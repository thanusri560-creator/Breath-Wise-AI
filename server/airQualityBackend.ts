import type {
  AirQualityReading,
  LocationSearchResult,
} from '../src/domain/airQualityTypes.ts';
import {
  AirQualityDataService,
  calculateUsEpaAqiFromPm25,
  interpretUsEpaAqiCategory,
} from '../src/services/AirQualityDataService.ts';
import {
  computeDiurnalWindows,
  degreesToCompass,
  extractHourlyCurve,
  weatherCodeToLabel,
  type HourlySeriesPayload,
} from '../src/services/meteorologyUtils.ts';
import {
  assertAllowedExternalUrl,
  sanitizeLocationInput,
  sanitizeUserText,
  validatePollutantValue,
} from '../src/services/validation.ts';
import { fetchLiveWaqiReading, hasWaqiToken } from './waqiProvider.ts';

interface CachedAqiEntry {
  reading: AirQualityReading;
  expiresAt: number;
}

interface CachedSearchEntry {
  results: LocationSearchResult[];
  expiresAt: number;
}

const AQI_CACHE_TTL_MS = 3 * 60 * 1000;
const SEARCH_CACHE_TTL_MS = 10 * 60 * 1000;
const aqiCache = new Map<string, CachedAqiEntry>();
const searchCache = new Map<string, CachedSearchEntry>();

interface OpenMeteoGeoItem {
  id?: number;
  name?: string;
  latitude?: number;
  longitude?: number;
  country?: string;
  country_code?: string;
  admin1?: string;
  admin2?: string;
}

interface OpenMeteoGeoPayload {
  results?: OpenMeteoGeoItem[];
}

interface OpenMeteoAqiPayload {
  current?: {
    time?: string;
    us_aqi?: number;
    pm2_5?: number;
    pm10?: number;
    nitrogen_dioxide?: number;
    ozone?: number;
  };
  hourly?: HourlySeriesPayload;
}

interface OpenMeteoWeatherPayload {
  current?: {
    temperature_2m?: number;
    apparent_temperature?: number;
    relative_humidity_2m?: number;
    surface_pressure?: number;
    wind_speed_10m?: number;
    wind_direction_10m?: number;
    weather_code?: number;
  };
}

// Live keyless Open-Meteo environmental telemetry is available out of the box across all of India
export function isLiveAqiConfigured(): boolean {
  return true;
}

/**
 * Dynamically searches ANY city, town, or district across India using Open-Meteo's
 * allowlisted Geocoding API (HTTPS allowlist verified, sanitized input, 10-minute TTL cache).
 */
