import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  AirQualityReading,
  BreatheWisePage,
  CityOption,
  FamilyMember,
  IndoorEnvironmentInput,
  LocationSearchResult,
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
import { useAiEnhancements } from './useAiEnhancements';

const STORAGE_KEY = 'breathewise_workspace_v1';

interface StoredWorkspace {
  profile: UserProfile;
  indoor: IndoorEnvironmentInput;
  family: FamilyMember[];
}

const DEFAULT_WORKSPACE: StoredWorkspace = {
  profile: DEFAULT_USER_PROFILE,
  indoor: DEFAULT_INDOOR_INPUT,
  family: DEFAULT_FAMILY_MEMBERS,
};

function loadStoredWorkspace(): StoredWorkspace {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_WORKSPACE;
    const parsed = JSON.parse(raw) as Partial<StoredWorkspace>;
    return {
      profile: parsed.profile ? { ...DEFAULT_USER_PROFILE, ...parsed.profile } : DEFAULT_USER_PROFILE,
      indoor: parsed.indoor ? { ...DEFAULT_INDOOR_INPUT, ...parsed.indoor } : DEFAULT_INDOOR_INPUT,
      family: Array.isArray(parsed.family) && parsed.family.length > 0 ? parsed.family : DEFAULT_FAMILY_MEMBERS,
    };
  } catch (err: unknown) {
    console.warn('Unable to read saved workspace preferences; restoring defaults.', err instanceof Error ? err.message : '');
    return DEFAULT_WORKSPACE;
  }
}

export function useBreatheWise() {
  const initial = useMemo(() => loadStoredWorkspace(), []);
  const [activePage, setActivePage] = useState<BreatheWisePage>('dashboard');

  // Security: keep HMAC-signed Bearer token strictly in memory (never in localStorage).
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [geminiConfigured, setGeminiConfigured] = useState<boolean>(true);
  const [liveAqiConfigured, setLiveAqiConfigured] = useState<boolean>(true);

  const [cities, setCities] = useState<CityOption[]>(() => AirQualityDataService.listDemoCities());
  const [profile, setProfile] = useState<UserProfile>(initial.profile);
  const [indoor, setIndoor] = useState<IndoorEnvironmentInput>(initial.indoor);
  const [family, setFamily] = useState<FamilyMember[]>(initial.family);
  const [selectedCoords, setSelectedCoords] = useState<{
    state?: string;
    lat?: number;
    lon?: number;
  } | null>(null);

  const [airQuality, setAirQuality] = useState<AirQualityReading>(() =>
    AirQualityDataService.getDemoReading(initial.profile.manualLocationLabel || initial.profile.cityId)
  );
  const [loadingAir, setLoadingAir] = useState<boolean>(false);
  const [airError, setAirError] = useState<string | null>(null);

  const syncTimerRef = useRef<number | null>(null);

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

  const fetchCityTelemetry = useCallback(
    async (
      cityQuery: string,
      opts?: { state?: string; lat?: number; lon?: number }
    ) => {
      const clean = sanitizeLocationInput(cityQuery) || 'New Delhi';
      setLoadingAir(true);
      setAirError(null);
      const res = await breathewiseApiClient.getAirQuality(clean, opts);
      if (res.ok && res.data?.reading) {
        setAirQuality(res.data.reading);
      } else {
        setAirQuality(AirQualityDataService.getDemoReading(clean));
        setAirError(
          res.error || 'Could not reach live environmental feed; showing Demo Mode sample dataset.'
        );
      }
      setLoadingAir(false);
    },
    []
  );

  useEffect(() => {
    let active = true;
    const clean = sanitizeLocationInput(profile.manualLocationLabel.trim() || profile.cityId) || 'New Delhi';

    async function loadTelemetry() {
      const res = await breathewiseApiClient.getAirQuality(clean, selectedCoords ?? undefined);
      if (!active) return;
      if (res.ok && res.data?.reading) {
        setAirQuality(res.data.reading);
        setAirError(null);
      } else {
        setAirQuality(AirQualityDataService.getDemoReading(clean));
        setAirError(
          res.error || 'Could not reach live environmental feed; showing Demo Mode sample dataset.'
        );
      }
    }

    void loadTelemetry();
    return () => {
      active = false;
    };
  }, [profile.cityId, profile.manualLocationLabel, selectedCoords]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ profile, indoor, family })
      );
    } catch (err: unknown) {
      console.warn('Workspace local persistence skipped.', err instanceof Error ? err.message : '');
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

  const ai = useAiEnhancements({
    sessionToken,
    airQuality,
    profile,
    indoor,
    family,
  });

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

  const selectPresetCity = useCallback((cityId: string) => {
    setSelectedCoords(null);
    setProfile((prev) => ({ ...prev, cityId, manualLocationLabel: '' }));
  }, []);

  const selectIndiaLocation = useCallback((loc: LocationSearchResult) => {
    setSelectedCoords({
      state: loc.state,
      lat: loc.latitude,
      lon: loc.longitude,
    });
    setProfile((prev) => ({
      ...prev,
      cityId: loc.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      manualLocationLabel: loc.name,
    }));
  }, []);

  const setManualLocation = useCallback((rawLocation: string) => {
    const clean = sanitizeLocationInput(rawLocation);
    if (!clean) return;
    setSelectedCoords(null);
    setProfile((prev) => ({ ...prev, manualLocationLabel: clean }));
  }, []);

  const updateProfile = useCallback((patch: Partial<UserProfile>) => {
    setProfile((prev) => ({ ...prev, ...patch }));
  }, []);

  const updateIndoor = useCallback((patch: Partial<IndoorEnvironmentInput>) => {
    setIndoor((prev) => ({ ...prev, ...patch }));
  }, []);

  const addFamilyMember = useCallback((member: Omit<FamilyMember, 'id'>) => {
    setFamily((prev) => [...prev, { ...member, id: `fam-${Date.now()}` }]);
    setProfile((prev) => ({ ...prev, householdSize: prev.householdSize + 1 }));
  }, []);

  const removeFamilyMember = useCallback((id: string) => {
    setFamily((prev) => {
      const next = prev.filter((m) => m.id !== id);
      return next.length > 0 ? next : prev;
    });
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
    selectIndiaLocation,
    setManualLocation,
    refreshAirQuality: () =>
      fetchCityTelemetry(
        profile.manualLocationLabel || profile.cityId,
        selectedCoords ?? undefined
      ),
    dailyPlan: ai.aiDailyPlan ?? deterministicDailyPlan,
    indoorGuide: ai.aiIndoorGuide ?? deterministicIndoorGuide,
    lowEmissionPlan: ai.aiLowEmission ?? deterministicLowEmission,
    familyPlan: ai.aiFamilyPlan ?? deterministicFamilyPlan,
    isAiDailyActive: Boolean(ai.aiDailyPlan),
    aiLoading: ai.aiLoading,
    aiNotice: ai.aiNotice,
    enhanceDailyPlanWithGemini: ai.enhanceDailyPlanWithGemini,
    enhanceIndoorGuideWithGemini: ai.enhanceIndoorGuideWithGemini,
    enhanceLowEmissionWithGemini: ai.enhanceLowEmissionWithGemini,
    enhanceFamilyPlanWithGemini: ai.enhanceFamilyPlanWithGemini,
    chatMessages: ai.chatMessages,
    sendChatMessage: ai.sendChatMessage,
    resetChat: ai.resetChat,
  };
}
