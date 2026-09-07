import nodemailer from 'nodemailer'
// Relative, with extensions, like lib/voucherInput.ts — these have to resolve
// under `node --experimental-strip-types` for tests/statusEmails.test.ts, and
// the `@/` alias is a bundler concern that plain node knows nothing about.
import { slotLabel } from './deliverySlots.ts'
import { DEFAULT_PAYMENT_METHOD, paymentMethodLabel, qrAccountFor } from './paymentMethods.ts'
import type { AppliedVoucher } from './vouchers.ts'

interface OrderItem {
  id: string
  name: string
  shots: number
  price: number
  quantity: number
}

export interface OrderEmailData {
  orderId: number
  customer: {
    firstName: string
    lastName: string
    email: string
    phone: string
    address: string
    barangay?: string
    city: string
    province: string
    postalCode: string
    notes: string
  }
  items: OrderItem[]
  subtotal: number
  discount: number
  shipping: number
  total: number
  deliverySlots?: string[]
  voucher?: AppliedVoucher | null
  /** What the customer picked at checkout. Never a claim that they paid. */
  paymentMethod?: string
}

// Web-safe stack — Outlook ignores `system-ui` and falls back to Times.
const FONT = "Arial,'Helvetica Neue',Helvetica,sans-serif"

let warnedNoCredentials = false

// nodemailer's jsonTransport resolves sendMail() without opening a socket, so
// the whole compose path still runs — templates rendered, every message built —
// while nothing leaves the machine.
function mockTransport() {
  return nodemailer.createTransport({ jsonTransport: true })
}

// ── Delivery ──────────────────────────────────────────────────────────────
//
// Three ways out, chosen per-call in this order:
//
//   1. mocked   — EMAIL_TRANSPORT=json, or no credentials at all
//   2. Resend   — RESEND_API_KEY set; sends as MAIL_FROM, i.e. our own domain
//   3. Gmail    — the original path, kept as a fallback
//
// The mock check is deliberately first. The e2e suite sets EMAIL_TRANSPORT=json
// (playwright.config.ts) and runs against a throwaway Neon branch with real
// order data in it; if a stray RESEND_API_KEY in the environment could outrank
// that, a test run would mail invented customers for real.
//
// Gmail stays because it's what is configured today and a domain can fail
// verification. Note it cannot honour MAIL_FROM — Gmail rewrites a From it
// doesn't own — so while that path is live, mail still comes from the Gmail
// account. That's the whole reason for moving to Resend.

export interface OutboundMessage {
  to: string | string[]
  bcc?: string[]
  subject: string
  html: string
  /**
   * Stable per-message identity, e.g. `order-41-shipped`. Resend rejects a
   * repeat of the same key within 24h, so a retried admin click or a
   * re-delivered request can't mail the customer twice.
   */
  idempotencyKey?: string
}

function mailFrom(): string {
  return process.env.MAIL_FROM || 'Make My Coffee <orders@makemycoffee.cafe>'
}

// Customers reply to these — with a payment screenshot, most of all (D13).
// Point that at a human rather than at a send-only mailbox.
function replyTo(): string | undefined {
  return process.env.ADMIN_EMAIL || undefined
}

async function deliverViaResend(msg: OutboundMessage, apiKey: string): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(msg.idempotencyKey ? { 'Idempotency-Key': msg.idempotencyKey } : {}),
    },
    body: JSON.stringify({
      from: mailFrom(),
      to: msg.to,
      ...(msg.bcc?.length ? { bcc: msg.bcc } : {}),
      ...(replyTo() ? { reply_to: replyTo() } : {}),
      subject: msg.subject,
      html: msg.html,
    }),
  })

  if (!res.ok) {
    // Resend reports a rejected send as a 4xx with a JSON body naming the
    // reason — an unverified domain being the common one. Surface it; the
    // caller decides whether it's fatal (it isn't — see D5).
    const detail = await res.text().catch(() => '')
    throw new Error(`Resend refused the message (${res.status}): ${detail.slice(0, 300)}`)
  }
}

