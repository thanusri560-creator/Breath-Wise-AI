import type { TestSuiteSummary } from '../domain/airQualityTypes';
import { runEdgeCaseTests } from './edgeCaseTests';
import { runIntegrationTests } from './integrationTests';
import { runStressTests } from './stressTests';
import { runUnitTests } from './unitTests';

export async function runAllBreatheWiseTests(): Promise<TestSuiteSummary> {
  const suiteStart = performance.now();

  const results = [
    ...(await runUnitTests()),
    ...(await runIntegrationTests()),
    ...(await runEdgeCaseTests()),
    ...(await runStressTests()),
  ];

  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;

  return {
    total: results.length,
    passed,
    failed,
    totalDurationMs: Math.max(0.1, performance.now() - suiteStart),
    executedAt: new Date().toISOString(),
    results,
  };
}
