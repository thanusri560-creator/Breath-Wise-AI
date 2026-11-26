import type {
  AirQualityReading,
  DailyActionPlanResult,
  FamilyActionPlanResult,
  IndoorEnvironmentInput,
  IndoorGuideResult,
  LowEmissionPlanResult,
  UserProfile,
} from '../domain/airQualityTypes';

export const ALLOWED_EXTERNAL_HOSTS = new Set<string>([
  'api.waqi.info',
  'geocoding-api.open-meteo.com',
  'air-quality-api.open-meteo.com',
  'api.open-meteo.com',
]);

/**
 * Validates outbound environmental API URLs against a strict HTTPS hostname allowlist,
 * preventing unauthorized external requests, plaintext HTTP downgrades, or custom port abuse.
 */
export function assertAllowedExternalUrl(rawUrl: string): URL {
  const parsed = new URL(rawUrl);
  if (parsed.protocol !== 'https:') {
    throw new Error('Only HTTPS external environmental endpoints are permitted.');
  }
  if (parsed.username || parsed.password) {
    throw new Error('Credentials in external endpoint URLs are not permitted.');
  }
  if (parsed.port && parsed.port !== '443') {
    throw new Error('Non-standard ports on external environmental endpoints are not permitted.');
  }
  if (!ALLOWED_EXTERNAL_HOSTS.has(parsed.hostname.toLowerCase())) {
    throw new Error(`External host "${parsed.hostname}" is not in the approved environmental API allowlist.`);
  }
  return parsed;
}

/**
 * Validates that an incoming client-supplied AirQualityReading payload has valid structural fields
 * and bounded AQI values before passing it into server-side Gemini prompt builders.
 */
export function isValidIncomingAirPayload(air: unknown): air is AirQualityReading {
  if (typeof air !== 'object' || air === null) return false;
  const candidate = air as Partial<AirQualityReading>;
  if (typeof candidate.cityName !== 'string' || !candidate.cityName.trim()) return false;
  if (
    candidate.aqi !== null &&
    (typeof candidate.aqi !== 'number' ||
      !Number.isFinite(candidate.aqi) ||
      candidate.aqi < 0 ||
      candidate.aqi > 500)
  ) {
    return false;
  }
  if (typeof candidate.weather !== 'object' || candidate.weather === null) return false;
  if (typeof candidate.wind !== 'object' || candidate.wind === null) return false;
  return true;
}

/**
 * Validates that an incoming IndoorEnvironmentInput payload contains expected string enums.
 */
export function isValidIncomingIndoorPayload(indoor: unknown): indoor is IndoorEnvironmentInput {
  if (typeof indoor !== 'object' || indoor === null) return false;
  const candidate = indoor as Partial<IndoorEnvironmentInput>;
  return (
    typeof candidate.ventilationHabit === 'string' &&
    typeof candidate.cookingPractice === 'string' &&
    typeof candidate.rangeHood === 'string' &&
    typeof candidate.purifierAvailability === 'string' &&
    typeof candidate.roomSize === 'string' &&
    typeof candidate.primaryRoom === 'string' &&
    Array.isArray(candidate.indoorSmokeSources)
  );
}

const VALID_LIFESTYLES = new Set([
  'parent',
  'office_worker',
  'student',
  'fitness_enthusiast',
  'outdoor_worker',
]);

const VALID_COMMUTES = new Set([
  'solo_car',
  'public_transit',
  'carpool',
  'walk_or_cycle',
  'remote_or_hybrid',
]);

const VALID_FILTRATIONS = new Set([
  'hepa_purifier',
  'hvac_merv13',
  'diy_corsi_rosenthal',
  'basic_ac_filter',
  'none',
]);

/**
 * Strips control characters, HTML angle brackets, and common prompt-injection override
 * patterns from untrusted user text or external sensor strings.
 */
