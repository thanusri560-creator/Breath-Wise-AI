import { useState } from 'react';
import { CloudFog, Table } from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AirQualityReading } from '../domain/airQualityTypes';

interface DiurnalTrendCardProps {
  airQuality: AirQualityReading;
}

/**
 * Displays the 24-hour diurnal AQI & PM2.5 curve with an accessible toggleable
 * data table and transparent data-provenance limitations footer.
 */
export function DiurnalTrendCard({ airQuality }: DiurnalTrendCardProps) {
  const [showDataTable, setShowDataTable] = useState(false);

  return (
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
            <CloudFog aria-hidden="true" className="w-5 h-5 text-teal-700" />
            <span>Diurnal AQI &amp; PM2.5 Inversion Curve</span>
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
          <Table aria-hidden="true" className="w-3.5 h-3.5" />
          <span>{showDataTable ? 'Hide Accessible Data Table' : 'View Accessible Data Table'}</span>
        </button>
      </div>

      {airQuality.hourlyTrend.length > 0 ? (
        <>
          <div
            className="h-64 w-full"
            role="img"
            aria-label={`Line chart of hourly AQI and PM2.5 in ${airQuality.cityName}`}
          >
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

      <div className="pt-3 border-t border-slate-200 text-xs text-slate-600 space-y-1">
        <div className="font-semibold text-slate-800">
          Data Source &amp; Limitations ({airQuality.methodology})
        </div>
        <ul className="list-disc pl-5 space-y-0.5">
          {airQuality.dataLimitations.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}
