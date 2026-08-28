-- Records how each order's shipping fee was priced: a live Lalamove
-- quotation ('lalamove') or the flat/free fallback rate ('flat'). Lets admin
-- see which orders got a real distance-based price vs the guess rate.
-- See lib/shipping.ts / lib/lalamove.ts.
--
-- Run once against the Neon DB (this project has no migration runner; apply
-- manually via the Neon SQL editor, same as lib/db-setup.sql and
-- 0001_add_delivery_slots.sql).

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS shipping_source TEXT NOT NULL DEFAULT 'flat',
  ADD COLUMN IF NOT EXISTS shipping_distance_km NUMERIC;
