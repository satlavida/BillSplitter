-- Multi-currency support: a session has its own base currency (bills already
-- had a `currency` column since 0001_init.sql, but nothing session-wide
-- existed). A bill whose currency differs from its session's carries an
-- exchange rate: either the value fetched from the global exchange_rates
-- cache (see 0010_exchange_rate_cache.sql) for exchange_rate_date, or a
-- user-entered override (exchange_rate_is_override) — either way, the
-- single exchange_rate column always holds whichever value is currently in
-- effect. Overrides are bill-local and never write back to the global cache.
ALTER TABLE sessions ADD COLUMN currency TEXT NOT NULL DEFAULT 'USD';
ALTER TABLE bills ADD COLUMN exchange_rate REAL;
ALTER TABLE bills ADD COLUMN exchange_rate_date TEXT;
ALTER TABLE bills ADD COLUMN exchange_rate_is_override INTEGER NOT NULL DEFAULT 0;
