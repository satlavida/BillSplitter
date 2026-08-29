-- Widens item_activity's action CHECK constraint to allow 'edit_item' and
-- 'delete_item' (a joiner with edit permission changing an item's own
-- fields or removing it entirely, distinct from claiming/unclaiming a
-- share of it), plus a free-text `details` column to describe what changed
-- (e.g. "price $10.00 -> $12.00") since price/quantity/name edits aren't a
-- single before/after number the way a claim's delta_value/total_value are.
--
-- SQLite has no ALTER TABLE support for modifying a CHECK constraint, so
-- this uses the same rename -> recreate -> copy -> drop pattern as
-- 0004_claim_activity_reject.sql.

ALTER TABLE item_activity RENAME TO item_activity_old;

CREATE TABLE item_activity (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id    TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    item_id       TEXT NOT NULL,
    item_name     TEXT NOT NULL,
    person_id     TEXT NOT NULL,
    person_name   TEXT NOT NULL,
    action        TEXT NOT NULL CHECK (action IN ('claim', 'unclaim', 'reject', 'edit_item', 'delete_item')),
    delta_value   REAL NOT NULL,
    total_value   REAL NOT NULL,
    details       TEXT NOT NULL DEFAULT '',
    created_at    TEXT NOT NULL
);

INSERT INTO item_activity (id, session_id, item_id, item_name, person_id, person_name, action, delta_value, total_value, details, created_at)
    SELECT id, session_id, item_id, item_name, person_id, person_name, action, delta_value, total_value, '', created_at
    FROM item_activity_old;

DROP TABLE item_activity_old;

CREATE INDEX IF NOT EXISTS idx_item_activity_session ON item_activity(session_id, created_at);
