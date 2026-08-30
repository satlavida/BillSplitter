// Covers setSessionCurrency's exchange-rate invalidation: a bill's stored
// exchangeRate/exchangeRateDate/exchangeRateIsOverride are only ever
// meaningful relative to the session currency they were fetched/overridden
// against. Changing the session currency must clear those fields on every
// affected bill, not leave a rate computed for the *old* session currency
// silently applied against the new one (see architecture/currency.md and
// getEffectiveRate in lib/settlement.ts).
//
// liveApi.ts is dynamically imported (see sessionStore.ts's top-of-file
// comment) specifically so Jest never has to parse its import.meta.env
// reference — jest.mock intercepts that dynamic import with this mock
// instead, so the real file is never loaded.
const mockUpdateLiveSessionCurrency = jest.fn().mockResolvedValue({});
const mockUpdateLiveBill = jest.fn().mockResolvedValue({});
const mockAddLiveBill = jest.fn().mockResolvedValue({});
const mockAddLiveItem = jest.fn().mockResolvedValue({});
const mockUpdateLiveItem = jest.fn().mockResolvedValue({});
const mockGetLiveSession = jest.fn();
const mockUploadLiveImage = jest.fn().mockResolvedValue({});
const mockClaimItem = jest.fn().mockResolvedValue({ status: 'approved' });
const mockUnclaimItem = jest.fn().mockResolvedValue(undefined);

jest.mock('./lib/liveApi', () => ({
  updateLiveSessionCurrency: (...args: unknown[]) => mockUpdateLiveSessionCurrency(...args),
  updateLiveBill: (...args: unknown[]) => mockUpdateLiveBill(...args),
  addLiveBill: (...args: unknown[]) => mockAddLiveBill(...args),
  addLiveItem: (...args: unknown[]) => mockAddLiveItem(...args),
  updateLiveItem: (...args: unknown[]) => mockUpdateLiveItem(...args),
  getLiveSession: (...args: unknown[]) => mockGetLiveSession(...args),
  uploadLiveImage: (...args: unknown[]) => mockUploadLiveImage(...args),
  claimItem: (...args: unknown[]) => mockClaimItem(...args),
  unclaimItem: (...args: unknown[]) => mockUnclaimItem(...args),
}));

import useSessionStore from './sessionStore';

const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  useSessionStore.setState({ sessions: [], currentSessionId: null });
  jest.clearAllMocks();
  mockGetLiveSession.mockResolvedValue({
    id: 'ABCDE',
    title: 'Trip',
    createdAt: '',
    updatedAt: '',
    currency: 'INR',
    joinMode: 'open_link',
    claimMode: 'free_select',
    permissionMode: 'edit',
    creatorPersonId: null,
    isSettled: false,
    settledAt: null,
    requirePaymentVerification: true,
    people: [],
    bills: [],
    payments: [],
  });
});

