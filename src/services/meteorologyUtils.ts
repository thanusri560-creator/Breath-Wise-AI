import type { HourlyAirPoint } from '../domain/airQualityTypes.ts';
import { calculateUsEpaAqiFromPm25 } from './AirQualityDataService.ts';
import { validatePollutantValue } from './validation.ts';

export interface HourlySeriesPayload {
  time?: string[];
  us_aqi?: Array<number | null>;
  pm2_5?: Array<number | null>;
  pm10?: Array<number | null>;
}

/**
 * Downsamples 24-hour Open-Meteo hourly pollutant arrays into clean 2-hour diurnal chart points.
 */
export function extractHourlyCurve(hourly?: HourlySeriesPayload): HourlyAirPoint[] {
  if (!hourly?.time || !Array.isArray(hourly.time)) return [];
  const points: HourlyAirPoint[] = [];
  for (let i = 0; i < hourly.time.length; i += 2) {
    const rawTime = hourly.time[i];
    const hourLabel =
      typeof rawTime === 'string' && rawTime.includes('T')
        ? rawTime.slice(11, 16)
        : `${String(i).padStart(2, '0')}:00`;
    const pm25 = validatePollutantValue(hourly.pm2_5?.[i], 1000) ?? 0;
    const pm10 = validatePollutantValue(hourly.pm10?.[i], 2000) ?? 0;
    const aqi =
      validatePollutantValue(hourly.us_aqi?.[i], 500) ??
      calculateUsEpaAqiFromPm25(pm25) ??
      0;
    points.push({
      hour: hourLabel,
      aqi: Math.round(aqi),
      pm25: Math.round(pm25 * 10) / 10,
      pm10: Math.round(pm10 * 10) / 10,
    });
  }
  return points;
}

/**
 * Identifies the cleanest and peak-smog diurnal bands from an hourly forecast curve.
 */
export function computeDiurnalWindows(
  trend: HourlyAirPoint[],
  currentAqi: number
): { bestWindow: string; peakWindow: string } {
  if (trend.length === 0) {
    return {
      bestWindow: '12:30 – 15:30 (typical midday mixing)',
      peakWindow: '07:00 – 09:30 & 19:30 – 22:30',
    };
  }
  let minPt = trend[0];
  let maxPt = trend[0];
  for (const pt of trend) {
    if (pt.aqi < minPt.aqi) minPt = pt;
    if (pt.aqi > maxPt.aqi) maxPt = pt;
  }
  const bestNote =
    currentAqi > 200 ? 'still elevated; keep outdoor time brief' : 'lowest forecast particulate band';
  return {
    bestWindow: `Around ${minPt.hour} (AQI ~${minPt.aqi}, ${bestNote})`,
    peakWindow: `Around ${maxPt.hour} (AQI ~${maxPt.aqi})`,
  };
}

/**
 * Converts meteorological wind degrees (0–360) into an 8-point compass heading.
 */
export function degreesToCompass(deg?: number): string | null {
  if (typeof deg !== 'number' || !Number.isFinite(deg)) return null;
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round((((deg % 360) + 360) % 360) / 45) % 8];
}

/**
 * Maps WMO numerical weather codes into plain-language atmospheric condition descriptions.
 */
export function weatherCodeToLabel(code?: number): string {
  if (typeof code !== 'number') return 'Live Regional Meteorology';
  if (code === 0) return 'Clear Sky';
  if (code <= 3) return 'Partly Cloudy / Light Haze';
  if (code === 45 || code === 48) return 'Fog / Shallow Mist';
  if (code >= 51 && code <= 67) return 'Light Rain / Drizzle';
  if (code >= 71 && code <= 77) return 'Winter Snow / Sleet';
  if (code >= 80 && code <= 82) return 'Rain Showers';
  if (code >= 95) return 'Thunderstorm';
  return 'Urban Atmospheric Conditions';
}
