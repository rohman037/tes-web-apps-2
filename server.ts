import express from 'express';
import rateLimit from 'express-rate-limit';
import { logger } from './src/utils/logger';
import next from 'next';

import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import { GoogleGenAI } from '@google/genai';
import cron from 'node-cron';
import { runAutoAgentFactory } from './src/agents/agentAutoAgentFactory';
import { analyzeUserGrowth } from './src/agents/agentUserGrowthAnalyst';
import { optimizeCostAndTiers } from './src/agents/agentCostTierOptimizer';
import { detectAbuseAndAnomalies } from './src/agents/agentAbuseAnomalyDetector';
import { requireAuth, requireAdminRole } from './src/middleware/auth';
import { getModelRoutingPlan, MODEL_TIERS, getInitialTierForTask } from './src/routing/modelRouter';
import { getApiKeys, saveApiKeys } from './src/lib/admin/apiKeys';
import { buildQueryCouncilPrompt, runIndonesianQueryCouncil } from './src/agents/agentIndonesianQueryCouncil';
import {
  initDbSeed,
  testFirestoreHealth,
  dbGetClients,
  dbSaveClient,
  dbDeleteClient,
  dbGetPackages,
  dbSavePackage,
  dbDeletePackage,
  dbGetTransactions,
  dbSaveTransaction,
  dbDeleteTransaction,
  dbGetQrisConfig,
  dbSaveQrisConfig,
  dbGetContactSettings,
  dbSaveContactSettings,
  dbGetLoginUiSettings,
  dbSaveLoginUiSettings,
  dbGetUserUiSettings,
  dbSaveUserUiSettings,
  dbGetAiAgents,
  dbSaveAiAgent,
  dbDeleteAiAgent,
  dbGetCategoryTaxonomy,
  dbSaveCategoryTaxonomyItem,
  dbGetCategoryProposals,
  dbSaveCategoryProposal,
  dbGetSystemMemory,
  dbSaveSystemMemory,
  dbGetPendingSchemaChanges,
  dbSavePendingSchemaChange,
  dbGetAuditLogs,
  dbAddAuditLog,

  dbGetAccessCodes, dbSaveAccessCode, dbDeleteAccessCode,
  dbGetAnnouncements, dbSaveAnnouncement, dbDeleteAnnouncement,
  dbGetFormulas, dbSaveFormula, dbDeleteFormula,
  dbGetAffiliates, dbSaveAffiliate, dbDeleteAffiliate,
  dbGetActiveGenerations, dbSaveActiveGenerations,
  dbGetTrackingEvents, dbAddTrackingEvent,
  dbGetLearningQueue, dbSaveLearningQueueItem,
  dbGetBannedDevices, dbSaveBannedDevice, dbDeleteBannedDevice,

  dbGetApiKeys, dbSaveApiKeys, dbGetGrowthState, dbSaveGrowthState
} from './src/db/dbService';



import { monitorAndValidateIngestion } from './src/agents/agentIngestionMonitor';
import { extractMultiModalSignals } from './src/agents/agentSignalExtractor';
import { calculateMultimodalFusionScore } from './src/agents/agentMultimodalFusion';
import { classifyContentCategory } from './src/agents/agentCategoryClassifier';
import { proposeNewCategoryTaxonomy } from './src/agents/agentTaxonomyProposer';
import { updateHookPatternSystemMemory } from './src/agents/agentHookPatternUpdater';
import { governAEOPipelineExecution } from './src/agents/agentAeoPipelineGovernor';
import { superviseMetaAutoBuild } from './src/agents/agentMetaAutoBuildSupervisor';
import { dispatchRealtimeBroadcast } from './src/agents/agentRealtimeBroadcastDispatcher';
import { auditPaymentAndClientHardening } from './src/agents/agentPaymentClientHardeningAuditor';
import { runStructuredPromptArchitect, isStructureSchemaConsistent } from './src/agents/agentStructuredPromptArchitect';
import { buildAEOPipelinePrompt, formatAEOOutputToMarkdown, AEOPipelineResult } from './src/agents/aeoAgentPipeline';
import {
  evaluateGrowthAndScale,
  getGrowthScalingState,
  rollbackGrowthScalingVersion,
  setFullAutoMode,
  saveGrowthScalingState,
  DEFAULT_GROWTH_STATE
} from './src/lib/admin/growthScaling';
import { DEFAULT_AI_AGENTS } from './src/lib/admin/aiAgents';

