// The two payment-method lists and the QR account table behind them.
//
// The split matters: what a customer may pick at checkout is narrower than what
// an admin may record on "Mark Paid", and POST /api/orders rejects anything
// outside the checkout set. A method drifting between the two lists — or a QR
// entry pointing at a file that doesn't exist — breaks that quietly, so both
// are pinned here.

import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import {
  CHECKOUT_PAYMENT_METHODS,
  DEFAULT_PAYMENT_METHOD,
  PAYMENT_METHODS,
  QR_ACCOUNTS,
  isCheckoutPaymentMethod,
  isPaymentMethod,
  paymentMethodLabel,
  qrAccountFor,
} from '../lib/paymentMethods.ts'

test('every checkout method is also a recordable admin method', () => {
  for (const method of CHECKOUT_PAYMENT_METHODS) {
    assert.ok(isPaymentMethod(method), `${method} is missing from PAYMENT_METHODS`)
  }
})

test('bank_transfer is admin-only — a customer cannot pick it', () => {
  assert.ok(isPaymentMethod('bank_transfer'))
  assert.equal(isCheckoutPaymentMethod('bank_transfer'), false)
})

test('rejects methods that are on neither list', () => {
  for (const junk of ['venmo', '', 'COD', undefined, null, 7, {}]) {
    assert.equal(isPaymentMethod(junk), false)
    assert.equal(isCheckoutPaymentMethod(junk), false)
  }
})

test('the default is a real checkout method', () => {
  assert.ok(isCheckoutPaymentMethod(DEFAULT_PAYMENT_METHOD))
})

test('labels fall back to the raw value rather than rendering blank', () => {
  assert.equal(paymentMethodLabel('gotyme'), 'GoTyme Bank')
  assert.equal(paymentMethodLabel('venmo'), 'venmo')
})

test('every checkout method except COD has a QR account, and vice versa', () => {
  const qrMethods = QR_ACCOUNTS.map(a => a.method).sort()
  const expected = CHECKOUT_PAYMENT_METHODS.filter(m => m !== 'cod').sort()
  assert.deepEqual(qrMethods, expected)
  assert.equal(qrAccountFor('cod'), null)
  assert.equal(qrAccountFor('bank_transfer'), null)
})

test('each QR image exists under public/ at the declared dimensions', async () => {
  const publicDir = fileURLToPath(new URL('../public', import.meta.url))
  for (const account of QR_ACCOUNTS) {
    assert.ok(account.image.startsWith('/qr/'), `${account.method} image must be a public path`)
    assert.ok(
      existsSync(publicDir + account.image),
      `${account.method}: public${account.image} is missing — the email links this URL directly`
    )
    // Width/height feed <Image>'s layout box; a wrong aspect ratio squashes the
    // QR, and a squashed QR does not scan.
    const { width, height } = await jpegSize(publicDir + account.image)
    assert.equal(width, account.width, `${account.method}: declared width is wrong`)
    assert.equal(height, account.height, `${account.method}: declared height is wrong`)
  }
})

test('every QR account names an account holder and a reference to check', () => {
  for (const account of QR_ACCOUNTS) {
    assert.ok(account.accountName.trim(), `${account.method} has no account name`)
    assert.ok(account.accountRef.trim(), `${account.method} has no account reference`)
    assert.ok(account.accountRefLabel.trim(), `${account.method} has no reference label`)
    assert.ok(account.scanHint.trim(), `${account.method} has no scan hint`)
  }
})

// Minimal JPEG dimension reader — walks the segment markers to the SOF frame.
// Cheaper than pulling in an image library for one assertion.
async function jpegSize(path: string): Promise<{ width: number; height: number }> {
  const { readFile } = await import('node:fs/promises')
  const buf = await readFile(path)
  assert.equal(buf.readUInt16BE(0), 0xffd8, `${path} is not a JPEG`)

  let offset = 2
  while (offset < buf.length) {
    assert.equal(buf[offset], 0xff, `${path}: lost segment alignment at ${offset}`)
    const marker = buf[offset + 1]
    const length = buf.readUInt16BE(offset + 2)
    // SOF0/1/2/9/10 carry the frame header; DHT/DAC/SOS (0xC4/0xC8/0xCC) don't.
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: buf.readUInt16BE(offset + 5), width: buf.readUInt16BE(offset + 7) }
    }
    offset += 2 + length
  }
  throw new Error(`${path}: no SOF marker found`)
}
