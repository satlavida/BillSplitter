import { connectLiveSync } from './liveSync';

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
