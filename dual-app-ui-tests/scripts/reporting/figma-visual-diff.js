#!/usr/bin/env node
'use strict';

/**
 * Figma Visual Diff
 *
 * Compares Maestro test screenshots against Figma design baselines using
 * pixel-level diffing (pixelmatch). Produces per-screen diff images and a
 * structured result object that generate-unified-report.js embeds in the
 * HTML test report under "🎨 Figma Visual Diff".
 *
 * Usage (as module):
 *   const { runFigmaDiff } = require('./figma-visual-diff');
 *   const data = runFigmaDiff('/path/to/test-reports/IOS_YYYYMMDD');
 *
 * Usage (CLI — standalone report):
 *   node scripts/reporting/figma-visual-diff.js <report-dir>
 *
 * Dependencies: pixelmatch (^5.x) + pngjs
 *   npm install pixelmatch@^5.3.0 pngjs
 *
 * Baseline images must be synced first:
 *   FIGMA_ACCESS_TOKEN=<token> node scripts/utils/visual/figma-baseline-sync.js
 */

const fs   = require('fs');
const path = require('path');

const PROJECT_ROOT  = path.join(__dirname, '..', '..');
const DEFAULT_MAPPING  = path.join(PROJECT_ROOT, 'figma-mapping.json');
const DEFAULT_BASELINE = path.join(PROJECT_ROOT, 'visual-regression-baselines', 'figma');

// ─── Pixel-diff helpers ───────────────────────────────────────────────────────

let PNG       = null;
let pixelmatch = null;

function loadDeps() {
  if (PNG) return true; // already loaded
  try {
    PNG        = require('pngjs').PNG;
    pixelmatch = require('pixelmatch');
    return true;
  } catch (_) {
    return false;
  }
}

function readPng(filePath) {
  const buf = fs.readFileSync(filePath);
  return PNG.sync.read(buf);
}

function writePng(img, filePath) {
  const buf = PNG.sync.write(img);
  fs.writeFileSync(filePath, buf);
}

// ─── Screenshot matching ──────────────────────────────────────────────────────

/**
 * Find the best screenshot in `screenshotsDir` matching `screenshotKey`.
 * Preference: most recent file whose name contains the key (case-insensitive).
 */
function findScreenshot(screenshotsDir, screenshotKey) {
  if (!fs.existsSync(screenshotsDir)) return null;
  const key = screenshotKey.toLowerCase();
  const files = fs.readdirSync(screenshotsDir)
    .filter(f => f.endsWith('.png') && f.toLowerCase().includes(key));
  if (files.length === 0) return null;
  // Pick newest by mtime
  files.sort((a, b) => {
    const ma = fs.statSync(path.join(screenshotsDir, a)).mtimeMs;
    const mb = fs.statSync(path.join(screenshotsDir, b)).mtimeMs;
    return mb - ma;
  });
  return path.join(screenshotsDir, files[0]);
}

// ─── Core comparison ─────────────────────────────────────────────────────────

/**
 * Compare baseline vs screenshot. Returns a result object.
 * @param {string} name          Screen key from figma-mapping.json
 * @param {object} screenCfg     Entry from figma-mapping.json screens map
 * @param {string} screenshotsDir Path to test report screenshots/
 * @param {string} baselineDir   Path to visual-regression-baselines/figma/
 * @param {string} diffsDir      Path to write diff PNGs into
 * @param {object} defaults      { diffThreshold, maxDiffPercent }
 */
