/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { PrivacyBanner } from './components/PrivacyBanner';
import { ChatWorkspace } from './components/ChatWorkspace';
import { DocumentRagWorkspace } from './components/DocumentRagWorkspace';
import { TextIntelligenceWorkspace } from './components/TextIntelligenceWorkspace';
import { EngineSettingsModal } from './components/EngineSettingsModal';
import { EngineConfig } from './types';
import { webLlm } from './services/webLlmService';
import { safeStorage } from './utils/safeStorage';

const DEFAULT_CONFIG: EngineConfig = {
  activeEngine: 'in-browser-nlp',
  webLlmModel: 'SmolLM2-360M-Instruct-q4f16_1-MLC',
  ollamaUrl: 'http://localhost:11434',
  ollamaModel: 'llama3',
  transformersModel: 'Xenova/distilgpt2',
  temperature: 0.7,
  systemPrompt: 'You are a helpful, versatile local AI assistant running directly on device with zero API keys.'
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'chat' | 'rag' | 'nlp' | 'settings'>('chat');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [config, setConfig] = useState<EngineConfig>(() => {
    const saved = safeStorage.getItem('local_ai_config');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...DEFAULT_CONFIG, ...parsed };
      } catch {
        // use default
      }
    }
    return DEFAULT_CONFIG;
  });

  useEffect(() => {
    try {
      safeStorage.setItem('local_ai_config', JSON.stringify(config));
    } catch {
      // safe fallback
    }
  }, [config]);

  const handleOpenSettings = () => {
    setIsSettingsOpen(true);
  };

  const handleSaveConfig = (updated: EngineConfig) => {
    setConfig(updated);
  };

  const handleUpdateConfigPartial = (partial: Partial<EngineConfig>) => {
    setConfig(prev => ({ ...prev, ...partial }));
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 flex flex-col font-sans antialiased selection:bg-zinc-200">
      {/* Top Navigation Header & Mobile Bottom Navigation */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          if (tab === 'settings') {
            setIsSettingsOpen(true);
          } else {
            setActiveTab(tab);
          }
        }}
        activeEngine={config.activeEngine}
        openSettings={handleOpenSettings}
      />

      {/* Zero-Key & Privacy Guarantee Banner */}
      <PrivacyBanner />

      {/* Main Workspace Area */}
      <main className="flex-1 flex flex-col">
        {activeTab === 'chat' && (
          <ChatWorkspace
            config={config}
            onOpenSettings={handleOpenSettings}
            onUpdateConfig={handleUpdateConfigPartial}
          />
        )}

        {activeTab === 'rag' && (
          <DocumentRagWorkspace />
        )}

        {activeTab === 'nlp' && (
          <TextIntelligenceWorkspace />
        )}
      </main>

      {/* Engine & Zero-Key Settings Modal */}
      <EngineSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        config={config}
        onSaveConfig={handleSaveConfig}
      />
    </div>
  );
}
