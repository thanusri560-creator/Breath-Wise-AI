export type NavigationPage =
  | 'dashboard'
  | 'onboarding'
  | 'routine'
  | 'indoor'
  | 'alternatives'
  | 'impact'
  | 'assistant'
  | 'family';

export type AqiCategory =
  | 'Good'
  | 'Moderate'
  | 'Unhealthy for Sensitive Groups'
  | 'Unhealthy'
  | 'Very Unhealthy'
  | 'Hazardous';

export interface HourlyReading {
  hour: string;
  aqi: number;
  pm25: number;
  pm10: number;
}

export interface WeatherInfo {
  tempC: number;
  humidityPct: number;
  condition: string;
  visibilityKm: number | null;
  inversionRisk: 'Low' | 'Moderate' | 'High';
}

export interface WindInfo {
  speedKmh: number | null;
  direction: string | null;
  dispersionNote: string;
}

export interface AirQualityData {
  cityId: string;
  cityName: string;
  region: string;
  stationName: string;
  aqi: number;
  category: AqiCategory;
  dominantPollutant: string;
  pm25: number;
  pm10: number;
  no2: number | null;
  o3: number | null;
  weather: WeatherInfo;
  wind: WindInfo;
  hourlyTrend: HourlyReading[];
  isDemo: boolean;
  dataSource: string;
  lastUpdated: string;
  sampleContextNote?: string;
  missingDataNotes: string[];
  primaryCausesSummary: string;
}

export interface CitySummary {
  id: string;
  name: string;
  region: string;
  sampleAqi: number;
  category: AqiCategory;
  scenarioLabel: string;
}

export type LifestyleType =
  | 'student'
  | 'office_worker'
  | 'parent'
  | 'outdoor_worker'
  | 'fitness_enthusiast';

export type CommuteType =
  | 'solo_car'
  | 'public_transit'
  | 'carpool'
  | 'walk_cycle'
  | 'two_wheeler'
  | 'remote_hybrid';

export type HouseholdType =
  | 'solo'
  | 'couple'
  | 'family_with_children'
  | 'multi_generational'
  | 'shared_housing';

export type FiltrationType =
  | 'hepa_purifier'
  | 'hvac_merv13'
  | 'basic_ac_fan'
  | 'none';

export interface UserProfile {
  name: string;
  cityId: string;
  customCity?: string;
  lifestyle: LifestyleType;
  commute: CommuteType;
  outdoorActivities: string[];
  householdType: HouseholdType;
  indoorFiltration: FiltrationType;
  preferences: string[];
  onboardingCompleted: boolean;
}

export interface IndoorSetup {
  ventilationHabit: 'closed_sealed' | 'cracked_all_day' | 'timed_midday' | 'cross_ventilation';
  cookingMethod: 'gas_stove' | 'electric_induction' | 'high_heat_frying' | 'solid_fuel_wood';
  exhaustHood: 'vented_outside' | 'recirculating' | 'none';
  smokeSources: string[];
  purifierAvailability: FiltrationType;
  roomSize: 'small_under_15m2' | 'medium_15_35m2' | 'large_over_35m2';
  notes: string;
}

export interface RoutineItem {
  period: 'Morning' | 'Afternoon' | 'Evening';
  timeWindow: string;
  activity: string;
  suggestedAdjustment: string;
  reason: string;
  expectedPersonalBenefit: string;
  confidenceOrLimitation: string;
}

export interface DailyRoutinePlan {
  summary: string;
  bestOutdoorWindow: string;
  items: RoutineItem[];
  dataLimitations: string;
  generatedAt: string;
}

export interface IndoorRecommendation {
  category:
    | 'Ventilation Timing'
    | 'Reducing Indoor Sources'
    | 'Filtration Guidance'
    | 'Cleaner Cooking'
    | 'Room-Specific Actions';
  title: string;
  action: string;
  whyItHelps: string;
  practicalConstraint: string;
}

export interface IndoorGuidancePlan {
  summary: string;
  priorityAction: string;
  recommendations: IndoorRecommendation[];
  houseplantRealityCheck: string;
  dataLimitations: string;
  generatedAt: string;
}

export interface LowEmissionOption {
  mode: string;
  whenAppropriate: string;
  personalExposureEffect: string;
  exposureDirection: 'Lower exposure' | 'Context-dependent' | 'Higher exposure during severe smog';
  emissionsEffect: string;
  emissionsDirection: 'Lower emissions' | 'Moderate reduction' | 'Minimal change';
  practicalTip: string;
  roadAndAqiSafetyNote: string;
}

export interface LowEmissionPlan {
  overview: string;
  exposureVsEmissionsDistinction: string;
  options: LowEmissionOption[];
  currentSmogWarning: string;
  generatedAt: string;
}

export interface ImpactScenarioInput {
  carTripsReplacedWithTransit: number; // per week (0-10)
  avgShortTripKm: number; // one-way km (2-20)
  avoidedCarTripsPerWeek: number; // combined errands / remote days (0-7)
  shiftExerciseToLowWindow: boolean;
  upgradeIndoorFiltrationPractice: boolean;
}

export interface ImpactSimulationResult {
  scenarioLabel: string;
  weeklyCo2SavedKg: { low: number; mid: number; high: number };
  monthlyCo2SavedKg: { low: number; mid: number; high: number };
  weeklyBaselineCo2Kg: number;
  weeklyScenarioCo2Kg: number;
  carKmAvoidedPerWeek: number;
  emissionsCalculableNote: string;
  personalExposureBenefit: {
    tierLabel: string;
    summary: string;
    nonFabricationDisclaimer: string;
  };
  routineComparison: Array<{
    dimension: string;
    originalRoutine: string;
    adjustedScenario: string;
    direction: string;
  }>;
  assumptions: string[];
  uncertainties: string[];
}

export interface FamilyMember {
  id: string;
  name: string;
  role: string;
  ageGroup: 'Child (under 12)' | 'Teen (12-17)' | 'Adult (18-64)' | 'Older Adult (65+)';
  commute: CommuteType;
  dailyNeeds: string;
  sensitivityNote: string;
}

export interface HouseholdActionPlan {
  overview: string;
  individualRoutines: Array<{
    memberName: string;
    role: string;
    keyAdjustment: string;
    reason: string;
  }>;
  sharedActivities: Array<{
    activity: string;
    recommendedPlan: string;
    whyItWorks: string;
  }>;
  indoorAirPractices: string[];
  sustainableHouseholdChoices: string[];
  publicHealthReminder: string;
  generatedAt: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}
