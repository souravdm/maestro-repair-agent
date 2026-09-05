#!/usr/bin/env node
/**
 * Test Coverage Map
 * Parses all .maestro/flows/**\/*.yaml files and generates an HTML coverage report
 * showing which features/domains have tests and which are missing.
 *
 * Usage: node scripts/analysis/test-coverage-map.js [--output <path>]
 * Output defaults to: test-reports/coverage-map.html
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const FLOWS_DIR = path.join(ROOT, '.maestro/flows');
const SUBFLOWS_DIR = path.join(ROOT, '.maestro/subflows');
const SCREENS_DIR = path.join(ROOT, '.maestro/screens');
const OUTPUT_IDX = process.argv.indexOf('--output');
const OUTPUT = OUTPUT_IDX >= 0 ? process.argv[OUTPUT_IDX + 1] : path.join(ROOT, 'test-reports/coverage-map.html');

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

function parseFlow(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const rel = path.relative(ROOT, filePath);
  const domain = rel.split('/')[2] || 'Unknown'; // .maestro/flows/DOMAIN/...

  const tags = [];
  const tagsMatch = content.match(/^tags:\s*\n((?:\s+-\s+\S+\n?)+)/m);
  if (tagsMatch) {
    const tagLines = tagsMatch[1].match(/^\s+-\s+(\S+)/mg) || [];
    tags.push(...tagLines.map(l => l.replace(/^\s+-\s+/, '')));
  }

  const runFlows = (content.match(/runFlow:\s+(\S+\.yaml)/g) || [])
    .map(m => m.replace('runFlow: ', '').trim());
  const runScripts = (content.match(/runScript:\s+(\S+\.js)/g) || [])
    .map(m => m.replace('runScript: ', '').trim());
  const appId = /appId:\s*\$\{APP_ID\}/.test(content);

  return {
    file: rel,
    name: path.basename(filePath, '.yaml'),
    domain,
    tags,
    runFlows,
    runScripts,
    usesAppIdVar: appId,
    lineCount: content.split('\n').length,
  };
}

function buildHtml(flows, subflows, screens) {
  const domains = [...new Set(flows.map(f => f.domain))].sort();
  const tagCounts = {};
  flows.forEach(f => f.tags.forEach(t => { tagCounts[t] = (tagCounts[t] || 0) + 1; }));
  const topTags = Object.entries(tagCounts).sort(([,a],[,b]) => b - a).slice(0, 20);

  const domainRows = domains.map(domain => {
    const domainFlows = flows.filter(f => f.domain === domain);
    const badAppId = domainFlows.filter(f => !f.usesAppIdVar);
    return `
      <tr>
        <td><strong>${domain}</strong></td>
        <td>${domainFlows.length}</td>
        <td>${domainFlows.filter(f => f.tags.includes('smoke')).length}</td>
        <td>${domainFlows.filter(f => f.tags.includes('regression') || f.tags.includes('full')).length}</td>
        <td class="${badAppId.length > 0 ? 'warn' : 'ok'}">${badAppId.length > 0 ? '[!] ' + badAppId.length + ' hardcoded' : '[ok] all clean'}</td>
        <td>${domainFlows.map(f => `<span class="flow-chip">${f.name}</span>`).join('')}</td>
      </tr>`;
  }).join('');

  const tagRows = topTags.map(([tag, count]) =>
    `<tr><td><span class="tag-chip">${tag}</span></td><td>${count}</td></tr>`
  ).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Test Coverage Map</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; background: #f8f9fb; color: #1e293b; }
  .header { background: #cc0000; color: white; padding: 24px 32px; }
  .header h1 { margin: 0; font-size: 22px; }
  .header p { margin: 4px 0 0; opacity: 0.85; font-size: 13px; }
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 16px; padding: 24px 32px; }
  .stat-card { background: white; border-radius: 10px; padding: 16px; border: 1px solid #edf0f4; border-left: 4px solid #cc0000; text-align: center; }
  .stat-num { font-size: 28px; font-weight: 700; color: #cc0000; }
  .stat-label { font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.8px; margin-top: 4px; }
  .section { background: white; margin: 0 32px 24px; border-radius: 10px; border: 1px solid #edf0f4; overflow: hidden; }
  .section-title { padding: 16px 20px; background: #f1f5f9; border-bottom: 1px solid #edf0f4; font-weight: 600; font-size: 14px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { padding: 10px 16px; text-align: left; background: #f8fafc; color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #edf0f4; }
  td { padding: 10px 16px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  tr:last-child td { border-bottom: none; }
  .ok { color: #22c55e; }
  .warn { color: #f59e0b; }
  .flow-chip { display: inline-block; font-size: 10px; background: #e0f2fe; color: #0369a1; border-radius: 4px; padding: 2px 6px; margin: 2px; }
  .tag-chip { display: inline-block; font-size: 11px; background: #f3e8ff; color: #6b21a8; border-radius: 4px; padding: 3px 8px; }
  .generated { text-align: center; padding: 20px; font-size: 11px; color: #94a3b8; }
</style>
</head>
<body>
<div class="header">
  <h1>Test Coverage Map</h1>
  <p>Generated ${new Date().toLocaleString()} &middot; ${flows.length} flows &middot; ${subflows.length} subflows &middot; ${screens.length} screens</p>
</div>
<div class="stats">
  <div class="stat-card"><div class="stat-num">${flows.length}</div><div class="stat-label">Total Flows</div></div>
  <div class="stat-card"><div class="stat-num">${domains.length}</div><div class="stat-label">Domains</div></div>
  <div class="stat-card"><div class="stat-num">${flows.filter(f => f.tags.includes('smoke')).length}</div><div class="stat-label">Smoke Tests</div></div>
  <div class="stat-card"><div class="stat-num">${subflows.length}</div><div class="stat-label">Subflows</div></div>
  <div class="stat-card"><div class="stat-num">${screens.length}</div><div class="stat-label">Screen Objects</div></div>
  <div class="stat-card"><div class="stat-num">${flows.filter(f => !f.usesAppIdVar).length}</div><div class="stat-label">Hardcoded App IDs</div></div>
</div>
<div class="section">
  <div class="section-title">Coverage by Domain</div>
  <table>
    <thead><tr><th>Domain</th><th>Flows</th><th>Smoke</th><th>Regression</th><th>App ID</th><th>Flow Names</th></tr></thead>
    <tbody>${domainRows}</tbody>
  </table>
</div>
<div class="section">
  <div class="section-title">Top Tags</div>
  <table>
    <thead><tr><th>Tag</th><th>Flow Count</th></tr></thead>
    <tbody>${tagRows}</tbody>
  </table>
</div>
<div class="generated">Generated by scripts/analysis/test-coverage-map.js</div>
</body>
</html>`;
}

function main() {
  const flows = walkDir(FLOWS_DIR).map(parseFlow);
  const subflows = walkDir(SUBFLOWS_DIR);
  const screens = walkDir(SCREENS_DIR, '.js');

  const html = buildHtml(flows, subflows, screens);
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, html);
  console.log(`Coverage map written to: ${OUTPUT}`);
  console.log(`   Flows: ${flows.length} | Subflows: ${subflows.length} | Screens: ${screens.length}`);
  console.log(`   Domains: ${[...new Set(flows.map(f => f.domain))].sort().join(', ')}`);

  if (process.platform === 'darwin') {
    require('child_process').execSync(`open "${OUTPUT}"`, { stdio: 'ignore' });
  }
}

main();
