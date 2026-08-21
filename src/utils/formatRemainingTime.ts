export interface RemainingTimeResult {
  label: string;
  urgency: 'normal' | 'warning' | 'expired';
  daysLeft: number;
  hoursLeft: number;
  minutesLeft: number;
}

/**
 * Formats time remaining for a client package or session expiry.
 * - > 1 day -> "Sisa X hari"
 * - < 1 day (>= 1 hour) -> "Sisa X jam"
 * - < 1 hour -> "Sisa X menit"
 * - Expired -> "Akses berakhir"
 */
export function formatRemainingTime(expiresAtStr?: string | Date | number | null): RemainingTimeResult {
  if (!expiresAtStr) {
    return {
      label: 'Sisa tidak terbatas',
      urgency: 'normal',
      daysLeft: 999,
      hoursLeft: 9999,
      minutesLeft: 99999,
    };
  }

  const now = Date.now();
  const expiry = new Date(expiresAtStr).getTime();

  if (isNaN(expiry)) {
    return {
      label: 'Sisa tidak terbatas',
      urgency: 'normal',
      daysLeft: 999,
      hoursLeft: 9999,
      minutesLeft: 99999,
    };
  }

  const diffMs = expiry - now;

  if (diffMs <= 0) {
    return {
      label: 'Akses berakhir',
      urgency: 'expired',
      daysLeft: 0,
      hoursLeft: 0,
      minutesLeft: 0,
    };
  }

  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 3600));
  const diffDays = Math.floor(diffMs / (1000 * 3600 * 24));

  if (diffDays >= 1) {
    return {
      label: `Sisa ${diffDays} hari`,
      urgency: diffDays <= 3 ? 'warning' : 'normal',
      daysLeft: diffDays,
      hoursLeft: diffHours,
      minutesLeft: diffMinutes,
    };
  }

  if (diffHours >= 1) {
    return {
      label: `Sisa ${diffHours} jam`,
      urgency: 'warning',
      daysLeft: 0,
      hoursLeft: diffHours,
      minutesLeft: diffMinutes,
    };
  }

  const minutes = Math.max(1, diffMinutes);
  return {
    label: `Sisa ${minutes} menit`,
    urgency: 'warning',
    daysLeft: 0,
    hoursLeft: 0,
    minutesLeft: minutes,
  };
}
