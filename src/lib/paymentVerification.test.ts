import { computeInitialVerified } from './paymentVerification';

describe('computeInitialVerified', () => {
  test('a local (non-live) session always auto-verifies, regardless of who added it or the toggle', () => {
    expect(computeInitialVerified(false, true, 'payer', 'payee')).toBe(true);
    expect(computeInitialVerified(false, false, 'payer', 'payee')).toBe(true);
    expect(computeInitialVerified(false, true, 'payee', 'payee')).toBe(true);
  });

  test('live + verification required + payer-added stays unverified', () => {
    expect(computeInitialVerified(true, true, 'payer', 'payee')).toBe(false);
  });

  test('live + verification required + payee-added auto-verifies', () => {
    expect(computeInitialVerified(true, true, 'payee', 'payee')).toBe(true);
  });

  test('live + verification turned off auto-verifies regardless of who added it', () => {
    expect(computeInitialVerified(true, false, 'payer', 'payee')).toBe(true);
    expect(computeInitialVerified(true, false, 'payee', 'payee')).toBe(true);
  });
});
