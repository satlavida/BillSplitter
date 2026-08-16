-- Adds joiner-side auth (mirrors sessions.creator_token, see store.go's
-- randomToken()) so claim/unclaim requests can be verified as coming from
-- the joiner they claim to be, plus a durable claim/unclaim activity log the
-- creator can review. Existing joiner rows get joiner_token = '' — a joiner
-- approved before this migration will need to rejoin to get a token, since
-- there's no way to retroactively hand them one; acceptable given this app's
-- 48h session purge window.
--
-- Requires the migration runner to track already-applied files (see
-- db.go's schema_migrations table) — unlike 0001/0002, ALTER TABLE ADD
-- COLUMN is not safely re-runnable the way CREATE TABLE IF NOT EXISTS is.

ALTER TABLE joiners ADD COLUMN joiner_token TEXT NOT NULL DEFAULT '';
ALTER TABLE joiners ADD COLUMN token_revealed INTEGER NOT NULL DEFAULT 0;

-- item_id/person_id are deliberately not foreign keys: this is a durable
-- historical record, not a live join, so it should survive an item or
-- person being removed rather than cascading away with them. item_name and
-- person_name are snapshotted at write time for the same reason.
CREATE TABLE IF NOT EXISTS item_activity (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id    TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    item_id       TEXT NOT NULL,
    item_name     TEXT NOT NULL,
    person_id     TEXT NOT NULL,
    person_name   TEXT NOT NULL,
    action        TEXT NOT NULL CHECK (action IN ('claim', 'unclaim')),
    delta_value   REAL NOT NULL,
    total_value   REAL NOT NULL,
    created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_item_activity_session ON item_activity(session_id, created_at);