describe('setSessionCurrency — offline session', () => {
  test('updates the session currency', () => {
    const session = useSessionStore.getState().createSession('Trip');
    useSessionStore.getState().setSessionCurrency(session.id, 'SGD');
    expect(useSessionStore.getState().getSession(session.id)?.currency).toBe('SGD');
  });

  test('clears a bill\'s stale exchange-rate fields on currency switch', () => {
    const session = useSessionStore.getState().createSession('Trip');
    const bill = useSessionStore.getState().addBill(session.id, {
      currency: 'USD',
      exchangeRate: 83.5,
      exchangeRateDate: '2026-08-01',
      exchangeRateIsOverride: true,
    })!;

    // session started at INR (newBillDefaults' default); switch INR -> SGD.
    useSessionStore.getState().setSessionCurrency(session.id, 'SGD');

    const updated = useSessionStore.getState().getBill(session.id, bill.id);
    expect(updated?.exchangeRate).toBeNull();
    expect(updated?.exchangeRateDate).toBeNull();
    expect(updated?.exchangeRateIsOverride).toBe(false);
    // The bill's own currency is untouched by a session currency change.
    expect(updated?.currency).toBe('USD');
  });

  test('leaves a bill with no exchange rate set untouched', () => {
    const session = useSessionStore.getState().createSession('Trip');
    const bill = useSessionStore.getState().addBill(session.id, { currency: 'USD' })!;

    useSessionStore.getState().setSessionCurrency(session.id, 'SGD');

    const updated = useSessionStore.getState().getBill(session.id, bill.id);
    expect(updated?.exchangeRate).toBeNull();
    expect(updated?.exchangeRateDate).toBeNull();
    expect(updated?.exchangeRateIsOverride).toBe(false);
  });

  test('clears a bill whose currency happens to equal the new session currency, if it had a stale rate', () => {
    // Edge case: a bill in SGD carrying a leftover rate from when it
    // differed from the session's *old* currency. Switching the session to
    // SGD makes bill.currency === sessionCurrency, so getEffectiveRate would
    // short-circuit to 1 regardless — but the stale fields should still be
    // cleared to match the "null/false unless currencies differ" invariant.
    const session = useSessionStore.getState().createSession('Trip');
    const bill = useSessionStore.getState().addBill(session.id, {
      currency: 'SGD',
      exchangeRate: 61.2,
      exchangeRateDate: '2026-08-01',
      exchangeRateIsOverride: false,
    })!;

    useSessionStore.getState().setSessionCurrency(session.id, 'SGD');

    const updated = useSessionStore.getState().getBill(session.id, bill.id);
    expect(updated?.exchangeRate).toBeNull();
    expect(updated?.exchangeRateDate).toBeNull();
  });

  test('only resets the bills that actually had a stale rate, across multiple bills', () => {
    const session = useSessionStore.getState().createSession('Trip');
    const staleBill = useSessionStore.getState().addBill(session.id, {
      title: 'Hotel',
      currency: 'USD',
      exchangeRate: 83.5,
      exchangeRateDate: '2026-08-01',
      exchangeRateIsOverride: true,
    })!;
    const cleanBill = useSessionStore.getState().addBill(session.id, { title: 'Coffee', currency: 'INR' })!;

    useSessionStore.getState().setSessionCurrency(session.id, 'SGD');

    const updatedStale = useSessionStore.getState().getBill(session.id, staleBill.id);
    const updatedClean = useSessionStore.getState().getBill(session.id, cleanBill.id);
    expect(updatedStale?.exchangeRate).toBeNull();
    expect(updatedClean?.exchangeRate).toBeNull();
    expect(updatedClean?.currency).toBe('INR');
  });

  test('does not push anything live for an offline session', async () => {
    const session = useSessionStore.getState().createSession('Trip');
    useSessionStore.getState().addBill(session.id, {
      currency: 'USD',
      exchangeRate: 83.5,
      exchangeRateDate: '2026-08-01',
      exchangeRateIsOverride: true,
    });

    useSessionStore.getState().setSessionCurrency(session.id, 'SGD');
    await flushMicrotasks();

    expect(mockUpdateLiveSessionCurrency).not.toHaveBeenCalled();
    expect(mockUpdateLiveBill).not.toHaveBeenCalled();
  });
});

describe('setSessionCurrency — live session', () => {
  test('pushes the session currency change live', async () => {
    const session = useSessionStore.getState().createSession('Trip');
    useSessionStore.getState().markSessionLive(session.id, 'ABCDE', 'creator-token');
    await flushMicrotasks();
    jest.clearAllMocks();

    useSessionStore.getState().setSessionCurrency(session.id, 'SGD');
    await flushMicrotasks();

    expect(mockUpdateLiveSessionCurrency).toHaveBeenCalledWith('ABCDE', 'SGD', 'creator-token');
  });

  test('pushes a cleared exchange rate for each affected bill', async () => {
    const session = useSessionStore.getState().createSession('Trip');
    const bill = useSessionStore.getState().addBill(session.id, {
      title: 'Hotel',
      currency: 'USD',
      exchangeRate: 83.5,
      exchangeRateDate: '2026-08-01',
      exchangeRateIsOverride: true,
    })!;
    useSessionStore.getState().markSessionLive(session.id, 'ABCDE', 'creator-token');
    await flushMicrotasks();
    jest.clearAllMocks();

    useSessionStore.getState().setSessionCurrency(session.id, 'SGD');
    await flushMicrotasks();

    expect(mockUpdateLiveBill).toHaveBeenCalledWith(
      'ABCDE',
      bill.id,
      expect.objectContaining({
        currency: 'USD',
        exchangeRate: null,
        exchangeRateDate: null,
        exchangeRateIsOverride: false,
      })
    );
  });

  test('does not push a bill-field update for a bill with no stale rate to clear', async () => {
    const session = useSessionStore.getState().createSession('Trip');
    useSessionStore.getState().addBill(session.id, { title: 'Coffee', currency: 'INR' });
    useSessionStore.getState().markSessionLive(session.id, 'ABCDE', 'creator-token');
    await flushMicrotasks();
    jest.clearAllMocks();

    useSessionStore.getState().setSessionCurrency(session.id, 'SGD');
    await flushMicrotasks();

    expect(mockUpdateLiveSessionCurrency).toHaveBeenCalled();
    expect(mockUpdateLiveBill).not.toHaveBeenCalled();
  });
});
