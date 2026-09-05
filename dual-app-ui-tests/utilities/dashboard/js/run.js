// ── State ──────────────────────────────────────────────────────────────────────
const state = {
  platform: 'ios',
  app: 'cvspharmacy',
  buildconfig: 'debug',
  testmode: 'suite',
  device: '',
  flags: new Set(),
  currentJobId: null,
  currentEs: null,
  shardCount: 1,
  shardJobIds: [],
  shardEventSources: []
};

// ── Radio groups ──────────────────────────────────────────────────────────────
document.querySelectorAll('.radio-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const group = btn.dataset.group;
    document.querySelectorAll(`.radio-btn[data-group="${group}"]`).forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state[group] = btn.dataset.val;
    if (group === 'testmode') updateTestModeUI();
    if (group === 'platform') {
      state.device = '';
      document.getElementById('device-select').value = '';
      updateBothPlatformUI();
      debouncedRefreshDeviceList();
      updateCheckboxVisibility();
      updateFlagChipVisibility();
    }
    if (group === 'app') filterSuitesByApp();
    updatePreview();
  });
});

// ── Shard controls ───────────────────────────────────────────────────────────
document.querySelectorAll('#shard-count-group .radio-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#shard-count-group .radio-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.shardCount = parseInt(btn.dataset.shard) || 1;
    const shardDevSec = document.getElementById('shard-devices-section');
    const btnRun = document.getElementById('btn-run-test');
    const btnSharded = document.getElementById('btn-run-sharded');
    if (state.shardCount > 1) {
      if (shardDevSec) shardDevSec.style.display = '';
      if (btnRun) btnRun.style.display = 'none';
      if (btnSharded) { btnSharded.style.display = ''; btnSharded.textContent = `▶ Run Sharded (${state.shardCount}×)`; }
      refreshShardDevices();
    } else {
      if (shardDevSec) shardDevSec.style.display = 'none';
      if (btnRun) btnRun.style.display = '';
      if (btnSharded) btnSharded.style.display = 'none';
    }
    updatePreview();
  });
});

async function refreshShardDevices() {
  const platform = state.platform || 'ios';
  const list = document.getElementById('shard-device-list');
  if (!list) return;
  list.innerHTML = '<div class="text-dim text-sm" style="text-align:center;padding:8px">Loading…</div>';
  try {
    const res = await fetch(`/api/devices?platform=${platform}`);
    const data = await res.json();
    const devices = data.devices || [];
    if (!devices.length) {
      list.innerHTML = '<div class="text-dim text-sm" style="text-align:center;padding:8px">No devices found</div>';
      return;
    }
    list.innerHTML = devices.map((d, i) => `
      <div class="shard-device-item">
        <input type="checkbox" id="shard-dev-${i}" value="${escHtml(d.id)}" ${i < state.shardCount ? 'checked' : ''} onchange="validateShardDevices()" />
        <label for="shard-dev-${i}">${escHtml(d.name || d.id)}</label>
        <span class="device-badge">${d.apiLevel ? 'API ' + escHtml(d.apiLevel) : escHtml(d.state || '')}</span>
      </div>`).join('');
    validateShardDevices();
  } catch (e) {
    list.innerHTML = `<div style="color:var(--cvs-red);font-size:11px">Error: ${escHtml(e.message)}</div>`;
  }
}

function getSelectedShardDevices() {
  return [...document.querySelectorAll('#shard-device-list input[type=checkbox]:checked')].map(cb => cb.value);
}

function validateShardDevices() {
  const selected = getSelectedShardDevices();
  const warn = document.getElementById('shard-device-warning');
  const btnSharded = document.getElementById('btn-run-sharded');
  if (!warn) return;
  if (selected.length < state.shardCount) {
    warn.style.display = '';
    warn.textContent = `Select ${state.shardCount} device${state.shardCount > 1 ? 's' : ''} (${selected.length}/${state.shardCount} selected)`;
    if (btnSharded) btnSharded.disabled = true;
  } else if (selected.length > state.shardCount) {
    warn.style.display = '';
    warn.textContent = `${selected.length} selected — only first ${state.shardCount} will be used`;
    if (btnSharded) btnSharded.disabled = false;
  } else {
    warn.style.display = 'none';
    if (btnSharded) btnSharded.disabled = false;
  }
  updatePreview();
}

function switchShardTab(index) {
  document.querySelectorAll('.shard-tab').forEach((t, i) => t.classList.toggle('active', i === index));
  document.querySelectorAll('.shard-output').forEach((o, i) => o.classList.toggle('active', i === index));
}

function appendShardLine(outputEl, type, text) {
  const lines = text.split('\n');
  for (const line of lines) {
    if (!line && lines.length > 1) continue;
    const span = document.createElement('span');
    span.className = `shard-line-${type}`;
    span.textContent = line + '\n';
    outputEl.appendChild(span);
  }
  outputEl.scrollTop = outputEl.scrollHeight;
}

