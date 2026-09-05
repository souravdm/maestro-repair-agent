#!/usr/bin/env node

/**
 * Zephyr Run Reporter
 * ───────────────────
 * Invoked by scripts/testing/run-test-suite.sh when --add-zephyr-execution
 * is passed. After a suite finishes:
 *
 *   1. Creates a new Zephyr Scale Test Cycle named "<area>-regression"
 *      (area = suite file basename, e.g. homescreen-complete-suite -> homescreen).
 *   2. For every executed test, scans its Maestro flow YAML `tags:` list for
 *      a Zephyr test case key matching /^[A-Z]+-T\d+$/ (e.g. TLPCWHSAM-T639).
 *   3. Creates a Test Execution against the cycle with statusName PASS/FAIL,
 *      derived from the test's pass/fail result in suite-results.json.
 *
 * Tests whose flow file has no matching tag are skipped (no execution
 * created) — this is intentional per the tag-based opt-in design.
 *
 * Usage (called by run-test-suite.sh — not meant to be run manually):
 *   node zephyr-run-reporter.js \
 *     --suite-file   <path/to/suite.yaml> \
 *     --results-json <path/to/suite-results.json> \
 *     --platform     ios|android \
 *     --environment  qa|prod (maps to Zephyr's QA/Production environment) \
 *     --report-url   <optional file:// or http(s):// URL>
 *
 * Never fails the calling shell script — all errors are logged and the
 * process exits 0 so Zephyr reporting issues don't break the test pipeline.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ZephyrScaleClient = require('./zephyr-scale-client');
const credentials = require('../../../.maestro/config/zephyr-credentials');
const { resolveFolderId } = require('./zephyr-cycle-folders');

const PROJECT_ROOT = path.resolve(__dirname, '../../..');

// Matches Zephyr test case keys, e.g. TLPCWHSAM-T639
const TEST_CASE_KEY_RE = /^[A-Z][A-Z0-9]+-T\d+$/;

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2);
      args[key] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
    }
  }
  return args;
}

/**
 * Extract Zephyr test case keys from a Maestro flow's `tags:` list.
 * Flow files declare tags like:
 *   tags:
 *       - homescreen
 *       - TLPCWHSAM-T639
 * We only care about entries matching the Zephyr key pattern.
 */
function extractZephyrTagsFromFlow(flowFilePath) {
  try {
    const content = fs.readFileSync(flowFilePath, 'utf8');
    const tagsBlockMatch = content.match(/^tags:\s*\n((?:^\s*-\s*.+\n?)+)/m);
    if (!tagsBlockMatch) return [];
    const lines = tagsBlockMatch[1].split('\n');
    const keys = [];
    for (const line of lines) {
      const m = line.match(/^\s*-\s*(\S+)\s*$/);
      if (m && TEST_CASE_KEY_RE.test(m[1])) keys.push(m[1]);
    }
    return keys;
  } catch (e) {
    console.error(`[zephyr-run-reporter] Could not read flow file ${flowFilePath}: ${e.message}`);
    return [];
  }
}

/** Derive a human-friendly area name from the suite filename. */
function deriveAreaName(suiteFilePath) {
  const base = path.basename(suiteFilePath, path.extname(suiteFilePath));
  // Strip common suffixes like "-complete-suite", "-suite", "_suite"
  return base
    .replace(/[-_]?(complete[-_]?)?suite$/i, '')
    .replace(/_/g, '-')
    .toLowerCase() || 'automation';
}

