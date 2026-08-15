// Package models holds the server-side row/entity shapes, mirroring
// src/schemas/session.schema.ts and src/schemas/bill.schema.ts on the
// frontend (kept as separate hand-written structs, not code-generated —
// see internal/settlement's doc comment for why the two languages don't
// share a single source of truth).
package models

type Person struct {
	ID   string `json:"id"`
	Name string `json:"name"`
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
	// The bill's most-recently-uploaded receipt image, if any (see
	// api.UploadImage / store.listBills). Nil when no image has been
	// uploaded for this bill.
	ImageRefKey *string `json:"imageRefKey"`
	ImageWidth  *int    `json:"imageWidth"`
	ImageHeight *int    `json:"imageHeight"`
}

// JoinMode controls how POST /join is handled for a session.
type JoinMode string

const (
	JoinModeApprovalCode JoinMode = "approval_code"
	JoinModeOpenLink     JoinMode = "open_link"
)

// ClaimMode controls how item claims are handled for a session.
type ClaimMode string

const (
	ClaimModeFreeSelect            ClaimMode = "free_select"
	ClaimModeClaimsRequireApproval ClaimMode = "claims_require_approval"
)

type Session struct {
	ID           string    `json:"id"`
	Title        string    `json:"title"`
	CreatedAt    string    `json:"createdAt"`
	UpdatedAt    string    `json:"updatedAt"`
	LastAccessAt string    `json:"-"`
	JoinMode     JoinMode  `json:"joinMode"`
	ClaimMode    ClaimMode `json:"claimMode"`
	IsSettled    bool      `json:"isSettled"`
	SettledAt    *string   `json:"settledAt"`
	CreatorToken string    `json:"-"`
	People       []Person  `json:"people"`
	Bills        []Bill    `json:"bills"`
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
}

type ClaimStatus string

const (
	ClaimPending  ClaimStatus = "pending"
	ClaimApproved ClaimStatus = "approved"
)

type ItemClaim struct {
	ID       string      `json:"id"`
	ItemID   string      `json:"-"`
	PersonID string      `json:"personId"`
	Value    float64     `json:"value"`
	Status   ClaimStatus `json:"status"`
}

type ImageMeta struct {
	RefKey   string `json:"refKey"`
	BillID   string `json:"-"`
	FilePath string `json:"-"`
	Width    int    `json:"width"`
	Height   int    `json:"height"`
}
