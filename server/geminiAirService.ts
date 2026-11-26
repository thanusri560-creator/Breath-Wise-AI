import crypto from 'node:crypto';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';
import type { Schema } from '@google/genai';
import type {
  AirQualityReading,
  ChatMessage,
  DailyActionPlanResult,
  FamilyActionPlanResult,
  FamilyMember,
  IndoorEnvironmentInput,
  IndoorGuideResult,
  LowEmissionPlanResult,
  UserProfile,
} from '../src/domain/airQualityTypes.ts';
import {
  sanitizeUserText,
  validateDailyPlanAiResponse,
  validateFamilyPlanAiResponse,
  validateIndoorGuideAiResponse,
  validateLowEmissionAiResponse,
} from '../src/services/validation.ts';
import {
  classifyGeminiError,
  compactAirContext,
  compactProfileContext,
  DAILY_PLAN_SCHEMA,
  FAMILY_PLAN_SCHEMA,
  INDOOR_GUIDE_SCHEMA,
  LOW_EMISSION_SCHEMA,
  SYSTEM_SAFETY_RULES,
  type SafeAiError,
} from './geminiSchemas.ts';

export { classifyGeminiError, type SafeAiError };

const GEMINI_MODEL = 'gemini-4-hydrogen';
const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const aiCache = new Map<string, CacheEntry<unknown>>();

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim().length < 8) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export function isGeminiConfigured(): boolean {
  return getGeminiClient() !== null;
}

function makeCacheKey(prefix: string, payload: unknown): string {
  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify(payload))
    .digest('hex')
    .slice(0, 20);
  return `${prefix}:${hash}`;
}

function readCache<T>(key: string): T | null {
  const entry = aiCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    aiCache.delete(key);
    return null;
  }
  return entry.value as T;
}

function writeCache<T>(key: string, value: T): void {
  if (aiCache.size > 150) {
    const oldest = aiCache.keys().next().value;
    if (oldest) aiCache.delete(oldest);
  }
  aiCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

async function callWithTimeout<T>(promise: Promise<T>, timeoutMs = 20000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('Gemini request timeout')), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Shared structured-JSON Gemini executor with TTL caching, timeout protection,
 * and strict post-response schema validation.
 */
async function generateStructuredJson<T>(options: {
  cachePrefix: string;
  cachePayload: unknown;
  forceRefresh?: boolean;
  prompt: string;
  schema: Schema;
  validate: (parsed: Record<string, unknown>) => T | null;
}): Promise<T | null> {
  const ai = getGeminiClient();
  if (!ai) return null;

  const cacheKey = makeCacheKey(options.cachePrefix, options.cachePayload);
  if (!options.forceRefresh) {
    const cached = readCache<T>(cacheKey);
    if (cached) return cached;
  }

  const response = await callWithTimeout(
    ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: options.prompt,
      config: {
        systemInstruction: SYSTEM_SAFETY_RULES,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: options.schema,
      },
    })
  );

  if (!response.text) return null;
  const parsed: unknown = JSON.parse(response.text);
  const record = typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
  const validated = options.validate(record);

  if (validated) writeCache(cacheKey, validated);
  return validated;
}

export async function generateGeminiDailyPlan(
  air: AirQualityReading,
  profile: UserProfile,
  forceRefresh = false
): Promise<DailyActionPlanResult | null> {
  const airCtx = compactAirContext(air);
  const profCtx = compactProfileContext(profile);

  return generateStructuredJson({
    cachePrefix: 'daily',
    cachePayload: { airCtx, profCtx },
    forceRefresh,
    schema: DAILY_PLAN_SCHEMA,
    prompt: `
Generate a personalized Morning, Afternoon, and Evening Daily Air Action Plan based strictly on the untrusted environmental and user profile JSON below.
Return concise, actionable recommendations with clear What, Why, Direct Benefit, Benefit Dimension, and Assumptions/Limitations.

<untrusted_data>
${JSON.stringify({ air: airCtx, profile: profCtx })}
</untrusted_data>
`.trim(),
    validate: (record) =>
      validateDailyPlanAiResponse({
        ...record,
        source: 'Gemini AI + Air Action Engine',
        isDataComplete: air.aqi !== null && air.pm25 !== null && !air.isStale,
        missingDataWarnings: air.dataLimitations,
        generatedAt: new Date().toISOString(),
      }),
  });
}

