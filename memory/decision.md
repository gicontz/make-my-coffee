# Decisions — Make My Coffee

Architectural and product decisions, with the reasoning. Newest context as of
commit `21d95a6` (2026-06-02). Where a decision contradicts the root `CLAUDE.md`,
the **code is authoritative** and `CLAUDE.md` should be updated.

## D1 — Currency is PHP (₱), not USD
**Decision:** All prices are integer Philippine pesos. Products: ₱299 / ₱449 / ₱599.
**Why:** Business operates in the Philippines (Pasig-based delivery). `CLAUDE.md`
still says USD/`$` with $8.99/$14.99/$19.99 — that is **stale**.
**Implications:** Prices stored as integers (no cents/decimals). Display uses `₱`
and `toLocaleString()`. Do not reintroduce dollar formatting.

## D2 — Cash on Delivery instead of PayPal
**Decision:** Payment is COD. No online payment gateway integrated.
**Why:** Simpler launch, matches local buyer expectations, avoids gateway fees/setup.
**Implications:** Orders persist with `payment_method='cod'`, `payment_status='unpaid'`.
Admin marks `paid` on delivery. `CLAUDE.md`'s "PayPal planned / discuss before
touching payment code" is **superseded** — there is no payment code to gate.

## D3 — Pasig-only free shipping above ₱1000, else ₱99 flat
**Decision:** `calcShipping` gives free shipping only for Pasig orders ≥ ₱1000;
all other cases pay a flat ₱99.
**Why:** Delivery is operated locally in Pasig; free shipping is a localized
incentive, not a global threshold. `CLAUDE.md`'s "free above $30, else $4.99" is stale.
**Implications:** City string is normalized (trim/lowercase/strip "city" suffix), so
"Pasig City" and "pasig" both match. Shipping is **recomputed server-side** in
`POST /api/orders` — the client-supplied total is never trusted.

## D4 — Neon serverless Postgres for persistence
**Decision:** Single `orders` table on Neon, accessed via `@neondatabase/serverless`
tagged-template `sql` client. Schema in `lib/db-setup.sql`, run manually once.
**Why:** Serverless-friendly (works on Vercel edge/functions, no connection pool
management), minimal for a single-table store. Cart items stored as `JSONB` snapshot
so historical orders are immutable even if product catalog changes.
**Implications:** No ORM/migrations tool — schema changes are hand-applied SQL.
`db.ts` throws at import if `DATABASE_URL` is unset (fail fast).

## D5 — Email via Gmail + Nodemailer, fire-and-forget
**Decision:** Two HTML emails per order (admin notification + customer confirmation)
via Nodemailer over Gmail App Password.
**Why:** Zero-cost, no transactional-email vendor for launch volume.
**Implications:** Email send is wrapped in `.catch` — failures are logged but do
**not** fail the order. Templates inline all styles + hex colors (email-client safe).
Trade-off: Gmail sending limits/deliverability may force a move to a real provider
(Resend/SES) as volume grows.

## D6 — Lightweight HMAC cookie session for admin (no auth library)
**Decision:** Admin auth is a single HMAC-SHA256 cookie (`mmc_admin`) of
`username:secret`, checked in `middleware.ts`. Credentials are env vars.
**Why:** One admin user, no need for a user table or NextAuth. Web Crypto works in
the edge middleware runtime.
**Implications:** `createToken` is **duplicated** in `lib/session.ts` and
`middleware.ts` because middleware can't import `next/headers`. Keep them in sync.
Token is deterministic (no expiry/nonce baked in) — security rests on `SESSION_SECRET`
secrecy. Dev fallback secret + default `admin`/`gimcontz` creds exist; **must** be
overridden in production via env.

## D7 — Cart stays client-side (Context + localStorage)
**Decision:** Cart lives entirely in the browser (`CartContext`, key `mmc-cart`);
server only sees the cart at checkout time in the order POST.
**Why:** No account system; cart is ephemeral per-device. Simple and offline-tolerant.
**Implications:** Hydration guard (`hydrated` flag) prevents SSR/client mismatch.
Server recomputes shipping/total from the posted items, so a tampered localStorage
cart can't change pricing.

## D8 — Single source of truth for products in `lib/products.ts`
**Decision:** Product catalog is a typed array in `lib/products.ts`; everything
imports from there.
**Why:** Avoid drift between shop, cart, emails, and order records.
**Implications:** Adding/changing a product is a one-file edit. Order rows snapshot
item data into JSONB so past orders are unaffected by catalog edits.

---
## Open items / known gaps
- `CLAUDE.md` is out of date (currency, payment, shipping) — update to match code.
- Default admin credentials and dev `SESSION_SECRET` fallback must not ship to prod.
- No automated DB migrations; schema changes are manual SQL.
- No inventory/stock tracking — orders can be placed regardless of stock.
- No order-confirmation page persistence beyond the returned `orderId`.
