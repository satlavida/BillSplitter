-- Schema for BillSplitter's live-collaboration layer (planv3.md section 3.3).
-- item_allocations is a normalized table (one row per {item, person}) rather
-- than a JSON array column specifically so concurrent joiner claims are
-- row-level inserts, not read-modify-write races on a JSON blob.

CREATE TABLE IF NOT EXISTS sessions (
    id              TEXT PRIMARY KEY,             -- 5-char code
    title           TEXT NOT NULL DEFAULT '',
    creator_token   TEXT NOT NULL,
    join_mode       TEXT NOT NULL DEFAULT 'approval_code' CHECK (join_mode IN ('approval_code', 'open_link')),
    claim_mode      TEXT NOT NULL DEFAULT 'free_select' CHECK (claim_mode IN ('free_select', 'claims_require_approval')),
    is_settled      INTEGER NOT NULL DEFAULT 0,
    settled_at      TEXT,
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL,
    last_access_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS people (
    id          TEXT PRIMARY KEY,
    session_id  TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    name        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_people_session ON people(session_id);

CREATE TABLE IF NOT EXISTS bills (
    id                  TEXT PRIMARY KEY,
    session_id          TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    title               TEXT NOT NULL DEFAULT '',
    date                TEXT NOT NULL,
    tax_amount          REAL NOT NULL DEFAULT 0,
    currency            TEXT NOT NULL DEFAULT 'USD',
    paid_by_person_id   TEXT REFERENCES people(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_bills_session ON bills(session_id);

CREATE TABLE IF NOT EXISTS items (
    id            TEXT PRIMARY KEY,
    bill_id       TEXT NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    price         REAL NOT NULL DEFAULT 0,
    quantity      INTEGER NOT NULL DEFAULT 1,
    discount      REAL NOT NULL DEFAULT 0,
    discount_type TEXT NOT NULL DEFAULT 'flat' CHECK (discount_type IN ('flat', 'percentage')),
    split_type    TEXT NOT NULL DEFAULT 'equal' CHECK (split_type IN ('equal', 'percentage', 'fraction'))
);
CREATE INDEX IF NOT EXISTS idx_items_bill ON items(bill_id);

CREATE TABLE IF NOT EXISTS item_allocations (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id    TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    person_id  TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    value      REAL NOT NULL DEFAULT 1,
    UNIQUE (item_id, person_id)
);
CREATE INDEX IF NOT EXISTS idx_allocations_item ON item_allocations(item_id);

CREATE TABLE IF NOT EXISTS joiners (
    id              TEXT PRIMARY KEY,
    session_id      TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    name            TEXT NOT NULL,
    person_id       TEXT REFERENCES people(id) ON DELETE SET NULL,
    status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'disapproved')),
    approval_code   TEXT NOT NULL DEFAULT '',
    created_at      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_joiners_session ON joiners(session_id);

-- Only populated in claims_require_approval mode; free_select claims go
-- straight into item_allocations.
CREATE TABLE IF NOT EXISTS item_claims (
    id         TEXT PRIMARY KEY,
    item_id    TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    person_id  TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    value      REAL NOT NULL DEFAULT 1,
    status     TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved'))
);
CREATE INDEX IF NOT EXISTS idx_claims_item ON item_claims(item_id);

CREATE TABLE IF NOT EXISTS images (
    ref_key    TEXT PRIMARY KEY,
    bill_id    TEXT NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
    file_path  TEXT NOT NULL,
    width      INTEGER NOT NULL DEFAULT 0,
    height     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_images_bill ON images(bill_id);
