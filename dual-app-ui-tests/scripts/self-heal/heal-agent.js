#!/usr/bin/env node

/**
 * Self-Heal Agent
 *
 * Runs after a Maestro test failure. Finds broken element selectors, identifies
 * the correct replacement using heuristics + Claude AI, patches the screen file,
 * and writes a structured heal log for review.
 *
 * Usage (called by test.sh after failure):
 *   node scripts/self-heal/heal-agent.js \
 *     --test .maestro/flows/HAIO/TC008_HAIO_intent_claims.yaml \
 *     --log  test-reports/IOS_.../maestro-test.log \
 *     --hierarchy test-reports/IOS_.../heal-hierarchy.json \
 *     --platform ios \
 *     [--dry-run]           # show proposed changes without writing
 *     [--min-confidence 0.78]
 *
 * Exit codes:
 *   0 — healed (or dry-run showed a fix)
 *   1 — no fixable element failures found
 *   2 — failures found but confidence too low (heal log written for manual review)
 *   3 — unexpected error
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const { matchElement, APPLY_THRESHOLD }   = require('./element-matcher');
const { patchSelector, findScreenFilesContaining } = require('./screen-patcher');

const PROJECT_ROOT       = path.resolve(__dirname, '../..');
const IOS_INSPECTOR_PATH = path.join(PROJECT_ROOT, 'scripts/utils/ui-capture/ios-ui-inspector.js');
const SCREENS_DIR        = path.join(PROJECT_ROOT, '.maestro/screens');
const HEAL_LOG_DIR       = path.join(PROJECT_ROOT, '.maestro-heal-log');

// ─── CLI arg parsing ──────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { dryRun: false, minConfidence: APPLY_THRESHOLD };
  for (let i = 2; i < argv.length; i++) {
    switch (argv[i]) {
      case '--test':            args.testPath     = argv[++i]; break;
      case '--log':             args.logPath      = argv[++i]; break;
      case '--hierarchy':       args.hierarchyPath = argv[++i]; break;
      case '--platform':        args.platform     = argv[++i]; break;
      case '--dry-run':         args.dryRun       = true;      break;
      case '--min-confidence':  args.minConfidence = parseFloat(argv[++i]); break;
    }
  }
  return args;
}

// ─── Failure extraction ───────────────────────────────────────────────────────

/**
 * Extract "element not found" selector values from a Maestro log.
 * Maestro error formats vary across versions; we cover the common ones.
 */
function extractFailedSelectors(logContent) {
  const selectors = new Set();
  const patterns = [
    // "No element found for: Text matching regex: Send Message"
    /No element (?:found|matching)[:\s]+(?:Text matching regex:\s*)?(.+)/gi,
    // "Element not found: Send Message"
    /Element not found:\s*(.+)/gi,
    // "Assertion is false: "Send Message" is visible"
    /Assertion is false:\s*"([^"]+)"\s*is visible/gi,
    // "Could not find element with id: send_btn"
    /Could not find element with id:\s*(.+)/gi,
    // "✗ tapOn "Send Message""  followed by error lines
    /✗\s*(?:tapOn|assertVisible|extendedWaitUntil)[:\s]+"([^"]+)"/gi,
  ];

  for (const pattern of patterns) {
    let m;
    while ((m = pattern.exec(logContent)) !== null) {
      const raw = m[1].trim();
      if (raw && raw.length < 200) selectors.add(raw);
    }
  }

  return [...selectors];
}

// ─── Hierarchy loading ────────────────────────────────────────────────────────

/**
 * Load UI elements from:
 *   1. A pre-captured hierarchy JSON file (preferred — captured before daemon dies)
 *   2. Live `maestro hierarchy` call (fallback — only works while driver is alive)
 */
function loadElements(hierarchyPath) {
  // Option 1: pre-captured file
  if (hierarchyPath && fs.existsSync(hierarchyPath)) {
    try {
      const raw = fs.readFileSync(hierarchyPath, 'utf8');
      // The file may be a raw maestro hierarchy JSON or our extracted element array
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;

      // If it's the raw maestro JSON tree, walk it
      const elems = [];
      extractElementsFromTree(parsed, elems);
      if (elems.length > 0) return elems;
    } catch {
      // fall through to live capture
    }
  }

  // Option 2: live capture (requires maestro driver still running)
  const inspector = loadInspector();
  if (inspector?.captureUIHierarchy) {
    try {
      return inspector.captureUIHierarchy(null) || [];
    } catch {
      return [];
    }
  }

  return [];
}

