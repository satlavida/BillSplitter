package api

import (
	"errors"
	"fmt"
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
	if !a.requireEditPermission(w, r, code) {
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
		// Non-nil so the JSON response below serializes "items" as [] rather
		// than null — LiveBillSchema (live.schema.ts) requires an array,
		// same bug/fix as AddItem's ConsumedBy (see
		// architecture/live-collaboration.md's Notes). This response is
		// used as-is, not re-fetched from the DB.
		Items: []models.Item{},
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
	Title                  string   `json:"title"`
	Currency               string   `json:"currency"`
	TaxAmount              float64  `json:"taxAmount"`
	PaidByPersonID         *string  `json:"paidByPersonId"`
	ExchangeRate           *float64 `json:"exchangeRate"`
	ExchangeRateDate       *string  `json:"exchangeRateDate"`
	ExchangeRateIsOverride bool     `json:"exchangeRateIsOverride"`
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
	if !a.requireEditPermission(w, r, code) {
		return
	}

	var req updateBillRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := a.store.UpdateBill(code, billID, req.Title, req.Currency, req.TaxAmount, req.PaidByPersonID, req.ExchangeRate, req.ExchangeRateDate, req.ExchangeRateIsOverride); errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "bill not found")
		return
	} else if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update bill")
		return
	}

	a.hub.Broadcast(code, sse.Event{Kind: "bill.updated", ID: billID})
	writeJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

// DeleteBill handles DELETE /api/sessions/{code}/bills/{billId} — soft
// deletes: the bill drops out of GetSession (so joiners/the creator's own
// bill list stop seeing it) but stays recoverable. Dual-mode auth like
// UpdateItem/DeleteItem: an optional personId (query param, since DELETE
// carries no body here) attributes the deletion to a joiner in the
// activity log when paired with a matching X-Joiner-Token; the creator's
// own UI omits both and the deletion goes unlogged-by-person (still
// findable by title/time). Only ever soft-deletes — see
// PermanentlyDeleteBill for the creator-only irreversible version.
func (a *API) DeleteBill(w http.ResponseWriter, r *http.Request) {
	code := r.PathValue("code")
	billID := r.PathValue("billId")
	personID := r.URL.Query().Get("personId")

	if r.Header.Get("X-Joiner-Token") != "" && personID != "" && !a.requireJoiner(w, r, code, personID) {
		return
	}
	if !a.requireNotSettled(w, r, code) {
		return
	}
	if !a.requireEditPermission(w, r, code) {
		return
	}

	billTitle, _ := a.store.GetBillTitle(billID)

	if err := a.store.SoftDeleteBill(code, billID); errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "bill not found")
		return
	} else if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to delete bill")
		return
	}

	if personID != "" {
		personName, _ := a.store.GetPersonName(personID)
		a.recordItemActivity(code, billID, billTitle, personID, personName, "delete_bill", 0, 0, fmt.Sprintf("deleted bill %q", billTitle))
	}

	a.hub.Broadcast(code, sse.Event{Kind: "bill.updated", ID: billID})
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// RestoreBill handles POST /api/sessions/{code}/bills/{billId}/restore —
// creator-only, reverses a DeleteBill.
func (a *API) RestoreBill(w http.ResponseWriter, r *http.Request) {
	if !a.requireCreator(w, r) {
		return
	}
	code := r.PathValue("code")
	billID := r.PathValue("billId")

	deleted, err := a.store.ListDeletedBills(code)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load deleted bills")
		return
	}
	billTitle := ""
	for _, b := range deleted {
		if b.ID == billID {
			billTitle = b.Title
			break
		}
	}

	if err := a.store.RestoreBill(code, billID); errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "deleted bill not found")
		return
	} else if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to restore bill")
		return
	}

	a.recordItemActivity(code, billID, billTitle, "", "", "restore_bill", 0, 0, fmt.Sprintf("restored bill %q", billTitle))
	a.hub.Broadcast(code, sse.Event{Kind: "bill.updated", ID: billID})
	writeJSON(w, http.StatusOK, map[string]string{"status": "restored"})
}