async function deliverViaGmail(msg: OutboundMessage, user: string, pass: string): Promise<void> {
  const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } })
  await transporter.sendMail({
    from: `"Make My Coffee" <${user}>`,
    to: msg.to,
    ...(msg.bcc?.length ? { bcc: msg.bcc } : {}),
    ...(replyTo() ? { replyTo: replyTo() } : {}),
    subject: msg.subject,
    html: msg.html,
  })
}

async function deliver(msg: OutboundMessage): Promise<void> {
  if (process.env.EMAIL_TRANSPORT === 'json') {
    await mockTransport().sendMail({ from: mailFrom(), to: msg.to, subject: msg.subject, html: msg.html })
    return
  }

  const resendKey = process.env.RESEND_API_KEY
  if (resendKey) return deliverViaResend(msg, resendKey)

  const user = process.env.GMAIL_USER
  // Gmail app passwords are shown in 4 space-separated groups for
  // readability; the spaces aren't part of the secret — strip them.
  const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, '')
  if (user && pass) return deliverViaGmail(msg, user, pass)

  // Absent credentials are a misconfiguration in production — but dialling a
  // provider to discover that just burns failed auth attempts. Mock and say so
  // instead. Either way the order is unaffected: mail is fire-and-forget by
  // design (decision.md D5).
  if (!warnedNoCredentials) {
    console.warn(
      'Neither RESEND_API_KEY nor GMAIL_USER/GMAIL_APP_PASSWORD is set — email is being mocked, not delivered.'
    )
    warnedNoCredentials = true
  }
  await mockTransport().sendMail({ from: mailFrom(), to: msg.to, subject: msg.subject, html: msg.html })
}

// Staff copied on everything we send (comma-separated env).
function staffBcc(): string[] {
  return (process.env.BCC_EMAIL ?? '').split(',').map(e => e.trim()).filter(Boolean)
}

function itemsTable(items: OrderItem[]): string {
  const cell = `padding:10px 12px;border-bottom:1px solid #F5E6D3;font-family:${FONT};font-size:14px;color:#1C0A00;`
  const head = `padding:10px 12px;font-family:${FONT};font-size:12px;color:#8B5E0A;text-transform:uppercase;letter-spacing:.05em;`
  const rows = items
    .map(
      item => `
        <tr>
          <td style="${cell}">${item.name} (${item.shots} shots)</td>
          <td style="${cell}text-align:center;">×${item.quantity}</td>
          <td style="${cell}text-align:right;font-weight:600;">₱${(item.price * item.quantity).toLocaleString()}</td>
        </tr>`
    )
    .join('')
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;margin:16px 0;">
      <thead>
        <tr>
          <th bgcolor="#FAF6F1" align="left" style="${head}background:#FAF6F1;">Item</th>
          <th bgcolor="#FAF6F1" align="center" style="${head}background:#FAF6F1;">Qty</th>
          <th bgcolor="#FAF6F1" align="right" style="${head}background:#FAF6F1;">Price</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`
}

// Totals block (subtotal / discount / shipping / total) shared by both emails.
// The discount row only appears when a voucher actually took money off — a
// free-delivery voucher shows up on the shipping row instead, so rendering an
// unconditional "− ₱0" line would read as a bug to the customer.
function totalsTable(
  subtotal: number,
  discount: number,
  shipping: number,
  total: number,
  totalLabel: string,
  freeHtml: string,
  voucher?: AppliedVoucher | null
): string {
  const td = `padding:6px 0;font-family:${FONT};font-size:14px;color:#5C3317;`
  const discountRow = discount > 0
    ? `<tr>
         <td style="${td}color:#16a34a;">Voucher${voucher ? ` (${voucher.code})` : ''}</td>
         <td style="${td}text-align:right;color:#16a34a;font-weight:600;">− ₱${discount.toLocaleString()}</td>
       </tr>`
    : ''
  const shippingValue = shipping === 0
    ? (voucher?.freeShipping ? `<span style="color:#16a34a;font-weight:600;">Free (${voucher.code})</span>` : freeHtml)
    : '₱' + shipping
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
      <tr><td style="${td}">Subtotal</td><td style="${td}text-align:right;">₱${subtotal.toLocaleString()}</td></tr>
      ${discountRow}
      <tr><td style="${td}">Shipping</td><td style="${td}text-align:right;">${shippingValue}</td></tr>
      <tr>
        <td style="padding:12px 0 0;border-top:2px solid #F5E6D3;font-family:${FONT};font-weight:700;font-size:16px;color:#1C0A00;">${totalLabel}</td>
        <td style="padding:12px 0 0;border-top:2px solid #F5E6D3;font-family:${FONT};text-align:right;font-weight:700;font-size:18px;color:#C8860A;">₱${total.toLocaleString()}</td>
      </tr>
    </table>`
}

// Padded-cell button: padding lives on the <td> (Outlook honors it there,
// not on <a>). Corners round everywhere except Outlook, which squares them.
function button(href: string, label: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:24px;">
      <tr>
        <td align="center" bgcolor="#1C0A00" style="background:#1C0A00;border-radius:99px;padding:12px 24px;">
          <a href="${href}" style="font-family:${FONT};font-size:14px;font-weight:600;color:#F5E6D3;text-decoration:none;">${label}</a>
        </td>
      </tr>
    </table>`
}

