/**
 * Masks an access code symmetrically: 4 initial characters + •••••••••• + 2 ending characters.
 * Example: "SATSET-XHKG-HF9V-T8NJ" => "SATS••••••••••NJ"
 */
export function maskAccessCode(code?: string | null): string {
  if (!code) return '';
  const trimmed = code.trim();
  if (trimmed.length <= 6) {
    return '••••••••';
  }
  const first4 = trimmed.slice(0, 4);
  const last2 = trimmed.slice(-2);
  return `${first4}••••••••••${last2}`;
}