export function sanitizeUserText(input: string, maxLength = 300): string {
  return input
    .replace(/[<>]/g, '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\b(ignore\s+previous\s+instructions|system\s+prompt|disregard\s+all\s+rules)\b/gi, '[filtered]')
    .trim()
    .slice(0, maxLength);
}

/**
 * Sanitizes a city or manual location string while stripping precise street coordinates
 * or sensitive personal address patterns.
 */
export function sanitizeLocationInput(raw: string): string {
  const cleaned = raw
    .replace(/[^\p{L}\p{N}\s,.-]/gu, '')
    .replace(/\b\d{1,3}\.\d{3,}\b/g, '') // Strip precise GPS decimal coordinates
    .trim()
    .slice(0, 80);
  return cleaned;
}

export interface ProfileValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateUserProfile(profile: Partial<UserProfile>): ProfileValidationResult {
  const errors: string[] = [];

  if (!profile.lifestyle || !VALID_LIFESTYLES.has(profile.lifestyle)) {
    errors.push('Invalid lifestyle selection.');
  }
  if (!profile.commute || !VALID_COMMUTES.has(profile.commute)) {
    errors.push('Invalid commute mode selection.');
  }
  if (
    typeof profile.commuteDistanceKm !== 'number' ||
    !Number.isFinite(profile.commuteDistanceKm) ||
    profile.commuteDistanceKm < 0 ||
    profile.commuteDistanceKm > 250
  ) {
    errors.push('Commute distance must be between 0 and 250 km.');
  }
  if (
    typeof profile.householdSize !== 'number' ||
    !Number.isInteger(profile.householdSize) ||
    profile.householdSize < 1 ||
    profile.householdSize > 30
  ) {
    errors.push('Household size must be a whole number between 1 and 30.');
  }
  if (!profile.filtration || !VALID_FILTRATIONS.has(profile.filtration)) {
    errors.push('Invalid indoor filtration selection.');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates numeric air-quality pollutant values before use in recommendations.
 * Rejects NaN, negative values, or physically impossible spikes.
 */
export function validatePollutantValue(
  value: unknown,
  maxAllowed: number
): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (value < 0 || value > maxAllowed) return null;
  return Math.round(value * 10) / 10;
}

export function validateAirQualityReading(reading: AirQualityReading): {
  valid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];

  if (reading.aqi === null || !Number.isFinite(reading.aqi) || reading.aqi < 0 || reading.aqi > 500) {
    warnings.push('AQI reading is missing or outside the valid 0–500 US EPA scale.');
  }
  if (reading.pm25 === null || !Number.isFinite(reading.pm25) || reading.pm25 < 0) {
    warnings.push('PM2.5 concentration is unavailable or invalid.');
  }
  if (reading.pm10 === null || !Number.isFinite(reading.pm10) || reading.pm10 < 0) {
    warnings.push('PM10 concentration is unavailable or invalid.');
  }
  if (reading.isStale) {
    warnings.push('Environmental data is stale (older than 3 hours) and may not reflect current smog conditions.');
  }
  if (reading.hasSourceConflict && reading.sourceConflictNote) {
    warnings.push(reading.sourceConflictNote);
  }

  const valid = reading.aqi !== null && reading.aqi >= 0 && reading.aqi <= 500;
  return { valid, warnings };
}

/**
 * Validates AI-generated structured responses before displaying them in the UI,
 * preventing malformed payloads or unsupported houseplant/medical claims from slipping through.
 */
export function validateDailyPlanAiResponse(payload: unknown): DailyActionPlanResult | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const obj = payload as Partial<DailyActionPlanResult>;
  if (typeof obj.summary !== 'string' || !obj.summary.trim()) return null;
  if (!Array.isArray(obj.recommendations) || obj.recommendations.length === 0) return null;

  for (const rec of obj.recommendations) {
    if (
      typeof rec !== 'object' ||
      rec === null ||
      typeof rec.activity !== 'string' ||
      typeof rec.suggestedAction !== 'string' ||
      typeof rec.whySuggested !== 'string' ||
      typeof rec.directBenefit !== 'string' ||
      typeof rec.assumptionsAndLimitations !== 'string'
    ) {
      return null;
    }
  }

  return {
    summary: sanitizeUserText(obj.summary, 600),
    source: obj.source ?? 'Gemini AI + Air Action Engine',
    isDataComplete: Boolean(obj.isDataComplete ?? true),
    missingDataWarnings: Array.isArray(obj.missingDataWarnings)
      ? obj.missingDataWarnings.map((w) => sanitizeUserText(String(w), 240))
      : [],
    recommendations: obj.recommendations.map((rec, idx) => ({
      id: rec.id || `ai-rec-${idx}`,
      timeBlock:
        rec.timeBlock === 'Morning' || rec.timeBlock === 'Afternoon' || rec.timeBlock === 'Evening'
          ? rec.timeBlock
          : idx === 0
            ? 'Morning'
            : idx === 1
              ? 'Afternoon'
              : 'Evening',
      timeWindow: sanitizeUserText(rec.timeWindow || 'Scheduled Window', 60),
      priorityRank: typeof rec.priorityRank === 'number' ? rec.priorityRank : idx + 1,
      activity: sanitizeUserText(rec.activity, 140),
      suggestedAction: sanitizeUserText(rec.suggestedAction, 360),
      whySuggested: sanitizeUserText(rec.whySuggested, 360),
      directBenefit: sanitizeUserText(rec.directBenefit, 260),
      benefitDimension: rec.benefitDimension || 'Personal Exposure',
      assumptionsAndLimitations: sanitizeUserText(rec.assumptionsAndLimitations, 260),
      confidence: rec.confidence || 'Moderate',
    })),
    publicHealthAdvisory: sanitizeUserText(
      obj.publicHealthAdvisory ||
        'Follow official municipal air-quality and public-health advisories when AQI is elevated.',
      300
    ),
    generatedAt: obj.generatedAt || new Date().toISOString(),
  };
}

