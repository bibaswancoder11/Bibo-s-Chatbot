import { DocumentChunk, EngineType, OllamaModelInfo, TextAnalysisResult } from '../types';

// Stopwords list for high-accuracy local NLP
const STOPWORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren\'t', 'as', 'at',
  'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by', 'can', 'can\'t', 'cannot',
  'could', 'couldn\'t', 'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing', 'don\'t', 'down', 'during', 'each',
  'few', 'for', 'from', 'further', 'had', 'hadn\'t', 'has', 'hasn\'t', 'have', 'haven\'t', 'having', 'he', 'he\'d',
  'he\'ll', 'he\'s', 'her', 'here', 'here\'s', 'hers', 'herself', 'him', 'himself', 'his', 'how', 'how\'s', 'i',
  'i\'d', 'i\'ll', 'i\'m', 'i\'ve', 'if', 'in', 'into', 'is', 'isn\'t', 'it', 'it\'s', 'its', 'itself', 'let\'s',
  'me', 'more', 'most', 'mustn\'t', 'my', 'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or',
  'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'shan\'t', 'she', 'she\'d', 'she\'ll',
  'she\'s', 'should', 'shouldn\'t', 'so', 'some', 'such', 'than', 'that', 'that\'s', 'the', 'their', 'theirs',
  'them', 'themselves', 'then', 'there', 'there\'s', 'these', 'they', 'they\'d', 'they\'ll', 'they\'re', 'they\'ve',
  'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'wasn\'t', 'we', 'we\'d', 'we\'ll',
  'we\'re', 'we\'ve', 'were', 'weren\'t', 'what', 'what\'s', 'when', 'when\'s', 'where', 'where\'s', 'which', 'while',
  'who', 'who\'s', 'whom', 'why', 'why\'s', 'with', 'won\'t', 'would', 'wouldn\'t', 'you', 'you\'d', 'you\'ll',
  'you\'re', 'you\'ve', 'your', 'yours', 'yourself', 'yourselves'
]);

const POSITIVE_LEXICON = new Set([
  'good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'superb', 'positive', 'outstanding',
  'exceptional', 'terrific', 'marvelous', 'beneficial', 'innovative', 'efficient', 'reliable', 'clean',
  'fast', 'secure', 'private', 'intuitive', 'delightful', 'perfect', 'brilliant', 'smart', 'strong',
  'effective', 'love', 'like', 'helpful', 'success', 'successful', 'thriving', 'flourish', 'superior',
  'impressive', 'promising', 'stable', 'seamless', 'elegant', 'pleased', 'satisfying', 'joy', 'awesome'
]);

const NEGATIVE_LEXICON = new Set([
  'bad', 'terrible', 'horrible', 'poor', 'awful', 'negative', 'broken', 'failed', 'failing', 'buggy',
  'slow', 'unreliable', 'vulnerable', 'insecure', 'confusing', 'difficult', 'painful', 'annoying',
  'worst', 'flawed', 'defect', 'problem', 'issue', 'danger', 'harmful', 'risk', 'crisis', 'disappointing',
  'hate', 'dislike', 'useless', 'inefficient', 'crash', 'lag', 'error', 'warning', 'loss', 'unstable'
]);

const INTENSIFIERS = new Set(['very', 'extremely', 'incredibly', 'really', 'super', 'exceptionally', 'totally']);
const NEGATORS = new Set(['not', 'never', 'no', 'hardly', 'barely', 'scarcely', 'without', 'cannot', 'wasn\'t', 'isn\'t']);

// Syllable counter for Flesch-Kincaid Readability metrics
function countSyllables(word: string): number {
  word = word.toLowerCase().trim();
  if (word.length <= 3) return 1;
  word = word.replace(/(?:[^laeiouy]|ed|es|e)$/, '');
  word = word.replace(/^y/, '');
  const matches = word.match(/[aeiouy]{1,2}/g);
  return matches ? Math.max(1, matches.length) : 1;
}

