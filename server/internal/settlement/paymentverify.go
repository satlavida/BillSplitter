package settlement

// ComputeInitialVerified decides whether a newly-logged payment starts
// verified. Mirrored on the frontend (src/lib/paymentVerification.ts) — keep
// both in sync, same discipline as CalculateBalances/settlement.ts.
//
// A local (non-live) session has only one operator, so there's no second
// real party to withhold verification from — every payment there
// auto-verifies regardless of who "added" it. The server only ever sees
// live sessions (isLive is implicitly true here), but this takes the same
// signature as the frontend for symmetry and so a future local-simulation
// test can call it identically. Once live, a payer-added payment stays
// unverified until the payee confirms it, unless the creator has turned
// "Require Payment Verification" off.
func ComputeInitialVerified(isLive, requirePaymentVerification bool, addedByPersonID, payeeID string) bool {
	if !isLive {
		return true
	}
	if !requirePaymentVerification {
		return true
	}
	return addedByPersonID == payeeID
}
