package sse

import "testing"

func TestHub_BroadcastDeliversToSubscribersOfSameCode(t *testing.T) {
	h := NewHub()
	ch, unsubscribe := h.Subscribe("ABCDE")
	defer unsubscribe()

	h.Broadcast("ABCDE", Event{Kind: "bill.updated", ID: "b1"})

	select {
	case ev := <-ch:
		if ev.Kind != "bill.updated" || ev.ID != "b1" {
			t.Fatalf("unexpected event: %+v", ev)
		}
	default:
		t.Fatal("expected an event to be delivered")
	}
}

func TestHub_BroadcastDoesNotCrossSessionCodes(t *testing.T) {
	h := NewHub()
	ch, unsubscribe := h.Subscribe("AAAAA")
	defer unsubscribe()

	h.Broadcast("BBBBB", Event{Kind: "bill.updated", ID: "b1"})

	select {
	case ev := <-ch:
		t.Fatalf("did not expect an event for a different session code, got %+v", ev)
	default:
		// expected: no event delivered
	}
}

func TestHub_UnsubscribeStopsDelivery(t *testing.T) {
	h := NewHub()
	ch, unsubscribe := h.Subscribe("ABCDE")
	unsubscribe()

	h.Broadcast("ABCDE", Event{Kind: "bill.updated", ID: "b1"})

	if _, ok := <-ch; ok {
		t.Fatal("expected channel to be closed after unsubscribe")
	}
}

func TestHub_SlowSubscriberDoesNotBlockBroadcast(t *testing.T) {
	h := NewHub()
	ch, unsubscribe := h.Subscribe("ABCDE")
	defer unsubscribe()

	// Fill the subscriber's buffer (capacity 8) without draining it.
	for i := 0; i < 20; i++ {
		h.Broadcast("ABCDE", Event{Kind: "bill.updated", ID: "b1"})
	}

	if len(ch) == 0 {
		t.Fatal("expected some events to have been buffered")
	}
}
