-- Run this once in the Neon SQL editor after creating your project

CREATE TABLE IF NOT EXISTS orders (
  id             SERIAL PRIMARY KEY,
  first_name     TEXT NOT NULL,
  last_name      TEXT NOT NULL,
  email          TEXT NOT NULL,
  phone          TEXT,
  address        TEXT,
  barangay       TEXT NOT NULL DEFAULT '',
  city           TEXT,
  province       TEXT,
  postal_code    TEXT,
  notes          TEXT,
  items          JSONB NOT NULL,
  subtotal       INTEGER NOT NULL,
  discount       INTEGER NOT NULL DEFAULT 0,
  shipping       INTEGER NOT NULL DEFAULT 0,
  total          INTEGER NOT NULL,
  voucher_code   TEXT NOT NULL DEFAULT '',
  payment_method TEXT NOT NULL DEFAULT 'cod',
  payment_status TEXT NOT NULL DEFAULT 'unpaid',
  paid_at        TIMESTAMPTZ,
  order_status   TEXT NOT NULL DEFAULT 'pending',
  delivery_date  DATE,
  delivery_slots TEXT[] NOT NULL DEFAULT '{}',
  shipping_source TEXT NOT NULL DEFAULT 'flat',
  shipping_distance_km NUMERIC,
  delivery_lat   NUMERIC,
  delivery_lng   NUMERIC,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Applied to the live DB via lib/migrations/0001_add_delivery_slots.sql,
-- 0002_add_shipping_source.sql, 0003_add_barangay_and_pin.sql,
-- 0004_add_vouchers.sql, 0005_add_paid_at.sql and 0008_add_delivery_date.sql;
-- included here too so a fresh setup doesn't need the migrations separately.

CREATE INDEX IF NOT EXISTS orders_order_status_idx  ON orders (order_status);
CREATE INDEX IF NOT EXISTS orders_created_at_idx    ON orders (created_at DESC);

-- ── Vouchers (0004) — see memory/decision.md D11 ──

CREATE TABLE IF NOT EXISTS vouchers (
  id               SERIAL PRIMARY KEY,
  code             TEXT NOT NULL UNIQUE,
  description      TEXT NOT NULL DEFAULT '',
  discount_type    TEXT NOT NULL,
  discount_value   INTEGER NOT NULL DEFAULT 0,
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

CREATE TABLE IF NOT EXISTS voucher_redemptions (
  id         SERIAL PRIMARY KEY,
  voucher_id INTEGER NOT NULL REFERENCES vouchers(id) ON DELETE CASCADE,
  order_id   INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  email      TEXT NOT NULL,
  email_uniq TEXT,
  discount   INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS voucher_redemptions_once_per_email_idx
  ON voucher_redemptions (voucher_id, email_uniq);
CREATE INDEX IF NOT EXISTS voucher_redemptions_voucher_idx ON voucher_redemptions (voucher_id);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS voucher_id   INTEGER REFERENCES vouchers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS voucher_code TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS discount     INTEGER NOT NULL DEFAULT 0;

-- 0005_add_paid_at — the CREATE TABLE above already has this column for a
-- fresh setup; this ALTER retrofits it onto a database that had the table
-- before 0005 (the live DB, and any Neon branch of it — e2e's included).
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

UPDATE orders SET paid_at = created_at WHERE payment_status = 'paid' AND paid_at IS NULL;

-- ── Email signups (0009) — see memory/decision.md D15 ──

ALTER TABLE vouchers
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'manual'
    CONSTRAINT vouchers_kind_chk CHECK (kind IN ('manual', 'welcome'));

CREATE TABLE IF NOT EXISTS email_subscribers (
  id                SERIAL PRIMARY KEY,
  email             TEXT NOT NULL,
  email_key         TEXT NOT NULL UNIQUE,
  source            TEXT NOT NULL DEFAULT '',
  consent_text      TEXT NOT NULL,
  subscribed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unsubscribed_at   TIMESTAMPTZ,
  unsubscribe_token TEXT NOT NULL UNIQUE,
  voucher_id        INTEGER REFERENCES vouchers(id) ON DELETE SET NULL,
  welcome_sent_at   TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS email_subscribers_created_at_idx ON email_subscribers (created_at);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS orders_email_key_idx ON orders (lower(trim(email)));

-- ── Reviews (0010) — issue #37 ──
-- Here as well as in the migration because the delivered transition now
-- issues a review token, and e2e applies this file rather than migrations.
-- No INSERT, ever: see the hard rule at the top of lib/reviews.ts.

CREATE TABLE IF NOT EXISTS review_requests (
  order_id    INTEGER PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reviews (
  id            SERIAL PRIMARY KEY,
  order_id      INTEGER NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  rating        SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body          TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  display_name  TEXT NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 40),
  product_ids   TEXT[] NOT NULL,
  approved      BOOLEAN NOT NULL DEFAULT FALSE,
  moderated_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS reviews_moderation_idx ON reviews (moderated_at NULLS FIRST, created_at DESC);
CREATE INDEX IF NOT EXISTS reviews_product_ids_idx ON reviews USING GIN (product_ids) WHERE approved;

-- ── Subscriptions (0013) — see memory/decision.md D16 ──
-- Same statements as lib/migrations/0013_add_subscriptions.sql, which carries
-- the reasoning. Nothing creates a subscription yet: billing comes first.

CREATE TABLE IF NOT EXISTS subscriptions (
  id                   SERIAL PRIMARY KEY,
  first_name           TEXT NOT NULL,
  last_name            TEXT NOT NULL,
  email                TEXT NOT NULL,
  phone                TEXT NOT NULL DEFAULT '',
  address              TEXT NOT NULL DEFAULT '',
  barangay             TEXT NOT NULL DEFAULT '',
  city                 TEXT NOT NULL DEFAULT '',
  province             TEXT NOT NULL DEFAULT '',
  postal_code          TEXT NOT NULL DEFAULT '',
  notes                TEXT NOT NULL DEFAULT '',
  delivery_lat         NUMERIC,
  delivery_lng         NUMERIC,
  items                JSONB NOT NULL,
  delivery_slots       TEXT[] NOT NULL,
  status               TEXT NOT NULL DEFAULT 'active',
  next_delivery_date   DATE NOT NULL,
  manage_token_version INTEGER NOT NULL DEFAULT 1,
  manage_token_hash    TEXT NOT NULL UNIQUE,
  paused_at            TIMESTAMPTZ,
  cancelled_at         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT subscriptions_status_chk CHECK (status IN ('active', 'paused', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS subscriptions_due_idx
  ON subscriptions (next_delivery_date) WHERE status = 'active';

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS subscription_id INTEGER REFERENCES subscriptions(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS orders_subscription_delivery_idx
  ON orders (subscription_id, delivery_date) WHERE subscription_id IS NOT NULL;
