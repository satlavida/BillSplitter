package api

import (
	"billsplitter/server/internal/models"
	"billsplitter/server/internal/settlement"
)

func computeSettlement(sess *models.Session) settlement.Result {
	return settlement.CalculateSettlement(sess.Bills, sess.People)
}
