import useSessionStore from './sessionStore';

// Mock localStorage for testing persistence
const mockLocalStorageData: Record<string, string> = {};
const mockLocalStorage = {
  getItem: jest.fn((key: string) => mockLocalStorageData[key] || null),
  setItem: jest.fn((key: string, value: string) => {
    mockLocalStorageData[key] = value;
  }),
  removeItem: jest.fn((key: string) => {
    delete mockLocalStorageData[key];
  }),
  clear: jest.fn(() => {
    Object.keys(mockLocalStorageData).forEach((key) => delete mockLocalStorageData[key]);
  }),
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
  writable: true,
});

beforeEach(() => {
  useSessionStore.setState({
    version: '2.0.0',
    sessions: [],
    currentSessionId: null,
    migratedFromV1: false,
  });
});

describe('sessionStore - Session management', () => {
  test('createSession adds a session and sets it as current', () => {
    const session = useSessionStore.getState().createSession('Trip to Goa');
    const state = useSessionStore.getState();
    expect(state.sessions).toHaveLength(1);
    expect(state.currentSessionId).toBe(session.id);
    expect(session.title).toBe('Trip to Goa');
    expect(session.people).toEqual([]);
    expect(session.bills).toEqual([]);
  });

  test('deleteSession removes it and clears currentSessionId if it was current', () => {
    const session = useSessionStore.getState().createSession('Trip');
    useSessionStore.getState().deleteSession(session.id);
    const state = useSessionStore.getState();
    expect(state.sessions).toHaveLength(0);
    expect(state.currentSessionId).toBeNull();
  });

  test('getSession/getCurrentSession retrieve the right session', () => {
    const session = useSessionStore.getState().createSession('Trip');
    expect(useSessionStore.getState().getSession(session.id)?.id).toBe(session.id);
    expect(useSessionStore.getState().getCurrentSession()?.id).toBe(session.id);
  });
});

describe('sessionStore - Shared people pool', () => {
  test('addPerson adds to the session-level people pool', () => {
    const session = useSessionStore.getState().createSession('Trip');
    useSessionStore.getState().addPerson(session.id, 'Alice');
    useSessionStore.getState().addPerson(session.id, 'Bob');
    const updated = useSessionStore.getState().getSession(session.id);
    expect(updated?.people).toHaveLength(2);
    expect(updated?.people.map((p) => p.name)).toEqual(['Alice', 'Bob']);
  });

  test('removePerson strips them from all bills consumedBy and paidByPersonId', () => {
    const session = useSessionStore.getState().createSession('Trip');
    const alice = useSessionStore.getState().addPerson(session.id, 'Alice')!;
    const bill = useSessionStore.getState().addBill(session.id, { paidByPersonId: alice.id })!;
    useSessionStore.getState().updateBill(session.id, bill.id, {
      items: [
        {
          id: 'i1',
          name: 'Pizza',
          price: 10,
          quantity: 1,
          discount: 0,
          discountType: 'flat',
          consumedBy: [{ personId: alice.id, value: 1 }],
          splitType: 'equal',
        },
      ],
    });

    useSessionStore.getState().removePerson(session.id, alice.id);

    const updated = useSessionStore.getState().getSession(session.id);
    expect(updated?.people).toHaveLength(0);
    expect(updated?.bills[0].paidByPersonId).toBeNull();
    expect(updated?.bills[0].items[0].consumedBy).toEqual([]);
  });
});

describe('sessionStore - Multi-bill', () => {
  test('a session can hold multiple independently editable bills', () => {
    const session = useSessionStore.getState().createSession('Trip');
    const billA = useSessionStore.getState().addBill(session.id, { title: 'Uber' })!;
    const billB = useSessionStore.getState().addBill(session.id, { title: 'Restaurant' })!;

    useSessionStore.getState().updateBill(session.id, billA.id, { taxAmount: 5 });

    const updated = useSessionStore.getState().getSession(session.id);
    expect(updated?.bills).toHaveLength(2);
    expect(updated?.bills.find((b) => b.id === billA.id)?.taxAmount).toBe(5);
    expect(updated?.bills.find((b) => b.id === billB.id)?.taxAmount).toBe(0);
    // currentBillId tracks the most recently added bill
    expect(updated?.currentBillId).toBe(billB.id);
  });

  test('deleteBill removes only the targeted bill', () => {
    const session = useSessionStore.getState().createSession('Trip');
    const billA = useSessionStore.getState().addBill(session.id)!;
    const billB = useSessionStore.getState().addBill(session.id)!;

    useSessionStore.getState().deleteBill(session.id, billA.id);

    const updated = useSessionStore.getState().getSession(session.id);
    expect(updated?.bills).toHaveLength(1);
    expect(updated?.bills[0].id).toBe(billB.id);
  });
});

describe('sessionStore - paidByPersonId', () => {
  test('setBillPaidBy sets and clears the payer', () => {
    const session = useSessionStore.getState().createSession('Trip');
    const alice = useSessionStore.getState().addPerson(session.id, 'Alice')!;
    const bill = useSessionStore.getState().addBill(session.id)!;

    useSessionStore.getState().setBillPaidBy(session.id, bill.id, alice.id);
    expect(useSessionStore.getState().getBill(session.id, bill.id)?.paidByPersonId).toBe(alice.id);

    useSessionStore.getState().setBillPaidBy(session.id, bill.id, null);
    expect(useSessionStore.getState().getBill(session.id, bill.id)?.paidByPersonId).toBeNull();
  });
});

describe('sessionStore - export/import', () => {
  test('exportSession/importSession round-trips a session', () => {
    const session = useSessionStore.getState().createSession('Trip');
    useSessionStore.getState().addPerson(session.id, 'Alice');
    const exported = useSessionStore.getState().exportSession(session.id);
    expect(exported).not.toBeNull();

    useSessionStore.getState().deleteSession(session.id);
    expect(useSessionStore.getState().sessions).toHaveLength(0);

    const result = useSessionStore.getState().importSession(exported as string);
    expect(result.success).toBe(true);
    expect(useSessionStore.getState().sessions).toHaveLength(1);
    expect(useSessionStore.getState().sessions[0].people[0].name).toBe('Alice');
  });

  test('importSession rejects malformed JSON gracefully', () => {
    const result = useSessionStore.getState().importSession('not json');
    expect(result.success).toBe(false);
  });
});
