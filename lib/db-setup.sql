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
  shipping       INTEGER NOT NULL DEFAULT 0,
  total          INTEGER NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'cod',
  payment_status TEXT NOT NULL DEFAULT 'unpaid',
  order_status   TEXT NOT NULL DEFAULT 'pending',
  delivery_slots TEXT[] NOT NULL DEFAULT '{}',
  shipping_source TEXT NOT NULL DEFAULT 'flat',
  shipping_distance_km NUMERIC,
  delivery_lat   NUMERIC,
  delivery_lng   NUMERIC,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Applied to the live DB via lib/migrations/0001_add_delivery_slots.sql,
-- 0002_add_shipping_source.sql and 0003_add_barangay_and_pin.sql; included
-- here too so a fresh setup doesn't need the migrations separately.

CREATE INDEX IF NOT EXISTS orders_order_status_idx  ON orders (order_status);
CREATE INDEX IF NOT EXISTS orders_created_at_idx    ON orders (created_at DESC);
