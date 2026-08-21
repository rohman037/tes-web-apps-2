import { GoogleGenAI } from '@google/genai';
import { logAdminAction } from '../lib/admin/auditLog';

export interface IngestionValidationResult {
  isValid: boolean;
  domain: string;
  sourceType: 'tiktok' | 'youtube' | 'instagram' | 'web' | 'unknown';
  reachable: boolean;
  contentLength: number;
  extractedTitle?: string;
  rejectionReason?: string;
  timestamp: string;
}

export async function monitorAndValidateIngestion(
  urlInput: string,
  rawContent?: string
): Promise<IngestionValidationResult> {
  let domain = 'unknown';
  let sourceType: IngestionValidationResult['sourceType'] = 'unknown';
  
  try {
    if (urlInput.startsWith('http://') || urlInput.startsWith('https://')) {
      const parsedUrl = new URL(urlInput);
      domain = parsedUrl.hostname.toLowerCase();
      if (domain.includes('tiktok.com')) sourceType = 'tiktok';
      else if (domain.includes('youtube.com') || domain.includes('youtu.be')) sourceType = 'youtube';
      else if (domain.includes('instagram.com')) sourceType = 'instagram';
      else sourceType = 'web';
    }
  } catch (e) {
    // If not a full URL, attempt string match
    if (urlInput.toLowerCase().includes('tiktok')) sourceType = 'tiktok';
    else if (urlInput.toLowerCase().includes('youtube')) sourceType = 'youtube';
  }

  const isValid = Boolean(urlInput && (urlInput.length > 5 || (rawContent && rawContent.length > 10)));
  const rejectionReason = isValid ? undefined : 'URL atau input konten terlalu pendek / tidak terjangkau.';

  const result: IngestionValidationResult = {
    isValid,
    domain,
    sourceType,
    reachable: isValid,
    contentLength: (rawContent || urlInput || '').length,
    extractedTitle: urlInput.slice(0, 60),
    rejectionReason,
    timestamp: new Date().toISOString(),
  };

  logAdminAction(
    'Agent Ingestion Monitor',
    `Validasi Ingestion [${sourceType.toUpperCase()}]: ${isValid ? 'Lolos' : 'Ditolak'}. Domain: ${domain}. ${rejectionReason || ''}`,
    'system',
    'Agent Ingestion Monitor'
  );

  return result;
}
