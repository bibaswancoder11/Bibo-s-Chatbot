import React, { useState, useEffect } from 'react';
import {
  X,
  Cpu,
  HardDrive,
  Sparkles,
  Terminal,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Copy,
  Check,
  ShieldCheck,
  Sliders,
  Trash2,
  BrainCircuit,
  Download,
  Loader2
} from 'lucide-react';
import { EngineConfig, EngineType, OllamaModelInfo } from '../types';
import { OllamaService, ChromeNativeAiService } from '../services/localAiEngine';
import { webLlm, LOCAL_LLM_MODELS, LoadingStatus } from '../services/webLlmService';
import { safeStorage } from '../utils/safeStorage';

interface EngineSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: EngineConfig;
  onSaveConfig: (updated: EngineConfig) => void;
}

export const EngineSettingsModal: React.FC<EngineSettingsModalProps> = ({
  isOpen,
  onClose,
  config,
  onSaveConfig,
}) => {
  const [localConfig, setLocalConfig] = useState<EngineConfig>(config);
  const [ollamaStatus, setOllamaStatus] = useState<{
    tested: boolean;
    connected: boolean;
    models: OllamaModelInfo[];
    error?: string;
    checking: boolean;
  }>({
    tested: false,
    connected: false,
    models: [],
    checking: false
  });
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [cacheCleared, setCacheCleared] = useState(false);
  const [chromeAiAvailable, setChromeAiAvailable] = useState(false);
  const [webLlmStatus, setWebLlmStatus] = useState<LoadingStatus>(webLlm.getStatus());
  const [hasGpu, setHasGpu] = useState(true);

  useEffect(() => {
    setLocalConfig(config);
    setChromeAiAvailable(ChromeNativeAiService.isAvailable());
    setHasGpu(webLlm.hasWebGpu());

    const unsub = webLlm.subscribe((s) => {
      setWebLlmStatus(s);
    });
    return unsub;
  }, [config, isOpen]);

  if (!isOpen) return null;

  const handleTestOllama = async () => {
    setOllamaStatus(prev => ({ ...prev, checking: true }));
    const result = await OllamaService.checkConnection(localConfig.ollamaUrl);
    setOllamaStatus({
      tested: true,
      connected: result.connected,
      models: result.models,
      error: result.error,
      checking: false
    });

    if (result.connected && result.models.length > 0) {
      if (!result.models.some(m => m.name === localConfig.ollamaModel)) {
        setLocalConfig(prev => ({ ...prev, ollamaModel: result.models[0].name }));
      }
    }
  };

  const handleLoadWebLlm = async () => {
    try {
      await webLlm.loadModel(localConfig.webLlmModel || 'SmolLM2-360M-Instruct-q4f16_1-MLC');
    } catch (err) {
      console.error('Failed to load WebLLM model:', err);
    }
  };

  const handleSave = () => {
    onSaveConfig(localConfig);
    onClose();
  };

  const handleCopyOllamaCommand = () => {
    navigator.clipboard.writeText('OLLAMA_ORIGINS="*" ollama serve');
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  const handleClearCache = () => {
    safeStorage.removeItem('local_ai_chat_history');
    safeStorage.removeItem('local_ai_config');
    setCacheCleared(true);
    setTimeout(() => setCacheCleared(false), 2500);
  };

  const ENGINES: {
    id: EngineType;
    title: string;
    subtitle: string;
    icon: any;
    badge: string;
    badgeColor: string;
    description: string;
  }[] = [
    {
      id: 'web-llm',
      title: 'In-Browser WebGPU Neural LLM',
      subtitle: 'Real Quantized LLM • WebGPU Acceleration',
      icon: BrainCircuit,
      badge: 'Neural LLM',
      badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200',
      description: 'Executes open-weight models (SmolLM2, Qwen 2.5, Llama 3.2) directly inside your browser GPU with full streaming completions and zero external servers.'
    },
    {
      id: 'in-browser-nlp',
      title: 'Pure Local Engine',
      subtitle: 'Zero Download • Instant • 100% Reliable',
      icon: Cpu,
      badge: 'Zero MB',
      badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      description: 'Ultra-fast semantic engine running in JavaScript memory. Instant 0ms responses, zero download required, perfect for all mobile devices without discrete GPUs.'
    },
    {
      id: 'transformers-wasm',
      title: 'Transformers (WASM)',
      subtitle: 'ONNX Runtime Web • Client-Side Neural Net',
      icon: HardDrive,
      badge: 'WASM Net',
      badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
      description: 'Loads compact models via Hugging Face Transformers.js and executes them via WebAssembly.'
    },
    {
      id: 'ollama-local',
      title: 'Localhost Ollama Daemon',
      subtitle: 'Host Machine (localhost:11434)',
      icon: Terminal,
      badge: 'Local Daemon',
      badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
      description: 'Direct connection to Ollama daemon running on your computer. Run Llama 3, DeepSeek-R1, Mistral, and more.'
    },
    {
      id: 'chrome-ai',
      title: 'Chrome Native AI (Gemini Nano)',
      subtitle: 'Experimental Built-in Browser Model',
      icon: Sparkles,
      badge: 'Prompt API',
      badgeColor: 'bg-purple-100 text-purple-800 border-purple-200',
      description: 'Uses Chrome built-in window.ai.languageModel (available in Chrome Canary/Dev with flags enabled).'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 transition-opacity animate-in fade-in duration-200">
      <div className="bg-white w-full sm:max-w-2xl max-h-[92dvh] sm:max-h-[88vh] rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-zinc-200">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-zinc-200 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-900 text-white flex items-center justify-center">
              <Cpu className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-zinc-900">Local AI Engine & Model Settings</h2>
              <p className="text-xs text-zinc-500">100% on-device • Zero API keys required</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded-xl transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-6 flex-1 text-xs sm:text-sm">
          {/* Zero-Key Guarantee Banner */}
          <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              <strong>Zero-Key Guarantee:</strong> None of these engines transmit prompts to commercial cloud APIs. All token generation occurs on your physical device.
            </span>
          </div>

          {/* Engine Selection List */}
          <div className="space-y-3">
            <label className="text-xs font-semibold text-zinc-600 uppercase tracking-wider block">
              Select Active Local Engine
            </label>

            <div className="space-y-2.5">
              {ENGINES.map((engine) => {
                const Icon = engine.icon;
                const isSelected = localConfig.activeEngine === engine.id;

                return (
                  <div
                    key={engine.id}
                    onClick={() => setLocalConfig(prev => ({ ...prev, activeEngine: engine.id }))}
                    className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'border-zinc-900 bg-zinc-50/90 ring-1 ring-zinc-900 shadow-xs'
                        : 'border-zinc-200 hover:border-zinc-300 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                            isSelected ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-zinc-900 text-xs sm:text-sm">
                              {engine.title}
                            </span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${engine.badgeColor}`}>
                              {engine.badge}
                            </span>
                          </div>
                          <p className="text-[11px] text-zinc-500 mt-0.5">{engine.subtitle}</p>
                        </div>
                      </div>

                      <div className="shrink-0 pt-0.5">
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                            isSelected ? 'border-zinc-900 bg-zinc-900' : 'border-zinc-300'
                          }`}
                        >
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                      </div>
                    </div>

                    <p className="text-xs text-zinc-600 mt-2.5 pl-11 leading-relaxed">
                      {engine.description}
                    </p>

                    {/* Sub-config: WebGPU LLM Details */}
                    {isSelected && engine.id === 'web-llm' && (
                      <div className="mt-3.5 pt-3 border-t border-zinc-200/80 pl-2 sm:pl-11 space-y-3" onClick={e => e.stopPropagation()}>
                        <div>
                          <label className="text-xs font-semibold text-zinc-800 block mb-1">
                            Choose Quantized Model:
                          </label>
                          <select
                            value={localConfig.webLlmModel || LOCAL_LLM_MODELS[0].id}
                            onChange={(e) => setLocalConfig(prev => ({ ...prev, webLlmModel: e.target.value }))}
                            className="w-full text-xs p-2.5 rounded-lg border border-zinc-300 bg-white font-medium text-zinc-800 focus:outline-hidden focus:border-zinc-900"
                          >
                            {LOCAL_LLM_MODELS.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name} (~{m.sizeMb}MB) - {m.recommendedFor}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex items-center justify-between gap-2 flex-wrap text-xs bg-zinc-100 p-2.5 rounded-lg">
                          <div>
                            <p className="font-semibold text-zinc-800">
                              WebGPU: {hasGpu ? '🟢 Hardware Acceleration Available' : '⚠️ WebGPU not detected in this browser'}
                            </p>
                            <p className="text-[11px] text-zinc-500 mt-0.5">
                              Status: {webLlmStatus.text}
                            </p>
                          </div>

                          {webLlmStatus.phase !== 'ready' && hasGpu && (
                            <button
                              type="button"
                              onClick={handleLoadWebLlm}
                              disabled={webLlmStatus.phase === 'downloading' || webLlmStatus.phase === 'compiling'}
                              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-medium inline-flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                            >
                              {webLlmStatus.phase === 'downloading' || webLlmStatus.phase === 'compiling' ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  <span>Loading ({webLlmStatus.progress}%)</span>
                                </>
                              ) : (
                                <>
                                  <Download className="w-3.5 h-3.5" />
                                  <span>Pre-load Model</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Sub-config: Ollama Settings */}
                    {isSelected && engine.id === 'ollama-local' && (
                      <div className="mt-3.5 pt-3 border-t border-zinc-200/80 pl-2 sm:pl-11 space-y-3" onClick={e => e.stopPropagation()}>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <div>
                            <label className="text-xs font-medium text-zinc-700 block mb-1">Ollama Host URL</label>
                            <input
                              type="text"
                              value={localConfig.ollamaUrl}
                              onChange={(e) => setLocalConfig(prev => ({ ...prev, ollamaUrl: e.target.value }))}
                              className="w-full text-xs p-2 rounded-lg border border-zinc-300 bg-white font-mono"
                              placeholder="http://localhost:11434"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-zinc-700 block mb-1">Model Name</label>
                            <input
                              type="text"
                              value={localConfig.ollamaModel}
                              onChange={(e) => setLocalConfig(prev => ({ ...prev, ollamaModel: e.target.value }))}
                              className="w-full text-xs p-2 rounded-lg border border-zinc-300 bg-white font-mono"
                              placeholder="llama3, mistral, deepseek-r1"
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleTestOllama}
                            disabled={ollamaStatus.checking}
                            className="px-3 py-1.5 bg-zinc-900 text-white rounded-lg text-xs font-medium hover:bg-zinc-800 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${ollamaStatus.checking ? 'animate-spin' : ''}`} />
                            <span>{ollamaStatus.checking ? 'Testing...' : 'Test Connection'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={handleCopyOllamaCommand}
                            className="px-2.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
                          >
                            {copiedCmd ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                            <span>Copy CORS Flag</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Model Inference Parameters */}
          <div className="space-y-3 pt-3 border-t border-zinc-200">
            <h3 className="text-xs font-semibold text-zinc-600 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-zinc-400" />
              <span>Inference Parameters</span>
            </h3>

            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="font-medium text-zinc-700">Temperature (Creativity)</span>
                  <span className="font-mono text-zinc-500">{localConfig.temperature}</span>
                </div>
                <input
                  type="range"
                  min="0.1"
                  max="1.0"
                  step="0.05"
                  value={localConfig.temperature}
                  onChange={(e) => setLocalConfig(prev => ({ ...prev, temperature: parseFloat(e.target.value) }))}
                  className="w-full accent-zinc-900"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-700 block mb-1">System Instructions</label>
                <textarea
                  rows={2}
                  value={localConfig.systemPrompt}
                  onChange={(e) => setLocalConfig(prev => ({ ...prev, systemPrompt: e.target.value }))}
                  className="w-full text-base sm:text-xs p-2.5 rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:outline-hidden focus:border-zinc-800"
                  placeholder="You are a helpful, versatile local AI assistant..."
                />
              </div>
            </div>
          </div>

          {/* Local Storage & Cache Reset */}
          <div className="pt-2 border-t border-zinc-100 flex items-center justify-between">
            <span className="text-xs text-zinc-400">Clear chat history and local cache:</span>
            {cacheCleared ? (
              <span className="text-xs text-emerald-600 font-medium flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                <span>Cache cleared!</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={handleClearCache}
                className="text-xs text-rose-600 hover:text-rose-700 underline underline-offset-2 flex items-center gap-1 py-1"
              >
                <Trash2 className="w-3 h-3" />
                <span>Reset Local Cache</span>
              </button>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 bg-zinc-50 border-t border-zinc-200 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 min-h-[44px] text-xs font-medium text-zinc-700 hover:bg-zinc-200/70 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            id="btn-save-engine-settings"
            onClick={handleSave}
            className="px-5 py-2 min-h-[44px] text-xs font-semibold bg-zinc-900 text-white hover:bg-zinc-800 active:scale-95 rounded-xl transition-all shadow-xs"
          >
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
};
