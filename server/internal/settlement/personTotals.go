package settlement

import "billsplitter/server/internal/models"

// PersonTotal mirrors src/lib/personTotals.ts's PersonTotal (item-level
// breakdown omitted here — the Go side only ever needs the aggregate
// subtotal/tax/total per person for settlement purposes).
type PersonTotal struct {
	ID       string
	Subtotal float64
	Tax      float64
	Total    float64
}

func discountedItemPrice(item models.Item) float64 {
	if item.DiscountType == "percentage" {
		return item.Price - (item.Price*item.Discount)/100
	}
	return item.Price - item.Discount
}

// calculatePersonTotals is a Go port of src/lib/personTotals.ts's
// calculatePersonTotals — kept algorithmically identical (same doc comment
// applies: this is the single source of truth for the split math, mirrored
// by hand in both languages, with the same test fixtures exercising both).
func calculatePersonTotals(people []models.Person, items []models.Item, taxAmount float64) map[string]*PersonTotal {
	totals := make(map[string]*PersonTotal, len(people))
	for _, p := range people {
		totals[p.ID] = &PersonTotal{ID: p.ID}
	}

	for _, item := range items {
		if len(item.ConsumedBy) == 0 {
			continue
		}

		itemPrice := discountedItemPrice(item)
		totalItemPrice := itemPrice * float64(item.Quantity)

		shares := make(map[string]float64, len(item.ConsumedBy))

		switch item.SplitType {
		case "percentage":
			var totalPercentage float64
			for _, a := range item.ConsumedBy {
				totalPercentage += a.Value
			}
			for _, a := range item.ConsumedBy {
				if totalPercentage == 0 {
					continue
				}
				shares[a.PersonID] = totalItemPrice * (a.Value / totalPercentage)
			}
		case "fraction":
			var totalFraction float64
			for _, a := range item.ConsumedBy {
				totalFraction += a.Value
			}
			for _, a := range item.ConsumedBy {
				if totalFraction == 0 {
					continue
				}
				shares[a.PersonID] = totalItemPrice * (a.Value / totalFraction)
			}
		default: // "equal" and any unrecognized value falls back to equal, matching the TS port
			pricePerPerson := totalItemPrice / float64(len(item.ConsumedBy))
			for _, a := range item.ConsumedBy {
				shares[a.PersonID] = pricePerPerson
			}
		}

		for _, a := range item.ConsumedBy {
			pt, ok := totals[a.PersonID]
			share, hasShare := shares[a.PersonID]
			if !ok || !hasShare {
				continue
			}
			pt.Subtotal += share
		}
	}

	if taxAmount > 0 {
		var totalBeforeTax float64
		for _, pt := range totals {
			totalBeforeTax += pt.Subtotal
		}
		if totalBeforeTax > 0 {
			for _, pt := range totals {
				pt.Tax = (pt.Subtotal / totalBeforeTax) * taxAmount
				pt.Total = pt.Subtotal + pt.Tax
			}
		}
	} else {
		for _, pt := range totals {
			pt.Total = pt.Subtotal
		}
	}

	return totals
}
