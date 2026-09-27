import { afterEach, describe, expect, test } from 'bun:test';

const intervalIds: ReturnType<typeof setInterval>[] = [];
const realSetInterval = globalThis.setInterval.bind(globalThis);

function trackIntervals<T>(run: () => T): T {
  const previous = globalThis.setInterval;
  globalThis.setInterval = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
    const id = realSetInterval(handler, timeout, ...args);
    intervalIds.push(id);
    return id;
  }) as typeof setInterval;

  try {
    return run();
  } finally {
    globalThis.setInterval = previous;
  }
}

const realLog = console.log;
console.log = () => {};
const { Redis } = await trackIntervals(() => import('..'));
console.log = realLog;

function createClient() {
  return trackIntervals(
    () =>
      new Redis({
        id: 'test-id',
        password: 'test-password',
      }),
  );
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

afterEach(() => {
  for (const id of intervalIds) clearInterval(id);
  intervalIds.length = 0;
});

describe('set', () => {
  test('stores a value with no expiry', () => {
    const redis = createClient();

    expect(redis.set('name', 'yagya')).toBe(true);
    expect(redis.get('name')).toBe('yagya');
  });

  test('stores a value with a PX timeout', () => {
    const redis = createClient();

    expect(redis.set('name', 'yagya', 'PX', 5_000)).toBe(true);
    expect(redis.get('name')).toBe('yagya');
  });

  test('stores 0', () => {
    const redis = createClient();

    expect(redis.set('count', 0)).toBe(true);
    expect(redis.get('count')).toBe(0);
  });

  test('stores 0 with a PX timeout', () => {
    const redis = createClient();

    expect(redis.set('count', 0, 'PX', 1_000)).toBe(true);
    expect(redis.get('count')).toBe(0);
  });

  test('stores an empty string with a PX timeout', () => {
    const redis = createClient();

    expect(redis.set('blank', '', 'PX', 1_000)).toBe(true);
    expect(redis.get('blank')).toBe('');
  });

  test('throws when the key is empty', () => {
    const redis = createClient();

    expect(() => redis.set('', 'value')).toThrow('Please pass key');
  });

  test('replaces the previous value', () => {
    const redis = createClient();

    redis.set('name', 'first', 'PX', 60_000);
    redis.set('name', 'second', 'PX', 60_000);

    expect(redis.get('name')).toBe('second');
  });

  test('EX expires in seconds', async () => {
    const redis = createClient();

    redis.set('name', 'yagya', 'EX', 1);

    await wait(200);
    expect(redis.get('name')).toBe('yagya');

    await wait(1_300);
    expect(redis.get('name')).toBeNull();
  });
});

describe('get', () => {
  test('returns null for a missing key', () => {
    const redis = createClient();

    expect(redis.get('missing')).toBeNull();
  });

  test('returns null after a PX timeout', async () => {
    const redis = createClient();

    redis.set('name', 'yagya', 'PX', 30);
    await wait(80);

    expect(redis.get('name')).toBeNull();
    expect(redis.exists('name')).toBe(false);
  });
});

describe('mGet', () => {
  test('returns values in key order', () => {
    const redis = createClient();

    redis.set('a', 'one', 'PX', 60_000);
    redis.set('b', 2, 'PX', 60_000);

    expect(redis.mGet(['b', 'missing', 'a'])).toEqual([2, null, 'one']);
  });
});

describe('inc', () => {
  test('starts a missing key at 1', () => {
    const redis = createClient();

    expect(redis.inc('counter')).toBe(1);
    expect(redis.get('counter')).toBe(1);
  });

  test('adds 1 to an existing number', () => {
    const redis = createClient();

    redis.set('counter', 1, 'PX', 60_000);

    expect(redis.inc('counter')).toBe(2);
    expect(redis.inc('counter')).toBe(3);
    expect(redis.get('counter')).toBe(3);
  });

  test('increments a stored 0 to 1', () => {
    const redis = createClient();

    redis.set('counter', 0, 'PX', 60_000);

    expect(redis.inc('counter')).toBe(1);
    expect(redis.get('counter')).toBe(1);
  });

  test('returns null for a non-number and leaves it unchanged', () => {
    const redis = createClient();

    redis.set('name', 'yagya', 'PX', 60_000);

    expect(redis.inc('name')).toBeNull();
    expect(redis.get('name')).toBe('yagya');
  });
});

describe('delete', () => {
  test('removes an existing key', () => {
    const redis = createClient();

    redis.set('name', 'yagya', 'PX', 60_000);

    expect(redis.delete('name')).toBe(true);
    expect(redis.get('name')).toBeNull();
    expect(redis.exists('name')).toBe(false);
  });

  test('returns false for a missing key', () => {
    const redis = createClient();

    expect(redis.delete('missing')).toBe(false);
  });
});

describe('keys', () => {
  test('returns keys that match the pattern', () => {
    const redis = createClient();

    redis.set('myname', 'a', 'PX', 60_000);
    redis.set('mypeople', 'b', 'PX', 60_000);
    redis.set('other', 'c', 'PX', 60_000);
    const regex = new RegExp('my*', 'i');
    expect(redis.keys(regex).sort()).toEqual(['myname', 'mypeople']);
  });

  test('returns an empty list when nothing matches', () => {
    const redis = createClient();

    redis.set('alpha', 'a', 'PX', 60_000);

    expect(redis.keys(/zzz/)).toEqual([]);
  });
});

describe('exists', () => {
  test('is false for a missing key', () => {
    const redis = createClient();

    expect(redis.exists('missing')).toBe(false);
  });

  test('is true for a stored key', () => {
    const redis = createClient();

    redis.set('name', 'yagya', 'PX', 60_000);

    expect(redis.exists('name')).toBe(true);
  });

  test('is false after the key expires', async () => {
    const redis = createClient();

    redis.set('name', 'yagya', 'PX', 30);
    await wait(80);

    expect(redis.exists('name')).toBe(false);
  });
});

describe('expire', () => {
  test('returns false for a missing key', () => {
    const redis = createClient();

    expect(redis.expire('missing', 1)).toBe(false);
  });

  test('expires an existing key in seconds', async () => {
    const redis = createClient();

    redis.set('name', 'yagya');
    expect(redis.expire('name', 1)).toBe(true);

    await wait(200);
    expect(redis.get('name')).toBe('yagya');

    await wait(1_300);
    expect(redis.get('name')).toBeNull();
  });
});

describe('ttl', () => {
  test('returns -2 for a missing key', () => {
    const redis = createClient();

    expect(redis.ttl('missing')).toBe(-2);
  });

  test('returns the remaining time in seconds', () => {
    const redis = createClient();

    redis.set('name', 'yagya', 'PX', 5_000);
    const ttl = redis.ttl('name');

    expect(ttl).toBeGreaterThan(4);
    expect(ttl).toBeLessThanOrEqual(5);
  });

  test('returns -2 once the key has expired', async () => {
    const redis = createClient();

    redis.set('name', 'yagya', 'PX', 30);
    await wait(80);

    expect(redis.ttl('name')).toBe(-2);
  });

  test('returns -1 after persist removes the expiry', () => {
    const redis = createClient();

    redis.set('name', 'yagya', 'PX', 60_000);
    redis.persist('name');

    expect(redis.ttl('name')).toBe(-1);
    expect(redis.get('name')).toBe('yagya');
  });
});

describe('persist', () => {
  test('keeps the key past the original deadline', async () => {
    const redis = createClient();

    redis.set('name', 'yagya', 'PX', 40);
    expect(redis.persist('name')).toBe(true);

    await wait(80);

    expect(redis.get('name')).toBe('yagya');
  });

  test('returns false when the key has no expiry', () => {
    const redis = createClient();

    redis.set('name', 'yagya', 'PX', 60_000);
    redis.persist('name');

    expect(redis.persist('name')).toBe(false);
  });

  test('returns false for a missing key', () => {
    const redis = createClient();

    expect(redis.persist('missing')).toBe(false);
  });
});

describe('expiry cleanup', () => {
  test('drops an expired key without reading it first', async () => {
    const redis = createClient();

    redis.set('name', 'yagya', 'PX', 50);
    await wait(1_200);

    expect(redis.keys(/^name$/)).toEqual([]);
  });

  test('a replaced expiry does not expire at the old deadline', async () => {
    const redis = createClient();

    redis.set('name', 'first', 'PX', 40);
    redis.set('name', 'second', 'PX', 5_000);

    await wait(80);

    expect(redis.get('name')).toBe('second');
  });
});
