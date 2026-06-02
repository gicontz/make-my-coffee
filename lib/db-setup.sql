-- Run this once in the Neon SQL editor after creating your project

CREATE TABLE IF NOT EXISTS orders (
  id             SERIAL PRIMARY KEY,
  first_name     TEXT NOT NULL,
  last_name      TEXT NOT NULL,
  email          TEXT NOT NULL,
  phone          TEXT,
  address        TEXT,
  city           TEXT,
  province       TEXT,
  postal_code    TEXT,
  notes          TEXT,
  items          JSONB NOT NULL,
  subtotal       INTEGER NOT NULL,
  shipping       INTEGER NOT NULL DEFAULT 0,
  total          INTEGER NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'cod',
  payment_status TEXT NOT NULL DEFAULT 'unpaid',
  order_status   TEXT NOT NULL DEFAULT 'pending',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS orders_order_status_idx  ON orders (order_status);
CREATE INDEX IF NOT EXISTS orders_created_at_idx    ON orders (created_at DESC);
