import { RateLimitter } from './limitter';

export class FixedWindowLimiter extends RateLimitter {
  window_time: number = 6000; // in miliseconds

  constructor({ time, limit = 10 }: { time?: number; limit?: number } = {}) {
    super({
      limit,
      max_limit: limit,
    });
    if (time !== undefined) {
      this.window_time = time;
    }
    this.max_limit = limit;
    this.resetLimit();
  }

  protected resetLimit() {
    setInterval(() => {
      this.max_limit = this.limit;
      for (const id of Object.keys(this.user_limits)) {
        this.user_limits[id] = this.limit;
      }
    }, this.window_time);
  }

  check(): Boolean {
    if (this.max_limit > 0) {
      this.max_limit -= 1;
      return true;
    }
    return false;
  }

  allow(ip: string): Boolean {
    if (this.curr_limit(ip) > 0) {
      this.decrement(ip);
      return true;
    }
    return false;
  }
}

const rate = new FixedWindowLimiter({
  limit: 10,
  time: 6000,
});

for (let i = 0; i < 15; i++) {
  console.log(rate.allow('abc'));
}

setInterval(() => {
  console.log('\n after delay \n');
  for (let i = 0; i < 8; i++) {
    console.log(rate.allow('abc'));
  }
}, 3000);
