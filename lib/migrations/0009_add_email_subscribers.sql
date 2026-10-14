-- Email signups, the ₱50 welcome code and the running-low reminder (#39).
-- See memory/decision.md D15.
--
-- Additive only, so a code rollback across this migration stays safe (issue #9).
--
-- Run once against the Neon DB (no migration runner here; apply manually via
-- the Neon SQL editor, same as 0001-0008).

-- Welcome codes are ordinary vouchers — fixed ₱50, one redemption — so
-- POST /api/orders prices and claims them with no special case. `kind` exists
-- only to keep one-per-signup rows out of the admin voucher list, which is for
-- codes a person made.
ALTER TABLE vouchers
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'manual'
    CONSTRAINT vouchers_kind_chk CHECK (kind IN ('manual', 'welcome'));

CREATE TABLE IF NOT EXISTS email_subscribers (
  id                SERIAL PRIMARY KEY,
  -- As typed (trimmed), for addressing mail.
  email             TEXT NOT NULL,
  -- lower(trim(email)) — the identity. One row, and so one welcome code, per
  -- address however it is capitalised. Orders are matched on the same key.
  email_key         TEXT NOT NULL UNIQUE,
  -- Which form it came from ('home'), and the exact wording shown beside it.
  -- Together they are the record of what this person agreed to.
  source            TEXT NOT NULL DEFAULT '',
  consent_text      TEXT NOT NULL,
  subscribed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Set = no marketing mail, ever, until they sign up again. The row is kept
  -- (rather than deleted) so a re-signup can't mint a second welcome code; a
  -- request to be forgotten entirely deletes it by hand.
  unsubscribed_at   TIMESTAMPTZ,
  -- Random, 32 url-safe chars. Possession of it is the whole authorisation to
  -- unsubscribe — it is only ever in that person's own email.
  unsubscribe_token TEXT NOT NULL UNIQUE,
  voucher_id        INTEGER REFERENCES vouchers(id) ON DELETE SET NULL,
  -- NULL until the welcome email is handed to the provider. Claimed before
  -- sending and cleared again if the send fails, so a later re-signup retries
  -- a lost code instead of the address never receiving one.
  welcome_sent_at   TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The daily signup ceiling counts rows created in the last 24 hours.
CREATE INDEX IF NOT EXISTS email_subscribers_created_at_idx ON email_subscribers (created_at);

-- Set when the running-low reminder for this order is claimed. Never cleared
-- after a successful send, so one order is reminded at most once.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS reminder_sent_at TIMESTAMPTZ;

-- The reminder job joins orders to subscribers on the address key.
CREATE INDEX IF NOT EXISTS orders_email_key_idx ON orders (lower(trim(email)));