export async function generateGeminiIndoorGuide(
  air: AirQualityReading,
  profile: UserProfile,
  indoor: IndoorEnvironmentInput
): Promise<IndoorGuideResult | null> {
  const airCtx = compactAirContext(air);
  const safeIndoor = {
    ventilationHabit: indoor.ventilationHabit,
    cookingPractice: indoor.cookingPractice,
    rangeHood: indoor.rangeHood,
    indoorSmokeSources: indoor.indoorSmokeSources.slice(0, 8).map((s) => sanitizeUserText(s, 50)),
    purifierAvailability: indoor.purifierAvailability,
    roomSize: indoor.roomSize,
    primaryRoom: indoor.primaryRoom,
    indoorMonitorAvailable: indoor.indoorMonitorAvailable,
    profileFiltration: profile.filtration,
  };

  return generateStructuredJson({
    cachePrefix: 'indoor',
    cachePayload: { airCtx, safeIndoor },
    schema: INDOOR_GUIDE_SCHEMA,
    prompt: `
Create an evidence-based Indoor Air Quality Guide for this home.
Include 5 actions covering Ventilation Timing, Source Reduction, Filtration Guidance, Cleaner Cooking, and Room-Specific Action.
Never assume indoor air is cleaner than outdoor air. Explicitly state in houseplantEvidenceNote that houseplants alone cannot clean polluted indoor air.

<untrusted_data>
${JSON.stringify({ air: airCtx, indoor: safeIndoor })}
</untrusted_data>
`.trim(),
    validate: (record) =>
      validateIndoorGuideAiResponse({
        ...record,
        generatedAt: new Date().toISOString(),
      }),
  });
}

export async function generateGeminiLowEmissionPlan(
  air: AirQualityReading,
  profile: UserProfile
): Promise<LowEmissionPlanResult | null> {
  const airCtx = compactAirContext(air);
  const profCtx = compactProfileContext(profile);

  return generateStructuredJson({
    cachePrefix: 'alternatives',
    cachePayload: { airCtx, profCtx },
    schema: LOW_EMISSION_SCHEMA,
    prompt: `
Provide 5 low-emission daily travel and routine alternatives tailored to this city's air quality and user commute.
Explicitly separate personal exposure outcomes from community emission outcomes for every option. Never recommend vigorous outdoor cycling when AQI > 150.

<untrusted_data>
${JSON.stringify({ air: airCtx, profile: profCtx })}
</untrusted_data>
`.trim(),
    validate: (record) =>
      validateLowEmissionAiResponse({
        ...record,
        generatedAt: new Date().toISOString(),
      }),
  });
}

export async function generateGeminiFamilyPlan(
  air: AirQualityReading,
  profile: UserProfile,
  members: FamilyMember[]
): Promise<FamilyActionPlanResult | null> {
  const airCtx = compactAirContext(air);
  const safeMembers = members.slice(0, 12).map((m) => ({
    name: sanitizeUserText(m.name, 50),
    role: sanitizeUserText(m.role, 50),
    ageGroup: m.ageGroup,
    commute: m.commute,
    keyActivities: sanitizeUserText(m.keyActivities, 100),
  }));

  return generateStructuredJson({
    cachePrefix: 'family',
    cachePayload: { airCtx, filtration: profile.filtration, safeMembers },
    schema: FAMILY_PLAN_SCHEMA,
    prompt: `
Create a coordinated Household Air Action Plan covering individual routines for each member, shared activities, indoor air practices, and sustainable household choices.

<untrusted_data>
${JSON.stringify({ air: airCtx, filtration: profile.filtration, members: safeMembers })}
</untrusted_data>
`.trim(),
    validate: (record) =>
      validateFamilyPlanAiResponse({
        ...record,
        generatedAt: new Date().toISOString(),
      }),
  });
}

export async function generateGeminiChatReply(
  question: string,
  history: ChatMessage[],
  air: AirQualityReading,
  profile: UserProfile,
  indoor: IndoorEnvironmentInput
): Promise<{ reply: string; contextNote: string } | null> {
  const ai = getGeminiClient();
  if (!ai) return null;

  const cleanQuestion = sanitizeUserText(question, 500);
  if (!cleanQuestion) return null;

  const recentHistory = history.slice(-6).map((m) => ({
    role: m.role,
    content: sanitizeUserText(m.content, 300),
  }));

  const airCtx = compactAirContext(air);
  const profCtx = compactProfileContext(profile);

  const prompt = `
Answer the user's urban air-quality question clearly in plain, structured Markdown (short paragraphs and bullet points, no raw HTML).
Always mention assumptions/limitations, distinguish personal exposure reduction from community emission reduction when relevant, never claim houseplants clean smog, and never give medical diagnoses.

<untrusted_data>
${JSON.stringify({
  question: cleanQuestion,
  recentHistory,
  air: airCtx,
  profile: profCtx,
  indoor: {
    ventilationHabit: indoor.ventilationHabit,
    cookingPractice: indoor.cookingPractice,
    rangeHood: indoor.rangeHood,
    purifierAvailability: indoor.purifierAvailability,
    indoorMonitorAvailable: indoor.indoorMonitorAvailable,
  },
})}
</untrusted_data>
`.trim();

  const response = await callWithTimeout(
    ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_SAFETY_RULES,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      },
    })
  );

  const replyText = response.text?.trim();
  if (!replyText) return null;

  return {
    reply: replyText,
    contextNote: `Context used: ${airCtx.city} (${airCtx.aqi !== null ? `AQI ${airCtx.aqi}, ${airCtx.category}` : 'AQI unavailable'}${airCtx.isDemo ? ', Demo Mode' : ''}), ${profCtx.lifestyle.replace('_', ' ')} profile, ${profCtx.filtration.replace(/_/g, ' ')}.`,
  };
}
