package api

import (
	"errors"
	"net/http"
	"time"

	"billsplitter/server/internal/models"
	"billsplitter/server/internal/sse"
	"billsplitter/server/internal/store"
)

type addBillRequest struct {
	// ID lets a caller that already has a client-side id for this bill (the
	// offline-first frontend, syncing a locally-created bill up to a live
	// session) keep the same id on both sides — required for sessionStore's
	// entity-id merge to update the bill in place rather than duplicate it.
	// Left empty, one is generated server-side as before.
	ID        string  `json:"id"`
	Title     string  `json:"title"`
	Currency  string  `json:"currency"`
	TaxAmount float64 `json:"taxAmount"`
}

// AddBill handles POST /api/sessions/{code}/bills — add a bill within a
// live session (joiner or creator, no auth required beyond being a
// recognized session).
func (a *API) AddBill(w http.ResponseWriter, r *http.Request) {
	code := r.PathValue("code")
	if !a.requireNotSettled(w, r, code) {
		return
	}

	var req addBillRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	id := req.ID
	if id == "" {
		generated, err := newID()
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to create bill")
			return
		}
		id = generated
	}

	currency := req.Currency
	if currency == "" {
		currency = "USD"
	}

	bill := models.Bill{
		ID:        id,
		Title:     req.Title,
		Date:      time.Now().UTC().Format(time.RFC3339),
		Currency:  currency,
		TaxAmount: req.TaxAmount,
	}
	// Date is a display field (matches the frontend's ISO-8601 Bill.date),
	// unrelated to the SQLite-comparable timestamps store.go uses internally.

	if err := a.store.AddBill(code, bill); errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "session not found")
		return
	} else if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create bill")
		return
	}

	a.hub.Broadcast(code, sse.Event{Kind: "bill.updated", ID: id})
	writeJSON(w, http.StatusCreated, bill)
}

type updateBillRequest struct {
	Title          string  `json:"title"`
	Currency       string  `json:"currency"`
	TaxAmount      float64 `json:"taxAmount"`
	PaidByPersonID *string `json:"paidByPersonId"`
}

// UpdateBill handles PATCH /api/sessions/{code}/bills/{billId} — syncs a
// locally-edited bill's own fields up to a live session. Never touches
// items (see UpdateItem) or claims — this is purely bill-row fields.
func (a *API) UpdateBill(w http.ResponseWriter, r *http.Request) {
	code := r.PathValue("code")
	billID := r.PathValue("billId")
	if !a.requireNotSettled(w, r, code) {
		return
	}

	var req updateBillRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := a.store.UpdateBill(code, billID, req.Title, req.Currency, req.TaxAmount, req.PaidByPersonID); errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "bill not found")
		return
	} else if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update bill")
		return
	}

	a.hub.Broadcast(code, sse.Event{Kind: "bill.updated", ID: billID})
	writeJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

type addItemRequest struct {
	// ID: see addBillRequest.ID — same client-id passthrough, same reason.
	ID           string  `json:"id"`
	Name         string  `json:"name"`
	Price        float64 `json:"price"`
	Quantity     int     `json:"quantity"`
	Discount     float64 `json:"discount"`
	DiscountType string  `json:"discountType"`
	SplitType    string  `json:"splitType"`
}

// AddItem handles POST /api/sessions/{code}/bills/{billId}/items.
func (a *API) AddItem(w http.ResponseWriter, r *http.Request) {
	code := r.PathValue("code")
	billID := r.PathValue("billId")
	if !a.requireNotSettled(w, r, code) {
		return
	}

	var req addItemRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	id := req.ID
	if id == "" {
		generated, err := newID()
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to create item")
			return
		}
		id = generated
	}

	quantity := req.Quantity
	if quantity <= 0 {
		quantity = 1
	}
	discountType := req.DiscountType
	if discountType == "" {
		discountType = "flat"
	}
	splitType := req.SplitType
	if splitType == "" {
		splitType = "equal"
	}

	item := models.Item{
		ID:           id,
		Name:         req.Name,
		Price:        req.Price,
		Quantity:     quantity,
		Discount:     req.Discount,
		DiscountType: discountType,
		SplitType:    splitType,
	}

	if err := a.store.AddItem(code, billID, item); errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "bill not found")
		return
	} else if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create item")
		return
	}

	a.hub.Broadcast(code, sse.Event{Kind: "item.updated", ID: id})
	writeJSON(w, http.StatusCreated, item)
}

