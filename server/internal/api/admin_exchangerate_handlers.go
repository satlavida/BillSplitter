// Admin viewer for the global exchange-rate cache (internal/store's
// exchange_rates table — see internal/exchangerate and
// GetExchangeRate/exchangerate_handlers.go). Unlike the other admin tables
// (client-side filter-only over a fully rendered result set — see
// adminLayoutHTML's .admin-search JS), this page does genuine server-side
// pagination/search/filter since the cache can grow unbounded.
package api

import (
	"net/http"
	"strconv"
)

const adminExchangeRatesPageSize = 50

// AdminExchangeRatesPage handles GET /admin/exchange-rates?page=&q=&date=&currency=.
func (a *API) AdminExchangeRatesPage(w http.ResponseWriter, r *http.Request) {
	if !a.requireAdminToken(w, r) {
		return
	}

	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	search := r.URL.Query().Get("q")
	date := r.URL.Query().Get("date")
	currency := r.URL.Query().Get("currency")

	rates, total, err := a.store.ListExchangeRatesPaged(page, adminExchangeRatesPageSize, date, currency, search)
	if err != nil {
		http.Error(w, "failed to load exchange rates", http.StatusInternalServerError)
		return
	}

	pageCount := (total + adminExchangeRatesPageSize - 1) / adminExchangeRatesPageSize
	if pageCount < 1 {
		pageCount = 1
	}

	_ = adminExchangeRatesTemplate.ExecuteTemplate(w, "layout", map[string]any{
		"Rates":     rates,
		"Total":     total,
		"Page":      page,
		"PageCount": pageCount,
		"PrevPage":  page - 1,
		"NextPage":  page + 1,
		"HasPrev":   page > 1,
		"HasNext":   page < pageCount,
		"Query":     search,
		"Date":      date,
		"Currency":  currency,
		"Flushed":   r.URL.Query().Get("flushed"),
	})
}

// AdminFlushExchangeRates handles POST /admin/exchange-rates/flush —
// deletes every row from the global exchange-rate cache (never touches
// bill-level rate overrides, which live on the bills table). The confirming
// click happens client-side (see adminExchangeRatesContentHTML's
// onsubmit=confirm(...)), same as AdminPurgeSession's purge button.
func (a *API) AdminFlushExchangeRates(w http.ResponseWriter, r *http.Request) {
	if !a.requireAdminToken(w, r) {
		return
	}

	n, err := a.store.FlushExchangeRates()
	if err != nil {
		http.Error(w, "failed to flush exchange rates", http.StatusInternalServerError)
		return
	}

	http.Redirect(w, r, "/admin/exchange-rates?flushed="+strconv.FormatInt(n, 10), http.StatusSeeOther)
}
