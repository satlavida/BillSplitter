package presence

import (
	"testing"
	"time"
)

func TestTouchAndIsOnline(t *testing.T) {
	tr := NewTracker()
	if tr.IsOnline("s1", "p1") {
		t.Fatal("expected not online before any Touch")
	}
	tr.Touch("s1", "p1")
	if !tr.IsOnline("s1", "p1") {
		t.Fatal("expected online immediately after Touch")
	}
}

func TestIsAvailableWhenNeverSeen(t *testing.T) {
	tr := NewTracker()
	if !tr.IsAvailable("s1", "p1") {
		t.Fatal("expected available when never seen")
	}
}

func TestIsAvailableFalseWhileActive(t *testing.T) {
	tr := NewTracker()
	tr.Touch("s1", "p1")
	if tr.IsAvailable("s1", "p1") {
		t.Fatal("expected unavailable while recently seen")
	}
}

func TestIsAvailableTrueOnceStale(t *testing.T) {
	tr := NewTracker()
	tr.mu.Lock()
	tr.seen["s1"] = map[string]entry{"p1": {lastSeen: time.Now().Add(-StaleAfter - time.Second)}}
	tr.mu.Unlock()
	if !tr.IsAvailable("s1", "p1") {
		t.Fatal("expected available once past StaleAfter")
	}
}

func TestListOnlineScopedToSession(t *testing.T) {
	tr := NewTracker()
	tr.Touch("s1", "p1")
	tr.Touch("s1", "p2")
	tr.Touch("s2", "p3")

	online := tr.ListOnline("s1")
	if len(online) != 2 {
		t.Fatalf("expected 2 online in s1, got %d", len(online))
	}
	if len(tr.ListOnline("s2")) != 1 {
		t.Fatal("expected 1 online in s2")
	}
}

func TestSweepRemovesOnlyStaleEntries(t *testing.T) {
	tr := NewTracker()
	tr.Touch("s1", "fresh")
	tr.mu.Lock()
	tr.seen["s1"]["stale"] = entry{lastSeen: time.Now().Add(-FlushAfter - time.Second)}
	tr.mu.Unlock()

	tr.Sweep()

	tr.mu.RLock()
	defer tr.mu.RUnlock()
	if _, ok := tr.seen["s1"]["stale"]; ok {
		t.Fatal("expected stale entry to be swept")
	}
	if _, ok := tr.seen["s1"]["fresh"]; !ok {
		t.Fatal("expected fresh entry to survive sweep")
	}
}

func TestSweepRemovesEmptySessionMap(t *testing.T) {
	tr := NewTracker()
	tr.mu.Lock()
	tr.seen["s1"] = map[string]entry{"stale": {lastSeen: time.Now().Add(-FlushAfter - time.Second)}}
	tr.mu.Unlock()

	tr.Sweep()

	tr.mu.RLock()
	defer tr.mu.RUnlock()
	if _, ok := tr.seen["s1"]; ok {
		t.Fatal("expected empty session map to be removed")
	}
}

func TestActiveSinceNoRecord(t *testing.T) {
	tr := NewTracker()
	if _, ok := tr.ActiveSince("s1", "p1"); ok {
		t.Fatal("expected no activeSince record before any Touch")
	}
}

func TestActiveSinceStaysStableAcrossRapidTouches(t *testing.T) {
	tr := NewTracker()
	tr.Touch("s1", "p1")
	first, ok := tr.ActiveSince("s1", "p1")
	if !ok {
		t.Fatal("expected an activeSince record after Touch")
	}

	// A second touch well within GapThreshold shouldn't reset activeSince.
	tr.Touch("s1", "p1")
	second, _ := tr.ActiveSince("s1", "p1")
	if !second.Equal(first) {
		t.Fatalf("expected activeSince to stay stable across a rapid re-touch, got %v then %v", first, second)
	}
}

func TestActiveSinceResetsAfterGap(t *testing.T) {
	tr := NewTracker()
	tr.mu.Lock()
	staleTime := time.Now().Add(-GapThreshold - time.Second)
	tr.seen["s1"] = map[string]entry{"p1": {lastSeen: staleTime, activeSince: staleTime}}
	tr.mu.Unlock()

	tr.Touch("s1", "p1")

	since, ok := tr.ActiveSince("s1", "p1")
	if !ok {
		t.Fatal("expected an activeSince record after Touch")
	}
	if since.Before(staleTime.Add(GapThreshold)) {
		t.Fatalf("expected activeSince to reset to roughly now after a gap, got %v (previous streak started %v)", since, staleTime)
	}
}
