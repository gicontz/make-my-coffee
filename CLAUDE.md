# Make My Coffee — Project Guide

## What this is
An ecommerce website selling bottled espresso shots (30ml per shot) in 4, 7, and 10-shot bottles. The brand and sole blend is called **Aconchego** — a mix of Cambodia and Indonesia beans (not single-origin; specific proportions undisclosed). The business concept is economical, DIY espresso — customers mix their own lattes, iced drinks, etc.

## Tech stack
- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS with a custom `espresso` color palette
- **Language**: TypeScript
- **State**: React Context API (CartContext) + localStorage persistence
- **Fonts**: Playfair Display (headings) + Work Sans (body) via `next/font/google`

## Running the project
```bash
npm run dev   # http://localhost:3000
npm run build
npm start
```

## Pages
| Route | File | Notes |
|-------|------|-------|
| `/` | `app/page.tsx` | Landing page — server component |
| `/shop` | `app/shop/page.tsx` | 3 product cards, add to cart |
| `/cart` | `app/cart/page.tsx` | Cart view with qty controls |
| `/order` | `app/order/page.tsx` | Checkout form + payment method picker (COD / QR) |

## Key files
- `lib/products.ts` — single source of truth for product data and the `Product` type
- `context/CartContext.tsx` — cart state, imports `Product` from `lib/products.ts`, persists to `localStorage`
- `tailwind.config.ts` — `espresso` color tokens (50–900)

## Design system
Custom color tokens all prefixed `espresso-`:
- `espresso-50/100` → cream backgrounds
- `espresso-400` → caramel gold, primary accent / CTA color
- `espresso-700/800` → mid browns
- `espresso-900` → near-black espresso, nav/footer/hero backgrounds

Headings use `style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}` inline (Tailwind `font-serif` is not configured separately).

## Products
Defined in `lib/products.ts` — do not duplicate elsewhere:
- **Aconchego Starter** — 4 shots / 120ml / ₱299
- **Aconchego Classic** — 7 shots / 210ml / ₱449 (Most Popular)
- **Aconchego Reserve** — 10 shots / 300ml / ₱599 (Best Value)

## Backend / payment
**No online gateway, by decision** (`memory/decision.md` D2, D13) — PayPal was planned and never built.

Checkout offers Cash on Delivery, GCash, Maya and GoTyme Bank. The wallets are
**display-only**: `/order` shows that account's QR from `public/qr/`, the customer
pays in their own app, and the order is inserted `payment_status = 'unpaid'`
regardless of method. Nothing verifies a payment — there is no merchant API for
any of the three — so an admin confirms every one by hand with Mark Paid, which
is the only thing that ever sets `paid`/`paid_at`.

`payment_method` on an unpaid order is what the customer *intends*, not what
happened. Don't read it as evidence of payment.

`lib/paymentMethods.ts` holds both method lists and the QR account table; read
its header before adding a method. QR images are in `public/qr/` (stable URLs —
the confirmation email embeds them); sources and the regeneration recipe are in
`app/assets/qr/README.md`.

## Email
Three transactional emails, all built in `lib/email.ts`:

| When | To | Function |
|---|---|---|
| Order placed | admin + customer | `sendOrderEmails()` |
| Status → `shipped` | customer | `sendOrderStatusEmail()` |
| Status → `delivered` | customer | `sendOrderStatusEmail()` |
| Status → `cancelled` | customer | `sendOrderStatusEmail()` |

`approved` deliberately sends nothing — see the comment on
`NOTIFIED_ORDER_STATUSES`. A cancellation email never shows a delivery address
or a QR: if the order was paid it offers a refund, if it wasn't it says there is
nothing outstanding. Status mail fires from `PATCH /api/admin/orders/[id]`
only on a **real** transition: the UPDATE carries `AND order_status <> …`, so a
re-clicked button writes nothing and therefore mails nothing.

Delivery picks a route per call, in this order: `EMAIL_TRANSPORT=json` (mocked —
what the e2e suite runs with, checked first so a stray API key can never mail
real customers), then `RESEND_API_KEY`, then Gmail, then mocked-with-a-warning.
Mail is fire-and-forget (D5) — a provider outage never fails the request that
triggered it.

### Setting up Resend for makemycoffee.cafe
1. resend.com → Domains → Add Domain. Use a **subdomain** — `mail.makemycoffee.cafe`
   or `updates.makemycoffee.cafe` — so a bad send can't damage the root domain's
   reputation.
2. Resend shows the exact DNS records to add (an SPF `TXT`, DKIM, and a `MX` for
   the sending subdomain). Copy them verbatim; don't reconstruct them from memory.
3. Add them at whoever actually hosts the DNS for `makemycoffee.cafe` — **check
   this first.** Registrar and DNS host are often not the same company, and
   editing records in the wrong dashboard looks like it worked and changes
   nothing.
4. Wait for Verified in Resend, then add a DMARC record (`_dmarc`, start at
   `p=none`) once mail is flowing.
5. API Keys → Create, with **Sending access** only. Put it in Vercel env for
   Production and Preview, and set `MAIL_FROM` to an address on the verified
   subdomain.

Until step 4 passes, leave `RESEND_API_KEY` unset — sends against an unverified
domain are rejected outright, and the Gmail fallback keeps working meanwhile.

## Conventions
- Orders, vouchers, shipping quotes and admin all go through `app/api/*` against Neon Postgres; only the cart is purely client-side
- Cart persists to `localStorage` under key `mmc-cart`
- Shipping: flat ₱99, free only for Pasig City orders ≥ ₱1,000 (`lib/shipping.ts`)
- Currency is PHP (`₱`), integer pesos — no cents (D1)
