import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Send,
  Trash2,
  Copy,
  Check,
  Sparkles,
  Cpu,
  Bot,
  User,
  Download,
  Terminal,
  FileCode,
  PenTool,
  BrainCircuit,
  Loader2,
  Square,
  HardDrive
} from 'lucide-react';
import { ChatMessage, EngineConfig } from '../types';
import {
  LocalSmartAssistant,
  OllamaService,
  TransformersBrowserService,
  ChromeNativeAiService
} from '../services/localAiEngine';
import { webLlm } from '../services/webLlmService';
import { ModelStatusCard } from './ModelStatusCard';
import { safeStorage } from '../utils/safeStorage';

interface ChatWorkspaceProps {
  config: EngineConfig;
  onOpenSettings: () => void;
  onUpdateConfig?: (newConfig: Partial<EngineConfig>) => void;
}

const STARTER_PROMPTS = [
  {
    title: 'Local AI Architecture',
    prompt: 'How does Local AI work without using any API keys, and what are its privacy advantages?',
    icon: BrainCircuit
  },
  {
    title: 'TypeScript Utility',
    prompt: 'Write a type-safe TypeScript debounce function with cleanup and leading-edge options.',
    icon: FileCode
  },
  {
    title: 'Product Brainstorming',
    prompt: 'Suggest 4 innovative application ideas built specifically around privacy-first local computing.',
    icon: Sparkles
  },
  {
    title: 'Technical Summary',
    prompt: 'Summarize the differences between WebAssembly in-browser inference and localhost Ollama models.',
    icon: Terminal
  }
];

const PERSONAS = [
  { id: 'general', name: 'General Assistant', icon: Bot, prompt: 'You are a helpful, versatile local AI assistant running on-device.' },
  { id: 'coding', name: 'Code Architect', icon: FileCode, prompt: 'You are an expert software engineer specializing in clean TypeScript and modern architecture.' },
  { id: 'writing', name: 'Writing Editor', icon: PenTool, prompt: 'You are a meticulous copy editor focused on clarity, rhythm, and active voice.' },
  { id: 'research', name: 'Research Analyst', icon: BrainCircuit, prompt: 'You are an analytical researcher who provides structured breakdowns and balanced insights.' }
];

