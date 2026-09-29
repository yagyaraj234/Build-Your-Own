type Config = {
  limit: number;
  max_limit: number;
};

export class RateLimitter {
  user_limits: Record<string, number> = {};
  limit: Config['limit'] = 0;
  max_limit: Config['max_limit'] = 0;
  constructor(config: Config) {
    this.limit = config.limit;
    this.max_limit = config.max_limit;
  }

  protected curr_limit(unique_id: string) {
    this.check_user(unique_id);
    return this.user_limits[unique_id];
  }

  protected check_user(unique_id: string) {
    if (!(unique_id in this.user_limits)) {
      this.user_limits[unique_id] = this.limit;
    }
    return true;
  }

  decrement(unique_id: string): number {
    const limit = this.curr_limit(unique_id);
    if (limit > 0) {
      this.user_limits[unique_id] = limit - 1;
      return limit - 1;
    }
    return 0;
  }
  increment(unique_id: string, value: number): number {
    const next = Math.min(this.curr_limit(unique_id) + value, this.max_limit);
    this.user_limits[unique_id] = next;
    return next;
  }
  user_limit(unique_id: string) {
    return this.curr_limit(unique_id);
  }
}
