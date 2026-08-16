-- Widens item_activity's action CHECK constraint to allow 'reject' (the
-- creator declining a pending claims_require_approval claim, distinct from
-- a joiner cancelling their own pending claim via unclaim — see the new
-- RejectClaim store method / POST .../claims/{id}/reject route).
--
-- SQLite has no ALTER TABLE support for modifying a CHECK constraint, so
-- this uses the standard rename -> recreate -> copy -> drop pattern.

ALTER TABLE item_activity RENAME TO item_activity_old;

CREATE TABLE item_activity (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id    TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    item_id       TEXT NOT NULL,
    item_name     TEXT NOT NULL,
    person_id     TEXT NOT NULL,
    person_name   TEXT NOT NULL,
    action        TEXT NOT NULL CHECK (action IN ('claim', 'unclaim', 'reject')),
    delta_value   REAL NOT NULL,
    total_value   REAL NOT NULL,
    created_at    TEXT NOT NULL
);

INSERT INTO item_activity (id, session_id, item_id, item_name, person_id, person_name, action, delta_value, total_value, created_at)
    SELECT id, session_id, item_id, item_name, person_id, person_name, action, delta_value, total_value, created_at
    FROM item_activity_old;

DROP TABLE item_activity_old;

CREATE INDEX IF NOT EXISTS idx_item_activity_session ON item_activity(session_id, created_at);