export async function searchIndiaLocations(rawQuery: string): Promise<LocationSearchResult[]> {
  const cleanQuery = sanitizeLocationInput(rawQuery);
  if (cleanQuery.length < 2) return [];

  const cacheKey = cleanQuery.toLowerCase();
  const cached = searchCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.results;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const url = assertAllowedExternalUrl(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cleanQuery)}&count=8&countryCode=IN&language=en&format=json`
    );
    const response = await fetch(url.toString(), { signal: controller.signal });
    if (!response.ok) return [];

    const json = (await response.json()) as OpenMeteoGeoPayload;
    const rawItems = Array.isArray(json.results) ? json.results : [];

    const results: LocationSearchResult[] = rawItems
      .filter(
        (item) =>
          typeof item.name === 'string' &&
          typeof item.latitude === 'number' &&
          typeof item.longitude === 'number' &&
          Number.isFinite(item.latitude) &&
          Number.isFinite(item.longitude)
      )
      .map((item) => ({
        id: String(item.id ?? `${item.name}-${item.admin1 ?? 'IN'}`),
        name: sanitizeUserText(item.name as string, 60),
        state: sanitizeUserText(item.admin1 || 'India', 60),
        district: item.admin2 ? sanitizeUserText(item.admin2, 60) : undefined,
        country: sanitizeUserText(item.country || 'India', 40),
        latitude: Math.round((item.latitude as number) * 1000) / 1000,
        longitude: Math.round((item.longitude as number) * 1000) / 1000,
      }));

    if (searchCache.size > 300) {
      const oldest = searchCache.keys().next().value;
      if (oldest) searchCache.delete(oldest);
    }
    searchCache.set(cacheKey, { results, expiresAt: Date.now() + SEARCH_CACHE_TTL_MS });
    return results;
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

export interface DynamicLocationParams {
  city: string;
  state?: string;
  lat?: number;
  lon?: number;
}

/**
 * Retrieves validated live air-quality & meteorology for any location in India (or preset cities).
 * Priority:
 *  1. Optional WAQI live feed when WAQI_API_TOKEN is explicitly set
 *  2. Live Open-Meteo Air Quality + Weather Forecast (real-time across all of India)
 *  3. Clearly labeled Demo Mode fallback only if external network/API fails
 */
export async function fetchAirQualityForCity(
  params: string | DynamicLocationParams
): Promise<AirQualityReading> {
  const normalized: DynamicLocationParams =
    typeof params === 'string' ? { city: params } : params;

  const cleanCity = sanitizeLocationInput(normalized.city) || 'New Delhi';
  const cleanState = normalized.state ? sanitizeLocationInput(normalized.state) : '';
  const hasValidCoords =
    typeof normalized.lat === 'number' &&
    typeof normalized.lon === 'number' &&
    Number.isFinite(normalized.lat) &&
    Number.isFinite(normalized.lon) &&
    normalized.lat >= -90 &&
    normalized.lat <= 90 &&
    normalized.lon >= -180 &&
    normalized.lon <= 180;

  const cacheKey = hasValidCoords
    ? `coords:${normalized.lat!.toFixed(2)},${normalized.lon!.toFixed(2)}:${cleanCity.toLowerCase()}`
    : `city:${cleanCity.toLowerCase()}:${cleanState.toLowerCase()}`;

  const cached = aqiCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.reading;
  }

  let reading: AirQualityReading | null = null;

  if (hasWaqiToken() && !hasValidCoords) {
    reading = await fetchLiveWaqiReading(cleanCity, process.env.WAQI_API_TOKEN as string);
  }

  if (!reading || reading.aqi === null) {
    reading = await fetchLiveOpenMeteoReading(
      cleanCity,
      cleanState,
      hasValidCoords ? normalized.lat : undefined,
      hasValidCoords ? normalized.lon : undefined
    );
  }

  if (!reading) {
    reading = AirQualityDataService.getDemoReading(cleanCity);
  }

  if (aqiCache.size > 250) {
    const firstKey = aqiCache.keys().next().value;
    if (firstKey) aqiCache.delete(firstKey);
  }

  aqiCache.set(cacheKey, { reading, expiresAt: Date.now() + AQI_CACHE_TTL_MS });
  return reading;
}

async function resolveLocationForOpenMeteo(
  city: string,
  state?: string
): Promise<LocationSearchResult | null> {
  const humanQuery = city.replace(/-/g, ' ').trim();
  const indiaMatches = await searchIndiaLocations(humanQuery);

  if (indiaMatches.length > 0) {
    if (state) {
      const stateMatch = indiaMatches.find(
        (m) => m.state.toLowerCase() === state.toLowerCase()
      );
      if (stateMatch) return stateMatch;
    }
    return indiaMatches[0];
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);
  try {
    const url = assertAllowedExternalUrl(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(humanQuery)}&count=1&language=en&format=json`
    );
    const res = await fetch(url.toString(), { signal: controller.signal });
    if (!res.ok) return null;
    const json = (await res.json()) as OpenMeteoGeoPayload;
    const item = json.results?.[0];
    if (!item || typeof item.latitude !== 'number' || typeof item.longitude !== 'number') {
      return null;
    }
    return {
      id: String(item.id ?? humanQuery),
      name: sanitizeUserText(item.name || humanQuery, 60),
      state: sanitizeUserText(item.admin1 || item.country || 'Region', 60),
      district: item.admin2 ? sanitizeUserText(item.admin2, 60) : undefined,
      country: sanitizeUserText(item.country || '', 40),
      latitude: item.latitude,
      longitude: item.longitude,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchLiveOpenMeteoReading(
  city: string,
  state?: string,
  providedLat?: number,
  providedLon?: number
): Promise<AirQualityReading | null> {
  let lat = providedLat;
  let lon = providedLon;
  let resolvedName = city.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  let resolvedRegion = state ? `${state}, India` : 'India';

  if (lat === undefined || lon === undefined) {
    const found = await resolveLocationForOpenMeteo(city, state);
    if (!found) return null;
    lat = found.latitude;
    lon = found.longitude;
    resolvedName = found.name;
    resolvedRegion = found.state
      ? found.country && found.state !== found.country
        ? `${found.state}, ${found.country}`
        : found.state
      : found.country || 'India';
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    const aqiUrl = assertAllowedExternalUrl(
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${encodeURIComponent(String(lat))}&longitude=${encodeURIComponent(String(lon))}&current=us_aqi,pm2_5,pm10,nitrogen_dioxide,ozone&hourly=us_aqi,pm2_5,pm10&timezone=auto&forecast_days=1`
    );
    const weatherUrl = assertAllowedExternalUrl(
      `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(String(lat))}&longitude=${encodeURIComponent(String(lon))}&current=temperature_2m,apparent_temperature,relative_humidity_2m,surface_pressure,wind_speed_10m,wind_direction_10m,weather_code&timezone=auto`
    );

    const [aqiRes, weatherRes] = await Promise.all([
      fetch(aqiUrl.toString(), { signal: controller.signal }),
      fetch(weatherUrl.toString(), { signal: controller.signal }),
    ]);

    if (!aqiRes.ok) return null;

    const aqiJson = (await aqiRes.json()) as OpenMeteoAqiPayload;
    const weatherJson = weatherRes.ok
      ? ((await weatherRes.json()) as OpenMeteoWeatherPayload)
      : {};

    const pm25 = validatePollutantValue(aqiJson.current?.pm2_5, 1000);
    const pm10 = validatePollutantValue(aqiJson.current?.pm10, 2000);
    const no2 = validatePollutantValue(aqiJson.current?.nitrogen_dioxide, 1000);
    const o3 = validatePollutantValue(aqiJson.current?.ozone, 1000);
    const apiUsAqi = validatePollutantValue(aqiJson.current?.us_aqi, 500);
    const finalAqi = apiUsAqi ?? calculateUsEpaAqiFromPm25(pm25);

    if (finalAqi === null && pm25 === null) return null;

    const observedAtIso = new Date().toISOString();
    const hourlyTrend = extractHourlyCurve(aqiJson.hourly);
    const { bestWindow, peakWindow } = computeDiurnalWindows(hourlyTrend, finalAqi ?? 100);

    const tempC = validatePollutantValue(weatherJson.current?.temperature_2m, 65) ?? 22;
    const feelsLikeC = validatePollutantValue(weatherJson.current?.apparent_temperature, 70) ?? tempC;
    const humidityPct = validatePollutantValue(weatherJson.current?.relative_humidity_2m, 100) ?? 60;
    const pressureHpa = validatePollutantValue(weatherJson.current?.surface_pressure, 1100) ?? 1013;
    const windSpeedKmh = validatePollutantValue(weatherJson.current?.wind_speed_10m, 180);
    const windDir = degreesToCompass(weatherJson.current?.wind_direction_10m);
    const condition = weatherCodeToLabel(weatherJson.current?.weather_code);

    const dominantPollutant =
      pm25 !== null && (pm10 === null || pm25 >= pm10 * 0.45)
        ? 'PM2.5'
        : pm10 !== null
          ? 'PM10'
          : 'O3';

    const category = interpretUsEpaAqiCategory(finalAqi);
    const slugId = resolvedName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    return {
      cityId: slugId,
      cityName: resolvedName,
      region: resolvedRegion,
      stationName: `Live Regional Feed · ${resolvedName} (${resolvedRegion})`,
      aqi: finalAqi !== null ? Math.round(finalAqi) : null,
      category,
      methodology: 'US EPA AQI Scale (0–500) · Live Open-Meteo / CAMS Telemetry',
      dominantPollutant,
      pm25,
      pm10,
      no2,
      o3,
      weather: {
        temperatureC: Math.round(tempC * 10) / 10,
        feelsLikeC: Math.round(feelsLikeC * 10) / 10,
        humidityPct: Math.round(humidityPct),
        visibilityKm: null,
        pressureHpa: Math.round(pressureHpa),
        condition,
        inversionNote:
          windSpeedKmh !== null && windSpeedKmh < 6
            ? 'Low surface wind speed favors stagnant particulate trapping during cool morning and night hours.'
            : 'Active surface airflow is assisting atmospheric mixing across the local urban boundary layer.',
      },
      wind: {
        speedKmh: windSpeedKmh,
        direction: windDir,
        dispersionNote:
          windSpeedKmh === null
            ? 'Wind telemetry unavailable for this interval.'
            : windSpeedKmh < 6
              ? 'Calm breeze (< 6 km/h) slows urban pollutant dispersion.'
              : windSpeedKmh < 14
                ? 'Light-to-moderate airflow provides steady afternoon dispersion.'
                : 'Brisk wind actively clears ambient urban particulates.',
      },
      hourlyTrend,
      bestWindow,
      peakWindow,
      dataSource: 'Live Open-Meteo Air Quality & Meteorology Feed (Real-Time)',
      isDemo: false,
      isStale: false,
      scenarioLabel: `Live · ${category}`,
      observedAtIso,
      lastUpdatedLabel: `Live Feed · ${new Date(observedAtIso).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })}`,
      dataLimitations: [
        'Regional live air-quality models (~11 km resolution) do not capture hyperlocal curbside traffic exhaust or indoor PM2.5 concentrations.',
        'Always verify severe local smog alerts against CPCB (Central Pollution Control Board) or your municipal public-health agency.',
      ],
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
