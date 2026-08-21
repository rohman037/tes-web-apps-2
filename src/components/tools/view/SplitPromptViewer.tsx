'use client';

import React, { useState } from 'react';
import { Copy, Check, Sparkles, Layers, FileText, ChevronDown, ChevronUp, Share2, Clapperboard, Camera } from 'lucide-react';
import Markdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { learningSync } from '../../../lib/learningSync';

interface SplitPromptViewerProps {
  rawPrompt: string;
  segmentDuration: string;
  targetAI: string;
  onSendToPhotoPrompt?: (text: string) => void;
}

export interface ClipSegment {
  id: number;
  title: string;
  timestamp: string;
  masterPrompt: string;
  content: string;
}

export function parseClipSegments(rawText: string): ClipSegment[] {
  if (!rawText) return [];

  // Split on headings that indicate clips or segments, e.g.:
  // ### 🎬 KLIP PROMPT SEGMEN 1
  // ### KLIP 1
  // ### SEGMEN 1
  // ### CLIP 1
  // ## KLIP 1
  // ### 1. KLIP
  const headerSplitter = /(?=(?:^|\n)#{2,4}\s*(?:🎬|🎥|📹)?\s*(?:KLIP|SEGMEN|CLIP|PART|\d+\.)\b)/gi;
  const blocks = rawText.split(headerSplitter);
  const segments: ClipSegment[] = [];

  let count = 0;
  for (const block of blocks) {
    if (!block.trim()) continue;

    // Check if block contains clip header pattern
    const headerMatch = block.match(/(?:^|\n)#{2,4}\s*(?:🎬|🎥|📹)?\s*(?:KLIP|SEGMEN|CLIP|PART|\d+\.)\s*([^\n]+)/i);
    if (headerMatch) {
      count++;
      const fullHeader = headerMatch[1].trim();

      // Extract timestamp if available
      let timestamp = '';
      const timeMatch = fullHeader.match(/\(Timestamp:?\s*([^\)]+)\)/i) || block.match(/Timestamp:?\s*([0-9:\s\-]+)/i) || fullHeader.match(/(\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2})/);
      if (timeMatch) {
        timestamp = timeMatch[1].trim();
      } else {
        timestamp = `Segmen ${count}`;
      }

      // Extract master prompt code block if available
      let masterPrompt = '';
      const codeBlockMatch = block.match(/```(?:text|prompt)?\n([\s\S]*?)\n```/i);
      if (codeBlockMatch) {
        masterPrompt = codeBlockMatch[1].trim();
      } else {
        // Fallback: look for lines under Master Prompt header or bold text
        const promptLineMatch = block.match(/(?:Master Prompt|Prompt AI|Prompt Klip)[^\n]*\n+([\s\S]+?)(?=\n---|#{2,4}|$)/i);
        if (promptLineMatch) {
          masterPrompt = promptLineMatch[1].replace(/```/g, '').trim();
        }
      }

      segments.push({
        id: count,
        title: `Klip ${count}`,
        timestamp: timestamp,
        masterPrompt: masterPrompt || block.trim(),
        content: block.trim(),
      });
    }
  }

  return segments;
}

export default function SplitPromptViewer({ rawPrompt, segmentDuration, targetAI, onSendToPhotoPrompt }: SplitPromptViewerProps) {
  const [copiedClipId, setCopiedClipId] = useState<number | null>(null);
  const [copiedAllPrompts, setCopiedAllPrompts] = useState(false);
  const [copiedFullReport, setCopiedFullReport] = useState(false);
  const [activeTab, setActiveTab] = useState<'cards' | 'raw'>('cards');
  const [expandedClip, setExpandedClip] = useState<number | null>(null);

  const segments = parseClipSegments(rawPrompt);

  const handleCopyClipPrompt = (segment: ClipSegment) => {
    const textToCopy = segment.masterPrompt || segment.content;
    navigator.clipboard.writeText(textToCopy);
    setCopiedClipId(segment.id);

    learningSync.track('prompt_clip_copied', {
      type: 'video_clip_prompt',
      clipIndex: segment.id,
      promptSnippet: textToCopy.slice(0, 100),
      segmentDuration,
      targetAI,
      text: textToCopy,
    });

    setTimeout(() => setCopiedClipId(null), 2000);
  };

  const handleCopyAllPrompts = () => {
    let textToCopy = rawPrompt;
    if (segments.length === 0) {
      navigator.clipboard.writeText(rawPrompt);
    } else {
      const allPromptsText = segments
        .map((s, idx) => `[KLIP ${idx + 1} (${s.timestamp})]\n${s.masterPrompt}\n`)
        .join('\n---\n\n');
      textToCopy = allPromptsText;
      navigator.clipboard.writeText(allPromptsText);
    }
    setCopiedAllPrompts(true);

    learningSync.track('prompt_copied', {
      type: 'video_clip_prompt_all',
      text: textToCopy,
    });

    setTimeout(() => setCopiedAllPrompts(false), 2000);
  };

  const handleCopyFullReport = () => {
    navigator.clipboard.writeText(rawPrompt);
    setCopiedFullReport(true);

    learningSync.track('prompt_copied', {
      type: 'video_prompt_full_report',
      text: rawPrompt,
    });

    setTimeout(() => setCopiedFullReport(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* Top Header Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#5b50e5] shrink-0">
            <Clapperboard className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">Hasil Split Prompt Video</h3>
              {segments.length > 0 && (
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                  {segments.length} Klip Siap Salin
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              {segmentDuration !== 'auto'
                ? `Dipecah per ${segmentDuration} detik • Target: ${targetAI.toUpperCase()}`
                : `Analisis Penuh Durasi Video • Target: ${targetAI.toUpperCase()}`}
            </p>
          </div>
        </div>

        {/* View Toggle & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {segments.length > 0 && (
            <div className="flex items-center p-1 bg-slate-100 border border-slate-200 rounded-xl text-xs font-medium mr-1">
              <button
                type="button"
                onClick={() => setActiveTab('cards')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'cards' ? 'bg-[#5b50e5] text-white font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Kartu Klip ({segments.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('raw')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'raw' ? 'bg-[#5b50e5] text-white font-semibold shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Teks Utuh</span>
              </button>
            </div>
          )}

          {segments.length > 0 && (
            <button
              type="button"
              onClick={handleCopyAllPrompts}
              className="px-3.5 py-1.5 rounded-xl bg-[#5b50e5] hover:bg-[#4f46e5] text-white font-medium text-xs transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              {copiedAllPrompts ? <Check className="w-3.5 h-3.5 text-emerald-200" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedAllPrompts ? 'Semua Tersalin!' : `Salin Semua ${segments.length} Prompt`}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCopyFullReport}
            className="px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs transition-all flex items-center gap-1.5 border border-slate-200 cursor-pointer"
          >
            {copiedFullReport ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5" />}
            <span>{copiedFullReport ? 'Laporan Tersalin!' : 'Salin Laporan'}</span>
          </button>
        </div>
      </div>

      {/* Content Rendering */}
      {activeTab === 'cards' && segments.length > 0 ? (
        <div className="grid grid-cols-1 gap-4">
          {segments.map((segment) => {
            const isExpanded = expandedClip === segment.id;
            return (
              <motion.div
                key={segment.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="rounded-2xl bg-white border border-slate-200/80 hover:border-[#5b50e5]/50 overflow-hidden transition-all shadow-sm"
              >
                {/* Clip Card Header */}
                <div className="p-4 bg-slate-50/80 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-100 text-[#5b50e5] flex items-center justify-center font-bold text-xs shrink-0">
                      #{segment.id}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-slate-900">Segmen Prompt Klip {segment.id}</h4>
                        <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-[#5b50e5] border border-indigo-100 text-[11px] font-mono font-semibold">
                          {segment.timestamp}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">Dioptimalkan untuk {targetAI.toUpperCase()}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-end">
                    {onSendToPhotoPrompt && (
                      <button
                        type="button"
                        onClick={() => {
                          const text = segment.masterPrompt || segment.content;
                          learningSync.track('prompt_sent_to_photo', {
                            clipIndex: segment.id,
                            promptSnippet: text.slice(0, 100),
                            segmentDuration,
                            targetAI,
                          });
                          onSendToPhotoPrompt(text);
                        }}
                        className="px-3 py-1.5 rounded-xl font-medium text-xs transition-all flex items-center gap-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 shadow-2xs cursor-pointer"
                        title="Kirim deskripsi visual klip ini ke Prompt Foto AI Generator"
                      >
                        <Camera className="w-3.5 h-3.5 text-purple-600" />
                        <span>Ke Prompt Foto</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleCopyClipPrompt(segment)}
                      className={`px-3 py-1.5 rounded-xl font-medium text-xs transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer ${
                        copiedClipId === segment.id
                          ? 'bg-emerald-600 text-white'
                          : 'bg-[#5b50e5] hover:bg-[#4f46e5] text-white'
                      }`}
                    >
                      {copiedClipId === segment.id ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedClipId === segment.id ? 'Prompt Klip Tersalin!' : 'Salin Prompt Klip'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setExpandedClip(isExpanded ? null : segment.id)}
                      className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors border border-slate-200 cursor-pointer"
                      title={isExpanded ? 'Sembunyikan Rincian' : 'Tampilkan Rincian Detail'}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Master Prompt Highlights Box */}
                {segment.masterPrompt && (
                  <div className="p-4 bg-slate-50/50 border-b border-slate-100">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-[#5b50e5] uppercase tracking-wider flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> Master Prompt AI Klip {segment.id} (Siap Copy)
                      </span>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-100 border border-slate-200/80 font-mono text-xs text-slate-800 leading-relaxed select-all">
                      {segment.masterPrompt}
                    </div>
                  </div>
                )}

                {/* Expanded Details */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="p-4 bg-white border-t border-slate-100 overflow-hidden"
                    >
                      <div className="prose prose-slate max-w-none text-xs leading-relaxed">
                        <Markdown>{segment.content}</Markdown>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      ) : (
        /* Full Markdown Output */
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 relative shadow-sm">
          <div className="prose prose-slate max-w-none text-xs sm:text-sm leading-relaxed">
            <Markdown>{rawPrompt}</Markdown>
          </div>
        </div>
      )}
    </div>
  );
}
