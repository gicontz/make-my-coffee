-- Vouchers: admin-created discount codes redeemed by customers at checkout.
-- See memory/decision.md D11.
--
-- Run once against the Neon DB (this project has no migration runner; apply
-- manually via the Neon SQL editor, same as the earlier migrations).

CREATE TABLE IF NOT EXISTS vouchers (
  id               SERIAL PRIMARY KEY,
  -- Always stored normalized (uppercase, no spaces) by normalizeCode() in
  -- lib/vouchers.ts, so a plain UNIQUE is enough to make lookups
  -- case-insensitive without a functional index.
  code             TEXT NOT NULL UNIQUE,
  description      TEXT NOT NULL DEFAULT '',
  discount_type    TEXT NOT NULL,
  -- percent: 1-100. fixed: pesos off the subtotal. free_shipping: unused (0).
  discount_value   INTEGER NOT NULL DEFAULT 0,
  -- Percent vouchers only — caps the peso value of the discount. NULL = uncapped.
  max_discount     INTEGER,
  min_subtotal     INTEGER NOT NULL DEFAULT 0,
  max_redemptions  INTEGER,
  redemption_count INTEGER NOT NULL DEFAULT 0,
  once_per_email   BOOLEAN NOT NULL DEFAULT FALSE,
  starts_at        TIMESTAMPTZ,
  expires_at       TIMESTAMPTZ,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT vouchers_type_chk    CHECK (discount_type IN ('percent', 'fixed', 'free_shipping')),
  CONSTRAINT vouchers_percent_chk CHECK (discount_type <> 'percent' OR discount_value BETWEEN 1 AND 100),
  CONSTRAINT vouchers_fixed_chk   CHECK (discount_type <> 'fixed'   OR discount_value > 0),
  CONSTRAINT vouchers_cap_chk     CHECK (max_discount    IS NULL OR max_discount    > 0),
  CONSTRAINT vouchers_max_red_chk CHECK (max_redemptions IS NULL OR max_redemptions > 0),
  CONSTRAINT vouchers_min_sub_chk CHECK (min_subtotal >= 0),
  CONSTRAINT vouchers_window_chk  CHECK (starts_at IS NULL OR expires_at IS NULL OR expires_at > starts_at)
);

-- One row per successful redemption. Kept even when max_redemptions is NULL —
-- it is the audit log behind vouchers.redemption_count.
CREATE TABLE IF NOT EXISTS voucher_redemptions (
  id         SERIAL PRIMARY KEY,
  voucher_id INTEGER NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
  -- NULL only for the brief window between claiming the voucher and the
  -- order row existing (see claimVoucher/attachOrder in lib/voucherStore.ts).
  order_id   INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  email      TEXT NOT NULL,
  -- lower(email) when the voucher is once_per_email, otherwise NULL. Postgres
  -- treats NULLs as distinct in a unique index, so this one index enforces
  -- "one use per email" for the vouchers that want it and constrains nothing
  -- for the ones that don't — no partial index across tables needed.
  email_uniq TEXT,
  discount   INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS voucher_redemptions_once_per_email_idx
  ON voucher_redemptions (voucher_id, email_uniq);
CREATE INDEX IF NOT EXISTS voucher_redemptions_voucher_idx ON voucher_redemptions (voucher_id);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS voucher_id   INTEGER REFERENCES vouchers(id) ON DELETE SET NULL,
  -- Denormalized on purpose: the code as redeemed survives the voucher being
  -- deleted, same reasoning as the JSONB items snapshot (decision.md D8).
  ADD COLUMN IF NOT EXISTS voucher_code TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS discount     INTEGER NOT NULL DEFAULT 0;
