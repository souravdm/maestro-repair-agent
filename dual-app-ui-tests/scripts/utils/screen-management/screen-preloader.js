#!/usr/bin/env node
/**
 * screen-preloader.js
 *
 * Automatically discovers all screen files (.maestro/screens/**\/*.js) needed
 * by a Maestro flow and all its referenced subflows, then generates / injects
 * the corresponding `runScript` entries into the flow's `onFlowStart` section.
 *
 * How it works:
 *   1. Builds a namespace→screenFile index by scanning every screen .js file
 *      for `output.NAMESPACE = {` / `output.NAMESPACE={` declarations.
 *   2. Recursively follows all `runFlow:` references from the input flow file.
 *   3. Extracts every `${output.NAMESPACE.something}` reference from those files.
 *   4. Maps referenced namespaces → screen file absolute paths (deduplicated).
 *   5. Generates `onFlowStart` runScript entries with paths relative to the flow.
 *
 * Usage:
 *   node scripts/utils/screen-management/screen-preloader.js <flow-file>
 *       Print the generated onFlowStart YAML block (default / --print)
 *
 *   node scripts/utils/screen-management/screen-preloader.js <flow-file> --inject
 *       Inject/replace screen runScript entries in the flow's onFlowStart
 *       (modifies in-place; preserves credentials-loader and other non-screen entries)
 *
 *   node scripts/utils/screen-management/screen-preloader.js <flow-file> --generate-temp
 *       Write a temp file (.tmp_preloaded_<name>.yaml) with onFlowStart injected,
 *       print its absolute path to stdout. Used by scripts/testing/test.sh --auto-preload.
 *
 *   node scripts/utils/screen-management/screen-preloader.js <flow-file> --verbose
 *       Show full dependency tree and namespace resolution details.
 *
 *   node scripts/utils/screen-management/screen-preloader.js <flow-file> --screens-only
 *       Print just the discovered screen file paths (one per line).
 */
'use strict';

const fs   = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const SCREENS_ROOT = path.join(PROJECT_ROOT, '.maestro', 'screens');

// ---------------------------------------------------------------------------
// Step 1: Build namespace → screen-file index
//
// Scans every .js file under .maestro/screens/ for:
//   output.NAMESPACE = {
//   output.NAMESPACE={
// A single screen file can export multiple namespaces (e.g. LoginScreen.js
// exports both `output.account_login` and `output.account_health100_onboarding`).
// ---------------------------------------------------------------------------
function buildNamespaceIndex() {
  const index = new Map(); // namespace string → absolute path to screen file

  function scanDir(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch (_) { return; }

    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        scanDir(full);
      } else if (entry.isFile() && entry.name.endsWith('.js')) {
        let content;
        try { content = fs.readFileSync(full, 'utf8'); }
        catch (_) { continue; }

        const rx = /\boutput\.([a-zA-Z_][a-zA-Z0-9_]*)\s*=/g;
        let m;
        while ((m = rx.exec(content)) !== null) {
          const ns = m[1];
          // First definition wins (multiple screen files could theoretically
          // export the same namespace — unlikely but handle gracefully).
          if (!index.has(ns)) {
            index.set(ns, full);
          }
        }
      }
    }
  }

  if (fs.existsSync(SCREENS_ROOT)) scanDir(SCREENS_ROOT);
  return index;
}

// ---------------------------------------------------------------------------
// Step 2: Recursively collect all YAML files (flow + referenced subflows)
//
// Handles both inline and file: forms of runFlow:
//   - runFlow: path/to/subflow.yaml
//   - runFlow:
//       file: path/to/subflow.yaml
//       when: ...
//   - runFlow:
//       when: ...
//       commands:
//         - runFlow: nested/subflow.yaml
// ---------------------------------------------------------------------------
function extractRunFlowPaths(content) {
  const found = [];

  // Pass 1 — inline form:  - runFlow: some/path.yaml
  // The leading `- ` is part of YAML list syntax, so include it optionally.
  const rxInline = /(?:^|(?<=\n))\s*(?:-\s+)?runFlow:\s+['"]?([^\s'"#\n]+\.yaml)['"]?[ \t]*(?:\n|$)/gm;
  let m;
  while ((m = rxInline.exec(content)) !== null) found.push(m[1].trim());

  // Pass 2 — block form:  - runFlow:\n      file: some/path.yaml
  // Split on every `runFlow:` occurrence and look for a `file:` key in the
  // immediately following indented lines (up to ~8 lines, stop at next key).
  const segments = content.split(/(?=runFlow:)/);
  for (const seg of segments) {
    if (!seg.startsWith('runFlow:')) continue;
    const lines = seg.split('\n').slice(1, 9); // lines after the `runFlow:` line
    for (const line of lines) {
      const fm = /^\s+file:\s+['"]?([^\s'"#\n]+\.yaml)['"]?/.exec(line);
      if (fm) { found.push(fm[1].trim()); break; }
      // Stop if we reach a non-indented key or the end of the indented block
      if (/^\S/.test(line) && line.trim() !== '') break;
    }
  }

  return found;
}

