export interface ContentIdeasGenerationSettings {
  aeoQueryMode?: 'short' | 'long' | 'both';
  enableBigSound?: boolean;
  enableTextOverlay?: boolean;
  referenceImageBase64?: string;
  referenceImageMimeType?: string;
}

export interface QueryCouncilPersonaResult {
  persona_breakdown: Record<string, string[]>;
  final_short_query_targets: string[];
  final_long_tail_queries: string[];
  seed_queries_used: string[];
}

export type HistoryCategory = 'video_prompt' | 'photo_prompt' | 'splitter_result' | 'tiktok_download' | 'content_ideas' | 'frame_extraction' | 'tiktok_shop_ideas';

export interface HistoryItem {
  id: string;
  category: HistoryCategory;
  title: string;
  subtitle?: string;
  timestamp: number;
  accessCode?: string;
  clientId?: string;
  clientName?: string;
  data: {
    // For video_prompt / photo_prompt / splitter_result / content_ideas
    prompt?: string;
    contentIdeasResult?: string;
    modelUsed?: string;
    targetAI?: string;
    segmentDuration?: string;
    photoStyle?: string;
    aspectRatio?: string;
    targetGenerator?: string;
    sourceText?: string;
    contentType?: string;
    tone?: string;
    fileName?: string;
    previewUrl?: string;
    // For tiktok_download
    tiktokUrl?: string;
    tiktokTitle?: string;
    tiktokCover?: string;
    tiktokPlay?: string;
    tiktokAuthor?: string;
    // For frame_extraction
    frameCount?: number;
    extractionMode?: string;
    videoName?: string;
    extractedFrames?: Array<{
      id: string;
      dataUrl: string;
      timestamp: number;
      timestampFormatted: string;
      type: 'manual' | 'automatic';
      width: number;
      height: number;
    }>;
    [key: string]: any;
  };
}

export interface AntiLimitConfig {
  enableCache: boolean;
  enableAutoRetry: boolean;
  customApiKey: string;
  apiKeys?: string[];
}

export interface UserSession {
  code: string;
  role: 'admin' | 'user';
  name?: string;
  email?: string;
  loginTime: number;
}

export interface AccessCodeItem {
  code: string;
  note: string;
  createdAt: number;
}
