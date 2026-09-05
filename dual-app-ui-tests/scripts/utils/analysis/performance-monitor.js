#!/usr/bin/env node
/**
 * Real-device performance monitor for Maestro E2E tests.
 *
 * iOS (simulator):
 *   - PID    : xcrun simctl spawn <udid> launchctl list | grep <appId>
 *   - CPU %  : host `ps -p <pid> -o pcpu=`  (simulator = macOS process)
 *   - Memory : host `ps -p <pid> -o rss=`   (KB → MB)
 *   - FPS    : skipped on simulator (not meaningful; use physical device + Instruments)
 *
 * Android:
 *   - PID    : adb shell pidof <appId>
 *   - CPU %  : adb shell top -bn1 -p <pid>
 *   - Memory : adb shell dumpsys meminfo <appId>  → Total PSS
 *   - Battery: adb shell dumpsys battery           → level
 *   - FPS    : adb shell dumpsys gfxinfo <appId>  → Janky frames %
 *
 * Writes samples to <outputDir>/perf-samples.json on SIGTERM/exit.
 * Also writes a running perf-samples.jsonl (one JSON object per line)
 * so data is never lost if killed ungracefully.
 *
 * Usage (background process):
 *   node performance-monitor.js <platform> <deviceId> <appId> <outputDir> [intervalMs]
 */

const { execSync } = require('child_process');
const fs           = require('fs');
const path         = require('path');

const platform    = (process.argv[2] || 'ios').toLowerCase();
const deviceId    = process.argv[3] || '';
const appId       = process.argv[4] || '';
const outputDir   = process.argv[5] || '.';
const intervalMs  = parseInt(process.argv[6] || '2000', 10);

if (!deviceId || !appId) {
  process.stderr.write('Usage: performance-monitor.js <platform> <deviceId> <appId> <outputDir> [intervalMs]\n');
  process.exit(1);
}

fs.mkdirSync(outputDir, { recursive: true });
const samplesFile = path.join(outputDir, 'perf-samples.jsonl');
const startTime   = Date.now();
let   appPid      = null;
let   sampleCount = 0;
let   lastFpsPoll = 0;
let   fpsBaseline = null; // Android: last gfxinfo total frames snapshot

