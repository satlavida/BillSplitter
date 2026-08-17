// Package presence tracks which (session, person) pairs have an actively
// polling joiner, via an in-memory last-seen map. It serves two purposes:
// showing an online/offline indicator for claimed people, and gating whether
// a person identity is free for a new joiner to claim (see IsAvailable) —
// there is deliberately no separate lock table, the presence map is the
// single source of truth for both.
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

type Tracker struct {
	mu   sync.RWMutex
	seen map[string]map[string]time.Time // sessionID -> personID -> lastSeen
}

func NewTracker() *Tracker {
	return &Tracker{seen: make(map[string]map[string]time.Time)}
}

// Touch records that personID in sessionID was just seen (O(1)).
func (t *Tracker) Touch(sessionID, personID string) {
	t.mu.Lock()
	defer t.mu.Unlock()
	people := t.seen[sessionID]
	if people == nil {
		people = make(map[string]time.Time)
		t.seen[sessionID] = people
	}
	people[personID] = time.Now()
}

// IsAvailable reports whether personID's identity is free to be claimed: no
// record exists, or the last time they were seen is older than StaleAfter (O(1)).
func (t *Tracker) IsAvailable(sessionID, personID string) bool {
	t.mu.RLock()
	defer t.mu.RUnlock()
	last, ok := t.seen[sessionID][personID]
	if !ok {
		return true
	}
	return time.Since(last) > StaleAfter
}

// IsOnline reports whether personID has been seen within OnlineThreshold.
func (t *Tracker) IsOnline(sessionID, personID string) bool {
	t.mu.RLock()
	defer t.mu.RUnlock()
	last, ok := t.seen[sessionID][personID]
	if !ok {
		return false
	}
	return time.Since(last) <= OnlineThreshold
}

// ListOnline returns the personIDs in sessionID currently within
// OnlineThreshold (O(k) for k people tracked in that session).
func (t *Tracker) ListOnline(sessionID string) []string {
	t.mu.RLock()
	defer t.mu.RUnlock()
	var online []string
	now := time.Now()
	for personID, last := range t.seen[sessionID] {
		if now.Sub(last) <= OnlineThreshold {
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
		for personID, last := range people {
			if now.Sub(last) > FlushAfter {
				delete(people, personID)
			}
		}
		if len(people) == 0 {
			delete(t.seen, sessionID)
		}
	}
}
