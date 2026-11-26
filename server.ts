import 'dotenv/config';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AirQualityDataService } from './src/services/AirQualityDataService.ts';
import type {
  FamilyMember,
  IndoorEnvironmentInput,
  UserProfile,
} from './src/domain/airQualityTypes.ts';
import {
  fetchAirQualityForCity,
  isLiveAqiConfigured,
  searchIndiaLocations,
} from './server/airQualityBackend.ts';
import { isGeminiConfigured } from './server/geminiAirService.ts';
import {
  rateLimit,
  requireWorkspaceAuth,
  securityHeaders,
  type AuthenticatedRequest,
} from './server/middleware.ts';
import { createAiRouter } from './server/routes/aiRoutes.ts';
import {
  getWorkspaceRecord,
  issueWorkspaceSession,
  saveWorkspaceRecord,
} from './server/sessionStore.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = Number(process.env.PORT) || 3000;

async function createServer() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '512kb' }));
  app.use(securityHeaders);

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

  // 4. Environmental Data & Dynamic All-India Location Search API
  app.get('/api/cities', (_req, res) => {
    res.json({
      cities: AirQualityDataService.listDemoCities(),
      liveAqiConfigured: isLiveAqiConfigured(),
    });
  });

  app.get('/api/locations/search', rateLimit('geo', 60, 60_000), async (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const results = await searchIndiaLocations(q);
    res.json({ results });
  });

  app.get('/api/air-quality', async (req, res) => {
    const cityParam = typeof req.query.city === 'string' ? req.query.city : 'New Delhi';
    const stateParam = typeof req.query.state === 'string' ? req.query.state : undefined;
    const latNum = typeof req.query.lat === 'string' && req.query.lat !== '' ? Number(req.query.lat) : undefined;
    const lonNum = typeof req.query.lon === 'string' && req.query.lon !== '' ? Number(req.query.lon) : undefined;
    const reading = await fetchAirQualityForCity({
      city: cityParam,
      state: stateParam,
      lat: latNum,
      lon: lonNum,
    });
    res.json({ reading });
  });

  // 5. Auth-protected & rate-limited Server-Side Gemini AI Endpoints with Deterministic Fallback
  app.use('/api/ai', createAiRouter());

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

createServer().catch((err) => {
  console.error('Failed to start BreatheWise AI server:', err instanceof Error ? err.message : 'Unknown error');
  process.exit(1);
});
