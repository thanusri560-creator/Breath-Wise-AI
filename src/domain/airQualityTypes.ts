export type BreatheWisePage =
  | 'dashboard'
  | 'routine'
  | 'indoor'
  | 'alternatives'
  | 'impact'
  | 'assistant'
  | 'family'
  | 'onboarding'
  | 'testing';

export type AqiCategory =
  | 'Good'
  | 'Moderate'
  | 'Unhealthy for Sensitive Groups'
  | 'Unhealthy'
  | 'Very Unhealthy'
  | 'Hazardous';

export type LifestyleType =
  | 'parent'
  | 'office_worker'
  | 'student'
  | 'fitness_enthusiast'
  | 'outdoor_worker';

export type CommuteType =
  | 'solo_car'
  | 'public_transit'
  | 'carpool'
  | 'walk_or_cycle'
  | 'remote_or_hybrid';

export type HouseholdType =
  | 'family_with_children'
  | 'multigenerational'
  | 'couple'
  | 'solo'
  | 'shared_housing';

export type FiltrationType =
  | 'hepa_purifier'
  | 'hvac_merv13'
  | 'diy_corsi_rosenthal'
  | 'basic_ac_filter'
  | 'none';

export type BenefitDimension =
  | 'Personal Exposure'
  | 'Community Emissions'
  | 'Indoor Air Quality'
  | 'Schedule & Safety';

export interface HourlyAirPoint {
  hour: string;
  aqi: number;
  pm25: number;
  pm10: number;
}

export interface WeatherSnapshot {
  temperatureC: number;
  feelsLikeC: number;
  humidityPct: number;
  visibilityKm: number | null;
  pressureHpa: number;
  condition: string;
  inversionNote: string;
}

export interface WindSnapshot {
  speedKmh: number | null;
  direction: string | null;
  dispersionNote: string;
}

export interface AirQualityReading {
  cityId: string;
  cityName: string;
  region: string;
  stationName: string;
  aqi: number | null;
  category: AqiCategory | 'Unavailable';
  methodology: string;
  dominantPollutant: string;
  pm25: number | null;
  pm10: number | null;
  no2: number | null;
  o3: number | null;
  weather: WeatherSnapshot;
  wind: WindSnapshot;
  hourlyTrend: HourlyAirPoint[];
  bestWindow: string;
  peakWindow: string;
  dataSource: string;
  isDemo: boolean;
  isStale: boolean;
  hasSourceConflict?: boolean;
  sourceConflictNote?: string;
  scenarioLabel: string;
  observedAtIso: string;
  lastUpdatedLabel: string;
  dataLimitations: string[];
}

export interface CityOption {
  id: string;
  name: string;
  region: string;
  aqi: number;
  category: AqiCategory;
  scenarioLabel: string;
}

export interface ActivitySlot {
  id: string;
  timeBlock: 'Morning' | 'Afternoon' | 'Evening';
  title: string;
  isOutdoor: boolean;
  exertion: 'low' | 'moderate' | 'high';
}

export interface UserProfile {
  name: string;
  cityId: string;
  manualLocationLabel: string;
  lifestyle: LifestyleType;
  commute: CommuteType;
  commuteDistanceKm: number;
  householdType: HouseholdType;
  householdSize: number;
  filtration: FiltrationType;
  activities: ActivitySlot[];
  preferences: string[];
  onboardingCompleted: boolean;
}

export interface DirectImpactRecommendation {
  id: string;
  timeBlock: 'Morning' | 'Afternoon' | 'Evening';
  timeWindow: string;
  priorityRank: number;
  activity: string;
  suggestedAction: string;
  whySuggested: string;
  directBenefit: string;
  benefitDimension: BenefitDimension;
  assumptionsAndLimitations: string;
  confidence: 'High' | 'Moderate' | 'Low (Limited Data)';
}

export interface DailyActionPlanResult {
  summary: string;
  source: 'Deterministic Air Action Engine' | 'Gemini AI + Air Action Engine';
  isDataComplete: boolean;
  missingDataWarnings: string[];
  recommendations: DirectImpactRecommendation[];
  publicHealthAdvisory: string;
  generatedAt: string;
}

export interface IndoorEnvironmentInput {
  ventilationHabit: 'closed_sealed' | 'cracked_windows' | 'cross_ventilation' | 'exhaust_only' | 'unknown';
  cookingPractice: 'gas_stove' | 'electric_induction' | 'high_heat_frying' | 'solid_fuel' | 'unknown';
  rangeHood: 'vented_outdoors' | 'recirculating' | 'none' | 'unknown';
  indoorSmokeSources: string[];
  purifierAvailability: FiltrationType | 'unknown';
  roomSize: 'small_under_15m2' | 'medium_15_to_35m2' | 'large_over_35m2';
  primaryRoom: 'bedroom' | 'living_room' | 'home_office' | 'kids_room';
  indoorMonitorAvailable: boolean;
}

