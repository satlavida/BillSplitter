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

jest.mock('./lib/liveApi', () => ({
  addLiveBill: (...args: unknown[]) => mockAddLiveBill(...args),
  addLiveItem: (...args: unknown[]) => mockAddLiveItem(...args),
  updateLiveBill: (...args: unknown[]) => mockUpdateLiveBill(...args),
  updateLiveItem: (...args: unknown[]) => mockUpdateLiveItem(...args),
  getLiveSession: (...args: unknown[]) => mockGetLiveSession(...args),
  uploadLiveImage: (...args: unknown[]) => mockUploadLiveImage(...args),
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