// Tinted info box as a single-cell table (div backgrounds/padding are unreliable in Outlook).
function infoBox(bg: string, border: string, inner: string): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;background:${bg};border:1px solid ${border};border-radius:12px;">
      <tr><td bgcolor="${bg}" style="background:${bg};padding:16px 20px;">${inner}</td></tr>
    </table>`
}

// Absolute base for anything the email has to link or load. Email clients have
// no page context, so relative paths are dead — and the QR lives at a stable
// /qr/... path (not a hashed /_next/static one) precisely so an email sent
// today still renders its image after the next deploy.
function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_URL || 'https://makemycoffee.cafe').replace(/\/+$/, '')
}

// The "how to pay" block. COD keeps its original wording; the QR wallets get
// the code itself, because the account numbers the wallets print on a share-QR
// are masked — scanning is the only way for the customer to address the
// payment, so the image has to survive into the inbox.
//
// Remote images are blocked by default in plenty of clients, so every scrap of
// information the QR carries is repeated in text and a plain link to the image
// is offered underneath. Nothing here is verified: the customer is told what to
// send and asked to send proof, and an admin confirms it by hand.
function paymentBox(method: string, orderId: number, total: number): string {
  const account = qrAccountFor(method)

  if (!account) {
    return infoBox(
      '#FFF8F0',
      '#E8C9A0',
      `<p style="margin:0 0 4px;font-family:${FONT};font-weight:600;color:#C8860A;">💵 Cash on Delivery</p>
       <p style="margin:0;font-family:${FONT};color:#5C3317;font-size:14px;">Please have <strong>₱${total.toLocaleString()}</strong> ready when your order arrives. No upfront payment required.</p>`
    )
  }

  const src = `${siteUrl()}${account.image}`
  const displayWidth = 200
  const displayHeight = Math.round((account.height / account.width) * displayWidth)

  return infoBox(
    '#FFF8F0',
    '#E8C9A0',
    `<p style="margin:0 0 4px;font-family:${FONT};font-weight:600;color:#C8860A;">📱 Pay with ${account.label}</p>
     <p style="margin:0 0 12px;font-family:${FONT};color:#5C3317;font-size:14px;">Send <strong>₱${total.toLocaleString()}</strong> to the account below, then reply with a screenshot of your receipt quoting order <strong>#${orderId}</strong>. We'll confirm your payment by hand — your order is already placed either way.</p>
     <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 10px;">
       <tr>
         <td style="background:#ffffff;border:1px solid #F0E2D0;border-radius:10px;padding:8px;">
           <a href="${src}" style="text-decoration:none;"><img src="${src}" alt="${account.label} QR code for ${account.accountName}" width="${displayWidth}" height="${displayHeight}" style="display:block;width:${displayWidth}px;height:auto;border:0;outline:none;"></a>
         </td>
       </tr>
     </table>
     <p style="margin:0 0 2px;font-family:${FONT};color:#1C0A00;font-size:14px;font-weight:600;">${account.accountName}</p>
     <p style="margin:0 0 10px;font-family:${FONT};color:#5C3317;font-size:13px;">${account.accountRefLabel}: ${account.accountRef}</p>
     <p style="margin:0;font-family:${FONT};color:#8B5E0A;font-size:12px;">QR not showing? <a href="${src}" style="color:#C8860A;">Open it here</a>. ${account.scanHint}</p>`
  )
}

function base(content: string): string {
  return `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <!--[if mso]>
  <style>table,td{border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;}</style>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background:#FAF6F1;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FAF6F1;">
    <tr>
      <td align="center" style="padding:32px 12px;">
        <!--[if mso]><table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #F0E2D0;">
          <tr>
            <td bgcolor="#1C0A00" style="background:#1C0A00;padding:24px 32px;font-family:${FONT};">
              <p style="margin:0;color:#C8860A;font-size:12px;letter-spacing:.1em;text-transform:uppercase;">Make My Coffee</p>
              <p style="margin:4px 0 0;color:#F5E6D3;font-size:20px;font-weight:700;">Aconchego Espresso Shots</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;font-family:${FONT};color:#1C0A00;">${content}</td>
          </tr>
          <tr>
            <td bgcolor="#FAF6F1" align="center" style="background:#FAF6F1;padding:16px 32px;font-family:${FONT};">
              <p style="margin:0;font-size:12px;color:#8B5E0A;">makemycoffee.cafe · Aconchego Signature Blend</p>
            </td>
          </tr>
        </table>
        <!--[if mso]></td></tr></table><![endif]-->
      </td>
    </tr>
  </table>