export class PureLocalNLP {
  static tokenize(text: string): string[] {
    return text.toLowerCase()
      .replace(/[^a-z0-9_\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 0);
  }

  static getSentences(text: string): string[] {
    return text
      .replace(/([.?!])\s*(?=[A-Z0-9])/g, '$1|')
      .split('|')
      .map(s => s.trim())
      .filter(s => s.length > 5);
  }

  static analyzeSentiment(text: string): TextAnalysisResult['sentiment'] {
    const tokens = this.tokenize(text);
    if (tokens.length === 0) {
      return { label: 'NEUTRAL', score: 0.5, valence: 0, subjectivity: 0 };
    }

    let posScore = 0;
    let negScore = 0;
    let emotionalTokens = 0;

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      const prev = i > 0 ? tokens[i - 1] : '';
      const isNegated = NEGATORS.has(prev);
      const isIntensified = i > 1 && INTENSIFIERS.has(tokens[i - 2]) || INTENSIFIERS.has(prev);
      const multiplier = isIntensified ? 1.5 : 1.0;

      if (POSITIVE_LEXICON.has(token)) {
        emotionalTokens++;
        if (isNegated) {
          negScore += 1 * multiplier;
        } else {
          posScore += 1 * multiplier;
        }
      } else if (NEGATIVE_LEXICON.has(token)) {
        emotionalTokens++;
        if (isNegated) {
          posScore += 0.8 * multiplier;
        } else {
          negScore += 1 * multiplier;
        }
      }
    }

    const netValence = (posScore - negScore) / Math.max(1, (posScore + negScore));
    const normalizedScore = (netValence + 1) / 2;
    const subjectivity = Math.min(1, emotionalTokens / Math.max(5, tokens.length * 0.15));

    let label: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL' = 'NEUTRAL';
    if (netValence > 0.15) label = 'POSITIVE';
    else if (netValence < -0.15) label = 'NEGATIVE';

    return {
      label,
      score: Math.round(normalizedScore * 100) / 100,
      valence: Math.round(netValence * 100) / 100,
      subjectivity: Math.round(subjectivity * 100) / 100
    };
  }

  static calculateReadability(text: string): TextAnalysisResult['readability'] {
    const words = this.tokenize(text);
    const sentences = this.getSentences(text);

    const wordCount = Math.max(1, words.length);
    const sentenceCount = Math.max(1, sentences.length);
    const charCount = text.length;

    let totalSyllables = 0;
    for (const word of words) {
      totalSyllables += countSyllables(word);
    }

    const avgWordsPerSentence = wordCount / sentenceCount;
    const avgSyllablesPerWord = totalSyllables / wordCount;

    // Flesch Reading Ease = 206.835 - (1.015 * ASL) - (84.6 * ASW)
    let flesch = 206.835 - (1.015 * avgWordsPerSentence) - (84.6 * avgSyllablesPerWord);
    flesch = Math.max(0, Math.min(100, Math.round(flesch)));

    let readingLevel = 'Standard';
    if (flesch >= 90) readingLevel = 'Very Easy (5th grade)';
    else if (flesch >= 80) readingLevel = 'Easy (6th grade)';
    else if (flesch >= 70) readingLevel = 'Fairly Easy (7th grade)';
    else if (flesch >= 60) readingLevel = 'Standard (8th-9th grade)';
    else if (flesch >= 50) readingLevel = 'Fairly Difficult (10th-12th grade)';
    else if (flesch >= 30) readingLevel = 'Difficult (College level)';
    else readingLevel = 'Very Confusing / Technical (Graduate)';

    const readingTimeMinutes = Math.max(0.2, Math.round((wordCount / 220) * 10) / 10);

    return {
      fleschKincaidScore: flesch,
      readingLevel,
      readingTimeMinutes,
      wordCount,
      sentenceCount,
      charCount,
      avgWordsPerSentence: Math.round(avgWordsPerSentence * 10) / 10
    };
  }

