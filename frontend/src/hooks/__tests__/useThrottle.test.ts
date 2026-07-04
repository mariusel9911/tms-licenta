import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from '@testing-library/react';
import { renderHookWithProviders } from '@/__tests__/helpers/render';
import { useThrottledCallback } from '../useThrottle';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useThrottledCallback()', () => {
  it('executes the callback on first call', () => {
    const fn = vi.fn().mockReturnValue('result');
    const { result } = renderHookWithProviders(() =>
      useThrottledCallback(fn, 500),
    );

    act(() => {
      result.current();
    });

    expect(fn).toHaveBeenCalledOnce();
  });

  it('suppresses calls within the delay window', () => {
    const fn = vi.fn();
    const { result } = renderHookWithProviders(() =>
      useThrottledCallback(fn, 500),
    );

    act(() => {
      result.current(); // fires
      result.current(); // suppressed
      result.current(); // suppressed
    });

    expect(fn).toHaveBeenCalledOnce();
  });

  it('fires again after the delay has elapsed', () => {
    const fn = vi.fn();
    const { result } = renderHookWithProviders(() =>
      useThrottledCallback(fn, 300),
    );

    act(() => {
      result.current(); // fires
    });

    act(() => {
      vi.advanceTimersByTime(300);
      result.current(); // fires again
    });

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('always uses the latest callback reference without resetting the timer', () => {
    const fn1 = vi.fn();
    const fn2 = vi.fn();

    const { result, rerender } = renderHookWithProviders(
      ({ cb }: { cb: () => void }) => useThrottledCallback(cb, 1000),
      { initialProps: { cb: fn1 } },
    );

    act(() => {
      result.current(); // fn1 fires, timer starts
    });

    // Re-render with a new callback — timer is NOT reset
    rerender({ cb: fn2 });

    act(() => {
      vi.advanceTimersByTime(1000);
      result.current(); // fires with fn2 after delay
    });

    expect(fn1).toHaveBeenCalledTimes(1);
    expect(fn2).toHaveBeenCalledTimes(1);
  });

  it('returns a stable function reference across renders when delay is unchanged', () => {
    const fn = vi.fn();
    const { result, rerender } = renderHookWithProviders(
      ({ cb }: { cb: () => void }) => useThrottledCallback(cb, 200),
      { initialProps: { cb: fn } },
    );

    const first = result.current;
    rerender({ cb: vi.fn() }); // different callback, same delay
    const second = result.current;

    // Same throttle instance (delay unchanged) → same outer useCallback reference
    expect(first).toBe(second);
  });

  it('creates a new throttle when delay changes', () => {
    const fn = vi.fn();
    const { result, rerender } = renderHookWithProviders(
      ({ delay }: { delay: number }) => useThrottledCallback(fn, delay),
      { initialProps: { delay: 200 } },
    );

    const first = result.current;
    rerender({ delay: 500 }); // delay changes → new throttle
    const second = result.current;

    expect(first).not.toBe(second);
  });
});
