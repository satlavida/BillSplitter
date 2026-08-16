-- Receipt-scan usage tracking, migrated from the external bill-processor
-- Cloudflare Worker's KV-backed usage stats. Aggregates are updated with
-- INSERT ... ON CONFLICT upserts (see store.go RecordScanRequest) instead of
-- the Worker's non-atomic KV read-modify-write.

CREATE TABLE IF NOT EXISTS scan_requests (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    requested_at       TEXT NOT NULL,
    model              TEXT NOT NULL,
    success            INTEGER NOT NULL DEFAULT 1,
    prompt_tokens      INTEGER NOT NULL DEFAULT 0,
    completion_tokens  INTEGER NOT NULL DEFAULT 0,
    total_tokens       INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_scan_requests_requested_at ON scan_requests(requested_at);

CREATE TABLE IF NOT EXISTS scan_usage_daily (
    day                TEXT PRIMARY KEY,   -- YYYY-MM-DD
    request_count      INTEGER NOT NULL DEFAULT 0,
    prompt_tokens      INTEGER NOT NULL DEFAULT 0,
    completion_tokens  INTEGER NOT NULL DEFAULT 0,
    total_tokens       INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS scan_usage_monthly (
    month              TEXT PRIMARY KEY,   -- YYYY-MM
    request_count      INTEGER NOT NULL DEFAULT 0,
    prompt_tokens      INTEGER NOT NULL DEFAULT 0,
    completion_tokens  INTEGER NOT NULL DEFAULT 0,
    total_tokens       INTEGER NOT NULL DEFAULT 0
);