function updateShardSummary() {
  const tabs = document.querySelectorAll('.shard-tab');
  let running = 0, passed = 0, failed = 0;
  tabs.forEach(t => {
    if (t.classList.contains('running')) running++;
    else if (t.classList.contains('done-ok')) passed++;
    else if (t.classList.contains('done-err')) failed++;
  });
  const el = document.getElementById('shard-run-summary');
  if (!el) return;
  const parts = [];
  if (running) parts.push(`${running} running`);
  if (passed) parts.push(`${passed} passed`);
  if (failed) parts.push(`${failed} failed`);
  el.textContent = parts.join(' · ') || 'Complete';
  if (!running) {
    const killBtn = document.getElementById('btn-kill-sharded');
    if (killBtn) killBtn.style.display = 'none';
  }
}

async function runSharded() {
  const buildResult = buildTestCommand();
  if (!buildResult) return alert('Please select a test target first.');

  const deviceIds = getSelectedShardDevices().slice(0, state.shardCount);
  if (deviceIds.length < state.shardCount) {
    return alert(`Please select ${state.shardCount} device${state.shardCount > 1 ? 's' : ''} for sharding.`);
  }

  // Collect flow files from the selected target
  let flowFiles = [];
  try {
    if (state.testmode === 'flow') {
      const folder = document.getElementById('flow-folder-select')?.value;
      if (folder) {
        const res = await fetch(`/api/flows-in-folder?folder=${encodeURIComponent(folder)}`);
        flowFiles = await res.json();
      } else {
        const f = document.getElementById('flow-select')?.value;
        if (f) flowFiles = [f];
      }
    } else {
      // Suite / custom: run the same target on each device in parallel
      flowFiles = [buildResult.target];
    }
  } catch (e) {
    return alert('Failed to load flow files: ' + e.message);
  }

  if (!flowFiles.length) return alert('No flow files found for the selected target.');

  // When fewer files than shards (e.g. single suite), duplicate so every device runs
  while (flowFiles.length < deviceIds.length) flowFiles = [...flowFiles, ...flowFiles];
  flowFiles = flowFiles.slice(0, Math.max(flowFiles.length, deviceIds.length));

  // Close any existing shard streams
  for (const es of state.shardEventSources) { try { es.close(); } catch (_) {} }
  state.shardEventSources = [];
  state.shardJobIds = [];

  // Show panel in "starting" state (no tabs yet — built after server responds)
  const panel = document.getElementById('shard-output-panel');
  const tabBar = document.getElementById('shard-tab-bar');
  const container = document.getElementById('shard-output-container');
  if (!panel || !tabBar || !container) return;
  tabBar.innerHTML = '';
  container.innerHTML = '';
  panel.style.display = '';
  document.getElementById('btn-kill-sharded').style.display = '';
  document.getElementById('shard-run-summary').textContent = 'Starting…';

  // Fire the sharded run request
  let shards;
  try {
    const res = await fetch('/api/run-sharded', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        flowFiles,
        deviceIds,
        appId: buildResult.appId,
        platform: state.platform,
        buildConfig: state.buildconfig,
        extraFlags: buildResult.flagParts.filter(f => !f.startsWith('--platform') && !f.startsWith('--device'))
      })
    });
    const data = await res.json();
    if (data.error) return alert('Sharded run error: ' + data.error);
    shards = data.shards;
  } catch (e) {
    return alert('Failed to start sharded run: ' + e.message);
  }

  if (!shards || !shards.length) {
    panel.style.display = 'none';
    return alert('No shards were created. Check your device selection and test target.');
  }

  // Build tabs and output panels based on the ACTUAL shards returned (not state.shardCount)
  for (let i = 0; i < shards.length; i++) {
    const shard = shards[i];
    const tab = document.createElement('div');
    tab.className = 'shard-tab running';
    const shortDevice = shard.deviceId.length > 20 ? shard.deviceId.slice(-12) : shard.deviceId;
    tab.innerHTML = `<span class="shard-dot"></span>Shard ${i + 1} <span style="color:var(--text-muted);margin-left:4px;font-size:10px">${escHtml(shortDevice)}</span>`;
    tab.onclick = ((idx) => () => switchShardTab(idx))(i);
    tabBar.appendChild(tab);

    const out = document.createElement('div');
    out.className = 'shard-output' + (i === 0 ? ' active' : '');
    container.appendChild(out);
  }

  // Subscribe to each shard's SSE stream using sequential indices (not shard.index)
  const outputs = [...container.querySelectorAll('.shard-output')];
  const tabs    = [...tabBar.querySelectorAll('.shard-tab')];

  shards.forEach((shard, i) => {
    const outEl = outputs[i];
    const tabEl = tabs[i];
    state.shardJobIds.push(shard.jobId);

    appendShardLine(outEl, 'stdout', `$ Shard ${i + 1}: ${shard.fileCount} flow${shard.fileCount !== 1 ? 's' : ''} on ${shard.deviceId}\n`);

    const es = new EventSource(`/api/stream/${shard.jobId}`);
    state.shardEventSources.push(es);

    es.onmessage = (evt) => {
      const msg = JSON.parse(evt.data);
      if (msg.type === 'stdout') appendShardLine(outEl, 'stdout', msg.data);
      else if (msg.type === 'stderr') appendShardLine(outEl, 'stderr', msg.data);
      else if (msg.type === 'error') appendShardLine(outEl, 'error', msg.data);
      else if (msg.type === 'done' || msg.type === 'exit') {
        const code = msg.data?.code;
        if (code === 0 || code === null) {
          appendShardLine(outEl, 'success', `\n✓ Shard ${i + 1} complete (exit 0)`);
          tabEl.className = 'shard-tab done-ok';
        } else {
          appendShardLine(outEl, 'error', `\n✗ Shard ${i + 1} failed (exit ${code})`);
          tabEl.className = 'shard-tab done-err';
        }
        updateShardSummary();
        es.close();
      }
    };
    es.onerror = () => {
      appendShardLine(outEl, 'error', '\n[stream disconnected]');
      tabEl.className = 'shard-tab done-err';
      updateShardSummary();
    };
  });

  updateShardSummary();
  switchShardTab(0);
}

