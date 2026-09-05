'use strict';

const express = require('express');
const path = require('path');
const fs = require('fs');
const vm = require('vm');
const { spawn, exec, execSync } = require('child_process');
const { randomUUID } = require('crypto');
const os = require('os');
const MaestroYAMLValidator = require('../../scripts/utils/validation/validate-yaml');

const app = express();
const PORT = process.env.PORT || 3003;
const PROJECT_ROOT = path.resolve(__dirname, '../..');
const IS_ELECTRON = process.env.ELECTRON_DEV === 'true';

// ─── Load .env from project root (dev convenience) ────────────────────────────
// Populates process.env from a gitignored `.env` file at the repo root. Only
// sets vars that aren't already defined in the environment, so shell exports
// still win. Silently skipped if the file doesn't exist.
(function loadDotEnv() {
  try {
    const envPath = path.join(PROJECT_ROOT, '.env');
    if (!fs.existsSync(envPath)) return;
    const contents = fs.readFileSync(envPath, 'utf8');
    for (const rawLine of contents.split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const match = line.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/i);
      if (!match) continue;
      const [, key, rawVal] = match;
      if (process.env[key] !== undefined) continue; // shell wins
      process.env[key] = rawVal.replace(/^["']|["']$/g, '');
    }
    console.log(`[env] Loaded .env from ${envPath}`);
  } catch (e) {
    console.warn(`[env] Failed to load .env: ${e.message}`);
  }
})();

app.use(express.json());
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});
app.use(express.static(__dirname));
app.use('/test-reports', express.static(path.join(PROJECT_ROOT, 'test-reports')));
app.use('/artifacts',    express.static(path.join(PROJECT_ROOT, 'artifacts')));

// ─── Active Jobs ──────────────────────────────────────────────────────────────

const jobs = new Map(); // jobId -> { proc, clients, output, status }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function walkDir(dir, ext) {
  const results = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        results.push(...walkDir(full, ext));
      } else if (entry.isFile() && (!ext || entry.name.endsWith(ext))) {
        results.push(full);
      }
    }
  } catch (_) {}
  return results;
}

// ─── API: List flows ──────────────────────────────────────────────────────────

app.get('/api/flows', (_req, res) => {
  const flowsDir = path.join(PROJECT_ROOT, '.maestro', 'flows');
  const files = walkDir(flowsDir, '.yaml')
    .filter(f => !f.includes('/suites/'))
    .map(f => path.relative(PROJECT_ROOT, f));
  res.json(files.sort());
});

app.get('/api/flow-folders', (_req, res) => {
  const flowsDir = path.join(PROJECT_ROOT, '.maestro', 'flows');
  try {
    const folders = fs.readdirSync(flowsDir, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => e.name)
      .sort();
    res.json(folders);
  } catch (_) { res.json([]); }
});

app.get('/api/subflow-folders', (_req, res) => {
  const subflowsDir = path.join(PROJECT_ROOT, '.maestro', 'subflows');
  try {
    const folders = fs.readdirSync(subflowsDir, { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => e.name)
      .sort();
    res.json(folders);
  } catch (_) { res.json([]); }
});

app.get('/api/flows-in-folder', (req, res) => {
  const { folder } = req.query;
  if (!folder) return res.json([]);
  const dir = path.join(PROJECT_ROOT, '.maestro', 'flows', folder);
  try {
    const files = walkDir(dir, '.yaml').map(f => path.relative(PROJECT_ROOT, f));
    res.json(files.sort());
  } catch (_) { res.json([]); }
});

app.get('/api/suites', (_req, res) => {
  const suites = [];
  const appDirs = ['cvshealth', 'health100'];
  for (const app of appDirs) {
    const dir = path.join(PROJECT_ROOT, '.maestro', 'apps', app, 'suites');
    try {
      const files = fs.readdirSync(dir)
        .filter(f => f.endsWith('.yaml'))
        .map(f => path.join('.maestro', 'apps', app, 'suites', f));
      suites.push(...files);
    } catch (_) {}
  }
  const sharedDir = path.join(PROJECT_ROOT, '.maestro', 'flows', 'suites');
  try {
    const files = fs.readdirSync(sharedDir)
      .filter(f => f.endsWith('.yaml'))
      .map(f => path.join('.maestro', 'flows', 'suites', f));
    suites.push(...files);
  } catch (_) {}
  res.json(suites.sort());
});

// ─── API: Latest report ───────────────────────────────────────────────────────

app.get('/api/latest-report', (_req, res) => {
  const reportsDir = path.join(PROJECT_ROOT, 'test-reports');
  try {
    const reports = [];
    const entries = fs.readdirSync(reportsDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const dir = path.join(reportsDir, entry.name);
      const candidates = ['suite-report.html', 'test-report-latest.html'];
      for (const fname of candidates) {
        const fp = path.join(dir, fname);
        if (fs.existsSync(fp)) {
          reports.push({ url: `/test-reports/${entry.name}/${fname}`, mtime: fs.statSync(fp).mtimeMs });
        }
      }
      try {
        fs.readdirSync(dir).filter(f => f.startsWith('test-report') && f.endsWith('.html')).forEach(f => {
          const fp = path.join(dir, f);
          reports.push({ url: `/test-reports/${entry.name}/${f}`, mtime: fs.statSync(fp).mtimeMs });
        });
      } catch (_) {}
    }
    if (reports.length === 0) return res.json({ url: null });
    reports.sort((a, b) => b.mtime - a.mtime);
    const best = reports[0];
    res.json({ url: best.url, timestamp: new Date(best.mtime).toISOString() });
  } catch (e) {
    res.json({ url: null, error: e.message });
  }
});

// ─── API: Latest test-data report ─────────────────────────────────────────────
// Scans artifacts/api/tests/ for the newest `test-data-report-*` directory
// (mtime-sorted) and returns its report URL. Used by the Test Data tab in the
// dashboard to auto-load / refresh the iframe. Mirrors the scan logic in
// scripts/utils/api/test-data-runner.js:findLatestReportDir.

app.get('/api/test-data/latest-report', (_req, res) => {
  const testsDir = path.join(PROJECT_ROOT, 'artifacts', 'api', 'tests');
  try {
    if (!fs.existsSync(testsDir)) return res.json({ url: null });
    const dirs = fs.readdirSync(testsDir)
      .filter(f => f.startsWith('test-data-report-'))
      .map(name => {
        const full = path.join(testsDir, name);
        let mtime = 0;
        try { mtime = fs.statSync(full).mtimeMs; } catch (_) {}
        return { name, mtime };
      })
      .filter(d => d.mtime > 0)
      .sort((a, b) => b.mtime - a.mtime);

    if (!dirs.length) return res.json({ url: null });

    const newest = dirs[0];
    const htmlPath = path.join(testsDir, newest.name, 'test-data-report.html');
    if (!fs.existsSync(htmlPath)) return res.json({ url: null });

    res.json({
      url:   `/artifacts/api/tests/${newest.name}/test-data-report.html`,
      name:  newest.name,
      mtime: new Date(newest.mtime).toISOString()
    });
  } catch (e) {
    res.json({ url: null, error: e.message });
  }
});

// ─── API: Run command ─────────────────────────────────────────────────────────

app.post('/api/run', (req, res) => {
  const { cmd, args = [], env = {} } = req.body;
  if (!cmd) return res.status(400).json({ error: 'cmd required' });

  const jobId = randomUUID();
  const clients = new Set();
  const output = [];

  const mergedEnv = { ...process.env, FORCE_COLOR: '1', ...env };
  const proc = spawn(cmd, args, {
    cwd: PROJECT_ROOT,
    env: mergedEnv,
    shell: true
  });

  const job = { proc, clients, output, status: 'running', exitCode: null };
  jobs.set(jobId, job);

  function broadcast(type, data) {
    const line = JSON.stringify({ type, data });
    output.push(line);
    for (const client of clients) {
      client.write(`data: ${line}\n\n`);
    }
  }

  proc.stdout.on('data', chunk => broadcast('stdout', chunk.toString()));
  proc.stderr.on('data', chunk => broadcast('stderr', chunk.toString()));
  proc.on('close', code => {
    job.status = 'done';
    job.exitCode = code;
    broadcast('exit', { code });
    for (const client of clients) {
      client.write(`data: ${JSON.stringify({ type: 'done', data: { code } })}\n\n`);
      client.end();
    }
    setTimeout(() => jobs.delete(jobId), 30 * 60 * 1000);
  });
  proc.on('error', err => {
    broadcast('error', err.message);
    job.status = 'done';
  });

  res.json({ jobId });
});

// ─── API: SSE stream ──────────────────────────────────────────────────────────

app.get('/api/stream/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'job not found' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Replay buffered output
  for (const line of job.output) {
    res.write(`data: ${line}\n\n`);
  }

  if (job.status === 'done') {
    res.write(`data: ${JSON.stringify({ type: 'done', data: { code: job.exitCode } })}\n\n`);
    return res.end();
  }

  job.clients.add(res);
  req.on('close', () => job.clients.delete(res));
});

