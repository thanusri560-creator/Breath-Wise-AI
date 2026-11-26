import {
  Leaf,
  RefreshCw,
  Shield,
  Sparkles,
  Wind,
} from 'lucide-react';
import type {
  AirQualityReading,
  LowEmissionPlanResult,
} from '../domain/airQualityTypes';
import { AQIIndicator } from './AQIIndicator';
import { StatusIndicator } from './StatusIndicator';

interface LowEmissionAlternativesProps {
  airQuality: AirQualityReading;
  plan: LowEmissionPlanResult;
  loadingAi: boolean;
  aiNotice: string | null;
  onEnhanceWithGemini: () => void;
}

export function LowEmissionAlternatives({
  airQuality,
  plan,
  loadingAi,
  aiNotice,
  onEnhanceWithGemini,
}: LowEmissionAlternativesProps) {
  return (
    <div className="space-y-6">
      {/* Header + Explicit Distinction Framework */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5 max-w-3xl">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-display text-2xl font-bold text-slate-900 flex items-center gap-2">
                <Leaf className="w-5 h-5 text-teal-700" />
                <span>Low-Emission Daily Alternatives</span>
              </h2>
              <AQIIndicator aqi={airQuality.aqi} category={airQuality.category} compact />
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              {plan.currentConditionSummary}
            </p>
          </div>

          <button
            type="button"
            onClick={onEnhanceWithGemini}
            disabled={loadingAi}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
          >
            {loadingAi ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            <span>{loadingAi ? 'Refreshing...' : 'Tailor with Gemini AI'}</span>
          </button>
        </div>

        {/* Core Scientific Principle: Personal Exposure vs Community Emissions */}
        <div className="bg-[#0B1220] text-slate-100 rounded-xl p-5 grid grid-cols-1 md:grid-cols-2 gap-5 border border-slate-800">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-cyan-300">
              <Shield className="w-4 h-4" />
              <span>Dimension A · Personal Exposure Reduction</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
              Actions that protect the air you personally breathe today (indoor HEPA filtration, sealing windows during smog peaks, avoiding roadside exertion, enclosed transit cabins).
            </p>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-teal-300">
              <Wind className="w-4 h-4" />
              <span>Dimension B · Community Emission Reduction</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
              Actions that cut tailpipe CO₂, NOx, and exhaust particulates released into shared city air (public transit, carpooling, trip-chaining, remote days, cleaner cooking).
            </p>
          </div>
          <div className="md:col-span-2 pt-3 border-t border-slate-800 text-xs text-slate-300 leading-relaxed">
            <strong className="text-white">Key Distinction:</strong> {plan.keyDistinctionSummary}
          </div>
        </div>

        {aiNotice && (
          <div role="status" className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
            {aiNotice}
          </div>
        )}
      </section>

      {/* Option Cards Comparing Both Dimensions Explicitly */}
      <section aria-label="Low-emission travel and routine options" className="space-y-4">
        {plan.options.map((opt, idx) => {
          const tone =
            opt.feasibility === 'Recommended Today'
              ? 'feasible'
              : opt.feasibility === 'Conditional — Check Window'
                ? 'warning'
                : 'critical';

          return (
            <article
              key={`${opt.mode}-${idx}`}
              className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
                <h3 className="font-display text-lg font-bold text-slate-900">
                  {opt.mode}
                </h3>
                <StatusIndicator tone={tone} label={opt.feasibility} />
              </div>

              <p className="text-sm font-medium text-slate-900 leading-relaxed">
                {opt.suggestedAction}
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                  <div className="text-xs font-semibold uppercase tracking-wider text-cyan-800">
                    Personal Exposure Outcome
                  </div>
                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                    {opt.personalExposureOutcome}
                  </p>
                </div>

                <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
                  <div className="text-xs font-semibold uppercase tracking-wider text-teal-800">
                    Community Emission Outcome
                  </div>
                  <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                    {opt.communityEmissionOutcome}
                  </p>
                </div>
              </div>

              <div className="text-xs text-slate-600 space-y-1 pt-2 border-t border-slate-100">
                <p>
                  <strong className="text-slate-800">Exposure vs. Emissions Note:</strong>{' '}
                  {opt.distinctionNote}
                </p>
                <p>
                  <strong className="text-slate-800">Assumptions & Conditions:</strong>{' '}
                  {opt.assumptionsAndLimitations}
                </p>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
}
