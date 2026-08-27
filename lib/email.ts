import nodemailer from 'nodemailer'
import { slotLabel } from '@/lib/deliverySlots'

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
    city: string
    province: string
    postalCode: string
    notes: string
  }
  items: OrderItem[]
  subtotal: number
  shipping: number
  total: number
  deliverySlots?: string[]
}

// Web-safe stack — Outlook ignores `system-ui` and falls back to Times.
const FONT = "Arial,'Helvetica Neue',Helvetica,sans-serif"

function createTransport() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      // Gmail app passwords are shown in 4 space-separated groups for
      // readability; the spaces aren't part of the secret — strip them.
      pass: process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, ''),
    },
  })
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

// Totals block (subtotal / shipping / total) shared by both emails.
function totalsTable(subtotal: number, shipping: number, total: number, totalLabel: string, freeHtml: string): string {
  const td = `padding:6px 0;font-family:${FONT};font-size:14px;color:#5C3317;`
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
      <tr><td style="${td}">Subtotal</td><td style="${td}text-align:right;">₱${subtotal.toLocaleString()}</td></tr>
      <tr><td style="${td}">Shipping</td><td style="${td}text-align:right;">${shipping === 0 ? freeHtml : '₱' + shipping}</td></tr>
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
  const transporter = createTransport()
  const { orderId, customer, items, subtotal, shipping, total, deliverySlots } = data
  const customerName = `${customer.firstName} ${customer.lastName}`
  const deliveryWindow = deliverySlots?.length
    ? [...deliverySlots].sort().map(slotLabel).join(', ')
    : null

  // Staff to BCC on the admin notification (comma-separated env)
  const staffBcc = (process.env.BCC_EMAIL ?? '')
    .split(',')
    .map(e => e.trim())
    .filter(Boolean)

  const detailRow = (label: string, value: string) =>
    `<tr><td style="padding:6px 0;font-family:${FONT};color:#5C3317;font-size:13px;width:120px;">${label}</td><td style="padding:6px 0;font-family:${FONT};color:#1C0A00;">${value}</td></tr>`

  // ── Admin notification ──
  await transporter.sendMail({
    from: `"Make My Coffee" <${process.env.GMAIL_USER}>`,
    to: process.env.ADMIN_EMAIL,
    ...(staffBcc.length ? { bcc: staffBcc } : {}),
    subject: `New Order #${orderId} — ${customerName}`,
    html: base(`
      <h2 style="margin:0 0 4px;font-family:${FONT};color:#1C0A00;font-size:22px;">New Order Received</h2>
      <p style="margin:0 0 24px;font-family:${FONT};color:#8B5E0A;font-size:14px;">Order #${orderId}</p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:24px;">
        ${detailRow('Customer', `<strong>${customerName}</strong>`)}
        ${detailRow('Email', customer.email)}
        ${detailRow('Phone', customer.phone)}
        ${detailRow('Address', customer.address)}
        ${detailRow('City', `${customer.city}, ${customer.province} ${customer.postalCode}`)}
        ${deliveryWindow ? detailRow('Delivery Time', deliveryWindow) : ''}
        ${customer.notes ? detailRow('Notes', customer.notes) : ''}
      </table>

      ${itemsTable(items)}

      ${totalsTable(subtotal, shipping, total, 'Total (COD)', 'Free')}

      ${button(`${process.env.NEXT_PUBLIC_URL || 'https://makemycoffee.cafe'}/admin/orders`, 'View in Admin →')}
    `),
  })

  // ── Customer confirmation ──
  await transporter.sendMail({
    from: `"Make My Coffee" <${process.env.GMAIL_USER}>`,
    to: customer.email,
    // BCC staff on the customer confirmation too — silent to the customer,
    // so we and staff get a copy of every email we send.
    ...(staffBcc.length ? { bcc: staffBcc } : {}),
    subject: `Order Confirmed #${orderId} — Make My Coffee`,
    html: base(`
      <h2 style="margin:0 0 4px;font-family:${FONT};color:#1C0A00;font-size:22px;">Thank you, ${customer.firstName}!</h2>
      <p style="margin:0 0 24px;font-family:${FONT};color:#5C3317;font-size:15px;">Your order <strong>#${orderId}</strong> has been received and is being prepared.</p>

      ${itemsTable(items)}

      ${totalsTable(subtotal, shipping, total, 'Total to pay on delivery', '<span style="color:#16a34a;font-weight:600;">Free</span>')}

      ${infoBox(
        '#FAF6F1',
        '#F0E2D0',
        `<p style="margin:0 0 4px;font-family:${FONT};font-weight:600;color:#1C0A00;">📦 Delivery Address</p>
         <p style="margin:0;font-family:${FONT};color:#5C3317;font-size:14px;">${customer.address}<br>${customer.city}, ${customer.province} ${customer.postalCode}</p>`
      )}

      ${deliveryWindow ? infoBox(
        '#FAF6F1',
        '#F0E2D0',
        `<p style="margin:0 0 4px;font-family:${FONT};font-weight:600;color:#1C0A00;">🕐 Delivery Time</p>
         <p style="margin:0;font-family:${FONT};color:#5C3317;font-size:14px;">${deliveryWindow}</p>`
      ) : ''}

      ${infoBox(
        '#FFF8F0',
        '#E8C9A0',
        `<p style="margin:0 0 4px;font-family:${FONT};font-weight:600;color:#C8860A;">💵 Cash on Delivery</p>
         <p style="margin:0;font-family:${FONT};color:#5C3317;font-size:14px;">Please have <strong>₱${total.toLocaleString()}</strong> ready when your order arrives. No upfront payment required.</p>`
      )}
    `),
  })
}
