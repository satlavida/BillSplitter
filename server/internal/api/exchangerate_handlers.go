// Exchange-rate lookup for the frontend's Bill Settings flow (see
// architecture/currency.md, added alongside this feature). This is a
// stateless global utility endpoint — it doesn't touch anything
// session-specific, only the global read-mostly exchange_rates cache — so
// it carries no admin/creator-token auth, unlike session-scoped routes.
package api

import (
	"net/http"
	"strings"
	"time"
)

type exchangeRateResponse struct {
	Date   string  `json:"date"`
	Base   string  `json:"base"`
	Quote  string  `json:"quote"`
	Rate   float64 `json:"rate"`
	Cached bool    `json:"cached"`
}

// GetExchangeRate handles GET /api/exchange-rate?base=&quote=&date=. Same-
// currency requests short-circuit to rate 1.0 without touching the DB or
// the external provider. Otherwise it's cache-lookup-then-fetch-and-cache:
// a cache hit never calls the external API; a miss fetches, caches, and
// responds.
func (a *API) GetExchangeRate(w http.ResponseWriter, r *http.Request) {
	base := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("base")))
	quote := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("quote")))
	date := strings.TrimSpace(r.URL.Query().Get("date"))

	if !isCurrencyCode(base) || !isCurrencyCode(quote) {
		writeError(w, http.StatusBadRequest, "base and quote must be 3-letter currency codes")
		return
	}
	if _, err := time.Parse("2006-01-02", date); err != nil {
		writeError(w, http.StatusBadRequest, "date must be in YYYY-MM-DD format")
		return
	}

	if base == quote {
		writeJSON(w, http.StatusOK, exchangeRateResponse{Date: date, Base: base, Quote: quote, Rate: 1.0, Cached: true})
		return
	}

	if rate, found, err := a.store.GetExchangeRate(date, base, quote); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to look up exchange rate")
		return
	} else if found {
		writeJSON(w, http.StatusOK, exchangeRateResponse{Date: date, Base: base, Quote: quote, Rate: rate, Cached: true})
		return
	}

	rate, err := a.exchangeRate.FetchRate(r.Context(), date, base, quote)
	if err != nil {
		a.reporter.Warn("exchange_rate_fetch", "failed to fetch %s->%s on %s: %v", base, quote, date, err)
		writeError(w, http.StatusBadGateway, "failed to fetch exchange rate")
		return
	}

	if err := a.store.UpsertExchangeRate(date, base, quote, rate); err != nil {
		a.reporter.Warn("exchange_rate_cache", "failed to cache %s->%s on %s: %v", base, quote, date, err)
		// Still return the fetched rate to the caller — a cache-write
		// failure shouldn't fail the request that triggered it.
	}

	writeJSON(w, http.StatusOK, exchangeRateResponse{Date: date, Base: base, Quote: quote, Rate: rate, Cached: false})
}

func isCurrencyCode(s string) bool {
	if len(s) != 3 {
		return false
	}
	for _, c := range s {
		if c < 'A' || c > 'Z' {
			return false
		}
	}
	return true
}
