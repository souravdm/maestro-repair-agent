#!/usr/bin/env node

/**
 * Parse Network Logs - Universal Parser for iOS & Android
 *
 * iOS capture uses two enhancements that work for both debug and prod builds:
 *   1. `log config --mode private_data:on`  → full URLs in place of <private>
 *   2. `launchctl setenv CFNETWORK_DIAGNOSTICS 3` → verbose request/response detail
 *
 * Neither technique involves SSL interception, so certificate pinning in
 * production builds is never triggered.
 *
 * Android capture uses a broad logcat tag set (OkHttp for debug builds +
 * NetworkSecurityConfig / System.err / ConnectivityService for prod builds).
 */

const fs = require('fs');
const path = require('path');

// Load exclusion config from network-exclude.yaml (simple line-by-line parser — no deps)
function loadExcludeConfig() {
  const configFile = path.join(__dirname, 'network-exclude.yaml');
  const defaults = {
    include_domains: ['cvs.com','cvshealth.com','caremark.com','aetna.com','health100.com'],
    exclude_domains: ['cmsservices.','sit2depservices.','cdn.','static.','assets.','fonts.'],
    exclude_patterns: [
      '\\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|css|js|map)(\\?|$)',
      'google-analytics','googletagmanager','firebase','crashlytics',
      'datadog','appsflyer','amplitude','/_bm/'
    ]
  };
  try {
    if (!fs.existsSync(configFile)) return defaults;
    const lines = fs.readFileSync(configFile, 'utf8').split('\n');
    const result = { include_domains: [], exclude_domains: [], exclude_patterns: [] };
    let currentKey = null;
    for (const raw of lines) {
      const line = raw.trimEnd();
      if (line.startsWith('#') || !line.trim()) continue;
      const listMatch = line.match(/^(\w+_\w+):\s*$/);
      if (listMatch) { currentKey = listMatch[1]; continue; }
      const itemMatch = line.match(/^\s+-\s+'(.+)'$/) || line.match(/^\s+-\s+"(.+)"$/) || line.match(/^\s+-\s+(.+)$/);
      if (itemMatch && currentKey && result[currentKey] !== undefined) {
        result[currentKey].push(itemMatch[1].trim());
      }
    }
    // Fall back to defaults for any empty sections
    if (!result.include_domains.length) result.include_domains = defaults.include_domains;
    if (!result.exclude_domains.length) result.exclude_domains = defaults.exclude_domains;
    if (!result.exclude_patterns.length) result.exclude_patterns = defaults.exclude_patterns;
    return result;
  } catch (_) {
    return defaults;
  }
}

const EXCLUDE_CONFIG = loadExcludeConfig();

const reportDir = process.argv[2] || process.cwd();
const networkDir = path.join(reportDir, 'network');
const apiCallsFile = path.join(networkDir, 'api-calls.json');

// Known CVS/Health100 API domains — loaded from network-exclude.yaml.
// When URLs are still redacted (private_data:on not supported on this OS version)
// all calls with a valid HTTP status are kept regardless of domain.
const CVS_DOMAINS = EXCLUDE_CONFIG.include_domains;

// Static asset / analytics patterns — loaded from network-exclude.yaml.
const EXCLUDE_PATTERNS = [
  ...EXCLUDE_CONFIG.exclude_patterns.map(p => new RegExp(p, 'i')),
];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function extractTimestamp(line) {
  const m = line.match(/(\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}:\d{2})/);
  if (m) return m[1];
  const am = line.match(/(\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/);
  if (am) return `${new Date().getFullYear()}-${am[1]}`;
  return new Date().toISOString();
}

function extractEndpoint(url) {
  try {
    const u = new URL(url);
    return u.pathname + (u.search ? ' (with params)' : '');
  } catch {
    return url;
  }
}

function isCVSDomain(url) {
  return CVS_DOMAINS.some(d => url.includes(d));
}

function isExcluded(url) {
  if (EXCLUDE_CONFIG.exclude_domains.some(d => url.toLowerCase().includes(d.toLowerCase()))) return true;
  return EXCLUDE_PATTERNS.some(p => p.test(url));
}

