import type {
  AirQualityReading,
  AqiCategory,
  CityOption,
  HourlyAirPoint,
} from '../domain/airQualityTypes';
import { DEMO_CITY_TEMPLATES } from '../data/demoCityTemplates.ts';
import { sanitizeLocationInput, validatePollutantValue } from './validation.ts';

/**
 * Official US EPA 2024 PM2.5 24-hour AQI Breakpoint Table (µg/m³ -> US AQI 0–500).
 * Used whenever raw PM2.5 measurements need deterministic AQI calculation.
 */
const EPA_PM25_BREAKPOINTS: Array<[number, number, number, number]> = [
  [0.0, 9.0, 0, 50],
  [9.1, 35.4, 51, 100],
  [35.5, 55.4, 101, 150],
  [55.5, 125.4, 151, 200],
  [125.5, 225.4, 201, 300],
  [225.5, 325.4, 301, 400],
  [325.5, 500.4, 401, 500],
];

const STALE_THRESHOLD_HOURS = 3;

/**
 * Computes US EPA AQI from a validated PM2.5 concentration (µg/m³) via piecewise linear interpolation.
 * Returns null if pm25 is invalid or negative.
 */
export function calculateUsEpaAqiFromPm25(pm25: number | null): number | null {
  if (pm25 === null || !Number.isFinite(pm25) || pm25 < 0) return null;
  const truncated = Math.floor(pm25 * 10) / 10;
  if (truncated > 500.4) return 500;

  for (const [cLow, cHigh, iLow, iHigh] of EPA_PM25_BREAKPOINTS) {
    if (truncated >= cLow && truncated <= cHigh) {
      const aqi = ((iHigh - iLow) / (cHigh - cLow)) * (truncated - cLow) + iLow;
      return Math.round(aqi);
    }
  }
  return 500;
}

/**
 * Official US EPA AQI category interpretation (0–500 scale).
 */
export function interpretUsEpaAqiCategory(aqi: number | null): AqiCategory | 'Unavailable' {
  if (aqi === null || !Number.isFinite(aqi) || aqi < 0) return 'Unavailable';
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Unhealthy for Sensitive Groups';
  if (aqi <= 200) return 'Unhealthy';
  if (aqi <= 300) return 'Very Unhealthy';
  return 'Hazardous';
}

/**
 * Determines whether an environmental observation timestamp is stale (> 3 hours old).
 */
export function isObservationStale(
  observedAtIso: string,
  referenceNowMs: number = Date.now(),
  maxAgeHours: number = STALE_THRESHOLD_HOURS
): boolean {
  const obsMs = Date.parse(observedAtIso);
  if (Number.isNaN(obsMs)) return true;
  const ageHours = (referenceNowMs - obsMs) / (1000 * 60 * 60);
  return ageHours > maxAgeHours;
}

/**
 * Reconciles multiple environmental sources and flags material discrepancy
 * when primary and secondary readings differ by >= 40 AQI points.
 */
export function detectSourceConflict(
  primaryAqi: number | null,
  secondaryAqi: number | null,
  primarySource: string,
  secondarySource: string
): { hasConflict: boolean; note: string | null } {
  if (primaryAqi === null || secondaryAqi === null) {
    return { hasConflict: false, note: null };
  }
  const diff = Math.abs(primaryAqi - secondaryAqi);
  if (diff >= 40) {
    return {
      hasConflict: true,
      note: `Conflicting readings detected: ${primarySource} reports AQI ${primaryAqi} while ${secondarySource} reports AQI ${secondaryAqi} (${diff}-point gap). Using the conservative higher reading for exposure caution.`,
    };
  }
  return { hasConflict: false, note: null };
}

function buildDiurnalCurve(
  peakAqi: number,
  middayRatio: number,
  pm25Ratio: number,
  pm10Ratio: number
): HourlyAirPoint[] {
  const slots = [
    { hour: '06:00', mult: 0.94 },
    { hour: '08:00', mult: 1.0 },
    { hour: '10:00', mult: 0.87 },
    { hour: '12:00', mult: middayRatio + 0.08 },
    { hour: '14:00', mult: middayRatio },
    { hour: '16:00', mult: middayRatio + 0.05 },
    { hour: '18:00', mult: 0.85 },
    { hour: '20:00', mult: 0.95 },
    { hour: '22:00', mult: 0.98 },
  ];

  return slots.map(({ hour, mult }) => {
    const aqi = Math.max(10, Math.round(peakAqi * mult));
    const pm25 = Math.max(3, Math.round(aqi * pm25Ratio));
    const pm10 = Math.max(pm25 + 6, Math.round(pm25 * pm10Ratio));
    return { hour, aqi, pm25, pm10 };
  });
}

