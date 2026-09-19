-- The date a customer asks their order to be delivered on (issue: delivery
-- date at checkout). Until now the shop captured time *windows* but no day, so
-- an order placed on Friday for "9-10am" said nothing about which morning.
--
-- Nullable, because every order placed before this shipped has no date and
-- inventing one would be worse than an honest NULL. Checkout requires it from
-- here on, enforced in POST /api/orders — so NULL means "placed before we
-- asked", not "customer skipped it".
--
-- DATE, not TIMESTAMPTZ: this is a calendar day the customer named, not an
-- instant. A timestamp would invite exactly the zone shift that turns
-- 20 September into the 19th somewhere between Manila and UTC.
--
-- Additive only, so a code rollback across this migration stays safe (issue #9).
--
-- Run once against the Neon DB (no migration runner here; apply manually via
-- the Neon SQL editor, same as 0001-0007).

ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_date DATE;

-- The admin orders list and the dashboard both want "what is due soonest".
CREATE INDEX IF NOT EXISTS orders_delivery_date_idx ON orders (delivery_date);
