export type EngineType = 'web-llm' | 'in-browser-nlp' | 'transformers-wasm' | 'ollama-local' | 'chrome-ai';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  engineUsed?: EngineType;
  modelUsed?: string;
  stats?: {
    latencyMs?: number;
    tokensEstimated?: number;
  };
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}

export interface DocumentChunk {
  id: string;
  docTitle: string;
  content: string;
  index: number;
  wordCount: number;
  score?: number;
}

export interface UploadedDoc {
  id: string;
  title: string;
  rawText: string;
  sizeBytes: number;
  createdAt: number;
  chunks: DocumentChunk[];
}

export interface TextAnalysisResult {
  sentiment: {
    label: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
    score: number;
    valence: number;
    subjectivity: number;
  };
  readability: {
    fleschKincaidScore: number;
    readingLevel: string;
    readingTimeMinutes: number;
    wordCount: number;
    sentenceCount: number;
    charCount: number;
    avgWordsPerSentence: number;
  };
  keyTopics: string[];
  entities: {
    text: string;
    type: 'Organization' | 'Technology' | 'Metric' | 'Concept' | 'Person/Place';
  }[];
  summary: string;
}

export interface EngineConfig {
  activeEngine: EngineType;
  webLlmModel: string;
  ollamaUrl: string;
  ollamaModel: string;
  transformersModel: string;
  temperature: number;
  systemPrompt: string;
}

export interface OllamaModelInfo {
  name: string;
  size: number;
  modified_at: string;
}

export interface ModelLoadingProgress {
  status: 'idle' | 'loading' | 'ready' | 'error';
  progress: number;
  file?: string;
  detail?: string;
}