// ─── Helper: run a command and return stdout, or null on error ─────────────
function run(cmd, timeoutMs = 4000) {
  try {
    return execSync(cmd, { encoding: 'utf8', timeout: timeoutMs, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch (_) {
    return null;
  }
}

// ─── iOS: resolve PID via launchctl list inside simulator ─────────────────
function getIOSPid() {
  const out = run(`xcrun simctl spawn "${deviceId}" launchctl list 2>/dev/null | grep "${appId}"`);
  if (!out) return null;
  // Output: "<pid>\t<status>\tUIKitApplication:com.example.app[...]"
  const pid = parseInt(out.split('\t')[0], 10);
  return isNaN(pid) || pid <= 0 ? null : pid;
}

// ─── iOS: CPU % and RSS from macOS host ps (simulator = macOS process) ─────
function getIOSMetrics(pid) {
  const out = run(`ps -p ${pid} -o pcpu=,rss= 2>/dev/null`);
  if (!out) return null;
  const parts = out.trim().split(/\s+/);
  const cpu   = parseFloat(parts[0]);
  const rssKB = parseInt(parts[1], 10);
  if (isNaN(cpu) || isNaN(rssKB)) return null;
  return { cpu, memMB: parseFloat((rssKB / 1024).toFixed(1)) };
}

// ─── Android: resolve PID ──────────────────────────────────────────────────
function getAndroidPid() {
  const adb = process.env.ADB_PATH || 'adb';
  const out = run(`${adb} -s "${deviceId}" shell pidof "${appId}" 2>/dev/null`);
  if (!out) return null;
  const pid = parseInt(out.split(/\s+/)[0], 10);
  return isNaN(pid) || pid <= 0 ? null : pid;
}

// ─── Android: CPU from top ─────────────────────────────────────────────────
function getAndroidCPU(pid) {
  const adb = process.env.ADB_PATH || 'adb';
  const out = run(`${adb} -s "${deviceId}" shell top -bn1 -p ${pid} 2>/dev/null`);
  if (!out) return null;
  // top output line: PID USER PR NI VIRT RES SHR S %CPU %MEM TIME COMMAND
  const lines = out.split('\n').filter(l => l.trim().startsWith(String(pid)));
  if (lines.length === 0) return null;
  const parts = lines[0].trim().split(/\s+/);
  const cpu = parseFloat(parts[8]);
  return isNaN(cpu) ? null : cpu;
}

// ─── Android: memory via dumpsys meminfo ──────────────────────────────────
function getAndroidMemMB() {
  const adb = process.env.ADB_PATH || 'adb';
  const out = run(`${adb} -s "${deviceId}" shell dumpsys meminfo "${appId}" 2>/dev/null`);
  if (!out) return null;
  // "TOTAL PSS:   XXXXX" (KB) or "TOTAL:   XXXXX   XXXXX" older format
  const m = out.match(/TOTAL\s+PSS:\s+(\d+)/i) || out.match(/TOTAL\s+(\d+)/);
  if (!m) return null;
  return parseFloat((parseInt(m[1], 10) / 1024).toFixed(1));
}

// ─── Android: battery level ────────────────────────────────────────────────
function getAndroidBattery() {
  const adb = process.env.ADB_PATH || 'adb';
  const out = run(`${adb} -s "${deviceId}" shell dumpsys battery 2>/dev/null | grep "level:"`);
  if (!out) return null;
  const m = out.match(/level:\s*(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

// ─── Android: FPS / jank via gfxinfo ──────────────────────────────────────
// Returns { totalFrames, jankyFrames, jankRate%, jankyMs50, jankyMs90, jankyMs99 }
function getAndroidFPS() {
  const adb = process.env.ADB_PATH || 'adb';
  const out = run(`${adb} -s "${deviceId}" shell dumpsys gfxinfo "${appId}" 2>/dev/null`, 6000);
  if (!out) return null;

  const totalM  = out.match(/Total frames rendered:\s*(\d+)/);
  const jankyM  = out.match(/Janky frames:\s*(\d+)\s*\(([0-9.]+)%\)/);
  const p50M    = out.match(/50th percentile:\s*([0-9.]+)ms/);
  const p90M    = out.match(/90th percentile:\s*([0-9.]+)ms/);
  const p99M    = out.match(/99th percentile:\s*([0-9.]+)ms/);

  if (!totalM) return null;

  const totalFrames = parseInt(totalM[1], 10);
  const jankyFrames = jankyM ? parseInt(jankyM[1], 10) : 0;
  const jankRate    = jankyM ? parseFloat(jankyM[2]) : 0;

  // Delta from last snapshot gives frames-since-last-poll (avoids cumulative inflation)
  let deltaTotal = totalFrames;
  let deltaJanky = jankyFrames;
  if (fpsBaseline) {
    deltaTotal = Math.max(0, totalFrames - fpsBaseline.totalFrames);
    deltaJanky = Math.max(0, jankyFrames - fpsBaseline.jankyFrames);
  }
  fpsBaseline = { totalFrames, jankyFrames };

  return {
    totalFrames: deltaTotal,
    jankyFrames: deltaJanky,
    jankRatePct: deltaTotal > 0 ? parseFloat(((deltaJanky / deltaTotal) * 100).toFixed(1)) : 0,
    p50ms:  p50M  ? parseFloat(p50M[1])  : null,
    p90ms:  p90M  ? parseFloat(p90M[1])  : null,
    p99ms:  p99M  ? parseFloat(p99M[1])  : null,
    // Implied FPS: 60 fps target, jank = frames > 16.7ms render time
    estimatedFPS: deltaTotal > 0 ? Math.max(0, Math.round(60 * (1 - deltaJanky / deltaTotal))) : null,
  };
}

// ─── Write one sample to the JSONL file ───────────────────────────────────
function writeSample(sample) {
  fs.appendFileSync(samplesFile, JSON.stringify(sample) + '\n');
}

// ─── Take one sample ──────────────────────────────────────────────────────
function takeSample() {
  const now     = Date.now();
  const elapsed = now - startTime;

  // Lazily resolve PID
  if (!appPid) {
    appPid = platform === 'ios' ? getIOSPid() : getAndroidPid();
    if (!appPid) return; // app not running yet
  }

  const sample = {
    ts: now,
    elapsedMs: elapsed,
    cpu: null,
    memMB: null,
    battery: null,
    fps: null,
  };

  if (platform === 'ios') {
    const m = getIOSMetrics(appPid);
    if (m) { sample.cpu = m.cpu; sample.memMB = m.memMB; }
    else    { appPid = null; } // process may have respawned
  } else {
    // Refresh PID every 10th sample (it can change after activity restart)
    if (sampleCount % 10 === 0) appPid = getAndroidPid();
    if (appPid) {
      const cpu = getAndroidCPU(appPid);
      if (cpu !== null) sample.cpu = cpu;
      const mem = getAndroidMemMB();
      if (mem !== null) sample.memMB = mem;
    }
    // Battery every 30 s
    const battery = getAndroidBattery();
    if (battery !== null) sample.battery = battery;
    // FPS every 5 s (gfxinfo is slow)
    if (now - lastFpsPoll >= 5000) {
      sample.fps = getAndroidFPS();
      lastFpsPoll = now;
    }
  }

  sampleCount++;
  writeSample(sample);
}

// ─── Generate summary from JSONL samples ──────────────────────────────────
function buildReport() {
  let rawLines = [];
  try { rawLines = fs.readFileSync(samplesFile, 'utf8').trim().split('\n').filter(Boolean); } catch (_) {}

  const samples = rawLines.map(l => { try { return JSON.parse(l); } catch (_) { return null; } }).filter(Boolean);

  const cpuSamples = samples.map(s => s.cpu).filter(v => v !== null && !isNaN(v));
  const memSamples = samples.map(s => s.memMB).filter(v => v !== null && !isNaN(v));
  const fpsSamples = samples.flatMap(s => s.fps ? [s.fps] : []);

  const avg = arr => arr.length ? parseFloat((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)) : null;
  const max = arr => arr.length ? parseFloat(Math.max(...arr).toFixed(1)) : null;
  const min = arr => arr.length ? parseFloat(Math.min(...arr).toFixed(1)) : null;

  const report = {
    timestamp:   new Date().toISOString(),
    platform,
    deviceId,
    appId,
    durationMs:  Date.now() - startTime,
    sampleCount: samples.length,
    cpu: {
      avg:  avg(cpuSamples),
      max:  max(cpuSamples),
      min:  min(cpuSamples),
      unit: '%',
    },
    memory: {
      avg:  avg(memSamples),
      max:  max(memSamples),
      min:  min(memSamples),
      unit: 'MB',
    },
    fps: fpsSamples.length ? {
      avgJankRate:     avg(fpsSamples.map(f => f.jankRatePct)),
      maxJankRate:     max(fpsSamples.map(f => f.jankRatePct)),
      avgEstimatedFPS: avg(fpsSamples.map(f => f.estimatedFPS).filter(v => v !== null)),
      p50ms:           avg(fpsSamples.map(f => f.p50ms).filter(v => v !== null)),
      p90ms:           avg(fpsSamples.map(f => f.p90ms).filter(v => v !== null)),
      p99ms:           avg(fpsSamples.map(f => f.p99ms).filter(v => v !== null)),
    } : null,
    battery: (() => {
      const battSamples = samples.map(s => s.battery).filter(v => v !== null);
      if (battSamples.length < 2) return null;
      return { start: battSamples[0], end: battSamples[battSamples.length - 1], drain: battSamples[0] - battSamples[battSamples.length - 1] };
    })(),
    timeline: samples.map(s => ({ elapsedMs: s.elapsedMs, cpu: s.cpu, memMB: s.memMB, jankRate: s.fps ? s.fps.jankRatePct : null })),
  };

  return report;
}

// ─── Shutdown handler ─────────────────────────────────────────────────────
function shutdown() {
  if (timer) clearInterval(timer);
  const report = buildReport();
  const outPath = path.join(outputDir, 'perf-samples.json');
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  process.stdout.write(`\n✅ Performance monitor stopped (${sampleCount} samples → ${outPath})\n`);
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT',  shutdown);

// ─── Main loop ────────────────────────────────────────────────────────────
process.stdout.write(`📊 Performance monitor started (${platform}, ${deviceId}, interval=${intervalMs}ms)\n`);
takeSample(); // immediate first sample
const timer = setInterval(takeSample, intervalMs);
