-- Payment logging (see architecture/payments.md). require_payment_verification
-- is creator-only, default true — when true a payer-added payment stays
-- unverified until the payee confirms it; when false every payment
-- auto-verifies regardless of who added it. See
-- internal/settlement/paymentverify.go's ComputeInitialVerified.

ALTER TABLE sessions ADD COLUMN require_payment_verification INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS payments (
    id                        TEXT PRIMARY KEY,
    session_id                TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    payer_id                  TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    payee_id                  TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    amount                    REAL NOT NULL,
    currency                  TEXT NOT NULL,
    exchange_rate             REAL,
    exchange_rate_date        TEXT,
    exchange_rate_is_override INTEGER NOT NULL DEFAULT 0,
    method                    TEXT NOT NULL CHECK (method IN ('cash', 'online')),
    transaction_id            TEXT,
    added_by_person_id        TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
    verified                  INTEGER NOT NULL DEFAULT 0,
    verified_at               TEXT,
    created_at                TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_payments_session ON payments(session_id, created_at);
