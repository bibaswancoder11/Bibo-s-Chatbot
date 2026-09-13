import React, { useEffect, useState } from 'react';
import {
  BrainCircuit,
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
  Cpu,
  ChevronDown,
  ChevronUp,
  X
} from 'lucide-react';
import { webLlm, LOCAL_LLM_MODELS, LoadingStatus } from '../services/webLlmService';

interface ModelStatusCardProps {
  modelId: string;
  onSwitchToPureNlp?: () => void;
  onModelLoaded?: () => void;
}

export const ModelStatusCard: React.FC<ModelStatusCardProps> = ({
  modelId,
  onSwitchToPureNlp,
  onModelLoaded,
}) => {
  const [status, setStatus] = useState<LoadingStatus>(webLlm.getStatus());
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [hasGpu, setHasGpu] = useState(true);

  useEffect(() => {
    setHasGpu(webLlm.hasWebGpu());
    const unsubscribe = webLlm.subscribe((newStatus) => {
      setStatus(newStatus);
      if (newStatus.phase === 'ready' && onModelLoaded) {
        onModelLoaded();
      }
    });
    return unsubscribe;
  }, [onModelLoaded]);

  const currentModelMeta = LOCAL_LLM_MODELS.find(m => m.id === modelId) || LOCAL_LLM_MODELS[0];

  const handleLoad = async () => {
    try {
      await webLlm.loadModel(modelId);
    } catch (err) {
      console.error('Failed to load local model:', err);
    }
  };

  const handleUnload = async () => {
    await webLlm.unload();
  };

  // If collapsed on mobile when ready, show a minimal bar
  if (status.phase === 'ready' && isCollapsed) {
    return (
      <div className="flex items-center justify-between px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 mb-3 shadow-xs">
        <div className="flex items-center gap-1.5 truncate">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="font-medium truncate">{currentModelMeta.name}</span>
          <span className="text-[11px] text-emerald-600 hidden sm:inline">• Active on WebGPU</span>
        </div>
        <button
          onClick={() => setIsCollapsed(false)}
          className="p-1 hover:bg-emerald-100 rounded text-emerald-700 transition-colors"
          title="Expand Model Controls"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white border border-indigo-100 rounded-2xl p-3 sm:p-4 shadow-xs mb-3 transition-all">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 shrink-0">
            <BrainCircuit className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xs sm:text-sm font-semibold text-zinc-900">
                Local Neural LLM: {currentModelMeta.name}
              </h3>
              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-indigo-100/70 text-indigo-800 rounded-md border border-indigo-200">
                ~{currentModelMeta.sizeMb} MB
              </span>
              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-emerald-50 text-emerald-700 rounded-md border border-emerald-200">
                Zero API Keys
              </span>
            </div>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              {currentModelMeta.description}
            </p>
          </div>
        </div>

        {status.phase === 'ready' && (
          <button
            onClick={() => setIsCollapsed(true)}
            className="p-1 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors"
            title="Collapse"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* WebGPU Hardware Check */}
      {!hasGpu && (
        <div className="mt-2.5 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold">WebGPU is not enabled or supported in this browser.</p>
            <p className="text-[11px] mt-0.5 text-amber-700">
              For immediate 100% on-device AI without GPU support, switch to the Pure Local Engine or connect Ollama.
            </p>
            {onSwitchToPureNlp && (
              <button
                onClick={onSwitchToPureNlp}
                className="mt-1.5 inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-600 text-white rounded-lg font-medium text-[11px] hover:bg-amber-700 active:scale-95 transition-all"
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>Switch to Pure Local NLP (Instant)</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Progress / Status Bar */}
      {(status.phase === 'downloading' || status.phase === 'compiling') && (
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-indigo-950 flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
              <span>{status.phase === 'compiling' ? 'Compiling WebGPU shaders...' : 'Loading model shards into device memory...'}</span>
            </span>
            <span className="font-semibold text-indigo-600">{status.progress}%</span>
          </div>

          <div className="w-full h-2 bg-indigo-50 rounded-full overflow-hidden border border-indigo-100">
            <div
              className="h-full bg-indigo-600 rounded-full transition-all duration-300"
              style={{ width: `${Math.max(5, status.progress)}%` }}
            />
          </div>

          <p className="text-[10px] text-zinc-500 truncate font-mono">
            {status.text}
          </p>
        </div>
      )}

      {/* State: Idle -> Ready to load */}
      {status.phase === 'idle' && hasGpu && (
        <div className="mt-3 pt-2.5 border-t border-zinc-100 flex items-center justify-between gap-2 flex-wrap">
          <div className="text-[11px] text-zinc-500 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-zinc-300"></span>
            <span>Weights stay in your browser CacheStorage once loaded.</span>
          </div>

          <div className="flex items-center gap-2">
            {onSwitchToPureNlp && (
              <button
                type="button"
                onClick={onSwitchToPureNlp}
                className="text-xs text-zinc-600 hover:text-zinc-900 px-2.5 py-1.5 rounded-lg hover:bg-zinc-100 transition-colors"
              >
                Use Instant NLP
              </button>
            )}

            <button
              id="btn-load-web-llm"
              type="button"
              onClick={handleLoad}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-medium text-xs rounded-xl shadow-xs transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Load Model to GPU ({currentModelMeta.sizeMb}MB)</span>
            </button>
          </div>
        </div>
      )}

      {/* State: Ready */}
      {status.phase === 'ready' && (
        <div className="mt-2.5 pt-2 border-t border-zinc-100 flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-emerald-700 font-medium text-[11px] sm:text-xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Active on WebGPU • Zero API Keys • Full Streaming</span>
          </span>

          <button
            type="button"
            onClick={handleUnload}
            className="text-[11px] text-zinc-500 hover:text-rose-600 px-2 py-1 rounded-md hover:bg-rose-50 transition-colors"
            title="Unload from GPU memory to free RAM"
          >
            Unload Model
          </button>
        </div>
      )}

      {/* State: Error */}
      {status.phase === 'error' && (
        <div className="mt-2.5 p-2 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 space-y-1.5">
          <p className="font-semibold flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>Initialization Notice</span>
          </p>
          <p className="text-[11px]">{status.text}</p>
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleLoad}
              className="px-2.5 py-1 bg-rose-600 text-white rounded-lg text-[11px] font-medium hover:bg-rose-700 transition-colors"
            >
              Retry
            </button>
            {onSwitchToPureNlp && (
              <button
                onClick={onSwitchToPureNlp}
                className="px-2.5 py-1 bg-white border border-rose-200 text-rose-700 rounded-lg text-[11px] font-medium hover:bg-rose-100 transition-colors"
              >
                Switch to Pure Local NLP (0 MB)
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
