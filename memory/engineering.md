# Engineering — Make My Coffee

> Snapshot of the actual codebase as of 2026-06-02 (commit `21d95a6`).
> Note: the root `CLAUDE.md` is partly **stale** — it describes a frontend-only,
> USD/PayPal MVP. The real app is a full PHP-currency (₱), COD, Neon-backed store
> with an admin backoffice. See `decision.md` for the deltas and why.

## Stack
- **Framework**: Next.js 14.2.10 (App Router)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 3.4 — custom `espresso` palette (50–900) in `tailwind.config.ts`
- **DB**: Neon serverless Postgres via `@neondatabase/serverless` (`neon()` tagged-template client)
- **Email**: Nodemailer over Gmail (`service: 'gmail'`, App Password auth)
- **Charts**: Recharts 3.x (admin dashboard sales chart)
- **State (storefront)**: React Context (`CartContext`) + `localStorage` (key `mmc-cart`)
- **Fonts**: Playfair Display (headings, inline `var(--font-playfair)`) + Inter (body) via `next/font/google`

## Scripts
```bash
npm run dev     # http://localhost:3000
npm run build
npm start
npm test        # unit: node:test + Node 22 type stripping — no test framework dependency
npm run test:e2e  # Playwright — needs a throwaway DB in .env.e2e, see e2e/README.md
```

## Directory map
```
app/
  page.tsx                      Landing (server component)
  shop/page.tsx                 3 product cards, add to cart
  cart/page.tsx                 Cart view, qty controls
  order/page.tsx                Checkout form → POST /api/orders (COD)
  layout.tsx, globals.css
  admin/
    layout.tsx                  Admin shell (Sidebar)
    page.tsx, login/page.tsx
    dashboard/page.tsx          Stats + SalesChart
    orders/page.tsx             Orders table, status controls
    vouchers/page.tsx           Voucher list + create/edit dialog (D11)
  api/
    orders/route.ts             POST — create order, insert, send emails
    shipping/quote/route.ts     POST — checkout preview only, not authoritative
    vouchers/validate/route.ts  POST — checkout preview only, not authoritative (D11)
    geocode/route.ts            POST — map-pin pre-fill guess only, not authoritative
    admin/
      login/route.ts            POST — credential check, set session cookie
      logout/route.ts           POST — clear session
      orders/route.ts           GET — list orders (?status= filter)
      orders/[id]/route.ts      PATCH — update order_status / payment_status
      stats/route.ts            GET — dashboard aggregates
      vouchers/route.ts         GET list / POST create  (admin-cookie guarded)
      vouchers/[id]/route.ts    PATCH edit or toggle / DELETE (admin-cookie guarded)
  assets/                       bottle.png, hero_splash.png, flavors/*.png
components/
  Navbar.tsx, Footer.tsx, HeroSection.tsx
  DeliveryMapPicker.tsx          Leaflet pin picker (dynamic-imported, ssr:false), see D10
  admin/Sidebar.tsx, admin/SalesChart.tsx
context/CartContext.tsx         Cart provider + useCart hook
lib/
  products.ts                   Product type + 3 products + priceOrderItems() (D8, D12)
  db.ts                         neon() sql client (throws if DATABASE_URL unset)
  db-setup.sql                  one-time orders table DDL (run in Neon)
  email.ts                      sendOrderEmails() — admin + customer HTML emails
  shipping.ts                   calcShipping(city, subtotal) — pure, client-safe
  shippingQuote.ts               getShippingFee() — server-only, calls Lalamove
  lalamove.ts                   Lalamove v3 signed HMAC client, prefers pin over geocoding
  geocoding.ts                  Nominatim (OSM) free-text geocode(), used as pre-fill + fallback only
  phLocations.ts                Province/City/ZIP dataset — 6-province delivery coverage (D10)
  vouchers.ts                   Pure voucher math + rule checks, client-safe (D11)
  voucherStore.ts               Server-only voucher lookup + atomic claim/release (D11)
  voucherInput.ts               Admin create/edit input validation (D11)
  session.ts                    HMAC cookie session helpers + isAdminAuthenticated()
middleware.ts                   Guards /admin/* pages (except /admin/login) — NOT /api/admin/*
tests/                          node:test unit suites, run with `npm test`
  vouchers.test.ts              Discount math, rule checks, admin input validation
  pricing.test.ts               priceOrderItems() catalog re-pricing
e2e/                            Playwright suite, run with `npm run test:e2e` — see e2e/README.md
  voucher-admin.spec.ts         Admin backoffice: create/edit/toggle/delete
  voucher-checkout.spec.ts      Customer journey + resulting order rows
  voucher-api.spec.ts           Authorization, payload tampering, concurrency
  helpers/                      DB seeding + cleanup (with a prod-DB guard), page objects
playwright.config.ts            Starts its own next dev with Gmail/Lalamove creds withheld
```

