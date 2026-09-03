-- Records the instant an order was actually marked paid, separate from
-- created_at (when it was placed). Backfills existing paid orders to their
-- created_at as the best available estimate — for COD that's usually close
-- to correct, and it's strictly better than leaving historical paid orders
-- with a NULL that reads as "never paid" once code starts relying on this
-- column. See memory/make_my_coffee_timezone.md and CLAUDE.md D-notes.
--
-- Run once against the Neon DB (this project has no migration runner; apply
-- manually via the Neon SQL editor, same as the earlier migrations).

ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

UPDATE orders SET paid_at = created_at WHERE payment_status = 'paid' AND paid_at IS NULL;