// PermanentlyDeleteBill handles DELETE /api/sessions/{code}/bills/{billId}/permanent
// — creator-only, irreversible. Works on a bill whether or not it was
// already soft-deleted (a creator can jump straight to permanent removal).
func (a *API) PermanentlyDeleteBill(w http.ResponseWriter, r *http.Request) {
	if !a.requireCreator(w, r) {
		return
	}
	code := r.PathValue("code")
	billID := r.PathValue("billId")

	billTitle, _ := a.store.GetBillTitle(billID)
	if billTitle == "" {
		if deleted, err := a.store.ListDeletedBills(code); err == nil {
			for _, b := range deleted {
				if b.ID == billID {
					billTitle = b.Title
					break
				}
			}
		}
	}

	if err := a.store.HardDeleteBill(code, billID); errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "bill not found")
		return
	} else if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to permanently delete bill")
		return
	}

	a.recordItemActivity(code, billID, billTitle, "", "", "permanent_delete_bill", 0, 0, fmt.Sprintf("permanently removed bill %q", billTitle))
	a.hub.Broadcast(code, sse.Event{Kind: "bill.updated", ID: billID})
	writeJSON(w, http.StatusOK, map[string]string{"status": "removed"})
}

// ListDeletedBills handles GET /api/sessions/{code}/bills/deleted —
// creator-only, backs the "Deleted Bills" review UI (restore/permanently
// remove).
func (a *API) ListDeletedBills(w http.ResponseWriter, r *http.Request) {
	if !a.requireCreator(w, r) {
		return
	}
	code := r.PathValue("code")

	bills, err := a.store.ListDeletedBills(code)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load deleted bills")
		return
	}
	writeJSON(w, http.StatusOK, bills)
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
	if !a.requireEditPermission(w, r, code) {
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
		// Non-nil so the JSON response below serializes "consumedBy" as []
		// rather than null — LiveItemSchema (live.schema.ts) requires an
		// array, and this response is used as-is, not re-fetched from the DB
		// (store.listItems always returns a non-nil slice).
		ConsumedBy: []models.Allocation{},
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
	// PersonID identifies who made this edit, for the activity log — only
	// sent by the joiner UI (EditLiveItemModal.tsx); the creator's own
	// live-editing UI omits it and edits go unlogged, same as before this
	// field existed. When present alongside X-Joiner-Token, it must
	// authenticate as that same person (requireJoiner) — a joiner can only
	// attribute an edit to themselves, not impersonate someone else.
	PersonID string `json:"personId"`
}

// describeItemEdit builds a human-readable summary of which fields changed,
// e.g. "price $10.00 -> $12.00, quantity 2 -> 3" — used for edit_item's
// activity-log Details, since a name/price/quantity/discount/splitType edit
// isn't a single before/after number the way a claim's delta_value is.
func describeItemEdit(old models.Item, name string, price float64, quantity int, discount float64, discountType, splitType string) string {
	var changes []string
	if old.Name != name {
		changes = append(changes, fmt.Sprintf("name %q -> %q", old.Name, name))
	}
	if old.Price != price {
		changes = append(changes, fmt.Sprintf("price %.2f -> %.2f", old.Price, price))
	}
	if old.Quantity != quantity {
		changes = append(changes, fmt.Sprintf("quantity %d -> %d", old.Quantity, quantity))
	}
	if old.Discount != discount || old.DiscountType != discountType {
		changes = append(changes, fmt.Sprintf("discount %.2f%s -> %.2f%s", old.Discount, old.DiscountType, discount, discountType))
	}
	if old.SplitType != splitType {
		changes = append(changes, fmt.Sprintf("split type %s -> %s", old.SplitType, splitType))
	}
	if len(changes) == 0 {
		return "no changes"
	}
	result := changes[0]
	for _, c := range changes[1:] {
		result += ", " + c
	}
	return result
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
	if !a.requireEditPermission(w, r, code) {
		return
	}

	var req updateItemRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if r.Header.Get("X-Joiner-Token") != "" && req.PersonID != "" && !a.requireJoiner(w, r, code, req.PersonID) {
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

	// Loaded before the write (when we'll need it for the activity log) so
	// the "old" side of the diff reflects the item's state right before
	// this edit, not after.
	var old *models.Item
	if req.PersonID != "" {
		old, _ = a.store.GetItem(itemID)
	}

	if err := a.store.UpdateItem(code, itemID, req.Name, req.Price, quantity, req.Discount, discountType, splitType); errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "item not found")
		return
	} else if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update item")
		return
	}

	if old != nil {
		personName, _ := a.store.GetPersonName(req.PersonID)
		details := describeItemEdit(*old, req.Name, req.Price, quantity, req.Discount, discountType, splitType)
		a.recordItemActivity(code, itemID, old.Name, req.PersonID, personName, "edit_item", 0, 0, details)
	}

	a.hub.Broadcast(code, sse.Event{Kind: "item.updated", ID: itemID})
	writeJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

