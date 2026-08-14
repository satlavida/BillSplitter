import { buildSessionsFromLegacyData, runMigrationIfNeeded } from './toSessionStore';
import useSessionStore from '../sessionStore';

// Mock localStorage with a functional backing store (needed for
// runMigrationIfNeeded's guard checks and sessionStore's own persistence).
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

// Fixture matching the real old billHistoryStore persisted shape
// ({version, bills: [{id, title, date, data: <billStore state>, isCurrent, version}], currentBillId})
const makeLegacyHistoryRaw = (bills: unknown[]) => ({
  version: '1.1.0',
  bills,
  currentBillId: bills.length > 0 ? (bills[0] as { id: string }).id : null,
});

const makeLegacyBillEntry = (overrides: Record<string, unknown> = {}) => ({
  id: 'AB12D',
  title: 'Dinner',
  date: '2026-01-01T00:00:00.000Z',
  data: {
    version: '1.1.0',
    billId: 'AB12D',
    step: 4,
    people: [{ id: 'p1', name: 'Alice' }, { id: 'p2', name: 'Bob' }],
    items: [
      {
        id: 'i1',
        name: 'Pizza',
        price: 20,
        quantity: 1,
        consumedBy: ['p1', 'p2'], // legacy string-array consumedBy format
        splitType: 'equal',
      },
    ],
    taxAmount: 2,
    currency: 'INR',
    title: 'Dinner',
  },
  isCurrent: true,
  version: '1.1.0',
  ...overrides,
});

// Fixture matching the real old billStore persisted shape (raw BillState)
const makeLegacyActiveBillRaw = (overrides: Record<string, unknown> = {}) => ({
  version: '1.1.0',
  billId: null,
  step: 2,
  people: [{ id: 'p1', name: 'Solo Person' }],
  items: [],
  taxAmount: 0,
  currency: 'USD',
  title: 'Unsaved Bill',
  ...overrides,
});

beforeEach(() => {
  mockLocalStorage.clear();
  useSessionStore.setState({
    version: '2.0.0',
    sessions: [],
    currentSessionId: null,
    migratedFromV1: false,
  });
});

describe('buildSessionsFromLegacyData', () => {
  test('returns an empty array for undefined/missing legacy data', () => {
    expect(buildSessionsFromLegacyData(undefined, undefined)).toEqual([]);
  });

  test('converts a single billHistory entry into one Session with one Bill', () => {
    const historyRaw = makeLegacyHistoryRaw([makeLegacyBillEntry()]);
    const sessions = buildSessionsFromLegacyData(historyRaw, undefined);

    expect(sessions).toHaveLength(1);
    expect(sessions[0].title).toBe('Dinner');
    expect(sessions[0].people).toHaveLength(2);
    expect(sessions[0].bills).toHaveLength(1);
    expect(sessions[0].bills[0].id).toBe('AB12D');
    expect(sessions[0].bills[0].taxAmount).toBe(2);
  });

  test('normalizes legacy string-array consumedBy inside migrated bill items', () => {
    const historyRaw = makeLegacyHistoryRaw([makeLegacyBillEntry()]);
    const sessions = buildSessionsFromLegacyData(historyRaw, undefined);

    expect(sessions[0].bills[0].items[0].consumedBy).toEqual([
      { personId: 'p1', value: 1 },
      { personId: 'p2', value: 1 },
    ]);
  });

  test('converts multiple billHistory entries into multiple Sessions', () => {
    const historyRaw = makeLegacyHistoryRaw([
      makeLegacyBillEntry({ id: 'A', title: 'Uber' }),
      makeLegacyBillEntry({ id: 'B', title: 'Restaurant' }),
    ]);
    const sessions = buildSessionsFromLegacyData(historyRaw, undefined);

    expect(sessions).toHaveLength(2);
    expect(sessions.map((s) => s.title)).toEqual(['Uber', 'Restaurant']);
  });

  test('migrated bills default paidByPersonId and receiptImage to null', () => {
    const historyRaw = makeLegacyHistoryRaw([makeLegacyBillEntry()]);
    const sessions = buildSessionsFromLegacyData(historyRaw, undefined);
    expect(sessions[0].bills[0].paidByPersonId).toBeNull();
    expect(sessions[0].bills[0].receiptImage).toBeNull();
  });

  test('wraps an unsaved active bill (with real data) as a standalone session', () => {
    const activeRaw = makeLegacyActiveBillRaw();
    const sessions = buildSessionsFromLegacyData(undefined, activeRaw);

    expect(sessions).toHaveLength(1);
    expect(sessions[0].title).toBe('Unsaved Bill');
    expect(sessions[0].people[0].name).toBe('Solo Person');
  });

  test('does not add a standalone session for an empty/untouched active bill', () => {
    const activeRaw = makeLegacyActiveBillRaw({ people: [], items: [], title: '' });
    const sessions = buildSessionsFromLegacyData(undefined, activeRaw);
    expect(sessions).toEqual([]);
  });

  test('does not duplicate an active bill that is already represented in history', () => {
    const entry = makeLegacyBillEntry();
    const historyRaw = makeLegacyHistoryRaw([entry]);
    // Active bill blob mirrors the already-saved history entry (same billId)
    const activeRaw = { ...entry.data };

    const sessions = buildSessionsFromLegacyData(historyRaw, activeRaw);
    expect(sessions).toHaveLength(1);
  });

  test('combines a billHistory migration with an additional unsaved active bill', () => {
    const historyRaw = makeLegacyHistoryRaw([makeLegacyBillEntry({ id: 'A' })]);
    const activeRaw = makeLegacyActiveBillRaw({ billId: null });

    const sessions = buildSessionsFromLegacyData(historyRaw, activeRaw);
    expect(sessions).toHaveLength(2);
  });

  test('malformed/corrupt legacy data is skipped gracefully rather than throwing', () => {
    expect(() => buildSessionsFromLegacyData({ garbage: true }, { garbage: true })).not.toThrow();
    expect(buildSessionsFromLegacyData({ garbage: true }, { garbage: true })).toEqual([]);
  });
});

describe('runMigrationIfNeeded', () => {
  test('does nothing when there is no legacy data and no existing session data', () => {
    runMigrationIfNeeded();
    expect(useSessionStore.getState().sessions).toEqual([]);
    expect(useSessionStore.getState().migratedFromV1).toBe(false);
  });

  test('migrates legacy billHistory data into sessionStore and sets migratedFromV1', () => {
    mockLocalStorage.setItem(
      'billHistory',
      JSON.stringify({ state: makeLegacyHistoryRaw([makeLegacyBillEntry()]), version: 0 })
    );

    runMigrationIfNeeded();

    const state = useSessionStore.getState();
    expect(state.sessions).toHaveLength(1);
    expect(state.migratedFromV1).toBe(true);
  });

  test('does not re-run once sessionStore has already persisted (billSplitterSession key present)', () => {
    mockLocalStorage.setItem('billSplitterSession', JSON.stringify({ state: { sessions: [] }, version: 0 }));
    mockLocalStorage.setItem(
      'billHistory',
      JSON.stringify({ state: makeLegacyHistoryRaw([makeLegacyBillEntry()]), version: 0 })
    );

    runMigrationIfNeeded();

    // Guarded off by the presence of the sessionStore key - never even reads billHistory
    expect(useSessionStore.getState().sessions).toEqual([]);
    expect(useSessionStore.getState().migratedFromV1).toBe(false);
  });
});