function loadInspector() {
  try { return require(IOS_INSPECTOR_PATH); } catch { return null; }
}

/**
 * Minimal recursive element extractor (mirrors ios-ui-inspector.js logic).
 * Used when we have a raw maestro hierarchy JSON but the inspector isn't loadable.
 */
function extractElementsFromTree(node, out) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { node.forEach(n => extractElementsFromTree(n, out)); return; }

  const attrs = node.attributes || {};
  const text  = attrs.text || attrs.accessibilityText || attrs.title || '';
  const identifier = attrs.identifier || attrs.accessibilityIdentifier || attrs['resource-id'] || '';
  const type  = (attrs.type || 'unknown').toLowerCase();

  if (text || identifier) {
    out.push({ text: text.trim(), identifier: identifier.trim(), label: attrs.accessibilityLabel || text, value: attrs.value || null, type });
  }

  if (node.children) extractElementsFromTree(node.children, out);
  for (const key of Object.keys(node)) {
    if (key !== 'attributes' && key !== 'children' && typeof node[key] === 'object') {
      extractElementsFromTree(node[key], out);
    }
  }
}

// ─── Heal log ─────────────────────────────────────────────────────────────────

function writeHealLog(entries) {
  if (!fs.existsSync(HEAL_LOG_DIR)) fs.mkdirSync(HEAL_LOG_DIR, { recursive: true });

  const logPath = path.join(HEAL_LOG_DIR, 'changelog.json');
  let existing = [];
  try { existing = JSON.parse(fs.readFileSync(logPath, 'utf8')); } catch {}

  const updated = [...existing, ...entries];
  fs.writeFileSync(logPath, JSON.stringify(updated, null, 2), 'utf8');
  return logPath;
}

