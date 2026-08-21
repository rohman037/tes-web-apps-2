export interface FeaturePoint {
  id: string;
  icon: string;
  title: string;
}

export interface LoginUiSettings {
  // Brand Header
  logoTitle: string;
  logoBadgeText: string;
  logoImageUrl: string;
  logoThemeColor: string;
  headerHelpText: string;

  // Hero Section (Left Column)
  heroTitle: string;
  heroImageUrl: string;
  bannerCardTitle: string;
  bannerCardDescription: string;
  bannerGradientFrom: string;
  bannerGradientTo: string;
  featurePoints: FeaturePoint[];

  // Login Form (Right Column)
  formTitle: string;
  formSubtitle: string;
  inputLabel: string;
  inputPlaceholder: string;
  buttonText: string;
  buttonLoadingText: string;
  buttonColor: string;

  // Actions & Links
  paketAksesButtonText: string;
  showPaketAksesLink: boolean;
  waButtonText: string;
  showWaButton: boolean;

  // Footer & Theme
  footerItems: string[];
  pageBgColor: string;
  bgPatternUrl: string;

  updatedAt?: string;
}

const LOCAL_STORAGE_LOGIN_UI_KEY = 'satset_login_ui_settings';

export const DEFAULT_LOGIN_UI_SETTINGS: LoginUiSettings = {
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
};

export function getLoginUiSettings(): LoginUiSettings {
  if (typeof localStorage === 'undefined') {
    return DEFAULT_LOGIN_UI_SETTINGS;
  }
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_LOGIN_UI_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          ...DEFAULT_LOGIN_UI_SETTINGS,
          ...parsed,
          featurePoints: Array.isArray(parsed.featurePoints) ? parsed.featurePoints : DEFAULT_LOGIN_UI_SETTINGS.featurePoints,
          footerItems: Array.isArray(parsed.footerItems) ? parsed.footerItems : DEFAULT_LOGIN_UI_SETTINGS.footerItems,
        };
      }
    }
  } catch (e) {
    // console.error('[LoginUiSettings] Error reading settings:', e);
  }

  return DEFAULT_LOGIN_UI_SETTINGS;
}

export async function syncLoginUiSettingsWithBackend(): Promise<LoginUiSettings> {
  try {
    const res = await fetch('/api/login-ui-settings');
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === 'object') {
        const payload: LoginUiSettings = {
          ...DEFAULT_LOGIN_UI_SETTINGS,
          ...data,
          featurePoints: Array.isArray(data.featurePoints) ? data.featurePoints : DEFAULT_LOGIN_UI_SETTINGS.featurePoints,
          footerItems: Array.isArray(data.footerItems) ? data.footerItems : DEFAULT_LOGIN_UI_SETTINGS.footerItems,
        };
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(LOCAL_STORAGE_LOGIN_UI_KEY, JSON.stringify(payload));
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('satset_login_ui_settings_updated'));
        }
        return payload;
      }
    }
  } catch (e) {
    console.warn('[LoginUiSettings] Sync error from backend API:', e);
  }
  return getLoginUiSettings();
}

export async function saveLoginUiSettings(settings: LoginUiSettings): Promise<{ success: boolean; error?: string }> {
  try {
    const payload: LoginUiSettings = {
      ...settings,
      updatedAt: new Date().toISOString(),
    };

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_LOGIN_UI_KEY, JSON.stringify(payload));
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('satset_login_ui_settings_updated'));
    }

    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('satset_admin_session') || '' : '';
    const res = await fetch('/api/admin/login-ui-settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { success: false, error: errData.error || 'Gagal menyimpan konfigurasi ke database server.' };
    }

    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message || 'Terjadi kesalahan sistem saat menyimpan.' };
  }
}