export interface IndoorActionItem {
  category:
    | 'Ventilation Timing'
    | 'Source Reduction'
    | 'Filtration Guidance'
    | 'Cleaner Cooking'
    | 'Room-Specific Action';
  suggestedAction: string;
  whySuggested: string;
  directBenefit: string;
  benefitDimension: BenefitDimension;
  assumptionsAndLimitations: string;
}

export interface IndoorGuideResult {
  overallAssessment: string;
  indoorVsOutdoorWarning: string;
  ventilationTimingGuidance: string;
  actions: IndoorActionItem[];
  houseplantEvidenceNote: string;
  unknownDataWarnings: string[];
  generatedAt: string;
}

export interface LowEmissionOption {
  mode: string;
  feasibility: 'Recommended Today' | 'Conditional — Check Window' | 'Not Advisable Under Current AQI';
  suggestedAction: string;
  whySuggested: string;
  personalExposureOutcome: string;
  communityEmissionOutcome: string;
  distinctionNote: string;
  assumptionsAndLimitations: string;
}

export interface LowEmissionPlanResult {
  keyDistinctionSummary: string;
  currentConditionSummary: string;
  options: LowEmissionOption[];
  generatedAt: string;
}

export interface EmissionFactorSet {
  carKgCo2PerKm: number | null;
  carLowKgPerKm: number;
  carHighKgPerKm: number;
  transitKgCo2PerPkm: number | null;
  transitLowKgPerPkm: number;
  transitHighKgPerPkm: number;
  carpoolOccupancy: number;
}

export interface ImpactScenarioInput {
  baselineCarTripsPerWeek: number;
  avgTripDistanceKm: number;
  carTripsReplacedWithTransit: number;
  carTripsReplacedWithCarpool: number;
  unnecessaryCarTripsEliminated: number;
  shiftOutdoorExerciseOffPeak: boolean;
  improveIndoorFiltration: boolean;
}

export interface ImpactCalculationResult {
  valid: boolean;
  infeasibleReason: string | null;
  scenarioLabel: string;
  emissionsCalculable: boolean;
  baselineWeeklyCo2Kg: number | null;
  scenarioWeeklyCo2Kg: number | null;
  weeklyCo2SavedKg: number | null;
  monthlyCo2SavedKg: number | null;
  co2RangeLowKg: number | null;
  co2RangeHighKg: number | null;
  personalExposureTier:
    | 'No Exposure Change'
    | 'Moderate Personal Exposure Reduction'
    | 'Substantial Personal Exposure Reduction';
  personalExposureExplanation: string;
  emissionsVsExposureWarning: string;
  assumptions: string[];
  uncertainties: string[];
  comparisonRows: Array<{
    metric: string;
    originalRoutine: string;
    simulatedScenario: string;
    difference: string;
  }>;
  chartData: Array<{
    label: string;
    originalCo2: number;
    simulatedCo2: number;
  }>;
}

export interface WhatIfSimulationInput {
  aqiOverride: number | null;
  pm25Override: number | null;
  commuteMode: CommuteType;
  householdSize: number;
  filtration: FiltrationType;
  keepOutdoorHighExertion: boolean;
  impactScenario: ImpactScenarioInput;
}

export interface ScenarioConflict {
  id: string;
  severity: 'critical' | 'warning';
  title: string;
  detail: string;
  alternativeAction: string;
}

export interface WhatIfSimulationResult {
  originalAir: AirQualityReading;
  simulatedAir: AirQualityReading;
  originalProfile: UserProfile;
  simulatedProfile: UserProfile;
  originalPlan: DailyActionPlanResult;
  simulatedPlan: DailyActionPlanResult;
  impactResult: ImpactCalculationResult;
  conflicts: ScenarioConflict[];
  isFeasible: boolean;
  feasibilityStatus: 'feasible' | 'feasible_with_adjustments' | 'infeasible';
  feasibilitySummary: string;
  simulatedDisclaimer: string;
}

export interface FamilyMember {
  id: string;
  name: string;
  role: string;
  ageGroup: 'Child (under 12)' | 'Teen (13–17)' | 'Adult (18–64)' | 'Older Adult (65+)';
  commute: CommuteType;
  keyActivities: string;
  activityPreference: string;
}

export interface FamilyActionPlanResult {
  householdSummary: string;
  individualRoutines: Array<{
    memberName: string;
    role: string;
    suggestedAction: string;
    whySuggested: string;
    benefitDimension: BenefitDimension;
  }>;
  sharedActivities: Array<{
    activity: string;
    plan: string;
    benefit: string;
  }>;
  indoorAirPractices: string[];
  sustainableHouseholdChoices: string[];
  publicHealthAdvisory: string;
  generatedAt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  contextNote?: string;
}

export type TestCategory = 'unit' | 'integration' | 'edge-case' | 'stress';

export interface TestCaseResult {
  id: string;
  name: string;
  category: TestCategory;
  passed: boolean;
  durationMs: number;
  details: string;
  error?: string;
}

export interface TestSuiteSummary {
  total: number;
  passed: number;
  failed: number;
  totalDurationMs: number;
  executedAt: string;
  results: TestCaseResult[];
}