  static extractKeyTopics(text: string, topN = 6): string[] {
    const tokens = this.tokenize(text).filter(w => !STOPWORDS.has(w) && w.length > 2);
    const freq: Record<string, number> = {};

    for (const t of tokens) {
      freq[t] = (freq[t] || 0) + 1;
    }

    // Also extract bigrams for natural concepts
    const bigrams: Record<string, number> = {};
    for (let i = 0; i < tokens.length - 1; i++) {
      const bg = `${tokens[i]} ${tokens[i + 1]}`;
      bigrams[bg] = (bigrams[bg] || 0) + 1.8;
    }

    const merged = { ...freq, ...bigrams };
    return Object.entries(merged)
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN)
      .map(([term]) => term.charAt(0).toUpperCase() + term.slice(1));
  }

  static extractEntities(text: string): TextAnalysisResult['entities'] {
    const entities: TextAnalysisResult['entities'] = [];
    const seen = new Set<string>();

    // Tech patterns
    const techPatterns = /\b(React|TypeScript|JavaScript|Python|Rust|HTML|CSS|Node\.js|Docker|Kubernetes|Linux|WASM|WebAssembly|WebGPU|Ollama|ONNX|Transformers|SQL|PostgreSQL|JSON|API|GraphQL)\b/gi;
    let match;
    while ((match = techPatterns.exec(text)) !== null) {
      const val = match[1];
      if (!seen.has(val.toLowerCase())) {
        seen.add(val.toLowerCase());
        entities.push({ text: val, type: 'Technology' });
      }
    }

    // Numbers & Metrics
    const metricPatterns = /\b(\d+(?:\.\d+)?%|\$\d+(?:,\d+)*(?:\.\d+)?|\b\d+\s*(?:ms|seconds|minutes|hours|GB|MB|KB|tokens|users|fps)\b)/gi;
    while ((match = metricPatterns.exec(text)) !== null) {
      const val = match[1];
      if (!seen.has(val.toLowerCase()) && entities.length < 12) {
        seen.add(val.toLowerCase());
        entities.push({ text: val, type: 'Metric' });
      }
    }

    // Capitalized Organizations / Proper nouns (2-3 words capitalized together)
    const orgPatterns = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2})\b/g;
    while ((match = orgPatterns.exec(text)) !== null) {
      const val = match[1];
      if (!seen.has(val.toLowerCase()) && val.length > 3 && entities.length < 15) {
        seen.add(val.toLowerCase());
        entities.push({ text: val, type: 'Organization' });
      }
    }

    return entities;
  }

  static summarize(text: string, maxSentences = 3): string {
    const sentences = this.getSentences(text);
    if (sentences.length <= maxSentences) return text;

    const tokens = this.tokenize(text).filter(w => !STOPWORDS.has(w));
    const wordFreq: Record<string, number> = {};
    for (const t of tokens) {
      wordFreq[t] = (wordFreq[t] || 0) + 1;
    }

    const scored = sentences.map((sentence, idx) => {
      const sTokens = this.tokenize(sentence).filter(w => !STOPWORDS.has(w));
      let rawScore = 0;
      for (const st of sTokens) {
        rawScore += (wordFreq[st] || 0);
      }
      // Position boost (lead and concluding sentences often carry most meaning)
      const positionFactor = idx === 0 ? 1.6 : (idx === sentences.length - 1 ? 1.3 : 1.0);
      const lengthPenalty = sTokens.length < 4 ? 0.4 : 1.0;
      const score = (rawScore / Math.max(1, sTokens.length)) * positionFactor * lengthPenalty;
      return { sentence, score, originalIndex: idx };
    });

    scored.sort((a, b) => b.score - a.score);
    const topSentences = scored.slice(0, maxSentences);
    topSentences.sort((a, b) => a.originalIndex - b.originalIndex);

    return topSentences.map(s => s.sentence).join(' ');
  }

  static analyzeFull(text: string): TextAnalysisResult {
    return {
      sentiment: this.analyzeSentiment(text),
      readability: this.calculateReadability(text),
      keyTopics: this.extractKeyTopics(text),
      entities: this.extractEntities(text),
      summary: this.summarize(text, 3)
    };
  }
}

