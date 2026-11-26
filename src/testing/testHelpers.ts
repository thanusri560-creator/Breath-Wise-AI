import type { TestCaseResult, TestCategory } from '../domain/airQualityTypes';

export function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

export async function runCase(
  id: string,
  name: string,
  category: TestCategory,
  fn: () => string | Promise<string>
): Promise<TestCaseResult> {
  const start = performance.now();
  try {
    const details = await fn();
    return {
      id,
      name,
      category,
      passed: true,
      durationMs: Math.max(0.01, performance.now() - start),
      details,
    };
  } catch (err) {
    return {
      id,
      name,
      category,
      passed: false,
      durationMs: Math.max(0.01, performance.now() - start),
      details: 'Assertion failed',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
