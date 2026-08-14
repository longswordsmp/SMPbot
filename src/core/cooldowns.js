'use strict';

/**
 * In-memory cooldown / rate-limit tracker. Keys are free-form strings, e.g.
 * `cmd:giveaway:12345:67890` or `ticket:open:guild:user`. Also provides
 * sliding-window counters used by the security and automod engines.
 */
class CooldownManager {
  constructor() {
    this.expiries = new Map(); // key -> expiry ms epoch
    this.windows = new Map(); // key -> number[] of ms timestamps
    // Periodic sweep so long-running processes don't leak memory.
    this._sweeper = setInterval(() => this.sweep(), 10 * 60 * 1000);
    if (this._sweeper.unref) this._sweeper.unref();
  }

  /**
   * Check-and-set a cooldown. Returns 0 if the action is allowed (and starts
   * the cooldown), otherwise the remaining ms.
   */
  hit(key, seconds) {
    const now = Date.now();
    const expiry = this.expiries.get(key);
    if (expiry && expiry > now) return expiry - now;
    this.expiries.set(key, now + seconds * 1000);
    return 0;
  }

  /** Remaining ms without setting anything. */
  remaining(key) {
    const expiry = this.expiries.get(key);
    return expiry && expiry > Date.now() ? expiry - Date.now() : 0;
  }

  clear(key) {
    this.expiries.delete(key);
    this.windows.delete(key);
  }

  /**
   * Sliding-window counter: record one event and return how many events
   * occurred within the past `windowMs`. Used for thresholds like
   * "5 channel deletions within 60s".
   */
  count(key, windowMs) {
    const now = Date.now();
    let arr = this.windows.get(key);
    if (!arr) {
      arr = [];
      this.windows.set(key, arr);
    }
    arr.push(now);
    const cutoff = now - windowMs;
    while (arr.length && arr[0] < cutoff) arr.shift();
    return arr.length;
  }

  /** Peek at a window count without recording an event. */
  peek(key, windowMs) {
    const arr = this.windows.get(key);
    if (!arr) return 0;
    const cutoff = Date.now() - windowMs;
    return arr.filter((t) => t >= cutoff).length;
  }

  sweep() {
    const now = Date.now();
    for (const [key, expiry] of this.expiries) {
      if (expiry <= now) this.expiries.delete(key);
    }
    const cutoff = now - 60 * 60 * 1000;
    for (const [key, arr] of this.windows) {
      while (arr.length && arr[0] < cutoff) arr.shift();
      if (!arr.length) this.windows.delete(key);
    }
  }
}

module.exports = { CooldownManager };
