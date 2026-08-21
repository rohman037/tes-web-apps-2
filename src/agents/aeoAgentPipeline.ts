import { GoogleGenAI } from '@google/genai';

export interface AEOMetadata {
  core_entity: string;
  intent_category: string;
  synthetic_fanout_queries: string[];
  short_query_targets?: string[];
  target_ai_platforms: string[];
  aeo_query_mode?: 'short' | 'long' | 'both';
}

export interface AEOScenePrompt {
  timeframe: string;
  visual_prompt: string;
  audio_voiceover: string;
  negative_prompt?: string;
  background_sound_enabled?: boolean;
  text_overlay_enabled?: boolean;
}

export interface AEOContentIdea {
  id: number;
  title: string;
  bluff_hook_3s: string;
  atomic_answer_summary: string;
  consensus_trigger: string;
  aeo_query_mapping?: {
    short: string[];
    long: string[];
  };
  relevance_justification?: string;
  scene_prompts: AEOScenePrompt[];
  aeo_caption_seo: string;
  hashtags: {
    niche_entity: string[];
    category_broad: string[];
    viral_trending: string[];
  };
}

export interface AEOPipelineResult {
  aeo_metadata: AEOMetadata;
  content_ideas: AEOContentIdea[];
  rawMarkdown?: string;
}

export const AEO_CORE_SYSTEM_PROMPT = `
Anda adalah "Satset AEO & Short-Form Content Orchestrator", agen AI tingkat lanjut yang menggabungkan Answer Engine Optimization (AEO) dan Algoritma Viral Short-Form (TikTok/Reels/Shorts).

DOKTRIN EKSEKUSI AEO:
1. QUERY FAN-OUT: Ekstraksi entitas utama dari input pengguna. Generate 5-9 sub-kueri sintetis yang paling mungkin dipicu oleh AI Search (Google AI Overview, ChatGPT Search, Perplexity) terkait topik tersebut.
2. BLUFF HOOK (0-3s): Buat Hook verbal & visual yang langsung memberikan inti jawaban/solusi utama di awal (Bottom Line Up Front).
3. ATOMIC & CONSENSUS-READY: Susun narasi yang berdiri sendiri (atomic) dan sertakan pemicu konsensus sosial (Tier 2 Reddit/Review style) agar dinilai valid oleh LLM.
4. PLATFORM TARGETING: Sesuaikan struktur agar ramah kutipan untuk Google AI Overviews (YouTube/Reddit focus) dan ChatGPT (Editorial Listicle focus).

OUTPUT HARUS BERFORMAT JSON VALID ATAU BISA DI-PARSE:
{
  "aeo_metadata": {
    "core_entity": "Nama Produk / Brand / Topik Utama",
    "intent_category": "Informational / Commercial Investigation / Action-Oriented",
    "synthetic_fanout_queries": [
      "Sub-query 1 (misal: apakah X worth it)",
      "Sub-query 2 (misal: rekomendasi X vs Y)",
      "Sub-query 3", "Sub-query 4", "Sub-query 5"
    ],
    "short_query_targets": [
      "keyword pendek 1", "keyword pendek 2", "keyword pendek 3"
    ],
    "target_ai_platforms": ["Google AI Overviews", "ChatGPT", "Perplexity"],
    "aeo_query_mode": "both"
  },
  "content_ideas": [
    {
      "id": 1,
      "title": "Judul Ide Konten Berbasis Fan-Out Query",
      "bluff_hook_3s": "Hook Verbal & Visual 0-3s (BLUFF Style - Langsung ke Solusi Utama)",
      "atomic_answer_summary": "Rangkuman 1-2 kalimat fakta/solusi utuh yang mudah dikutip langsung oleh AI Search",
      "consensus_trigger": "Strategi membangun konsensus (misal: menyitir review komunitas / Reddit validation)",
      "aeo_query_mapping": {
        "short": ["keyword pendek 1"],
        "long": ["Sub-query 1"]
      },
      "relevance_justification": "Penjelasan singkat mengapa ide ini relevan untuk menjawab target query di atas dan konteks grounding.",
      "scene_prompts": [
        {
          "timeframe": "00:00-00:05",
          "visual_prompt": "Prompt visual Cinematic/Hyper-realistic untuk Generator AI Video (Sora/Kling/Runway)",
          "audio_voiceover": "Teks naskah voiceover 0-5 detik",
          "negative_prompt": "flickering, flicker, strobing, morphing face, warping identity, inconsistent character design between frames, changing outfit/product color mid-clip, unstable lighting, jittery motion, texture popping, banding artifacts, blurry transition, extra fingers, deformed hands, distorted proportions, watermark, text glitch, double exposure ghosting, low resolution, oversaturated color shift",
          "background_sound_enabled": true,
          "text_overlay_enabled": true
        },
        {
          "timeframe": "00:05-00:15",
          "visual_prompt": "Prompt visual detail adegan tengah",
          "audio_voiceover": "Teks naskah penjelas bernilai informasi tinggi"
        },
        {
          "timeframe": "00:15-00:30",
          "visual_prompt": "Prompt visual Call to Action & Closing",
          "audio_voiceover": "Naskah CTA / Penutup"
        }
      ],
      "aeo_caption_seo": "Caption terstruktur: Kalimat 1 = BLUFF Answer + Kata Kunci Entitas, Kalimat 2-3 = Poin Detail, Penutup = Q&A Pemicu Diskusi",
      "hashtags": {
        "niche_entity": ["#HashtagEntitas1", "#HashtagEntitas2"],
        "category_broad": ["#HashtagKategori1", "#HashtagKategori2"],
        "viral_trending": ["#HashtagViral1"]
      }
    }
  ]
}
`;

