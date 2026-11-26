import type {
  AirQualityReading,
  ChatMessage,
  CityOption,
  DailyActionPlanResult,
  FamilyActionPlanResult,
  FamilyMember,
  IndoorEnvironmentInput,
  IndoorGuideResult,
  LocationSearchResult,
  LowEmissionPlanResult,
  UserProfile,
} from '../domain/airQualityTypes';

export interface HealthResponse {
  status: string;
  app: string;
  geminiConfigured: boolean;
  liveAqiConfigured: boolean;
  timestamp: string;
}

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
}

async function fetchJson<T>(
  url: string,
  options: RequestInit = {},
  token?: string | null
): Promise<ApiResult<T>> {
  try {
    const headers = new Headers(options.headers);
    if (options.body && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const res = await fetch(url, { ...options, headers });
    const parsed = (await res.json().catch(() => ({}))) as T & { error?: string };

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        data: parsed,
        error: parsed.error || `Request failed (${res.status})`,
      };
    }

    return { ok: true, status: res.status, data: parsed };
  } catch (err: unknown) {
    const detail = err instanceof Error && err.name === 'AbortError'
      ? 'Request timed out. Offline deterministic engine remains active.'
      : 'Unable to reach BreatheWise AI server. Offline deterministic engine remains active.';
    return {
      ok: false,
      status: 0,
      error: detail,
    };
  }
}

export const breathewiseApiClient = {
  getHealth() {
    return fetchJson<HealthResponse>('/api/health');
  },

  createSession() {
    return fetchJson<{ token: string; issuedAt: string }>('/api/session', {
      method: 'POST',
    });
  },

  getCities() {
    return fetchJson<{ cities: CityOption[]; liveAqiConfigured: boolean }>('/api/cities');
  },

  searchIndiaLocations(query: string) {
    return fetchJson<{ results: LocationSearchResult[] }>(
      `/api/locations/search?q=${encodeURIComponent(query)}`
    );
  },

  getAirQuality(
    city: string,
    opts?: { state?: string; lat?: number; lon?: number }
  ) {
    const params = new URLSearchParams({ city });
    if (opts?.state) params.set('state', opts.state);
    if (typeof opts?.lat === 'number' && typeof opts?.lon === 'number') {
      params.set('lat', String(opts.lat));
      params.set('lon', String(opts.lon));
    }
    return fetchJson<{ reading: AirQualityReading }>(
      `/api/air-quality?${params.toString()}`
    );
  },

  saveWorkspace(
    token: string,
    payload: {
      profile: UserProfile;
      indoor: IndoorEnvironmentInput;
      family: FamilyMember[];
    }
  ) {
    return fetchJson<{ record: { updatedAt: string } }>(
      '/api/profile',
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      },
      token
    );
  },

  generateDailyPlanAi(
    token: string,
    air: AirQualityReading,
    profile: UserProfile,
    forceRefresh = false
  ) {
    return fetchJson<{
      plan?: DailyActionPlanResult;
      fallbackPlan?: DailyActionPlanResult;
      engine?: string;
    }>(
      '/api/ai/routine',
      {
        method: 'POST',
        body: JSON.stringify({ air, profile, forceRefresh }),
      },
      token
    );
  },

  generateIndoorGuideAi(
    token: string,
    air: AirQualityReading,
    profile: UserProfile,
    indoor: IndoorEnvironmentInput
  ) {
    return fetchJson<{
      guide?: IndoorGuideResult;
      fallbackGuide?: IndoorGuideResult;
      engine?: string;
    }>(
      '/api/ai/indoor',
      {
        method: 'POST',
        body: JSON.stringify({ air, profile, indoor }),
      },
      token
    );
  },

  generateLowEmissionAi(
    token: string,
    air: AirQualityReading,
    profile: UserProfile
  ) {
    return fetchJson<{
      plan?: LowEmissionPlanResult;
      fallbackPlan?: LowEmissionPlanResult;
      engine?: string;
    }>(
      '/api/ai/alternatives',
      {
        method: 'POST',
        body: JSON.stringify({ air, profile }),
      },
      token
    );
  },

  generateFamilyPlanAi(
    token: string,
    air: AirQualityReading,
    profile: UserProfile,
    members: FamilyMember[]
  ) {
    return fetchJson<{
      plan?: FamilyActionPlanResult;
      fallbackPlan?: FamilyActionPlanResult;
      engine?: string;
    }>(
      '/api/ai/family',
      {
        method: 'POST',
        body: JSON.stringify({ air, profile, members }),
      },
      token
    );
  },

  sendChatQuestion(
    token: string,
    payload: {
      question: string;
      history: ChatMessage[];
      air: AirQualityReading;
      profile: UserProfile;
      indoor: IndoorEnvironmentInput;
    }
  ) {
    return fetchJson<{
      reply?: string;
      fallbackReply?: string;
      contextNote?: string;
      engine?: string;
    }>(
      '/api/ai/chat',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      token
    );
  },
};
