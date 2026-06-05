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
  api/
    orders/route.ts             POST — create order, insert, send emails
    admin/
      login/route.ts            POST — credential check, set session cookie
      logout/route.ts           POST — clear session
      orders/route.ts           GET — list orders (?status= filter)
      orders/[id]/route.ts      PATCH — update order_status / payment_status
      stats/route.ts            GET — dashboard aggregates
  assets/                       bottle.png, hero_splash.png, flavors/*.png
components/
  Navbar.tsx, Footer.tsx, HeroSection.tsx
  admin/Sidebar.tsx, admin/SalesChart.tsx
context/CartContext.tsx         Cart provider + useCart hook
lib/
  products.ts                   Product type + 3 products (single source of truth)
  db.ts                         neon() sql client (throws if DATABASE_URL unset)
  db-setup.sql                  one-time orders table DDL (run in Neon)
  email.ts                      sendOrderEmails() — admin + customer HTML emails
  shipping.ts                   calcShipping(city, subtotal)
  session.ts                    HMAC cookie session helpers
middleware.ts                   Guards /admin/* (except /admin/login)
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
1. `app/order/page.tsx` posts `{ customer, items, subtotal }` to `POST /api/orders`.
2. Route recomputes shipping server-side via `calcShipping` (never trusts client total),
   computes `total = subtotal + shipping`, inserts row, returns `{ orderId }`.
3. `sendOrderEmails()` fires admin notification + customer confirmation. Email failure
   is caught/logged and does **not** fail the order (fire-and-forget `.catch`).

## Shipping (`lib/shipping.ts`)
```
calcShipping(city, subtotal):
  normalize city (trim, lowercase, strip trailing "city")
  if city == "pasig" && subtotal >= 1000  → ₱0 (free)
  else → ₱99
```
Free shipping is **Pasig-only** above ₱1000; everyone else pays ₱99 flat.

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

## Design system
- All color tokens prefixed `espresso-` (50/100 cream → 400 caramel-gold CTA →
  700/800 mid-brown → 900 near-black for nav/footer/hero).
- Headings use inline `style={{ fontFamily: 'var(--font-playfair), Georgia, serif' }}`
  — Tailwind `font-serif` is **not** configured separately.
- Email templates (`lib/email.ts`) hardcode hex equivalents of the palette.

## Deployment
- Vercel (`.vercel/` present, gitignored). Set all env vars in the Vercel project.
- Run `lib/db-setup.sql` once against the Neon database before first order.
