#!/usr/bin/env node

/**
 * Update Test Data Report
 * Re-runs API requests for a specific user and updates the existing report.
 * Useful for retrying failed requests without re-running all users.
 *
 * Usage:
 *   node update-test-data-report.js --user ELIZABETH_MILLER --report-dir <path>
 *   node update-test-data-report.js --user ELIZABETH_MILLER --report-dir artifacts/api/tests/test-data-report-2026-04-14T17-00-00
 *   node update-test-data-report.js --user ELIZABETH_MILLER --report-dir artifacts/api/tests/test-data-report-2026-04-14T17-00-00 --retry 3
 */

'use strict';

const fs = require('fs');
const path = require('path');
const TestDataReportGenerator = require('./lib/test-data-report-generator');
const { getUser } = require('./lib/test-data-loader');

const REQUESTS_DIR = path.join(__dirname, 'requests');

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
    env:       'qa2',
    baseURL:   'https://www-qa2.cvs.com',
    user:      null,
    reportDir: null,
    retry:     1,
    apiKey:    process.env.CVS_API_KEY    || 'FHbLTRk49KzXrKDrWWcHVGOVUvnIyVFz',
    visitorId: process.env.CVS_VISITOR_ID || '550e8400-e29b-41d4-a716-446655440000'
  };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--env'        && args[i+1]) { cfg.env       = args[++i]; }
    if (args[i] === '--base-url'   && args[i+1]) { cfg.baseURL   = args[++i]; }
    if (args[i] === '--user'       && args[i+1]) { cfg.user      = args[++i]; }
    if (args[i] === '--report-dir' && args[i+1]) { cfg.reportDir = args[++i]; }
    if (args[i] === '--retry'      && args[i+1]) { cfg.retry     = parseInt(args[++i], 10); }
  }
  return cfg;
}

// ── Request loading ───────────────────────────────────────────────────────────

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

// ── Request execution with retry ──────────────────────────────────────────────

async function executeRequestWithRetry(request, config, maxRetries) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await request.execute(config);
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        const delay = Math.pow(2, attempt - 1) * 1000; // exponential backoff
        console.log(`${colors.yellow}  Retry ${attempt}/${maxRetries - 1} in ${delay}ms...${colors.reset}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  return { name: request.name, method: request.method, success: false, error: lastError.message, data: null };
}

// ── Report update ─────────────────────────────────────────────────────────────

async function updateReportForUser(requests, userCfg, maxRetries) {
  const label = userCfg.key || userCfg.userEmail || 'user';
  const results = [];
  let sessionCfg = { ...userCfg };

  for (const req of requests) {
    const name = req.name || 'unknown';
    process.stdout.write(`  [${colors.cyan}${label}${colors.reset}] ${name}... `);

    const result = await executeRequestWithRetry(req, sessionCfg, maxRetries);
    result.user = label;
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
    } else {
      console.log(`${colors.red}❌ FAIL${colors.reset} (${result.statusCode || 'ERROR'}) — continuing`);
    }
  }

  return results;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const cfg = parseArgs();

  if (!cfg.user || !cfg.reportDir) {
    console.error(`${colors.red}❌ Missing required arguments${colors.reset}`);
    console.error(`\nUsage: node update-test-data-report.js --user <USER_KEY> --report-dir <path> [--retry N]\n`);
    process.exit(1);
  }

  console.log(`\n${colors.blue}${'='.repeat(70)}${colors.reset}`);
  console.log(`${colors.bright}${colors.blue}CVS API — Update Test Data Report${colors.reset}`);
  console.log(`${colors.blue}${'='.repeat(70)}${colors.reset}\n`);
  console.log(`  User        : ${colors.bright}${cfg.user}${colors.reset}`);
  console.log(`  Report Dir  : ${colors.bright}${cfg.reportDir}${colors.reset}`);
  console.log(`  Max Retries : ${colors.bright}${cfg.retry}${colors.reset}\n`);

  // Validate report directory
  const jsonPath = path.join(cfg.reportDir, 'test-data.json');
  if (!fs.existsSync(jsonPath)) {
    console.error(`${colors.red}❌ Report not found: ${jsonPath}${colors.reset}\n`);
    process.exit(1);
  }

  // Load existing report
  let existingData;
  try {
    existingData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  } catch (err) {
    console.error(`${colors.red}❌ Failed to parse existing report: ${err.message}${colors.reset}\n`);
    process.exit(1);
  }

  // Resolve user
  let user;
  try {
    user = getUser(cfg.user, cfg.env);
  } catch (err) {
    console.error(`${colors.red}❌ ${err.message}${colors.reset}\n`);
    process.exit(1);
  }

  const requests = loadRequestsFromDir(REQUESTS_DIR);
  if (!requests.length) {
    console.error(`${colors.red}❌ No requests found in ${REQUESTS_DIR}${colors.reset}\n`);
    process.exit(1);
  }

  console.log(`${colors.cyan}Re-running ${requests.length} request(s) for ${cfg.user} with up to ${cfg.retry} attempt(s)${colors.reset}\n`);

  const userCfg = {
    ...cfg,
    key:       user.key,
    userEmail: user.email || user.userEmail || '',
    dob:       user.dob  || user.dateOfBirth || '',
    _userKey:  user.key
  };

  const newResults = await updateReportForUser(requests, userCfg, cfg.retry);
  console.log('');

  // Merge results: replace old results for this user with new ones
  const mergedData = { ...existingData };
  if (!mergedData[cfg.user]) {
    mergedData[cfg.user] = {};
  }

  newResults.forEach(result => {
    const reqName = result.name || 'unknown';
    mergedData[cfg.user][reqName] = {
      success: result.success,
      statusCode: result.statusCode,
      extractedData: result.extractedData || null
    };
  });

  // Save updated JSON
  fs.writeFileSync(jsonPath, JSON.stringify(mergedData, null, 2), 'utf8');

  // Regenerate HTML report from merged data
  const allResults = [];
  for (const [user, reqs] of Object.entries(mergedData)) {
    for (const [name, r] of Object.entries(reqs)) {
      allResults.push({
        user,
        name,
        success: r.success,
        statusCode: r.statusCode,
        extractedData: r.extractedData,
        skipped: false
      });
    }
  }

  const reportGen = new TestDataReportGenerator(path.dirname(cfg.reportDir));
  const htmlPath = path.join(cfg.reportDir, 'test-data-report.html');
  const html = reportGen.generateHtml(allResults, { env: cfg.env });
  fs.writeFileSync(htmlPath, html, 'utf8');

  console.log(`${colors.cyan}Report updated:${colors.reset}`);
  console.log(`  HTML : ${colors.bright}${htmlPath}${colors.reset}`);
  console.log(`  JSON : ${colors.bright}${jsonPath}${colors.reset}\n`);

  const failed = newResults.filter(r => !r.success && !r.skipped).length;
  if (failed > 0) {
    console.log(`${colors.yellow}⚠ ${failed} request(s) still failing — check the report for details.${colors.reset}\n`);
  } else {
    console.log(`${colors.green}✅ All requests passed or skipped as expected.${colors.reset}\n`);
  }
}

main().catch(err => {
  console.error(`${colors.red}Fatal: ${err.message}${colors.reset}\n`);
  process.exit(1);
});
