import type {
  AirQualityReading,
  EmissionFactorSet,
  ImpactCalculationResult,
  ImpactScenarioInput,
} from '../domain/airQualityTypes';

/**
 * Default published urban passenger transport emission factor set (DEFRA / EPA ranges):
 * - Average urban gasoline passenger car: 0.192 kg CO2e/km (range: 0.155 – 0.240)
 * - Urban public transit (metro/bus weighted mix): 0.065 kg CO2e/passenger-km (range: 0.035 – 0.095)
 * - Carpool assumes 2.5 average occupants sharing one passenger car.
 *
 * SCIENTIFIC INTEGRITY RULE:
 * We never fabricate exact personal PM2.5 µg/m³ reductions or guaranteed medical/health
 * outcomes, and we never claim one household's trips measurably lower city-wide ambient AQI.
 */
export const DEFAULT_EMISSION_FACTORS: EmissionFactorSet = {
  carKgCo2PerKm: 0.192,
  carLowKgPerKm: 0.155,
  carHighKgPerKm: 0.24,
  transitKgCo2PerPkm: 0.065,
  transitLowKgPerPkm: 0.035,
  transitHighKgPerPkm: 0.095,
  carpoolOccupancy: 2.5,
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export const ImpactCalculationService = {
  calculate(
    input: ImpactScenarioInput,
    airQuality: AirQualityReading,
    factors: EmissionFactorSet = DEFAULT_EMISSION_FACTORS
  ): ImpactCalculationResult {
    // 1. Validate scenario inputs (reject negative values, impossible totals, or zero-distance travel)
    if (
      !Number.isFinite(input.baselineCarTripsPerWeek) ||
      input.baselineCarTripsPerWeek < 0 ||
      !Number.isFinite(input.avgTripDistanceKm) ||
      input.avgTripDistanceKm < 0 ||
      input.carTripsReplacedWithTransit < 0 ||
      input.carTripsReplacedWithCarpool < 0 ||
      input.unnecessaryCarTripsEliminated < 0
    ) {
      return buildInvalidResult(
        'Invalid scenario parameters: trip counts and average distance cannot be negative.'
      );
    }

    const totalSwappedTrips =
      input.carTripsReplacedWithTransit +
      input.carTripsReplacedWithCarpool +
      input.unnecessaryCarTripsEliminated;

    const travelChangesRequested = totalSwappedTrips > 0;

    if (travelChangesRequested && input.avgTripDistanceKm === 0) {
      return buildInvalidResult(
        'Zero-distance travel scenario: enter a positive trip distance (> 0 km) to estimate travel emission savings.'
      );
    }

    const effectiveBaselineTrips = Math.max(input.baselineCarTripsPerWeek, totalSwappedTrips);
    const baselineKm = effectiveBaselineTrips * input.avgTripDistanceKm;
    const transitKm = input.carTripsReplacedWithTransit * input.avgTripDistanceKm;
    const carpoolKm = input.carTripsReplacedWithCarpool * input.avgTripDistanceKm;
    const eliminatedKm = input.unnecessaryCarTripsEliminated * input.avgTripDistanceKm;
    const remainingSoloCarKm = Math.max(0, baselineKm - transitKm - carpoolKm - eliminatedKm);

    // 2. Check whether emission factors are available (never fabricate numbers when factors are missing!)
    const hasEmissionFactors =
      factors.carKgCo2PerKm !== null &&
      Number.isFinite(factors.carKgCo2PerKm) &&
      factors.carKgCo2PerKm > 0 &&
      factors.transitKgCo2PerPkm !== null &&
      Number.isFinite(factors.transitKgCo2PerPkm) &&
      factors.transitKgCo2PerPkm >= 0;

    let baselineWeeklyCo2Kg: number | null = null;
    let scenarioWeeklyCo2Kg: number | null = null;
    let weeklyCo2SavedKg: number | null = null;
    let monthlyCo2SavedKg: number | null = null;
    let co2RangeLowKg: number | null = null;
    let co2RangeHighKg: number | null = null;

    if (hasEmissionFactors && factors.carKgCo2PerKm !== null && factors.transitKgCo2PerPkm !== null) {
      const occ = Math.max(2, factors.carpoolOccupancy);
      const carpoolFactor = factors.carKgCo2PerKm / occ;

      baselineWeeklyCo2Kg = round1(baselineKm * factors.carKgCo2PerKm);
      scenarioWeeklyCo2Kg = round1(
        remainingSoloCarKm * factors.carKgCo2PerKm +
          transitKm * factors.transitKgCo2PerPkm +
          carpoolKm * carpoolFactor
      );
      weeklyCo2SavedKg = round1(Math.max(0, baselineWeeklyCo2Kg - scenarioWeeklyCo2Kg));
      monthlyCo2SavedKg = round1(weeklyCo2SavedKg * 4.33);

      const transitDeltaLow = Math.max(0.05, factors.carLowKgPerKm - factors.transitHighKgPerPkm);
      const transitDeltaHigh = Math.max(transitDeltaLow, factors.carHighKgPerKm - factors.transitLowKgPerPkm);
      const carpoolDeltaLow = factors.carLowKgPerKm * (1 - 1 / occ);
      const carpoolDeltaHigh = factors.carHighKgPerKm * (1 - 1 / occ);

      co2RangeLowKg = round1(
        transitKm * transitDeltaLow +
          carpoolKm * carpoolDeltaLow +
          eliminatedKm * factors.carLowKgPerKm
      );
      co2RangeHighKg = round1(
        transitKm * transitDeltaHigh +
          carpoolKm * carpoolDeltaHigh +
          eliminatedKm * factors.carHighKgPerKm
      );
    }

    // 3. Qualitative Personal Exposure comparison (strictly separate from CO2 emissions!)
    let exposureScore = 0;
    const exposureReasons: string[] = [];
    const aqi = airQuality.aqi ?? 150;

    if (input.shiftOutdoorExerciseOffPeak) {
      exposureScore += aqi > 150 ? 2 : 1;
      exposureReasons.push(
        `Moving elevated-breathing exercise out of peak inversion (${airQuality.peakWindow}) into ${airQuality.bestWindow} or filtered indoor space`
      );
    }
    if (input.improveIndoorFiltration) {
      exposureScore += aqi > 100 ? 2 : 1;
      exposureReasons.push(
        'Operating room-matched HEPA filtration, sealing windows during smog peaks, and exhausting cooking fumes'
      );
    }
    if (input.unnecessaryCarTripsEliminated >= 2) {
      exposureScore += 1;
      exposureReasons.push(
        `Avoiding ${input.unnecessaryCarTripsEliminated} weekly roadside traffic commutes where curbside exhaust spikes`
      );
    }

    const personalExposureTier: ImpactCalculationResult['personalExposureTier'] =
      exposureScore >= 3
        ? 'Substantial Personal Exposure Reduction'
        : exposureScore >= 1
          ? 'Moderate Personal Exposure Reduction'
          : 'No Exposure Change';

    const personalExposureExplanation =
      exposureReasons.length > 0
        ? `${exposureReasons.join('; ')}. Exact inhaled PM2.5 (µg/m³) reductions cannot be measured without wearable and indoor sensors.`
        : 'Current selections target transport emissions only. Switching car trips to transit lowers community exhaust but does not automatically protect your personal exposure during severe smog unless combined with timing or filtration.';

    const parts: string[] = [];
    if (input.carTripsReplacedWithTransit > 0) parts.push(`${input.carTripsReplacedWithTransit} trips -> transit`);
    if (input.carTripsReplacedWithCarpool > 0) parts.push(`${input.carTripsReplacedWithCarpool} trips -> carpool`);
    if (input.unnecessaryCarTripsEliminated > 0) parts.push(`${input.unnecessaryCarTripsEliminated} trips eliminated`);
    if (input.shiftOutdoorExerciseOffPeak) parts.push('off-peak exercise');
    if (input.improveIndoorFiltration) parts.push('HEPA + clean indoor air');
    const scenarioLabel = parts.length > 0 ? parts.join(' + ') : 'Baseline Routine (Unchanged)';

    const assumptions = hasEmissionFactors
      ? [
          `Baseline models ${effectiveBaselineTrips} solo passenger-car trips/week × ${input.avgTripDistanceKm} km = ${baselineKm} km/week.`,
          `Passenger car factor: ${factors.carKgCo2PerKm} kg CO₂e/km (uncertainty band ${factors.carLowKgPerKm}–${factors.carHighKgPerKm} kg/km).`,
          `Public transit factor: ${factors.transitKgCo2PerPkm} kg CO₂e/passenger-km (band ${factors.transitLowKgPerPkm}–${factors.transitHighKgPerPkm} kg/pkm); carpool assumes ${factors.carpoolOccupancy} occupants.`,
          'Monthly CO₂e estimate scales weekly savings by 4.33 weeks/month.',
          `Personal exposure tier reflects qualitative timing/filtration guidance for ${airQuality.cityName} (${airQuality.aqi !== null ? `AQI ${airQuality.aqi}` : 'AQI unavailable'}).`,
        ]
      : [
          'Transport emission factors are missing or incomplete; CO₂e savings are intentionally marked uncalculable rather than fabricated.',
          `Personal exposure tier still evaluates qualitative schedule & indoor habits for ${airQuality.cityName}.`,
        ];

    const uncertainties = [
      'Actual tailpipe emissions depend on vehicle fuel type (petrol, diesel, hybrid, EV), winter cold-start idling, and traffic congestion.',
      'Public transit per-rider emissions vary with electricity grid mix and peak vs. off-peak occupancy.',
      'Indoor PM2.5 depends on building air leakage, purifier CADR relative to room volume, filter condition, and indoor cooking habits.',
      'A single household’s travel shift cannot measurably change citywide ambient AQI on its own; community-scale adoption drives ambient improvements.',
    ];

    const comparisonRows = [
      {
        metric: 'Weekly Solo Car Travel',
        originalRoutine: `${baselineKm} km / wk`,
        simulatedScenario: `${remainingSoloCarKm} km / wk`,
        difference:
          baselineKm - remainingSoloCarKm > 0
            ? `-${baselineKm - remainingSoloCarKm} km / wk`
            : 'No change',
      },
      {
        metric: 'Estimated Travel Emissions (CO₂e)',
        originalRoutine: baselineWeeklyCo2Kg !== null ? `${baselineWeeklyCo2Kg.toFixed(1)} kg / wk` : 'Unavailable (missing factor)',
        simulatedScenario: scenarioWeeklyCo2Kg !== null ? `${scenarioWeeklyCo2Kg.toFixed(1)} kg / wk` : 'Unavailable (missing factor)',
        difference:
          weeklyCo2SavedKg !== null && co2RangeLowKg !== null && co2RangeHighKg !== null
            ? weeklyCo2SavedKg > 0
              ? `-${weeklyCo2SavedKg.toFixed(1)} kg/wk (${co2RangeLowKg.toFixed(1)}–${co2RangeHighKg.toFixed(1)} kg range)`
              : 'No change'
            : 'Uncalculable',
      },
      {
        metric: 'Personal Exposure Protection',
        originalRoutine: 'Baseline routine',
        simulatedScenario: personalExposureTier,
        difference: exposureReasons.length > 0 ? `${exposureReasons.length} protective habit(s)` : 'Unchanged',
      },
    ];

    const chartData =
      baselineWeeklyCo2Kg !== null && scenarioWeeklyCo2Kg !== null
        ? [
            {
              label: 'Weekly CO₂e (kg)',
              originalCo2: baselineWeeklyCo2Kg,
              simulatedCo2: scenarioWeeklyCo2Kg,
            },
            {
              label: 'Monthly CO₂e (kg)',
              originalCo2: round1(baselineWeeklyCo2Kg * 4.33),
              simulatedCo2: round1(scenarioWeeklyCo2Kg * 4.33),
            },
          ]
        : [];

    return {
      valid: true,
      infeasibleReason: null,
      scenarioLabel,
      emissionsCalculable: hasEmissionFactors,
      baselineWeeklyCo2Kg,
      scenarioWeeklyCo2Kg,
      weeklyCo2SavedKg,
      monthlyCo2SavedKg,
      co2RangeLowKg,
      co2RangeHighKg,
      personalExposureTier,
      personalExposureExplanation,
      emissionsVsExposureWarning:
        'Reducing personal pollution exposure (e.g. indoor HEPA filtration or rescheduling runs) does NOT reduce urban emissions, and lowering tailpipe emissions (e.g. switching to transit) does not automatically eliminate personal smog exposure.',
      assumptions,
      uncertainties,
      comparisonRows,
      chartData,
    };
  },
};

function buildInvalidResult(reason: string): ImpactCalculationResult {
  return {
    valid: false,
    infeasibleReason: reason,
    scenarioLabel: 'Invalid / Unsupported Scenario',
    emissionsCalculable: false,
    baselineWeeklyCo2Kg: null,
    scenarioWeeklyCo2Kg: null,
    weeklyCo2SavedKg: null,
    monthlyCo2SavedKg: null,
    co2RangeLowKg: null,
    co2RangeHighKg: null,
    personalExposureTier: 'No Exposure Change',
    personalExposureExplanation: 'Fix invalid scenario parameters to evaluate exposure benefits.',
    emissionsVsExposureWarning:
      'Invalid or incomplete inputs cannot produce credible emission or exposure comparisons.',
    assumptions: [],
    uncertainties: ['Scenario parameters failed validation.'],
    comparisonRows: [],
    chartData: [],
  };
}