// ─────────────────────────────────────────────────────────────────────────────
// iOS log parser
//
// Handles three log formats:
//
// Format A — private_data:on (full URL in log line):
//   Task <UUID>.<N> HTTP load https://www-qa2.cvs.com/api/v1/login
//   Task <UUID>.<N> received response, status 200 content-length 1024
//   Task <UUID>.<N> summary for task X {transaction_duration_ms=421 response_status=200 ...}
//
// Format B — CFNETWORK_DIAGNOSTICS=3 verbose (URL in braces / quoted):
//   Task <UUID>.<N> (load) {url = "https://www-qa2.cvs.com/api/v1/login", ...}
//   Task <UUID>.<N> completed {status = 200, duration = 421}
//
// Format C — legacy redacted (no URL, partial info):
//   Task <UUID>.<N> sent request, body S 512
//   Task <UUID>.<N> received response, status 401
//   Task <UUID>.<N> summary for task X {transaction_duration_ms=8480 response_status=504 ...}
// ─────────────────────────────────────────────────────────────────────────────
function parseIOSLogs(logFile) {
  if (!fs.existsSync(logFile)) return [];

  const raw = fs.readFileSync(logFile, 'utf8');

  // Re-join wrapped log lines (a new entry starts with a date stamp)
  const lines = [];
  let cur = '';
  for (const line of raw.split('\n')) {
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(line)) {
      if (cur) lines.push(cur);
      cur = line;
    } else {
      cur += ' ' + line.trim();
    }
  }
  if (cur) lines.push(cur);

  // ── Pass 1: build connection-number → URL map ─────────────────────────────
  // Network-layer connection lines contain full URLs even when Task lines are
  // redacted. Format: [CN UUID Hostname#hash:port ..., url: https://..., ...]
  // The connection=N field in Task summary lines maps to this CN number.
  const connUrlMap = new Map(); // connectionNum (int) -> url (string)
  for (const line of lines) {
    if (
      !line.includes('CVSOnline') &&
      !line.includes('Health100') &&
      !line.includes('cvspharmacy') &&
      !line.includes('health100')
    ) continue;
    // Match: [C5 UUID Hostname url: https://...]
    // The URL ends at comma, space, or ] — we stop at the first whitespace/comma
    const connM = line.match(/\[C(\d+)\s+[A-F0-9-]+.*?\burl:\s+(https?:\/\/[^\s,\]]+)/i);
    if (connM) {
      const connNum = parseInt(connM[1], 10);
      const url = connM[2].replace(/[)\]}>,.;]+$/, '');
      if (!connUrlMap.has(connNum) && !isExcluded(url)) {
        connUrlMap.set(connNum, url);
      }
    }
  }

  // ── Pass 2: process Task lines ────────────────────────────────────────────
  const tasks = new Map();

  const ensureTask = (id, line) => {
    if (!tasks.has(id)) {
      tasks.set(id, {
        taskId: id,
        timestamp: extractTimestamp(line),
        method: 'HTTP',
        url: null,
        status: null,
        duration: null,
        bodySize: 0,
      });
    }
    return tasks.get(id);
  };

  const calls = [];

  for (const line of lines) {
    // Only process lines that belong to the CVS app processes
    if (
      !line.includes('CVSOnline') &&
      !line.includes('Health100') &&
      !line.includes('cvspharmacy') &&
      !line.includes('health100')
    ) continue;

    // ── Task ID ──────────────────────────────────────────────────────────────
    const tidM = line.match(/Task <([A-F0-9-]+)>\.<(\d+)>/i);
    if (!tidM) continue;
    const taskId = `${tidM[1]}.${tidM[2]}`;
    const task = ensureTask(taskId, line);

    // ── URL: NSErrorFailingURLStringKey (error + cancelled lines) ────────────
    // These lines contain the full URL alongside the Task ID — easy win.
    if (!task.url) {
      const errUrlM = line.match(/NSErrorFailingURLStringKey=(https?:\/\/[^\s,}]+)/);
      if (errUrlM) {
        const candidate = errUrlM[1].replace(/[)\]}>,.]+$/, '');
        if (!isExcluded(candidate)) task.url = candidate;
      }
    }

    // ── URL: direct https?:// on the Task line (Format A + B) ───────────────
    if (!task.url) {
      const urlM = line.match(/https?:\/\/[^\s"'<>{},]+/);
      if (urlM) {
        const candidate = urlM[0].replace(/[)\]}>,.]+$/, '');
        if (!isExcluded(candidate)) task.url = candidate;
      }
    }

    // Format B quoted URL: url = "https://..."
    if (!task.url) {
      const quotedM = line.match(/url\s*=\s*"(https?:\/\/[^"]+)"/);
      if (quotedM) task.url = quotedM[1];
    }

    // ── Method ───────────────────────────────────────────────────────────────
    const methodM = line.match(/\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/);
    if (methodM) task.method = methodM[1];

    // ── Body size (hints POST when > 0) ─────────────────────────────────────
    const bodyM = line.match(/body\s+S\s+(\d+)/);
    if (bodyM) {
      task.bodySize = parseInt(bodyM[1], 10);
      if (task.method === 'HTTP') task.method = task.bodySize > 0 ? 'POST' : 'GET';
    }

    // ── Status from "received response" ─────────────────────────────────────
    const recvM = line.match(/received response,?\s+status\s+(\d+)/);
    if (recvM) task.status = parseInt(recvM[1], 10);

    // Format B: "completed {status = 200, ...}"
    const compM = line.match(/completed\s*\{[^}]*status\s*=\s*(\d+)/);
    if (compM && !task.status) task.status = parseInt(compM[1], 10);

    // ── Duration + final status + connection-URL lookup from summary line ────
    const sumM = line.match(/summary for task\s+\S+\s*\{([^}]+)\}/);
    if (sumM) {
      const seg = sumM[1];
      const durM = seg.match(/transaction_duration_ms=(\d+)/);
      if (durM) task.duration = parseInt(durM[1], 10);
      const stM = seg.match(/response_status=(\d+)/);
      if (stM) task.status = parseInt(stM[1], 10);

      // Use connection number to look up URL from Pass 1 connection map.
      // connection=N in the summary refers to the network-layer [CN] connection.
      if (!task.url) {
        const connNumM = seg.match(/\bconnection=(\d+)/);
        if (connNumM) {
          const connNum = parseInt(connNumM[1], 10);
          if (connUrlMap.has(connNum)) {
            task.url = connUrlMap.get(connNum);
          }
        }
      }

      // Task is complete — record if it has a valid HTTP status
      if (task.status && task.status >= 100 && task.status < 600) {
        calls.push({
          method: task.method,
          endpoint: task.url ? extractEndpoint(task.url) : `API Call (Task ${tidM[2]})`,
          url: task.url || '<URL not captured>',
          status: task.status,
          responseTime: task.duration || 0,
          timestamp: task.timestamp,
        });
      }
      tasks.delete(taskId);
    }

    // Format B completion line with duration
    const compDurM = line.match(/completed\s*\{[^}]*duration\s*=\s*(\d+)/);
    if (compDurM && task.status) {
      task.duration = parseInt(compDurM[1], 10);
      calls.push({
        method: task.method,
        endpoint: task.url ? extractEndpoint(task.url) : `API Call (Task ${tidM[2]})`,
        url: task.url || '<URL not captured>',
        status: task.status,
        responseTime: task.duration,
        timestamp: task.timestamp,
      });
      tasks.delete(taskId);
    }
  }

  // Flush incomplete tasks that have at least status + url
  for (const task of tasks.values()) {
    if (task.status && task.status >= 100 && task.status < 600 && task.url) {
      calls.push({
        method: task.method,
        endpoint: extractEndpoint(task.url),
        url: task.url,
        status: task.status,
        responseTime: task.duration || 0,
        timestamp: task.timestamp,
      });
    }
  }

  return calls;
}