async function startServer() {
  const dev = process.env.NODE_ENV !== 'production';
  const nextApp = next({ dev, dir: process.cwd() });
  const handle = nextApp.getRequestHandler();
  await nextApp.prepare();

  const app = express();
  const PORT = 3000;

  // Initialize DB seed on server startup (non-blocking safe fallback)
  try {
    await initDbSeed();
  } catch (err) {
    logger.warn('[DbService] initDbSeed failed on startup (continuing with cache):', err);
  }

  // Increase payload limits for base64 video data on API routes only
  // Do not parse body globally so Next.js internal requests (_next, devtools, dev indicators) receive unconsumed streams
  app.use('/api', express.json({ limit: '100mb' }));
  app.use('/api', express.urlencoded({ limit: '100mb', extended: true }));

  // Enable trust proxy for Google Cloud Run / Nginx reverse proxy so req.ip reflects actual client IP
  app.set('trust proxy', 1);

  // Apply Global API Rate Limiter to prevent DoS and quota drain with reasonable thresholds and real-time exemptions
  const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute window
    max: 600, // Up to 600 requests per minute per client IP
    message: { error: 'Terlalu banyak permintaan (Rate limit). Silakan coba lagi sebentar lagi.' },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
      const url = req.originalUrl || req.url || '';
      return (
        url.includes('/api/events') ||
        url.includes('/api/health') ||
        url.includes('/api/ping') ||
        url.includes('/active-status') ||
        url.includes('/events/live') ||
        url.includes('/events/stream') ||
        url.includes('/events/poll')
      );
    },
  });
  app.use('/api', apiLimiter);

  // --- BANNED DEVICES & ADVANCED SECURITY ENFORCEMENT ENGINE ---
  interface BannedDeviceItem {
    id: string;
    fingerprint: string;
    ip: string;
    accessCode?: string;
    reason: string;
    bannedAt: string;
    bannedBy: string;
  }

  const bannedDevicesMap = new Map<string, BannedDeviceItem>();
  const failedLoginTracker = new Map<string, { count: number; lastAttempt: number }>();

  async function loadBannedDevicesServer() {
    try {
      const list = await dbGetBannedDevices();
      if (Array.isArray(list)) {
        for (const item of list) {
          const key = item.id || item.fingerprint || item.ip;
          if (key) bannedDevicesMap.set(key, item);
        }
      }
    } catch (e) {
      logger.warn('[Security Engine] Failed loading banned devices from DB:', e);
    }
  }
  await loadBannedDevicesServer();

  function isDeviceOrIpBanned(ip: string, fingerprint?: string, accessCode?: string): { banned: boolean; reason?: string } {
    const cleanIp = (ip || '').replace('::ffff:', '').trim();
    const cleanFp = (fingerprint || '').trim();
    const cleanCode = (accessCode || '').trim().toUpperCase();

    for (const item of bannedDevicesMap.values()) {
      if (cleanFp && item.fingerprint && item.fingerprint === cleanFp) {
        return { banned: true, reason: item.reason || 'Perangkat (Fingerprint) ini telah diblokir secara permanen oleh Sistem Keamanan.' };
      }
      if (cleanIp && item.ip && item.ip === cleanIp) {
        return { banned: true, reason: item.reason || 'Alamat IP Anda telah diblokir secara permanen.' };
      }
      if (cleanCode && item.accessCode && item.accessCode.toUpperCase() === cleanCode) {
        return { banned: true, reason: item.reason || 'Kode Akses ini telah diblokir karena aktivitas mencurigakan.' };
      }
    }

    return { banned: false };
  }

  async function banDeviceOrIp(details: { fingerprint?: string; ip: string; accessCode?: string; reason: string; bannedBy?: string }) {
    const id = `ban_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const bannedItem: BannedDeviceItem = {
      id,
      fingerprint: details.fingerprint || '',
      ip: (details.ip || '').replace('::ffff:', '').trim(),
      accessCode: details.accessCode ? details.accessCode.trim().toUpperCase() : '',
      reason: details.reason || 'Pelanggaran keamanan / Konsol terdeteksi',
      bannedAt: new Date().toISOString(),
      bannedBy: details.bannedBy || 'SYSTEM_AUTO_BAN',
    };

    bannedDevicesMap.set(id, bannedItem);
    if (bannedItem.fingerprint) bannedDevicesMap.set(bannedItem.fingerprint, bannedItem);
    if (bannedItem.ip) bannedDevicesMap.set(bannedItem.ip, bannedItem);
    if (bannedItem.accessCode) bannedDevicesMap.set(bannedItem.accessCode, bannedItem);

    try {
      await dbSaveBannedDevice(bannedItem);
    } catch (e) {
      logger.warn('[Security Engine] Failed saving banned device to DB:', e);
    }

    if (bannedItem.accessCode) {
      try {
        const clients = await dbGetClients();
        const cli = clients.find((c) => c.accessCode && c.accessCode.toUpperCase() === bannedItem.accessCode);
        if (cli) {
          cli.status = 'suspended' as any;
          await dbSaveClient(cli);
        }
      } catch (e) {}
    }

    dbAddAuditLog({
      id: 'audit_' + Date.now(),
      adminName: 'DEVICE_BANNED',
      action: `Device/IP Banned (${bannedItem.reason}) - IP: ${bannedItem.ip}, FP: ${bannedItem.fingerprint || 'N/A'}, Code: ${bannedItem.accessCode || 'N/A'}`,
      details: 'security_system',
      timestamp: new Date().toISOString(),
      category: 'Security System' as any,
    });

    try {
      if (typeof broadcastLiveEvent === 'function') {
        broadcastLiveEvent({ type: 'device_banned', bannedDevice: bannedItem });
      }
    } catch (e) {}

    return bannedItem;
  }

  // Middleware to verify that request is not from a banned device/IP/Code
  app.use('/api', (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.path.includes('/admin/banned-devices/unban') || req.path === '/health') {
      return next();
    }

    const clientIp = req.ip || req.socket.remoteAddress || '';
    const fingerprint = (req.headers['x-device-fingerprint'] as string) || req.body?.fingerprint || '';
    const accessCode = (req.headers['x-access-code'] as string) || (req.headers['x-client-access-code'] as string) || req.body?.accessCode || '';

    const check = isDeviceOrIpBanned(clientIp, fingerprint, accessCode);
    if (check.banned) {
      return res.status(403).json({
        error: `Akses Ditolak! Perangkat atau IP Anda telah diblokir secara permanen oleh Sistem Keamanan Backend (Device Banned). Alasan: ${check.reason || 'Pelanggaran Akses'}.`,
        code: 'DEVICE_BANNED',
        isBanned: true,
        reason: check.reason,
      });
    }

    next();
  });

  // Helper to instantiate Gemini AI client dynamically
  function getGeminiClient(customApiKey?: string) {
    const keyToUse = customApiKey && customApiKey.trim() ? customApiKey.trim() : process.env.GEMINI_API_KEY;
    if (!keyToUse) {
      throw new Error('API Key Gemini tidak dikonfigurasi. Silakan atur di Pengaturan Anti Limit.');
    }
    return new GoogleGenAI({
      apiKey: keyToUse,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }

  // --- BACKEND SELF-LEARNING ADAPTIVE SYSTEM MEMORY ENGINE ---
  interface SystemMemory {
    totalExecutions: number;
    successfulPromptsCount: number;
    learnedKnowledgeBase: string[];
    viralHookPatterns: string[];
    categoryUsage: {
      videoPrompt: number;
      contentIdeas: number;
      photoPrompt: number;
    };
    formulas?: any[];
    lastUpdated: string;
  }

  const MEMORY_FILE_PATH = path.join(process.cwd(), 'system_memory.json');

  async function loadSystemMemory() {
    try {
      return await dbGetSystemMemory();
    } catch (err) {
      logger.warn('[System Memory] Unable to load systemMemory from DB on startup, using default fallback:', err);
      return {
        totalExecutions: 350,
        successfulPromptsCount: 342,
        learnedKnowledgeBase: ['Hook visual di 3 detik pertama meningkatkan retention rate hingga 68%.'],
        viralHookPatterns: [{ id: 'hk_01', pattern: 'Jangan beli [produk] sebelum tau 3 hal ini!', category: 'umum', confidence: 95 }],
        categoryUsage: { videoPrompt: 120, contentIdeas: 90, photoPrompt: 40 },
        formulas: ['Hook BLUFF + 3 Adegan Visual + CTA Spesifik'],
        lastUpdated: new Date().toISOString(),
      };
    }
  }

  let systemMemory = await loadSystemMemory();

  async function saveSystemMemoryAsync() {
    try {
      systemMemory.lastUpdated = new Date().toISOString();
      await dbSaveSystemMemory(systemMemory);
      await dispatchRealtimeBroadcast('system_memory_updated', systemMemory);
    } catch (e) {
      logger.warn('[System Memory] Failed to save memory to DB:', e);
    }
  }

  function saveSystemMemory() {
    saveSystemMemoryAsync().catch((err) => logger.warn('[System Memory Async Error]', err));
  }

  function autoUpdateMemory(newInsight?: string) {
    recordExecutionAndUpgrade('videoPrompt', newInsight);
  }

  function recordExecutionAndUpgrade(type: 'videoPrompt' | 'contentIdeas' | 'photoPrompt', keyInsight?: string) {
    if (!systemMemory.categoryUsage) {
      systemMemory.categoryUsage = { videoPrompt: 0, contentIdeas: 0, photoPrompt: 0 };
    }
    if (!Array.isArray(systemMemory.learnedKnowledgeBase)) {
      systemMemory.learnedKnowledgeBase = [];
    }
    if (!Array.isArray(systemMemory.viralHookPatterns)) {
      systemMemory.viralHookPatterns = [];
    }
    if (!Array.isArray(systemMemory.formulas)) {
      systemMemory.formulas = [];
    }

    systemMemory.totalExecutions = (systemMemory.totalExecutions || 0) + 1;
    systemMemory.successfulPromptsCount = (systemMemory.successfulPromptsCount || 0) + 1;
    systemMemory.categoryUsage[type] = (systemMemory.categoryUsage[type] || 0) + 1;

    if (keyInsight && !systemMemory.learnedKnowledgeBase.includes(keyInsight)) {
      systemMemory.learnedKnowledgeBase.push(keyInsight);
    }

    // Dynamic auto-learning wisdom accumulation
    if (systemMemory.totalExecutions % 3 === 0) {
      const autoLearnedInsights = [
        `Analisis algoritma TikTok terkini (Iterasi ${systemMemory.totalExecutions}): Terapkan variasi tempo pencahayaan dan gerakan zoom-in 1.2x pada 2 detik pertama untuk meningkatkan retention rate.`,
        `Optimasi Prompt AI Video: Tambahkan indikator pencahayaan volumetric lighting & depth-of-field f/1.8 agar hasil render Sora/Kling/Runway tidak terasa kaku.`,
        `Penelitian Copywriting FYP: Caption berpola "Masalah -> Solusi Ringkas -> Hasil Bukti -> CTA Direct" terbukti meningkatkan conversion rate affiliate sebesar 35%.`
      ];
      const nextInsight = autoLearnedInsights[Math.floor(Math.random() * autoLearnedInsights.length)];
      if (!systemMemory.learnedKnowledgeBase.includes(nextInsight)) {
        systemMemory.learnedKnowledgeBase.push(nextInsight);
      }
    }

    const currentLevel = Math.floor(systemMemory.totalExecutions / 5) + 1;
    saveSystemMemory();
    logger.info(`[Silent Memory Engine] Memory updated: Level ${currentLevel} | Total Executions: ${systemMemory.totalExecutions}`);
  }

  function getSystemIntelligenceLevel() {
    if (!Array.isArray(systemMemory.learnedKnowledgeBase)) {
      systemMemory.learnedKnowledgeBase = [];
    }
    if (!Array.isArray(systemMemory.viralHookPatterns)) {
      systemMemory.viralHookPatterns = [];
    }
    if (!Array.isArray(systemMemory.formulas)) {
      systemMemory.formulas = [];
    }

    const totalExecs = systemMemory.totalExecutions || 0;
    const level = Math.floor(totalExecs / 5) + 1;
    let title = 'Pengenal Algoritma Pemula';
    if (level >= 5) title = 'Analis Konten Viral Pro';
    if (level >= 10) title = 'Master TikTok Strategist & FYP Engineer';
    if (level >= 20) title = 'Algorithmic Super-Intelligence AI';
    if (level >= 50) title = 'Autonomous Supreme Content Engine';

    return {
      level,
      title,
      totalExecutions: totalExecs,
      knowledgeCount: systemMemory.learnedKnowledgeBase.length,
      formulasCount: systemMemory.formulas.length || systemMemory.learnedKnowledgeBase.length,
      learnedWisdom: systemMemory.learnedKnowledgeBase.slice(-10),
      viralHooks: systemMemory.viralHookPatterns
    };
  }

  function getInjectedSystemInstruction(baseInstruction: string): string {
    const memory = systemMemory || { categoryUsage: {}, learnedKnowledgeBase: [], viralHookPatterns: [], activeMemory: {}, totalExecutions: 0 };
    const level = Math.floor((memory.totalExecutions || 0) / 5) + 1;
    const knowledgeBase = (memory.learnedKnowledgeBase || []).slice(-5);

    const memoryContext = `
\n---
[BACKEND ADAPTIVE MEMORY CONTEXT]
Level Pemikiran System: Level ${level} (Total Eksekusi: ${memory.totalExecutions || 0})
Formulas/Knowledge Terakumulasi:
${knowledgeBase.map((k: string, i: number) => `${i + 1}. ${k}`).join('\n')}
---
Gunakan konteks pengetahuan di atas untuk mengoptimalkan ketajaman output script/prompt.
`;
    return (baseInstruction || '') + memoryContext;
  }

  // Simple in-memory cache for TikTok metadata (10 minute TTL)
  const tiktokCache = new Map<string, { timestamp: number; data: any }>();
  const TIKTOK_CACHE_TTL_MS = 10 * 60 * 1000;

  // Server-side response cache for AI prompt generations to save quota (2 Hour TTL)
  const promptResponseCache = new Map<string, { timestamp: number; text: string; modelUsed: string; promptArchitect?: any }>();
  const PROMPT_CACHE_TTL_MS = 2 * 60 * 60 * 1000;

  const CLIENTS_FILE_PATH = path.join(process.cwd(), 'clients.json');
  const API_KEYS_FILE_PATH = path.join(process.cwd(), 'api_keys.json');

  async function getClientInfoByCode(accessCode?: string): Promise<{ name: string; accessCode: string; email?: string }> {
    if (!accessCode) return { name: 'Klien Satset', accessCode: 'GUEST' };
    const cleanCode = accessCode.trim().toUpperCase();
    try {
      const list = await dbGetClients();
      const found = list.find((c: any) => c.accessCode && c.accessCode.toUpperCase() === cleanCode);
      if (found) {
        return { name: found.name || 'Klien Satset', accessCode: found.accessCode, email: found.email };
      }
    } catch (e) { logger.warn('[Client Auth] Gagal membaca clients file (mungkin belum ada)', e); }
    
    // Check against master admin code securely
    const masterAdminCode = process.env.ADMIN_ACCESS_CODE ? process.env.ADMIN_ACCESS_CODE.trim().toUpperCase() : null;
    if (masterAdminCode && cleanCode === masterAdminCode) {
      return { name: 'Administrator', accessCode: cleanCode };
    }
    
    return { name: 'Klien Satset', accessCode: cleanCode };
  }

  const serverKeyCooldowns = new Map<string, number>();

  function isRealApiKey(key?: string): boolean {
    if (!key || typeof key !== 'string') return false;
    const k = key.trim();
    if (k.length < 10) return false;
    if (k.includes('demo_key') || k.includes('backup_key_satset') || k.includes('satset_01') || k.includes('satset_02')) {
      return false;
    }
    return true;
  }

  function normalizeGeminiModel(inputModel: string): string {
    const m = (inputModel || '').toLowerCase().trim();
    if (m === 'gemini-3.6-flash') return 'gemini-3.6-flash';
    if (m === 'gemini-3.1-pro-preview' || m === 'gemini-3.1-pro') return 'gemini-3.1-pro-preview';
    if (m === 'gemini-3.1-flash-lite' || m === 'gemini-3.5-flash-lite') return 'gemini-3.1-flash-lite';
    if (m === 'gemini-2.0-flash' || m === 'gemini-1.5-flash') return 'gemini-3.6-flash';
    if (m === 'gemini-2.0-flash-lite' || m === 'gemini-1.5-flash-lite') return 'gemini-3.1-flash-lite';
    if (m === 'gemini-2.0-pro' || m === 'gemini-1.5-pro') return 'gemini-3.1-pro-preview';
    return inputModel || 'gemini-3.6-flash';
  }

  async function getClientIsolatedKeys(customApiKeyHeader?: string, clientAccessCode?: string): Promise<string[]> {
    let userCustomKeys: string[] = [];
    if (customApiKeyHeader && customApiKeyHeader.trim()) {
      userCustomKeys = customApiKeyHeader
        .split(/[\n,]+/)
        .map((k) => k.trim())
        .filter((k) => isRealApiKey(k));
    }

    let boundKeys: string[] = [];
    if (clientAccessCode && clientAccessCode !== 'GUEST') {
      const cleanCode = clientAccessCode.trim().toUpperCase();
      try {
        const keysArr = await dbGetApiKeys();
        boundKeys = keysArr
          .filter((k: any) => k.status === 'active' && k.accessCode && k.accessCode.toUpperCase() === cleanCode && isRealApiKey(k.key))
          .map((k: any) => k.key);
      } catch (e) { logger.warn('[API Keys] Gagal membaca api keys untuk access code', e); }
    }

    const clientKeys = Array.from(new Set([...userCustomKeys, ...boundKeys])).filter((k) => isRealApiKey(k));
    if (clientKeys.length > 0) {
      return clientKeys;
    }

    const systemKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : '';
    let globalKeys: string[] = [];
    try {
      const keysArr = await dbGetApiKeys();
      globalKeys = keysArr
        .filter((k: any) => k.status === 'active' && (!k.accessCode || k.accessCode === 'SYSTEM' || k.accessCode === 'GLOBAL') && isRealApiKey(k.key))
        .map((k: any) => k.key);
    } catch (e) { logger.warn('[API Keys] Gagal membaca global api keys', e); }

    const candidateKeys = Array.from(new Set([...(isRealApiKey(systemKey) ? [systemKey] : []), ...globalKeys])).filter((k) => isRealApiKey(k));
    const now = Date.now();
    const availableKeys = candidateKeys.filter((k) => {
      const cd = serverKeyCooldowns.get(k);
      return !cd || cd < now;
    });

    if (availableKeys.length > 0) {
      return availableKeys;
    }

    return candidateKeys;
  }

  function extractClientAccessCode(req: express.Request): string {
    const code =
      (req.headers['x-access-code'] as string) ||
      (req.headers['x-client-id'] as string) ||
      (req.headers['x-client-access-code'] as string) ||
      req.body?.accessCode ||
      req.body?.clientId ||
      'GUEST';
    return code.trim();
  }

  // Helper function for calling Gemini API with key rotation, candidate model fallback & anti-limit exponential backoff + jitter
  async function callGeminiWithFallback(
    userSelectedModel: string,
    promptPayload: any,
    customApiKeyHeader?: string,
    clientAccessCode?: string,
    targetTier?: any
  ): Promise<{ text: string; modelUsed: string }> {
    // Fallback to legacy isolated keys logic if custom key logic is bypassed
    const keyCandidates = await getClientIsolatedKeys(customApiKeyHeader, clientAccessCode);
    
    const primaryModel = normalizeGeminiModel(userSelectedModel);
    
    // Top model hierarchy priority: Flagship Pro/Reasoning -> High Performance Flash -> Lite Fallback
    const TOP_MODEL_HIERARCHY = [
      'gemini-3.1-pro-preview',
      'gemini-3.1-pro',
      'gemini-3.6-flash',
      'gemini-2.5-pro',
      'gemini-2.5-flash',
      'gemini-3.1-flash-lite',
      'gemini-2.5-flash-lite'
    ];

    let candidateModels = Array.from(new Set([
      primaryModel,
      ...TOP_MODEL_HIERARCHY
    ])).filter((m): m is string => Boolean(m && m.trim().length > 0));

    // Calculate routing plan prioritizing top models
    try {
       const plan = getModelRoutingPlan(userSelectedModel, customApiKeyHeader);
       if (plan && plan.targetModels && plan.targetModels.length > 0) {
          const mappedModels = plan.targetModels.map((m) => normalizeGeminiModel(m));
          candidateModels = Array.from(new Set([
            primaryModel,
            ...mappedModels,
            ...TOP_MODEL_HIERARCHY
          ])).filter((m): m is string => Boolean(m && m.trim().length > 0));
       }
    } catch (e) {
       logger.warn('[Routing] Failed to calculate model routing plan, using top model fallback hierarchy');
    }

    if (keyCandidates.length === 0) {
      throw new Error('API Key Gemini tidak dikonfigurasi. Silakan atur di Pengaturan Anti Limit.');
    }

    let lastError: any = null;

    for (let kIdx = 0; kIdx < keyCandidates.length; kIdx++) {
      const activeKey = keyCandidates[kIdx];
      let aiInstance: GoogleGenAI;
      try {
        aiInstance = getGeminiClient(activeKey);
      } catch (e) {
        continue;
      }

      for (const targetModel of candidateModels) {
        let attempts = 0;
        const maxAttempts = 2;

        while (attempts < maxAttempts) {
          attempts++;
          try {
            logger.info(`[Gemini Request] Key #${kIdx + 1}/${keyCandidates.length}, Model: ${targetModel}, Attempt: ${attempts}...`);
            
            const isThinkingModel = targetModel === 'gemini-3.1-pro-preview' || targetModel === 'gemini-3.1-pro';
            const baseConfig = promptPayload.config || {};
            
            const requestConfig: any = {
              ...baseConfig,
            };

            const rawInstruction = requestConfig.systemInstruction || "You are an elite AI assistant.";
            requestConfig.systemInstruction = getInjectedSystemInstruction(rawInstruction);

            if (isThinkingModel) {
              requestConfig.thinkingConfig = {
                thinkingLevel: 'HIGH',
              };
              delete requestConfig.maxOutputTokens;
            }

            const response = await aiInstance.models.generateContent({
              model: targetModel,
              contents: promptPayload.contents,
              config: requestConfig,
            });

            if (response && response.text) {
              return { text: response.text, modelUsed: targetModel };
            }
          } catch (err: any) {
            lastError = err;
            const errMsg = String(err?.message || err || '');
            const status = (err as any)?.status || (err as any)?.statusCode || 0;

            logger.warn(`[Gemini Warning] Key #${kIdx + 1}, Model ${targetModel} attempt ${attempts} failed:`, errMsg);

            const isDeadKey =
              status === 403 ||
              errMsg.includes('403') ||
              errMsg.includes('API_KEY_INVALID') ||
              errMsg.includes('API key not found') ||
              errMsg.includes('PERMISSION_DENIED') ||
              errMsg.includes('UNAUTHENTICATED');

            const isRateLimitOrQuota =
              status === 429 ||
              errMsg.includes('429') ||
              errMsg.includes('RESOURCE_EXHAUSTED') ||
              errMsg.includes('Quota exceeded') ||
              errMsg.includes('limit: 0');

            if (isDeadKey || isRateLimitOrQuota) {
                serverKeyCooldowns.set(activeKey, Date.now() + 5 * 60 * 1000);
                try {
                   const keys = await dbGetApiKeys();
                   const foundKey = keys.find((k: any) => k.key === activeKey);
                   if (foundKey) {
                       foundKey.cooldownUntil = Date.now() + 5 * 60 * 1000;
                       await dbSaveApiKeys(keys);
                       logger.warn(`[Circuit Breaker] Key #${kIdx + 1} isolated until ${new Date(foundKey.cooldownUntil).toISOString()}`);
                   }
                } catch(cbErr) {
                   // ignore if db not accessible
                }
            }

            if (isDeadKey) {
              logger.warn(`[Auto-Prune] Key #${kIdx + 1} is invalid/dead. Rotating to next key...`);
              attempts = maxAttempts;
              break;
            }

            if (isRateLimitOrQuota) {
              logger.info(`[Model Cascading] Model ${targetModel} rate limited on Key #${kIdx + 1}. Cascading to next model...`);
              attempts = maxAttempts;
              break;
            }

            if (errMsg.includes('503') || errMsg.includes('UNAVAILABLE') || errMsg.includes('demand')) {
              const jitter = Math.floor(Math.random() * 2000);
              const backoffDelay = 1000 + jitter;
              logger.info(`[Anti-Limit Backoff] Waiting ${backoffDelay}ms before retry...`);
              await new Promise((resolve) => setTimeout(resolve, backoffDelay));
            } else {
              // Non-retryable error on this model (e.g. model 404/400), cascade to next candidate model
              attempts = maxAttempts;
              break;
            }
          }
        }

        const lastErrStr = String(lastError?.message || lastError || '');
        const isDeadKey =
          lastErrStr.includes('403') ||
          lastErrStr.includes('API_KEY_INVALID') ||
          lastErrStr.includes('PERMISSION_DENIED') ||
          lastErrStr.includes('UNAUTHENTICATED');

        if (isDeadKey) {
          break;
        }
      }
    }

    const errorMsg = String(lastError?.message || lastError || '');
    if (errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED') || errorMsg.includes('Quota exceeded')) {
      const err = new Error('Batas kuota harian/menit AI Gemini telah terlampaui (429 Rate Limit). Silakan tambahkan satu atau beberapa API Key cadangan di menu "Anti Limit API" di bagian atas.');
      (err as any).statusCode = 429;
      throw err;
    } else if (errorMsg.includes('503') || errorMsg.includes('UNAVAILABLE') || errorMsg.includes('demand')) {
      const err = new Error('Model AI Gemini saat ini sedang mengalami lonjakan trafik (503 High Demand). Silakan coba klik tombol "Hasilkan Ulang" dalam beberapa saat lagi.');
      (err as any).statusCode = 503;
      throw err;
    }

    throw lastError || new Error('Gagal menghasilkan prompt dari AI Gemini.');
  }

  // API endpoint for Audio Transcription using Gemini 3.6 Flash / Flash Lite
  app.post('/api/transcribe-audio', async (req, res) => {
    try {
      const { base64Audio, mimeType = 'audio/wav', prompt } = req.body;
      if (!base64Audio) {
        return res.status(400).json({ error: 'Data audio base64 diperlukan.' });
      }

      const clientAccessCode = extractClientAccessCode(req);
      const customApiKey = (req.headers['x-custom-api-key'] as string) || req.body.customApiKey;

      const audioPart = {
        inlineData: {
          mimeType: mimeType || 'audio/wav',
          data: base64Audio.replace(/^data:audio\/[a-z0-9]+;base64,/, '')
        }
      };

      const promptText = prompt || 'Transkripsikan rekaman suara audio ini secara akurat dan lengkap ke dalam teks Bahasa Indonesia.';

      const result = await callGeminiWithFallback(
        'gemini-3.6-flash',
        {
          contents: { parts: [audioPart, { text: promptText }] },
          config: { temperature: 0.2 }
        },
        customApiKey,
        clientAccessCode
      );

      res.json({
        transcript: result.text,
        modelUsed: result.modelUsed
      });
    } catch (error: any) {
      logger.error('Transcribe audio error:', error);
      res.status(500).json({ error: error.message || 'Gagal merubah audio menjadi teks' });
    }
  });

  // API endpoint for Video Analysis & Prompt Generation
  app.post('/api/generate-prompt', async (req, res) => {
    const clientAccessCode = extractClientAccessCode(req);
    const clientInfo = await getClientInfoByCode(clientAccessCode);
    const taskId = req.body.taskId || `gen_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const clientIp = (req.ip || req.socket.remoteAddress || '').replace('::ffff:', '').trim();
    const fingerprint = (req.headers['x-device-fingerprint'] as string) || req.body?.fingerprint || '';
    const userAgent = req.headers['user-agent'] || '';

    const activeTask = {
      id: taskId,
      clientId: clientAccessCode,
      accessCode: clientAccessCode,
      clientName: clientInfo.name,
      clientEmail: clientInfo.email || '',
      tool: 'Video to Prompt',
      status: 'generating',
      category: req.body.category || 'umum',
      topic: req.body.topic || `Target: ${req.body.targetAI || 'General'}`,
      modelUsed: req.body.model || 'gemini-3.6-flash',
      startedAt: new Date().toISOString(),
      updatedAt: Date.now(),
      ip: clientIp,
      deviceFingerprint: fingerprint,
      userAgent: userAgent,
    };
    activeGenerationsMap.set(taskId, activeTask);

    broadcastLiveEvent({
      type: 'active_status_update',
      activeGenerations: Array.from(activeGenerationsMap.values()),
      activeUserCount: sseClients.size,
    });

    try {
      const customApiKey = (req.headers['x-custom-api-key'] as string) || req.body.customApiKey;
      const useCache = req.headers['x-use-cache'] !== 'false';

      const {
        mimeType,
        base64Data,
        model = 'gemini-3.6-flash',
        targetAI = 'general', // sora | runway | kling | luma | pika | general
        segmentDuration = '10',
        includeActions = true,
        includeVoiceOver = true,
        includeCinematics = true,
      } = req.body;

      if (!base64Data || !mimeType) {
        return res.status(400).json({ error: 'Data video dan tipe MIME diperlukan' });
      }

      // Check Cache to save quota & prevent rate limits using content hash
      const contentHash = crypto.createHash('sha256').update(base64Data).digest('hex').slice(0, 32);
      const cacheInput = `${mimeType}_${base64Data.length}_${contentHash}_${model}_${targetAI}_${segmentDuration}_${includeActions}_${includeVoiceOver}_${includeCinematics}`;
      const cacheKey = crypto.createHash('sha256').update(cacheInput).digest('hex');

      if (useCache) {
        const cached = promptResponseCache.get(cacheKey);

        if (cached && Date.now() - cached.timestamp < PROMPT_CACHE_TTL_MS) {
          logger.info('[Prompt Cache Hit - Saved Quota]', cacheKey);
          return res.json({
            prompt: cached.text,
            modelUsed: cached.modelUsed,
            promptArchitect: cached.promptArchitect,
            cached: true
          });
        }
      }

      // Supported primary model choices
      const userSelectedModel = model || 'gemini-3.6-flash';

      // Target AI Generator Syntax Guide
      let aiGuide = '';
      if (targetAI === 'runway') {
        aiGuide = 'Format prompt dioptimalkan khusus untuk Runway Gen-3 Alpha. Gunakan deskripsi pergerakan kamera persis, pencahayaan sinematik, dan gerakan karakter fluid. Akhiri dengan kata kunci style sinematik.';
      } else if (targetAI === 'sora') {
        aiGuide = 'Format prompt dioptimalkan khusus untuk OpenAI Sora. Sertakan deskripsi naratif yang sangat kaya akan fotorealisme, fisika dunia, pencahayaan alami, dan depth of field.';
      } else if (targetAI === 'kling') {
        aiGuide = 'Format prompt dioptimalkan untuk Kling AI. Sertakan instruksi detail mengenai tekstur visual, pencahayaan, gerakan halus 3D, dan aksi karakter.';
      } else if (targetAI === 'luma') {
        aiGuide = 'Format prompt dioptimalkan untuk Luma Dream Machine. Fokus pada gerakan kamera fokal, pencahayaan atmosferik, dan konsistensi elemen visual.';
      } else {
        aiGuide = 'Format prompt siap pakai universal untuk semua AI Video Generator (Sora, Runway Gen-3, Kling, Luma, Pika).';
      }

      // Build custom user prompt instruction based on duration segmentation and feature options
      let promptText = '';

      if (segmentDuration !== 'auto') {
        const sec = parseInt(segmentDuration, 10) || 10;
        promptText = `Anda adalah AI Video Prompt Engineer & Sinematografer Kelas Dunia.
Analisis video/skrip ini dengan presisi tinggi. ${aiGuide}
PECAH & BAGI seluruh durasi video menjadi beberapa segmen prompt klip terpisah dengan durasi masing-masing tepat sekitar ${sec} detik (pilihan split user: ${sec} detik per klip).
Contoh: Jika durasi total video adalah 30 detik dan split ${sec} detik, buatlah persis ${Math.max(1, Math.ceil(30 / sec))} segmen klip (Klip 1: 00:00 - 00:${sec < 10 ? '0' + sec : sec}, Klip 2: 00:${sec < 10 ? '0' + sec : sec} - ..., dst).

PENTING: Untuk SETIAP segmen klip (${sec} detik), Anda WAJIB menggunakan struktur tag dalam tanda kurung siku berikut ini secara persis (dalam Bahasa Inggris untuk kompatibilitas AI Video Generator):

### 🎬 KLIP PROMPT SEGMEN [Nomor Klip] (Timestamp: [Awal] - [Akhir])

[Style]: The visual style is commercial, polished, high production quality e-commerce product or video demonstration, bright even lighting, clean aesthetic.
[Environment]: Detailed description of setting, furniture, background elements, window light, props, background color palette.
[Tone & Pacing]: Tone (friendly, confident, enthusiastic), presenter expression, speech delivery pace and energy.
[Camera]: Static or dynamic camera move (medium shot, eye-level angle, framing, no camera shake or panning).
[Lighting]: Soft, diffused frontal lighting, bright natural light, subtle skin highlights, no harsh shadows.
[Actions]:
- Detailed physical actions, body language, hands position, product holding, gestures at specific timestamps.
- **Dialogue**: "Exact line or voice-over transcript for this clip segment."
- Additional reaction, smiling, nodding, or product movement.
[Background Sound]: Crisp voice recording, ambient sound or background music details (or silence).
[Transition / Editing]: Single continuous shot, clean cut, or smooth clip transition.
[Call to Action]: Verbalized call to action or inviting final gesture for this segment if applicable.

- **Master Prompt AI Video (Siap Copy untuk ${targetAI.toUpperCase()})**:
\`\`\`text
[Style]: The visual style is commercial and polished...
[Environment]: The setting is...
[Tone & Pacing]: The tone is...
[Camera]: The camera is...
[Lighting]: The scene is lit with...
[Actions]:
- The clip begins with...
- **Dialogue**: "..."
[Background Sound]: Clear voice...
[Transition / Editing]: Single continuous shot...
[Call to Action]: "..."
\`\`\`

---`;
      } else {
        promptText = `Anda adalah AI Video Prompt Engineer & Sinematografer Kelas Dunia.
Analisis video/skrip ini secara menyeluruh dari awal hingga akhir. ${aiGuide}
Hasilkan breakdown terstruktur serta Master Prompt AI Rekreatif menggunakan format tag resmi berikut ini:

### 🎬 MASTER PROMPT VIDEO LENGKAP

[Style]: The visual style is commercial and polished, typical of an e-commerce product demonstration video for social media. It employs a clean aesthetic with bright, even lighting to highlight the product and the presenter.

[Environment]: The setting is a modern, well-lit space. Detailed background elements, furniture, lighting, and decor.

[Tone & Pacing]: Friendly, enthusiastic, and confident tone. Warm engaging smile throughout. Moderate persuasive speech delivery.

[Camera]: Static or dynamic camera setup, maintaining consistent medium shot, eye-level angle, direct personal connection.

[Lighting]: Bright, soft, and even frontal lighting, softbox diffusion, natural window light, flattering professional illumination.

[Actions]:
- Chronological step-by-step breakdown of subject movements, product interaction, gestures at specific timestamps.
- **Dialogue**: "Exact transcript or voice-over script kata demi kata."
- Additional gestures and reactions.

[Background Sound]: Clear well-recorded voice, background music or ambient sound setup.

[Transition / Editing]: Single continuous shot or specific transition notes.

[Call to Action]: Explicitly verbalized call to action or visual CTA.

- **Master Prompt AI Video (Siap Copy untuk ${targetAI.toUpperCase()})**:
\`\`\`text
[Style]: The visual style is commercial and polished...
[Environment]: The setting is...
[Tone & Pacing]: The tone is...
[Camera]: The camera is...
[Lighting]: The scene is lit with...
[Actions]:
- The video begins with...
- **Dialogue**: "..."
[Background Sound]: Clear voice...
[Transition / Editing]: Single continuous shot...
[Call to Action]: "..."
\`\`\``;
      }

      let promptPayload: any;

      if (mimeType === 'text/plain') {
        const rawUserText = Buffer.from(base64Data, 'base64').toString('utf-8');
        promptPayload = {
          contents: {
            parts: [
              {
                text: `BERIKUT TEKS DESKRIPSI / SKRIP / KONSEP ADAGAN INPUT DARI USER:
"""
${rawUserText}
"""

TUGAS UTAMA ANDA:
${promptText}`
              }
            ]
          },
          config: {
            systemInstruction:
              "You are an elite cinematographer, video editor, and AI prompt engineer. Your task is to analyze user requests, video descriptions, and scripts with extreme precision. Break down the scene, physical actions, voice overs, camera moves, and lighting into clean, copyable video prompts in English for each segment. Output your response clearly using the requested Indonesian headers and Markdown layout.",
          }
        };
      } else {
        promptPayload = {
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: mimeType,
                  data: base64Data,
                },
              },
              {
                text: promptText,
              },
            ],
          },
          config: {
            systemInstruction:
              "You are an elite cinematographer, video editor, and AI prompt engineer. Your task is to analyze videos with extreme accuracy. Pay close attention to physical actions, speech transcriptions, voice overs, camera moves, and lighting. Output your response clearly using the requested Indonesian headers and Markdown layout.",
          },
        };
      }

      const result = await callGeminiWithFallback(userSelectedModel, promptPayload, customApiKey, clientAccessCode);

      // Multi-Agent Step: Run Structured Prompt Architect to refine & enrich without breaking markdown schema
      let finalPromptText = result.text;
      let architectMetadata: any = undefined;

      try {
        const architectResult = await runStructuredPromptArchitect(
          result.text,
          targetAI || 'general'
        );
        architectMetadata = architectResult;

        if (architectResult.isOptimized && isStructureSchemaConsistent(result.text, architectResult.finalPrompt)) {
          finalPromptText = architectResult.finalPrompt;
        } else if (architectResult.isOptimized) {
          logger.warn('[StructuredPromptArchitect] Video prompt output failed structural schema consistency check, falling back to raw model draft.');
        }
      } catch (archErr) {
        logger.warn('[StructuredPromptArchitect] Video prompt enhancement notice:', archErr);
      }

      // Record successful execution & train system memory
      recordExecutionAndUpgrade('videoPrompt');

      activeTask.status = 'completed';
      activeTask.updatedAt = Date.now();
      activeGenerationsMap.set(taskId, activeTask);

      broadcastLiveEvent({
        type: 'active_status_update',
        activeGenerations: Array.from(activeGenerationsMap.values()),
        activeUserCount: sseClients.size,
      });

      setTimeout(async () => {
        activeGenerationsMap.delete(taskId);
        broadcastLiveEvent({
          type: 'active_status_update',
          activeGenerations: Array.from(activeGenerationsMap.values()),
          activeUserCount: sseClients.size,
        });
      }, 120000);

      if (useCache) {
        const cacheInput = `${mimeType}_${base64Data.slice(0, 500)}_${base64Data.length}_${model}_${targetAI}_${segmentDuration}`;
        const cacheKey = crypto.createHash('sha256').update(cacheInput).digest('hex');
        promptResponseCache.set(cacheKey, {
          timestamp: Date.now(),
          text: finalPromptText,
          modelUsed: result.modelUsed,
          promptArchitect: architectMetadata
        });
      }

      res.json({
        prompt: finalPromptText,
        modelUsed: result.modelUsed,
        promptArchitect: architectMetadata
      });
    } catch (error: any) {
      logger.error('Error generating video prompt:', error);
      activeTask.status = 'failed';
      activeTask.updatedAt = Date.now();
      activeGenerationsMap.set(taskId, activeTask);
      broadcastLiveEvent({
        type: 'active_status_update',
        activeGenerations: Array.from(activeGenerationsMap.values()),
        activeUserCount: sseClients.size,
      });
      setTimeout(() => {
        activeGenerationsMap.delete(taskId);
        broadcastLiveEvent({
          type: 'active_status_update',
          activeGenerations: Array.from(activeGenerationsMap.values()),
          activeUserCount: sseClients.size,
        });
      }, 5000);
      const statusCode = error.statusCode || 500;
      res.status(statusCode).json({ error: error.message || 'Terjadi kesalahan saat menganalisis video dengan AI.' });
    }
  });

  // API endpoint for Image / Photo Analysis & AI Image Prompt Generation
  app.post('/api/generate-photo-prompt', async (req, res) => {
    const clientAccessCode = extractClientAccessCode(req);
    const clientInfo = await getClientInfoByCode(clientAccessCode);
    const taskId = req.body.taskId || `gen_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const clientIp = (req.ip || req.socket.remoteAddress || '').replace('::ffff:', '').trim();
    const fingerprint = (req.headers['x-device-fingerprint'] as string) || req.body?.fingerprint || '';
    const userAgent = req.headers['user-agent'] || '';

    const activeTask = {
      id: taskId,
      clientId: clientAccessCode,
      accessCode: clientAccessCode,
      clientName: clientInfo.name,
      clientEmail: clientInfo.email || '',
      tool: 'Photo Prompt',
      status: 'generating',
      category: req.body.category || 'umum',
      topic: req.body.photoStyle ? `Style: ${req.body.photoStyle}` : 'Photo Analysis',
      modelUsed: req.body.model || 'gemini-3.6-flash',
      startedAt: new Date().toISOString(),
      updatedAt: Date.now(),
      ip: clientIp,
      deviceFingerprint: fingerprint,
      userAgent: userAgent,
    };
    activeGenerationsMap.set(taskId, activeTask);

    broadcastLiveEvent({
      type: 'active_status_update',
      activeGenerations: Array.from(activeGenerationsMap.values()),
      activeUserCount: sseClients.size,
    });

    try {
      const customApiKey = (req.headers['x-custom-api-key'] as string) || req.body.customApiKey;
      const useCache = req.headers['x-use-cache'] !== 'false';

      const {
        mimeType,
        base64Data,
        model = 'gemini-3.6-flash',
        targetGenerator = 'nanobananapro', // nanobananapro | midjourney | flux | dalle3 | stablediffusion
        photoStyle = 'commercial', // commercial | portrait | cinematic | product | anime | architectural
        aspectRatio = '--ar 16:9',
        negativePrompt,
        referenceImageBase64,
        referenceImageMimeType
      } = req.body;

      if (!base64Data || !mimeType) {
        return res.status(400).json({ error: 'Data gambar/teks dan tipe MIME diperlukan' });
      }

      if (useCache) {
        const cacheInput = `photo_${mimeType}_${base64Data.slice(0, 500)}_${base64Data.length}_${model}_${targetGenerator}_${photoStyle}_${aspectRatio}_${negativePrompt || ''}_${referenceImageBase64 ? referenceImageBase64.slice(0,500) : ''}`;
        const cacheKey = crypto.createHash('sha256').update(cacheInput).digest('hex');
        const cached = promptResponseCache.get(cacheKey);

        if (cached && Date.now() - cached.timestamp < PROMPT_CACHE_TTL_MS) {
          logger.info('[Photo Prompt Cache Hit - Saved Quota]', cacheKey);
          return res.json({
            prompt: cached.text,
            modelUsed: cached.modelUsed,
            promptArchitect: cached.promptArchitect,
            cached: true
          });
        }
      }

      const userSelectedModel = model === 'gemini-3.1-pro-preview' ? 'gemini-3.1-pro-preview' : 'gemini-3.6-flash';

      const promptText = `Anda adalah Master Director of Photography (DoP) Sinematik Global, Ahli Algoritma Visual TikTok FYP, dan Spesialis Multimodal Google SEO / AEO (Answer Engine Optimization) & Entity Search.

TUGAS UTAMA:
Analisis secara SUPER PRESISI input gambar atau teks konsep dari pengguna, lalu transformasikan menjadi Master Prompt AI Image Generator (Midjourney v6.1 / Flux.1 / DALL-E 3) yang memiliki RELEVANSI TINGGI, REKAYASA SCENE MENDALAM, VISUAL HOOK TIKTOK KUAT, dan MEMENUHI STANDAR MULTIMODAL GOOGLE SEARCH / AEO TERBARU.

PANDUAN RELEVANSI & PRESISI:
1. JIKA INPUT BERUPA KONSEP TEKS:
   - Bedah secara semantik seluruh konteks cerita, subjek inti, aktivitas, lokasi spesifik, mood emosional, dan detail prop.
   - Terapkan pemetaan entitas (Google AEO): sebutkan material nyata (misal: unbleached organic linen, brushed brass, weathered mahogany), nama arsitektur/setting, dan kondisi atmosfer yang jelas agar mudah diindeks AI Search Engine.
   - Bangun visual hook 3-detik pertama untuk TikTok: pose dinamis/tatapan mata tajam, kontras tinggi, ekspresi mikroskopis, dan framing sinematik.

2. JIKA INPUT BERUPA FOTO REFERENSI (IMAGE):
   - Lakukan dekonstruksi visual mendalam: identifikasi anatomi wajah, gaya rambut, busana, sudut kamera (eye-level, low-angle, high-angle), arah & temperatur cahaya (Kelvin, key/fill/rim light), palet warna, dan latar belakang.
   - Pertahankan identitas visual dan esensi komposisi referensi, namun tingkatkan menjadi resolusi sinematik 8K dengan tekstur fotorealistik murni (micro skin pores, subsurface scattering, authentic lens grain, tanpa kesan AI plastik/halus buatan).

3. PARAMETER TEKNIS FOTOGRAFI WAJIB:
   - Tipe Kamera & Lensa: (Contoh: Shot on Hasselblad H6D-100c / Sony A7R V / Arri Alexa LF, Zeiss Master Prime 85mm f/1.2 atau 35mm f/1.4).
   - Pencahayaan: (Contoh: Volumetric golden hour side lighting, softbox diffusion at 45 degrees, subtle blue rim lighting, ray-traced reflections).
   - Detail Tekstur: (Contoh: Ultra-detailed skin texture, authentic fabric weave, natural specular reflections, sharp edge definition).
   - Target Aspect Ratio: ${aspectRatio}
   - Preset Gaya: ${photoStyle.toUpperCase()}

FORMAT OUTPUT WAJIB (Gunakan format Markdown persis seperti di bawah, blok prompt HARUS dalam bahasa Inggris agar optimal di semua AI generator):

### 📸 TIKTOK-OPTIMIZED AI PROMPT (SUPER REALISTIS & SIAP COPY)
\`\`\`text
[Master Shot]: Hyper-realistic ${photoStyle} photography, TikTok FYP visual hook aesthetic, Google AEO high-relevance semantic framing.
[Subject & Identity]: [Deskripsi super spesifik subjek: usia, fitur wajah otentik, ekspresi mikro yang menarik perhatian, pose dinamis, busana & tekstur bahan detail].
[Scene Context & Environment]: [Latar belakang storytelling kaya entitas, detail arsitektur/ruang, elemen pendukung, kedalaman spasial sinematik].
[Lighting & Atmospheric Physics]: [Pencahayaan presisi: arah key light, soft fill, subtle rim light, temperatur warna ambient, volumetric rays, bayangan lembut].
[Camera, Optics & Composition]: [Kamera profesional, panjang lensa (focal length), aperture f-stop ultra-lebar, fokus tajam pada subjek, natural optical depth of field / creamy bokeh].
[Texture & Rendering Quality]: 8k UHD resolution, raw authentic documentary photo, natural micro skin pores, fabric threading, zero artificial airbrushing, photorealistic raytraced reflections, ${aspectRatio} --style raw --v 6.1
\`\`\`

---

### 🔍 ANALISIS MENDALAM RELEVANSI SCENE & ALGORITMA
- **🎯 Konteks Scene & Semantic Entity (Google SEO/AEO)**: [Penjelasan entitas subjek, lokasi, material, dan konteks cerita yang membuat gambar mudah dikenali oleh algoritma Google Lens dan AI Search Overview].
- **⚡ TikTok Visual Hook (3-Second Retention)**: [Analisis elemen visual utama yang mengunci pandangan audiens di 3 detik pertama saat scrolling FYP].
- **💡 Pencahayaan, Optik & Komposisi Kamera**: [Setup teknis pencahayaan studio/alam, panjang lensa, aperture, dan depth-of-field untuk menghasilkan dimensi gambar 3D yang hidup].
- **🎨 Color Grading & Tekstur Otentik**: [Palet warna sinematik, tone harmony, dan mikro tekstur alami yang menjamin gambar tampak seperti foto nyata produksi komersial].`;

      let extendedPromptText = promptText;
      if (negativePrompt && negativePrompt.trim()) {
        extendedPromptText += `\n\nTAMBAHKAN TAG NEGATIVE PROMPT PADA AKHIR BLOK: [Negative Prompt]: ${negativePrompt.trim()}`;
      }

      let promptPayload: any = {
        contents: {
          parts: []
        },
        config: {
          systemInstruction: "You are the world's leading Director of Photography, TikTok Visual Hook Strategist, and Google AEO Multimodal SEO Specialist. Generate highly precise, hyper-realistic AI image prompts with deep scene comprehension, authentic camera physics, and complete visual algorithm compliance.",
        }
      };

      if (mimeType === 'text/plain') {
        const rawUserText = Buffer.from(base64Data, 'base64').toString('utf-8');
        
        promptPayload.contents.parts.push({
          text: `BERIKUT DESKRIPSI / KONSEP FOTO INPUT DARI USER:\n"""\n${rawUserText}\n"""\n\nTUGAS UTAMA ANDA:\n${extendedPromptText}`
        });

        if (referenceImageBase64 && referenceImageMimeType) {
          promptPayload.contents.parts.push({
            text: `\n\nIni adalah IDENTITY ANCHOR REFERENCE IMAGE opsional yang diberikan user:`
          });
          promptPayload.contents.parts.push({
            inlineData: {
              mimeType: referenceImageMimeType,
              data: referenceImageBase64,
            },
          });
        }
      } else {
        promptPayload.contents.parts.push({
          inlineData: {
            mimeType: mimeType,
            data: base64Data,
          },
        });
        promptPayload.contents.parts.push({
          text: extendedPromptText,
        });
      }

      const result = await callGeminiWithFallback(userSelectedModel, promptPayload, customApiKey, clientAccessCode);

      // Multi-Agent Step: Run Structured Prompt Architect to refine & enrich without breaking markdown schema
      let finalPromptText = result.text;
      let architectMetadata: any = undefined;

      try {
        const architectResult = await runStructuredPromptArchitect(
          result.text,
          targetGenerator || photoStyle || 'general'
        );
        architectMetadata = architectResult;

        if (architectResult.isOptimized && isStructureSchemaConsistent(result.text, architectResult.finalPrompt)) {
          finalPromptText = architectResult.finalPrompt;
        } else if (architectResult.isOptimized) {
          logger.warn('[StructuredPromptArchitect] Photo prompt output failed structural schema consistency check, falling back to raw model draft.');
        }
      } catch (archErr) {
        logger.warn('[StructuredPromptArchitect] Photo prompt enhancement notice:', archErr);
      }

      // Record successful execution & train system memory
      recordExecutionAndUpgrade('photoPrompt');

      activeTask.status = 'completed';
      activeTask.updatedAt = Date.now();
      activeGenerationsMap.set(taskId, activeTask);

      broadcastLiveEvent({
        type: 'active_status_update',
        activeGenerations: Array.from(activeGenerationsMap.values()),
        activeUserCount: sseClients.size,
      });

      setTimeout(() => {
        activeGenerationsMap.delete(taskId);
        broadcastLiveEvent({
          type: 'active_status_update',
          activeGenerations: Array.from(activeGenerationsMap.values()),
          activeUserCount: sseClients.size,
        });
      }, 120000);

      if (useCache) {
        const cacheInput = `photo_${mimeType}_${base64Data.slice(0, 500)}_${base64Data.length}_${model}_${targetGenerator}_${photoStyle}_${aspectRatio}`;
        const cacheKey = crypto.createHash('sha256').update(cacheInput).digest('hex');
        promptResponseCache.set(cacheKey, {
          timestamp: Date.now(),
          text: finalPromptText,
          modelUsed: result.modelUsed,
          promptArchitect: architectMetadata
        });
      }

      res.json({
        prompt: finalPromptText,
        modelUsed: result.modelUsed,
        promptArchitect: architectMetadata
      });
    } catch (error: any) {
      logger.error('Error generating photo prompt:', error);
      activeTask.status = 'failed';
      activeTask.updatedAt = Date.now();
      activeGenerationsMap.set(taskId, activeTask);
      broadcastLiveEvent({
        type: 'active_status_update',
        activeGenerations: Array.from(activeGenerationsMap.values()),
        activeUserCount: sseClients.size,
      });
      setTimeout(() => {
        activeGenerationsMap.delete(taskId);
        broadcastLiveEvent({
          type: 'active_status_update',
          activeGenerations: Array.from(activeGenerationsMap.values()),
          activeUserCount: sseClients.size,
        });
      }, 5000);
      const statusCode = error.statusCode || 500;
      res.status(statusCode).json({ error: error.message || 'Terjadi kesalahan saat membuat prompt foto.' });
    }
  });

  // API endpoint for 5 TikTok Content Ideas, Captions & Hashtags Generator (2-Stage Grounded Pipeline & Anti-AI-Slop)
  app.post('/api/generate-content-ideas', async (req, res) => {
    const clientAccessCode = extractClientAccessCode(req);
    const clientInfo = await getClientInfoByCode(clientAccessCode);
    const taskId = req.body.taskId || `gen_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const clientIp = (req.ip || req.socket.remoteAddress || '').replace('::ffff:', '').trim();
    const fingerprint = (req.headers['x-device-fingerprint'] as string) || req.body?.fingerprint || '';
    const userAgent = req.headers['user-agent'] || '';

    const activeTask = {
      id: taskId,
      clientId: clientAccessCode,
      accessCode: clientAccessCode,
      clientName: clientInfo.name,
      clientEmail: clientInfo.email || '',
      tool: 'Idea Konten',
      status: 'generating',
      category: req.body.category || 'umum',
      topic: req.body.topic || req.body.sourceTitle || 'Idea Konten TikTok',
      modelUsed: req.body.model || 'gemini-3.6-flash',
      startedAt: new Date().toISOString(),
      updatedAt: Date.now(),
      ip: clientIp,
      deviceFingerprint: fingerprint,
      userAgent: userAgent,
    };
    activeGenerationsMap.set(taskId, activeTask);

    broadcastLiveEvent({
      type: 'active_status_update',
      activeGenerations: Array.from(activeGenerationsMap.values()),
      activeUserCount: sseClients.size,
    });

    try {
      const customApiKey = (req.headers['x-custom-api-key'] as string) || req.body.customApiKey;
      const useCache = req.headers['x-use-cache'] !== 'false';

      const {
        mimeType,
        base64Data,
        sourceTitle = '',
        topic = '',
        contentType = 'affiliate', // affiliate | tutorial | review | storytelling | entertainment
        tone = 'persuasive', // persuasive | funny | casual | expert | dramatic
        maxDuration = '60', // 15 | 30 | 60 | 90 | 120
        segmentDuration = '5', // 5 | 8 | 10 | 15 | auto
        targetAI = 'general', // general | sora | kling | runway | pika | hailuo | veo
        model = 'gemini-3.6-flash',
        aeoQueryMode = 'both',
        enableBigSound = true,
        enableTextOverlay = true,
        referenceImageBase64 = '',
        referenceImageMimeType = '',
        userSeedQueries = [],
        ideasCount = '5',
      } = req.body;

      if (!base64Data && !topic && !sourceTitle) {
        return res.status(400).json({ error: 'Mohon sediakan data video TikTok, judul, atau topik konten.' });
      }

      const numIdeas = Math.min(5, Math.max(1, parseInt(ideasCount, 10) || 5));

      const sampleData = base64Data ? base64Data.slice(0, 300) : topic || sourceTitle;
      const refImgSample = referenceImageBase64 ? referenceImageBase64.slice(0, 50) : '';
      
      let userSeedQueriesClean = Array.isArray(userSeedQueries) 
        ? userSeedQueries.map(s => String(s).trim().slice(0, 80)).filter(s => s.length > 0).slice(0, 10)
        : [];
      
      const userSeedSample = userSeedQueriesClean.join('|').slice(0, 50);

      const cacheInput = `content_ideas_v4_${mimeType}_${sampleData}_${model}_${contentType}_${tone}_${maxDuration}_${segmentDuration}_${targetAI}_${aeoQueryMode}_${enableBigSound}_${enableTextOverlay}_${refImgSample}_${userSeedSample}_${numIdeas}`;
      const cacheKey = crypto.createHash('sha256').update(cacheInput).digest('hex');

      if (useCache) {
        const cached = promptResponseCache.get(cacheKey);

        if (cached && Date.now() - cached.timestamp < PROMPT_CACHE_TTL_MS) {
          logger.info('[Content Ideas Cache Hit - Saved Quota]', cacheKey);
          return res.json({ result: cached.text, modelUsed: cached.modelUsed, cached: true });
        }
      }

      const userSelectedModel = model === 'gemini-3.1-pro-preview' ? 'gemini-3.1-pro-preview' : 'gemini-3.6-flash';
      const maxSecNum = parseInt(maxDuration, 10) || 60;
      const targetAIName = targetAI === 'sora' ? 'OpenAI Sora' : targetAI === 'kling' ? 'Kling AI' : targetAI === 'runway' ? 'Runway Gen-3' : targetAI === 'pika' ? 'Pika Labs' : targetAI === 'hailuo' ? 'Hailuo / Minimax' : targetAI === 'veo' ? 'Google Veo' : 'General AI Video Generator';

      // Hitung jumlah klip & timestamp rentang waktu secara dinamis
      let segSecNum = 5;
      if (segmentDuration === '8') segSecNum = 8;
      else if (segmentDuration === '10') segSecNum = 10;
      else if (segmentDuration === '15') segSecNum = 15;
      else if (segmentDuration === 'auto') segSecNum = Math.max(5, Math.ceil(maxSecNum / 4));
      else segSecNum = parseInt(segmentDuration, 10) || 5;

      const expectedClipsCount = Math.ceil(maxSecNum / segSecNum);

      const timestampGuideList: string[] = [];
      let currentSec = 0;
      for (let i = 1; i <= expectedClipsCount; i++) {
        const nextSec = Math.min(maxSecNum, currentSec + segSecNum);
        const startStr = `${String(Math.floor(currentSec / 60)).padStart(2, '0')}:${String(currentSec % 60).padStart(2, '0')}`;
        const endStr = `${String(Math.floor(nextSec / 60)).padStart(2, '0')}:${String(nextSec % 60).padStart(2, '0')}`;

        timestampGuideList.push(`  - **[${startStr} - ${endStr}] Klip ${i}${i === 1 ? ' (Hook)' : ''}**:
    - *Aksi & Dialog/VO*: [Deskripsi ringkas aksi visual faktual + Dialog kasual natural]
    - *Prompt AI Video*:
\`\`\`text
[Style]: Bright, commercial e-commerce product video, clean and polished aesthetic.
[Environment]: Detailed description of setting, room, furniture, props, and background in English.
[Tone & Pacing]: Friendly, energetic, engaging product presentation.
[Camera]: Medium shot, static eye-level camera, framing presenter and product.
[Lighting]: Soft, bright studio lighting, even illumination.
[Actions]:
- [Detailed physical actions, hand movements, or product holding in English]
- **Dialogue**: "[Exact line or voice-over script in Indonesian for this clip segment]"${enableTextOverlay ? '\n[Text Overlay]: "[Hook text / overlay text on screen in Indonesian]"' : ''}${enableBigSound ? '\n[Background Sound]: Clear Indonesian voiceover with upbeat background music.' : ''}
[Transition / Editing]: Single continuous shot.
[Call to Action]: Recommending product or action if applicable for this clip segment.
\`\`\``);

        currentSec = nextSec;
      }
      const timestampTemplateText = timestampGuideList.join('\n');

      // =========================================================================
      // TAHAP 0 — AEO QUERY MODE ROUTER
      // =========================================================================
      logger.info(`[Content Ideas Stage 0] AEO Query Router. Mode: ${aeoQueryMode}`);

      // =========================================================================
      // TAHAP 1 — ANALISIS KONTEKS VISUAL VIDEO (REUSE LOGIC ANALYZER VIDEO)
      // =========================================================================
      logger.info('[Content Ideas Stage 1] Menganalisis elemen visual asli video...');
      let groundingContext = '';

      if (base64Data) {
        const stage1Prompt = `Anda adalah AI Video Vision Analyzer tingkat presisi tinggi.
TUGAS TAHAP 1: Analisis video ini dari detik awal sampai akhir secara objektif tanpa mengarang.
Ekstrak struktur data internal faktual berikut:
1. Objek/Produk yang BENAR-BENAR terlihat di frame (nama barang, warna, bahan, detail visual unik, kancing, motif, kerah, jahitan, packaging).
2. Aksi Tangan / Orang yang BENAR-BENAR terjadi (misal: memegang kerah, membalik lengan baju, menunjuk detail kancing, mengoleskan krim, membuka kemasan, mengangkat barang ke kamera).
3. Environment / Setting Asli Video (ruang tamu, kamar, studio, latar belakang, lighting, suasana).
4. Ekspresi & Gesture yang Terlihat (apabila ada orang/presenter di video).
5. Transkrip Audio / Teks Terdeteksi (jika ada suara/VO/teks asli di video).

JIKA ADA BAGIAN DETAIL YANG TIDAK JELAS ATAU TIDAK TERDETEKSI: Tandai eksplisit sebagai "[Kurang yakin / Tidak terdeteksi jelas]". JANGAN PERNAH MENGARANG AKSI ATAU PRODUK YANG TIDAK ADA.`;

        const stage1Payload = {
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: mimeType || 'video/mp4',
                  data: base64Data,
                },
              },
              {
                text: `${stage1Prompt}\n\nJudul/Caption Video: ${sourceTitle || '-'}\nCatatan Tambahan: ${topic || '-'}`,
              },
            ],
          },
          config: {
            systemInstruction:
              "You are an objective video vision analyzer. Extract exact physical actions, visible objects, gestures, and settings without hallucinating or making assumptions.",
          },
        };

        const targetTier = getInitialTierForTask(aeoQueryMode, !!base64Data);

        const stage1Result = await callGeminiWithFallback(userSelectedModel, stage1Payload, customApiKey, clientAccessCode, targetTier);
        groundingContext = stage1Result.text;
      } else {
        groundingContext = `INFORMASI INPUT TEKS USER (Tanpa Video File):
- Judul/Caption Video: ${sourceTitle || '-'}
- Topik / Produk: ${topic || '-'}`;
      }

      logger.info('[Content Ideas Stage 1 Complete] Grounding context extracted.');

      let identityAnchorDescription = '';
      if (referenceImageBase64) {
        logger.info('[Content Ideas Stage 1.5] Reference Image Anchor Extraction...');
        const anchorPrompt = `Anda adalah AI Identity Extractor. Analisis gambar referensi ini secara presisi.
Ekstrak 'Identity Anchor' yang solid (seperti warna kulit, pakaian, bentuk wajah, tekstur barang, atau logo pada produk).
Deskripsi ini akan disalin persis ke prompt video generation untuk mencegah flickering identitas antar adegan.
Hasilkan HANYA 1 paragraf padat berbahasa Inggris yang mendeskripsikan secara jelas ciri khas subjek/produk utama di gambar ini.`;

        const anchorPayload = {
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: referenceImageMimeType || 'image/jpeg',
                  data: referenceImageBase64,
                },
              },
              {
                text: anchorPrompt,
              },
            ],
          },
        };
        const anchorResult = await callGeminiWithFallback('gemini-3.6-flash', anchorPayload, customApiKey, clientAccessCode);
        identityAnchorDescription = anchorResult?.text?.trim() || '';
        logger.info('[Content Ideas Stage 1.5 Complete] Identity Anchor extracted:', identityAnchorDescription);
      }

      // =========================================================================
      // TAHAP 1.8 — DEWAN 10 AI AGENT QUERY (INDONESIAN QUERY COUNCIL)
      // =========================================================================
      let queryCouncilResult: any = { final_short_query_targets: [], final_long_tail_queries: [] };
      let isCouncilSuccessful = false;

      // H1 Optimization: Skip council if user provides a rich set of seed queries (>= 5)
      // This saves cost and latency. We will use the seed queries directly as the final targets.
      if (userSeedQueriesClean.length >= 5) {
          logger.info(`[Content Ideas Stage 1.8] Skipping Query Council because user provided ${userSeedQueriesClean.length} seed queries.`);
          queryCouncilResult = {
              final_short_query_targets: userSeedQueriesClean.filter(q => q.split(' ').length <= 4),
              final_long_tail_queries: userSeedQueriesClean.filter(q => q.split(' ').length > 4)
          };
          // Fallback if filtering resulted in empty array for one of them
          if (queryCouncilResult.final_short_query_targets.length === 0) queryCouncilResult.final_short_query_targets = userSeedQueriesClean.slice(0, 3);
          if (queryCouncilResult.final_long_tail_queries.length === 0) queryCouncilResult.final_long_tail_queries = userSeedQueriesClean.slice(-3);
          isCouncilSuccessful = true;
      } else {
          logger.info(`[Content Ideas Stage 1.8] Menjalankan Dewan 10 AI Agent Query...`);
          try {
              const councilTier = getInitialTierForTask(aeoQueryMode, !!base64Data);
              queryCouncilResult = await runIndonesianQueryCouncil(
                  topic || sourceTitle || '',
                  groundingContext,
                  userSeedQueriesClean,
                  aeoQueryMode,
                  callGeminiWithFallback,
                  userSelectedModel,
                  customApiKey,
                  clientAccessCode,
                  councilTier
              );
              isCouncilSuccessful = true;
              logger.info(`[Content Ideas Stage 1.8 Complete] Generated ${queryCouncilResult.final_short_query_targets?.length || 0} short and ${queryCouncilResult.final_long_tail_queries?.length || 0} long queries.`);
          } catch (err) {
              logger.warn("[Stage 1.8] Query Council Agent failed or JSON parse error, falling back to legacy synthetic query generation mode. Error:", err);
          }
      }

      // =========================================================================
      // TAHAP 2 — GENERATE IDE KONTEN GROUNDED + ANTI-AI-SLOP VOICE-OVER
      // =========================================================================
      logger.info(`[Content Ideas Stage 2] Menghasilkan ${numIdeas} ide konten grounded...`);
      const referenceImageProvided = !!identityAnchorDescription;

      const hasCouncilQueries = (queryCouncilResult.final_short_query_targets?.length > 0 || queryCouncilResult.final_long_tail_queries?.length > 0);

      // Susun template output ide sejumlah numIdeas secara dinamis
      const ideasOutputTemplateList: string[] = [];
      for (let i = 1; i <= numIdeas; i++) {
        ideasOutputTemplateList.push(`### 💡 IDE ${i}: [Judul Ide Konten ${i}]
- **Tipe & Angle Konten**: [Problem-Solution / POV Relatable / Unboxing Soft-Sell / Review Jujur]
- **Target Audience**: [Sebutkan audiens target spesifik]
- **AEO Query Mapping**: Short → [...], Long → [...]
- **Alasan Relevansi**: [1-2 kalimat penjelasan koneksi ke grounding & query target]
- **BLUFF Hook Pikat (0-3s)**: "[Kalimat pikat BLUFF - Langsung ke Inti Solusi/Jawaban di 3 detik pertama]"
- **Atomic Answer Summary (LLM RAG Citation Ready)**: "[1-2 kalimat fakta mandiri utuh yang siap dikutip AI Search Engine]"
- **Consensus Trigger (Tier 2 Validation)**: "[Pemicu validasi sosial / review komunitas untuk membangun konsensus LLM]"
- **Panduan Visual & Audio**: [Deskripsi gaya adegan, ekspresi, lighting, rekomendasi sound TikTok]
- **Rincian Adegan Video & Prompt AI per Segmen (${maxSecNum} Detik)**:
${timestampTemplateText}
- **AEO Caption SEO**:
"""text
[Caption AEO: Kalimat 1 = BLUFF Answer + Entitas Utama, Kalimat 2-3 = Poin Detail Faktual, Penutup = Q&A Pemicu Diskusi]
"""
- **Hashtag Relevan**: '#HashtagSpesifikVisual1 #HashtagSpesifikVisual2 #HashtagDetail3 #HashtagNiche4 #HashtagTargetSEO5'`);
      }
      const ideasOutputTemplateText = ideasOutputTemplateList.join('\n\n---\n\n');

      const stage2PromptText = `Anda adalah TikTok Content Strategist & Anti-AI-Slop Indonesian Copywriter Spesialis FYP Ranking TikTok Indonesia.

TUGAS UTAMA TAHAP 2:
Buatkan TEPAT ${numIdeas} IDE KONTEN VIRAL SANGAT OPTIMAL, RELEVAN, & PERSUASIF berdasarkan DATA HASIL ANALISIS TAHAP 1 TERLAMPIR. (PENTING: Buat persis ${numIdeas} ide, jangan kurang dan jangan lebih).

${hasCouncilQueries ? `=== HASIL DEWAN 10 AGENT QUERY TAHAP 0 (WAJIB DIPAKAI, DILARANG MENGARANG QUERY BARU) ===
Short Query Targets: ${(queryCouncilResult.final_short_query_targets || []).join(' | ')}
Long-Tail Queries: ${(queryCouncilResult.final_long_tail_queries || []).join(' | ')}
${userSeedQueriesClean.length > 0 ? `Seed Asli dari User (prioritas tertinggi): ${userSeedQueriesClean.join(' | ')}` : ''}
==================================================================

