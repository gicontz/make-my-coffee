-- On-site chat (issue #17). Additive only — nothing existing is altered, so a
-- code rollback across this migration stays safe (issue #9's release rule).
--
-- Run once against the Neon DB (this project has no migration runner; apply
-- manually via the Neon SQL editor, same as 0001-0006).

-- One conversation. `visitor_id` is an opaque value we mint into an httpOnly
-- cookie — the on-site equivalent of Messenger's PSID, and the reason the
-- widget can exist at all: an anonymous web visitor has no PSID and there is
-- no API to mint one.
--
-- It authenticates NOTHING. It means "same browser as before", not "same
-- person", which is why verified_order_id still has to be earned with an order
-- number *and* the email on that order. failed_attempts + window_started_at are
-- the same rate limit the Messenger path uses (lib/chat/rateLimit.ts).
--
-- assistant_calls is the money guard. This endpoint is public with no Meta in
-- front of it, so an uncapped model call behind it is somebody else's free
-- compute.
CREATE TABLE IF NOT EXISTS chat_sessions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id        TEXT NOT NULL UNIQUE,
  verified_order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
  failed_attempts   INTEGER NOT NULL DEFAULT 0,
  window_started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  assistant_calls   INTEGER NOT NULL DEFAULT 0,
  assistant_day     DATE NOT NULL DEFAULT CURRENT_DATE,
  needs_human       BOOLEAN NOT NULL DEFAULT FALSE,
  last_message_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- The staff inbox sorts by "needs a person first, then most recent".
CREATE INDEX IF NOT EXISTS chat_sessions_inbox_idx
  ON chat_sessions (needs_human DESC, last_message_at DESC);

-- Every turn, in order. `role` says who spoke: the visitor, the bot, or a
-- member of staff answering from /admin/chat.
CREATE TABLE IF NOT EXISTS chat_messages (
  id         SERIAL PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role       TEXT NOT NULL,
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chat_messages_role_chk CHECK (role IN ('visitor', 'bot', 'staff'))
);

-- The widget polls "anything newer than id N for this session".
CREATE INDEX IF NOT EXISTS chat_messages_session_idx ON chat_messages (session_id, id);