// ─────────────────────────────────────────────────────────────────────────────
// Android log parser
//
// Debug builds (OkHttp logging enabled):
//   --> POST https://api.cvs.com/v1/login
//   <-- 201 OK https://api.cvs.com/v1/login (421ms)
//
// Prod builds (NetworkSecurityConfig / System.err errors):
//   W NetworkSecurityConfig: ... cleartext traffic to api.cvs.com ... not permitted
//   W System.err: ... javax.net.ssl.SSLHandshakeException ...
// ─────────────────────────────────────────────────────────────────────────────
function parseAndroidLogs(logFile) {
  if (!fs.existsSync(logFile)) return [];

  const lines = fs.readFileSync(logFile, 'utf8').split('\n');
  const calls = [];
  let pending = null;

  for (const line of lines) {
    // ── OkHttp request (debug builds) ────────────────────────────────────────
    const reqM = line.match(/-->\s+(GET|POST|PUT|DELETE|PATCH|HEAD)\s+(https?:\/\/\S+)/);
    if (reqM) {
      pending = {
        method: reqM[1],
        url: reqM[2],
        timestamp: extractTimestamp(line),
      };
      continue;
    }

    // ── OkHttp response (debug builds) ───────────────────────────────────────
    const resM = line.match(/<--\s+(\d{3})\s+\S+\s+https?:\/\/\S+\s+\((\d+)ms\)/);
    if (resM && pending) {
      calls.push({
        method: pending.method,
        endpoint: extractEndpoint(pending.url),
        url: pending.url,
        status: parseInt(resM[1], 10),
        responseTime: parseInt(resM[2], 10),
        timestamp: pending.timestamp,
      });
      pending = null;
      continue;
    }

    // ── NetworkSecurityConfig warning (all builds) ───────────────────────────
    // Surfaces cleartext / cert errors even in production
    const nsM = line.match(/NetworkSecurityConfig.*?(https?:\/\/\S+|[a-z0-9.-]+\.[a-z]{2,})/i);
    if (nsM) {
      const url = nsM[1].startsWith('http') ? nsM[1] : `https://${nsM[1]}`;
      calls.push({
        method: 'HTTP',
        endpoint: extractEndpoint(url),
        url,
        status: 0,  // connection-level error, no HTTP status
        responseTime: 0,
        timestamp: extractTimestamp(line),
        note: 'NetworkSecurityConfig error',
      });
      continue;
    }

    // ── System.err SSL / network exceptions (all builds) ────────────────────
    const sslM = line.match(/System\.err.*?(SSLHandshakeException|UnknownHostException|SocketTimeoutException|ConnectException).*?(https?:\/\/\S+)?/);
    if (sslM) {
      const url = sslM[2] || 'unknown';
      calls.push({
        method: 'HTTP',
        endpoint: url !== 'unknown' ? extractEndpoint(url) : 'Connection error',
        url,
        status: 0,
        responseTime: 0,
        timestamp: extractTimestamp(line),
        note: sslM[1],
      });
    }
  }

  return calls;
}

