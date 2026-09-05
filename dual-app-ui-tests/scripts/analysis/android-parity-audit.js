#!/usr/bin/env node
/**
 * Android Parity Audit
 * Flags .maestro/flows and .maestro/subflows that use iOS-specific selectors
 * or lack Android platform guards, so you know which tests need Android variants.
 *
 * Usage: node scripts/analysis/android-parity-audit.js [--json]
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const FLOWS_DIR = path.join(ROOT, '.maestro/flows');
const SUBFLOWS_DIR = path.join(ROOT, '.maestro/subflows');

// Patterns that indicate iOS-specific code without a corresponding Android guard
const IOS_ONLY_PATTERNS = [
  { pattern: /platform:\s*iOS/i, label: 'iOS platform guard (no Android equivalent check)' },
  { pattern: /xctest/i, label: 'XCTest reference' },
  { pattern: /simctl/i, label: 'simctl reference' },
  { pattern: /\bios\b.*only/i, label: 'iOS-only comment' },
];

// Patterns that suggest proper multi-platform handling
const ANDROID_AWARE_PATTERNS = [
  /platform:\s*android/i,
  /\$\{maestro\.platform/i,
  /android/i,
];

function walkDir(dir, ext = '.yaml') {
  if (!fs.existsSync(dir)) return [];
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walkDir(full, ext));
    else if (entry.name.endsWith(ext)) results.push(full);
  }
  return results;
}

function auditFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const rel = path.relative(ROOT, filePath);
  const issues = [];

  for (const { pattern, label } of IOS_ONLY_PATTERNS) {
    if (pattern.test(content)) {
      issues.push(label);
    }
  }

  const hasAndroidAwareness = ANDROID_AWARE_PATTERNS.some(p => p.test(content));

  return { file: rel, issues, hasAndroidAwareness, lineCount: content.split('\n').length };
}

function main() {
  const jsonOutput = process.argv.includes('--json');
  const allFiles = [...walkDir(FLOWS_DIR), ...walkDir(SUBFLOWS_DIR)];

  const results = allFiles.map(auditFile);
  const flagged = results.filter(r => r.issues.length > 0);
  const iosOnly = results.filter(r => !r.hasAndroidAwareness);

  if (jsonOutput) {
    console.log(JSON.stringify({ flagged, iosOnlyCount: iosOnly.length, total: results.length }, null, 2));
    return;
  }

  console.log('\nAndroid Parity Audit\n' + '='.repeat(50));
  console.log(`Scanned: ${results.length} files`);
  console.log(`iOS-specific issues: ${flagged.length} files`);
  console.log(`No Android awareness: ${iosOnly.length} files\n`);

  if (flagged.length > 0) {
    console.log('Files with iOS-specific patterns:');
    for (const r of flagged) {
      console.log(`  [X] ${r.file}`);
      r.issues.forEach(i => console.log(`     * ${i}`));
    }
  }

  console.log('\nFiles with no Android platform awareness (top 20):');
  iosOnly.slice(0, 20).forEach(r => console.log(`  [!] ${r.file}`));
  if (iosOnly.length > 20) console.log(`  ... and ${iosOnly.length - 20} more`);

  console.log('\nRun with --json for machine-readable output.');
}

main();
