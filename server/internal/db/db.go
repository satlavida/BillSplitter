// Package db opens the SQLite connection and applies migrations.
package db

import (
	"database/sql"
	"embed"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"time"

	_ "modernc.org/sqlite"
)

//go:embed migrations/*.sql
var migrationsFS embed.FS

// Open opens (creating parent directories as needed) the SQLite database at
// path, enables foreign key enforcement (required for cascading deletes
// used by cleanup), and applies any migrations not yet applied.
func Open(path string) (*sql.DB, error) {
	if dir := filepath.Dir(path); dir != "." {
		if err := os.MkdirAll(dir, 0o755); err != nil {
			return nil, fmt.Errorf("create db dir: %w", err)
		}
	}

	// busy_timeout so concurrent writers (e.g. two joiners claiming
	// different items at once) block-and-retry instead of failing outright
	// with SQLITE_BUSY; journal_mode=WAL so readers don't block writers (or
	// the writer) — see the pool sizing note below for why that requires
	// more than one connection to actually pay off.
	database, err := sql.Open("sqlite", path+"?_pragma=foreign_keys(1)&_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)")
	if err != nil {
		return nil, fmt.Errorf("open db: %w", err)
	}
	// A single-connection pool serializes every read behind every other
	// read and write, which defeats WAL's whole point (WAL lets readers
	// run concurrently with the one active writer). SQLite still only
	// allows one writer at a time, but that's enforced by SQLite's own file
	// locking + busy_timeout (writers block-and-retry, not error) — it
	// doesn't need Go's pool capped to 1 to be safe. 8 connections gives
	// read concurrency headroom without holding an excessive number of
	// open file descriptors/WAL readers.
	database.SetMaxOpenConns(8)
	database.SetMaxIdleConns(8)

	if err := database.Ping(); err != nil {
		return nil, fmt.Errorf("ping db: %w", err)
	}

	if err := migrate(database); err != nil {
		return nil, fmt.Errorf("migrate: %w", err)
	}

	return database, nil
}

// schema_migrations records which migration files have already run. Early
// migrations only used CREATE TABLE/INDEX IF NOT EXISTS, which are naturally
// idempotent, so this tracking wasn't needed until a migration needed a
// non-idempotent statement like ALTER TABLE ADD COLUMN (fails with
// "duplicate column" if re-run).
const createSchemaMigrations = `CREATE TABLE IF NOT EXISTS schema_migrations (
	name        TEXT PRIMARY KEY,
	applied_at  TEXT NOT NULL
)`

func migrate(database *sql.DB) error {
	if _, err := database.Exec(createSchemaMigrations); err != nil {
		return fmt.Errorf("create schema_migrations: %w", err)
	}

	applied := map[string]bool{}
	rows, err := database.Query(`SELECT name FROM schema_migrations`)
	if err != nil {
		return fmt.Errorf("query schema_migrations: %w", err)
	}
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			rows.Close()
			return fmt.Errorf("scan schema_migrations: %w", err)
		}
		applied[name] = true
	}
	if err := rows.Err(); err != nil {
		return fmt.Errorf("iterate schema_migrations: %w", err)
	}
	rows.Close()

	entries, err := migrationsFS.ReadDir("migrations")
	if err != nil {
		return err
	}

	names := make([]string, 0, len(entries))
	for _, e := range entries {
		names = append(names, e.Name())
	}
	sort.Strings(names)

	for _, name := range names {
		if applied[name] {
			continue
		}
		sqlBytes, err := migrationsFS.ReadFile("migrations/" + name)
		if err != nil {
			return fmt.Errorf("read migration %s: %w", name, err)
		}
		if _, err := database.Exec(string(sqlBytes)); err != nil {
			return fmt.Errorf("apply migration %s: %w", name, err)
		}
		if _, err := database.Exec(`INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)`, name, time.Now().UTC().Format(time.RFC3339)); err != nil {
			return fmt.Errorf("record migration %s: %w", name, err)
		}
	}

	return nil
}
