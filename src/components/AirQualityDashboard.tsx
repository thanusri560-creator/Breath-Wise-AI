import { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  CloudFog,
  Compass,
  Droplets,
  MapPin,
  RefreshCw,
  Table,
  Thermometer,
  Wind,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  AirQualityReading,
  BreatheWisePage,
  DailyActionPlanResult,
  UserProfile,
} from '../domain/airQualityTypes';
import { LIFESTYLE_LABELS, SKYLINE_IMAGE_URL } from '../data/breathewiseDefaults';
import { AQIIndicator, getAqiVisualMeta } from './AQIIndicator';

interface AirQualityDashboardProps {
  airQuality: AirQualityReading;
  profile: UserProfile;
  dailyPlan: DailyActionPlanResult;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onNavigate: (page: BreatheWisePage) => void;
}

export function AirQualityDashboard({
  airQuality,
  profile,
  dailyPlan,
  loading,
  error,
  onRefresh,
  onNavigate,
}: AirQualityDashboardProps) {
  const [showDataTable, setShowDataTable] = useState(false);
  const meta = getAqiVisualMeta(airQuality.category, true);
  const aqiPercent =
    airQuality.aqi !== null ? Math.min(100, Math.round((airQuality.aqi / 500) * 100)) : 0;

  return (
    <div className="space-y-6">
      {/* Error / Stale / Conflict Alerts */}
      {(error || airQuality.isStale || airQuality.hasSourceConflict || airQuality.aqi === null) && (
        <section
          aria-label="Environmental data alerts"
          className="bg-amber-50 border border-amber-300 rounded-xl p-4 space-y-2 text-sm text-amber-950"
        >
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
            <span>Data Freshness & Reliability Notice</span>
          </div>
          {error && <p>{error}</p>}
          {airQuality.aqi === null && (
            <p>
              Verified AQI measurements are currently unavailable for {airQuality.cityName}. Recommendations use precautionary baseline defaults.
            </p>
          )}
          {airQuality.isStale && (
            <p>
              Station timestamp is older than 3 hours ({airQuality.lastUpdatedLabel}). Current street-level winter smog may have shifted.
            </p>
          )}
          {airQuality.hasSourceConflict && airQuality.sourceConflictNote && (
            <p>{airQuality.sourceConflictNote}</p>
          )}
        </section>
      )}

      {/* Atmospheric Dark Navy Hero Banner */}
      <section
        aria-labelledby="hero-city-heading"
        className="relative overflow-hidden rounded-2xl bg-[#0B1220] text-white border border-slate-800 shadow-sm"
      >
        <img
          src={SKYLINE_IMAGE_URL}
          alt={`Atmospheric winter skyline backdrop representing urban air conditions in ${airQuality.cityName}`}
          className="absolute inset-0 w-full h-full object-cover opacity-30 pointer-events-none select-none"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-[#0B1220] via-[#0B1220]/90 to-[#0B1220]/65"
        />

        <div className="relative p-6 sm:p-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300">
              <span className="inline-flex items-center gap-1.5 font-medium text-cyan-300">
                <MapPin className="w-3.5 h-3.5" />
                {airQuality.cityName} · {airQuality.region}
              </span>
              <span className="text-slate-400">·</span>
              <span className="font-mono tabular-nums text-slate-300">
                {airQuality.lastUpdatedLabel}
              </span>
            </div>

            <div className="flex flex-wrap items-end gap-5">
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
                  Current Air Quality Index (US EPA)
                </p>
                <div className="mt-1 flex items-baseline gap-3">
                  <span
                    id="hero-city-heading"
                    className="font-display text-5xl sm:text-6xl font-extrabold tracking-tight font-mono tabular-nums text-white"
                  >
                    {airQuality.aqi !== null ? airQuality.aqi : 'N/A'}
                  </span>
                  <AQIIndicator
                    aqi={null}
                    category={airQuality.category}
                    inverted
                  />
                </div>
              </div>
            </div>

            {/* Accessible Linear Severity Scale */}
            <div className="max-w-md space-y-1.5">
              <div
                className="h-2 w-full bg-slate-800 rounded overflow-hidden"
                role="progressbar"
                aria-label="AQI severity on 0 to 500 scale"
                aria-valuenow={airQuality.aqi ?? 0}
                aria-valuemin={0}
                aria-valuemax={500}
              >
                <div
                  className={`h-full transition-all duration-300 ${meta.barClass}`}
                  style={{ width: `${aqiPercent}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] font-mono tabular-nums text-slate-400">
                <span>0 Good</span>
                <span>100 Moderate</span>
                <span>200 Unhealthy</span>
                <span>300+ Hazardous</span>
              </div>
            </div>

            <p className="text-sm text-slate-200 leading-relaxed max-w-2xl">
              <strong className="text-white font-semibold">
                What this means for {LIFESTYLE_LABELS[profile.lifestyle]}:
              </strong>{' '}
              {dailyPlan.summary}
            </p>

            <div className="pt-1 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => onNavigate('routine')}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300"
              >
                <span>Open Full Daily Routine</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onRefresh}
                disabled={loading}
                className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-lg bg-white/10 hover:bg-white/15 text-slate-100 text-sm font-medium border border-white/15 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-300"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                <span>{loading ? 'Refreshing...' : 'Refresh Reading'}</span>
              </button>
            </div>
          </div>

          {/* Right Column: Key Pollutants & Meteorology Summary */}
          <div className="lg:col-span-5 bg-slate-900/75 border border-slate-700/80 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Measured Pollutants & Inversion
              </span>
              <span className="text-xs font-mono text-cyan-300">
                Primary: {airQuality.dominantPollutant}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-xs text-slate-400">PM2.5 (Fine)</div>
                <div className="mt-0.5 font-mono tabular-nums text-2xl font-bold text-white">
                  {airQuality.pm25 !== null ? airQuality.pm25 : '—'}
                  <span className="text-xs font-normal text-slate-400 ml-1">µg/m³</span>
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">PM10 (Coarse)</div>
                <div className="mt-0.5 font-mono tabular-nums text-2xl font-bold text-white">
                  {airQuality.pm10 !== null ? airQuality.pm10 : '—'}
                  <span className="text-xs font-normal text-slate-400 ml-1">µg/m³</span>
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">NO₂ / O₃</div>
                <div className="mt-0.5 font-mono tabular-nums text-sm font-semibold text-slate-200">
                  {airQuality.no2 !== null ? `${airQuality.no2}` : '—'} /{' '}
                  {airQuality.o3 !== null ? `${airQuality.o3}` : '—'}{' '}
                  <span className="text-xs font-normal text-slate-400">ppb</span>
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Visibility</div>
                <div className="mt-0.5 font-mono tabular-nums text-sm font-semibold text-slate-200">
                  {airQuality.weather.visibilityKm !== null
                    ? `${airQuality.weather.visibilityKm} km`
                    : 'Unavailable'}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-800 text-xs text-slate-300 space-y-1">
              <div className="flex items-center gap-1.5 font-medium text-cyan-200">
                <Clock className="w-3.5 h-3.5" />
                <span>Best Window: {airQuality.bestWindow}</span>
              </div>
              <p className="text-slate-400 leading-relaxed">
                Peak Smog Hours: {airQuality.peakWindow}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Environmental & Weather Telemetry Row */}
      <section aria-label="Local weather and wind telemetry" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500">
            <span>Temperature</span>
            <Thermometer className="w-4 h-4 text-teal-600" />
          </div>
          <div className="mt-2 font-mono tabular-nums text-2xl font-bold text-slate-900">
            {airQuality.weather.temperatureC}°C
          </div>
          <p className="mt-1 text-xs text-slate-600">
            Feels like {airQuality.weather.feelsLikeC}°C · {airQuality.weather.condition}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500">
            <span>Wind & Dispersion</span>
            <Wind className="w-4 h-4 text-cyan-600" />
          </div>
          <div className="mt-2 font-mono tabular-nums text-2xl font-bold text-slate-900">
            {airQuality.wind.speedKmh !== null ? `${airQuality.wind.speedKmh} km/h` : 'Unavailable'}
          </div>
          <p className="mt-1 text-xs text-slate-600">
            {airQuality.wind.direction ? `Direction ${airQuality.wind.direction} · ` : ''}
            {airQuality.wind.dispersionNote}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500">
            <span>Humidity & Pressure</span>
            <Droplets className="w-4 h-4 text-teal-600" />
          </div>
          <div className="mt-2 font-mono tabular-nums text-2xl font-bold text-slate-900">
            {airQuality.weather.humidityPct}%
          </div>
          <p className="mt-1 text-xs text-slate-600 font-mono tabular-nums">
            {airQuality.weather.pressureHpa} hPa · {airQuality.weather.inversionNote}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500">
            <span>Data Provenance</span>
            <Compass className="w-4 h-4 text-cyan-600" />
          </div>
          <div className="mt-2 text-sm font-bold text-slate-900 leading-snug">
            {airQuality.isDemo ? 'Demo Mode Sample Feed' : 'Live WAQI Telemetry'}
          </div>
          <p className="mt-1 text-xs text-slate-600">
            {airQuality.stationName}
          </p>
        </div>
      </section>

      {/* Prominent "Today's Air Action Plan" Card */}
      <section
        aria-labelledby="todays-action-plan-heading"
        className="bg-white border border-slate-200 rounded-xl overflow-hidden"
      >
        <div className="px-6 py-5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2
              id="todays-action-plan-heading"
              className="font-display text-xl font-bold text-slate-900"
            >
              Today’s Air Action Plan
            </h2>
            <p className="mt-0.5 text-sm text-slate-600">
              Synchronized across your {LIFESTYLE_LABELS[profile.lifestyle]} routine, {airQuality.cityName} air conditions, and indoor filtration setup.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onNavigate('indoor')}
              className="px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
            >
              Indoor Air Guide
            </button>
            <button
              type="button"
              onClick={() => onNavigate('routine')}
              className="px-3.5 py-2 text-xs sm:text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
            >
              Customize / Enhance with AI
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-slate-200">
          {dailyPlan.recommendations.map((rec) => (
            <article key={rec.id} className="p-6 space-y-3">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-display font-bold text-base text-slate-900">
                  {rec.timeBlock}
                </h3>
                <span className="font-mono tabular-nums text-xs text-slate-500">
                  {rec.timeWindow}
                </span>
              </div>
              <div className="text-xs font-semibold uppercase tracking-wide text-teal-700">
                {rec.benefitDimension} · {rec.activity}
              </div>
              <p className="text-sm font-medium text-slate-900 leading-relaxed">
                {rec.suggestedAction}
              </p>
              <p className="text-xs text-slate-600 leading-relaxed">
                <strong className="text-slate-800">Direct Benefit:</strong> {rec.directBenefit}
              </p>
            </article>
          ))}
        </div>

        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-600 flex flex-wrap items-center justify-between gap-2">
          <span>{dailyPlan.publicHealthAdvisory}</span>
          <span className="font-mono text-[11px] text-slate-500">
            Engine: {dailyPlan.source}
          </span>
        </div>
      </section>

      {/* Diurnal 24-Hour Smog Pattern Chart + Accessible Table Toggle */}
      <section
        aria-labelledby="diurnal-chart-heading"
        className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2
              id="diurnal-chart-heading"
              className="font-display text-lg font-bold text-slate-900 flex items-center gap-2"
            >
              <CloudFog className="w-5 h-5 text-teal-700" />
              <span>Diurnal AQI & PM2.5 Inversion Curve</span>
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Text summary: {airQuality.cityName} typically reaches its lowest particulate window around{' '}
              <strong className="text-slate-900">{airQuality.bestWindow}</strong> and peaks during{' '}
              <strong className="text-slate-900">{airQuality.peakWindow}</strong>.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowDataTable((prev) => !prev)}
            aria-expanded={showDataTable}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
          >
            <Table className="w-3.5 h-3.5" />
            <span>{showDataTable ? 'Hide Accessible Data Table' : 'View Accessible Data Table'}</span>
          </button>
        </div>

        {airQuality.hourlyTrend.length > 0 ? (
          <>
            <div className="h-64 w-full" role="img" aria-label={`Line chart of hourly AQI and PM2.5 in ${airQuality.cityName}`}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={airQuality.hourlyTrend}
                  margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="aqiFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0D9488" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#0D9488" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="hour" tick={{ fontSize: 12, fill: '#475569' }} />
                  <YAxis tick={{ fontSize: 12, fill: '#475569' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0F172A',
                      borderColor: '#334155',
                      borderRadius: '8px',
                      color: '#F8FAFC',
                      fontSize: '12px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="aqi"
                    name="US EPA AQI"
                    stroke="#0D9488"
                    strokeWidth={2.5}
                    fill="url(#aqiFill)"
                  />
                  <Area
                    type="monotone"
                    dataKey="pm25"
                    name="PM2.5 (µg/m³)"
                    stroke="#0891B2"
                    strokeWidth={2}
                    fillOpacity={0}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {showDataTable && (
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-xs sm:text-sm">
                  <caption className="sr-only">
                    Hourly AQI, PM2.5, and PM10 readings for {airQuality.cityName}
                  </caption>
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <tr>
                      <th scope="col" className="px-4 py-2.5 font-semibold">Hour</th>
                      <th scope="col" className="px-4 py-2.5 font-semibold">US AQI</th>
                      <th scope="col" className="px-4 py-2.5 font-semibold">PM2.5 (µg/m³)</th>
                      <th scope="col" className="px-4 py-2.5 font-semibold">PM10 (µg/m³)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-mono tabular-nums">
                    {airQuality.hourlyTrend.map((pt) => (
                      <tr key={pt.hour} className="hover:bg-slate-50">
                        <td className="px-4 py-2 text-slate-900 font-medium">{pt.hour}</td>
                        <td className="px-4 py-2 text-slate-800">{pt.aqi}</td>
                        <td className="px-4 py-2 text-slate-700">{pt.pm25}</td>
                        <td className="px-4 py-2 text-slate-700">{pt.pm10}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-slate-600 py-4">
            Hourly diurnal trend data is unavailable for this location. Check your municipal air-quality agency for hourly updates.
          </p>
        )}

        {/* Data Sources & Limitations Footer */}
        <div className="pt-3 border-t border-slate-200 text-xs text-slate-600 space-y-1">
          <div className="font-semibold text-slate-800">
            Data Source & Limitations ({airQuality.methodology})
          </div>
          <ul className="list-disc pl-5 space-y-0.5">
            {airQuality.dataLimitations.map((note, idx) => (
              <li key={idx}>{note}</li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
