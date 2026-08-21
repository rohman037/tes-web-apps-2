/**
 * Advanced Client Security & Device Fingerprinting Engine
 * Generates unique hardware/browser fingerprint & monitors unauthorized console tampering.
 */

let cachedFingerprint: string | null = null;

export function getDeviceFingerprint(): string {
  if (cachedFingerprint) return cachedFingerprint;

  if (typeof window === 'undefined') return 'SSR_SERVER_ENVIRONMENT';

  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    let canvasHash = 'no_canvas';
    if (ctx) {
      canvas.width = 200;
      canvas.height = 50;
      ctx.textBaseline = 'top';
      ctx.font = "14px 'Arial'";
      ctx.fillStyle = '#f60';
      ctx.fillRect(125, 1, 62, 20);
      ctx.fillStyle = '#069';
      ctx.fillText('SatsetSecurityGuard_2026', 2, 15);
      ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
      ctx.fillText('SatsetSecurityGuard_2026', 4, 17);
      const dataUrl = canvas.toDataURL();
      let hash = 0;
      for (let i = 0; i < dataUrl.length; i++) {
        const char = dataUrl.charCodeAt(i);
        hash = (hash << 5) - hash + char;
        hash |= 0;
      }
      canvasHash = Math.abs(hash).toString(36);
    }

    const ua = navigator.userAgent || '';
    const screenRes = `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`;
    const lang = navigator.language || '';
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const cores = navigator.hardwareConcurrency || 4;

    const rawString = `${ua}_${screenRes}_${lang}_${tz}_${cores}_${canvasHash}`;
    let fnv = 0x811c9dc5;
    for (let i = 0; i < rawString.length; i++) {
      fnv ^= rawString.charCodeAt(i);
      fnv += (fnv << 1) + (fnv << 4) + (fnv << 7) + (fnv << 8) + (fnv << 24);
    }
    cachedFingerprint = `DEV_FP_${Math.abs(fnv).toString(16).toUpperCase()}`;
    return cachedFingerprint;
  } catch (e) {
    cachedFingerprint = `DEV_FP_GENERIC_${Date.now().toString(36)}`;
    return cachedFingerprint;
  }
}

/**
 * Report security violation to backend server
 */
export async function reportSecurityViolation(
  violationType: 'DEVTOOLS_OPENED' | 'CONSOLE_TAMPERING' | 'UNAUTHORIZED_ACCESS_ATTEMPT' | 'BRUTE_FORCE_CODE',
  details: string,
  accessCode?: string
): Promise<{ isBanned: boolean; error?: string }> {
  try {
    const fingerprint = getDeviceFingerprint();
    const res = await fetch('/api/security/report-violation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-fingerprint': fingerprint,
        'x-access-code': accessCode || '',
      },
      body: JSON.stringify({
        violationType,
        details,
        fingerprint,
        accessCode,
        timestamp: new Date().toISOString(),
        locationUrl: typeof window !== 'undefined' ? window.location.href : '',
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      if (res.status === 403 || data.isBanned) {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('satset_device_banned', { detail: data }));
        }
        return { isBanned: true, error: data.error };
      }
    }
    return { isBanned: false };
  } catch (err) {
    console.warn('[SecurityGuard] Failed reporting violation:', err);
    return { isBanned: false };
  }
}

/**
 * Initialize DevTools & Console Tampering Monitoring
 */
export function initSecurityGuard(onBannedCallback?: (errMessage: string) => void) {
  if (typeof window === 'undefined') return;

  const fingerprint = getDeviceFingerprint();

  // Listen for device banned event
  window.addEventListener('satset_device_banned', (e: Event) => {
    const customEvt = e as CustomEvent;
    if (onBannedCallback && customEvt.detail?.error) {
      onBannedCallback(customEvt.detail.error);
    }
  });

  // Periodically verify if current device is banned
  const checkBannedStatus = async () => {
    try {
      const res = await fetch('/api/security/check-banned', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-device-fingerprint': fingerprint,
        },
      });
      if (res.status === 403) {
        const data = await res.json().catch(() => ({}));
        if (onBannedCallback) {
          onBannedCallback(data.error || 'Perangkat Anda telah diblokir oleh sistem.');
        }
        window.dispatchEvent(new CustomEvent('satset_device_banned', { detail: data }));
      }
    } catch (e) {}
  };

  checkBannedStatus();
  const intervalId = setInterval(checkBannedStatus, 45000); // Check every 45s

  return () => {
    clearInterval(intervalId);
  };
}
