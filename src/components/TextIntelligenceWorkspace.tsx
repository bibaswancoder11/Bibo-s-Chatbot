import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Gauge,
  BookOpen,
  Tag,
  Cpu,
  Layers,
  FileText,
  RotateCcw,
  Check,
  Copy,
  Sliders,
  Award
} from 'lucide-react';
import { PureLocalNLP } from '../services/localAiEngine';
import { TextAnalysisResult } from '../types';

const SAMPLE_TEXTS = [
  {
    title: 'Product Review (Positive)',
    text: `I have been testing this local AI app for the past week, and the performance is absolutely outstanding! The zero-key architecture is brilliantly implemented, ensuring that none of my confidential project documents are ever transmitted to third-party cloud servers. Inference is instantaneous and requires no API tokens or billing subscriptions. The privacy and speed make this an indispensable tool for our engineering workflow.`
  },
  {
    title: 'Customer Complaint (Negative)',
    text: `The previous cloud software was a complete disaster. It constantly failed with network timeout errors, required expensive API keys that repeatedly hit rate limits, and created massive compliance risks by sending our proprietary code to external servers. The user experience was confusing, frustrating, and inefficient.`
  },
  {
    title: 'Technical Whitepaper',
    text: `WebAssembly enables high-performance execution of compiled binary modules directly within web browsers at near-native speed. In the context of edge artificial intelligence, client-side neural execution leverages WebGPU compute shaders to distribute tensor multiplications across parallel GPU hardware without requiring server-side compute clusters or API gateway credentials. This radically reduces latency and infrastructure overhead for privacy-preserving applications.`
  }
];