// Local In-Memory Vector Search & RAG
export class LocalVectorIndex {
  private chunks: DocumentChunk[] = [];
  private vocabulary: Map<string, number> = new Map();
  private docFrequencies: Map<string, number> = new Map();

  chunkDocument(docTitle: string, text: string, chunkSizeWords = 110, overlapWords = 25): DocumentChunk[] {
    const words = text.split(/\s+/).filter(w => w.length > 0);
    const result: DocumentChunk[] = [];
    let start = 0;
    let index = 0;

    while (start < words.length) {
      const end = Math.min(words.length, start + chunkSizeWords);
      const chunkWords = words.slice(start, end);
      const chunkText = chunkWords.join(' ');

      result.push({
        id: `${docTitle}-${index}-${Date.now()}`,
        docTitle,
        content: chunkText,
        index,
        wordCount: chunkWords.length
      });

      index++;
      if (end >= words.length) break;
      start += (chunkSizeWords - overlapWords);
    }

    return result;
  }

  addChunks(newChunks: DocumentChunk[]) {
    this.chunks.push(...newChunks);
    this.rebuildIndex();
  }

  clear() {
    this.chunks = [];
    this.vocabulary.clear();
    this.docFrequencies.clear();
  }

  getAllChunks(): DocumentChunk[] {
    return this.chunks;
  }

  private rebuildIndex() {
    this.vocabulary.clear();
    this.docFrequencies.clear();

    const N = this.chunks.length;
    if (N === 0) return;

    for (const chunk of this.chunks) {
      const terms = new Set(PureLocalNLP.tokenize(chunk.content).filter(t => !STOPWORDS.has(t)));
      for (const term of terms) {
        this.docFrequencies.set(term, (this.docFrequencies.get(term) || 0) + 1);
        if (!this.vocabulary.has(term)) {
          this.vocabulary.set(term, this.vocabulary.size);
        }
      }
    }
  }

  private getTfidfVector(tokens: string[]): Map<string, number> {
    const termCounts: Record<string, number> = {};
    for (const t of tokens) {
      termCounts[t] = (termCounts[t] || 0) + 1;
    }

    const vector = new Map<string, number>();
    const totalDocs = Math.max(1, this.chunks.length);

    for (const [term, count] of Object.entries(termCounts)) {
      const tf = 1 + Math.log(count);
      const df = this.docFrequencies.get(term) || 1;
      const idf = Math.log(1 + (totalDocs / df));
      vector.set(term, tf * idf);
    }

    return vector;
  }

  search(query: string, topK = 4): DocumentChunk[] {
    if (this.chunks.length === 0) return [];
    const queryTokens = PureLocalNLP.tokenize(query).filter(t => !STOPWORDS.has(t));
    if (queryTokens.length === 0) {
      return this.chunks.slice(0, topK);
    }

    const queryVector = this.getTfidfVector(queryTokens);
    let queryMagnitude = 0;
    for (const val of queryVector.values()) {
      queryMagnitude += val * val;
    }
    queryMagnitude = Math.sqrt(queryMagnitude) || 1;

    const scored = this.chunks.map(chunk => {
      const chunkTokens = PureLocalNLP.tokenize(chunk.content).filter(t => !STOPWORDS.has(t));
      const chunkVector = this.getTfidfVector(chunkTokens);

      let dotProduct = 0;
      let chunkMagnitude = 0;
      for (const [term, val] of chunkVector.entries()) {
        chunkMagnitude += val * val;
        if (queryVector.has(term)) {
          dotProduct += (queryVector.get(term)! * val);
        }
      }
      chunkMagnitude = Math.sqrt(chunkMagnitude) || 1;

      // Exact substring boost
      const exactBoost = chunk.content.toLowerCase().includes(query.toLowerCase().trim()) ? 0.35 : 0;
      const cosineSim = (dotProduct / (queryMagnitude * chunkMagnitude)) + exactBoost;

      return {
        ...chunk,
        score: Math.round(cosineSim * 100) / 100
      };
    });

    scored.sort((a, b) => (b.score || 0) - (a.score || 0));
    return scored.filter(c => (c.score || 0) > 0.05).slice(0, topK);
  }

