import { Router } from 'express';
import type { Response } from 'express';
import type {
  AirQualityReading,
  ChatMessage,
  FamilyMember,
  IndoorEnvironmentInput,
  UserProfile,
} from '../../src/domain/airQualityTypes.ts';
import { RecommendationEngine } from '../../src/services/RecommendationEngine.ts';
import { sanitizeUserText, validateUserProfile } from '../../src/services/validation.ts';
import {
  classifyGeminiError,
  generateGeminiChatReply,
  generateGeminiDailyPlan,
  generateGeminiFamilyPlan,
  generateGeminiIndoorGuide,
  generateGeminiLowEmissionPlan,
} from '../geminiAirService.ts';
import {
  isValidIncomingAirPayload,
  isValidIncomingIndoorPayload,
  rateLimit,
  requireWorkspaceAuth,
} from '../middleware.ts';

/**
 * Shared responder helper eliminating duplicated try/catch/fallback boilerplate across
 * structured Gemini AI routes while keeping error outputs safe and consistent.
 */
async function respondWithGeminiOrFallback<T>(
  res: Response,
  fieldName: 'plan' | 'guide',
  fallbackFieldName: 'fallbackPlan' | 'fallbackGuide',
  runGemini: () => Promise<T | null>,
  buildFallback: () => T
): Promise<void> {
  try {
    const aiResult = await runGemini();
    if (aiResult) {
      res.json({ [fieldName]: aiResult, engine: 'gemini' });
      return;
    }
    res.json({ [fieldName]: buildFallback(), engine: 'deterministic' });
  } catch (err) {
    const safe = classifyGeminiError(err);
    res.status(safe.status).json({
      error: safe.message,
      [fallbackFieldName]: buildFallback(),
    });
  }
}

function buildDeterministicChatFallback(
  question: string,
  air: AirQualityReading,
  profile: UserProfile,
  indoor: IndoorEnvironmentInput
): string {
  const lower = question.toLowerCase();
  const aqiText = air.aqi !== null ? `AQI ${air.aqi} (${air.category})` : 'unavailable AQI';

  if (lower.includes('plant')) {
    return `**Evidence on Houseplants & Smog**\n\nControlled indoor air studies show that houseplants alone cannot meaningfully clean a room during urban winter smog—you would need hundreds of plants per square meter to match a single True-HEPA purifier.\n\n- **What works in ${air.cityName} (${aqiText})**: Seal windows during ${air.peakWindow}, eliminate indoor smoke/frying fumes, and run mechanical HEPA or MERV-13 filtration.\n- **Advisory**: Follow local public-health guidance during high-particulate alerts.`;
  }

  if (lower.includes('window') || lower.includes('ventilat') || lower.includes('cook')) {
    const guide = RecommendationEngine.generateIndoorAirGuide(air, profile, indoor);
    return `**Indoor Air & Ventilation Guidance for ${air.cityName} (${aqiText})**\n\n${guide.ventilationTimingGuidance}\n\n- **Indoor vs. Outdoor Warning**: ${guide.indoorVsOutdoorWarning}\n- **Cooking**: ${guide.actions.find((a) => a.category === 'Cleaner Cooking')?.suggestedAction ?? 'Use an outdoor-vented range hood and cover pots.'}`;
  }

  const plan = RecommendationEngine.generateDailyActionPlan(air, profile);
  return `**Air Action Guidance for ${air.cityName} (${aqiText})**\n\n${plan.summary}\n\n- **Morning**: ${plan.recommendations[0]?.suggestedAction}\n- **Afternoon**: ${plan.recommendations[1]?.suggestedAction}\n- **Evening**: ${plan.recommendations[2]?.suggestedAction}\n\n*Note: ${plan.publicHealthAdvisory}*`;
}