// ─────────────────────────────────────────────────────────────────────────────
// Summarise and write api-calls.json
// ─────────────────────────────────────────────────────────────────────────────
function generateApiCallsFile() {
  let calls = [];

  const iosLog = path.join(networkDir, 'ios-network.log');
  const simLog = path.join(networkDir, 'simulator-network.log');
  const androidLog = path.join(networkDir, 'android-network.log');

  if (fs.existsSync(iosLog)) {
    console.log('📱 Parsing iOS network logs...');
    calls = parseIOSLogs(iosLog);
  } else if (fs.existsSync(simLog)) {
    console.log('📱 Parsing simulator network logs...');
    calls = parseIOSLogs(simLog);
  }

  if (fs.existsSync(androidLog)) {
    console.log('🤖 Parsing Android network logs...');
    calls = calls.concat(parseAndroidLogs(androidLog));
  }

  // ── Domain filter ────────────────────────────────────────────────────────
  // When full URLs are visible (private_data:on worked) filter to CVS domains
  // and drop any call whose URL was still not captured (connection C1 hashed URL etc).
  // When ALL URLs were redacted (private_data:on not active on this OS), keep any
  // call with a valid status so engineers still see timing/status data.
  const urlsCaptured = calls.some(c => c.url && c.url.startsWith('http'));

  const filtered = calls.filter(c => {
    if (isExcluded(c.url || '')) return false;
    if (c.url && c.url.startsWith('http')) {
      // Drop non-CVS domains when full URLs are visible
      return !urlsCaptured || isCVSDomain(c.url);
    }
    // URL still not captured — only keep when NO URLs were visible at all
    return !urlsCaptured && c.status >= 100 && c.status < 600;
  });

  // Remove duplicates (same method + url + status within the same test run)
  const seen = new Set();
  const unique = filtered.filter(c => {
    const key = `${c.method}-${c.url}-${c.status}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  unique.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  const summary = {
    totalCalls: unique.length,
    successfulCalls: unique.filter(c => c.status >= 200 && c.status < 300).length,
    failedCalls: unique.filter(c => c.status >= 400 || c.status === 0).length,
    avgResponseTime: unique.length > 0
      ? Math.round(unique.reduce((s, c) => s + (c.responseTime || 0), 0) / unique.length)
      : 0,
    urlsVisible: urlsCaptured,
  };

  const out = {
    timestamp: new Date().toISOString(),
    source: unique.length > 0 ? 'network-logs' : 'none',
    summary,
    calls: unique,
  };

  fs.mkdirSync(networkDir, { recursive: true });
  fs.writeFileSync(apiCallsFile, JSON.stringify(out, null, 2));

  if (unique.length > 0) {
    console.log(`✅ Captured ${unique.length} network calls`);
    console.log(`   Successful : ${summary.successfulCalls}`);
    console.log(`   Failed     : ${summary.failedCalls}`);
    console.log(`   Avg time   : ${summary.avgResponseTime}ms`);
    console.log(`   Full URLs  : ${urlsCaptured ? 'yes (private_data:on active)' : 'no (URLs redacted by OS)'}`);
  } else {
    console.log('✓ Network log parsed — no CVS API calls captured');
  }
  console.log(`   File: ${apiCallsFile}`);
}

try {
  generateApiCallsFile();
} catch (err) {
  console.error(`❌ Failed to parse network logs: ${err.message}`);
  process.exit(1);
}
