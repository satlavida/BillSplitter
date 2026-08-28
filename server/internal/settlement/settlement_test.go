package settlement

import (
	"math"
	"testing"

	"billsplitter/server/internal/models"
)

func person(id, name string) models.Person {
	return models.Person{ID: id, Name: name}
}

// makeBill mirrors settlement.test.ts's makeBill helper: a single item split
// equally among the given consumer ids.
func makeBill(id string, price float64, consumerIDs []string, paidByPersonID *string) models.Bill {
	allocations := make([]models.Allocation, len(consumerIDs))
	for i, pid := range consumerIDs {
		allocations[i] = models.Allocation{PersonID: pid, Value: 1}
	}
	return models.Bill{
		ID:             id,
		Title:          "Bill " + id,
		Date:           "2026-01-01T00:00:00.000Z",
		Currency:       "INR",
		TaxAmount:      0,
		PaidByPersonID: paidByPersonID,
		Items: []models.Item{
			{
				ID:           id + "-item",
				Name:         "Item",
				Price:        price,
				Quantity:     1,
				Discount:     0,
				DiscountType: "flat",
				SplitType:    "equal",
				ConsumedBy:   allocations,
			},
		},
	}
}

func strPtr(s string) *string { return &s }

func closeTo(t *testing.T, got, want, tolerance float64) {
	t.Helper()
	if math.Abs(got-want) > tolerance {
		t.Fatalf("got %v, want %v (tolerance %v)", got, want, tolerance)
	}
}

func sumBalances(balances []Balance) float64 {
	var sum float64
	for _, b := range balances {
		sum += b.Amount
	}
	return sum
}

func balancesByID(balances []Balance) map[string]float64 {
	m := make(map[string]float64, len(balances))
	for _, b := range balances {
		m[b.PersonID] = b.Amount
	}
	return m
}

func TestCalculateBalances_SinglePayerSingleBill(t *testing.T) {
	people := []models.Person{person("alice", "Alice"), person("bob", "Bob"), person("carol", "Carol")}
	bills := []models.Bill{makeBill("b1", 90, []string{"alice", "bob", "carol"}, strPtr("alice"))}

	balances := CalculateBalances(bills, people, "INR")
	byID := balancesByID(balances)

	closeTo(t, byID["alice"], 60, 1e-9)
	closeTo(t, byID["bob"], -30, 1e-9)
	closeTo(t, byID["carol"], -30, 1e-9)
	closeTo(t, sumBalances(balances), 0, 1e-9)
}

func TestCalculateBalances_MultipleBillsSamePayer(t *testing.T) {
	people := []models.Person{person("alice", "Alice"), person("bob", "Bob")}
	bills := []models.Bill{
		makeBill("b1", 20, []string{"alice", "bob"}, strPtr("alice")),
		makeBill("b2", 40, []string{"alice", "bob"}, strPtr("alice")),
	}

	balances := CalculateBalances(bills, people, "INR")
	byID := balancesByID(balances)

	closeTo(t, byID["alice"], 30, 1e-9)
	closeTo(t, byID["bob"], -30, 1e-9)
	closeTo(t, sumBalances(balances), 0, 1e-9)
}

func TestCalculateBalances_MultipleBillsDifferentPayersOverlapping(t *testing.T) {
	people := []models.Person{person("alice", "Alice"), person("bob", "Bob"), person("carol", "Carol")}
	bills := []models.Bill{
		makeBill("b1", 90, []string{"alice", "bob", "carol"}, strPtr("alice")),
		makeBill("b2", 60, []string{"bob", "carol"}, strPtr("bob")),
	}

	balances := CalculateBalances(bills, people, "INR")
	byID := balancesByID(balances)

	closeTo(t, byID["alice"], 60, 1e-9)
	closeTo(t, byID["bob"], 0, 1e-9)
	closeTo(t, byID["carol"], -60, 1e-9)
	closeTo(t, sumBalances(balances), 0, 1e-9)
}

func TestCalculateBalances_PersonAbsentFromAllBills(t *testing.T) {
	people := []models.Person{person("alice", "Alice"), person("bob", "Bob"), person("dave", "Dave")}
	bills := []models.Bill{makeBill("b1", 50, []string{"alice", "bob"}, strPtr("alice"))}

	balances := CalculateBalances(bills, people, "INR")
	byID := balancesByID(balances)

	if byID["dave"] != 0 {
		t.Fatalf("expected dave's balance to be 0, got %v", byID["dave"])
	}
	closeTo(t, sumBalances(balances), 0, 1e-9)
}

func TestCalculateBalances_NullPayerContributesNothing(t *testing.T) {
	people := []models.Person{person("alice", "Alice"), person("bob", "Bob")}
	bills := []models.Bill{makeBill("b1", 100, []string{"alice", "bob"}, nil)}

	balances := CalculateBalances(bills, people, "INR")
	for _, b := range balances {
		if b.Amount != 0 {
			t.Fatalf("expected all balances to be 0 for a null-payer bill, got %v = %v", b.PersonID, b.Amount)
		}
	}
}

func TestCalculateBalances_ZeroSumInvariant(t *testing.T) {
	people := []models.Person{person("a", "a"), person("b", "b"), person("c", "c"), person("d", "d")}
	bills := []models.Bill{
		makeBill("b1", 37.5, []string{"a", "b", "c"}, strPtr("a")),
		makeBill("b2", 123.45, []string{"b", "c", "d"}, strPtr("c")),
		makeBill("b3", 10, []string{"a", "d"}, strPtr("d")),
		makeBill("b4", 99.99, []string{"a", "b", "c", "d"}, strPtr("b")),
	}

	balances := CalculateBalances(bills, people, "INR")
	closeTo(t, sumBalances(balances), 0, 1e-6)
}

