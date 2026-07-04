import { useRef, useCallback, useMemo } from 'react';
import { throttle } from '@/utils/throttle';

/**
 * React hook that returns a throttled version of a callback.
 * The throttled function executes at most once per `delay` ms.
 *
 * The throttle instance is stable across renders. When the callback
 * reference changes, the next invocation uses the latest callback
 * without resetting the throttle timer.
 */
export function useThrottledCallback<T extends (...args: never[]) => unknown>(
  callback: T,
  delay: number = 1000,
): (...args: Parameters<T>) => ReturnType<T> | undefined {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const throttled = useMemo(
    () => throttle((...args: Parameters<T>) => callbackRef.current(...args), delay),
    [delay],
  );

  return useCallback(
    (...args: Parameters<T>) => throttled(...args) as ReturnType<T> | undefined,
    [throttled],
  );
}
