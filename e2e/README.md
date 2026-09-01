# End-to-end tests

Playwright suite covering the voucher feature: the admin backoffice, the
customer checkout journey, and the API contract (authorization, payload
tampering, and the redemption limits under concurrency).

```bash
npm run test:e2e          # headless
npm run test:e2e:ui       # Playwright UI mode
npx playwright test --list
npx playwright test e2e/voucher-api.spec.ts
```

## You need a throwaway database first

The suite creates and deletes orders, vouchers and redemptions, and asserts on
exact redemption counts — so it must not run against the real shop. It will
refuse to start until `E2E_DATABASE_URL` is set, and refuse again if that value
matches the `DATABASE_URL` in `.env.local`.

The cheapest safe option is a **Neon branch** of the production database
(Neon console → Branches → New branch). It is an instant copy-on-write clone
with its own connection string and costs nothing to keep or delete. A blank
Postgres works equally well — `ensureSchema()` applies `lib/db-setup.sql`,
whose statements are all idempotent.

```bash
cp .env.e2e.example .env.e2e
# then put the branch connection string in E2E_DATABASE_URL
```

`.env.e2e` is gitignored.

## What the test server does *not* get

`playwright.config.ts` starts its own `next dev` with a deliberately stripped
environment: no Gmail credentials, no Lalamove keys, and `EMAIL_TRANSPORT=json`.

That last one matters. Withholding the Gmail credentials stops mail going out,
but nodemailer still dials smtp.gmail.com and fails authentication — so every
order-placing test was a failed Gmail login from your IP, which is how a sender
gets flagged. `EMAIL_TRANSPORT=json` selects nodemailer's `jsonTransport`, which
resolves `sendMail()` without opening a socket. The compose path still runs, so
a template that throws still fails the test.

Both integrations also fail soft by design — order email is fire-and-forget (D5)
and the shipping quote falls back to the flat ₱99 rate (D9) — so the suite never
emails a real person, never calls the courier API, and gets a deterministic
delivery fee to assert against.

## Layout

| File | Covers |
|------|--------|
| `voucher-admin.spec.ts` | Creating each voucher type, validation, editing, activate/deactivate, delete rules, state badges |
| `voucher-checkout.spec.ts` | Applying/removing codes, every discount type, every rejection reason, the full shop → cart → checkout journey, and the order row that results |
| `voucher-api.spec.ts` | Admin authorization, the validate endpoint contract, tampered subtotals/prices/items, and concurrent redemption limits |
| `helpers/db.ts` | Schema setup, seeding, readback, cleanup, and the production-database guard |
| `helpers/app.ts` | Page objects for the storefront, checkout and admin forms |

Fixtures are tagged so cleanup can find them without touching anything else:
voucher codes start with `E2E`, customer emails end in `@e2e.test`.

Specs share one database and assert on exact counts, so the config runs them
with a single worker and no cross-file parallelism.
