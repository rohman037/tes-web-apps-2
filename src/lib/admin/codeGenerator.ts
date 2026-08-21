/**
 * Generator Kode Akses Aman & Panjang (D2 Format)
 * Format: [PREFIX]-[SEGMEN-PAKET]-[RANDOM8]-[CHECKSUM4]
 * Contoh: SATSET-ULTRAVIP-K7M2XQ9A-3F1D
 */

const NON_AMBIGUOUS_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function getRandomChar(): string {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    return NON_AMBIGUOUS_CHARS[array[0] % NON_AMBIGUOUS_CHARS.length];
  }
  return NON_AMBIGUOUS_CHARS[Math.floor(Math.random() * NON_AMBIGUOUS_CHARS.length)];
}

function calculateChecksum4(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  const positive = Math.abs(hash);
  const hex = positive.toString(16).toUpperCase().padStart(4, 'X');
  return hex.substring(hex.length - 4);
}

export function generateSecureAccessCode(packageSegment: string = 'PRO'): string {
  const prefix = 'SATSET';
  const cleanSegment = packageSegment
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .substring(0, 10) || 'PRO';

  let random8 = '';
  for (let i = 0; i < 8; i++) {
    random8 += getRandomChar();
  }

  const baseCode = `${prefix}-${cleanSegment}-${random8}`;
  const checksum4 = calculateChecksum4(baseCode);

  return `${baseCode}-${checksum4}`;
}

export function verifyAccessCodeFormat(code: string): boolean {
  if (!code || typeof code !== 'string') return false;
  const parts = code.trim().toUpperCase().split('-');
  if (parts.length < 4) return false;

  const checksumPart = parts[parts.length - 1];
  const baseCode = parts.slice(0, parts.length - 1).join('-');
  const expectedChecksum = calculateChecksum4(baseCode);

  return checksumPart === expectedChecksum;
}

/**
 * Hash sederhana untuk proteksi penyimpanan JSON
 */
export function hashAccessCode(code: string): string {
  let hash = 5381;
  const str = code.trim().toUpperCase();
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
}