export const AirQualityDataService = {
  listDemoCities(): CityOption[] {
    return DEMO_CITY_TEMPLATES.map((t) => {
      const aqi = calculateUsEpaAqiFromPm25(t.pm25) ?? 0;
      const cat = interpretUsEpaAqiCategory(aqi);
      return {
        id: t.id,
        name: t.cityName,
        region: t.region,
        aqi,
        category: cat === 'Unavailable' ? 'Moderate' : cat,
        scenarioLabel: t.scenarioLabel,
      };
    });
  },

  getDemoReading(cityQuery: string, observedAtIso?: string): AirQualityReading {
    const clean = sanitizeLocationInput(cityQuery) || 'new-delhi';
    const lower = clean.toLowerCase();
    const matched = DEMO_CITY_TEMPLATES.find(
      (t) => t.id === lower || t.cityName.toLowerCase() === lower || t.cityName.toLowerCase().includes(lower)
    );
    const tpl = matched ?? DEMO_CITY_TEMPLATES[2];
    const isCustomFallback = !matched;

    const pm25 = validatePollutantValue(tpl.pm25, 1000);
    const pm10 = validatePollutantValue(tpl.pm10, 2000);
    const aqi = calculateUsEpaAqiFromPm25(pm25);
    const category = interpretUsEpaAqiCategory(aqi);
    const timestampIso = observedAtIso ?? new Date().toISOString();
    const stale = isObservationStale(timestampIso);

    return {
      cityId: tpl.id,
      cityName: isCustomFallback ? clean : tpl.cityName,
      region: isCustomFallback ? 'Demo Mode Interpolated Winter Reference' : tpl.region,
      stationName: isCustomFallback
        ? `Demo Mode Sample Profile (modeled on ${tpl.cityName} winter inversion)`
        : tpl.stationName,
      aqi,
      category,
      methodology: 'US EPA 2024 PM2.5 24-hr Breakpoint Scale (0–500)',
      dominantPollutant: tpl.dominantPollutant,
      pm25,
      pm10,
      no2: tpl.no2,
      o3: tpl.o3,
      weather: {
        temperatureC: tpl.temperatureC,
        feelsLikeC: tpl.feelsLikeC,
        humidityPct: tpl.humidityPct,
        visibilityKm: tpl.visibilityKm,
        pressureHpa: tpl.pressureHpa,
        condition: tpl.condition,
        inversionNote: tpl.inversionNote,
      },
      wind: {
        speedKmh: tpl.windSpeedKmh,
        direction: tpl.windDirection,
        dispersionNote: tpl.dispersionNote,
      },
      hourlyTrend: buildDiurnalCurve(
        aqi ?? 100,
        tpl.middayRatio,
        (pm25 ?? 35) / Math.max(1, aqi ?? 100),
        (pm10 ?? 60) / Math.max(1, pm25 ?? 35)
      ),
      bestWindow: tpl.bestWindow,
      peakWindow: tpl.peakWindow,
      dataSource: 'DEMO MODE — Sample Urban Winter Smog Dataset (Not Live Telemetry)',
      isDemo: true,
      isStale: stale,
      scenarioLabel: tpl.scenarioLabel,
      observedAtIso: timestampIso,
      lastUpdatedLabel: `Sample Dataset · ${new Date(timestampIso).toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })}`,
      dataLimitations: [
        'Operating in clearly labeled DEMO MODE because no live environmental API key is configured on the server.',
        'Hyperlocal street-level traffic hotspots and indoor PM2.5 concentrations are not measured by citywide stations.',
        'Always follow official municipal public-health and meteorological advisories during elevated smog events.',
      ],
    };
  },

  /**
   * Builds a safe fallback reading when external environmental data is completely unavailable,
   * clearly signaling missing metrics rather than fabricating fake live measurements.
   */
  buildUnavailableReading(cityLabel: string, reason: string): AirQualityReading {
    const clean = sanitizeLocationInput(cityLabel) || 'Selected Location';
    const nowIso = new Date().toISOString();
    return {
      cityId: 'unavailable',
      cityName: clean,
      region: 'Environmental Feed Unavailable',
      stationName: 'No reporting station available',
      aqi: null,
      category: 'Unavailable',
      methodology: 'US EPA 2024 Breakpoint Scale (Data Missing)',
      dominantPollutant: 'Unknown',
      pm25: null,
      pm10: null,
      no2: null,
      o3: null,
      weather: {
        temperatureC: 0,
        feelsLikeC: 0,
        humidityPct: 0,
        visibilityKm: null,
        pressureHpa: 1013,
        condition: 'Weather telemetry unavailable',
        inversionNote: 'Cannot assess thermal inversion without live meteorological inputs.',
      },
      wind: {
        speedKmh: null,
        direction: null,
        dispersionNote: 'Wind conditions unavailable.',
      },
      hourlyTrend: [],
      bestWindow: 'Unavailable — check local government monitor',
      peakWindow: 'Unavailable',
      dataSource: 'Unavailable (Fallback Safety State)',
      isDemo: false,
      isStale: true,
      scenarioLabel: 'Unavailable Data',
      observedAtIso: nowIso,
      lastUpdatedLabel: 'No verified reading available',
      dataLimitations: [
        reason,
        'Recommendations default to cautious baseline guidance until verified local readings return.',
      ],
    };
  },
};
