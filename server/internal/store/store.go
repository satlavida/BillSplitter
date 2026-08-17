// Package store is the repository layer over SQLite: hand-written SQL
// (no ORM — the schema is small, 8 tables, and this keeps it transparent),
// shared by the API handlers and the cleanup job.
package store

import (
	"crypto/rand"
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"billsplitter/server/internal/models"
)

var ErrNotFound = errors.New("not found")

type Store struct {
	db *sql.DB
}

func New(db *sql.DB) *Store {
	return &Store{db: db}
}

const codeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // no 0/O/1/I ambiguity

func randomCode(n int) (string, error) {
	buf := make([]byte, n)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	out := make([]byte, n)
	for i, b := range buf {
		out[i] = codeAlphabet[int(b)%len(codeAlphabet)]
	}
	return string(out), nil
}

func randomToken() (string, error) {
	buf := make([]byte, 24)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	const hex = "0123456789abcdef"
	out := make([]byte, len(buf)*2)
	for i, b := range buf {
		out[i*2] = hex[b>>4]
		out[i*2+1] = hex[b&0x0f]
	}
	return string(out), nil
}

// now formats timestamps in the same "YYYY-MM-DD HH:MM:SS" shape SQLite's
// own datetime('now', ...) produces, so string comparisons against it in
// PurgeStaleSessions's SQL sort correctly (an ISO8601 "T"/"Z" format would
// not memcmp-compare consistently against SQLite's space-separated output).
func now() string {
	return time.Now().UTC().Format("2006-01-02 15:04:05")
}

