// Covers req 5: activating "Go Live" on a session that already has bills
// must push those pre-existing bills/items up, not just future ones.
// liveApi.ts is dynamically imported (see sessionStore.ts's top-of-file
// comment) specifically so Jest never has to parse its import.meta.env
// reference — jest.mock intercepts that dynamic import with this mock
// instead, so the real file is never loaded.
const mockAddLiveBill = jest.fn().mockResolvedValue({});
const mockAddLiveItem = jest.fn().mockResolvedValue({});
const mockUpdateLiveBill = jest.fn().mockResolvedValue({});
const mockUpdateLiveItem = jest.fn().mockResolvedValue({});
const mockGetLiveSession = jest.fn();
const mockUploadLiveImage = jest.fn().mockResolvedValue({});
const mockClaimItem = jest.fn().mockResolvedValue({ status: 'approved' });
const mockUnclaimItem = jest.fn().mockResolvedValue(undefined);

jest.mock('./lib/liveApi', () => ({
  addLiveBill: (...args: unknown[]) => mockAddLiveBill(...args),
  addLiveItem: (...args: unknown[]) => mockAddLiveItem(...args),
  updateLiveBill: (...args: unknown[]) => mockUpdateLiveBill(...args),
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
    joinMode: 'open_link',
    claimMode: 'free_select',
    permissionMode: 'edit',
    creatorPersonId: null,
    isSettled: false,
    settledAt: null,
    people: [],
    bills: [],
  });
});

describe('markSessionLive — existing-bills sync (req 5)', () => {
  test('pushes a pre-existing bill and its items that the server has never seen', async () => {
    const session = useSessionStore.getState().createSession('Trip');
    const bill = useSessionStore.getState().addBill(session.id, { title: 'Dinner' })!;
    useSessionStore.getState().updateBill(session.id, bill.id, {
      items: [
        {
          id: 'item1',
          name: 'Pizza',
          price: 20,
          quantity: 1,
          discount: 0,
          discountType: 'flat',
          splitType: 'equal',
          consumedBy: [],
        },
      ],
    });

    useSessionStore.getState().markSessionLive(session.id, 'ABCDE', 'creator-token');
    await flushMicrotasks();
    await flushMicrotasks();

    expect(mockAddLiveBill).toHaveBeenCalledWith('ABCDE', expect.objectContaining({ id: bill.id, title: 'Dinner' }));
    expect(mockAddLiveItem).toHaveBeenCalledWith('ABCDE', bill.id, expect.objectContaining({ id: 'item1', name: 'Pizza' }));
  });

  test('does not re-push a bill the server already has unchanged', async () => {
    const session = useSessionStore.getState().createSession('Trip');
    const bill = useSessionStore.getState().addBill(session.id, { title: 'Dinner', currency: 'USD', taxAmount: 0 })!;

    mockGetLiveSession.mockResolvedValue({
      id: 'ABCDE',
      title: 'Trip',
      createdAt: '',
      updatedAt: '',
      joinMode: 'open_link',
      claimMode: 'free_select',
      permissionMode: 'edit',
      creatorPersonId: null,
      isSettled: false,
      settledAt: null,
      people: [],
      bills: [
        {
          id: bill.id,
          title: 'Dinner',
          date: bill.date,
          items: [],
          taxAmount: 0,
          currency: 'USD',
          paidByPersonId: null,
          imageRefKey: null,
          imageWidth: null,
          imageHeight: null,
        },
      ],
    });

    useSessionStore.getState().markSessionLive(session.id, 'ABCDE', 'creator-token');
    await flushMicrotasks();
    await flushMicrotasks();

    expect(mockAddLiveBill).not.toHaveBeenCalled();
    expect(mockUpdateLiveBill).not.toHaveBeenCalled();
  });

  test('does nothing when the session has no bills yet', async () => {
    const session = useSessionStore.getState().createSession('Trip');

    useSessionStore.getState().markSessionLive(session.id, 'ABCDE', 'creator-token');
    await flushMicrotasks();

    expect(mockGetLiveSession).not.toHaveBeenCalled();
    expect(mockAddLiveBill).not.toHaveBeenCalled();
  });
});