// ─── API: Kill job ────────────────────────────────────────────────────────────

app.post('/api/kill/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'not found' });

  console.log(`[KILL] Job ${req.params.jobId} - PID: ${job.proc.pid}`);

  try {
    // Kill entire process group (parent + all children).
    // The wrapper (run-both-platforms.sh) and each child (test.sh /
    // run-test-suite.sh) install traps on SIGTERM/SIGINT that run graceful
    // cleanup — releasing the XCTest driver's accessibility observer inside
    // SpringBoard, finalizing Maestro's DebugLogStore zip, and letting the
    // simulator/emulator return to a healthy state. That cleanup takes
    // roughly 3-5 seconds end-to-end, so we MUST wait for it below before
    // firing any SIGKILL fallback. Bypassing the trap with early SIGKILL is
    // what corrupts SpringBoard's XCTAutomationSession and causes the
    // ~/Library/Logs/DiagnosticReports/SpringBoard-*.ips segfault crashes.
    process.kill(-job.proc.pid, 'SIGTERM');
    console.log(`[KILL] Sent SIGTERM to process group -${job.proc.pid}`);
  } catch (e) {
    console.log(`[KILL] Failed to kill process group: ${e.message}`);
    try {
      job.proc.kill('SIGTERM');
      console.log(`[KILL] Sent SIGTERM to process ${job.proc.pid}`);
    } catch (e2) {
      console.log(`[KILL] Failed to kill process: ${e2.message}`);
    }
  }

  // Give the wrapper + its children ~5s to run their SIGTERM traps to
  // completion. During this window each script releases its XCTest driver,
  // finalizes Maestro's debug log store, and reaps its own background
  // helpers — all things we would otherwise SIGKILL and leave in a broken
  // state.
  setTimeout(() => {
    console.log('[KILL] Post-grace cleanup: SIGTERM stragglers first, SIGKILL only if they survive...');
    try {
      // ── Phase 1: SIGTERM anything the wrapper's own traps didn't reach ───
      // Never blanket-match "accessibility" or "SpringBoard.*accessibility"
      // — those patterns hit SpringBoard's OWN internal threads / XPC
      // services on macOS and the sim, which is exactly what triggers
      // "SpringBoard segfault at __XCTAutomationSession..." crashes.
      const softTargets = [
        'maestro-driver-ios',
        'maestro.*server',
        'maestro.*driver',
        'dadb',
        'XCTAutomationSupport',
        'XCTestSupport',
        'idevice',
        'maestro test',
        'bash scripts/testing/test.sh',
        'run-test-suite.sh',
        'run-both-platforms.sh',
      ];
      for (const pat of softTargets) {
        execSync(`pkill -TERM -f "${pat}" 2>/dev/null || true`, { stdio: 'ignore' });
      }
      // Android helper scripts: SIGTERM only (they clean up their adb state
      // on exit).
      execSync('pkill -TERM -f "android-ui-inspector.js" 2>/dev/null || true', { stdio: 'ignore' });
      execSync('pkill -TERM -f "android-network-monitor.js" 2>/dev/null || true', { stdio: 'ignore' });
      execSync('pkill -TERM -f "tail.*-F.*maestro.log" 2>/dev/null || true', { stdio: 'ignore' });

      // ── Grace: let SIGTERM'd processes disassociate from the simulator ──
      execSync('sleep 2', { stdio: 'ignore' });

      // ── Phase 2: SIGKILL only what survived Phase 1 ─────────────────────
      for (const pat of softTargets) {
        execSync(`pkill -9 -f "${pat}" 2>/dev/null || true`, { stdio: 'ignore' });
      }
      execSync('pkill -9 -f "android-ui-inspector.js" 2>/dev/null || true', { stdio: 'ignore' });
      execSync('pkill -9 -f "android-network-monitor.js" 2>/dev/null || true', { stdio: 'ignore' });
      execSync('pkill -9 -f "tail.*-F.*maestro.log" 2>/dev/null || true', { stdio: 'ignore' });

      // Release port 7001 if anything else grabbed it
      execSync('lsof -ti tcp:7001 2>/dev/null | xargs kill -9 2>/dev/null || true', { stdio: 'ignore' });

      // Wait for port to be released and processes to fully terminate
      execSync('sleep 1', { stdio: 'ignore' });
      
      // Verify port is actually free (with timeout to prevent hanging)
      let retry = 0;
      while (retry < 3) {
        try {
          const portCheck = execSync('lsof -ti tcp:7001 2>/dev/null', { encoding: 'utf8', stdio: 'pipe' });
          if (portCheck.trim()) {
            console.log(`[KILL] Port 7001 still in use (retry ${retry + 1}/3), waiting...`);
            execSync('sleep 1', { stdio: 'ignore' });
            retry++;
          } else {
            break; // Port is free
          }
        } catch (e) {
          break; // lsof returned empty (port is free)
        }
      }
      
      // Final port check
      try {
        const finalCheck = execSync('lsof -ti tcp:7001 2>/dev/null', { encoding: 'utf8', stdio: 'pipe' });
        if (finalCheck.trim()) {
          console.log('[KILL] ⚠️  Port 7001 still in use after cleanup!');
        } else {
          console.log('[KILL] ✓ Port 7001 freed, cleanup complete');
        }
      } catch {
        console.log('[KILL] ✓ Port 7001 freed, cleanup complete');
      }
    } catch (e) {
      console.log(`[KILL] Error during cleanup: ${e.message}`);
    }
  }, 5000);

  res.json({ ok: true });
});

