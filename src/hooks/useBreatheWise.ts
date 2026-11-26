import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  AirQualityReading,
  BreatheWisePage,
  ChatMessage,
  CityOption,
  DailyActionPlanResult,
  FamilyActionPlanResult,
  FamilyMember,
  IndoorEnvironmentInput,
  IndoorGuideResult,
  LowEmissionPlanResult,
  UserProfile,
} from '../domain/airQualityTypes';
import {
  DEFAULT_FAMILY_MEMBERS,
  DEFAULT_INDOOR_INPUT,
  DEFAULT_USER_PROFILE,
} from '../data/breathewiseDefaults';
import { AirQualityDataService } from '../services/AirQualityDataService';
import { RecommendationEngine } from '../services/RecommendationEngine';
import { breathewiseApiClient } from '../services/breathewiseApiClient';
import { sanitizeLocationInput } from '../services/validation';

const STORAGE_KEY = 'breathewise_workspace_v1';

interface StoredWorkspace {
  profile: UserProfile;
  indoor: IndoorEnvironmentInput;
  family: FamilyMember[];
}

function loadStoredWorkspace(): StoredWorkspace {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {
        profile: DEFAULT_USER_PROFILE,
        indoor: DEFAULT_INDOOR_INPUT,
        family: DEFAULT_FAMILY_MEMBERS,
      };
    }
    const parsed = JSON.parse(raw) as Partial<StoredWorkspace>;
    return {
      profile: parsed.profile ? { ...DEFAULT_USER_PROFILE, ...parsed.profile } : DEFAULT_USER_PROFILE,
      indoor: parsed.indoor ? { ...DEFAULT_INDOOR_INPUT, ...parsed.indoor } : DEFAULT_INDOOR_INPUT,
      family: Array.isArray(parsed.family) && parsed.family.length > 0 ? parsed.family : DEFAULT_FAMILY_MEMBERS,
    };
  } catch {
    return {
      profile: DEFAULT_USER_PROFILE,
      indoor: DEFAULT_INDOOR_INPUT,
      family: DEFAULT_FAMILY_MEMBERS,
    };
  }
}

