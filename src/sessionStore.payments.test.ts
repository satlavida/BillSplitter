// Covers addPayment/verifyPayment/setRequirePaymentVerification — local
// mutation correctness plus fire-and-forget live-push behavior, mirroring
// sessionStore.currency.test.ts's mock/setup shape. See architecture/payments.md.

const mockAddLivePayment = jest.fn().mockResolvedValue({});
const mockVerifyLivePayment = jest.fn().mockResolvedValue(undefined);
const mockUpdateLiveRequirePaymentVerification = jest.fn().mockResolvedValue(undefined);

jest.mock('./lib/liveApi', () => ({
  addLivePayment: (...args: unknown[]) => mockAddLivePayment(...args),
  verifyLivePayment: (...args: unknown[]) => mockVerifyLivePayment(...args),
  updateLiveRequirePaymentVerification: (...args: unknown[]) => mockUpdateLiveRequirePaymentVerification(...args),
}));

import useSessionStore from './sessionStore';

const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0));

const newPaymentInput = (payerId: string, payeeId: string, addedByPersonId: string) => ({
  payerId,
  payeeId,
  amount: 500,
  currency: 'INR',
  exchangeRate: null,
  exchangeRateDate: null,
  exchangeRateIsOverride: false,
  method: 'cash' as const,
  transactionId: null,
  addedByPersonId,
});

beforeEach(() => {
  useSessionStore.setState({ sessions: [], currentSessionId: null });
  jest.clearAllMocks();
});

describe('addPayment — offline session', () => {
  test('always starts verified, regardless of who added it', () => {
    const session = useSessionStore.getState().createSession('Trip');
    const alice = useSessionStore.getState().addPerson(session.id, 'Alice')!;
    const bob = useSessionStore.getState().addPerson(session.id, 'Bob')!;

    const payment = useSessionStore.getState().addPayment(session.id, newPaymentInput(bob.id, alice.id, bob.id));

    expect(payment?.verified).toBe(true);
    expect(payment?.verifiedAt).not.toBeNull();
    expect(useSessionStore.getState().getSession(session.id)?.payments).toHaveLength(1);
  });

  test('does not push anything live', async () => {
    const session = useSessionStore.getState().createSession('Trip');
    const alice = useSessionStore.getState().addPerson(session.id, 'Alice')!;
    const bob = useSessionStore.getState().addPerson(session.id, 'Bob')!;

    useSessionStore.getState().addPayment(session.id, newPaymentInput(bob.id, alice.id, bob.id));
    await flushMicrotasks();

    expect(mockAddLivePayment).not.toHaveBeenCalled();
  });
});

describe('addPayment — live session', () => {
  test('a payer-added payment starts unverified when verification is required (default)', async () => {
    const session = useSessionStore.getState().createSession('Trip');
    const alice = useSessionStore.getState().addPerson(session.id, 'Alice')!;
    const bob = useSessionStore.getState().addPerson(session.id, 'Bob')!;
    useSessionStore.getState().markSessionLive(session.id, 'ABCDE', 'creator-token');
    await flushMicrotasks();

    const payment = useSessionStore.getState().addPayment(session.id, newPaymentInput(bob.id, alice.id, bob.id), 'bob-token');
    await flushMicrotasks();

    expect(payment?.verified).toBe(false);
    expect(mockAddLivePayment).toHaveBeenCalledWith('ABCDE', expect.objectContaining({ payerId: bob.id, payeeId: alice.id }), 'bob-token');
  });

  test('a payee-added payment auto-verifies', async () => {
    const session = useSessionStore.getState().createSession('Trip');
    const alice = useSessionStore.getState().addPerson(session.id, 'Alice')!;
    const bob = useSessionStore.getState().addPerson(session.id, 'Bob')!;
    useSessionStore.getState().markSessionLive(session.id, 'ABCDE', 'creator-token');
    await flushMicrotasks();

    const payment = useSessionStore.getState().addPayment(session.id, newPaymentInput(bob.id, alice.id, alice.id), 'alice-token');

    expect(payment?.verified).toBe(true);
  });

  test('turning off requirePaymentVerification auto-verifies a payer-added payment too', async () => {
    const session = useSessionStore.getState().createSession('Trip');
    const alice = useSessionStore.getState().addPerson(session.id, 'Alice')!;
    const bob = useSessionStore.getState().addPerson(session.id, 'Bob')!;
    useSessionStore.getState().markSessionLive(session.id, 'ABCDE', 'creator-token');
    useSessionStore.getState().setRequirePaymentVerification(session.id, false);
    await flushMicrotasks();

    const payment = useSessionStore.getState().addPayment(session.id, newPaymentInput(bob.id, alice.id, bob.id), 'bob-token');

    expect(payment?.verified).toBe(true);
  });
});

describe('verifyPayment', () => {
  test('marks a pending payment verified and sets verifiedAt', async () => {
    const session = useSessionStore.getState().createSession('Trip');
    const alice = useSessionStore.getState().addPerson(session.id, 'Alice')!;
    const bob = useSessionStore.getState().addPerson(session.id, 'Bob')!;
    useSessionStore.getState().markSessionLive(session.id, 'ABCDE', 'creator-token');
    await flushMicrotasks();
    const payment = useSessionStore.getState().addPayment(session.id, newPaymentInput(bob.id, alice.id, bob.id), 'bob-token')!;
    await flushMicrotasks();
    jest.clearAllMocks();

    useSessionStore.getState().verifyPayment(session.id, payment.id, 'alice-token');
    await flushMicrotasks();

    const updated = useSessionStore.getState().getSession(session.id)?.payments.find((p) => p.id === payment.id);
    expect(updated?.verified).toBe(true);
    expect(updated?.verifiedAt).not.toBeNull();
    expect(mockVerifyLivePayment).toHaveBeenCalledWith('ABCDE', payment.id, 'alice-token');
  });
});

describe('setRequirePaymentVerification', () => {
  test('updates locally and pushes live only when the session is live', async () => {
    const session = useSessionStore.getState().createSession('Trip');
    expect(useSessionStore.getState().getSession(session.id)?.requirePaymentVerification).toBe(true);

    useSessionStore.getState().setRequirePaymentVerification(session.id, false);
    await flushMicrotasks();

    expect(useSessionStore.getState().getSession(session.id)?.requirePaymentVerification).toBe(false);
    expect(mockUpdateLiveRequirePaymentVerification).not.toHaveBeenCalled();

    useSessionStore.getState().markSessionLive(session.id, 'ABCDE', 'creator-token');
    await flushMicrotasks();
    jest.clearAllMocks();

    useSessionStore.getState().setRequirePaymentVerification(session.id, true);
    await flushMicrotasks();

    expect(mockUpdateLiveRequirePaymentVerification).toHaveBeenCalledWith('ABCDE', true, 'creator-token');
  });
});
