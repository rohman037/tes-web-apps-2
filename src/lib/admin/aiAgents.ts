export interface AiAgentItem {
  id: string;
  name: string;
  role: string;
  model: string;
  status: 'active' | 'inactive';
  callsCount: number;
  lastUsed?: string;
  approvedPatternsCount: number;
  rejectedPatternsCount: number;
}

const LOCAL_STORAGE_AI_AGENTS_KEY = 'satset_ai_agents_data';

export const DEFAULT_AI_AGENTS: AiAgentItem[] = [
  {
    id: 'agent_hook_analyzer',
    name: 'Agent Analisis Hook FYP',
    role: 'Mengekstrak gaya hook pembuka & pola viral dari submission video',
    model: 'gemini-3.1-pro-preview',
    status: 'active',
    callsCount: 142,
    lastUsed: new Date(Date.now() - 3600000 * 3).toISOString(),
    approvedPatternsCount: 38,
    rejectedPatternsCount: 2
  },
  {
    id: 'agent_content_idea',
    name: 'Agent Ide Konten & Angle',
    role: 'Menganalisis formula angle ide konten dari performa tinggi',
    model: 'gemini-3.1-pro-preview',
    status: 'active',
    callsCount: 98,
    lastUsed: new Date(Date.now() - 3600000 * 5).toISOString(),
    approvedPatternsCount: 24,
    rejectedPatternsCount: 1
  },
  {
    id: 'agent_caption_pacing',
    name: 'Agent Caption & Pacing Segmen',
    role: 'Mengekstrak pacing visual & ritme transisi teks/audio',
    model: 'gemini-3.6-flash',
    status: 'active',
    callsCount: 76,
    lastUsed: new Date(Date.now() - 3600000 * 12).toISOString(),
    approvedPatternsCount: 19,
    rejectedPatternsCount: 0
  },
  {
    id: 'agent_motion_camera_analyzer',
    name: 'Agent Analisis Gerakan Kamera & Framing',
    role: 'Mengekstrak jenis shot (close-up/wide/tracking), gerakan kamera, dan komposisi framing',
    model: 'gemini-3.6-flash',
    status: 'active',
    callsCount: 45,
    lastUsed: new Date(Date.now() - 3600000 * 2).toISOString(),
    approvedPatternsCount: 12,
    rejectedPatternsCount: 0
  },
  {
    id: 'agent_transition_editing_style',
    name: 'Agent Gaya Transisi & Editing',
    role: 'Mengidentifikasi pola cut/transisi (jump cut, match cut), tempo editing, & parameter pacing',
    model: 'gemini-3.6-flash',
    status: 'active',
    callsCount: 38,
    lastUsed: new Date(Date.now() - 3600000 * 4).toISOString(),
    approvedPatternsCount: 10,
    rejectedPatternsCount: 1
  },
  {
    id: 'agent_compliance_brand_safety',
    name: 'Agent Kepatuhan & Keamanan Merek',
    role: 'Audit klaim di konten (khususnya herbal_kesehatan & makanan) terhadap klaim berlebihan',
    model: 'gemini-3.1-pro',
    status: 'active',
    callsCount: 62,
    lastUsed: new Date(Date.now() - 3600000 * 1).toISOString(),
    approvedPatternsCount: 15,
    rejectedPatternsCount: 3
  },
  {
    id: 'agent_multi_platform_adapter',
    name: 'Agent Adaptasi Multi-Platform',
    role: 'Adaptasi spesifikasi output prompt untuk TikTok (9:16), Reels (9:16 <=90s), Shorts (9:16 <=60s)',
    model: 'gemini-3.6-flash',
    status: 'active',
    callsCount: 84,
    lastUsed: new Date(Date.now() - 3600000 * 6).toISOString(),
    approvedPatternsCount: 22,
    rejectedPatternsCount: 0
  },
  {
    id: 'agent_viral_gap_benchmark',
    name: 'Agent Analisis Kesenjangan Viral (Benchmark Kompetitor)',
    role: 'Membandingkan pola hook/caption/pacing dengan top-performing di System Memory',
    model: 'gemini-3.1-pro-preview',
    status: 'active',
    callsCount: 51,
    lastUsed: new Date(Date.now() - 3600000 * 3).toISOString(),
    approvedPatternsCount: 14,
    rejectedPatternsCount: 1
  },
  {
    id: 'agent_prompt_quality_selfcritic',
    name: 'Agent Self-Critique Kualitas Prompt Akhir',
    role: 'Evaluasi kejelasan instruksi, konsistensi visual, & regenerasi jika skor < 80',
    model: 'gemini-3.6-flash',
    status: 'active',
    callsCount: 92,
    lastUsed: new Date(Date.now() - 3600000 * 1).toISOString(),
    approvedPatternsCount: 28,
    rejectedPatternsCount: 2
  },
  {
    id: 'agent_user_growth_analyst',
    name: 'Agent Analisis Pertumbuhan & Perilaku User',
    role: 'Menghitung metrik pertumbuhan, user aktif, & ringkasan insight narasi harian',
    model: 'gemini-3.1-flash-lite',
    status: 'active',
    callsCount: 24,
    lastUsed: new Date(Date.now() - 3600000 * 8).toISOString(),
    approvedPatternsCount: 8,
    rejectedPatternsCount: 0
  },
  {
    id: 'agent_cost_tier_optimizer',
    name: 'Agent Optimasi Biaya & Tier Model',
    role: 'Memantau kuota harian API keys & beban tier model per jam',
    model: 'gemini-3.1-flash-lite',
    status: 'active',
    callsCount: 48,
    lastUsed: new Date(Date.now() - 3600000 * 1).toISOString(),
    approvedPatternsCount: 12,
    rejectedPatternsCount: 0
  },
  {
    id: 'agent_abuse_anomaly_detector',
    name: 'Agent Deteksi Anomali & Penyalahgunaan',
    role: 'Memantau request tak wajar, burst rate, & spam access code per 15 menit',
    model: 'gemini-3.6-flash',
    status: 'active',
    callsCount: 96,
    lastUsed: new Date(Date.now() - 3600000 * 1).toISOString(),
    approvedPatternsCount: 20,
    rejectedPatternsCount: 0
  },
  {
    id: 'agent_auto_agent_factory',
    name: 'Meta-Agent: Pabrik Auto-Pembuat Agent & Parameter Baru',
    role: 'Menevaluasi ambang batas pertumbuhan & mengaktifkan/menaikkan tier agent otomatis',
    model: 'gemini-3.1-pro-preview',
    status: 'active',
    callsCount: 24,
    lastUsed: new Date(Date.now() - 3600000 * 12).toISOString(),
    approvedPatternsCount: 6,
    rejectedPatternsCount: 0
  },
  {
    id: 'agent_ingestion_monitor',
    name: 'Agent Monitor Ingestion & URL Fetcher',
    role: 'Memantau URL/submission baru, memvalidasi jangkauan domain & mengekstrak konten dasar',
    model: 'gemini-3.1-flash-lite',
    status: 'active',
    callsCount: 32,
    lastUsed: new Date(Date.now() - 3600000 * 2).toISOString(),
    approvedPatternsCount: 10,
    rejectedPatternsCount: 0,
  },
  {
    id: 'agent_signal_extractor',
    name: 'Agent Ekstraksi Sinyal Multi-Modal',
    role: 'Ekstraksi sinyal visual, transkrip audio, caption, dan hashtag dari video sumber',
    model: 'gemini-3.6-flash',
    status: 'active',
    callsCount: 64,
    lastUsed: new Date(Date.now() - 3600000 * 1).toISOString(),
    approvedPatternsCount: 18,
    rejectedPatternsCount: 1,
  },
  {
    id: 'agent_multimodal_fusion',
    name: 'Agent Penggabungan Sinyal & Multimodal Fusion Classifier',
    role: 'Menghitung skor gabungan (fused confidence score) dari sinyal visual, caption, & audio',
    model: 'gemini-3.1-pro',
    status: 'active',
    callsCount: 41,
    lastUsed: new Date(Date.now() - 3600000 * 4).toISOString(),
    approvedPatternsCount: 12,
    rejectedPatternsCount: 0,
  },
  {
    id: 'agent_category_classifier',
    name: 'Agent Klasifikasi Taksonomi Kategori Dinamis',
    role: 'Mengklasifikasikan konten ke taksonomi Postgres dinamis & menandai tinjauan manual jika rentan',
    model: 'gemini-3.1-pro',
    status: 'active',
    callsCount: 88,
    lastUsed: new Date(Date.now() - 3600000 * 2).toISOString(),
    approvedPatternsCount: 26,
    rejectedPatternsCount: 2,
  },
  {
    id: 'agent_taxonomy_proposer',
    name: 'Agent Pengusul Taksonomi Kategori Baru',
    role: 'Mengidentifikasi tren kategori/subkategori baru & mengajukan proposal ke tabel peninjauan admin',
    model: 'gemini-3.1-pro',
    status: 'active',
    callsCount: 29,
    lastUsed: new Date(Date.now() - 3600000 * 6).toISOString(),
    approvedPatternsCount: 8,
    rejectedPatternsCount: 1,
  },
  {
    id: 'agent_hook_pattern_updater',
    name: 'Agent Pembaru Pola Hook System Memory',
    role: 'Memperbarui memori kolektif sistem & kamus hook viral secara otomatis dari hasil pembelajaran',
    model: 'gemini-3.6-flash',
    status: 'active',
    callsCount: 52,
    lastUsed: new Date(Date.now() - 3600000 * 3).toISOString(),
    approvedPatternsCount: 15,
    rejectedPatternsCount: 0,
  },
  {
    id: 'agent_aeo_pipeline_governor',
    name: 'Agent Gubernur Pipeline AEO Short-Form',
    role: 'Mengatur urutan eksekusi pipeline AEO, Fan-Out queries, & memverifikasi konsistensi output',
    model: 'gemini-3.1-pro',
    status: 'active',
    callsCount: 110,
    lastUsed: new Date(Date.now() - 3600000 * 1).toISOString(),
    approvedPatternsCount: 32,
    rejectedPatternsCount: 1,
  },
  {
    id: 'agent_meta_auto_build_supervisor',
    name: 'Agent Supervisor Pertumbuhan Skema Terkendali',
    role: 'Mengusulkan perubahan Drizzle ORM / Postgres baru ke tabel pending_schema_changes tanpa auto-apply',
    model: 'gemini-3.1-pro',
    status: 'active',
    callsCount: 18,
    lastUsed: new Date(Date.now() - 3600000 * 10).toISOString(),
    approvedPatternsCount: 5,
    rejectedPatternsCount: 0,
  },
  {
    id: 'agent_realtime_broadcast_dispatcher',
    name: 'Agent Dispatcher Broadcast Real-Time (SSE)',
    role: 'Memastikan setiap mutasi data Postgres memicu event SSE ke seluruh klien terhubung',
    model: 'gemini-3.1-flash-lite',
    status: 'active',
    callsCount: 210,
    lastUsed: new Date().toISOString(),
    approvedPatternsCount: 50,
    rejectedPatternsCount: 0,
  },
  {
    id: 'agent_payment_client_hardening_auditor',
    name: 'Agent Auditor Pembayaran & Keamanan Klien',
    role: 'Audit transaksi pembayaran, mencegah pemalsuan bukti QRIS, & verifikasi batas waktu paket',
    model: 'gemini-3.1-pro',
    status: 'active',
    callsCount: 75,
    lastUsed: new Date(Date.now() - 3600000 * 2).toISOString(),
    approvedPatternsCount: 20,
    rejectedPatternsCount: 1,
  },
];

