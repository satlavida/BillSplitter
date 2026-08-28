package store

import (
	"testing"

	"billsplitter/server/internal/models"
)

func TestCreateSession_PersistsCurrency(t *testing.T) {
	s := openSettingsTestDB(t)

	sess, err := s.CreateSession("Trip", nil, models.JoinModeApprovalCode, models.ClaimModeFreeSelect, models.PermissionModeEdit, nil, "EUR")
	if err != nil {
		t.Fatalf("CreateSession: %v", err)
	}
	if sess.Currency != "EUR" {
		t.Fatalf("Currency = %q, want EUR", sess.Currency)
	}

	reloaded, err := s.GetSession(sess.ID)
	if err != nil {
		t.Fatalf("GetSession: %v", err)
	}
	if reloaded.Currency != "EUR" {
		t.Fatalf("reloaded Currency = %q, want EUR", reloaded.Currency)
	}
}

func TestUpdateSessionCurrency(t *testing.T) {
	s := openSettingsTestDB(t)

	sess, err := s.CreateSession("Trip", nil, models.JoinModeApprovalCode, models.ClaimModeFreeSelect, models.PermissionModeEdit, nil, "USD")
	if err != nil {
		t.Fatalf("CreateSession: %v", err)
	}

	if err := s.UpdateSessionCurrency(sess.ID, "INR"); err != nil {
		t.Fatalf("UpdateSessionCurrency: %v", err)
	}

	reloaded, err := s.GetSession(sess.ID)
	if err != nil {
		t.Fatalf("GetSession: %v", err)
	}
	if reloaded.Currency != "INR" {
		t.Fatalf("Currency = %q, want INR", reloaded.Currency)
	}
}

func TestUpdateSessionCurrency_NotFound(t *testing.T) {
	s := openSettingsTestDB(t)

	if err := s.UpdateSessionCurrency("nonexistent", "INR"); err != ErrNotFound {
		t.Fatalf("expected ErrNotFound, got %v", err)
	}
}

func TestUpdateBill_PersistsExchangeRateFields(t *testing.T) {
	s := openSettingsTestDB(t)

	sess, err := s.CreateSession("Trip", nil, models.JoinModeApprovalCode, models.ClaimModeFreeSelect, models.PermissionModeEdit, nil, "INR")
	if err != nil {
		t.Fatalf("CreateSession: %v", err)
	}

	bill := models.Bill{ID: "bill1", Title: "Dinner", Date: "2026-01-01T00:00:00.000Z", Currency: "INR", TaxAmount: 0}
	if err := s.AddBill(sess.ID, bill); err != nil {
		t.Fatalf("AddBill: %v", err)
	}

	// A freshly-added bill has no rate fields set.
	reloaded, err := s.GetSession(sess.ID)
	if err != nil {
		t.Fatalf("GetSession: %v", err)
	}
	if reloaded.Bills[0].ExchangeRate != nil || reloaded.Bills[0].ExchangeRateDate != nil || reloaded.Bills[0].ExchangeRateIsOverride {
		t.Fatalf("expected no rate fields on a freshly-added bill, got %+v", reloaded.Bills[0])
	}

	rate := 0.011
	date := "2026-01-01"
	if err := s.UpdateBill(sess.ID, "bill1", "Dinner", "USD", 0, nil, &rate, &date, true); err != nil {
		t.Fatalf("UpdateBill: %v", err)
	}

	reloaded, err = s.GetSession(sess.ID)
	if err != nil {
		t.Fatalf("GetSession: %v", err)
	}
	got := reloaded.Bills[0]
	if got.Currency != "USD" {
		t.Fatalf("Currency = %q, want USD", got.Currency)
	}
	if got.ExchangeRate == nil || *got.ExchangeRate != rate {
		t.Fatalf("ExchangeRate = %v, want %v", got.ExchangeRate, rate)
	}
	if got.ExchangeRateDate == nil || *got.ExchangeRateDate != date {
		t.Fatalf("ExchangeRateDate = %v, want %v", got.ExchangeRateDate, date)
	}
	if !got.ExchangeRateIsOverride {
		t.Fatalf("expected ExchangeRateIsOverride = true")
	}

	// Switching back to session currency clears the rate fields (mirrors the
	// frontend Bill Settings modal's save behavior — see plan §5).
	if err := s.UpdateBill(sess.ID, "bill1", "Dinner", "INR", 0, nil, nil, nil, false); err != nil {
		t.Fatalf("UpdateBill clear: %v", err)
	}
	reloaded, err = s.GetSession(sess.ID)
	if err != nil {
		t.Fatalf("GetSession: %v", err)
	}
	got = reloaded.Bills[0]
	if got.ExchangeRate != nil || got.ExchangeRateDate != nil || got.ExchangeRateIsOverride {
		t.Fatalf("expected cleared rate fields, got %+v", got)
	}
}
