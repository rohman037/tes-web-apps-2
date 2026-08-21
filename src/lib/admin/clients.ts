import { addSpecificAccessCode, removeAccessCode, getUserSession } from '../auth';

export interface ClientToolUsage {
  tiktokDownloader: number;
  contentIdeas: number;
  videoToPrompt: number;
  photoPrompt: number;
  frameExtractor: number;
}

export interface ClientItem {
  id: string;
  accessCode: string;
  name: string;
  whatsapp?: string;
  email?: string;
  packageId: string;
  packageName: string;
  price: number;
  startDate: string;
  expiryDate: string;
  status: 'active' | 'expiring_soon' | 'expired' | 'suspended';
  type?: 'standard' | 'custom';
  lastLoginAt?: string;
  toolUsage?: ClientToolUsage;
  customFeatures?: string[];
  notes?: string;
  createdAt: string;
}

const LOCAL_STORAGE_CLIENTS_KEY = 'satset_clients_data';

export const DEFAULT_CLIENTS: ClientItem[] = [
  {
    id: 'cli_001',
    accessCode: 'SATSET-882194',
    name: 'Rizky Ramadhan',
    whatsapp: '081234567890',
    email: 'rizky@gmail.com',
    packageId: 'bulanan',
    packageName: 'Akses Bulanan (VIP)',
    price: 149000,
    startDate: '2026-08-01T10:00:00.000Z',
    expiryDate: '2026-08-31T10:00:00.000Z',
    status: 'active',
    type: 'standard',
    lastLoginAt: '2026-08-06T08:00:00.000Z',
    toolUsage: {
      tiktokDownloader: 12,
      contentIdeas: 8,
      videoToPrompt: 15,
      photoPrompt: 6,
      frameExtractor: 4
    },
    createdAt: '2026-08-01T10:00:00.000Z'
  },
  {
    id: 'cli_002',
    accessCode: 'SATSET-331209',
    name: 'Budi Santoso',
    whatsapp: '085711223344',
    email: 'budi.santoso@yahoo.com',
    packageId: 'mingguan',
    packageName: 'Akses Mingguan',
    price: 49000,
    startDate: '2026-08-02T12:00:00.000Z',
    expiryDate: '2026-08-09T12:00:00.000Z',
    status: 'expiring_soon',
    type: 'standard',
    lastLoginAt: '2026-08-05T14:30:00.000Z',
    toolUsage: {
      tiktokDownloader: 5,
      contentIdeas: 3,
      videoToPrompt: 4,
      photoPrompt: 2,
      frameExtractor: 1
    },
    createdAt: '2026-08-02T12:00:00.000Z'
  }
];

export function calculateClientStatus(expiryDateStr: string, currentStatus?: string): 'active' | 'expiring_soon' | 'expired' | 'suspended' {
  if (currentStatus === 'suspended') return 'suspended';
  try {
    const now = new Date().getTime();
    const expiry = new Date(expiryDateStr).getTime();
    const diffDays = (expiry - now) / (1000 * 3600 * 24);

    if (diffDays <= 0) return 'expired';
    if (diffDays <= 7) return 'expiring_soon';
    return 'active';
  } catch (e) {
    return 'active';
  }
}

export function getClients(): ClientItem[] {
  if (typeof localStorage === 'undefined') {
    return DEFAULT_CLIENTS;
  }
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_CLIENTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item) => ({
          ...item,
          status: calculateClientStatus(item.expiryDate, item.status)
        }));
      }
    }
  } catch (e) {
    // console.warn('[Clients Lib] Error parsing localStorage clients:', e);
  }

  try {
    localStorage.setItem(LOCAL_STORAGE_CLIENTS_KEY, JSON.stringify(DEFAULT_CLIENTS));
  } catch (e) {}

  return DEFAULT_CLIENTS;
}

