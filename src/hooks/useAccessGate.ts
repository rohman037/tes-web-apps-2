import { useState, useEffect } from 'react';
import { getUserSession, UserSession } from '../lib/auth';
import { getClients, ClientItem } from '../lib/admin/clients';

export type ToolId =
  | 'idea_konten'
  | 'video_to_prompt'
  | 'prompt_foto'
  | 'tiktok_downloader'
  | 'ekstraktor_frame';

export interface AccessGateResult {
  session: UserSession | null;
  client: ClientItem | null;
  isAdmin: boolean;
  isExpired: boolean;
  isSuspended: boolean;
  isAllowed: (toolId: ToolId) => boolean;
  getReason: (toolId: ToolId) => string;
}

export function useAccessGate(): AccessGateResult {
  const [session, setSession] = useState<UserSession | null>(() => getUserSession());
  const [client, setClient] = useState<ClientItem | null>(() => {
    const s = getUserSession();
    if (s && s.role !== 'admin' && s.code) {
      const clients = getClients();
      return clients.find((c) => c.accessCode.toUpperCase() === s.code.toUpperCase()) || null;
    }
    return null;
  });

  useEffect(() => {
    const handleSessionChange = () => {
      const updatedS = getUserSession();
      setSession(updatedS);
      if (updatedS && updatedS.role !== 'admin' && updatedS.code) {
        const clients = getClients();
        const matched = clients.find(
          (c) => c.accessCode.toUpperCase() === updatedS.code.toUpperCase()
        );
        setClient(matched || null);
      } else {
        setClient(null);
      }
    };

    window.addEventListener('satset_clients_updated', handleSessionChange);
    window.addEventListener('storage', handleSessionChange);
    return () => {
      window.removeEventListener('satset_clients_updated', handleSessionChange);
      window.removeEventListener('storage', handleSessionChange);
    };
  }, []);

  const isAdmin = session?.role === 'admin';
  const isExpired = client?.status === 'expired';
  const isSuspended = client?.status === 'suspended';

  const isAllowed = (toolId: ToolId): boolean => {
    if (isAdmin) return true;
    if (!session) return false;
    if (isExpired || isSuspended) return false;

    // Check custom package restrictions if defined
    if (client?.type === 'custom' && Array.isArray(client.customFeatures)) {
      return client.customFeatures.includes(toolId);
    }

    // Default: all standard packages include all 5 tools
    return true;
  };

  const getReason = (toolId: ToolId): string => {
    if (isAdmin) return '';
    if (!session) return 'Silakan masuk dengan Kode Akses resmi.';
    if (isSuspended) return 'Akun dan kode akses Anda saat ini sedang ditangguhkan oleh Admin.';
    if (isExpired) return 'Masa aktif paket Anda telah habis. Silakan perpanjang paket untuk membuka fitur ini.';
    if (!isAllowed(toolId)) return 'Tool ini tidak termasuk dalam langganan paket aktif Anda.';
    return '';
  };

  return {
    session,
    client,
    isAdmin,
    isExpired: Boolean(isExpired),
    isSuspended: Boolean(isSuspended),
    isAllowed,
    getReason,
  };
}
