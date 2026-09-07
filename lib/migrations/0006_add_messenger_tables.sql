-- Messenger bot state (issue #11). Two small tables, both additive — nothing
-- existing is altered, so a code rollback across this migration is safe (see
-- issue #9's release rule).
--
-- Run once against the Neon DB (this project has no migration runner; apply
-- manually via the Neon SQL editor, same as 0001-0005).

-- Meta retries webhook deliveries and can deliver the same event twice. Every
-- message is claimed here first: INSERT ... ON CONFLICT DO NOTHING returns no
-- row on a repeat, and that is what stops a customer being answered twice.
--
-- An in-memory Set cannot do this job — the webhook runs on serverless
-- instances that are created, duplicated and destroyed per request, so two
-- deliveries of one message routinely land in two different processes.
CREATE TABLE IF NOT EXISTS messenger_events (
  mid        TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- For pruning: these rows are only useful for as long as Meta might retry.
CREATE INDEX IF NOT EXISTS messenger_events_created_at_idx ON messenger_events (created_at);

-- One row per person who has messaged the Page. `psid` is Meta's page-scoped
-- id — it identifies a chatter to *this Page only* and tells us nothing about
-- who they are, which is exactly why verified_order_id has to be earned.
--
-- verified_order_id is set only after someone proved an order number *and* the
-- email on that order. It is what lets the bot answer a follow-up without
-- re-interrogating them. failed_attempts + window_started_at are the rate
-- limit: order ids are sequential, so without a cap someone could sit and
-- guess email addresses against #1, #2, #3.
CREATE TABLE IF NOT EXISTS messenger_sessions (
  psid              TEXT PRIMARY KEY,
  verified_order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  failed_attempts   INTEGER NOT NULL DEFAULT 0,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
