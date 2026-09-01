package api

import (
	"errors"
	"net/http"
	"time"

	"billsplitter/server/internal/models"
	"billsplitter/server/internal/settlement"
	"billsplitter/server/internal/sse"
	"billsplitter/server/internal/store"
)

type addPaymentRequest struct {
	// ID lets the offline-first frontend keep the same client-generated id
	// on both sides, same reasoning as addBillRequest.ID.
	ID                     string   `json:"id"`
	PayerID                string   `json:"payerId"`
	PayeeID                string   `json:"payeeId"`
	Amount                 float64  `json:"amount"`
	Currency               string   `json:"currency"`
	ExchangeRate           *float64 `json:"exchangeRate"`
	ExchangeRateDate       *string  `json:"exchangeRateDate"`
	ExchangeRateIsOverride bool     `json:"exchangeRateIsOverride"`
	Method                 string   `json:"method"`
	TransactionID          *string  `json:"transactionId"`
	AddedByPersonID        string   `json:"addedByPersonId"`
}

// AddPayment handles POST /api/sessions/{code}/payments — either party to a
// settlement edge can log a payment for themselves (their own
// X-Joiner-Token, authenticating as AddedByPersonID), or the creator can log
// one token-free on anyone's behalf, same dual-auth shape as ClaimItem.
// AddedByPersonID must be either PayerID or PayeeID — logging a payment
// "on behalf of" two unrelated other people isn't a joiner's to do even with
// their own valid token. verified is computed here (not trusted from the
// request) via settlement.ComputeInitialVerified, mirroring
// paymentVerification.ts's local-optimistic computation on the frontend.
func (a *API) AddPayment(w http.ResponseWriter, r *http.Request) {
	code := r.PathValue("code")
	if !a.requireNotSettled(w, r, code) {
		return
	}

	requirePaymentVerification, err := a.store.GetRequirePaymentVerification(code)
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "session not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load session")
		return
	}

	var req addPaymentRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.PayerID == "" || req.PayeeID == "" || req.AddedByPersonID == "" {
		writeError(w, http.StatusBadRequest, "payerId, payeeId, and addedByPersonId are required")
		return
	}
	if req.Method != "cash" && req.Method != "online" {
		writeError(w, http.StatusBadRequest, "method must be \"cash\" or \"online\"")
		return
	}
	if req.AddedByPersonID != req.PayerID && req.AddedByPersonID != req.PayeeID {
		writeError(w, http.StatusForbidden, "addedByPersonId must be the payer or the payee")
		return
	}
	if r.Header.Get("X-Joiner-Token") != "" && !a.requireJoiner(w, r, code, req.AddedByPersonID) {
		return
	}

	id := req.ID
	if id == "" {
		generated, err := newID()
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to create payment")
			return
		}
		id = generated
	}

	verified := settlement.ComputeInitialVerified(true, requirePaymentVerification, req.AddedByPersonID, req.PayeeID)
	createdAt := time.Now().UTC().Format(time.RFC3339)
	payment := models.Payment{
		ID:                     id,
		SessionID:              code,
		PayerID:                req.PayerID,
		PayeeID:                req.PayeeID,
		Amount:                 req.Amount,
		Currency:               req.Currency,
		ExchangeRate:           req.ExchangeRate,
		ExchangeRateDate:       req.ExchangeRateDate,
		ExchangeRateIsOverride: req.ExchangeRateIsOverride,
		Method:                 req.Method,
		TransactionID:          req.TransactionID,
		AddedByPersonID:        req.AddedByPersonID,
		Verified:               verified,
		CreatedAt:              createdAt,
	}
	if verified {
		payment.VerifiedAt = &createdAt
	}

	if err := a.store.AddPayment(code, payment); errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "session not found")
		return
	} else if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to add payment")
		return
	}

	a.hub.Broadcast(code, sse.Event{Kind: "payment.created", ID: id})
	writeJSON(w, http.StatusCreated, payment)
}

// VerifyPayment handles POST /api/sessions/{code}/payments/{paymentId}/verify.
// Dual auth, same shape as ClaimItem/UpdatePerson: an X-Joiner-Token, if
// present, must authenticate as the payment's own payee — the payer's own
// valid token fails this check (proves the wrong personID), since
// verification exists precisely so the person owed money stays in control
// of what counts (see architecture/payments.md). Omitting the header is the
// creator's token-free path, trusted the same way every other creator UI
// call in this codebase is.
func (a *API) VerifyPayment(w http.ResponseWriter, r *http.Request) {
	code := r.PathValue("code")
	paymentID := r.PathValue("paymentId")

	payment, err := a.store.GetPayment(code, paymentID)
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "payment not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load payment")
		return
	}

	if r.Header.Get("X-Joiner-Token") != "" && !a.requireJoiner(w, r, code, payment.PayeeID) {
		return
	}

	if err := a.store.VerifyPayment(code, paymentID); errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "payment not found")
		return
	} else if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to verify payment")
		return
	}

	a.hub.Broadcast(code, sse.Event{Kind: "payment.verified", ID: paymentID})
	writeJSON(w, http.StatusOK, map[string]string{"status": "verified"})
}
