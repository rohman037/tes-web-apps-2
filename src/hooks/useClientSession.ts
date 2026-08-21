'use client';

import { useCallback, useEffect, useState } from 'react';
import { getUserSession, UserSession } from '../lib/auth';
import { useClientHydration } from './useClientHydration';

function readOfficialSession(): UserSession | null {
  const current = getUserSession();
  if (current && current.code !== 'GUEST-ACCESS') {
    return current;
  }

  return null;
}

export function useClientSession() {
  const isHydrated = useClientHydration();
  const [session, setSession] = useState<UserSession | null>(() => readOfficialSession());

  const refreshSession = useCallback(() => {
    setSession(readOfficialSession());
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    refreshSession();

    window.addEventListener('satset_auth_updated', refreshSession);
    window.addEventListener('storage', refreshSession);

    return () => {
      window.removeEventListener('satset_auth_updated', refreshSession);
      window.removeEventListener('storage', refreshSession);
    };
  }, [isHydrated, refreshSession]);

  return {
    isHydrated,
    session,
    refreshSession,
  };
}
