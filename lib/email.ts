import nodemailer from 'nodemailer'

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
}

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
  const rows = items
    .map(
      item => `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #F5E6D3;">${item.name} (${item.shots} shots)</td>
          <td style="padding:10px 12px;border-bottom:1px solid #F5E6D3;text-align:center;">×${item.quantity}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #F5E6D3;text-align:right;font-weight:600;">₱${(item.price * item.quantity).toLocaleString()}</td>
        </tr>`
    )
    .join('')
  return `
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin:16px 0;">
      <thead>
        <tr style="background:#FAF6F1;">
          <th style="padding:10px 12px;text-align:left;font-size:12px;color:#8B5E0A;text-transform:uppercase;letter-spacing:.05em;">Item</th>
          <th style="padding:10px 12px;text-align:center;font-size:12px;color:#8B5E0A;text-transform:uppercase;letter-spacing:.05em;">Qty</th>
          <th style="padding:10px 12px;text-align:right;font-size:12px;color:#8B5E0A;text-transform:uppercase;letter-spacing:.05em;">Price</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`
}

function base(content: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#FAF6F1;font-family:system-ui,sans-serif;">
  <div style="max-width:560px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">
    <div style="background:#1C0A00;padding:24px 32px;">
      <p style="margin:0;color:#C8860A;font-size:12px;letter-spacing:.1em;text-transform:uppercase;">Make My Coffee</p>
      <p style="margin:4px 0 0;color:#F5E6D3;font-size:20px;font-weight:700;">Aconchego Espresso Shots</p>
    </div>
    <div style="padding:32px;">${content}</div>
    <div style="background:#FAF6F1;padding:16px 32px;text-align:center;">
      <p style="margin:0;font-size:12px;color:#8B5E0A;">makemycoffee.cafe · Aconchego Signature Blend</p>
    </div>
  </div>
</body></html>`
}

export async function sendOrderEmails(data: OrderEmailData) {
  const transporter = createTransport()
  const { orderId, customer, items, subtotal, shipping, total } = data
  const customerName = `${customer.firstName} ${customer.lastName}`

  // Staff to BCC on the admin notification (comma-separated env)
  const staffBcc = (process.env.BCC_EMAIL ?? '')
    .split(',')
    .map(e => e.trim())
    .filter(Boolean)

  // ── Admin notification ──
  await transporter.sendMail({
    from: `"Make My Coffee" <${process.env.GMAIL_USER}>`,
    to: process.env.ADMIN_EMAIL,
    ...(staffBcc.length ? { bcc: staffBcc } : {}),
    subject: `New Order #${orderId} — ${customerName}`,
    html: base(`
      <h2 style="margin:0 0 4px;color:#1C0A00;font-size:22px;">New Order Received</h2>
      <p style="margin:0 0 24px;color:#8B5E0A;font-size:14px;">Order #${orderId}</p>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
        <tr><td style="padding:6px 0;color:#5C3317;font-size:13px;width:120px;">Customer</td><td style="padding:6px 0;font-weight:600;color:#1C0A00;">${customerName}</td></tr>
        <tr><td style="padding:6px 0;color:#5C3317;font-size:13px;">Email</td><td style="padding:6px 0;color:#1C0A00;">${customer.email}</td></tr>
        <tr><td style="padding:6px 0;color:#5C3317;font-size:13px;">Phone</td><td style="padding:6px 0;color:#1C0A00;">${customer.phone}</td></tr>
        <tr><td style="padding:6px 0;color:#5C3317;font-size:13px;">Address</td><td style="padding:6px 0;color:#1C0A00;">${customer.address}</td></tr>
        <tr><td style="padding:6px 0;color:#5C3317;font-size:13px;">City</td><td style="padding:6px 0;color:#1C0A00;">${customer.city}, ${customer.province} ${customer.postalCode}</td></tr>
        ${customer.notes ? `<tr><td style="padding:6px 0;color:#5C3317;font-size:13px;">Notes</td><td style="padding:6px 0;color:#1C0A00;">${customer.notes}</td></tr>` : ''}
      </table>

      ${itemsTable(items)}

      <table width="100%" cellpadding="0" cellspacing="0">
        <tr><td style="padding:6px 0;color:#5C3317;">Subtotal</td><td style="padding:6px 0;text-align:right;">₱${subtotal.toLocaleString()}</td></tr>
        <tr><td style="padding:6px 0;color:#5C3317;">Shipping</td><td style="padding:6px 0;text-align:right;">${shipping === 0 ? 'Free' : '₱' + shipping}</td></tr>
        <tr style="border-top:2px solid #F5E6D3;">
          <td style="padding:12px 0 0;font-weight:700;font-size:16px;color:#1C0A00;">Total (COD)</td>
          <td style="padding:12px 0 0;text-align:right;font-weight:700;font-size:18px;color:#C8860A;">₱${total.toLocaleString()}</td>
        </tr>
      </table>

      <a href="${process.env.NEXT_PUBLIC_URL || 'https://makemycoffee.cafe'}/admin/orders"
         style="display:inline-block;margin-top:24px;background:#1C0A00;color:#F5E6D3;text-decoration:none;padding:12px 24px;border-radius:99px;font-size:14px;font-weight:600;">
        View in Admin →
      </a>
    `),
  })

  // ── Customer confirmation ──
  await transporter.sendMail({
    from: `"Make My Coffee" <${process.env.GMAIL_USER}>`,
    to: customer.email,
    subject: `Order Confirmed #${orderId} — Make My Coffee`,
    html: base(`
      <h2 style="margin:0 0 4px;color:#1C0A00;font-size:22px;">Thank you, ${customer.firstName}!</h2>
      <p style="margin:0 0 24px;color:#5C3317;font-size:15px;">Your order <strong>#${orderId}</strong> has been received and is being prepared.</p>

      ${itemsTable(items)}

      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
        <tr><td style="padding:6px 0;color:#5C3317;">Subtotal</td><td style="padding:6px 0;text-align:right;">₱${subtotal.toLocaleString()}</td></tr>
        <tr><td style="padding:6px 0;color:#5C3317;">Shipping</td><td style="padding:6px 0;text-align:right;">${shipping === 0 ? '<span style="color:#16a34a;font-weight:600;">Free</span>' : '₱' + shipping}</td></tr>
        <tr style="border-top:2px solid #F5E6D3;">
          <td style="padding:12px 0 0;font-weight:700;font-size:16px;color:#1C0A00;">Total to pay on delivery</td>
          <td style="padding:12px 0 0;text-align:right;font-weight:700;font-size:18px;color:#C8860A;">₱${total.toLocaleString()}</td>
        </tr>
      </table>

      <div style="background:#FAF6F1;border-radius:12px;padding:16px 20px;margin-bottom:24px;">
        <p style="margin:0 0 4px;font-weight:600;color:#1C0A00;">📦 Delivery Address</p>
        <p style="margin:0;color:#5C3317;font-size:14px;">${customer.address}<br>${customer.city}, ${customer.province} ${customer.postalCode}</p>
      </div>

      <div style="background:#FFF8F0;border:1px solid #E8C9A0;border-radius:12px;padding:16px 20px;">
        <p style="margin:0 0 4px;font-weight:600;color:#C8860A;">💵 Cash on Delivery</p>
        <p style="margin:0;color:#5C3317;font-size:14px;">Please have <strong>₱${total.toLocaleString()}</strong> ready when your order arrives. No upfront payment required.</p>
      </div>
    `),
  })
}
