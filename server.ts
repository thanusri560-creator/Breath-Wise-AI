import 'dotenv/config';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AirQualityDataService } from './src/services/AirQualityDataService.ts';
import { RecommendationEngine } from './src/services/RecommendationEngine.ts';
import { sanitizeUserText, validateUserProfile } from './src/services/validation.ts';
import type {
  AirQualityReading,
  ChatMessage,
  FamilyMember,
  IndoorEnvironmentInput,
  UserProfile,
} from './src/domain/airQualityTypes.ts';
import {
  fetchAirQualityForCity,
  isLiveAqiConfigured,
} from './server/airQualityBackend.ts';
import {
  classifyGeminiError,
  generateGeminiChatReply,
  generateGeminiDailyPlan,
  generateGeminiFamilyPlan,
  generateGeminiIndoorGuide,
  generateGeminiLowEmissionPlan,
  isGeminiConfigured,
} from './server/geminiAirService.ts';
import {
  getWorkspaceRecord,
  issueWorkspaceSession,
  saveWorkspaceRecord,
  verifyWorkspaceToken,
} from './server/sessionStore.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = 3000;

interface AuthenticatedRequest extends Request {
  ownerId?: string;
}

// Lightweight sliding-window rate limiter protecting session issuance and Gemini AI quota
const rateWindows = new Map<string, { count: number; resetAt: number }>();

function rateLimit(bucket: string, maxRequests: number, windowMs: number) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const actor = req.ownerId || req.ip || 'unknown';
    const key = `${bucket}:${actor}`;
    const now = Date.now();
    const entry = rateWindows.get(key);

    if (!entry || entry.resetAt <= now) {
      if (rateWindows.size > 1000) {
        const oldest = rateWindows.keys().next().value;
        if (oldest) rateWindows.delete(oldest);
      }
      rateWindows.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (entry.count >= maxRequests) {
      res.status(429).json({
        error: 'Too many requests in a short window. Please wait a moment before retrying.',
      });
      return;
    }

    entry.count += 1;
    next();
  };
}

function requireWorkspaceAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const ownerId = verifyWorkspaceToken(req.headers.authorization);
  if (!ownerId) {
    res.status(401).json({
      error: 'Authentication required. Initialize a workspace session via /api/session.',
    });
    return;
  }
  req.ownerId = ownerId;
  next();
}

