// Package models holds the server-side row/entity shapes, mirroring
// src/schemas/session.schema.ts and src/schemas/bill.schema.ts on the
// frontend (kept as separate hand-written structs, not code-generated —
// see internal/settlement's doc comment for why the two languages don't
// share a single source of truth).
package models

type Person struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	UpiID string `json:"upiId"`
}

type Allocation struct {
	PersonID string  `json:"personId"`
	Value    float64 `json:"value"`
}

type Item struct {
	ID           string       `json:"id"`
	BillID       string       `json:"-"`
	Name         string       `json:"name"`
	Price        float64      `json:"price"`
	Quantity     int          `json:"quantity"`
	Discount     float64      `json:"discount"`
	DiscountType string       `json:"discountType"` // "flat" | "percentage"
	SplitType    string       `json:"splitType"`    // "equal" | "percentage" | "fraction"
	ConsumedBy   []Allocation `json:"consumedBy"`
}

type Bill struct {
	ID             string  `json:"id"`
	SessionID      string  `json:"-"`
	Title          string  `json:"title"`
	Date           string  `json:"date"`
	Items          []Item  `json:"items"`
	TaxAmount      float64 `json:"taxAmount"`
	Currency       string  `json:"currency"`
	PaidByPersonID *string `json:"paidByPersonId"`
	// ExchangeRate is the rate currently in effect for converting this
	// bill's amounts into its session's currency (fetched from the global
	// exchange_rates cache, or a user override — see migration 0009) — nil
	// when Currency matches the session's currency (implicit 1:1).
	ExchangeRate *float64 `json:"exchangeRate"`
	// ExchangeRateDate is the transaction date the rate was fetched/overridden for.
	ExchangeRateDate *string `json:"exchangeRateDate"`
	// ExchangeRateIsOverride distinguishes a user-entered rate from a
	// fetched one, for display/audit purposes only — settlement math reads
	// ExchangeRate regardless of which it is.
	ExchangeRateIsOverride bool `json:"exchangeRateIsOverride"`
	// The bill's most-recently-uploaded receipt image, if any (see
	// api.UploadImage / store.listBills). Nil when no image has been
	// uploaded for this bill.
	ImageRefKey *string `json:"imageRefKey"`
	ImageWidth  *int    `json:"imageWidth"`
	ImageHeight *int    `json:"imageHeight"`
	// DeletedAt is set by SoftDeleteBill (RFC3339) and cleared by
	// RestoreBill. Bills.listBills excludes soft-deleted rows entirely, so
	// this only ever shows up on ListDeletedBills' response — the
	// creator-only "Deleted Bills" review UI.
	DeletedAt *string `json:"deletedAt"`
}

// JoinMode controls how POST /join is handled for a session.
type JoinMode string

const (
	JoinModeApprovalCode JoinMode = "approval_code"
	JoinModeOpenLink     JoinMode = "open_link"
)

// ClaimMode controls how item claims are handled for a session.
// Deprecated: superseded by PermissionMode; removed once the claims
// mechanism is dropped (migration 0006).
type ClaimMode string

const (
	ClaimModeFreeSelect            ClaimMode = "free_select"
	ClaimModeClaimsRequireApproval ClaimMode = "claims_require_approval"
)

// PermissionMode controls whether joiners can directly edit bills/items
// (edit) or only view the creator's changes (read_only).
type PermissionMode string

const (
	PermissionModeEdit     PermissionMode = "edit"
	PermissionModeReadOnly PermissionMode = "read_only"
)

type Session struct {
	ID              string         `json:"id"`
	Title           string         `json:"title"`
	CreatedAt       string         `json:"createdAt"`
	UpdatedAt       string         `json:"updatedAt"`
	LastAccessAt    string         `json:"-"`
	JoinMode        JoinMode       `json:"joinMode"`
	ClaimMode       ClaimMode      `json:"claimMode"`
	PermissionMode  PermissionMode `json:"permissionMode"`
	CreatorPersonID *string        `json:"creatorPersonId"`
	Currency        string         `json:"currency"`
	IsSettled       bool           `json:"isSettled"`
	SettledAt       *string        `json:"settledAt"`
	CreatorToken    string         `json:"-"`
	// RequirePaymentVerification is a creator-only toggle (Session Settings)
	// — see internal/settlement/paymentverify.go's ComputeInitialVerified
	// and migration 0014_payments.sql.
	RequirePaymentVerification bool     `json:"requirePaymentVerification"`
	People                     []Person `json:"people"`
	Bills                      []Bill   `json:"bills"`
	// Payments is filtered by caller identity before being serialized — see
	// api.filterPaymentsForViewer. A joiner only ever sees payments they're
	// the payer or payee of; the creator sees all.
	Payments []Payment `json:"payments"`
}

