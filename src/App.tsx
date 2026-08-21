'use client';

import React, { useState, useEffect, Suspense } from 'react';
import LoginView from './components/views/LoginView';
import PaketAksesView from './components/views/PaketAksesView';
import AdminDashboardView from './components/views/AdminDashboardView';
import UserLayout from './components/layouts/UserLayout';
import { getUserSession, logoutUser, UserSession } from './lib/auth';
import { initRealtimeSync } from './lib/realtimeSync';
import { initCrossTabSync } from './lib/crossTabSync';
import { useAppNavigation, PublicViewType, AdminViewType } from './hooks/useAppNavigation';

import { useClientHydration } from './hooks/useClientHydration';

function AppContent({ initialView, initialTab }: { initialView?: string; initialTab?: string }) {
  const isHydrated = useClientHydration();
  const [session, setSession] = useState<UserSession | null>(() => {
    const current = getUserSession();
    if (current && current.code !== 'GUEST-ACCESS') {
      return current;
    }
    return null;
  });
  const [publicView, setPublicView] = useState<PublicViewType>(() => {
    if (initialView === 'pricing') return 'pricing';
    return 'login';
  });
  const [adminViewMode, setAdminViewMode] = useState<AdminViewType>(() => {
    if (initialView === 'admin') return 'admin_dashboard';
    if (initialView === 'workspace') return 'workspace';
    return 'admin_dashboard';
  });

  const { navigateTo } = useAppNavigation(session, publicView, setPublicView, adminViewMode, setAdminViewMode);

  useEffect(() => {
    // Initialize central real-time sync (SSE Manager) & Cross-Tab Sync
    const cleanupRealtime = initRealtimeSync();
    const cleanupCrossTab = initCrossTabSync();

    // Sync Local Auth Event
    const handleAuthUpdate = () => {
      const current = getUserSession();
      if (current && current.code !== 'GUEST-ACCESS') {
        setSession(current);
      } else {
        setSession(null);
      }
    };

    window.addEventListener('satset_auth_updated', handleAuthUpdate);
    window.addEventListener('storage', handleAuthUpdate);

    return () => {
      cleanupRealtime();
      cleanupCrossTab();
      window.removeEventListener('satset_auth_updated', handleAuthUpdate);
      window.removeEventListener('storage', handleAuthUpdate);
    };
  }, []);

  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#5b50e5]" />
      </div>
    );
  }

  const handleLogout = () => {
    logoutUser();
    setSession(null);
    setPublicView('login');
    navigateTo('/login');
  };

  const handleNavigateToPricing = () => {
    setPublicView('pricing');
    navigateTo('/pricing');
  };

  const handleNavigateToLogin = () => {
    setPublicView('login');
    navigateTo('/login');
  };

  const handleGoToWorkspace = () => {
    setAdminViewMode('workspace');
    navigateTo('/workspace');
  };

  const handleGoToAdmin = () => {
    setAdminViewMode('admin_dashboard');
    navigateTo('/admin');
  };

  // Proteksi: Jika belum ada session resmi atau terdeteksi guest access, render tampilan publik
  if (!session || session.code === 'GUEST-ACCESS') {
    if (publicView === 'pricing') {
      return (
        <div className="min-h-screen bg-[#fcf8ff] p-4 sm:p-8">
          <PaketAksesView
            onBackToLogin={handleNavigateToLogin}
            onSuccessLogin={() => {
              const current = getUserSession();
              if (current && current.code !== 'GUEST-ACCESS') {
                setSession(current);
                setPublicView('login');
                navigateTo('/workspace');
              }
            }}
          />
        </div>
      );
    }

    return (
      <LoginView
        onLoginSuccess={(s) => {
          if (s.code !== 'GUEST-ACCESS') {
            setSession(s);
            setPublicView('login');
            if (s.role === 'admin') {
              navigateTo('/admin');
            } else {
              navigateTo('/workspace');
            }
          }
        }}
        onOpenPaketAkses={handleNavigateToPricing}
      />
    );
  }

  // Tampilan Admin Dashboard
  if (session.role === 'admin' && adminViewMode === 'admin_dashboard') {
    return (
      <AdminDashboardView
        onGoToWorkspace={handleGoToWorkspace}
        onLogout={handleLogout}
        onOpenApiKeySettings={handleGoToWorkspace}
      />
    );
  }

  // Workspace User Layout (Hanya untuk pengguna terautentikasi resmi)
  return (
    <UserLayout
      session={session}
      onLogout={handleLogout}
      onGoToAdmin={session.role === 'admin' ? handleGoToAdmin : undefined}
      initialTab={initialTab}
    />
  );
}

export default function App({ initialView, initialTab }: { initialView?: string; initialTab?: string }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0d0f17] flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <AppContent initialView={initialView} initialTab={initialTab} />
    </Suspense>
  );
}