export async function saveClientsAsync(clients: ClientItem[], retries = 3): Promise<{ success: boolean; error?: string }> {
  const safeClients = (clients || []).map((c) => ({
    ...c,
    status: calculateClientStatus(c.expiryDate, c.status)
  }));

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_CLIENTS_KEY, JSON.stringify(safeClients));
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('satset_clients_updated'));
    }
  } catch (e) {
    console.warn('[Clients Lib] Error saving to localStorage:', e);
  }

  let attempt = 0;
  let delayMs = 150;

  const session = getUserSession();
  const accessCode = session?.code || 'SATSET-ADMIN';

  while (attempt < retries) {
    attempt++;
    try {
      const res = await fetch('/api/admin/clients', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-access-code': accessCode
        },
        body: JSON.stringify(safeClients)
      });
      if (res.ok) {
        return { success: true };
      }
    } catch (e) {
      console.warn(`[Clients Lib Sync Attempt ${attempt}/${retries} failed]`, e);
    }
    if (attempt < retries) {
      await new Promise((r) => setTimeout(r, delayMs));
      delayMs *= 2;
    }
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('satset_server_sync_error', {
      detail: { entity: 'clients', message: 'Gagal menyimpan data klien ke server. Perubahan tersimpan lokal.' }
    }));
  }

  return { success: false, error: 'Gagal menyimpan data client ke server setelah beberapa kali mencoba.' };
}

export function saveClients(clients: ClientItem[]): void {
  saveClientsAsync(clients);
}

export function saveClient(client: ClientItem): ClientItem[] {
  const current = getClients();
  const index = current.findIndex((c) => c.id === client.id);
  let updated: ClientItem[];

  if (index >= 0) {
    updated = [...current];
    updated[index] = client;
  } else {
    updated = [client, ...current];
  }

  saveClients(updated);

  // Register in auth access code list
  if (client.accessCode) {
    try {
      addSpecificAccessCode(client.accessCode, `Client ${client.name} (${client.packageName})`);
    } catch (e) {
      console.warn('[Clients Lib] Error registering client access code:', e);
    }
  }

  return updated;
}

export async function deleteClientAsync(id: string, accessCode?: string): Promise<{ success: boolean; error?: string }> {
  const session = getUserSession();
  const authCode = session?.code || 'SATSET-ADMIN';

  try {
    const res = await fetch(`/api/admin/clients/${id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'x-access-code': authCode
      }
    });

    if (!res.ok) {
      // Try fallback delete endpoint
      await fetch('/api/admin/clients/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-access-code': authCode
        },
        body: JSON.stringify({ id, accessCode })
      });
    }

    if (accessCode) {
      await fetch('/api/access-codes/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: accessCode })
      }).catch(() => {});
    }

    return { success: true };
  } catch (err: any) {
    console.warn('[Clients Lib] Error in deleteClientAsync:', err);
    return { success: false, error: err.message || 'Gagal menghapus klien dari server' };
  }
}

export function deleteClient(id: string): ClientItem[] {
  const current = getClients();
  const target = current.find((c) => c.id === id);
  const filtered = current.filter((c) => c.id !== id);

  // 1. Save updated clients list to localStorage and trigger sync
  saveClients(filtered);

  // 2. Remove access code from auth store & backend
  if (target && target.accessCode) {
    removeAccessCode(target.accessCode);
  }

  // 3. Trigger server cascade deletion
  deleteClientAsync(id, target?.accessCode);

  return filtered;
}

export function updateClientStatus(id: string, newStatus: 'active' | 'expiring_soon' | 'expired' | 'suspended'): ClientItem[] {
  const current = getClients();
  const updated = current.map((c) => {
    if (c.id === id) {
      return { ...c, status: newStatus };
    }
    return c;
  });
  saveClients(updated);
  return updated;
}

export function extendClientExpiry(id: string, daysToAdd: number): ClientItem[] {
  const current = getClients();
  const updated = current.map((c) => {
    if (c.id === id) {
      const baseDate = new Date(c.expiryDate).getTime() > new Date().getTime() ? new Date(c.expiryDate) : new Date();
      baseDate.setDate(baseDate.getDate() + daysToAdd);
      const newExpiry = baseDate.toISOString();
      return {
        ...c,
        expiryDate: newExpiry,
        status: calculateClientStatus(newExpiry, c.status === 'suspended' ? 'active' : c.status)
      };
    }
    return c;
  });
  saveClients(updated);
  return updated;
}

export function updateClientPackage(
  id: string,
  packageId: string,
  packageName: string,
  durationDays: number,
  price: number
): ClientItem[] {
  const current = getClients();
  const updated = current.map((c) => {
    if (c.id === id) {
      const startDate = new Date().toISOString();
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + durationDays);
      const expiryDate = expiry.toISOString();
      return {
        ...c,
        packageId,
        packageName,
        price,
        startDate,
        expiryDate,
        status: calculateClientStatus(expiryDate, 'active')
      };
    }
    return c;
  });
  saveClients(updated);
  return updated;
}