// DeleteItem handles DELETE /api/sessions/{code}/bills/{billId}/items/{itemId}
// — removes an item (and, via ON DELETE CASCADE, any claims on it). personId
// is optional (query string, since DELETE requests carry no JSON body here)
// and works the same as UpdateItem's: only used to attribute+log a joiner's
// deletion, dual-mode with the creator's own token-free UI.
func (a *API) DeleteItem(w http.ResponseWriter, r *http.Request) {
	code := r.PathValue("code")
	itemID := r.PathValue("itemId")
	personID := r.URL.Query().Get("personId")

	if r.Header.Get("X-Joiner-Token") != "" && personID != "" && !a.requireJoiner(w, r, code, personID) {
		return
	}
	if !a.requireNotSettled(w, r, code) {
		return
	}
	if !a.requireEditPermission(w, r, code) {
		return
	}

	itemName := ""
	if personID != "" {
		if item, err := a.store.GetItem(itemID); err == nil {
			itemName = item.Name
		}
	}

	if err := a.store.DeleteItem(code, itemID); errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "item not found")
		return
	} else if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to delete item")
		return
	}

	if personID != "" {
		personName, _ := a.store.GetPersonName(personID)
		a.recordItemActivity(code, itemID, itemName, personID, personName, "delete_item", 0, 0, fmt.Sprintf("removed %q", itemName))
	}

	a.hub.Broadcast(code, sse.Event{Kind: "item.updated", ID: itemID})
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

type claimItemRequest struct {
	PersonID string  `json:"personId"`
	Value    float64 `json:"value"`
}

// ClaimItem handles POST /api/sessions/{code}/bills/{billId}/items/{itemId}/claims
// — a person directly selects/updates their share of an item (writes an
// item_allocations row, insert-only so concurrent claims for different
// people never conflict). There is no approval queue: a joiner's selection
// takes effect immediately, gated only by requireEditPermission (read_only
// sessions reject it outright) — see req 6.
//
// If the caller sends X-Joiner-Token, it must authenticate them as the
// personId being claimed for (self-claim enforcement). If the header is
// absent, the request proceeds unauthenticated — the creator's own
// live-editing UI (ItemAssignment) claims on behalf of arbitrary people as
// the creator and has no joiner token to send; this dual-mode is
// deliberate, not an oversight.
func (a *API) ClaimItem(w http.ResponseWriter, r *http.Request) {
	code := r.PathValue("code")
	itemID := r.PathValue("itemId")

	gate, err := a.store.GetSessionGate(code)
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "session not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load session")
		return
	}
	if gate.IsSettled {
		writeError(w, http.StatusConflict, "session has been settled")
		return
	}
	if !a.requireEditPermission(w, r, code) {
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
	if r.Header.Get("X-Joiner-Token") != "" && !a.requireJoiner(w, r, code, req.PersonID) {
		return
	}
	value := req.Value
	if value == 0 {
		value = 1
	}

	item, err := a.store.GetItem(itemID)
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "item not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to load item")
		return
	}

	// Quantity Split items have a hard pool to share: a claim can't push the
	// total claimed past the item's own quantity. Equal-split items have no
	// such cap — their claim value is always exactly 1 (presence-only), not
	// quantity-bound. This mirrors JoinerItemRow.tsx's frontend cap, which
	// only bounds what's *shown*; the real enforcement has to live here,
	// since a joiner could otherwise post directly past the UI's cap.
	var currentValue float64
	if item.SplitType == "fraction" {
		var othersTotal float64
		for _, c := range item.ConsumedBy {
			if c.PersonID != req.PersonID {
				othersTotal += c.Value
			} else {
				currentValue = c.Value
			}
		}
		const epsilon = 1e-6
		if othersTotal+value > float64(item.Quantity)+epsilon {
			remaining := float64(item.Quantity) - othersTotal
			if remaining < 0 {
				remaining = 0
			}
			writeError(w, http.StatusConflict, fmt.Sprintf("Only %g left to claim on this item", remaining))
			return
		}
	} else {
		for _, c := range item.ConsumedBy {
			if c.PersonID == req.PersonID {
				currentValue = c.Value
				break
			}
		}
	}

	personName, _ := a.store.GetPersonName(req.PersonID)
	delta := value - currentValue

	if err := a.store.ClaimItemFreeSelect(code, itemID, req.PersonID, value); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to claim item")
		return
	}
	a.recordItemActivity(code, itemID, item.Name, req.PersonID, personName, "claim", delta, value, "")
	a.hub.Broadcast(code, sse.Event{Kind: "item.updated", ID: itemID})
	writeJSON(w, http.StatusOK, map[string]string{"status": "approved"})
}

