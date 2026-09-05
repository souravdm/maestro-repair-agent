#!/usr/bin/env node
/* eslint-disable no-console */
'use strict';

/**
 * Slack notifier for Maestro test/suite runs.
 *
 * Posts a structured payload to a Slack Workflow Builder webhook trigger.
 * The workflow owns the message template — this script only sends the variables.
 *
 * The webhook URL is read from the SLACK_WEBHOOK_URL env var.
 * If SLACK_WEBHOOK_URL is unset, the script exits 0 without posting (silent no-op),
 * so callers can safely invoke it unconditionally.
 *
 * Recognized CLI flags (all optional):
 *   --status         passed | failed
 *   --suite-name     display name of the suite (or test) — populates `suite`
 *   --test-name      alias for --suite-name when called from single-test runs
 *   --platform       ios | android
 *   --app            e.g. cvspharmacy | health100
 *   --environment    qa | stage | prod (unused if not in workflow)
 *   --total          integer, total tests in the run
 *   --passed         integer, tests passed
 *   --failed         integer, tests failed
 *   --duration       preformatted duration string like "2m 22s"
 *   --duration-seconds  integer seconds (falls back if --duration not passed)
 *   --report-path    filesystem path to the HTML report
 *   --report-url     explicit URL to the HTML report (overrides --report-path)
 *   --results-json   path to the results JSON file (informational only)
 *
 * Failures are logged to stderr and swallowed with exit 0 — Slack must never
 * break the test pipeline. Callers already redirect stderr and add `|| true`.
 */

const os = require('os');
const path = require('path');

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next !== undefined && !next.startsWith('--')) {
      out[key] = next;
      i++;
    } else {
      out[key] = 'true';
    }
  }
  return out;
}

function formatDuration(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return m > 0 ? `${m}m ${rem}s` : `${rem}s`;
}

async function main() {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) {
    // Silent no-op — callers can invoke unconditionally.
    return 0;
  }

  const args = parseArgs(process.argv.slice(2));

  const status = (args.status || '').toLowerCase() === 'passed' ? 'passed' : 'failed';
  const statusEmoji = status === 'passed' ? ':white_check_mark:' : ':x:';
  const statusDisplay = status.toUpperCase();

  const suite = args['suite-name'] || args['test-name'] || 'unknown';

  // Duration: prefer the preformatted string; otherwise derive from seconds
  const durationSeconds = args['duration-seconds'] || '';
  const durationFormatted = args.duration
    || (durationSeconds ? formatDuration(durationSeconds) : '');

  // Report URL: explicit --report-url wins; otherwise convert --report-path to a file:// URL
  let reportUrl = args['report-url'] || '';
  if (!reportUrl && args['report-path']) {
    try {
      reportUrl = 'file://' + path.resolve(args['report-path']);
    } catch (_) {
      reportUrl = args['report-path'];
    }
  }

  const payload = {
    status: statusDisplay,
    status_emoji: statusEmoji,
    suite,
    platform: args.platform || '',
    app: args.app || '',
    environment: args.environment || '',
    total_tests: String(args.total || ''),
    total_passed: String(args.passed || ''),
    total_failed: String(args.failed || ''),
    duration_seconds: String(durationSeconds || ''),
    duration_formatted: durationFormatted,
    host: os.hostname(),
    report_url: reportUrl,
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error(`[slack-notify] non-2xx response: ${res.status} ${body.slice(0, 200)}`);
    }
  } catch (e) {
    console.error(`[slack-notify] post failed: ${e.message}`);
  }

  return 0;
}

main().then(code => process.exit(code || 0)).catch(err => {
  console.error(`[slack-notify] unexpected error: ${err && err.message}`);
  process.exit(0);
});
