// ── Terminal helpers ──────────────────────────────────────────────────────────
const term = document.getElementById('terminal');

// ── Step duration tracking ───────────────────────────────────────────────────
// Detects recognizable step markers in terminal output and tracks elapsed time.
const STEP_PATTERNS = [
  // test.sh step banners
  { re: /Maestro Test Runner/,                label: 'Maestro Test Runner' },
  { re: /Setting up (ios|android) device/i,   label: 'Device Setup' },
  { re: /Clearing (iOS|Android) app state/i,  label: 'Clear App State' },
  { re: /Granting clipboard/i,                label: 'Grant Permissions' },
  { re: /Pre-launching app/i,                 label: 'App Pre-launch' },
  { re: /Verify App Installation/,            label: 'Verify App Install' },
  { re: /Step 3.*Running Tests/,              label: 'Running Tests' },
  { re: /Validating Maestro flow/i,           label: 'Path Validation' },
  { re: /Collecting CI\/CD metadata/i,        label: 'CI/CD Metadata' },
  { re: /Auto-preloading screen/i,            label: 'Screen Preload' },
  { re: /Starting Maestro test execution/i,   label: 'Maestro Execution' },
  { re: /Generating (HTML|unified) report/i,  label: 'Report Generation' },
  { re: /Network capture enabled/i,           label: 'Network Capture' },
  { re: /Extracting Network Calls/i,          label: 'Network Extraction' },
  { re: /Running performance tests/i,         label: 'Performance Tests' },
  // run-test-suite.sh markers
  { re: /Maestro Test Suite Runner/,          label: 'Suite Runner' },
  { re: /Parsing suite file/i,               label: 'Parse Suite' },
  { re: /Running tests\.\.\./,               label: 'Running Tests' },
  { re: /Test Summary/,                       label: 'Test Summary' },
  { re: /Generating HTML report/i,            label: 'Report Generation' },
  // suite per-test markers
  { re: /\[\d+\/\d+\]\s+(\S+)/,              label: null, dynamic: true },
  // reset-app-state.sh
  { re: /Resetting (iOS|Android) app state/i, label: 'Reset App State' },
  { re: /Disabling mobile data/i,             label: 'Disable Mobile Data' },
  { re: /Cleaning up old report/i,            label: 'Cleanup Old Reports' },
  { re: /Loading credentials/i,              label: 'Load Credentials' },
];

let _stepState = { startTime: null, label: null, headerEl: null };

function _stripAnsi(text) {
  return text.replace(/\x1b\[[0-9;]*m/g, '');
}

function _formatDuration(ms) {
  if (ms < 1000) return ms + 'ms';
  const s = ms / 1000;
  if (s < 60) return s.toFixed(1) + 's';
  const m = Math.floor(s / 60);
  const rem = Math.floor(s % 60);
  return m + 'm ' + rem + 's';
}

function _finalizeStep() {
  if (!_stepState.startTime || !_stepState.headerEl) return;
  const dur = Date.now() - _stepState.startTime;
  const badge = document.createElement('span');
  badge.className = 'step-duration-badge ' + (dur < 5000 ? 'fast' : dur < 30000 ? 'medium' : 'slow');
  badge.textContent = _formatDuration(dur);
  _stepState.headerEl.appendChild(badge);
  _stepState.startTime = null;
  _stepState.headerEl = null;
  _stepState.label = null;
}

function _detectStep(text) {
  const clean = _stripAnsi(text);
  for (const p of STEP_PATTERNS) {
    const m = clean.match(p.re);
    if (m) {
      let label = p.label;
      if (p.dynamic && m[1]) label = 'Test: ' + m[1];
      if (!label) continue;
      return label;
    }
  }
  return null;
}

// ANSI escape code → HTML converter
const ANSI_COLORS = {
  30: '#1e1e1e', 31: '#e06c75', 32: '#98c379', 33: '#e5c07b',
  34: '#61afef', 35: '#c678dd', 36: '#56b6c2', 37: '#abb2bf',
  90: '#5c6370', 91: '#e06c75', 92: '#98c379', 93: '#e5c07b',
  94: '#61afef', 95: '#c678dd', 96: '#56b6c2', 97: '#ffffff'
};
function ansiToHtml(text) {
  // Escape HTML entities first
  let html = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // Replace ANSI sequences with spans
  let open = false;
  html = html.replace(/\x1b\[([0-9;]*)m/g, (_match, codes) => {
    const parts = codes ? codes.split(';').map(Number) : [0];
    let prefix = open ? '</span>' : '';
    open = false;
    // Reset
    if (parts.includes(0) && parts.length === 1) return prefix;
    let color = '', bold = false;
    for (const c of parts) {
      if (c === 0) { color = ''; bold = false; }
      else if (c === 1) bold = true;
      else if (ANSI_COLORS[c]) color = ANSI_COLORS[c];
    }
    if (color || bold) {
      let style = '';
      if (color) style += 'color:' + color + ';';
      if (bold) style += 'font-weight:700;';
      open = true;
      return prefix + '<span style="' + style + '">';
    }
    return prefix;
  });
  if (open) html += '</span>';
  return html;
}
function hasAnsi(text) { return /\x1b\[/.test(text); }

function appendLines(cls, data) {
  data.split('\n').forEach((line, i, arr) => {
    if (i === arr.length - 1 && line === '') return;
    appendLine(cls, line);
  });
}

function appendLine(cls, text) {
  // Detect step boundaries and inject duration-tracked headers
  const stepLabel = (cls === 'stdout' || cls === 'stderr') ? _detectStep(text) : null;
  if (stepLabel && stepLabel !== _stepState.label) {
    _finalizeStep();
    const hdr = document.createElement('div');
    hdr.className = 'line-step-header';
    const labelSpan = document.createElement('span');
    labelSpan.textContent = '▸ ' + stepLabel;
    hdr.appendChild(labelSpan);
    term.appendChild(hdr);
    _stepState = { startTime: Date.now(), label: stepLabel, headerEl: hdr };
  }

  const div = document.createElement('div');
  div.className = 'line-' + cls;
  if (hasAnsi(text)) {
    div.innerHTML = ansiToHtml(text);
  } else {
    div.textContent = text;
  }
  term.appendChild(div);
  term.scrollTop = term.scrollHeight;
}

function clearTerm() {
  term.innerHTML = '';
  _stepState = { startTime: null, label: null, headerEl: null };
}

function setStatus(type, label) {
  const el = document.getElementById('term-status');
  el.className = 'term-status ' + type;
  const icons = { idle: '', running: '⟳ ', success: '✓ ', error: '✗ ' };
  el.textContent = (icons[type] || '') + label;
  document.getElementById('term-title').textContent = type === 'idle' ? 'Terminal Output' : label;
}
