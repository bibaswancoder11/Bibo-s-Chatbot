import React, { useState, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  FileText,
  UploadCloud,
  Search,
  BookOpen,
  Trash2,
  Database,
  Sparkles,
  Layers,
  ArrowRight,
  ShieldCheck,
  FileCheck2,
  Clock,
  Loader2,
  Check,
  BrainCircuit,
  Cpu
} from 'lucide-react';
import { DocumentChunk, UploadedDoc } from '../types';
import { LocalVectorIndex } from '../services/localAiEngine';
import { webLlm } from '../services/webLlmService';

const SAMPLE_DOCS = [
  {
    title: 'On-Device AI Architecture.md',
    content: `# On-Device AI Architecture & Privacy Manifesto

## Abstract
On-device artificial intelligence represents a paradigm shift away from centralized cloud inference towards autonomous client-side computing. By executing models inside local runtimes such as WebAssembly (WASM), WebGPU, and ONNX Runtime, applications eliminate the transmission of private user telemetry over the public internet.

## The Zero-Key Principle
In traditional SaaS architectures, developers configure centralized API keys (e.g. OpenAI, Anthropic, Gemini API) which act as cost and latency bottlenecks. Zero-key architecture relies strictly on:
1. Client-Side WebAssembly models compiled from PyTorch/ONNX.
2. Localhost background daemons (such as Ollama or LocalAI).
3. Browser-embedded vector spaces and semantic centroid summarization.

## Security Guarantees
Because zero network payloads leave the browser sandbox, local AI applications are inherently compliant with stringent data regulations including HIPAA, GDPR, and SOC2. All indexing tables and TF-IDF vectors reside strictly in volatile RAM or client-side IndexedDB.`
  },
  {
    title: 'System Requirements & Performance.txt',
    content: `Local Computing Benchmarks:
- Memory footprint: Pure local vector indexing consumes under 15MB of RAM for up to 50,000 words.
- Latency: Cosine vector searches across 1,000 document chunks execute in less than 4 milliseconds.
- Storage: All documents and semantic chunk caches are stored in browser LocalStorage and memory.
- Hardware requirements: Any modern browser supporting WebAssembly and ECMAScript 2022. Discrete GPUs are optional but enhance WebGPU performance.`
  }
];

