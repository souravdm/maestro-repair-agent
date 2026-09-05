#!/usr/bin/env node

/**
 * API Test Runner
 * Executes test suites from the requests folder structure
 * Usage: node runner.js [--suite <suite-name>] [--env <environment>]
 */

const fs = require('fs');
const path = require('path');
const ReportGenerator = require('./lib/report-generator');

// Configuration
const ARTIFACTS_DIR = path.join(__dirname, '../../..', 'artifacts/api/tests');
const REQUESTS_DIR = path.join(__dirname, 'requests');
const { getUser, getUsers, getUserKeys } = require('./lib/test-data-loader');

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    suite: 'all',
    app: 'all',
    env: 'qa2',
    baseURL: 'https://www-qa2.cvs.com',
    h100BaseURL: 'https://api.qa2.health100.com',
    apiKey:     process.env.CVS_API_KEY   || 'FHbLTRk49KzXrKDrWWcHVGOVUvnIyVFz',
    h100ApiKey: process.env.H100_API_KEY  || 'PRX4fYhAfVTr3UH3tSOTlb9oYNrAPUjA',
    visitorId:  process.env.CVS_VISITOR_ID || '550e8400-e29b-41d4-a716-446655440000',
    userEmail: process.env.CVS_USER_EMAIL || '',
    // Multi-user options
    users: null,       // comma-separated user keys, or 'all'
    parallel: true,    // run users concurrently
    parallelDelay: 1000,
    requestDelay: 0,
    continueOnFailure: false
  };

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--suite' && args[i + 1]) {
      config.suite = args[i + 1];
      i++;
    } else if (args[i] === '--app' && args[i + 1]) {
      config.app = args[i + 1].toLowerCase();
      i++;
    } else if (args[i] === '--env' && args[i + 1]) {
      config.env = args[i + 1];
      i++;
    } else if (args[i] === '--base-url' && args[i + 1]) {
      config.baseURL = args[i + 1];
      i++;
    } else if (args[i] === '--h100-api-key' && args[i + 1]) {
      config.h100ApiKey = args[i + 1];
      i++;
    } else if (args[i] === '--users' && args[i + 1]) {
      config.users = args[i + 1];
      i++;
    } else if (args[i] === '--parallel') {
      config.parallel = true;
    } else if (args[i] === '--parallel-delay' && args[i + 1]) {
      config.parallelDelay = parseInt(args[i + 1], 10) || 0;
      i++;
    } else if (args[i] === '--request-delay' && args[i + 1]) {
      config.requestDelay = parseInt(args[i + 1], 10) || 0;
      i++;
    } else if (args[i] === '--continue') {
      config.continueOnFailure = true;
    }
  }

  return config;
}

/**
 * Load all request modules from a directory
 */
function loadRequestsFromDir(dirPath) {
  const requests = [];

  if (!fs.existsSync(dirPath)) {
    return requests;
  }

  const files = fs.readdirSync(dirPath);

  files.forEach(file => {
    const filePath = path.join(dirPath, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // Recursively load from subdirectories
      requests.push(...loadRequestsFromDir(filePath));
    } else if (file.endsWith('.js') && !file.startsWith('_')) {
      try {
        const request = require(filePath);
        if (request && request.execute) {
          requests.push(request);
        }
      } catch (error) {
        console.error(`${colors.red}Error loading ${file}: ${error.message}${colors.reset}`);
      }
    }
  });

  return requests;
}

/**
 * Resolve one or more root directories to load requests from, based on --app.
 *   app='cvs'  → [requests/]                       (CVS files live at top level;
 *                                                   requests/h100 is skipped)
 *   app='h100' → [requests/h100/]
 *   app='all'  → [requests/] (loads both CVS + h100 recursively)
 */
function getAppRoots(app) {
  const H100_DIR = path.join(REQUESTS_DIR, 'h100');

  if (app === 'h100') {
    return [H100_DIR];
  }
  if (app === 'cvs') {
    return [REQUESTS_DIR];
  }
  if (app === 'all') {
    // Top-level (CVS) + h100 subtree. Filtering below prevents double-loading h100.
    return fs.existsSync(H100_DIR) ? [REQUESTS_DIR, H100_DIR] : [REQUESTS_DIR];
  }
  console.warn(`${colors.yellow}⚠ Unknown --app value: ${app}, defaulting to 'all'${colors.reset}`);
  return fs.existsSync(H100_DIR) ? [REQUESTS_DIR, H100_DIR] : [REQUESTS_DIR];
}

/**
 * True if a path lives under requests/h100/.
 */
function isH100Path(p) {
  const rel = path.relative(REQUESTS_DIR, p);
  return rel === 'h100' || rel.startsWith(`h100${path.sep}`);
}

/**
 * List immediate subdirectories of a root directory.
 */
