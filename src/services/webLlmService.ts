// Dynamic import is used for @mlc-ai/web-llm so the 6MB+ engine is loaded
// strictly on-demand, preventing initial page freeze and ensuring instant startup
// across all devices and sandboxed iframe environments.

export interface LocalLlmModelOption {
  id: string;
  name: string;
  sizeMb: number;
  description: string;
  recommendedFor: string;
}

export const LOCAL_LLM_MODELS: LocalLlmModelOption[] = [
  {
    id: 'SmolLM2-360M-Instruct-q4f16_1-MLC',
    name: 'SmolLM2 360M (Quantized)',
    sizeMb: 240,
    description: 'Ultra-fast, lightweight neural LLM running on-device via WebGPU.',
    recommendedFor: 'Mobile & low-RAM devices (Recommended)'
  },
  {
    id: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC',
    name: 'Qwen 2.5 0.5B Instruct',
    sizeMb: 390,
    description: 'High accuracy instruction following and coding in under 400MB.',
    recommendedFor: 'General reasoning & coding'
  },
  {
    id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
    name: 'Llama 3.2 1B Instruct',
    sizeMb: 880,
    description: 'Meta\'s Llama 3.2 quantized for private client-side execution.',
    recommendedFor: 'Desktops with discrete GPU'
  }
];

export interface LoadingStatus {
  phase: 'idle' | 'checking' | 'downloading' | 'compiling' | 'ready' | 'error';
  progress: number;
  text: string;
  modelId?: string;
  timeRemaining?: string;
}

type StatusListener = (status: LoadingStatus) => void;

class WebLlmManager {
  private engine: any = null;
  private currentModelId: string | null = null;
  private isInitializing = false;
  private status: LoadingStatus = {
    phase: 'idle',
    progress: 0,
    text: 'Model not yet loaded to GPU memory.'
  };
  private listeners: Set<StatusListener> = new Set();

  hasWebGpu(): boolean {
    try {
      return typeof navigator !== 'undefined' && 'gpu' in navigator && !!(navigator as any).gpu;
    } catch {
      return false;
    }
  }

  isReady(): boolean {
    return this.engine !== null && !this.isInitializing;
  }

  isLoading(): boolean {
    return this.isInitializing;
  }

  getCurrentModel(): string | null {
    return this.currentModelId;
  }

  getStatus(): LoadingStatus {
    return { ...this.status, modelId: this.currentModelId || undefined };
  }

  subscribe(listener: StatusListener): () => void {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(status: LoadingStatus) {
    this.status = status;
    this.listeners.forEach((l) => l(status));
  }

  async loadModel(
    modelId: string,
    onProgress?: (status: LoadingStatus) => void
  ): Promise<any> {
    if (this.engine && this.currentModelId === modelId) {
      const readyStatus: LoadingStatus = {
        phase: 'ready',
        progress: 100,
        text: `Model ${modelId} is loaded and ready on your GPU.`,
        modelId
      };
      this.notify(readyStatus);
      if (onProgress) onProgress(readyStatus);
      return this.engine;
    }

    if (!this.hasWebGpu()) {
      const err = 'WebGPU is not supported or enabled in this browser. Please use the Pure Local Engine or Ollama.';
      const errorStatus: LoadingStatus = {
        phase: 'error',
        progress: 0,
        text: err,
        modelId
      };
      this.notify(errorStatus);
      if (onProgress) onProgress(errorStatus);
      throw new Error(err);
    }

    this.isInitializing = true;
    const initialStatus: LoadingStatus = {
      phase: 'downloading',
      progress: 5,
      text: 'Loading WebLLM engine module...',
      modelId
    };
    this.notify(initialStatus);
    if (onProgress) onProgress(initialStatus);

    try {
      const { CreateMLCEngine } = await import('@mlc-ai/web-llm');

      const progressCallback = (report: any) => {
        const percent = Math.round(report.progress * 100);
        let phase: LoadingStatus['phase'] = 'downloading';
        const lowerText = (report.text || '').toLowerCase();
        if (
          lowerText.includes('compile') ||
          lowerText.includes('finish') ||
          lowerText.includes('shader') ||
          lowerText.includes('warming')
        ) {
          phase = 'compiling';
        }
        const updatedStatus: LoadingStatus = {
          phase,
          progress: percent,
          text: report.text || 'Loading local model weights into GPU...',
          modelId
        };
        this.notify(updatedStatus);
        if (onProgress) onProgress(updatedStatus);
      };

      const engine = await CreateMLCEngine(modelId, {
        initProgressCallback: progressCallback,
        logLevel: 'INFO'
      });

      this.engine = engine;
      this.currentModelId = modelId;
      this.isInitializing = false;

      const readyStatus: LoadingStatus = {
        phase: 'ready',
        progress: 100,
        text: 'Local neural LLM loaded! Inference is executing 100% on-device.',
        modelId
      };
      this.notify(readyStatus);
      if (onProgress) onProgress(readyStatus);

      return engine;
    } catch (err: any) {
      this.isInitializing = false;
      this.engine = null;
      this.currentModelId = null;
      const errorMsg = err?.message || 'Failed to initialize local LLM on WebGPU';
      const errorStatus: LoadingStatus = {
        phase: 'error',
        progress: 0,
        text: errorMsg,
        modelId
      };
      this.notify(errorStatus);
      if (onProgress) onProgress(errorStatus);
      throw new Error(errorMsg);
    }
  }

  async streamChat(
    messages: { role: 'system' | 'user' | 'assistant'; content: string }[],
    onToken: (token: string) => void,
    temperature = 0.7,
    signal?: AbortSignal
  ): Promise<string> {
    if (!this.engine) {
      throw new Error('Local LLM engine is not loaded. Please load the model first.');
    }

    const chunks = await this.engine.chat.completions.create({
      messages: messages as any,
      stream: true,
      temperature,
      max_tokens: 1024
    });

    let fullText = '';
    for await (const chunk of chunks) {
      if (signal?.aborted) {
        break;
      }
      const token = chunk.choices[0]?.delta?.content || '';
      if (token) {
        fullText += token;
        onToken(token);
      }
    }

    return fullText;
  }

  async unload() {
    if (this.engine) {
      await this.engine.unload();
      this.engine = null;
      this.currentModelId = null;
      this.notify({
        phase: 'idle',
        progress: 0,
        text: 'Model unloaded from GPU memory.'
      });
    }
  }
}

export const webLlm = new WebLlmManager();