function nameDate(d = new Date()) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const mon = months[d.getMonth()];
  const day = String(d.getDate()).padStart(2, '0');
  return `${mon}${day}-${d.getFullYear()}`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const suiteFile = args['suite-file'];
  const resultsJsonPath = args['results-json'];
  const platform = (args['platform'] || 'ios').toLowerCase();
  const environment = (args['environment'] || 'qa').toLowerCase();
  const reportUrl = args['report-url'] || '';

  // Zephyr Scale project environments are QA/Production only — Android/iOS
  // are not defined there. Map the run's ENVIRONMENT (qa|prod) to Zephyr's
  // environmentName and keep the platform label in the comment instead.
  const zephyrEnvironmentName = environment === 'prod' ? 'Production' : 'QA';

  if (!suiteFile || !resultsJsonPath) {
    console.error('[zephyr-run-reporter] --suite-file and --results-json are required. Skipping.');
    process.exit(0);
  }

  if (!credentials.isConfigured()) {
    console.error('[zephyr-run-reporter] ZEPHYR_API_TOKEN not set — skipping Zephyr reporting.');
    process.exit(0);
  }

  if (!fs.existsSync(resultsJsonPath)) {
    console.error(`[zephyr-run-reporter] Results file not found: ${resultsJsonPath} — skipping.`);
    process.exit(0);
  }

  let results;
  try {
    results = JSON.parse(fs.readFileSync(resultsJsonPath, 'utf8'));
  } catch (e) {
    console.error(`[zephyr-run-reporter] Failed to parse ${resultsJsonPath}: ${e.message} — skipping.`);
    process.exit(0);
  }

  const tests = Array.isArray(results.tests) ? results.tests : [];
  if (!tests.length) {
    console.error('[zephyr-run-reporter] No tests found in suite-results.json — skipping.');
    process.exit(0);
  }

  const area = deriveAreaName(suiteFile);
  const platformLabel = platform === 'android' ? 'Android' : platform === 'ios' ? 'iOS' : platform;
  const cycleName = `${area}-regression-${platformLabel}-${nameDate()}`;

  let client;
  try {
    client = new ZephyrScaleClient(credentials.getConfig());
  } catch (e) {
    console.error(`[zephyr-run-reporter] Failed to init Zephyr client: ${e.message} — skipping.`);
    process.exit(0);
  }

  // ── 1. Create the test cycle ──────────────────────────────────────────────
  const folderId = resolveFolderId(suiteFile);
  let cycleKey;
  try {
    const cycle = await client.createTestCycle({
      name: cycleName,
      folderId,
      description: [
        `Automated regression run — ${area}`,
        `Platform: ${platformLabel}`,
        `Suite: ${path.basename(suiteFile)}`,
        reportUrl ? `Report: ${reportUrl}` : ''
      ].filter(Boolean).join('\n'),
      status: 'In Progress'
    });
    cycleKey = cycle.key || cycle.id;
    if (!cycleKey) throw new Error('Zephyr did not return a cycle key');
    console.error(
      folderId
        ? `[zephyr-run-reporter] ✓ Created test cycle: ${cycleKey} (${cycleName}) in folderId ${folderId}`
        : `[zephyr-run-reporter] ✓ Created test cycle: ${cycleKey} (${cycleName}) — no folder mapping for this suite, created at project root`
    );
  } catch (e) {
    console.error(`[zephyr-run-reporter] ✗ Failed to create test cycle: ${e.message}`);
    process.exit(0);
  }

  // ── 2. For each test, resolve its Zephyr tag(s) and record an execution ───
  const suiteDir = path.dirname(path.resolve(PROJECT_ROOT, suiteFile));
  let created = 0, skippedNoTag = 0, failed = 0;

  for (const test of tests) {
    const flowFileAbs = test.file
      ? (path.isAbsolute(test.file) ? test.file : path.resolve(PROJECT_ROOT, test.file))
      : null;

    if (!flowFileAbs || !fs.existsSync(flowFileAbs)) {
      console.error(`[zephyr-run-reporter] ⚠ Flow file not found for test "${test.name}" — skipping.`);
      skippedNoTag++;
      continue;
    }

    const testCaseKeys = extractZephyrTagsFromFlow(flowFileAbs);
    if (!testCaseKeys.length) {
      // No Zephyr tag on this test — intentionally skip, no execution created.
      skippedNoTag++;
      continue;
    }

    const statusName = test.status === 'passed' ? 'Pass' : 'Fail';

    for (const testCaseKey of testCaseKeys) {
      try {
        await client.createTestExecution({
          testCaseKey,
          testCycleKey: cycleKey,
          status: statusName,
          executionTime: Math.round((test.duration || 0) * 1000),
          environment: zephyrEnvironmentName,
          comment: [
            `Platform: ${platformLabel}`,
            test.status === 'failed' ? `Failed in suite run: ${path.basename(suiteFile)}` : ''
          ].filter(Boolean).join(' — ')
        });
        console.error(`[zephyr-run-reporter] ✓ ${testCaseKey}: ${statusName} (${test.name})`);
        created++;
      } catch (e) {
        console.error(`[zephyr-run-reporter] ✗ Failed to create execution for ${testCaseKey} (${test.name}): ${e.message}`);
        failed++;
      }
    }
  }

  console.error(
    `[zephyr-run-reporter] Done. Cycle: ${cycleKey} — ` +
    `${created} execution(s) created, ${skippedNoTag} test(s) skipped (no Zephyr tag), ${failed} error(s).`
  );
  process.exit(0);
}

main().catch(e => {
  console.error(`[zephyr-run-reporter] Unhandled error: ${e.message} — non-fatal, continuing.`);
  process.exit(0);
});
