// Email signups, the welcome code and the running-low reminder (#39).
//
// Most of what can go wrong here is not a crash but a broken promise: a
// reminder mailed to someone who never asked, an unsubscribe that a mail
// scanner triggers, a code the email says is valid on a day it isn't, or a
// privacy page that still says we send no marketing at all. The tests are
// aimed at those.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import {
  REMINDER_GRACE_DAYS,
  SIGNUP_CONSENT,
  WELCOME_CODE_PREFIX,
  WELCOME_DISCOUNT,
  WELCOME_VOUCHER_DAYS,
  emailKey,
  generateWelcomeCode,
  isReminderDue,
  isUnsubscribeToken,
  isValidEmail,
  oldestDeliveryStillDue,
  reminderDueDate,
  totalShots,
  welcomeVoucherWindow,
} from '../lib/subscribe.ts'
import { addDays, formatDeliveryDate } from '../lib/deliveryDate.ts'
import { DAYS_FROM_DELIVERY, SHELF_LIFE, TRANSIT_STORAGE } from '../lib/freshness.ts'
import { isValidCode } from '../lib/vouchers.ts'
import { runningLowEmail, unsubscribeLinks, welcomeEmail } from '../lib/email.ts'

const read = (rel: string) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')

const TOKEN = 'abcdefghijklmnopqrstuvwxyz012345'

// ── The welcome code ──────────────────────────────────────────────────────

test('welcome codes are valid voucher codes, prefixed and unambiguous', () => {
  for (let i = 0; i < 500; i++) {
    const code = generateWelcomeCode()
    assert.ok(isValidCode(code), `${code} must be accepted by the voucher code rule`)
    assert.ok(code.startsWith(WELCOME_CODE_PREFIX))
    const body = code.slice(WELCOME_CODE_PREFIX.length)
    assert.equal(body.length, 8)
    assert.doesNotMatch(body, /[01OIL]/, 'no characters that read as each other off a phone screen')
  }
})

test('bytes that would bias the alphabet are skipped, not wrapped', () => {
  // 248 = 31 × 8. Anything at or above it would land on the first letters
  // more often if it were taken modulo 31.
  let call = 0
  const random = (n: number) => {
    call++
    return new Uint8Array(n).fill(call === 1 ? 250 : 0)
  }
  assert.equal(generateWelcomeCode(random), `${WELCOME_CODE_PREFIX}AAAAAAAA`)
  assert.equal(call, 2, 'the first, all-biased batch must be discarded entirely')
})

test('the code is good through the end of a Manila day, and the email can say which', () => {
  // 20:00 UTC on the 12th is already 04:00 on the 13th in Manila.
  const { lastDay, expiresAt } = welcomeVoucherWindow(new Date('2026-10-12T20:00:00Z'))
  assert.equal(lastDay, addDays('2026-10-13', WELCOME_VOUCHER_DAYS))
  assert.equal(expiresAt, `${addDays(lastDay, 1)}T00:00:00+08:00`)
  assert.equal(new Date(expiresAt).toISOString(), `${lastDay}T16:00:00.000Z`)
})

// ── The signup ────────────────────────────────────────────────────────────

test('one address is one subscriber however it is typed', () => {
  assert.equal(emailKey('  Ana.Cruz@Example.COM '), 'ana.cruz@example.com')
  assert.ok(isValidEmail(' ana@example.com '))
  for (const bad of ['', 'ana', 'ana@', '@example.com', 'ana@example', 'a b@example.com', 42, null, `${'a'.repeat(250)}@x.co`]) {
    assert.equal(isValidEmail(bad), false, `${String(bad).slice(0, 20)} must be refused`)
  }
})

test('the consent wording names every kind of email the list gets, and the way out', () => {
  assert.match(SIGNUP_CONSENT, new RegExp(`₱${WELCOME_DISCOUNT}`))
  assert.match(SIGNUP_CONSENT, /code/i)
  assert.match(SIGNUP_CONSENT, /running low/i)
  assert.match(SIGNUP_CONSENT, /offer/i)
  assert.match(SIGNUP_CONSENT, /unsubscribe/i)
})

test('the signup route will not record consent it did not ask for', () => {
  const route = read('../app/api/subscribe/route.ts')
  assert.match(route, /consent !== true/, 'the route must refuse a signup without consent: true')

  // The form renders the same wording the server stores.
  const form = read('../components/EmailSignup.tsx')
  assert.match(form, /\{SIGNUP_CONSENT\}/)
  assert.match(form, /consent: true/)
  assert.doesNotMatch(form, /mmc-consent|parseConsent|lib\/analytics/, 'cookie consent must not feed the email list')
  assert.match(read('../lib/subscriberStore.ts'), /\$\{SIGNUP_CONSENT\}/, 'the stored wording must be SIGNUP_CONSENT')
})

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const full = `${dir}/${entry}`
    if (statSync(full).isDirectory()) return entry === 'node_modules' ? [] : sourceFiles(full)
    return /\.(ts|tsx)$/.test(entry) ? [full] : []
  })
}

