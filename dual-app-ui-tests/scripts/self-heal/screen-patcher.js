#!/usr/bin/env node

/**
 * Screen Patcher
 *
 * Safely replaces a broken selector value inside a .maestro/screens/*.js file.
 * Handles three value shapes:
 *
 *   1. Simple string      sendBtn: "Send Message"
 *   2. Regex pattern      chatInput: "Search or ask.*|Your message,"
 *   3. Platform ternary   backBtn: __isIOS ? "Back" : "Navigate up"
 *
 * For platform ternaries the patch targets only the side that matches the
 * platform the failure was reported on.
 *
 * Exports: patchSelector(screenFile, failedSelector, newSelector, platform)
 *          → { patched, replacedCount, diff }  or throws on fs error
 */

'use strict';

const fs   = require('fs');
const path = require('path');

/**
 * Escape a literal string so it can be used inside a RegExp character class
 * or as a literal pattern (not a regex pattern itself).
 */
function escapeForRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Try to find which key in the screen file holds failedSelector as its value.
 * Returns { key, lineNumber } or null.
 */
function findKeyForSelector(content, failedSelector) {
  const escaped = escapeForRegex(failedSelector);
  // Match:  someKey: "failedSelector"
  //    or:  someKey: __isIOS ? "failedSelector" : "other"
  //    or:  someKey: __isIOS ? "other" : "failedSelector"
  const pattern = new RegExp(
    `([a-zA-Z_][a-zA-Z0-9_]*)\\s*:\\s*(?:__isIOS\\s*\\?\\s*)?(?:"${escaped}"|.*?:\\s*"${escaped}")`,
    'm'
  );
  const match = content.match(pattern);
  if (!match) return null;

  const linesBefore = content.slice(0, match.index).split('\n');
  return { key: match[1], lineNumber: linesBefore.length };
}

/**
 * Pure compute core for patchSelector — no fs access, never writes anything.
 * Returns { content, replacedCount } where content === original when nothing
 * changed. Shared by the write path (patchSelector) and the read-only preview
 * path (the --dry-run CLI mode), so both can never disagree on the result.
 *
 * Strategy:
 *   - Finds the exact quoted string `"failedSelector"` in the content.
 *   - When the value is a platform ternary (iOS ? A : B), replaces only the
 *     side that corresponds to `platform`.
 *   - Leaves all other content untouched.
 */
function computeSelectorPatch(original, failedSelector, newSelector, platform = 'ios') {
  const escaped = escapeForRegex(failedSelector);
  const quotedPattern = new RegExp(`"${escaped}"`, 'g');

  const occurrences = (original.match(quotedPattern) || []).length;
  if (occurrences === 0) {
    return { content: original, replacedCount: 0, reason: 'selector value not found in file' };
  }

  // For platform ternaries, be surgical: only replace the correct side.
  // Pattern: __isIOS ? "A" : "B"
  const ternaryIOS     = new RegExp(`(__isIOS\\s*\\?\\s*)"${escaped}"(\\s*:\\s*"[^"]*")`, 'g');
  const ternaryAndroid = new RegExp(`(__isIOS\\s*\\?\\s*"[^"]*"\\s*:\\s*)"${escaped}"`, 'g');

  let patched = original;
  let replacedCount = 0;

  if (platform === 'ios') {
    patched = original.replace(ternaryIOS, (_, prefix, suffix) => {
      replacedCount++;
      return `${prefix}"${newSelector}"${suffix}`;
    });
  } else if (platform === 'android') {
    patched = original.replace(ternaryAndroid, (_, prefix) => {
      replacedCount++;
      return `${prefix}"${newSelector}"`;
    });
  }

  if (patched === original) {
    // Simple string or regex — replace all occurrences
    patched = original.replace(quotedPattern, () => {
      replacedCount++;
      return `"${newSelector}"`;
    });
  }

  if (patched === original) {
    return { content: original, replacedCount: 0, reason: 'replacement produced no change' };
  }

  return { content: patched, replacedCount };
}