async function createServer() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '512kb' }));

  // Iframe-compatible HTTP security headers (intentionally omits X-Frame-Options for embedded preview)
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=()');
    next();
  });

  // 1. Health & runtime status (never leaks API keys or secrets)
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      app: 'BreatheWise AI',
      geminiConfigured: isGeminiConfigured(),
      liveAqiConfigured: isLiveAqiConfigured(),
      timestamp: new Date().toISOString(),
    });
  });

  // 2. Issue ephemeral HMAC-signed workspace Bearer token (kept in client memory)
  app.post('/api/session', rateLimit('session', 30, 60_000), (_req, res) => {
    const session = issueWorkspaceSession();
    res.json({
      token: session.token,
      issuedAt: new Date().toISOString(),
    });
  });

  // 3. Owner-isolated user profile, indoor & household persistence
  app.get('/api/profile', requireWorkspaceAuth, (req: AuthenticatedRequest, res) => {
    const record = getWorkspaceRecord(req.ownerId as string);
    res.json({ record });
  });

  app.put('/api/profile', requireWorkspaceAuth, (req: AuthenticatedRequest, res) => {
    const body = req.body as {
      profile?: UserProfile;
      indoor?: IndoorEnvironmentInput;
      family?: FamilyMember[];
    };
    if (!body?.profile || !body?.indoor || !Array.isArray(body?.family)) {
      res.status(400).json({ error: 'Profile, indoor environment, and family payload are required.' });
      return;
    }

    const result = saveWorkspaceRecord(req.ownerId as string, {
      profile: body.profile,
      indoor: body.indoor,
      family: body.family,
    });

    if (!result.ok) {
      res.status(400).json({ error: result.errors.join(' ') });
      return;
    }

    res.json({ record: result.record });
  });

  // 4. Environmental Data API (Demo presets + optional server-side WAQI live feed)
  app.get('/api/cities', (_req, res) => {
    res.json({
      cities: AirQualityDataService.listDemoCities(),
      liveAqiConfigured: isLiveAqiConfigured(),
    });
  });

  app.get('/api/air-quality', async (req, res) => {
    const cityParam = typeof req.query.city === 'string' ? req.query.city : 'new-delhi';
    const reading = await fetchAirQualityForCity(cityParam);
    res.json({ reading });
  });

  // 5. Auth-protected & rate-limited Server-Side Gemini AI Endpoints with Deterministic Engine Fallback
  const aiRateLimiter = rateLimit('ai', 24, 60_000);

  app.post('/api/ai/routine', requireWorkspaceAuth, aiRateLimiter, async (req, res) => {
    const { air, profile, forceRefresh } = req.body as {
      air?: AirQualityReading;
      profile?: UserProfile;
      forceRefresh?: boolean;
    };
    if (!air || !profile || !validateUserProfile(profile).valid) {
      res.status(400).json({ error: 'Valid air quality reading and user profile are required.' });
      return;
    }

    try {
      const aiPlan = await generateGeminiDailyPlan(air, profile, Boolean(forceRefresh));
      if (aiPlan) {
        res.json({ plan: aiPlan, engine: 'gemini' });
        return;
      }
      const fallback = RecommendationEngine.generateDailyActionPlan(air, profile);
      res.json({ plan: fallback, engine: 'deterministic' });
    } catch (err) {
      const safe = classifyGeminiError(err);
      const fallback = RecommendationEngine.generateDailyActionPlan(air, profile);
      res.status(safe.status).json({
        error: safe.message,
        fallbackPlan: fallback,
      });
    }
  });

  app.post('/api/ai/indoor', requireWorkspaceAuth, aiRateLimiter, async (req, res) => {
    const { air, profile, indoor } = req.body as {
      air?: AirQualityReading;
      profile?: UserProfile;
      indoor?: IndoorEnvironmentInput;
    };
    if (!air || !profile || !indoor || !validateUserProfile(profile).valid) {
      res.status(400).json({ error: 'Valid air quality, profile, and indoor settings are required.' });
      return;
    }

    try {
      const aiGuide = await generateGeminiIndoorGuide(air, profile, indoor);
      if (aiGuide) {
        res.json({ guide: aiGuide, engine: 'gemini' });
        return;
      }
      const fallback = RecommendationEngine.generateIndoorAirGuide(air, profile, indoor);
      res.json({ guide: fallback, engine: 'deterministic' });
    } catch (err) {
      const safe = classifyGeminiError(err);
      const fallback = RecommendationEngine.generateIndoorAirGuide(air, profile, indoor);
      res.status(safe.status).json({
        error: safe.message,
        fallbackGuide: fallback,
      });
    }
  });

  app.post('/api/ai/alternatives', requireWorkspaceAuth, aiRateLimiter, async (req, res) => {
    const { air, profile } = req.body as {
      air?: AirQualityReading;
      profile?: UserProfile;
    };
    if (!air || !profile || !validateUserProfile(profile).valid) {
      res.status(400).json({ error: 'Valid air quality and user profile are required.' });
      return;
    }

    try {
      const aiPlan = await generateGeminiLowEmissionPlan(air, profile);
      if (aiPlan) {
        res.json({ plan: aiPlan, engine: 'gemini' });
        return;
      }
      const fallback = RecommendationEngine.generateLowEmissionAlternatives(air, profile);
      res.json({ plan: fallback, engine: 'deterministic' });
    } catch (err) {
      const safe = classifyGeminiError(err);
      const fallback = RecommendationEngine.generateLowEmissionAlternatives(air, profile);
      res.status(safe.status).json({
        error: safe.message,
        fallbackPlan: fallback,
      });
    }
  });

  app.post('/api/ai/family', requireWorkspaceAuth, aiRateLimiter, async (req, res) => {
    const { air, profile, members } = req.body as {
      air?: AirQualityReading;
      profile?: UserProfile;
      members?: FamilyMember[];
    };
    if (!air || !profile || !Array.isArray(members) || !validateUserProfile(profile).valid) {
      res.status(400).json({ error: 'Valid air quality, profile, and family members are required.' });
      return;
    }

    try {
      const aiPlan = await generateGeminiFamilyPlan(air, profile, members);
      if (aiPlan) {
        res.json({ plan: aiPlan, engine: 'gemini' });
        return;
      }
      const fallback = RecommendationEngine.generateFamilyActionPlan(air, profile, members);
      res.json({ plan: fallback, engine: 'deterministic' });
    } catch (err) {
      const safe = classifyGeminiError(err);
      const fallback = RecommendationEngine.generateFamilyActionPlan(air, profile, members);
      res.status(safe.status).json({
        error: safe.message,
        fallbackPlan: fallback,
      });
    }
  });

  app.post('/api/ai/chat', requireWorkspaceAuth, aiRateLimiter, async (req, res) => {
    const { question, history, air, profile, indoor } = req.body as {
      question?: string;
      history?: ChatMessage[];
      air?: AirQualityReading;
      profile?: UserProfile;
      indoor?: IndoorEnvironmentInput;
    };

    const cleanQ = typeof question === 'string' ? sanitizeUserText(question, 500) : '';
    if (!cleanQ || !air || !profile || !indoor || !validateUserProfile(profile).valid) {
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

      const fallbackReply = buildDeterministicChatFallback(cleanQ, air, profile, indoor);
      res.json({
        reply: fallbackReply,
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

  // Safe JSON error handler (never leaks stack traces or secrets)
  app.use((_err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({
      error: 'An unexpected server error occurred. Please try again.',
    });
  });

  // Vite dev middleware or production static assets
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`BreatheWise AI server running on http://0.0.0.0:${PORT}`);
  });
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

createServer().catch((err) => {
  console.error('Failed to start BreatheWise AI server:', err instanceof Error ? err.message : 'Unknown error');
  process.exit(1);
});
