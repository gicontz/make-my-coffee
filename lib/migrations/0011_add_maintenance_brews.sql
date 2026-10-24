-- Maintenance brews: beans used for dialing in, cleaning cycles, calibration
-- and testing (issue #51).
--
-- These beans are never sold, so they never appear in `orders` — until now
-- they left inventory with no trace, a hidden cost. One row per brew records
-- what was done, how many grams it took, who did it and when.
--
-- operators — the people who brew. Seeded here and read-only: no admin UI or
--   API writes to it, so adding an operator is a migration. First names only;
--   if this ever grows an email or phone column, /privacy needs revisiting.
--   `ON CONFLICT DO NOTHING` keeps the seed safe to re-run.
--
-- maintenance_brews — created `in_progress`, then closed exactly once by an
--   admin (PATCH /api/admin/maintenance-brews/[id], whose UPDATE carries
--   `WHERE status = 'in_progress'`): `done`, or `failed` when the assignee
--   never did it. A failed brew never happened, so its grams are not beans
--   used. There is no way back to in_progress, and no way between the two.
--   maintenance_brews_closed_chk ties each status to its own timestamp, so a
--   row can't claim to be done with no done_at, or carry both stamps.
--
-- Additive only, so a code rollback across this migration stays safe (issue #9).
--
-- Run once against the Neon DB (no migration runner here; apply manually via
-- the Neon SQL editor, same as 0001-0010).

CREATE TABLE IF NOT EXISTS operators (
  id    SERIAL PRIMARY KEY,
  name  TEXT NOT NULL UNIQUE
);

INSERT INTO operators (name) VALUES ('Gim'), ('Gleia'), ('Romel')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS maintenance_brews (
  id           SERIAL PRIMARY KEY,
  activity     TEXT NOT NULL CHECK (char_length(activity) BETWEEN 1 AND 200),
  beans_grams  INTEGER NOT NULL CHECK (beans_grams > 0),
  operator_id  INTEGER NOT NULL REFERENCES operators(id),
  status       TEXT NOT NULL DEFAULT 'in_progress'
                 CONSTRAINT maintenance_brews_status_chk CHECK (status IN ('in_progress', 'done', 'failed')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  done_at      TIMESTAMPTZ,
  failed_at    TIMESTAMPTZ,

  CONSTRAINT maintenance_brews_closed_chk CHECK (
    (status = 'in_progress' AND done_at IS NULL     AND failed_at IS NULL) OR
    (status = 'done'        AND done_at IS NOT NULL AND failed_at IS NULL) OR
    (status = 'failed'      AND failed_at IS NOT NULL AND done_at IS NULL)
  )
);

-- The log is read newest first.
CREATE INDEX IF NOT EXISTS maintenance_brews_created_idx ON maintenance_brews (created_at DESC);
