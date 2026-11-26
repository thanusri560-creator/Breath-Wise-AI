import type {
  AirQualityReading,
  AqiCategory,
  CityOption,
  HourlyAirPoint,
} from '../domain/airQualityTypes';
import { sanitizeLocationInput, validatePollutantValue } from './validation';

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

interface DemoCityTemplate {
  id: string;
  cityName: string;
  region: string;
  stationName: string;
  pm25: number;
  pm10: number;
  no2: number;
  o3: number;
  dominantPollutant: string;
  temperatureC: number;
  feelsLikeC: number;
  humidityPct: number;
  visibilityKm: number;
  pressureHpa: number;
  condition: string;
  inversionNote: string;
  windSpeedKmh: number;
  windDirection: string;
  dispersionNote: string;
  middayRatio: number;
  bestWindow: string;
  peakWindow: string;
  scenarioLabel: string;
}

const DEMO_CITY_TEMPLATES: DemoCityTemplate[] = [
  {
    id: 'new-delhi',
    cityName: 'New Delhi',
    region: 'National Capital Region, India',
    stationName: 'Demo Station: Anand Vihar — Urban Winter Smog',
    pm25: 256,
    pm10: 394,
    no2: 64,
    o3: 28,
    dominantPollutant: 'PM2.5',
    temperatureC: 11,
    feelsLikeC: 10,
    humidityPct: 78,
    visibilityKm: 0.8,
    pressureHpa: 1018,
    condition: 'Dense Winter Smog & Shallow Fog',
    inversionNote:
      'Strong overnight temperature inversion traps fine particulates close to street level.',
    windSpeedKmh: 3.4,
    windDirection: 'NW',
    dispersionNote:
      'Calm winds (< 5 km/h) slow pollutant dispersion until brief afternoon solar warming.',
    middayRatio: 0.74,
    bestWindow: '13:30 – 15:30 (still elevated; keep outdoor time brief)',
    peakWindow: '06:30 – 09:30 & 20:00 – 23:00',
    scenarioLabel: 'Severe Winter Smog',
  },
  {
    id: 'lahore',
    cityName: 'Lahore',
    region: 'Punjab, Pakistan',
    stationName: 'Demo Station: Gulberg Corridor — Thermal Inversion',
    pm25: 192,
    pm10: 320,
    no2: 58,
    o3: 24,
    dominantPollutant: 'PM2.5',
    temperatureC: 13,
    feelsLikeC: 12,
    humidityPct: 74,
    visibilityKm: 1.2,
    pressureHpa: 1016,
    condition: 'Heavy Particulate Haze',
    inversionNote:
      'Stable cool air layer traps regional biomass smoke and urban commuter exhaust.',
    windSpeedKmh: 4.1,
    windDirection: 'WNW',
    dispersionNote: 'Weak surface breeze offers minimal clearing before sunset rebound.',
    middayRatio: 0.72,
    bestWindow: '13:00 – 15:30 (lowest diurnal band, still Very Unhealthy)',
    peakWindow: '07:00 – 10:00 & 19:30 – 23:00',
    scenarioLabel: 'Very Unhealthy Inversion',
  },
  {
    id: 'salt-lake-city',
    cityName: 'Salt Lake City',
    region: 'Utah, United States',
    stationName: 'Demo Station: Hawthorne Basin — Valley Cold Pool',
    pm25: 76,
    pm10: 112,
    no2: 46,
    o3: 31,
    dominantPollutant: 'PM2.5',
    temperatureC: -2,
    feelsLikeC: -5,
    humidityPct: 68,
    visibilityKm: 3.1,
    pressureHpa: 1024,
    condition: 'Winter Valley Inversion Haze',
    inversionNote:
      'Cold air pooled on the valley floor beneath warmer mountain air holds secondary particulates.',
    windSpeedKmh: 5.2,
    windDirection: 'SSE',
    dispersionNote: 'Light valley flow concentrates haze along commuter corridors until midday.',
    middayRatio: 0.68,
    bestWindow: '12:30 – 15:30 (moderate midday mixing)',
    peakWindow: '07:00 – 09:30 & 18:00 – 21:00',
    scenarioLabel: 'Unhealthy Valley Inversion',
  },
  {
    id: 'krakow',
    cityName: 'Krakow',
    region: 'Lesser Poland, Poland',
    stationName: 'Demo Station: Aleja Krasinskiego — Heating Season',
    pm25: 48,
    pm10: 82,
    no2: 49,
    o3: 22,
    dominantPollutant: 'PM2.5',
    temperatureC: 1,
    feelsLikeC: -2,
    humidityPct: 81,
    visibilityKm: 4.2,
    pressureHpa: 1021,
    condition: 'Winter Heating Haze',
    inversionNote:
      'Evening solid-fuel heating combined with cold stagnant air elevates particulates in low districts.',
    windSpeedKmh: 6.5,
    windDirection: 'SW',
    dispersionNote: 'Mild southwest airflow provides partial afternoon clearing.',
    middayRatio: 0.66,
    bestWindow: '12:00 – 15:00 (lower particulate concentration)',
    peakWindow: '07:00 – 09:00 & 19:00 – 22:00',
    scenarioLabel: 'Sensitive Groups Alert',
  },
  {
    id: 'milan',
    cityName: 'Milan',
    region: 'Lombardy (Po Valley), Italy',
    stationName: 'Demo Station: Via Senato — Urban Background',
    pm25: 29,
    pm10: 54,
    no2: 41,
    o3: 34,
    dominantPollutant: 'PM2.5',
    temperatureC: 6,
    feelsLikeC: 4,
    humidityPct: 76,
    visibilityKm: 6.5,
    pressureHpa: 1020,
    condition: 'Light Po Valley Mist',
    inversionNote: 'High-pressure winter system slows regional exchange across the Po Valley basin.',
    windSpeedKmh: 8.2,
    windDirection: 'E',
    dispersionNote: 'Gentle easterly airflow keeps background levels moderate away from rush-hour roads.',
    middayRatio: 0.75,
    bestWindow: '11:30 – 15:30 (comfortable for most outdoor routines)',
    peakWindow: '08:00 – 09:30 & 18:30 – 20:30',
    scenarioLabel: 'Moderate Winter Haze',
  },
  {
    id: 'vancouver',
    cityName: 'Vancouver',
    region: 'British Columbia, Canada',
    stationName: 'Demo Station: Kitsilano Coastal Monitor',
    pm25: 6.2,
    pm10: 15,
    no2: 14,
    o3: 38,
    dominantPollutant: 'O3',
    temperatureC: 7,
    feelsLikeC: 5,
    humidityPct: 72,
    visibilityKm: 16.0,
    pressureHpa: 1014,
    condition: 'Crisp Coastal Breeze',
    inversionNote: 'Active marine airflow prevents stagnant particulate accumulation.',
    windSpeedKmh: 16.4,
    windDirection: 'W',
    dispersionNote: 'Steady onshore Pacific wind keeps urban air well mixed.',
    middayRatio: 0.85,
    bestWindow: 'All day (07:00 – 20:00)',
    peakWindow: 'Minor commuter bump 08:00 – 09:00',
    scenarioLabel: 'Clean Air Baseline',
  },
];

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
