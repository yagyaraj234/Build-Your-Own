import { afterEach, describe, expect, setSystemTime, test } from 'bun:test';

const timeoutIds: ReturnType<typeof setTimeout>[] = [];
const realSetTimeout = globalThis.setTimeout.bind(globalThis);
const realLog = console.log;

console.log = () => {};
globalThis.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
  const id = realSetTimeout(handler, timeout, ...args);
  timeoutIds.push(id);
  return id;
}) as typeof setTimeout;

const { SlidingWindowLog } = await import('../sliding-window-log');

globalThis.setTimeout = realSetTimeout as typeof setTimeout;
console.log = realLog;

for (const id of timeoutIds) clearTimeout(id);
timeoutIds.length = 0;

function take(check: () => Boolean, count: number) {
  return Array.from({ length: count }, () => check());
}

afterEach(() => {
  setSystemTime();
});

describe('sliding window log', () => {
  test('allows window_size checks, then rejects', () => {
    setSystemTime(1_000);
    const limiter = new SlidingWindowLog({ window_size: 3, window_size_time: 5_000 });

    expect(take(() => limiter.check(), 3)).toEqual([true, true, true]);
    expect(limiter.check()).toBe(false);
  });

  test('records the time of each allowed check', () => {
    setSystemTime(1_000);
    const limiter = new SlidingWindowLog({ window_size: 3, window_size_time: 5_000 });

    limiter.check();
    setSystemTime(1_100);
    limiter.check();

    expect(limiter.window_logs).toEqual([1_000, 1_100]);
  });

  test('does not record a rejected check', () => {
    setSystemTime(0);
    const limiter = new SlidingWindowLog({ window_size: 2, window_size_time: 1_000 });

    limiter.check();
    setSystemTime(100);
    limiter.check();
    expect(limiter.check()).toBe(false);
    expect(limiter.window_logs).toEqual([0, 100]);
  });

  test('keeps a timestamp that is exactly window_size_time old', () => {
    setSystemTime(0);
    const limiter = new SlidingWindowLog({ window_size: 1, window_size_time: 1_000 });

    expect(limiter.check()).toBe(true);
    setSystemTime(1_000);
    expect(limiter.check()).toBe(false);
    expect(limiter.window_logs).toEqual([0]);
  });

  test('allows a new check once a timestamp is older than the window', () => {
    setSystemTime(0);
    const limiter = new SlidingWindowLog({ window_size: 1, window_size_time: 1_000 });

    limiter.check();
    setSystemTime(1_001);
    expect(limiter.check()).toBe(true);
    expect(limiter.window_logs).toEqual([1_001]);
  });

  test('drops the oldest timestamp and keeps a newer one that is still inside the window', () => {
    setSystemTime(0);
    const limiter = new SlidingWindowLog({ window_size: 2, window_size_time: 1_000 });

    limiter.check();
    setSystemTime(100);
    limiter.check();
    expect(limiter.check()).toBe(false);

    setSystemTime(1_001);
    expect(limiter.check()).toBe(true);
    expect(limiter.check()).toBe(false);
    expect(limiter.window_logs).toEqual([100, 1_001]);
  });

  test('allows ten checks spread across the window, then rejects', () => {
    setSystemTime(0);
    const limiter = new SlidingWindowLog({ window_size: 10, window_size_time: 5_000 });

    expect(take(() => limiter.check(), 6).every(Boolean)).toBe(true);
    setSystemTime(2_000);
    expect(take(() => limiter.check(), 4).every(Boolean)).toBe(true);
    expect(limiter.check()).toBe(false);
  });
});

describe('sliding window log break scenarios', () => {
  test('a window size of 0 rejects the first check', () => {
    setSystemTime(0);
    const limiter = new SlidingWindowLog({ window_size: 0, window_size_time: 1_000 });

    expect(limiter.check()).toBe(false);
  });

  test('one check drops every expired timestamp', () => {
    setSystemTime(0);
    const limiter = new SlidingWindowLog({ window_size: 3, window_size_time: 1_000 });

    limiter.check();
    limiter.check();
    limiter.check();

    setSystemTime(1_001);
    expect(limiter.check()).toBe(true);
    expect(limiter.window_logs).toEqual([1_001]);
  });

  test('an expired timestamp is not left in front of a newer one', () => {
    setSystemTime(0);
    const limiter = new SlidingWindowLog({ window_size: 3, window_size_time: 1_000 });

    limiter.check();
    limiter.check();
    setSystemTime(500);
    limiter.check();

    setSystemTime(1_001);
    expect(limiter.check()).toBe(true);
    expect(limiter.window_logs.every((stamp) => stamp >= 500)).toBe(true);
  });

  test('requests from the start of a 5000ms window are gone at 5000ms', () => {
    setSystemTime(0);
    const limiter = new SlidingWindowLog({ window_size: 10, window_size_time: 5_000 });

    expect(take(() => limiter.check(), 6).every(Boolean)).toBe(true);
    setSystemTime(2_000);
    expect(take(() => limiter.check(), 4).every(Boolean)).toBe(true);
    expect(limiter.check()).toBe(false);

    setSystemTime(5_000);
    const again = take(() => limiter.check(), 10);
    expect(again.filter(Boolean).length).toBe(6);
  });

  test('after those first requests expire, the log holds only the later ones plus the new check', () => {
    setSystemTime(0);
    const limiter = new SlidingWindowLog({ window_size: 4, window_size_time: 1_000 });

    limiter.check();
    limiter.check();
    limiter.check();
    limiter.check();

    setSystemTime(1_001);
    expect(limiter.check()).toBe(true);
    expect(limiter.window_logs).toEqual([1_001]);
  });
});