// ─── Pretty output ────────────────────────────────────────────────────────────

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m',
  green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', cyan: '\x1b[36m', dim: '\x1b[2m',
};

function log(msg)        { process.stdout.write(msg + '\n'); }
function ok(msg)         { log(`${C.green}✓${C.reset} ${msg}`); }
function warn(msg)       { log(`${C.yellow}⚠${C.reset}  ${msg}`); }
function fail(msg)       { log(`${C.red}✗${C.reset} ${msg}`); }
function info(msg)       { log(`${C.cyan}ℹ${C.reset}  ${msg}`); }
function dim(msg)        { log(`${C.dim}${msg}${C.reset}`); }
function section(title)  { log(`\n${C.bold}${title}${C.reset}`); }

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv);

  if (!args.testPath || !args.logPath) {
    fail('Usage: heal-agent.js --test <path> --log <path> [--hierarchy <json>] [--platform ios|android] [--dry-run]');
    process.exit(3);
  }

  const platform = args.platform || 'ios';
  const dryRun   = args.dryRun;

  section('Self-Heal Agent');
  info(`Test:     ${args.testPath}`);
  info(`Platform: ${platform}`);
  if (dryRun) warn('DRY RUN — no files will be modified');

  // 1. Read maestro log
  if (!fs.existsSync(args.logPath)) {
    fail(`Log file not found: ${args.logPath}`);
    process.exit(3);
  }
  const logContent = fs.readFileSync(args.logPath, 'utf8');

  // 2. Extract failed selectors
  const failedSelectors = extractFailedSelectors(logContent);
  if (failedSelectors.length === 0) {
    info('No element-not-found failures detected in log. Nothing to heal.');
    process.exit(1);
  }

  info(`Found ${failedSelectors.length} failed selector(s):`);
  failedSelectors.forEach(s => dim(`  • ${s}`));

  // 3. Load UI hierarchy
  section('Loading UI hierarchy…');
  const elements = loadElements(args.hierarchyPath);
  if (elements.length === 0) {
    warn('Could not capture UI hierarchy (maestro driver may be down). AI matching will be limited.');
  } else {
    info(`Loaded ${elements.length} UI elements from hierarchy.`);
  }

  // 4. For each failed selector: find screen file → match → patch
  section('Matching and patching…');

  const healEntries = [];
  let healedCount = 0;
  let lowConfidenceCount = 0;

  for (const failedSelector of failedSelectors) {
    log('');
    info(`Selector: "${failedSelector}"`);

    // Find which screen file(s) contain this selector
    const screenFiles = findScreenFilesContaining(SCREENS_DIR, failedSelector);
    if (screenFiles.length === 0) {
      warn(`  No screen file found containing "${failedSelector}" — may be hardcoded in flow/subflow (skip).`);
      continue;
    }

    for (const { file: screenFile, content: screenContent, key } of screenFiles) {
      const relFile = path.relative(PROJECT_ROOT, screenFile);
      info(`  Screen file: ${relFile}${key ? ` (key: ${key})` : ''}`);

      // Run matcher
      let result = null;
      try {
        result = await matchElement(failedSelector, elements, platform, screenContent);
      } catch (e) {
        warn(`  Matcher error: ${e.message}`);
      }

      if (!result) {
        fail(`  No match found. Adding to manual review queue.`);
        healEntries.push({
          timestamp: new Date().toISOString(),
          test: args.testPath,
          platform,
          failedSelector,
          screenFile: relFile,
          key,
          status: 'no-match',
          needsManualReview: true,
        });
        continue;
      }

      const { match, confidence, strategy, reasoning } = result;

      if (confidence < args.minConfidence) {
        warn(`  Low confidence match: "${match}" (${(confidence * 100).toFixed(0)}% via ${strategy})`);
        dim(`  Reason: ${reasoning || 'n/a'}`);
        lowConfidenceCount++;
        healEntries.push({
          timestamp: new Date().toISOString(),
          test: args.testPath,
          platform,
          failedSelector,
          proposedSelector: match,
          screenFile: relFile,
          key,
          confidence,
          strategy,
          status: 'low-confidence',
          needsManualReview: true,
        });
        continue;
      }

      log(`  ${C.green}Match:${C.reset} "${match}" — ${(confidence * 100).toFixed(0)}% confidence (${strategy})`);
      if (reasoning) dim(`  ${reasoning}`);

      if (dryRun) {
        ok(`  [DRY RUN] Would patch: "${failedSelector}" → "${match}" in ${relFile}`);
        healEntries.push({
          timestamp: new Date().toISOString(),
          test: args.testPath,
          platform,
          failedSelector,
          proposedSelector: match,
          screenFile: relFile,
          key,
          confidence,
          strategy,
          reasoning,
          status: 'dry-run',
        });
        healedCount++;
        continue;
      }

      // Apply patch
      try {
        const patchResult = patchSelector(screenFile, failedSelector, match, platform);
        if (!patchResult.patched) {
          warn(`  Patch skipped: ${patchResult.reason}`);
          continue;
        }

        ok(`  Patched ${patchResult.replacedCount} occurrence(s) in ${relFile}`);
        if (patchResult.diff?.changes?.length) {
          for (const change of patchResult.diff.changes) {
            dim(`  Line ${change.lineNumber}:`);
            dim(`    - ${change.before}`);
            dim(`    + ${change.after}`);
          }
        }

        healEntries.push({
          timestamp: new Date().toISOString(),
          test: args.testPath,
          platform,
          failedSelector,
          newSelector: match,
          screenFile: relFile,
          key,
          confidence,
          strategy,
          reasoning,
          replacedCount: patchResult.replacedCount,
          diff: patchResult.diff,
          status: 'healed',
        });
        healedCount++;
      } catch (e) {
        fail(`  Patch error: ${e.message}`);
      }
    }
  }

  // 5. Write heal log
  if (healEntries.length > 0) {
    const logFile = writeHealLog(healEntries);
    log('');
    info(`Heal log written to: ${path.relative(PROJECT_ROOT, logFile)}`);
  }

  // 6. Summary
  section('Summary');
  log(`  Total failed selectors : ${failedSelectors.length}`);
  log(`  Healed${dryRun ? ' (dry-run)' : ''}         : ${C.green}${healedCount}${C.reset}`);
  if (lowConfidenceCount > 0) {
    log(`  Low confidence (skipped): ${C.yellow}${lowConfidenceCount}${C.reset} — see ${path.join('.maestro-heal-log', 'changelog.json')}`);
  }
  log('');

  if (healedCount > 0 && !dryRun) {
    ok('Screen files updated. Re-run the test to verify.');
    process.exit(0);
  } else if (healedCount > 0 && dryRun) {
    ok('Dry run complete. Run without --dry-run to apply.');
    process.exit(0);
  } else if (lowConfidenceCount > 0) {
    warn('Low-confidence matches need manual review.');
    process.exit(2);
  } else {
    warn('No selectors could be healed automatically.');
    process.exit(1);
  }
}

main().catch((err) => {
  process.stderr.write(`heal-agent fatal error: ${err.message}\n`);
  process.exit(3);
});
