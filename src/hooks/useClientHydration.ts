'use client';

import { useSyncExternalStore } from 'react';

function subscribe() {
  return () => {};
}

/**
 * Hook to ensure client-only execution and prevent Next.js hydration mismatches.
 * Returns true once the component has successfully mounted on the browser client.
 */
export function useClientHydration(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false
  );
}
