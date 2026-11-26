import { Sliders } from 'lucide-react';
import type {
  CommuteType,
  FiltrationType,
  ImpactScenarioInput,
} from '../domain/airQualityTypes';
import {
  COMMUTE_LABELS,
  FILTRATION_LABELS,
} from '../data/breathewiseDefaults';

interface SimulationControlsFormProps {
  currentAqi: number | null;
  aqiOverride: string;
  householdSize: number;
  commuteMode: CommuteType;
  filtration: FiltrationType;
  keepOutdoorHighExertion: boolean;
  scenario: ImpactScenarioInput;
  onChangeAqiOverride: (value: string) => void;
  onChangeHouseholdSize: (value: number) => void;
  onChangeCommuteMode: (value: CommuteType) => void;
  onChangeFiltration: (value: FiltrationType) => void;
  onChangeKeepOutdoorHighExertion: (value: boolean) => void;
  onUpdateScenario: (updater: (prev: ImpactScenarioInput) => ImpactScenarioInput) => void;
}

/**
 * Modular left-column controls panel for the Mid-Flight What-If Simulator.
 * Separates interactive form inputs from the live comparison chart, conflict engine,
 * and confirmation modal inside ImpactExplorer.
 */
export function SimulationControlsForm({
  currentAqi,
  aqiOverride,
  householdSize,
  commuteMode,
  filtration,
  keepOutdoorHighExertion,
  scenario,
  onChangeAqiOverride,
  onChangeHouseholdSize,
  onChangeCommuteMode,
  onChangeFiltration,
  onChangeKeepOutdoorHighExertion,
  onUpdateScenario,
}: SimulationControlsFormProps) {
  return (
    <section
      aria-labelledby="sim-controls-heading"
      className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-5"
    >
      <div className="flex items-center gap-2 pb-3 border-b border-slate-200">
        <Sliders aria-hidden="true" className="w-4 h-4 text-teal-700" />
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
              placeholder={currentAqi !== null ? `Current: ${currentAqi}` : 'e.g. 260'}
              value={aqiOverride}
              onChange={(e) => onChangeAqiOverride(e.target.value)}
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
              onChange={(e) => onChangeHouseholdSize(Number(e.target.value))}
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
            onChange={(e) => onChangeCommuteMode(e.target.value as CommuteType)}
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
            onChange={(e) => onChangeFiltration(e.target.value as FiltrationType)}
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
                  onUpdateScenario((s) => ({
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
                  onUpdateScenario((s) => ({
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
                  onUpdateScenario((s) => ({
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
                  onUpdateScenario((s) => ({
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
                  onUpdateScenario((s) => ({
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
            Personal Exposure &amp; Activity Preferences
          </div>

          <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={scenario.shiftOutdoorExerciseOffPeak}
              onChange={(e) =>
                onUpdateScenario((s) => ({ ...s, shiftOutdoorExerciseOffPeak: e.target.checked }))
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
                onUpdateScenario((s) => ({ ...s, improveIndoorFiltration: e.target.checked }))
              }
              className="mt-0.5 accent-teal-700"
            />
            <span>Run mechanical HEPA / MERV-13 filtration &amp; kitchen exhaust</span>
          </label>

          <label className="flex items-start gap-2.5 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={keepOutdoorHighExertion}
              onChange={(e) => onChangeKeepOutdoorHighExertion(e.target.checked)}
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
  );
}
