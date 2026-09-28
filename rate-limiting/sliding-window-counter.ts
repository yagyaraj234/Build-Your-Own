export class SlidingWindowCounter {
  window_size: number = 10;
  current_count: number = 0;
  last_window_count: number = 0;
  window_time: number = 10000;
  current_window_start_time: number;

  constructor() {
    this.current_window_start_time = new Date().getTime();

    setTimeout(() => {
      this.last_window_count = this.current_count;
      this.current_window_start_time = new Date().getTime();
    }, 10000);
  }

  check(): Boolean {
    const current_time = new Date().getTime();
    const current_span = current_time - this.current_window_start_time;

    let from_last_window = (current_span / this.last_window_count) * 100;

    if (from_last_window + this.current_count >= this.window_size) {
      return false;
    }

    return true;
  }
}
