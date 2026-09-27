type Input = {
  id: string;
  password: string;
};

type KeyValue = {
  value: any;
  created_at: Date;
  expire_at?: Date;
};

type SET_INPUT = string | number;

type ExpiryEnum = 'PX' | 'EX';

//  PX -> milliseconds
//  EX -> seconds

export class Redis {
  protected id: Input['id'] = '';
  protected password: Input['password'] = '';
  private expiry_keys: Record<string, string[]> = {};
  private mp: Record<string, KeyValue> = {};

  constructor(input: Input) {
    this.id = input.id;
    this.password = input.password;
    this.cron();
  }

  cron() {
    setInterval(() => {
      const curr = new Date().toString();

      if (this.expiry_keys[curr]) {
        console.log('deleteing in cron ---> ', this.expiry_keys[curr].join(', '));
      }
    }, 1000);
  }
  //  get individual key values
  get(key: string) {
    const result = this.mp[key];
    if (!result) {
      return null;
    }

    //  now check is expired;
    if (result.expire_at) {
      const curr = new Date();
      if (curr > result.expire_at) {
        this.delete(key);
        this.remove_from_expire_keys(key);
        return null;
      }
    }

    return this.mp[key].value;
  }
  //  returns the values of keys
  mGet(keys: string[]): any[] {
    return keys.map((k) => this.get(k));
  }

  //  set key and value
  set(key: string, value: SET_INPUT, expiry?: ExpiryEnum, exp_value?: number): Boolean | Error {
    if (!key) {
      throw new Error('Please pass key');
    }

    this.mp[key] = {
      value,
      created_at: new Date(),
    };

    if (exp_value) {
      this.setExpiry(key, exp_value, expiry, value);
    }
    return true;
  }

  //  increament the value of key if not exist first create key with 0 and then increment
  inc(key: string): number | null {
    const existing = this.mp[key];
    if (existing) {
      const num = Number(existing.value);
      if (Number.isNaN(num)) return null;
      this.mp[key].value = num + 1;
      return this.mp[key].value;
    }
    this.set(key, 1);
    return 1;
  }
  // delete key
  delete(key: string): Boolean {
    if (!this.mp[key]) {
      return false;
    }
    delete this.mp[key];
    this.remove_from_expire_keys(key);
    return true;
  }
  //  returns all the keys matching all the patterns
  keys(pattern: RegExp): string[] {
    const keys = Object.keys(this.mp);
    const result = keys.filter((key) => pattern.test(key));
    return result;
  }

  //  check if key exist or not
  exists(key: string) {
    const current_datetime = new Date();
    const value = this.mp[key];
    if (!value) return false;

    if (value?.expire_at && value?.expire_at < current_datetime) {
      return false;
    }
    return true;
  }
  //  add expiry of any key
  expire(key: string, timeout: number) {
    if (this.mp[key]) {
      this.setExpiry(key, timeout);
      return true;
    }
    return false;
  }
  //  returns how much time left to expire in seconds
  ttl(key: string): number {
    const exist = this.mp[key];
    if (!exist) return -2;
    if (!exist.expire_at) return -1;
    const msLeft = exist.expire_at.getTime() - Date.now();
    return msLeft > 0 ? Math.ceil(msLeft / 1000) : -2;
  }

  // remove expiry from the key

  persist(key: string): Boolean {
    const exist = this.mp[key];
    if (exist && exist.expire_at) {
      this.expiry_keys[exist.expire_at.toString()].filter((it: string) => it !== key);
      this.mp[key].expire_at = undefined;
      return true;
    }

    return false;
  }

  //  helper
  //  -----> it set's the key expiry date/time
  protected setExpiry(
    key: string,
    expiry: number,
    timeout_type: 'EX' | 'PX' = 'EX',
    value?: SET_INPUT,
  ) {
    const currentDate = new Date();
    const toAdd = timeout_type !== 'EX' ? expiry * 60 * 1000 : expiry;
    const futureDate = new Date(currentDate.getTime() + toAdd);

    if (value) {
      this.mp[key] = {
        value,
        created_at: new Date(),
        expire_at: expiry ? futureDate : undefined,
      };
    } else {
      this.mp[key].expire_at = futureDate;
    }

    const time = futureDate.toString();
    if (this.expiry_keys[time]) {
      this.expiry_keys[time].push(key);
    } else {
      this.expiry_keys[time] = [key];
    }
  }

  protected remove_from_expire_keys(key: string) {
    const expire_at = this.mp[key]?.expire_at?.toString();

    if (expire_at && this.expiry_keys[expire_at]) {
      this.expiry_keys[expire_at].filter((k) => k != key);
    }
  }
}

export const redis = new Redis({
  id: 'fdjkfndsk',
  password: 'fdknjfd',
});

// console.log('insert ', redis.set('key', 'value', 'PX', 5000));
// redis.set('myname', 'item');
// redis.set('mypeople', 'item');

const regex = new RegExp('my*', 'i');

// console.log(redis.keys(regex));

// setInterval(() => {
//   console.log('retrieve ', redis.get('key'));
// }, 1100);
// console.log('delete ', redis.delete('key'));
// console.log('retrieve after deleting ', redis.get('key'));

// redis.set('myname', 'a', 'PX', 60_000);
// redis.set('mypeople', 'b', 'PX', 60_000);
// redis.set('other', 'c', 'PX', 60_000);
// console.log(redis.keys(regex).sort());

// redis.set('name', 'yagya', 'PX', 60_000);

// redis.inc('name');
// console.log(redis.get('name'));

// redis.set('name', 'yagya', 'PX', 1000);

redis.set('name', 'yagya', 'PX', 5_000);
const ttl = redis.ttl('name');

console.log('tt;l -->', ttl);
