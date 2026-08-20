-- Admin-configurable settings (key/value), background-job run history, and
-- a durable error-event log used for the /adminhealth windowed error counts.

CREATE TABLE IF NOT EXISTS settings (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS job_runs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    job_name    TEXT NOT NULL,
    status      TEXT NOT NULL, -- 'started' | 'success' | 'failed'
    started_at  TEXT NOT NULL,
    finished_at TEXT,
    message     TEXT
);
CREATE INDEX IF NOT EXISTS idx_job_runs_job_name_started_at ON job_runs(job_name, started_at);

CREATE TABLE IF NOT EXISTS error_events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    category    TEXT NOT NULL, -- e.g. 'openrouter_request', 'job_cleanup', ...
    occurred_at TEXT NOT NULL,
    message     TEXT
);
CREATE INDEX IF NOT EXISTS idx_error_events_category_occurred_at ON error_events(category, occurred_at);