// CreateSession seeds server state from a creator's local session snapshot.
// creatorPersonID, if non-nil, must reference one of the ids in people (or be
// nil if the creator hasn't picked/added their own identity yet). Returns the
// new session (with its generated code and creator token).
func (s *Store) CreateSession(title string, people []models.Person, joinMode models.JoinMode, claimMode models.ClaimMode, permissionMode models.PermissionMode, creatorPersonID *string) (*models.Session, error) {
	code, err := s.newUniqueSessionCode()
	if err != nil {
		return nil, err
	}
	token, err := randomToken()
	if err != nil {
		return nil, err
	}

	ts := now()
	tx, err := s.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	// creator_person_id is set via a follow-up UPDATE below, not on this
	// INSERT: it references people.id, and people rows in turn reference
	// this session's id, so neither table can be seeded first under FK
	// enforcement — insert the session with a NULL creator_person_id, then
	// the people, then backfill.
	_, err = tx.Exec(
		`INSERT INTO sessions (id, title, creator_token, join_mode, claim_mode, permission_mode, creator_person_id, is_settled, created_at, updated_at, last_access_at)
		 VALUES (?, ?, ?, ?, ?, ?, NULL, 0, ?, ?, ?)`,
		code, title, token, joinMode, claimMode, permissionMode, ts, ts, ts,
	)
	if err != nil {
		return nil, fmt.Errorf("insert session: %w", err)
	}

	for _, p := range people {
		if _, err := tx.Exec(`INSERT INTO people (id, session_id, name) VALUES (?, ?, ?)`, p.ID, code, p.Name); err != nil {
			return nil, fmt.Errorf("insert person: %w", err)
		}
	}

	if creatorPersonID != nil {
		if _, err := tx.Exec(`UPDATE sessions SET creator_person_id = ? WHERE id = ?`, *creatorPersonID, code); err != nil {
			return nil, fmt.Errorf("set creator_person_id: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return s.GetSession(code)
}

// SetCreatorPersonID records which person row represents the session
// creator (req 7/8) — personID must already exist in this session's people.
func (s *Store) SetCreatorPersonID(sessionID, personID string) error {
	res, err := s.db.Exec(`UPDATE sessions SET creator_person_id = ? WHERE id = ?`, personID, sessionID)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return s.touchSession(sessionID)
}

func (s *Store) newUniqueSessionCode() (string, error) {
	for i := 0; i < 10; i++ {
		code, err := randomCode(5)
		if err != nil {
			return "", err
		}
		var exists int
		err = s.db.QueryRow(`SELECT 1 FROM sessions WHERE id = ?`, code).Scan(&exists)
		if errors.Is(err, sql.ErrNoRows) {
			return code, nil
		}
		if err != nil {
			return "", err
		}
	}
	return "", errors.New("failed to generate a unique session code")
}

// TouchLastAccess bumps last_access_at, used by middleware on every request
// to a session's routes so idle-but-viewed sessions extend their lifetime.
func (s *Store) TouchLastAccess(sessionID string) error {
	_, err := s.db.Exec(`UPDATE sessions SET last_access_at = ? WHERE id = ?`, now(), sessionID)
	return err
}

func (s *Store) GetSession(code string) (*models.Session, error) {
	sess := &models.Session{}
	var settledAt, creatorPersonID sql.NullString
	err := s.db.QueryRow(
		`SELECT id, title, creator_token, join_mode, claim_mode, permission_mode, creator_person_id, is_settled, settled_at, created_at, updated_at, last_access_at
		 FROM sessions WHERE id = ?`, code,
	).Scan(&sess.ID, &sess.Title, &sess.CreatorToken, &sess.JoinMode, &sess.ClaimMode, &sess.PermissionMode, &creatorPersonID, &sess.IsSettled, &settledAt, &sess.CreatedAt, &sess.UpdatedAt, &sess.LastAccessAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if settledAt.Valid {
		sess.SettledAt = &settledAt.String
	}
	if creatorPersonID.Valid {
		sess.CreatorPersonID = &creatorPersonID.String
	}

	people, err := s.listPeople(code)
	if err != nil {
		return nil, err
	}
	sess.People = people

	bills, err := s.listBills(code)
	if err != nil {
		return nil, err
	}
	sess.Bills = bills

	return sess, nil
}

// GetSessionsStatus is a lightweight batch companion to GetSession — a
// client tracking several sessions it has joined only needs to know
// active/settled/deleted for each, not the full people/bills payload, so
// this does a single indexed lookup instead of N GetSession round trips.
// Codes with no matching row (never existed, or purged by
// PurgeStaleSessions/DeleteLiveSession) come back as "deleted" — the two
// are indistinguishable from here, same as GetSession's ErrNotFound.
func (s *Store) GetSessionsStatus(codes []string) ([]models.SessionStatus, error) {
	result := make([]models.SessionStatus, len(codes))
	for i, code := range codes {
		result[i] = models.SessionStatus{Code: code, Status: "deleted"}
	}
	if len(codes) == 0 {
		return result, nil
	}

	placeholders := make([]string, len(codes))
	args := make([]any, len(codes))
	for i, code := range codes {
		placeholders[i] = "?"
		args[i] = code
	}
	rows, err := s.db.Query(
		`SELECT id, title, is_settled, settled_at FROM sessions WHERE id IN (`+strings.Join(placeholders, ",")+`)`,
		args...,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	found := make(map[string]models.SessionStatus, len(codes))
	for rows.Next() {
		var id, title string
		var isSettled bool
		var settledAt sql.NullString
		if err := rows.Scan(&id, &title, &isSettled, &settledAt); err != nil {
			return nil, err
		}
		status := "active"
		if isSettled {
			status = "settled"
		}
		entry := models.SessionStatus{Code: id, Title: title, Status: status}
		if settledAt.Valid {
			entry.SettledAt = &settledAt.String
		}
		found[id] = entry
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	for i, code := range codes {
		if entry, ok := found[code]; ok {
			result[i] = entry
		}
	}
	return result, nil
}

func (s *Store) listPeople(sessionID string) ([]models.Person, error) {
	rows, err := s.db.Query(`SELECT id, name FROM people WHERE session_id = ?`, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	people := []models.Person{}
	for rows.Next() {
		var p models.Person
		if err := rows.Scan(&p.ID, &p.Name); err != nil {
			return nil, err
		}
		people = append(people, p)
	}
	return people, rows.Err()
}

// listBills also resolves each bill's most-recently-uploaded receipt image
// (if any) via a correlated subquery — a bill can have more than one images
// row if a receipt was re-scanned, and only the latest one is relevant.
func (s *Store) listBills(sessionID string) ([]models.Bill, error) {
	rows, err := s.db.Query(
		`SELECT b.id, b.title, b.date, b.tax_amount, b.currency, b.paid_by_person_id,
		        i.ref_key, i.width, i.height
		 FROM bills b
		 LEFT JOIN images i ON i.ref_key = (
		   SELECT ref_key FROM images WHERE bill_id = b.id ORDER BY rowid DESC LIMIT 1
		 )
		 WHERE b.session_id = ?`, sessionID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	bills := []models.Bill{}
	var ids []string
	for rows.Next() {
		var b models.Bill
		var paidBy, imageRefKey sql.NullString
		var imageWidth, imageHeight sql.NullInt64
		if err := rows.Scan(&b.ID, &b.Title, &b.Date, &b.TaxAmount, &b.Currency, &paidBy, &imageRefKey, &imageWidth, &imageHeight); err != nil {
			return nil, err
		}
		if paidBy.Valid {
			b.PaidByPersonID = &paidBy.String
		}
		if imageRefKey.Valid {
			b.ImageRefKey = &imageRefKey.String
			width := int(imageWidth.Int64)
			height := int(imageHeight.Int64)
			b.ImageWidth = &width
			b.ImageHeight = &height
		}
		bills = append(bills, b)
		ids = append(ids, b.ID)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	for i := range bills {
		items, err := s.listItems(bills[i].ID)
		if err != nil {
			return nil, err
		}
		bills[i].Items = items
	}

	return bills, nil
}

func (s *Store) listItems(billID string) ([]models.Item, error) {
	rows, err := s.db.Query(
		`SELECT id, name, price, quantity, discount, discount_type, split_type FROM items WHERE bill_id = ?`, billID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []models.Item{}
	for rows.Next() {
		var it models.Item
		if err := rows.Scan(&it.ID, &it.Name, &it.Price, &it.Quantity, &it.Discount, &it.DiscountType, &it.SplitType); err != nil {
			return nil, err
		}
		it.BillID = billID
		items = append(items, it)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	for i := range items {
		allocations, err := s.listAllocations(items[i].ID)
		if err != nil {
			return nil, err
		}
		items[i].ConsumedBy = allocations
	}

	return items, nil
}

func (s *Store) listAllocations(itemID string) ([]models.Allocation, error) {
	rows, err := s.db.Query(`SELECT person_id, value FROM item_allocations WHERE item_id = ?`, itemID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	allocations := []models.Allocation{}
	for rows.Next() {
		var a models.Allocation
		if err := rows.Scan(&a.PersonID, &a.Value); err != nil {
			return nil, err
		}
		allocations = append(allocations, a)
	}
	return allocations, rows.Err()
}

// AddBill inserts a new bill (with no items yet) into a session.
func (s *Store) AddBill(sessionID string, bill models.Bill) error {
	_, err := s.db.Exec(
		`INSERT INTO bills (id, session_id, title, date, tax_amount, currency, paid_by_person_id) VALUES (?, ?, ?, ?, ?, ?, ?)`,
		bill.ID, sessionID, bill.Title, bill.Date, bill.TaxAmount, bill.Currency, bill.PaidByPersonID,
	)
	if err != nil {
		return err
	}
	return s.touchSession(sessionID)
}

// SetBillPaidBy updates who paid for a bill.
func (s *Store) SetBillPaidBy(sessionID, billID string, personID *string) error {
	res, err := s.db.Exec(`UPDATE bills SET paid_by_person_id = ? WHERE id = ? AND session_id = ?`, personID, billID, sessionID)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return s.touchSession(sessionID)
}

// UpdateBill overwrites a bill's own fields (title/currency/tax/payer) —
// used to sync a locally-edited bill up to a live session. Never touches
// items; see UpdateItem.
func (s *Store) UpdateBill(sessionID, billID, title, currency string, taxAmount float64, paidByPersonID *string) error {
	res, err := s.db.Exec(
		`UPDATE bills SET title = ?, currency = ?, tax_amount = ?, paid_by_person_id = ? WHERE id = ? AND session_id = ?`,
		title, currency, taxAmount, paidByPersonID, billID, sessionID,
	)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return s.touchSession(sessionID)
}

// AddItem inserts a new item (with no allocations yet) into a bill.
func (s *Store) AddItem(sessionID, billID string, item models.Item) error {
	_, err := s.db.Exec(
		`INSERT INTO items (id, bill_id, name, price, quantity, discount, discount_type, split_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		item.ID, billID, item.Name, item.Price, item.Quantity, item.Discount, item.DiscountType, item.SplitType,
	)
	if err != nil {
		return err
	}
	return s.touchSession(sessionID)
}

// UpdateItem overwrites an item's own fields — used to sync a locally-edited
// item (price, quantity, discount, split type) up to a live session. Never
// touches consumedBy/allocations: those stay server-authoritative, driven
// only by ClaimItemFreeSelect/UnclaimItem, so a stale local edit can never
// clobber a joiner's claim.
func (s *Store) UpdateItem(sessionID, itemID, name string, price float64, quantity int, discount float64, discountType, splitType string) error {
	res, err := s.db.Exec(
		`UPDATE items SET name = ?, price = ?, quantity = ?, discount = ?, discount_type = ?, split_type = ? WHERE id = ?`,
		name, price, quantity, discount, discountType, splitType, itemID,
	)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return s.touchSession(sessionID)
}

// ClaimItemFreeSelect writes an item_allocations row directly (insert-only,
// so concurrent claims for different people never conflict; re-claiming by
// the same person is idempotent via upsert on the unique (item_id, person_id) key).
func (s *Store) ClaimItemFreeSelect(sessionID, itemID, personID string, value float64) error {
	_, err := s.db.Exec(
		`INSERT INTO item_allocations (item_id, person_id, value) VALUES (?, ?, ?)
		 ON CONFLICT (item_id, person_id) DO UPDATE SET value = excluded.value`,
		itemID, personID, value,
	)
	if err != nil {
		return err
	}
	return s.touchSession(sessionID)
}

// UnclaimItem removes a person's allocation from an item.
func (s *Store) UnclaimItem(sessionID, itemID, personID string) error {
	_, err := s.db.Exec(`DELETE FROM item_allocations WHERE item_id = ? AND person_id = ?`, itemID, personID)
	if err != nil {
		return err
	}
	return s.touchSession(sessionID)
}

// RecordItemActivity appends one claim/unclaim log entry. Names are
// snapshotted by the caller (the API handler, which already has the item
// and person names from the loaded session) rather than looked up here —
// see migrations/0003 for why.
func (s *Store) RecordItemActivity(sessionID string, entry models.ItemActivity) error {
	_, err := s.db.Exec(
		`INSERT INTO item_activity (session_id, item_id, item_name, person_id, person_name, action, delta_value, total_value, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		sessionID, entry.ItemID, entry.ItemName, entry.PersonID, entry.PersonName, entry.Action, entry.DeltaValue, entry.TotalValue, now(),
	)
	return err
}

// ListItemActivity returns a session's claim/unclaim log, newest first.
func (s *Store) ListItemActivity(sessionID string) ([]models.ItemActivity, error) {
	rows, err := s.db.Query(
		`SELECT id, item_id, item_name, person_id, person_name, action, delta_value, total_value, created_at
		 FROM item_activity WHERE session_id = ? ORDER BY id DESC`, sessionID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	entries := []models.ItemActivity{}
	for rows.Next() {
		var e models.ItemActivity
		if err := rows.Scan(&e.ID, &e.ItemID, &e.ItemName, &e.PersonID, &e.PersonName, &e.Action, &e.DeltaValue, &e.TotalValue, &e.CreatedAt); err != nil {
			return nil, err
		}
		entries = append(entries, e)
	}
	return entries, rows.Err()
}

// CreateJoiner registers a join request. In open_link mode it is
// auto-approved; in approval_code mode it starts pending with a 2-digit
// approval code shown to the joiner. When newPersonID is non-nil (the joiner
// picked "someone new" rather than an existing person), a Person row is
// created for them in the same transaction — without this, a new-name
// joiner would have no personId and so no way to claim items later.
func (s *Store) CreateJoiner(sessionID, id, name string, existingPersonID *string, newPersonID *string, joinMode models.JoinMode) (*models.Joiner, error) {
	status := models.JoinerPending
	approvalCode := ""
	if joinMode == models.JoinModeOpenLink {
		status = models.JoinerApproved
	} else {
		code, err := randomCode(2)
		if err != nil {
			return nil, err
		}
		approvalCode = code
	}

	// Generated regardless of status/mode — a pending joiner still needs a
	// token to claim items once approved, and they never re-call Join, so
	// there's no later point to generate it at. It's only ever revealed to
	// the client once approved (see RevealJoinerTokenIfPending).
	token, err := randomToken()
	if err != nil {
		return nil, err
	}

	personID := existingPersonID
	if personID == nil {
		personID = newPersonID
	}

	ts := now()
	tx, err := s.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	if newPersonID != nil {
		if _, err := tx.Exec(`INSERT INTO people (id, session_id, name) VALUES (?, ?, ?)`, *newPersonID, sessionID, name); err != nil {
			return nil, err
		}
	}

	// A rejoin by a person who is already approved must not be demoted back
	// to pending — otherwise every rejoin (lost token, new device, cleared
	// storage) in approval_code mode would silently revoke an
	// already-granted identity's access and force re-approval by the
	// creator. The token is still rotated below and handed back to this
	// caller directly, so the rejoining client ends up with a working token.
	if personID != nil {
		var existingStatus models.JoinerStatus
		err := tx.QueryRow(`SELECT status FROM joiners WHERE session_id = ? AND person_id = ?`, sessionID, *personID).Scan(&existingStatus)
		if err != nil && err != sql.ErrNoRows {
			return nil, err
		}
		if err == nil && existingStatus == models.JoinerApproved {
			status = models.JoinerApproved
			approvalCode = ""
		}
	}

	tokenRevealed := status == models.JoinerApproved
	// Upsert on (session_id, person_id): a rejoin by a known person (e.g.
	// after being disapproved, or re-requesting after their prior request
	// went stale) replaces their earlier row instead of adding a second one
	// that would double them up in the creator's approval list. Joiners
	// without a resolvable person_id never collide since newPersonID is
	// freshly generated per join.
	if _, err := tx.Exec(
		`INSERT INTO joiners (id, session_id, name, person_id, status, approval_code, created_at, joiner_token, token_revealed)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT(session_id, person_id) WHERE person_id IS NOT NULL DO UPDATE SET
		   id = excluded.id,
		   name = excluded.name,
		   status = excluded.status,
		   approval_code = excluded.approval_code,
		   created_at = excluded.created_at,
		   joiner_token = excluded.joiner_token,
		   token_revealed = excluded.token_revealed`,
		id, sessionID, name, personID, status, approvalCode, ts, token, tokenRevealed,
	); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}
	if err := s.touchSession(sessionID); err != nil {
		return nil, err
	}

	joiner := &models.Joiner{ID: id, SessionID: sessionID, Name: name, PersonID: personID, Status: status, ApprovalCode: approvalCode, CreatedAt: ts, TokenRevealed: tokenRevealed}
	// Only surfaced to the immediate caller when already approved
	// (open_link mode) — the API layer decides whether to put this on the
	// wire; approval_code-mode joiners get it later via GetJoiner's
	// one-time reveal, once a creator approves them.
	if tokenRevealed {
		joiner.JoinerToken = token
	}
	return joiner, nil
}

// SetJoinerStatus approves or disapproves a pending joiner (creator-only).
func (s *Store) SetJoinerStatus(sessionID, joinerID string, status models.JoinerStatus) error {
	res, err := s.db.Exec(`UPDATE joiners SET status = ? WHERE id = ? AND session_id = ?`, status, joinerID, sessionID)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return s.touchSession(sessionID)
}

// GetJoiner looks up a single joiner by id, so a joiner who is still
// pending can poll their own admission status (approval requires the
// creator's token, but checking your own status doesn't).
func (s *Store) GetJoiner(sessionID, joinerID string) (*models.Joiner, error) {
	var j models.Joiner
	var personID sql.NullString
	err := s.db.QueryRow(
		`SELECT id, name, person_id, status, approval_code, created_at, token_revealed FROM joiners WHERE id = ? AND session_id = ?`,
		joinerID, sessionID,
	).Scan(&j.ID, &j.Name, &personID, &j.Status, &j.ApprovalCode, &j.CreatedAt, &j.TokenRevealed)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if personID.Valid {
		j.PersonID = &personID.String
	}
	return &j, nil
}

// RevealJoinerTokenIfPending returns this joiner's secret token exactly
// once: if the joiner is approved and its token hasn't been revealed yet,
// it atomically flips token_revealed and returns the token; every call
// after that (or before approval) returns "". This lets a joiner's existing
// GetJoiner poll loop pick up its token the first time it observes
// status=approved, without a dedicated push mechanism.
func (s *Store) RevealJoinerTokenIfPending(sessionID, joinerID string) (string, error) {
	var token string
	err := s.db.QueryRow(
		`SELECT joiner_token FROM joiners WHERE id = ? AND session_id = ? AND status = 'approved' AND token_revealed = 0`,
		joinerID, sessionID,
	).Scan(&token)
	if errors.Is(err, sql.ErrNoRows) {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	if _, err := s.db.Exec(`UPDATE joiners SET token_revealed = 1 WHERE id = ?`, joinerID); err != nil {
		return "", err
	}
	return token, nil
}

// VerifyJoinerToken checks whether token authenticates the caller as the
// joiner who owns personID in this session. Returns false (no error) for a
// personID with no owning joiner row — notably, the session creator's own
// seeded people are never owned by a joiner, so this correctly refuses to
// "authenticate" them; the creator's own live-editing calls are expected to
// omit a token entirely rather than attempt this check (see requireJoiner).
func (s *Store) VerifyJoinerToken(sessionID, personID, token string) (bool, error) {
	if token == "" {
		return false, nil
	}
	var stored string
	err := s.db.QueryRow(
		`SELECT joiner_token FROM joiners WHERE session_id = ? AND person_id = ?`,
		sessionID, personID,
	).Scan(&stored)
	if errors.Is(err, sql.ErrNoRows) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	return stored != "" && stored == token, nil
}

func (s *Store) ListJoiners(sessionID string) ([]models.Joiner, error) {
	rows, err := s.db.Query(
		`SELECT id, name, person_id, status, approval_code, created_at FROM joiners WHERE session_id = ?`, sessionID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	joiners := []models.Joiner{}
	for rows.Next() {
		var j models.Joiner
		var personID sql.NullString
		if err := rows.Scan(&j.ID, &j.Name, &personID, &j.Status, &j.ApprovalCode, &j.CreatedAt); err != nil {
			return nil, err
		}
		if personID.Valid {
			j.PersonID = &personID.String
		}
		joiners = append(joiners, j)
	}
	return joiners, rows.Err()
}

// SettleSession marks a session settled, starting the 48h purge clock.
func (s *Store) SettleSession(sessionID string) error {
	ts := now()
	res, err := s.db.Exec(`UPDATE sessions SET is_settled = 1, settled_at = ?, updated_at = ? WHERE id = ?`, ts, ts, sessionID)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}

func (s *Store) touchSession(sessionID string) error {
	ts := now()
	_, err := s.db.Exec(`UPDATE sessions SET updated_at = ?, last_access_at = ? WHERE id = ?`, ts, ts, sessionID)
	return err
}

// PurgeStaleSessions deletes settled sessions past their 48h grace period
// and unsettled-but-idle sessions past 48h since last access. Returns the
// ids of purged sessions and their associated image file paths (so the
// caller can remove image files *before* the cascading SQL delete — see
// planv3.md 3.8).
func (s *Store) PurgeStaleSessions() (purgedSessionIDs []string, imagePaths []string, err error) {
	rows, err := s.db.Query(
		`SELECT id FROM sessions
		 WHERE (is_settled = 1 AND settled_at <= datetime('now', '-48 hours'))
		    OR (is_settled = 0 AND last_access_at <= datetime('now', '-48 hours'))`,
	)
	if err != nil {
		return nil, nil, err
	}
	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			rows.Close()
			return nil, nil, err
		}
		ids = append(ids, id)
	}
	rows.Close()
	if err := rows.Err(); err != nil {
		return nil, nil, err
	}

	if len(ids) == 0 {
		return nil, nil, nil
	}

	for _, id := range ids {
		paths, err := s.imagePathsForSession(id)
		if err != nil {
			return nil, nil, err
		}
		imagePaths = append(imagePaths, paths...)
	}

	for _, id := range ids {
		if _, err := s.db.Exec(`DELETE FROM sessions WHERE id = ?`, id); err != nil {
			return nil, nil, err
		}
	}

	return ids, imagePaths, nil
}

func (s *Store) imagePathsForSession(sessionID string) ([]string, error) {
	rows, err := s.db.Query(
		`SELECT file_path FROM images WHERE bill_id IN (SELECT id FROM bills WHERE session_id = ?)`, sessionID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var paths []string
	for rows.Next() {
		var p string
		if err := rows.Scan(&p); err != nil {
			return nil, err
		}
		paths = append(paths, p)
	}
	return paths, rows.Err()
}

// ListAllSessionsForAdmin returns every session's summary fields for the
// admin panel's session list.
func (s *Store) ListAllSessionsForAdmin() ([]models.Session, error) {
	rows, err := s.db.Query(
		`SELECT id, title, is_settled, settled_at, created_at, updated_at, last_access_at FROM sessions ORDER BY last_access_at DESC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	sessions := []models.Session{}
	for rows.Next() {
		var sess models.Session
		var settledAt sql.NullString
		if err := rows.Scan(&sess.ID, &sess.Title, &sess.IsSettled, &settledAt, &sess.CreatedAt, &sess.UpdatedAt, &sess.LastAccessAt); err != nil {
			return nil, err
		}
		if settledAt.Valid {
			sess.SettledAt = &settledAt.String
		}
		sessions = append(sessions, sess)
	}
	return sessions, rows.Err()
}

// AdminStats holds the aggregate numbers shown on the admin stats page.
type AdminStats struct {
	SessionCount       int
	BillCount          int
	AvgBillsPerSession float64
	ImageCount         int
}

func (s *Store) AdminStats() (AdminStats, error) {
	var stats AdminStats
	if err := s.db.QueryRow(`SELECT COUNT(*) FROM sessions`).Scan(&stats.SessionCount); err != nil {
		return stats, err
	}
	if err := s.db.QueryRow(`SELECT COUNT(*) FROM bills`).Scan(&stats.BillCount); err != nil {
		return stats, err
	}
	if err := s.db.QueryRow(`SELECT COUNT(*) FROM images`).Scan(&stats.ImageCount); err != nil {
		return stats, err
	}
	if stats.SessionCount > 0 {
		stats.AvgBillsPerSession = float64(stats.BillCount) / float64(stats.SessionCount)
	}
	return stats, nil
}

// SaveImageMeta records a stored receipt image's metadata.
func (s *Store) SaveImageMeta(sessionID string, meta models.ImageMeta) error {
	_, err := s.db.Exec(
		`INSERT INTO images (ref_key, bill_id, file_path, width, height) VALUES (?, ?, ?, ?, ?)`,
		meta.RefKey, meta.BillID, meta.FilePath, meta.Width, meta.Height,
	)
	if err != nil {
		return err
	}
	return s.touchSession(sessionID)
}

// ImageFilePath resolves a refKey to its on-disk path.
func (s *Store) ImageFilePath(refKey string) (string, error) {
	var path string
	err := s.db.QueryRow(`SELECT file_path FROM images WHERE ref_key = ?`, refKey).Scan(&path)
	if errors.Is(err, sql.ErrNoRows) {
		return "", ErrNotFound
	}
	return path, err
}

// PurgeSessionByID is used by the admin panel's per-row purge button.
func (s *Store) PurgeSessionByID(sessionID string) ([]string, error) {
	paths, err := s.imagePathsForSession(sessionID)
	if err != nil {
		return nil, err
	}
	if _, err := s.db.Exec(`DELETE FROM sessions WHERE id = ?`, sessionID); err != nil {
		return nil, err
	}
	return paths, nil
}

// ScanUsage is the aggregate token/request usage shape shared by the daily
// and monthly lookups (and by /api/scan/usage's response body).
type ScanUsage struct {
	RequestCount     int `json:"request_count"`
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

// RecordScanRequest logs one receipt-scan request (success or failure) and
// atomically upserts its day/month aggregates. Unlike the bill-processor
// Worker's KV read-modify-write (a race under concurrent requests), the
// aggregate updates here are single ON CONFLICT statements.
func (s *Store) RecordScanRequest(model string, success bool, promptTokens, completionTokens, totalTokens int) error {
	ts := time.Now().UTC()
	day := ts.Format("2006-01-02")
	month := ts.Format("2006-01")

	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	successInt := 0
	if success {
		successInt = 1
	}
	if _, err := tx.Exec(
		`INSERT INTO scan_requests (requested_at, model, success, prompt_tokens, completion_tokens, total_tokens)
		 VALUES (?, ?, ?, ?, ?, ?)`,
		now(), model, successInt, promptTokens, completionTokens, totalTokens,
	); err != nil {
		return fmt.Errorf("insert scan_requests: %w", err)
	}

	if _, err := tx.Exec(
		`INSERT INTO scan_usage_daily (day, request_count, prompt_tokens, completion_tokens, total_tokens)
		 VALUES (?, 1, ?, ?, ?)
		 ON CONFLICT(day) DO UPDATE SET
		   request_count = request_count + 1,
		   prompt_tokens = prompt_tokens + excluded.prompt_tokens,
		   completion_tokens = completion_tokens + excluded.completion_tokens,
		   total_tokens = total_tokens + excluded.total_tokens`,
		day, promptTokens, completionTokens, totalTokens,
	); err != nil {
		return fmt.Errorf("upsert scan_usage_daily: %w", err)
	}

	if _, err := tx.Exec(
		`INSERT INTO scan_usage_monthly (month, request_count, prompt_tokens, completion_tokens, total_tokens)
		 VALUES (?, 1, ?, ?, ?)
		 ON CONFLICT(month) DO UPDATE SET
		   request_count = request_count + 1,
		   prompt_tokens = prompt_tokens + excluded.prompt_tokens,
		   completion_tokens = completion_tokens + excluded.completion_tokens,
		   total_tokens = total_tokens + excluded.total_tokens`,
		month, promptTokens, completionTokens, totalTokens,
	); err != nil {
		return fmt.Errorf("upsert scan_usage_monthly: %w", err)
	}

	return tx.Commit()
}

// ScanUsageDaily returns the aggregate for a single day (YYYY-MM-DD), or a
// zero-value ScanUsage if no requests were recorded that day.
func (s *Store) ScanUsageDaily(day string) (ScanUsage, error) {
	var u ScanUsage
	err := s.db.QueryRow(
		`SELECT request_count, prompt_tokens, completion_tokens, total_tokens FROM scan_usage_daily WHERE day = ?`, day,
	).Scan(&u.RequestCount, &u.PromptTokens, &u.CompletionTokens, &u.TotalTokens)
	if errors.Is(err, sql.ErrNoRows) {
		return ScanUsage{}, nil
	}
	return u, err
}

// ScanUsageMonthly returns the aggregate for a single month (YYYY-MM), or a
// zero-value ScanUsage if no requests were recorded that month.
func (s *Store) ScanUsageMonthly(month string) (ScanUsage, error) {
	var u ScanUsage
	err := s.db.QueryRow(
		`SELECT request_count, prompt_tokens, completion_tokens, total_tokens FROM scan_usage_monthly WHERE month = ?`, month,
	).Scan(&u.RequestCount, &u.PromptTokens, &u.CompletionTokens, &u.TotalTokens)
	if errors.Is(err, sql.ErrNoRows) {
		return ScanUsage{}, nil
	}
	return u, err
}

// ScanRequestLogEntry is one row shown in the admin bill-processor page's
// recent-requests table.
type ScanRequestLogEntry struct {
	RequestedAt      string
	Model            string
	Success          bool
	PromptTokens     int
	CompletionTokens int
	TotalTokens      int
}

// ScanAnalyticsSummary holds everything the admin bill-processor page shows:
// last-30-day totals, a lifetime success/failure count, and the most recent
// requests.
type ScanAnalyticsSummary struct {
	Last30Days     ScanUsage
	SuccessCount   int
	FailureCount   int
	RecentRequests []ScanRequestLogEntry
}

func (s *Store) ScanAnalyticsSummary() (ScanAnalyticsSummary, error) {
	var summary ScanAnalyticsSummary

	since := time.Now().UTC().AddDate(0, 0, -30).Format("2006-01-02 15:04:05")
	err := s.db.QueryRow(
		`SELECT COUNT(*), COALESCE(SUM(prompt_tokens),0), COALESCE(SUM(completion_tokens),0), COALESCE(SUM(total_tokens),0)
		 FROM scan_requests WHERE requested_at >= ?`, since,
	).Scan(&summary.Last30Days.RequestCount, &summary.Last30Days.PromptTokens, &summary.Last30Days.CompletionTokens, &summary.Last30Days.TotalTokens)
	if err != nil {
		return summary, err
	}

	if err := s.db.QueryRow(`SELECT COUNT(*) FROM scan_requests WHERE success = 1`).Scan(&summary.SuccessCount); err != nil {
		return summary, err
	}
	if err := s.db.QueryRow(`SELECT COUNT(*) FROM scan_requests WHERE success = 0`).Scan(&summary.FailureCount); err != nil {
		return summary, err
	}

	rows, err := s.db.Query(
		`SELECT requested_at, model, success, prompt_tokens, completion_tokens, total_tokens
		 FROM scan_requests ORDER BY id DESC LIMIT 25`,
	)
	if err != nil {
		return summary, err
	}
	defer rows.Close()

	entries := []ScanRequestLogEntry{}
	for rows.Next() {
		var e ScanRequestLogEntry
		var successInt int
		if err := rows.Scan(&e.RequestedAt, &e.Model, &successInt, &e.PromptTokens, &e.CompletionTokens, &e.TotalTokens); err != nil {
			return summary, err
		}
		e.Success = successInt == 1
		entries = append(entries, e)
	}
	if err := rows.Err(); err != nil {
		return summary, err
	}
	summary.RecentRequests = entries

	return summary, nil
}