// ─── API: Check single dependency (synchronous, with timeout) ────────────────

app.post('/api/check', (req, res) => {
  const { cmd, timeout = 10000 } = req.body;
  if (!cmd) return res.status(400).json({ ok: false, output: 'cmd required' });

  let finished = false;
  let stdout = '';
  let stderr = '';

  const proc = spawn(cmd, [], { cwd: PROJECT_ROOT, shell: true, env: process.env });

  const timer = setTimeout(() => {
    if (!finished) {
      finished = true;
      try { proc.kill('SIGTERM'); } catch (_) {}
      res.json({ ok: false, output: 'Timed out after ' + (timeout / 1000) + 's' });
    }
  }, timeout);

  proc.stdout.on('data', d => { stdout += d.toString(); });
  proc.stderr.on('data', d => { stderr += d.toString(); });
  proc.on('close', code => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    res.json({ ok: code === 0, output: (stdout + stderr).trim(), code });
  });
  proc.on('error', err => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    res.json({ ok: false, output: err.message });
  });
});

// ─── API: Run all dependency checks ──────────────────────────────────────────

app.get('/api/verify-all', async (req, res) => {
  const checks = [
    { id: 'maestro',      label: 'Maestro CLI',           cmd: 'maestro --version' },
    { id: 'node',         label: 'Node.js',               cmd: 'node --version' },
    { id: 'npm',          label: 'npm',                   cmd: 'npm --version' },
    { id: 'xcode',        label: 'Xcode CLI Tools',       cmd: 'xcode-select --print-path' },
    { id: 'cocoapods',    label: 'CocoaPods',             cmd: 'pod --version' },
    { id: 'node_modules', label: 'Node Dependencies',     cmd: 'test -d node_modules && echo "node_modules present"' },
    { id: 'ios_sim',      label: 'iOS Simulators',        cmd: 'xcrun simctl list devices available 2>/dev/null | grep -c "iPhone"' },
    { id: 'ios_booted',   label: 'iOS Simulator Booted',  cmd: 'xcrun simctl list devices 2>/dev/null | grep -c "Booted"' },
    { id: 'android_home', label: 'Android SDK (ANDROID_HOME)', cmd: 'test -n "$ANDROID_HOME" && echo "$ANDROID_HOME"' },
    { id: 'adb',          label: 'ADB',                   cmd: 'adb --version' },
    { id: 'emulator',     label: 'Android Emulators',     cmd: 'emulator -list-avds 2>/dev/null | head -5' },
    { id: 'cvs_ios',      label: 'CVS Health App (iOS)',  cmd: 'xcrun simctl listapps booted 2>/dev/null | grep -c cvspharmacy || true' },
    { id: 'h100_ios',     label: 'Health 100 App (iOS)',  cmd: 'xcrun simctl listapps booted 2>/dev/null | grep -c health100 || true' },
    { id: 'cvs_android',  label: 'CVS App (Android)',     cmd: 'adb shell pm list packages 2>/dev/null | grep -c cvs || true' },
  ];

  const results = await Promise.all(checks.map(c => new Promise(resolve => {
    let stdout = '', stderr = '', done = false;
    const proc = spawn(c.cmd, [], { cwd: PROJECT_ROOT, shell: true, env: process.env });
    const timer = setTimeout(() => {
      if (!done) { done = true; try { proc.kill(); } catch (_) {} resolve({ ...c, ok: false, output: 'timeout' }); }
    }, 8000);
    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });
    proc.on('close', code => {
      if (done) return; done = true; clearTimeout(timer);
      const output = (stdout + stderr).trim();
      let ok = code === 0;
      if (['ios_sim','ios_booted','cvs_ios','h100_ios','cvs_android'].includes(c.id)) {
        const n = parseInt(output, 10);
        ok = !isNaN(n) && n > 0;
      }
      if (c.id === 'emulator') ok = output.trim().length > 0;
      resolve({ ...c, ok, output });
    });
    proc.on('error', err => {
      if (done) return; done = true; clearTimeout(timer);
      resolve({ ...c, ok: false, output: err.message });
    });
  })));

  res.json(results);
});

// ─── API: List devices ────────────────────────────────────────────────────────

app.get('/api/devices', (req, res) => {
  const { platform } = req.query;
  
  if (!platform || !['ios', 'android'].includes(platform)) {
    return res.status(400).json({ error: 'platform required (ios or android)' });
  }

  let cmd;
  if (platform === 'ios') {
    cmd = 'xcrun simctl list devices available --json';
  } else {
    cmd = 'adb devices -l';
  }

  let stdout = '';
  let stderr = '';
  const proc = spawn(cmd, [], { cwd: PROJECT_ROOT, shell: true, env: process.env });

  proc.stdout.on('data', d => { stdout += d.toString(); });
  proc.stderr.on('data', d => { stderr += d.toString(); });

  proc.on('close', code => {
    const devices = [];
    
    if (platform === 'ios') {
      try {
        const json = JSON.parse(stdout);
        if (json.devices) {
          Object.entries(json.devices).forEach(([runtime, devList]) => {
            if (Array.isArray(devList)) {
              devList.forEach(device => {
                devices.push({
                  id: device.udid,
                  name: device.name,
                  state: device.state,
                  platform: 'ios'
                });
              });
            }
          });
        }
      } catch (e) {
        console.error('Failed to parse iOS devices JSON:', e.message);
      }
    } else {
      const { execSync } = require('child_process');
      const lines = stdout.trim().split('\n');
      lines.forEach(line => {
        // Skip header line — actual header is "List of devices attached"
        if (!line.trim() || line.includes('List of devices')) return;
        // Only process lines that have a device/emulator state
        if (!line.includes('\tdevice') && !/ device /.test(line)) return;

        const deviceId = line.split(/\s+/)[0].trim();
        if (!deviceId) return;

        let deviceName = deviceId;
        let apiLevel = '';

        try {
          // API level: ro.build.version.sdk is the integer SDK (e.g. 36)
          const apiOutput = execSync(
            `adb -s ${deviceId} shell getprop ro.build.version.sdk 2>/dev/null`,
            { encoding: 'utf8', timeout: 5000, stdio: ['pipe', 'pipe', 'ignore'] }
          ).trim();
          if (apiOutput) apiLevel = apiOutput;

          // For emulators use AVD name (e.g. "Pixel_9_Pro_API_36"), else model
          if (deviceId.startsWith('emulator-')) {
            const avdOutput = execSync(
              `adb -s ${deviceId} emu avd name 2>/dev/null`,
              { encoding: 'utf8', timeout: 5000, stdio: ['pipe', 'pipe', 'ignore'] }
            ).split('\n')[0].trim();
            // avd name may have trailing "OK" on second line — first line is the name
            if (avdOutput && avdOutput !== 'OK') {
              deviceName = avdOutput.replace(/_/g, ' ');
            }
          } else {
            const modelOutput = execSync(
              `adb -s ${deviceId} shell getprop ro.product.model 2>/dev/null`,
              { encoding: 'utf8', timeout: 5000, stdio: ['pipe', 'pipe', 'ignore'] }
            ).trim();
            if (modelOutput) deviceName = modelOutput;
          }
        } catch (_) {
          // Fall back to device ID if properties can't be read
        }

        devices.push({
          id: deviceId,
          name: deviceName,
          apiLevel: apiLevel,
          state: 'online',
          platform: 'android'
        });
      });
    }

    res.json({ devices, platform });
  });

  proc.on('error', err => {
    res.json({ devices: [], platform, error: err.message });
  });
});

