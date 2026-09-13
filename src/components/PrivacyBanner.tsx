import React, { useState } from 'react';
import { ShieldCheck, ChevronDown, ChevronUp, Lock, HardDrive, WifiOff, KeyRound } from 'lucide-react';

export const PrivacyBanner: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="bg-emerald-50/70 border-b border-emerald-100 text-xs text-emerald-900 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-semibold text-emerald-950">Zero-API-Key Architecture:</span>
            <span className="text-emerald-800">
              100% of reasoning, vector indexing, and token generation occurs directly on your device.
            </span>
          </div>

          <button
            id="btn-toggle-privacy-details"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-1 font-medium text-emerald-700 hover:text-emerald-900 underline underline-offset-2 ml-auto"
          >
            <span>{isExpanded ? 'Hide Security Details' : 'Verify Privacy Guarantees'}</span>
            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {isExpanded && (
          <div className="mt-3 pt-3 border-t border-emerald-200/60 grid grid-cols-1 md:grid-cols-4 gap-3 text-emerald-900 pb-1">
            <div className="flex items-start gap-2 bg-white/70 p-2.5 rounded-lg border border-emerald-100">
              <KeyRound className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-zinc-900">Zero API Keys</p>
                <p className="text-zinc-600 mt-0.5 leading-relaxed">
                  No OpenAI, Gemini, or Anthropic keys. No paid subscriptions or rate limit throttles.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2 bg-white/70 p-2.5 rounded-lg border border-emerald-100">
              <HardDrive className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-zinc-900">On-Device Computation</p>
                <p className="text-zinc-600 mt-0.5 leading-relaxed">
                  Runs via client-side WebAssembly, ONNX Runtime Web, or your machine's Ollama runner.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2 bg-white/70 p-2.5 rounded-lg border border-emerald-100">
              <Lock className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-zinc-900">100% Data Confidentiality</p>
                <p className="text-zinc-600 mt-0.5 leading-relaxed">
                  Your chat logs and uploaded documents remain in your local browser sandbox only.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-2 bg-white/70 p-2.5 rounded-lg border border-emerald-100">
              <WifiOff className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-zinc-900">Fully Offline Capable</p>
                <p className="text-zinc-600 mt-0.5 leading-relaxed">
                  Works seamlessly without an internet connection or on airplane mode.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