// Payment is a logged payment settling part/all of what PayerID owes
// PayeeID — see architecture/payments.md. Session-scoped, not bill-scoped:
// settlement already aggregates across every bill, and a payment settles a
// person-to-person balance, not one specific bill. Mirrors
// bill.schema.ts/live.schema.ts's Payment/LivePayment on the frontend.
type Payment struct {
	ID        string  `json:"id"`
	SessionID string  `json:"-"`
	PayerID   string  `json:"payerId"`
	PayeeID   string  `json:"payeeId"`
	Amount    float64 `json:"amount"`
	Currency  string  `json:"currency"`
	// ExchangeRate/ExchangeRateDate/ExchangeRateIsOverride mirror Bill's
	// fields of the same name — set only when Currency differs from the
	// session's own currency.
	ExchangeRate           *float64 `json:"exchangeRate"`
	ExchangeRateDate       *string  `json:"exchangeRateDate"`
	ExchangeRateIsOverride bool     `json:"exchangeRateIsOverride"`
	Method                 string   `json:"method"` // "cash" | "online"
	// TransactionID is set only for Method == "online".
	TransactionID   *string `json:"transactionId"`
	AddedByPersonID string  `json:"addedByPersonId"`
	// Verified is computed once, at creation time (see
	// ComputeInitialVerified), and flipped true by VerifyPayment — never
	// recomputed afterward.
	Verified   bool    `json:"verified"`
	VerifiedAt *string `json:"verifiedAt"`
	CreatedAt  string  `json:"createdAt"`
}

// SessionStatus is the lightweight per-code result of a batch status lookup
// (store.GetSessionsStatus) — Status is one of "active", "settled", or
// "deleted" (never existed or purged; the two are indistinguishable).
type SessionStatus struct {
	Code      string  `json:"code"`
	Title     string  `json:"title,omitempty"`
	Status    string  `json:"status"`
	SettledAt *string `json:"settledAt"`
}

type JoinerStatus string

const (
	JoinerPending     JoinerStatus = "pending"
	JoinerApproved    JoinerStatus = "approved"
	JoinerDisapproved JoinerStatus = "disapproved"
)

type Joiner struct {
	ID           string       `json:"id"`
	SessionID    string       `json:"-"`
	Name         string       `json:"name"`
	PersonID     *string      `json:"personId"`
	Status       JoinerStatus `json:"status"`
	ApprovalCode string       `json:"approvalCode,omitempty"`
	CreatedAt    string       `json:"createdAt"`
	// JoinerToken authenticates later claim/unclaim requests as coming from
	// this joiner (see store.VerifyJoinerToken). Never serialized directly —
	// it's revealed to the client exactly once via a separate response
	// wrapper (see api.joinerWithToken), not through this struct's own JSON.
	JoinerToken   string `json:"-"`
	TokenRevealed bool   `json:"-"`
}

// ItemActivity is a durable log entry recording a single claim or unclaim
// action, snapshotting the item/person names at write time so the log stays
// legible even if either is later removed (see migrations/0003).
type ItemActivity struct {
	ID         int64   `json:"id"`
	ItemID     string  `json:"itemId"`
	ItemName   string  `json:"itemName"`
	PersonID   string  `json:"personId"`
	PersonName string  `json:"personName"`
	Action     string  `json:"action"` // "claim" | "unclaim" | "reject" | "edit_item" | "delete_item"
	DeltaValue float64 `json:"deltaValue"`
	TotalValue float64 `json:"totalValue"`
	// Details holds a human-readable summary of what changed for
	// "edit_item"/"delete_item" entries (e.g. "price $10.00 -> $12.00,
	// quantity 2 -> 3") — those actions don't reduce to a single
	// before/after number the way DeltaValue/TotalValue do for claims.
	// Empty for claim/unclaim/reject entries.
	Details   string `json:"details"`
	CreatedAt string `json:"createdAt"`
}

// ExchangeRate is a single cached rate lookup row (see migration
// 0010_exchange_rate_cache.sql) — a global, backend-only, permanent cache
// keyed by (date, base, quote), never edited by users directly.
type ExchangeRate struct {
	Date          string  `json:"date"`
	BaseCurrency  string  `json:"baseCurrency"`
	QuoteCurrency string  `json:"quoteCurrency"`
	Rate          float64 `json:"rate"`
	FetchedAt     string  `json:"fetchedAt"`
}

type ImageMeta struct {
	RefKey   string `json:"refKey"`
	BillID   string `json:"-"`
	FilePath string `json:"-"`
	Width    int    `json:"width"`
	Height   int    `json:"height"`
}
