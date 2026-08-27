-- Delivery time-slot picker (checkout). Customers choose one or more hourly
-- windows between 9am–7pm, with at least one morning + one afternoon/evening
-- slot required (enforced in app/api/orders, not here — see lib/deliverySlots.ts
-- for the canonical slot list, same pattern as VALID_ORDER_STATUSES).
--
-- Run once against the Neon DB (this project has no migration runner; apply
-- manually via the Neon SQL editor or `node` + the pg client, same as
-- lib/db-setup.sql).

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_slots TEXT[] NOT NULL DEFAULT '{}';
