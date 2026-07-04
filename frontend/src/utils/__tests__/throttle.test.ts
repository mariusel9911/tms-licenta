import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { throttle } from '../throttle';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('throttle()', () => {
  it('executes the callback on the first call and returns its value', () => {
    const fn = vi.fn().mockReturnValue(42);
    const throttled = throttle(fn, 1000);

    const result = throttled('arg1');

    expect(fn).toHaveBeenCalledOnce();
    expect(fn).toHaveBeenCalledWith('arg1');
    expect(result).toBe(42);
  });

  it('returns undefined and does NOT call the callback within the delay window', () => {
    const fn = vi.fn().mockReturnValue('value');
    const throttled = throttle(fn, 1000);

    throttled(); // first call — executes
    const result = throttled(); // within delay — suppressed

    expect(fn).toHaveBeenCalledOnce();
    expect(result).toBeUndefined();
  });

  it('executes again after the delay has elapsed', () => {
    const fn = vi.fn().mockReturnValue('ok');
    const throttled = throttle(fn, 500);

    throttled(); // fires immediately
    vi.advanceTimersByTime(500); // advance past the delay
    throttled(); // should fire again

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('passes all arguments through to the callback', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 200);

    throttled(1, 2, 3);

    expect(fn).toHaveBeenCalledWith(1, 2, 3);
  });

  it('uses a default delay of 1000 ms when none is provided', () => {
    const fn = vi.fn();
    const throttled = throttle(fn); // no delay arg

    throttled();
    vi.advanceTimersByTime(999);
    throttled(); // still within 1000 ms window — suppressed

    expect(fn).toHaveBeenCalledOnce();

    vi.advanceTimersByTime(1); // now 1000 ms have passed
    throttled();

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('each throttle() call produces an independent timer', () => {
    const fn = vi.fn();
    const t1 = throttle(fn, 1000);
    const t2 = throttle(fn, 1000);

    t1(); // fires on t1
    t2(); // fires on t2 (independent timer)

    expect(fn).toHaveBeenCalledTimes(2);
  });
});
