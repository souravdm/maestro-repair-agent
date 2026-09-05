#!/usr/bin/env node
'use strict';

/**
 * Slack Notifier — Maestro UI Tests
 *
 * Sends a rich Block Kit notification to a Slack channel when a test run
 * (single test or full suite) completes.
 *
 * Security: The webhook URL must be supplied via env var SLACK_WEBHOOK_URL or
 * the --webhook CLI flag. It is never logged or stored.
 *
 * Usage (called by test.sh / run-test-suite.sh — do not run manually unless testing):
 *
 *   # Single test
 *   node scripts/utils/reporting/slack-notify.js \
 *     --status       passed|failed \
 *     --test-name    "test_authentication" \
 *     --platform     ios \
 *     --environment  qa \
 *     --total        1 \
 *     --passed       1 \
 *     --failed       0 \
 *     --duration     "1m 42s" \
 *     --report-path  "/abs/path/to/test-report.html"
 *
 *   # Suite run (adds feature breakdown)
 *   node scripts/utils/reporting/slack-notify.js \
 *     --status        failed \
 *     --suite-name    "Smoke Suite" \
 *     --platform      ios \
 *     --environment   qa \
 *     --total         12 \
 *     --passed        10 \
 *     --failed        2 \
 *     --duration      "4m 12s" \
 *     --report-path   "/abs/path/to/suite-report.html" \
 *     --results-json  "/abs/path/to/suite-results.json"
 */

const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');

// ─── CLI argument parser ──────────────────────────────────────────────────────

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

const args = parseArgs(process.argv.slice(2));

// ─── Config ───────────────────────────────────────────────────────────────────

// ── Two auth modes ─────────────────────────────────────────────────────────
//
//  MODE A — Incoming Webhook (simpler, channel is fixed in the webhook URL)
//    Set: SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T.../B.../...
//    The channel is determined when you create the webhook in Slack —
//    you cannot change it at runtime.
//
//  MODE B — Bot Token (flexible: one token, choose channel per run)
//    Set: SLACK_BOT_TOKEN=xoxb-...
//         SLACK_CHANNEL=#qa-automation   (name with # or bare channel ID)
//    Requires the bot to be invited to the channel: /invite @YourBot
//
//  If both are set, Bot Token takes precedence.
// ───────────────────────────────────────────────────────────────────────────

const WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL || args['webhook'] || '';
const BOT_TOKEN   = process.env.SLACK_BOT_TOKEN   || args['bot-token'] || '';
const CHANNEL     = process.env.SLACK_CHANNEL     || args['channel'] || '';

const USE_BOT_TOKEN = !!(BOT_TOKEN && CHANNEL);
const USE_WEBHOOK   = !!WEBHOOK_URL;

if (!USE_BOT_TOKEN && !USE_WEBHOOK) {
  console.error('⚠️  Slack notification skipped: no credentials configured.');
  console.error('   Set SLACK_WEBHOOK_URL  — OR —  SLACK_BOT_TOKEN + SLACK_CHANNEL in .env');
  process.exit(0); // Non-fatal — test must still exit with its own code
}

const status      = (args['status']       || 'unknown').toLowerCase();
const testName    = args['test-name']     || args['suite-name'] || 'Unknown Test';
const suiteName   = args['suite-name']    || '';
const platform    = (args['platform']     || 'ios').toUpperCase();
const environment = (args['environment']  || 'qa').toUpperCase();
const total       = parseInt(args['total']  || '0', 10);
const passed      = parseInt(args['passed'] || '0', 10);
const failed      = parseInt(args['failed'] || '0', 10);
const duration    = args['duration']      || 'N/A';
const reportPath  = args['report-path']   || '';
const resultsJson = args['results-json']  || '';

// ─── Feature-level breakdown ──────────────────────────────────────────────────

/**
 * Groups tests by feature (first folder segment after flows/ in the file path).
 * Returns array of { feature, total, passed, failed, pct }.
 */
function buildFeatureBreakdown(jsonPath) {
  if (!jsonPath || !fs.existsSync(jsonPath)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const tests = data.tests || [];
    const map = {};
    for (const t of tests) {
      // Derive feature from file path: .maestro/flows/Benefits/Claims/… → "Benefits"
      const filePath = t.file || t.name || '';
      const m = filePath.match(/flows\/([^/]+)/i);
      const feature = m ? m[1] : 'Other';
      if (!map[feature]) map[feature] = { total: 0, passed: 0, failed: 0 };
      map[feature].total++;
      if (t.status === 'passed') map[feature].passed++;
      else map[feature].failed++;
    }
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([feature, s]) => ({
        feature,
        total:  s.total,
        passed: s.passed,
        failed: s.failed,
        pct:    s.total > 0 ? Math.round((s.passed / s.total) * 100) : 0
      }));
  } catch (_) {
    return [];
  }
}

const features = buildFeatureBreakdown(resultsJson);

// ─── Pass rate ────────────────────────────────────────────────────────────────

const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;

// ─── Report link ─────────────────────────────────────────────────────────────

function buildReportLink(filePath) {
  if (!filePath) return null;
  // In CI, REPORT_BASE_URL can be set to an HTTP server URL that serves the reports
  const baseUrl = process.env.REPORT_BASE_URL || '';
  if (baseUrl) {
    const PROJECT_ROOT = path.join(__dirname, '..', '..');
    const rel = path.relative(PROJECT_ROOT, filePath);
    return `${baseUrl.replace(/\/$/, '')}/${rel}`;
  }
  // Local: file:// URL
  return `file://${filePath}`;
}

const reportLink = buildReportLink(reportPath);

// ─── Slack Block Kit builder ──────────────────────────────────────────────────