  synthesizeAnswer(query: string, matchedChunks: DocumentChunk[]): string {
    if (matchedChunks.length === 0) {
      return `I analyzed your local documents, but could not find a high-confidence match for "${query}". Try uploading related notes or refining your question keywords.`;
    }

    const topSentences: string[] = [];
    const qTokens = new Set(PureLocalNLP.tokenize(query).filter(t => !STOPWORDS.has(t)));

    for (const chunk of matchedChunks) {
      const sentences = PureLocalNLP.getSentences(chunk.content);
      for (const sentence of sentences) {
        const sTokens = PureLocalNLP.tokenize(sentence);
        let overlap = 0;
        for (const token of sTokens) {
          if (qTokens.has(token)) overlap++;
        }
        if (overlap > 0) {
          topSentences.push(sentence);
        }
      }
    }

    const uniqueTop = Array.from(new Set(topSentences)).slice(0, 4);
    const docSources = Array.from(new Set(matchedChunks.map(c => c.docTitle))).join(', ');

    let response = `### Synthesized Local Knowledge Answer\n\n`;
    if (uniqueTop.length > 0) {
      response += `${uniqueTop.join(' ')}\n\n`;
    } else {
      response += `${matchedChunks[0].content.slice(0, 300)}...\n\n`;
    }

    response += `**Relevant Sources Cited (Local):**\n`;
    matchedChunks.forEach((c, idx) => {
      response += `- **[Source ${idx + 1}]** *${c.docTitle}* (Relevance: ${(c.score! * 100).toFixed(0)}%)\n  > "${c.content.slice(0, 180)}..."\n`;
    });

    return response;
  }
}

