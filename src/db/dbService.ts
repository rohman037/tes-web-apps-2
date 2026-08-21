import { adminDb } from '../lib/firebase-admin';
import firebaseConfig from '../../firebase-applet-config.json';
import { AiAgentItem, DEFAULT_AI_AGENTS } from '../lib/admin/aiAgents';
import { ClientItem, DEFAULT_CLIENTS } from '../lib/admin/clients';
import { PackageItem, DEFAULT_PACKAGES } from '../lib/admin/packages';
import { Transaction, QrisConfig } from '../lib/payment';
import { ContactSettings, DEFAULT_CONTACT_SETTINGS } from '../lib/admin/contactSettings';
import { AuditLogItem, DEFAULT_AUDIT_LOGS } from '../lib/admin/auditLog';
import { GrowthScalingState, DEFAULT_GROWTH_STATE } from '../lib/admin/growthScaling';
import fs from 'fs';
import path from 'path';

let lastPermissionDeniedLog = 0;
let lastQuotaExceededLog = 0;
let quotaExhaustedUntil = 0;

export class DatabaseError extends Error {
  public statusCode: number;
  public code?: string | number;
  public isPermissionDenied: boolean;
  public isQuotaExceeded: boolean;

  constructor(message: string, originalError?: any) {
    super(message);
    this.name = 'DatabaseError';
    const code = originalError?.code || originalError?.status;
    this.code = code;
    this.isPermissionDenied = code === 7 || (typeof originalError?.message === 'string' && originalError.message.includes('PERMISSION_DENIED'));
    this.isQuotaExceeded = code === 8 || code === '8' || (typeof originalError?.message === 'string' && (originalError.message.includes('RESOURCE_EXHAUSTED') || originalError.message.includes('Quota exceeded')));
    this.statusCode = this.isPermissionDenied ? 403 : this.isQuotaExceeded ? 429 : 500;
  }
}

function isQuotaExceededError(error: any): boolean {
  const code = error?.code || error?.status;
  const msg = typeof error?.message === 'string' ? error.message : String(error || '');
  return code === 8 || code === '8' || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('Quota exceeded');
}

function handleDbError(operationName: string, error: any) {
  const isPermissionDenied = error?.code === 7 || error?.status === 7 || (typeof error?.message === 'string' && error.message.includes('PERMISSION_DENIED'));
  const isQuotaExceeded = isQuotaExceededError(error);
  const now = Date.now();

  if (isQuotaExceeded) {
    quotaExhaustedUntil = now + 60000; // Circuit breaker: pause Firestore calls for 60s to use high-speed memory cache
    if (now - lastQuotaExceededLog > 60000) {
      console.warn(
        `[DbService QUOTA_EXCEEDED] ${operationName} hit Firestore quota limit. Automatically utilizing In-Memory Cache fallback for smooth operation.`
      );
      lastQuotaExceededLog = now;
    }
  } else if (isPermissionDenied) {
    quotaExhaustedUntil = now + 120000; // Circuit breaker: pause Firestore calls for 2 mins to use memory/local cache
    if (now - lastPermissionDeniedLog > 300000) {
      console.warn(
        `[DbService PERMISSION_DENIED] ${operationName} paused Firestore remote calls. Operating with In-Memory fallback cache.`
      );
      lastPermissionDeniedLog = now;
    }
  } else {
    console.warn(`[DbService] Error during ${operationName}:`, error?.message || error);
  }
}

export async function testFirestoreHealth(): Promise<{
  ok: boolean;
  status: string;
  code?: string | number;
  message?: string;
  projectId: string;
  firestoreDatabaseId: string;
  timestamp: string;
}> {
  const projectId = firebaseConfig.projectId;
  const firestoreDatabaseId = firebaseConfig.firestoreDatabaseId || '(default)';
  const timestamp = new Date().toISOString();

  try {
    const docRef = adminDb.collection('_healthCheck').doc('ping');
    await docRef.set({ lastPing: timestamp }, { merge: true });
    const snap = await docRef.get();
    
    if (snap.exists) {
      return {
        ok: true,
        status: 'OPERATIONAL',
        projectId,
        firestoreDatabaseId,
        timestamp,
      };
    } else {
      return {
        ok: false,
        status: 'DOC_NOT_FOUND',
        message: 'Healthcheck document write/read anomaly.',
        projectId,
        firestoreDatabaseId,
        timestamp,
      };
    }
  } catch (err: any) {
    const isPermissionDenied = err?.code === 7 || err?.status === 7 || (typeof err?.message === 'string' && err.message.includes('PERMISSION_DENIED'));
    const isQuotaExceeded = isQuotaExceededError(err);
    if (isQuotaExceeded) {
      quotaExhaustedUntil = Date.now() + 30000;
    }
    return {
      ok: false,
      status: isQuotaExceeded ? 'QUOTA_EXCEEDED' : isPermissionDenied ? 'PERMISSION_DENIED' : 'ERROR',
      code: err?.code || err?.status || 'UNKNOWN',
      message: isQuotaExceeded
        ? 'Quota exceeded for Firestore database (RESOURCE_EXHAUSTED). Application operating smoothly with automatic In-Memory cache fallback.'
        : isPermissionDenied
        ? `PERMISSION_DENIED (gRPC code 7): Runtime service account needs 'roles/datastore.user' or 'roles/firebase.admin' on project '${projectId}'.`
        : (err?.message || String(err)),
      projectId,
      firestoreDatabaseId,
      timestamp,
    };
  }
}