// ─── API: Device Recovery ─────────────────────────────────────────────────────

app.post('/api/refresh-device', (req, res) => {
  const { platform = 'android', device = '' } = req.body;
  
  console.log('[refresh-device] platform:', platform, 'device:', device);
  
  const commands = [
    "pkill -9 -f 'maestro.*driver' 2>/dev/null || true",
    "pkill -9 -f 'maestro.*server' 2>/dev/null || true",
    'lsof -ti tcp:7001 | xargs kill -9 2>/dev/null || true',
    'sleep 2'
  ];
  
  if (platform === 'android') {
    commands.push('bash scripts/setup/android-setup.sh boot');
  } else {
    if (device) {
      const escapedDevice = device.replace(/'/g, "'\\''");
      commands.push(`bash scripts/setup/ios-setup.sh boot '${escapedDevice}'`);
      console.log('[refresh-device] iOS command:', commands[commands.length - 1]);
    } else {
      commands.push('bash scripts/setup/ios-setup.sh boot');
    }
  }
  
  const jobId = require('crypto').randomUUID();
  const clients = new Set();
  const output = [];
  
  function broadcast(type, data) {
    const line = JSON.stringify({ type, data });
    output.push(line);
    for (const client of clients) {
      client.write(`data: ${line}\n\n`);
    }
  }
  
  const fullCmd = commands.join(' && ');
  const proc = spawn('bash', ['-c', fullCmd], {
    cwd: PROJECT_ROOT,
    env: { ...process.env, FORCE_COLOR: '1' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  
  const job = { proc, clients, output, status: 'running', exitCode: null };
  jobs.set(jobId, job);
  
  proc.stdout.on('data', chunk => broadcast('stdout', chunk.toString()));
  proc.stderr.on('data', chunk => broadcast('stderr', chunk.toString()));
  proc.on('close', code => {
    job.status = 'done';
    job.exitCode = code;
    broadcast('exit', { code });
    for (const client of clients) {
      client.write(`data: ${JSON.stringify({ type: 'done', data: { code } })}\n\n`);
      client.end();
    }
    setTimeout(() => jobs.delete(jobId), 30 * 60 * 1000);
  });
  proc.on('error', err => {
    broadcast('error', err.message);
    job.status = 'done';
  });
  
  res.json({ jobId });
});

// ─── API: List reports ────────────────────────────────────────────────────────

app.get('/api/reports', (_req, res) => {
  const reportsDir = path.join(PROJECT_ROOT, 'test-reports');
  try {
    const entries = fs.readdirSync(reportsDir, { withFileTypes: true })
      .filter(e => e.isDirectory() || (e.isFile() && e.name.endsWith('.html')))
      .map(e => {
        const full = path.join(reportsDir, e.name);
        const stat = fs.statSync(full);
        if (e.isDirectory()) {
          const htmls = fs.readdirSync(full).filter(f => f.endsWith('.html')).map(f => path.join('test-reports', e.name, f));
          return { name: e.name, type: 'dir', htmls, mtime: stat.mtimeMs };
        }
        return { name: e.name, type: 'file', path: path.join('test-reports', e.name), mtime: stat.mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, 20);
    res.json(entries);
  } catch (_) {
    res.json([]);
  }
});

// ─── API: Script Builder - flow tree ─────────────────────────────────────────

function buildFlowTree(dir, base) {
  const result = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
      .sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1;
        if (!a.isDirectory() && b.isDirectory()) return 1;
        return a.name.localeCompare(b.name);
      });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      const rel = path.relative(base, full);
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        result.push({ type: 'dir', name: entry.name, path: rel, children: buildFlowTree(full, base) });
      } else if (entry.isFile() && entry.name.endsWith('.yaml')) {
        result.push({ type: 'file', name: entry.name, path: rel });
      }
    }
  } catch (_) {}
  return result;
}

app.get('/api/flow-tree', (_req, res) => {
  const flowsDir = path.join(PROJECT_ROOT, '.maestro', 'flows');
  res.json(buildFlowTree(flowsDir, PROJECT_ROOT));
});

app.get('/api/subflow-tree', (_req, res) => {
  const subflowsDir = path.join(PROJECT_ROOT, '.maestro', 'subflows');
  res.json(buildFlowTree(subflowsDir, PROJECT_ROOT));
});

app.get('/api/file', (req, res) => {
  const { filePath } = req.query;
  if (!filePath) return res.status(400).json({ error: 'filePath required' });
  
  const abs = path.resolve(PROJECT_ROOT, filePath);
  if (!abs.startsWith(PROJECT_ROOT)) return res.status(403).json({ error: 'Forbidden: Path outside project root' });
  
  try {
    if (!fs.existsSync(abs)) {
      return res.status(404).json({ error: 'File not found: ' + filePath });
    }
    
    const stats = fs.statSync(abs);
    if (!stats.isFile()) {
      return res.status(400).json({ error: 'Path is not a file: ' + filePath });
    }
    
    const content = fs.readFileSync(abs, 'utf8');
    res.json({ content });
  } catch (e) {
    console.error('Error serving file:', filePath, e.message);
    res.status(500).json({ error: 'Failed to read file: ' + e.message });
  }
});

app.post('/api/file', (req, res) => {
  const { filePath, content } = req.body;
  if (!filePath || content === undefined) return res.status(400).json({ error: 'filePath and content required' });
  const abs = path.resolve(PROJECT_ROOT, filePath);
  if (!abs.startsWith(PROJECT_ROOT)) return res.status(403).json({ error: 'Forbidden' });
  try {
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content, 'utf8');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

function normalizePreviewEnvValue(val) {
  if (val === undefined || val === null) return val;
  const str = String(val).trim().replace(/^['"]|['"]$/g, '');
  const fallbackMatch = str.match(/^\$\{[^:}]+:-([^}]+)\}$/);
  if (fallbackMatch) return fallbackMatch[1].trim().replace(/^['"]|['"]$/g, '');
  return str;
}

app.post('/api/resolve-script-data', (req, res) => {
  const { currentFile, scriptPath, env = {} } = req.body || {};
  if (!currentFile || !scriptPath) return res.status(400).json({ error: 'currentFile and scriptPath required' });

  const baseDir = path.dirname(path.resolve(PROJECT_ROOT, currentFile));
  const abs = path.resolve(baseDir, scriptPath);
  if (!abs.startsWith(PROJECT_ROOT)) return res.status(403).json({ error: 'Forbidden' });
  if (!fs.existsSync(abs)) return res.status(404).json({ error: `Script not found: ${scriptPath}` });

  try {
    const script = fs.readFileSync(abs, 'utf8');
    const normalizedEnv = Object.fromEntries(Object.entries(env).map(([k, v]) => [k, normalizePreviewEnvValue(v)]));
    
    // Capture console output from the script
    const consoleOutput = [];
    const sandbox = {
      output: {},
      env: normalizedEnv,
      console: { 
        log(...args) { 
          const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
          consoleOutput.push(`[credentials-loader] ${message}`);
          console.log(`[credentials-loader] ${message}`); // Also log to server console
        },
        warn(...args) { 
          const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
          consoleOutput.push(`[credentials-loader] WARNING: ${message}`);
          console.warn(`[credentials-loader] WARNING: ${message}`);
        },
        error(...args) { 
          const message = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
          consoleOutput.push(`[credentials-loader] ERROR: ${message}`);
          console.error(`[credentials-loader] ERROR: ${message}`);
        }
      },
      process: { env: { ...process.env, ...normalizedEnv } },
      require,
      __dirname: path.dirname(abs),
      __filename: abs,
      Math,
      Date,
      JSON,
      String,
      Number,
      Boolean,
      Array,
      Object,
      RegExp,
      setTimeout,
      clearTimeout
    };

    // Add env vars as top-level globals too (for scripts that access them directly)
    Object.assign(sandbox, normalizedEnv);
    
    vm.createContext(sandbox);
    vm.runInContext(script, sandbox, { timeout: 1000, filename: abs });

    // Ensure output.user is properly serialized
    const userData = sandbox.output && sandbox.output.user ? JSON.parse(JSON.stringify(sandbox.output.user)) : null;
    
    console.log(`[resolve-script-data] Script: ${scriptPath}, Env: ${JSON.stringify(normalizedEnv)}, User resolved: ${!!userData}`);
    
    res.json({
      resolvedPath: path.relative(PROJECT_ROOT, abs),
      env: normalizedEnv,
      output: sandbox.output || {},
      user: userData,
      consoleOutput: consoleOutput
    });
  } catch (e) {
    console.error(`[resolve-script-data] Error in ${scriptPath}:`, e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/new-flow', (req, res) => {
  const { dir, name } = req.body;
  if (!dir || !name) return res.status(400).json({ error: 'dir and name required' });
  const filename = name.endsWith('.yaml') ? name : `${name}.yaml`;
  const abs = path.resolve(PROJECT_ROOT, '.maestro', 'flows', dir, filename);
  if (!abs.startsWith(PROJECT_ROOT)) return res.status(403).json({ error: 'Forbidden' });
  if (fs.existsSync(abs)) return res.status(409).json({ error: 'File already exists' });
  const template = `appId: \${APP_ID}\ntags:\n  - ${dir.toLowerCase()}\n---\n- runFlow: ../../subflows/common/launchApp.yaml\n`;
  try {
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, template, 'utf8');
    res.json({ ok: true, path: path.relative(PROJECT_ROOT, abs) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/check-flow', (req, res) => {
  const { filePath, content } = req.body;
  
  if (!content) {
    return res.status(400).json({ error: 'content required' });
  }

  try {
    // Create temporary file for validation
    const tempFilePath = filePath ? path.resolve(PROJECT_ROOT, filePath) : path.join(PROJECT_ROOT, '.temp-validation.yaml');
    
    // Write content to temp file
    fs.writeFileSync(tempFilePath, content, 'utf8');
    
    // Run validation
    const validator = new MaestroYAMLValidator(PROJECT_ROOT);
    const result = validator.validateFile(tempFilePath);
    
    // Clean up temp file if it wasn't the original file
    if (!filePath || !fs.existsSync(path.resolve(PROJECT_ROOT, filePath))) {
      fs.unlinkSync(tempFilePath);
    }
    
    // Return validation results
    res.json({ 
      issues: result.errors.length > 0 ? result.errors : result.warnings,
      total: result.total,
      errors: result.errors,
      warnings: result.warnings
    });
    
  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({ 
      error: 'Validation failed', 
      message: error.message,
      issues: [{ line: 1, type: 'error', message: `Validation error: ${error.message}` }]
    });
  }
});

// ─── API: Screen labels (parse output.* objects from .js screen files) ────────

function parseScreenLabels(content) {
  const result = {};
  
  // Find all output.screenName = { ... } blocks
  const blockStartRegex = /output\.(\w+)\s*=\s*\{/g;
  let blockMatch;
  
  while ((blockMatch = blockStartRegex.exec(content)) !== null) {
    const screenName = blockMatch[1];
    const startPos = blockMatch.index;
    
    // Find the matching closing brace for this block
    let braceCount = 1;
    let pos = startPos + blockMatch[0].length;
    let blockContent = '';
    
    while (pos < content.length && braceCount > 0) {
      const char = content[pos];
      if (char === '{') braceCount++;
      else if (char === '}') braceCount--;
      
      if (braceCount > 0) {
        blockContent += char;
      }
      pos++;
    }
    
    if (braceCount === 0) {
      result[screenName] = {};
      // Match: key: __isIOS ? "ios" : "android"  OR  key: "value"  (double or single quotes)
      const propRegex = /(\w+):\s*(?:__isIOS\s*\?\s*(?:"([^"]*)"|'([^']*)')\s*:\s*(?:"([^"]*)"|'([^']*)')|(?:"([^"]*)"|'([^']*)'))/g;
      let propMatch;
      while ((propMatch = propRegex.exec(blockContent)) !== null) {
        const key = propMatch[1];
        const isConditional = propMatch[2] !== undefined || propMatch[3] !== undefined;
        if (isConditional) {
          result[screenName][key] = {
            ios:     propMatch[2] !== undefined ? propMatch[2] : propMatch[3],
            android: propMatch[4] !== undefined ? propMatch[4] : propMatch[5]
          };
        } else {
          const val = propMatch[6] !== undefined ? propMatch[6] : propMatch[7];
          result[screenName][key] = { ios: val, android: val };
        }
      }
    }
  }
  return result;
}

app.get('/api/screen-labels', (_req, res) => {
  const screensDir = path.join(PROJECT_ROOT, '.maestro', 'screens');
  const labels = {};

  function walkDir(dir) {
    try {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walkDir(full);
        else if (entry.isFile() && entry.name.endsWith('.js')) {
          try {
            const parsedLabels = parseScreenLabels(fs.readFileSync(full, 'utf8'));
            // Merge without overwriting existing screen definitions
            for (const screenName in parsedLabels) {
              if (!labels[screenName]) {
                labels[screenName] = parsedLabels[screenName];
              }
            }
          } catch (_) {}
        }
      }
    } catch (_) {}
  }

  walkDir(screensDir);
  res.json(labels);
});

// ─── Serve frontend ───────────────────────────────────────────────────────────

app.get('/', (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ─── Port cleanup ─────────────────────────────────────────────────────────────

function killPortSync(port) {
  try {
    const cmd = process.platform === 'darwin'
      ? `lsof -ti tcp:${port} | xargs kill -9 2>/dev/null; true`
      : `fuser -k ${port}/tcp 2>/dev/null; true`;
    execSync(cmd, { stdio: 'ignore', shell: true });
  } catch (_) {}
}

// ─── Start server ─────────────────────────────────────────────────────────────

// ─── Auto-open browser on startup ─────────────────────────────────────────────
// Skipped when the Electron shell is running (it loads the URL itself) or when
// NO_OPEN=1 is set. Opens once per server start.
function maybeOpenBrowser(url) {
  if (IS_ELECTRON) return;
  if (process.env.NO_OPEN === '1' || process.env.DASHBOARD_NO_OPEN === '1') return;

  const platform = process.platform;
  let cmd, args;
  if (platform === 'darwin')      { cmd = 'open';     args = [url]; }
  else if (platform === 'win32')  { cmd = 'cmd';      args = ['/c', 'start', '', url]; }
  else                            { cmd = 'xdg-open'; args = [url]; }

  try {
    const child = spawn(cmd, args, { stdio: 'ignore', detached: true });
    child.on('error', () => { /* browser not available — ignore */ });
    child.unref();
  } catch (_) {
    // Non-fatal — user can still open the URL manually.
  }
}

function startServer() {
  killPortSync(PORT);

  const server = app.listen(PORT, () => {
    console.log(`\n🚀 Automation Dashboard running at http://localhost:${PORT}\n`);
    console.log(`📱 Open in browser: http://localhost:${PORT}`);
    maybeOpenBrowser(`http://localhost:${PORT}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`[Server] Port ${PORT} still busy, retrying kill...`);
      killPortSync(PORT);
      setTimeout(() => {
        server.close();
        startServer();
      }, 800);
    } else {
      console.error('[Server] Fatal error:', err);
      process.exit(1);
    }
  });

  // Graceful shutdown so concurrently --kill-others SIGTERM is handled cleanly
  const shutdown = () => {
    server.close(() => process.exit(0));
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT',  shutdown);
}

// ─── Test Generation via HybridTestGenerator ────────────────────────────────
const { HybridTestGenerator, MODES } = require('../../scripts/utils/dashboard/hybrid-test-generator');

app.post('/api/generate-enhanced-test', async (req, res) => {
  const { testId, functionalArea, testScenario, notes, testSteps, mode } = req.body;

  if (!testId || !testSteps) {
    return res.status(400).json({ success: false, error: 'testId and testSteps are required' });
  }

  const generationMode = mode || MODES.HYBRID;
  console.log(`🚀 Generating test ${testId} in ${generationMode} mode`);

  try {
    const generator = new HybridTestGenerator(generationMode);
    const result = await generator.generateTestWithRetry({
      testId,
      functionalArea: functionalArea || 'General',
      testScenario: testScenario || testId,
      notes: notes || '',
      testSteps
    });

    const report = generator.generateReport(result);

    res.json({
      success: result.success,
      yaml: result.yaml || '',
      source: result.source,
      validation: result.validation,
      resolutions: result.resolutions,
      steps: result.steps,
      errors: result.errors,
      report
    });
  } catch (error) {
    console.error('❌ Test generation error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Save generated test endpoint
app.post('/api/save-test', async (req, res) => {
  const { filename, content, feature } = req.body;
  
  try {
    // Determine the target directory based on feature
    const featureDir = feature || 'General';
    const flowsDir = path.join(PROJECT_ROOT, '.maestro', 'flows', featureDir);
    
    // Ensure directory exists
    fs.mkdirSync(flowsDir, { recursive: true });
    
    // Write the test file
    const filePath = path.join(flowsDir, filename);
    fs.writeFileSync(filePath, content, 'utf8');
    
    console.log(`Generated test saved: ${filePath}`);
    
    res.json({ 
      success: true, 
      path: filePath,
      message: `Test saved successfully to ${filename}`
    });
    
  } catch (error) {
    console.error('Error saving test:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Process monitoring endpoints
app.get('/api/processes', async (req, res) => {
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    // Get process information
    let processes = [];
    
    if (process.platform === 'darwin') {
      // macOS
      const { stdout } = await execAsync('ps aux | grep -E "(maestro|simulator|xcrun|adb|emulator|gradle|node|npm)" | grep -v grep');
      processes = parsePsOutput(stdout);
    } else {
      // Linux
      const { stdout } = await execAsync('ps aux | grep -E "(maestro|simulator|xcrun|adb|emulator|gradle|node|npm)" | grep -v grep');
      processes = parsePsOutput(stdout);
    }
    
    // Identify stale processes
    const staleProcesses = await identifyStaleProcesses(processes);
    
    res.json({
      processes: processes,
      staleProcesses: staleProcesses,
      total: processes.length,
      staleCount: staleProcesses.length
    });
    
  } catch (error) {
    console.error('Error getting processes:', error);
    res.json({
      processes: [],
      staleProcesses: [],
      total: 0,
      staleCount: 0,
      error: error.message
    });
  }
});

app.post('/api/processes/cleanup', async (req, res) => {
  try {
    const { pids } = req.body;
    const cleanupScript = path.join(PROJECT_ROOT, 'scripts/utils/cleanup-stale-processes.sh');
    
    if (!Array.isArray(pids) || pids.length === 0) {
      return res.status(400).json({ error: 'No PIDs provided for cleanup' });
    }
    
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    const results = [];
    
    for (const pid of pids) {
      try {
        // Kill process gracefully
        await execAsync(`kill -TERM ${pid}`);
        
        // Wait a bit and check if it's still running
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        try {
          await execAsync(`kill -0 ${pid}`);
          // Still running, force kill
          await execAsync(`kill -KILL ${pid}`);
          results.push({ pid, status: 'force-killed' });
        } catch {
          // Process is dead
          results.push({ pid, status: 'killed' });
        }
      } catch (error) {
        results.push({ pid, status: 'error', error: error.message });
      }
    }
    
    res.json({
      success: true,
      results: results,
      killed: results.filter(r => r.status === 'killed' || r.status === 'force-killed').length,
      failed: results.filter(r => r.status === 'error').length
    });
    
  } catch (error) {
    console.error('Error cleaning up processes:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/processes/cleanup-all', async (req, res) => {
  try {
    const cleanupScript = path.join(PROJECT_ROOT, 'scripts/utils/cleanup-stale-processes.sh');
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    // Run the cleanup script
    const { stdout, stderr } = await execAsync(`${cleanupScript} cleanup`, { timeout: 30000 });
    
    res.json({
      success: true,
      output: stdout,
      error: stderr
    });
    
  } catch (error) {
    console.error('Error running cleanup script:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper functions
function parsePsOutput(output) {
  const lines = output.trim().split('\n');
  return lines.map(line => {
    const parts = line.trim().split(/\s+/);
    const user = parts[0];
    const pid = parts[1];
    const cpu = parts[2];
    const mem = parts[3];
    const command = parts.slice(10).join(' ');
    
    return {
      pid: parseInt(pid),
      user: user,
      cpu: parseFloat(cpu),
      memory: parseFloat(mem),
      command: command,
      timestamp: Date.now()
    };
  });
}

async function identifyStaleProcesses(processes) {
  const stale = [];
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  
  for (const process of processes) {
    // Check if process is older than 1 hour
    if (process.timestamp < oneHourAgo) {
      stale.push({
        ...process,
        reason: 'Older than 1 hour'
      });
    }
    
    // Check for specific stale patterns
    if (process.command.includes('maestro') && process.cpu > 50) {
      stale.push({
        ...process,
        reason: 'High CPU usage for Maestro process'
      });
    }
    
    if (process.command.includes('simulator') && process.memory > 2000) {
      stale.push({
        ...process,
        reason: 'High memory usage for simulator'
      });
    }
  }
  
  return stale;
}

// ─── Zephyr Scale API Proxy ───────────────────────────────────────────────────
const https = require('https');

function zephyrRequest(token, apiPath, params) {
  return new Promise((resolve, reject) => {
    const qs = new URLSearchParams(params).toString();
    const fullPath = `/v2${apiPath}${qs ? '?' + qs : ''}`;
    const options = {
      hostname: 'api.zephyrscale.smartbear.com',
      port: 443,
      path: fullPath,
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch (_) { resolve({ status: res.statusCode, body: { raw: data } }); }
      });
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('Zephyr API timeout')); });
    req.end();
  });
}

function zephyrProxy(pathFn) {
  return async (req, res) => {
    const { token, ...rest } = req.query;
    if (!token) return res.status(400).json({ error: 'token is required' });
    try {
      const p = typeof pathFn === 'function' ? pathFn(req) : pathFn;
      const result = await zephyrRequest(token, p, rest);
      res.status(result.status).json(result.body);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };
}

app.get('/api/zephyr/testcases',                          zephyrProxy('/testcases'));
app.get('/api/zephyr/testcases/:key',                     zephyrProxy(r => `/testcases/${r.params.key}`));
app.get('/api/zephyr/testcases/:key/teststeps',           zephyrProxy(r => `/testcases/${r.params.key}/teststeps`));
app.get('/api/zephyr/testcases/:key/testexecutions',      zephyrProxy(r => `/testcases/${r.params.key}/testexecutions`));
app.get('/api/zephyr/testcycles',                         zephyrProxy('/testcycles'));
app.get('/api/zephyr/testcycles/:key',                    zephyrProxy(r => `/testcycles/${r.params.key}`));
app.get('/api/zephyr/testcycles/:key/testexecutions',     zephyrProxy(r => `/testcycles/${r.params.key}/testexecutions`));
app.get('/api/zephyr/testplans',                          zephyrProxy('/testplans'));
app.get('/api/zephyr/testplans/:key',                     zephyrProxy(r => `/testplans/${r.params.key}`));
app.get('/api/zephyr/testexecutions',                     zephyrProxy('/testexecutions'));
app.get('/api/zephyr/testexecutions/:id',                 zephyrProxy(r => `/testexecutions/${r.params.id}`));
app.get('/api/zephyr/folders',                            zephyrProxy('/folders'));
app.get('/api/zephyr/customfields',                       zephyrProxy('/customfields'));
app.get('/api/zephyr/priorities',                         zephyrProxy('/priorities'));

// Returns Zephyr env config from server process.env (populated from .env at startup).
// Lets the dashboard pre-populate the token field without manual entry each session.
app.get('/api/zephyr/env', (_req, res) => {
  res.json({
    token: process.env.ZEPHYR_API_TOKEN || '',
    projectKey: process.env.ZEPHYR_PROJECT_KEY || 'TLPCWHSAM',
  });
});

// ─── Zephyr Write Proxy (POST / PUT) ─────────────────────────────────────────
// Forwards write operations to Zephyr Scale API v2. Token is taken from the
// request body so it never appears in server logs as a query parameter.

function zephyrWrite(method, pathFn) {
  return async (req, res) => {
    const token = (req.body && req.body.token) || req.query.token;
    if (!token) return res.status(400).json({ error: 'token is required' });

    const apiPath = typeof pathFn === 'function' ? pathFn(req) : pathFn;
    const fullPath = `/v2${apiPath}`;

    // Strip internal 'token' field before forwarding to Zephyr
    const { token: _t, ...payload } = req.body || {};
    const bodyStr = JSON.stringify(payload);

    const options = {
      hostname: 'api.zephyrscale.smartbear.com',
      port: 443,
      path: fullPath,
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
      },
    };

    console.log(`[zephyr] ${method} ${fullPath}`, bodyStr.slice(0, 300));
    try {
      const result = await new Promise((resolve, reject) => {
        const wreq = https.request(options, (wres) => {
          let data = '';
          wres.on('data', chunk => { data += chunk; });
          wres.on('end', () => {
            console.log(`[zephyr] response ${wres.statusCode}:`, data.slice(0, 300));
            try { resolve({ status: wres.statusCode, body: data ? JSON.parse(data) : {} }); }
            catch (_) { resolve({ status: wres.statusCode, body: { raw: data } }); }
          });
        });
        wreq.on('error', (e) => { console.error('[zephyr] request error:', e.message); reject(e); });
        wreq.setTimeout(45000, () => { wreq.destroy(); reject(new Error('Zephyr API timeout')); });
        wreq.write(bodyStr);
        wreq.end();
      });
      res.status(result.status).json(result.body);
    } catch (err) {
      console.error('[zephyr] write failed:', err.message);
      res.status(500).json({ error: err.message });
    }
  };
}

// Test Cycles
app.post('/api/zephyr/testcycles',                        zephyrWrite('POST', '/testcycles'));
app.put('/api/zephyr/testcycles/:key',                    zephyrWrite('PUT',  r => `/testcycles/${r.params.key}`));
app.post('/api/zephyr/testcycles/:key/testexecutions',    zephyrWrite('POST', r => `/testcycles/${r.params.key}/testexecutions`));

// Test Plans
app.post('/api/zephyr/testplans',           zephyrWrite('POST', '/testplans'));
app.put('/api/zephyr/testplans/:key',       zephyrWrite('PUT',  r => `/testplans/${r.params.key}`));

// Folders
app.post('/api/zephyr/folders',             zephyrWrite('POST', '/folders'));

// Test Executions
app.post('/api/zephyr/testexecutions',      zephyrWrite('POST', '/testexecutions'));
app.put('/api/zephyr/testexecutions/:id',   zephyrWrite('PUT',  r => `/testexecutions/${r.params.id}`));

// Test Cases (update steps / metadata)
app.put('/api/zephyr/testcases/:key',       zephyrWrite('PUT',  r => `/testcases/${r.params.key}`));

// Returns Zephyr env config available on the server (from .env / shell).
// Token is returned so the client can pre-populate the field without requiring
// manual entry each session. Never logged or stored client-side beyond the input.
app.get('/api/zephyr/env', (_req, res) => {
  res.json({
    token: process.env.ZEPHYR_API_TOKEN || '',
    projectKey: process.env.ZEPHYR_PROJECT_KEY || 'TLPCWHSAM',
  });
});

// ─── API: Sharded parallel test run ──────────────────────────────────────────

app.post('/api/run-sharded', (req, res) => {
  const { flowFiles = [], deviceIds = [], appId = '', platform = 'ios', buildConfig = 'debug', extraFlags = [] } = req.body || {};

  if (!flowFiles.length) return res.status(400).json({ error: 'flowFiles required' });
  if (!deviceIds.length) return res.status(400).json({ error: 'deviceIds required' });

  const shardCount = deviceIds.length;

  // Split flowFiles into N equal chunks (round-robin so sizes stay balanced)
  const chunks = Array.from({ length: shardCount }, () => []);
  flowFiles.forEach((f, i) => chunks[i % shardCount].push(f));

  // One-time pre-spawn cleanup for Android: kill stale Maestro host-side processes
  // and flush per-device ADB port forwards. We intentionally do NOT restart the ADB
  // server here — adb kill-server severs all emulator connections and the devices can
  // take 10-20s to reconnect, causing "Android driver unreachable" on the first step
  // after onFlowStart. The ADB server itself is healthy; only Maestro's process state
  // needs clearing. Device-specific forwards are flushed per device so each shard
  // starts with a clean slate without touching the other shard's device.
  if (platform === 'android') {
    try {
      execSync(
        'pkill -9 -f "maestro.*server" 2>/dev/null || true;' +
        'pkill -9 -f "maestro.*driver" 2>/dev/null || true;' +
        'sleep 2',
        { cwd: PROJECT_ROOT, stdio: 'ignore', timeout: 10000 }
      );
    } catch (_) {}
    for (const deviceId of deviceIds) {
      try {
        execSync(`adb -s ${deviceId} forward --remove-all 2>/dev/null || true`, { stdio: 'ignore', timeout: 5000 });
      } catch (_) {}
    }
  }

  // Temp shard scripts go to os.tmpdir(), NOT inside .maestro/ — the path validator
  // recursively walks .maestro/ and would pick them up causing ENOENT race conditions.
  const shardDir = path.join(os.tmpdir(), 'maestro-shards');
  fs.mkdirSync(shardDir, { recursive: true });
  const timestamp = Date.now();

  const shards = [];

  for (let i = 0; i < shardCount; i++) {
    const files = chunks[i];
    if (!files.length) continue;

    // Build a shell script that runs test.sh once per flow file individually.
    // This avoids Maestro's suite runner (runShardSuite), which conflicts when
    // two concurrent `maestro test suite.yaml` processes share host-side state.
    // Each individual `maestro test flow.yaml` call uses the simpler single-flow path.
    const baseFlags = `--platform ${platform} --device ${deviceIds[i]}`;
    const extraFlagsStr = extraFlags.filter(Boolean).join(' ');
    const scriptLines = ['#!/bin/bash'];
    if (buildConfig === 'release') scriptLines.push('export BUILD_CONFIG=release');

    // These exports must live in the shard script itself, not inside test.sh,
    // because test.sh exits early to the suite runner for suite files before
    // reaching the equivalent lines (stagger at ~1018, JAVA_TOOL_OPTIONS at ~1233,
    // MAESTRO_DRIVER_STARTUP_TIMEOUT at ~1238).  Putting them here ensures they
    // are always in effect regardless of whether the target is a suite or a flow.

    // Stagger: shard 0 starts immediately; subsequent shards wait to avoid
    // simultaneous Maestro gRPC session setup races on the host ADB server.
    if (i > 0) scriptLines.push(`sleep ${i * 8}`);

    // Cap Maestro JVM heap — without this the ergonomic default is 25% of host
    // RAM (8 GB on a 32 GB machine), making two concurrent shards consume 16 GB.
    scriptLines.push('export JAVA_TOOL_OPTIONS="${JAVA_TOOL_OPTIONS:+${JAVA_TOOL_OPTIONS} }-Xmx512m"');

    // Give the Maestro driver 4 minutes to start on the device.  The default is
    // much shorter and causes premature TcpForwarder.waitFor TimeoutException on
    // the first test of each suite shard when both shards race to initialize.
    scriptLines.push('export MAESTRO_DRIVER_STARTUP_TIMEOUT=${MAESTRO_DRIVER_STARTUP_TIMEOUT:-240000}');

    files.forEach((f, fi) => {
      const absPath = path.resolve(PROJECT_ROOT, f);
      // Flows after the first skip the app-install check (already done) and
      // reset the stagger delay so only the first flow sleeps.
      const skipSetup = fi > 0 ? '--skip-setup' : '';
      if (fi > 0) scriptLines.push('export SHARD_START_DELAY=0');
      // Brief cooldown between sequential tests so the previous Maestro JVM
      // process fully releases its gRPC/ADB session before the next one starts.
      if (fi > 0) scriptLines.push('sleep 3');
      scriptLines.push(`echo "=== Shard ${i}: ${path.basename(f)} ==="`);
      scriptLines.push(`bash scripts/testing/test.sh "${absPath}" ${baseFlags} ${skipSetup} ${extraFlagsStr}`.replace(/\s+/g, ' ').trim());
    });

    const shardFile = path.join(shardDir, `shard-${i}-${timestamp}.sh`);
    fs.writeFileSync(shardFile, scriptLines.join('\n') + '\n', 'utf-8');
    fs.chmodSync(shardFile, 0o755);

    const jobId = randomUUID();
    const clients = new Set();
    const output = [];

    const cmdStr = `bash "${shardFile}"`;

    // ANDROID_SERIAL tells every bare `adb` call (no -s flag) which device to target.
    // Without it, adb fails silently with "error: more than one device" when multiple
    // emulators are running, causing check_and_install_android_app to think the app
    // isn't installed even when it is.
    const shardEnv = {
      ...process.env,
      FORCE_COLOR: '1',
      APP_ID: appId,
      MAESTRO_SHARD: '1',
      SHARD_INDEX: String(i),
      // Stagger shard starts so each shard's Maestro driver has time to establish
      // its gRPC session before the next shard starts competing for ADB/server resources.
      SHARD_START_DELAY: String(i * 8),
      ...(platform === 'android' ? { ANDROID_SERIAL: deviceIds[i] } : {})
    };

    const proc = spawn(cmdStr, [], { cwd: PROJECT_ROOT, shell: true, env: shardEnv });
    const job = { proc, clients, output, status: 'running', exitCode: null };
    jobs.set(jobId, job);

    (function(jid, sf) {
      function broadcast(type, data) {
        const line = JSON.stringify({ type, data });
        output.push(line);
        for (const client of clients) client.write(`data: ${line}\n\n`);
      }
      proc.stdout.on('data', chunk => broadcast('stdout', chunk.toString()));
      proc.stderr.on('data', chunk => broadcast('stderr', chunk.toString()));
      proc.on('close', code => {
        job.status = 'done';
        job.exitCode = code;
        broadcast('exit', { code });
        for (const client of clients) {
          client.write(`data: ${JSON.stringify({ type: 'done', data: { code } })}\n\n`);
          client.end();
        }
        try { fs.unlinkSync(sf); } catch (_) {}
        setTimeout(() => jobs.delete(jid), 30 * 60 * 1000);
      });
      proc.on('error', err => { broadcast('error', err.message); job.status = 'done'; });
    })(jobId, shardFile);

    shards.push({ jobId, deviceId: deviceIds[i], fileCount: files.length, index: i });
  }

  res.json({ shards });
});

app.post('/api/kill-sharded', (req, res) => {
  const { jobIds = [] } = req.body || {};
  for (const jobId of jobIds) {
    const job = jobs.get(jobId);
    if (!job) continue;
    try { process.kill(-job.proc.pid, 'SIGTERM'); } catch (_) {
      try { job.proc.kill('SIGTERM'); } catch (_2) {}
    }
  }
  res.json({ ok: true });
});

startServer();
