// Decides whether a newly-logged payment starts verified. Mirrored on the
// Go side (server/internal/settlement/paymentverify.go) — keep both in sync,
// same discipline as settlement.ts/settlement.go (see architecture/settlement.md).
//
// A local (non-live) session has only one operator, so there's no second
// real party to withhold verification from — every payment there
// auto-verifies regardless of who "added" it. Once live, a payer-added
// payment stays unverified until the payee confirms it, unless the creator
// has turned "Require Payment Verification" off.
export function computeInitialVerified(
  isLive: boolean,
  requirePaymentVerification: boolean,
  addedByPersonId: string,
  payeeId: string
): boolean {
  if (!isLive) return true;
  if (!requirePaymentVerification) return true;
  return addedByPersonId === payeeId;
}