async function killAllShards() {
  if (!state.shardJobIds.length) return;
  for (const es of state.shardEventSources) { try { es.close(); } catch (_) {} }
  state.shardEventSources = [];
  try {
    await fetch('/api/kill-sharded', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jobIds: state.shardJobIds })
    });
  } catch (_) {}
  state.shardJobIds = [];
  document.getElementById('btn-kill-sharded').style.display = 'none';
  document.getElementById('shard-run-summary').textContent = 'Stopped';
  document.querySelectorAll('.shard-tab.running').forEach(t => t.className = 'shard-tab done-err');
}

// ── Device selection ───────────────────────────────────────────────────────────
const deviceSelect = document.getElementById('device-select');
if (deviceSelect) {
  deviceSelect.addEventListener('change', () => {
    state.device = deviceSelect.value;
    const selectedText = deviceSelect.options[deviceSelect.selectedIndex]?.text || '';
    console.log('[device-select] Changed to:', state.device, 'Label:', selectedText);
    updatePreview();
  });
}

// Device list caching and debouncing
const deviceCache = new Map();
let deviceRefreshTimeout = null;

async function refreshDeviceList() {
  const platform = state.platform || 'ios';
  const select = document.getElementById('device-select');
  if (!select) return;

  // "Both" mode: wrapper auto-detects one device per platform; no dropdown needed.
  if (platform === 'both') {
    select.innerHTML = '<option value="">— Auto (both platforms) —</option>';
    return;
  }

  // Check cache first (cache for 10 seconds)
  const cacheKey = `devices_${platform}`;
  const cached = deviceCache.get(cacheKey);
  const now = Date.now();
  
  if (cached && (now - cached.timestamp) < 10000) {
    renderDeviceList(select, cached.data);
    return;
  }
  
  // Show loading state
  select.innerHTML = '<option value="">— Loading devices... —</option>';
  
  try {
    const res = await fetch(`/api/devices?platform=${platform}`);
    const data = await res.json();
    
    console.log(`Devices for ${platform}:`, data);
    
    // Cache the result
    deviceCache.set(cacheKey, {
      data: data,
      timestamp: now
    });
    
    renderDeviceList(select, data);
  } catch (e) {
    console.error('Failed to load devices:', e);
    select.innerHTML = '<option value="">— Error loading devices —</option>';
  }
}

function renderDeviceList(select, data) {
  // Use DocumentFragment for better performance
  const fragment = document.createDocumentFragment();
  
  // Add default option
  const defaultOption = document.createElement('option');
  defaultOption.value = '';
  defaultOption.textContent = '— Select device —';
  fragment.appendChild(defaultOption);
  
  if (data.devices && data.devices.length > 0) {
    data.devices.forEach(device => {
      const opt = document.createElement('option');
      opt.value = device.id;
      let label = device.name;
      if (device.apiLevel) {
        label += ` API ${device.apiLevel}`;
      }
      label += ` (${device.state})`;
      opt.textContent = label;
      fragment.appendChild(opt);
    });
  } else {
    const msg = data.error ? `— Error: ${data.error} —` : '— No devices available —';
    const errorOption = document.createElement('option');
    errorOption.value = '';
    errorOption.textContent = msg;
    fragment.appendChild(errorOption);
  }
  
  // Single DOM update
  select.innerHTML = '';
  select.appendChild(fragment);
}

