#!/usr/bin/env node

/**
 * Parse Test Data Report
 * Analyzes a test data report to identify failed requests and users.
 * Generates a summary and provides options for targeted retries.
 *
 * Usage:
 *   node parse-test-data-report.js --report-dir <path>
 *   node parse-test-data-report.js --report-dir artifacts/api/tests/test-data-report-2026-04-14T17-00-00
 *   node parse-test-data-report.js --report-dir <path> --failed-only
 *   node parse-test-data-report.js --report-dir <path> --user ELIZABETH_MILLER
 */

'use strict';

const fs = require('fs');
const path = require('path');

const colors = {
  reset:  '\x1b[0m',
  bright: '\x1b[1m',
  dim:    '\x1b[2m',
  red:    '\x1b[31m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  blue:   '\x1b[34m',
  cyan:   '\x1b[36m',
  gray:   '\x1b[90m'
};

// ── CLI args ─────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const cfg = {
    reportDir: null,
    failedOnly: false,
    user: null,
    json: false
  };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--report-dir' && args[i+1]) { cfg.reportDir = args[++i]; }
    if (args[i] === '--failed-only')              { cfg.failedOnly = true; }
    if (args[i] === '--user' && args[i+1])       { cfg.user = args[++i]; }
    if (args[i] === '--json')                     { cfg.json = true; }
  }
  return cfg;
}

// ── Report parsing ────────────────────────────────────────────────────────────

function parseReport(jsonPath) {
  let data;
  try {
    data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  } catch (err) {
    throw new Error(`Failed to parse report: ${err.message}`);
  }

  const analysis = {
    totalUsers: 0,
    totalRequests: 0,
    totalPassed: 0,
    totalFailed: 0,
    totalSkipped: 0,
    users: {}
  };

  for (const [user, requests] of Object.entries(data)) {
    analysis.totalUsers++;
    const userAnalysis = {
      name: user,
      totalRequests: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      failedRequests: []
    };

    for (const [reqName, result] of Object.entries(requests)) {
      userAnalysis.totalRequests++;
      analysis.totalRequests++;

      if (result.success) {
        userAnalysis.passed++;
        analysis.totalPassed++;
      } else {
        userAnalysis.failed++;
        analysis.totalFailed++;
        userAnalysis.failedRequests.push({
          name: reqName,
          statusCode: result.statusCode,
          extractedData: result.extractedData
        });
      }
    }

    analysis.users[user] = userAnalysis;
  }

  return analysis;
}

// ── Report formatting ─────────────────────────────────────────────────────────

function formatAnalysis(analysis, cfg) {
  const lines = [];

  lines.push(`\n${colors.blue}${'='.repeat(80)}${colors.reset}`);
  lines.push(`${colors.bright}${colors.blue}Test Data Report Analysis${colors.reset}`);
  lines.push(`${colors.blue}${'='.repeat(80)}${colors.reset}\n`);

  // Summary
  lines.push(`${colors.cyan}Summary:${colors.reset}`);
  lines.push(`  Total Users    : ${colors.bright}${analysis.totalUsers}${colors.reset}`);
  lines.push(`  Total Requests : ${colors.bright}${analysis.totalRequests}${colors.reset}`);
  lines.push(`  Passed         : ${colors.green}${analysis.totalPassed}${colors.reset}`);
  lines.push(`  Failed         : ${colors.red}${analysis.totalFailed}${colors.reset}`);
  lines.push(`  Pass Rate      : ${colors.bright}${((analysis.totalPassed / analysis.totalRequests) * 100).toFixed(1)}%${colors.reset}\n`);

  // Users with failures
  const usersWithFailures = Object.values(analysis.users).filter(u => u.failed > 0);

  if (usersWithFailures.length === 0) {
    lines.push(`${colors.green}✅ All requests passed!${colors.reset}\n`);
    return lines.join('\n');
  }

  lines.push(`${colors.cyan}Users with Failed Requests (${usersWithFailures.length}):${colors.reset}\n`);

  usersWithFailures.forEach((user, idx) => {
    const passRate = ((user.passed / user.totalRequests) * 100).toFixed(0);
    lines.push(`  ${idx + 1}. ${colors.bright}${user.name}${colors.reset}`);
    lines.push(`     Requests: ${user.passed}/${user.totalRequests} passed (${passRate}%)`);
    lines.push(`     Failed: ${colors.red}${user.failed}${colors.reset}`);

    user.failedRequests.forEach(req => {
      const status = req.statusCode ? `(${req.statusCode})` : '(ERROR)';
      lines.push(`       • ${req.name} ${colors.red}${status}${colors.reset}`);
    });
    lines.push('');
  });

  // Retry commands
  lines.push(`${colors.cyan}Retry Commands:${colors.reset}\n`);
  usersWithFailures.forEach(user => {
    lines.push(`  npm run test:data-report:update -- --user ${user.name} --report-dir <report-dir> --retry 3`);
  });
  lines.push('');

  // Batch retry
  const failedUsers = usersWithFailures.map(u => u.name).join(',');
  lines.push(`${colors.cyan}Batch Retry (all failed users):${colors.reset}`);
  lines.push(`  node test-data-runner.js --users ${failedUsers} --parallel\n`);

  return lines.join('\n');
}

function formatJson(analysis) {
  return JSON.stringify(analysis, null, 2);
}

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  const cfg = parseArgs();

  if (!cfg.reportDir) {
    console.error(`${colors.red}❌ Missing required argument: --report-dir${colors.reset}`);
    console.error(`\nUsage: node parse-test-data-report.js --report-dir <path> [--failed-only] [--user USER_KEY] [--json]\n`);
    process.exit(1);
  }

  const jsonPath = path.join(cfg.reportDir, 'test-data.json');
  if (!fs.existsSync(jsonPath)) {
    console.error(`${colors.red}❌ Report not found: ${jsonPath}${colors.reset}\n`);
    process.exit(1);
  }

  let analysis;
  try {
    analysis = parseReport(jsonPath);
  } catch (err) {
    console.error(`${colors.red}❌ ${err.message}${colors.reset}\n`);
    process.exit(1);
  }

  // Filter by user if specified
  if (cfg.user) {
    if (!analysis.users[cfg.user]) {
      console.error(`${colors.red}❌ User not found: ${cfg.user}${colors.reset}\n`);
      process.exit(1);
    }
    const userAnalysis = analysis.users[cfg.user];
    analysis = {
      totalUsers: 1,
      totalRequests: userAnalysis.totalRequests,
      totalPassed: userAnalysis.passed,
      totalFailed: userAnalysis.failed,
      totalSkipped: 0,
      users: { [cfg.user]: userAnalysis }
    };
  }

  // Filter to failed only
  if (cfg.failedOnly) {
    const failedUsers = {};
    for (const [user, data] of Object.entries(analysis.users)) {
      if (data.failed > 0) {
        failedUsers[user] = data;
      }
    }
    analysis.users = failedUsers;
  }

  // Output
  if (cfg.json) {
    console.log(formatJson(analysis));
  } else {
    console.log(formatAnalysis(analysis, cfg));
  }
}

main();
