/**
 * Creates a throttled version of a function that only executes once per `delay` ms.
 * Unlike debounce (which delays execution), throttle ensures a regular, controlled
 * execution pattern — the function fires immediately on the first call, then ignores
 * subsequent calls until the delay window has elapsed.
 */
export function throttle<T extends (...args: never[]) => unknown>(
  callback: T,
  delay: number = 1000,
): (...args: Parameters<T>) => ReturnType<T> | undefined {
  let lastCall = 0;
  return (...args: Parameters<T>): ReturnType<T> | undefined => {
    const now = Date.now();
    if (now - lastCall < delay) return undefined;
    lastCall = now;
    return callback(...args) as ReturnType<T>;
  };
}
