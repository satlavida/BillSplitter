-- A rejoin by the same known person previously inserted a second `joiners`
-- row instead of replacing the first, so they'd show up twice in the
-- creator's approval list. Collapse any existing duplicates (keep the most
-- recent row per session+person) and enforce uniqueness going forward so
-- CreateJoiner can upsert instead of insert.
DELETE FROM joiners
WHERE person_id IS NOT NULL
  AND id NOT IN (
    SELECT id FROM (
      SELECT id, ROW_NUMBER() OVER (
        PARTITION BY session_id, person_id
        ORDER BY created_at DESC, id DESC
      ) AS rn
      FROM joiners
      WHERE person_id IS NOT NULL
    )
    WHERE rn = 1
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_joiners_session_person
    ON joiners(session_id, person_id)
    WHERE person_id IS NOT NULL;
