#!/usr/bin/env node
/**
 * Extract real performance timing from the Maestro debug log.
 *
 * Every command emits RUNNING / COMPLETED events with millisecond timestamps.
 * This script derives:
 *   - App launch time  (launchApp RUNNING → COMPLETED)
 *   - Per-subflow duration (screen load proxies)
 *   - Slow individual commands (>2 s)
 *   - Overall test duration
 *
 * Output: <outputDir>/perf-log-data.json
 *
 * Usage:
 *   node perf-extract-from-log.js <maestroLogPath> <outputDir>
 */

const fs   = require('fs');
const path = require('path');

const logPath   = process.argv[2];
const outputDir = process.argv[3] || '.';

if (!logPath || !fs.existsSync(logPath)) {
  process.stderr.write(`Log not found: ${logPath}\n`);
  process.exit(1);
}

fs.mkdirSync(outputDir, { recursive: true });

// ─── Parse HH:MM:SS.mmm → ms-from-midnight ────────────────────────────────
function parseTs(line) {
  const m = line.match(/^(\d{2}):(\d{2}):(\d{2})\.(\d{3})/);
  if (!m) return null;
  return +m[1] * 3600000 + +m[2] * 60000 + +m[3] * 1000 + +m[4];
}

const RUNNING_RE   = /runCommands\$lambda\$0:\s+(.+?)\s+RUNNING/;
const COMPLETED_RE = /runCommands\$lambda\$2:\s+(.+?)\s+COMPLETED/;
const SUBFLOW_RE   = /Run (.+\.yaml)/;

const lines  = fs.readFileSync(logPath, 'utf8').split('\n');
const events = [];

for (const line of lines) {
  const ts = parseTs(line);
  if (ts === null) continue;

  const rm = RUNNING_RE.exec(line);
  if (rm) {
    const cmd     = rm[1].trim();
    const sfMatch = SUBFLOW_RE.exec(cmd);
    events.push({ ts, type: 'start', cmd, subflow: sfMatch ? path.basename(sfMatch[1], '.yaml') : null });
    continue;
  }
  const cm = COMPLETED_RE.exec(line);
  if (cm) {
    const cmd     = cm[1].trim();
    const sfMatch = SUBFLOW_RE.exec(cmd);
    events.push({ ts, type: 'end', cmd, subflow: sfMatch ? path.basename(sfMatch[1], '.yaml') : null });
  }
}

if (events.length === 0) {
  process.stdout.write('ℹ️  No timing events in log\n');
  process.exit(0);
}

// ─── App launch time ───────────────────────────────────────────────────────
const launchStart = events.find(e => e.type === 'start' && /launchApp/i.test(e.cmd));
const launchEnd   = events.find(e => e.type === 'end'   && /launchApp/i.test(e.cmd));
const launchTimeMs = launchStart && launchEnd ? launchEnd.ts - launchStart.ts : null;

// ─── Per-subflow (screen) durations ────────────────────────────────────────
const sfStack    = [];   // { name, ts }
const sfTimings  = [];   // { name, durationMs, startTs }

for (const ev of events) {
  if (ev.type === 'start' && ev.subflow) {
    sfStack.push({ name: ev.subflow, ts: ev.ts });
  } else if (ev.type === 'end' && ev.subflow) {
    const i = sfStack.map(x => x.name).lastIndexOf(ev.subflow);
    if (i >= 0) {
      const { name, ts: startTs } = sfStack.splice(i, 1)[0];
      sfTimings.push({ name, durationMs: ev.ts - startTs, startTs });
    }
  }
}

// ─── Slow individual commands (non-subflow, >2 s) ─────────────────────────
const SLOW_MS   = 2000;
const cmdStack  = [];   // { cmd, ts }
const slowCmds  = [];

for (const ev of events) {
  if (ev.type === 'start') {
    cmdStack.push({ cmd: ev.cmd, ts: ev.ts });
  } else if (ev.type === 'end') {
    // Match by normalized command prefix (strip trailing bits)
    const normEnd = ev.cmd.split(/\s+Run\s+/)[0].trim().toLowerCase();
    const idx = cmdStack.map(x => x.cmd.split(/\s+Run\s+/)[0].trim().toLowerCase())
                        .lastIndexOf(normEnd);
    if (idx >= 0) {
      const { cmd, ts: startTs } = cmdStack.splice(idx, 1)[0];
      const dur = ev.ts - startTs;
      if (dur >= SLOW_MS && !cmd.includes('.yaml')) {
        slowCmds.push({ command: cmd, durationMs: dur });
      }
    }
  }
}

// ─── Overall timing ────────────────────────────────────────────────────────
const totalDurationMs = events[events.length - 1].ts - events[0].ts;

// Unique screens (first occurrence of each subflow name)
const seen    = new Set();
const screens = sfTimings.filter(x => !seen.has(x.name) && seen.add(x.name));

const result = {
  timestamp:     new Date().toISOString(),
  launchTimeMs,
  totalDurationMs,
  screens,
  allSubflows:   sfTimings,
  slowCommands:  slowCmds.sort((a, b) => b.durationMs - a.durationMs).slice(0, 15),
  stats: {
    screenCount:         screens.length,
    avgScreenDurationMs: screens.length ? Math.round(screens.reduce((s, x) => s + x.durationMs, 0) / screens.length) : 0,
    maxScreenDurationMs: screens.length ? Math.max(...screens.map(x => x.durationMs)) : 0,
    slowCommandCount:    slowCmds.length,
  }
};

const outPath = path.join(outputDir, 'perf-log-data.json');
fs.writeFileSync(outPath, JSON.stringify(result, null, 2));

process.stdout.write(`✅ Timing extracted:\n`);
process.stdout.write(`   Launch time:    ${launchTimeMs != null ? launchTimeMs + ' ms' : 'N/A'}\n`);
process.stdout.write(`   Total duration: ${totalDurationMs} ms\n`);
process.stdout.write(`   Screens:        ${screens.length}\n`);
process.stdout.write(`   Slow commands:  ${slowCmds.length}\n`);
