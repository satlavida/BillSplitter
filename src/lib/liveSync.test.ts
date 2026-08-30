import { connectLiveSync, createStaleResponseGuard } from './liveSync';

// Minimal fake EventSource: lets tests drive onopen/onerror/dispatchEvent
// directly instead of depending on a real network connection.
class FakeEventSource {
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  listeners: Record<string, ((ev: MessageEvent) => void)[]> = {};
  closed = false;

  addEventListener(kind: string, handler: (ev: MessageEvent) => void) {
    (this.listeners[kind] ??= []).push(handler);
  }

  close() {
    this.closed = true;
  }

  emit(kind: string, data: unknown) {
    for (const handler of this.listeners[kind] ?? []) {
      handler({ data: JSON.stringify(data) } as MessageEvent);
    }
  }
}

describe('connectLiveSync', () => {
  test('reports "live" once the EventSource opens', () => {
    let fake!: FakeEventSource;
    const statuses: string[] = [];

    connectLiveSync('ABCDE', {
      baseUrl: 'http://localhost:8080',
      onEvent: () => {},
      onStatusChange: (s) => statuses.push(s),
      eventSourceFactory: () => {
        fake = new FakeEventSource();
        return fake as unknown as EventSource;
      },
    });

    fake.onopen?.();
    expect(statuses).toContain('live');
  });

  test('delivers events with kind and id to onEvent', () => {
    let fake!: FakeEventSource;
    const events: { kind: string; id: string }[] = [];

    connectLiveSync('ABCDE', {
      baseUrl: 'http://localhost:8080',
      onEvent: (e) => events.push(e),
      onStatusChange: () => {},
      eventSourceFactory: () => {
        fake = new FakeEventSource();
        return fake as unknown as EventSource;
      },
    });

    fake.emit('bill.updated', { id: 'bill-1' });
    expect(events).toEqual([{ kind: 'bill.updated', id: 'bill-1' }]);
  });

  // Regression test: payment.created/payment.verified/session.updated were
  // broadcast server-side (see architecture/payments.md) but missing from
  // this client's subscribed-kinds allowlist, so a joiner's already-open
  // page silently never refreshed on a payment change — caught by
  // e2e/payments-live-collaboration.spec.ts, fixed here.
  test('delivers payment.created, payment.verified, and session.updated events too', () => {
    let fake!: FakeEventSource;
    const events: { kind: string; id: string }[] = [];

    connectLiveSync('ABCDE', {
      baseUrl: 'http://localhost:8080',
      onEvent: (e) => events.push(e),
      onStatusChange: () => {},
      eventSourceFactory: () => {
        fake = new FakeEventSource();
        return fake as unknown as EventSource;
      },
    });

    fake.emit('payment.created', { id: 'pay-1' });
    fake.emit('payment.verified', { id: 'pay-1' });
    fake.emit('session.updated', { id: 'ABCDE' });

    expect(events).toEqual([
      { kind: 'payment.created', id: 'pay-1' },
      { kind: 'payment.verified', id: 'pay-1' },
      { kind: 'session.updated', id: 'ABCDE' },
    ]);
  });

  test('falls back to polling after repeated failures within the failure window', () => {
    let fake!: FakeEventSource;
    const statuses: string[] = [];
    let pollCount = 0;

    connectLiveSync('ABCDE', {
      baseUrl: 'http://localhost:8080',
      onEvent: () => {},
      onStatusChange: (s) => statuses.push(s),
      onPoll: () => {
        pollCount++;
      },
      maxFailuresBeforePolling: 3,
      failureWindowMs: 30000,
      pollIntervalMs: 1000000, // avoid real timer firing during the test
      eventSourceFactory: () => {
        fake = new FakeEventSource();
        return fake as unknown as EventSource;
      },
    });

    fake.onerror?.();
    fake.onerror?.();
    expect(statuses).not.toContain('polling');

    fake.onerror?.();
    expect(statuses).toContain('polling');
    expect(fake.closed).toBe(true);
    expect(pollCount).toBeGreaterThanOrEqual(1);
  });

  test('goes straight to polling when EventSource is unavailable', () => {
    const originalEventSource = globalThis.EventSource;
    // @ts-expect-error simulating an environment without EventSource
    delete globalThis.EventSource;

    const statuses: string[] = [];
    let pollCount = 0;

    connectLiveSync('ABCDE', {
      baseUrl: 'http://localhost:8080',
      onEvent: () => {},
      onStatusChange: (s) => statuses.push(s),
      onPoll: () => {
        pollCount++;
      },
      pollIntervalMs: 1000000,
    });

    expect(statuses).toEqual(['polling']);
    expect(pollCount).toBe(1);

    globalThis.EventSource = originalEventSource;
  });

  test('disconnect closes the EventSource and stops polling', () => {
    let fake!: FakeEventSource;

    const handle = connectLiveSync('ABCDE', {
      baseUrl: 'http://localhost:8080',
      onEvent: () => {},
      onStatusChange: () => {},
      eventSourceFactory: () => {
        fake = new FakeEventSource();
        return fake as unknown as EventSource;
      },
    });

    handle.disconnect();
    expect(fake.closed).toBe(true);
  });
});

describe('createStaleResponseGuard', () => {
  test('drops a slower, earlier-issued response that resolves after a later one already applied', async () => {
    const guard = createStaleResponseGuard();
    const applied: string[] = [];

    // Call #1 is issued first but resolves last (simulates an SSE-triggered
    // refresh that was kicked off before all of an edit's writes had
    // landed, and is slow to come back).
    let resolveFirst!: (v: string) => void;
    const first = new Promise<string>((resolve) => (resolveFirst = resolve));
    const firstApplied = guard(first, (v) => applied.push(v));

    // Call #2 is issued second but resolves first (the refresh triggered
    // once everything had actually settled).
    const secondApplied = guard(Promise.resolve('second'), (v) => applied.push(v));
    await secondApplied;

    // Now the stale first response finally arrives.
    resolveFirst('first');
    await firstApplied;

    expect(applied).toEqual(['second']);
  });

  test('applies in-order responses normally', async () => {
    const guard = createStaleResponseGuard();
    const applied: string[] = [];

    await guard(Promise.resolve('first'), (v) => applied.push(v));
    await guard(Promise.resolve('second'), (v) => applied.push(v));

    expect(applied).toEqual(['first', 'second']);
  });
});