/**
 * Writes computeSelectorPatch's result atomically (temp file → rename).
 * This is the ONLY function in this file that touches disk for a rename —
 * callers that only need a preview must use computeSelectorPatch directly
 * (see the --dry-run CLI mode) so triage-only callers never mutate a file.
 *
 * Exports: patchSelector(screenFile, failedSelector, newSelector, platform)
 *          → { patched, replacedCount, diff }  or throws on fs error
 */
function patchSelector(screenFilePath, failedSelector, newSelector, platform = 'ios') {
  if (!fs.existsSync(screenFilePath)) {
    throw new Error(`Screen file not found: ${screenFilePath}`);
  }

  const original = fs.readFileSync(screenFilePath, 'utf8');
  const { content: patched, replacedCount, reason } = computeSelectorPatch(
    original, failedSelector, newSelector, platform
  );

  if (replacedCount === 0) {
    return { patched: false, replacedCount: 0, reason: reason || 'no change' };
  }

  // Atomic write via temp file → rename
  const tmp = `${screenFilePath}.heal-tmp`;
  fs.writeFileSync(tmp, patched, 'utf8');
  fs.renameSync(tmp, screenFilePath);

  return {
    patched: true,
    replacedCount,
    diff: buildDiff(original, patched, screenFilePath),
    keyInfo: findKeyForSelector(original, failedSelector),
  };
}

/**
 * Build a minimal unified-diff-style summary (just the changed lines).
 * Not a real unified diff — just enough for the heal log.
 */
function buildDiff(before, after, filePath) {
  const beforeLines = before.split('\n');
  const afterLines  = after.split('\n');
  const changed = [];

  for (let i = 0; i < Math.max(beforeLines.length, afterLines.length); i++) {
    const b = beforeLines[i];
    const a = afterLines[i];
    if (b !== a) {
      changed.push({
        lineNumber: i + 1,
        before: (b || '').trim(),
        after:  (a || '').trim(),
      });
    }
  }

  return { file: path.basename(filePath), changes: changed };
}

/**
 * Pure compute core for addPlatformOverride — no fs access, never writes.
 * Converts a plain-string screen JS value into a platform ternary. Used when
 * a locator is correct on one platform but needs a platform-specific override
 * on the other — the POM pattern already used throughout .maestro/screens
 * (`key: __isIOS ? "a" : "b"`).
 *
 *   before: key: "Not now"
 *   after:  key: __isIOS ? "Not Now" : "Not now"
 */
function computePlatformOverride(original, oldValue, iosValue, androidValue) {
  const escapedOld = escapeForRegex(oldValue);

  // Already a ternary — nothing to convert (caller should have used
  // computeSelectorPatch instead). Refuse rather than guess which side to touch.
  const ternaryAlready = new RegExp(`__isIOS\\s*\\?\\s*"[^"]*"\\s*:\\s*"${escapedOld}"|__isIOS\\s*\\?\\s*"${escapedOld}"\\s*:\\s*"[^"]*"`);
  if (ternaryAlready.test(original)) {
    return { content: original, replacedCount: 0, reason: 'value is already part of a platform ternary' };
  }

  const plainPattern = new RegExp(`([a-zA-Z_$][\\w$]*\\s*:\\s*)"${escapedOld}"`);
  const match = original.match(plainPattern);
  if (!match) {
    return { content: original, replacedCount: 0, reason: 'selector value not found as a plain string in file' };
  }

  const replacement = `${match[1]}__isIOS ? "${iosValue}" : "${androidValue}"`;
  return { content: original.replace(plainPattern, replacement), replacedCount: 1 };
}

/**
 * Writes computePlatformOverride's result atomically. See patchSelector's
 * comment — previews must call computePlatformOverride directly instead.
 *
 * Exports: addPlatformOverride(screenFilePath, oldValue, iosValue, androidValue)
 *          → { patched, replacedCount, diff }  or throws on fs error
 */