export function getAiAgents(): AiAgentItem[] {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(LOCAL_STORAGE_AI_AGENTS_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        let updated = false;
        DEFAULT_AI_AGENTS.forEach((def) => {
          if (!parsed.some((a: any) => a.id === def.id)) {
            parsed.push(def);
            updated = true;
          }
        });
        if (updated) {
          saveAiAgents(parsed);
        }
        return parsed.filter((v,i,a)=>a.findIndex(t=>(t.id === v.id))===i);
      }
    }
  } catch (e) {}

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_AI_AGENTS_KEY, JSON.stringify(DEFAULT_AI_AGENTS));
    }
  } catch (e) {}

  return DEFAULT_AI_AGENTS;
}

export async function syncAiAgentsWithBackend(): Promise<AiAgentItem[]> {
  try {
    const res = await fetch('/api/agents');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(LOCAL_STORAGE_AI_AGENTS_KEY, JSON.stringify(data));
          localStorage.setItem('satset_ai_agents', JSON.stringify(data));
          window.dispatchEvent(new Event('satset_ai_agents_updated'));
        }
        return data.filter((v,i,a)=>a.findIndex(t=>(t.id === v.id))===i);
      }
    }
  } catch (e) {
    console.warn('[AiAgents Lib] Error syncing AI agents from backend:', e);
  }
  return getAiAgents();
}

