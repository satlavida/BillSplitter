import { isNameEditLocked, NAME_EDIT_LOCK_DURATION_MS } from './presenceRules';

const NOW = 1_000_000_000;

describe('isNameEditLocked', () => {
  test('unclaimed (not linked) is never locked, regardless of presence', () => {
    expect(isNameEditLocked({ linked: false, online: true, activeSinceMs: NOW, now: NOW })).toBe(false);
  });

  test('claimed but not currently online is not locked', () => {
    expect(isNameEditLocked({ linked: true, online: false, activeSinceMs: null, now: NOW })).toBe(false);
  });

  test('claimed and online for less than an hour is locked', () => {
    const activeSinceMs = NOW - (NAME_EDIT_LOCK_DURATION_MS - 1000);
    expect(isNameEditLocked({ linked: true, online: true, activeSinceMs, now: NOW })).toBe(true);
  });

  test('claimed and online for more than an hour is not locked', () => {
    const activeSinceMs = NOW - (NAME_EDIT_LOCK_DURATION_MS + 1000);
    expect(isNameEditLocked({ linked: true, online: true, activeSinceMs, now: NOW })).toBe(false);
  });

  test('claimed and online with no activeSince data is not locked (defensive default)', () => {
    expect(isNameEditLocked({ linked: true, online: true, activeSinceMs: null, now: NOW })).toBe(false);
  });
});