</body></html>`
}

export async function sendOrderEmails(data: OrderEmailData) {
  const { orderId, customer, items, subtotal, discount, shipping, total, deliverySlots, voucher } = data
  const paymentMethod = data.paymentMethod ?? DEFAULT_PAYMENT_METHOD
  const isQr = qrAccountFor(paymentMethod) !== null
  const customerName = `${customer.firstName} ${customer.lastName}`
  const deliveryWindow = deliverySlots?.length
    ? [...deliverySlots].sort().map(slotLabel).join(', ')
    : null

  const bcc = staffBcc()

  const detailRow = (label: string, value: string) =>
    `<tr><td style="padding:6px 0;font-family:${FONT};color:#5C3317;font-size:13px;width:120px;">${label}</td><td style="padding:6px 0;font-family:${FONT};color:#1C0A00;">${value}</td></tr>`

  // ── Admin notification ──
  await deliver({
    to: process.env.ADMIN_EMAIL ?? '',
    bcc,
    idempotencyKey: `order-${orderId}-admin`,
    subject: `New Order #${orderId} — ${customerName}`,
    html: base(`
      <h2 style="margin:0 0 4px;font-family:${FONT};color:#1C0A00;font-size:22px;">New Order Received</h2>
      <p style="margin:0 0 24px;font-family:${FONT};color:#8B5E0A;font-size:14px;">Order #${orderId}</p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
        ${detailRow('Customer', `<strong>${customerName}</strong>`)}
        ${detailRow('Email', customer.email)}
        ${detailRow('Phone', customer.phone)}
        ${detailRow('Address', customer.address)}
        ${customer.barangay ? detailRow('Barangay', customer.barangay) : ''}
        ${detailRow('City', `${customer.city}, ${customer.province} ${customer.postalCode}`)}
        ${deliveryWindow ? detailRow('Delivery Time', deliveryWindow) : ''}
        ${detailRow('Payment', isQr
          ? `<strong>${paymentMethodLabel(paymentMethod)}</strong> — customer says they'll pay by QR. Unverified: confirm the money landed before marking this paid.`
          : `<strong>${paymentMethodLabel(paymentMethod)}</strong>`)}
        ${voucher ? detailRow('Voucher', `<strong>${voucher.code}</strong> — ${voucher.label}`) : ''}
        ${customer.notes ? detailRow('Notes', customer.notes) : ''}
      </table>

      ${itemsTable(items)}

      ${totalsTable(subtotal, discount, shipping, total, `Total (${paymentMethodLabel(paymentMethod)})`, 'Free', voucher)}

      ${button(`${process.env.NEXT_PUBLIC_URL || 'https://makemycoffee.cafe'}/admin/orders`, 'View in Admin →')}
    `),
  })

  // ── Customer confirmation ──
  await deliver({
    to: customer.email,
    // BCC staff on the customer confirmation too — silent to the customer,
    // so we and staff get a copy of every email we send.
    bcc,
    idempotencyKey: `order-${orderId}-confirmation`,
    subject: `Order Confirmed #${orderId} — Make My Coffee`,
    html: base(`
      <h2 style="margin:0 0 4px;font-family:${FONT};color:#1C0A00;font-size:22px;">Thank you, ${customer.firstName}!</h2>
      <p style="margin:0 0 24px;font-family:${FONT};color:#5C3317;font-size:15px;">Your order <strong>#${orderId}</strong> has been received and is being prepared.</p>

      ${itemsTable(items)}

      ${totalsTable(subtotal, discount, shipping, total, isQr ? 'Total to pay' : 'Total to pay on delivery', '<span style="color:#16a34a;font-weight:600;">Free</span>', voucher)}

      ${infoBox(
        '#FAF6F1',
        '#F0E2D0',
        `<p style="margin:0 0 4px;font-family:${FONT};font-weight:600;color:#1C0A00;">📦 Delivery Address</p>
         <p style="margin:0;font-family:${FONT};color:#5C3317;font-size:14px;">${customer.address}${customer.barangay ? `, Brgy. ${customer.barangay}` : ''}<br>${customer.city}, ${customer.province} ${customer.postalCode}</p>`
      )}

      ${deliveryWindow ? infoBox(
        '#FAF6F1',
        '#F0E2D0',
        `<p style="margin:0 0 4px;font-family:${FONT};font-weight:600;color:#1C0A00;">🕐 Delivery Time</p>
         <p style="margin:0;font-family:${FONT};color:#5C3317;font-size:14px;">${deliveryWindow}</p>`
      ) : ''}

      ${paymentBox(paymentMethod, orderId, total)}
    `),
  })
}

