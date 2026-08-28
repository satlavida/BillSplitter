import { toSessionCurrency } from './currencyConvert';

describe('toSessionCurrency', () => {
  test('returns the amount unchanged when the bill currency matches the session currency', () => {
    expect(toSessionCurrency(100, { currency: 'USD', exchangeRate: 80 }, 'USD')).toBe(100);
  });

  test('multiplies by the exchange rate when currencies differ', () => {
    expect(toSessionCurrency(10, { currency: 'USD', exchangeRate: 80 }, 'INR')).toBe(800);
  });

  test('falls back to 1:1 when currencies differ and no rate is set', () => {
    expect(toSessionCurrency(10, { currency: 'USD', exchangeRate: null }, 'INR')).toBe(10);
  });
});