function listSubdirs(root) {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root).filter(entry => {
    const full = path.join(root, entry);
    return fs.statSync(full).isDirectory();
  });
}

/**
 * Get requests for a specific suite, filtered by app.
 * Supports exact folder names or suffix matching for numbered folders
 * e.g. --suite authenticated matches 01-authenticated
 */
function getRequestsForSuite(suite, app = 'all') {
  const roots = getAppRoots(app);
  const results = [];

  for (const root of roots) {
    if (!fs.existsSync(root)) continue;

    if (suite === 'all') {
      // When scanning the top-level requests/ dir under 'cvs' or 'all', skip the
      // h100/ subtree — under 'all' the h100 root is scanned separately, and under
      // 'cvs' h100 files should not be included at all.
      if ((app === 'cvs' || app === 'all') && root === REQUESTS_DIR) {
        results.push(...loadRequestsFiltered(root, filePath => !isH100Path(filePath)));
      } else {
        results.push(...loadRequestsFromDir(root));
      }
      continue;
    }

    // Try exact match first
    const exactDir = path.join(root, suite);
    if (fs.existsSync(exactDir)) {
      results.push(...loadRequestsFromDir(exactDir));
      continue;
    }

    // Try suffix match for numbered folders (e.g. "authenticated" → "01-authenticated")
    const match = listSubdirs(root).find(dir => dir === suite || dir.endsWith(`-${suite}`));
    if (match) {
      results.push(...loadRequestsFromDir(path.join(root, match)));
    }
  }

  return results;
}

/**
 * Same as loadRequestsFromDir but applies a filter predicate on each file path.
 */
function loadRequestsFiltered(dirPath, predicate) {
  const requests = [];
  if (!fs.existsSync(dirPath)) return requests;

  const files = fs.readdirSync(dirPath);
  files.forEach(file => {
    const filePath = path.join(dirPath, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      requests.push(...loadRequestsFiltered(filePath, predicate));
    } else if (file.endsWith('.js') && !file.startsWith('_') && predicate(filePath)) {
      try {
        const request = require(filePath);
        if (request && request.execute) {
          requests.push(request);
        }
      } catch (error) {
        console.error(`${colors.red}Error loading ${file}: ${error.message}${colors.reset}`);
      }
    }
  });

  return requests;
}

/**
 * Execute a single request
 */
async function executeRequest(request, config) {
  try {
    const result = await request.execute(config);
    return result;
  } catch (error) {
    return {
      name: request.name,
      method: request.method,
      statusCode: 0,
      success: false,
      error: error.message,
      timing: 0
    };
  }
}

/**
 * Build a user-specific config by merging testdata user fields over the base config.
 * Maps testdata field names to the keys request files expect.
 */
function buildUserConfig(baseConfig, user) {
  return {
    ...baseConfig,
    userEmail: user.email || baseConfig.userEmail,
    password: user.password || '',
    dob: user.dob || '',
    phoneNumber: user.phoneNumber || '',
    profileId: user.profileId || '',
    extracareCard: user.ecNumber || '',
    firstName: user.firstName || '',
    lastName: user.lastName || '',
    _userKey: user.key || 'unknown'
  };
}

/**
 * Print failure details to the console.
 */
function printFailureDetails(result) {
  if (result.error) {
    console.log(`     ${colors.red}Error: ${result.error}${colors.reset}`);
  }
  if (result.data !== undefined && result.data !== null) {
    const body = typeof result.data === 'string' ? result.data : JSON.stringify(result.data, null, 2);
    const preview = body.length > 800 ? body.slice(0, 800) + '\n     ...' : body;
    console.log(`     ${colors.dim}Response:${colors.reset}`);
    preview.split('\n').forEach(line => console.log(`     ${colors.dim}${line}${colors.reset}`));
  }
}

/**
 * Run all requests in a suite for a single user config, returning results array.
 * Extracts session data from each response and threads it into subsequent requests.
 * Aborts on the first failure unless continueOnFailure is true.
 * Sleeps `requestDelay` ms between requests when > 0.
 */
