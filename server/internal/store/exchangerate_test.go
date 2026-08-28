package store

import "testing"

func TestGetExchangeRate_MissThenHit(t *testing.T) {
	s := openSettingsTestDB(t)

	if _, found, err := s.GetExchangeRate("2024-01-15", "USD", "EUR"); err != nil {
		t.Fatalf("GetExchangeRate: %v", err)
	} else if found {
		t.Fatalf("expected cache miss before any upsert")
	}

	if err := s.UpsertExchangeRate("2024-01-15", "USD", "EUR", 0.91366); err != nil {
		t.Fatalf("UpsertExchangeRate: %v", err)
	}

	rate, found, err := s.GetExchangeRate("2024-01-15", "USD", "EUR")
	if err != nil {
		t.Fatalf("GetExchangeRate: %v", err)
	}
	if !found {
		t.Fatalf("expected cache hit after upsert")
	}
	if rate != 0.91366 {
		t.Fatalf("rate = %v, want 0.91366", rate)
	}
}

func TestUpsertExchangeRate_OverwritesOnConflict(t *testing.T) {
	s := openSettingsTestDB(t)

	if err := s.UpsertExchangeRate("2024-01-15", "USD", "EUR", 0.9); err != nil {
		t.Fatalf("UpsertExchangeRate: %v", err)
	}
	if err := s.UpsertExchangeRate("2024-01-15", "USD", "EUR", 0.95); err != nil {
		t.Fatalf("UpsertExchangeRate overwrite: %v", err)
	}

	rate, found, err := s.GetExchangeRate("2024-01-15", "USD", "EUR")
	if err != nil {
		t.Fatalf("GetExchangeRate: %v", err)
	}
	if !found || rate != 0.95 {
		t.Fatalf("expected overwritten rate=0.95, got found=%v rate=%v", found, rate)
	}
}

func TestGetExchangeRate_DifferentPairsIndependent(t *testing.T) {
	s := openSettingsTestDB(t)

	if err := s.UpsertExchangeRate("2024-01-15", "USD", "EUR", 0.9); err != nil {
		t.Fatalf("UpsertExchangeRate: %v", err)
	}

	if _, found, err := s.GetExchangeRate("2024-01-15", "USD", "GBP"); err != nil {
		t.Fatalf("GetExchangeRate: %v", err)
	} else if found {
		t.Fatalf("expected miss for a different quote currency")
	}
	if _, found, err := s.GetExchangeRate("2024-01-16", "USD", "EUR"); err != nil {
		t.Fatalf("GetExchangeRate: %v", err)
	} else if found {
		t.Fatalf("expected miss for a different date")
	}
}

func TestListExchangeRatesPaged_EmptyTable(t *testing.T) {
	s := openSettingsTestDB(t)

	rates, total, err := s.ListExchangeRatesPaged(1, 10, "", "", "")
	if err != nil {
		t.Fatalf("ListExchangeRatesPaged: %v", err)
	}
	if total != 0 || len(rates) != 0 {
		t.Fatalf("expected empty result, got total=%d len=%d", total, len(rates))
	}
}

func TestListExchangeRatesPaged_PageBoundaryAndTotal(t *testing.T) {
	s := openSettingsTestDB(t)

	for i, date := range []string{"2024-01-01", "2024-01-02", "2024-01-03"} {
		if err := s.UpsertExchangeRate(date, "USD", "EUR", 0.9+float64(i)*0.01); err != nil {
			t.Fatalf("seed: %v", err)
		}
	}

	page1, total, err := s.ListExchangeRatesPaged(1, 2, "", "", "")
	if err != nil {
		t.Fatalf("ListExchangeRatesPaged page1: %v", err)
	}
	if total != 3 || len(page1) != 2 {
		t.Fatalf("page1: total=%d len=%d, want total=3 len=2", total, len(page1))
	}

	page2, total, err := s.ListExchangeRatesPaged(2, 2, "", "", "")
	if err != nil {
		t.Fatalf("ListExchangeRatesPaged page2: %v", err)
	}
	if total != 3 || len(page2) != 1 {
		t.Fatalf("page2: total=%d len=%d, want total=3 len=1", total, len(page2))
	}
}

func TestListExchangeRatesPaged_Filters(t *testing.T) {
	s := openSettingsTestDB(t)

	if err := s.UpsertExchangeRate("2024-01-01", "USD", "EUR", 0.9); err != nil {
		t.Fatalf("seed: %v", err)
	}
	if err := s.UpsertExchangeRate("2024-01-02", "GBP", "INR", 100); err != nil {
		t.Fatalf("seed: %v", err)
	}

	byDate, total, err := s.ListExchangeRatesPaged(1, 10, "2024-01-01", "", "")
	if err != nil {
		t.Fatalf("date filter: %v", err)
	}
	if total != 1 || byDate[0].Date != "2024-01-01" {
		t.Fatalf("date filter: total=%d rows=%+v", total, byDate)
	}

	byCurrency, total, err := s.ListExchangeRatesPaged(1, 10, "", "INR", "")
	if err != nil {
		t.Fatalf("currency filter: %v", err)
	}
	if total != 1 || byCurrency[0].QuoteCurrency != "INR" {
		t.Fatalf("currency filter: total=%d rows=%+v", total, byCurrency)
	}

	bySearch, total, err := s.ListExchangeRatesPaged(1, 10, "", "", "gbp")
	if err != nil {
		t.Fatalf("search filter: %v", err)
	}
	if total != 1 || bySearch[0].BaseCurrency != "GBP" {
		t.Fatalf("search filter: total=%d rows=%+v", total, bySearch)
	}
}

func TestFlushExchangeRates(t *testing.T) {
	s := openSettingsTestDB(t)

	if err := s.UpsertExchangeRate("2024-01-01", "USD", "EUR", 0.9); err != nil {
		t.Fatalf("seed: %v", err)
	}
	if err := s.UpsertExchangeRate("2024-01-02", "GBP", "INR", 100); err != nil {
		t.Fatalf("seed: %v", err)
	}

	n, err := s.FlushExchangeRates()
	if err != nil {
		t.Fatalf("FlushExchangeRates: %v", err)
	}
	if n != 2 {
		t.Fatalf("rows deleted = %d, want 2", n)
	}

	_, total, err := s.ListExchangeRatesPaged(1, 10, "", "", "")
	if err != nil {
		t.Fatalf("ListExchangeRatesPaged after flush: %v", err)
	}
	if total != 0 {
		t.Fatalf("expected empty cache after flush, total=%d", total)
	}
}
