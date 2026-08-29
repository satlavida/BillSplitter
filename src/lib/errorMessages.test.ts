import { friendlyErrorMessage } from './errorMessages';

describe('friendlyErrorMessage', () => {
  it('maps a known raw server message to its friendly copy', () => {
    expect(friendlyErrorMessage('session not found')).toBe("We couldn't find that session — double-check the code and try again.");
  });

  it('is case/whitespace insensitive for exact matches', () => {
    expect(friendlyErrorMessage('  Session Not Found  ')).toBe("We couldn't find that session — double-check the code and try again.");
  });

  it('passes through the over-claim message verbatim, remaining count included', () => {
    expect(friendlyErrorMessage('Only 3 left to claim on this item')).toBe('Only 3 left to claim on this item');
    expect(friendlyErrorMessage('Only 0 left to claim on this item')).toBe('Only 0 left to claim on this item');
  });

  it('falls back to a generic message for anything unmapped', () => {
    expect(friendlyErrorMessage('failed to claim item')).toBe('Something went wrong. Please try again.');
  });
});