/**
 * Utility to process AEO Engine Pipeline prompt generation
 */
export function buildAEOPipelinePrompt(topicInput: string, groundingContext?: string): string {
  return `
BERIKUT ADALAH INPUT USER:
Topik/Produk: "${topicInput}"
${groundingContext ? `\nKONTEKS Tambahan / Grounding Data:\n${groundingContext}` : ''}

TUGAS UTAMA:
Hasilkan 5 Ide Konten Viral yang sepenuhnya dioptimasi dengan Answer Engine Optimization (AEO).
Gunakan Query Fan-Out, BLUFF Hook (0-3s), Atomic Answer Summary, Consensus Triggers, Scene Prompts berdurasi, dan AEO Caption SEO.

Hasilkan seluruh respon dalam JSON valid yang sesuai dengan skema AEO_CORE_SYSTEM_PROMPT.
`;
}

/**
 * Format AEO JSON output into clean readable Markdown for legacy or standard text renderers
 */
export function formatAEOOutputToMarkdown(result: AEOPipelineResult): string {
  if (!result || !result.content_ideas) return result.rawMarkdown || '';

  const meta = result.aeo_metadata;
  let md = `# 🚀 5 IDE KONTEN VIRAL (AEO & AI SEARCH ENGINE OPTIMIZED)\n\n`;

  if (meta) {
    md += `> **AEO ENTITY SUMMARY**\n`;
    md += `> **Core Entity**: ${meta.core_entity || '-'}\n`;
    md += `> **Intent Category**: ${meta.intent_category || '-'}\n`;
    if (meta.synthetic_fanout_queries && meta.synthetic_fanout_queries.length > 0) {
      md += `> **Synthetic Fan-Out Queries (AEO)**:\n`;
      meta.synthetic_fanout_queries.forEach((q, idx) => {
        md += `> ${idx + 1}. *${q}*\n`;
      });
    }
    if (meta.short_query_targets && meta.short_query_targets.length > 0) {
      md += `> **Short Query Targets**:\n`;
      meta.short_query_targets.forEach((q, idx) => {
        md += `> ${idx + 1}. *${q}*\n`;
      });
    }
    if (meta.target_ai_platforms) {
      md += `> **Target AI Search Platforms**: ${meta.target_ai_platforms.join(', ')}\n`;
    }
    md += `\n---\n\n`;
  }

  result.content_ideas.forEach((idea, index) => {
    md += `## IDE ${index + 1}: ${idea.title}\n\n`;
    if (idea.aeo_query_mapping) {
      md += `* **AEO Query Mapping**: Short → [${idea.aeo_query_mapping.short.join(', ')}], Long → [${idea.aeo_query_mapping.long.join(', ')}]\n`;
    }
    if (idea.relevance_justification) {
      md += `* **Alasan Relevansi**: ${idea.relevance_justification}\n`;
    }
    md += `* **BLUFF Hook (0-3s)**: ${idea.bluff_hook_3s}\n`;
    md += `* **Atomic Answer Summary (LLM Citation Ready)**: ${idea.atomic_answer_summary}\n`;
    md += `* **Consensus Trigger**: ${idea.consensus_trigger}\n\n`;

    md += `### 🎬 Panduan Adegan & Prompt AI Video:\n`;
    if (idea.scene_prompts && idea.scene_prompts.length > 0) {
      idea.scene_prompts.forEach((scene, sIdx) => {
        md += `- **[${scene.timeframe}] Klip ${sIdx + 1}**:\n`;
        md += `  - *Aksi & VO*: ${scene.audio_voiceover}\n`;
        md += `  - *Prompt AI Video*:\n\`\`\`text\n${scene.visual_prompt}\n\`\`\`\n`;
        if (scene.negative_prompt) {
          md += `  - *Negative Prompt*:\n\`\`\`text\n${scene.negative_prompt}\n\`\`\`\n`;
        }
      });
    }

    md += `\n### 📝 AEO Caption SEO & Hash:\n`;
    md += `${idea.aeo_caption_seo}\n\n`;

    if (idea.hashtags) {
      const allTags = [
        ...(idea.hashtags.niche_entity || []),
        ...(idea.hashtags.category_broad || []),
        ...(idea.hashtags.viral_trending || []),
      ];
      md += `**Hashtags**: ${allTags.join(' ')}\n\n`;
    }

    md += `---\n\n`;
  });

  return md;
}
