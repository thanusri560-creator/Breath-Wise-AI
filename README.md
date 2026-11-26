# BreatheWise AI — Urban Air Quality Assistant

BreatheWise AI is a full-stack React, TypeScript, Express, and Gemini (`@google/genai`) web application that helps urban residents, commuters, and households interpret real-time air quality anywhere in India, protect indoor air, choose realistic low-emission daily alternatives, and stress-test lifestyle changes with a Mid-Flight What-If Simulator.

## Key Capabilities

- **Live All-India Air Quality & Meteorology**: Dynamic location search across Indian cities, towns, and districts via Open-Meteo Geocoding, Air Quality (US EPA AQI, PM2.5, PM10, NO₂, O₃, diurnal forecast curve), and Meteorology APIs, with optional WAQI station override and clearly labeled Demo Mode fallback.
- **Deterministic Air Action Engine + Gemini AI**: Instant, zero-latency Morning/Afternoon/Evening action plans, Indoor Air Quality Guides, Low-Emission Alternatives, and Household Plans — optionally enhanced on demand via server-side Gemini structured JSON generation and contextual Markdown Q&A.
- **Scientific & Health Integrity**: Clearly separates personal exposure reduction from community emission reduction, warns that indoor air is not automatically cleaner than outdoor air, notes that houseplants alone cannot clean smog, and provides non-diagnostic public-health guidance.
- **Mid-Flight What-If Simulator & Impact Explorer**: Real-time emission-factor modeling with uncertainty bands, conflict detection between preferences and severe smog conditions, and an accessible review-and-accept workflow.
- **WCAG 2.2 AA Accessibility**: Keyboard focus-trapped modals, ARIA 1.2 combobox with active-option tracking, linked onboarding tab panels, accessible data tables alongside charts, and polite live-region announcements.

## Architecture

```text
server.ts                     Express entry point (dev Vite middleware + Cloud Run static dist)
server/
  middleware.ts               Security headers, sliding-window rate limiter, HMAC auth middleware
  sessionStore.ts             Ephemeral HMAC-signed Bearer tokens & owner-isolated workspace store
  airQualityBackend.ts        All-India location search & Open-Meteo live AQI/weather fetcher
  waqiProvider.ts             Optional WAQI station provider
  geminiSchemas.ts            Gemini safety instructions, JSON schemas, context compactors
  geminiAirService.ts         Server-side Gemini API orchestrator with TTL caching & timeouts
  routes/aiRoutes.ts          Auth-protected /api/ai/* endpoints with deterministic fallback
src/
  domain/airQualityTypes.ts   Strict TypeScript domain models
  data/                       Default profiles, emission presets, and 15 Demo Mode city templates
  services/                   US EPA AQI math, RecommendationEngine, ImpactCalculationService,
                              WhatIfSimulationService, meteorologyUtils, shared validation
  hooks/                      useBreatheWise workspace state & useAiEnhancements
  components/                 Modular, accessible React UI views and controls
  testing/                    44 automated unit, integration, edge-case, and stress tests
```

## Environment Variables

Copy `.env.example` to `.env` for local development:

- `GEMINI_API_KEY` *(optional for local fallback; required for live Gemini enhancements)* — Server-side Gemini API key (never exposed to browser bundles).
- `WAQI_API_TOKEN` *(optional)* — World Air Quality Index token if you prefer WAQI station feeds over Open-Meteo.
- `PORT` *(optional, default `3000`)* — Server listening port (automatically supplied by Cloud Run).

## Scripts

```bash
npm run dev      # Start full-stack dev server (Express + Vite on port 3000)
npm run build    # Build optimized production client bundle in dist/
npm start        # Run production server (node server.ts)
npm run lint     # Run strict TypeScript typecheck + ESLint static analysis
npm test         # Execute all 44 automated unit, integration, edge-case & stress tests
```
