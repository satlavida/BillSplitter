import { markBillVisited, hasBillBeenVisited } from './joinerVisitTracking';

describe('joinerVisitTracking', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('reports a bill as unvisited until marked', () => {
    expect(hasBillBeenVisited('ABC123', 'bill1')).toBe(false);
    markBillVisited('ABC123', 'bill1');
    expect(hasBillBeenVisited('ABC123', 'bill1')).toBe(true);
  });

  it('scopes visited state per session code, not just per bill id', () => {
    markBillVisited('ABC123', 'bill1');
    expect(hasBillBeenVisited('XYZ789', 'bill1')).toBe(false);
  });

  it('does not throw when localStorage access fails', () => {
    const original = window.localStorage.setItem;
    Object.defineProperty(window, 'localStorage', {
      value: {
        ...localStorage,
        setItem: () => {
          throw new Error('storage disabled');
        },
        getItem: () => {
          throw new Error('storage disabled');
        },
      },
      configurable: true,
    });

    expect(() => markBillVisited('ABC123', 'bill1')).not.toThrow();
    expect(hasBillBeenVisited('ABC123', 'bill1')).toBe(false);

    Object.defineProperty(window, 'localStorage', { value: { ...localStorage, setItem: original }, configurable: true });
  });
});