// Debounced device refresh
function debouncedRefreshDeviceList() {
  if (deviceRefreshTimeout) {
    clearTimeout(deviceRefreshTimeout);
  }
  deviceRefreshTimeout = setTimeout(refreshDeviceList, 300);
}

// When platform=="both", disable the device dropdown — the wrapper
// auto-detects one device per platform, so a manual choice is meaningless.
// All test modes (suite/flow/custom) are supported.
function updateBothPlatformUI() {
  const isBoth = state.platform === 'both';
  const deviceSel = document.getElementById('device-select');
  if (deviceSel) {
    deviceSel.disabled = isBoth;
    deviceSel.title = isBoth ? 'In "Both" mode, devices are auto-detected per platform' : '';
  }
}

function updateTestModeUI() {
  document.getElementById('suite-picker').style.display = state.testmode === 'suite' ? '' : 'none';
  document.getElementById('flow-picker').style.display  = state.testmode === 'flow'   ? '' : 'none';
  document.getElementById('custom-picker').style.display = state.testmode === 'custom' ? '' : 'none';
  if (state.testmode === 'flow') loadFlowFolders();

  // Sharding is only available for suite/custom modes — hide and reset when flow is selected
  const shardSection = document.getElementById('shard-section');
  if (shardSection) {
    if (state.testmode === 'flow') {
      shardSection.style.display = 'none';
      // Reset shard count to 1 so state stays clean
      state.shardCount = 1;
      document.querySelectorAll('#shard-count-group .radio-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.shard === '1');
      });
      const shardDevSec = document.getElementById('shard-devices-section');
      if (shardDevSec) shardDevSec.style.display = 'none';
      const btnSharded = document.getElementById('btn-run-sharded');
      if (btnSharded) btnSharded.style.display = 'none';
    } else {
      shardSection.style.display = '';
    }
  }

  updateCheckboxVisibility();
}

function updateCheckboxVisibility() {
  const containers = document.querySelectorAll('.checkbox-container');
  
  containers.forEach(container => {
    const context = container.dataset.context;
    let shouldShow = false;
    
    switch (context) {
      case 'single-test':
        // Show for flow, custom, and suite modes
        shouldShow = state.testmode === 'flow' || state.testmode === 'custom' || state.testmode === 'suite';
        break;
      case 'suite-only':
        // Show only for suite mode
        shouldShow = state.testmode === 'suite';
        break;
      case 'ios-only':
        // Show only when iOS is selected
        shouldShow = state.platform === 'ios';
        break;
      default:
        shouldShow = true;
    }
    
    if (shouldShow) {
      container.classList.remove('hidden');
    } else {
      container.classList.add('hidden');
      // Also uncheck the checkbox when hiding to avoid confusion
      const checkbox = container.querySelector('input[type="checkbox"]');
      if (checkbox) checkbox.checked = false;
    }
  });
}

// Hide/show flag chips that only apply to one platform (currently just the
// Android-only "Firebase Latest" chip). Deactivates the chip when hidden so
// its flag can't linger in state.flags after switching platforms.
function updateFlagChipVisibility() {
  document.querySelectorAll('#flag-chips .chip[data-android-only]').forEach(chip => {
    const show = state.platform === 'android';
    chip.style.display = show ? '' : 'none';
    if (!show && chip.classList.contains('active')) {
      chip.classList.remove('active');
      state.flags.delete(chip.dataset.flag);
    }
  });
}


// ── Flag chips ────────────────────────────────────────────────────────────────
updateFlagChipVisibility();
document.querySelectorAll('#flag-chips .chip').forEach(chip => {
  chip.addEventListener('click', () => {
    chip.classList.toggle('active');
    const flag = chip.dataset.flag;
    if (chip.classList.contains('active')) state.flags.add(flag);
    else state.flags.delete(flag);
    updatePreview();
  });
});

// ── Flow folder two-level picker ─────────────────────────────────────────────
let _foldersLoaded = false;
async function loadFlowFolders(force = false) {
  if (_foldersLoaded && !force) return;
  try {
    const folders = await fetch('/api/flow-folders').then(r => r.json());
    const sel = document.getElementById('flow-folder-select');
    sel.innerHTML = '<option value="">— Select folder —</option>' +
      folders.map(f => `<option value="${f}">${f}</option>`).join('');
    _foldersLoaded = true;
  } catch (e) { console.error('Failed to load flow folders:', e); }
}

// ── Refresh flows (force reload folders + flows) ─────────────────────────────
async function refreshFlows() {
  _foldersLoaded = false;
  await loadFlowFolders(true);
  // Reset flow select since folders were reloaded
  const flowSel = document.getElementById('flow-select');
  if (flowSel) flowSel.innerHTML = '<option value="">— Select a folder first —</option>';
  updatePreview();
}

