-- Adds the session-wide edit/read-only permission toggle for joiners (replacing
-- the claims-approval workflow, removed in migration 0006) and tracks which
-- person row represents the session creator, so a joiner can be blocked from
-- claiming the creator's own identity (see presence.Tracker for the parallel
-- reclaim-lock check on non-creator identities).
ALTER TABLE sessions ADD COLUMN permission_mode TEXT NOT NULL DEFAULT 'edit' CHECK (permission_mode IN ('edit', 'read_only'));
ALTER TABLE sessions ADD COLUMN creator_person_id TEXT REFERENCES people(id) ON DELETE SET NULL;