test('the signup form is the only way onto the list', () => {
  // /privacy promises that ordering and accepting cookies never add anyone.
  // Anything else writing to email_subscribers makes that false.
  const root = fileURLToPath(new URL('..', import.meta.url))
  const files = [...sourceFiles(`${root}app`), ...sourceFiles(`${root}lib`), ...sourceFiles(`${root}components`)]

  const inserters = files.filter(f => /INSERT INTO email_subscribers/i.test(readFileSync(f, 'utf8')))
  assert.deepEqual(inserters.map(f => f.slice(root.length)), ['lib/subscriberStore.ts'])

  const callers = files.filter(f => {
    const src = readFileSync(f, 'utf8')
    return /from '@\/lib\/subscriberStore'/.test(src) && /\bsubscribe\b[,\s}]/.test(src.match(/import \{([^}]*)\} from '@\/lib\/subscriberStore'/)?.[1] ?? '')
  })
  assert.deepEqual(callers.map(f => f.slice(root.length)), ['app/api/subscribe/route.ts'])
})

// ── Unsubscribe ───────────────────────────────────────────────────────────

test('unsubscribe tokens are exactly what the store mints', () => {
  assert.ok(isUnsubscribeToken(Buffer.alloc(24, 7).toString('base64url')))
  for (const bad of ['', 'short', `${TOKEN}x`, `${TOKEN.slice(0, 31)}!`, null, 32]) {
    assert.equal(isUnsubscribeToken(bad), false)
  }
})

test('unsubscribing is a POST, never a GET a mail scanner could trigger', () => {
  const route = read('../app/api/unsubscribe/route.ts')
  assert.match(route, /export async function POST/)
  assert.doesNotMatch(route, /export async function GET/)

  const form = read('../app/(storefront)/unsubscribe/UnsubscribeForm.tsx')
  assert.doesNotMatch(form, /useEffect/, 'the page must wait for a click, not act on load')
})