function collectYamlFiles(flowPath, visited, verbose) {
  const abs = path.resolve(flowPath);
  if (visited.has(abs)) return;
  visited.add(abs);

  if (!fs.existsSync(abs)) {
    process.stderr.write(`[WARN] File not found: ${abs}\n`);
    return;
  }

  let content;
  try { content = fs.readFileSync(abs, 'utf8'); }
  catch (e) {
    process.stderr.write(`[WARN] Cannot read: ${abs} — ${e.message}\n`);
    return;
  }

  const dir = path.dirname(abs);
  for (const rel of extractRunFlowPaths(content)) {
    const child = path.resolve(dir, rel);
    if (verbose) process.stderr.write(`  -> ${path.relative(PROJECT_ROOT, child)}\n`);
    collectYamlFiles(child, visited, verbose);
  }
}

// ---------------------------------------------------------------------------
// Step 3: Extract all `output.NAMESPACE` references used in YAML files
// ---------------------------------------------------------------------------
function extractNamespacesUsed(yamlFiles) {
  const namespaces = new Set();
  const rx = /\$\{output\.([a-zA-Z_][a-zA-Z0-9_]*)\./g;

  for (const file of yamlFiles) {
    let content;
    try { content = fs.readFileSync(file, 'utf8'); }
    catch (_) { continue; }

    let m;
    while ((m = rx.exec(content)) !== null) namespaces.add(m[1]);
    rx.lastIndex = 0;
  }
  return namespaces;
}

// ---------------------------------------------------------------------------
// Step 4: Map namespaces → screen file absolute paths (deduplicated)
// ---------------------------------------------------------------------------
function resolveScreenFiles(namespaces, nsIndex) {
  // Use insertion-order Map to deduplicate while keeping a stable order
  const resolved = new Map();
  const missing  = [];

  for (const ns of namespaces) {
    if (nsIndex.has(ns)) {
      resolved.set(nsIndex.get(ns), ns);  // path → representative namespace
    } else {
      missing.push(ns);
    }
  }

  return { screenFiles: [...resolved.keys()], missing };
}

// ---------------------------------------------------------------------------
// Step 5a: Clean redundant screen runScript entries from subflow files
//
// Removes simple `- runScript: <path>.js` lines that resolve to a known
// screen file. Multi-line runScript blocks (with file:/env: keys) are kept
// so credentials-loader and similar parametrised scripts are never touched.
// The flow file itself is skipped — its onFlowStart is managed by inject/genTemp.
// Operation is idempotent: re-running on already-clean files is a no-op.
// ---------------------------------------------------------------------------
function cleanSubflows(yamlFiles, flowFile, nsIndex) {
  const screenPaths  = new Set(nsIndex.values()); // absolute paths of all screen .js files
  const flowAbs      = path.resolve(flowFile);
  let   filesChanged = 0;
  let   linesRemoved = 0;

  for (const yamlAbs of yamlFiles) {
    if (yamlAbs === flowAbs) continue; // flow's onFlowStart is managed separately
    if (!fs.existsSync(yamlAbs)) continue;

    const content = fs.readFileSync(yamlAbs, 'utf8');
    const dir     = path.dirname(yamlAbs);
    const lines   = content.split('\n');

    const kept = lines.filter(line => {
      // Only target the simple one-liner form:  - runScript: some/path.js
      const m = /^\s*-\s+runScript:\s+['"]?([^\s'"#\n]+\.js)['"]?\s*$/.exec(line);
      if (!m) return true; // keep everything else (multi-line blocks, comments, etc.)
      const jsAbs = path.resolve(dir, m[1].trim());
      if (screenPaths.has(jsAbs)) {
        linesRemoved++;
        return false; // drop this line
      }
      return true; // not a screen file — keep it
    });

    const newContent = kept.join('\n');
    if (newContent !== content) {
      fs.writeFileSync(yamlAbs, newContent, 'utf8');
      filesChanged++;
    }
  }

  return { filesChanged, linesRemoved };
}

// ---------------------------------------------------------------------------
// Step 5: Generate runScript YAML lines relative to the flow file
// ---------------------------------------------------------------------------
function toRelPath(fromFile, toAbs) {
  return path.relative(path.dirname(path.resolve(fromFile)), toAbs)
    .replace(/\\/g, '/');
}

function generatePreloadLines(flowFile, screenFiles, indent = '    ') {
  return screenFiles.map(f => `${indent}- runScript: ${toRelPath(flowFile, f)}`);
}

// ---------------------------------------------------------------------------
// Step 6: Inject / merge into onFlowStart section
//
// Rules:
//   - If no onFlowStart exists: create one before the --- separator.
//   - If onFlowStart exists: replace simple `- runScript: <path>.js` entries
//     (screen files) with the newly computed set; keep everything else intact
//     (e.g. `runScript:\n    file: credentials-loader.js\n    env: ...`).
// ---------------------------------------------------------------------------
function injectOnFlowStart(content, newScreenLines, flowFile, screenFiles) {
  // Locate the --- separator that divides front-matter from commands
  const sepMatch = content.match(/\n---[ \t]*\n/);
  const sepIdx   = sepMatch ? content.indexOf(sepMatch[0]) : -1;

  const frontMatter = sepIdx !== -1 ? content.slice(0, sepIdx) : content;
  const rest        = sepIdx !== -1 ? content.slice(sepIdx)    : '';

  const hasOnFlowStart = /^onFlowStart:/m.test(frontMatter);

  // Detect the indentation level used by existing onFlowStart entries.
  // Look for the first `- runScript:` or `- ` list item inside onFlowStart
  // and use its leading whitespace as the canonical indent.
  let detectedIndent = '    '; // default: 4 spaces (project convention)
  if (hasOnFlowStart) {
    const afterStart = frontMatter.split(/^onFlowStart:.*$/m)[1] || '';
    const indentMatch = afterStart.match(/^( +)- /m);
    if (indentMatch) {
      detectedIndent = indentMatch[1];
    }
  }

  // Regenerate screen preload lines at the detected indent level
  if (flowFile && screenFiles) {
    newScreenLines = generatePreloadLines(flowFile, screenFiles, detectedIndent);
  }

  if (!hasOnFlowStart) {
    // Append onFlowStart before the --- separator
    const block = 'onFlowStart:\n' + newScreenLines.join('\n') + '\n';
    return frontMatter + '\n' + block + rest;
  }

  // Replace existing onFlowStart block
  const lines    = frontMatter.split('\n');
  const outLines = [];
  let   inBlock  = false;
  const keptNonScreen = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!inBlock) {
      if (/^onFlowStart:/.test(line)) {
        inBlock = true;
        // Don't emit this line yet; rebuild the block below
        continue;
      }
      outLines.push(line);
      continue;
    }

    // Inside onFlowStart block: stop when we hit the next top-level key
    const isTopLevel = /^[a-zA-Z_-]/.test(line) && line.trim() !== '';
    if (isTopLevel) {
      inBlock = false;
      outLines.push(line);
      continue;
    }

    // Keep non-screen-file entries (credentials-loader, multi-line runScript
    // blocks with env:, comments, etc.)
    // A "screen entry" looks exactly like:  - runScript: some/path.js
    const isSimpleScreenEntry = /^\s+-\s+runScript:\s+\S+\.js\s*$/.test(line);
    if (!isSimpleScreenEntry) {
      keptNonScreen.push(line);
    }
  }

  const screenBlock    = 'onFlowStart:\n' + newScreenLines.join('\n');
  const nonScreenPart  = keptNonScreen.length ? '\n' + keptNonScreen.join('\n') : '';

  return outLines.join('\n') + '\n' + screenBlock + nonScreenPart + '\n' + rest;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const args       = process.argv.slice(2);
