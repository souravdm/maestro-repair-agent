#!/usr/bin/env node
/**
 * Hierarchy Shim — replaces `maestro studio` as the fast hierarchy source for
 * the recorder backend (studioClient.ts).
 *
 * Exposes the same REST contract Studio used so studioClient.ts needs zero changes:
 *   GET /api/device-screen  →  { deviceScreen: { tree, screenshot } }
 *   GET /health             →  { status: "ok", source: "hierarchy-shim", treeReady: bool }
 *
 * Tree    : sourced from `maestro hierarchy` (pure JSON since Maestro 2.6.0),
 *           background-refreshed every REFRESH_INTERVAL_MS so callers always
 *           get a cached response (<5ms) after the first warm-up.
 *
 * Screenshot: captured fresh per-request via `xcrun simctl io booted screenshot`
 *             (iOS, ~80–150ms) or `adb exec-out screencap -p` (Android) — no JVM.
 *
 * Usage (called by start-recorder.sh):
 *   MAESTRO_STUDIO_PORT=9999 MAESTRO_PLATFORM=ios node hierarchy-server.js
 */
'use strict';

const http   = require('http');
const { execSync } = require('child_process');
const { createHash } = require('crypto');
const fs   = require('fs');
const os   = require('os');
const path = require('path');

const PORT     = parseInt(process.env.MAESTRO_STUDIO_PORT || '9999', 10);
const PLATFORM = (process.env.MAESTRO_PLATFORM || 'ios').toLowerCase();
const REFRESH_INTERVAL_MS = 2000;  // how often to background-refresh the tree

// ─── Hierarchy cache ──────────────────────────────────────────────────────────

let cachedTree = null;   // last-known Maestro element tree (parsed JSON)
let refreshing = false;

function parseMaestroOutput(raw) {
  // `maestro hierarchy` may emit a "Running on <device>..." prefix line before
  // the JSON. Find the first { and parse from there — same logic as Fix2.
  const lines = raw.split('\n');
  const idx = lines.findIndex(l => l.trim().startsWith('{'));
  if (idx < 0) throw new Error('no JSON object found in maestro hierarchy output');
  return JSON.parse(lines.slice(idx).join('\n'));
}

function fetchTree() {
  const raw = execSync('maestro hierarchy 2>/dev/null', {
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    timeout: 15000,
  });
  return parseMaestroOutput(raw);
}

function scheduleRefresh() {
  if (refreshing) return;
  refreshing = true;
  setImmediate(() => {
    try {
      cachedTree = fetchTree();
    } catch (e) {
      process.stderr.write(`[hierarchy-shim] tree refresh failed: ${e.message}\n`);
      // Keep serving the stale cache — a failed refresh is not fatal.
    } finally {
      refreshing = false;
      setTimeout(scheduleRefresh, REFRESH_INTERVAL_MS);
    }
  });
}

// ─── Screenshot ───────────────────────────────────────────────────────────────

function captureScreenshot() {
  const tmp = path.join(os.tmpdir(), `hshim-${PORT}.png`);
  try {
    if (PLATFORM === 'ios') {
      // xcrun talks directly to the simulator — no JVM, ~80–150ms.
      execSync(`xcrun simctl io booted screenshot "${tmp}" 2>/dev/null`, { timeout: 6000 });
    } else {
      // Android: screencap via ADB, output piped to temp file.
      execSync(`adb exec-out screencap -p > "${tmp}"`, { timeout: 6000, shell: true });
    }
    const data = fs.readFileSync(tmp);
    try { fs.unlinkSync(tmp); } catch (_) {}
    return `data:image/png;base64,${data.toString('base64')}`;
  } catch (e) {
    process.stderr.write(`[hierarchy-shim] screenshot failed: ${e.message}\n`);
    return null;
  }
}

// ─── HTTP server ──────────────────────────────────────────────────────────────

const server = http.createServer((req, res) => {

  // Health probe — answers immediately, before the tree is ready.
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      source: 'hierarchy-shim',
      platform: PLATFORM,
      treeReady: cachedTree !== null,
    }));
    return;
  }

  // Main endpoint — identical contract to the old Studio REST API.
  if (req.method === 'GET' && req.url === '/api/device-screen') {
    if (!cachedTree) {
      // Tree not ready yet (shim just started). Poll at 250ms intervals for up
      // to 15s before giving up. In practice the first maestro hierarchy call
      // completes in 2–4s, so the backend startup probe will usually succeed.
      const poll = (attemptsLeft) => {
        if (cachedTree) {
          serve(res);
          return;
        }
        if (attemptsLeft <= 0) {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'hierarchy not ready — try again shortly' }));
          return;
        }
        setTimeout(() => poll(attemptsLeft - 1), 250);
      };
      poll(60);  // 60 × 250ms = 15s max wait
      return;
    }

    // Cache is warm. Kick a background refresh so the next request stays fresh,
    // then respond immediately from cache + a live screenshot.
    if (!refreshing) scheduleRefresh();
    serve(res);
    return;
  }

  res.writeHead(404);
  res.end();
});

function serve(res) {
  const screenshot = captureScreenshot();
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ deviceScreen: { tree: cachedTree, screenshot } }));
}

server.on('error', (e) => {
  process.stderr.write(`[hierarchy-shim] fatal: ${e.message}\n`);
  process.exit(1);
});

server.listen(PORT, '127.0.0.1', () => {
  process.stdout.write(
    `[hierarchy-shim] listening on port ${PORT} (platform: ${PLATFORM}) — warming tree...\n`
  );
  // Kick off the first tree fetch immediately so it's ready by the time the
  // backend sends its first /api/device-screen probe (~5–10s after startup).
  scheduleRefresh();
});
