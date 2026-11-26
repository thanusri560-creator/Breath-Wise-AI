import { useCallback, useMemo, useState } from 'react';
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
} from '../domain/airQualityTypes';
import { breathewiseApiClient, type ApiResult } from '../services/breathewiseApiClient';

interface UseAiEnhancementsParams {
  sessionToken: string | null;
  airQuality: AirQualityReading;
  profile: UserProfile;
  indoor: IndoorEnvironmentInput;
  family: FamilyMember[];
}

interface KeyedAiResult<T> {
  contextKey: string;
  value: T;
}

function formatCurrentTime(): string {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Manages optional on-demand Gemini AI enhancements and interactive Q&A chat,
 * invalidating stale AI outputs immediately via derived context keys without cascading effects.
 */
export function useAiEnhancements({
  sessionToken,
  airQuality,
  profile,
  indoor,
  family,
}: UseAiEnhancementsParams) {
  const routineContextKey = useMemo(
    () => JSON.stringify([airQuality.cityName, airQuality.aqi, profile]),
    [airQuality.cityName, airQuality.aqi, profile]
  );

  const indoorContextKey = useMemo(
    () => JSON.stringify([airQuality.cityName, airQuality.aqi, indoor, profile.filtration]),
    [airQuality.cityName, airQuality.aqi, indoor, profile.filtration]
  );

  const [dailyEntry, setDailyEntry] = useState<KeyedAiResult<DailyActionPlanResult> | null>(null);
  const [indoorEntry, setIndoorEntry] = useState<KeyedAiResult<IndoorGuideResult> | null>(null);
  const [lowEmissionEntry, setLowEmissionEntry] = useState<KeyedAiResult<LowEmissionPlanResult> | null>(null);
  const [familyEntry, setFamilyEntry] = useState<KeyedAiResult<FamilyActionPlanResult> | null>(null);

  const aiDailyPlan = dailyEntry?.contextKey === routineContextKey ? dailyEntry.value : null;
  const aiIndoorGuide = indoorEntry?.contextKey === indoorContextKey ? indoorEntry.value : null;
  const aiLowEmission = lowEmissionEntry?.contextKey === routineContextKey ? lowEmissionEntry.value : null;
  const aiFamilyPlan = familyEntry?.contextKey === routineContextKey ? familyEntry.value : null;

  const [aiLoading, setAiLoading] = useState<Record<string, boolean>>({});
  const [aiNotice, setAiNotice] = useState<Record<string, string | null>>({});

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-msg',
      role: 'assistant',
      content:
        'Welcome to **BreatheWise AI**. Ask any question about today’s urban air quality anywhere in India, indoor ventilation timing, HEPA filtration, cooking fumes, or practical lower-emission travel swaps.\n\n*Guidance is non-diagnostic and tailored to your active city and household profile.*',
      timestamp: formatCurrentTime(),
    },
  ]);

  const runAiTask = useCallback(
    async <TData, TValue>(
      key: string,
      request: (token: string) => Promise<ApiResult<TData>>,
      extract: (data: TData | undefined) => TValue | undefined,
      onSuccess: (value: TValue) => void,
      fallbackNotice: string
    ) => {
      if (!sessionToken) return;
      setAiLoading((s) => ({ ...s, [key]: true }));
      setAiNotice((n) => ({ ...n, [key]: null }));

      const res = await request(sessionToken);
      const value = res.ok ? extract(res.data) : undefined;
      if (value) {
        onSuccess(value);
      } else {
        setAiNotice((n) => ({ ...n, [key]: res.error || fallbackNotice }));
      }
      setAiLoading((s) => ({ ...s, [key]: false }));
    },
    [sessionToken]
  );

  const enhanceDailyPlanWithGemini = useCallback(
    (forceRefresh = false) =>
      runAiTask(
        'routine',
        (token) => breathewiseApiClient.generateDailyPlanAi(token, airQuality, profile, forceRefresh),
        (data) => data?.plan,
        (value) => setDailyEntry({ contextKey: routineContextKey, value }),
        'Gemini enhancement unavailable; showing deterministic Air Action Engine plan.'
      ),
    [runAiTask, airQuality, profile, routineContextKey]
  );

  const enhanceIndoorGuideWithGemini = useCallback(
    () =>
      runAiTask(
        'indoor',
        (token) => breathewiseApiClient.generateIndoorGuideAi(token, airQuality, profile, indoor),
        (data) => data?.guide,
        (value) => setIndoorEntry({ contextKey: indoorContextKey, value }),
        'Gemini indoor synthesis unavailable; showing deterministic guide.'
      ),
    [runAiTask, airQuality, profile, indoor, indoorContextKey]
  );

  const enhanceLowEmissionWithGemini = useCallback(
    () =>
      runAiTask(
        'alternatives',
        (token) => breathewiseApiClient.generateLowEmissionAi(token, airQuality, profile),
        (data) => data?.plan,
        (value) => setLowEmissionEntry({ contextKey: routineContextKey, value }),
        'Gemini refresh unavailable; showing deterministic comparison.'
      ),
    [runAiTask, airQuality, profile, routineContextKey]
  );

  const enhanceFamilyPlanWithGemini = useCallback(
    () =>
      runAiTask(
        'family',
        (token) => breathewiseApiClient.generateFamilyPlanAi(token, airQuality, profile, family),
        (data) => data?.plan,
        (value) => setFamilyEntry({ contextKey: routineContextKey, value }),
        'Gemini household synthesis unavailable; showing deterministic plan.'
      ),
    [runAiTask, airQuality, profile, family, routineContextKey]
  );

  const sendChatMessage = useCallback(
    async (question: string) => {
      const trimmed = question.trim();
      if (!trimmed) return;

      const userMsg: ChatMessage = {
        id: `usr-${Date.now()}`,
        role: 'user',
        content: trimmed,
        timestamp: formatCurrentTime(),
      };

      setChatMessages((prev) => [...prev, userMsg]);
      setAiLoading((s) => ({ ...s, chat: true }));
      setAiNotice((n) => ({ ...n, chat: null }));

      if (!sessionToken) {
        setAiLoading((s) => ({ ...s, chat: false }));
        setAiNotice((n) => ({
          ...n,
          chat: 'Initializing secure workspace session. Please retry in a moment.',
        }));
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
        timestamp: formatCurrentTime(),
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
        timestamp: formatCurrentTime(),
      },
    ]);
  }, []);

  return {
    aiDailyPlan,
    aiIndoorGuide,
    aiLowEmission,
    aiFamilyPlan,
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