// ── Refresh suites ───────────────────────────────────────────────────────────
async function refreshSuites() {
  try {
    const res = await fetch('/api/suites');
    _allSuites = await res.json();
    filterSuitesByApp();
  } catch (e) {
    console.error('Failed to refresh suites:', e);
  }
}

// ── Slack notify checkbox: persist state across sessions ──────────────────────
(function initSlackNotifyToggle() {
  const attach = () => {
    const cb = document.getElementById('suite-slack-notify');
    if (!cb) return;
    cb.checked = localStorage.getItem('dashboard.suiteSlackNotify') === 'true';
    cb.addEventListener('change', () => {
      localStorage.setItem('dashboard.suiteSlackNotify', cb.checked);
      updatePreview();
    });
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attach);
  } else {
    attach();
  }
})();

// ── Zephyr execution checkbox: persist state across sessions ─────────────────
(function initZephyrExecutionToggle() {
  const attach = () => {
    const cb = document.getElementById('suite-zephyr-execution');
    if (!cb) return;
    cb.checked = localStorage.getItem('dashboard.suiteZephyrExecution') === 'true';
    cb.addEventListener('change', () => {
      localStorage.setItem('dashboard.suiteZephyrExecution', cb.checked);
      updatePreview();
    });
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attach);
  } else {
    attach();
  }
})();

async function loadFlowsInFolder() {
  const folder = document.getElementById('flow-folder-select').value;
  const sel = document.getElementById('flow-select');
  if (!folder) {
    sel.innerHTML = '<option value="">— Select a folder first —</option>';
    updatePreview(); return;
  }
  sel.innerHTML = '<option value="">— Loading... —</option>';
  try {
    const flows = await fetch(`/api/flows-in-folder?folder=${encodeURIComponent(folder)}`).then(r => r.json());
    sel.innerHTML = '<option value="">— Select flow —</option>' +
      flows.map(f => `<option value="${f}">${f.split('/').pop()}</option>`).join('');
  } catch (e) {
    sel.innerHTML = '<option value="">— Error loading flows —</option>';
  }
  updatePreview();
}

// ── Load selects ──────────────────────────────────────────────────────────────
let _allSuites = []; // cached full suite list for filtering by app

function filterSuitesByApp() {
  const suiteEl = document.getElementById('suite-select');
  if (!suiteEl) return;

  // Map app radio values to the folder names used in suite paths
  const appFolderMap = { cvspharmacy: 'cvshealth', health100: 'health100' };
  const selectedFolder = appFolderMap[state.app] || 'cvshealth';

  // Filter suites: keep app-specific suites for the selected app + shared suites
  const filtered = _allSuites.filter(s => {
    // App-specific suite: .maestro/apps/<app>/suites/...
    if (s.includes('/apps/')) {
      return s.includes(`/apps/${selectedFolder}/`);
    }
    // Shared suites (e.g. .maestro/flows/suites/...) always shown
    return true;
  });

  suiteEl.innerHTML = '<option value="">— Select suite —</option>';
  if (filtered.length > 0) {
    filtered.forEach(s => {
      const o = document.createElement('option');
      o.value = s;
      o.textContent = s.replace('.maestro/', '').replace('/apps/', ' › ').replace('.yaml', '');
      suiteEl.appendChild(o);
    });
  } else {
    suiteEl.innerHTML = '<option value="">— No suites available —</option>';
  }
  updatePreview();
}

async function loadSelects() {
  try {
    console.log('Loading suites, flows, and devices...');
    
    const suitesRes = await fetch('/api/suites');
    _allSuites = await suitesRes.json();
    console.log('Suites loaded:', _allSuites.length);
    
    const flowsRes = await fetch('/api/flows');
    const flows = await flowsRes.json();
    console.log('Flows loaded:', flows.length);
    
    debouncedRefreshDeviceList();

    // Populate suites filtered by currently selected app
    filterSuitesByApp();

    const flowEl = document.getElementById('flow-select');
    if (!flowEl) {
      console.error('flow-select element not found');
      return;
    }
    
    flowEl.innerHTML = '<option value="">— Select flow —</option>';
    if (flows && flows.length > 0) {
      flows.forEach(f => {
        const o = document.createElement('option');
        o.value = f;
        o.textContent = f.replace('.maestro/flows/', '').replace('.yaml', '');
        flowEl.appendChild(o);
      });
      console.log('Populated', flows.length, 'flows');
    } else {
      console.warn('No flows returned from API');
      flowEl.innerHTML = '<option value="">— No flows available —</option>';
    }
  } catch (e) {
    console.error('Failed to load selects:', e);
    const suiteEl = document.getElementById('suite-select');
    if (suiteEl) suiteEl.innerHTML = '<option value="">— Error loading suites —</option>';
    const flowEl = document.getElementById('flow-select');
    if (flowEl) flowEl.innerHTML = '<option value="">— Error loading flows —</option>';
  }
  updatePreview();
}

