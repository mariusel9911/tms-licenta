import { QueryClient } from '@tanstack/react-query';

/**
 * Create a QueryClient configured for tests:
 * - retries disabled (fail fast)
 * - no stale time (always refetch)
 * - no caching between tests
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });
}
