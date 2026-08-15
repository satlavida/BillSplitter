// Package store is the repository layer over SQLite: hand-written SQL
// (no ORM — the schema is small, 8 tables, and this keeps it transparent),
// shared by the API handlers and the cleanup job.
package store

import (
	"crypto/rand"
	"database/sql"
	"errors"
	"fmt"
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
// Returns the new session (with its generated code and creator token).
func (s *Store) CreateSession(title string, people []models.Person, joinMode models.JoinMode, claimMode models.ClaimMode) (*models.Session, error) {
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

	_, err = tx.Exec(
		`INSERT INTO sessions (id, title, creator_token, join_mode, claim_mode, is_settled, created_at, updated_at, last_access_at)
		 VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)`,
		code, title, token, joinMode, claimMode, ts, ts, ts,
	)
	if err != nil {
		return nil, fmt.Errorf("insert session: %w", err)
	}

	for _, p := range people {
		if _, err := tx.Exec(`INSERT INTO people (id, session_id, name) VALUES (?, ?, ?)`, p.ID, code, p.Name); err != nil {
			return nil, fmt.Errorf("insert person: %w", err)
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return s.GetSession(code)
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
	var settledAt sql.NullString
	err := s.db.QueryRow(
		`SELECT id, title, creator_token, join_mode, claim_mode, is_settled, settled_at, created_at, updated_at, last_access_at
		 FROM sessions WHERE id = ?`, code,
	).Scan(&sess.ID, &sess.Title, &sess.CreatorToken, &sess.JoinMode, &sess.ClaimMode, &sess.IsSettled, &settledAt, &sess.CreatedAt, &sess.UpdatedAt, &sess.LastAccessAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if settledAt.Valid {
		sess.SettledAt = &settledAt.String
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

func (s *Store) listBills(sessionID string) ([]models.Bill, error) {
	rows, err := s.db.Query(
		`SELECT id, title, date, tax_amount, currency, paid_by_person_id FROM bills WHERE session_id = ?`, sessionID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	bills := []models.Bill{}
	var ids []string
	for rows.Next() {
		var b models.Bill
		var paidBy sql.NullString
		if err := rows.Scan(&b.ID, &b.Title, &b.Date, &b.TaxAmount, &b.Currency, &paidBy); err != nil {
			return nil, err
		}
		if paidBy.Valid {
			b.PaidByPersonID = &paidBy.String
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
// only by the claim endpoints (ClaimItemFreeSelect/CreatePendingClaim/
// ApproveClaim), so a stale local edit can never clobber a joiner's claim.
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

// UnclaimItem removes a person's allocation from an item (free_select mode).
func (s *Store) UnclaimItem(sessionID, itemID, personID string) error {
	_, err := s.db.Exec(`DELETE FROM item_allocations WHERE item_id = ? AND person_id = ?`, itemID, personID)
	if err != nil {
		return err
	}
	return s.touchSession(sessionID)
}

// CreatePendingClaim writes a pending item_claims row (claims_require_approval mode).
func (s *Store) CreatePendingClaim(sessionID string, claim models.ItemClaim) error {
	_, err := s.db.Exec(
		`INSERT INTO item_claims (id, item_id, person_id, value, status) VALUES (?, ?, ?, ?, 'pending')`,
		claim.ID, claim.ItemID, claim.PersonID, claim.Value,
	)
	if err != nil {
		return err
	}
	return s.touchSession(sessionID)
}

// ApproveClaim marks a pending claim approved and copies it into item_allocations.
func (s *Store) ApproveClaim(sessionID, claimID string) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var itemID, personID string
	var value float64
	err = tx.QueryRow(`SELECT item_id, person_id, value FROM item_claims WHERE id = ? AND status = 'pending'`, claimID).
		Scan(&itemID, &personID, &value)
	if errors.Is(err, sql.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}

	if _, err := tx.Exec(`UPDATE item_claims SET status = 'approved' WHERE id = ?`, claimID); err != nil {
		return err
	}
	if _, err := tx.Exec(
		`INSERT INTO item_allocations (item_id, person_id, value) VALUES (?, ?, ?)
		 ON CONFLICT (item_id, person_id) DO UPDATE SET value = excluded.value`,
		itemID, personID, value,
	); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return err
	}
	return s.touchSession(sessionID)
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

	if _, err := tx.Exec(
		`INSERT INTO joiners (id, session_id, name, person_id, status, approval_code, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
		id, sessionID, name, personID, status, approvalCode, ts,
	); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}
	if err := s.touchSession(sessionID); err != nil {
		return nil, err
	}

	return &models.Joiner{ID: id, SessionID: sessionID, Name: name, PersonID: personID, Status: status, ApprovalCode: approvalCode, CreatedAt: ts}, nil
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
		`SELECT id, name, person_id, status, approval_code, created_at FROM joiners WHERE id = ? AND session_id = ?`,
		joinerID, sessionID,
	).Scan(&j.ID, &j.Name, &personID, &j.Status, &j.ApprovalCode, &j.CreatedAt)
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
