import { formatRelativeTime } from './formatRelativeTime';

describe('formatRelativeTime', () => {
  const now = new Date('2026-01-01T12:00:00Z');

  test('a few seconds ago reads "just now"', () => {
    expect(formatRelativeTime('2026-01-01 11:59:58', now)).toBe('just now');
  });

  test('under a minute reads "Ns ago"', () => {
    expect(formatRelativeTime('2026-01-01 11:59:30', now)).toBe('30s ago');
  });

  test('under an hour reads "Nm ago"', () => {
    expect(formatRelativeTime('2026-01-01 11:45:00', now)).toBe('15m ago');
  });

  test('under a day reads "Nh ago"', () => {
    expect(formatRelativeTime('2026-01-01 09:00:00', now)).toBe('3h ago');
  });

  test('under a week reads "Nd ago"', () => {
    expect(formatRelativeTime('2025-12-30 12:00:00', now)).toBe('2d ago');
  });

  test('older than a week falls back to a short date', () => {
    expect(formatRelativeTime('2025-12-01 12:00:00', now)).toBe('Dec 1');
  });

  test('unparseable input is returned unchanged', () => {
    expect(formatRelativeTime('not-a-date', now)).toBe('not-a-date');
  });
});
