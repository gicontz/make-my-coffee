-- Structured address (Province/City dropdowns restricted to Lalamove's
-- realistic coverage from the Pasig pickup point + free-text Barangay) and
-- the customer's confirmed checkout map pin. See lib/phLocations.ts,
-- components/DeliveryMapPicker.tsx, memory/decision.md D10.
--
-- Run once against the Neon DB (this project has no migration runner; apply
-- manually via the Neon SQL editor, same as the earlier migrations).

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS barangay TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS delivery_lat NUMERIC,
  ADD COLUMN IF NOT EXISTS delivery_lng NUMERIC;