export function saveAiAgents(agents: AiAgentItem[]): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_AI_AGENTS_KEY, JSON.stringify(agents));
      localStorage.setItem('satset_ai_agents', JSON.stringify(agents));
      window.dispatchEvent(new Event('satset_ai_agents_updated'));

      const rawSession = localStorage.getItem('satset_user_session');
      let accessCode = 'SATSET-ADMIN';
      if (rawSession) {
        try {
          const parsed = JSON.parse(rawSession);
          if (parsed?.code) accessCode = parsed.code;
        } catch (e) {}
      }

      fetch('/api/admin/agents', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'x-access-code': accessCode
        },
        body: JSON.stringify({ agents })
      }).catch(() => {});
    }
  } catch (e) {
    console.error('[AiAgents Lib] Error saving agents:', e);
  }
}

export function saveAiAgent(agent: AiAgentItem): void {
  const current = getAiAgents();
  const idx = current.findIndex(a => a.id === agent.id);
  if (idx >= 0) {
    current[idx] = agent;
  } else {
    current.push(agent);
  }
  saveAiAgents(current);
}

export function deleteAiAgent(id: string): void {
  const current = getAiAgents();
  const updated = current.filter(a => a.id !== id);
  saveAiAgents(updated);
}

export function incrementAgentCall(id: string, approved: boolean): void {
  const current = getAiAgents();
  const idx = current.findIndex(a => a.id === id);
  if (idx >= 0) {
    current[idx].callsCount += 1;
    current[idx].lastUsed = new Date().toISOString();
    if (approved) {
      current[idx].approvedPatternsCount += 1;
    } else {
      current[idx].rejectedPatternsCount += 1;
    }
    saveAiAgents(current);
  }
}
