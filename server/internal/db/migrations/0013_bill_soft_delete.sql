-- Soft-delete for bills: deleting a bill (creator or a joiner with edit
-- permission) sets deleted_at instead of removing the row, so a creator can
-- review what was deleted (via the activity log) and restore it. Only an
-- explicit "permanently remove" (creator-only) actually deletes the row —
-- see store.go's SoftDeleteBill/RestoreBill/HardDeleteBill and
-- api.DeleteBill/RestoreBill/PermanentlyDeleteBill.
ALTER TABLE bills ADD COLUMN deleted_at TEXT;

-- Widens item_activity's action CHECK to add the three bill-level actions.
-- item_id/item_name double as billId/bill title for these three (a bill
-- isn't an item, but reusing this table keeps a single audit log rather
-- than splitting bill activity into its own table+endpoint) — see
-- bill_handlers.go's DeleteBill/RestoreBill/PermanentlyDeleteBill.
--
-- SQLite has no ALTER TABLE support for modifying a CHECK constraint, so
-- this uses the same rename -> recreate -> copy -> drop pattern as
-- 0004_claim_activity_reject.sql / 0012_item_edit_delete_activity.sql.
ALTER TABLE item_activity RENAME TO item_activity_old;

CREATE TABLE item_activity (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id    TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    item_id       TEXT NOT NULL,
    item_name     TEXT NOT NULL,
    person_id     TEXT NOT NULL,
    person_name   TEXT NOT NULL,
    action        TEXT NOT NULL CHECK (action IN ('claim', 'unclaim', 'reject', 'edit_item', 'delete_item', 'delete_bill', 'restore_bill', 'permanent_delete_bill')),
    delta_value   REAL NOT NULL,
    total_value   REAL NOT NULL,
    details       TEXT NOT NULL DEFAULT '',
    created_at    TEXT NOT NULL
);

INSERT INTO item_activity (id, session_id, item_id, item_name, person_id, person_name, action, delta_value, total_value, details, created_at)
    SELECT id, session_id, item_id, item_name, person_id, person_name, action, delta_value, total_value, details, created_at
    FROM item_activity_old;

DROP TABLE item_activity_old;

CREATE INDEX IF NOT EXISTS idx_item_activity_session ON item_activity(session_id, created_at);