const suiteSelect = document.getElementById('suite-select');
const flowSelect = document.getElementById('flow-select');
const customPath = document.getElementById('custom-path');
const flowFolderSelect = document.getElementById('flow-folder-select');

if (suiteSelect) suiteSelect.addEventListener('change', updatePreview);
if (flowSelect) flowSelect.addEventListener('change', updatePreview);
if (customPath) customPath.addEventListener('input', updatePreview);
if (flowFolderSelect) flowFolderSelect.addEventListener('change', updatePreview);

// ── Preview ───────────────────────────────────────────────────────────────────
function buildTestCommand() {
  const iosAppIds = { cvspharmacy: 'com.cvsenterpriseiphone.cvspharmacy', health100: 'com.health100.h100.app' };
  const androidAppIds = { cvspharmacy: 'com.cvs.launchers.cvs', health100: 'com.health100.launchers' };

  const appId = state.platform === 'ios' ? iosAppIds[state.app]
              : state.platform === 'android' ? androidAppIds[state.app]
              : null; // "both" — wrapper resolves per-platform from config.env

  let target = '';
  if (state.testmode === 'suite') target = document.getElementById('suite-select').value;
  else if (state.testmode === 'flow') target = document.getElementById('flow-select').value;
  else target = document.getElementById('custom-path').value.trim();

  if (!target) return null;

  // ── "Both platforms" path — use the parallel wrapper ──────────────────────
  // The wrapper dispatches per-target: suite paths route through
  // run-test-suite.sh, everything else through test.sh. Supported flags on the
  // wrapper are --skip-setup, --slack, --ios-device, --android-device.
  if (state.platform === 'both') {
    const envParts = [];
    if (state.buildconfig === 'release') envParts.push('BUILD_CONFIG=release');
    const flagParts = [];
    if (state.flags.has('--skip-setup')) flagParts.push('--skip-setup');
    // --slack is intentionally NOT propagated to the Both-platforms path.
    // The Suite-level Slack checkbox only applies to real single-platform
    // suite runs. See runTest() for the append condition.
    const parts = [
      ...envParts,
      'bash scripts/testing/run-both-platforms.sh',
      target,
      ...flagParts,
    ];
    return { envParts, target, flagParts, full: parts.join(' '), appId: null, isDualPlatform: true };
  }

  const envParts = [`APP_ID=${appId}`];
  if (state.buildconfig === 'release') envParts.push('BUILD_CONFIG=release');

  const flagParts = [...state.flags];
  if (state.platform === 'android') flagParts.push('--platform android');
  else if (state.platform === 'ios') flagParts.push('--platform ios');
  if (state.device) flagParts.push(`--device ${state.device}`);
  
  // Add skip validation flag if checkbox is checked
  const skipValidation = document.getElementById('skip-validation');
  if (skipValidation && skipValidation.checked) {
    flagParts.push('--skip-validation');
  }
  
  // Add skip prelaunch flag if checkbox is checked
  const skipPrelaunch = document.getElementById('skip-prelaunch');
  if (skipPrelaunch && skipPrelaunch.checked) {
    flagParts.push('--skip-prelaunch');
  }

  // Add adhoc parameters if adhoc test is selected
  const flowSelect = document.getElementById('flow-select');
  const isAdhoc = flowSelect && flowSelect.value && flowSelect.value.toLowerCase().includes('adhoc');
  if (isAdhoc) {
    const numActions = document.getElementById('num-actions');
    const tapWeight = document.getElementById('tap-weight');
    const swipeWeight = document.getElementById('swipe-weight');
    const backWeight = document.getElementById('back-weight');
    
    if (numActions && numActions.value) {
      flagParts.push(`--num-of-adhoc-actions ${numActions.value}`);
    }
    
    if (tapWeight && tapWeight.value) {
      envParts.push(`TAP_WEIGHT=${tapWeight.value}`);
    }
    if (swipeWeight && swipeWeight.value) {
      envParts.push(`SWIPE_WEIGHT=${swipeWeight.value}`);
    }
    if (backWeight && backWeight.value) {
      envParts.push(`BACK_WEIGHT=${backWeight.value}`);
    }
  }

  const parts = [
    ...envParts,
    'bash scripts/testing/test.sh',
    target,
    ...flagParts
  ];

  return { envParts, target, flagParts, full: parts.join(' '), appId };
}

