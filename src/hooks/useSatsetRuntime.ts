'use client';

import { useEffect } from 'react';
import { initRealtimeSync } from '../lib/realtimeSync';
import { initCrossTabSync } from '../lib/crossTabSync';

export function useSatsetRuntime() {
  useEffect(() => {
    const cleanupRealtime = initRealtimeSync();
    const cleanupCrossTab = initCrossTabSync();

    return () => {
      cleanupRealtime();
      cleanupCrossTab();
    };
  }, []);
}
