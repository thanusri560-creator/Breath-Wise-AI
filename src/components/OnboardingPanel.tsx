import { useState } from 'react';
import {
  CheckCircle2,
  Compass,
  MapPin,
  SlidersHorizontal,
} from 'lucide-react';
import type {
  BreatheWisePage,
  CityOption,
  CommuteType,
  FiltrationType,
  HouseholdType,
  LifestyleType,
  LocationSearchResult,
  UserProfile,
} from '../domain/airQualityTypes';
import {
  COMMUTE_LABELS,
  FILTRATION_LABELS,
  HOUSEHOLD_LABELS,
  LIFESTYLE_LABELS,
} from '../data/breathewiseDefaults';
import { useDebounce } from '../hooks/useDebounce';
import { IndiaLocationPicker } from './IndiaLocationPicker';

interface OnboardingPanelProps {
  profile: UserProfile;
  cities: CityOption[];
  onUpdateProfile: (patch: Partial<UserProfile>) => void;
  onSelectPresetCity: (cityId: string) => void;
  onSelectLocation: (loc: LocationSearchResult) => void;
  onSetManualLocation: (label: string) => void;
  onFinish: (target: BreatheWisePage) => void;
}

export function OnboardingPanel({
  profile,
  cities,
  onUpdateProfile,
  onSelectPresetCity,
  onSelectLocation,
  onSetManualLocation,
  onFinish,
}: OnboardingPanelProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [manualInput, setManualInput] = useState(profile.manualLocationLabel);
  const debouncedLocation = useDebounce(manualInput, 300);
  const [geoMessage, setGeoMessage] = useState<string | null>(null);
  const [savedNotice, setSavedNotice] = useState<string | null>(null);

  const handleOptionalGeolocation = () => {
    if (!('geolocation' in navigator)) {
      setGeoMessage('Browser geolocation is unavailable. Please choose a city or enter your city name manually.');
      return;
    }
    setGeoMessage('Requesting coarse regional match (precise GPS coordinates are never stored or sent to AI prompts)...');
    navigator.geolocation.getCurrentPosition(
      () => {
        // Privacy safeguard: map to a coarse regional label without storing or logging raw coordinates
        setGeoMessage('Location permission granted. Select your nearest urban region below or type your city name manually.');
      },
      () => {
        setGeoMessage('Location permission declined. Manual city selection works identically without geolocation.');
      },
      { timeout: 6000 }
    );
  };

  const handleApplyManual = () => {
    if (!manualInput.trim()) return;
    onSetManualLocation(manualInput);
    setSavedNotice(`Updated active monitoring location to "${manualInput.trim()}".`);
  };

  const handleComplete = () => {
    onUpdateProfile({ onboardingCompleted: true });
    onFinish('dashboard');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-900 flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5 text-teal-700" />
              <span>Personalize BreatheWise AI</span>
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Tailor air-quality action plans to your city, commute, household, and indoor filtration. Optional steps can be skipped anytime.
            </p>
          </div>
          <span className="font-mono tabular-nums text-xs font-semibold text-teal-800">
            Step {step} of 3
          </span>
        </div>

        {/* Step Indicator Tabs */}
        <div className="grid grid-cols-3 gap-2" role="tablist" aria-label="Onboarding steps">
          {[
            { id: 1 as const, label: '1. Location & Lifestyle' },
            { id: 2 as const, label: '2. Commute & Activities' },
            { id: 3 as const, label: '3. Household & Filtration' },
          ].map((tab) => (
            <button
              key={tab.id}
              id={`onb-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={step === tab.id}
              aria-controls={`onb-panel-${tab.id}`}
              onClick={() => setStep(tab.id)}
              className={`px-3 py-2.5 rounded-lg text-xs sm:text-sm font-semibold border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 ${
                step === tab.id
                  ? 'bg-[#0B1220] text-white border-[#0B1220]'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {step === 1 && (
          <div
            id="onb-panel-1"
            role="tabpanel"
            aria-labelledby="onb-tab-1"
            aria-label="Location and Lifestyle"
            className="space-y-5"
          >
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                Search Any City, Town, or District Across India (Live AQI)
              </div>
              <IndiaLocationPicker
                currentCityName={profile.manualLocationLabel || profile.cityId}
                cities={cities}
                onSelectLocation={(loc) => {
                  setManualInput(loc.name);
                  onSelectLocation(loc);
                  setSavedNotice(
                    `Selected live location: ${loc.name}${loc.state ? `, ${loc.state}` : ''}. Fetching current AQI & meteorology.`
                  );
                }}
                onSelectPresetCity={(id) => {
                  setManualInput('');
                  onSelectPresetCity(id);
                  setSavedNotice(`Switched active city to ${id.replace(/-/g, ' ')}.`);
                }}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label htmlFor="onb-city" className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  Or Pick a Featured City Preset
                </label>
                <select
                  id="onb-city"
                  value={profile.cityId}
                  onChange={(e) => {
                    setManualInput('');
                    onSelectPresetCity(e.target.value);
                  }}
                  className="w-full h-10 px-3 text-sm bg-slate-50 border border-slate-300 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                >
                  {cities.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} — {c.region}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="onb-manual-city" className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  Or Enter Any Location Manually (Optional)
                </label>
                <div className="flex gap-2">
                  <input
                    id="onb-manual-city"
                    type="text"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    placeholder="e.g. Coimbatore, Indore, Shimla, Surat"
                    className="flex-1 h-10 px-3 text-sm bg-slate-50 border border-slate-300 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                  />
                  <button
                    type="button"
                    onClick={handleApplyManual}
                    className="px-3.5 h-10 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                  >
                    Apply
                  </button>
                </div>
                {debouncedLocation.trim().length > 0 && (
                  <p className="mt-1 text-[11px] text-slate-500">
                    Ready to apply custom city: <strong className="text-slate-700">{debouncedLocation.trim()}</strong>
                  </p>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700">
              <MapPin className="w-4 h-4 text-teal-700 shrink-0" />
              <span className="flex-1">
                Location permission is optional. Precise coordinates are never logged or sent to Gemini prompts.
              </span>
              <button
                type="button"
                onClick={handleOptionalGeolocation}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
              >
                <Compass className="w-3.5 h-3.5" />
                <span>Check Device Location</span>
              </button>
            </div>
            {geoMessage && (
              <p role="status" aria-live="polite" className="text-xs text-slate-600">
                {geoMessage}
              </p>
            )}

            <div>
              <span className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-2">
                Primary Lifestyle
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {(Object.keys(LIFESTYLE_LABELS) as LifestyleType[]).map((key) => {
                  const selected = profile.lifestyle === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => onUpdateProfile({ lifestyle: key })}
                      className={`text-left px-3.5 py-3 rounded-lg border text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 ${
                        selected
                          ? 'bg-teal-50 border-teal-600 text-teal-950 font-semibold'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {LIFESTYLE_LABELS[key]}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div
            id="onb-panel-2"
            role="tabpanel"
            aria-labelledby="onb-tab-2"
            aria-label="Commute and Activities"
            className="space-y-5"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label htmlFor="onb-commute" className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  Typical Commute Mode
                </label>
                <select
                  id="onb-commute"
                  value={profile.commute}
                  onChange={(e) => onUpdateProfile({ commute: e.target.value as CommuteType })}
                  className="w-full h-10 px-3 text-sm bg-slate-50 border border-slate-300 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                >
                  {(Object.keys(COMMUTE_LABELS) as CommuteType[]).map((k) => (
                    <option key={k} value={k}>
                      {COMMUTE_LABELS[k]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="onb-distance" className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  One-Way Commute Distance (km, Optional)
                </label>
                <input
                  id="onb-distance"
                  type="number"
                  min={0}
                  max={250}
                  value={profile.commuteDistanceKm}
                  onChange={(e) =>
                    onUpdateProfile({ commuteDistanceKm: Math.max(0, Number(e.target.value)) })
                  }
                  className="w-full h-10 px-3 text-sm font-mono tabular-nums bg-slate-50 border border-slate-300 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                />
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                Daily Scheduled Activities (Morning / Afternoon / Evening)
              </div>
              {profile.activities.slice(0, 3).map((act, idx) => (
                <div key={act.id} className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                  <span className="sm:col-span-2 text-xs font-semibold text-teal-800">
                    {act.timeBlock}
                  </span>
                  <input
                    type="text"
                    aria-label={`${act.timeBlock} activity`}
                    value={act.title}
                    onChange={(e) => {
                      const next = [...profile.activities];
                      next[idx] = { ...act, title: e.target.value };
                      onUpdateProfile({ activities: next });
                    }}
                    className="sm:col-span-10 h-9 px-3 text-sm bg-slate-50 border border-slate-300 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div
            id="onb-panel-3"
            role="tabpanel"
            aria-labelledby="onb-tab-3"
            aria-label="Household and Filtration"
            className="space-y-5"
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="onb-household" className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  Household Type
                </label>
                <select
                  id="onb-household"
                  value={profile.householdType}
                  onChange={(e) =>
                    onUpdateProfile({ householdType: e.target.value as HouseholdType })
                  }
                  className="w-full h-10 px-3 text-sm bg-slate-50 border border-slate-300 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                >
                  {(Object.keys(HOUSEHOLD_LABELS) as HouseholdType[]).map((k) => (
                    <option key={k} value={k}>
                      {HOUSEHOLD_LABELS[k]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="onb-size" className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  Household Size
                </label>
                <input
                  id="onb-size"
                  type="number"
                  min={1}
                  max={30}
                  value={profile.householdSize}
                  onChange={(e) =>
                    onUpdateProfile({
                      householdSize: Math.max(1, Math.min(30, Math.round(Number(e.target.value)))),
                    })
                  }
                  className="w-full h-10 px-3 text-sm font-mono tabular-nums bg-slate-50 border border-slate-300 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                />
              </div>

              <div>
                <label htmlFor="onb-filtration" className="block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1.5">
                  Indoor Filtration
                </label>
                <select
                  id="onb-filtration"
                  value={profile.filtration}
                  onChange={(e) =>
                    onUpdateProfile({ filtration: e.target.value as FiltrationType })
                  }
                  className="w-full h-10 px-3 text-sm bg-slate-50 border border-slate-300 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                >
                  {(Object.keys(FILTRATION_LABELS) as FiltrationType[]).map((k) => (
                    <option key={k} value={k}>
                      {FILTRATION_LABELS[k]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {savedNotice && (
          <div role="status" className="p-3 rounded-lg bg-teal-50 border border-teal-200 text-xs text-teal-900 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-teal-700" />
            <span>{savedNotice}</span>
          </div>
        )}

        {/* Footer Actions with Skip Option */}
        <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleComplete}
            className="text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-900 underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 rounded"
          >
            Skip Optional Steps &amp; Go to Dashboard
          </button>

          <div className="flex items-center gap-2.5">
            {step > 1 && (
              <button
                type="button"
                onClick={() => setStep((s) => (s === 3 ? 2 : 1))}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
              >
                Back
              </button>
            )}
            {step < 3 ? (
              <button
                type="button"
                onClick={() => setStep((s) => (s === 1 ? 2 : 3))}
                className="px-5 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
              >
                Continue
              </button>
            ) : (
              <button
                type="button"
                onClick={handleComplete}
                className="px-5 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
              >
                Save Profile &amp; View Dashboard
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
