import { scannedTitle, isUnsetTitle, DEFAULT_BILL_TITLE } from './receiptTitle';

describe('scannedTitle', () => {
  test('combines restaurant name and date when both are present', () => {
    expect(scannedTitle({ restaurant_name: 'Pizza Hut', date: '2025-03-20' })).toBe('Pizza Hut - 2025-03-20');
  });

  test('uses just the restaurant name when there is no date', () => {
    expect(scannedTitle({ restaurant_name: 'Cafe Luna' })).toBe('Cafe Luna');
  });

  test('returns undefined when there is no restaurant name', () => {
    expect(scannedTitle({ date: '2025-03-20' })).toBeUndefined();
    expect(scannedTitle({})).toBeUndefined();
  });
});

describe('isUnsetTitle', () => {
  test('treats an empty/undefined title as unset', () => {
    expect(isUnsetTitle('')).toBe(true);
    expect(isUnsetTitle(undefined)).toBe(true);
  });

  test('treats the default bill title as unset', () => {
    expect(isUnsetTitle(DEFAULT_BILL_TITLE)).toBe(true);
  });

  test('treats any other title as already set', () => {
    expect(isUnsetTitle('My Custom Title')).toBe(false);
  });
});
