-- Customer reviews, requested after delivery (issue #37).
--
-- Two tables, because the right to review and the review itself arrive at
-- different times and from different people. An admin marking an order
-- delivered creates the request; the customer, days later, writes the review.
--
-- review_requests — one per delivered order. Holds a SHA-256 of the token
--   that goes out in the delivered email, never the token itself: whoever can
--   read this table should not thereby be able to post as the customer.
--   `orders.id` is a SERIAL, so a link keyed on the number would let anyone
--   walk the table and review orders that are not theirs (the same reasoning
--   that makes lookupOrder() demand the number *and* the email). The token
--   is 256 random bits and is the only thing the public endpoint accepts.
--
-- reviews — one per order, UNIQUE, so a link cannot be replayed into a
--   second review. `product_ids` is a snapshot of the bottles the order
--   contained, taken at submission: the review shows on each of those
--   product pages and nowhere else.
--
-- Moderation is `approved` plus `moderated_at`: NULL moderated_at is the
-- queue, approved = false after moderation is rejected. Nothing is public
-- until a person has approved it.
--
-- There is deliberately no INSERT here, and there must never be one: a
-- review exists only because a customer with a delivered order wrote it.
--
-- Additive only, so a code rollback across this migration stays safe (issue #9).
--
-- Run once against the Neon DB (no migration runner here; apply manually via
-- the Neon SQL editor, same as 0001-0009).

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

-- The admin queue: unmoderated first, newest first.
CREATE INDEX IF NOT EXISTS reviews_moderation_idx ON reviews (moderated_at NULLS FIRST, created_at DESC);

-- A product page reads approved reviews whose snapshot contains its bottle.
CREATE INDEX IF NOT EXISTS reviews_product_ids_idx ON reviews USING GIN (product_ids) WHERE approved;
