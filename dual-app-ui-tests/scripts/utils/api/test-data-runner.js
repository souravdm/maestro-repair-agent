#!/usr/bin/env node

/**
 * Test Data Runner
 * Runs all API requests for all (or specified) users and generates
 * a detailed test-data HTML report with per-user expandable sections.
 *
 * Usage:
 *   node test-data-runner.js
 *   node test-data-runner.js --users all
 *   node test-data-runner.js --users ELIZABETH_MILLER,CARL_GREEN
 *   node test-data-runner.js --env qa --users all
 *   node test-data-runner.js --parallel
 *   node test-data-runner.js --users all --parallel
 *   node test-data-runner.js --failed-only
 *   node test-data-runner.js --failed-only --parallel
 *   node test-data-runner.js --failed-only --report-dir artifacts/api/tests/test-data-report-2026-04-14T22-08-38
 *   node test-data-runner.js --app cvs
 *   node test-data-runner.js --app h100
 *   node test-data-runner.js --app both   (default)
 *   node test-data-runner.js --parallel --parallel-delay 3000
 *   node test-data-runner.js --parallel --parallel-delay 1000 --request-delay 300
 *   node test-data-runner.js --request-delay 500
 *   node test-data-runner.js --coverage-config path/to/nba-coverage.yaml
 *   node test-data-runner.js --fail-on-missing-coverage
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const TestDataReportGenerator = require('./lib/test-data-report-generator');
const NbaCoverageChecker = require('./lib/nba-coverage-checker');
const { getUser, getUsers } = require('./lib/test-data-loader');

const ARTIFACTS_DIR = path.join(__dirname, '../../..', 'artifacts/api/tests');
const REQUESTS_DIR  = path.join(__dirname, 'requests');

const CVS_SUITES  = ['01-authenticated', '02-pe', '03-benefits'];
const H100_SUITES = ['h100/01-authenticated', 'h100/02-pe', 'h100/03-benefits', 'h100/05-home'];

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const colors = {
  reset:  '\x1b[0m',
  bright: '\x1b[1m',
  dim:    '\x1b[2m',
  red:    '\x1b[31m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  blue:   '\x1b[34m',
  cyan:   '\x1b[36m'
};

// ── CLI args ─────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const cfg = {
    env:        'qa2',
    baseURL:    'https://www-qa2.cvs.com',
    h100BaseURL: 'https://api.qa2.health100.com',
    users:      'all',
    app:        'both',
    parallel:      true,
    parallelDelay: 1000,
    requestDelay:  500,
    failedOnly:    false,
    reportDir:     null,
    apiKey:     process.env.CVS_API_KEY      || 'FHbLTRk49KzXrKDrWWcHVGOVUvnIyVFz',
    h100ApiKey: process.env.H100_API_KEY    || 'PRX4fYhAfVTr3UH3tSOTlb9oYNrAPUjA',
    visitorId:  process.env.CVS_VISITOR_ID  || '550e8400-e29b-41d4-a716-446655440000',
    coverageConfig:        path.join(__dirname, 'coverage/nba-coverage.yaml'),
    failOnMissingCoverage: false
  };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--env'           && args[i+1]) { cfg.env        = args[++i]; }
    if (args[i] === '--base-url'      && args[i+1]) { cfg.baseURL    = args[++i]; }
    if (args[i] === '--users'         && args[i+1]) { cfg.users      = args[++i]; }
    if (args[i] === '--app'           && args[i+1]) { cfg.app        = args[++i]; }
    if (args[i] === '--h100-api-key'  && args[i+1]) { cfg.h100ApiKey = args[++i]; }
    if (args[i] === '--parallel')                             { cfg.parallel      = true; }
    if (args[i] === '--parallel-delay' && args[i+1])          { cfg.parallelDelay = parseInt(args[++i], 10) || 0; }
    if (args[i] === '--request-delay'  && args[i+1])          { cfg.requestDelay  = parseInt(args[++i], 10) || 0; }
    if (args[i] === '--failed-only')                          { cfg.failedOnly    = true; }
    if (args[i] === '--report-dir' && args[i+1]) { cfg.reportDir = args[++i]; }
    if (args[i] === '--coverage-config' && args[i+1])         { cfg.coverageConfig = args[++i]; }
    if (args[i] === '--fail-on-missing-coverage')             { cfg.failOnMissingCoverage = true; }
  }
  return cfg;
}

// ── Failed-only user resolution ───────────────────────────────────────────────

function findLatestReportDir(artifactsDir) {
  if (!fs.existsSync(artifactsDir)) return null;
  const dirs = fs.readdirSync(artifactsDir)
    .filter(f => f.startsWith('test-data-report-'))
    .map(f => ({ name: f, mtime: fs.statSync(path.join(artifactsDir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  return dirs.length ? path.join(artifactsDir, dirs[0].name) : null;
}

function resolveFailedUsers(reportDir, env) {
  const jsonPath = path.join(reportDir, 'test-data.json');
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`Report JSON not found: ${jsonPath}`);
  }
  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const failedKeys = [];
  for (const [user, requests] of Object.entries(data)) {
    const hasFailed = Object.values(requests).some(r => !r.success);
    if (hasFailed) failedKeys.push(user);
  }
  return failedKeys;
}

// ── Request loading ───────────────────────────────────────────────────────────

function loadSuiteRequests(suites) {
  const requests = [];
  suites.forEach(suite => {
    requests.push(...loadRequestsFromDir(path.join(REQUESTS_DIR, suite)));
  });
  return requests;
}

function loadRequestsFromDir(dir) {
  const requests = [];
  if (!fs.existsSync(dir)) return requests;
  fs.readdirSync(dir).sort().forEach(file => {
    const fp = path.join(dir, file);
    if (fs.statSync(fp).isDirectory()) {
      requests.push(...loadRequestsFromDir(fp));
    } else if (file.endsWith('.js') && !file.startsWith('_')) {
      try {
        const req = require(fp);
        if (req && req.execute) requests.push(req);
      } catch (e) {
        console.error(`${colors.red}Error loading ${file}: ${e.message}${colors.reset}`);
      }
    }
  });
  return requests;
}

// ── Session execution ─────────────────────────────────────────────────────────

async function executeRequest(request, config) {
  try {
    return await request.execute(config);
  } catch (err) {
    return { name: request.name, method: request.method, success: false, error: err.message, data: null };
  }
}

async function runForUser(requests, userCfg, appTag = 'cvs') {
  const label   = userCfg.key || userCfg.userEmail || 'user';
  const results = [];
  let sessionCfg = { ...userCfg };

  for (let reqIdx = 0; reqIdx < requests.length; reqIdx++) {
    const req  = requests[reqIdx];
    const name = req.name || 'unknown';

    if (reqIdx > 0 && sessionCfg.requestDelay > 0) await sleep(sessionCfg.requestDelay);

    if (typeof req.condition === 'function' && !req.condition(sessionCfg)) {
      console.log(`  [${colors.cyan}${label}${colors.reset}][${appTag}] ${name}... ${colors.dim}⊘ SKIP${colors.reset} — condition not met`);
      results.push({ name, method: req.method, success: true, skipped: true, conditionSkipped: true, data: null, user: label, app: appTag });
      continue;
    }

    process.stdout.write(`  [${colors.cyan}${label}${colors.reset}][${appTag}] ${name}... `);

    const result   = await executeRequest(req, sessionCfg);
    result.user    = label;
    result.app     = appTag;
    results.push(result);

    if (result.success) {
      console.log(`${colors.green}✅ PASS${colors.reset} (${result.statusCode})`);
      if (typeof req.extract === 'function') {
        const extracted = req.extract(result.data);
        if (Object.keys(extracted).length) sessionCfg = { ...sessionCfg, ...extracted };
      }
      if (typeof req.extractData === 'function') {
        result.extractedData = req.extractData(result.data);
      }
    } else if (req.allowFailure) {
      result.skipped = true;
      console.log(`${colors.yellow}⚠ SKIP${colors.reset} (${result.statusCode || 'ERROR'}) — expected, continuing`);
      if (typeof req.extract === 'function') {
        const extracted = req.extract(result.data);
        if (extracted && Object.keys(extracted).length) sessionCfg = { ...sessionCfg, ...extracted };
      }
    } else {
      console.log(`${colors.red}❌ FAIL${colors.reset} (${result.statusCode || 'ERROR'}) — aborting session`);
      break;
    }
  }

  return results;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const cfg = parseArgs();

  console.log(`\n${colors.blue}${'='.repeat(70)}${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}CVS API — Test Data Runner${colors.reset}`);
  console.log(`${colors.blue}${'='.repeat(70)}${colors.reset}\n`);
  console.log(`  Environment : ${colors.bright}${cfg.env}${colors.reset}`);
  console.log(`  App         : ${colors.bright}${cfg.app}${colors.reset}`);
  console.log(`  Users       : ${colors.bright}${cfg.users}${colors.reset}\n`);

  // Resolve users
  let users;
  try {
    if (cfg.failedOnly) {
      const reportDir = cfg.reportDir || findLatestReportDir(ARTIFACTS_DIR);
      if (!reportDir) {
        console.error(`${colors.red}❌ No report found in ${ARTIFACTS_DIR}. Run a full report first.${colors.reset}\n`);
        process.exit(1);
      }
      console.log(`  Report Dir  : ${colors.bright}${reportDir}${colors.reset}`);
      const failedKeys = resolveFailedUsers(reportDir, cfg.env);
      if (!failedKeys.length) {
        console.log(`${colors.green}✅ No failed users found in the report — nothing to retry.${colors.reset}\n`);
        process.exit(0);
      }
      console.log(`  Failed Users: ${colors.red}${failedKeys.join(', ')}${colors.reset}\n`);
      users = failedKeys.map(k => getUser(k.trim(), cfg.env));
    } else {
      users = cfg.users === 'all'
        ? getUsers(cfg.env)
        : cfg.users.split(',').map(k => getUser(k.trim(), cfg.env));
    }
  } catch (err) {
    console.error(`${colors.red}❌ ${err.message}${colors.reset}\n`);
    process.exit(1);
  }

  const shouldRunCvs  = cfg.app !== 'h100';
  const shouldRunH100 = cfg.app !== 'cvs';

  const cvsRequests  = shouldRunCvs  ? loadSuiteRequests(CVS_SUITES)  : [];
  const h100Requests = shouldRunH100 ? loadSuiteRequests(H100_SUITES) : [];
  const totalRequests = cvsRequests.length + h100Requests.length;

  if (!totalRequests) {
    console.error(`${colors.red}❌ No requests found for app: ${cfg.app}${colors.reset}\n`);
    process.exit(1);
  }

  if (shouldRunCvs)  console.log(`  CVS  requests : ${colors.bright}${cvsRequests.length}${colors.reset}`);
  if (shouldRunH100) console.log(`  H100 requests : ${colors.bright}${h100Requests.length}${colors.reset}`);

  const mode = cfg.parallel
    ? `parallel (stagger: ${cfg.parallelDelay}ms)`
    : 'sequential';
  console.log(`\n${colors.cyan}Running ${totalRequests} request(s) for ${users.length} user(s) — ${mode}${colors.reset}\n`);

  const startTime = Date.now();
  const allResults = [];

  async function runBothSuitesForUser(user) {
    const base = {
      ...cfg,
      key:       user.key,
      userEmail: user.email || user.userEmail || '',
      dob:       user.dob  || user.dateOfBirth || '',
      _userKey:  user.key
    };
    const results = [];
    if (cvsRequests.length) {
      results.push(...await runForUser(cvsRequests, base, 'cvs'));
    }
    if (h100Requests.length) {
      results.push(...await runForUser(h100Requests, base, 'h100'));
    }
    return results;
  }

  if (cfg.parallel) {
    const userResultsArray = await Promise.all(
      users.map((user, i) => {
        const delay = i * cfg.parallelDelay;
        return (delay > 0 ? sleep(delay) : Promise.resolve())
          .then(() => runBothSuitesForUser(user));
      })
    );
    userResultsArray.forEach(results => allResults.push(...results));
    console.log('');
  } else {
    for (const user of users) {
      const results = await runBothSuitesForUser(user);
      allResults.push(...results);
      console.log('');
    }
  }
  const endTime = Date.now();
  const totalMs = endTime - startTime;
  const totalSec = (totalMs / 1000).toFixed(2);

  // Generate reports
  const reportGen = new TestDataReportGenerator(ARTIFACTS_DIR);
  const { htmlPath, jsonPath } = reportGen.saveReport(allResults, { env: cfg.env });

  console.log(`${colors.cyan}Reports generated:${colors.reset}`);
  console.log(`  HTML : ${colors.bright}${htmlPath}${colors.reset}`);
  console.log(`  JSON : ${colors.bright}${jsonPath}${colors.reset}`);
  console.log(`  Time : ${colors.bright}${totalSec}s${colors.reset}\n`);

  // NBA/benefits coverage check — did the test-data user pool exercise every ANBA/DNBA/
  // benefit/flag we expect to see, per app? Non-fatal unless --fail-on-missing-coverage.
  let coverageFullyCovered = true;
  if (fs.existsSync(cfg.coverageConfig)) {
    const checker = new NbaCoverageChecker(cfg.coverageConfig);
    const coverage = checker.checkCoverage(allResults);
    coverageFullyCovered = checker.isFullyCovered(coverage);

    const coverageDir = path.dirname(jsonPath);
    const coverageJsonPath = path.join(coverageDir, 'nba-coverage.json');
    const coverageMdPath   = path.join(coverageDir, 'nba-coverage.md');
    fs.writeFileSync(coverageJsonPath, JSON.stringify(coverage, null, 2), 'utf8');
    fs.writeFileSync(coverageMdPath, checker.toMarkdownTable(coverage), 'utf8');

    console.log(`${colors.cyan}NBA/Benefits Coverage:${colors.reset} ${checker.toConsoleSummary(coverage)}`);
    console.log(`  Coverage JSON : ${colors.bright}${coverageJsonPath}${colors.reset}`);
    console.log(`  Coverage MD   : ${colors.bright}${coverageMdPath}${colors.reset}\n`);
  } else {
    console.log(`${colors.yellow}⚠ Coverage config not found at ${cfg.coverageConfig} — skipping coverage check.${colors.reset}\n`);
  }

  const openCmd = process.platform === 'win32' ? `start "" "${htmlPath}"`
    : process.platform === 'darwin'             ? `open "${htmlPath}"`
    :                                             `xdg-open "${htmlPath}"`;
  exec(openCmd, err => {
    if (err) console.log(`${colors.dim}  (Could not auto-open report: ${err.message})${colors.reset}`);
  });

  const failed = allResults.filter(r => !r.success && !r.skipped).length;
  const passed = allResults.filter(r => r.success && !r.skipped).length;
  const skipped = allResults.filter(r => r.skipped).length;
  console.log(`${colors.cyan}Summary:${colors.reset}`);
  console.log(`  Passed  : ${colors.green}${passed}${colors.reset}`);
  console.log(`  Skipped : ${colors.yellow}${skipped}${colors.reset}`);
  console.log(`  Failed  : ${colors.red}${failed}${colors.reset}\n`);
  if (failed > 0) {
    console.log(`${colors.yellow}⚠ Check the report for details.${colors.reset}\n`);
  } else {
    console.log(`${colors.green}✅ All requests passed or skipped as expected.${colors.reset}\n`);
  }

  if (!coverageFullyCovered) {
    console.log(`${colors.yellow}⚠ Some configured NBAs/benefits/flags were not covered — see nba-coverage.md.${colors.reset}\n`);
    if (cfg.failOnMissingCoverage) process.exit(1);
  }
}

main().catch(err => {
  console.error(`${colors.red}Fatal: ${err.message}${colors.reset}\n`);
  process.exit(1);
});
