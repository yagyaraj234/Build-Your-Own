export class FixedWindowLimiter {
  max_limit: number = 10;
  window_time: number = 6000; // in miliseconds

  constructor({ time, limit }: { time?: number; limit?: number }) {
    if (time) {
      this.window_time = time;
    }
    if (limit) {
      this.max_limit = limit;
    }
    setTimeout(() => {
      this.max_limit = time || 10;
    }, this.window_time);
  }

  check(): Boolean {
    if (this.max_limit >= 0) {
      this.max_limit--;
      return true;
    }
    return false;
  }
}

const rate = new FixedWindowLimiter({});

for (let i = 0; i < 15; i++) {
  console.log(rate.check());
}

setTimeout(() => {
  console.log('\n after delay \n');
  for (let i = 0; i < 15; i++) {
    console.log(rate.check());
  }
}, 7500);
