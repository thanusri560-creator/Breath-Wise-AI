import type { AqiCategory } from '../domain/airQualityTypes';

interface AQIIndicatorProps {
  aqi: number | null;
  category: AqiCategory | 'Unavailable';
  inverted?: boolean;
  compact?: boolean;
}

/**
 * WCAG 2.2 AA accessible AQI Indicator.
 * Never communicates air-quality severity by color alone: always pairs a distinct
 * geometric glyph + explicit category text + numeric reading.
 */
export function AQIIndicator({
  aqi,
  category,
  inverted = false,
  compact = false,
}: AQIIndicatorProps) {
  const meta = getAqiVisualMeta(category, inverted);

  return (
    <div
      className={`inline-flex items-center gap-2 ${compact ? 'text-xs' : 'text-sm'} font-medium ${meta.textClass}`}
      aria-label={`Air Quality Index ${aqi !== null ? aqi : 'unavailable'}, category ${category}`}
    >
      <span
        aria-hidden="true"
        className="font-mono text-xs leading-none select-none"
      >
        {meta.glyph}
      </span>
      <span className="font-semibold">{category}</span>
      {aqi !== null && (
        <span className="font-mono tabular-nums opacity-85">
          (AQI {aqi})
        </span>
      )}
    </div>
  );
}

export function getAqiVisualMeta(
  category: AqiCategory | 'Unavailable',
  inverted = false
): {
  glyph: string;
  textClass: string;
  barClass: string;
  shortGuidance: string;
} {
  switch (category) {
    case 'Good':
      return {
        glyph: '●',
        textClass: inverted ? 'text-teal-300' : 'text-teal-700',
        barClass: 'bg-teal-500',
        shortGuidance: 'Clean urban airflow; normal outdoor activities and natural ventilation are appropriate.',
      };
    case 'Moderate':
      return {
        glyph: '◆',
        textClass: inverted ? 'text-cyan-300' : 'text-cyan-700',
        barClass: 'bg-cyan-500',
        shortGuidance: 'Acceptable for most people; sensitive individuals should avoid prolonged roadside exertion.',
      };
    case 'Unhealthy for Sensitive Groups':
      return {
        glyph: '▲',
        textClass: inverted ? 'text-amber-300' : 'text-amber-700',
        barClass: 'bg-amber-500',
        shortGuidance: 'Children, older adults, and active commuters should shorten outdoor time during peak rush hours.',
      };
    case 'Unhealthy':
      return {
        glyph: '■',
        textClass: inverted ? 'text-orange-300' : 'text-orange-700',
        barClass: 'bg-orange-500',
        shortGuidance: 'Everyone should limit prolonged outdoor exertion, seal windows during peaks, and run HEPA filtration.',
      };
    case 'Very Unhealthy':
      return {
        glyph: '✖',
        textClass: inverted ? 'text-rose-300' : 'text-rose-700',
        barClass: 'bg-rose-500',
        shortGuidance: 'Move workouts and family play indoors; keep windows shut and use a fitted N95 for essential trips.',
      };
    case 'Hazardous':
      return {
        glyph: '✖✖',
        textClass: inverted ? 'text-rose-200' : 'text-rose-800',
        barClass: 'bg-rose-700',
        shortGuidance: 'Severe winter smog alert: stay indoors with mechanical HEPA filtration and follow local public-health advisories.',
      };
    default:
      return {
        glyph: '○',
        textClass: inverted ? 'text-slate-300' : 'text-slate-600',
        barClass: 'bg-slate-400',
        shortGuidance: 'Verified station data is unavailable; follow cautious baseline habits and check local government monitors.',
      };
  }
}