function addPlatformOverride(screenFilePath, oldValue, iosValue, androidValue) {
  if (!fs.existsSync(screenFilePath)) {
    throw new Error(`Screen file not found: ${screenFilePath}`);
  }

  const original = fs.readFileSync(screenFilePath, 'utf8');
  const { content: patched, replacedCount, reason } = computePlatformOverride(
    original, oldValue, iosValue, androidValue
  );

  if (replacedCount === 0) {
    return { patched: false, replacedCount: 0, reason: reason || 'no change' };
  }

  const tmp = `${screenFilePath}.heal-tmp`;
  fs.writeFileSync(tmp, patched, 'utf8');
  fs.renameSync(tmp, screenFilePath);

  return {
    patched: true,
    replacedCount,
    diff: buildDiff(original, patched, screenFilePath),
    keyInfo: findKeyForSelector(original, oldValue),
  };
}

/**
 * Search all screen JS files for a given selector value.
 * Returns an array of { file, key, lineNumber } matches.
 */
function findScreenFilesContaining(screensDir, selectorValue) {
  const results = [];
  if (!fs.existsSync(screensDir)) return results;

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!entry.name.endsWith('.js')) continue;

      const content = fs.readFileSync(full, 'utf8');
      // Quick string check before expensive regex
      if (!content.includes(`"${selectorValue}"`)) continue;

      const keyInfo = findKeyForSelector(content, selectorValue);
      results.push({ file: full, content, key: keyInfo?.key, lineNumber: keyInfo?.lineNumber });
    }
  }

  walk(screensDir);
  return results;
}

module.exports = {
  patchSelector, addPlatformOverride,
  computeSelectorPatch, computePlatformOverride,
  findScreenFilesContaining, buildDiff,
};

// ─── CLI ────────────────────────────────────────────────────────────────────
// Exposes the patchers to non-Node callers (e.g. the Python maestro-repair-
// agent) as a stable subprocess interface, without changing anything
// heal-agent.js already does via require('./screen-patcher').
//
//   node screen-patcher.js --mode rename   --file <path> --old <v> --new <v> --platform ios|android [--dry-run]
//   node screen-patcher.js --mode override --file <path> --old <v> --ios <v> --android <v>            [--dry-run]
//
// --dry-run reads the file and computes the result WITHOUT writing anything —
// prints { content, replacedCount } (the full would-be new file content) so
// the caller can build its own diff. This is what a pure triage/preview
// caller (never allowed to mutate a file) must use; omit --dry-run only from
// the apply path, once a patch has already been verified.
//
// Prints one JSON line to stdout. Exit 0 on patched/would-patch, 1 on no
// change, 2 on error.
if (require.main === module) {
  const args = { dryRun: false };
  for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if (a === '--dry-run') { args.dryRun = true; continue; }
    if (a.startsWith('--')) args[a.slice(2)] = process.argv[++i];
  }

  try {
    let result;
    if (args.dryRun) {
      if (!args.file || !fs.existsSync(args.file)) {
        throw new Error(`--file not found: ${args.file}`);
      }
      const original = fs.readFileSync(args.file, 'utf8');
      if (args.mode === 'override') {
        if (args.old === undefined || args.ios === undefined || args.android === undefined) {
          throw new Error('override --dry-run requires --old --ios --android');
        }
        result = computePlatformOverride(original, args.old, args.ios, args.android);
      } else {
        if (args.old === undefined || args.new === undefined) {
          throw new Error('rename --dry-run requires --old --new [--platform]');
        }
        result = computeSelectorPatch(original, args.old, args.new, args.platform || 'ios');
      }
      process.stdout.write(JSON.stringify(result) + '\n');
      process.exit(result.replacedCount > 0 ? 0 : 1);
    }

    if (args.mode === 'override') {
      if (!args.file || args.old === undefined || args.ios === undefined || args.android === undefined) {
        throw new Error('override mode requires --file --old --ios --android');
      }
      result = addPlatformOverride(args.file, args.old, args.ios, args.android);
    } else {
      if (!args.file || args.old === undefined || args.new === undefined) {
        throw new Error('rename mode requires --file --old --new [--platform]');
      }
      result = patchSelector(args.file, args.old, args.new, args.platform || 'ios');
    }
    process.stdout.write(JSON.stringify(result) + '\n');
    process.exit(result.patched ? 0 : 1);
  } catch (e) {
    process.stdout.write(JSON.stringify({ patched: false, replacedCount: 0, error: e.message }) + '\n');
    process.exit(2);
  }
}
