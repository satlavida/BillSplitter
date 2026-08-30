package api

import (
	"billsplitter/server/internal/models"
	"billsplitter/server/internal/settlement"
)

// computeSettlement always uses sess.Payments in full (never the
// viewer-filtered slice returned to a joiner in GetSession's response —
// see filterPaymentsForViewer) since the aggregate balances/transactions
// this produces are already visible to every session participant; only the
// individual payment records themselves are privacy-restricted.
func computeSettlement(sess *models.Session) settlement.Result {
	return settlement.CalculateSettlement(sess.Bills, sess.People, sess.Currency, sess.Payments)
}
