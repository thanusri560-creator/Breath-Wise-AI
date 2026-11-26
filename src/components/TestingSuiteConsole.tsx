import { useEffect, useState } from 'react';
import {
  FlaskConical,
  Play,
} from 'lucide-react';
import type { TestCategory, TestSuiteSummary } from '../domain/airQualityTypes';
import { runAllBreatheWiseTests } from '../testing/testSuite';
import { StatusIndicator } from './StatusIndicator';

export function TestingSuiteConsole() {
  const [summary, setSummary] = useState<TestSuiteSummary | null>(null);
  const [manualRunning, setManualRunning] = useState(false);
  const [filter, setFilter] = useState<'all' | TestCategory>('all');

  const running = manualRunning || summary === null;

  const executeSuite = async () => {
    setManualRunning(true);
    const result = await runAllBreatheWiseTests();
    setSummary(result);
    setManualRunning(false);
  };

  useEffect(() => {
    let active = true;
    void runAllBreatheWiseTests().then((result) => {
      if (active) {
        setSummary(result);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const visibleResults = summary
    ? filter === 'all'
      ? summary.results
      : summary.results.filter((r) => r.category === filter)
    : [];

  return (
    <div className="space-y-6">
      <section className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-900 flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-teal-700" />
              <span>Automated Engineering Verification Suite</span>
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Executable Unit, Integration, Edge-Case, and Stress tests verifying EPA AQI formulas, prompt-injection sanitization, AI response validation, What-If conflict detection, and high-volume performance.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void executeSuite()}
            disabled={running}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
          >
            <Play className="w-4 h-4" />
            <span>{running ? 'Running Tests...' : 'Re-Run All Tests'}</span>
          </button>
        </div>

        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-slate-200">
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
              <div className="text-xs text-slate-500 font-semibold uppercase">Total Assertions</div>
              <div className="mt-1 font-mono tabular-nums text-2xl font-bold text-slate-900">
                {summary.total}
              </div>
            </div>
            <div className="p-4 rounded-lg bg-teal-50 border border-teal-200">
              <div className="text-xs text-teal-800 font-semibold uppercase">Passed</div>
              <div className="mt-1 font-mono tabular-nums text-2xl font-bold text-teal-800">
                {summary.passed}
              </div>
            </div>
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
              <div className="text-xs text-slate-500 font-semibold uppercase">Failed</div>
              <div
                className={`mt-1 font-mono tabular-nums text-2xl font-bold ${
                  summary.failed > 0 ? 'text-rose-700' : 'text-slate-900'
                }`}
              >
                {summary.failed}
              </div>
            </div>
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
              <div className="text-xs text-slate-500 font-semibold uppercase">Execution Time</div>
              <div className="mt-1 font-mono tabular-nums text-2xl font-bold text-slate-900">
                {summary.totalDurationMs.toFixed(1)} ms
              </div>
            </div>
          </div>
        )}

        {/* Category Filters */}
        <div className="flex flex-wrap gap-2 pt-2">
          {(['all', 'unit', 'integration', 'edge-case', 'stress'] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setFilter(cat)}
              aria-pressed={filter === cat}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 ${
                filter === cat
                  ? 'bg-[#0B1220] text-white border-[#0B1220]'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
            >
              {cat === 'all' ? 'All Suites' : `${cat} tests`}
            </button>
          ))}
        </div>
      </section>

      {/* Accessible Results Table */}
      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <caption className="sr-only">Automated BreatheWise AI test suite results</caption>
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold">Status</th>
                <th scope="col" className="px-4 py-3 font-semibold">Category</th>
                <th scope="col" className="px-4 py-3 font-semibold">Test Case</th>
                <th scope="col" className="px-4 py-3 font-semibold">Verified Outcome</th>
                <th scope="col" className="px-4 py-3 font-semibold text-right">Duration</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {visibleResults.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3">
                    <StatusIndicator
                      tone={t.passed ? 'feasible' : 'critical'}
                      label={t.passed ? 'PASS' : 'FAIL'}
                    />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs uppercase text-slate-600">
                    {t.category}
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{t.name}</td>
                  <td className="px-4 py-3 text-xs text-slate-600">
                    {t.passed ? t.details : t.error || t.details}
                  </td>
                  <td className="px-4 py-3 font-mono tabular-nums text-xs text-slate-600 text-right">
                    {t.durationMs.toFixed(2)} ms
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
