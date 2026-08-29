// Maps the Go server's `{"error": "..."}` strings (server/internal/api/*.go's
// writeError calls — written for developers, e.g. "invalid joiner token for
// this person") to copy a non-technical user can act on. liveApi.ts's
// request() is the single choke point where every API error passes through
// this, so no call site needs to know about raw server wording.
const EXACT_MATCHES: Record<string, string> = {
  'invalid joiner token for this person': "Your session isn't valid anymore — try rejoining.",
  'x-joiner-token header required': "Your session isn't valid anymore — try rejoining.",
  'invalid creator token': "You're not authorized to do that.",
  'x-creator-token header required': "You're not authorized to do that.",
  'this session is read-only for joiners': 'This session is read-only right now.',
  'session has been settled': 'This session has already been settled and is now read-only.',
  "cannot join as the session creator's own identity": "You can't join using the host's own identity.",
  'this person is already active in the session — try again in a few minutes': 'That person is already active in this session — try again in a few minutes.',
  'session not found': "We couldn't find that session — double-check the code and try again.",
  'bill not found': "We couldn't find that bill.",
  'item not found': "We couldn't find that item.",
  'joiner not found': "We couldn't find that join request.",
  'image not found': "We couldn't find that image.",
  'name or existingpersonid is required': 'Please enter a name to join.',
  'personid is required': 'Please select who this is for.',
  'image field is required': 'Please choose an image to upload.',
  "creatorpersonid must reference a person in people": 'Please choose a valid person.',
  'invalid request body': 'Something went wrong with that request — please try again.',
  'invalid multipart form': "That upload didn't go through — please try again.",
};

const GENERIC_FALLBACK = 'Something went wrong. Please try again.';

// bill_handlers.go's ClaimItem over-claim rejection embeds the actual
// remaining count (e.g. "Only 3 left to claim on this item"), so it can't
// be an EXACT_MATCHES entry — this is already human-readable as written,
// so it passes through unchanged rather than collapsing to the generic
// fallback and losing the number the joiner needs to see.
const OVER_CLAIM_PATTERN = /^only \d+(\.\d+)? left to claim on this item$/i;

// Anything not explicitly mapped (including every bare "failed to ..." 500)
// collapses to the same generic fallback rather than leaking server wording.
export function friendlyErrorMessage(raw: string): string {
  const trimmed = raw.trim();
  if (OVER_CLAIM_PATTERN.test(trimmed)) return trimmed;
  return EXACT_MATCHES[trimmed.toLowerCase()] ?? GENERIC_FALLBACK;
}
