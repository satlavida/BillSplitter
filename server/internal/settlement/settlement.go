// Package settlement is a Go port of src/lib/settlement.ts's net-balance +
// greedy-debt-simplification algorithm. It is hand-mirrored, not shared via
// any TS/Go bridge — the frontend's settlement.ts doc comment is the single
// source of truth for the algorithm's spec (see planv3.md section 2.4), and
// the same test fixtures are mirrored in settlement.test.ts and
// settlement_test.go so the two implementations can't silently drift.
package settlement

import (
	"math"
	"sort"

	"billsplitter/server/internal/models"
)

const epsilon = 1e-6

func round2(n float64) float64 {
	return math.Round(n*100) / 100
}

type Balance struct {
	PersonID string  `json:"personId"`
	Amount   float64 `json:"amount"`
}

type Transaction struct {
	From   string  `json:"from"`
	To     string  `json:"to"`
	Amount float64 `json:"amount"`
}

type Result struct {
	Balances     []Balance     `json:"balances"`
	Transactions []Transaction `json:"transactions"`
}

// CalculateBalances computes each person's net balance across every bill in
// a session, converted into sessionCurrency. For each bill, the payer is
// owed everyone else's share; a bill with no payer (PaidByPersonID == nil)
// contributes nothing to any balance. A bill whose own currency differs from
// sessionCurrency has its contribution multiplied by its effective rate
// (bill.ExchangeRate — set by a fetch or a user override, see
// architecture/currency.md) before being added to any balance; a mismatched
// bill with no rate yet falls back to 1.0 rather than erroring (shouldn't
// normally happen once the Bill Settings flow enforces setting a rate, but
// this must stay defensive since settlement can't fail outright over it).
// Invariant: sum(balances) is always 0, verified in settlement_test.go.
func CalculateBalances(bills []models.Bill, people []models.Person, sessionCurrency string) []Balance {
	balances := make(map[string]float64, len(people))
	order := make([]string, 0, len(people))
	for _, p := range people {
		balances[p.ID] = 0
		order = append(order, p.ID)
	}

	for _, bill := range bills {
		if bill.PaidByPersonID == nil {
			continue
		}
		payerID := *bill.PaidByPersonID

		effectiveRate := 1.0
		if bill.Currency != sessionCurrency && bill.ExchangeRate != nil {
			effectiveRate = *bill.ExchangeRate
		}

		personTotals := calculatePersonTotals(people, bill.Items, bill.TaxAmount)
		var billTotal float64
		for _, pt := range personTotals {
			billTotal += pt.Total
		}

		for personID, pt := range personTotals {
			if _, ok := balances[personID]; !ok {
				continue
			}
			if personID == payerID {
				balances[personID] += (billTotal - pt.Total) * effectiveRate
			} else {
				balances[personID] -= pt.Total * effectiveRate
			}
		}
	}

	out := make([]Balance, 0, len(order))
	for _, id := range order {
		out = append(out, Balance{PersonID: id, Amount: balances[id]})
	}
	return out
}

// SimplifyDebts greedily matches the largest creditor against the largest
// debtor, settling the smaller of the two amounts, repeated to zero. Not
// guaranteed minimal transaction count (NP-hard in general) — same
// practical trade-off as the TS port.
func SimplifyDebts(balances []Balance) []Transaction {
	type mutBalance struct {
		personID string
		amount   float64
	}

	var creditors, debtors []mutBalance
	for _, b := range balances {
		if b.Amount > epsilon {
			creditors = append(creditors, mutBalance{b.PersonID, b.Amount})
		} else if b.Amount < -epsilon {
			debtors = append(debtors, mutBalance{b.PersonID, -b.Amount})
		}
	}

	sort.Slice(creditors, func(i, j int) bool { return creditors[i].amount > creditors[j].amount })
	sort.Slice(debtors, func(i, j int) bool { return debtors[i].amount > debtors[j].amount })

	var transactions []Transaction
	ci, di := 0, 0
	for ci < len(creditors) && di < len(debtors) {
		creditor := &creditors[ci]
		debtor := &debtors[di]
		settled := math.Min(creditor.amount, debtor.amount)

		if settled > epsilon {
			transactions = append(transactions, Transaction{
				From:   debtor.personID,
				To:     creditor.personID,
				Amount: round2(settled),
			})
		}

		creditor.amount -= settled
		debtor.amount -= settled

		if creditor.amount <= epsilon {
			ci++
		}
		if debtor.amount <= epsilon {
			di++
		}
	}

	if transactions == nil {
		transactions = []Transaction{}
	}
	return transactions
}

// CalculateSettlement combines CalculateBalances and SimplifyDebts into the
// full server-computed settlement for a session, in sessionCurrency.
func CalculateSettlement(bills []models.Bill, people []models.Person, sessionCurrency string) Result {
	balances := CalculateBalances(bills, people, sessionCurrency)
	transactions := SimplifyDebts(balances)
	return Result{Balances: balances, Transactions: transactions}
}
