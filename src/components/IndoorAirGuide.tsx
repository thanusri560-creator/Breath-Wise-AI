import {
  AlertTriangle,
  Home,
  Info,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import type {
  AirQualityReading,
  IndoorEnvironmentInput,
  IndoorGuideResult,
} from '../domain/airQualityTypes';
import { AQIIndicator } from './AQIIndicator';

interface IndoorAirGuideProps {
  airQuality: AirQualityReading;
  indoor: IndoorEnvironmentInput;
  guide: IndoorGuideResult;
  loadingAi: boolean;
  aiNotice: string | null;
  onUpdateIndoor: (patch: Partial<IndoorEnvironmentInput>) => void;
  onEnhanceWithGemini: () => void;
}

const SMOKE_SOURCE_OPTIONS = [
  'None',
  'Occasional incense',
  'Scented candles',
  'Indoor tobacco smoke',
  'Wood / coal / biomass heater',
];

export function IndoorAirGuide({
  airQuality,
  indoor,
  guide,
  loadingAi,
  aiNotice,
  onUpdateIndoor,
  onEnhanceWithGemini,
}: IndoorAirGuideProps) {
  const toggleSmokeSource = (source: string) => {
    if (source === 'None') {
      onUpdateIndoor({ indoorSmokeSources: ['None'] });
      return;
    }
    const filtered = indoor.indoorSmokeSources.filter((s) => s !== 'None');
    const exists = filtered.includes(source);
    const next = exists ? filtered.filter((s) => s !== source) : [...filtered, source];
    onUpdateIndoor({ indoorSmokeSources: next.length > 0 ? next : ['None'] });
  };

  return (
    <div className="space-y-6">
      {/* Header & Interactive Home Profile Controls */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-display text-2xl font-bold text-slate-900 flex items-center gap-2">
                <Home className="w-5 h-5 text-teal-700" />
                <span>Interactive Indoor Air Quality Guide</span>
              </h2>
              <AQIIndicator aqi={airQuality.aqi} category={airQuality.category} compact />
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              {guide.overallAssessment}
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
            <span>{loadingAi ? 'Synthesizing...' : 'Personalize with Gemini'}</span>
          </button>
        </div>

        {/* Interactive Indoor Configuration Form */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pt-4 border-t border-slate-200">
          <div>
            <label
              htmlFor="indoor-ventilation"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5"
            >
              Windows & Ventilation Habit
            </label>
            <select
              id="indoor-ventilation"
              value={indoor.ventilationHabit}
              onChange={(e) =>
                onUpdateIndoor({
                  ventilationHabit: e.target.value as IndoorEnvironmentInput['ventilationHabit'],
                })
              }
              className="w-full h-10 px-3 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
            >
              <option value="closed_sealed">Windows Closed & Sealed</option>
              <option value="cracked_windows">Cracked Windows / Drafty Frames</option>
              <option value="cross_ventilation">Open Cross-Ventilation</option>
              <option value="exhaust_only">Kitchen/Bath Exhaust Fans Only</option>
              <option value="unknown">Unknown / Not Sure</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="indoor-cooking"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5"
            >
              Cooking Practice
            </label>
            <select
              id="indoor-cooking"
              value={indoor.cookingPractice}
              onChange={(e) =>
                onUpdateIndoor({
                  cookingPractice: e.target.value as IndoorEnvironmentInput['cookingPractice'],
                })
              }
              className="w-full h-10 px-3 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
            >
              <option value="gas_stove">Gas Stove</option>
              <option value="high_heat_frying">High-Heat Oil Frying / Tempering</option>
              <option value="electric_induction">Electric / Induction Range</option>
              <option value="solid_fuel">Solid Fuel / Biomass Stove</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="indoor-hood"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5"
            >
              Kitchen Range Hood
            </label>
            <select
              id="indoor-hood"
              value={indoor.rangeHood}
              onChange={(e) =>
                onUpdateIndoor({
                  rangeHood: e.target.value as IndoorEnvironmentInput['rangeHood'],
                })
              }
              className="w-full h-10 px-3 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
            >
              <option value="vented_outdoors">Ducted / Vented Outdoors</option>
              <option value="recirculating">Recirculating (Vents Back Inside)</option>
              <option value="none">No Range Hood</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="indoor-purifier"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5"
            >
              Air Purifier Availability
            </label>
            <select
              id="indoor-purifier"
              value={indoor.purifierAvailability}
              onChange={(e) =>
                onUpdateIndoor({
                  purifierAvailability: e.target
                    .value as IndoorEnvironmentInput['purifierAvailability'],
                })
              }
              className="w-full h-10 px-3 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
            >
              <option value="hepa_purifier">Portable True-HEPA Purifier</option>
              <option value="hvac_merv13">Central HVAC (MERV-13+ Filter)</option>
              <option value="diy_corsi_rosenthal">DIY MERV-13 Box-Fan Filter</option>
              <option value="basic_ac_filter">Basic AC Mesh Only</option>
              <option value="none">No Purifier</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="indoor-room-size"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5"
            >
              Primary Room Size
            </label>
            <select
              id="indoor-room-size"
              value={indoor.roomSize}
              onChange={(e) =>
                onUpdateIndoor({
                  roomSize: e.target.value as IndoorEnvironmentInput['roomSize'],
                })
              }
              className="w-full h-10 px-3 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
            >
              <option value="small_under_15m2">Compact Room (&lt; 15 m²)</option>
              <option value="medium_15_to_35m2">Medium Room (15–35 m²)</option>
              <option value="large_over_35m2">Large / Open Plan (&gt; 35 m²)</option>
            </select>
          </div>

          <div>
            <label
              htmlFor="indoor-primary-room"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5"
            >
              Clean-Air Sanctuary Room
            </label>
            <select
              id="indoor-primary-room"
              value={indoor.primaryRoom}
              onChange={(e) =>
                onUpdateIndoor({
                  primaryRoom: e.target.value as IndoorEnvironmentInput['primaryRoom'],
                })
              }
              className="w-full h-10 px-3 text-sm bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
            >
              <option value="bedroom">Primary Bedroom</option>
              <option value="kids_room">Children’s Bedroom</option>
              <option value="living_room">Living / Family Room</option>
              <option value="home_office">Home Office / Study</option>
            </select>
          </div>
        </div>

        {/* Indoor Smoke Sources + Indoor Monitor Toggle */}
        <div className="pt-4 border-t border-slate-200 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          <fieldset className="lg:col-span-8">
            <legend className="text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
              Indoor Combustion / Smoke Sources
            </legend>
            <div className="flex flex-wrap gap-3">
              {SMOKE_SOURCE_OPTIONS.map((source) => {
                const checked = indoor.indoorSmokeSources.includes(source);
                return (
                  <label
                    key={source}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                      checked
                        ? 'bg-teal-50 border-teal-600 text-teal-900'
                        : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSmokeSource(source)}
                      className="accent-teal-700"
                    />
                    <span>{source}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="lg:col-span-4">
            <label className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer">
              <input
                type="checkbox"
                checked={indoor.indoorMonitorAvailable}
                onChange={(e) => onUpdateIndoor({ indoorMonitorAvailable: e.target.checked })}
                className="mt-0.5 accent-teal-700"
              />
              <span className="text-xs text-slate-700 leading-relaxed">
                <strong className="text-slate-900 block">I have an indoor PM2.5 sensor</strong>
                Uncheck if indoor air is unmeasured so guidance explicitly notes monitoring limitations.
              </span>
            </label>
          </div>
        </div>

        {aiNotice && (
          <div role="status" className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
            {aiNotice}
          </div>
        )}
      </section>

      {/* Critical Indoor-vs-Outdoor Warning & Unknown-Data Warnings */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-5 space-y-2">
          <div className="flex items-center gap-2 text-sm font-bold text-amber-950">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>Indoor Air Is Not Automatically Cleaner</span>
          </div>
          <p className="text-xs sm:text-sm text-amber-950 leading-relaxed">
            {guide.indoorVsOutdoorWarning}
          </p>
        </div>

        <div className="bg-[#0B1220] text-slate-100 border border-slate-800 rounded-xl p-5 space-y-2">
          <div className="flex items-center gap-2 text-sm font-bold text-cyan-300">
            <ShieldCheck className="w-4 h-4 shrink-0" />
            <span>Ventilation Timing for {airQuality.cityName}</span>
          </div>
          <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
            {guide.ventilationTimingGuidance}
          </p>
        </div>
      </section>

      {guide.unknownDataWarnings.length > 0 && (
        <section className="bg-slate-100 border border-slate-300 rounded-xl p-4 space-y-1.5 text-xs text-slate-700">
          <div className="font-semibold text-slate-900 flex items-center gap-1.5">
            <Info className="w-4 h-4 text-slate-600" />
            <span>Monitoring & Incomplete-Input Notes</span>
          </div>
          <ul className="list-disc pl-5 space-y-1">
            {guide.unknownDataWarnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </section>
      )}

      {/* 5 Actionable Evidence-Based Indoor Cards */}
      <section aria-label="Indoor air quality recommendations" className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {guide.actions.map((action, idx) => (
          <article
            key={`${action.category}-${idx}`}
            className="bg-white border border-slate-200 rounded-xl p-5 space-y-3"
          >
            <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-200">
              <h3 className="font-display font-bold text-base text-slate-900">
                {action.category}
              </h3>
              <span className="text-xs font-semibold text-teal-700">
                {action.benefitDimension}
              </span>
            </div>
            <p className="text-sm font-medium text-slate-900 leading-relaxed">
              {action.suggestedAction}
            </p>
            <p className="text-xs text-slate-600 leading-relaxed">
              <strong className="text-slate-800">Why:</strong> {action.whySuggested}
            </p>
            <p className="text-xs text-slate-700 leading-relaxed">
              <strong className="text-teal-800">Direct Benefit:</strong> {action.directBenefit}
            </p>
            <p className="text-[11px] text-slate-500 pt-2 border-t border-slate-100 leading-relaxed">
              <strong>Limitation:</strong> {action.assumptionsAndLimitations}
            </p>
          </article>
        ))}
      </section>

      {/* Explicit Scientific Evidence Box on Houseplants */}
      <section
        aria-label="Scientific evidence regarding houseplants"
        className="bg-white border border-slate-300 rounded-xl p-5 space-y-1.5"
      >
        <h3 className="font-display text-sm font-bold text-slate-900">
          Evidence Check: Why Houseplants Alone Cannot Clean Winter Smog
        </h3>
        <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
          {guide.houseplantEvidenceNote}
        </p>
      </section>
    </div>
  );
}
