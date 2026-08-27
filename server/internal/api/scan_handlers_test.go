package api

import (
	"encoding/json"
	"testing"
)

func TestStringifyParsedResponse_PassesThroughRestaurantNameAndDate(t *testing.T) {
	raw := `{"restaurant_name":"Pizza Hut","date":"2025-03-20","items":[{"name":"Pizza","price":10,"quantity":1}],"tax":1}`

	out := stringifyParsedResponse(raw)

	var parsed map[string]any
	if err := json.Unmarshal([]byte(out), &parsed); err != nil {
		t.Fatalf("expected valid JSON, got error: %v", err)
	}
	if parsed["restaurant_name"] != "Pizza Hut" {
		t.Errorf("expected restaurant_name to round-trip, got %v", parsed["restaurant_name"])
	}
	if parsed["date"] != "2025-03-20" {
		t.Errorf("expected date to round-trip, got %v", parsed["date"])
	}
}

func TestStringifyParsedResponse_OmitsRestaurantNameAndDateWhenAbsent(t *testing.T) {
	raw := `{"items":[{"name":"Pizza","price":10,"quantity":1}],"tax":1}`

	out := stringifyParsedResponse(raw)

	var parsed map[string]any
	if err := json.Unmarshal([]byte(out), &parsed); err != nil {
		t.Fatalf("expected valid JSON, got error: %v", err)
	}
	if _, ok := parsed["restaurant_name"]; ok {
		t.Errorf("expected restaurant_name to be absent, got %v", parsed["restaurant_name"])
	}
	if _, ok := parsed["date"]; ok {
		t.Errorf("expected date to be absent, got %v", parsed["date"])
	}
}

func TestStringifyParsedResponse_UnparseableJSONFallsBackToRawResponseQuirk(t *testing.T) {
	raw := "not json at all"

	out := stringifyParsedResponse(raw)

	var parsed map[string]any
	if err := json.Unmarshal([]byte(out), &parsed); err != nil {
		t.Fatalf("expected valid JSON fallback envelope, got error: %v", err)
	}
	if parsed["raw_response"] != raw {
		t.Errorf("expected raw_response to preserve the original text, got %v", parsed["raw_response"])
	}
	if parsed["error"] == "" || parsed["error"] == nil {
		t.Errorf("expected a non-empty error message, got %v", parsed["error"])
	}
}

func TestStringifyParsedResponse_StripsFencedJSONBlock(t *testing.T) {
	raw := "```json\n{\"restaurant_name\":\"Cafe\",\"items\":[]}\n```"

	out := stringifyParsedResponse(raw)

	var parsed map[string]any
	if err := json.Unmarshal([]byte(out), &parsed); err != nil {
		t.Fatalf("expected valid JSON after stripping fence, got error: %v", err)
	}
	if parsed["restaurant_name"] != "Cafe" {
		t.Errorf("expected restaurant_name to round-trip through a fenced block, got %v", parsed["restaurant_name"])
	}
}