export function validateIndoorGuideAiResponse(payload: unknown): IndoorGuideResult | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const obj = payload as Partial<IndoorGuideResult>;
  if (
    typeof obj.overallAssessment !== 'string' ||
    !obj.overallAssessment.trim() ||
    !Array.isArray(obj.actions) ||
    obj.actions.length === 0
  ) {
    return null;
  }

  const validCategories = new Set([
    'Ventilation Timing',
    'Source Reduction',
    'Filtration Guidance',
    'Cleaner Cooking',
    'Room-Specific Action',
  ]);

  const cleanActions: IndoorGuideResult['actions'] = [];
  for (const item of obj.actions) {
    if (
      typeof item !== 'object' ||
      item === null ||
      typeof item.suggestedAction !== 'string' ||
      typeof item.whySuggested !== 'string' ||
      typeof item.directBenefit !== 'string'
    ) {
      return null;
    }
    const category =
      typeof item.category === 'string' && validCategories.has(item.category)
        ? (item.category as IndoorGuideResult['actions'][number]['category'])
        : 'Room-Specific Action';

    cleanActions.push({
      category,
      suggestedAction: sanitizeUserText(item.suggestedAction, 360),
      whySuggested: sanitizeUserText(item.whySuggested, 320),
      directBenefit: sanitizeUserText(item.directBenefit, 260),
      benefitDimension: item.benefitDimension || 'Indoor Air Quality',
      assumptionsAndLimitations: sanitizeUserText(
        typeof item.assumptionsAndLimitations === 'string'
          ? item.assumptionsAndLimitations
          : 'Actual indoor PM2.5 depends on building leakage, cooking ventilation, and filter CADR.',
        260
      ),
    });
  }

  const rawPlantNote =
    typeof obj.houseplantEvidenceNote === 'string' ? sanitizeUserText(obj.houseplantEvidenceNote, 420) : '';
  const safePlantNote = /cannot|not\s+clean|do\s+not/i.test(rawPlantNote)
    ? rawPlantNote
    : 'Scientific Evidence on Houseplants: Houseplants alone cannot meaningfully clean polluted indoor air during winter smog; use mechanical HEPA/MERV-13 filtration, source control, and smart ventilation timing instead.';

  return {
    overallAssessment: sanitizeUserText(obj.overallAssessment, 500),
    indoorVsOutdoorWarning: sanitizeUserText(
      typeof obj.indoorVsOutdoorWarning === 'string' && obj.indoorVsOutdoorWarning.trim()
        ? obj.indoorVsOutdoorWarning
        : 'Indoor air is not automatically cleaner than outdoor air; unvented gas cooking, frying, and smoke can spike indoor particulates above outdoor levels.',
      420
    ),
    ventilationTimingGuidance: sanitizeUserText(
      typeof obj.ventilationTimingGuidance === 'string' && obj.ventilationTimingGuidance.trim()
        ? obj.ventilationTimingGuidance
        : 'Keep exterior windows sealed during peak smog inversions and only ventilate briefly when outdoor AQI drops.',
      420
    ),
    actions: cleanActions,
    houseplantEvidenceNote: safePlantNote,
    unknownDataWarnings: Array.isArray(obj.unknownDataWarnings)
      ? obj.unknownDataWarnings.slice(0, 8).map((w) => sanitizeUserText(String(w), 240))
      : [],
    generatedAt: typeof obj.generatedAt === 'string' ? obj.generatedAt : new Date().toISOString(),
  };
}

