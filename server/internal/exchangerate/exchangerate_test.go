package exchangerate

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
)

func TestFetchRate_SameCurrencyShortCircuits(t *testing.T) {
	var calls int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		atomic.AddInt32(&calls, 1)
		w.Write([]byte(`{}`))
	}))
	defer srv.Close()

	c := New(srv.URL)
	rate, err := c.FetchRate(context.Background(), "2024-01-15", "USD", "USD")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if rate != 1.0 {
		t.Errorf("rate = %v, want 1.0", rate)
	}
	if got := atomic.LoadInt32(&calls); got != 0 {
		t.Errorf("expected no HTTP call for same-currency, got %d calls", got)
	}
}

func TestFetchRate_Success(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !strings.HasPrefix(r.URL.Path, "/2024-01-15") {
			t.Errorf("unexpected path: %s", r.URL.Path)
		}
		if r.URL.Query().Get("base") != "USD" {
			t.Errorf("base = %q, want USD", r.URL.Query().Get("base"))
		}
		if r.URL.Query().Get("symbols") != "EUR" {
			t.Errorf("symbols = %q, want EUR", r.URL.Query().Get("symbols"))
		}
		w.Write([]byte(`{"amount":1.0,"base":"USD","date":"2024-01-15","rates":{"EUR":0.91366}}`))
	}))
	defer srv.Close()

	c := New(srv.URL)
	rate, err := c.FetchRate(context.Background(), "2024-01-15", "USD", "EUR")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if rate != 0.91366 {
		t.Errorf("rate = %v, want 0.91366", rate)
	}
}

func TestFetchRate_NonSuccessStatus(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNotFound)
		w.Write([]byte(`{"error":"not found"}`))
	}))
	defer srv.Close()

	c := New(srv.URL)
	_, err := c.FetchRate(context.Background(), "2024-01-15", "USD", "EUR")
	if err == nil {
		t.Fatal("expected error for non-2xx status")
	}
}

func TestFetchRate_MalformedJSON(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`not json`))
	}))
	defer srv.Close()

	c := New(srv.URL)
	_, err := c.FetchRate(context.Background(), "2024-01-15", "USD", "EUR")
	if err == nil {
		t.Fatal("expected error for malformed JSON")
	}
}

func TestFetchRate_MissingRateKey(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"amount":1.0,"base":"USD","date":"2024-01-15","rates":{}}`))
	}))
	defer srv.Close()

	c := New(srv.URL)
	_, err := c.FetchRate(context.Background(), "2024-01-15", "USD", "EUR")
	if err == nil {
		t.Fatal("expected error for missing rate key")
	}
}

func TestNew_DefaultBaseURL(t *testing.T) {
	c := New("")
	if c.baseURL != defaultBaseURL {
		t.Errorf("baseURL = %q, want %q", c.baseURL, defaultBaseURL)
	}
}
