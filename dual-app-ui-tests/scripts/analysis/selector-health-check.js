#!/usr/bin/env node
/**
 * Selector Health Check
 * Loads every .maestro/screens/**\/*.js file and extracts all output.* selectors.
 * Reports a flat inventory so you can grep for stale/duplicate element names.
 *
 * Usage: node scripts/analysis/selector-health-check.js [--json] [--find <text>]
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '../..');
const SCREENS_DIR = path.join(ROOT, '.maestro/screens');

function walkDir(dir) {
  if (!fs.existsSync(dir)) return [];
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walkDir(full));
    else if (entry.name.endsWith('.js')) results.push(full);
  }
  return results;
}

function extractSelectors(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const rel = path.relative(ROOT, filePath);
  const selectors = [];

  try {
    // Create a sandbox with a mock `output` and `maestro` object
    const outputProxy = {};
    const sandbox = {
      output: new Proxy(outputProxy, {
        set(obj, key, val) { obj[key] = val; return true; }
      }),
      maestro: { platform: 'ios', timeoutMs: 10000 },
      console: { log: () => {}, error: () => {} },
    };
    vm.createContext(sandbox);
    vm.runInContext(content, sandbox, { timeout: 3000, filename: filePath });

    // Flatten output.* namespaces
    for (const [ns, obj] of Object.entries(outputProxy)) {
      if (typeof obj === 'object' && obj !== null) {
        for (const [key, val] of Object.entries(obj)) {
          selectors.push({
            namespace: ns,
            key,
            value: String(val),
            file: rel,
          });
        }
      }
    }
  } catch (err) {
    return { file: rel, error: err.message, selectors: [] };
  }

  return { file: rel, selectors, error: null };
}

function main() {
  const jsonOutput = process.argv.includes('--json');
  const exitOnError = process.argv.includes('--exit-on-error');
  const findIdx = process.argv.indexOf('--find');
  const findQuery = findIdx >= 0 ? process.argv[findIdx + 1] : null;

  const files = walkDir(SCREENS_DIR);
  const results = files.map(extractSelectors);

  const allSelectors = results.flatMap(r => r.selectors || []);
  const errors = results.filter(r => r.error);

  if (findQuery) {
    const matches = allSelectors.filter(s =>
      s.key.toLowerCase().includes(findQuery.toLowerCase()) ||
      s.value.toLowerCase().includes(findQuery.toLowerCase())
    );
    if (jsonOutput) { console.log(JSON.stringify(matches, null, 2)); return; }
    console.log(`\nSelectors matching "${findQuery}":\n`);
    matches.forEach(s => console.log(`  ${s.namespace}.${s.key} = "${s.value}" (${s.file})`));
    return;
  }

  if (jsonOutput) {
    console.log(JSON.stringify({ total: allSelectors.length, files: results.length, errors: errors.length, selectors: allSelectors }, null, 2));
    if (exitOnError && errors.length > 0) process.exit(1);
    return;
  }

  console.log('\nSelector Inventory\n' + '='.repeat(50));
  console.log(`Screen files: ${results.length}`);
  console.log(`Total selectors: ${allSelectors.length}`);
  if (errors.length > 0) {
    console.log(`\n[!] Parse errors (${errors.length}):`);
    errors.forEach(e => console.log(`  ${e.file}: ${e.error}`));
    if (exitOnError) {
      console.error(`\nFailed: ${errors.length} screen JS file(s) have parse errors. Fix them before running tests.`);
      process.exit(1);
    }
  }

  console.log('\nSelectors by namespace:');
  const byNs = {};
  allSelectors.forEach(s => { byNs[s.namespace] = (byNs[s.namespace] || 0) + 1; });
  Object.entries(byNs).sort(([,a],[,b]) => b - a).forEach(([ns, count]) => {
    console.log(`  ${ns}: ${count} selectors`);
  });

  console.log('\nUsage:');
  console.log('  node scripts/analysis/selector-health-check.js --find "password"');
  console.log('  node scripts/analysis/selector-health-check.js --json > selectors.json');
  console.log('  node scripts/analysis/selector-health-check.js --exit-on-error  (fails with code 1 if any parse errors)');
}

main();