## Products (`lib/products.ts` — do not duplicate)
Prices are **integers in PHP pesos (₱)**, not dollars.
| id | Name | Shots | Volume | Price | Badge |
|----|------|-------|--------|-------|-------|
| `4-shot` | Aconchego Starter | 4 | 120ml | ₱299 | — |
| `7-shot` | Aconchego Classic | 7 | 210ml | ₱449 | Most Popular |
| `10-shot` | Aconchego Reserve | 10 | 300ml | ₱599 | Best Value |

`Product` type: `{ id, name, shots, volume, price, description, badge? }`.

## Data model — `orders` table (`lib/db-setup.sql`)
Run once in the Neon SQL editor.
- `id SERIAL PK`
- customer: `first_name, last_name, email` (NOT NULL on names+email), `phone, address, city, province, postal_code, notes`
- `items JSONB NOT NULL` — cart snapshot
- money (integers, ₱): `subtotal`, `shipping` (default 0), `total`
- `payment_method` default `'cod'`, `payment_status` default `'unpaid'`
- `order_status` default `'pending'`
- `created_at`, `updated_at` (TIMESTAMPTZ, default NOW())
- Indexes: `order_status`, `created_at DESC`

**Valid status values** (enforced in `api/admin/orders/[id]/route.ts`):
- `order_status`: `pending | approved | shipped | delivered | cancelled`
- `payment_status`: `unpaid | paid`

## Order flow
1. `app/order/page.tsx` posts `{ customer, items, deliverySlots, voucherCode }` to
   `POST /api/orders`. It also posts a `subtotal`, which the server **ignores**.
2. Route re-prices the cart from the catalog (`priceOrderItems`, D12), recomputes
   shipping via `getShippingFee` (D9), re-resolves and atomically claims the
   voucher (D11), computes `total = subtotal - discount + shipping`, inserts the
   row, returns `{ orderId }`. Nothing priced by the client is trusted.
3. `sendOrderEmails()` fires admin notification + customer confirmation. Email failure
   is caught/logged and does **not** fail the order (fire-and-forget `.catch`).

## Vouchers (`lib/vouchers.ts` + `lib/voucherStore.ts`, see decision.md D11)
```
POST /api/vouchers/validate    // preview: price a code against the cart
POST /api/orders               // authoritative: re-price AND take the slot
```
Types: `percent` (optional ₱ cap) | `fixed` | `free_shipping`, one per voucher.
Rules, all optional and admin-set: `min_subtotal`, `max_redemptions`,
`once_per_email`, `starts_at`/`expires_at`.
Money: `total = subtotal - discount + shipping`; `orders.discount` is the
subtotal reduction only, a free-delivery voucher shows as `shipping = 0`.
The redemption slot is taken by `claimVoucher()` with a guarded UPDATE plus a
unique-index insert (no interactive transactions on the Neon HTTP driver), and
released if the order insert then fails.

