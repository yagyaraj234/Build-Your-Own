export class SlidingWindowLog {
  window_size: number = 10;
  window_size_time: number = 10000; // in milliseconds
  window_logs: number[] = [];

  constructor({
    window_size,
    window_size_time,
  }: {
    window_size_time: number;
    window_size: number;
  }) {
    if (window_size) {
      this.window_size = window_size;
    }
    if (window_size_time) {
      this.window_size_time = window_size_time;
    }
  }

  check(): Boolean {
    const current_time = new Date().getTime();

    const logs = this.window_logs;

    for (let i = 0; i < logs.length; i++) {
      if (logs[i] < current_time - this.window_size_time) {
        logs.shift();
      } else {
        break;
      }
    }

    if (this.window_logs.length < this.window_size) {
      logs.push(current_time);
      return true;
    }

    return false;
  }
}

const rateLimit = new SlidingWindowLog({
  window_size: 10,
  window_size_time: 5000,
});

//  hit 11 request instant

console.log('Intial 11 request check \n');

for (let it = 0; it < 6; it++) {
  console.log(rateLimit.check());
}

// now hit after 2 seconds
setTimeout(() => {
  console.log('5 request check after 2 sec same window \n');
  for (let it = 0; it < 5; it++) {
    console.log(rateLimit.check());
  }
}, 2000);

//  now check again after 5 sec
setTimeout(() => {
  console.log('check again only 5 should success rest fail');
  for (let it = 0; it < 10; it++) {
    console.log(rateLimit.check());
  }
}, 5000);
