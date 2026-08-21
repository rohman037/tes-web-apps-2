'use client';

import { useEffect, useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

export type PublicViewType = 'login' | 'pricing';
export type AdminViewType = 'admin_dashboard' | 'workspace';
export type WorkspaceTabType = 'tiktok' | 'prompt' | 'photo' | 'ideas' | 'shop_ideas' | 'extractor' | 'paket' | 'pengaturan';

export function useAppNavigation(
  session: any,
  publicView: PublicViewType,
  setPublicView: (view: PublicViewType) => void,
  adminViewMode: AdminViewType,
  setAdminViewMode: (mode: AdminViewType) => void
) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Sinkronisasi dari URL ke React State pada initial load & browser popstate (Back/Forward)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleLocationSync = () => {
      const path = window.location.pathname;
      const params = new URLSearchParams(window.location.search);
      const viewParam = params.get('view');

      if (path === '/pricing' || viewParam === 'pricing') {
        setPublicView('pricing');
      } else if (path === '/login' || path === '/') {
        setPublicView('login');
      }

      if (path.startsWith('/admin') || viewParam === 'admin') {
        setAdminViewMode('admin_dashboard');
      } else if (path.startsWith('/workspace') || path.startsWith('/tools')) {
        setAdminViewMode('workspace');
      }
    };

    handleLocationSync();
    window.addEventListener('popstate', handleLocationSync);
    return () => {
      window.removeEventListener('popstate', handleLocationSync);
    };
  }, [setPublicView, setAdminViewMode]);

  // Helper untuk update URL tanpa trigger full reload
  const navigateTo = useCallback((path: string, search?: Record<string, string>) => {
    if (typeof window === 'undefined') return;
    
    let url = path;
    if (search) {
      const q = new URLSearchParams(search).toString();
      if (q) url += `?${q}`;
    }

    if (window.location.pathname !== path || (search && window.location.search !== `?${new URLSearchParams(search).toString()}`)) {
      window.history.pushState(null, '', url);
    }
  }, []);

  return {
    pathname,
    searchParams,
    navigateTo,
  };
}
