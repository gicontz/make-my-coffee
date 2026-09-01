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

## D9 — Lalamove for shipping *pricing* only, not booking/dispatch
**Decision:** Integrate Lalamove's v3 Quotation API to replace the flat ₱99 /
free-Pasig-above-₱1000 rule with a real distance-based fee, wherever a live
quote can be obtained. Do **not** call Lalamove's order/booking endpoints —
riders are still arranged outside this app, same as before. User confirmed
this scope explicitly (quotation only, not auto-dispatch) after being asked.
**Why:** Removes the guesswork/subsidy risk of a flat rate (over/undercharging
depending on actual distance) without taking on the cost and blast radius of
auto-booking real couriers on every checkout.
**Implications:**
- `lib/lalamove.ts` — signed HMAC client + Nominatim (OpenStreetMap) geocoding
  for the customer's typed address (free, no API key; fine at this volume).
- `lib/shipping.ts` stays pure/client-safe (constants + free-shipping check
  only) so the checkout page can still import it directly. The Lalamove-aware
  orchestrator lives in **`lib/shippingQuote.ts`** instead, kept server-only
  on purpose — it pulls in Node `crypto` and API secrets via `lib/lalamove.ts`,
  none of which may reach a browser bundle.
- `getShippingFee()` (`lib/shippingQuote.ts`) is the single source of truth:
  free-Pasig promo first, then a live Lalamove quote, then the flat ₱99
  fallback if Lalamove/geocoding is unavailable for any reason (no coverage,
  network/API error, pickup env vars unset). Checkout never blocks on this.
- `POST /api/shipping/quote` is a preview-only endpoint the checkout page
  calls (debounced) to show a live number as the customer types their
  address. Same as the rest of this app's discipline (D3): the client value
  is never trusted — `POST /api/orders` recomputes the authoritative fee
  itself via the same `getShippingFee()` at insert time.
- New `orders` columns (`0002_add_shipping_source.sql`): `shipping_source`
  (`'lalamove' | 'flat'`) and `shipping_distance_km`, so admin can see which
  orders got a real distance-based price. Shown as a small badge in
  `app/admin/orders/page.tsx`.
- Pickup coordinates/address are env vars (`LALAMOVE_PICKUP_*`), not
  hardcoded — must be set for live quotes to actually kick in; unset = same
  flat-rate behavior as before this feature existed.