function updatePreview() {
  const preview = document.getElementById('cmd-preview');
  const result = buildTestCommand();
  if (!result) { preview.textContent = '— Select a test target —'; return; }

  // Show/hide adhoc options based on selected test
  const adhocOptions = document.getElementById('adhoc-options');
  const flowSelectEl = document.getElementById('flow-select');
  const isAdhoc = flowSelectEl && flowSelectEl.value && flowSelectEl.value.toLowerCase().includes('adhoc');
  if (adhocOptions) adhocOptions.style.display = isAdhoc ? 'block' : 'none';

  if (state.shardCount > 1) {
    const devices = getSelectedShardDevices().slice(0, state.shardCount);
    const deviceList = devices.length
      ? devices.map(d => `<span class="preview-flag">${escHtml(d)}</span>`).join(', ')
      : '<span style="color:var(--term-stderr)">no devices selected</span>';
    const shardNote = state.testmode === 'flow'
      ? `<span style="color:var(--text-muted)"> (flows in folder split across ${state.shardCount} shards)</span>`
      : `<span style="color:var(--text-muted)"> (same target on each device)</span>`;
    const shardFlagParts = result.flagParts.filter(f => !f.startsWith('--device') && !f.startsWith('--platform'));
    preview.innerHTML =
      result.envParts.map(e => `<span class="preview-env">${escHtml(e)}</span>`).join(' ') +
      ` <span class="preview-cmd">bash scripts/testing/test.sh</span>` +
      ` <span class="preview-env">${escHtml(result.target)}</span>` +
      ` <span class="preview-flag">--device [${deviceList}]</span>` +
      ` <span class="preview-flag">--shards ${state.shardCount}</span>` +
      (shardFlagParts.length ? ' ' + shardFlagParts.map(f => `<span class="preview-flag">${escHtml(f)}</span>`).join(' ') : '') +
      shardNote;
    return;
  }

  const scriptLabel = result.isDualPlatform
    ? 'bash scripts/testing/run-both-platforms.sh'
    : 'bash scripts/testing/test.sh';

  // --slack / --add-zephyr-execution are only appended at run time for real
  // Suite-mode, single-platform runs (see runTest()). Mirror that here so the
  // preview matches what actually executes.
  const extraFlags = [];
  const isSuiteSingle = state.testmode === 'suite' && !result.isDualPlatform;
  const slackCb = document.getElementById('suite-slack-notify');
  if (isSuiteSingle && slackCb && slackCb.checked) extraFlags.push('--slack');
  const zephyrCb = document.getElementById('suite-zephyr-execution');
  if (isSuiteSingle && zephyrCb && zephyrCb.checked) extraFlags.push('--add-zephyr-execution');

  preview.innerHTML =
    result.envParts.map(e => `<span class="preview-env">${escHtml(e)}</span>`).join(' ') +
    ` <span class="preview-cmd">${scriptLabel}</span>` +
    ` <span class="preview-env">${escHtml(result.target)}</span>` +
    (result.flagParts.length ? ' ' + result.flagParts.map(f => `<span class="preview-flag">${escHtml(f)}</span>`).join(' ') : '') +
    (extraFlags.length ? ' ' + extraFlags.map(f => `<span class="preview-flag">${escHtml(f)}</span>`).join(' ') : '');
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Adhoc weight slider logic ──────────────────────────────────────────────────
function updateWeights() {
  const tapSlider = document.getElementById('tap-weight');
  const swipeSlider = document.getElementById('swipe-weight');
  const backSlider = document.getElementById('back-weight');
  const totalSpan = document.getElementById('weight-total');
  
  let tap = parseInt(tapSlider.value) || 0;
  let swipe = parseInt(swipeSlider.value) || 0;
  let back = parseInt(backSlider.value) || 0;
  let total = tap + swipe + back;
  
  // If total exceeds 100, scale down the other two proportionally
  if (total > 100) {
    const excess = total - 100;
    // Find which slider was just changed and adjust the others
    const lastChanged = event.target.id;
    
    if (lastChanged === 'tap-weight') {
      // Reduce swipe and back proportionally
      const otherTotal = swipe + back;
      if (otherTotal > 0) {
        const scale = (100 - tap) / otherTotal;
        swipe = Math.round(swipe * scale);
        back = Math.round(back * scale);
      } else {
        swipe = (100 - tap) / 2;
        back = (100 - tap) / 2;
      }
    } else if (lastChanged === 'swipe-weight') {
      const otherTotal = tap + back;
      if (otherTotal > 0) {
        const scale = (100 - swipe) / otherTotal;
        tap = Math.round(tap * scale);
        back = Math.round(back * scale);
      } else {
        tap = (100 - swipe) / 2;
        back = (100 - swipe) / 2;
      }
    } else if (lastChanged === 'back-weight') {
      const otherTotal = tap + swipe;
      if (otherTotal > 0) {
        const scale = (100 - back) / otherTotal;
        tap = Math.round(tap * scale);
        swipe = Math.round(swipe * scale);
      } else {
        tap = (100 - back) / 2;
        swipe = (100 - back) / 2;
      }
    }
    
    // Ensure we don't go negative
    tap = Math.max(0, tap);
    swipe = Math.max(0, swipe);
    back = Math.max(0, back);
    
    // Adjust for rounding errors to ensure exactly 100
    total = tap + swipe + back;
    if (total !== 100) {
      const diff = 100 - total;
      if (lastChanged === 'tap-weight') back += diff;
      else if (lastChanged === 'swipe-weight') back += diff;
      else tap += diff;
    }
    
    tapSlider.value = tap;
    swipeSlider.value = swipe;
    backSlider.value = back;
  }
  
  // Update display values
  document.getElementById('tap-value').textContent = tap;
  document.getElementById('swipe-value').textContent = swipe;
  document.getElementById('back-value').textContent = back;
  document.getElementById('weight-total').textContent = tap + swipe + back;
  
  updatePreview();
}

// ── Run test ──────────────────────────────────────────────────────────────────
function runTest() {
  const result = buildTestCommand();
  if (!result) return alert('Please select a test target first.');
  const labelPrefix = result.isDualPlatform ? 'Both platforms: ' : 'Test: ';
  const label = labelPrefix + result.target.split('/').pop().replace('.yaml', '');
  // Append --slack ONLY for real suite runs, not for "Both platforms" dual
  // runs. The checkbox is scoped to the Suite picker; letting its persisted
  // state bleed into dual-platform runs was noisy (users who checked it once
  // for a suite were silently notifying Slack on every subsequent both-
  // platforms invocation from the dashboard).
  let cmdStr = result.full;
  const slackCb = document.getElementById('suite-slack-notify');
  if (slackCb && slackCb.checked && state.testmode === 'suite' && !result.isDualPlatform) {
    cmdStr = cmdStr + ' --slack';
  }
  // --add-zephyr-execution is scoped to real Suite-mode runs only (matches the
  // Slack checkbox behavior above). It's meaningless for a single flow/custom
  // run and unsupported by the dual-platform wrapper.
  const zephyrCb = document.getElementById('suite-zephyr-execution');
  if (zephyrCb && zephyrCb.checked && state.testmode === 'suite' && !result.isDualPlatform) {
    cmdStr = cmdStr + ' --add-zephyr-execution';
  }
  runCmd(cmdStr, label);
}

// ── Run command ───────────────────────────────────────────────────────────────
async function runCmd(cmdStr, label) {
  if (state.currentEs) {
    state.currentEs.close();
    state.currentEs = null;
  }

  clearTerm();
  openTermDrawer();
  setStatus('running', label || cmdStr);
  appendLine('cmd-echo', '$ ' + cmdStr);
  appendLine('meta', '');

  let jobId;
  try {
    const res = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cmd: cmdStr, args: [] })
    });
    const data = await res.json();
    jobId = data.jobId;
    state.currentJobId = jobId;
  } catch (e) {
    appendLine('error', 'Failed to start command: ' + e.message);
    setStatus('error', 'Error');
    return;
  }

  document.getElementById('btn-kill').style.display = '';

  const es = new EventSource('/api/stream/' + jobId);
  state.currentEs = es;

  es.onmessage = (evt) => {
    const msg = JSON.parse(evt.data);
    if (msg.type === 'stdout') appendLines('stdout', msg.data);
    else if (msg.type === 'stderr') appendLines('stderr', msg.data);
    else if (msg.type === 'error') appendLine('error', msg.data);
    else if (msg.type === 'done' || msg.type === 'exit') {
      _finalizeStep();
      const code = msg.data?.code;
      if (code === 0 || code === null) {
        appendLine('success', '\n✓ Process exited with code ' + (code ?? 0));
        setStatus('success', 'Done');
      } else {
        appendLine('error', '\n✗ Process exited with code ' + code);
        setStatus('error', 'Failed (exit ' + code + ')');
      }
      document.getElementById('btn-kill').style.display = 'none';
      state.currentJobId = null;
      state.currentEs = null;
      es.close();
      setTimeout(() => loadLatestReport(), 2000);
    }
  };
  es.onerror = () => {
    if (state.currentEs === es) {
      setStatus('error', 'Connection lost');
      document.getElementById('btn-kill').style.display = 'none';
    }
    es.close();
  };
}

async function killJob() {
  if (!state.currentJobId) return;
  await fetch('/api/kill/' + state.currentJobId, { method: 'POST' });
  _finalizeStep();
  appendLine('meta', '\n[Process terminated by user]');
  setStatus('idle', 'Killed');
  document.getElementById('btn-kill').style.display = 'none';
  if (state.currentEs) { state.currentEs.close(); state.currentEs = null; }
  state.currentJobId = null;
}