export const ChatWorkspace: React.FC<ChatWorkspaceProps> = ({ config, onOpenSettings, onUpdateConfig }) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = safeStorage.getItem('local_ai_chat_history');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved chat', e);
      }
    }
    return [
      {
        id: 'welcome-msg',
        role: 'assistant',
        content: `👋 **Welcome to Local AI Studio!**\n\nThis application is running **100% locally with zero API keys required**. No external credentials, credit cards, or cloud tokens are required anywhere.\n\n### Available On-Device Engines:\n1. **WebGPU Neural LLM**: Real quantized Large Language Models (SmolLM2, Qwen 2.5, Llama 3.2) streaming on-device via WebGPU.\n2. **Pure Local NLP (Instant)**: Zero-download, 0ms latency, client-side semantic reasoning and NLP.\n3. **Transformers (WASM)**: In-browser neural net via ONNX Runtime Web.\n4. **Ollama Localhost**: Connect to your machine's \`http://localhost:11434\` daemon.\n5. **Chrome Native AI**: Built-in Gemini Nano if supported by your browser.\n\nType a message below or tap a starter prompt to begin!`,
        timestamp: Date.now(),
        engineUsed: config.activeEngine,
        stats: { latencyMs: 1, tokensEstimated: 95 }
      }
    ];
  });

  const [input, setInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState(PERSONAS[0]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [streamedText, setStreamedText] = useState('');
  const abortControllerRef = useRef<AbortController | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      safeStorage.setItem('local_ai_chat_history', JSON.stringify(messages));
    } catch {
      // safe fallback
    }
    scrollToBottom();
  }, [messages, streamedText]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleCopy = (text: string, id: string) => {
    try {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // safe fallback
    }
  };

  const handleClearHistory = () => {
    setShowClearConfirm(false);
    const resetMsg: ChatMessage = {
      id: `welcome-${Date.now()}`,
      role: 'assistant',
      content: `Chat history cleared. All local state reset. Zero external logs created.\n\nReady for your next request!`,
      timestamp: Date.now(),
      engineUsed: config.activeEngine
    };
    setMessages([resetMsg]);
  };

  const handleExportMarkdown = () => {
    const md = messages
      .map(m => `### ${m.role.toUpperCase()} (${new Date(m.timestamp).toLocaleTimeString()})\n\n${m.content}\n\n---\n`)
      .join('\n');
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `local-ai-chat-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isGenerating) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsGenerating(true);
    setStreamedText('');

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const startTime = performance.now();
    let finalAssistantText = '';

    try {
      if (config.activeEngine === 'web-llm') {
        // In-browser WebGPU Neural LLM
        if (!webLlm.isReady()) {
          // If not loaded, attempt to auto-load or notify
          setStreamedText('Loading on-device model weights into WebGPU...');
          await webLlm.loadModel(config.webLlmModel || 'SmolLM2-360M-Instruct-q4f16_1-MLC');
          setStreamedText('');
        }

        const chatHistoryForLlm = [
          { role: 'system' as const, content: `${config.systemPrompt}\n${selectedPersona.prompt}` },
          ...messages.slice(-4).map(m => ({
            role: (m.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
            content: m.content
          })),
          { role: 'user' as const, content: trimmed }
        ];

        finalAssistantText = await webLlm.streamChat(
          chatHistoryForLlm,
          (token) => {
            setStreamedText(prev => prev + token);
          },
          config.temperature,
          controller.signal
        );
      } else if (config.activeEngine === 'ollama-local') {
        // Stream from Ollama daemon
        finalAssistantText = await OllamaService.streamGenerate(
          config.ollamaUrl,
          config.ollamaModel,
          trimmed,
          selectedPersona.prompt,
          (chunk) => {
            setStreamedText(prev => prev + chunk);
          },
          config.temperature
        );
      } else if (config.activeEngine === 'chrome-ai') {
        if (ChromeNativeAiService.isAvailable()) {
          finalAssistantText = await ChromeNativeAiService.prompt(trimmed, selectedPersona.prompt);
        } else {
          finalAssistantText = `*Chrome Built-in AI (Prompt API) was not detected in this browser session. Falling back to Pure Local Assistant:*\n\n` +
            LocalSmartAssistant.generateResponse(trimmed, selectedPersona.id);
        }
      } else if (config.activeEngine === 'transformers-wasm') {
        // Run Transformers.js in browser
        finalAssistantText = await TransformersBrowserService.generate(trimmed, 80);
      } else {
        // Default: Instant Pure Local Assistant
        await new Promise(r => setTimeout(r, 60)); // Micro-tick for natural feel
        finalAssistantText = LocalSmartAssistant.generateResponse(trimmed, selectedPersona.id);
      }
    } catch (err: any) {
      if (controller.signal.aborted) {
        finalAssistantText = streamedText + '\n\n*(Generation stopped by user)*';
      } else {
        finalAssistantText = `⚠️ **Local Engine Notice**: ${err.message || 'Error executing local inference.'}\n\n` +
          `*Tip: If WebGPU is not supported by this browser, you can switch to the Instant Pure Local Engine or Ollama in Engine Settings.*`;
      }
    } finally {
      const elapsed = Math.round(performance.now() - startTime);
      const outputText = finalAssistantText || streamedText || 'No response generated.';
      const estTokens = Math.round(outputText.split(/\s+/).length * 1.3);

      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: outputText,
        timestamp: Date.now(),
        engineUsed: config.activeEngine,
        modelUsed: config.activeEngine === 'web-llm' ? config.webLlmModel : undefined,
        stats: {
          latencyMs: elapsed,
          tokensEstimated: estTokens
        }
      };

      setMessages(prev => [...prev, assistantMessage]);
      setStreamedText('');
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const getEngineBadgeLabel = (engine: string) => {
    switch (engine) {
      case 'web-llm':
        return 'WebGPU Neural LLM';
      case 'in-browser-nlp':
        return 'Pure Local NLP';
      case 'transformers-wasm':
        return 'Transformers (WASM)';
      case 'ollama-local':
        return 'Ollama Localhost';
      case 'chrome-ai':
        return 'Chrome Native AI';
      default:
        return 'Local Engine';
    }
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-5.5rem)] md:h-[calc(100vh-6.5rem)] max-w-5xl mx-auto px-3 sm:px-6 py-2 sm:py-4 pb-20 md:pb-4 w-full">
      {/* Top Controls Bar */}
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-zinc-200">
        {/* Persona Selector (Mobile horizontal swipe) */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 text-xs max-w-[80%] sm:max-w-none">
          <span className="text-zinc-500 font-medium whitespace-nowrap mr-0.5 hidden sm:inline">Role:</span>
          {PERSONAS.map((p) => {
            const Icon = p.icon;
            const isSelected = selectedPersona.id === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setSelectedPersona(p)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap min-h-[36px] sm:min-h-0 ${
                  isSelected
                    ? 'bg-zinc-900 text-white font-medium shadow-xs'
                    : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200/80 active:bg-zinc-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span>{p.name}</span>
              </button>
            );
          })}
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            id="btn-export-chat"
            onClick={handleExportMarkdown}
            className="w-8 h-8 sm:w-8 sm:h-8 flex items-center justify-center text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 rounded-lg transition-colors"
            title="Export conversation as Markdown"
            aria-label="Export chat"
          >
            <Download className="w-4 h-4" />
          </button>
          {showClearConfirm ? (
            <div className="flex items-center gap-1 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-lg text-xs">
              <span className="text-rose-700 font-medium">Clear chat?</span>
              <button
                onClick={handleClearHistory}
                className="px-1.5 py-0.5 bg-rose-600 text-white rounded text-[11px] font-semibold hover:bg-rose-700"
              >
                Yes
              </button>
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-1.5 py-0.5 text-zinc-600 hover:text-zinc-900 text-[11px]"
              >
                No
              </button>
            </div>
          ) : (
            <button
              id="btn-clear-chat"
              onClick={() => setShowClearConfirm(true)}
              className="w-8 h-8 sm:w-8 sm:h-8 flex items-center justify-center text-zinc-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
              title="Clear conversation"
              aria-label="Clear chat history"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* In-Browser WebGPU LLM Status Card */}
      {config.activeEngine === 'web-llm' && (
        <div className="mt-2.5">
          <ModelStatusCard
            modelId={config.webLlmModel || 'SmolLM2-360M-Instruct-q4f16_1-MLC'}
            onSwitchToPureNlp={() => {
              if (onUpdateConfig) {
                onUpdateConfig({ activeEngine: 'in-browser-nlp' });
              } else {
                onOpenSettings();
              }
            }}
          />
        </div>
      )}

      {/* Message Feed */}
      <div className="flex-1 overflow-y-auto py-3 space-y-4 pr-1 sm:pr-2">
        {messages.map((m) => {
          const isUser = m.role === 'user';
          return (
            <div
              key={m.id}
              className={`flex items-start gap-2 sm:gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {/* Avatar */}
              <div
                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                  isUser
                    ? 'bg-zinc-900 text-white'
                    : 'bg-white text-emerald-700 border border-zinc-200'
                }`}
              >
                {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              {/* Message Bubble Container */}
              <div
                className={`group relative max-w-[90%] sm:max-w-[85%] rounded-2xl p-3 sm:p-4 text-sm leading-relaxed ${
                  isUser
                    ? 'bg-zinc-900 text-white shadow-xs'
                    : 'bg-white text-zinc-800 border border-zinc-200 shadow-xs'
                }`}
              >
                {/* Header Tag for Assistant */}
                {!isUser && (
                  <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-zinc-100 text-xs text-zinc-400">
                    <div className="flex items-center gap-1.5 font-medium text-zinc-600 truncate">
                      <Cpu className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="truncate">{m.engineUsed ? getEngineBadgeLabel(m.engineUsed) : 'On-Device Engine'}</span>
                      {m.modelUsed && (
                        <span className="text-[10px] px-1 py-0.2 bg-zinc-100 rounded text-zinc-500 font-mono hidden sm:inline">
                          {m.modelUsed.split('-')[0]}
                        </span>
                      )}
                    </div>
                    {m.stats && (
                      <span className="text-[10px] sm:text-[11px] text-zinc-400 whitespace-nowrap">
                        ⚡ {m.stats.latencyMs}ms • ~{m.stats.tokensEstimated} tok
                      </span>
                    )}
                  </div>
                )}

                {/* Content */}
                {isUser ? (
                  <p className="whitespace-pre-wrap break-words">{m.content}</p>
                ) : (
                  <div className="prose prose-sm max-w-none text-zinc-800 break-words prose-pre:bg-zinc-900 prose-pre:text-zinc-100 prose-pre:rounded-xl prose-pre:p-3 prose-code:text-emerald-700 prose-code:bg-emerald-50/60 prose-code:px-1 prose-code:py-0.5 prose-code:rounded">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                )}

                {/* Copy button */}
                <button
                  onClick={() => handleCopy(m.content, m.id)}
                  className={`absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md min-w-[32px] min-h-[32px] flex items-center justify-center ${
                    isUser
                      ? 'text-zinc-300 hover:text-white hover:bg-zinc-800'
                      : 'text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100'
                  }`}
                  title="Copy message"
                  aria-label="Copy message content"
                >
                  {copiedId === m.id ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          );
        })}

        {/* Live Streaming State */}
        {isGenerating && (
          <div className="flex items-start gap-2 sm:gap-3">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-white text-emerald-700 border border-zinc-200 flex items-center justify-center shrink-0 shadow-xs animate-pulse">
              <Bot className="w-4 h-4" />
            </div>
            <div className="max-w-[90%] sm:max-w-[85%] rounded-2xl p-3 sm:p-4 bg-white border border-zinc-200 shadow-xs text-sm">
              <div className="flex items-center justify-between gap-2 mb-2 pb-1 border-b border-zinc-100 text-xs text-indigo-700 font-medium">
                <div className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Streaming directly from device hardware...</span>
                </div>
                <button
                  type="button"
                  onClick={handleStopGeneration}
                  className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] bg-rose-50 text-rose-700 border border-rose-200 rounded-md hover:bg-rose-100 transition-colors"
                >
                  <Square className="w-3 h-3 fill-current" />
                  <span>Stop</span>
                </button>
              </div>
              {streamedText ? (
                <div className="prose prose-sm max-w-none text-zinc-800 break-words">
                  <ReactMarkdown>{streamedText}</ReactMarkdown>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-zinc-400 py-1">
                  <span className="w-2 h-2 rounded-full bg-zinc-300 animate-bounce"></span>
                  <span className="w-2 h-2 rounded-full bg-zinc-300 animate-bounce [animation-delay:0.2s]"></span>
                  <span className="w-2 h-2 rounded-full bg-zinc-300 animate-bounce [animation-delay:0.4s]"></span>
                </div>
              )}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Starter Prompts (visible if only welcome message exists) */}
      {messages.length <= 1 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 my-2">
          {STARTER_PROMPTS.map((sp, idx) => {
            const Icon = sp.icon;
            return (
              <button
                key={idx}
                id={`starter-prompt-${idx}`}
                onClick={() => {
                  setInput(sp.prompt);
                  textareaRef.current?.focus();
                }}
                className="flex items-start gap-2.5 p-3 text-left rounded-xl bg-zinc-50 hover:bg-zinc-100/90 active:bg-zinc-100 border border-zinc-200/80 transition-all group min-h-[52px]"
              >
                <div className="w-7 h-7 rounded-lg bg-white border border-zinc-200 flex items-center justify-center text-zinc-700 shrink-0 group-hover:text-emerald-600 transition-colors">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-zinc-900">{sp.title}</p>
                  <p className="text-[11px] text-zinc-500 line-clamp-1 mt-0.5">{sp.prompt}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Input Composer */}
      <form onSubmit={handleSubmit} className="mt-1 relative">
        <div className="flex flex-col bg-white border border-zinc-300 focus-within:border-zinc-900 rounded-2xl shadow-xs transition-colors p-2">
          <textarea
            ref={textareaRef}
            id="chat-input-textarea"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message... (100% on-device, zero API keys)"
            rows={2}
            className="w-full bg-transparent resize-none border-none outline-hidden text-base sm:text-sm text-zinc-900 placeholder:text-zinc-400 px-2 pt-1 pb-1.5 leading-relaxed"
          />

          <div className="flex items-center justify-between pt-1 border-t border-zinc-100 px-1 gap-2">
            <div className="flex items-center gap-1.5 text-[11px] sm:text-xs text-zinc-400 truncate">
              <button
                type="button"
                onClick={onOpenSettings}
                className="hover:text-zinc-700 underline underline-offset-2 truncate"
              >
                Engine: {getEngineBadgeLabel(config.activeEngine)}
              </button>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {isGenerating ? (
                <button
                  type="button"
                  onClick={handleStopGeneration}
                  className="flex items-center justify-center min-w-[44px] min-h-[44px] w-11 h-11 rounded-xl bg-rose-600 text-white hover:bg-rose-700 transition-all shadow-xs"
                  title="Stop Generating"
                  aria-label="Stop generation"
                >
                  <Square className="w-4 h-4 fill-current" />
                </button>
              ) : (
                <button
                  id="btn-send-message"
                  type="submit"
                  disabled={!input.trim()}
                  className="flex items-center justify-center min-w-[44px] min-h-[44px] w-11 h-11 rounded-xl bg-zinc-900 text-white disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-800 active:scale-95 transition-all shadow-xs"
                  title="Send Prompt (Runs 100% locally)"
                  aria-label="Send message"
                >
                  <Send className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