// ── Order status updates ──────────────────────────────────────────────────
//
// Only two transitions are worth a customer's inbox: the order leaving, and
// the order arriving. 'approved' is internal bookkeeping — from the customer's
// side nothing has happened that the confirmation email didn't already
// promise — and 'cancelled' deliberately isn't here either: a cancellation is
// a conversation, not a notification, and it usually needs a human explaining
// why. Adding it later means adding copy, not plumbing.
export const NOTIFIED_ORDER_STATUSES = ['shipped', 'delivered'] as const

export type NotifiedOrderStatus = (typeof NOTIFIED_ORDER_STATUSES)[number]

export function notifiesCustomer(status: unknown): status is NotifiedOrderStatus {
  return typeof status === 'string' && (NOTIFIED_ORDER_STATUSES as readonly string[]).includes(status)
}

export interface OrderStatusEmailData {
  orderId: number
  status: NotifiedOrderStatus
  customer: {
    firstName: string
    email: string
    address: string
    barangay?: string
    city: string
    province: string
    postalCode: string
  }
  total: number
  deliverySlots?: string[]
  paymentMethod?: string
  /** 'paid' suppresses the payment reminder; anything else keeps it. */
  paymentStatus?: string
}

/**
 * Shapes an `orders` row (snake_case, straight out of the UPDATE ... RETURNING)
 * into what the status email needs. Lives here rather than in the route so it
 * can be tested without a database.
 */
export function statusEmailFromOrderRow(
  row: Record<string, unknown>,
  status: NotifiedOrderStatus
): OrderStatusEmailData {
  const str = (v: unknown) => (typeof v === 'string' ? v : '')
  return {
    orderId: Number(row.id),
    status,
    customer: {
      firstName: str(row.first_name),
      email: str(row.email),
      address: str(row.address),
      barangay: str(row.barangay) || undefined,
      city: str(row.city),
      province: str(row.province),
      postalCode: str(row.postal_code),
    },
    total: Number(row.total ?? 0),
    deliverySlots: Array.isArray(row.delivery_slots) ? (row.delivery_slots as string[]) : [],
    paymentMethod: str(row.payment_method) || DEFAULT_PAYMENT_METHOD,
    paymentStatus: str(row.payment_status) || 'unpaid',
  }
}

