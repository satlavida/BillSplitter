#!/usr/bin/env bash
# Seeds one realistic session (creator + bill) via the real API and writes
# the ids/tokens the bench_*.sh scripts need to benchmark/.seed.env
# (gitignored — regenerated every run, not meant to be committed).
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
source ./lib.sh
require_cmds curl

curl -sf "$BASE_URL/healthz" >/dev/null || die "server not reachable at $BASE_URL — run setup.sh first"

log "Creating session"
create_resp="$(curl -sf -X POST "$BASE_URL/api/sessions" \
  -H 'Content-Type: application/json' \
  -d '{
    "title": "Benchmark Session",
    "people": [{"id":"p1","name":"Alice","upiId":""},{"id":"p2","name":"Bob","upiId":""}],
    "joinMode": "open_link",
    "claimMode": "free_select",
    "permissionMode": "edit",
    "creatorPersonId": "p1",
    "currency": "INR"
  }')"
code="$(echo "$create_resp" | grep -oE '"code":"[^"]*"' | cut -d'"' -f4)"
token="$(echo "$create_resp" | grep -oE '"creatorToken":"[^"]*"' | cut -d'"' -f4)"
[ -n "$code" ] && [ -n "$token" ] || die "session creation failed: $create_resp"

log "Adding a bill"
bill_resp="$(curl -sf -X POST "$BASE_URL/api/sessions/$code/bills" \
  -H 'Content-Type: application/json' -H "X-Creator-Token: $token" \
  -d '{"title":"Dinner","currency":"INR","taxAmount":0}')"
bill_id="$(echo "$bill_resp" | grep -oE '"id":"[^"]*"' | head -1 | cut -d'"' -f4)"
[ -n "$bill_id" ] || die "bill creation failed: $bill_resp"

log "Adding an item (for claim/unclaim benchmarks)"
item_resp="$(curl -sf -X POST "$BASE_URL/api/sessions/$code/bills/$bill_id/items" \
  -H 'Content-Type: application/json' -H "X-Creator-Token: $token" \
  -d '{"name":"Seed Item","price":100,"quantity":1}')"
item_id="$(echo "$item_resp" | grep -oE '"id":"[^"]*"' | head -1 | cut -d'"' -f4)"
[ -n "$item_id" ] || die "item creation failed: $item_resp"

cat >"$BENCH_DIR/.seed.env" <<EOF
SESSION_CODE=$code
CREATOR_TOKEN=$token
BILL_ID=$bill_id
ITEM_ID=$item_id
PERSON_ID=p2
EOF

log "Seeded session=$code bill=$bill_id -> $BENCH_DIR/.seed.env"
