#!/usr/bin/env node
/**
 * Performance report generator — real-data edition.
 *
 * Reads three data sources written during the test run:
 *   1. performance/perf-samples.json  — CPU/memory timeline (from performance-monitor.js)
 *   2. performance/perf-log-data.json — launch & screen timing (from perf-extract-from-log.js)
 *   3. network/api-calls.json         — API response times (from capture-network-logs.js)
 *
 * Feeds everything into PerformanceTester, then generates:
 *   performance/performance-report.json
 *   performance/performance-report.html
 *
 * Usage:
 *   node run-performance-tests.js <testName> <reportDir> <platform>
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const PerformanceTester = require('./performanceTester');

const testName  = process.argv[2] || 'test';
const reportDir = process.argv[3] || process.cwd();
const platform  = (process.argv[4] || 'ios').toLowerCase();

if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });

const perfDir = path.join(reportDir, 'performance');
fs.mkdirSync(perfDir, { recursive: true });

// ─── Load data sources (all optional — graceful if missing) ───────────────
function loadJSON(filePath) {
  try {
    if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_) {}
  return null;
}

const samplesData = loadJSON(path.join(perfDir, 'perf-samples.json'));
const logData     = loadJSON(path.join(perfDir, 'perf-log-data.json'));
const networkData = loadJSON(path.join(reportDir, 'network', 'api-calls.json'));

console.log(`\n⚡ Performance Analysis: ${testName}`);
console.log(`   Platform : ${platform}`);
console.log(`   CPU/mem  : ${samplesData ? `${samplesData.sampleCount} samples` : 'no data'}`);
console.log(`   Timing   : ${logData     ? `${logData.stats.screenCount} screens` : 'no data'}`);
console.log(`   Network  : ${networkData ? `${(networkData.calls || []).length} API calls` : 'no data'}`);
console.log('');

const tester = new PerformanceTester(reportDir);

// ─── 1. Launch time ────────────────────────────────────────────────────────
if (logData && logData.launchTimeMs != null) {
  tester.recordMetric(testName, 'appLaunchTime', logData.launchTimeMs, 'ms');
  tester.checkAppLaunchTime(testName, logData.launchTimeMs);
}

// ─── 2. Screen transition times (informational only — not scored) ─────────
// These are subflow durations (entire auth flows, OTP waits, etc.), not
// individual screen render times. Scoring them against a 3s threshold would
// always fail and make the score meaningless. They appear in the bar chart.
if (logData && Array.isArray(logData.screens)) {
  for (const screen of logData.screens) {
    tester.recordMetric(testName, 'screenLoadTime', screen.durationMs, 'ms');
    // Do NOT call checkScreenTransition — not a pass/fail check
  }
}

// ─── 3. CPU (average and peak from monitor) ───────────────────────────────
if (samplesData && samplesData.cpu) {
  const { avg, max } = samplesData.cpu;
  if (avg != null) tester.recordMetric(testName, 'cpuUsage', avg, '%');
  if (max != null) tester.checkCPUUsage(testName, max);
}

// ─── 4. Memory ────────────────────────────────────────────────────────────
if (samplesData && samplesData.memory) {
  const { avg, max } = samplesData.memory;
  if (avg != null) tester.recordMetric(testName, 'memoryUsage', avg, 'MB');
  if (max != null) tester.checkMemoryUsage(testName, max);
}

// ─── 5. FPS / jank (Android) ──────────────────────────────────────────────
if (samplesData && samplesData.fps) {
  const { avgJankRate, avgEstimatedFPS } = samplesData.fps;
  if (avgJankRate != null) {
    tester.recordMetric(testName, 'jankRate', avgJankRate, '% janky frames');
    tester.checkJankRate(testName, avgJankRate);
  }
  if (avgEstimatedFPS != null) {
    tester.recordMetric(testName, 'animationFrameRate', avgEstimatedFPS, 'fps');
    tester.checkAnimationFrameRate(testName, avgEstimatedFPS);
  }
}

// ─── 6. Battery drain (Android) ───────────────────────────────────────────
if (samplesData && samplesData.battery && samplesData.battery.drain != null) {
  const durationHours = (samplesData.durationMs || 0) / 3600000;
  if (durationHours > 0) {
    const drainPerHour = parseFloat((samplesData.battery.drain / durationHours).toFixed(2));
    tester.recordMetric(testName, 'batteryDrain', drainPerHour, '%/hour');
    tester.checkBatteryDrain(testName, drainPerHour);
  }
}

// ─── 7. API response times from network capture ───────────────────────────
if (networkData) {
  const calls = networkData.calls || networkData.apiCalls || [];
  for (const call of calls) {
    const responseTime = call.responseTime || call.duration || call.durationMs;
    if (responseTime != null) {
      const endpoint = call.endpoint || call.url || call.path || 'API';
      const shortName = endpoint.replace(/https?:\/\/[^/]+/, '').split('?')[0].slice(0, 60) || 'API';
      tester.recordMetric(testName, 'apiResponseTime', responseTime, 'ms');
      tester.checkAPIResponseTime(testName, shortName, responseTime);
    }
  }

  // Also use summary average if individual calls are missing
  if (calls.length === 0 && networkData.summary && networkData.summary.avgResponseTime) {
    const avg = networkData.summary.avgResponseTime;
    tester.recordMetric(testName, 'apiResponseTime', avg, 'ms');
    tester.checkAPIResponseTime(testName, 'API (avg)', avg);
  }
}

// ─── Generate report ──────────────────────────────────────────────────────
// If no checks were run (only screen timing was available, which is informational),
// note that the score is N/A rather than 0%
const noChecksRun = tester.getCheckCount() === 0;
const report = tester.generatePerformanceReport();

// Augment report with raw timeline + slow commands for HTML charts
report.meta = {
  platform,
  testName,
  noChecksRun,
  logData:     logData     || null,
  samplesData: samplesData || null,
  networkData: networkData || null,
};

// Save JSON
const jsonPath = path.join(perfDir, 'performance-report.json');
fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
console.log(`✅ JSON report: ${jsonPath}`);

// Generate and save HTML
const htmlPath = path.join(perfDir, 'performance-report.html');
fs.writeFileSync(htmlPath, generateHTML(report, testName, platform));
console.log(`✅ HTML report: ${htmlPath}`);

// Print text summary
if (noChecksRun) {
  console.log('\n=== PERFORMANCE SUMMARY ===');
  console.log('Score: N/A — no live metrics collected (run with --perf for CPU/memory/launch time)');
  console.log(`Timing data: ${logData ? logData.stats.screenCount + ' subflows extracted from debug log (informational)' : 'none'}`);
} else {
  console.log(tester.generatePerformanceSummary());
}

// Exit code
if (tester.hasCriticalIssues()) {
  console.log('⚠️  Critical performance issues detected!');
  process.exit(1);
}
process.exit(0);


// ═══════════════════════════════════════════════════════════════════════════
// HTML Report Generator
// ═══════════════════════════════════════════════════════════════════════════
function generateHTML(report, testName, platform) {
  const score      = report.summary.performanceScore;
  const scoreColor = score >= 90 ? '#10b981' : score >= 70 ? '#f59e0b' : '#ef4444';
  const ts         = new Date(report.timestamp).toLocaleString();

  const { logData, samplesData, networkData, noChecksRun } = report.meta || {};

  // ── Timeline data for CPU/memory chart ────────────────────────────────
  const timeline = (samplesData && samplesData.timeline) || [];
  const timeLabels  = timeline.map(s => `${(s.elapsedMs / 1000).toFixed(1)}s`);
  const cpuData     = timeline.map(s => s.cpu    != null ? s.cpu    : null);
  const memData     = timeline.map(s => s.memMB  != null ? s.memMB  : null);
  const jankData    = timeline.map(s => s.jankRate != null ? s.jankRate : null);
  const hasTimeline = timeline.length > 0;

  // ── Screen timing data ─────────────────────────────────────────────────
  const screens       = (logData && logData.screens) || [];
  const hasScreens    = screens.length > 0;

  // ── API response times ─────────────────────────────────────────────────
  const apiCalls      = (networkData && (networkData.calls || networkData.apiCalls)) || [];
  const hasAPICalls   = apiCalls.length > 0;

  // ── Slow commands ─────────────────────────────────────────────────────
  const slowCmds      = (logData && logData.slowCommands) || [];

  // ── Badge ─────────────────────────────────────────────────────────────
  const scoreDisplay = noChecksRun ? 'N/A' : `${score}%`;
  const badge = noChecksRun ? 'NO LIVE DATA' : score >= 90 ? 'EXCELLENT' : score >= 75 ? 'GOOD' : score >= 50 ? 'NEEDS WORK' : 'POOR';
  const platformIcon = platform === 'ios' ? '🍎' : '🤖';

  // ── Metrics table rows ─────────────────────────────────────────────────
  const metricRows = Object.entries(report.metrics)
    .filter(([, m]) => m.available)
    .map(([key, m]) => {
      const lowerBetter = key !== 'animationFrameRate';
      const pass = lowerBetter ? m.average <= m.threshold : m.average >= m.threshold;
      const statusIcon  = pass ? '✓' : '✗';
      const statusColor = pass ? '#10b981' : '#ef4444';
      const label = key
        .replace(/([A-Z])/g, ' $1').trim()
        .replace(/\b\w/g, c => c.toUpperCase());
      return `<tr>
        <td>${label}</td>
        <td class="num">${m.average.toFixed(1)} ${m.unit}</td>
        <td class="num">${m.threshold} ${m.unit}</td>
        <td class="num" style="color:${statusColor};font-weight:700">${statusIcon}</td>
      </tr>`;
    }).join('');

  // ── Issues ────────────────────────────────────────────────────────────
  const issueRows = (report.details && report.details.issues || []).map(iss => {
    const bg    = iss.severity === 'critical' ? '#fee2e2' : iss.severity === 'high' ? '#fef3c7' : '#f0fdf4';
    const border = iss.severity === 'critical' ? '#ef4444'  : iss.severity === 'high' ? '#f59e0b'  : '#10b981';
    return `<div style="background:${bg};border-left:4px solid ${border};padding:14px;margin-bottom:10px;border-radius:4px">
      <p style="margin:0 0 4px;font-weight:700">${iss.checkName}</p>
      <p style="margin:0 0 4px;color:#4b5563;font-size:13px">${iss.details}</p>
      <p style="margin:0;color:#6b7280;font-size:12px;font-style:italic">💡 ${iss.remediation}</p>
    </div>`;
  }).join('');

  // ── Screen timing bars ────────────────────────────────────────────────
  const maxScreenDur = screens.length ? Math.max(...screens.map(s => s.durationMs), 1) : 1;
  const screenBars   = screens.map(s => {
    const pct   = Math.min(100, (s.durationMs / maxScreenDur) * 100);
    const color = s.durationMs > 5000 ? '#ef4444' : s.durationMs > 3000 ? '#f59e0b' : '#10b981';
    return `<div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:13px">
        <span>${s.name}</span><span style="font-weight:600">${(s.durationMs/1000).toFixed(2)}s</span>
      </div>
      <div style="background:#e5e7eb;border-radius:4px;height:10px">
        <div style="width:${pct}%;background:${color};border-radius:4px;height:10px;transition:width 0.3s"></div>
      </div>
    </div>`;
  }).join('');

  // ── API call rows ──────────────────────────────────────────────────────
  const apiRows = apiCalls.slice(0, 20).map(call => {
    const rt  = call.responseTime || call.duration || call.durationMs || 0;
    const url = (call.endpoint || call.url || call.path || '').replace(/https?:\/\/[^/]+/, '').split('?')[0].slice(0, 60);
    const ok  = rt <= 2000;
    return `<tr>
      <td style="font-family:monospace;font-size:12px">${call.method || 'GET'}</td>
      <td style="font-family:monospace;font-size:12px">${url}</td>
      <td class="num">${rt}ms</td>
      <td class="num" style="color:${ok ? '#10b981' : '#ef4444'}">${call.status || '—'}</td>
    </tr>`;
  }).join('');

  // ── SVG mini-chart for CPU timeline ───────────────────────────────────
  function svgLine(data, color, maxVal, w = 600, h = 80) {
    const valid = data.map((v, i) => ({ v, i })).filter(p => p.v != null);
    if (valid.length < 2) return '';
    const pts = valid.map(p => {
      const x = (p.i / (data.length - 1)) * w;
      const y = h - (p.v / maxVal) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
    return `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>`;
  }

  const cpuMax    = Math.max(...cpuData.filter(v => v != null), 100);
  const memMax    = Math.max(...memData.filter(v => v != null), 500);
  const timelineSection = hasTimeline ? `
  <div class="card">
    <h3>CPU &amp; Memory Timeline</h3>
    <svg viewBox="0 0 600 90" style="width:100%;overflow:visible;background:#f9fafb;border-radius:6px;padding:5px">
      ${svgLine(cpuData, '#6366f1', cpuMax)}
      ${svgLine(memData.map(v => v != null ? (v / memMax) * cpuMax : null), '#10b981', cpuMax)}
      <line x1="0" y1="80" x2="600" y2="80" stroke="#e5e7eb" stroke-width="1"/>
    </svg>
    <div style="display:flex;gap:20px;margin-top:8px;font-size:12px;color:#6b7280">
      <span><span style="color:#6366f1">●</span> CPU% (max ${cpuMax.toFixed(1)}%)</span>
      <span><span style="color:#10b981">●</span> Memory MB (max ${memMax.toFixed(1)} MB)</span>
      ${samplesData && samplesData.cpu ? `<span>Avg CPU: ${samplesData.cpu.avg}% | Avg Mem: ${samplesData.memory && samplesData.memory.avg}MB</span>` : ''}
    </div>
    ${jankData.some(v => v != null) ? `
    <div style="margin-top:16px">
      <p style="font-size:13px;font-weight:600;margin-bottom:8px">Jank Rate %</p>
      <svg viewBox="0 0 600 50" style="width:100%;overflow:visible;background:#f9fafb;border-radius:6px;padding:5px">
        ${svgLine(jankData, '#f59e0b', Math.max(...jankData.filter(v=>v!=null), 20))}
      </svg>
    </div>` : ''}
  </div>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Performance Report — ${testName}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f3f4f6;color:#1f2937}
    .wrap{max-width:1100px;margin:0 auto;padding:32px 20px}
    .header{background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);color:#fff;padding:36px;border-radius:12px;margin-bottom:28px}
    .header h1{font-size:28px;margin-bottom:6px}
    .header p{font-size:14px;opacity:.85}
    .meta{display:flex;gap:12px;margin-top:14px;flex-wrap:wrap}
    .meta-chip{background:rgba(255,255,255,.2);border-radius:20px;padding:4px 12px;font-size:12px}
    .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:24px}
    .stat{background:#fff;padding:20px;border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,.08);text-align:center}
    .stat-val{font-size:32px;font-weight:800;margin-bottom:4px}
    .stat-lbl{font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:.5px}
    .card{background:#fff;padding:24px;border-radius:10px;box-shadow:0 1px 3px rgba(0,0,0,.08);margin-bottom:20px}
    .card h3{font-size:16px;font-weight:700;margin-bottom:16px;color:#1f2937}
    table{width:100%;border-collapse:collapse}
    th{background:#f9fafb;padding:10px 12px;text-align:left;font-size:12px;font-weight:600;text-transform:uppercase;color:#6b7280;border-bottom:2px solid #e5e7eb}
    td{padding:10px 12px;border-bottom:1px solid #f3f4f6;font-size:14px}
    td.num{text-align:right}
    .badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700}
    .badge-good{background:#d1fae5;color:#065f46}
    .badge-warn{background:#fef3c7;color:#92400e}
    .badge-bad {background:#fee2e2;color:#991b1b}
    tr:last-child td{border-bottom:none}
    .note{font-size:12px;color:#9ca3af;font-style:italic;margin-top:8px}
    @media(max-width:600px){.grid{grid-template-columns:1fr 1fr}}
  </style>
</head>
<body>
<div class="wrap">

  <!-- Header -->
  <div class="header">
    <h1>⚡ Performance Report</h1>
    <div class="meta">
      <span class="meta-chip">${platformIcon} ${platform.toUpperCase()}</span>
      <span class="meta-chip">📋 ${testName}</span>
      <span class="meta-chip">🕐 ${ts}</span>
      <span class="meta-chip ${noChecksRun ? '' : score >= 90 ? 'badge-good' : score >= 70 ? 'badge-warn' : 'badge-bad'}" style="background:rgba(255,255,255,.25)">${badge}${noChecksRun ? '' : ` — ${score}%`}</span>
    </div>
  </div>

  <!-- Score + key stats -->
  ${noChecksRun ? `<div class="card" style="background:#fffbeb;border:1px solid #fbbf24;margin-bottom:20px">
    <p style="font-size:14px;color:#92400e">
      <strong>ℹ️ No live metrics collected.</strong>
      Screen timings are shown below as reference but are not scored — they represent entire subflow durations (auth flows, OTP waits), not individual screen render times.
      Run with <code style="background:#fef3c7;padding:2px 6px;border-radius:4px">--perf</code> to collect real-time CPU, memory, and launch time metrics.
    </p>
  </div>` : ''}
  <div class="grid">
    <div class="stat">
      <div class="stat-val" style="color:${noChecksRun ? '#9ca3af' : scoreColor}">${scoreDisplay}</div>
      <div class="stat-lbl">Performance Score</div>
    </div>
    ${logData && logData.launchTimeMs != null ? `<div class="stat">
      <div class="stat-val" style="color:${logData.launchTimeMs > 5000 ? '#ef4444' : '#10b981'}">${(logData.launchTimeMs/1000).toFixed(2)}s</div>
      <div class="stat-lbl">App Launch Time</div>
    </div>` : ''}
    ${samplesData && samplesData.cpu && samplesData.cpu.avg != null ? `<div class="stat">
      <div class="stat-val" style="color:${samplesData.cpu.avg > 80 ? '#ef4444' : '#6366f1'}">${samplesData.cpu.avg}%</div>
      <div class="stat-lbl">Avg CPU</div>
    </div>` : ''}
    ${samplesData && samplesData.memory && samplesData.memory.avg != null ? `<div class="stat">
      <div class="stat-val" style="color:${samplesData.memory.avg > 500 ? '#ef4444' : '#10b981'}">${samplesData.memory.avg}</div>
      <div class="stat-lbl">Avg Memory (MB)</div>
    </div>` : ''}
    ${samplesData && samplesData.fps ? `<div class="stat">
      <div class="stat-val" style="color:${samplesData.fps.avgJankRate > 10 ? '#ef4444' : '#f59e0b'}">${(samplesData.fps.avgJankRate||0).toFixed(1)}%</div>
      <div class="stat-lbl">Avg Jank Rate</div>
    </div>` : ''}
    ${logData && logData.totalDurationMs ? `<div class="stat">
      <div class="stat-val" style="color:#6b7280">${(logData.totalDurationMs/1000).toFixed(1)}s</div>
      <div class="stat-lbl">Test Duration</div>
    </div>` : ''}
  </div>

  <!-- Metrics table -->
  <div class="card">
    <h3>Metric Thresholds</h3>
    <table>
      <thead><tr><th>Metric</th><th class="num">Measured</th><th class="num">Threshold</th><th class="num">Status</th></tr></thead>
      <tbody>${metricRows || '<tr><td colspan="4" style="text-align:center;color:#9ca3af">No metrics collected</td></tr>'}</tbody>
    </table>
  </div>

  <!-- Timeline chart -->
  ${timelineSection}

  <!-- Screen timings -->
  ${hasScreens ? `<div class="card">
    <h3>Screen Transition Times</h3>
    ${screenBars}
    <p class="note">Green &lt;3s | Amber 3–5s | Red &gt;5s. Threshold: ${tester.thresholds ? tester.thresholds.screenLoadTime : 3000}ms</p>
  </div>` : ''}

  <!-- API calls -->
  ${hasAPICalls ? `<div class="card">
    <h3>API Response Times</h3>
    <table>
      <thead><tr><th>Method</th><th>Endpoint</th><th class="num">Time</th><th class="num">Status</th></tr></thead>
      <tbody>${apiRows}</tbody>
    </table>
    ${apiCalls.length > 20 ? `<p class="note">Showing first 20 of ${apiCalls.length} calls</p>` : ''}
  </div>` : ''}

  <!-- Slow commands -->
  ${slowCmds.length > 0 ? `<div class="card">
    <h3>Slow Commands (&gt;2s)</h3>
    <table>
      <thead><tr><th>Command</th><th class="num">Duration</th></tr></thead>
      <tbody>
        ${slowCmds.map(c => `<tr>
          <td style="font-family:monospace;font-size:12px">${c.command.slice(0, 80)}</td>
          <td class="num" style="color:${c.durationMs > 5000 ? '#ef4444' : '#f59e0b'}">${(c.durationMs/1000).toFixed(2)}s</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>` : ''}

  <!-- Issues -->
  ${issueRows ? `<div class="card"><h3>Issues (${report.details.issues.length})</h3>${issueRows}</div>` : `
  <div class="card" style="text-align:center;padding:40px">
    <p style="font-size:32px;margin-bottom:8px">✅</p>
    <p style="font-weight:700;color:#065f46">All performance checks passed</p>
  </div>`}

  <!-- Data sources -->
  <div class="card" style="background:#f9fafb">
    <h3>Data Sources</h3>
    <table>
      <thead><tr><th>Source</th><th>File</th><th>Status</th></tr></thead>
      <tbody>
        <tr><td>CPU / Memory (live monitor)</td><td style="font-family:monospace;font-size:12px">performance/perf-samples.json</td><td>${samplesData ? '✅ ' + samplesData.sampleCount + ' samples' : '⚠️ Not collected'}</td></tr>
        <tr><td>Launch &amp; screen timing</td><td style="font-family:monospace;font-size:12px">performance/perf-log-data.json</td><td>${logData ? '✅ ' + (logData.stats && logData.stats.screenCount) + ' screens' : '⚠️ Not collected'}</td></tr>
        <tr><td>API response times</td><td style="font-family:monospace;font-size:12px">network/api-calls.json</td><td>${networkData ? '✅ ' + ((networkData.calls || networkData.apiCalls || []).length) + ' calls' : '⚠️ Run with --network-capture'}</td></tr>
        ${platform === 'ios' ? '<tr><td>FPS (physical device)</td><td style="font-family:monospace;font-size:12px">xctrace — Core Animation</td><td>ℹ️ Only on physical device; not available on simulator</td></tr>' : ''}
      </tbody>
    </table>
  </div>

</div>
</body>
</html>`;
}