for (const [name, msg] of [
  ['welcome', welcomeEmail({ subscriberId: 7, email: 'ana@example.com', code: 'HELLO-ABCDEFGH', lastDay: '2026-11-12', unsubscribeToken: TOKEN })],
  ['running-low', runningLowEmail({ orderId: 41, firstName: 'Ana', email: 'ana@example.com', shots: 7, deliveryDate: '2026-10-05', unsubscribeToken: TOKEN })],
] as const) {
  test(`the ${name} email works the way out from the first send`, () => {
    const links = unsubscribeLinks(TOKEN)
    assert.equal(msg.headers?.['List-Unsubscribe'], `<${links.oneClick}>`)
    assert.equal(msg.headers?.['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click')
    assert.ok(msg.html.includes(links.page), 'a visible unsubscribe link in the body')
    assert.match(links.oneClick, /\/api\/unsubscribe\?token=/)
    assert.match(links.page, /\/unsubscribe\?token=/)
  })

  test(`the ${name} email is not copied to staff`, () => {
    // The footer link unsubscribes whoever's token it carries; a staff copy is
    // one stray click from unsubscribing the customer.
    assert.equal(msg.bcc, undefined)
  })
}

test('the welcome email states the code, the amount and the last valid day', () => {
  const msg = welcomeEmail({ subscriberId: 7, email: 'ana@example.com', code: 'HELLO-ABCDEFGH', lastDay: '2026-11-12', unsubscribeToken: TOKEN })
  assert.ok(msg.html.includes('HELLO-ABCDEFGH'))
  assert.match(msg.subject, new RegExp(`₱${WELCOME_DISCOUNT}`))
  assert.ok(msg.html.includes(formatDeliveryDate('2026-11-12')))
  assert.equal(msg.idempotencyKey, 'welcome-7')
})

test('the reminder states facts — what arrived, when — and escapes the name', () => {
  const msg = runningLowEmail({
    orderId: 41, firstName: '<b>Ana</b>', email: 'ana@example.com', shots: 7,
    deliveryDate: '2026-10-05', unsubscribeToken: TOKEN, now: new Date('2026-10-11T02:00:00Z'),
  })
  assert.match(msg.html, /7 shots/)
  assert.ok(msg.html.includes(formatDeliveryDate('2026-10-05')))
  assert.ok(msg.html.includes(formatDeliveryDate('2026-10-12')), 'the earliest new delivery is tomorrow in Manila')
  assert.ok(!msg.html.includes('<b>Ana</b>'), 'a name from the checkout form must not become markup')
  assert.equal(msg.idempotencyKey, 'running-low-41')
  // No fee, no price: neither is knowable for an order not yet placed.
  assert.doesNotMatch(msg.html, /₱/)
  // The shelf-life claim travels only with the fridge instruction; the email
  // carries neither half rather than one.
  assert.ok(!msg.html.includes(SHELF_LIFE) && !msg.html.includes(TRANSIT_STORAGE))
})

// ── When the reminder is due ──────────────────────────────────────────────

test('shots are counted from the items snapshot, ignoring anything malformed', () => {
  assert.equal(totalShots([{ shots: 7, quantity: 2 }, { shots: 4, quantity: 1 }]), 18)
  assert.equal(totalShots([{ shots: '10', quantity: '1' }]), 10)
  assert.equal(totalShots([{ shots: -4, quantity: 1 }, { quantity: 3 }, null, 'x']), 0)
  assert.equal(totalShots(null), 0)
  assert.equal(totalShots('[]'), 0)
})

test('a bottle is reminded the day before it runs out, never past its freshness window', () => {
  // A coffee a day; the next order can arrive tomorrow at the earliest.
  assert.equal(reminderDueDate('2026-10-05', 4), '2026-10-08')
  assert.equal(reminderDueDate('2026-10-05', 7), addDays('2026-10-05', Math.min(7, DAYS_FROM_DELIVERY) - 1))
  // A bigger order still can't outlast the window.
  for (const shots of [10, 14, 30]) {
    assert.equal(reminderDueDate('2026-10-05', shots), addDays('2026-10-05', DAYS_FROM_DELIVERY - 1))
  }
  // Nothing parsed out of the items still gets a date, not NaN.
  assert.equal(reminderDueDate('2026-10-05', 0), '2026-10-05')
})

test('a reminder is due on the day or a little late, never early', () => {
  const today = '2026-10-12'
  assert.equal(isReminderDue(today, today), true)
  assert.equal(isReminderDue(addDays(today, -REMINDER_GRACE_DAYS), today), true)
  assert.equal(isReminderDue(addDays(today, -REMINDER_GRACE_DAYS - 1), today), false, 'old orders are not mailed on launch day')
  assert.equal(isReminderDue(addDays(today, 1), today), false)
})

test('the candidate query never cuts off an order that is due', () => {
  // The SQL bound comes from oldestDeliveryStillDue(); the due date from
  // reminderDueDate(). If they disagree, a reminder silently never goes out.
  const today = '2026-10-12'
  for (let back = 0; back <= 30; back++) {
    const delivered = addDays(today, -back)
    for (const shots of [1, 4, 7, 10, 14, 21, 40]) {
      if (isReminderDue(reminderDueDate(delivered, shots), today)) {
        assert.ok(delivered >= oldestDeliveryStillDue(today), `${delivered} (${shots} shots) is due but outside the scan`)
      }
    }
  }
})

// ── Wiring ────────────────────────────────────────────────────────────────

test('the reminder job runs on a schedule and refuses to run open', () => {
  const vercel = JSON.parse(read('../vercel.json'))
  assert.ok(vercel.crons.some((c: { path: string }) => c.path === '/api/cron/running-low'))

  const route = read('../app/api/cron/running-low/route.ts')
  assert.match(route, /process\.env\.CRON_SECRET/)
  assert.match(route, /timingSafeEqual/)
  assert.match(route, /if \(!secret\) return false/, 'an unset secret must refuse, not allow')
})

test('the privacy policy describes the list as it now is', () => {
  const page = read('../app/(storefront)/privacy/page.tsx')
  assert.doesNotMatch(page, /We do not send marketing email/, 'that sentence stopped being true with #39')
  assert.match(page, /\{SIGNUP_CONSENT\}/, 'quote the wording people actually agree to')
  assert.match(page, /email_subscribers/, 'the collection list mirrors the tables, this one included')
  assert.match(page, /accepting\s+cookies/i, 'say plainly that cookie consent is not email consent')
  assert.match(page, /Unsubscrib/)

  const business = read('../lib/business.ts')
  assert.doesNotMatch(business, /PRIVACY_UPDATED = '7 October 2026'/, 'move the date with the text')
})

test('checkout cannot place an order while a voucher is unapplied or still checking', () => {
  // Welcome codes are pasted from an email; posting `voucher?.code` while the
  // check is in flight charged full price beside a discounted summary.
  const page = read('../app/(storefront)/order/page.tsx')
  assert.match(page, /disabled=\{loading \|\| quoting \|\| checkingVoucher\}/)
  assert.match(page, /if \(checkingVoucher\) return/)
  assert.match(page, /if \(!voucher && voucherInput\.trim\(\)\)/)
})