function statusHeader() {
  const isPass = status === 'passed' || failed === 0;
  const emoji  = isPass ? '✅' : '❌';
  const label  = isPass ? 'PASSED' : 'FAILED';
  const title  = suiteName
    ? `${emoji} *${label}* — ${suiteName}`
    : `${emoji} *${label}* — ${testName}`;
  return {
    type: 'header',
    text: { type: 'plain_text', text: `${isPass ? '✅' : '❌'} Maestro ${suiteName ? 'Suite' : 'Test'} ${label}`, emoji: true }
  };
}

function contextBlock() {
  const isPass = status === 'passed' || failed === 0;
  return {
    type: 'context',
    elements: [
      { type: 'mrkdwn', text: `*${suiteName || testName}*` },
      { type: 'mrkdwn', text: `📱 ${platform}  |  🌍 ${environment}  |  ⏱ ${duration}` }
    ]
  };
}

function summarySection() {
  const isPass = status === 'passed' || failed === 0;
  const passRateBar = buildProgressBar(passRate);
  return {
    type: 'section',
    fields: [
      { type: 'mrkdwn', text: `*Total*\n${total}` },
      { type: 'mrkdwn', text: `*Passed*\n✅ ${passed}` },
      { type: 'mrkdwn', text: `*Failed*\n${failed > 0 ? '❌' : '—'} ${failed}` },
      { type: 'mrkdwn', text: `*Pass Rate*\n${passRateBar} ${passRate}%` }
    ]
  };
}

/** ASCII-style progress bar, 10 chars wide */
function buildProgressBar(pct) {
  const filled = Math.round(pct / 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}

function featureSection(features) {
  if (!features || features.length === 0) return null;
  const lines = features.map(f => {
    const bar  = buildProgressBar(f.pct);
    const icon = f.failed > 0 ? '❌' : '✅';
    return `${icon} *${f.feature}*  ${f.passed}/${f.total}  \`${bar}\` ${f.pct}%`;
  });
  return {
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `*📋 Feature Breakdown*\n\n${lines.join('\n')}`
    }
  };
}

function reportButton(link) {
  if (!link) return null;
  return {
    type: 'actions',
    elements: [
      {
        type: 'button',
        text: { type: 'plain_text', text: '📄 View Report', emoji: true },
        url: link,
        style: (status === 'passed' || failed === 0) ? 'primary' : 'danger'
      }
    ]
  };
}

function buildBlocks() {
  const blocks = [];
  blocks.push(statusHeader());
  blocks.push({ type: 'divider' });
  blocks.push(contextBlock());
  blocks.push({ type: 'divider' });
  blocks.push(summarySection());
  const feat = featureSection(features);
  if (feat) {
    blocks.push({ type: 'divider' });
    blocks.push(feat);
  }
  blocks.push({ type: 'divider' });
  const btn = reportButton(reportLink);
  if (btn) blocks.push(btn);
  // Footer
  blocks.push({
    type: 'context',
    elements: [
      { type: 'mrkdwn', text: `_Maestro UI Tests • ${new Date().toLocaleString()} • ${platform}_` }
    ]
  });
  return blocks;
}

// ─── Fallback text (for notification previews) ────────────────────────────────

function buildFallbackText() {
  const label = (status === 'passed' || failed === 0) ? 'PASSED' : 'FAILED';
  return `${label}: ${suiteName || testName} — ${passed}/${total} tests passed (${passRate}%) on ${platform} [${environment}]`;
}

// ─── HTTP helper ─────────────────────────────────────────────────────────────

function httpPost(url, body, extraHeaders = {}) {
  const parsedUrl = new URL(url);
  const mod = parsedUrl.protocol === 'https:' ? https : http;
  const bodyBuf = Buffer.from(JSON.stringify(body));

  return new Promise((resolve, reject) => {
    const req = mod.request(
      {
        hostname: parsedUrl.hostname,
        path:     parsedUrl.pathname + parsedUrl.search,
        method:   'POST',
        headers: {
          'Content-Type':   'application/json',
          'Content-Length': bodyBuf.length,
          ...extraHeaders
        }
      },
      res => {
        let data = '';
        res.on('data', c => (data += c));
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data);
          } else {
            reject(new Error(`Slack responded with HTTP ${res.statusCode}: ${data}`));
          }
        });
      }
    );
    req.on('error', reject);
    req.write(bodyBuf);
    req.end();
  });
}

// ─── Send via Incoming Webhook ────────────────────────────────────────────────

function sendViaWebhook(payload) {
  return httpPost(WEBHOOK_URL, payload);
}

// ─── Send via Bot Token (chat.postMessage) ───────────────────────────────────

function sendViaBotToken(payload) {
  const body = {
    channel:  CHANNEL,
    text:     payload.text,
    blocks:   payload.blocks
  };
  return httpPost('https://slack.com/api/chat.postMessage', body, {
    'Authorization': `Bearer ${BOT_TOKEN}`
  }).then(raw => {
    const res = JSON.parse(raw);
    if (!res.ok) throw new Error(`Slack API error: ${res.error}`);
    return raw;
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  const payload = {
    text:   buildFallbackText(),
    blocks: buildBlocks()
  };

  const mode = USE_BOT_TOKEN ? `bot token → ${CHANNEL}` : `webhook`;
  try {
    if (USE_BOT_TOKEN) {
      await sendViaBotToken(payload);
    } else {
      await sendViaWebhook(payload);
    }
    console.log(`✅ Slack notification sent (${mode})`);
  } catch (e) {
    // Never fail the test pipeline because of a notification error
    console.warn(`⚠️  Slack notification failed (${mode}): ${e.message}`);
  }
})();