const flowFile   = args.find(a => !a.startsWith('--'));
const verbose    = args.includes('--verbose');
const screensOnly   = args.includes('--screens-only');
const injectMode    = args.includes('--inject');
const genTemp       = args.includes('--generate-temp');
const cleanSubflowsMode = args.includes('--clean-subflows');
// default: --print
const printMode  = !injectMode && !genTemp && !screensOnly && !cleanSubflowsMode;

if (!flowFile) {
  process.stderr.write([
    'Usage: node scripts/utils/screen-management/screen-preloader.js <flow-file> [options]',
    '',
    'Options:',
    '  --print           Print generated onFlowStart YAML (default)',
    '  --inject          Inject screen preloads into the flow file in-place',
    '  --generate-temp   Write temp flow file with preloads, print its path',
    '  --clean-subflows  Remove redundant screen runScript lines from subflows',
    '  --screens-only    Print discovered screen file paths only',
    '  --verbose         Show full dependency tree and namespace details',
    '',
    'Flags can be combined, e.g.: --inject --clean-subflows',
  ].join('\n'));
  process.exit(1);
}

if (!fs.existsSync(path.resolve(flowFile))) {
  process.stderr.write(`Error: flow file not found: ${flowFile}\n`);
  process.exit(1);
}

// 1. Namespace index
if (verbose) process.stderr.write('Building namespace index from .maestro/screens/...\n');
const nsIndex = buildNamespaceIndex();
if (verbose) {
  const uniqueFiles = new Set(nsIndex.values()).size;
  process.stderr.write(`  ${nsIndex.size} namespaces across ${uniqueFiles} screen files\n\n`);
}