const DEFAULT_QRIS_SVG = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><rect width="300" height="300" fill="%23ffffff"/><rect x="20" y="20" width="260" height="260" fill="none" stroke="%233525cd" stroke-width="4"/><path d="M40 40h70v70H40zM190 40h70v70h-70zM40 190h70v70H40z" fill="%233525cd"/><path d="M55 55h40v40H55zM205 55h40v40h-40zM55 205h40v40H55z" fill="%23ffffff"/><path d="M130 40h30v30h-30zM130 90h40v40h-40zM180 130h30v30h-30zM130 180h40v40h-40zM190 190h30v30h-30zM230 220h30v30h-30zM150 240h30v30h-30z" fill="%233525cd"/><text x="150" y="280" font-family="sans-serif" font-size="12" font-weight="bold" fill="%233525cd" text-anchor="middle">QRIS SATSET OFFICIAL</text></svg>`;
const DEFAULT_QRIS: QrisConfig = {
  imageBase64: DEFAULT_QRIS_SVG,
  merchantName: 'Tools Satset Official (QRIS ALL PAYMENT)',
};
const DEFAULT_TRANSACTIONS: Transaction[] = [];

export const ALL_23_AI_AGENTS: AiAgentItem[] = [
  ...DEFAULT_AI_AGENTS,
  {
    id: 'agent_ingestion_monitor',
    name: 'Agent Monitor Ingestion & URL Fetcher',
    role: 'Memantau URL/submission baru',
    model: 'gemini-3.1-flash-lite',
    status: 'active',
    callsCount: 32, approvedPatternsCount: 0, rejectedPatternsCount: 0,
  }
];

export async function initDbSeed() {
  console.log('[DbService] initDbSeed (Firestore) completed.');
}

const memoryStore: Record<string, Record<string, any>> = {};

async function getCollectionData<T>(collectionName: string, defaultData: T[]): Promise<T[]> {
  if (Date.now() < quotaExhaustedUntil) {
    if (memoryStore[collectionName] && Object.keys(memoryStore[collectionName]).length > 0) {
      return Object.values(memoryStore[collectionName]) as T[];
    }
    return defaultData;
  }

  try {
    const snap = await adminDb.collection(collectionName).get();
    if (snap.empty) {
      if (memoryStore[collectionName] && Object.keys(memoryStore[collectionName]).length > 0) {
        return Object.values(memoryStore[collectionName]) as T[];
      }
      if (!memoryStore[collectionName]) memoryStore[collectionName] = {};
      defaultData.forEach((item: any) => {
        const id = item?.id || item?.code;
        if (id) memoryStore[collectionName][id] = item;
      });
      return defaultData;
    }
    const docs = snap.docs.map(d => d.data() as T);
    if (!memoryStore[collectionName]) memoryStore[collectionName] = {};
    docs.forEach((doc: any) => {
      const id = doc?.id || doc?.code;
      if (id) {
        memoryStore[collectionName][id] = doc;
      }
    });
    return docs;
  } catch (e: any) {
    handleDbError(`read collection '${collectionName}'`, e);
    if (memoryStore[collectionName] && Object.keys(memoryStore[collectionName]).length > 0) {
      return Object.values(memoryStore[collectionName]) as T[];
    }
    return defaultData;
  }
}

async function getDocData<T>(collectionName: string, docId: string, fallbackDefault: T): Promise<T> {
  if (Date.now() < quotaExhaustedUntil) {
    return memoryStore[collectionName]?.[docId] ?? fallbackDefault;
  }

  try {
    const snap = await adminDb.collection(collectionName).doc(docId).get();
    if (snap.exists) {
      const data = snap.data() as T;
      if (!memoryStore[collectionName]) memoryStore[collectionName] = {};
      memoryStore[collectionName][docId] = data;
      return data;
    }
  } catch (e: any) {
    handleDbError(`read doc '${collectionName}/${docId}'`, e);
  }

  return memoryStore[collectionName]?.[docId] ?? fallbackDefault;
}

async function saveDoc(collectionName: string, id: string, data: any): Promise<void> {
  if (!memoryStore[collectionName]) {
    memoryStore[collectionName] = {};
  }
  memoryStore[collectionName][id] = data;

  if (Date.now() < quotaExhaustedUntil) {
    return;
  }

  try {
    await adminDb.collection(collectionName).doc(id).set(data, { merge: true });
  } catch (e: any) {
    handleDbError(`save doc '${id}' in '${collectionName}'`, e);
  }
}

async function deleteDoc(collectionName: string, id: string): Promise<void> {
  if (memoryStore[collectionName]) {
    delete memoryStore[collectionName][id];
  }

  if (Date.now() < quotaExhaustedUntil) {
    return;
  }

  try {
    await adminDb.collection(collectionName).doc(id).delete();
  } catch (e: any) {
    handleDbError(`delete doc '${id}' in '${collectionName}'`, e);
  }
}

export async function dbGetClients(): Promise<ClientItem[]> { return getCollectionData('clients', DEFAULT_CLIENTS); }
export async function dbSaveClient(client: ClientItem): Promise<void> { return saveDoc('clients', client.id, client); }
export async function dbDeleteClient(id: string): Promise<void> { return deleteDoc('clients', id); }

export async function dbGetPackages(): Promise<PackageItem[]> { return getCollectionData('packages', DEFAULT_PACKAGES); }
export async function dbSavePackage(pkg: PackageItem): Promise<void> { return saveDoc('packages', pkg.id, pkg); }
export async function dbDeletePackage(id: string): Promise<void> { return deleteDoc('packages', id); }

export async function dbGetTransactions(): Promise<Transaction[]> { return getCollectionData('transactions', DEFAULT_TRANSACTIONS); }
export async function dbSaveTransaction(txn: Transaction): Promise<void> { return saveDoc('transactions', txn.id, txn); }
export async function dbDeleteTransaction(id: string): Promise<void> { return deleteDoc('transactions', id); }

export async function dbGetQrisConfig(): Promise<QrisConfig> {
  return getDocData('configs', 'qris', DEFAULT_QRIS);
}
export async function dbSaveQrisConfig(config: QrisConfig): Promise<void> { return saveDoc('configs', 'qris', config); }

export async function dbGetContactSettings(): Promise<ContactSettings> {
  return getDocData('configs', 'contactSettings', DEFAULT_CONTACT_SETTINGS);
}
export async function dbSaveContactSettings(settings: ContactSettings): Promise<void> { return saveDoc('configs', 'contactSettings', settings); }

export async function dbGetAuditLogs(): Promise<AuditLogItem[]> { return getCollectionData('auditLogs', DEFAULT_AUDIT_LOGS); }
export async function dbAddAuditLog(log: AuditLogItem): Promise<void> { return saveDoc('auditLogs', log.id, log); }

export async function dbGetGrowthState(): Promise<GrowthScalingState> {
  return getDocData('configs', 'growthState', DEFAULT_GROWTH_STATE);
}
export async function dbSaveGrowthState(state: GrowthScalingState): Promise<void> { return saveDoc('configs', 'growthState', state); }

export async function dbGetAiAgents(): Promise<AiAgentItem[]> { return getCollectionData('aiAgents', ALL_23_AI_AGENTS); }
export async function dbSaveAiAgent(agent: AiAgentItem): Promise<void> { return saveDoc('aiAgents', agent.id, agent); }
export async function dbDeleteAiAgent(id: string): Promise<void> { return deleteDoc('aiAgents', id); }

// Access Codes
export async function dbGetAccessCodes(): Promise<any[]> { return getCollectionData('accessCodes', []); }
export async function dbSaveAccessCode(code: any): Promise<void> { return saveDoc('accessCodes', code.id || code.code, code); }
export async function dbDeleteAccessCode(id: string): Promise<void> { return deleteDoc('accessCodes', id); }

// Active Generations
export async function dbGetActiveGenerations(): Promise<any> {
  return getDocData('configs', 'activeGenerations', {});
}
export async function dbSaveActiveGenerations(data: any): Promise<void> { return saveDoc('configs', 'activeGenerations', data); }

// Events (Tracking)
export async function dbGetTrackingEvents(): Promise<any[]> { return getCollectionData('trackingEvents', []); }
export async function dbAddTrackingEvent(event: any): Promise<void> { return saveDoc('trackingEvents', event.id || String(Date.now()), event); }

// Learning Queue
export async function dbGetLearningQueue(): Promise<any[]> { return getCollectionData('learningQueue', []); }
export async function dbSaveLearningQueueItem(item: any): Promise<void> { return saveDoc('learningQueue', item.id, item); }

// System Memory
export async function dbGetSystemMemory(): Promise<any> {
  const defaultMem = {
    totalExecutions: 350,
    successfulPromptsCount: 342,
    learnedKnowledgeBase: ['Hook visual di 3 detik pertama meningkatkan retention rate hingga 68%.'],
    viralHookPatterns: [{ id: 'hk_01', pattern: 'Jangan beli [produk] sebelum tau 3 hal ini!', category: 'umum', confidence: 95 }],
    categoryUsage: { fashion: 120, beauty_grooming: 90 },
    formulas: ['Hook BLUFF + 3 Adegan Visual + CTA Spesifik'],
    lastUpdated: new Date().toISOString(),
  };
  return getDocData('configs', 'systemMemory', defaultMem);
}

export async function dbSaveSystemMemory(mem: any): Promise<void> {
  return saveDoc('configs', 'systemMemory', mem);
}

// API Keys
export async function dbGetApiKeys(): Promise<any[]> { 
  const data = await getDocData<{ keys: any[] }>('configs', 'apiKeys', { keys: [] });
  return data?.keys || [];
}
export async function dbSaveApiKeys(keys: any[]): Promise<void> { 
  return saveDoc('configs', 'apiKeys', { keys });
}

// Category Taxonomy
export async function dbGetCategoryTaxonomy(): Promise<any[]> { return getCollectionData('categoryTaxonomy', []); }
export async function dbSaveCategoryTaxonomyItem(item: any): Promise<void> { return saveDoc('categoryTaxonomy', item.id, item); }

// Category Proposals
export async function dbGetCategoryProposals(): Promise<any[]> { return getCollectionData('categoryTaxonomyProposals', []); }
export async function dbSaveCategoryProposal(prop: any): Promise<void> { return saveDoc('categoryTaxonomyProposals', prop.id, prop); }

// Announcements & Broadcast
export async function dbGetAnnouncements(): Promise<any[]> { return getCollectionData('announcements', []); }
export async function dbSaveAnnouncement(item: any): Promise<void> { return saveDoc('announcements', item.id, item); }
export async function dbDeleteAnnouncement(id: string): Promise<void> { return deleteDoc('announcements', id); }

// Master Prompt Formulas
export async function dbGetFormulas(): Promise<any[]> { return getCollectionData('promptFormulas', []); }
export async function dbSaveFormula(item: any): Promise<void> { return saveDoc('promptFormulas', item.id, item); }
export async function dbDeleteFormula(id: string): Promise<void> { return deleteDoc('promptFormulas', id); }

// Affiliate & Referral System
export async function dbGetAffiliates(): Promise<any[]> { return getCollectionData('affiliates', []); }
export async function dbSaveAffiliate(item: any): Promise<void> { return saveDoc('affiliates', item.id, item); }
export async function dbDeleteAffiliate(id: string): Promise<void> { return deleteDoc('affiliates', id); }


// Pending Schema Changes
export async function dbGetPendingSchemaChanges(): Promise<any[]> { return getCollectionData('pendingSchemaChanges', []); }
export async function dbSavePendingSchemaChange(change: any): Promise<void> { return saveDoc('pendingSchemaChanges', change.id, change); }

// Banned Devices & Security Enforcement System
export async function dbGetBannedDevices(): Promise<any[]> { return getCollectionData('bannedDevices', []); }
export async function dbSaveBannedDevice(device: any): Promise<void> { return saveDoc('bannedDevices', device.id || device.fingerprint || device.ip, device); }
export async function dbDeleteBannedDevice(id: string): Promise<void> { return deleteDoc('bannedDevices', id); }

// User UI Customization Config
export async function dbGetUserUiSettings(): Promise<any> {
  return getDocData('configs', 'userUiSettings', {
    logoTitle: 'Tools Satset AI',
    logoBadgeText: 'TS',
    logoImageUrl: '',
    logoThemeColor: '#3525cd',
    headerHelpText: 'Bantuan & CS',
    showAntiLimitBadge: true,
    antiLimitBadgeText: 'Anti-Limit AI Engine Active',
    showAnnouncement: true,
    announcementText: '🔥 Update Baru: Model Gemini 2.5 Flash Ultra Aktif. Proses analisis prompt & ide konten 3x lebih cepat!',
    announcementBg: '#1e1b4b',
    announcementTextColor: '#fbbf24',
    toolsConfig: [
      { id: 'pengaturan', label: 'Pengaturan System', badge: 'WAJIB', enabled: true, icon: 'key' },
      { id: 'tiktok', label: 'TikTok Downloader', badge: 'FREE', enabled: true, icon: 'download' },
      { id: 'prompt', label: 'Video-to-Prompt AI', badge: 'HOT', enabled: true, icon: 'video' },
      { id: 'photo', label: 'Prompt Foto Nano', badge: 'ULTRA', enabled: true, icon: 'camera' },
      { id: 'ideas', label: 'Ide Konten AI (AEO)', badge: 'FYP', enabled: true, icon: 'lightbulb' },
      { id: 'shop_ideas', label: 'TikTok Shop to Ideas', badge: 'PRO', enabled: true, icon: 'shopping' },
      { id: 'extractor', label: 'Video Frame Extractor', badge: '8K', enabled: true, icon: 'scissors' },
      { id: 'paket', label: 'Paket Akses & Lisensi', badge: '', enabled: true, icon: 'credit-card' },
    ],
    showWelcomeCard: true,
    welcomeTitle: 'Selamat Datang di Workspace Tools Satset AI',
    welcomeSubtitle: 'Kelola & ciptakan konten viral dari video, prompt foto nano, ide konten FYP hingga ekstraksi frame dalam satu sistem otomatis.',
    pageBgColor: '#fcf8ff',
    primaryColor: '#3525cd',
    sidebarStyle: 'light',
    footerText: '© 2026 Tools Satset AI - Multi-Engine Content Suite',
    supportWaText: 'Hubungi Support CS WhatsApp',
    updatedAt: new Date().toISOString()
  });
}
export async function dbSaveUserUiSettings(data: any): Promise<void> {
  return saveDoc('configs', 'userUiSettings', data);
}

export async function dbGetLoginUiSettings(): Promise<any> {
  return getDocData('configs', 'loginUiSettings', {
    logoTitle: 'Tools Satset',
    logoBadgeText: 'TS',
    logoImageUrl: '',
    logoThemeColor: '#3525cd',
    headerHelpText: 'Bantuan',
    heroTitle: 'Buat lebih banyak konten dari satu video',
    heroImageUrl: '',
    bannerCardTitle: 'Workspace AI All-in-One',
    bannerCardDescription: 'Generator Ide Konten, Video-to-Prompt, Prompt Foto Nano Banana Ultra, dan Frame Extractor dalam satu platform satset.',
    bannerGradientFrom: '#1e1b4b',
    bannerGradientTo: '#3525cd',
    featurePoints: [
      { id: 'fp_1', icon: 'lightbulb', title: 'Ide konten' },
      { id: 'fp_2', icon: 'video', title: 'Prompt video' },
      { id: 'fp_3', icon: 'camera', title: 'Prompt foto' },
      { id: 'fp_4', icon: 'crop', title: 'Ekstraksi frame' },
    ],
    formTitle: 'Masuk ke workspace Anda',
    formSubtitle: 'Gunakan Kode Akses Anda untuk melanjutkan.',
    inputLabel: 'Kode Akses',
    inputPlaceholder: 'Masukkan kode akses Anda',
    buttonText: 'Masuk ke aplikasi',
    buttonLoadingText: 'Memverifikasi...',
    buttonColor: '#3525cd',
    paketAksesButtonText: 'Belum punya kode akses? Lihat paket akses',
    showPaketAksesLink: true,
    waButtonText: 'Konsultasi melalui WhatsApp',
    showWaButton: true,
    footerItems: ['Akses aman', 'Tanpa password', 'Bantuan langsung'],
    pageBgColor: '#fcf8ff',
    bgPatternUrl: '',
    updatedAt: new Date().toISOString()
  });
}
export async function dbSaveLoginUiSettings(data: any): Promise<void> {
  return saveDoc('configs', 'loginUiSettings', data);
}