export const TextIntelligenceWorkspace: React.FC = () => {
  const [inputText, setInputText] = useState(SAMPLE_TEXTS[0].text);
  const [summarySentences, setSummarySentences] = useState(2);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const analysis: TextAnalysisResult = useMemo(() => {
    return {
      sentiment: PureLocalNLP.analyzeSentiment(inputText),
      readability: PureLocalNLP.calculateReadability(inputText),
      keyTopics: PureLocalNLP.extractKeyTopics(inputText, 6),
      entities: PureLocalNLP.extractEntities(inputText),
      summary: PureLocalNLP.summarize(inputText, summarySentences)
    };
  }, [inputText, summarySentences]);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(label);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  const handleQuickTransform = (type: 'bullets' | 'tldr' | 'clean') => {
    if (type === 'bullets') {
      const sentences = PureLocalNLP.getSentences(inputText);
      const bullets = sentences.map(s => `• ${s}`).join('\n');
      setInputText(bullets);
    } else if (type === 'tldr') {
      const summary = PureLocalNLP.summarize(inputText, 2);
      setInputText(`TL;DR:\n${summary}`);
    } else if (type === 'clean') {
      const cleaned = inputText.replace(/\s+/g, ' ').trim();
      setInputText(cleaned);
    }
  };

  const getSentimentBadge = () => {
    if (analysis.sentiment.label === 'POSITIVE') {
      return { label: 'Positive', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', barColor: 'bg-emerald-500' };
    }
    if (analysis.sentiment.label === 'NEGATIVE') {
      return { label: 'Negative', bg: 'bg-rose-50 text-rose-700 border-rose-200', barColor: 'bg-rose-500' };
    }
    return { label: 'Neutral', bg: 'bg-zinc-100 text-zinc-700 border-zinc-200', barColor: 'bg-zinc-400' };
  };

  const sentimentBadge = getSentimentBadge();

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 pb-24 md:pb-8 space-y-4 sm:space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-2xl border border-zinc-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <Sparkles className="w-5 h-5 text-emerald-600 shrink-0" />
            <h2 className="text-base font-bold text-zinc-900 tracking-tight">On-Device Text Intelligence & NLP</h2>
            <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-medium">
              Zero API Keys
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-0.5">
            Real-time sentiment scoring, Flesch readability grades, key concept clustering, and centroid summarization.
          </p>
        </div>

        {/* Sample Loaders (Horizontally scrollable on mobile) */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs py-1">
          <span className="text-zinc-400 font-medium whitespace-nowrap">Presets:</span>
          {SAMPLE_TEXTS.map((sample, idx) => (
            <button
              key={idx}
              onClick={() => setInputText(sample.text)}
              className="px-2.5 py-1.5 bg-zinc-100 hover:bg-zinc-200/80 active:bg-zinc-200 text-zinc-700 rounded-lg transition-colors whitespace-nowrap min-h-[36px] flex items-center"
            >
              {sample.title}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Input Editor & Quick Tools (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-zinc-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-700 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-zinc-500" />
                <span>Text Editor</span>
              </span>
              <button
                onClick={() => setInputText('')}
                className="text-xs text-zinc-400 hover:text-rose-600 flex items-center gap-1 min-h-[36px] px-1"
                title="Clear text"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Clear</span>
              </button>
            </div>

            <textarea
              id="nlp-input-textarea"
              rows={8}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Paste or type text to analyze locally..."
              className="w-full text-base sm:text-xs p-3 rounded-xl border border-zinc-200 bg-zinc-50/50 focus:bg-white focus:outline-hidden focus:border-zinc-800 transition-colors leading-relaxed font-sans"
            />

            {/* Quick Actions */}
            <div className="pt-2 border-t border-zinc-100 flex items-center justify-between gap-2 flex-wrap text-xs">
              <span className="text-zinc-400 font-medium">Quick Transform:</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  onClick={() => handleQuickTransform('bullets')}
                  className="px-2.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg transition-colors min-h-[36px]"
                >
                  To Bullets
                </button>
                <button
                  onClick={() => handleQuickTransform('tldr')}
                  className="px-2.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg transition-colors min-h-[36px]"
                >
                  Prepend TL;DR
                </button>
                <button
                  onClick={() => handleQuickTransform('clean')}
                  className="px-2.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-lg transition-colors min-h-[36px]"
                >
                  Trim Spaces
                </button>
              </div>
            </div>
          </div>

          {/* Summarizer Controls & Result */}
          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-zinc-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-semibold text-zinc-900">Extractive Summarizer</h3>
              </div>
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <span>{summarySentences} Sentences</span>
                <input
                  type="range"
                  min="1"
                  max="4"
                  value={summarySentences}
                  onChange={(e) => setSummarySentences(parseInt(e.target.value))}
                  className="w-20 accent-zinc-900"
                />
              </div>
            </div>

            <div className="p-3 bg-zinc-50 rounded-xl border border-zinc-100 text-xs sm:text-sm text-zinc-700 leading-relaxed relative group">
              <p>{analysis.summary || 'Summary will appear here when text is provided.'}</p>
              {analysis.summary && (
                <button
                  onClick={() => handleCopy(analysis.summary, 'summary')}
                  className="absolute top-2 right-2 opacity-80 sm:opacity-0 group-hover:opacity-100 p-1.5 text-zinc-400 hover:text-zinc-700 bg-white/90 rounded-md transition-opacity min-w-[32px] min-h-[32px] flex items-center justify-center"
                  title="Copy summary"
                  aria-label="Copy summary"
                >
                  {copiedSection === 'summary' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Analytical Meters & Deep Extraction (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          {/* Sentiment & Readability Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Sentiment Meter */}
            <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-zinc-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-600 flex items-center gap-1.5">
                  <Gauge className="w-4 h-4 text-zinc-400" />
                  <span>Sentiment & Valence</span>
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold ${sentimentBadge.bg}`}>
                  {sentimentBadge.label}
                </span>
              </div>

              {/* Bar visualization */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-zinc-500">
                  <span>Neg (-1.0)</span>
                  <span className="font-semibold text-zinc-800">
                    Valence: {analysis.sentiment.valence > 0 ? `+${analysis.sentiment.valence}` : analysis.sentiment.valence}
                  </span>
                  <span>Pos (+1.0)</span>
                </div>
                <div className="w-full bg-zinc-100 rounded-full h-2 overflow-hidden flex">
                  <div
                    className={`h-full transition-all ${sentimentBadge.barColor}`}
                    style={{ width: `${Math.round(analysis.sentiment.score * 100)}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-100 text-xs">
                <div>
                  <p className="text-zinc-400">Confidence</p>
                  <p className="font-semibold text-zinc-800">{Math.round(analysis.sentiment.score * 100)}%</p>
                </div>
                <div>
                  <p className="text-zinc-400">Subjectivity</p>
                  <p className="font-semibold text-zinc-800">{Math.round(analysis.sentiment.subjectivity * 100)}%</p>
                </div>
              </div>
            </div>

            {/* Readability Score */}
            <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-zinc-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-600 flex items-center gap-1.5">
                  <Award className="w-4 h-4 text-zinc-400" />
                  <span>Flesch Readability</span>
                </span>
                <span className="text-xs font-bold text-zinc-900 bg-zinc-100 px-2 py-0.5 rounded-md">
                  {analysis.readability.fleschKincaidScore} / 100
                </span>
              </div>

              <div>
                <p className="text-xs text-zinc-500">Grade Equivalent</p>
                <p className="text-sm font-semibold text-zinc-900">{analysis.readability.readingLevel}</p>
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-zinc-100 text-xs">
                <div>
                  <p className="text-zinc-400">Read Time</p>
                  <p className="font-semibold text-zinc-800">~{analysis.readability.readingTimeMinutes} min</p>
                </div>
                <div>
                  <p className="text-zinc-400">Words/Sent</p>
                  <p className="font-semibold text-zinc-800">{analysis.readability.avgWordsPerSentence}</p>
                </div>
                <div>
                  <p className="text-zinc-400">Total Words</p>
                  <p className="font-semibold text-zinc-800">{analysis.readability.wordCount}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Key Topics & Concepts */}
          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-zinc-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-zinc-600 uppercase tracking-wider flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-zinc-400" />
                <span>Key Topics & Concepts</span>
              </h3>
              <span className="text-[11px] text-zinc-400">Calculated via N-Gram Frequency</span>
            </div>

            <div className="flex flex-wrap gap-2">
              {analysis.keyTopics.length === 0 ? (
                <p className="text-xs text-zinc-400">No key concepts identified yet.</p>
              ) : (
                analysis.keyTopics.map((topic, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-zinc-100 text-zinc-800 border border-zinc-200/60"
                  >
                    #{topic}
                  </span>
                ))
              )}
            </div>
          </div>

          {/* Named Entities Extraction */}
          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-zinc-200 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-zinc-600 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-zinc-400" />
                <span>Extracted Entities & Attributes</span>
              </h3>
              <span className="text-[11px] text-zinc-400">{analysis.entities.length} detected</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
              {analysis.entities.length === 0 ? (
                <p className="text-xs text-zinc-400 col-span-2 py-2">
                  No specialized entities or metrics detected in this excerpt.
                </p>
              ) : (
                analysis.entities.map((ent, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-xl bg-zinc-50 border border-zinc-100 text-xs"
                  >
                    <span className="font-semibold text-zinc-900 truncate">{ent.text}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white text-zinc-500 font-medium border border-zinc-200 shrink-0">
                      {ent.type}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
