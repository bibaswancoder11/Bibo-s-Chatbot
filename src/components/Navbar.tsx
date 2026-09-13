import React from 'react';
import {
  ShieldCheck,
  MessageSquare,
  FileSearch,
  Sparkles,
  Settings,
  Cpu,
  HardDrive,
  BrainCircuit,
  Bot
} from 'lucide-react';
import { EngineType } from '../types';
import { webLlm } from '../services/webLlmService';

interface NavbarProps {
  activeTab: 'chat' | 'rag' | 'nlp' | 'settings';
  setActiveTab: (tab: 'chat' | 'rag' | 'nlp' | 'settings') => void;
  activeEngine: EngineType;
  openSettings: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  activeEngine,
  openSettings,
}) => {
  const hasGpu = webLlm.hasWebGpu();

  const getEngineBadge = () => {
    switch (activeEngine) {
      case 'web-llm':
        return {
          label: 'Neural LLM (WebGPU)',
          shortLabel: 'Local LLM',
          icon: BrainCircuit,
          color: 'text-indigo-700 bg-indigo-50 border-indigo-200'
        };
      case 'in-browser-nlp':
        return {
          label: 'Pure Local Engine',
          shortLabel: 'Instant NLP',
          icon: Cpu,
          color: 'text-emerald-700 bg-emerald-50 border-emerald-200'
        };
      case 'transformers-wasm':
        return {
          label: 'Transformers (WASM)',
          shortLabel: 'WASM Net',
          icon: HardDrive,
          color: 'text-blue-700 bg-blue-50 border-blue-200'
        };
      case 'ollama-local':
        return {
          label: 'Ollama (localhost:11434)',
          shortLabel: 'Ollama',
          icon: Cpu,
          color: 'text-amber-700 bg-amber-50 border-amber-200'
        };
      case 'chrome-ai':
        return {
          label: 'Chrome Native AI',
          shortLabel: 'Gemini Nano',
          icon: Sparkles,
          color: 'text-purple-700 bg-purple-50 border-purple-200'
        };
      default:
        return {
          label: 'Local Engine',
          shortLabel: 'Local',
          icon: Bot,
          color: 'text-zinc-700 bg-zinc-50 border-zinc-200'
        };
    }
  };

  const badge = getEngineBadge();
  const BadgeIcon = badge.icon;

  return (
    <>
      {/* Top Header */}
      <header className="border-b border-zinc-200 bg-white/95 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16 gap-2 sm:gap-4">
            {/* Brand & Zero-Key Tag */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-zinc-900 flex items-center justify-center text-white shadow-xs shrink-0">
                <ShieldCheck className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <span className="font-semibold text-zinc-900 text-base sm:text-lg tracking-tight">Local AI</span>
                  <span className="inline-flex items-center gap-1 px-1.5 sm:px-2 py-0.5 text-[10px] sm:text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    Zero Keys
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 hidden sm:block">100% On-Device • No Cloud APIs • Fully Private</p>
              </div>
            </div>

            {/* Desktop Navigation Tabs (Hidden on mobile, bottom bar is used instead) */}
            <nav className="hidden md:flex items-center bg-zinc-100 p-1 rounded-xl border border-zinc-200 text-sm font-medium">
              <button
                id="nav-tab-chat"
                onClick={() => setActiveTab('chat')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-all ${
                  activeTab === 'chat'
                    ? 'bg-white text-zinc-900 shadow-xs font-semibold'
                    : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/60'
                }`}
              >
                <MessageSquare className="w-4 h-4" />
                <span>AI Chat</span>
              </button>

              <button
                id="nav-tab-rag"
                onClick={() => setActiveTab('rag')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-all ${
                  activeTab === 'rag'
                    ? 'bg-white text-zinc-900 shadow-xs font-semibold'
                    : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/60'
                }`}
              >
                <FileSearch className="w-4 h-4" />
                <span>Ask Docs (RAG)</span>
              </button>

              <button
                id="nav-tab-nlp"
                onClick={() => setActiveTab('nlp')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg transition-all ${
                  activeTab === 'nlp'
                    ? 'bg-white text-zinc-900 shadow-xs font-semibold'
                    : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/60'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                <span>Text Intelligence</span>
              </button>
            </nav>

            {/* Right Action: Active Engine & Settings */}
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <button
                id="btn-active-engine-badge"
                onClick={openSettings}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 sm:py-1.5 text-xs font-medium rounded-lg border transition-colors hover:brightness-95 active:scale-95 ${badge.color}`}
                title="Click to configure local LLM engine"
              >
                <BadgeIcon className="w-3.5 h-3.5 shrink-0" />
                <span className="hidden sm:inline">{badge.label}</span>
                <span className="sm:hidden">{badge.shortLabel}</span>
              </button>

              <button
                id="btn-open-settings"
                onClick={openSettings}
                className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors border border-transparent hover:border-zinc-200 active:scale-95"
                title="Configure Local Engine & Models"
                aria-label="Engine settings"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Navigation Bar (Visible only on small screens < md) */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-zinc-200 z-40 px-2 py-1.5 flex items-center justify-around shadow-lg"
      >
        <button
          id="mobile-nav-chat"
          onClick={() => setActiveTab('chat')}
          className={`flex flex-col items-center justify-center min-w-[64px] min-h-[48px] px-2 py-1 rounded-xl transition-all ${
            activeTab === 'chat'
              ? 'text-zinc-900 font-semibold bg-zinc-100'
              : 'text-zinc-500 hover:text-zinc-900 active:bg-zinc-50'
          }`}
        >
          <MessageSquare className="w-5 h-5 mb-0.5" />
          <span className="text-[11px] leading-tight">Chat</span>
        </button>

        <button
          id="mobile-nav-rag"
          onClick={() => setActiveTab('rag')}
          className={`flex flex-col items-center justify-center min-w-[64px] min-h-[48px] px-2 py-1 rounded-xl transition-all ${
            activeTab === 'rag'
              ? 'text-zinc-900 font-semibold bg-zinc-100'
              : 'text-zinc-500 hover:text-zinc-900 active:bg-zinc-50'
          }`}
        >
          <FileSearch className="w-5 h-5 mb-0.5" />
          <span className="text-[11px] leading-tight">Docs RAG</span>
        </button>

        <button
          id="mobile-nav-nlp"
          onClick={() => setActiveTab('nlp')}
          className={`flex flex-col items-center justify-center min-w-[64px] min-h-[48px] px-2 py-1 rounded-xl transition-all ${
            activeTab === 'nlp'
              ? 'text-zinc-900 font-semibold bg-zinc-100'
              : 'text-zinc-500 hover:text-zinc-900 active:bg-zinc-50'
          }`}
        >
          <Sparkles className="w-5 h-5 mb-0.5" />
          <span className="text-[11px] leading-tight">NLP</span>
        </button>

        <button
          id="mobile-nav-settings"
          onClick={openSettings}
          className="flex flex-col items-center justify-center min-w-[64px] min-h-[48px] px-2 py-1 rounded-xl text-zinc-500 hover:text-zinc-900 active:bg-zinc-50 transition-all"
        >
          <Settings className="w-5 h-5 mb-0.5" />
          <span className="text-[11px] leading-tight">Engines</span>
        </button>
      </nav>
    </>
  );
};
