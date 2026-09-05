// ── Test Data tab ─────────────────────────────────────────────────────────────
//
// Runs scripts/utils/api/test-data-runner.js in the terminal drawer (via the
// existing runCmd() pipeline), then swaps the report iframe (in
// #testdata-panel, a panel-right sibling of #report-panel) to the latest
// generated report. The runner writes to
// artifacts/api/tests/test-data-report-<iso>/; server serves that path via
// express.static('/artifacts').
const testDataState = { app: 'both' };

function setTestDataApp(app) {
  testDataState.app = app;
  document.querySelectorAll('[data-group="testdata-app"]').forEach(el => {
    el.classList.toggle('active', el.dataset.val === app);
  });
  updateTestDataCmdPreview();
}

function buildTestDataCmd() {
  return `node scripts/utils/api/test-data-runner.js `
       + `--app ${testDataState.app} --parallel --parallel-delay 1000`;
}

function updateTestDataCmdPreview() {
  const el = document.getElementById('testdata-cmd-preview');
  if (el) el.textContent = '$ ' + buildTestDataCmd();
}

function runTestData() {
  const cmd = buildTestDataCmd();
  runCmd(cmd, `Test Data — ${testDataState.app.toUpperCase()}`);
  schedulePostRunRefresh();
}

async function refreshTestDataReport() {
  try {
    const res = await fetch('/api/test-data/latest-report');
    const data = await res.json();
    const frame = document.getElementById('testdata-report-frame');
    const label = document.getElementById('testdata-report-label');
    if (!frame || !label) return;
    if (data.url) {
      // Cache-bust so a freshly-written report is picked up.
      frame.src = data.url + '?t=' + Date.now();
      label.textContent = data.name;
    } else {
      frame.src = 'about:blank';
      label.textContent = 'No report yet — run to generate one';
    }
  } catch (e) {
    console.error('Failed to load latest test-data report', e);
  }
}

// Poll every 2s (up to 5 min) after a run kicks off, swap iframe when the
// latest-report label changes (indicating the runner wrote a new directory).
function schedulePostRunRefresh() {
  const labelEl = document.getElementById('testdata-report-label');
  if (!labelEl) return;
  const before = labelEl.textContent;
  let elapsed = 0;
  const iv = setInterval(async () => {
    elapsed += 2000;
    await refreshTestDataReport();
    if (labelEl.textContent !== before || elapsed >= 300000) clearInterval(iv);
  }, 2000);
}

// Auto-load on first activation of the Test Data tab (and set command preview).
document.querySelector('[data-tab="testdata"]').addEventListener('click', () => {
  updateTestDataCmdPreview();
  const frame = document.getElementById('testdata-report-frame');
  if (frame && (frame.src === 'about:blank' || frame.src.endsWith('about:blank'))) {
    refreshTestDataReport();
  }
});