const STATUS_COPY: Record<NotifiedOrderStatus, { subject: (id: number) => string; heading: (name: string) => string; lead: string }> = {
  shipped: {
    subject: id => `Your order #${id} is on its way — Make My Coffee`,
    heading: name => `On the way, ${name}!`,
    lead: 'Your order has left us and is heading to the address below. Please keep your phone reachable — our rider may call when they are close.',
  },
  delivered: {
    subject: id => `Order #${id} delivered — Make My Coffee`,
    heading: name => `Delivered. Enjoy, ${name}!`,
    lead: 'Your order has been marked delivered. Keep the bottle chilled and shake before pouring — each 30ml shot is a full espresso.',
  },
}

export async function sendOrderStatusEmail(data: OrderStatusEmailData) {
  const { orderId, status, customer, total, deliverySlots, paymentStatus } = data
  const paymentMethod = data.paymentMethod ?? DEFAULT_PAYMENT_METHOD
  const copy = STATUS_COPY[status]
  const deliveryWindow = deliverySlots?.length
    ? [...deliverySlots].sort().map(slotLabel).join(', ')
    : null

  // Payment is still the customer's to complete on anything not yet marked
  // paid — which, given nothing verifies a QR wallet (D13), is most orders at
  // the moment they ship. Repeat the QR here: this is the last email before
  // the goods arrive, and for a delivered-but-unpaid order it's the only
  // prompt they'll get.
  const unpaid = paymentStatus !== 'paid'

  await deliver({
    to: customer.email,
    bcc: staffBcc(),
    // One notification per order per status, however many times the admin
    // clicks — the route already guards against a repeat transition, this
    // guards against a retried request.
    idempotencyKey: `order-${orderId}-${status}`,
    subject: copy.subject(orderId),
    html: base(`
      <h2 style="margin:0 0 4px;font-family:${FONT};color:#1C0A00;font-size:22px;">${copy.heading(customer.firstName)}</h2>
      <p style="margin:0 0 24px;font-family:${FONT};color:#8B5E0A;font-size:14px;">Order #${orderId}</p>

      <p style="margin:0 0 24px;font-family:${FONT};color:#5C3317;font-size:15px;">${copy.lead}</p>

      ${infoBox(
        '#FAF6F1',
        '#F0E2D0',
        `<p style="margin:0 0 4px;font-family:${FONT};font-weight:600;color:#1C0A00;">📦 Delivery Address</p>
         <p style="margin:0;font-family:${FONT};color:#5C3317;font-size:14px;">${customer.address}${customer.barangay ? `, Brgy. ${customer.barangay}` : ''}<br>${customer.city}, ${customer.province} ${customer.postalCode}</p>`
      )}

      ${status === 'shipped' && deliveryWindow ? infoBox(
        '#FAF6F1',
        '#F0E2D0',
        `<p style="margin:0 0 4px;font-family:${FONT};font-weight:600;color:#1C0A00;">🕐 Delivery Time</p>
         <p style="margin:0;font-family:${FONT};color:#5C3317;font-size:14px;">${deliveryWindow}</p>`
      ) : ''}

      ${unpaid
        ? paymentBox(paymentMethod, orderId, total)
        : infoBox(
            '#F0FDF4',
            '#BBF7D0',
            `<p style="margin:0 0 4px;font-family:${FONT};font-weight:600;color:#16a34a;">✅ Paid</p>
             <p style="margin:0;font-family:${FONT};color:#5C3317;font-size:14px;">₱${total.toLocaleString()} received — nothing to prepare.</p>`
          )}

      <p style="margin:0;font-family:${FONT};color:#8B5E0A;font-size:13px;">Something wrong with this order? Just reply to this email.</p>
    `),
  })
}
