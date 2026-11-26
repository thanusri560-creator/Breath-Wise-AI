import type { AirQualityReading } from '../src/domain/airQualityTypes.ts';
import {
  AirQualityDataService,
  calculateUsEpaAqiFromPm25,
  interpretUsEpaAqiCategory,
  isObservationStale,
} from '../src/services/AirQualityDataService.ts';
import {
  assertAllowedExternalUrl,
  sanitizeUserText,
  validatePollutantValue,
} from '../src/services/validation.ts';

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

export function hasWaqiToken(): boolean {
  return Boolean(process.env.WAQI_API_TOKEN && process.env.WAQI_API_TOKEN.trim().length > 4);
}

/**
 * Optional live WAQI station feed provider used when WAQI_API_TOKEN is configured.
 * Enforces strict HTTPS allowlist verification, timeout abort, and numeric bounds validation.
 */
export async function fetchLiveWaqiReading(
  city: string,
  token: string
): Promise<AirQualityReading | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5500);

  try {
    const url = assertAllowedExternalUrl(
      `https://api.waqi.info/feed/${encodeURIComponent(city)}/?token=${encodeURIComponent(token)}`
    );
    const response = await fetch(url.toString(), { signal: controller.signal });
    if (!response.ok) return null;

    const json = (await response.json()) as WaqiPayload;
    if (json.status !== 'ok' || !json.data) return null;

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

    const tempC = validatePollutantValue(json.data.iaqi?.t?.v, 60) ?? 20;
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
      ],
    };
  } catch (err: unknown) {
    if (!(err instanceof Error && err.name === 'AbortError')) {
      console.warn('Live WAQI station lookup failed; falling back to Open-Meteo.');
    }
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
