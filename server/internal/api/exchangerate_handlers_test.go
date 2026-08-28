package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	appdb "billsplitter/server/internal/db"
	"billsplitter/server/internal/logging"
	"billsplitter/server/internal/sse"
	"billsplitter/server/internal/store"
)

// newExchangeRateTestServer is like newTestServer but points the exchange
// rate client at a caller-supplied mock provider base URL, so tests never
// hit the real Frankfurter API.
func newExchangeRateTestServer(t *testing.T, providerBaseURL string) (*httptest.Server, *store.Store) {
	t.Helper()
	database, err := appdb.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatalf("open db: %v", err)
	}
	t.Cleanup(func() { database.Close() })

	st := store.New(database)
	hub := sse.NewHub()
	reporter := logging.NewReporter(st)
	a := New(st, hub, reporter, Config{
		ImageDir:               t.TempDir(),
		AdminToken:             "test-admin-token",
		ExchangeRateAPIBaseURL: providerBaseURL,
	})

	srv := httptest.NewServer(a.Router())
	t.Cleanup(srv.Close)
	return srv, st
}

func TestGetExchangeRate_SameCurrencyShortCircuits(t *testing.T) {
	mock := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatalf("unexpected call to provider for same-currency request: %s", r.URL.String())
	}))
	defer mock.Close()

	srv, _ := newExchangeRateTestServer(t, mock.URL)
	resp := getJSON(t, srv, "/api/exchange-rate?base=USD&quote=USD&date=2024-01-15")
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}
	var body exchangeRateResponse
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body.Rate != 1.0 || !body.Cached {
		t.Fatalf("unexpected body: %+v", body)
	}
}

func TestGetExchangeRate_CacheHitSkipsProvider(t *testing.T) {
	mock := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatalf("unexpected call to provider on a cache hit: %s", r.URL.String())
	}))
	defer mock.Close()

	srv, st := newExchangeRateTestServer(t, mock.URL)
	if err := st.UpsertExchangeRate("2024-01-15", "USD", "EUR", 0.9); err != nil {
		t.Fatalf("seed cache: %v", err)
	}

	resp := getJSON(t, srv, "/api/exchange-rate?base=USD&quote=EUR&date=2024-01-15")
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}
	var body exchangeRateResponse
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body.Rate != 0.9 || !body.Cached {
		t.Fatalf("unexpected body: %+v", body)
	}
}

func TestGetExchangeRate_CacheMissFetchesAndCaches(t *testing.T) {
	var calls int
	mock := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		w.Write([]byte(`{"amount":1.0,"base":"USD","date":"2024-01-15","rates":{"EUR":0.91366}}`))
	}))
	defer mock.Close()

	srv, st := newExchangeRateTestServer(t, mock.URL)

	resp := getJSON(t, srv, "/api/exchange-rate?base=USD&quote=EUR&date=2024-01-15")
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}
	var body exchangeRateResponse
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if body.Rate != 0.91366 || body.Cached {
		t.Fatalf("unexpected body: %+v", body)
	}
	if calls != 1 {
		t.Fatalf("expected 1 provider call, got %d", calls)
	}

	rate, found, err := st.GetExchangeRate("2024-01-15", "USD", "EUR")
	if err != nil || !found || rate != 0.91366 {
		t.Fatalf("expected cached rate after fetch, got found=%v rate=%v err=%v", found, rate, err)
	}
}

func TestGetExchangeRate_InvalidParams(t *testing.T) {
	mock := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {}))
	defer mock.Close()
	srv, _ := newExchangeRateTestServer(t, mock.URL)

	cases := []string{
		"/api/exchange-rate?base=US&quote=EUR&date=2024-01-15",
		"/api/exchange-rate?base=USD&quote=EU&date=2024-01-15",
		"/api/exchange-rate?base=USD&quote=EUR&date=not-a-date",
		"/api/exchange-rate?base=USD&quote=EUR",
	}
	for _, path := range cases {
		resp := getJSON(t, srv, path)
		resp.Body.Close()
		if resp.StatusCode != http.StatusBadRequest {
			t.Errorf("path %s: status = %d, want 400", path, resp.StatusCode)
		}
	}
}

func TestGetExchangeRate_ProviderFailureReturnsBadGateway(t *testing.T) {
	mock := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer mock.Close()

	srv, _ := newExchangeRateTestServer(t, mock.URL)
	resp := getJSON(t, srv, "/api/exchange-rate?base=USD&quote=EUR&date=2024-01-15")
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusBadGateway {
		t.Fatalf("status = %d, want 502", resp.StatusCode)
	}
}
