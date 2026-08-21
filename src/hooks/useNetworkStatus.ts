'use client';

import { useState, useEffect } from 'react';

export interface NetworkStatus {
  isOnline: boolean;
  wasOffline: boolean;
  effectiveType?: string;
  rtt?: number;
}

export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [wasOffline, setWasOffline] = useState<boolean>(false);
  const [effectiveType, setEffectiveType] = useState<string | undefined>(undefined);
  const [rtt, setRtt] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const updateOnlineStatus = () => {
      const online = navigator.onLine;
      setIsOnline(online);
      if (!online) {
        setWasOffline(true);
      }
    };

    const updateConnectionInfo = () => {
      const nav = navigator as unknown as { connection?: { effectiveType?: string; rtt?: number; addEventListener?: (type: string, listener: () => void) => void; removeEventListener?: (type: string, listener: () => void) => void } };
      if (nav.connection) {
        setEffectiveType(nav.connection.effectiveType);
        setRtt(nav.connection.rtt);
      }
    };

    updateOnlineStatus();
    updateConnectionInfo();

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    const nav = navigator as unknown as { connection?: { addEventListener?: (type: string, listener: () => void) => void; removeEventListener?: (type: string, listener: () => void) => void } };
    if (nav.connection && nav.connection.addEventListener) {
      nav.connection.addEventListener('change', updateConnectionInfo);
    }

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
      if (nav.connection && nav.connection.removeEventListener) {
        nav.connection.removeEventListener('change', updateConnectionInfo);
      }
    };
  }, []);

  return { isOnline, wasOffline, effectiveType, rtt };
}
