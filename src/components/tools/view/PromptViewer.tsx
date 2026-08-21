'use client';

import React, { useState } from 'react';
import { Copy, Check, Sparkles, Sliders, ExternalLink } from 'lucide-react';

interface PromptViewerProps {
  prompt: string;
  title?: string;
  subtitle?: string;
  onCopy?: () => void;
  className?: string;
}

export default function PromptViewer({
  prompt,
  title = 'Hasil Prompt AI Video',
  subtitle,
  onCopy,
  className = '',
}: PromptViewerProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    if (onCopy) onCopy();
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`p-5 rounded-3xl bg-slate-900/80 border border-white/10 backdrop-blur-md space-y-4 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            {title}
          </h3>
          {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
            copied
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
              : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30'
          }`}
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>Tersalin!</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Salin Prompt</span>
            </>
          )}
        </button>
      </div>

      <div className="p-4 rounded-2xl bg-black/60 border border-white/10 text-xs sm:text-sm font-mono text-slate-200 leading-relaxed overflow-x-auto whitespace-pre-wrap selection:bg-indigo-500/30">
        {prompt}
      </div>
    </div>
  );
}