export function useBreatheWise() {
  const initial = useMemo(() => loadStoredWorkspace(), []);
  const [activePage, setActivePage] = useState<BreatheWisePage>('dashboard');

  // Security: keep HMAC-signed Bearer token strictly in memory (never in localStorage).
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [geminiConfigured, setGeminiConfigured] = useState<boolean>(true);
  const [liveAqiConfigured, setLiveAqiConfigured] = useState<boolean>(false);

  const [cities, setCities] = useState<CityOption[]>(() => AirQualityDataService.listDemoCities());
  const [profile, setProfile] = useState<UserProfile>(initial.profile);
  const [indoor, setIndoor] = useState<IndoorEnvironmentInput>(initial.indoor);
  const [family, setFamily] = useState<FamilyMember[]>(initial.family);

  const [airQuality, setAirQuality] = useState<AirQualityReading>(() =>
    AirQualityDataService.getDemoReading(initial.profile.manualLocationLabel || initial.profile.cityId)
  );
  const [loadingAir, setLoadingAir] = useState<boolean>(false);
  const [airError, setAirError] = useState<string | null>(null);

  // Optional Gemini AI overrides (cleared whenever underlying city, profile, or indoor context changes)
  const [aiDailyPlan, setAiDailyPlan] = useState<DailyActionPlanResult | null>(null);
  const [aiIndoorGuide, setAiIndoorGuide] = useState<IndoorGuideResult | null>(null);
  const [aiLowEmission, setAiLowEmission] = useState<LowEmissionPlanResult | null>(null);
  const [aiFamilyPlan, setAiFamilyPlan] = useState<FamilyActionPlanResult | null>(null);

  const [aiLoading, setAiLoading] = useState<Record<string, boolean>>({});
  const [aiNotice, setAiNotice] = useState<Record<string, string | null>>({});

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-msg',
      role: 'assistant',
      content:
        'Welcome to **BreatheWise AI**. Ask any question about today’s urban air quality, indoor ventilation timing, HEPA filtration, cooking fumes, or practical lower-emission travel swaps.\n\n*Guidance is non-diagnostic and tailored to your active city and household profile.*',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);

  const syncTimerRef = useRef<number | null>(null);

  // Bootstrap server session + health + city catalog
  useEffect(() => {
    let active = true;
    async function init() {
      const [healthRes, sessionRes, citiesRes] = await Promise.all([
        breathewiseApiClient.getHealth(),
        breathewiseApiClient.createSession(),
        breathewiseApiClient.getCities(),
      ]);

      if (!active) return;

      if (healthRes.ok && healthRes.data) {
        setGeminiConfigured(healthRes.data.geminiConfigured);
        setLiveAqiConfigured(healthRes.data.liveAqiConfigured);
      }
      if (sessionRes.ok && sessionRes.data?.token) {
        setSessionToken(sessionRes.data.token);
      }
      if (citiesRes.ok && citiesRes.data?.cities) {
        setCities(citiesRes.data.cities);
      }
    }
    void init();
    return () => {
      active = false;
    };
  }, []);

  // Fetch environmental telemetry when active city/location changes
  const fetchCityTelemetry = useCallback(async (cityQuery: string) => {
    const clean = sanitizeLocationInput(cityQuery) || 'new-delhi';
    setLoadingAir(true);
    setAirError(null);
    const res = await breathewiseApiClient.getAirQuality(clean);
    if (res.ok && res.data?.reading) {
      setAirQuality(res.data.reading);
    } else {
      // Fall back to deterministic demo dataset while showing a transparent notice
      setAirQuality(AirQualityDataService.getDemoReading(clean));
      setAirError(res.error || 'Could not reach server environmental feed; showing local Demo Mode dataset.');
    }
    setLoadingAir(false);
  }, []);

  useEffect(() => {
    const query = profile.manualLocationLabel.trim() || profile.cityId;
    void fetchCityTelemetry(query);
  }, [profile.cityId, profile.manualLocationLabel, fetchCityTelemetry]);

  // Persist workspace safely to localStorage + debounced authenticated server sync
  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ profile, indoor, family })
      );
    } catch {
      // Ignore storage quota issues
    }

    if (!sessionToken) return;
    if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
    syncTimerRef.current = window.setTimeout(() => {
      void breathewiseApiClient.saveWorkspace(sessionToken, { profile, indoor, family });
    }, 450);

    return () => {
      if (syncTimerRef.current) window.clearTimeout(syncTimerRef.current);
    };
  }, [profile, indoor, family, sessionToken]);

  // Clear stale AI overrides whenever foundational inputs change so views stay tightly synchronized
  useEffect(() => {
    setAiDailyPlan(null);
    setAiLowEmission(null);
    setAiFamilyPlan(null);
  }, [airQuality.cityName, airQuality.aqi, profile]);

  useEffect(() => {
    setAiIndoorGuide(null);
  }, [airQuality.cityName, airQuality.aqi, indoor, profile.filtration]);

  // Memoized deterministic Air Action Engine outputs (instant zero-latency recalculation)
  const deterministicDailyPlan = useMemo(
    () => RecommendationEngine.generateDailyActionPlan(airQuality, profile),
    [airQuality, profile]
  );

  const deterministicIndoorGuide = useMemo(
    () => RecommendationEngine.generateIndoorAirGuide(airQuality, profile, indoor),
    [airQuality, profile, indoor]
  );

  const deterministicLowEmission = useMemo(
    () => RecommendationEngine.generateLowEmissionAlternatives(airQuality, profile),
    [airQuality, profile]
  );

  const deterministicFamilyPlan = useMemo(
    () => RecommendationEngine.generateFamilyActionPlan(airQuality, profile, family),
    [airQuality, profile, family]
  );

  const activeDailyPlan = aiDailyPlan ?? deterministicDailyPlan;
  const activeIndoorGuide = aiIndoorGuide ?? deterministicIndoorGuide;
  const activeLowEmission = aiLowEmission ?? deterministicLowEmission;
  const activeFamilyPlan = aiFamilyPlan ?? deterministicFamilyPlan;

  // Profile & location mutators
  const selectPresetCity = useCallback((cityId: string) => {
    setProfile((prev) => ({ ...prev, cityId, manualLocationLabel: '' }));
  }, []);

  const setManualLocation = useCallback((rawLocation: string) => {
    const clean = sanitizeLocationInput(rawLocation);
    if (!clean) return;
    setProfile((prev) => ({ ...prev, manualLocationLabel: clean }));
  }, []);

  const updateProfile = useCallback((patch: Partial<UserProfile>) => {
    setProfile((prev) => ({ ...prev, ...patch }));
  }, []);

  const updateIndoor = useCallback((patch: Partial<IndoorEnvironmentInput>) => {
    setIndoor((prev) => ({ ...prev, ...patch }));
  }, []);

  const addFamilyMember = useCallback((member: Omit<FamilyMember, 'id'>) => {
    setFamily((prev) => [
      ...prev,
      { ...member, id: `fam-${Date.now()}` },
    ]);
    setProfile((prev) => ({ ...prev, householdSize: prev.householdSize + 1 }));
  }, []);

  const removeFamilyMember = useCallback((id: string) => {
    setFamily((prev) => {
      const next = prev.filter((m) => m.id !== id);
      return next.length > 0 ? next : prev;
    });
  }, []);

  // Optional Gemini AI enhancement actions (never auto-spam API; user-triggered + server-cached)
  const enhanceDailyPlanWithGemini = useCallback(
    async (forceRefresh = false) => {
      if (!sessionToken) return;
      setAiLoading((s) => ({ ...s, routine: true }));
      setAiNotice((n) => ({ ...n, routine: null }));

      const res = await breathewiseApiClient.generateDailyPlanAi(
        sessionToken,
        airQuality,
        profile,
        forceRefresh
      );

      if (res.ok && res.data?.plan) {
        setAiDailyPlan(res.data.plan);
      } else {
        setAiNotice((n) => ({
          ...n,
          routine: res.error || 'Gemini enhancement unavailable; showing deterministic Air Action Engine plan.',
        }));
      }
      setAiLoading((s) => ({ ...s, routine: false }));
    },
    [sessionToken, airQuality, profile]
  );

  const enhanceIndoorGuideWithGemini = useCallback(async () => {
    if (!sessionToken) return;
    setAiLoading((s) => ({ ...s, indoor: true }));
    setAiNotice((n) => ({ ...n, indoor: null }));

    const res = await breathewiseApiClient.generateIndoorGuideAi(
      sessionToken,
      airQuality,
      profile,
      indoor
    );

    if (res.ok && res.data?.guide) {
      setAiIndoorGuide(res.data.guide);
    } else {
      setAiNotice((n) => ({
        ...n,
        indoor: res.error || 'Gemini indoor synthesis unavailable; showing deterministic guide.',
      }));
    }
    setAiLoading((s) => ({ ...s, indoor: false }));
  }, [sessionToken, airQuality, profile, indoor]);

  const enhanceLowEmissionWithGemini = useCallback(async () => {
    if (!sessionToken) return;
    setAiLoading((s) => ({ ...s, alternatives: true }));
    setAiNotice((n) => ({ ...n, alternatives: null }));

    const res = await breathewiseApiClient.generateLowEmissionAi(
      sessionToken,
      airQuality,
      profile
    );

    if (res.ok && res.data?.plan) {
      setAiLowEmission(res.data.plan);
    } else {
      setAiNotice((n) => ({
        ...n,
        alternatives: res.error || 'Gemini refresh unavailable; showing deterministic comparison.',
      }));
    }
    setAiLoading((s) => ({ ...s, alternatives: false }));
  }, [sessionToken, airQuality, profile]);

  const enhanceFamilyPlanWithGemini = useCallback(async () => {
    if (!sessionToken) return;
    setAiLoading((s) => ({ ...s, family: true }));
    setAiNotice((n) => ({ ...n, family: null }));

    const res = await breathewiseApiClient.generateFamilyPlanAi(
      sessionToken,
      airQuality,
      profile,
      family
    );

    if (res.ok && res.data?.plan) {
      setAiFamilyPlan(res.data.plan);
    } else {
      setAiNotice((n) => ({
        ...n,
        family: res.error || 'Gemini household synthesis unavailable; showing deterministic plan.',
      }));
    }
    setAiLoading((s) => ({ ...s, family: false }));
  }, [sessionToken, airQuality, profile, family]);

  const sendChatMessage = useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      if (!trimmed) return;

      const userMsg: ChatMessage = {
        id: `usr-${Date.now()}`,
        role: 'user',
        content: trimmed,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setChatMessages((prev) => [...prev, userMsg]);
      setAiLoading((s) => ({ ...s, chat: true }));
      setAiNotice((n) => ({ ...n, chat: null }));

      if (!sessionToken) {
        setAiLoading((s) => ({ ...s, chat: false }));
        setAiNotice((n) => ({ ...n, chat: 'Initializing secure workspace session. Please retry in a moment.' }));
        return;
      }

      const res = await breathewiseApiClient.sendChatQuestion(sessionToken, {
        question: trimmed,
        history: chatMessages.slice(-6),
        air: airQuality,
        profile,
        indoor,
      });

      const replyContent =
        res.data?.reply ||
        res.data?.fallbackReply ||
        'BreatheWise AI could not reach Gemini right now. Refer to your Daily Action Plan and local municipal advisories.';

      if (!res.ok && res.error) {
        setAiNotice((n) => ({ ...n, chat: res.error ?? null }));
      }

      const assistantMsg: ChatMessage = {
        id: `ast-${Date.now()}`,
        role: 'assistant',
        content: replyContent,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        contextNote: res.data?.contextNote,
      };

      setChatMessages((prev) => [...prev, assistantMsg]);
      setAiLoading((s) => ({ ...s, chat: false }));
    },
    [sessionToken, chatMessages, airQuality, profile, indoor]
  );

  const resetChat = useCallback(() => {
    setChatMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'assistant',
        content:
          'Conversation cleared. Ask any question about today’s air quality, indoor filtration, or low-emission alternatives.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  }, []);

  return {
    activePage,
    setActivePage,
    geminiConfigured,
    liveAqiConfigured,
    cities,
    profile,
    updateProfile,
    indoor,
    updateIndoor,
    family,
    addFamilyMember,
    removeFamilyMember,
    airQuality,
    loadingAir,
    airError,
    selectPresetCity,
    setManualLocation,
    refreshAirQuality: () => fetchCityTelemetry(profile.manualLocationLabel || profile.cityId),
    dailyPlan: activeDailyPlan,
    indoorGuide: activeIndoorGuide,
    lowEmissionPlan: activeLowEmission,
    familyPlan: activeFamilyPlan,
    isAiDailyActive: Boolean(aiDailyPlan),
    aiLoading,
    aiNotice,
    enhanceDailyPlanWithGemini,
    enhanceIndoorGuideWithGemini,
    enhanceLowEmissionWithGemini,
    enhanceFamilyPlanWithGemini,
    chatMessages,
    sendChatMessage,
    resetChat,
  };
}