// Ollama Localhost Integration (Zero API Key, 100% on user's machine)
export class OllamaService {
  static async checkConnection(baseUrl: string = 'http://localhost:11434'): Promise<{ connected: boolean; models: OllamaModelInfo[]; error?: string }> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);

      const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/tags`, {
        method: 'GET',
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        return { connected: false, models: [], error: `Status ${res.status}: ${res.statusText}` };
      }

      const data = await res.json();
      return {
        connected: true,
        models: (data.models || []).map((m: any) => ({
          name: m.name,
          size: m.size,
          modified_at: m.modified_at
        }))
      };
    } catch (err: any) {
      return {
        connected: false,
        models: [],
        error: err.name === 'AbortError' ? 'Connection timed out' : (err.message || 'Cannot reach localhost:11434')
      };
    }
  }

  static async streamGenerate(
    baseUrl: string,
    model: string,
    prompt: string,
    systemPrompt: string,
    onChunk: (text: string) => void,
    temperature = 0.7
  ): Promise<string> {
    const url = `${baseUrl.replace(/\/$/, '')}/api/generate`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        system: systemPrompt,
        stream: true,
        options: { temperature }
      })
    });

    if (!res.ok) {
      throw new Error(`Ollama error: ${res.statusText}`);
    }

    if (!res.body) {
      throw new Error('Readable stream not supported in response');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullResponse = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(l => l.trim().length > 0);

      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.response) {
            fullResponse += parsed.response;
            onChunk(parsed.response);
          }
        } catch {
          // ignore non-json keep-alives
        }
      }
    }

    return fullResponse;
  }
}

// In-Browser Transformers.js dynamic wrapper
export class TransformersBrowserService {
  private static pipelineInstance: any = null;
  private static currentTask: string | null = null;
  private static currentModel: string | null = null;

  static async loadTextGenPipeline(
    modelName = 'Xenova/distilgpt2',
    onProgress?: (info: { status: string; progress?: number; file?: string }) => void
  ) {
    if (this.pipelineInstance && this.currentModel === modelName) {
      return this.pipelineInstance;
    }

    // Dynamic import to avoid loading large wasm binaries until requested
    const { pipeline, env } = await import('@huggingface/transformers');
    env.allowLocalModels = false;
    env.useBrowserCache = true;

    if (onProgress) {
      onProgress({ status: 'Initiating local model weights download...', progress: 5 });
    }

    this.pipelineInstance = await pipeline('text-generation', modelName, {
      progress_callback: (p: any) => {
        if (onProgress) {
          onProgress({
            status: p.status || 'Loading weights...',
            progress: p.progress ? Math.round(p.progress) : undefined,
            file: p.file
          });
        }
      }
    });

    this.currentModel = modelName;
    this.currentTask = 'text-generation';
    return this.pipelineInstance;
  }

  static async generate(prompt: string, maxTokens = 60): Promise<string> {
    if (!this.pipelineInstance) {
      await this.loadTextGenPipeline();
    }
    const output = await this.pipelineInstance(prompt, {
      max_new_tokens: maxTokens,
      temperature: 0.8,
      do_sample: true,
      top_k: 40
    });

    if (Array.isArray(output) && output[0]?.generated_text) {
      return output[0].generated_text;
    }
    return typeof output === 'string' ? output : JSON.stringify(output);
  }
}

// Chrome Native AI (Prompt API / Gemini Nano)
export class ChromeNativeAiService {
  static isAvailable(): boolean {
    return typeof window !== 'undefined' && (
      'ai' in window ||
      ('model' in window && 'generateText' in (window as any).model)
    );
  }

  static async prompt(text: string, systemPrompt?: string): Promise<string> {
    const ai = (window as any).ai;
    if (!ai?.languageModel) {
      throw new Error('Chrome Built-in AI (ai.languageModel) is not available in this browser.');
    }

    const session = await ai.languageModel.create({
      systemPrompt: systemPrompt || 'You are a helpful assistant.'
    });

    const result = await session.prompt(text);
    return result;
  }
}

// Conversational Pure-Local Assistant (Instant 0ms, Zero-API-key reasoning heuristics & template generation)
export class LocalSmartAssistant {
  static generateResponse(userPrompt: string, role = 'general'): string {
    const lower = userPrompt.toLowerCase().trim();

    // 1. Code help / creation
    if (lower.includes('code') || lower.includes('function') || lower.includes('react') || lower.includes('typescript') || lower.includes('python')) {
      if (lower.includes('sort') || lower.includes('array')) {
        return `Here is a clean, modern TypeScript solution running locally:\n\n` +
          `\`\`\`typescript\n// Fast sorting with custom comparator\nfunction sortItems<T>(items: T[], key: keyof T, order: 'asc' | 'desc' = 'asc'): T[] {\n  return [...items].sort((a, b) => {\n    if (a[key] < b[key]) return order === 'asc' ? -1 : 1;\n    if (a[key] > b[key]) return order === 'asc' ? 1 : -1;\n    return 0;\n  });\n}\n\n// Example usage:\nconst data = [{ name: 'Alpha', score: 88 }, { name: 'Beta', score: 95 }];\nconst sorted = sortItems(data, 'score', 'desc');\nconsole.log(sorted);\n\`\`\`\n\n*Executed completely on your local device without any external network calls.*`;
      }
      if (lower.includes('debounce') || lower.includes('throttle')) {
        return `Here is a type-safe debounce hook implemented for local React apps:\n\n` +
          `\`\`\`typescript\nimport { useEffect, useState } from 'react';\n\nexport function useDebounce<T>(value: T, delayMs = 300): T {\n  const [debouncedValue, setDebouncedValue] = useState<T>(value);\n\n  useEffect(() => {\n    const timer = setTimeout(() => setDebouncedValue(value), delayMs);\n    return () => clearTimeout(timer);\n  }, [value, delayMs]);\n\n  return debouncedValue;\n}\n\`\`\`\n\n*This runs 100% on client-side memory.*`;
      }
      return `Here is a structured implementation addressing your request:\n\n` +
        `\`\`\`typescript\n// Local Zero-Key Utility\nexport async function processDataLocally(input: string): Promise<{ success: boolean; data: string }> {\n  // Perform client-side validation\n  if (!input || input.trim().length === 0) {\n    throw new Error("Invalid input provided");\n  }\n  \n  const transformed = input.trim().toUpperCase();\n  return {\n    success: true,\n    data: transformed\n  };\n}\n\`\`\`\n\nLet me know if you would like me to adjust the typing or add unit tests!`;
    }

    // 2. Explain concepts
    if (lower.startsWith('what is') || lower.startsWith('explain') || lower.includes('how does')) {
      if (lower.includes('local ai') || lower.includes('zero key') || lower.includes('privacy')) {
        return `### What is Local AI?\n\n**Local AI** refers to running machine learning algorithms and neural network inference directly on your machine or in your browser, rather than transmitting prompts to third-party cloud servers.\n\n**Key Advantages:**\n- **100% Privacy & Data Sovereignty:** Your sensitive documents, personal thoughts, and code never leave your device.\n- **Zero API Keys & Cost:** No subscriptions, credit cards, or rate limits.\n- **Offline Reliability:** Operates seamlessly on airplanes, trains, or without an active internet connection.\n- **Zero Latency & Censorship-Free:** Near instantaneous response times on modern hardware utilizing WebAssembly or WebGPU.`;
      }
      if (lower.includes('rag') || lower.includes('vector')) {
        return `### How Retrieval-Augmented Generation (RAG) Works Locally\n\n1. **Document Chunking:** Long text or documents are split into semantic blocks (typically 100–300 words) with small overlaps.\n2. **Vector Indexing:** Each block is converted into a mathematical vector representation (using TF-IDF, BM25, or neural embedding models like MiniLM).\n3. **Cosine Similarity Search:** When you ask a question, your query is mapped into the same vector space, and the closest matching chunks are retrieved based on vector angles.\n4. **Context Synthesis:** The system feeds the retrieved excerpts into the model to formulate a grounded answer with verifiable source citations!`;
      }
    }

    // 3. Summarization request
    if (lower.includes('summarize') || lower.includes('tldr') || lower.includes('key points')) {
      return `Here is a concise, high-signal breakdown:\n\n- **Core Theme:** Focuses on autonomous, private execution without external dependencies.\n- **Key Mechanism:** Utilizes local computation, vectorized in-memory indexing, and rule-based semantic inference.\n- **Primary Takeaway:** Eliminates third-party API exposure while maintaining high responsiveness and predictability.`;
    }

    // 4. Brainstorming or creative ideation
    if (lower.includes('idea') || lower.includes('suggest') || lower.includes('plan') || lower.includes('brainstorm')) {
      return `Here are 4 focused, high-impact suggestions tailored for your prompt:\n\n` +
        `1. **Modular Architecture:** Structure logic into isolated, testable components with zero side-effects.\n` +
        `2. **Optimized Caching:** Leverage IndexedDB or client-side cache stores for sub-second retrieval.\n` +
        `3. **Progressive Enhancement:** Ensure graceful fallbacks from WebGPU → WebAssembly → Pure JavaScript.\n` +
        `4. **Strict Data Isolation:** Guarantee that private inputs never leak through network payloads or analytics trackers.\n\nWhich direction would you like to explore further?`;
    }

    // 5. Default friendly intelligent conversational response
    return `I received your prompt: **"${userPrompt}"**.\n\n` +
      `As a **100% Local AI engine** operating with **zero API keys**, I process all reasoning, tokenization, and vector transformations directly within your device sandbox.\n\n` +
      `**What you can do right now:**\n` +
      `- **Ask questions & draft text:** Get instant local responses without latency or rate limits.\n` +
      `- **Try "Ask Your Docs" (RAG):** Switch to the RAG tab to upload any notes, markdown, or PDF text for private offline Q&A.\n` +
      `- **Text Intelligence:** Analyze sentiment, calculate Flesch reading grade level, and extract key entities.\n` +
      `- **Connect Ollama:** If you have Ollama running on your machine, connect to \`http://localhost:11434\` in Settings for full open-weights LLMs (Llama 3, DeepSeek, Mistral) with zero keys!`;
  }
}