export const DocumentRagWorkspace: React.FC = () => {
  const [docs, setDocs] = useState<UploadedDoc[]>(() => {
    const vectorIndex = new LocalVectorIndex();
    const initialDocs: UploadedDoc[] = SAMPLE_DOCS.map((s, idx) => {
      const chunks = vectorIndex.chunkDocument(s.title, s.content);
      return {
        id: `sample-${idx}`,
        title: s.title,
        rawText: s.content,
        sizeBytes: new Blob([s.content]).size,
        createdAt: Date.now(),
        chunks
      };
    });
    return initialDocs;
  });

  const [activeDocId, setActiveDocId] = useState<string>(docs[0]?.id || '');
  const [pasteTitle, setPasteTitle] = useState('');
  const [pasteContent, setPasteContent] = useState('');
  const [isPasting, setIsPasting] = useState(false);
  const [mobileTab, setMobileTab] = useState<'query' | 'docs'>('query');

  const [query, setQuery] = useState('What are the security guarantees and advantages of zero-key local AI?');
  const [searchResults, setSearchResults] = useState<DocumentChunk[]>([]);
  const [synthesizedAnswer, setSynthesizedAnswer] = useState<string>('');
  const [isSearching, setIsSearching] = useState(false);
  const [useNeuralLlm, setUseNeuralLlm] = useState(webLlm.isReady());

  // Initialize vector index with all chunks from all uploaded docs
  const vectorIndex = useMemo(() => {
    const index = new LocalVectorIndex();
    const allChunks = docs.flatMap(d => d.chunks);
    index.addChunks(allChunks);
    return index;
  }, [docs]);

  const totalChunks = useMemo(() => {
    return docs.reduce((acc, d) => acc + d.chunks.length, 0);
  }, [docs]);

  const totalWords = useMemo(() => {
    return docs.reduce((acc, d) => acc + d.rawText.split(/\s+/).filter(Boolean).length, 0);
  }, [docs]);

  const activeDoc = useMemo(() => {
    return docs.find(d => d.id === activeDocId) || docs[0];
  }, [docs, activeDocId]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (!text) return;

        const chunks = vectorIndex.chunkDocument(file.name, text);
        const newDoc: UploadedDoc = {
          id: `doc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          title: file.name,
          rawText: text,
          sizeBytes: file.size,
          createdAt: Date.now(),
          chunks
        };

        setDocs(prev => [newDoc, ...prev]);
        setActiveDocId(newDoc.id);
        setMobileTab('docs');
      };
      reader.readAsText(file);
    });

    e.target.value = '';
  };

  const handlePasteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pasteContent.trim()) return;

    const title = pasteTitle.trim() || `Pasted Note ${docs.length + 1}`;
    const chunks = vectorIndex.chunkDocument(title, pasteContent);
    const newDoc: UploadedDoc = {
      id: `doc-${Date.now()}`,
      title,
      rawText: pasteContent,
      sizeBytes: new Blob([pasteContent]).size,
      createdAt: Date.now(),
      chunks
    };

    setDocs(prev => [newDoc, ...prev]);
    setActiveDocId(newDoc.id);
    setPasteTitle('');
    setPasteContent('');
    setIsPasting(false);
    setMobileTab('docs');
  };

  const handleDeleteDoc = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const filtered = docs.filter(d => d.id !== id);
    setDocs(filtered);
    if (activeDocId === id && filtered.length > 0) {
      setActiveDocId(filtered[0].id);
    }
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim() || isSearching) return;

    setIsSearching(true);
    setSynthesizedAnswer('');

    // Micro-delay to yield thread
    await new Promise(r => setTimeout(r, 60));

    const matched = vectorIndex.search(query, 3);
    setSearchResults(matched);

    if (matched.length === 0) {
      setSynthesizedAnswer(`No matching excerpts found in your local documents for "${query}". Try adding more documents or adjusting keywords.`);
      setIsSearching(false);
      return;
    }

    if (useNeuralLlm && webLlm.isReady()) {
      try {
        const contextText = matched.map((c, i) => `[Source ${i + 1}: ${c.docTitle}]\n${c.content}`).join('\n\n');
        const prompt = [
          {
            role: 'system' as const,
            content: 'You are a private on-device RAG assistant. Answer the user question based strictly on the provided local document excerpts. Cite sources clearly.'
          },
          {
            role: 'user' as const,
            content: `Document Excerpts:\n${contextText}\n\nQuestion: ${query}`
          }
        ];

        let streamed = '';
        await webLlm.streamChat(prompt, (token) => {
          streamed += token;
          setSynthesizedAnswer(streamed);
        });
      } catch (err: any) {
        const fallback = vectorIndex.synthesizeAnswer(query, matched);
        setSynthesizedAnswer(fallback);
      }
    } else {
      const answer = vectorIndex.synthesizeAnswer(query, matched);
      setSynthesizedAnswer(answer);
    }

    setIsSearching(false);
  };

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 pb-24 md:pb-8 w-full">
      {/* Header Stat Strip */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-zinc-900 tracking-tight flex items-center gap-2">
            <Database className="w-5 h-5 text-indigo-600" />
            <span>Local Document RAG & Vector Index</span>
          </h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            100% Client-Side Vector Storage & In-Memory Retrieval • Zero Cloud Transmission
          </p>
        </div>

        {/* Index Metrics Bar */}
        <div className="flex items-center gap-2 text-xs flex-wrap">
          <div className="flex items-center gap-1.5 bg-zinc-100 px-2.5 py-1.5 rounded-xl border border-zinc-200">
            <Layers className="w-3.5 h-3.5 text-zinc-500" />
            <span className="text-zinc-500">Chunks:</span>
            <span className="font-semibold text-zinc-900">{totalChunks}</span>
          </div>

          <div className="flex items-center gap-1.5 bg-zinc-100 px-2.5 py-1.5 rounded-xl border border-zinc-200">
            <FileText className="w-3.5 h-3.5 text-zinc-500" />
            <span className="text-zinc-500">Words:</span>
            <span className="font-semibold text-zinc-900">{totalWords.toLocaleString()}</span>
          </div>

          <div className="flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1.5 rounded-xl border border-emerald-200">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span className="font-semibold text-emerald-700">Zero Keys</span>
          </div>
        </div>
      </div>

      {/* Mobile Segmented Switcher (Visible on small screens < lg) */}
      <div className="flex lg:hidden items-center bg-zinc-100 p-1 rounded-xl mb-4 border border-zinc-200">
        <button
          onClick={() => setMobileTab('query')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all min-h-[42px] flex items-center justify-center gap-1.5 ${
            mobileTab === 'query'
              ? 'bg-white text-zinc-900 shadow-xs'
              : 'text-zinc-600 active:bg-zinc-200'
          }`}
        >
          <Search className="w-4 h-4" />
          <span>Ask & Synthesize</span>
        </button>
        <button
          onClick={() => setMobileTab('docs')}
          className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all min-h-[42px] flex items-center justify-center gap-1.5 ${
            mobileTab === 'docs'
              ? 'bg-white text-zinc-900 shadow-xs'
              : 'text-zinc-600 active:bg-zinc-200'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Documents ({docs.length})</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Documents Manager (4 cols) */}
        <div className={`lg:col-span-4 space-y-4 ${mobileTab === 'docs' ? 'block' : 'hidden lg:block'}`}>
          <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-900 flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-zinc-500" />
                <span>Indexed Documents</span>
              </h3>
              <button
                id="btn-toggle-paste"
                onClick={() => setIsPasting(!isPasting)}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium underline underline-offset-2 min-h-[36px] flex items-center"
              >
                {isPasting ? 'Cancel' : '+ Paste Text'}
              </button>
            </div>

            {/* Upload Area */}
            <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-zinc-200 hover:border-zinc-400 rounded-xl cursor-pointer bg-zinc-50/50 hover:bg-zinc-50 transition-colors group min-h-[80px]">
              <UploadCloud className="w-6 h-6 text-zinc-400 group-hover:text-zinc-700 mb-1.5 transition-colors" />
              <span className="text-xs font-semibold text-zinc-800">Upload text or markdown file</span>
              <span className="text-[11px] text-zinc-400">.txt, .md, .csv, .json (100% client-side)</span>
              <input
                type="file"
                multiple
                accept=".txt,.md,.markdown,.json,.csv,.js,.ts"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>

            {/* Paste Modal/Form */}
            {isPasting && (
              <form onSubmit={handlePasteSubmit} className="p-3 bg-zinc-50 rounded-xl border border-zinc-200 space-y-2">
                <input
                  type="text"
                  placeholder="Document Title (e.g. Meeting Notes)"
                  value={pasteTitle}
                  onChange={(e) => setPasteTitle(e.target.value)}
                  className="w-full text-base sm:text-xs px-2.5 py-1.5 rounded-lg border border-zinc-200 bg-white focus:outline-hidden focus:border-zinc-700"
                />
                <textarea
                  rows={4}
                  placeholder="Paste text content here..."
                  value={pasteContent}
                  onChange={(e) => setPasteContent(e.target.value)}
                  className="w-full text-base sm:text-xs px-2.5 py-1.5 rounded-lg border border-zinc-200 bg-white focus:outline-hidden focus:border-zinc-700"
                  required
                />
                <button
                  type="submit"
                  className="w-full text-xs font-medium bg-zinc-900 text-white py-2 min-h-[44px] rounded-lg hover:bg-zinc-800 transition-colors"
                >
                  Index into Vector Space
                </button>
              </form>
            )}

            {/* Documents List */}
            <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {docs.length === 0 ? (
                <p className="text-xs text-zinc-400 text-center py-4">No documents indexed yet.</p>
              ) : (
                docs.map((d) => (
                  <div
                    key={d.id}
                    onClick={() => {
                      setActiveDocId(d.id);
                    }}
                    className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer border transition-all text-xs min-h-[44px] ${
                      activeDocId === d.id
                        ? 'bg-zinc-900 text-white border-zinc-900 shadow-xs'
                        : 'bg-zinc-50/70 hover:bg-zinc-100 text-zinc-800 border-zinc-200/80'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileText className={`w-3.5 h-3.5 shrink-0 ${activeDocId === d.id ? 'text-emerald-400' : 'text-zinc-500'}`} />
                      <div className="truncate">
                        <p className="font-medium truncate">{d.title}</p>
                        <p className={`text-[10px] ${activeDocId === d.id ? 'text-zinc-400' : 'text-zinc-500'}`}>
                          {d.chunks.length} chunks • {(d.sizeBytes / 1024).toFixed(1)} KB
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={(e) => handleDeleteDoc(d.id, e)}
                      className={`p-2 rounded-md transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center ${
                        activeDocId === d.id
                          ? 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                          : 'text-zinc-400 hover:text-rose-600 hover:bg-rose-50'
                      }`}
                      title="Delete document"
                      aria-label="Delete document"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Active Document Preview */}
          {activeDoc && (
            <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-xs text-xs space-y-2">
              <div className="flex items-center justify-between pb-1.5 border-b border-zinc-100">
                <span className="font-semibold text-zinc-900 truncate">{activeDoc.title}</span>
                <span className="text-[10px] text-zinc-400 font-mono">
                  {(activeDoc.sizeBytes / 1024).toFixed(1)} KB
                </span>
              </div>
              <p className="text-zinc-600 whitespace-pre-wrap max-h-48 overflow-y-auto line-clamp-6 leading-relaxed font-mono text-[11px] bg-zinc-50 p-2.5 rounded-lg border border-zinc-100">
                {activeDoc.rawText}
              </p>
            </div>
          )}
        </div>

        {/* Right Column: Q&A and Vector Search (8 cols) */}
        <div className={`lg:col-span-8 space-y-4 ${mobileTab === 'query' ? 'block' : 'hidden lg:block'}`}>
          {/* Query Form */}
          <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-xs space-y-3">
            <form onSubmit={handleSearch} className="space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-3.5" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Ask a question across your local indexed documents..."
                  className="w-full text-base sm:text-sm pl-9 pr-3 py-2.5 rounded-xl border border-zinc-200 focus:outline-hidden focus:border-zinc-900 transition-colors"
                />
              </div>

              <div className="flex items-center justify-between gap-2 flex-wrap">
                {/* Engine Selector for RAG */}
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-xs text-zinc-600 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={useNeuralLlm}
                      onChange={(e) => setUseNeuralLlm(e.target.checked)}
                      className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="flex items-center gap-1">
                      {webLlm.isReady() ? (
                        <>
                          <BrainCircuit className="w-3.5 h-3.5 text-indigo-600" />
                          <span className="font-medium text-indigo-900">Use On-Device WebGPU LLM</span>
                        </>
                      ) : (
                        <>
                          <Cpu className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Vector Centroid Engine (Instant)</span>
                        </>
                      )}
                    </span>
                  </label>
                </div>

                <button
                  id="btn-ask-docs"
                  type="submit"
                  disabled={!query.trim() || isSearching}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 min-h-[44px] bg-zinc-900 text-white rounded-xl text-xs font-semibold hover:bg-zinc-800 active:scale-95 disabled:opacity-40 transition-all shadow-xs ml-auto"
                >
                  {isSearching ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Searching Vector Space...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Search & Synthesize</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Synthesized Answer Card */}
          {synthesizedAnswer && (
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-emerald-100 shadow-xs space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-emerald-50 text-xs text-emerald-700 font-semibold">
                <Sparkles className="w-4 h-4" />
                <span>On-Device RAG Synthesis (Zero API Keys)</span>
              </div>
              <div className="prose prose-sm max-w-none text-zinc-800 leading-relaxed">
                <ReactMarkdown>{synthesizedAnswer}</ReactMarkdown>
              </div>
            </div>
          )}

          {/* Matched Vector Chunks */}
          {searchResults.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                Matched Local Chunks ({searchResults.length})
              </h4>

              <div className="space-y-2.5">
                {searchResults.map((chunk, idx) => (
                  <div
                    key={chunk.id || idx}
                    className="p-3.5 bg-white rounded-2xl border border-zinc-200/80 shadow-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-xs pb-1 border-b border-zinc-100">
                      <span className="font-semibold text-zinc-800 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-zinc-400" />
                        <span>{chunk.docTitle}</span>
                        <span className="text-zinc-400 font-normal">#chunk-{chunk.index + 1}</span>
                      </span>

                      {chunk.score !== undefined && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {Math.round(chunk.score * 100)}% Match
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-zinc-600 leading-relaxed font-sans">
                      "{chunk.content}"
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