- Sandbox keys only need to be in `.env.local`; sandbox quotations are free
  (no wallet top-up required — that's only for booking, which this app
  doesn't do). Production keys/base URL gated behind `LALAMOVE_ENV=production`.

## D10 — Checkout map pin + restricted Province/City dropdowns, because free-text geocoding silently fails on PH addresses
**Decision:** Add a Leaflet/OpenStreetMap pin picker to checkout
(`components/DeliveryMapPicker.tsx`) and replace the free-text Province/City
fields with dropdowns restricted to `lib/phLocations.ts`'s 6 provinces
(Metro Manila/NCR, Rizal, Cavite, Laguna, Batangas, Bulacan) — Lalamove
MOTORCYCLE's realistic coverage from the Pasig pickup point. Barangay stays
free text (no reliable, complete barangay-level dataset exists to hardcode —
PH has 40k+ barangays).
**Why:** Confirmed live — "Blk 17 Lt 7 Zone 1 Bulihan, Silang, Cavite" (a real
subdivision-style address a customer typed) could not be geocoded by
Nominatim at all, so D9's flat-rate fallback silently kicked in and quoted
₱99 for what a real pin priced at ₱288/60.7km. Free-text geocoding of PH
subdivision addresses is not reliable enough to be the primary path — asking
the customer to confirm a literal pin is.
**Implications:**
- The pin, once set, is what `lib/lalamove.ts`'s `getLalamoveQuote()` uses
  directly for the dropoff — it skips geocoding entirely when
  `dest.lat`/`dest.lng` are present. Free-text geocoding (`lib/geocoding.ts`,
  extracted from the old inline copy in `lib/lalamove.ts`) is now only a
  same-tier fallback for older/JS-disabled clients, and the *pre-fill*
  mechanism for the map (`POST /api/geocode`) — never authoritative.
- The map pin auto-applies a geocoded suggestion as the customer types
  Province/City/Barangay/Address, but stops doing so the moment the customer
  taps or drags the pin themselves (`manuallySet` ref in
  `DeliveryMapPicker.tsx`) — never overwrites a deliberate correction.
- The pre-fill guess itself is tiered (`geocodeWithFallback()` in
  `lib/geocoding.ts`, called by `POST /api/geocode`): try the full address,
  then just `Barangay X, City, Province`, then just `City, Province` —
  stopping at whichever resolves. Verified live against the Silang/Cavite
  case above: both the full address AND the barangay-level query failed to
  resolve (Nominatim doesn't have "Bulihan" indexed distinctly), so it fell
  through to city-level and centered on Silang correctly rather than leaving
  the map at the generic Metro Manila default. `DeliveryMapPicker` shows
  which tier it landed on — zooms in tighter for a closer match, and only
  shows the green "pin set" confirmation once the customer has placed it
  themselves or the full address resolved; barangay/city-level guesses get an
  amber "we centered on your X — drag to your exact spot" prompt instead, so
  the customer knows to actually check it.
- Changing **Province or City** clears the pin (`setPin(null)` in
  `handleProvinceChange`/`handleCityChange`) and remounts
  `DeliveryMapPicker` via a `key={province|city}` — otherwise a manually-
  placed pin from a previously-selected city would silently stick around
  after the customer switches to a different one, pricing the quote against
  the wrong location with no signal anything was stale. Barangay/street-
  address edits do **not** reset the pin — those are refinements to an
  already-placed pin, not a new location, and resetting on every keystroke
  there would fight the "never override a manual placement" rule above.
- Pin is **not required** to submit — if unset, `POST /api/orders` still
  falls back through the D9 chain (text-geocode attempt → flat rate). Never
  block checkout; this is an accuracy improvement, not a new gate.
- ZIP code is auto-suggested from the selected City (`zipFor()` in
  `lib/phLocations.ts`) but stays a plain editable text input — never
  auto-filled again once the customer has typed their own (tracked via a
  "was this still our last auto-fill" ref, not a blanket "field is dirty"
  flag, so switching city twice doesn't get stuck). NCR is flagged
  (`zipMayVaryByArea`) because Metro Manila cities genuinely have many ZIP
  codes each (by barangay/district) — confirmed against this project's own
  order data (Pasig/Manggahan is 1611, not the 1600 city default).
- New `orders` columns (`0003_add_barangay_and_pin.sql`): `barangay`,
  `delivery_lat`, `delivery_lng`. Admin (`app/admin/orders/page.tsx`) shows
  barangay inline in the address and a "View pinned location" Google Maps
  link when a pin exists. Customer emails (`lib/email.ts`) show barangay too.
- Leaflet/react-leaflet chosen over Google Maps/Mapbox specifically because
  no paid map API key exists in this project yet — free OSM tiles, no key,
  consistent with the free-Nominatim-geocoding choice in D9. Loaded via
  `next/dynamic({ ssr: false })` since Leaflet needs `window`; a custom SVG
  divIcon is used for the pin instead of Leaflet's default marker (sidesteps
  the well-known default-icon-path-under-webpack breakage, and matches brand
  color instead of Leaflet's default blue).

## D11 — Vouchers: admin-created codes, priced and claimed server-side
**Decision:** Discount codes customers redeem at checkout. Three types
(`percent`, `fixed`, `free_shipping`), one per voucher, each with four
admin-configurable rules: minimum spend, total redemption cap, one-use-per-
email, and a validity window. Managed at `/admin/vouchers`.
**Why:** First promotional lever the shop has. Built to the same rule as D3/D9:
the browser may preview a price, only the server may decide one.
**Implications:**
- **File split mirrors D9.** `lib/vouchers.ts` is pure and client-safe (types,
  `normalizeCode`, `calcVoucherDiscount`, `checkVoucherRules`, `applyVoucher`)
  so the `'use client'` checkout page can import the discount math directly.
  Everything touching Postgres lives in the server-only `lib/voucherStore.ts`.
  `lib/voucherInput.ts` holds admin create/edit validation — in `lib/` and not
  in the route file because Next type-checks `route.ts` modules and rejects
  exports that aren't handlers or config.
- **`POST /api/vouchers/validate` is preview-only**, exactly like
  `/api/shipping/quote`. `POST /api/orders` re-looks-up the code, re-prices it
  and takes the redemption slot itself.
- **Claiming is atomic**, because the Neon HTTP driver has no interactive
  transactions. `claimVoucher()` does a guarded `UPDATE ... WHERE is_active AND
  window ok AND redemption_count < max_redemptions RETURNING id` (so the cap
  can't be oversold under concurrency), then inserts the redemption row whose
  unique index enforces one-per-email. If that insert loses the race the
  increment is rolled back. If the *order* insert then fails, the claim is
  released — a failed order must not burn a redemption.
- **One-per-email without accounts** is done with a `email_uniq` column on
  `voucher_redemptions`, set to `lower(email)` only when the voucher has the
  rule and `NULL` otherwise. Postgres treats NULLs as distinct in a unique
  index, so a single index enforces the rule for the vouchers that want it and
  constrains nothing for the rest. The pre-check in the validate endpoint is
  UX only; the index is what binds.
- **Money model:** `total = subtotal - discount + shipping`. `orders.discount`
  is the subtotal reduction only; a `free_shipping` voucher shows up as
  `shipping = 0` instead. `voucher_redemptions.discount` records the *total*
  pesos forgone (discount + any waived delivery) for reporting.
- **The free-Pasig ₱1000 threshold (D3) is judged on the pre-discount
  subtotal**, so a voucher can only ever make delivery cheaper, never dearer.
- `discount_value` is unvalidated at the type level, so the DB carries CHECK
  constraints (percent 1–100, fixed > 0, expiry after start) as a backstop to
  `lib/voucherInput.ts` — the schema stays correct even if a future caller
  skips the validator.
- **Deleting a redeemed voucher is refused** (409) — it would cascade its
  redemption rows away and null out `orders.voucher_id`, losing the audit trail
  behind discounts already given. Deactivating is the intended path, and the
  admin UI only offers Delete on never-redeemed vouchers.
- `redemption_count` is never writable through the admin edit endpoint; it is
  owned by `claimVoucher`/`releaseVoucher`. Letting an edit reset it would hand
  back already-spent redemption slots.
- Admin datetime inputs are pinned to **Asia/Manila (fixed UTC+8 — PH has had
  no DST since 1978)** in both directions rather than inheriting the browser's
  clock, so a voucher window means the same thing regardless of where admin is.
- `/api/admin/vouchers*` check the session cookie **in the route handler** via
  `isAdminAuthenticated()` (`lib/session.ts`). `middleware.ts` matches only
  `/admin/:path*` — pages — so it does not cover any `/api/admin/*` route. See
  the open items below.

## D12 — Order money is re-derived from the catalog, not the request
**Decision:** `POST /api/orders` ignores the posted `subtotal` and the posted
per-item prices entirely. `priceOrderItems()` (`lib/products.ts`) re-prices the
cart from the catalog by product id + quantity; an unknown id or a
non-whole/out-of-range quantity rejects the order with a 400.
**Why:** The route previously inserted the client's `subtotal` verbatim and
snapshotted the client's own price fields — so the browser decided what it
owed. D7 already claimed "a tampered localStorage cart can't change pricing";
that was true of shipping but **not** of the subtotal. Vouchers made it
material rather than theoretical: minimum-spend gating and percentage discounts
are both computed from the subtotal, so a tampered cart could unlock vouchers
it didn't qualify for and scale a percentage discount without limit.
**Implications:** The `items` JSONB snapshot now stores catalog-derived
name/shots/price, so historical orders can't contain prices the shop never
charged. `MAX_LINE_QUANTITY` (99) bounds a single line — a sanity check, not
inventory (there is still no stock tracking). Products removed from
`lib/products.ts` become unorderable immediately, which is the intended
behavior for a delisted item.

---
## Open items / known gaps
- `CLAUDE.md` is out of date (currency, payment, shipping) — update to match code.
- Default admin credentials and dev `SESSION_SECRET` fallback must not ship to prod.
- No automated DB migrations; schema changes are manual SQL.
- No inventory/stock tracking — orders can be placed regardless of stock.
- **`/api/admin/*` is not covered by `middleware.ts`** (its matcher is
  `/admin/:path*`, which is pages only). The voucher admin routes assert the
  session themselves via `isAdminAuthenticated()`, but `api/admin/orders`,
  `api/admin/orders/[id]` and `api/admin/stats` predate that helper and are
  still reachable unauthenticated. Fix is either the same guard in each or
  adding `/api/admin/:path*` to the middleware matcher.
- `POST /api/vouchers/validate` is unauthenticated and unthrottled by nature
  (customers must be able to try codes), so short codes are guessable. Prefer
  8+ character codes for anything valuable; a rate limit is the real fix.
- Vouchers are one-per-order and one type per voucher — no stacking, and no
  "10% off *and* free delivery" in a single code (that needs two codes today).
- A voucher redemption is claimed at order creation and is **not** returned if
  the order is later cancelled in admin — a cancelled order still consumes its
  slot.
- No order-confirmation page persistence beyond the returned `orderId`.
- Lalamove pickup location (`LALAMOVE_PICKUP_ADDRESS/LAT/LNG`) not yet set in
  `.env.local` — until it is, every order still gets the flat ₱99/free-Pasig
  rate (D9), silently, with a console warning.
- Nominatim (free OSM geocoding) can fail to resolve loosely-formatted PH
  addresses; when it does, that order also falls back to the flat rate rather
  than blocking checkout. (D10's map pin is the fix for this — but only for
  orders where the customer actually sets the pin.)
- Barangay dropdowns don't exist (D10) — free text only, so typos/variant
  spellings aren't caught. Not a correctness issue for pricing (the pin
  decides that), just for the address text stored/emailed/shown to admin.
