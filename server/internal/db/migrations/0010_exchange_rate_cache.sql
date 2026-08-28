-- Global, backend-only cache of historical FX rates, populated lazily by
-- GET /api/exchange-rate (see store.go GetExchangeRate/UpsertExchangeRate).
-- Historical rates never change once published, so rows have no TTL/expiry
-- — a cache hit is permanent. This table is read-only from the app's
-- perspective: a user's bill-level rate override (0009_currency.sql) never
-- writes here, it only ever writes to that bill's own row.
CREATE TABLE IF NOT EXISTS exchange_rates (
    date            TEXT NOT NULL,
    base_currency   TEXT NOT NULL,
    quote_currency  TEXT NOT NULL,
    rate            REAL NOT NULL,
    fetched_at      TEXT NOT NULL,
    PRIMARY KEY (date, base_currency, quote_currency)
);
CREATE INDEX IF NOT EXISTS idx_exchange_rates_fetched_at ON exchange_rates(fetched_at);
