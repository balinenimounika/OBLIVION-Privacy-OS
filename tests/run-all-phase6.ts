/**
 * OBLIVION - Phase 6 Master Test Suite Runner
 *
 * Sequentially executes all Phase 6 full integration, security,
 * database integrity, and performance test suites against PostgreSQL 18.6:
 * - Suite 1: End-to-End User Journey (16 steps)
 * - Suite 2: Security & Vulnerability Test Suite (20 tests)
 * - Suite 3: Database Integrity & Relational Verification (15 tests)
 * - Suite 4: Performance, Scaled Pagination & Reliability (6 tests)
 */

import { spawn } from 'child_process';

interface SuiteResult {
  module: string;
  file: string;
  passed: boolean;
  exitCode: number;
}

const suites = [
  { module: 'Suite 1: End-to-End 16-Step User Journey', file: 'tests/e2e-workflow.test.ts' },
  { module: 'Suite 2: Security & Vulnerability Controls', file: 'tests/security.test.ts' },
  { module: 'Suite 3: Database Integrity & Relational Constraints', file: 'tests/database-integrity.test.ts' },
  { module: 'Suite 4: Performance, Scaled Pagination & Reliability', file: 'tests/performance-reliability.test.ts' },
];

async function runCommand(file: string): Promise<{ code: number }> {
  return new Promise((resolve) => {
    const isWindows = process.platform === 'win32';
    const npxCmd = isWindows ? 'npx.cmd' : 'npx';
    const child = spawn(npxCmd, ['ts-node', file], {
      stdio: 'inherit',
      shell: true,
      env: process.env,
    });

    child.on('close', (code) => {
      resolve({ code: code ?? 1 });
    });
  });
}

async function runAllPhase6() {
  console.log('================================================================');
  console.log('OBLIVION PHASE 6 MASTER INTEGRATION & REGRESSION TEST RUNNER');
  console.log('Target Database: PostgreSQL 18.6 (oblivion_db)');
  console.log('Suites: E2E Lifecycle, Security Controls, DB Integrity, Performance');
  console.log('================================================================\n');

  const results: SuiteResult[] = [];
  let allPassed = true;

  for (const s of suites) {
    console.log(`\n▶ Starting: ${s.module} (${s.file})...`);
    const { code } = await runCommand(s.file);
    const passed = code === 0;
    if (!passed) allPassed = false;
    results.push({
      module: s.module,
      file: s.file,
      passed,
      exitCode: code,
    });
  }

  console.log('\n================================================================');
  console.log('PHASE 6 MASTER EXECUTION SUMMARY');
  console.log('================================================================');
  results.forEach((r) => {
    console.log(`${r.passed ? '✅' : '❌'} ${r.module}: ${r.passed ? 'ALL TESTS PASSED' : `FAILED (Exit Code ${r.exitCode})`}`);
  });
  console.log('================================================================');
  const passedSuites = results.filter((r) => r.passed).length;
  console.log(`SUITES PASSED: ${passedSuites}/${results.length} | OVERALL STATUS: ${allPassed ? '100% GREEN' : 'TESTS FAILED'}`);
  console.log('================================================================\n');

  process.exit(allPassed ? 0 : 1);
}

runAllPhase6().catch((err) => {
  console.error('Fatal Phase 6 Runner Error:', err);
  process.exit(1);
});
