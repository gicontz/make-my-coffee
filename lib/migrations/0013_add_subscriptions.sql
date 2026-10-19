-- Weekly subscriptions at 10% off (#38). See memory/decision.md D16 and
-- lib/subscriptions.ts.
--
-- Numbered 0013, after PayMongo's 0012 (#21): subscriptions can't be offered
-- until billing exists, so this lands after it. 0009 (email capture) and 0010
-- (reviews) are taken on their branches; 0011 is unused.
--
-- ⚠️ No payment columns, on purpose. How a subscription is charged — a
-- PayMongo card subscription, a stored payment method, something else — is
-- not decided (D16), and whichever it is will bring its own columns in its own
-- migration. Nothing creates a row here until then.
--
-- Additive only, so a code rollback across this migration stays safe (issue #9).
--
-- Run once against the Neon DB (no migration runner here; apply manually via
-- the Neon SQL editor, same as 0001-0008).

CREATE TABLE IF NOT EXISTS subscriptions (
  id                   SERIAL PRIMARY KEY,

  -- Who and where, captured at sign-up and copied onto each generated order —
  -- the same fields an order has.
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

  -- [{id, quantity}] only — never a price. Each delivery is priced from
  -- lib/products.ts when its order is generated (D8, D12).
  items                JSONB NOT NULL,
  delivery_slots       TEXT[] NOT NULL,

  status               TEXT NOT NULL DEFAULT 'active',
  -- The next delivery not yet turned into an order. A DATE, read as
  -- next_delivery_date::text, for the reasons in 0008.
  next_delivery_date   DATE NOT NULL,

  -- The manage link is HMAC(SUBSCRIPTION_LINK_SECRET, id + version); only its
  -- SHA-256 is stored. Bumping the version revokes a leaked link.
  manage_token_version INTEGER NOT NULL DEFAULT 1,
  manage_token_hash    TEXT NOT NULL UNIQUE,

  paused_at            TIMESTAMPTZ,
  cancelled_at         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT subscriptions_status_chk CHECK (status IN ('active', 'paused', 'cancelled'))
);

-- What the order run will scan: active subscriptions coming due.
CREATE INDEX IF NOT EXISTS subscriptions_due_idx
  ON subscriptions (next_delivery_date) WHERE status = 'active';

-- Which orders a subscription produced. This is the column the weekly
-- subscription-share report counts; NULL is an ordinary one-off order.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS subscription_id INTEGER REFERENCES subscriptions(id) ON DELETE SET NULL;

-- One order per subscription per delivery day, enforced by the database rather
-- than by the order run remembering — a retried or overlapping run then cannot
-- deliver (or charge) the same week twice.
CREATE UNIQUE INDEX IF NOT EXISTS orders_subscription_delivery_idx
  ON orders (subscription_id, delivery_date) WHERE subscription_id IS NOT NULL;
