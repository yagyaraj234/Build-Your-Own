import { afterEach, describe, expect, jest, test } from 'bun:test';

const timeoutIds: ReturnType<typeof setTimeout>[] = [];
const realSetTimeout = globalThis.setTimeout.bind(globalThis);
const realLog = console.log;

console.log = () => {};
globalThis.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
  const id = realSetTimeout(handler, timeout, ...args);
  timeoutIds.push(id);
  return id;
}) as typeof setTimeout;

const { FixedWindowLimiter } = await import('../fixed-window');

globalThis.setTimeout = realSetTimeout as typeof setTimeout;
console.log = realLog;

for (const id of timeoutIds) clearTimeout(id);
timeoutIds.length = 0;

function take(check: () => Boolean, count: number) {
  return Array.from({ length: count }, () => check());
}

function allowedCount(check: () => Boolean, max: number) {
  let allowed = 0;
  while (allowed < max && check()) allowed++;
  return allowed;
}

afterEach(() => {
  jest.useRealTimers();
});

describe('fixed window', () => {
  test('stores the limit and window time passed to the constructor', () => {
    jest.useFakeTimers();
    const limiter = new FixedWindowLimiter({ time: 1_000, limit: 3 });

    expect(limiter.max_limit).toBe(3);
    expect(limiter.window_time).toBe(1_000);
  });

  test('allows a check while max_limit is above zero', () => {
    jest.useFakeTimers();
    const limiter = new FixedWindowLimiter({ time: 1_000, limit: 3 });

    expect(take(() => limiter.check(), 3)).toEqual([true, true, true]);
    expect(limiter.max_limit).toBe(0);
  });

  test('rejects once max_limit has reached zero', () => {
    jest.useFakeTimers();
    const limiter = new FixedWindowLimiter({ time: 1_000, limit: 3 });

    take(() => limiter.check(), 3);
    expect(limiter.check()).toBe(false);
    expect(limiter.check()).toBe(false);
  });

  test('defaults to a limit of 10 and a 6000ms window', () => {
    jest.useFakeTimers();
    const limiter = new FixedWindowLimiter({});

    expect(limiter.window_time).toBe(6_000);
    expect(take(() => limiter.check(), 10).every(Boolean)).toBe(true);
    expect(limiter.check()).toBe(false);
  });

  test('restores max_limit to the original limit when the window ends', () => {
    jest.useFakeTimers();
    const limiter = new FixedWindowLimiter({ time: 1_000, limit: 3 });

    take(() => limiter.check(), 3);
    jest.advanceTimersByTime(999);
    expect(limiter.max_limit).toBe(0);

    jest.advanceTimersByTime(1);
    expect(limiter.max_limit).toBe(3);
  });

  test('keeps the default window and restores the passed limit when no window time was passed', () => {
    jest.useFakeTimers();
    const limiter = new FixedWindowLimiter({ limit: 4 });

    limiter.check();
    expect(limiter.window_time).toBe(6_000);
    jest.advanceTimersByTime(6_000);
    expect(limiter.max_limit).toBe(4);
  });

  test('keeps a separate max_limit on each instance', () => {
    jest.useFakeTimers();
    const first = new FixedWindowLimiter({ time: 1_000, limit: 1 });
    const second = new FixedWindowLimiter({ time: 1_000, limit: 1 });

    expect(first.check()).toBe(true);
    expect(first.check()).toBe(false);
    expect(second.max_limit).toBe(1);
    expect(second.check()).toBe(true);
  });
});

describe('fixed window break scenarios', () => {
  test('a limit of 3 allows 3 checks, then rejects the 4th', () => {
    jest.useFakeTimers();
    const limiter = new FixedWindowLimiter({ time: 1_000, limit: 3 });

    expect(take(() => limiter.check(), 3)).toEqual([true, true, true]);
    expect(limiter.check()).toBe(false);
  });

  test('a limit of 0 rejects the first check', () => {
    jest.useFakeTimers();
    const limiter = new FixedWindowLimiter({ time: 1_000, limit: 0 });

    expect(limiter.check()).toBe(false);
  });

  test('the next window restores the original limit of 3, not the window duration', () => {
    jest.useFakeTimers();
    const limiter = new FixedWindowLimiter({ time: 1_000, limit: 3 });

    take(() => limiter.check(), 4);
    jest.advanceTimersByTime(1_000);

    expect(allowedCount(() => limiter.check(), 5)).toBe(3);
  });

  test('a second window resets the quota again after the first timeout', () => {
    jest.useFakeTimers();
    const limiter = new FixedWindowLimiter({ time: 1_000, limit: 2 });

    jest.advanceTimersByTime(1_000);
    limiter.max_limit = 0;

    jest.advanceTimersByTime(1_000);
    expect(limiter.max_limit).toBe(2);
  });

  test('traffic just before the boundary still counts only against that window', () => {
    jest.useFakeTimers();
    const limiter = new FixedWindowLimiter({ time: 1_000, limit: 1 });

    expect(limiter.check()).toBe(true);
    expect(limiter.check()).toBe(false);

    jest.advanceTimersByTime(1_000);
    expect(allowedCount(() => limiter.check(), 3)).toBe(1);
  });
});
