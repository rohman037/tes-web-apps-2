export interface ToolTabConfig {
  id: 'tiktok' | 'prompt' | 'photo' | 'ideas' | 'shop_ideas' | 'extractor' | 'paket' | 'pengaturan';
  label: string;
  badge?: string;
  enabled: boolean;
  icon: string;
}

export interface UserUiSettings {
  // Header Branding
  logoTitle: string;
  logoBadgeText: string;
  logoImageUrl: string;
  logoThemeColor: string;
  headerHelpText: string;
  showAntiLimitBadge: boolean;
  antiLimitBadgeText: string;

  // Announcement Ticker Banner
  showAnnouncement: boolean;
  announcementText: string;
  announcementBg: string;
  announcementTextColor: string;

  // Tools Tab Control & Order
  toolsConfig: ToolTabConfig[];

  // Welcome Hero Section
  showWelcomeCard: boolean;
  welcomeTitle: string;
  welcomeSubtitle: string;

  // Theme & Colors
  pageBgColor: string;
  primaryColor: string;
  sidebarStyle: 'light' | 'dark' | 'indigo';

  // Footer & CS
  footerText: string;
  supportWaText: string;

  updatedAt?: string;
}

const LOCAL_STORAGE_USER_UI_KEY = 'satset_user_ui_settings';

export const DEFAULT_USER_UI_SETTINGS: UserUiSettings = {
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
};

export function getUserUiSettings(): UserUiSettings {
  if (typeof localStorage === 'undefined') {
    return DEFAULT_USER_UI_SETTINGS;
  }
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_USER_UI_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          ...DEFAULT_USER_UI_SETTINGS,
          ...parsed,
          toolsConfig: Array.isArray(parsed.toolsConfig) ? parsed.toolsConfig : DEFAULT_USER_UI_SETTINGS.toolsConfig,
        };
      }
    }
  } catch (e) {
    // console.error('[UserUiSettings] Error reading settings:', e);
  }

  return DEFAULT_USER_UI_SETTINGS;
}

export async function syncUserUiSettingsWithBackend(): Promise<UserUiSettings> {
  try {
    const res = await fetch('/api/user-ui-settings');
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object') {
        const payload: UserUiSettings = {
          ...DEFAULT_USER_UI_SETTINGS,
          ...data,
          toolsConfig: Array.isArray(data.toolsConfig) ? data.toolsConfig : DEFAULT_USER_UI_SETTINGS.toolsConfig,
        };
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(LOCAL_STORAGE_USER_UI_KEY, JSON.stringify(payload));
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('satset_user_ui_settings_updated'));
        }
        return payload;
      }
    }
  } catch (e) {
    console.warn('[UserUiSettings] Sync error from backend API:', e);
  }
  return getUserUiSettings();
}

export async function saveUserUiSettings(settings: UserUiSettings): Promise<{ success: boolean; error?: string }> {
  try {
    const payload: UserUiSettings = {
      ...settings,
      updatedAt: new Date().toISOString(),
    };

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_USER_UI_KEY, JSON.stringify(payload));
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('satset_user_ui_settings_updated'));
    }

    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('satset_admin_session') || '' : '';
    const res = await fetch('/api/admin/user-ui-settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { success: false, error: errData.error || 'Gagal menyimpan konfigurasi UI User ke server.' };
    }

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message || 'Terjadi kesalahan sistem saat menyimpan.' };
  }
}
