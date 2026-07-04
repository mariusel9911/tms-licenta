import React from 'react';
import { render, renderHook } from '@testing-library/react';
import type { RenderOptions, RenderHookOptions } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { createTestQueryClient } from './query-client';

interface WrapperProps {
  children: React.ReactNode;
}

/**
 * Creates the standard test wrapper: QueryClientProvider + MemoryRouter.
 * A fresh QueryClient is created per call to prevent cache bleeding between tests.
 */
function createWrapper(initialEntries: string[] = ['/']) {
  const queryClient = createTestQueryClient();

  function Wrapper({ children }: WrapperProps) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter
          initialEntries={initialEntries}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          {children}
        </MemoryRouter>
      </QueryClientProvider>
    );
  }

  return { Wrapper, queryClient };
}

/**
 * Render a component with all standard providers.
 * Use this instead of RTL's bare `render()` in most component tests.
 */
export function renderWithProviders(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'> & { initialEntries?: string[] },
) {
  const { initialEntries, ...renderOptions } = options ?? {};
  const { Wrapper, queryClient } = createWrapper(initialEntries);
  return { ...render(ui, { wrapper: Wrapper, ...renderOptions }), queryClient };
}

/**
 * Render a hook with all standard providers (QueryClient + Router).
 * Use this for testing React Query hooks.
 */
export function renderHookWithProviders<TResult, TProps>(
  hook: (props: TProps) => TResult,
  options?: Omit<RenderHookOptions<TProps>, 'wrapper'> & { initialEntries?: string[] },
) {
  const { initialEntries, ...hookOptions } = options ?? {};
  const { Wrapper, queryClient } = createWrapper(initialEntries);
  return { ...renderHook(hook, { wrapper: Wrapper, ...hookOptions }), queryClient };
}
