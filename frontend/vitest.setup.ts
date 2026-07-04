import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// ── Suppress noisy-but-expected warnings ────────────────────────────────────

// React Router v6 → v7 migration advisory warnings. These are informational only
// and appear on every MemoryRouter render in tests. Suppress them globally.
const _origWarn = console.warn.bind(console);
console.warn = (...args: unknown[]) => {
  if (typeof args[0] === 'string' && args[0].includes('React Router Future Flag Warning')) {
    return;
  }
  _origWarn(...args);
};

// jsdom does not support file-download navigation (anchor.click() with blob href).
// The component code is correct — this is a jsdom limitation, not a bug.
// jsdom writes this directly to process.stderr (bypasses console.error), so we
// intercept at the stream level.
const _origStderrWrite = process.stderr.write.bind(process.stderr);
// @ts-expect-error – narrowed overload; we only care about the string path
process.stderr.write = (chunk: unknown, ...rest: unknown[]): boolean => {
  if (typeof chunk === 'string' && chunk.includes('Not implemented: navigation')) return true;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (_origStderrWrite as any)(chunk, ...rest);
};

// Polyfill ResizeObserver — required by Radix UI components (Dialog, Checkbox, etc.)
// jsdom does not include ResizeObserver by default.
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Polyfill window.matchMedia — required by useReducedMotion hook and LoginPage.
// jsdom does not include matchMedia by default.
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Automatically clean up after each test
afterEach(() => {
  cleanup();
});