export function createAiRouter(): Router {
  const router = Router();
  const aiRateLimiter = rateLimit('ai', 24, 60_000);

  router.use(requireWorkspaceAuth, aiRateLimiter);

  router.post('/routine', async (req, res) => {
    const { air, profile, forceRefresh } = req.body as {
      air?: unknown;
      profile?: UserProfile;
      forceRefresh?: boolean;
    };
    if (!isValidIncomingAirPayload(air) || !profile || !validateUserProfile(profile).valid) {
      res.status(400).json({ error: 'Valid air quality reading and user profile are required.' });
      return;
    }

    await respondWithGeminiOrFallback(
      res,
      'plan',
      'fallbackPlan',
      () => generateGeminiDailyPlan(air, profile, Boolean(forceRefresh)),
      () => RecommendationEngine.generateDailyActionPlan(air, profile)
    );
  });

  router.post('/indoor', async (req, res) => {
    const { air, profile, indoor } = req.body as {
      air?: unknown;
      profile?: UserProfile;
      indoor?: unknown;
    };
    if (
      !isValidIncomingAirPayload(air) ||
      !profile ||
      !isValidIncomingIndoorPayload(indoor) ||
      !validateUserProfile(profile).valid
    ) {
      res.status(400).json({ error: 'Valid air quality, profile, and indoor settings are required.' });
      return;
    }

    await respondWithGeminiOrFallback(
      res,
      'guide',
      'fallbackGuide',
      () => generateGeminiIndoorGuide(air, profile, indoor),
      () => RecommendationEngine.generateIndoorAirGuide(air, profile, indoor)
    );
  });

  router.post('/alternatives', async (req, res) => {
    const { air, profile } = req.body as {
      air?: unknown;
      profile?: UserProfile;
    };
    if (!isValidIncomingAirPayload(air) || !profile || !validateUserProfile(profile).valid) {
      res.status(400).json({ error: 'Valid air quality and user profile are required.' });
      return;
    }

    await respondWithGeminiOrFallback(
      res,
      'plan',
      'fallbackPlan',
      () => generateGeminiLowEmissionPlan(air, profile),
      () => RecommendationEngine.generateLowEmissionAlternatives(air, profile)
    );
  });

  router.post('/family', async (req, res) => {
    const { air, profile, members } = req.body as {
      air?: unknown;
      profile?: UserProfile;
      members?: FamilyMember[];
    };
    if (
      !isValidIncomingAirPayload(air) ||
      !profile ||
      !Array.isArray(members) ||
      members.length === 0 ||
      !validateUserProfile(profile).valid
    ) {
      res.status(400).json({ error: 'Valid air quality, profile, and family members are required.' });
      return;
    }

    await respondWithGeminiOrFallback(
      res,
      'plan',
      'fallbackPlan',
      () => generateGeminiFamilyPlan(air, profile, members),
      () => RecommendationEngine.generateFamilyActionPlan(air, profile, members)
    );
  });

  router.post('/chat', async (req, res) => {
    const { question, history, air, profile, indoor } = req.body as {
      question?: string;
      history?: ChatMessage[];
      air?: unknown;
      profile?: UserProfile;
      indoor?: unknown;
    };

    const cleanQ = typeof question === 'string' ? sanitizeUserText(question, 500) : '';
    if (
      !cleanQ ||
      !isValidIncomingAirPayload(air) ||
      !profile ||
      !isValidIncomingIndoorPayload(indoor) ||
      !validateUserProfile(profile).valid
    ) {
      res.status(400).json({ error: 'A valid question and air-quality context are required.' });
      return;
    }

    try {
      const result = await generateGeminiChatReply(
        cleanQ,
        Array.isArray(history) ? history : [],
        air,
        profile,
        indoor
      );
      if (result) {
        res.json({
          reply: result.reply,
          contextNote: result.contextNote,
          engine: 'gemini',
        });
        return;
      }

      res.json({
        reply: buildDeterministicChatFallback(cleanQ, air, profile, indoor),
        contextNote: `Engine fallback used for ${air.cityName} (${air.aqi !== null ? `AQI ${air.aqi}` : 'AQI unavailable'}).`,
        engine: 'deterministic',
      });
    } catch (err) {
      const safe = classifyGeminiError(err);
      res.status(safe.status).json({
        error: safe.message,
        fallbackReply: buildDeterministicChatFallback(cleanQ, air, profile, indoor),
      });
    }
  });

  return router;
}
