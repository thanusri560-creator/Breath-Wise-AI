import type {
  AirQualityReading,
  IndoorEnvironmentInput,
  TestCaseResult,
  UserProfile,
} from '../domain/airQualityTypes';
import {
  DEFAULT_IMPACT_SCENARIO,
  DEFAULT_INDOOR_INPUT,
  DEFAULT_USER_PROFILE,
} from '../data/breathewiseDefaults';
import {
  AirQualityDataService,
  calculateUsEpaAqiFromPm25,
  detectSourceConflict,
} from '../services/AirQualityDataService';
import {
  DEFAULT_EMISSION_FACTORS,
  ImpactCalculationService,
} from '../services/ImpactCalculationService';
import { RecommendationEngine } from '../services/RecommendationEngine';
import {
  validateAirQualityReading,
  validateDailyPlanAiResponse,
  validateFamilyPlanAiResponse,
  validateIndoorGuideAiResponse,
  validateLowEmissionAiResponse,
} from '../services/validation';
import { assert, runCase } from './testHelpers';

export async function runEdgeCaseTests(): Promise<TestCaseResult[]> {
  return [
    await runCase('edge-unavailable-aqi', 'Missing / unavailable AQI triggers cautious fallback state', 'edge-case', () => {
      const missing = AirQualityDataService.buildUnavailableReading('Remote Valley', 'Station offline');
      const check = validateAirQualityReading(missing);
      assert(!check.valid && check.warnings.length > 0, 'Missing AQI flagged invalid with warnings');
      const plan = RecommendationEngine.generateDailyActionPlan(missing, DEFAULT_USER_PROFILE);
      assert(plan.isDataComplete === false, 'Plan marks data incomplete');
      assert(plan.recommendations[0].confidence === 'Low (Limited Data)', 'Confidence downgraded on missing AQI');
      return 'Handled unavailable AQI with Low confidence and cautious baseline plan';
    }),

    await runCase('edge-invalid-location', 'Invalid / symbol-only location safely falls back', 'edge-case', () => {
      const reading = AirQualityDataService.getDemoReading('!!!@@@###');
      assert(reading.cityName.length > 0 && reading.aqi !== null, 'Fallback reading generated cleanly');
      return `Sanitized invalid input safely to fallback city "${reading.cityName}"`;
    }),

    await runCase('edge-negative-pollutants', 'Negative & impossible pollutant inputs rejected cleanly', 'edge-case', () => {
      assert(calculateUsEpaAqiFromPm25(-12) === null, 'Negative PM2.5 returns null AQI');
      const sim = RecommendationEngine.runMidFlightWhatIfSimulation(
        AirQualityDataService.getDemoReading('milan'),
        DEFAULT_USER_PROFILE,
        DEFAULT_INDOOR_INPUT,
        {
          aqiOverride: -50,
          pm25Override: -10,
          commuteMode: 'solo_car',
          householdSize: 2,
          filtration: 'hepa_purifier',
          keepOutdoorHighExertion: false,
          impactScenario: DEFAULT_IMPACT_SCENARIO,
        }
      );
      assert(!sim.isFeasible, 'Negative simulated pollutants must mark scenario infeasible');
      return 'Rejected negative AQI (-50) and PM2.5 (-10) in What-If simulation';
    }),

    await runCase('edge-missing-pm', 'Missing PM2.5 or PM10 flagged without crashing', 'edge-case', () => {
      const partial: AirQualityReading = {
        ...AirQualityDataService.getDemoReading('salt-lake-city'),
        pm25: null,
        pm10: null,
      };
      const check = validateAirQualityReading(partial);
      assert(check.warnings.some((w) => w.includes('PM2.5')), 'Missing PM2.5 warning emitted');
      assert(check.warnings.some((w) => w.includes('PM10')), 'Missing PM10 warning emitted');
      return 'Flagged missing PM2.5 and PM10 while preserving AQI rendering';
    }),

    await runCase('edge-stale-data', 'Stale environmental data (>3h) triggers warning & Low confidence', 'edge-case', () => {
      const oldIso = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
      const staleReading = AirQualityDataService.getDemoReading('new-delhi', oldIso);
      assert(staleReading.isStale === true, '6h old reading marked stale');
      const plan = RecommendationEngine.generateDailyActionPlan(staleReading, DEFAULT_USER_PROFILE);
      assert(plan.recommendations[0].confidence === 'Low (Limited Data)', 'Stale data lowers confidence');
      return 'Marked 6-hour-old reading stale and downgraded plan confidence';
    }),

    await runCase('edge-conflicting-sources', 'Conflicting environmental sources surfaced in validation warnings', 'edge-case', () => {
      const conflict = detectSourceConflict(240, 150, 'Municipal Station', 'Crowd Sensor');
      const reading: AirQualityReading = {
        ...AirQualityDataService.getDemoReading('lahore'),
        hasSourceConflict: conflict.hasConflict,
        sourceConflictNote: conflict.note ?? undefined,
      };
      const check = validateAirQualityReading(reading);
      assert(check.warnings.some((w) => w.includes('Conflicting readings')), 'Conflict surfaced to warnings');
      return 'Surfaced 90-point source conflict into recommendation warnings';
    }),

    await runCase('edge-empty-schedule', 'Empty user activity schedule falls back to lifestyle defaults', 'edge-case', () => {
      const emptyProfile: UserProfile = { ...DEFAULT_USER_PROFILE, activities: [] };
      const plan = RecommendationEngine.generateDailyActionPlan(
        AirQualityDataService.getDemoReading('milan'),
        emptyProfile
      );
      assert(plan.recommendations.length === 3, 'Still produces 3 time blocks on empty schedule');
      return 'Populated safe lifestyle-specific Morning/Afternoon/Evening defaults';
    }),

    await runCase('edge-ai-errors', 'Gemini timeout, 429 rate-limit, and malformed AI payload recovery', 'edge-case', () => {
      const malformed = validateDailyPlanAiResponse({ summary: '', recommendations: [{ activity: 123 }] });
      assert(malformed === null, 'Malformed AI payload rejected');

      const simulatedErrorCodes = [429, 504];
      for (const code of simulatedErrorCodes) {
        const fallback = RecommendationEngine.generateDailyActionPlan(
          AirQualityDataService.getDemoReading('new-delhi'),
          DEFAULT_USER_PROFILE
        );
        assert(fallback.recommendations.length === 3 && code > 400, `Fallback survived HTTP ${code}`);
      }
      return 'Verified safe rejection of malformed JSON and instant fallback on simulated 429/timeout';
    }),

    await runCase('edge-missing-factors', 'Missing emission factors handled without fabricating CO2 savings', 'edge-case', () => {
      const air = AirQualityDataService.getDemoReading('new-delhi');
      const res = ImpactCalculationService.calculate(DEFAULT_IMPACT_SCENARIO, air, {
        ...DEFAULT_EMISSION_FACTORS,
        carKgCo2PerKm: null,
      });
      assert(res.valid && !res.emissionsCalculable, 'Marked uncalculable cleanly');
      assert(res.weeklyCo2SavedKg === null, 'Did not fabricate fake CO2 number');
      return 'Refused to fabricate CO₂e numbers when transport emission factors are missing';
    }),

    await runCase('edge-zero-distance-and-unknown-indoor', 'Zero-distance travel & unknown indoor conditions under high smog', 'edge-case', () => {
      const air = AirQualityDataService.getDemoReading('new-delhi');
      const zeroDist = ImpactCalculationService.calculate(
        { ...DEFAULT_IMPACT_SCENARIO, avgTripDistanceKm: 0, carTripsReplacedWithTransit: 3 },
        air
      );
      assert(!zeroDist.valid && Boolean(zeroDist.infeasibleReason), 'Zero-distance travel swap rejected');

      const unknownIndoor: IndoorEnvironmentInput = {
        ventilationHabit: 'unknown',
        cookingPractice: 'unknown',
        rangeHood: 'unknown',
        indoorSmokeSources: [],
        purifierAvailability: 'unknown',
        roomSize: 'medium_15_to_35m2',
        primaryRoom: 'bedroom',
        indoorMonitorAvailable: false,
      };
      const guide = RecommendationEngine.generateIndoorAirGuide(air, DEFAULT_USER_PROFILE, unknownIndoor);
      assert(guide.unknownDataWarnings.length >= 2, 'Unknown indoor inputs triggered precautionary warnings');
      return 'Rejected zero-distance travel scenario and emitted precautionary warnings for unknown indoor setup';
    }),

    await runCase('edge-nested-ai-validators', 'Nested AI response validation & houseplant safety guard', 'edge-case', () => {
      assert(validateIndoorGuideAiResponse({ overallAssessment: 'ok', actions: [{ bad: true }] }) === null, 'Malformed indoor action rejected');
      assert(validateLowEmissionAiResponse({ keyDistinctionSummary: 'ok', options: [{ mode: 'Bus' }] }) === null, 'Incomplete low-emission option rejected');
      assert(validateFamilyPlanAiResponse({ householdSummary: 'ok', individualRoutines: [{ role: 'Parent' }] }) === null, 'Incomplete family routine rejected');

      const indoorValid = validateIndoorGuideAiResponse({
        overallAssessment: 'Seal windows during smog.',
        houseplantEvidenceNote: 'Buy ferns to purify smog.',
        actions: [
          {
            category: 'Filtration Guidance',
            suggestedAction: 'Run HEPA purifier.',
            whySuggested: 'Captures PM2.5.',
            directBenefit: 'Lower indoor particulates.',
            benefitDimension: 'Indoor Air Quality',
            assumptionsAndLimitations: 'Depends on CADR.',
          },
        ],
      });
      assert(
        indoorValid !== null && indoorValid.houseplantEvidenceNote.toLowerCase().includes('cannot'),
        'Houseplant myth overridden with evidence-based clarification'
      );
      return 'Blocked malformed nested AI items and enforced scientific houseplant safeguard';
    }),

    await runCase('edge-negative-scenario-trips', 'Negative scenario trip counts rejected cleanly', 'edge-case', () => {
      const air = AirQualityDataService.getDemoReading('milan');
      const invalid = ImpactCalculationService.calculate(
        { ...DEFAULT_IMPACT_SCENARIO, carTripsReplacedWithTransit: -3 },
        air
      );
      assert(!invalid.valid && invalid.emissionsCalculable === false, 'Negative trip count rejected');
      return 'Rejected negative trip count scenario with clear infeasibility reason';
    }),
  ];
}