// 2. Collect flow + subflows
if (verbose) process.stderr.write(`Scanning dependency graph from: ${flowFile}\n`);
const yamlFiles = new Set();
collectYamlFiles(flowFile, yamlFiles, verbose);
if (verbose) process.stderr.write(`  Total YAML files scanned: ${yamlFiles.size}\n\n`);

// 3. Extract referenced namespaces
const namespaces = extractNamespacesUsed(yamlFiles);
if (verbose) {
  process.stderr.write(`Referenced output namespaces (${namespaces.size}):\n`);
  for (const ns of [...namespaces].sort()) process.stderr.write(`  output.${ns}\n`);
  process.stderr.write('\n');
}

// 4. Resolve to screen files
const { screenFiles, missing } = resolveScreenFiles(namespaces, nsIndex);
if (missing.length) {
  process.stderr.write(`[WARN] No screen file found for: ${missing.join(', ')}\n`);
}

if (screensOnly) {
  for (const f of screenFiles) console.log(f);
  process.exit(0);
}

if (screenFiles.length === 0) {
  if (verbose) process.stderr.write('No screen files to preload.\n');
  // --generate-temp: output nothing — caller checks for empty string and falls
  // back to $TEST_FILE (the original path). Returning path.resolve(flowFile) here
  // caused run-test-suite.sh to delete the original flow file: the bash cleanup
  // check compared the un-normalized $TEST_FILE (with ../) against the normalized
  // path returned here, they differed, and `rm -f $PRELOADED_TEST_FILE` ran on
  // the original.
  process.exit(0);
}

if (verbose) {
  process.stderr.write(`Screen files to preload (${screenFiles.length}):\n`);
  for (const f of screenFiles) process.stderr.write(`  ${path.relative(PROJECT_ROOT, f)}\n`);
  process.stderr.write('\n');
}

// 5. Generate preload lines
const preloadLines = generatePreloadLines(flowFile, screenFiles);

// 6. Output
if (printMode) {
  console.log('onFlowStart:');
  console.log(preloadLines.join('\n'));
}

if (injectMode || genTemp) {
  const original   = fs.readFileSync(path.resolve(flowFile), 'utf8');
  const newContent = injectOnFlowStart(original, preloadLines, flowFile, screenFiles);

  if (injectMode) {
    fs.writeFileSync(path.resolve(flowFile), newContent, 'utf8');
    process.stderr.write(
      `Injected ${screenFiles.length} screen preload(s) into onFlowStart: ${flowFile}\n`
    );
  }

  if (genTemp) {
    const tempPath = path.join(
      path.dirname(path.resolve(flowFile)),
      `.tmp_preloaded_${path.basename(flowFile)}`
    );
    fs.writeFileSync(tempPath, newContent, 'utf8');
    // Print ONLY the path — consumed by test.sh via $( ... )
    process.stdout.write(tempPath);
  }
}

// 7. Clean redundant screen runScript entries from subflows
if (cleanSubflowsMode) {
  const { filesChanged, linesRemoved } = cleanSubflows(yamlFiles, flowFile, nsIndex);
  if (filesChanged > 0) {
    process.stderr.write(
      `Cleaned ${linesRemoved} redundant runScript line(s) from ${filesChanged} subflow file(s)\n`
    );
  } else {
    process.stderr.write('Subflows already clean — no changes needed\n');
  }
}
