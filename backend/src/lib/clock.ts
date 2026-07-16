// src/lib/clock.ts
//
// Injectable clock. Time-dependent logic takes a Clock from its deps instead of
// reading the wall clock through `new Date()` / `Date.now()` directly, so tests
// can freeze time and assert on derived timestamps deterministically.

export interface Clock {
  /** Current instant as a Date. */
  now(): Date;
  /** Current instant as epoch milliseconds (equivalent to `Date.now()`). */
  timestamp(): number;
}

/** Production clock backed by the system wall clock. */
export const systemClock: Clock = {
  now: () => new Date(),
  timestamp: () => Date.now(),
};

/**
 * A clock frozen at a fixed instant, for tests. `now()` returns a fresh Date on
 * every call so callers may mutate the result without affecting the clock.
 */
export const fixedClock = (instant: Date | number | string): Clock => {
  const ms = new Date(instant).getTime();
  return {
    now: () => new Date(ms),
    timestamp: () => ms,
  };
};
