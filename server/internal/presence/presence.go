// Package presence tracks which (session, person) pairs have an actively
// polling joiner, via an in-memory last-seen map. It serves three purposes:
// showing an online/offline indicator for claimed people, gating whether a
// person identity is free for a new joiner to claim (see IsAvailable), and
// tracking how long a person has been continuously active (see ActiveSince,
// used to gate renaming an active/claimed person) — there is deliberately
// no separate lock table, the presence map is the single source of truth
// for all three.
package presence

import (
	"sync"
	"time"
)

// StaleAfter is how long a person can go unseen before their identity is
// considered free to be claimed by a different joiner.
const StaleAfter = 5 * time.Minute

// FlushAfter is how long an entry survives in the map before being swept
// away entirely (must be >= StaleAfter; kept distinct so "available to
// reclaim" and "fully forgotten" aren't required to be the same instant).
const FlushAfter = 10 * time.Minute

// OnlineThreshold is how recently a person must have been seen to be shown
// as currently online (the frontend heartbeats every 1.5s — see
// HEARTBEAT_INTERVAL_MS in src/hooks/usePresenceHeartbeat.ts — this must
// stay comfortably above that interval so a normal beat cadence doesn't
// flicker offline).
const OnlineThreshold = 4 * time.Second

// GapThreshold is how long a person can go unseen before a subsequent Touch
// is treated as the start of a new activity streak rather than a
// continuation of the previous one — well above the 1.5s heartbeat cadence
// (so normal jitter/a missed beat or two doesn't reset it), well below the
// 1-hour "continuously active" bar the name-edit lock checks against.
const GapThreshold = 60 * time.Second

type entry struct {
	lastSeen    time.Time
	activeSince time.Time
}

type Tracker struct {
	mu   sync.RWMutex
	seen map[string]map[string]entry // sessionID -> personID -> entry
}

func NewTracker() *Tracker {
	return &Tracker{seen: make(map[string]map[string]entry)}
}

// Touch records that personID in sessionID was just seen (O(1)). If this is
// a new entry, or the previous lastSeen was more than GapThreshold ago,
// activeSince resets to now — otherwise it's left untouched, so a person
// heartbeating continuously accrues a stable, growing "active since"
// duration rather than resetting on every beat.
func (t *Tracker) Touch(sessionID, personID string) {
	t.mu.Lock()
	defer t.mu.Unlock()
	people := t.seen[sessionID]
	if people == nil {
		people = make(map[string]entry)
		t.seen[sessionID] = people
	}
	now := time.Now()
	prev, ok := people[personID]
	activeSince := now
	if ok && now.Sub(prev.lastSeen) <= GapThreshold {
		activeSince = prev.activeSince
	}
	people[personID] = entry{lastSeen: now, activeSince: activeSince}
}

// IsAvailable reports whether personID's identity is free to be claimed: no
// record exists, or the last time they were seen is older than StaleAfter (O(1)).
func (t *Tracker) IsAvailable(sessionID, personID string) bool {
	t.mu.RLock()
	defer t.mu.RUnlock()
	e, ok := t.seen[sessionID][personID]
	if !ok {
		return true
	}
	return time.Since(e.lastSeen) > StaleAfter
}

// IsOnline reports whether personID has been seen within OnlineThreshold.
func (t *Tracker) IsOnline(sessionID, personID string) bool {
	t.mu.RLock()
	defer t.mu.RUnlock()
	e, ok := t.seen[sessionID][personID]
	if !ok {
		return false
	}
	return time.Since(e.lastSeen) <= OnlineThreshold
}

// ActiveSince returns when personID's current continuous activity streak
// began, and whether they have any record at all. Only meaningful while
// they're online (IsOnline) — an offline person's activeSince refers to
// their last streak before they stopped being seen.
func (t *Tracker) ActiveSince(sessionID, personID string) (time.Time, bool) {
	t.mu.RLock()
	defer t.mu.RUnlock()
	e, ok := t.seen[sessionID][personID]
	if !ok {
		return time.Time{}, false
	}
	return e.activeSince, true
}

// ListOnline returns the personIDs in sessionID currently within
// OnlineThreshold (O(k) for k people tracked in that session).
func (t *Tracker) ListOnline(sessionID string) []string {
	t.mu.RLock()
	defer t.mu.RUnlock()
	var online []string
	now := time.Now()
	for personID, e := range t.seen[sessionID] {
		if now.Sub(e.lastSeen) <= OnlineThreshold {
			online = append(online, personID)
		}
	}
	return online
}

// Sweep removes every entry older than FlushAfter, across all sessions.
// Intended to be called periodically (e.g. every 10 minutes) by a background
// goroutine started in cmd/server/main.go, mirroring the existing cleanup job.
func (t *Tracker) Sweep() {
	t.mu.Lock()
	defer t.mu.Unlock()
	now := time.Now()
	for sessionID, people := range t.seen {
		for personID, e := range people {
			if now.Sub(e.lastSeen) > FlushAfter {
				delete(people, personID)
			}
		}
		if len(people) == 0 {
			delete(t.seen, sessionID)
		}
	}
}
