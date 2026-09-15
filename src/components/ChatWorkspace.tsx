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
  HardDrive,
  Mic,
  MicOff,
  Camera,
  Paperclip,
  Volume2,
  VolumeX,
  FileText,
  Image as ImageIcon,
  X,
  UploadCloud,
  Eye,
  AlertCircle
} from 'lucide-react';
import { ChatMessage, EngineConfig, ChatAttachment, VoiceInputMeta, CameraCaptureMeta } from '../types';
import {
  LocalSmartAssistant,
  OllamaService,
  TransformersBrowserService,
  ChromeNativeAiService
} from '../services/localAiEngine';
import { webLlm } from '../services/webLlmService';
import { ModelStatusCard } from './ModelStatusCard';
import { safeStorage } from '../utils/safeStorage';
import { SpeechService, FileParserService, buildMultimodalPrompt } from '../services/multimodalService';
import { CameraCaptureModal } from './CameraCaptureModal';

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
        content: `👋 **Welcome to Local AI Studio!**\n\nThis application is running **100% locally with zero API keys required**. No external credentials, credit cards, or cloud tokens are required anywhere.\n\n### Available Multi-Modal & Local AI Capabilities:\n1. **🎙️ Voice Input & Transcription**: Tap the microphone button to speak naturally. Your speech is transcribed locally and answered directly!\n2. **📁 File & Code Attachment**: Attach documents, datasets, or code files via the paperclip or drag-and-drop for offline analysis.\n3. **📷 Camera Snapshot**: Use your device camera or webcam to capture photos and inspect visual characteristics completely on-device.\n4. **⚡ On-Device Neural Engines**: WebGPU LLMs (SmolLM2, Qwen), Transformers (WASM), Ollama Localhost, and Pure Local NLP.\n\nType a question, speak via the mic, or attach a file/photo below to begin!`,
        timestamp: Date.now(),
        engineUsed: config.activeEngine,
        stats: { latencyMs: 1, tokensEstimated: 120 }
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

  // Multi-modal state
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [cameraCapture, setCameraCapture] = useState<CameraCaptureMeta | null>(null);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [isVoiceListening, setIsVoiceListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [isSpeakingMessageId, setIsSpeakingMessageId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
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

  // Clean up speech recognition on unmount
  useEffect(() => {
    return () => {
      SpeechService.stopRecognition();
      SpeechService.stopSpeaking();
    };
  }, []);

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
    SpeechService.stopSpeaking();
    setIsSpeakingMessageId(null);
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

  // Text-To-Speech Playback
  const handleToggleSpeech = (msg: ChatMessage) => {
    if (isSpeakingMessageId === msg.id) {
      SpeechService.stopSpeaking();
      setIsSpeakingMessageId(null);
    } else {
      setIsSpeakingMessageId(msg.id);
      SpeechService.speak(msg.content, () => {
        setIsSpeakingMessageId(null);
      });
    }
  };

  // Voice Input (Speech-to-Text) Toggle
  const handleToggleVoice = () => {
    setVoiceError(null);

    if (isVoiceListening) {
      SpeechService.stopRecognition();
      setIsVoiceListening(false);
      return;
    }

    if (!SpeechService.isRecognitionSupported()) {
      setVoiceError('Speech recognition is not supported in this browser. Please use Chrome/Edge or type your question.');
      return;
    }

    setLiveTranscript('');
    setIsVoiceListening(true);

    const started = SpeechService.startRecognition({
      onInterim: (text) => {
        setLiveTranscript(text);
      },
      onFinal: (text) => {
        setLiveTranscript(text);
      },
      onError: (err) => {
        setVoiceError(err);
        setIsVoiceListening(false);
      },
      onEnd: () => {
        setIsVoiceListening(false);
      }
    });

    if (!started) {
      setIsVoiceListening(false);
    }
  };

  // Immediate Transcribe & Submit
  const handleVoiceTranscribeAndSubmit = () => {
    const spoken = liveTranscript.trim();
    SpeechService.stopRecognition();
    setIsVoiceListening(false);

    if (spoken) {
      const voiceMeta: VoiceInputMeta = {
        transcription: spoken,
        isLiveTranscript: true
      };
      handleSubmit(undefined, spoken, voiceMeta);
    }
  };

  // Insert transcript into text input for user edits
  const handleInsertTranscript = () => {
    const spoken = liveTranscript.trim();
    SpeechService.stopRecognition();
    setIsVoiceListening(false);
    if (spoken) {
      setInput(prev => (prev ? `${prev} ${spoken}` : spoken));
      textareaRef.current?.focus();
    }
  };

  // File Upload Handlers
  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      try {
        const parsed = await FileParserService.parseFile(files[i]);
        setAttachments(prev => [...prev, parsed]);
      } catch (err) {
        console.warn('File parse error:', err);
      }
    }
    // reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveAttachment = (id: string) => {
    setAttachments(prev => prev.filter(a => a.id !== id));
  };

  // Drag and Drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      try {
        const parsed = await FileParserService.parseFile(files[i]);
        setAttachments(prev => [...prev, parsed]);
      } catch (err) {
        console.warn('Drop parse error:', err);
      }
    }
  };

  // Core Submit logic supporting text, voice, files, and camera
  const handleSubmit = async (
    e?: React.FormEvent,
    overrideText?: string,
    specificVoiceMeta?: VoiceInputMeta
  ) => {
    if (e) e.preventDefault();
    const effectiveText = (overrideText !== undefined ? overrideText : input).trim();

    // Check if there is any content to send (text, voice, files, or camera)
    const hasAttachments = attachments.length > 0;
    const hasCamera = !!cameraCapture;
    const hasVoice = !!specificVoiceMeta;

    if (!effectiveText && !hasAttachments && !hasCamera && !hasVoice) return;
    if (isGenerating) return;

    // Build multimodal prompt context
    const currentAttachments = [...attachments];
    const currentCamera = cameraCapture;
    const currentVoice = specificVoiceMeta;

    const { promptForModel, base64Images } = buildMultimodalPrompt(
      effectiveText,
      currentAttachments,
      currentCamera,
      currentVoice
    );

    // Display text in user bubble: display user text or transcribed speech or default prompt
    const displayUserContent = effectiveText ||
      (currentVoice ? currentVoice.transcription : '') ||
      (currentCamera ? 'Analyze and explain this camera capture.' : '') ||
      (hasAttachments ? `Analyze attached ${currentAttachments.length} file(s).` : 'Prompt');

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: displayUserContent,
      timestamp: Date.now(),
      attachments: currentAttachments.length > 0 ? currentAttachments : undefined,
      cameraCapture: currentCamera || undefined,
      voiceInput: currentVoice || undefined
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setAttachments([]);
    setCameraCapture(null);
    setLiveTranscript('');
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
          { role: 'user' as const, content: promptForModel }
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
        // Stream from Ollama daemon (with vision base64 support if present)
        finalAssistantText = await OllamaService.streamGenerate(
          config.ollamaUrl,
          config.ollamaModel,
          promptForModel,
          selectedPersona.prompt,
          (chunk) => {
            setStreamedText(prev => prev + chunk);
          },
          config.temperature,
          base64Images
        );
      } else if (config.activeEngine === 'chrome-ai') {
        if (ChromeNativeAiService.isAvailable()) {
          finalAssistantText = await ChromeNativeAiService.prompt(promptForModel, selectedPersona.prompt);
        } else {
          finalAssistantText = `*Chrome Built-in AI was not detected in this browser session. Using Pure Local Assistant:*\n\n` +
            LocalSmartAssistant.generateResponse(promptForModel, selectedPersona.id);
        }
      } else if (config.activeEngine === 'transformers-wasm') {
        finalAssistantText = await TransformersBrowserService.generate(promptForModel, 100);
      } else {
        // Instant Pure Local Assistant
        await new Promise(r => setTimeout(r, 60)); // Micro-tick for natural response feel
        finalAssistantText = LocalSmartAssistant.generateResponse(promptForModel, selectedPersona.id);
      }
    } catch (err: any) {
      if (controller.signal.aborted) {
        finalAssistantText = streamedText + '\n\n*(Generation stopped by user)*';
      } else {
        finalAssistantText = `⚠️ **Local Engine Notice**: ${err.message || 'Error executing local inference.'}\n\n` +
          `*Tip: If WebGPU is not supported by this browser, you can switch to the Instant Pure Local Engine in Engine Settings.*`;
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
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative flex flex-col h-[calc(100dvh-5.5rem)] md:h-[calc(100vh-6.5rem)] max-w-5xl mx-auto px-3 sm:px-6 py-2 sm:py-4 pb-20 md:pb-4 w-full"
    >
      {/* Drag & Drop Visual Overlay */}
      {isDragging && (
        <div className="absolute inset-2 z-40 bg-zinc-900/80 backdrop-blur-xs border-2 border-dashed border-emerald-400 rounded-2xl flex flex-col items-center justify-center text-white pointer-events-none p-6 text-center">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3">
            <UploadCloud className="w-8 h-8 animate-bounce" />
          </div>
          <p className="text-base font-semibold">Drop files to attach to Local AI</p>
          <p className="text-xs text-zinc-300 mt-1">Accepts code, markdown, documents, CSV, or images</p>
        </div>
      )}

      {/* Top Controls Bar */}
      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-zinc-200 shrink-0">
        {/* Persona Selector */}
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
        <div className="mt-2 shrink-0">
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

      {/* Voice Recognition / Permission Error Notice */}
      {voiceError && (
        <div className="mt-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{voiceError}</span>
          </div>
          <button
            onClick={() => setVoiceError(null)}
            className="text-amber-600 hover:text-amber-900 font-medium p-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
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
                    <div className="flex items-center gap-2">
                      {m.stats && (
                        <span className="text-[10px] sm:text-[11px] text-zinc-400 whitespace-nowrap">
                          ⚡ {m.stats.latencyMs}ms • ~{m.stats.tokensEstimated} tok
                        </span>
                      )}
                      {/* Audio playback button */}
                      <button
                        onClick={() => handleToggleSpeech(m)}
                        className={`p-1 rounded-md transition-colors ${
                          isSpeakingMessageId === m.id
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100'
                        }`}
                        title={isSpeakingMessageId === m.id ? 'Stop reading' : 'Read aloud with local speech synthesizer'}
                      >
                        {isSpeakingMessageId === m.id ? (
                          <VolumeX className="w-3.5 h-3.5 animate-pulse" />
                        ) : (
                          <Volume2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Multimodal Badges in User Messages */}
                {isUser && m.voiceInput && (
                  <div className="mb-2 pb-1.5 border-b border-zinc-800/80 flex items-center gap-1.5 text-xs text-emerald-400">
                    <Mic className="w-3.5 h-3.5" />
                    <span className="font-medium">Transcribed Voice Input:</span>
                    <span className="italic text-zinc-300 truncate">"{m.voiceInput.transcription}"</span>
                  </div>
                )}

                {/* Camera Capture in User Messages */}
                {isUser && m.cameraCapture && (
                  <div className="mb-2.5">
                    <div className="relative inline-block rounded-xl overflow-hidden border border-zinc-700 bg-black max-w-xs group/cam">
                      <img
                        src={m.cameraCapture.dataUrl}
                        alt="Captured frame"
                        className="max-h-48 w-auto object-cover cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => setPreviewPhoto(m.cameraCapture?.dataUrl || null)}
                      />
                      <div className="absolute bottom-1 right-1 bg-black/70 backdrop-blur-xs text-[10px] text-zinc-300 px-1.5 py-0.5 rounded">
                        {m.cameraCapture.width}x{m.cameraCapture.height}
                      </div>
                    </div>
                    {m.cameraCapture.visualAnalysis && (
                      <p className="text-[11px] text-zinc-400 mt-1">
                        📷 {m.cameraCapture.visualAnalysis.description}
                      </p>
                    )}
                  </div>
                )}

                {/* Attached Files in User Messages */}
                {isUser && m.attachments && m.attachments.length > 0 && (
                  <div className="mb-2.5 flex flex-wrap gap-1.5">
                    {m.attachments.map((att) => (
                      <div
                        key={att.id}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zinc-800 border border-zinc-700 text-xs text-zinc-200"
                      >
                        {att.type === 'code' ? (
                          <FileCode className="w-3.5 h-3.5 text-blue-400" />
                        ) : att.type === 'image' ? (
                          <ImageIcon className="w-3.5 h-3.5 text-purple-400" />
                        ) : (
                          <FileText className="w-3.5 h-3.5 text-emerald-400" />
                        )}
                        <span className="font-medium max-w-[140px] truncate">{att.name}</span>
                        <span className="text-[10px] text-zinc-400">({(att.sizeBytes / 1024).toFixed(1)} KB)</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Message Text Content */}
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
                  <span>Processing completely on-device...</span>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 my-2 shrink-0">
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

      {/* Active Voice Listening Banner */}
      {isVoiceListening && (
        <div className="mb-2 p-3 bg-emerald-950/90 border border-emerald-500/40 rounded-2xl text-white shadow-lg flex flex-col gap-2 shrink-0 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
              <span className="text-xs font-semibold text-emerald-300">Listening to your voice...</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleInsertTranscript}
                disabled={!liveTranscript.trim()}
                className="px-2.5 py-1 text-[11px] bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-200 disabled:opacity-40 transition-colors"
              >
                Insert into Textbox
              </button>
              <button
                type="button"
                onClick={handleVoiceTranscribeAndSubmit}
                disabled={!liveTranscript.trim()}
                className="px-3 py-1 text-[11px] bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold rounded-lg disabled:opacity-40 transition-colors flex items-center gap-1"
              >
                <span>Transcribe & Ask</span>
                <Send className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => {
                  SpeechService.stopRecognition();
                  setIsVoiceListening(false);
                }}
                className="p-1 text-zinc-400 hover:text-white"
                title="Cancel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="bg-black/40 rounded-xl p-2.5 text-xs text-zinc-200 font-sans min-h-[42px] border border-white/5">
            {liveTranscript ? (
              <span className="text-white font-medium">{liveTranscript}</span>
            ) : (
              <span className="italic text-zinc-400">Speak now... audio is transcribed on-device in real time.</span>
            )}
          </div>
        </div>
      )}

      {/* Attachments & Camera Preview Bar above Composer */}
      {(attachments.length > 0 || cameraCapture) && (
        <div className="mb-2 p-2 bg-zinc-100/90 border border-zinc-200 rounded-xl flex items-center flex-wrap gap-2 shrink-0">
          {/* Camera preview */}
          {cameraCapture && (
            <div className="relative group/camprev flex items-center gap-2 bg-white border border-zinc-300 rounded-lg p-1 pr-2 shadow-xs">
              <img
                src={cameraCapture.dataUrl}
                alt="Camera capture preview"
                className="w-9 h-9 object-cover rounded-md cursor-pointer"
                onClick={() => setPreviewPhoto(cameraCapture.dataUrl)}
              />
              <div className="text-[11px] leading-tight">
                <p className="font-semibold text-zinc-800">Camera Photo</p>
                <p className="text-zinc-500">{cameraCapture.width}x{cameraCapture.height}</p>
              </div>
              <button
                type="button"
                onClick={() => setCameraCapture(null)}
                className="ml-1 p-0.5 text-zinc-400 hover:text-rose-600 rounded"
                title="Remove photo"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Attached Files preview */}
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center gap-1.5 bg-white border border-zinc-300 rounded-lg px-2.5 py-1 shadow-xs text-xs"
            >
              {att.type === 'code' ? (
                <FileCode className="w-3.5 h-3.5 text-blue-600" />
              ) : att.type === 'image' ? (
                <ImageIcon className="w-3.5 h-3.5 text-purple-600" />
              ) : (
                <FileText className="w-3.5 h-3.5 text-emerald-600" />
              )}
              <span className="font-medium text-zinc-800 max-w-[150px] truncate">{att.name}</span>
              <span className="text-[10px] text-zinc-500 font-mono">({(att.sizeBytes / 1024).toFixed(1)} KB)</span>
              <button
                type="button"
                onClick={() => handleRemoveAttachment(att.id)}
                className="ml-1 text-zinc-400 hover:text-rose-600 p-0.5 rounded"
                title="Remove file"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}

          <span className="text-[11px] text-zinc-500 ml-auto italic">
            Attached for local context
          </span>
        </div>
      )}

      {/* Input Composer */}
      <form onSubmit={(e) => handleSubmit(e)} className="mt-auto relative shrink-0">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".txt,.md,.json,.csv,.tsv,.js,.ts,.tsx,.jsx,.html,.css,.py,.java,.cpp,.c,.sql,.yaml,.yml,.xml,.pdf,image/*"
          className="hidden"
          onChange={handleFileInputChange}
        />

        <div className="flex flex-col bg-white border border-zinc-300 focus-within:border-zinc-900 rounded-2xl shadow-xs transition-colors p-2">
          <textarea
            ref={textareaRef}
            id="chat-input-textarea"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              cameraCapture
                ? 'Ask a question about the captured photo, or press Enter to analyze...'
                : attachments.length > 0
                  ? 'Ask a question about the attached file(s), or press Enter to summarize...'
                  : 'Type your message, speak via microphone, or attach files/photos...'
            }
            rows={2}
            className="w-full bg-transparent resize-none border-none outline-hidden text-base sm:text-sm text-zinc-900 placeholder:text-zinc-400 px-2 pt-1 pb-1.5 leading-relaxed"
          />

          <div className="flex items-center justify-between pt-1.5 border-t border-zinc-100 px-1 gap-2">
            {/* Multimodal Actions Toolbar (Mic, Camera, Attachments) */}
            <div className="flex items-center gap-1 text-zinc-500">
              {/* Voice / Mic Button */}
              <button
                type="button"
                onClick={handleToggleVoice}
                className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
                  isVoiceListening
                    ? 'bg-rose-500 text-white animate-pulse'
                    : 'hover:text-zinc-900 hover:bg-zinc-100 text-zinc-600'
                }`}
                title={isVoiceListening ? 'Stop recording voice' : 'Voice Input: Transcribe and answer'}
                aria-label="Voice input"
              >
                {isVoiceListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              {/* Camera Button */}
              <button
                type="button"
                onClick={() => setIsCameraModalOpen(true)}
                className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
                  cameraCapture
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'hover:text-zinc-900 hover:bg-zinc-100 text-zinc-600'
                }`}
                title="Camera Input: Take photo with device camera"
                aria-label="Camera snapshot"
              >
                <Camera className="w-4 h-4" />
              </button>

              {/* File Attachment Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors ${
                  attachments.length > 0
                    ? 'bg-blue-100 text-blue-800'
                    : 'hover:text-zinc-900 hover:bg-zinc-100 text-zinc-600'
                }`}
                title="File Input: Attach code, document, dataset, or image"
                aria-label="Attach file"
              >
                <Paperclip className="w-4 h-4" />
              </button>

              <div className="h-4 w-px bg-zinc-200 mx-1 hidden sm:block" />

              <button
                type="button"
                onClick={onOpenSettings}
                className="hover:text-zinc-700 underline underline-offset-2 text-[11px] sm:text-xs truncate hidden sm:inline"
              >
                {getEngineBadgeLabel(config.activeEngine)}
              </button>
            </div>

            {/* Submit / Stop Controls */}
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
                  disabled={!input.trim() && attachments.length === 0 && !cameraCapture}
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

      {/* Camera Capture Modal */}
      <CameraCaptureModal
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onCapture={(meta) => {
          setCameraCapture(meta);
        }}
      />

      {/* Fullscreen Photo Lightbox Modal */}
      {previewPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setPreviewPhoto(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh] flex flex-col items-center">
            <button
              onClick={() => setPreviewPhoto(null)}
              className="absolute -top-10 right-0 text-white hover:text-zinc-300 p-1"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={previewPhoto}
              alt="Photo preview"
              className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl border border-zinc-800"
            />
          </div>
        </div>
      )}
    </div>
  );
};

