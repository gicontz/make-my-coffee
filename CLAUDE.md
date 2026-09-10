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

## On-site chat
The widget on the storefront (`components/ChatWidget.tsx`) talks to our own
backend, not to Meta. `POST /api/chat` runs the same decision sequence the
Messenger webhook does — `lib/chat/respond.ts` is the single implementation, and
a second copy of it is the bug to watch for.

| Piece | File |
|---|---|
| Widget | `components/ChatWidget.tsx` |
| Endpoint | `app/api/chat/route.ts` |
| Shared bot brain | `lib/chat/respond.ts`, `conversation.ts`, `assistant.ts` |
| Storage, lookups, budgets | `lib/chat/store.ts` (migration 0007) |
| Staff inbox | `/admin/chat` |

**Visitor identity is an httpOnly cookie**, minted server-side — Messenger's PSID
has no web equivalent and there is no API to mint one. It authenticates nothing;
it means "same browser". Order lookups still demand the order number **and** the
email on that order.

**`/api/chat` is public with nothing in front of it.** That is why
`lib/chat/budget.ts` exists: a per-session daily cap and a global daily ceiling
on model calls, both degrading to the button menu rather than erroring. Without
them the endpoint is free compute for whoever finds it.

⚠️ **Nothing pushes a chat to anyone's phone.** A visitor asking for a person
flags the session and sends one email to `ADMIN_EMAIL`. If chats sit unanswered,
the honest fix is a real notification path or dropping live chat and offering
only the bot — not leaving the widget promising a reply nobody sees.

## Messenger chat + bot
An m.me chat launcher on the storefront, plus a webhook-backed bot. Issue #11
has the full credential walkthrough; this is the shape of it.

| Piece | File | Gated on |
|---|---|---|
| Webhook | `app/api/messenger/webhook/route.ts` | `FB_APP_SECRET`, `FB_VERIFY_TOKEN` |
| Replies out | `lib/messenger/send.ts` | `FB_PAGE_ACCESS_TOKEN` |
| Buttons + parsing (pure) | `lib/messenger/conversation.ts` | — |
| Order lookup + dedupe | `lib/messenger/store.ts` | migration 0006 |
| Free-text answers | `lib/messenger/assistant.ts` | `ANTHROPIC_API_KEY` |

Each is independently dark without its variable: no Anthropic key and the bot
still answers with buttons.

**There is no chat entry point on the site right now, deliberately.** Meta
discontinued the embeddable Chat Plugin on 2024-05-09, and the `m.me` link that
replaced it is broken on desktop — m.me redirects to `messenger.com/t/<id>`, and
Meta shut down messaging on messenger.com in April 2026, so it lands on a page
that cannot open a thread. A known-good Page (`m.me/FacebookDevelopers`)
misbehaves identically, so this is not something we can fix from our side. The
launcher was removed rather than left pointing at a dead page.

The replacement is an in-house widget on our own backend — the bot logic below
is already transport-agnostic and carries over unchanged. Until then the webhook
still serves anyone who messages the Page directly from Facebook.

**Order lookups need an order number *and* the email on that order.**
`orders.id` is a SERIAL, so a lookup on the number alone would let anyone walk
the table. Failures are rate-limited per PSID (`lib/messenger/rateLimit.ts`),
and a match returns status, window, total and paid/unpaid only — never the
address or phone.

**Nothing the bot does marks an order paid.** A payment screenshot emails the
admin and is acknowledged; a human still confirms it (D13).

Meta retries deliveries, so every message id is claimed in `messenger_events`
before it is answered — an in-memory guard cannot work when two deliveries land
in two serverless instances.

**Meta requires a 200 within 5 seconds** and unsubscribes the app after an hour
of failures, so the webhook acks first and does the work in `waitUntil`
(`@vercel/functions` — Next 14 has no `after()`). Nothing after the ack may
reject: the response has already gone, and an unhandled rejection takes the
function down.

### Deploy order
1. Merge and deploy — the route answers Meta's `GET` challenge. **Meta will not
   save a callback URL until it does**, so the code must ship before the webhook
   can be configured. Use a preview deployment.
2. Configure the webhook in the app dashboard's **Webhooks** product (or
   Messenger → Settings → Webhooks) → *Add Callback URL*. Subscribe the Page to
   `messages` first and confirm the base flow works before adding
   `messaging_postbacks`, `messaging_optins`, `messaging_referrals`.
3. App Review for `pages_messaging` + Business Verification before the bot can
   talk to anyone who isn't an admin/developer/tester on the app.

**Message tags are not an option here.** `POST_PURCHASE_UPDATE`,
`CONFIRMED_EVENT_UPDATE` and `ACCOUNT_UPDATE` return error 100 as of
2026-04-27, so there is no supported way to message a customer outside the
24-hour window. Order notifications stay on email.

## Contact & Privacy pages
`/contact` and `/privacy`, linked from the footer. Business details come from
env (`lib/business.ts`) — `CONTACT_EMAIL` (falls back to `ADMIN_EMAIL`),
`CONTACT_PHONE`, `BUSINESS_ADDRESS`, `LEGAL_NAME`. **Not hardcoded, because
this repo is public**: a personal number committed here is committed
permanently. Unset optional values render nothing rather than an empty row.
Both pages are statically prerendered, so a change needs a redeploy.

⚠️ **The privacy policy describes what the code actually does** — the
collection list mirrors the `orders` and `chat_*` tables, and the processor list
is every external host the app talks to. Add a processor or a column and that
page is wrong until it is updated.

## Conventions
- Orders, vouchers, shipping quotes and admin all go through `app/api/*` against Neon Postgres; only the cart is purely client-side
- Cart persists to `localStorage` under key `mmc-cart`
- Shipping is quoted live per order from the customer's pinned dropoff (`lib/shippingQuote.ts`); free for Pasig City orders ≥ ₱1,000, and the flat ₱99 in `lib/shipping.ts` is only the fallback when a quote can't be got
- Free-delivery vouchers waive at most **₱150** (`FREE_SHIPPING_VOUCHER_CAP`); the customer pays any excess, and the voucher is still labelled "Free delivery". Always price it with `shippingAfterVoucher()` — never `freeShipping ? 0 : fee` (D11a)
- **Never state a delivery fee in customer-facing copy.** It isn't knowable ahead of the pin — see the comment on `deliveryReply()`
- Currency is PHP (`₱`), integer pesos — no cents (D1)
