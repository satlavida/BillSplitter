import { CurrencyStateSchema } from './currency.schema';

describe('CurrencyStateSchema', () => {
  test('parses a well-formed currency blob', () => {
    expect(CurrencyStateSchema.parse({ currency: 'INR' })).toEqual({ currency: 'INR' });
  });

  test('defaults to USD when currency is missing', () => {
    expect(CurrencyStateSchema.parse({})).toEqual({ currency: 'USD' });
  });

  test('rejects a non-string currency value', () => {
    expect(CurrencyStateSchema.safeParse({ currency: 123 }).success).toBe(false);
  });
});
