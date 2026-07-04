/**
 * Prefetches all lazy-loaded route chunks in the background after
 * the authenticated layout mounts. Uses requestIdleCallback (with
 * setTimeout fallback) so prefetching never blocks user interaction.
 */

import { useEffect } from 'react';

// Partners/Vehicles/Orders are eagerly imported by AppLayout — no prefetch needed.
const routeImports = [
  () => import('@/pages/SettingsPage'),
  () => import('@/pages/StatisticsPage'),
  () => import('@/pages/NotFoundPage'),
  () => import('@/components/ai/ChatWidget'),
];

export function usePrefetchRoutes() {
  useEffect(() => {
    const schedule =
      typeof window.requestIdleCallback === 'function'
        ? window.requestIdleCallback
        : (cb: () => void) => window.setTimeout(cb, 2000);

    const id = schedule(() => {
      routeImports.forEach(importFn => {
        importFn().catch(() => {
          // Silently ignore — if a chunk fails to prefetch
          // it will be fetched on-demand when the user navigates.
        });
      });
    });

    return () => {
      if (typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(id as number);
      } else {
        window.clearTimeout(id as number);
      }
    };
  }, []);
}
