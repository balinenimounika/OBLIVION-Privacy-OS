/**
 * OBLIVION - Phase 4 Master Test Suite Runner
 *
 * Sequentially executes all Phase 4 module integration test suites against PostgreSQL 18.6:
 * - Module 1: Websites API (16 tests)
 * - Module 2 & 3: Exposure Records & Data Categories API (15 tests)
 * - Module 4 & 5: Removal Requests & Request History API (15 tests)
 * - Module 6: Reminders API (13 tests)
 * - Module 7: Notifications API (9 tests)
 * - Module 8: Dashboard Analytics API (6 tests)
 */

import { spawn } from 'child_process';
import path from 'path';

interface SuiteResult {
  module: string;
  command: string;
  passed: boolean;
  exitCode: number;
}

const suites = [
  { module: 'Module 1: Websites API', file: 'tests/website.test.ts' },
  { module: 'Module 2 & 3: Exposures & Categories', file: 'tests/exposure.test.ts' },
  { module: 'Module 4 & 5: Removals & History', file: 'tests/removal-request.test.ts' },
  { module: 'Module 6: Reminders API', file: 'tests/reminder.test.ts' },
  { module: 'Module 7: Notifications API', file: 'tests/notification.test.ts' },
  { module: 'Module 8: Dashboard Analytics', file: 'tests/dashboard.test.ts' },
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

async function runAll() {
  console.log('================================================================');
  console.log('OBLIVION PHASE 4 MASTER INTEGRATION TEST RUNNER');
  console.log('Target Database: PostgreSQL 18.6 (oblivion_db)');
  console.log('Modules: Websites, Exposures, Categories, Removals, Reminders,');
  console.log('         Notifications, Dashboard Analytics');
  console.log('================================================================\n');

  const results: SuiteResult[] = [];
  let allPassed = true;

  for (const s of suites) {
    console.log(`\n▶ Starting Suite: ${s.module} (${s.file})...`);
    const { code } = await runCommand(s.file);
    const passed = code === 0;
    if (!passed) allPassed = false;
    results.push({
      module: s.module,
      command: `npx ts-node ${s.file}`,
      passed,
      exitCode: code,
    });
  }

  console.log('\n================================================================');
  console.log('PHASE 4 MASTER EXECUTION SUMMARY');
  console.log('================================================================');
  results.forEach((r) => {
    console.log(`${r.passed ? '✅' : '❌'} ${r.module}: ${r.passed ? 'ALL TESTS PASSED' : `FAILED (Exit Code ${r.exitCode})`}`);
  });
  console.log('================================================================');
  const passedCount = results.filter((r) => r.passed).length;
  console.log(`SUITES PASSED: ${passedCount}/${results.length} | OVERALL STATUS: ${allPassed ? '100% GREEN' : 'FAILED'}`);
  console.log('================================================================\n');

  process.exit(allPassed ? 0 : 1);
}

runAll();