// Covers the "assignment reverted itself" bug: consumedBy is server-
// authoritative (per claim endpoints), so a creator-side item assignment
// that never reaches the server gets silently overwritten by the very next
// live-snapshot refresh (mergeLiveSnapshot). updateBill must push consumedBy
// changes as creator-initiated (token-free) claims/unclaims, same as any
// other bill/item field.
describe('updateBill — consumedBy pushes creator-initiated claims (live sync bug)', () => {
  test('assigning a person to an item pushes a token-free claim', async () => {
    const session = useSessionStore.getState().createSession('Trip');
    const bill = useSessionStore.getState().addBill(session.id, { title: 'Dinner' })!;
    useSessionStore.getState().markSessionLive(session.id, 'ABCDE', 'creator-token');
    await flushMicrotasks();

    useSessionStore.getState().updateBill(session.id, bill.id, {
      items: [
        { id: 'item1', name: 'Pizza', price: 20, quantity: 1, discount: 0, discountType: 'flat', splitType: 'equal', consumedBy: [] },
      ],
    });
    await flushMicrotasks();
    mockClaimItem.mockClear();

    useSessionStore.getState().updateBill(session.id, bill.id, {
      items: [
        {
          id: 'item1',
          name: 'Pizza',
          price: 20,
          quantity: 1,
          discount: 0,
          discountType: 'flat',
          splitType: 'equal',
          consumedBy: [{ personId: 'p1', value: 1 }],
        },
      ],
    });
    await flushMicrotasks();

    expect(mockClaimItem).toHaveBeenCalledWith('ABCDE', bill.id, 'item1', 'p1', 1);
    expect(mockUnclaimItem).not.toHaveBeenCalled();
  });

  test('removing a person from an item pushes a token-free unclaim', async () => {
    const session = useSessionStore.getState().createSession('Trip');
    const bill = useSessionStore.getState().addBill(session.id, { title: 'Dinner' })!;
    useSessionStore.getState().markSessionLive(session.id, 'ABCDE', 'creator-token');
    await flushMicrotasks();

    useSessionStore.getState().updateBill(session.id, bill.id, {
      items: [
        {
          id: 'item1',
          name: 'Pizza',
          price: 20,
          quantity: 1,
          discount: 0,
          discountType: 'flat',
          splitType: 'equal',
          consumedBy: [{ personId: 'p1', value: 1 }],
        },
      ],
    });
    await flushMicrotasks();
    mockUnclaimItem.mockClear();

    useSessionStore.getState().updateBill(session.id, bill.id, {
      items: [
        { id: 'item1', name: 'Pizza', price: 20, quantity: 1, discount: 0, discountType: 'flat', splitType: 'equal', consumedBy: [] },
      ],
    });
    await flushMicrotasks();

    expect(mockUnclaimItem).toHaveBeenCalledWith('ABCDE', bill.id, 'item1', 'p1');
  });
});

// End-to-end regression for the actual race: a live-snapshot refresh lands
// while the claim push it should reflect is still in flight (unresolved
// fetch). Without the pendingLiveWrites guard, mergeLiveSnapshot would
// overwrite the just-made assignment with the stale (pre-claim) remote
// snapshot the instant it resolves.
describe('mergeLiveSnapshot does not clobber an unacknowledged in-flight claim', () => {
  test('local consumedBy survives a snapshot merge that lands before the claim POST resolves', async () => {
    const session = useSessionStore.getState().createSession('Trip');
    const bill = useSessionStore.getState().addBill(session.id, { title: 'Dinner' })!;
    useSessionStore.getState().markSessionLive(session.id, 'ABCDE', 'creator-token');
    await flushMicrotasks();

    useSessionStore.getState().updateBill(session.id, bill.id, {
      items: [{ id: 'item1', name: 'Pizza', price: 20, quantity: 1, discount: 0, discountType: 'flat', splitType: 'equal', consumedBy: [] }],
    });
    await flushMicrotasks();

    // The claim push never resolves during this test — simulates a
    // snapshot refresh winning the race against a slow/in-flight POST.
    let resolveClaim: () => void = () => {};
    mockClaimItem.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveClaim = () => resolve({ status: 'approved' });
        })
    );

    useSessionStore.getState().updateBill(session.id, bill.id, {
      items: [
        {
          id: 'item1',
          name: 'Pizza',
          price: 20,
          quantity: 1,
          discount: 0,
          discountType: 'flat',
          splitType: 'equal',
          consumedBy: [{ personId: 'p1', value: 1 }],
        },
      ],
    });

    // A stale snapshot (pre-claim, empty consumedBy) refreshes in while the
    // claim above is still pending.
    useSessionStore.getState().mergeLiveSnapshot(session.id, {
      id: 'ABCDE',
      title: 'Trip',
      createdAt: '',
      updatedAt: '',
      joinMode: 'open_link',
      permissionMode: 'edit',
      creatorPersonId: null,
      isSettled: false,
      settledAt: null,
      people: [],
      bills: [
        {
          id: bill.id,
          title: 'Dinner',
          date: bill.date,
          items: [{ id: 'item1', name: 'Pizza', price: 20, quantity: 1, discount: 0, discountType: 'flat', splitType: 'equal', consumedBy: [] }],
          taxAmount: 0,
          currency: 'INR',
          paidByPersonId: null,
          imageRefKey: null,
          imageWidth: null,
          imageHeight: null,
        },
      ],
    });

    expect(useSessionStore.getState().getBill(session.id, bill.id)?.items[0].consumedBy).toEqual([{ personId: 'p1', value: 1 }]);

    // Once the claim finally acknowledges and a fresh snapshot reflects it,
    // a subsequent merge continues to agree (guard released cleanly).
    resolveClaim();
    await flushMicrotasks();
    useSessionStore.getState().mergeLiveSnapshot(session.id, {
      id: 'ABCDE',
      title: 'Trip',
      createdAt: '',
      updatedAt: '',
      joinMode: 'open_link',
      permissionMode: 'edit',
      creatorPersonId: null,
      isSettled: false,
      settledAt: null,
      people: [],
      bills: [
        {
          id: bill.id,
          title: 'Dinner',
          date: bill.date,
          items: [
            { id: 'item1', name: 'Pizza', price: 20, quantity: 1, discount: 0, discountType: 'flat', splitType: 'equal', consumedBy: [{ personId: 'p1', value: 1 }] },
          ],
          taxAmount: 0,
          currency: 'INR',
          paidByPersonId: null,
          imageRefKey: null,
          imageWidth: null,
          imageHeight: null,
        },
      ],
    });

    expect(useSessionStore.getState().getBill(session.id, bill.id)?.items[0].consumedBy).toEqual([{ personId: 'p1', value: 1 }]);
  });
});
