import { beginPendingLiveWrite, endPendingLiveWrite, isPendingLiveWrite, trackPendingLiveWrite } from './pendingLiveWrites';

describe('pendingLiveWrites', () => {
  test('a key with no begin/end is not pending', () => {
    expect(isPendingLiveWrite('item:1:fields')).toBe(false);
  });

  test('begin marks pending, end clears it', () => {
    beginPendingLiveWrite('item:1:fields');
    expect(isPendingLiveWrite('item:1:fields')).toBe(true);

    endPendingLiveWrite('item:1:fields');
    expect(isPendingLiveWrite('item:1:fields')).toBe(false);
  });

  test('refcounts: two begins require two ends before the key clears', () => {
    beginPendingLiveWrite('item:2:fields');
    beginPendingLiveWrite('item:2:fields');
    expect(isPendingLiveWrite('item:2:fields')).toBe(true);

    endPendingLiveWrite('item:2:fields');
    expect(isPendingLiveWrite('item:2:fields')).toBe(true);

    endPendingLiveWrite('item:2:fields');
    expect(isPendingLiveWrite('item:2:fields')).toBe(false);
  });

  test('unrelated keys do not interfere with each other', () => {
    beginPendingLiveWrite('item:3:fields');
    expect(isPendingLiveWrite('item:3:consumedBy')).toBe(false);
    expect(isPendingLiveWrite('item:4:fields')).toBe(false);
    endPendingLiveWrite('item:3:fields');
  });

  test('trackPendingLiveWrite marks pending synchronously and clears on resolve', async () => {
    let resolvePush: () => void;
    const push = new Promise<void>((resolve) => {
      resolvePush = resolve;
    });

    const tracked = trackPendingLiveWrite('bill:1:fields', push);
    expect(isPendingLiveWrite('bill:1:fields')).toBe(true);

    resolvePush!();
    await tracked;
    expect(isPendingLiveWrite('bill:1:fields')).toBe(false);
  });

  test('trackPendingLiveWrite clears on rejection too, without swallowing the error', async () => {
    let rejectPush: (err: Error) => void;
    const push = new Promise<void>((_, reject) => {
      rejectPush = reject;
    });

    const tracked = trackPendingLiveWrite('bill:2:fields', push);
    expect(isPendingLiveWrite('bill:2:fields')).toBe(true);

    rejectPush!(new Error('network down'));
    await expect(tracked).rejects.toThrow('network down');
    expect(isPendingLiveWrite('bill:2:fields')).toBe(false);
  });
});
