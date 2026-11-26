import type {
  AirQualityReading,
  DailyActionPlanResult,
  IndoorEnvironmentInput,
  ScenarioConflict,
  UserProfile,
  WhatIfSimulationInput,
  WhatIfSimulationResult,
} from '../domain/airQualityTypes';
import {
  calculateUsEpaAqiFromPm25,
  interpretUsEpaAqiCategory,
} from './AirQualityDataService.ts';
import { ImpactCalculationService } from './ImpactCalculationService.ts';

/**
 * Mid-Flight What-If Simulation Service.
 *
 * Isolates scenario validation, environmental override modeling, preference-vs-smog
 * conflict detection, and feasibility verdicts from routine generation so each
 * algorithmic stage is independently testable and easy to extend.
 */
export function executeMidFlightWhatIfSimulation(
  originalAir: AirQualityReading,
  originalProfile: UserProfile,
  _indoor: IndoorEnvironmentInput,
  simInput: WhatIfSimulationInput,
  generateDailyPlan: (air: AirQualityReading, profile: UserProfile) => DailyActionPlanResult
): WhatIfSimulationResult {
  const conflicts: ScenarioConflict[] = [];

  // 1. Validate simulated AQI / PM2.5 overrides before constructing modeled telemetry
  const simPm25 =
    simInput.pm25Override !== null ? simInput.pm25Override : originalAir.pm25;
  const derivedAqi =
    simInput.aqiOverride !== null
      ? simInput.aqiOverride
      : simInput.pm25Override !== null
        ? calculateUsEpaAqiFromPm25(simInput.pm25Override)
        : originalAir.aqi;

  const aqiInvalid =
    derivedAqi !== null && (!Number.isFinite(derivedAqi) || derivedAqi < 0 || derivedAqi > 500);
  const pm25Invalid =
    simPm25 !== null && (!Number.isFinite(simPm25) || simPm25 < 0 || simPm25 > 1000);

  if (aqiInvalid || pm25Invalid) {
    conflicts.push({
      id: 'conflict-invalid-pollutant',
      severity: 'critical',
      title: 'Invalid Simulated Pollutant Parameters',
      detail: 'Simulated AQI must be within 0–500 and PM2.5 must be non-negative (0–1000 µg/m³).',
      alternativeAction: 'Enter realistic US EPA AQI (0–500) and non-negative PM2.5 values.',
    });
  }

  const safeAqi = aqiInvalid ? originalAir.aqi : derivedAqi;
  const safePm25 = pm25Invalid ? originalAir.pm25 : simPm25;

  const simulatedAir: AirQualityReading = {
    ...originalAir,
    aqi: safeAqi,
    pm25: safePm25,
    category: interpretUsEpaAqiCategory(safeAqi),
    isDemo: true,
    dataSource: 'SIMULATED WHAT-IF SCENARIO (Not Real-World Measured Telemetry)',
  };

  const safeHouseholdSize = Math.max(1, Math.round(simInput.householdSize));
  const simulatedProfile: UserProfile = {
    ...originalProfile,
    commute: simInput.commuteMode,
    householdSize: safeHouseholdSize,
    filtration: simInput.filtration,
  };

  const originalPlan = generateDailyPlan(originalAir, originalProfile);
  const simulatedPlan = generateDailyPlan(simulatedAir, simulatedProfile);
  const impactResult = ImpactCalculationService.calculate(simInput.impactScenario, simulatedAir);

  // 2. Detect hard & soft conflicts between user preferences and modeled air quality
  if (!impactResult.valid) {
    conflicts.push({
      id: 'conflict-invalid-impact',
      severity: 'critical',
      title: 'Unsupported / Invalid Impact Scenario Inputs',
      detail: impactResult.infeasibleReason ?? 'Scenario travel inputs are invalid.',
      alternativeAction: 'Correct negative trip counts or zero-distance travel inputs before accepting.',
    });
  }

  if (simInput.keepOutdoorHighExertion && safeAqi !== null && safeAqi >= 200) {
    conflicts.push({
      id: 'conflict-outdoor-exercise-smog',
      severity: 'critical',
      title: 'Conflict: Vigorous Outdoor Activity Requested Under Very Unhealthy / Hazardous Smog',
      detail: `Keeping high-exertion outdoor exercise while simulated AQI is ${safeAqi} (${simulatedAir.category}) creates a direct conflict with safe exposure guidelines.`,
      alternativeAction:
        'Swap outdoor cardio to indoor filtered strength/mobility training or enable "Shift Outdoor Exercise Off-Peak".',
    });
  }

  if (simInput.commuteMode === 'walk_or_cycle' && safeAqi !== null && safeAqi > 150) {
    conflicts.push({
      id: 'conflict-active-commute-smog',
      severity: 'warning',
      title: 'Conflict: Walking/Cycling Commute Under Unhealthy+ Air',
      detail: `Active commuting produces zero exhaust, but at AQI ${safeAqi} it increases personal particulate inhalation along roadways.`,
      alternativeAction:
        'Switch commute mode to enclosed public transit, carpool, or remote participation on smog days.',
    });
  }

  if (simInput.filtration === 'none' && safeAqi !== null && safeAqi > 200 && safeHouseholdSize >= 3) {
    conflicts.push({
      id: 'conflict-no-filtration-family',
      severity: 'warning',
      title: 'Exposure Gap: Multi-Person Household Without Mechanical Filtration in Severe Smog',
      detail: `A ${safeHouseholdSize}-person household facing AQI ${safeAqi} without HEPA or MERV-13 filtration has limited ability to clear infiltrating PM2.5.`,
      alternativeAction:
        'Designate one sealed bedroom, eliminate all indoor smoke/frying, or add a true HEPA / DIY MERV-13 box-fan purifier.',
    });
  }

  const hasCritical = conflicts.some((c) => c.severity === 'critical');
  const isFeasible = !hasCritical && impactResult.valid;
  const feasibilityStatus: WhatIfSimulationResult['feasibilityStatus'] = !isFeasible
    ? 'infeasible'
    : conflicts.length > 0
      ? 'feasible_with_adjustments'
      : 'feasible';

  const feasibilitySummary = !isFeasible
    ? `INFEASIBLE / CONFLICTING SCENARIO: ${conflicts.filter((c) => c.severity === 'critical').length} hard conflict(s) detected. Review alternatives below before accepting.`
    : feasibilityStatus === 'feasible_with_adjustments'
      ? `FEASIBLE WITH ADJUSTMENTS: ${conflicts.length} preference-vs-environment trade-off(s) flagged with recommended alternatives.`
      : 'FEASIBLE SCENARIO: Simulated routine, indoor setup, and travel swaps align safely with the modeled air-quality conditions.';

  return {
    originalAir,
    simulatedAir,
    originalProfile,
    simulatedProfile,
    originalPlan,
    simulatedPlan,
    impactResult,
    conflicts,
    isFeasible,
    feasibilityStatus,
    feasibilitySummary,
    simulatedDisclaimer:
      'Simulation Notice: Results represent modeled what-if assumptions and transparent emission-factor ranges—not real-world measured pollution or clinical health outcomes.',
  };
}
