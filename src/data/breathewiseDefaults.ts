import type {
  CommuteType,
  FamilyMember,
  FiltrationType,
  HouseholdType,
  ImpactScenarioInput,
  IndoorEnvironmentInput,
  LifestyleType,
  UserProfile,
} from '../domain/airQualityTypes';

export const LIFESTYLE_LABELS: Record<LifestyleType, string> = {
  parent: 'Parent / Caregiver',
  office_worker: 'Office / Hybrid Worker',
  student: 'Student / Campus Commuter',
  fitness_enthusiast: 'Fitness Enthusiast',
  outdoor_worker: 'Outdoor Worker',
};

export const COMMUTE_LABELS: Record<CommuteType, string> = {
  solo_car: 'Solo Passenger Car',
  public_transit: 'Public Transit (Metro / Bus / Rail)',
  carpool: 'Carpool / Shared Ride',
  walk_or_cycle: 'Walking or Cycling',
  remote_or_hybrid: 'Remote / Hybrid',
};

export const HOUSEHOLD_LABELS: Record<HouseholdType, string> = {
  family_with_children: 'Family with Children',
  multigenerational: 'Multigenerational Household',
  couple: 'Couple / Two Adults',
  solo: 'Solo Resident',
  shared_housing: 'Shared Housing / Roommates',
};

export const FILTRATION_LABELS: Record<FiltrationType, string> = {
  hepa_purifier: 'Portable True-HEPA Purifier',
  hvac_merv13: 'Central HVAC (MERV-13+ Filter)',
  diy_corsi_rosenthal: 'DIY MERV-13 Box-Fan Filter',
  basic_ac_filter: 'Basic AC Mesh (Not PM2.5 Rated)',
  none: 'No Mechanical Air Filtration',
};

export const DEFAULT_USER_PROFILE: UserProfile = {
  name: 'Aarav Sharma',
  cityId: 'new-delhi',
  manualLocationLabel: '',
  lifestyle: 'parent',
  commute: 'solo_car',
  commuteDistanceKm: 14,
  householdType: 'family_with_children',
  householdSize: 4,
  filtration: 'hepa_purifier',
  activities: [
    {
      id: 'act-1',
      timeBlock: 'Morning',
      title: 'School drop-off & morning commute',
      isOutdoor: true,
      exertion: 'low',
    },
    {
      id: 'act-2',
      timeBlock: 'Afternoon',
      title: 'Grocery pickup & midday errands',
      isOutdoor: true,
      exertion: 'moderate',
    },
    {
      id: 'act-3',
      timeBlock: 'Evening',
      title: 'Evening park walk & family dinner prep',
      isOutdoor: true,
      exertion: 'moderate',
    },
  ],
  preferences: [
    'Minimize children’s winter smog exposure',
    'Prefer practical transit or carpool swaps',
    'Keep bedrooms clean overnight',
  ],
  onboardingCompleted: true,
};

export const DEFAULT_INDOOR_INPUT: IndoorEnvironmentInput = {
  ventilationHabit: 'cracked_windows',
  cookingPractice: 'gas_stove',
  rangeHood: 'recirculating',
  indoorSmokeSources: ['Occasional incense'],
  purifierAvailability: 'hepa_purifier',
  roomSize: 'medium_15_to_35m2',
  primaryRoom: 'bedroom',
  indoorMonitorAvailable: false,
};

export const DEFAULT_FAMILY_MEMBERS: FamilyMember[] = [
  {
    id: 'fam-1',
    name: 'Aarav',
    role: 'Parent · Hybrid Office',
    ageGroup: 'Adult (18–64)',
    commute: 'solo_car',
    keyActivities: 'Morning school run & office commute',
    activityPreference: 'Open to metro twice a week',
  },
  {
    id: 'fam-2',
    name: 'Meera',
    role: 'Parent · Healthcare Clinic',
    ageGroup: 'Adult (18–64)',
    commute: 'public_transit',
    keyActivities: 'Daytime transit commute & evening walk',
    activityPreference: 'Prefers indoor stretching on smog days',
  },
  {
    id: 'fam-3',
    name: 'Riya',
    role: 'Elementary Student',
    ageGroup: 'Child (under 12)',
    commute: 'carpool',
    keyActivities: 'School recess & after-school soccer',
    activityPreference: 'Indoor art/play when AQI is unhealthy',
  },
  {
    id: 'fam-4',
    name: 'Grandfather Raj',
    role: 'Retired Household Elder',
    ageGroup: 'Older Adult (65+)',
    commute: 'remote_or_hybrid',
    keyActivities: 'Early morning courtyard walk & tea',
    activityPreference: 'Needs clean-air bedroom & afternoon sunlit indoor room',
  },
];

export const DEFAULT_IMPACT_SCENARIO: ImpactScenarioInput = {
  baselineCarTripsPerWeek: 10,
  avgTripDistanceKm: 14,
  carTripsReplacedWithTransit: 4,
  carTripsReplacedWithCarpool: 2,
  unnecessaryCarTripsEliminated: 2,
  shiftOutdoorExerciseOffPeak: true,
  improveIndoorFiltration: true,
};

export interface ImpactPreset {
  id: string;
  label: string;
  description: string;
  scenario: ImpactScenarioInput;
}

export const IMPACT_SCENARIO_PRESETS: ImpactPreset[] = [
  {
    id: 'smog-week-hybrid',
    label: 'Severe Smog Hybrid Week',
    description: 'Shift 4 trips to metro, 2 to carpool, eliminate 2 errands, move exercise indoors & run HEPA.',
    scenario: {
      baselineCarTripsPerWeek: 10,
      avgTripDistanceKm: 14,
      carTripsReplacedWithTransit: 4,
      carTripsReplacedWithCarpool: 2,
      unnecessaryCarTripsEliminated: 2,
      shiftOutdoorExerciseOffPeak: true,
      improveIndoorFiltration: true,
    },
  },
  {
    id: 'transit-only-shift',
    label: 'Transit Shift Only (Emissions Focus)',
    description: 'Replace 6 solo car trips with public transit without altering indoor air or outdoor exercise.',
    scenario: {
      baselineCarTripsPerWeek: 10,
      avgTripDistanceKm: 12,
      carTripsReplacedWithTransit: 6,
      carTripsReplacedWithCarpool: 0,
      unnecessaryCarTripsEliminated: 0,
      shiftOutdoorExerciseOffPeak: false,
      improveIndoorFiltration: false,
    },
  },
  {
    id: 'indoor-shield-only',
    label: 'Personal Exposure Shield Only',
    description: 'Keep driving routine unchanged while adding HEPA filtration and moving workouts off-peak.',
    scenario: {
      baselineCarTripsPerWeek: 10,
      avgTripDistanceKm: 14,
      carTripsReplacedWithTransit: 0,
      carTripsReplacedWithCarpool: 0,
      unnecessaryCarTripsEliminated: 0,
      shiftOutdoorExerciseOffPeak: true,
      improveIndoorFiltration: true,
    },
  },
];

export const QUICK_ASSISTANT_PROMPTS: string[] = [
  'Is it safe to open windows right now?',
  'Should I run outside today or shift my workout indoors?',
  'Do houseplants actually clean winter smog indoors?',
  'What is the difference between lowering my exposure and reducing emissions?',
  'How can our family keep bedrooms cleaner overnight without a central HVAC?',
  'Which commute change makes the most practical sense under today’s AQI?',
];
