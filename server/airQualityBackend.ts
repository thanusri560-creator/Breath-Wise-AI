import type { AirQualityReading } from '../src/domain/airQualityTypes.ts';
import {
  AirQualityDataService,
  calculateUsEpaAqiFromPm25,
  interpretUsEpaAqiCategory,
  isObservationStale,
} from '../src/services/AirQualityDataService.ts';
import {
  sanitizeLocationInput,
  sanitizeUserText,
  validatePollutantValue,
} from '../src/services/validation.ts';

interface CachedAqiEntry {
  reading: AirQualityReading;
  expiresAt: number;
}

const AQI_CACHE_TTL_MS = 3 * 60 * 1000;
const aqiCache = new Map<string, CachedAqiEntry>();

interface WaqiIaqiEntry {
  v?: number;
}

interface WaqiPayload {
  status?: string;
  data?: {
    aqi?: number | string;
    dominentpol?: string;
    city?: { name?: string };
    time?: { iso?: string };
    iaqi?: {
      pm25?: WaqiIaqiEntry;
      pm10?: WaqiIaqiEntry;
      no2?: WaqiIaqiEntry;
      o3?: WaqiIaqiEntry;
      t?: WaqiIaqiEntry;
      h?: WaqiIaqiEntry;
      p?: WaqiIaqiEntry;
      w?: WaqiIaqiEntry;
    };
  };
}

export function isLiveAqiConfigured(): boolean {
  return Boolean(process.env.WAQI_API_TOKEN && process.env.WAQI_API_TOKEN.trim().length > 4);
}

/**
 * Retrieves validated environmental data for a city.
 * - Uses TTL caching to avoid redundant upstream API requests.
 * - Treats live external API responses as untrusted input and validates every pollutant.
 * - Clearly separates Live Telemetry from Demo Mode sample datasets.
 */
export async function fetchAirQualityForCity(rawCity: string): Promise<AirQualityReading> {
  const cleanCity = sanitizeLocationInput(rawCity) || 'new-delhi';
  const cacheKey = `${isLiveAqiConfigured() ? 'live' : 'demo'}:${cleanCity.toLowerCase()}`;

  const cached = aqiCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.reading;
  }

  let reading: AirQualityReading;

  if (isLiveAqiConfigured()) {
    reading = await fetchLiveWaqiReading(cleanCity, process.env.WAQI_API_TOKEN as string);
  } else {
    reading = AirQualityDataService.getDemoReading(cleanCity);
  }

  if (aqiCache.size > 200) {
    const firstKey = aqiCache.keys().next().value;
    if (firstKey) aqiCache.delete(firstKey);
  }

  aqiCache.set(cacheKey, { reading, expiresAt: Date.now() + AQI_CACHE_TTL_MS });
  return reading;
}

async function fetchLiveWaqiReading(city: string, token: string): Promise<AirQualityReading> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    // Allowlisted external environmental endpoint only (SSRF-safe).
    const url = `https://api.waqi.info/feed/${encodeURIComponent(city)}/?token=${encodeURIComponent(token)}`;
    const response = await fetch(url, { signal: controller.signal });

    if (!response.ok) {
      return AirQualityDataService.buildUnavailableReading(
        city,
        `Upstream live environmental station returned HTTP ${response.status}.`
      );
    }

    const json = (await response.json()) as WaqiPayload;
    if (json.status !== 'ok' || !json.data) {
      return AirQualityDataService.buildUnavailableReading(
        city,
        `No verified live monitoring station matched "${city}".`
      );
    }

    const rawAqi = typeof json.data.aqi === 'number' ? json.data.aqi : Number(json.data.aqi);
    const pm25 = validatePollutantValue(json.data.iaqi?.pm25?.v, 1000);
    const pm10 = validatePollutantValue(json.data.iaqi?.pm10?.v, 2000);
    const no2 = validatePollutantValue(json.data.iaqi?.no2?.v, 1000);
    const o3 = validatePollutantValue(json.data.iaqi?.o3?.v, 1000);
    const validatedAqi =
      validatePollutantValue(rawAqi, 500) ?? calculateUsEpaAqiFromPm25(pm25);

    const observedAtIso =
      json.data.time?.iso && !Number.isNaN(Date.parse(json.data.time.iso))
        ? json.data.time.iso
        : new Date().toISOString();
    const stale = isObservationStale(observedAtIso);

    const tempC = validatePollutantValue(json.data.iaqi?.t?.v, 60) ?? 12;
    const humidity = validatePollutantValue(json.data.iaqi?.h?.v, 100) ?? 65;
    const pressure = validatePollutantValue(json.data.iaqi?.p?.v, 1100) ?? 1015;
    const windMs = validatePollutantValue(json.data.iaqi?.w?.v, 60);
    const windKmh = windMs !== null ? Math.round(windMs * 3.6 * 10) / 10 : null;

    const baseTemplate = AirQualityDataService.getDemoReading(city, observedAtIso);

    return {
      ...baseTemplate,
      cityName: sanitizeUserText(json.data.city?.name || city, 80),
      stationName: sanitizeUserText(json.data.city?.name || 'Live WAQI Station', 100),
      aqi: validatedAqi,
      category: interpretUsEpaAqiCategory(validatedAqi),
      dominantPollutant: sanitizeUserText(
        (json.data.dominentpol || 'PM2.5').toUpperCase(),
        12
      ),
      pm25,
      pm10,
      no2,
      o3,
      weather: {
        ...baseTemplate.weather,
        temperatureC: tempC,
        feelsLikeC: tempC,
        humidityPct: humidity,
        pressureHpa: pressure,
        condition: 'Live Station Meteorology',
      },
      wind: {
        speedKmh: windKmh,
        direction: windKmh !== null ? 'Variable' : null,
        dispersionNote:
          windKmh === null
            ? 'Wind telemetry unavailable from station.'
            : windKmh < 6
              ? 'Calm wind conditions reduce urban particulate dispersion.'
              : 'Active surface airflow aids moderate pollutant dispersion.',
      },
      dataSource: 'Live World Air Quality Index (WAQI) Station Feed',
      isDemo: false,
      isStale: stale,
      scenarioLabel: 'Live Environmental Feed',
      observedAtIso,
      lastUpdatedLabel: `Live Station · ${new Date(observedAtIso).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })}`,
      dataLimitations: [
        'Station readings represent ambient neighborhood monitors; street-level traffic corridors and indoor PM2.5 may differ significantly.',
        ...(stale ? ['Observation timestamp is older than 3 hours and may be stale.'] : []),
        ...(pm25 === null ? ['Raw PM2.5 reading was unavailable from this monitoring station.'] : []),
      ],
    };
  } catch {
    return AirQualityDataService.buildUnavailableReading(
      city,
      'Live environmental data feed timed out or could not be reached. Showing safe unavailable state.'
    );
  } finally {
    clearTimeout(timeout);
  }
}