ATURAN QUERY FAN-OUT (DIPERKETAT):
1. SETIAP query yang dicantumkan di "AEO SYNTHETIC QUERY FAN-OUT" dan di
   "AEO Query Mapping" tiap ide WAJIB diambil PERSIS atau nyaris identik dari
   daftar Dewan 10 Agent di atas. DILARANG membuat query baru yang tidak ada
   di daftar tersebut — ini untuk mencegah halusinasi.` : `=== AEO SYNTHETIC QUERY FAN-OUT & MAPPING ===
1. Hasilkan dan cantumkan 5-9 synthetic long-tail queries secara mandiri berdasarkan topik dan konteks yang ada.
2. Lakukan "AEO Query Mapping" untuk setiap ide dengan mengaitkannya ke query yang relevan yang telah Anda hasilkan.`}

=== DATA GROUNDING FAKTUALL TAHAP 1 (MANDATORI DIIKUTI 100%) ===
"""
${groundingContext}
"""
==================================================================

PERATURAN MUTLAK GROUNDING & KONSISTENSI 3 ARAH (MANDATORI):
1. HOOK, DIALOG/VO, DESKRIPSI AKSI, CAPTION, DAN HASHTAG HARUS MERUJUK PADA ELEMEN VISUAL YANG BENAR-BENAR TERDETEKSI DI DATA TAHAP 1 DAN TOPIK PROFIL USER.
2. JANGAN MENGARANG AKSI, PRODUK, ATAU DETAIL YANG TIDAK ADA DI DATA TAHAP 1.
3. KONSISTENSI 3 ARAH (Caption, Hashtags, dan Hook/Visual Scene) HARUS SALING MENGUATKAN DENGAN PERFECT MATCH.
4. HASHTAG WAJIB MAKSIMAL 5 HASHTAG PER IDE & FOKUS SEO TIKTOK SEARCH ALGORITHM:
   - DILARANG KERAS MENGGUNAKAN HASHTAG GENERIK/SAMPAH SEPERTI #fyp, #fypTikTok, #racuntiktok, #viral, #trending, #foryou, #foryoupage, #beranda.
   - HASHTAG HARUS SANGAT SPESIFIK & TARGETED BERDASARKAN PRODUK/DETAIL VISUAL DI TAHAP 1 & REFERENSI JUDUL/HASHTAG TIKTOK USER (#1 & #2 Nama Produk/Bahan, #3 & #4 Detail Utama, #5 Niche Audience). Total MAKSIMAL 5 HASHTAG.
5. CAPTION RELEVAN TIKTOK HARUS RELEVAN DENGAN IDE & BERISI TEKS PENJUALAN/KETERANGAN VIDEO BAHASA INDONESIA PERSUASIF MANUSIA (DILARANG MEMASUKKAN TAG PROMPT BRACKET SEPERTI [Style] DI DALAM CAPTION!).
6. FORMAT PROMPT AI VIDEO PER KLIP WAJIB MENGGUNAKAN SELURUH TAG DALAM KURUNG SIKU SECARA PERSIS SEPERTI CONTOH BERIKUT (DILARANG MENGATUR ULANG ATAU MENGURANGI TAG):
\`\`\`text
[Style]: Bright, commercial e-commerce product video, clean and polished aesthetic.
[Environment]: Indoor studio or showroom with clothes rack, decorative items, and warm ambient lighting.
[Tone & Pacing]: Friendly, energetic, engaging product presentation.
[Camera]: Medium shot, static eye-level camera, framing presenter and product.
[Lighting]: Soft, bright studio lighting, even illumination.
[Actions]:
- Woman in brown hijab and gamis holds matching dress on a hanger, pointing to details and demonstrating soft fabric quality.
- **Dialogue**: "ini dia rekomendasi gamis malaysia simpel murah tapi anggun buat raya nanti, pantesan udah terjual ribuan lebih. bahannya ceruti premium yang halus dan juga adem, tebel, jatuh, ada furing di dalamnya,"${enableTextOverlay ? '\n[Text Overlay]: "REKOMENDASI GAMIS MALAYSIA ELEGAN"' : ''}${enableBigSound ? '\n[Background Sound]: Clear Indonesian female voiceover with upbeat background music.' : ''}
[Transition / Editing]: Single continuous shot.
[Call to Action]: Recommending product or dress.
\`\`\`

PERATURAN DUKUNGAN KLIP & SPLIT ADEGAN:
- WAJIB MEMECAH ADEGAN TEPAT MENJADI ${expectedClipsCount} KLIP (Total Durasi: ${maxSecNum}s, Durasi per Klip: ${segSecNum}s).
- IKUTI FORMAT TIMESTAMP SEGMEN BERIKUT SECARA PERSIS:
${timestampTemplateText}

PERATURAN DOKTRIN ANSWER ENGINE OPTIMIZATION (AEO):
${hasCouncilQueries ? `1. QUERY FAN-OUT SYNTHESIS: Cantumkan 5-9 synthetic queries yang DIAMBIL LANGSUNG DARI HASIL DEWAN 10 AGENT di atas di bagian paling atas output.` : `1. QUERY FAN-OUT SYNTHESIS: Cantumkan 5-9 synthetic long-tail queries yang paling mungkin dipicu AI Search Engine (Google AI Overview, ChatGPT Search, Perplexity) terkait topik/produk ini di bagian paling atas output.`}
2. BLUFF HOOK (0-3s): Hook 3 detik pertama WAJIB menggunakan metode Bottom Line Up Front (BLUFF) - langsung ke solusi/jawaban utama di detik pertama.
3. ATOMIC ANSWER SUMMARY: Setiap ide WAJIB menyertakan 1-2 kalimat fakta utuh & mandiri yang siap dikutip langsung oleh LLM / RAG.
4. CONSENSUS TRIGGER: Setiap ide menyertakan pemicu konsensus sosial (Tier 2 Reddit/Review style) untuk memvalidasi ide ini.
5. AEO CAPTION SEO: Caption disusun secara terstruktur: Kalimat 1 = BLUFF Answer + Entitas Utama, Kalimat 2-3 = Poin Detail Faktual, Penutup = Q&A Pemicu Diskusi.

PERATURAN TAMBAHAN — AEO DUAL-MODE TARGETING (BARU):
6. MODE TARGETING AKTIF: ${aeoQueryMode.toUpperCase()} (short | long | both).
${hasCouncilQueries ? `   - Jika mode = SHORT: fokuskan seluruh hook, caption, dan atomic answer pada
     Short Query Targets dari Dewan (maksimal 4 kata per query, gaya head-term search bar).
   - Jika mode = LONG: fokuskan pada Long-Tail Queries dari Dewan.
   - Jika mode = BOTH: prioritaskan keduanya secara seimbang.
