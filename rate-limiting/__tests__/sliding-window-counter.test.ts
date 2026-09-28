import { afterEach, describe, expect, jest, test } from 'bun:test';
import { SlidingWindowCounter } from '../sliding-window-counter';

function take(check: () => Boolean, count: number) {
  return Array.from({ length: count }, () => check());
}

afterEach(() => {
  jest.useRealTimers();
});

describe('sliding window counter', () => {
  test('allows checks taken at the current window start', () => {
    jest.useFakeTimers({ now: 0 });
    const limiter = new SlidingWindowCounter();

    expect(limiter.check()).toBe(true);
    expect(limiter.check()).toBe(true);
  });

  test('rejects after time has moved on while the previous count is still zero', () => {
    jest.useFakeTimers({ now: 0 });
    const limiter = new SlidingWindowCounter();

    jest.advanceTimersByTime(1);
    expect(limiter.check()).toBe(false);
  });

  test('does not change current_count when check runs', () => {
    jest.useFakeTimers({ now: 0 });
    const limiter = new SlidingWindowCounter();

    limiter.check();
    jest.advanceTimersByTime(1);
    limiter.check();
    expect(limiter.current_count).toBe(0);
  });

  test('rejects when the weighted previous count plus the current count reaches window_size', () => {
    jest.useFakeTimers({ now: 1_000 });
    const limiter = new SlidingWindowCounter();
    limiter.last_window_count = 50;
    limiter.current_count = 0;

    jest.advanceTimersByTime(5);
    expect(limiter.check()).toBe(false);

    limiter.current_count = 8;
    jest.setSystemTime(1_001);
    expect(limiter.check()).toBe(false);
  });

  test('allows when the weighted previous count plus the current count is under window_size', () => {
    jest.useFakeTimers({ now: 1_000 });
    const limiter = new SlidingWindowCounter();
    limiter.last_window_count = 50;
    limiter.current_count = 7;

    jest.advanceTimersByTime(1);
    expect(limiter.check()).toBe(true);
  });

  test('copies current_count into last_window_count after 10000ms', () => {
    jest.useFakeTimers({ now: 0 });
    const limiter = new SlidingWindowCounter();
    limiter.current_count = 4;

    jest.advanceTimersByTime(10_000);

    expect(limiter.last_window_count).toBe(4);
    expect(limiter.current_count).toBe(4);
    expect(limiter.current_window_start_time).toBe(10_000);
  });
});

describe('sliding window counter break scenarios', () => {
  test('allows 10 checks at the start of the window, then rejects the 11th', () => {
    jest.useFakeTimers({ now: 0 });
    const limiter = new SlidingWindowCounter();

    expect(take(() => limiter.check(), 10).every(Boolean)).toBe(true);
    expect(limiter.check()).toBe(false);
  });

  test('each allowed check increases current_count', () => {
    jest.useFakeTimers({ now: 0 });
    const limiter = new SlidingWindowCounter();

    expect(limiter.check()).toBe(true);
    expect(limiter.current_count).toBe(1);
  });

  test('a check 1ms later is still allowed when no request has been counted', () => {
    jest.useFakeTimers({ now: 0 });
    const limiter = new SlidingWindowCounter();

    jest.advanceTimersByTime(1);
    expect(limiter.check()).toBe(true);
  });

  test('a full previous window blocks the first check of the next window', () => {
    jest.useFakeTimers({ now: 0 });
    const limiter = new SlidingWindowCounter();

    take(() => limiter.check(), 10);
    jest.advanceTimersByTime(10_000);

    expect(limiter.last_window_count).toBe(10);
    expect(limiter.check()).toBe(false);
  });

  test('halfway through the next window, half of a full previous window has expired', () => {
    jest.useFakeTimers({ now: 0 });
    const limiter = new SlidingWindowCounter();

    take(() => limiter.check(), 10);
    jest.advanceTimersByTime(15_000);

    expect(take(() => limiter.check(), 5).every(Boolean)).toBe(true);
    expect(limiter.check()).toBe(false);
  });

  test('two windows later the old traffic is forgotten and 10 checks are allowed', () => {
    jest.useFakeTimers({ now: 0 });
    const limiter = new SlidingWindowCounter();

    take(() => limiter.check(), 10);
    jest.advanceTimersByTime(20_000);

    expect(take(() => limiter.check(), 10).every(Boolean)).toBe(true);
    expect(limiter.check()).toBe(false);
  });

  test('the window rolls again at 20000ms, not only at 10000ms', () => {
    jest.useFakeTimers({ now: 0 });
    const limiter = new SlidingWindowCounter();
    limiter.current_count = 3;

    jest.advanceTimersByTime(10_000);
    limiter.current_count = 5;
    jest.advanceTimersByTime(10_000);

    expect(limiter.last_window_count).toBe(5);
    expect(limiter.current_count).toBe(0);
    expect(limiter.current_window_start_time).toBe(20_000);
  });
});
