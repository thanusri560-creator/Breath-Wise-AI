import type { TestCaseResult } from '../domain/airQualityTypes';
import {
  DEFAULT_FAMILY_MEMBERS,
  DEFAULT_IMPACT_SCENARIO,
  DEFAULT_INDOOR_INPUT,
  DEFAULT_USER_PROFILE,
} from '../data/breathewiseDefaults';
import { AirQualityDataService } from '../services/AirQualityDataService';
import { ImpactCalculationService } from '../services/ImpactCalculationService';
import { RecommendationEngine } from '../services/RecommendationEngine';
import {
  validateDailyPlanAiResponse,
  validateUserProfile,
} from '../services/validation';
import { assert, runCase } from './testHelpers';

export async function runIntegrationTests(): Promise<TestCaseResult[]> {
  return [
    await runCase('int-demo-labeling', 'Air quality retrieval clearly identifies Demo Mode data', 'integration', () => {
      const reading = AirQualityDataService.getDemoReading('lahore');
      assert(reading.isDemo === true, 'Demo reading must set isDemo=true');
      assert(reading.dataSource.includes('DEMO MODE'), 'Data source must explicitly state DEMO MODE');
      assert(reading.hourlyTrend.length > 0, 'Diurnal chart series populated');
      return `Loaded ${reading.cityName} (AQI ${reading.aqi}) with explicit DEMO MODE provenance`;
    }),

    await runCase('int-profile-validation', 'User profile validation accepts valid and rejects corrupted profiles', 'integration', () => {
      const ok = validateUserProfile(DEFAULT_USER_PROFILE);
      assert(ok.valid, 'Default profile must pass validation');
      const bad = validateUserProfile({ ...DEFAULT_USER_PROFILE, householdSize: 0, commuteDistanceKm: -10 });
      assert(!bad.valid && bad.errors.length >= 2, 'Invalid household size & distance rejected');
      return 'Profile validation enforced bounds on household size and commute distance';
    }),

    await runCase('int-lifestyle-propagation', 'Lifestyle switch updates personalized Daily Action Plan', 'integration', () => {
      const air = AirQualityDataService.getDemoReading('salt-lake-city');
      const parentPlan = RecommendationEngine.generateDailyActionPlan(air, {
        ...DEFAULT_USER_PROFILE,
        lifestyle: 'parent',
        activities: [],
      });
      const fitnessPlan = RecommendationEngine.generateDailyActionPlan(air, {
        ...DEFAULT_USER_PROFILE,
        lifestyle: 'fitness_enthusiast',
        activities: [],
      });
      assert(
        parentPlan.recommendations[0].activity !== fitnessPlan.recommendations[0].activity,
        'Switching lifestyle must adapt scheduled activities'
      );
      return `Parent ("${parentPlan.recommendations[0].activity}") vs Fitness ("${fitnessPlan.recommendations[0].activity}")`;
    }),

    await runCase('int-aqi-propagation', 'AQI change propagates across Daily Routine & Low-Emission options', 'integration', () => {
      const delhi = AirQualityDataService.getDemoReading('new-delhi');
      const vancouver = AirQualityDataService.getDemoReading('vancouver');
      const delhiAlt = RecommendationEngine.generateLowEmissionAlternatives(delhi, DEFAULT_USER_PROFILE);
      const vanAlt = RecommendationEngine.generateLowEmissionAlternatives(vancouver, DEFAULT_USER_PROFILE);
      const delhiCycle = delhiAlt.options.find((o) => o.mode.includes('Cycling'));
      const vanCycle = vanAlt.options.find((o) => o.mode.includes('Cycling'));
      assert(delhiCycle?.feasibility === 'Not Advisable Under Current AQI', 'Cycling blocked in severe smog');
      assert(vanCycle?.feasibility === 'Recommended Today', 'Cycling recommended in clean air');
      return 'Cycling feasibility flipped cleanly between New Delhi (Hazardous) and Vancouver (Good)';
    }),

    await runCase('int-indoor-propagation', 'Indoor input updates dynamically revise Indoor Air Guide', 'integration', () => {
      const air = AirQualityDataService.getDemoReading('new-delhi');
      const vented = RecommendationEngine.generateIndoorAirGuide(air, DEFAULT_USER_PROFILE, {
        ...DEFAULT_INDOOR_INPUT,
        rangeHood: 'vented_outdoors',
        indoorSmokeSources: ['None'],
      });
      const unvented = RecommendationEngine.generateIndoorAirGuide(air, DEFAULT_USER_PROFILE, {
        ...DEFAULT_INDOOR_INPUT,
        rangeHood: 'none',
        indoorSmokeSources: ['Indoor tobacco smoke'],
      });
      const ventedCook = vented.actions.find((a) => a.category === 'Cleaner Cooking')?.suggestedAction;
      const unventedCook = unvented.actions.find((a) => a.category === 'Cleaner Cooking')?.suggestedAction;
      assert(ventedCook !== unventedCook, 'Changing kitchen range hood must update cooking guidance');
      return 'Cooking and smoke-source changes immediately refreshed indoor guidance';
    }),

    await runCase('int-ai-validation', 'Gemini structured response validator accepts valid & blocks malformed output', 'integration', () => {
      const air = AirQualityDataService.getDemoReading('krakow');
      const validPayload = RecommendationEngine.generateDailyActionPlan(air, DEFAULT_USER_PROFILE);
      assert(validateDailyPlanAiResponse(validPayload) !== null, 'Valid structured AI payload accepted');
      assert(validateDailyPlanAiResponse({ summary: 'broken', recommendations: [] }) === null, 'Empty recommendations rejected');
      assert(validateDailyPlanAiResponse('not-json-object') === null, 'Non-object payload rejected');
      return 'Validated structured schema before display and blocked malformed AI output';
    }),

    await runCase('int-impact-recalc', 'Impact Explorer recalculates emissions & chart rows on scenario edit', 'integration', () => {
      const air = AirQualityDataService.getDemoReading('milan');
      const base = ImpactCalculationService.calculate(DEFAULT_IMPACT_SCENARIO, air);
      const doubled = ImpactCalculationService.calculate(
        { ...DEFAULT_IMPACT_SCENARIO, avgTripDistanceKm: DEFAULT_IMPACT_SCENARIO.avgTripDistanceKm * 2 },
        air
      );
      assert(
        (doubled.weeklyCo2SavedKg ?? 0) > (base.weeklyCo2SavedKg ?? 0) * 1.9,
        'Doubling trip distance must proportionally scale CO2 savings'
      );
      assert(doubled.chartData.length === 2 && doubled.comparisonRows.length === 3, 'Chart & table rows synced');
      return `Scaled weekly savings from ${base.weeklyCo2SavedKg} kg to ${doubled.weeklyCo2SavedKg} kg CO₂e`;
    }),

    await runCase('int-location-change', 'Location switch updates city telemetry & household plan', 'integration', () => {
      const krakow = AirQualityDataService.getDemoReading('krakow');
      const plan = RecommendationEngine.generateFamilyActionPlan(krakow, DEFAULT_USER_PROFILE, DEFAULT_FAMILY_MEMBERS);
      assert(plan.householdSummary.includes('Krakow'), 'Family plan reflects active city');
      assert(plan.individualRoutines.length === DEFAULT_FAMILY_MEMBERS.length, 'Every member received a tailored routine');
      return `Household plan synchronized for ${krakow.cityName} (${DEFAULT_FAMILY_MEMBERS.length} members)`;
    }),

    await runCase('int-all-india-cities', 'All-India regional coverage across North, South, East & West cities', 'integration', () => {
      const indiaCities = ['new-delhi', 'mumbai', 'bengaluru', 'chennai', 'kolkata', 'hyderabad', 'pune', 'lucknow', 'jaipur', 'kochi'];
      for (const id of indiaCities) {
        const r = AirQualityDataService.getDemoReading(id);
        assert(r.region.includes('India') && r.aqi !== null, `Missing India reading for ${id}`);
      }
      const customTown = AirQualityDataService.getDemoReading('Coimbatore');
      assert(customTown.cityName === 'Coimbatore' && customTown.aqi !== null, 'Custom Indian city name preserved');
      return `Verified ${indiaCities.length} featured Indian cities + custom town resolution ("Coimbatore")`;
    }),
  ];
}