func TestCalculateBalances_FractionalCentSplitsNetToZero(t *testing.T) {
	people := []models.Person{person("alice", "Alice"), person("bob", "Bob"), person("carol", "Carol")}
	bills := []models.Bill{makeBill("b1", 10, []string{"alice", "bob", "carol"}, strPtr("alice"))}

	balances := CalculateBalances(bills, people, "INR")
	closeTo(t, sumBalances(balances), 0, 1e-2)
}

func TestSimplifyDebts_AllZeroProducesNoTransactions(t *testing.T) {
	transactions := SimplifyDebts([]Balance{{PersonID: "a", Amount: 0}, {PersonID: "b", Amount: 0}})
	if len(transactions) != 0 {
		t.Fatalf("expected no transactions, got %v", transactions)
	}
}

func TestSimplifyDebts_SingleCreditorSingleDebtor(t *testing.T) {
	transactions := SimplifyDebts([]Balance{{PersonID: "a", Amount: 30}, {PersonID: "b", Amount: -30}})
	if len(transactions) != 1 {
		t.Fatalf("expected 1 transaction, got %d", len(transactions))
	}
	got := transactions[0]
	if got.From != "b" || got.To != "a" || got.Amount != 30 {
		t.Fatalf("unexpected transaction: %+v", got)
	}
}

func TestSimplifyDebts_MultipleCreditorsDebtorsNetToBalances(t *testing.T) {
	balances := []Balance{
		{PersonID: "a", Amount: 60},
		{PersonID: "b", Amount: 0},
		{PersonID: "c", Amount: -60},
	}
	transactions := SimplifyDebts(balances)

	net := map[string]float64{"a": 0, "b": 0, "c": 0}
	for _, tx := range transactions {
		net[tx.From] -= tx.Amount
		net[tx.To] += tx.Amount
	}
	closeTo(t, net["a"], 60, 1e-9)
	closeTo(t, net["b"], 0, 1e-9)
	closeTo(t, net["c"], -60, 1e-9)
}

func TestSimplifyDebts_IgnoresEpsilonBalances(t *testing.T) {
	transactions := SimplifyDebts([]Balance{{PersonID: "a", Amount: 0.0000001}, {PersonID: "b", Amount: -0.0000001}})
	if len(transactions) != 0 {
		t.Fatalf("expected no transactions, got %v", transactions)
	}
}

// makeBillWithCurrency is like makeBill but lets the caller set a currency
// different from the session's and an effective exchange rate, for the
// multi-currency conversion tests below.
func makeBillWithCurrency(id string, price float64, consumerIDs []string, paidByPersonID *string, currency string, exchangeRate *float64) models.Bill {
	bill := makeBill(id, price, consumerIDs, paidByPersonID)
	bill.Currency = currency
	bill.ExchangeRate = exchangeRate
	return bill
}

func TestCalculateBalances_ConvertsMismatchedBillCurrencyUsingExchangeRate(t *testing.T) {
	people := []models.Person{person("alice", "Alice"), person("bob", "Bob"), person("carol", "Carol")}
	rate := 80.0
	bills := []models.Bill{
		// Session currency INR; matches, no conversion.
		makeBill("b1", 90, []string{"alice", "bob", "carol"}, strPtr("alice")),
		// Bill in USD at 1 USD = 80 INR; converted before being summed.
		makeBillWithCurrency("b2", 100, []string{"bob", "carol"}, strPtr("bob"), "USD", &rate),
	}

	balances := CalculateBalances(bills, people, "INR")
	byID := balancesByID(balances)

	closeTo(t, byID["alice"], 60, 1e-9)
	closeTo(t, byID["bob"], -30+4000, 1e-9)
	closeTo(t, byID["carol"], -30-4000, 1e-9)
	closeTo(t, sumBalances(balances), 0, 1e-9)
}

func TestCalculateBalances_MismatchedCurrencyWithNoRateFallsBackToOne(t *testing.T) {
	people := []models.Person{person("alice", "Alice"), person("bob", "Bob")}
	bills := []models.Bill{
		makeBillWithCurrency("b1", 40, []string{"alice", "bob"}, strPtr("alice"), "USD", nil),
	}

	balances := CalculateBalances(bills, people, "INR")
	byID := balancesByID(balances)

	closeTo(t, byID["alice"], 20, 1e-9)
	closeTo(t, byID["bob"], -20, 1e-9)
	closeTo(t, sumBalances(balances), 0, 1e-9)
}

func TestCalculateSettlement_CombinesBalancesAndTransactions(t *testing.T) {
	people := []models.Person{person("alice", "Alice"), person("bob", "Bob"), person("carol", "Carol")}
	bills := []models.Bill{
		makeBill("b1", 90, []string{"alice", "bob", "carol"}, strPtr("alice")),
		makeBill("b2", 60, []string{"bob", "carol"}, strPtr("bob")),
	}

	result := CalculateSettlement(bills, people, "INR")

	closeTo(t, sumBalances(result.Balances), 0, 1e-9)
	for _, tx := range result.Transactions {
		if tx.Amount <= 0 {
			t.Fatalf("expected positive transaction amount, got %v", tx.Amount)
		}
		if tx.From == tx.To {
			t.Fatalf("expected from != to, got both %v", tx.From)
		}
	}
}
