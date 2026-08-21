'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AppLoadingScreen from './AppLoadingScreen';
import { useClientSession } from '../../hooks/useClientSession';
import { useSatsetRuntime } from '../../hooks/useSatsetRuntime';

export default function RootPageShell() {
  const router = useRouter();
  const { isHydrated, session } = useClientSession();

  useSatsetRuntime();

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    if (!session) {
      router.replace('/login');
      return;
    }

    router.replace(session.role === 'admin' ? '/admin' : '/workspace');
  }, [isHydrated, router, session]);

  return <AppLoadingScreen tone="dark" />;
}
