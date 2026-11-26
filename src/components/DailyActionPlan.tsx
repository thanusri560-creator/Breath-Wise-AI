import { useState } from 'react';
import {
  CheckCircle2,
  Circle,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import type {
  AirQualityReading,
  DailyActionPlanResult,
  LifestyleType,
  UserProfile,
} from '../domain/airQualityTypes';
import { COMMUTE_LABELS, FILTRATION_LABELS, LIFESTYLE_LABELS } from '../data/breathewiseDefaults';
import { AQIIndicator } from './AQIIndicator';

interface DailyActionPlanProps {
  airQuality: AirQualityReading;
  profile: UserProfile;
  plan: DailyActionPlanResult;
  isAiActive: boolean;
  loadingAi: boolean;
  aiNotice: string | null;
  onUpdateProfile: (patch: Partial<UserProfile>) => void;
  onEnhanceWithGemini: (forceRefresh?: boolean) => void;
}

export function DailyActionPlan({
  airQuality,
  profile,
  plan,
  isAiActive,
  loadingAi,
  aiNotice,
  onUpdateProfile,
  onEnhanceWithGemini,
}: DailyActionPlanProps) {
  const [acceptedIds, setAcceptedIds] = useState<Record<string, boolean>>({});

  const toggleAccepted = (id: string) => {
    setAcceptedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const acceptedCount = plan.recommendations.filter((r) => acceptedIds[r.id]).length;

  return (
    <div className="space-y-6">
      {/* Header & Instant Lifestyle Calibration Bar */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-display text-2xl font-bold text-slate-900">
                Personalized Daily Air Routine
              </h2>
              <AQIIndicator
                aqi={airQuality.aqi}
                category={airQuality.category}
                compact
              />
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">{plan.summary}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => onEnhanceWithGemini(isAiActive)}
              disabled={loadingAi}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
            >
              {loadingAi ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              <span>
                {loadingAi
                  ? 'Synthesizing with Gemini...'
                  : isAiActive
                    ? 'Regenerate Gemini Plan'
                    : 'Enhance with Gemini AI'}
              </span>
            </button>
          </div>
        </div>

        {/* Live Lifestyle Switcher — demonstrates instant Air Action Engine propagation */}
        <div className="pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label
              htmlFor="routine-lifestyle-select"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5"
            >
              Active Lifestyle Profile
            </label>
            <select
              id="routine-lifestyle-select"
              value={profile.lifestyle}
              onChange={(e) => onUpdateProfile({ lifestyle: e.target.value as LifestyleType })}
              className="w-full h-10 px-3 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
            >
              {(Object.keys(LIFESTYLE_LABELS) as LifestyleType[]).map((key) => (
                <option key={key} value={key}>
                  {LIFESTYLE_LABELS[key]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Commute & Filtration Context
            </div>
            <div className="text-sm text-slate-800 font-medium leading-snug">
              {COMMUTE_LABELS[profile.commute]} ({profile.commuteDistanceKm} km) ·{' '}
              {FILTRATION_LABELS[profile.filtration]}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Plan Engine & Review Status
            </div>
            <div className="text-sm text-slate-800 font-medium">
              {plan.source} ·{' '}
              <span className="font-mono tabular-nums text-teal-700">
                {acceptedCount}/{plan.recommendations.length} accepted
              </span>
            </div>
          </div>
        </div>

        {aiNotice && (
          <div
            role="status"
            className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900"
          >
            {aiNotice}
          </div>
        )}
      </section>

      {/* Morning, Afternoon, Evening Direct Impact Cards */}
      <section aria-label="Morning, afternoon, and evening recommendations" className="space-y-4">
        {plan.recommendations.map((rec) => {
          const accepted = Boolean(acceptedIds[rec.id]);
          return (
            <article
              key={rec.id}
              className={`bg-white border rounded-xl p-6 transition-colors ${
                accepted ? 'border-teal-500 bg-teal-50/20' : 'border-slate-200'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-200">
                <div>
                  <div className="flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-wider">
                    <span className="text-teal-700">{rec.timeBlock}</span>
                    <span className="text-slate-300">|</span>
                    <span className="font-mono tabular-nums text-slate-600">
                      {rec.timeWindow}
                    </span>
                    <span className="text-slate-300">|</span>
                    <span className="text-cyan-800">{rec.benefitDimension}</span>
                  </div>
                  <h3 className="mt-1 font-display text-lg font-bold text-slate-900">
                    {rec.activity}
                  </h3>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-slate-600">
                    Confidence: <strong className="text-slate-900">{rec.confidence}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleAccepted(rec.id)}
                    aria-pressed={accepted}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 ${
                      accepted
                        ? 'bg-teal-700 text-white border-teal-700'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {accepted ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <Circle className="w-3.5 h-3.5" />
                    )}
                    <span>{accepted ? 'Accepted for Today' : 'Accept Action'}</span>
                  </button>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-5 text-sm">
                <div className="space-y-1">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    1. Suggested Action (What)
                  </div>
                  <p className="text-slate-900 font-medium leading-relaxed">
                    {rec.suggestedAction}
                  </p>
                </div>

                <div className="space-y-1">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    2. Environmental & Schedule Reason (Why)
                  </div>
                  <p className="text-slate-700 leading-relaxed">{rec.whySuggested}</p>
                </div>

                <div className="space-y-1">
                  <div className="text-xs font-semibold uppercase tracking-wider text-teal-700">
                    3. Expected Direct Benefit ({rec.benefitDimension})
                  </div>
                  <p className="text-slate-800 leading-relaxed">{rec.directBenefit}</p>
                </div>

                <div className="space-y-1">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    4. Assumptions & Data Limitations
                  </div>
                  <p className="text-slate-600 text-xs leading-relaxed">
                    {rec.assumptionsAndLimitations}
                  </p>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      <footer className="bg-slate-100 border border-slate-200 rounded-xl p-4 text-xs text-slate-700 leading-relaxed">
        <strong className="text-slate-900">Public Health Note:</strong> {plan.publicHealthAdvisory}
      </footer>
    </div>
  );
}
