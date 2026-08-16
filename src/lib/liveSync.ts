// Framework-free live-sync client (planv3.md 3.6 / 3.10): EventSource if
// available, falling back to a 3-5s poll after EventSource is undefined or
// after 3 consecutive reconnect failures within 30s. Surfaces a
// live/reconnecting/polling status rather than failing silently.

export type LiveSyncStatus = 'live' | 'reconnecting' | 'polling';

export interface LiveEvent {
  kind: string;
  id: string;
}

export interface LiveSyncHandle {
  status: LiveSyncStatus;
  disconnect: () => void;
}

interface ConnectOptions {
  // Base URL of the live server, e.g. LIVE_SERVER_URL from liveApi.ts.
  // Threaded through as an explicit parameter (rather than importing it
  // here) so this module stays free of import.meta.env — that keeps it
  // unit-testable under Jest/Babel's CommonJS transform, which can't
  // represent import.meta.
  baseUrl: string;
  onEvent: (event: LiveEvent) => void;
  onStatusChange: (status: LiveSyncStatus) => void;
  onPoll?: () => void;
  pollIntervalMs?: number;
  maxFailuresBeforePolling?: number;
  failureWindowMs?: number;
  eventSourceFactory?: (url: string) => EventSource;
}

const DEFAULT_POLL_INTERVAL_MS = 4000;
const DEFAULT_MAX_FAILURES = 3;
const DEFAULT_FAILURE_WINDOW_MS = 30000;

export function connectLiveSync(sessionCode: string, options: ConnectOptions): LiveSyncHandle {
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const maxFailures = options.maxFailuresBeforePolling ?? DEFAULT_MAX_FAILURES;
  const failureWindowMs = options.failureWindowMs ?? DEFAULT_FAILURE_WINDOW_MS;
  const makeEventSource = options.eventSourceFactory ?? ((url: string) => new EventSource(url));

  let status: LiveSyncStatus = 'reconnecting';
  let disconnected = false;
  let eventSource: EventSource | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let failureTimestamps: number[] = [];

  const setStatus = (next: LiveSyncStatus) => {
    if (status === next) return;
    status = next;
    options.onStatusChange(next);
  };

  const startPolling = () => {
    if (pollTimer) return;
    stopEventSource();
    setStatus('polling');
    options.onPoll?.();
    pollTimer = setInterval(() => {
      options.onPoll?.();
    }, pollIntervalMs);
  };

  const stopEventSource = () => {
    if (eventSource) {
      eventSource.close();
      eventSource = null;
    }
  };

  const recordFailureAndMaybeFallBack = () => {
    const now = Date.now();
    failureTimestamps = failureTimestamps.filter((t) => now - t < failureWindowMs);
    failureTimestamps.push(now);
    if (failureTimestamps.length >= maxFailures) {
      startPolling();
    } else {
      setStatus('reconnecting');
    }
  };

  const startEventSource = () => {
    if (!options.eventSourceFactory && typeof EventSource === 'undefined') {
      startPolling();
      return;
    }

    const es = makeEventSource(`${options.baseUrl}/api/sessions/${sessionCode}/events`);
    eventSource = es;

    es.onopen = () => {
      failureTimestamps = [];
      setStatus('live');
    };

    es.onerror = () => {
      if (disconnected) return;
      recordFailureAndMaybeFallBack();
    };

    const kinds = [
      'joiner.pending',
      'joiner.approved',
      'joiner.disapproved',
      'claim.pending',
      'claim.approved',
      'claim.rejected',
      'item.updated',
      'bill.updated',
      'session.settled',
      'activity.created',
    ];
    for (const kind of kinds) {
      es.addEventListener(kind, (ev: MessageEvent) => {
        try {
          const data = JSON.parse(ev.data);
          options.onEvent({ kind, id: data.id });
        } catch {
          // ignore malformed payloads
        }
      });
    }
  };

  startEventSource();

  return {
    get status() {
      return status;
    },
    disconnect: () => {
      disconnected = true;
      stopEventSource();
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    },
  };
}