export function validateLowEmissionAiResponse(payload: unknown): LowEmissionPlanResult | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const obj = payload as Partial<LowEmissionPlanResult>;
  if (
    typeof obj.keyDistinctionSummary !== 'string' ||
    !obj.keyDistinctionSummary.trim() ||
    !Array.isArray(obj.options) ||
    obj.options.length === 0
  ) {
    return null;
  }

  const validFeasibilities = new Set([
    'Recommended Today',
    'Conditional — Check Window',
    'Not Advisable Under Current AQI',
  ]);

  const cleanOptions: LowEmissionPlanResult['options'] = [];
  for (const opt of obj.options) {
    if (
      typeof opt !== 'object' ||
      opt === null ||
      typeof opt.mode !== 'string' ||
      typeof opt.suggestedAction !== 'string' ||
      typeof opt.personalExposureOutcome !== 'string' ||
      typeof opt.communityEmissionOutcome !== 'string'
    ) {
      return null;
    }

    cleanOptions.push({
      mode: sanitizeUserText(opt.mode, 100),
      feasibility:
        typeof opt.feasibility === 'string' && validFeasibilities.has(opt.feasibility)
          ? (opt.feasibility as LowEmissionPlanResult['options'][number]['feasibility'])
          : 'Conditional — Check Window',
      suggestedAction: sanitizeUserText(opt.suggestedAction, 340),
      whySuggested: sanitizeUserText(typeof opt.whySuggested === 'string' ? opt.whySuggested : '', 300),
      personalExposureOutcome: sanitizeUserText(opt.personalExposureOutcome, 300),
      communityEmissionOutcome: sanitizeUserText(opt.communityEmissionOutcome, 300),
      distinctionNote: sanitizeUserText(
        typeof opt.distinctionNote === 'string'
          ? opt.distinctionNote
          : 'Personal exposure reduction and community emission reduction are distinct outcomes.',
        280
      ),
      assumptionsAndLimitations: sanitizeUserText(
        typeof opt.assumptionsAndLimitations === 'string' ? opt.assumptionsAndLimitations : 'Depends on local infrastructure.',
        260
      ),
    });
  }

  return {
    keyDistinctionSummary: sanitizeUserText(obj.keyDistinctionSummary, 550),
    currentConditionSummary: sanitizeUserText(
      typeof obj.currentConditionSummary === 'string' ? obj.currentConditionSummary : '',
      420
    ),
    options: cleanOptions,
    generatedAt: typeof obj.generatedAt === 'string' ? obj.generatedAt : new Date().toISOString(),
  };
}

export function validateFamilyPlanAiResponse(payload: unknown): FamilyActionPlanResult | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const obj = payload as Partial<FamilyActionPlanResult>;
  if (
    typeof obj.householdSummary !== 'string' ||
    !obj.householdSummary.trim() ||
    !Array.isArray(obj.individualRoutines) ||
    obj.individualRoutines.length === 0
  ) {
    return null;
  }

  const cleanRoutines: FamilyActionPlanResult['individualRoutines'] = [];
  for (const r of obj.individualRoutines) {
    if (
      typeof r !== 'object' ||
      r === null ||
      typeof r.memberName !== 'string' ||
      typeof r.suggestedAction !== 'string'
    ) {
      return null;
    }
    cleanRoutines.push({
      memberName: sanitizeUserText(r.memberName, 60),
      role: sanitizeUserText(typeof r.role === 'string' ? r.role : 'Household Member', 80),
      suggestedAction: sanitizeUserText(r.suggestedAction, 340),
      whySuggested: sanitizeUserText(typeof r.whySuggested === 'string' ? r.whySuggested : '', 280),
      benefitDimension: r.benefitDimension || 'Personal Exposure',
    });
  }

  const cleanShared: FamilyActionPlanResult['sharedActivities'] = Array.isArray(obj.sharedActivities)
    ? obj.sharedActivities
        .filter((s) => typeof s === 'object' && s !== null && typeof s.activity === 'string')
        .slice(0, 10)
        .map((s) => ({
          activity: sanitizeUserText(s.activity, 100),
          plan: sanitizeUserText(typeof s.plan === 'string' ? s.plan : '', 300),
          benefit: sanitizeUserText(typeof s.benefit === 'string' ? s.benefit : '', 240),
        }))
    : [];

  return {
    householdSummary: sanitizeUserText(obj.householdSummary, 500),
    individualRoutines: cleanRoutines,
    sharedActivities: cleanShared,
    indoorAirPractices: Array.isArray(obj.indoorAirPractices)
      ? obj.indoorAirPractices.slice(0, 8).map((p) => sanitizeUserText(String(p), 260))
      : [],
    sustainableHouseholdChoices: Array.isArray(obj.sustainableHouseholdChoices)
      ? obj.sustainableHouseholdChoices.slice(0, 8).map((c) => sanitizeUserText(String(c), 260))
      : [],
    publicHealthAdvisory: sanitizeUserText(
      typeof obj.publicHealthAdvisory === 'string' && obj.publicHealthAdvisory.trim()
        ? obj.publicHealthAdvisory
        : 'Non-diagnostic household coordination plan. Follow official municipal public-health advisories.',
      300
    ),
    generatedAt: typeof obj.generatedAt === 'string' ? obj.generatedAt : new Date().toISOString(),
  };
}
