#!/usr/bin/env node
'use strict';

/**
 * Figma Baseline Sync
 *
 * Downloads design screenshots from Figma and saves them as visual-regression
 * baselines for comparison during test runs.
 *
 * Prerequisites:
 *   - FIGMA_ACCESS_TOKEN env var must be set (Figma Personal Access Token).
 *     Get one at: https://www.figma.com/settings → Personal access tokens
 *   - figma-mapping.json configured with fileKey / nodeId entries.
 *
 * Usage:
 *   FIGMA_ACCESS_TOKEN=<token> node scripts/utils/visual/figma-baseline-sync.js
 *   FIGMA_ACCESS_TOKEN=<token> node scripts/utils/visual/figma-baseline-sync.js \
 *       --mapping figma-mapping.json \
 *       --output  visual-regression-baselines/figma \
 *       --scale   2
 *
 * How to find fileKey and nodeId:
 *   fileKey : Figma URL → figma.com/design/{fileKey}/…
 *   nodeId  : right-click frame → "Copy link" → extract node-id param
 *             (convert dashes to colons: node-id=1-234 → "1:234")
 */

const https   = require('https');
const http    = require('http');
const fs      = require('fs');
const path    = require('path');

// ─── Config ──────────────────────────────────────────────────────────────────

const PROJECT_ROOT  = path.join(__dirname, '..', '..');
const DEFAULT_MAPPING = path.join(PROJECT_ROOT, 'figma-mapping.json');
const DEFAULT_OUTPUT  = path.join(PROJECT_ROOT, 'visual-regression-baselines', 'figma');

// CLI flags
const argv = process.argv.slice(2);
function argValue(flag) {
  const i = argv.indexOf(flag);
  return i !== -1 ? argv[i + 1] : null;
}

const MAPPING_FILE = argValue('--mapping') || DEFAULT_MAPPING;
const OUTPUT_DIR   = argValue('--output')  || DEFAULT_OUTPUT;
const SCALE        = parseInt(argValue('--scale') || '0', 10) || null; // falls through to per-screen / global default

// ─── Security: token from env only — never hardcoded ────────────────────────

const FIGMA_TOKEN = process.env.FIGMA_ACCESS_TOKEN;
if (!FIGMA_TOKEN) {
  console.error('❌  FIGMA_ACCESS_TOKEN env var is required.');
  console.error('    Set it before running: FIGMA_ACCESS_TOKEN=<token> node scripts/utils/visual/figma-baseline-sync.js');
  process.exit(1);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Fetch URL and return the raw response Buffer. Follows redirects. */
function fetchBuffer(targetUrl, headers = {}) {
  return new Promise((resolve, reject) => {
    const mod = targetUrl.startsWith('https:') ? https : http;
    const req = mod.get(targetUrl, { headers }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        // Follow redirect — strip auth header to avoid leaking token to 3rd-party S3
        return resolve(fetchBuffer(res.headers.location, {}));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} from ${targetUrl}`));
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end',  () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('error', reject);
  });
}

/** Fetch URL and parse response as JSON. */
async function fetchJson(targetUrl, headers = {}) {
  const buf = await fetchBuffer(targetUrl, headers);
  return JSON.parse(buf.toString('utf8'));
}

/**
 * Normalise Figma node ID: Figma URLs use dashes (1-234) but the REST API
 * and nodeId property in figma-mapping.json both use colons (1:234).
 */
function normaliseNodeId(nodeId) {
  return String(nodeId).replace(/-/g, ':');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  // Load mapping
  if (!fs.existsSync(MAPPING_FILE)) {
    console.error(`❌  Mapping file not found: ${MAPPING_FILE}`);
    console.error('    Copy and configure figma-mapping.json at the project root.');
    process.exit(1);
  }

  let mapping;
  try {
    mapping = JSON.parse(fs.readFileSync(MAPPING_FILE, 'utf8'));
  } catch (e) {
    console.error(`❌  Failed to parse ${MAPPING_FILE}: ${e.message}`);
    process.exit(1);
  }

  const screens = mapping.screens || {};
  const globalScale = SCALE || (mapping.defaults && mapping.defaults.scale) || 2;

  const screenNames = Object.keys(screens);
  if (screenNames.length === 0) {
    console.warn('⚠️   No screens defined in figma-mapping.json — nothing to sync.');
    process.exit(0);
  }

  // Ensure output directory exists
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log(`📁  Saving baselines to: ${OUTPUT_DIR}`);

  // Sync each screen
  let synced = 0;
  let skipped = 0;
  let failed = 0;

  for (const [screenName, screenCfg] of Object.entries(screens)) {
    const { fileKey, nodeId, description = screenName, scale: perScreenScale } = screenCfg;

    if (!fileKey || !nodeId) {
      console.warn(`⏭️   ${screenName}: fileKey or nodeId not configured — skipping.`);
      skipped++;
      continue;
    }

    const resolvedScale = perScreenScale || globalScale;
    const normNodeId    = normaliseNodeId(nodeId);
    // Figma API encodes colons as %3A in the query param
    const encodedNodeId = encodeURIComponent(normNodeId);

    console.log(`\n🎨  Syncing: ${screenName} (${description})`);
    console.log(`    fileKey=${fileKey}  nodeId=${normNodeId}  scale=${resolvedScale}`);

    try {
      // Step 1: request presigned image URLs from Figma
      const apiUrl = `https://api.figma.com/v1/images/${fileKey}?ids=${encodedNodeId}&format=png&scale=${resolvedScale}`;
      const apiResp = await fetchJson(apiUrl, { 'X-Figma-Token': FIGMA_TOKEN });

      if (apiResp.err) {
        throw new Error(`Figma API error: ${apiResp.err}`);
      }

      // The images map uses the original node ID as key (colon form)
      const imageUrl = (apiResp.images || {})[normNodeId];
      if (!imageUrl) {
        // Try with the raw nodeId in case server returned it differently
        const rawKey = Object.keys(apiResp.images || {})[0];
        const fallbackUrl = rawKey ? apiResp.images[rawKey] : null;
        if (!fallbackUrl) {
          throw new Error(`No image URL returned by Figma. Response keys: ${JSON.stringify(Object.keys(apiResp.images || {}))}`);
        }
        console.warn(`    ⚠️  Node ID key mismatch — using first available image.`);
        const pngBuf = await fetchBuffer(fallbackUrl);
        const outPath = path.join(OUTPUT_DIR, `${screenName}.png`);
        fs.writeFileSync(outPath, pngBuf);
        console.log(`    ✅  Saved: ${outPath} (${Math.round(pngBuf.length / 1024)}KB)`);
        synced++;
        continue;
      }

      // Step 2: download the PNG
      const pngBuf = await fetchBuffer(imageUrl);
      const outPath = path.join(OUTPUT_DIR, `${screenName}.png`);
      fs.writeFileSync(outPath, pngBuf);
      console.log(`    ✅  Saved: ${outPath} (${Math.round(pngBuf.length / 1024)}KB)`);
      synced++;

    } catch (e) {
      console.error(`    ❌  Failed: ${e.message}`);
      failed++;
    }
  }

  // Summary
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Figma baseline sync complete:`);
  console.log(`  ✅  Synced : ${synced}`);
  console.log(`  ⏭️   Skipped: ${skipped}`);
  console.log(`  ❌  Failed : ${failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch(e => {
  console.error(`\n❌  Unexpected error: ${e.message}`);
  process.exit(1);
});