async function runSuiteForUser(requests, userConfig, reportGen, continueOnFailure = false, requestDelay = 0) {
  const label = userConfig._userKey || userConfig.userEmail || 'user';
  const prefix = `  [${colors.cyan}${label}${colors.reset}]`;
  const results = [];
  let sessionConfig = { ...userConfig };

  for (let i = 0; i < requests.length; i++) {
    const request = requests[i];
    const requestName = request.name || 'Unknown';

    if (typeof request.condition === 'function' && !request.condition(sessionConfig)) {
      console.log(`${prefix} ${requestName}... ${colors.dim}⊘ SKIP${colors.reset} — condition not met`);
      results.push({ name: requestName, method: request.method, success: true, skipped: true, conditionSkipped: true, data: null, user: label });
      continue;
    }

    if (i > 0 && requestDelay > 0) {
      await sleep(requestDelay);
    }

    process.stdout.write(`${prefix} ${requestName}... `);

    const result = await executeRequest(request, sessionConfig);
    result.user = label;
    results.push(result);

    const responseFile = reportGen.saveResponse(`${label}_${requestName}`, result);
    result.responseFile = responseFile;

    if (result.success) {
      console.log(`${colors.green}✅ PASS${colors.reset} (${result.statusCode})`);
      if (typeof request.extract === 'function') {
        const extracted = request.extract(result.data);
        if (Object.keys(extracted).length > 0) {
          sessionConfig = { ...sessionConfig, ...extracted };
        }
      }
      if (typeof request.extractData === 'function') {
        result.extractedData = request.extractData(result.data);
      }
    } else if (request.allowFailure) {
      result.skipped = true;
      console.log(`${colors.yellow}⚠ SKIP${colors.reset} (${result.statusCode || 'ERROR'}) — expected failure, continuing`);
      if (typeof request.extract === 'function') {
        const extracted = request.extract(result.data);
        if (extracted && Object.keys(extracted).length > 0) {
          sessionConfig = { ...sessionConfig, ...extracted };
        }
      }
    } else {
      console.log(`${colors.red}❌ FAIL${colors.reset} (${result.statusCode || 'ERROR'})`);
      printFailureDetails(result);
      if (!continueOnFailure) {
        console.log(`     ${colors.yellow}⚠ Aborting remaining requests for ${label}${colors.reset}`);
        break;
      }
    }
  }

  return results;
}

/**
 * Resolve which users to run based on the --users flag value.
 */
function resolveUsers(usersArg, env) {
  if (usersArg === 'all') {
    return getUsers(env);
  }
  const keys = usersArg.split(',').map(k => k.trim()).filter(Boolean);
  return keys.map(key => getUser(key, env));
}

/**
 * Main execution function
 */