## Shipping (`lib/shipping.ts` + `lib/shippingQuote.ts`, see decision.md D9)
```
getShippingFee(dest, subtotal):     // lib/shippingQuote.ts, server-only
  if isFreeShippingEligible(city, subtotal) → ₱0
  else try live Lalamove MOTORCYCLE quote for dest (geocoded via Nominatim)
       → real distance-based fee
  else (no coverage / geocode fail / API error / pickup env unset) → ₱99 flat
```
Free shipping is still **Pasig-only** above ₱1000. Everyone else gets a live
Lalamove quote when possible, otherwise the ₱99 flat fallback — same number as
before this feature. `lib/shipping.ts` only holds the pure/client-safe pieces
(`FLAT_SHIPPING_FEE`, `isFreeShippingEligible`, `calcShipping`); the
Lalamove-aware orchestrator is a separate server-only file on purpose (see D9)
so the 'use client' checkout page can keep importing from `shipping.ts`
without pulling Node `crypto` / API secrets into the browser bundle.
`POST /api/orders` is the only authoritative caller — `POST /api/shipping/quote`
is a checkout-preview endpoint only.

## Auth / admin (`lib/session.ts`, `middleware.ts`)
- Cookie `mmc_admin`, HMAC-SHA256 token of `${username}:${secret}` (Web Crypto `crypto.subtle`).
- Cookie: `httpOnly`, `secure` in prod, `sameSite: 'lax'`, 7-day `maxAge`.
- `middleware.ts` matches `/admin/:path*`, redirects to `/admin/login` if cookie
  missing or token mismatch. It **re-implements** `createToken` locally (can't import
  `next/headers` from middleware/edge) — keep the two copies in sync.
- Login (`api/admin/login`) checks username/password against env, then `setSession`.

## Admin dashboard stats (`api/admin/stats`)
Single GET returns: `today`/`week`/`all` order counts + revenue, `pendingCount`,
`statusBreakdown` (group by status), `daily` (last 7 days via `generate_series` LEFT JOIN),
`recentOrders` (last 5). All money summed as integer ₱.

## Environment variables (`.env.local`, gitignored)
| Var | Purpose |
|-----|---------|
| `DATABASE_URL` | Neon pooled connection string (required; `db.ts` throws if missing) |
| `GMAIL_USER` | Gmail sender address |
| `GMAIL_APP_PASSWORD` | Gmail App Password (not account password) |
| `ADMIN_EMAIL` | Recipient of new-order notifications |
| `ADMIN_USERNAME` | Admin login (fallback `'admin'`) |
| `ADMIN_PASSWORD` | Admin login (fallback `'gimcontz'`) |
| `SESSION_SECRET` | HMAC secret (`openssl rand -hex 32`; dev fallback exists) |
| `NEXT_PUBLIC_URL` | Base URL used in email "View in Admin" link |
| `LALAMOVE_API_KEY` / `LALAMOVE_SECRET_KEY` | Lalamove sandbox/prod key pair (Partner Portal → Developers) |
| `LALAMOVE_ENV` | `production` to use live keys/base URL; unset = sandbox |
| `LALAMOVE_MARKET` | Market header code; unset defaults to `PH` |
| `LALAMOVE_PICKUP_ADDRESS` / `_LAT` / `_LNG` | Shop pickup point Lalamove quotes from; unset = flat-rate fallback only (D9) |

## Design system
- All color tokens prefixed `espresso-` (50/100 cream → 400 caramel-gold CTA →
  700/800 mid-brown → 900 near-black for nav/footer/hero).
- Headings use inline `style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}`
  — Tailwind `font-serif` is **not** configured separately.
- Email templates (`lib/email.ts`) hardcode hex equivalents of the palette.

## Deployment
- Vercel (`.vercel/` present, gitignored). Set all env vars in the Vercel project.
- Run `lib/db-setup.sql` once against the Neon database before first order.
