import React, { useState } from 'react';
import {
  Bot,
  RotateCcw,
  Send,
  ShieldAlert,
} from 'lucide-react';
import type {
  AirQualityReading,
  ChatMessage,
  UserProfile,
} from '../domain/airQualityTypes';
import { LIFESTYLE_LABELS, QUICK_ASSISTANT_PROMPTS } from '../data/breathewiseDefaults';
import { useDebounce } from '../hooks/useDebounce';
import { AQIIndicator } from './AQIIndicator';
import { MarkdownProse } from './MarkdownProse';

interface GeminiAirAssistantProps {
  airQuality: AirQualityReading;
  profile: UserProfile;
  messages: ChatMessage[];
  loading: boolean;
  notice: string | null;
  geminiConfigured: boolean;
  onSendMessage: (question: string) => void;
  onResetChat: () => void;
}

export function GeminiAirAssistant({
  airQuality,
  profile,
  messages,
  loading,
  notice,
  geminiConfigured,
  onSendMessage,
  onResetChat,
}: GeminiAirAssistantProps) {
  const [draft, setDraft] = useState('');
  const debouncedDraft = useDebounce(draft, 250);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.trim() || loading) return;
    onSendMessage(draft);
    setDraft('');
  };

  const showLengthHint = debouncedDraft.length > 420;

  return (
    <div className="space-y-6">
      {/* Assistant Header & Context Transparency */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-display text-2xl font-bold text-slate-900 flex items-center gap-2">
                <Bot className="w-5 h-5 text-teal-700" />
                <span>Gemini Air Quality Assistant</span>
              </h2>
              <AQIIndicator aqi={airQuality.aqi} category={airQuality.category} compact />
            </div>
            <p className="text-sm text-slate-600">
              Grounded in {airQuality.cityName} ({airQuality.aqi !== null ? `AQI ${airQuality.aqi}` : 'AQI unavailable'}),{' '}
              {LIFESTYLE_LABELS[profile.lifestyle]}, and your indoor filtration settings.{' '}
              {geminiConfigured ? 'Powered by server-side Gemini AI.' : 'Deterministic fallback engine active.'}
            </p>
          </div>

          <button
            type="button"
            onClick={onResetChat}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Thread</span>
          </button>
        </div>

        {/* Quick-Ask Prompt Grid */}
        <div className="pt-3 border-t border-slate-200">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
            Suggested Environmental Questions
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {QUICK_ASSISTANT_PROMPTS.map((q) => (
              <button
                key={q}
                type="button"
                disabled={loading}
                onClick={() => onSendMessage(q)}
                className="text-left px-3 py-2 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-teal-50 hover:text-teal-900 border border-slate-200 hover:border-teal-400 rounded-lg transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Conversation Transcript */}
      <section
        aria-label="Conversation transcript"
        aria-live="polite"
        className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col"
      >
        <div className="p-6 space-y-5 max-h-[520px] overflow-y-auto">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-3xl rounded-xl px-4 py-3.5 ${
                    isUser
                      ? 'bg-[#0B1220] text-white'
                      : 'bg-slate-50 border border-slate-200 text-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-4 mb-1.5 text-[11px]">
                    <span className={`font-semibold ${isUser ? 'text-cyan-300' : 'text-teal-800'}`}>
                      {isUser ? 'You' : 'BreatheWise AI'}
                    </span>
                    <span className={`font-mono tabular-nums ${isUser ? 'text-slate-400' : 'text-slate-500'}`}>
                      {msg.timestamp}
                    </span>
                  </div>
                  {isUser ? (
                    <p className="text-sm leading-relaxed">{msg.content}</p>
                  ) : (
                    <MarkdownProse text={msg.content} />
                  )}
                  {msg.contextNote && (
                    <p className="mt-2.5 pt-2 border-t border-slate-200 text-[11px] text-slate-500">
                      {msg.contextNote}
                    </p>
                  )}
                </div>
              </div>
            );
          })}

          {loading && (
            <div className="text-xs font-medium text-teal-800 bg-teal-50 border border-teal-200 rounded-lg px-4 py-3 inline-block">
              Evaluating {airQuality.cityName} air quality and your routine with Gemini AI...
            </div>
          )}
        </div>

        {notice && (
          <div
            role="status"
            className="mx-6 mb-3 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900"
          >
            {notice}
          </div>
        )}

        {/* Composer */}
        <form
          onSubmit={handleSubmit}
          className="p-4 bg-slate-50 border-t border-slate-200 space-y-2"
        >
          <label htmlFor="assistant-question-input" className="sr-only">
            Ask BreatheWise AI a question about air quality
          </label>
          <div className="flex gap-2.5">
            <input
              id="assistant-question-input"
              type="text"
              maxLength={500}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Ask about opening windows, N95 masks, cooking fumes, or commuting in smog..."
              className="flex-1 h-11 px-4 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
            />
            <button
              type="submit"
              disabled={loading || !draft.trim()}
              className="inline-flex items-center gap-2 px-5 h-11 rounded-lg bg-teal-700 hover:bg-teal-800 disabled:bg-slate-300 text-white text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
            >
              <Send className="w-4 h-4" />
              <span>Ask</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-slate-500" />
              Non-diagnostic environmental guidance. Always follow official municipal public-health advisories.
            </span>
            {showLengthHint && (
              <span className="font-mono tabular-nums text-amber-700">
                {draft.length}/500 chars
              </span>
            )}
          </div>
        </form>
      </section>
    </div>
  );
}
