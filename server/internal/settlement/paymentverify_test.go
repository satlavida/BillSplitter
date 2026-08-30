package settlement

import "testing"

// Mirrors src/lib/paymentVerification.test.ts's predicate matrix.
func TestComputeInitialVerified(t *testing.T) {
	cases := []struct {
		name                       string
		isLive                     bool
		requirePaymentVerification bool
		addedByPersonID            string
		payeeID                    string
		want                       bool
	}{
		{"non-live always verifies (payer-added)", false, true, "payer", "payee", true},
		{"non-live always verifies even with verification off", false, false, "payer", "payee", true},
		{"non-live always verifies (payee-added)", false, true, "payee", "payee", true},
		{"live + required + payer-added stays unverified", true, true, "payer", "payee", false},
		{"live + required + payee-added auto-verifies", true, true, "payee", "payee", true},
		{"live + not required auto-verifies (payer-added)", true, false, "payer", "payee", true},
		{"live + not required auto-verifies (payee-added)", true, false, "payee", "payee", true},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := ComputeInitialVerified(tc.isLive, tc.requirePaymentVerification, tc.addedByPersonID, tc.payeeID)
			if got != tc.want {
				t.Fatalf("got %v, want %v", got, tc.want)
			}
		})
	}
}