async function main() {
  const config = parseArgs();

  console.log(`\n${colors.blue}${'='.repeat(70)}${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}API Test Runner${colors.reset}`);
  console.log(`${colors.blue}${'='.repeat(70)}${colors.reset}\n`);

  console.log(`${colors.cyan}Configuration:${colors.reset}`);
  console.log(`  Suite:       ${colors.bright}${config.suite}${colors.reset}`);
  console.log(`  App:         ${colors.bright}${config.app}${colors.reset}`);
  console.log(`  Environment: ${colors.bright}${config.env}${colors.reset}`);
  console.log(`  Base URL:    ${colors.bright}${config.baseURL}${colors.reset}`);
  if (config.users) {
    const modeLabel = config.parallel
      ? `parallel (stagger: ${config.parallelDelay}ms)`
      : 'sequential';
    console.log(`  Users:       ${colors.bright}${config.users}${colors.reset}`);
    console.log(`  Mode:        ${colors.bright}${modeLabel}${colors.reset}`);
  }
  if (config.requestDelay > 0) {
    console.log(`  Req delay:   ${colors.bright}${config.requestDelay}ms${colors.reset}`);
  }
  console.log('');

  const requests = getRequestsForSuite(config.suite, config.app);

  if (requests.length === 0) {
    console.log(`${colors.yellow}⚠️  No requests found for suite: ${config.suite} (app: ${config.app})${colors.reset}\n`);
    process.exit(1);
  }

  const reportGen = new ReportGenerator(ARTIFACTS_DIR);

  // ── Multi-user mode ──────────────────────────────────────────────────────
  if (config.users) {
    let users;
    try {
      users = resolveUsers(config.users, config.env);
    } catch (err) {
      console.error(`${colors.red}❌ ${err.message}${colors.reset}\n`);
      process.exit(1);
    }

    console.log(`${colors.cyan}Running ${requests.length} request(s) for ${users.length} user(s)${colors.reset}\n`);

    let allResults = [];

    if (config.parallel) {
      // Parallel: stagger each user's start by parallelDelay ms
      const userRuns = await Promise.all(
        users.map((user, i) =>
          new Promise(resolve => setTimeout(resolve, config.parallelDelay * i))
            .then(() => runSuiteForUser(requests, buildUserConfig(config, user), reportGen, config.continueOnFailure))
        )
      );
      allResults = userRuns.flat();
    } else {
      // Sequential: one user at a time
      for (const user of users) {
        const userConfig = buildUserConfig(config, user);
        const userResults = await runSuiteForUser(
          requests,
          userConfig,
          reportGen,
          config.continueOnFailure,
          config.requestDelay
        );
        allResults.push(...userResults);
        console.log('');
      }
    }

    const report = reportGen.generateReport(`${config.suite} (${users.length} users)`, allResults);
    const jsonReportPath = reportGen.saveJsonReport(report);
    const htmlReportPath = reportGen.saveHtmlReport(report);

    console.log(`\n${colors.cyan}Reports generated:${colors.reset}`);
    console.log(`  📄 JSON: ${jsonReportPath}`);
    console.log(`  📊 HTML: ${htmlReportPath}`);
    console.log('');

    console.log(`${colors.blue}${'='.repeat(70)}${colors.reset}`);
    console.log(`${colors.bright}${colors.blue}Summary — ${users.length} user(s)${colors.reset}`);
    console.log(`${colors.blue}${'='.repeat(70)}${colors.reset}`);
    console.log(`Total Requests: ${colors.bright}${report.summary.totalRequests}${colors.reset}`);
    console.log(`Passed:         ${colors.green}${report.summary.passed} ✅${colors.reset}`);
    console.log(`Failed:         ${colors.red}${report.summary.failed} ❌${colors.reset}`);
    console.log(`Pass Rate:      ${colors.bright}${report.summary.passRate}${colors.reset}`);
    console.log(`${colors.blue}${'='.repeat(70)}${colors.reset}\n`);

    process.exit(report.summary.failed > 0 ? 1 : 0);
  }

  // ── Single-user mode (original behaviour) ────────────────────────────────
  console.log(`${colors.cyan}Found ${requests.length} request(s)${colors.reset}\n`);

  const results = [];
  let sessionConfig = { ...config };

  for (let i = 0; i < requests.length; i++) {
    const request = requests[i];
    const requestName = request.name || 'Unknown';

    if (typeof request.condition === 'function' && !request.condition(sessionConfig)) {
      console.log(`  ⏳ ${requestName}... ${colors.dim}⊘ SKIP${colors.reset} — condition not met`);
      results.push({ name: requestName, method: request.method, success: true, skipped: true, conditionSkipped: true, data: null });
      continue;
    }

    if (i > 0 && config.requestDelay > 0) {
      await sleep(config.requestDelay);
    }

    process.stdout.write(`  ⏳ ${requestName}... `);

    const result = await executeRequest(request, sessionConfig);
    results.push(result);

    const responseFile = reportGen.saveResponse(requestName, result);
    result.responseFile = responseFile;

    if (result.success) {
      console.log(`${colors.green}✅ PASS${colors.reset} (${result.statusCode})`);
      if (typeof request.extract === 'function') {
        const extracted = request.extract(result.data);
        if (Object.keys(extracted).length > 0) {
          sessionConfig = { ...sessionConfig, ...extracted };
        }
      }
      if (typeof request.extractData === 'function') {
        result.extractedData = request.extractData(result.data);
      }
    } else if (request.allowFailure) {
      result.skipped = true;
      console.log(`${colors.yellow}⚠ SKIP${colors.reset} (${result.statusCode || 'ERROR'}) — expected failure, continuing`);
      if (typeof request.extract === 'function') {
        const extracted = request.extract(result.data);
        if (extracted && Object.keys(extracted).length > 0) {
          sessionConfig = { ...sessionConfig, ...extracted };
        }
      }
    } else {
      console.log(`${colors.red}❌ FAIL${colors.reset} (${result.statusCode || 'ERROR'})`);
      printFailureDetails(result);
      if (!config.continueOnFailure) {
        console.log(`  ${colors.yellow}⚠ Aborting remaining requests${colors.reset}`);
        break;
      }
    }
  }

  console.log('');

  const report = reportGen.generateReport(config.suite, results);
  const jsonReportPath = reportGen.saveJsonReport(report);
  const htmlReportPath = reportGen.saveHtmlReport(report);

  console.log(`${colors.cyan}Reports generated:${colors.reset}`);
  console.log(`  📄 JSON: ${jsonReportPath}`);
  console.log(`  📊 HTML: ${htmlReportPath}`);
  console.log(`  📁 Responses: ${reportGen.responsesDir}`);
  console.log('');

  console.log(`${colors.blue}${'='.repeat(70)}${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}Test Summary${colors.reset}`);
  console.log(`${colors.blue}${'='.repeat(70)}${colors.reset}`);
  console.log(`Total Requests: ${colors.bright}${report.summary.totalRequests}${colors.reset}`);
  console.log(`Passed: ${colors.green}${report.summary.passed} ✅${colors.reset}`);
  console.log(`Failed: ${colors.red}${report.summary.failed} ❌${colors.reset}`);
  console.log(`Pass Rate: ${colors.bright}${report.summary.passRate}${colors.reset}`);
  console.log(`${colors.blue}${'='.repeat(70)}${colors.reset}\n`);

  process.exit(report.summary.failed > 0 ? 1 : 0);
}

// Run if executed directly
if (require.main === module) {
  main().catch(error => {
    console.error(`${colors.red}❌ Error: ${error.message}${colors.reset}`);
    process.exit(1);
  });
}

module.exports = { getRequestsForSuite, executeRequest };
