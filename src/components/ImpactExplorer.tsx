import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  Sliders,
  Sparkles,
  Table,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  AirQualityReading,
  CommuteType,
  FiltrationType,
  ImpactScenarioInput,
  IndoorEnvironmentInput,
  UserProfile,
  WhatIfSimulationInput,
} from '../domain/airQualityTypes';
import {
  COMMUTE_LABELS,
  DEFAULT_IMPACT_SCENARIO,
  FILTRATION_LABELS,
  IMPACT_SCENARIO_PRESETS,
} from '../data/breathewiseDefaults';
import { RecommendationEngine } from '../services/RecommendationEngine';
import { AccessibleModal } from './AccessibleModal';
import { StatusIndicator } from './StatusIndicator';

interface ImpactExplorerProps {
  airQuality: AirQualityReading;
  profile: UserProfile;
  indoor: IndoorEnvironmentInput;
  onAcceptChanges: (patch: Partial<UserProfile>, indoorPatch?: Partial<IndoorEnvironmentInput>) => void;
}

export function ImpactExplorer({
  airQuality,
  profile,
  indoor,
  onAcceptChanges,
}: ImpactExplorerProps) {
  const [aqiOverride, setAqiOverride] = useState<string>('');
  const [commuteMode, setCommuteMode] = useState<CommuteType>(profile.commute);
  const [householdSize, setHouseholdSize] = useState<number>(profile.householdSize);
  const [filtration, setFiltration] = useState<FiltrationType>(profile.filtration);
  const [keepOutdoorHighExertion, setKeepOutdoorHighExertion] = useState<boolean>(false);
  const [scenario, setScenario] = useState<ImpactScenarioInput>({
    ...DEFAULT_IMPACT_SCENARIO,
    avgTripDistanceKm: profile.commuteDistanceKm || 14,
  });

  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [acceptedBanner, setAcceptedBanner] = useState<string | null>(null);
  const [showTable, setShowTable] = useState(true);

  const simInput: WhatIfSimulationInput = useMemo(() => {
    const parsedAqi = aqiOverride.trim() === '' ? null : Number(aqiOverride);
    return {
      aqiOverride: parsedAqi,
      pm25Override: null,
      commuteMode,
      householdSize,
      filtration,
      keepOutdoorHighExertion,
      impactScenario: scenario,
    };
  }, [aqiOverride, commuteMode, householdSize, filtration, keepOutdoorHighExertion, scenario]);

  // Real-time memoized Mid-Flight What-If Simulation
  const simResult = useMemo(
    () =>
      RecommendationEngine.runMidFlightWhatIfSimulation(
        airQuality,
        profile,
        indoor,
        simInput
      ),
    [airQuality, profile, indoor, simInput]
  );

  const handleReset = () => {
    setAqiOverride('');
    setCommuteMode(profile.commute);
    setHouseholdSize(profile.householdSize);
    setFiltration(profile.filtration);
    setKeepOutdoorHighExertion(false);
    setScenario({
      ...DEFAULT_IMPACT_SCENARIO,
      avgTripDistanceKm: profile.commuteDistanceKm || 14,
    });
    setAcceptedBanner(null);
  };

  const handleConfirmAccept = () => {
    if (!simResult.isFeasible) return;
    onAcceptChanges(
      {
        commute: commuteMode,
        householdSize: Math.max(1, Math.round(householdSize)),
        filtration,
        commuteDistanceKm: Math.max(0, scenario.avgTripDistanceKm),
      },
      {
        purifierAvailability: filtration,
      }
    );
    setReviewModalOpen(false);
    setAcceptedBanner(
      `Applied approved changes to your active profile (${COMMUTE_LABELS[commuteMode]}, ${FILTRATION_LABELS[filtration]}, household size ${Math.max(1, Math.round(householdSize))}). All views are synchronized.`
    );
  };

  const verdictTone =
    simResult.feasibilityStatus === 'feasible'
      ? 'feasible'
      : simResult.feasibilityStatus === 'feasible_with_adjustments'
        ? 'warning'
        : 'critical';

  const verdictLabel =
    simResult.feasibilityStatus === 'feasible'
      ? 'Feasible Scenario'
      : simResult.feasibilityStatus === 'feasible_with_adjustments'
        ? 'Feasible with Adjustments'
        : 'Infeasible / Conflicting';

  return (
    <div className="space-y-6">
      {/* Header + Presets */}
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5 max-w-3xl">
            <h2 className="font-display text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-teal-700" />
              <span>Impact Explorer & Mid-Flight What-If Simulator</span>
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
              Test air-quality spikes, commute swaps, filtration upgrades, and schedule preferences side by side before applying changes to your active plan.
            </p>
          </div>

          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset Simulation</span>
          </button>
        </div>

        {/* Scenario Presets */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t border-slate-200">
          {IMPACT_SCENARIO_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => {
                setScenario(preset.scenario);
                setAcceptedBanner(null);
              }}
              className="text-left p-3.5 rounded-lg border border-slate-200 bg-slate-50 hover:border-teal-500 hover:bg-teal-50/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
            >
              <div className="text-xs font-bold text-slate-900">{preset.label}</div>
              <p className="mt-1 text-[11px] text-slate-600 leading-relaxed">
                {preset.description}
              </p>
            </button>
          ))}
        </div>

        {acceptedBanner && (
          <div
            role="status"
            className="p-3.5 rounded-lg bg-teal-50 border border-teal-300 text-xs sm:text-sm text-teal-950 flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 text-teal-700 shrink-0" />
            <span>{acceptedBanner}</span>
          </div>
        )}
      </section>

      {/* Main Split Workspace: Controls (Left) + Live Comparison & Conflicts (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Simulation Inputs */}
        <section
          aria-labelledby="sim-controls-heading"
          className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-5"
        >
          <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
            <Sliders className="w-4 h-4 text-teal-700" />
            <h3 id="sim-controls-heading" className="font-display text-base font-bold text-slate-900">
              What-If Scenario Parameters
            </h3>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="sim-aqi-override"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Simulate AQI (0–500)
                </label>
                <input
                  id="sim-aqi-override"
                  type="number"
                  min={0}
                  max={500}
                  placeholder={airQuality.aqi !== null ? `Current: ${airQuality.aqi}` : 'e.g. 260'}
                  value={aqiOverride}
                  onChange={(e) => setAqiOverride(e.target.value)}
                  className="w-full h-9 px-3 text-sm font-mono tabular-nums bg-slate-50 border border-slate-300 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                />
              </div>

              <div>
                <label
                  htmlFor="sim-household-size"
                  className="block text-xs font-semibold text-slate-700 mb-1"
                >
                  Household Size
                </label>
                <input
                  id="sim-household-size"
                  type="number"
                  min={1}
                  max={20}
                  value={householdSize}
                  onChange={(e) => setHouseholdSize(Number(e.target.value))}
                  className="w-full h-9 px-3 text-sm font-mono tabular-nums bg-slate-50 border border-slate-300 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                />
              </div>
            </div>

            <div>
              <label htmlFor="sim-commute-mode" className="block text-xs font-semibold text-slate-700 mb-1">
                Primary Commute Mode
              </label>
              <select
                id="sim-commute-mode"
                value={commuteMode}
                onChange={(e) => setCommuteMode(e.target.value as CommuteType)}
                className="w-full h-9 px-3 text-sm bg-slate-50 border border-slate-300 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
              >
                {(Object.keys(COMMUTE_LABELS) as CommuteType[]).map((k) => (
                  <option key={k} value={k}>
                    {COMMUTE_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="sim-filtration" className="block text-xs font-semibold text-slate-700 mb-1">
                Indoor Filtration Setup
              </label>
              <select
                id="sim-filtration"
                value={filtration}
                onChange={(e) => setFiltration(e.target.value as FiltrationType)}
                className="w-full h-9 px-3 text-sm bg-slate-50 border border-slate-300 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
              >
                {(Object.keys(FILTRATION_LABELS) as FiltrationType[]).map((k) => (
                  <option key={k} value={k}>
                    {FILTRATION_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>

            <div className="pt-3 border-t border-slate-200 space-y-3">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Weekly Travel Swaps (Emissions Model)
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="sim-baseline-trips" className="block text-xs text-slate-700 mb-1">
                    Baseline Car Trips / Wk
                  </label>
                  <input
                    id="sim-baseline-trips"
                    type="number"
                    min={0}
                    max={40}
                    value={scenario.baselineCarTripsPerWeek}
                    onChange={(e) =>
                      setScenario((s) => ({
                        ...s,
                        baselineCarTripsPerWeek: Number(e.target.value),
                      }))
                    }
                    className="w-full h-9 px-3 text-sm font-mono tabular-nums bg-slate-50 border border-slate-300 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                  />
                </div>
                <div>
                  <label htmlFor="sim-trip-km" className="block text-xs text-slate-700 mb-1">
                    Avg Trip Distance (km)
                  </label>
                  <input
                    id="sim-trip-km"
                    type="number"
                    min={0}
                    max={200}
                    value={scenario.avgTripDistanceKm}
                    onChange={(e) =>
                      setScenario((s) => ({
                        ...s,
                        avgTripDistanceKm: Number(e.target.value),
                      }))
                    }
                    className="w-full h-9 px-3 text-sm font-mono tabular-nums bg-slate-50 border border-slate-300 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label htmlFor="sim-transit-swaps" className="block text-[11px] text-slate-700 mb-1">
                    To Transit
                  </label>
                  <input
                    id="sim-transit-swaps"
                    type="number"
                    min={0}
                    max={30}
                    value={scenario.carTripsReplacedWithTransit}
                    onChange={(e) =>
                      setScenario((s) => ({
                        ...s,
                        carTripsReplacedWithTransit: Number(e.target.value),
                      }))
                    }
                    className="w-full h-9 px-2.5 text-sm font-mono tabular-nums bg-slate-50 border border-slate-300 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                  />
                </div>
                <div>
                  <label htmlFor="sim-carpool-swaps" className="block text-[11px] text-slate-700 mb-1">
                    To Carpool
                  </label>
                  <input
                    id="sim-carpool-swaps"
                    type="number"
                    min={0}
                    max={30}
                    value={scenario.carTripsReplacedWithCarpool}
                    onChange={(e) =>
                      setScenario((s) => ({
                        ...s,
                        carTripsReplacedWithCarpool: Number(e.target.value),
                      }))
                    }
                    className="w-full h-9 px-2.5 text-sm font-mono tabular-nums bg-slate-50 border border-slate-300 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                  />
                </div>
                <div>
                  <label htmlFor="sim-eliminated-trips" className="block text-[11px] text-slate-700 mb-1">
                    Eliminated
                  </label>
                  <input
                    id="sim-eliminated-trips"
                    type="number"
                    min={0}
                    max={30}
                    value={scenario.unnecessaryCarTripsEliminated}
                    onChange={(e) =>
                      setScenario((s) => ({
                        ...s,
                        unnecessaryCarTripsEliminated: Number(e.target.value),
                      }))
                    }
                    className="w-full h-9 px-2.5 text-sm font-mono tabular-nums bg-slate-50 border border-slate-300 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
                  />
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 space-y-2.5">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Personal Exposure & Activity Preferences
              </div>

              <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={scenario.shiftOutdoorExerciseOffPeak}
                  onChange={(e) =>
                    setScenario((s) => ({ ...s, shiftOutdoorExerciseOffPeak: e.target.checked }))
                  }
                  className="mt-0.5 accent-teal-700"
                />
                <span>Shift outdoor workouts off-peak or indoors during severe smog</span>
              </label>

              <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={scenario.improveIndoorFiltration}
                  onChange={(e) =>
                    setScenario((s) => ({ ...s, improveIndoorFiltration: e.target.checked }))
                  }
                  className="mt-0.5 accent-teal-700"
                />
                <span>Run mechanical HEPA / MERV-13 filtration & kitchen exhaust</span>
              </label>

              <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={keepOutdoorHighExertion}
                  onChange={(e) => setKeepOutdoorHighExertion(e.target.checked)}
                  className="mt-0.5 accent-rose-600"
                />
                <span>
                  Force vigorous outdoor exercise regardless of smog{' '}
                  <span className="text-slate-500">(tests conflict detection)</span>
                </span>
              </label>
            </div>
          </div>
        </section>

        {/* Right: Feasibility Verdict, Conflicts, Chart & Review Action */}
        <section className="lg:col-span-7 space-y-5">
          {/* Feasibility Verdict Banner */}
          <div className="bg-[#0B1220] text-white border border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
                  Simulation Feasibility Verdict
                </div>
                <div className="mt-1">
                  <StatusIndicator tone={verdictTone} label={verdictLabel} inverted />
                </div>
              </div>

              <button
                type="button"
                disabled={!simResult.isFeasible}
                onClick={() => setReviewModalOpen(true)}
                className="px-4 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 disabled:bg-slate-700 disabled:text-slate-400 text-white text-xs sm:text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300"
              >
                Review &amp; Accept Changes
              </button>
            </div>

            <p className="text-sm text-slate-200 leading-relaxed">
              {simResult.feasibilitySummary}
            </p>

            {/* KPI Comparison Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-slate-800">
              <div>
                <div className="text-xs text-slate-400">Weekly CO₂e Saved</div>
                <div className="mt-0.5 font-mono tabular-nums text-2xl font-bold text-teal-300">
                  {simResult.impactResult.weeklyCo2SavedKg !== null
                    ? `${simResult.impactResult.weeklyCo2SavedKg.toFixed(1)} kg`
                    : 'N/A'}
                </div>
                {simResult.impactResult.co2RangeLowKg !== null &&
                  simResult.impactResult.co2RangeHighKg !== null && (
                    <div className="text-[11px] font-mono tabular-nums text-slate-400">
                      Band: {simResult.impactResult.co2RangeLowKg.toFixed(1)}–
                      {simResult.impactResult.co2RangeHighKg.toFixed(1)} kg
                    </div>
                  )}
              </div>

              <div>
                <div className="text-xs text-slate-400">Monthly CO₂e Saved</div>
                <div className="mt-0.5 font-mono tabular-nums text-2xl font-bold text-cyan-300">
                  {simResult.impactResult.monthlyCo2SavedKg !== null
                    ? `${simResult.impactResult.monthlyCo2SavedKg.toFixed(1)} kg`
                    : 'N/A'}
                </div>
                <div className="text-[11px] text-slate-400">Scaled × 4.33 weeks</div>
              </div>

              <div>
                <div className="text-xs text-slate-400">Personal Exposure Tier</div>
                <div className="mt-1 text-sm font-semibold text-white leading-snug">
                  {simResult.impactResult.personalExposureTier}
                </div>
                <div className="text-[11px] text-slate-400">Qualitative (separate from CO₂)</div>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 pt-2 border-t border-slate-800">
              {simResult.simulatedDisclaimer}
            </p>
          </div>

          {/* Detected Conflicts & Trade-offs */}
          {simResult.conflicts.length > 0 && (
            <div
              role="region"
              aria-live="polite"
              aria-label="Detected scenario conflicts"
              className="bg-amber-50 border border-amber-300 rounded-xl p-5 space-y-3"
            >
              <div className="flex items-center gap-2 text-sm font-bold text-amber-950">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                <span>Detected Preference vs. Air-Quality Conflicts ({simResult.conflicts.length})</span>
              </div>
              <ul className="space-y-3">
                {simResult.conflicts.map((c) => (
                  <li
                    key={c.id}
                    className="p-3.5 rounded-lg bg-white border border-amber-200 space-y-1 text-xs"
                  >
                    <div className="font-bold text-slate-900">
                      {c.severity === 'critical' ? '✖ Critical: ' : '▲ Trade-Off: '}
                      {c.title}
                    </div>
                    <p className="text-slate-700 leading-relaxed">{c.detail}</p>
                    <p className="text-teal-800 font-medium">
                      Suggested Alternative: {c.alternativeAction}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Chart + Accessible Side-by-Side Comparison Table */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-display text-base font-bold text-slate-900">
                  Original Routine vs. Simulated Scenario
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  {simResult.impactResult.emissionsVsExposureWarning}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTable((v) => !v)}
                aria-expanded={showTable}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
              >
                <Table className="w-3.5 h-3.5" />
                <span>{showTable ? 'Hide Table' : 'Show Table'}</span>
              </button>
            </div>

            {simResult.impactResult.baselineWeeklyCo2Kg !== null &&
              simResult.impactResult.scenarioWeeklyCo2Kg !== null && (
                <p className="text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5 leading-relaxed">
                  <strong className="text-slate-900">Chart Summary:</strong> Original travel routine emits an estimated{' '}
                  <span className="font-mono tabular-nums font-semibold">
                    {simResult.impactResult.baselineWeeklyCo2Kg.toFixed(1)} kg CO₂e/week
                  </span>{' '}
                  compared with{' '}
                  <span className="font-mono tabular-nums font-semibold">
                    {simResult.impactResult.scenarioWeeklyCo2Kg.toFixed(1)} kg CO₂e/week
                  </span>{' '}
                  under the simulated scenario ({simResult.impactResult.personalExposureTier}).
                </p>
              )}

            {simResult.impactResult.chartData.length > 0 && (
              <div
                className="h-56 w-full"
                role="img"
                aria-label="Bar chart comparing original weekly and monthly travel CO2e against simulated scenario"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={simResult.impactResult.chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#475569' }} />
                    <YAxis tick={{ fontSize: 12, fill: '#475569' }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="originalCo2" name="Original Routine (kg CO₂e)" fill="#64748B" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="simulatedCo2" name="Simulated Scenario (kg CO₂e)" fill="#0D9488" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {showTable && simResult.impactResult.comparisonRows.length > 0 && (
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-xs">
                  <caption className="sr-only">
                    Comparison of original routine and simulated scenario metrics
                  </caption>
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <tr>
                      <th scope="col" className="px-3.5 py-2.5 font-semibold">Metric</th>
                      <th scope="col" className="px-3.5 py-2.5 font-semibold">Original</th>
                      <th scope="col" className="px-3.5 py-2.5 font-semibold">Simulated</th>
                      <th scope="col" className="px-3.5 py-2.5 font-semibold">Difference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {simResult.impactResult.comparisonRows.map((row) => (
                      <tr key={row.metric}>
                        <td className="px-3.5 py-2.5 font-semibold text-slate-900">{row.metric}</td>
                        <td className="px-3.5 py-2.5 font-mono tabular-nums text-slate-700">{row.originalRoutine}</td>
                        <td className="px-3.5 py-2.5 font-mono tabular-nums text-slate-900">{row.simulatedScenario}</td>
                        <td className="px-3.5 py-2.5 font-mono tabular-nums text-teal-700 font-semibold">{row.difference}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Transparent Assumptions & Uncertainty */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-200 text-xs text-slate-600">
              <div>
                <h4 className="font-semibold text-slate-900 mb-1.5">Model Assumptions</h4>
                <ul className="list-disc pl-4 space-y-1">
                  {simResult.impactResult.assumptions.map((a, idx) => (
                    <li key={idx}>{a}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h4 className="font-semibold text-slate-900 mb-1.5">Uncertainties & Limitations</h4>
                <ul className="list-disc pl-4 space-y-1">
                  {simResult.impactResult.uncertainties.map((u, idx) => (
                    <li key={idx}>{u}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* WCAG 2.2 AA Review & Accept Proposed Changes Modal */}
      <AccessibleModal
        open={reviewModalOpen}
        title="Review & Accept Proposed Profile Changes"
        description="Confirming these simulated parameters will update your active BreatheWise profile and immediately refresh your Daily Action Plan, Indoor Guide, and Low-Emission Alternatives."
        onClose={() => setReviewModalOpen(false)}
      >
        <div className="space-y-4 text-sm">
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Commute Mode</span>
              <span className="font-semibold text-slate-900">
                {COMMUTE_LABELS[profile.commute]} → {COMMUTE_LABELS[commuteMode]}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Indoor Filtration</span>
              <span className="font-semibold text-slate-900">
                {FILTRATION_LABELS[profile.filtration]} → {FILTRATION_LABELS[filtration]}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Household Size</span>
              <span className="font-mono font-semibold text-slate-900">
                {profile.householdSize} → {Math.max(1, Math.round(householdSize))}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Estimated Weekly CO₂e Delta</span>
              <span className="font-mono font-semibold text-teal-700">
                {simResult.impactResult.weeklyCo2SavedKg !== null
                  ? `-${simResult.impactResult.weeklyCo2SavedKg.toFixed(1)} kg / wk`
                  : 'N/A'}
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Note: Any temporary AQI override used for stress-testing stays simulated only and will not overwrite live or city station readings.
          </p>

          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setReviewModalOpen(false)}
              className="px-4 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmAccept}
              className="px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
            >
              Accept &amp; Synchronize Plan
            </button>
          </div>
        </div>
      </AccessibleModal>
    </div>
  );
}
