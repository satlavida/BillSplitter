package api

import (
	"database/sql"
	"net/http"
	"strings"
	"testing"

	"billsplitter/server/internal/store"
)

func seedExchangeRate(t *testing.T, db *sql.DB, date, base, quote string, rate float64) {
	t.Helper()
	if err := store.New(db).UpsertExchangeRate(date, base, quote, rate); err != nil {
		t.Fatalf("seed exchange rate: %v", err)
	}
}

func TestAdminExchangeRatesPage_RequiresAdminToken(t *testing.T) {
	srv, _ := newTestServer(t)

	resp := getJSON(t, srv, "/admin/exchange-rates")
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403 with no admin token, got %d", resp.StatusCode)
	}
}

func TestAdminExchangeRatesPage_ListsAndPaginates(t *testing.T) {
	srv, db := newTestServer(t)
	seedExchangeRate(t, db, "2024-01-01", "USD", "EUR", 0.9)
	seedExchangeRate(t, db, "2024-01-02", "GBP", "INR", 100)

	resp := getJSONWithHeaders(t, srv, "/admin/exchange-rates", map[string]string{"X-Admin-Token": "test-admin-token"})
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
	defer resp.Body.Close()
	buf := make([]byte, 8192)
	n, _ := resp.Body.Read(buf)
	body := string(buf[:n])
	if !strings.Contains(body, "USD") || !strings.Contains(body, "GBP") {
		t.Fatalf("expected both cached pairs in page body, got:\n%s", body)
	}
}

func TestAdminFlushExchangeRates_DeletesAllAndRedirects(t *testing.T) {
	srv, db := newTestServer(t)
	seedExchangeRate(t, db, "2024-01-01", "USD", "EUR", 0.9)
	seedExchangeRate(t, db, "2024-01-02", "GBP", "INR", 100)

	client := &http.Client{CheckRedirect: func(req *http.Request, via []*http.Request) error { return http.ErrUseLastResponse }}
	req, _ := http.NewRequest(http.MethodPost, srv.URL+"/admin/exchange-rates/flush", nil)
	req.Header.Set("X-Admin-Token", "test-admin-token")
	resp, err := client.Do(req)
	if err != nil {
		t.Fatalf("flush request: %v", err)
	}
	if resp.StatusCode != http.StatusSeeOther {
		t.Fatalf("expected 303 redirect, got %d", resp.StatusCode)
	}
	loc := resp.Header.Get("Location")
	if !strings.Contains(loc, "flushed=2") {
		t.Fatalf("expected redirect location to report flushed=2, got %q", loc)
	}
}
