-- Removes the claims-approval workflow (req 6): a joiner's item selection
-- now either takes effect immediately (item_allocations, unchanged) or is
-- rejected outright by permission_mode read_only — there is no longer a
-- pending-approval queue for the creator to review. item_allocations itself
-- is untouched: it's the canonical storage for consumedBy, not claims-only.
DROP TABLE IF EXISTS item_claims;