// recordItemActivity logs a claim/unclaim/edit/delete and broadcasts it;
// logging failures are swallowed (not surfaced to the caller) since the
// mutation itself already succeeded by the time this runs — the log is a
// secondary audit trail, not something worth failing the user-visible
// request over.
func (a *API) recordItemActivity(code, itemID, itemName, personID, personName, action string, delta, total float64, details string) {
	if err := a.store.RecordItemActivity(code, models.ItemActivity{
		ItemID: itemID, ItemName: itemName, PersonID: personID, PersonName: personName,
		Action: action, DeltaValue: delta, TotalValue: total, Details: details,
	}); err != nil {
		return
	}
	a.hub.Broadcast(code, sse.Event{Kind: "activity.created", ID: itemID})
}

// UnclaimItem handles DELETE /api/sessions/{code}/bills/{billId}/items/{itemId}/claims/{personId}.
// Same dual-mode auth as ClaimItem: if X-Joiner-Token is present it must
// authenticate the caller as personID (self-unclaim enforcement); if absent,
// the request proceeds unauthenticated as the creator's own token-free
// live-editing UI (ItemAssignment/PassAndSplit) unclaiming on behalf of
// arbitrary people, mirroring ClaimItem's rationale.
func (a *API) UnclaimItem(w http.ResponseWriter, r *http.Request) {
	code := r.PathValue("code")
	itemID := r.PathValue("itemId")
	personID := r.PathValue("personId")

	if r.Header.Get("X-Joiner-Token") != "" && !a.requireJoiner(w, r, code, personID) {
		return
	}
	if !a.requireNotSettled(w, r, code) {
		return
	}
	if !a.requireEditPermission(w, r, code) {
		return
	}

	item, err := a.store.GetItem(itemID)
	if err != nil && !errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusInternalServerError, "failed to load item")
		return
	}
	itemName := ""
	var oldValue float64
	if item != nil {
		itemName = item.Name
		for _, c := range item.ConsumedBy {
			if c.PersonID == personID {
				oldValue = c.Value
				break
			}
		}
	}
	personName, _ := a.store.GetPersonName(personID)

	if err := a.store.UnclaimItem(code, itemID, personID); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to unclaim item")
		return
	}

	a.recordItemActivity(code, itemID, itemName, personID, personName, "unclaim", -oldValue, 0, "")
	a.hub.Broadcast(code, sse.Event{Kind: "item.updated", ID: itemID})
	writeJSON(w, http.StatusOK, map[string]string{"status": "unclaimed"})
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