function compareScreen(name, screenCfg, screenshotsDir, baselineDir, diffsDir, defaults) {
  const description    = screenCfg.description || name;
  const screenshotKey  = screenCfg.screenshotKey || name;
  const diffThreshold  = screenCfg.diffThreshold  ?? defaults.diffThreshold  ?? 0.1;
  const maxDiffPercent = screenCfg.maxDiffPercent  ?? defaults.maxDiffPercent ?? 5.0;

  const baselinePath   = path.join(baselineDir, `${name}.png`);
  const screenshotPath = findScreenshot(screenshotsDir, screenshotKey);

  const base = {
    name, description, diffThreshold, maxDiffPercent,
    baselinePath, screenshotPath,
    diffImagePath: null,
    status: 'SKIPPED',
    diffPct: null, diffPixels: null,
    baselineW: null, baselineH: null,
    screenshotW: null, screenshotH: null,
    error: null
  };

  if (!fs.existsSync(baselinePath)) {
    return { ...base, status: 'NO_BASELINE' };
  }
  if (!screenshotPath) {
    return { ...base, status: 'NO_SCREENSHOT' };
  }

  if (!loadDeps()) {
    return {
      ...base, status: 'SKIPPED',
      error: 'pixelmatch / pngjs not installed. Run: npm install pixelmatch@^5.3.0 pngjs'
    };
  }

  let img1, img2;
  try {
    img1 = readPng(baselinePath);
    img2 = readPng(screenshotPath);
  } catch (e) {
    return { ...base, status: 'ERROR', error: `PNG read error: ${e.message}` };
  }

  const result = {
    ...base,
    baselineW: img1.width, baselineH: img1.height,
    screenshotW: img2.width, screenshotH: img2.height
  };

  if (img1.width !== img2.width || img1.height !== img2.height) {
    return { ...result, status: 'SIZE_MISMATCH' };
  }

  // Run pixelmatch
  try {
    const diffImg = new PNG({ width: img1.width, height: img1.height });
    const numDiff = pixelmatch(
      img1.data, img2.data, diffImg.data,
      img1.width, img1.height,
      { threshold: diffThreshold }
    );
    const totalPixels = img1.width * img1.height;
    const diffPct     = (numDiff / totalPixels) * 100;

    // Save diff image
    const diffImageName = `${name}-diff.png`;
    const diffImagePath = path.join(diffsDir, diffImageName);
    writePng(diffImg, diffImagePath);

    const status = diffPct <= maxDiffPercent ? 'MATCH' : 'DIFF';
    return { ...result, diffPct, diffPixels: numDiff, diffImagePath, status };

  } catch (e) {
    return { ...result, status: 'ERROR', error: `pixelmatch error: ${e.message}` };
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Run Figma visual diff for all configured screens.
 *
 * @param {string} reportDir   Path to a test report directory (e.g. test-reports/IOS_20260324_…)
 * @param {object} [opts]
 * @param {string} [opts.mappingFile]  Override figma-mapping.json path
 * @param {string} [opts.baselineDir]  Override baselines directory
 * @returns {{ total, passed, failed, skipped, results: Array }}
 */
function runFigmaDiff(reportDir, opts = {}) {
  const mappingFile  = opts.mappingFile  || DEFAULT_MAPPING;
  const baselineDir  = opts.baselineDir  || DEFAULT_BASELINE;
  const screenshotsDir = path.join(reportDir, 'screenshots');
  const diffsDir       = path.join(reportDir, 'figma-diffs');

  // Load mapping
  if (!fs.existsSync(mappingFile)) {
    return { total: 0, passed: 0, failed: 0, skipped: 0, results: [], error: `Mapping file not found: ${mappingFile}` };
  }

  let mapping;
  try {
    mapping = JSON.parse(fs.readFileSync(mappingFile, 'utf8'));
  } catch (e) {
    return { total: 0, passed: 0, failed: 0, skipped: 0, results: [], error: `Failed to parse mapping: ${e.message}` };
  }

  const screens  = mapping.screens || {};
  const defaults = {
    diffThreshold:  (mapping.defaults && mapping.defaults.diffThreshold)  ?? 0.1,
    maxDiffPercent: (mapping.defaults && mapping.defaults.maxDiffPercent) ?? 5.0
  };

  const screenNames = Object.keys(screens).filter(k => !k.startsWith('_'));
  if (screenNames.length === 0) {
    return { total: 0, passed: 0, failed: 0, skipped: 0, results: [] };
  }

  // Create diffs output directory
  fs.mkdirSync(diffsDir, { recursive: true });

  const results = screenNames.map(name =>
    compareScreen(name, screens[name], screenshotsDir, baselineDir, diffsDir, defaults)
  );

  const total   = results.length;
  const passed  = results.filter(r => r.status === 'MATCH').length;
  const failed  = results.filter(r => r.status === 'DIFF' || r.status === 'SIZE_MISMATCH').length;
  const skipped = total - passed - failed;

  return { total, passed, failed, skipped, results };
}

// ─── HTML builder ─────────────────────────────────────────────────────────────

/**
 * Build the HTML snippet for the "🎨 Figma Visual Diff" report section.
 * Image paths are made relative to the `reportFile` so they work when opened
 * as a local file:// URL.
 *
 * @param {{ total, passed, failed, skipped, results }} diffData
 * @param {string} reportDir   Absolute path to the report directory
 * @returns {string}            HTML string (complete section div)
 */
function buildFigmaDiffHtml(diffData, reportDir) {
  if (!diffData || !diffData.results || diffData.results.length === 0) return '';

  const { total, passed, failed, skipped, results } = diffData;

  /** Make an absolute path relative to reportDir so <img src="…"> works. */
  function relImg(absPath) {
    if (!absPath) return '';
    try { return path.relative(reportDir, absPath); } catch (_) { return absPath; }
  }

  /** Badge colour by status */
  function statusBadge(status) {
    const map = {
      MATCH:          { cls: 'figma-match',   icon: '✅', label: 'MATCH' },
      DIFF:           { cls: 'figma-diff',    icon: '❌', label: 'DIFF' },
      SIZE_MISMATCH:  { cls: 'figma-size',    icon: '📐', label: 'SIZE MISMATCH' },
      NO_BASELINE:    { cls: 'figma-skip',    icon: '🔲', label: 'NO BASELINE' },
      NO_SCREENSHOT:  { cls: 'figma-skip',    icon: '📷', label: 'NO SCREENSHOT' },
      SKIPPED:        { cls: 'figma-skip',    icon: '⏭️',  label: 'SKIPPED' },
      ERROR:          { cls: 'figma-error',   icon: '⚠️',  label: 'ERROR' }
    };
    const b = map[status] || { cls: 'figma-skip', icon: '?', label: status };
    return `<span class="figma-badge ${b.cls}">${b.icon} ${b.label}</span>`;
  }

  const rows = results.map(r => {
    const baselineImg   = r.baselinePath   && fs.existsSync(r.baselinePath)   ? relImg(r.baselinePath)   : '';
    const screenshotImg = r.screenshotPath && fs.existsSync(r.screenshotPath) ? relImg(r.screenshotPath) : '';
    const diffImg       = r.diffImagePath  && fs.existsSync(r.diffImagePath)  ? relImg(r.diffImagePath)  : '';

    const diffPctText = r.diffPct != null ? `${r.diffPct.toFixed(2)}%` : '—';
    const pixelText   = r.diffPixels != null ? `${r.diffPixels.toLocaleString()} px` : '—';
    const sizeText    = r.baselineW
      ? `Figma: ${r.baselineW}×${r.baselineH} / App: ${r.screenshotW}×${r.screenshotH}`
      : '';

    return `
      <div class="figma-row">
        <div class="figma-row-header">
          <div class="figma-row-title">
            <strong>${r.name}</strong>
            <span class="figma-row-desc">${r.description || ''}</span>
          </div>
          <div class="figma-row-meta">
            ${statusBadge(r.status)}
            ${r.diffPct != null ? `<span class="figma-diffpct ${r.status === 'DIFF' ? 'figma-diffpct-fail' : ''}">${diffPctText} diff</span>` : ''}
            ${sizeText ? `<span class="figma-size-info">${sizeText}</span>` : ''}
            ${r.error ? `<span class="figma-error-msg">${r.error}</span>` : ''}
          </div>
        </div>
        <div class="figma-images">
          <div class="figma-img-col">
            <div class="figma-img-label">🎨 Figma Design</div>
            ${baselineImg ? `<img src="${baselineImg}" loading="lazy" alt="Figma baseline" class="figma-img">` : `<div class="figma-img-placeholder">No baseline</div>`}
          </div>
          <div class="figma-img-col">
            <div class="figma-img-label">📱 App Screenshot</div>
            ${screenshotImg ? `<img src="${screenshotImg}" loading="lazy" alt="App screenshot" class="figma-img">` : `<div class="figma-img-placeholder">No screenshot</div>`}
          </div>
          <div class="figma-img-col">
            <div class="figma-img-label">🔍 Diff <span class="figma-pixel-count">(${pixelText})</span></div>
            ${diffImg ? `<img src="${diffImg}" loading="lazy" alt="Pixel diff" class="figma-img">` : `<div class="figma-img-placeholder">${r.status === 'MATCH' ? 'No diff' : 'Not available'}</div>`}
          </div>
        </div>
      </div>`;
  }).join('\n');

  return `
    <div class="figma-diff-section">
      <div class="section-toggle-header" onclick="toggleSection(this)">
        <span class="section-toggle-icon">▶</span>
        <h2>🎨 Figma Visual Diff</h2>
        <div class="figma-summary-badges">
          <span class="figma-badge figma-match">✅ ${passed} Match</span>
          <span class="figma-badge figma-diff">❌ ${failed} Diff</span>
          <span class="figma-badge figma-skip">⏭️ ${skipped} Skipped</span>
          <span class="figma-total-label">of ${total} screens</span>
        </div>
      </div>
      <div class="section-collapsible-body">
        <style>
          .figma-diff-section { margin-bottom: 24px; }
          .figma-summary-badges { display:inline-flex; gap:8px; margin-left:12px; flex-wrap:wrap; align-items:center; }
          .figma-total-label { font-size:12px; color:#888; }
          .figma-row { border:1px solid #ddd; border-radius:8px; margin-bottom:16px; overflow:hidden; }
          .figma-row-header { display:flex; justify-content:space-between; align-items:flex-start; padding:12px 16px; background:#fafafa; border-bottom:1px solid #eee; flex-wrap:wrap; gap:8px; }
          .figma-row-title { display:flex; flex-direction:column; gap:2px; }
          .figma-row-desc { font-size:12px; color:#666; }
          .figma-row-meta { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
          .figma-images { display:grid; grid-template-columns:repeat(3,1fr); gap:0; }
          .figma-img-col { padding:12px; border-right:1px solid #eee; text-align:center; }
          .figma-img-col:last-child { border-right:none; }
          .figma-img-label { font-size:12px; font-weight:600; margin-bottom:8px; color:#555; }
          .figma-img { max-width:100%; height:auto; max-height:320px; object-fit:contain; border:1px solid #ddd; border-radius:4px; }
          .figma-img-placeholder { height:120px; display:flex; align-items:center; justify-content:center; color:#aaa; font-size:13px; background:#fafafa; border:1px dashed #ddd; border-radius:4px; }
          .figma-badge { display:inline-flex; align-items:center; gap:4px; padding:2px 8px; border-radius:12px; font-size:11px; font-weight:600; white-space:nowrap; }
          .figma-match { background:#e6f4ea; color:#1e7e34; }
          .figma-diff  { background:#fce8e8; color:#c62828; }
          .figma-size  { background:#fff3e0; color:#e65100; }
          .figma-skip  { background:#f5f5f5; color:#757575; }
          .figma-error { background:#fff8e1; color:#f57f17; }
          .figma-diffpct { font-size:13px; font-weight:700; color:#333; }
          .figma-diffpct-fail { color:#c62828; }
          .figma-pixel-count { font-weight:normal; font-size:11px; color:#888; }
          .figma-size-info { font-size:11px; color:#888; }
          .figma-error-msg { font-size:11px; color:#d32f2f; font-style:italic; }
          @media (max-width: 700px) { .figma-images { grid-template-columns: 1fr; } }
        </style>
        ${rows}
      </div>
    </div>`;
}

// ─── Module exports ────────────────────────────────────────────────────────────

module.exports = { runFigmaDiff, buildFigmaDiffHtml };

// ─── CLI mode ─────────────────────────────────────────────────────────────────

if (require.main === module) {
  const reportDir = process.argv[2];
  if (!reportDir) {
    console.error('Usage: node scripts/reporting/figma-visual-diff.js <report-dir>');
    process.exit(1);
  }
  if (!fs.existsSync(reportDir)) {
    console.error(`❌  Report directory not found: ${reportDir}`);
    process.exit(1);
  }

  const data = runFigmaDiff(reportDir);

  if (data.error) {
    console.error(`❌  ${data.error}`);
    process.exit(1);
  }
  if (data.total === 0) {
    console.log('ℹ️   No screens configured in figma-mapping.json — nothing to diff.');
    process.exit(0);
  }

  console.log(`\n🎨  Figma Visual Diff — ${reportDir}`);
  console.log(`${'─'.repeat(60)}`);
  for (const r of data.results) {
    const pct = r.diffPct != null ? ` (${r.diffPct.toFixed(2)}%)` : '';
    const icon = { MATCH: '✅', DIFF: '❌', SIZE_MISMATCH: '📐', NO_BASELINE: '🔲', NO_SCREENSHOT: '📷', SKIPPED: '⏭️', ERROR: '⚠️' }[r.status] || '?';
    console.log(`  ${icon}  ${r.name}: ${r.status}${pct}${r.error ? ' — ' + r.error : ''}`);
  }
  console.log(`${'─'.repeat(60)}`);
  console.log(`  ✅ ${data.passed} match  ❌ ${data.failed} diff  ⏭️  ${data.skipped} skipped  (${data.total} total)`);

  if (data.failed > 0) process.exit(1);
}
