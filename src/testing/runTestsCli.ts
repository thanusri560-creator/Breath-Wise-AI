import { runAllBreatheWiseTests } from './testSuite.ts';

async function main() {
  const summary = await runAllBreatheWiseTests();

  console.log('\n======================================================');
  console.log('  BreatheWise AI — Automated Verification Test Suite');
  console.log('======================================================');

  for (const r of summary.results) {
    const badge = r.passed ? '[PASS]' : '[FAIL]';
    console.log(`${badge} (${r.category.toUpperCase()}) ${r.name} — ${r.durationMs.toFixed(2)} ms`);
    if (!r.passed && r.error) {
      console.error(`       Error: ${r.error}`);
    }
  }

  console.log('------------------------------------------------------');
  console.log(
    `Total: ${summary.total} | Passed: ${summary.passed} | Failed: ${summary.failed} | Duration: ${summary.totalDurationMs.toFixed(2)} ms`
  );
  console.log('======================================================\n');

  if (summary.failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
});