type updateItemRequest struct {
	Name         string  `json:"name"`
	Price        float64 `json:"price"`
	Quantity     int     `json:"quantity"`
	Discount     float64 `json:"discount"`
	DiscountType string  `json:"discountType"`
	SplitType    string  `json:"splitType"`
}

// UpdateItem handles PATCH /api/sessions/{code}/bills/{billId}/items/{itemId}
// — syncs a locally-edited item's own fields up to a live session. Never
// touches consumedBy/allocations, which stay server-authoritative via the
// claim endpoints — an item update can't clobber a joiner's claim.
func (a *API) UpdateItem(w http.ResponseWriter, r *http.Request) {
	code := r.PathValue("code")
	itemID := r.PathValue("itemId")
	if !a.requireNotSettled(w, r, code) {
		return
	}

	var req updateItemRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	quantity := req.Quantity
	if quantity <= 0 {
		quantity = 1
	}
	discountType := req.DiscountType
	if discountType == "" {
		discountType = "flat"
	}
	splitType := req.SplitType
	if splitType == "" {
		splitType = "equal"
	}

	if err := a.store.UpdateItem(code, itemID, req.Name, req.Price, quantity, req.Discount, discountType, splitType); errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "item not found")
		return
	} else if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update item")
		return
	}

	a.hub.Broadcast(code, sse.Event{Kind: "item.updated", ID: itemID})
	writeJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

type claimItemRequest struct {
	PersonID string  `json:"personId"`
	Value    float64 `json:"value"`
}

// ClaimItem handles POST /api/sessions/{code}/bills/{billId}/items/{itemId}/claims.
// free_select writes an item_allocations row directly (auto-approved,
// insert-only so concurrent claims never conflict); claims_require_approval
// writes a pending item_claims row, SSE-pushed to the creator.
func (a *API) ClaimItem(w http.ResponseWriter, r *http.Request) {
	code := r.PathValue("code")
	itemID := r.PathValue("itemId")

	sess, err := a.store.GetSession(code)
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "session not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load session")
		return
	}
	if sess.IsSettled {
		writeError(w, http.StatusConflict, "session has been settled")
		return
	}

	var req claimItemRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.PersonID == "" {
		writeError(w, http.StatusBadRequest, "personId is required")
		return
	}
	value := req.Value
	if value == 0 {
		value = 1
	}

	if sess.ClaimMode == models.ClaimModeFreeSelect {
		if err := a.store.ClaimItemFreeSelect(code, itemID, req.PersonID, value); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to claim item")
			return
		}
		a.hub.Broadcast(code, sse.Event{Kind: "item.updated", ID: itemID})
		writeJSON(w, http.StatusOK, map[string]string{"status": "approved"})
		return
	}

	claimID, err := newID()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to claim item")
		return
	}
	claim := models.ItemClaim{ID: claimID, ItemID: itemID, PersonID: req.PersonID, Value: value, Status: models.ClaimPending}
	if err := a.store.CreatePendingClaim(code, claim); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to claim item")
		return
	}
	a.hub.Broadcast(code, sse.Event{Kind: "claim.pending", ID: claimID})
	writeJSON(w, http.StatusCreated, claim)
}

// ApproveClaim handles POST /api/sessions/{code}/claims/{id}/approve (creator-only).
func (a *API) ApproveClaim(w http.ResponseWriter, r *http.Request) {
	if !a.requireCreator(w, r) {
		return
	}
	code := r.PathValue("code")
	claimID := r.PathValue("id")
	if !a.requireNotSettled(w, r, code) {
		return
	}

	if err := a.store.ApproveClaim(code, claimID); errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "claim not found")
		return
	} else if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to approve claim")
		return
	}

	a.hub.Broadcast(code, sse.Event{Kind: "claim.approved", ID: claimID})
	writeJSON(w, http.StatusOK, map[string]string{"status": "approved"})
}

// GetSettlement handles GET /api/sessions/{code}/settlement — server-computed
// net who-owes-who, so all joiners see identical, server-arbitrated numbers.
func (a *API) GetSettlement(w http.ResponseWriter, r *http.Request) {
	code := r.PathValue("code")
	sess, err := a.store.GetSession(code)
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "session not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load session")
		return
	}

	result := computeSettlement(sess)
	writeJSON(w, http.StatusOK, result)
}