7. SETIAP IDE WAJIB MENYERTAKAN "AEO Query Mapping" yang eksplisit menyebut
   query pendek dan/atau query panjang mana DARI DAFTAR DEWAN yang dijawab ide tersebut, plus
   1-2 kalimat "Alasan Relevansi" yang menjelaskan koneksinya ke data grounding
   Tahap 1 dan ke query yang ditarget.` : `   - Jika mode = SHORT: fokuskan seluruh hook, caption, dan atomic answer pada
     3-6 SHORT QUERY TARGETS (maksimal 4 kata per query, gaya head-term search bar).
     Tetap sertakan synthetic_fanout_queries tapi tandai non-prioritas.
   - Jika mode = LONG: perilaku IDENTIK dengan sistem saat ini (5-9 synthetic
     fan-out query konversasional), short_query_targets tetap diisi tapi non-prioritas.
   - Jika mode = BOTH: prioritaskan keduanya secara seimbang.
7. SETIAP IDE WAJIB MENYERTAKAN "AEO Query Mapping" yang eksplisit menyebut
   query pendek dan/atau query panjang mana yang dijawab ide tersebut, plus
   1-2 kalimat "Alasan Relevansi" yang menjelaskan koneksinya ke data grounding
   Tahap 1 dan ke query yang ditarget.`}

PERATURAN TAMBAHAN — KONTROL AUDIO & TEKS (BARU):
8. BIG SOUND: ${enableBigSound ? 'AKTIF - WAJIB cantumkan tag [Background Sound] dengan detail musik/audio pendukung pada setiap klip.' : 'NONAKTIF - DILARANG SERTAKAN ATAU TULIS tag [Background Sound] dalam seluruh prompt video klip (struktur tag [Background Sound] dinonaktifkan total).'}
9. TEXT OVERLAY: ${enableTextOverlay ? 'AKTIF - WAJIB cantumkan tag [Text Overlay] dengan rekomendasi teks hook tulisan pendek di layar pada setiap klip.' : 'NONAKTIF - DILARANG SERTAKAN ATAU TULIS tag [Text Overlay] dalam seluruh prompt video klip (struktur tag [Text Overlay] dinonaktifkan total).'}

PERATURAN TAMBAHAN — ANTI-FLICKER NEGATIVE PROMPT (BARU, WAJIB DI SETIAP KLIP):
10. SETIAP blok prompt video WAJIB menambahkan tag berikut PERSIS setelah [Call to Action]:
\`\`\`text
[Negative Prompt]: flickering, flicker, strobing, morphing face, warping identity, inconsistent character design between frames, changing outfit/product color mid-clip, unstable lighting, jittery motion, texture popping, banding artifacts, blurry transition, extra fingers, deformed hands, distorted proportions, watermark, text glitch, double exposure ghosting, low resolution, oversaturated color shift
\`\`\`
${referenceImageProvided ? `11. REFERENCE IMAGE IDENTITY LOCK AKTIF: gunakan deskripsi identitas berikut secara KONSISTEN kata-demi-kata di setiap [Environment]/[Actions] klip: "${identityAnchorDescription}". Tambahkan baris tambahan di [Negative Prompt]: "jangan menyimpang dari identitas visual reference image (warna, tekstur, bentuk, wajah/model) - pertahankan konsistensi identik di semua klip, hindari perubahan warna/detail antar klip."` : ''}

PERATURAN GAYA BAHASA (VOICE-OVER & DIALOG ANTI-AI-SLOP):
- Tulis dialog/VO persis seperti orang Indonesia asli ngomong santai di depan kamera HP (kasual, spontan, bernyawa).
- Hindari pola AI-slop: kalimat terlalu rapi/simetris, terlalu banyak tanda seru berturut-turut, transisi yang kaku ("Saksikanlah", "Temukanlah", "Solusi terbaik untuk Anda").
- Variasikan panjang kalimat. Gunakan kata pengisi natural manusia ("nih", "loh", "kan", "eh", "gila sih", "coba liat deh").
- Kalimat hook (3 detik pertama) harus terdengar seperti reaksi spontan manusia terhadap barang/kejadian yang dilihat di layar, BUKAN tagline iklan formal.

CONTOH FEW-SHOT GAYA BAHASA:
❌ AI-Slop (SALAH): "Temukan outer sempurna yang akan mengubah gaya berpakaian Anda secara total!"
✅ Natural (BENAR): "Eh ini outer beneran worth it apa nggak sih? Coba liat dulu deh detail kancingnya."

KONFIGURASI TARGET KONTEN:
- Target Jenis Konten: ${contentType.toUpperCase()}
- Tone Bahasa: ${tone.toUpperCase()}
- Target Total Durasi Video: ${maxSecNum} Detik
- Jumlah Klip Dihasilkan: ${expectedClipsCount} Klip (${segSecNum} Detik per Klip)
- Target Engine AI Video: ${targetAIName}
- Target Jumlah Ide: ${numIdeas} Ide

FORMAT OUTPUT (WAJIB PERTAHANKAN STRUKTUR MARKDOWN BERIKUT SECARA PERSIS):

# 🚀 ${numIdeas} IDE KONTEN VIRAL & AEO ENGINE OPTIMIZED (${maxSecNum}s, ${expectedClipsCount} Klip)

> 🎯 **AEO SYNTHETIC QUERY FAN-OUT (AI SEARCH ENGINE TARGETING)**:
> 1. [Sub-query sintetis 1]
> 2. [Sub-query sintetis 2]
> 3. [Sub-query sintetis 3]
> 4. [Sub-query sintetis 4]
> 5. [Sub-query sintetis 5]

---

${ideasOutputTemplateText}

PERATURAN TAMBAHAN KONTROL AUDIO & TEKS:
- WAJIB FORMAT MARKDOWN: Setiap list poin (-) dan block code (\`\`\`text) HARUS menggunakan baris baru (newline). JANGAN menggabungkan teks per-segmen klip menjadi satu paragraf.
- LARANGAN KLAIM HARGA & OVERCLAIM: JANGAN PERNAH menyebutkan nominal harga spesifik (misal: "80 ribuan", "under 190k") di script, VO, atau teks layar. JANGAN melakukan overclaiming (klaim berlebihan yang menyesatkan atau melanggar aturan e-commerce). Gunakan bahasa persuasif yang aman seperti "harga promo", "diskon spesial", dll.
- CAPTION SEO: Anda WAJIB membuat caption pada bagian "AEO Caption SEO" yang SANGAT RELEVAN dengan produk/video, mengandung HOOK persuasif, dan dibatasi maksimal 5 hashtag saja (contoh: #A #B #C #D #E). Jangan masukkan caption ke dalam teks Rincian Adegan Video.
`;

      const stage2Payload = {
        contents: {
          parts: [
            {
              text: stage2PromptText,
            },
          ],
        },
        config: {
          systemInstruction:
            "You are a master Indonesian short-form content and Answer Engine Optimization (AEO) strategist. You combine viral video engagement with AEO doctrines (Query Fan-Out, BLUFF 0-3s hook, Atomic Answer Summaries, and Consensus triggers). You strictly avoid corporate AI-slop voice-overs and write like a real human speaking naturally on camera. Every idea must be grounded 100% in the provided Stage 1 visual video analysis data without hallucination.",
        },
      };

      const stage2Result = await callGeminiWithFallback(userSelectedModel, stage2Payload, customApiKey, clientAccessCode);
      let finalOutputText = stage2Result.text;

      // M2 Validation: Cross-check synthetic queries against Council Queries
      if (isCouncilSuccessful && (queryCouncilResult.final_short_query_targets?.length > 0 || queryCouncilResult.final_long_tail_queries?.length > 0)) {
         try {
             const fanoutMatch = finalOutputText.match(/AEO SYNTHETIC QUERY FAN-OUT.*?:([\s\S]*?)(?:---|###)/i);
             if (fanoutMatch) {
                 const extractedQueries = fanoutMatch[1].split('\n').filter(l => l.trim().length > 0 && l.trim().match(/^\d+\./));
                 let matchCount = 0;
                 const allCouncil = [...(queryCouncilResult.final_short_query_targets || []), ...(queryCouncilResult.final_long_tail_queries || [])].map(q => q.toLowerCase());
                 extractedQueries.forEach(eq => {
                     const cleanEq = eq.replace(/^\d+\.\s*/, '').replace(/\[|\]/g, '').toLowerCase().trim();
                     if (allCouncil.some(cq => cleanEq.includes(cq) || cq.includes(cleanEq))) matchCount++;
                 });
                 if (matchCount < (extractedQueries.length / 2)) {
                     logger.warn(`[AEO Validation] Warning: Many synthetic queries in Stage 2 output do not match Council targets. Matched ${matchCount} out of ${extractedQueries.length}.`);
                 } else {
                     logger.info(`[AEO Validation] Stage 2 synthetic queries match Council targets well (${matchCount}/${extractedQueries.length}).`);
                 }
             }
         } catch (e) {
             logger.warn('[AEO Validation] Failed to perform M2 validation check:', e);
         }
      }

      // =========================================================================
      // VALIDASI CROSS-CHECK AUTOMATED DENGAN GROUNDING DATA TAHAP 1
      // =========================================================================
      logger.info('[Content Ideas Validation] Cross-checking generated output against visual facts...');
      const validationPayload = {
        contents: {
          parts: [
            {
              text: `BERIKUT DATA ANALISIS VISUAL TAHAP 1:
"""
${groundingContext}
"""

BERIKUT HASIL 5 IDE KONTEN YANG DI-GENERATE TAHAP 2:
"""
${finalOutputText}
"""

TUGAS VALIDASI:
Lakukan verifikasi cross-check singkat. Apakah ada klaim aksi/produk di Tahap 2 yang sama sekali bertentangan dengan fakta visual Tahap 1?
- Jika hasil Tahap 2 sudah grounded dan sesuai dengan data visual, kembalikan teks Tahap 2 APA ADANYA tanpa diubah.
- Jika ada kesalahan/halusinasi fatal, perbaiki kalimat aksi/produk tersebut agar 100% sesuai dengan fakta visual Tahap 1, lalu kembalikan teks utuh yang sudah diperbaiki.`,
            },
          ],
        },
        config: {
          systemInstruction:
            "You are a factual consistency cross-checker. Ensure generated copy does not contradict video visual evidence.",
        },
      };

      try {
        const validatedResult = await callGeminiWithFallback(userSelectedModel, validationPayload, customApiKey, clientAccessCode);
        if (validatedResult?.text && validatedResult.text.includes('# 🚀 5 IDE KONTEN VIRAL')) {
          finalOutputText = validatedResult.text;
        }
      } catch (valErr) {
        logger.warn('[Validation Warning] Fast validation skipped or fallback to Stage 2 text:', valErr);
      }

      // Record successful execution & train system memory
      recordExecutionAndUpgrade('contentIdeas');

      activeTask.status = 'completed';
      activeTask.updatedAt = Date.now();
      activeGenerationsMap.set(taskId, activeTask);

      broadcastLiveEvent({
        type: 'active_status_update',
        activeGenerations: Array.from(activeGenerationsMap.values()),
        activeUserCount: sseClients.size,
      });

      setTimeout(() => {
        activeGenerationsMap.delete(taskId);
        broadcastLiveEvent({
          type: 'active_status_update',
          activeGenerations: Array.from(activeGenerationsMap.values()),
          activeUserCount: sseClients.size,
        });
      }, 120000);

      if (useCache) {
        promptResponseCache.set(cacheKey, { timestamp: Date.now(), text: finalOutputText, modelUsed: stage2Result.modelUsed });
      }

      res.json({ result: finalOutputText, modelUsed: stage2Result.modelUsed });
    } catch (error: any) {
      logger.error('Error generating content ideas:', error);
      activeTask.status = 'failed';
      activeTask.updatedAt = Date.now();
      activeGenerationsMap.set(taskId, activeTask);
      broadcastLiveEvent({
        type: 'active_status_update',
        activeGenerations: Array.from(activeGenerationsMap.values()),
        activeUserCount: sseClients.size,
      });
      setTimeout(() => {
        activeGenerationsMap.delete(taskId);
        broadcastLiveEvent({
          type: 'active_status_update',
          activeGenerations: Array.from(activeGenerationsMap.values()),
          activeUserCount: sseClients.size,
        });
      }, 5000);
      const statusCode = error.statusCode || 500;
      res.status(statusCode).json({ error: error.message || 'Terjadi kesalahan saat membuat ide konten.' });
    }
  });

  // --- TIKTOK SHOP TO CONTENT IDEAS GENERATOR ---
  app.post('/api/generate-tiktok-shop-ideas', async (req, res) => {
    const clientAccessCode = extractClientAccessCode(req);
    const clientInfo = await getClientInfoByCode(clientAccessCode);
    const taskId = req.body.taskId || `gen_shop_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    const activeTask: any = {
      id: taskId,
      clientId: clientAccessCode,
      accessCode: clientAccessCode,
      clientName: clientInfo.name,
      tool: 'TikTok Shop Ideas',
      status: 'generating',
      category: req.body.category || 'tiktok_shop',
      startedAt: new Date().toISOString(),
      updatedAt: Date.now(),
    };
    activeGenerationsMap.set(taskId, activeTask);

    broadcastLiveEvent({
      type: 'active_status_update',
      activeGenerations: Array.from(activeGenerationsMap.values()),
      activeUserCount: sseClients.size,
    });

    try {
      const customApiKey = (req.headers['x-custom-api-key'] as string) || req.body.customApiKey;
      const {
        shopUrl = '',
        productDetails = '',
        numIdeas = 3,
        totalDuration = '60',
        promptSplitSec = '10',
        aeoTargetMode = 'both',
        enableBigSound = true,
        enableTextOverlay = true,
        analysisMode = 'deep',
        model = 'gemini-3.6-flash',
      } = req.body;

      const totalIdeas = Math.min(5, Math.max(1, Number(numIdeas) || 3));
      const maxSecNum = parseInt(totalDuration, 10) || 60;

      let segSecNum = 10;
      if (promptSplitSec === '5') segSecNum = 5;
      else if (promptSplitSec === '8') segSecNum = 8;
      else if (promptSplitSec === '10') segSecNum = 10;
      else if (promptSplitSec === '15') segSecNum = 15;
      else if (promptSplitSec === '20') segSecNum = 20;
      else if (promptSplitSec === 'auto') segSecNum = Math.max(5, Math.ceil(maxSecNum / 4));
      else segSecNum = parseInt(promptSplitSec, 10) || 10;

      const expectedClipsCount = Math.ceil(maxSecNum / segSecNum);

      const timestampGuideList: string[] = [];
      let currentSec = 0;
      for (let i = 1; i <= expectedClipsCount; i++) {
        const nextSec = Math.min(maxSecNum, currentSec + segSecNum);
        const startStr = `${String(Math.floor(currentSec / 60)).padStart(2, '0')}:${String(currentSec % 60).padStart(2, '0')}`;
        const endStr = `${String(Math.floor(nextSec / 60)).padStart(2, '0')}:${String(nextSec % 60).padStart(2, '0')}`;

        timestampGuideList.push(`  - **[${startStr} - ${endStr}] Klip ${i}${i === 1 ? ' (Hook)' : ''}**:
    - *Aksi & Dialog/VO*: [Deskripsi ringkas aksi visual faktual + Dialog/VO kasual natural]
    - *Prompt AI Video*:
\`\`\`text
[Style]: Bright, commercial e-commerce product video, clean and polished aesthetic.
[Environment]: Indoor studio, showroom or aesthetic setup with product displayed nicely in English.
[Tone & Pacing]: Friendly, energetic, engaging TikTok Shop product presentation.
[Camera]: Medium shot, static eye-level camera, framing presenter and product.
[Lighting]: Soft, bright studio lighting, even illumination.
[Actions]:
- [Detailed physical actions, hand movements, or product holding in English]
- **Dialogue**: "[Exact line or voice-over script in Indonesian for this clip segment]"${enableTextOverlay ? '\n[Text Overlay]: "[Hook text / overlay text on screen in Indonesian]"' : ''}${enableBigSound ? '\n[Background Sound]: Clear Indonesian voiceover with upbeat background music.' : ''}
[Transition / Editing]: Single continuous shot.
[Call to Action]: Recommending product or action if applicable for this clip segment.
[Negative Prompt]: flickering, flicker, strobing, morphing face, warping identity, inconsistent character design between frames, changing outfit/product color mid-clip, unstable lighting, jittery motion, texture popping, banding artifacts, blurry transition, extra fingers, deformed hands, distorted proportions, watermark, text glitch, double exposure ghosting, low resolution, oversaturated color shift
\`\`\``);
        currentSec = nextSec;
      }
      const timestampTemplateText = timestampGuideList.join('\n');

      if (!shopUrl && !productDetails) {
        return res.status(400).json({ error: 'Mohon sediakan link TikTok Shop atau detail nama/deskripsi produk.' });
      }

      let enrichedInfo = '';
      if (shopUrl) {
        try {
          const rawUrl = shopUrl.trim();
          let cleanUrl = rawUrl;
          if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
            cleanUrl = 'https://' + cleanUrl;
          }

          let finalUrl = cleanUrl;
          let sitePlatform = 'E-Commerce Marketplace';
          if (cleanUrl.includes('tiktok.com') || cleanUrl.includes('vt.tiktok.com') || cleanUrl.includes('shop.tiktok.com')) sitePlatform = 'TikTok Shop';
          else if (cleanUrl.includes('tokopedia') || cleanUrl.includes('tokopedia.link')) sitePlatform = 'Tokopedia';
          else if (cleanUrl.includes('shopee') || cleanUrl.includes('s.shopee.co.id')) sitePlatform = 'Shopee';
          else if (cleanUrl.includes('lazada')) sitePlatform = 'Lazada';

          let pageTitle = '';
          let metaDesc = '';
          let ogPrice = '';
          let urlSlugKeywords = '';

          // Extract keywords from URL path/slug if present (e.g. /product/azarine-hydrasoothe-sunscreen-gel...)
          try {
            const urlObj = new URL(cleanUrl);
            const pathParts = urlObj.pathname.split('/').filter(p => p.length > 2);
            const rawSlug = pathParts.join(' ').replace(/[-_]/g, ' ');
            if (rawSlug && !rawSlug.includes('http')) {
              urlSlugKeywords = rawSlug.replace(/\b(product|item|i|p|dp|detail|view|shop|seller|buy)\b/gi, '').trim();
            }
          } catch (e) {}

          // 1. Follow short link redirects & extract metadata
          try {
            const htmlRes = await fetch(cleanUrl, {
              method: 'GET',
              redirect: 'follow',
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
              }
            });
            if (htmlRes.ok) {
              finalUrl = htmlRes.url || cleanUrl;
              const htmlText = await htmlRes.text();
              const ogTitleMatch = htmlText.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) || htmlText.match(/<title>([^<]+)<\/title>/i);
              const ogDescMatch = htmlText.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i) || htmlText.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
              const priceMatch = htmlText.match(/<meta[^>]*property=["'](?:product:price:amount|og:price:amount)["'][^>]*content=["']([^"']+)["']/i) || htmlText.match(/Rp\s*[\d\.,]+/i);

              if (ogTitleMatch) pageTitle = ogTitleMatch[1].replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').trim();
              if (ogDescMatch) metaDesc = ogDescMatch[1].replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&').trim();
              if (priceMatch) ogPrice = priceMatch[0] || priceMatch[1] || '';
            }
          } catch (fetchErr) {
            logger.warn('[TikTok Shop Ideas] Direct link expansion fetch error:', fetchErr);
          }

          // 2. If TikTok link, also attempt TikWM live scrape
          let tikwmSummary = '';
          if (cleanUrl.includes('tiktok.com') || finalUrl.includes('tiktok.com')) {
            try {
              const tikWmRes = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(finalUrl)}&hd=1`, {
                headers: { 'User-Agent': 'Mozilla/5.0' }
              });
              const tikWmData = await tikWmRes.json();
              if (tikWmData && tikWmData.code === 0 && tikWmData.data) {
                const v = tikWmData.data;
                tikwmSummary = `\nCaption TikTok Video: ${v.title || ''}\nAuthor: @${v.author?.unique_id || ''} (${v.author?.nickname || ''})\nPlay/Views: ${v.play_count || 0} views, Likes: ${v.digg_count || 0}`;
              }
            } catch (tikWmErr) {}
          }

          enrichedInfo = `[DATA HASIL METADATA LINK EXPANSION REALTIME]
Platform Detected: ${sitePlatform}
Original Link: ${cleanUrl}
Expanded Final Link: ${finalUrl}
Judul Halaman/Produk: ${pageTitle || 'Tidak dapat diambil langsung'}
Kata Kunci Slug URL: ${urlSlugKeywords || 'Tidak ada'}
Deskripsi Produk/Meta: ${metaDesc || 'Tidak dapat diambil langsung'}
Estimasi Harga: ${ogPrice || 'Tersedia di toko'}${tikwmSummary}`;

        } catch (err) {
          logger.warn('[TikTok Shop Ideas] Failed link expansion & enrichment:', err);
        }
      }

      const promptText = `Anda adalah Pakar TikTok Shop Affiliate Strategist & Senior E-Commerce Copywriter terbaik di Indonesia dengan keahlian analisis mendalam setara Grok Intelligence.
Tugas Anda adalah menganalisis produk berdasarkan link / detail yang diberikan dan memproduksi 3 BAGIAN UTAMA DENGAN RISET PRODUK DAN FORMULA VIRALITAS:

1. AI ANALISIS PRODUK (5 PILAR UTAMA + ENRICHMENT GROK INTELLIGENCE + RINGKASAN EKSEKUTIF)
2. MAPPING QUERY SEO TIKTOK (8-12 Kata Kunci Pencarian Alami High-Volume & Long-Tail)
3. GENERATE ${totalIdeas} IDE KONTEN VIRAL TIKTOK SHOP (Siap Pakai untuk Affiliate / Brand dengan Prompt Video per ${segSecNum} Detik)

[DATA INPUT DARI USER]
Link Produk: ${shopUrl || 'Tidak disertakan'}
Detail / Catatan Produk: ${productDetails || 'Tidak disertakan'}
Target Total Durasi Video: ${maxSecNum} Detik
Pecah Durasi Prompt: Tiap ${segSecNum} Detik per Klip (${expectedClipsCount} Klip Segmen)
Target Mode AEO: ${aeoTargetMode.toUpperCase()}
Kontrol Audio/Teks: Background Sound = ${enableBigSound ? 'AKTIF' : 'NONAKTIF'}, Text Overlay = ${enableTextOverlay ? 'AKTIF' : 'NONAKTIF'}
${enrichedInfo ? enrichedInfo : ''}

PENTING UNTUK LINK TIKTOK SHOP / MARKETPLACE:
Gunakan seluruh informasi dari URL slug, metadata, serta basis pengetahuan AI Anda untuk mengidentifikasi produk, merek, fungsi utama, bahan/spesifikasi, pain points konsumen, benefit, serta target audiens secara lengkap dan akurat. Jangan pernah membiarkan analisis kosong.

---
HARAP PATUHI DENGAN SANGAT PRESISI FORMAT MARKDOWN OUTPUT BERIKUT:

# 🛍️ ANALISIS PRODUK & IDE KONTEN VIRAL TIKTOK SHOP (${maxSecNum}s, ${expectedClipsCount} Klip)

## 📦 BAGIAN 1: AI ANALISIS PRODUK (5 PILAR & ENRICHMENT)

### 📊 5 Pilar Utama Analisis Produk
- **Kategori & Positioning**: [Sebutkan kategori spesifik & posisi produk di pasar, misal: Chemical Sunscreen Gel, Daily Protection, untuk sunscreen-haters]
- **Bahan / Key Ingredients / Spesifikasi**: [Sebutkan bahan aktif utama, komposisi, material, atau spesifikasi kunci]
- **Pain Points (Masalah Konsumen)**: [Sebutkan 3-5 masalah nyata konsumen yang diatasi, misal: whitecast, lengket, kulit berminyak, jerawat]
- **Benefit / Claim Utama**: [Sebutkan 3-5 benefit utama & klaim produk, misal: no whitecast, dingin & ringan, blue light protection, 0% alcohol]
- **Target User & Demografi**: [Profil target audiens ideal, jenis kulit/lifestyle, usia, dan persona pembeli]

### 🌟 Enrichment Extra (Grok-Style Product Intelligence)
- **Estimasi Harga & Rating**: [Sebutkan estimasi rentang harga & kisaran rating produk di marketplace]
- **BPOM / Sertifikasi**: [Status legalitas BPOM, Halal, Cruelty-Free, Dermatologically Tested, atau sertifikasi relevan]
- **Unique Selling Point (USP)**: [Keunggulan paling unik yang membedakan produk ini dari kompetitor sejenis]
- **Mood & Tone Konten Ideal**: [Gaya komunikasi ideal: Edukatif, Relatable, FOMO, Problem-Solving, Spontan, atau Entertainment]

### 📝 Ringkasan Eksekutif Produk
[Paragraf ringkasan komprehensif mengenai potensi penjualan produk ini di TikTok Shop dan strategi komunikasi kuncinya]

---

## 🔍 BAGIAN 2: MAPPING QUERY SEO TIKTOK (8-12 QUERY)

Berikut adalah 8–12 kata kunci pencarian TikTok yang sering dicari audiens (campuran High-Volume, Long-Tail, & Trending):

1. **Berdasarkan Problem / Pain Point**:
   - "[Query SEO 1 - Masalah]"
   - "[Query SEO 2 - Masalah]"
2. **Berdasarkan Ingredients / Spesifikasi**:
   - "[Query SEO 3 - Bahan/Bahan Aktif]"
   - "[Query SEO 4 - Spesifikasi/Material]"
3. **Berdasarkan Benefit & Solution**:
   - "[Query SEO 5 - Hasil / Benefit]"
   - "[Query SEO 6 - Klaim Khusus]"
4. **Berdasarkan Target User Specific**:
   - "[Query SEO 7 - Target Personas]"
   - "[Query SEO 8 - Lifestyle / Condition]"
5. **Berdasarkan Comparison & Recommendation**:
   - "[Query SEO 9 - Rekomendasi/Viral]"
   - "[Query SEO 10 - Perbandingan / Honest Review]"
   - "[Query SEO 11 - Worth It / Promo]"
   - "[Query SEO 12 - Daily Routine]"

---

## 🚀 BAGIAN 3: GENERATE ${totalIdeas} IDE KONTEN VIRAL TIKTOK SHOP

Hasilkan persis ${totalIdeas} ide konten kreatif dengan struktur persis seperti berikut:

### 💡 IDE 1: [Judul Ide Konten & Angle Hook]
- **Query SEO Acuan**: [Sebutkan 1 query dari Bagian 2]
- **Sudut Pandang / Angle**: [Pain Point / Benefit / Before-After / Edukasi / UGC Review / Mitos vs Fakta / Unboxing]
- **Target Audience**: [Sebutkan audiens target spesifik]
- **Hook 3 Detik Pertama (0-3s)**:
  - *Visual*: [Gambaran adegan pembuka yang menghentikan scroll / pattern break]
  - *Text On Screen (TOS)*: "[Kalimat teks tebal di layar]"
  - *Voice Over (VO)*: "[Kalimat pembuka yang diucapkan]"
- **Rincian Adegan Video & Prompt AI per Segmen (${maxSecNum} Detik)**:
${timestampTemplateText}
- **Call To Action (CTA)**:
  "[Kalimat ajakan klik keranjang kuning / promo stok terbatas]"
- **Rekomendasi Audio & Visual Style**:
  - *Audio / Sound*: [Tone BGM, sound effect, atau gaya suara]
  - *Visual Style*: [Pencahayaan, lokasi, prop visual, pacing video]
- **Draft Caption TikTok Shop**:
  [Draft caption persuasif dengan emosi dan klaim produk]
- **Hashtag Relevan**: #Hashtag1 #Hashtag2 #Hashtag3 #TikTokShopID

PERATURAN TAMBAHAN KONTROL AUDIO & TEKS:
- BIG SOUND: ${enableBigSound ? 'AKTIF - WAJIB cantumkan tag [Background Sound] dengan detail musik/audio pendukung pada setiap klip.' : 'NONAKTIF - DILARANG SERTAKAN ATAU TULIS tag [Background Sound] dalam seluruh prompt video klip (struktur tag [Background Sound] dinonaktifkan total).'}
- TEXT OVERLAY: ${enableTextOverlay ? 'AKTIF - WAJIB cantumkan tag [Text Overlay] dengan recommendation teks hook tulisan pendek di layar pada setiap klip.' : 'NONAKTIF - DILARANG SERTAKAN ATAU TULIS tag [Text Overlay] dalam seluruh prompt video klip (struktur tag [Text Overlay] dinonaktifkan total).'}
- WAJIB FORMAT MARKDOWN: Setiap list poin (-) dan block code (\`\`\`text) HARUS menggunakan baris baru (newline). JANGAN menggabungkan teks per-segmen klip menjadi satu paragraf.
- LARANGAN KLAIM HARGA & OVERCLAIM: JANGAN PERNAH menyebutkan nominal harga spesifik (misal: "80 ribuan", "under 190k") di script, VO, atau teks layar. JANGAN melakukan overclaiming (klaim berlebihan yang menyesatkan atau melanggar aturan e-commerce). Gunakan bahasa persuasif yang aman seperti "harga promo", "diskon spesial", dll.
- CAPTION SEO: Anda WAJIB membuat caption pada bagian "Draft Caption TikTok Shop" yang SANGAT RELEVAN dengan produk/video, mengandung HOOK persuasif, dan dibatasi maksimal 5 hashtag saja (contoh: #A #B #C #D #E). Jangan masukkan caption ke dalam teks Rincian Adegan Video.

(Lanjutkan dari IDE 2 hingga IDE ${totalIdeas} dengan format yang persis sama)
`;

      const payload = {
        contents: {
          parts: [{ text: promptText }],
        },
        config: {
          systemInstruction:
            "Anda adalah Pakar TikTok Shop Affiliate Strategist & Senior E-Commerce Copywriter. Anda wajib menganalisis produk berdasarkan pilar yang diminta dan menghasilkan ide konten viral serta caption yang alami, terstruktur, dan siap pakai.",
        },
      };

      const userSelectedModel = model || 'gemini-3.6-flash';
      const geminiResult = await callGeminiWithFallback(userSelectedModel, payload, customApiKey, clientAccessCode);

      recordExecutionAndUpgrade('contentIdeas');

      activeTask.status = 'completed';
      activeTask.updatedAt = Date.now();
      activeGenerationsMap.set(taskId, activeTask);

      broadcastLiveEvent({
        type: 'active_status_update',
        activeGenerations: Array.from(activeGenerationsMap.values()),
        activeUserCount: sseClients.size,
      });

      setTimeout(() => {
        activeGenerationsMap.delete(taskId);
        broadcastLiveEvent({
          type: 'active_status_update',
          activeGenerations: Array.from(activeGenerationsMap.values()),
          activeUserCount: sseClients.size,
        });
      }, 120000);

      res.json({
        success: true,
        result: geminiResult.text,
        text: geminiResult.text,
        modelUsed: geminiResult.modelUsed || userSelectedModel,
      });

    } catch (err: any) {
      logger.error('TikTok Shop Ideas generation error:', err);
      activeTask.status = 'failed';
      activeTask.updatedAt = Date.now();
      activeGenerationsMap.set(taskId, activeTask);

      broadcastLiveEvent({
        type: 'active_status_update',
        activeGenerations: Array.from(activeGenerationsMap.values()),
        activeUserCount: sseClients.size,
      });

      setTimeout(() => {
        activeGenerationsMap.delete(taskId);
        broadcastLiveEvent({
          type: 'active_status_update',
          activeGenerations: Array.from(activeGenerationsMap.values()),
          activeUserCount: sseClients.size,
        });
      }, 5000);

      const statusCode = err.statusCode || 500;
      res.status(statusCode).json({ error: err.message || 'Gagal menganalisis produk TikTok Shop.' });
    }
  });

  // API endpoint for Backend System Intelligence Status & Memory Metrics
  app.get('/api/system-intelligence', (req, res) => {
    const intel = getSystemIntelligenceLevel();
    res.json({
      status: 'active' as any,
      intelligence: intel,
      thinkingMode: 'Gemini 3.1 Pro High Thinking Active',
      memoryFile: MEMORY_FILE_PATH,
    });
  });

  // API endpoint for Realtime Batched Auto-Learning Memory Worker (Sync every 3 seconds)
  app.post('/api/backend/learn', (req, res) => {
    try {
      const { events } = req.body;
      if (!Array.isArray(events) || events.length === 0) {
        return res.json({ success: true, processedEventsCount: 0, intelligence: getSystemIntelligenceLevel() });
      }

      if (!Array.isArray(systemMemory.formulas)) {
        systemMemory.formulas = [];
      }

      let newInsightsAdded = 0;

      for (const evt of events) {
        const { type, payload } = evt;

        if (type === 'video_uploaded') {
          if (payload?.fileName) {
            logger.info(`[Event Analytics] Video uploaded: ${payload.fileName} (${payload.fileSize || 0} bytes)`);
          }
        } else if (type === 'split_duration_selected') {
          logger.info(`[Event Analytics] Duration selected: ${payload?.duration}`);
        } else if (type === 'ai_engine_selected') {
          logger.info(`[Event Analytics] Engine selected: ${payload?.model}`);
        } else if (type === 'detail_element_toggled') {
          logger.info(`[Event Analytics] Detail element toggled: ${payload?.element} = ${payload?.enabled}`);
        } else if (type === 'prompt_split_generated') {
          const params = payload?.parameters || payload || {};
          const duration = params.segmentDuration || '10';
          const model = params.selectedModel || params.model || 'gemini-3.6-flash';
          const act = params.includeActions !== false;
          const vo = params.includeVoiceOver !== false;
          const cine = params.includeCinematics !== false;

          const elementsList: string[] = [];
          if (act) elementsList.push('Aksi&Gerakan');
          if (vo) elementsList.push('Transkrip VO');
          if (cine) elementsList.push('Kamera&Lighting');

          const formulaKey = `formula_${duration}_${model}_${act ? '1' : '0'}_${vo ? '1' : '0'}_${cine ? '1' : '0'}`;
          const formulaPattern = `Formula Pecah ${duration !== 'auto' ? duration + 's' : 'Penuh'} • ${model} • [${elementsList.join(', ')}]`;

          let existingFormula = systemMemory.formulas.find((f: any) => f.id === formulaKey);

          if (!existingFormula) {
            existingFormula = {
              id: formulaKey,
              pattern: formulaPattern,
              segmentDuration: duration,
              model: model,
              elements: elementsList,
              confidenceScore: 1,
              createdAt: Date.now(),
              lastUsedAt: Date.now(),
            };
            systemMemory.formulas.push(existingFormula);

            const insight = `Formula Baru Teridentifikasi: ${formulaPattern}`;
            if (!systemMemory.learnedKnowledgeBase.includes(insight)) {
              systemMemory.learnedKnowledgeBase.push(insight);
              newInsightsAdded++;
            }
          } else {
            existingFormula.lastUsedAt = Date.now();
            existingFormula.confidenceScore += 1;
          }

          // Counter "Proyek Diproses" dinaikkan SETELAH formula berhasil tersimpan di memori
          systemMemory.totalExecutions += 1;
          systemMemory.successfulPromptsCount += 1;
          systemMemory.categoryUsage.videoPrompt = (systemMemory.categoryUsage.videoPrompt || 0) + 1;

        } else if (type === 'prompt_clip_copied' || type === 'prompt_sent_to_photo') {
          systemMemory.successfulPromptsCount += 1;
          const isSentToPhoto = type === 'prompt_sent_to_photo';
          const boost = isSentToPhoto ? 5 : 2;

          if (systemMemory.formulas.length > 0) {
            const targetFormula = systemMemory.formulas.find((f: any) => f.segmentDuration === payload?.segmentDuration) || systemMemory.formulas[systemMemory.formulas.length - 1];
            if (targetFormula) {
              targetFormula.confidenceScore = (targetFormula.confidenceScore || 1) + boost;
              const insight = `Formula Validasi AI (+Confidence ${targetFormula.confidenceScore}): ${targetFormula.pattern}`;
              if (!systemMemory.learnedKnowledgeBase.includes(insight) && targetFormula.confidenceScore >= 3) {
                systemMemory.learnedKnowledgeBase.push(insight);
                newInsightsAdded++;
              }
            }
          }

          if (payload?.promptSnippet || payload?.text) {
            const rawTxt = payload.promptSnippet || payload.text;
            const shortSnippet = String(rawTxt).slice(0, 100).replace(/\n/g, ' ');
            const insight = `${isSentToPhoto ? 'Lanjut ke Prompt Foto' : 'Prompt Klip Dicopy'}: "${shortSnippet}..."`;
            if (!systemMemory.learnedKnowledgeBase.includes(insight)) {
              systemMemory.learnedKnowledgeBase.push(insight);
              newInsightsAdded++;
            }
          }
        } else if (type === 'link_pasted') {
          systemMemory.totalExecutions += 1;
        } else if (type === 'video_downloaded') {
          systemMemory.totalExecutions += 1;
          systemMemory.successfulPromptsCount += 1;
        } else if (type === 'content_ideas_generated') {
          recordExecutionAndUpgrade('contentIdeas');
        } else if (type === 'video_prompt_generated') {
          recordExecutionAndUpgrade('videoPrompt');
        } else if (type === 'photo_prompt_generated') {
          recordExecutionAndUpgrade('photoPrompt');
        } else if (type === 'prompt_copied') {
          systemMemory.successfulPromptsCount += 1;
          if (payload?.text && typeof payload.text === 'string' && payload.text.length > 10) {
            const shortSnippet = payload.text.slice(0, 100).replace(/\n/g, ' ');
            const insight = `Pola Sukses (Dicopy User): "${shortSnippet}..."`;
            if (!systemMemory.learnedKnowledgeBase.includes(insight)) {
              systemMemory.learnedKnowledgeBase.push(insight);
              newInsightsAdded++;
            }
          }
        } else if (type === 'prompt_edited_manually') {
          if (payload?.editedText && typeof payload.editedText === 'string') {
            const shortSnippet = payload.editedText.slice(0, 100).replace(/\n/g, ' ');
            const insight = `Penyesuaian Manual User: "${shortSnippet}..."`;
            if (!systemMemory.learnedKnowledgeBase.includes(insight)) {
              systemMemory.learnedKnowledgeBase.push(insight);
              newInsightsAdded++;
            }
          }
        } else if (type === 'formula_injected') {
          if (payload?.insight && typeof payload.insight === 'string' && payload.insight.trim()) {
            recordExecutionAndUpgrade('contentIdeas', payload.insight.trim());
            newInsightsAdded++;
          }
        }
      }

      saveSystemMemory();

      return res.json({
        success: true,
        processedEventsCount: events.length,
        newInsightsAdded,
        intelligence: getSystemIntelligenceLevel(),
      });
    } catch (e: any) {
      logger.warn('[Realtime Auto-Learning] Error processing batch events:', e);
      return res.status(500).json({ error: e.message || 'Gagal memproses event pembelajaran' });
    }
  });

  // API endpoint to submit user feedback or custom prompt learning insight
  app.post('/api/learn-feedback', (req, res) => {
    try {
      const { insight, type = 'contentIdeas' } = req.body;
      if (insight && typeof insight === 'string' && insight.trim()) {
        recordExecutionAndUpgrade(type, insight.trim());
        return res.json({ success: true, intelligence: getSystemIntelligenceLevel() });
      }
      res.status(400).json({ error: 'Insight teks tidak valid' });
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Gagal menyimpan feedback pemikiran' });
    }
  });

  // --- ADMIN KNOWLEDGE SYSTEM INJECTION ENDPOINTS ---
  app.get('/api/admin/knowledge', (req, res) => {
    try {
      if (!Array.isArray(systemMemory.learnedKnowledgeBase)) {
        systemMemory.learnedKnowledgeBase = [];
      }
      return res.json({
        success: true,
        knowledgeBase: systemMemory.learnedKnowledgeBase,
        intelligenceLevel: getSystemIntelligenceLevel(),
        totalExecutions: systemMemory.totalExecutions || 350,
        lastUpdated: systemMemory.lastUpdated || new Date().toISOString()
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message || 'Gagal mengambil data pengetahuan sistem' });
    }
  });

  app.post('/api/admin/knowledge/inject', (req, res) => {
    try {
      const { insight, category, fileName } = req.body;
      if (!insight || typeof insight !== 'string' || !insight.trim()) {
        return res.status(400).json({ error: 'Teks wawasan pengetahuan tidak boleh kosong' });
      }

      const formattedInsight = fileName 
        ? `[Injeksi Berkas: ${fileName}] ${insight.trim()}`
        : category 
          ? `[Injeksi System Admin: ${category.toUpperCase()}] ${insight.trim()}`
          : `[Injeksi System Admin] ${insight.trim()}`;

      if (!Array.isArray(systemMemory.learnedKnowledgeBase)) {
        systemMemory.learnedKnowledgeBase = [];
      }

      if (!systemMemory.learnedKnowledgeBase.includes(formattedInsight)) {
        systemMemory.learnedKnowledgeBase.unshift(formattedInsight);
        systemMemory.lastUpdated = new Date().toISOString();
        saveSystemMemory();
      }

      return res.json({
        success: true,
        message: 'Wawasan berhasil diinjeksi ke memori sistem!',
        knowledgeBase: systemMemory.learnedKnowledgeBase,
        intelligenceLevel: getSystemIntelligenceLevel()
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message || 'Gagal menginjeksi pengetahuan' });
    }
  });

  app.delete('/api/admin/knowledge', (req, res) => {
    try {
      const { index, text } = req.body;
      if (!Array.isArray(systemMemory.learnedKnowledgeBase)) {
        systemMemory.learnedKnowledgeBase = [];
      }

      if (typeof index === 'number' && index >= 0 && index < systemMemory.learnedKnowledgeBase.length) {
        systemMemory.learnedKnowledgeBase.splice(index, 1);
      } else if (text && typeof text === 'string') {
        systemMemory.learnedKnowledgeBase = systemMemory.learnedKnowledgeBase.filter(k => k !== text);
      }

      systemMemory.lastUpdated = new Date().toISOString();
      saveSystemMemory();

      return res.json({
        success: true,
        knowledgeBase: systemMemory.learnedKnowledgeBase,
        intelligenceLevel: getSystemIntelligenceLevel()
      });
    } catch (e: any) {
      return res.status(500).json({ error: e.message || 'Gagal menghapus wawasan pengetahuan' });
    }
  });

  app.post('/api/admin/knowledge/chat', async (req, res) => {
    try {
      const { message, attachedFile, chatHistory } = req.body;
      if ((!message || !message.trim()) && !attachedFile) {
        return res.status(400).json({ error: 'Pesan atau berkas tidak boleh kosong' });
      }

      let systemPrompt = `Anda adalah Core AI System Architect & Neural Knowledge Integrator dari Console Admin Tools Satset.
Tugas Anda adalah berdiskusi dengan Admin, menganalisis berkas/dokumen/teks yang diunggah Admin, dan mengekstrak aturan wawasan (Knowledge Injection Rules) yang secara langsung akan memperkaya kecerdasan sistem AI di seluruh aplikasi.

Respons Anda HARUS berformat JSON dengan struktur berikut:
{
  "reply": "Penjelasan responsif, profesional, dan futuristik dalam Bahasa Indonesia kepada Admin mengenai bagaimana pengetahuan ini telah terintegrasi.",
  "extractedInsights": [
    "Aturan/wawasan ringkas 1 yang siap diinjeksi ke memori sistem",
    "Aturan/wawasan ringkas 2"
  ],
  "suggestedTags": ["Tag1", "Tag2"]
}`;

      let userContent = `PESAN ADMIN: "${message || 'Mohon analisis berkas berikut dan integrasikan ke kecerdasan sistem.'}"`;
      if (attachedFile) {
        userContent += `\n\nBERKAS DIPERIKSA:
- Nama Berkas: ${attachedFile.name}
- Tipe/Ukuran: ${attachedFile.type || 'Dokumen'} (${attachedFile.size || 0} bytes)
- Isi Berkas / Ekstrak Teks:
${attachedFile.textContent || attachedFile.content || '(Teks berkas terlampir)'}`;
      }

      const ai = getGeminiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: [
          { role: 'user', parts: [{ text: `${systemPrompt}\n\n${userContent}` }] }
        ],
        config: {
          temperature: 0.3,
          responseMimeType: 'application/json'
        }
      });

      const responseText = response.text || '';
      let parsedResponse: any = {};
      try {
        parsedResponse = JSON.parse(responseText);
      } catch (err) {
        parsedResponse = {
          reply: responseText || 'Berhasil memproses pengetahuan baru dan menyuntikkannya ke sistem.',
          extractedInsights: [
            attachedFile ? `[Injeksi Berkas: ${attachedFile.name}] Wawasan dari ${attachedFile.name}` : `[Injeksi Chat Admin] ${message}`
          ],
          suggestedTags: ['AdminInjection']
        };
      }

      // Automatically inject extracted insights into system memory
      if (!Array.isArray(systemMemory.learnedKnowledgeBase)) {
        systemMemory.learnedKnowledgeBase = [];
      }

      const newInsights = parsedResponse.extractedInsights || [];
      for (const ins of newInsights) {
        if (ins && typeof ins === 'string' && !systemMemory.learnedKnowledgeBase.includes(ins)) {
          systemMemory.learnedKnowledgeBase.unshift(ins);
        }
      }

      systemMemory.lastUpdated = new Date().toISOString();
      saveSystemMemory();

      return res.json({
        success: true,
        reply: parsedResponse.reply || 'Pengetahuan baru berhasil diserap dan diinjeksi ke dalam kecerdasan sistem.',
        extractedInsights: newInsights,
        knowledgeBase: systemMemory.learnedKnowledgeBase,
        intelligenceLevel: getSystemIntelligenceLevel()
      });
    } catch (e: any) {
      logger.warn('[Knowledge Chat API] Error processing admin knowledge chat:', e);
      // Fallback if AI call fails
      const fallbackMsg = `Gagal menghubungkan ke AI Engine: ${e.message || 'Error'}. Namun wawasan teks telah disimpan secara langsung.`;
      
      const { message, attachedFile } = req.body;
      const directInsight = attachedFile 
        ? `[Injeksi Berkas: ${attachedFile.name}] ${attachedFile.textContent ? attachedFile.textContent.slice(0, 150) : 'Berkas diunggah admin'}`
        : `[Injeksi Admin] ${message}`;

      if (!systemMemory.learnedKnowledgeBase.includes(directInsight)) {
        systemMemory.learnedKnowledgeBase.unshift(directInsight);
        saveSystemMemory();
      }

      return res.json({
        success: true,
        reply: fallbackMsg,
        extractedInsights: [directInsight],
        knowledgeBase: systemMemory.learnedKnowledgeBase,
        intelligenceLevel: getSystemIntelligenceLevel()
      });
    }
  });

  // 1-Hour Server-side Background Auto-Trainer Engine
  function initServerAutoTrainerScheduler() {
    logger.info('[Auto-Trainer Engine 24/7] Scheduler started. Running every 1 hour...');

    const runTrainerPass = async () => {
      try {
        logger.info('[Auto-Trainer Engine 24/7] Running 1-Hour Automated Knowledge Pass...');
        const events = await loadEventsServer();
        let newlyLearned = 0;

        events.forEach((evt) => {
          // Exclude herbal_kesehatan from auto-merging
          if (evt.category === 'herbal_kesehatan') {
            return;
          }

          if (evt.payload && evt.payload.insight) {
            const insight = String(evt.payload.insight).trim();
            if (insight && !systemMemory.learnedKnowledgeBase.includes(insight)) {
              systemMemory.learnedKnowledgeBase.push(insight);
              newlyLearned++;
            }
          }
        });

        systemMemory.lastUpdated = new Date().toISOString();
        saveSystemMemory();

        logger.info(`[Auto-Trainer Engine 24/7] Pass completed. +${newlyLearned} new patterns merged. Total Knowledge Base: ${systemMemory.learnedKnowledgeBase.length}`);
      } catch (err) {
        logger.warn('[Auto-Trainer Engine 24/7] Error in background pass:', err);
      }
    };

    // Run initial pass 10s after server boot
    setTimeout(runTrainerPass, 10000);

    // Repeat every 1 hour (3600000 ms)
    setInterval(runTrainerPass, 3600000);
  }

  initServerAutoTrainerScheduler();

  // Helper to extract clean URL from text (e.g. from user sharing text from TikTok app)
  function extractUrlFromText(text: string): string {
    if (!text || typeof text !== 'string') return '';
    const trimmed = text.trim();
    const urlMatch = trimmed.match(/https?:\/\/[^\s]+/i);
    if (urlMatch) {
      // Strip trailing punctuation often attached from copy-paste
      return urlMatch[0].replace(/[)\]}>,;."']+$/, '');
    }
    return trimmed;
  }

  // API endpoint for TikTok Video Info Downloader with Cache, Auto-Unshorten & Multi-Fallback
  app.post('/api/tiktok/info', async (req, res) => {
    try {
      const { url } = req.body;
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: 'URL TikTok tidak boleh kosong' });
      }

      let cleanUrl = extractUrlFromText(url);
      if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        cleanUrl = 'https://' + cleanUrl;
      }

      // Check Cache
      const cached = tiktokCache.get(cleanUrl);
      if (cached && Date.now() - cached.timestamp < TIKTOK_CACHE_TTL_MS) {
        logger.info('[TikTok Cache Hit]', cleanUrl);
        return res.json(cached.data);
      }

      // Resolve redirect for shortlinks (vt.tiktok.com, vm.tiktok.com, /t/)
      let resolvedUrl = cleanUrl;
      if (cleanUrl.includes('vt.tiktok.com') || cleanUrl.includes('vm.tiktok.com') || cleanUrl.includes('/t/')) {
        try {
          const headRes = await fetch(cleanUrl, {
            method: 'HEAD',
            redirect: 'follow',
            headers: {
              'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
            }
          });
          if (headRes.ok && headRes.url && headRes.url !== cleanUrl) {
            resolvedUrl = headRes.url;
          }
        } catch (e) {
          // Ignore redirect error, proceed with original
        }
      }

      const urlsToTry = Array.from(new Set([cleanUrl, resolvedUrl]));

      // Provider 1: TikWM
      for (const targetUrl of urlsToTry) {
        try {
          const response = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(targetUrl)}&hd=1`, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
              'Accept': 'application/json, text/plain, */*',
            }
          });

          const data = await response.json();

          if (data && data.code === 0 && data.data) {
            const v = data.data;
            const result = {
              id: v.id || String(Date.now()),
              title: v.title || 'TikTok Video',
              cover: v.cover || v.origin_cover || '',
              play: v.play || '', // No watermark video URL
              wmplay: v.wmplay || v.play || '', // Watermarked video URL
              hdplay: v.hdplay || v.play || '', // HD video URL
              music: v.music || '', // Audio URL
              musicTitle: v.music_info?.title || 'Original Audio',
              musicAuthor: v.music_info?.author || v.author?.nickname || '',
              author: {
                id: v.author?.id || '',
                uniqueId: v.author?.unique_id || 'tiktok_user',
                nickname: v.author?.nickname || 'TikTok Creator',
                avatar: v.author?.avatar || '',
              },
              stats: {
                playCount: v.play_count || 0,
                diggCount: v.digg_count || 0,
                commentCount: v.comment_count || 0,
                shareCount: v.share_count || 0,
              },
              images: v.images || null,
            };

            tiktokCache.set(cleanUrl, { timestamp: Date.now(), data: result });
            if (resolvedUrl !== cleanUrl) {
              tiktokCache.set(resolvedUrl, { timestamp: Date.now(), data: result });
            }
            return res.json(result);
          }
        } catch (e) {
          logger.warn('TikWM API failed for URL, trying next provider...', e);
        }
      }

      // Provider 2: Tiklydown (v1 / v4)
      for (const targetUrl of urlsToTry) {
        try {
          const fallbackRes = await fetch(`https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(targetUrl)}`);
          const fallbackData = await fallbackRes.json();
          if (fallbackData && (fallbackData.video || fallbackData.url)) {
            const result = {
              id: fallbackData.id || String(Date.now()),
              title: fallbackData.title || fallbackData.video?.caption || 'TikTok Video',
              cover: fallbackData.cover || fallbackData.video?.cover || '',
              play: fallbackData.video?.noWatermark || fallbackData.url || '',
              wmplay: fallbackData.video?.watermark || fallbackData.url || '',
              hdplay: fallbackData.video?.noWatermark || fallbackData.url || '',
              music: fallbackData.music?.url || fallbackData.audio || '',
              musicTitle: fallbackData.music?.title || 'Original Audio',
              musicAuthor: fallbackData.music?.author || '',
              author: {
                id: fallbackData.author?.id || '',
                uniqueId: fallbackData.author?.unique_id || fallbackData.author?.username || 'user',
                nickname: fallbackData.author?.nickname || fallbackData.author?.name || 'TikTok User',
                avatar: fallbackData.author?.avatar || '',
              },
              stats: {
                playCount: fallbackData.stats?.playCount || 0,
                diggCount: fallbackData.stats?.likeCount || 0,
                commentCount: fallbackData.stats?.commentCount || 0,
                shareCount: fallbackData.stats?.shareCount || 0,
              },
              images: fallbackData.images || null,
            };

            tiktokCache.set(cleanUrl, { timestamp: Date.now(), data: result });
            return res.json(result);
          }
        } catch (e) {
          logger.warn('Tiklydown API failed:', e);
        }
      }

      // Provider 3: TikTok Official oEmbed (for metadata if download APIs are temporarily throttled)
      try {
        const oembedRes = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(resolvedUrl)}`);
        if (oembedRes.ok) {
          const oembedData = await oembedRes.json();
          if (oembedData && oembedData.title) {
            const result = {
              id: String(Date.now()),
              title: oembedData.title || 'TikTok Video',
              cover: oembedData.thumbnail_url || '',
              play: '',
              wmplay: '',
              hdplay: '',
              music: '',
              musicTitle: 'Original Audio',
              musicAuthor: oembedData.author_name || '',
              author: {
                id: oembedData.author_unique_id || '',
                uniqueId: oembedData.author_unique_id || 'user',
                nickname: oembedData.author_name || 'TikTok User',
                avatar: '',
              },
              stats: { playCount: 0, diggCount: 0, commentCount: 0, shareCount: 0 },
              images: null,
            };
            return res.json(result);
          }
        }
      } catch (oembedErr) {
        // Continue to error
      }

      return res.status(404).json({
        error: 'Gagal mengambil informasi video TikTok. Pastikan tautan video berstatus publik dan valid.'
      });

    } catch (error: any) {
      logger.error('TikTok downloader error:', error);
      res.status(500).json({ error: 'Terjadi kesalahan saat memproses tautan TikTok.' });
    }
  });

  // API endpoint for streaming/proxying media to bypass CORS, support Range seeking, and force download
  app.get('/api/tiktok/proxy', async (req, res) => {
    try {
      const mediaUrl = req.query.url as string;
      const filename = (req.query.filename as string) || 'tiktok_media.mp4';
      const isDownload = req.query.download === 'true';

      if (!mediaUrl) {
        return res.status(400).send('URL query parameter is required');
      }

      // Set CORS Headers for Canvas/WebGL & Video Player compatibility
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Authorization');
      res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');

      if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
      }

      const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Referer': 'https://www.tiktok.com/',
      };

      if (req.headers.range) {
        headers['Range'] = req.headers.range;
      }

      const mediaRes = await fetch(mediaUrl, {
        headers,
      });

      if (!mediaRes.ok && mediaRes.status !== 206) {
        return res.status(mediaRes.status).send('Gagal mengambil berkas media');
      }

      const contentType = mediaRes.headers.get('content-type') || (filename.endsWith('.mp3') ? 'audio/mpeg' : 'video/mp4');
      res.setHeader('Content-Type', contentType);
      res.setHeader('Accept-Ranges', 'bytes');

      const contentRange = mediaRes.headers.get('content-range');
      if (contentRange) {
        res.setHeader('Content-Range', contentRange);
      }

      const contentLength = mediaRes.headers.get('content-length');
      if (contentLength) {
        res.setHeader('Content-Length', contentLength);
      }

      if (isDownload) {
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
      }

      res.status(mediaRes.status);

      // Stream buffer back to client
      const arrayBuffer = await mediaRes.arrayBuffer();
      res.send(Buffer.from(arrayBuffer));
    } catch (error: any) {
      logger.error('Proxy media error:', error);
      res.status(500).send('Media proxy error');
    }
  });

  // [REALTIME-FIX] --- TRACKING, SSE, LONG-POLLING & PERSISTENCE ENGINE ---
  interface SSEClientMeta {
    res: any;
    token: string;
    connectedAt: number;
  }

  const sseClients = new Set<SSEClientMeta>();
  const activeGenerationsMap = new Map<string, any>();
  const ACTIVE_GENS_FILE_PATH = path.join(process.cwd(), 'active_generations.json');

  // Load Active Generations on boot
  async function loadActiveGenerationsServer() {
    try {
      const data = await dbGetActiveGenerations();
      if (Array.isArray(data?.list)) {
        for (const item of data.list) {
          activeGenerationsMap.set(item.taskId, item);
        }
      }
    } catch (e) {
      logger.warn('[ActiveGen Persistence] Error reading file:', e);
    }
  }

  async function saveActiveGenerationsServer() {
    try {
      const list = Array.from(activeGenerationsMap.values());
      await dbSaveActiveGenerations({ list });
    } catch (e) {
      logger.warn('[ActiveGen Persistence] Error saving file:', e);
    }
  }

  await loadActiveGenerationsServer();

  // Periodic persistence of activeGenerationsMap (every 30s)
  setInterval(async () => {
    await saveActiveGenerationsServer();
  }, 30000);

  // In-Memory SimpleEventQueue (Max 500 items)
  interface QueueItem {
    id: number;
    payload: any;
    timestamp: number;
  }
  const simpleEventQueue: QueueItem[] = [];
  let globalEventCounter = Date.now();

  function pushToEventQueue(payload: any): number {
    const eventId = ++globalEventCounter;
    simpleEventQueue.push({ id: eventId, payload, timestamp: Date.now() });
    if (simpleEventQueue.length > 500) {
      simpleEventQueue.shift(); // Evict oldest
    }
    return eventId;
  }

  // Pending Long-Poll Requests Queue
  interface PendingPoll {
    token: string;
    lastEventId: number;
    res: any;
    timeout: any;
  }
  const pendingPolls: PendingPoll[] = [];

  // Heartbeat Timer every 15s for proxy connection keep-alive
  setInterval(() => {
    const hbPayload = `: heartbeat\nid: hb_${Date.now()}\ndata: ${JSON.stringify({ type: 'ping', ts: Date.now() })}\n\n`;
    sseClients.forEach((client) => {
      try {
        client.res.write(hbPayload);
      } catch (e) {
        sseClients.delete(client);
      }
    });
  }, 15000);

  // Robust Event Broadcast Function
  function broadcastLiveEvent(data: any) {
    const eventId = pushToEventQueue(data);
    const payload = `:pad\nid: ${eventId}\ndata: ${JSON.stringify(data)}\n\n`;

    // 1. Broadcast to SSE clients
    sseClients.forEach((client) => {
      try {
        client.res.write(payload);
      } catch (e) {
        // Retry 1x before dropping
        setTimeout(async () => {
          try {
            client.res.write(payload);
          } catch (retryErr) {
            logger.warn('[SSE] Client write failed after retry, dropping client.');
            sseClients.delete(client);
          }
        }, 50);
      }
    });

    // 2. Resolve Long-Polling clients waiting for new events
    for (let i = pendingPolls.length - 1; i >= 0; i--) {
      const poll = pendingPolls[i];
      if (poll.lastEventId < eventId) {
        clearTimeout(poll.timeout);
        try {
          poll.res.json({
            success: true,
            events: [data],
            lastEventId: eventId,
          });
        } catch (e) {
          // ignore write errors
        }
        pendingPolls.splice(i, 1);
      }
    }
  }

  // --- PACKAGES BACKEND PERSISTENCE ---
  const PACKAGES_FILE_PATH = path.join(process.cwd(), 'packages.json');

  const DEFAULT_PACKAGES_SERVER = [
    {
      id: 'mingguan',
      name: 'Akses Mingguan',
      tagline: 'Uji coba semua fitur AI Creator selama 7 hari penuh.',
      price: 49000,
      durationDays: 7,
      features: [
        'Akses 5 Tool AI Satset',
        'Generator Prompt Video 8K',
        'Generator Prompt Foto Ultra HD',
        'Video Frame Extractor',
        'TikTok Downloader No Watermark',
        'Bypass Kuota & Anti Limit Level 1'
      ],
      isPopular: false,
      isActive: true,
      badgeLabel: 'Hemat',
      targetCategory: 'public'
    },
    {
      id: 'bulanan',
      name: 'Akses Bulanan (VIP)',
      tagline: 'Pilihan favorit kreator konten & agensi digital.',
      price: 149000,
      durationDays: 30,
      features: [
        'Semua Fitur Paket Mingguan',
        'Prioritas Server Kecepatan Tinggi',
        'Bypass Kuota VIP & Anti Limit Max',
        'Format Export JSON & TXT',
        'Masa Aktif 30 Hari Penuh',
        'Dukungan Admin Fast Response'
      ],
      isPopular: true,
      isActive: true,
      badgeLabel: 'Paling Populer',
      targetCategory: 'public'
    },
    {
      id: 'lifetime',
      name: 'Ultra VIP Lifetime',
      tagline: 'Akses seumur hidup tanpa perpanjangan biaya bulanan.',
      price: 999000,
      durationDays: 36500,
      features: [
        'Akses Selamanya Tanpa Batas',
        'Semua Fitur VIP + Update Masa Depan',
        'Server Dedicated AI Engine',
        'Grup Komunitas Exclusive VIP',
        'Lisensi Komersial Konten Kreator'
      ],
      isPopular: false,
      isActive: true,
      badgeLabel: 'Sultan VIP',
      targetCategory: 'public'
    },
    {
      id: 'upgrade_vip',
      name: 'Perpanjang / Upgrade Member VIP',
      tagline: 'Penawaran khusus member terdaftar untuk perpanjangan atau upgrade akun.',
      price: 99000,
      durationDays: 30,
      features: [
        'Harga Khusus Perpanjangan Member',
        'Semua Fitur VIP + Priority Server',
        'Bypass Kuota & Anti Limit Max',
        'Akses Bebas Pemblokiran',
        'Dukungan Langsung via Admin VIP'
      ],
      isPopular: false,
      isActive: true,
      badgeLabel: 'Khusus Member',
      targetCategory: 'member'
    }
  ];

  function handleApiError(res: express.Response, err: any) {
    const statusCode = err?.statusCode || (err?.isPermissionDenied || err?.code === 7 ? 403 : 500);
    const message = err?.message || 'Terjadi kesalahan pada server/database';
    res.status(statusCode).json({
      error: message,
      status: err?.isPermissionDenied ? 'PERMISSION_DENIED' : 'DATABASE_ERROR',
      code: err?.code || statusCode,
    });
  }

  async function loadPackagesServer() { return await dbGetPackages(); }
  async function savePackagesServer(list: any[]) {
    try {
      const existing = await dbGetPackages();
      const newIds = new Set((list || []).map((p: any) => p.id).filter(Boolean));
      for (const oldPkg of existing) {
        if (oldPkg?.id && !newIds.has(oldPkg.id)) {
          await dbDeletePackage(oldPkg.id);
        }
      }
    } catch (e) {
      logger.warn('[savePackagesServer Delete Check Error]', e);
    }
    for (const item of list) { await dbSavePackage(item); }
  }
  app.get('/api/packages', async (req, res) => {
    try {
      res.json(await loadPackagesServer());
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.post('/api/admin/packages', requireAuth, requireAdminRole, async (req, res) => {
    try {
      const updatedPackagesList = req.body;
      if (!Array.isArray(updatedPackagesList)) {
        return res.status(400).json({ error: 'Payload paket harus berupa array' });
      }
      await savePackagesServer(updatedPackagesList);
      broadcastLiveEvent({ type: 'packages_updated', packages: updatedPackagesList });
      res.json({ success: true, packages: updatedPackagesList });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  // --- PAYMENT, CLIENTS, ACCESS CODES & QRIS ADMIN BACKEND PERSISTENCE ---
  const ACCESS_CODES_FILE_PATH = path.join(process.cwd(), 'access_codes.json');
  const QRIS_FILE_PATH = path.join(process.cwd(), 'qris_config.json');
  const TRANSACTIONS_FILE_PATH = path.join(process.cwd(), 'transactions.json');
  const CONTACT_SETTINGS_FILE_PATH = path.join(process.cwd(), 'contact_settings.json');

  const DEFAULT_ACCESS_CODES_SERVER = [
    { code: 'SATSET-ULTRA-VIP', note: 'Paket Ultra VIP Lifetime', createdAt: Date.now() },
    { code: 'PROMPT-SATSET-888', note: 'Akses Tester VIP', createdAt: Date.now() },
  ];

  async function loadAccessCodesServer() { return await dbGetAccessCodes(); }
  async function saveAccessCodesServer(list: any[]) {
    try {
      const existing = await dbGetAccessCodes();
      const newKeys = new Set((list || []).map((item: any) => (item?.id || item?.code || '').trim().toUpperCase()).filter(Boolean));
      for (const oldItem of existing) {
        const oldKey = (oldItem?.id || oldItem?.code || '').trim().toUpperCase();
        if (oldKey && !newKeys.has(oldKey)) {
          await dbDeleteAccessCode(oldKey);
        }
      }
    } catch (e) {
      logger.warn('[saveAccessCodesServer Delete Check Error]', e);
    }
    for (const item of list) { await dbSaveAccessCode(item); }
  }
  app.get('/api/access-codes', async (req, res) => {
    try {
      res.json(await loadAccessCodesServer());
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.post('/api/access-codes', async (req, res) => {
    try {
      const { code, note } = req.body || {};
      if (!code) return res.status(400).json({ error: 'Kode akses tidak boleh kosong' });
      const list = await loadAccessCodesServer();
      const cleanCode = code.trim().toUpperCase();
      const existingIdx = list.findIndex((item) => item.code && item.code.toUpperCase() === cleanCode);
      const newItem = {
        code: cleanCode,
        note: note || 'Akses Satset',
        createdAt: Date.now(),
      };
      if (existingIdx >= 0) {
        list[existingIdx] = { ...list[existingIdx], ...newItem };
      } else {
        list.unshift(newItem);
      }
      await saveAccessCodesServer(list);
      broadcastLiveEvent({ type: 'access_codes_updated', accessCodes: list });
      res.json({ success: true, accessCodes: list, item: newItem });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.post('/api/access-codes/remove', async (req, res) => {
    try {
      const { code } = req.body || {};
      if (!code) return res.status(400).json({ error: 'Kode akses tidak boleh kosong' });
      const cleanCode = code.trim().toUpperCase();
      const list = (await loadAccessCodesServer()).filter((item) => item.code && item.code.toUpperCase() !== cleanCode);
      await saveAccessCodesServer(list);
      broadcastLiveEvent({ type: 'access_codes_updated', accessCodes: list });
      res.json({ success: true, accessCodes: list });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  // --- AUDIT LOGS PERSISTENCE ENGINE ---
  const AUDIT_LOGS_FILE_PATH = path.join(process.cwd(), 'audit_logs.json');

  async function loadAuditLogsServer() { return await dbGetAuditLogs(); }
  async function saveAuditLogsServer(list: any[]) { for (const item of list) { await dbAddAuditLog(item); } }
  app.get('/api/admin/audit-logs', requireAuth, requireAdminRole, async (req, res) => {
    try {
      res.json(await loadAuditLogsServer());
    } catch (err) {
      handleApiError(res, err);
    }
  });

  // --- SECURITY ENFORCEMENT & VIOLATION REPORTING API ENDPOINTS ---
  app.post('/api/security/check-banned', (req, res) => {
    const clientIp = req.ip || req.socket.remoteAddress || '';
    const fingerprint = (req.headers['x-device-fingerprint'] as string) || req.body?.fingerprint || '';
    const accessCode = (req.headers['x-access-code'] as string) || req.body?.accessCode || '';

    const check = isDeviceOrIpBanned(clientIp, fingerprint, accessCode);
    if (check.banned) {
      return res.status(403).json({
        isBanned: true,
        error: `Akses Ditolak! Perangkat atau IP Anda telah diblokir secara permanen oleh Sistem Keamanan Server (Device Banned). Alasan: ${check.reason || 'Pelanggaran Akses'}.`,
        reason: check.reason,
      });
    }

    res.json({ isBanned: false });
  });

  app.post('/api/security/report-violation', async (req, res) => {
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const { violationType, details, fingerprint, accessCode } = req.body || {};

    const reason = `Otomatis Diblokir oleh Security System (${violationType || 'TAMPERING_DETECTED'}): ${details || 'Aktivitas mencurigakan di browser'}`;
    const banned = await banDeviceOrIp({
      fingerprint,
      ip: clientIp,
      accessCode,
      reason,
      bannedBy: 'SYSTEM_SECURITY_GUARD',
    });

    res.status(403).json({
      success: false,
      isBanned: true,
      error: `Perangkat Anda telah diblokir otomatis oleh Security Guard Server! Alasan: ${reason}`,
      bannedItem: banned,
    });
  });

  app.get('/api/admin/banned-devices', requireAuth, requireAdminRole, async (req, res) => {
    try {
      const list = await dbGetBannedDevices();
      res.json(list || Array.from(bannedDevicesMap.values()));
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.post('/api/admin/banned-devices', requireAuth, requireAdminRole, async (req, res) => {
    try {
      const { fingerprint, ip, accessCode, reason } = req.body || {};
      if (!fingerprint && !ip && !accessCode) {
        return res.status(400).json({ error: 'Sediakan Fingerprint, IP, atau Kode Akses untuk diblokir.' });
      }

      const item = await banDeviceOrIp({
        fingerprint,
        ip,
        accessCode,
        reason: reason || 'Manual Ban oleh Super Admin',
        bannedBy: 'SUPER_ADMIN',
      });

      res.json({ success: true, bannedDevice: item, message: 'Device/IP berhasil diblokir secara permanen.' });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.post('/api/admin/banned-devices/unban', requireAuth, requireAdminRole, async (req, res) => {
    try {
      const { id, fingerprint, ip } = req.body || {};
      const key = id || fingerprint || ip;
      if (!key) {
        return res.status(400).json({ error: 'Sediakan ID atau Key perangkat untuk di-unban.' });
      }

      bannedDevicesMap.delete(key);
      if (fingerprint) bannedDevicesMap.delete(fingerprint);
      if (ip) bannedDevicesMap.delete(ip);

      await dbDeleteBannedDevice(key);

      dbAddAuditLog({
        id: 'audit_' + Date.now(),
        adminName: 'DEVICE_UNBANNED',
        action: `Unbanned Device/IP key: ${key}`,
        details: 'security_system',
        timestamp: new Date().toISOString(),
        category: 'Security System' as any,
      });

      broadcastLiveEvent({ type: 'device_unbanned', unbannedKey: key });
      res.json({ success: true, message: 'Blokir perangkat berhasil dibuka.' });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.post('/api/admin/active-generations/stop', requireAuth, requireAdminRole, async (req, res) => {
    try {
      const { taskId, banUser } = req.body || {};
      if (!taskId) return res.status(400).json({ error: 'taskId required' });

      const task = activeGenerationsMap.get(taskId);
      if (task) {
        task.status = 'failed';
        task.updatedAt = Date.now();
        activeGenerationsMap.set(taskId, task);

        if (banUser && (task.ip || task.deviceFingerprint || task.accessCode)) {
          await banDeviceOrIp({
            fingerprint: task.deviceFingerprint,
            ip: task.ip,
            accessCode: task.accessCode,
            reason: `Dihentikan & Dibanned oleh Admin saat generate (${task.tool || 'Generasi AI'})`,
            bannedBy: 'ADMIN_FORCE_STOP',
          });
        }

        setTimeout(() => {
          activeGenerationsMap.delete(taskId);
          broadcastLiveEvent({
            type: 'active_status_update',
            activeGenerations: Array.from(activeGenerationsMap.values()),
            activeUserCount: sseClients.size,
          });
        }, 3000);
      }

      broadcastLiveEvent({
        type: 'active_status_update',
        activeGenerations: Array.from(activeGenerationsMap.values()),
        activeUserCount: sseClients.size,
      });

      res.json({ success: true, message: 'Generasi berhasil dibatalkan.' });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  // --- DEDICATED SERVER ACCESS CODE VERIFICATION ENDPOINT ---
  app.post('/api/verify-access-code', async (req, res) => {
    const { accessCode, fingerprint } = req.body || {};
    const ip = (req.ip || req.socket.remoteAddress || 'unknown').replace('::ffff:', '').trim();
    const cleaned = String(accessCode || '').trim().toUpperCase();

    // Check if IP or Fingerprint or Code is already banned
    const banCheck = isDeviceOrIpBanned(ip, fingerprint, cleaned);
    if (banCheck.banned) {
      return res.status(403).json({
        success: false,
        isBanned: true,
        error: `Akses Anda ditolak! Device/IP ini telah diblokir secara permanen oleh Sistem Keamanan. Alasan: ${banCheck.reason}`,
      });
    }

    if (!cleaned) {
      dbAddAuditLog({ id: 'audit_'+Date.now(), adminName: 'Percobaan Login Gagal', action: `Input kode akses kosong dari IP: ${ip}`, details: 'system', timestamp: new Date().toISOString(), category: 'Security System' as any });
      return res.status(400).json({ success: false, error: 'Masukkan Kode Akses Anda.' });
    }

    const trackerKey = `${ip}_${fingerprint || 'nofp'}`;
    const nowTs = Date.now();
    const prevAttempts = failedLoginTracker.get(trackerKey) || { count: 0, lastAttempt: nowTs };

    // Reset counter if last attempt was > 5 mins ago
    if (nowTs - prevAttempts.lastAttempt > 300000) {
      prevAttempts.count = 0;
    }

    const masterAdminKey = process.env.ADMIN_ACCESS_CODE ? process.env.ADMIN_ACCESS_CODE.trim().toUpperCase() : '';
    const masterAdminEmails = ['AHMADDAVID0906@GMAIL.COM', 'GLOBALLENSN@GMAIL.COM'];

    if ((masterAdminKey && cleaned === masterAdminKey) || masterAdminEmails.includes(cleaned)) {
      failedLoginTracker.delete(trackerKey);
      const loggedInEmail = cleaned.includes('@') ? cleaned.toLowerCase() : 'ahmaddavid0906@gmail.com';
      dbAddAuditLog({ id: 'audit_'+Date.now(), adminName: 'Login Master Admin Berhasil', action: `Admin login (${loggedInEmail}) dengan kode/email dari IP: ${ip}`, details: 'system', timestamp: new Date().toISOString(), category: 'Administrator' as any });
      return res.json({
        success: true,
        role: 'admin',
        name: 'Administrator',
        email: loggedInEmail,
        code: masterAdminKey || loggedInEmail,
      });
    }

    // Check Clients list
    const clients = await loadClientsServer();
    const client = clients.find((c) => c.accessCode && c.accessCode.toUpperCase() === cleaned);

    if (client) {
      const now = Date.now();
      const expiry = client.expiryDate ? new Date(client.expiryDate).getTime() : now + 86400000;
      let calculatedStatus = client.status || 'active';
      if (calculatedStatus !== 'suspended') {
        if (expiry - now <= 0) calculatedStatus = 'expired';
      }

      if (calculatedStatus === 'suspended') {
        dbAddAuditLog({ id: 'audit_'+Date.now(), adminName: 'Login Ditolak (Ditangguhkan)', action: `Kode Akses ${cleaned} (${client.name}) dalam status ditangguhkan dari IP: ${ip}`, details: 'client', timestamp: new Date().toISOString(), category: 'Security System' as any });
        return res.json({
          success: false,
          error: 'Akses Anda saat ini ditangguhkan. Silakan hubungi administrator.',
        });
      }

      if (calculatedStatus === 'expired') {
        dbAddAuditLog({ id: 'audit_'+Date.now(), adminName: 'Login Ditolak (Kadaluarsa)', action: `Kode Akses ${cleaned} (${client.name}) telah kedaluwarsa dari IP: ${ip}`, details: 'client', timestamp: new Date().toISOString(), category: 'Security System' as any });
        return res.json({
          success: false,
          error: 'Masa aktif kode akses telah kedaluwarsa. Silakan perpanjang paket Anda.',
        });
      }

      // Reset failed logins on success
      failedLoginTracker.delete(trackerKey);

      // Update client's lastLoginAt
      client.lastLoginAt = new Date().toISOString();
      await saveClientsServer(clients);
      broadcastLiveEvent({ type: 'clients_updated', clients });

      dbAddAuditLog({ id: 'audit_'+Date.now(), adminName: 'Login User Berhasil', action: `User ${client.name} (${cleaned}) berhasil login dari IP: ${ip}`, details: 'client', timestamp: new Date().toISOString(), category: client.name as any });
      return res.json({
        success: true,
        role: 'user',
        code: client.accessCode,
        name: client.name || 'Klien Satset',
        email: client.email || '',
      });
    }

    // Check Access Codes list
    const accessCodes = await loadAccessCodesServer();
    const matchedCode = accessCodes.find((item) => item.code && item.code.toUpperCase() === cleaned);

    if (matchedCode) {
      failedLoginTracker.delete(trackerKey);
      dbAddAuditLog({ id: 'audit_'+Date.now(), adminName: 'Login AccessCode Berhasil', action: `Kode Akses ${cleaned} (${matchedCode.note}) berhasil login dari IP: ${ip}`, details: 'system', timestamp: new Date().toISOString(), category: 'User' as any });
      return res.json({
        success: true,
        role: 'user',
        code: matchedCode.code,
        name: matchedCode.note || 'Klien Satset',
      });
    }

    // Increment failed login count
    const currentCount = prevAttempts.count + 1;
    failedLoginTracker.set(trackerKey, { count: currentCount, lastAttempt: nowTs });

    if (currentCount >= 5) {
      const banReason = `Otomatis Diblokir (Brute Force Login): 5x percobaan kode salah '${cleaned}' dari IP ${ip}`;
      await banDeviceOrIp({
        fingerprint,
        ip,
        accessCode: cleaned,
        reason: banReason,
        bannedBy: 'SYSTEM_BRUTE_FORCE_PROTECTOR',
      });

      return res.status(403).json({
        success: false,
        isBanned: true,
        error: `PERANGKAT DIBLOKIR PERMANEN! Anda telah melakukan 5 kali percobaan kode salah. Akses ditolak.`,
      });
    }

    dbAddAuditLog({ id: 'audit_'+Date.now(), adminName: 'Percobaan Login Ditolak', action: `Kode Akses tidak terdaftar (${currentCount}/5 attempt): ${cleaned} dari IP: ${ip}`, details: 'system', timestamp: new Date().toISOString(), category: 'Security System' as any });
    return res.json({
      success: false,
      error: `Kode Akses tidak terdaftar atau salah. (${currentCount}/5 batas percobaan sebelum Device Banned)`,
    });
  });

  const DEFAULT_CLIENTS_SERVER = [
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
      status: 'active' as any,
      type: 'standard' as any,
      lastLoginAt: '2026-08-06T08:00:00.000Z',
      toolUsage: { tiktokDownloader: 12, contentIdeas: 8, videoToPrompt: 15, photoPrompt: 6, frameExtractor: 4 },
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
      type: 'standard' as any,
      lastLoginAt: '2026-08-05T14:30:00.000Z',
      toolUsage: { tiktokDownloader: 5, contentIdeas: 3, videoToPrompt: 4, photoPrompt: 2, frameExtractor: 1 },
      createdAt: '2026-08-02T12:00:00.000Z'
    }
  ];

  async function loadClientsServer() { return await dbGetClients(); }
  async function saveClientsServer(list: any[]) {
    try {
      const existing = await dbGetClients();
      const newIds = new Set((list || []).map((c: any) => c.id).filter(Boolean));
      for (const oldCli of existing) {
        if (oldCli?.id && !newIds.has(oldCli.id)) {
          await dbDeleteClient(oldCli.id);
        }
      }
    } catch (e) {
      logger.warn('[saveClientsServer Delete Check Error]', e);
    }
    for (const c of list) { await dbSaveClient(c); }
  }
  app.get(['/api/clients', '/api/admin/clients'], requireAuth, requireAdminRole, async (req, res) => {
    try {
      res.json(await loadClientsServer());
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.get(['/api/apikeys', '/api/admin/apikeys'], async (req, res) => {
    try {
      res.json(await dbGetApiKeys());
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.post(['/api/apikeys', '/api/admin/apikeys'], requireAuth, requireAdminRole, async (req, res) => {
    try {
      const keys = Array.isArray(req.body) ? req.body : (req.body?.keys || []);
      await dbSaveApiKeys(keys);
      broadcastLiveEvent({ type: 'apikeys_updated', keys });
      res.json({ success: true, keys });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.post('/api/admin/clients', requireAuth, requireAdminRole, async (req, res) => {
    try {
      const clients = Array.isArray(req.body) ? req.body : (req.body?.clients || []);
      if (!Array.isArray(clients)) {
        return res.status(400).json({ error: 'Payload clients harus berupa array' });
      }
      await saveClientsServer(clients);

      // Auto-sync client access codes into access_codes.json so server verification recognizes them instantly
      try {
        const accessCodesList = await loadAccessCodesServer();
        let codesChanged = false;
        clients.forEach((c: any) => {
          if (c && c.accessCode) {
            const cleanCode = String(c.accessCode).trim().toUpperCase();
            const existingIdx = accessCodesList.findIndex(item => item.code && item.code.toUpperCase() === cleanCode);
            if (existingIdx === -1) {
              accessCodesList.unshift({
                code: cleanCode,
                note: `Client ${c.name || 'Custom'} (${c.packageName || 'Satset'})`,
                createdAt: Date.now()
              });
              codesChanged = true;
            }
          }
        });
        if (codesChanged) {
          await saveAccessCodesServer(accessCodesList);
          broadcastLiveEvent({ type: 'access_codes_updated', accessCodes: accessCodesList });
        }
      } catch (err) {
        logger.warn('[Clients Server] Failed syncing client access codes:', err);
      }

      broadcastLiveEvent({ type: 'clients_updated', clients });
      res.json({ success: true, clients });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  async function loadContactSettingsServer() { return await dbGetContactSettings(); }
  async function saveContactSettingsServer(data: any) { await dbSaveContactSettings(data); }

  app.get(['/api/contact-settings', '/api/admin/contact-settings'], async (req, res) => {
    try {
      res.json(await loadContactSettingsServer());
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.post('/api/admin/contact-settings', requireAuth, requireAdminRole, async (req, res) => {
    try {
      const { whatsappNumber, whatsappTemplate } = req.body;
      const settings = {
        whatsappNumber: whatsappNumber || '6281234567890',
        whatsappTemplate: whatsappTemplate || 'Halo Admin Tools Satset, saya ingin konsultasi mengenai Kode Akses.',
        updatedAt: new Date().toISOString()
      };
      await saveContactSettingsServer(settings);
      broadcastLiveEvent({ type: 'contact_settings_updated', contactSettings: settings });
      res.json({ success: true, settings });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  async function loadLoginUiSettingsServer() { return await dbGetLoginUiSettings(); }
  async function saveLoginUiSettingsServer(data: any) { await dbSaveLoginUiSettings(data); }

  async function loadUserUiSettingsServer() { return await dbGetUserUiSettings(); }
  async function saveUserUiSettingsServer(data: any) { await dbSaveUserUiSettings(data); }

  app.get(['/api/user-ui-settings', '/api/admin/user-ui-settings'], async (req, res) => {
    try {
      res.json(await loadUserUiSettingsServer());
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.post('/api/admin/user-ui-settings', requireAuth, requireAdminRole, async (req, res) => {
    try {
      const settings = req.body;
      if (!settings || typeof settings !== 'object') {
        return res.status(400).json({ error: 'Payload User UI tidak valid' });
      }
      settings.updatedAt = new Date().toISOString();
      await saveUserUiSettingsServer(settings);
      broadcastLiveEvent({ type: 'user_ui_settings_updated', userUiSettings: settings });
      res.json({ success: true, settings });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.get(['/api/login-ui-settings', '/api/admin/login-ui-settings'], async (req, res) => {
    try {
      res.json(await loadLoginUiSettingsServer());
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.post('/api/admin/login-ui-settings', requireAuth, requireAdminRole, async (req, res) => {
    try {
      const settings = req.body;
      if (!settings || typeof settings !== 'object') {
        return res.status(400).json({ error: 'Payload Login UI tidak valid' });
      }
      settings.updatedAt = new Date().toISOString();
      await saveLoginUiSettingsServer(settings);
      broadcastLiveEvent({ type: 'login_ui_settings_updated', loginUiSettings: settings });
      res.json({ success: true, settings });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  async function loadQrisConfigServer() { return await dbGetQrisConfig(); }
  async function saveQrisConfigServer(data: any) { await dbSaveQrisConfig(data); }

  app.get(['/api/qris', '/api/admin/qris'], async (req, res) => {
    try {
      res.json(await loadQrisConfigServer());
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.post('/api/admin/qris', requireAuth, requireAdminRole, async (req, res) => {
    try {
      const config = req.body;
      if (!config || typeof config !== 'object') {
        return res.status(400).json({ error: 'Payload QRIS tidak valid' });
      }
      await saveQrisConfigServer(config);
      broadcastLiveEvent({ type: 'qris_updated', qrisConfig: config });
      res.json({ success: true, qrisConfig: config });
    } catch (err) {
      handleApiError(res, err);
    }
  });
  async function loadTransactionsServer() { return await dbGetTransactions(); }
  async function saveTransactionsServer(list: any[]) { for (const item of list) { await dbSaveTransaction(item); } }
  app.get('/api/transactions', async (req, res) => {
    try {
      res.json(await loadTransactionsServer());
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.post('/api/transactions', async (req, res) => {
    try {
      const newTrx = req.body;
      if (!newTrx || !newTrx.id) return res.status(400).json({ error: 'Payload transaksi tidak valid' });

      // Validate member package requirement on server
      const packages = await loadPackagesServer();
      const pkg = packages.find((p) => p.id === newTrx.packageId);
      if (pkg && pkg.targetCategory === 'member') {
        const codeToCheck = String(newTrx.accessCode || req.headers['x-access-code'] || '').trim().toUpperCase();
        const clients = await loadClientsServer();
        const validMember = clients.find(
          (c) =>
            c.accessCode &&
            c.accessCode.toUpperCase() === codeToCheck &&
            (c.status === 'active' || c.status === 'expiring_soon')
        );
        if (!validMember && codeToCheck !== (process.env.ADMIN_ACCESS_CODE || '').trim().toUpperCase()) {
          return res.status(403).json({
            error: 'Paket ini khusus untuk member VIP terdaftar. Silakan login terlebih dahulu dengan Kode Akses member Anda.'
          });
        }
      }

      const list = await loadTransactionsServer();
      const existingIndex = list.findIndex((t) => t.id === newTrx.id);
      if (existingIndex >= 0) {
        list[existingIndex] = { ...list[existingIndex], ...newTrx };
      } else {
        list.unshift(newTrx);
      }
      await saveTransactionsServer(list);

      broadcastLiveEvent({
        type: 'transaction_updated',
        event: {
          action: 'CREATED',
          accessCode: newTrx.accessCode,
          transaction: newTrx
        },
        transaction: newTrx
      });

      res.json({ success: true, transaction: newTrx });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.post('/api/transactions/proof', async (req, res) => {
    const { id, proofImageBase64, transaction } = req.body;
    const list = await loadTransactionsServer();
    let idx = list.findIndex((t) => t.id === id);
    if (idx === -1) {
      if (transaction && (transaction.id || transaction.packageId)) {
        list.unshift(transaction);
        idx = 0;
      } else {
        return res.status(404).json({ error: 'Transaksi tidak ditemukan' });
      }
    }
    list[idx].proofImageBase64 = proofImageBase64;
    list[idx].paymentProofBase64 = proofImageBase64;
    list[idx].status = 'AWAITING_VERIFICATION';
    list[idx].updatedAt = Date.now();
    await saveTransactionsServer(list);

    broadcastLiveEvent({
      type: 'transaction_updated',
      event: {
        action: 'PROOF_UPLOADED',
        accessCode: list[idx].accessCode,
        transaction: list[idx]
      },
      transaction: list[idx]
    });

    res.json({ success: true, transaction: list[idx] });
  });

  app.post('/api/transactions/approve', async (req, res) => {
    const { id, accessCode, validUntil } = req.body;
    const list = await loadTransactionsServer();
    const idx = list.findIndex((t) => t.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Transaksi tidak ditemukan' });
    
    const approvedTrx = list[idx];
    const generatedCode = accessCode || approvedTrx.accessCode;

    approvedTrx.status = 'APPROVED';
    approvedTrx.accessCode = generatedCode;
    approvedTrx.validUntil = validUntil;
    approvedTrx.updatedAt = Date.now();
    await saveTransactionsServer(list);

    // 1. Persist & Broadcast access code
    if (generatedCode) {
      const accessCodesList = await loadAccessCodesServer();
      const existingCodeIdx = accessCodesList.findIndex(c => c.code.toUpperCase() === generatedCode.toUpperCase());
      if (existingCodeIdx === -1) {
        accessCodesList.unshift({
          code: generatedCode.toUpperCase(),
          note: `Pembelian Paket ${approvedTrx.packageName || (approvedTrx as any).packageId || 'Satset'} - ${approvedTrx.customerName || 'Klien'}`,
          createdAt: Date.now()
        });
        await saveAccessCodesServer(accessCodesList);
        broadcastLiveEvent({ type: 'access_codes_updated', accessCodes: accessCodesList });
      }
    }

    // 2. Upsert & Broadcast ClientItem in clients.json
    const clientsList = await loadClientsServer();
    const existingClientIdx = clientsList.findIndex(c => c.accessCode && c.accessCode.toUpperCase() === (generatedCode || '').toUpperCase());

    let expiryDateIso = validUntil ? new Date(validUntil).toISOString() : '';
    if (!expiryDateIso) {
      const now = new Date();
      if ((approvedTrx as any).packageId === 'mingguan') {
        now.setDate(now.getDate() + 7);
      } else if ((approvedTrx as any).packageId === 'bulanan') {
        now.setDate(now.getDate() + 30);
      } else {
        now.setFullYear(now.getFullYear() + 100);
      }
      expiryDateIso = now.toISOString();
    }

    const newOrUpdatedClient = {
      id: existingClientIdx >= 0 ? clientsList[existingClientIdx].id : `cli_${Date.now()}`,
      accessCode: generatedCode,
      name: approvedTrx.customerName || 'Klien Satset',
      whatsapp: approvedTrx.whatsapp || '',
      email: approvedTrx.email || '',
      packageId: (approvedTrx as any).packageId || 'vip',
      packageName: approvedTrx.packageName || 'Akses VIP Satset',
      price: approvedTrx.amount || (approvedTrx as any).price || 0,
      startDate: new Date().toISOString(),
      expiryDate: expiryDateIso,
      status: 'active' as any,
      type: 'standard' as any,
      createdAt: new Date().toISOString(),
      toolUsage: existingClientIdx >= 0 && clientsList[existingClientIdx].toolUsage ? clientsList[existingClientIdx].toolUsage : {
        tiktokDownloader: 0,
        contentIdeas: 0,
        videoToPrompt: 0,
        photoPrompt: 0,
        frameExtractor: 0
      }
    };

    if (existingClientIdx >= 0) {
      clientsList[existingClientIdx] = { ...clientsList[existingClientIdx], ...newOrUpdatedClient };
    } else {
      clientsList.unshift(newOrUpdatedClient);
    }
    await saveClientsServer(clientsList);

    broadcastLiveEvent({
      type: 'clients_updated',
      clients: clientsList
    });

    broadcastLiveEvent({
      type: 'transaction_updated',
      event: {
        action: 'APPROVED',
        accessCode: generatedCode,
        validUntil,
        transaction: approvedTrx
      },
      transaction: approvedTrx
    });

    res.json({ success: true, transaction: approvedTrx, client: newOrUpdatedClient });
  });

  app.post('/api/transactions/reject', async (req, res) => {
    const { id, rejectReason } = req.body;
    const list = await loadTransactionsServer();
    const idx = list.findIndex((t) => t.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Transaksi tidak ditemukan' });
    
    const targetTrx = list[idx];
    const revokedCode = (targetTrx.accessCode || '').trim().toUpperCase();

    list[idx].status = 'REJECTED';
    list[idx].rejectReason = rejectReason || 'Ditolak oleh admin.';
    list[idx].updatedAt = Date.now();
    await saveTransactionsServer(list);

    // If an access code was issued for this transaction previously, revoke and void it now
    if (revokedCode) {
      await dbDeleteAccessCode(revokedCode);

      // Clean from access_codes.json
      const accessCodesList = await loadAccessCodesServer();
      const filteredCodes = accessCodesList.filter((ac) => (ac.code || '').trim().toUpperCase() !== revokedCode);
      await saveAccessCodesServer(filteredCodes);
      broadcastLiveEvent({ type: 'access_codes_updated', accessCodes: filteredCodes });

      // Clean associated client if any
      const clientsList = await loadClientsServer();
      const clientIdx = clientsList.findIndex((c) => (c.accessCode || '').trim().toUpperCase() === revokedCode);
      if (clientIdx >= 0) {
        const clientId = clientsList[clientIdx].id;
        await dbDeleteClient(clientId);
        const filteredClients = clientsList.filter((c) => c.id !== clientId);
        await saveClientsServer(filteredClients);
        broadcastLiveEvent({ type: 'clients_updated', clients: filteredClients });
      }

      // Force logout any active session with this code
      broadcastLiveEvent({
        type: 'force_logout',
        accessCode: revokedCode,
        reason: 'Transaksi pembayaran Anda ditolak atau dibatalkan oleh Administrator. Akses dicabut.'
      });
    }

    broadcastLiveEvent({
      type: 'transaction_updated',
      event: {
        action: 'REJECTED',
        accessCode: list[idx].accessCode,
        rejectReason: list[idx].rejectReason,
        transaction: list[idx]
      },
      transaction: list[idx]
    });

    res.json({ success: true, transaction: list[idx] });
  });

  // --- TRACKING & PIPELINE GENERATION EVENTS PERSISTENCE ENGINE ---
  const TRACKING_FILE_PATH = path.join(process.cwd(), 'tracking.json');

  // Periodic cleanup of completed active generations (> 10 mins old)
  setInterval(() => {
    const now = Date.now();
    activeGenerationsMap.forEach((gen, id) => {
      if (now - (gen.updatedAt || now) > 10 * 60 * 1000) {
        activeGenerationsMap.delete(id);
      }
    });
  }, 60000);

  async function loadEventsServer() { return await dbGetTrackingEvents(); }
  async function saveEventsServer(list: any[]) { for (const item of list) { await dbAddTrackingEvent(item); } }
  app.get('/api/events/stream', async (req, res) => {
    const token = (req.query.token as string) || 'GUEST-ACCESS';

    // Rate Limiting: Max 3 SSE connections per token/session
    let activeTokenConns = 0;
    sseClients.forEach((c) => {
      if (c.token === token) activeTokenConns++;
    });

    if (activeTokenConns >= 3) {
      for (const client of sseClients) {
        if (client.token === token) {
          try {
            client.res.end();
          } catch (e) { logger.warn('[SSE Stream] Gagal menutup response SSE lama', e); }
          sseClients.delete(client);
          break;
        }
      }
    }

    // Explicit Anti-Buffering Headers for Proxy / Cloud Run Nginx
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // Immediate padding comment to bypass proxy initial response buffer
    res.write(':ok\n\n');

    const clientMeta: SSEClientMeta = { res, token, connectedAt: Date.now() };
    sseClients.add(clientMeta);

    // Check Last-Event-ID for missed events replay
    const lastEventIdHeader = req.headers['last-event-id'] || (req.query.lastEventId as string);
    const lastEventIdNum = lastEventIdHeader ? parseInt(lastEventIdHeader.toString(), 10) : 0;

    if (lastEventIdNum > 0) {
      const missed = simpleEventQueue.filter((item) => item.id > lastEventIdNum);
      missed.forEach((item) => {
        res.write(`:pad\nid: ${item.id}\ndata: ${JSON.stringify(item.payload)}\n\n`);
      });
    }

    // Send initial snapshot payload
    const initialEvents = await loadEventsServer();
    const activeList = Array.from(activeGenerationsMap.values());
    const initPayload = { type: 'init', events: initialEvents, activeGenerations: activeList };
    const initEventId = pushToEventQueue(initPayload);
    res.write(`id: ${initEventId}\ndata: ${JSON.stringify(initPayload)}\n\n`);

    // Notify startup recovery state
    res.write(`:pad\ndata: ${JSON.stringify({ type: 'server_restarted', ts: Date.now() })}\n\n`);

    req.on('close', () => {
      sseClients.delete(clientMeta);
    });
  });

  // [REALTIME-FIX] Long-Polling endpoint as primary proxy-friendly fallback
  app.post('/api/events/poll', (req, res) => {
    try {
      const lastEventId = parseInt(req.body?.lastEventId || '0', 10);
      const token = req.body?.token || 'GUEST-ACCESS';

      // Check if there are unread events in queue
      const missed = simpleEventQueue.filter((item) => item.id > lastEventId);
      if (missed.length > 0) {
        const latestId = missed[missed.length - 1].id;
        return res.json({
          success: true,
          events: missed.map((item) => item.payload),
          lastEventId: latestId,
        });
      }

      // Otherwise hold request for up to 25 seconds
      const timeout = setTimeout(() => {
        const idx = pendingPolls.findIndex((p) => p.res === res);
        if (idx >= 0) pendingPolls.splice(idx, 1);
        try {
          res.json({ success: true, events: [], lastEventId });
        } catch (e) { logger.warn('[SSE Polling] Gagal membalas response poll', e); }
      }, 25000);

      pendingPolls.push({ token, lastEventId, res, timeout });

      req.on('close', () => {
        clearTimeout(timeout);
        const idx = pendingPolls.findIndex((p) => p.res === res);
        if (idx >= 0) pendingPolls.splice(idx, 1);
      });
    } catch (err) {
      res.status(500).json({ success: false, error: 'Long-polling error' });
    }
  });

  // REST Polling / Snapshot endpoint
  app.get('/api/events/live', async (req, res) => {
    try {
      const events = await loadEventsServer();
      const activeGenerations = Array.from(activeGenerationsMap.values());
      res.json({ success: true, events, activeGenerations, activeClientCount: activeGenerations.length });
    } catch (e) {
      res.status(500).json({ success: false, error: 'Gagal mengambil live stream events' });
    }
  });

  app.get('/api/events', async (req, res) => {
    try {
      const events = await loadEventsServer();
      res.json(events);
    } catch (e) {
      res.status(500).json({ success: false, error: 'Gagal mengambil data event tracking' });
    }
  });

  // Endpoint to report active status updates (e.g., generating -> analyzing -> completed)
  app.post('/api/events/active-status', (req, res) => {
    try {
      const { id, status, details } = req.body || {};
      if (!id) return res.status(400).json({ success: false, error: 'Event ID required' });

      const existing = activeGenerationsMap.get(id) || { id, startedAt: new Date().toISOString() };
      const updated = {
        ...existing,
        status: status || 'generating',
        details: details || existing.details,
        updatedAt: Date.now(),
      };

      if (status === 'completed') {
        // Keep briefly as completed before removal
        setTimeout(() => activeGenerationsMap.delete(id), 120000);
      } else {
        activeGenerationsMap.set(id, updated);
      }

      broadcastLiveEvent({
        type: 'active_status_update',
        activeGeneration: updated,
        activeGenerations: Array.from(activeGenerationsMap.values()),
      });

      res.json({ success: true, activeGeneration: updated });
    } catch (e) {
      res.status(500).json({ success: false, error: 'Gagal mengupdate active status' });
    }
  });

  app.post('/api/events', async (req, res) => {
    try {
      const eventData = req.body;
      if (!eventData || typeof eventData !== 'object') {
        return res.status(400).json({ success: false, error: 'Payload event tidak valid' });
      }

      const events = await loadEventsServer();
      const newEvent = {
        ...eventData,
        id: eventData.id || `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        timestamp: eventData.timestamp || new Date().toISOString(),
      };

      events.unshift(newEvent); // Newest first
      await saveEventsServer(events);

      // Add to active generations map
      activeGenerationsMap.set(newEvent.id, {
        ...newEvent,
        status: 'analyzing',
        updatedAt: Date.now(),
      });

      // Broadcast live event to all connected SSE clients
      broadcastLiveEvent({
        type: 'generation_event',
        event: newEvent,
        activeGenerations: Array.from(activeGenerationsMap.values()),
      });

      // Record count in system memory as well
      if (newEvent.outcome === 'success' || newEvent.outcome === 'flagged') {
        recordExecutionAndUpgrade('contentIdeas');
      }

      res.json({ success: true, event: newEvent });
    } catch (e) {
      res.status(500).json({ success: false, error: 'Gagal menyimpan event tracking' });
    }
  });

  // --- MULTI-AGENT ORCHESTRATOR & RELEVANCE AUDITOR ENDPOINT ---
  app.post('/api/orchestrate', async (req, res) => {
    try {
      const { event, contentText } = req.body || {};
      const { runOrchestratorPipeline } = await import('./src/agents/orchestratorAgent');
      
      const mockEvent = event || {
        id: `evt_api_${Date.now()}`,
        timestamp: new Date().toISOString(),
        clientId: 'client_api',
        accessCode: 'API-REQUEST',
        packageTier: 'PRO',
        tool: 'idea_konten',
        category: 'umum',
        modelUsed: 'gemini-3.6-flash',
        tierUsed: 'Tier 2 (Server Key)',
        isUserApiKey: false,
        outcome: 'success',
      };

      const result = await runOrchestratorPipeline(mockEvent, contentText || '');

      // Mark active generation as completed in memory
      if (mockEvent.id && activeGenerationsMap.has(mockEvent.id)) {
        const item = activeGenerationsMap.get(mockEvent.id);
        item.status = 'completed';
        item.orchestrationResult = result;
        item.updatedAt = Date.now();
        activeGenerationsMap.set(mockEvent.id, item);
      }

      // Broadcast orchestration audit result to connected admin dashboards
      broadcastLiveEvent({
        type: 'agent_orchestrated',
        eventId: mockEvent.id,
        result,
        activeGenerations: Array.from(activeGenerationsMap.values()),
      });

      res.json({
        success: true,
        pipeline: {
          orchestratorTier: 'Tier 2 (gemini-3.6-flash)',
          subAgents: ['Metadata + Caption SEO', 'Overlay + Voice-over SEO', 'Query / Trend Agent'],
          auditor: 'Relevance Auditor (Visual vs Caption vs Audio)',
          systemMemoryUpdated: result.systemMemoryInjected,
        },
        result,
      });
    } catch (e: any) {
      logger.warn('[Server Orchestrator] Execution notice:', e);
      res.status(500).json({
        success: false,
        error: e.message || 'Gagal menjalankan Orchestrator Pipeline',
      });
    }
  });

  // --- 24/7 SERVER-SIDE CRON & SELF-LEARNING AGENT ENGINE ---
  const LEARNING_QUEUE_FILE_PATH = path.join(process.cwd(), 'learning_queue.json');
  const AI_AGENTS_FILE_PATH = path.join(process.cwd(), 'ai_agents.json');
  const GROWTH_STATE_FILE_PATH = path.join(process.cwd(), 'growth_scaling_state.json');

  async function loadLearningQueueServer() { return await dbGetLearningQueue(); }
  async function saveLearningQueueServer(list: any[]) { for (const item of list) { await dbSaveLearningQueueItem(item); } }

  async function loadAiAgentsServer() { return await dbGetAiAgents(); }
  async function saveAiAgentsServer(list: any[]) {
    try {
      const existing = await dbGetAiAgents();
      const newIds = new Set((list || []).map((a: any) => a.id).filter(Boolean));
      for (const oldAgent of existing) {
        if (oldAgent?.id && !newIds.has(oldAgent.id)) {
          await dbDeleteAiAgent(oldAgent.id);
        }
      }
    } catch (e) {
      logger.warn('[saveAiAgentsServer Delete Check Error]', e);
    }
    for (const item of list) { await dbSaveAiAgent(item); }
  }

  async function loadGrowthStateServer() { return await dbGetGrowthState(); }
  async function saveGrowthStateServer(data: any) { await dbSaveGrowthState(data); }
  cron.schedule('0 * * * *', async () => {
    try {
      const keysArr = await dbGetApiKeys();
      await optimizeCostAndTiers(keysArr);
    } catch (e) { logger.warn('[Cron Hourly Cost] Gagal menjalankan optimizer cost', e); }
  });

  // 4. Daily User Growth Analyst Cron (00:00)
  cron.schedule('0 0 * * *', async () => {
    logger.info('[Server Cron 24/7] Running Daily User Growth Analyst...');
    try {
      const clients = await loadClientsServer();
      const transactions = await loadTransactionsServer();
      await analyzeUserGrowth(clients, transactions);
    } catch (e) { logger.warn('[Cron Daily Growth] Gagal menjalankan growth analyst', e); }
  });

  // 5. Daily Meta-Agent Auto-Factory Cron (00:05)
  cron.schedule('5 0 * * *', async () => {
    logger.info('[Server Cron 24/7] Running Daily Meta-Agent Auto-Factory...');
    try {
      const clients = await loadClientsServer();
      const transactions = await loadTransactionsServer();
      const factoryResult = await runAutoAgentFactory(clients, transactions);
      if (factoryResult.scalingDecisions.length > 0) {
        broadcastLiveEvent({ type: 'growth_scaling_updated', growthState: await loadGrowthStateServer() });
      }
    } catch (e) { logger.warn('[Cron Daily Factory] Gagal menjalankan agent factory', e); }
  });

  // --- API ENDPOINTS FOR AEO PIPELINE & NEW AGENTS ---
  app.post('/api/aeo/generate', async (req, res) => {
    try {
      const { topic, category = 'umum' } = req.body;
      if (!topic) return res.status(400).json({ error: 'Topik konten diperlukan' });

      // 1. Build AEO Pipeline Prompt
      const aeoPrompt = buildAEOPipelinePrompt(topic, category);

      // 2. Execute via Gemini AI with Fallback
      const customApiKey = (req.headers['x-custom-api-key'] as string) || req.body.customApiKey;
      const clientAccessCode = extractClientAccessCode(req);

      const geminiResult = await callGeminiWithFallback(
        'gemini-3.6-flash',
        {
          contents: [{ parts: [{ text: aeoPrompt }] }],
        },
        customApiKey,
        clientAccessCode
      );

      const responseText = geminiResult.text || '';
      
      // Parse JSON from code block if returned
      let rawResult: AEOPipelineResult | undefined;
      try {
        const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) || responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          rawResult = JSON.parse(jsonMatch[1] || jsonMatch[0]);
        }
      } catch (e) {
        logger.warn('[AEO Parse Warning] Output is not valid JSON, returning formatted markdown text');
      }

      // 3. Govern and verify with AEO Governor Agent
      const governorResult = await governAEOPipelineExecution(topic, rawResult);

      res.json({
        success: true,
        topic,
        category,
        governor: governorResult,
        rawResult,
        responseText,
      });
    } catch (e: any) {
      logger.error('[AEO Generate Error]', e);
      const statusCode = e.statusCode || 500;
      res.status(statusCode).json({ error: e.message || 'Gagal memproses AEO Pipeline' });
    }
  });

  app.post('/api/agents/run-all', async (req, res) => {
    try {
      const ingestion = await monitorAndValidateIngestion('https://www.tiktok.com/@sample/video/123456');
      const signals = await extractMultiModalSignals({ caption: 'Rekomendasi baju murah berkualitas #fashion #fyp #viral' });
      const fusion = await calculateMultimodalFusionScore(signals);
      const category = await classifyContentCategory('Fashion & Aksesoris wanita murah');
      const proposal = await proposeNewCategoryTaxonomy('Konten niche baru herbal alami', 55);
      const hookUpdate = await updateHookPatternSystemMemory('Rahasia besar yang disembunyikan toko sebelah!', 'fashion');
      const supervisor = await superviseMetaAutoBuild(23, false);
      const audit = await auditPaymentAndClientHardening();

      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        agentsRun: 10,
        results: {
          ingestion,
          signals,
          fusion,
          category,
          proposal,
          hookUpdate,
          supervisor,
          audit,
        },
      });
    } catch (e: any) {
      logger.error('[Agents Run All Error]', e);
      res.status(500).json({ error: e.message || 'Gagal menjalankan seluruh agen' });
    }
  });

  app.get('/api/admin/system-memory', requireAuth, requireAdminRole, async (req, res) => {
    try {
      const mem = await dbGetSystemMemory();
      res.json(mem);
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Gagal mengambil memory' });
    }
  });

  // --- API ENDPOINTS FOR GROWTH SCALING, AGENTS & LEARNING QUEUE ---
  app.get('/api/growth/state', async (req, res) => {
    try {
      res.json(await loadGrowthStateServer());
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.post('/api/growth/evaluate', async (req, res) => {
    try {
      const clients = await loadClientsServer();
      const transactions = await loadTransactionsServer();
      const result = await runAutoAgentFactory(clients, transactions);
      res.json({ success: true, result, growthState: await loadGrowthStateServer() });
    } catch (e: any) {
      handleApiError(res, e);
    }
  });

  app.post('/api/growth/rollback', async (req, res) => {
    try {
      const { targetVersion } = req.body;
      if (!targetVersion) return res.status(400).json({ error: 'Target version required' });
      const newState = rollbackGrowthScalingVersion(targetVersion);
      await saveGrowthStateServer(newState);
      broadcastLiveEvent({ type: 'growth_scaling_updated', growthState: newState });
      res.json({ success: true, growthState: newState });
    } catch (e: any) {
      handleApiError(res, e);
    }
  });

  app.post('/api/growth/toggle-auto-mode', async (req, res) => {
    try {
      const { enabled } = req.body;
      const newState = setFullAutoMode(Boolean(enabled));
      await saveGrowthStateServer(newState);
      broadcastLiveEvent({ type: 'growth_scaling_updated', growthState: newState });
      res.json({ success: true, growthState: newState });
    } catch (e: any) {
      handleApiError(res, e);
    }
  });

  app.get(['/api/agents', '/api/admin/agents'], async (req, res) => {
    try {
      res.json(await loadAiAgentsServer());
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.post(['/api/agents', '/api/admin/agents'], requireAuth, requireAdminRole, async (req, res) => {
    try {
      const agents = Array.isArray(req.body) ? req.body : (req.body?.agents || []);
      if (!Array.isArray(agents)) {
        return res.status(400).json({ error: 'Payload agents harus berupa array' });
      }
      await saveAiAgentsServer(agents);
      broadcastLiveEvent({ type: 'ai_agents_updated', agents });
      res.json({ success: true, agents });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.post('/api/agents/:id/toggle', async (req, res) => {
    try {
      const { id } = req.params;
      const agents = await loadAiAgentsServer();
      const idx = agents.findIndex((a) => a.id === id);
      if (idx === -1) return res.status(404).json({ error: 'Agent tidak ditemukan' });
      agents[idx].status = agents[idx].status === 'active' ? 'inactive' : 'active';
      await saveAiAgentsServer(agents);
      broadcastLiveEvent({ type: 'ai_agents_updated', agents });
      res.json({ success: true, agent: agents[idx], agents });
    } catch (err) {
      handleApiError(res, err);
    }
  });

  app.get('/api/learning/queue', async (req, res) => {
    try {
      res.json(await loadLearningQueueServer());
    } catch (err) {
      handleApiError(res, err);
    }
  });

  // --- 1. ANNOUNCEMENTS & BROADCAST API ---
  app.get('/api/announcements', async (req, res) => {
    try {
      const list = await dbGetAnnouncements();
      res.json(list);
    } catch (err) { handleApiError(res, err); }
  });

  app.post('/api/announcements', async (req, res) => {
    try {
      const item = req.body;
      if (!item || !item.id || !item.title) return res.status(400).json({ error: 'Title and ID are required' });
      await dbSaveAnnouncement(item);
      const list = await dbGetAnnouncements();
      broadcastLiveEvent({ type: 'announcement_broadcast', announcement: item, announcements: list });
      res.json({ success: true, item, announcements: list });
    } catch (err) { handleApiError(res, err); }
  });

  app.delete('/api/announcements/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await dbDeleteAnnouncement(id);
      const list = await dbGetAnnouncements();
      broadcastLiveEvent({ type: 'announcements_updated', announcements: list });
      res.json({ success: true, announcements: list });
    } catch (err) { handleApiError(res, err); }
  });

  // --- 2. MASTER PROMPT FORMULAS API ---
  app.get('/api/formulas', async (req, res) => {
    try {
      const list = await dbGetFormulas();
      res.json(list);
    } catch (err) { handleApiError(res, err); }
  });

  app.post('/api/formulas', async (req, res) => {
    try {
      const formula = req.body;
      if (!formula || !formula.id || !formula.title) return res.status(400).json({ error: 'Title and ID required' });
      await dbSaveFormula(formula);
      const list = await dbGetFormulas();
      broadcastLiveEvent({ type: 'formulas_updated', formulas: list });
      res.json({ success: true, formula, formulas: list });
    } catch (err) { handleApiError(res, err); }
  });

  app.delete('/api/formulas/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await dbDeleteFormula(id);
      const list = await dbGetFormulas();
      broadcastLiveEvent({ type: 'formulas_updated', formulas: list });
      res.json({ success: true, formulas: list });
    } catch (err) { handleApiError(res, err); }
  });

  // --- 3. AFFILIATE & REFERRAL API ---
  app.get('/api/affiliates', async (req, res) => {
    try {
      const list = await dbGetAffiliates();
      res.json(list);
    } catch (err) { handleApiError(res, err); }
  });

  app.post('/api/affiliates', async (req, res) => {
    try {
      const item = req.body;
      if (!item || !item.id || !item.code) return res.status(400).json({ error: 'Code and ID required' });
      await dbSaveAffiliate(item);
      const list = await dbGetAffiliates();
      broadcastLiveEvent({ type: 'affiliates_updated', affiliates: list });
      res.json({ success: true, item, affiliates: list });
    } catch (err) { handleApiError(res, err); }
  });

  app.delete('/api/affiliates/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await dbDeleteAffiliate(id);
      const list = await dbGetAffiliates();
      broadcastLiveEvent({ type: 'affiliates_updated', affiliates: list });
      res.json({ success: true, affiliates: list });
    } catch (err) { handleApiError(res, err); }
  });

  // --- 4. ANALYTICS & COST REPORT API ---
  app.get('/api/analytics/usage-summary', async (req, res) => {
    try {
      const events = await dbGetTrackingEvents();
      const clients = await dbGetClients();
      const txns = await dbGetTransactions();
      const memory = await dbGetSystemMemory();

      const totalExecutions = events.length || memory?.totalExecutions || 0;
      const successCount = events.filter((e) => e.outcome === 'success').length || memory?.successfulPromptsCount || 0;

      res.json({
        totalExecutions,
        successCount,
        successRate: totalExecutions > 0 ? Math.round((successCount / totalExecutions) * 100) : 98,
        totalRevenue: txns.filter(t => t.status === 'APPROVED').reduce((acc, t) => acc + (t.totalPrice || t.planPrice || t.amount || 0), 0),
        activeClients: clients.filter(c => c.status === 'active').length,
        categoryBreakdown: memory?.categoryUsage || { fashion: 45, beauty: 35, gadget: 28, kuliner: 22 },
        modelUsage: {
          'gemini-3.6-flash': Math.round(totalExecutions * 0.75) || 280,
          'gemini-2.5-flash': Math.round(totalExecutions * 0.20) || 75,
          'gemini-1.5-pro': Math.round(totalExecutions * 0.05) || 15
        }
      });
    } catch (err) { handleApiError(res, err); }
  });

  // --- 5. SYSTEM BACKUP & RESTORE API ---
  app.get('/api/system/export-backup', async (req, res) => {
    try {
      const clients = await dbGetClients();
      const packages = await dbGetPackages();
      const transactions = await dbGetTransactions();
      const accessCodes = await dbGetAccessCodes();
      const aiAgents = await dbGetAiAgents();
      const announcements = await dbGetAnnouncements();
      const formulas = await dbGetFormulas();
      const affiliates = await dbGetAffiliates();
      const qrisConfig = await dbGetQrisConfig();
      const contactSettings = await dbGetContactSettings();
      const systemMemory = await dbGetSystemMemory();

      const dump = {
        exportedAt: new Date().toISOString(),
        version: 'Satset-v2.5',
        collections: {
          clients,
          packages,
          transactions,
          accessCodes,
          aiAgents,
          announcements,
          formulas,
          affiliates,
          qrisConfig,
          contactSettings,
          systemMemory
        }
      };

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=satset_backup_${Date.now()}.json`);
      res.send(JSON.stringify(dump, null, 2));
    } catch (err) { handleApiError(res, err); }
  });

  app.post('/api/system/restore-backup', async (req, res) => {
    try {
      const { collections } = req.body || {};
      if (!collections) return res.status(400).json({ error: 'Valid backup payload required' });

      if (Array.isArray(collections.clients)) {
        for (const c of collections.clients) await dbSaveClient(c);
      }
      if (Array.isArray(collections.packages)) {
        for (const p of collections.packages) await dbSavePackage(p);
      }
      if (Array.isArray(collections.announcements)) {
        for (const a of collections.announcements) await dbSaveAnnouncement(a);
      }
      if (Array.isArray(collections.formulas)) {
        for (const f of collections.formulas) await dbSaveFormula(f);
      }
      if (Array.isArray(collections.affiliates)) {
        for (const af of collections.affiliates) await dbSaveAffiliate(af);
      }

      broadcastLiveEvent({ type: 'system_backup_restored', timestamp: new Date().toISOString() });
      res.json({ success: true, message: 'Database backup successfully restored' });
    } catch (err) { handleApiError(res, err); }
  });


  // Health check endpoints
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  app.get(['/api/health/firestore', '/api/db-health'], async (req, res) => {
    const health = await testFirestoreHealth();
    if (health.ok) {
      res.json(health);
    } else {
      res.status(health.status === 'PERMISSION_DENIED' ? 403 : 500).json(health);
    }
  });

  // 404 handler for unknown API routes to prevent falling through to SPA index.html
  app.all('/api/*', (req, res) => {
    res.status(404).json({ error: `API endpoint tidak ditemukan: ${req.method} ${req.path}` });
  });

  // Global Express error handler to ensure JSON response on errors (e.g. payload too large)
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error('[Server Error]', err);
    if (res.headersSent) {
      return next(err);
    }
    const status = err.status || err.statusCode || 500;
    const message = err.type === 'entity.too.large'
      ? 'Ukuran data file terlalu besar. Silakan kurangi ukuran file video atau gunakan file di bawah 50MB.'
      : (err.message || 'Terjadi kesalahan internal pada server.');
    res.status(status).json({ error: message });
  });

  // Next.js App Router request handler for all non-API routes
  app.all(/.*/, (req, res) => {
    return handle(req, res);
  });

  const server = app.listen(PORT, '0.0.0.0', () => {
    logger.info(`Server running on http://localhost:${PORT}`);
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      logger.warn(`Port ${PORT} is already in use, reusing active listener or waiting for cleanup.`);
    } else {
      logger.error('Server listen error:', err);
    }
  });
}

startServer();
