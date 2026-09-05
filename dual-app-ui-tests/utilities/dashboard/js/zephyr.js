/* =========================================================
   ZEPHYR SCALE INTEGRATION — folder-tree view
   ========================================================= */
(function () {
  'use strict';
  const DEFAULT_PROJECT = 'TLPCWHSAM';

  /* ══════════════════════════════════════════════════════════
     STATE
     ══════════════════════════════════════════════════════════ */
  const Z = {
    token: '',
    project: DEFAULT_PROJECT,
    resource: 'testcases',
    folderCache: {},    // folderId → items array (fetched)
    folderRendered: new Set(), // folderIds whose items are in the DOM
    rootCache: null,    // items with no folder, once loaded
    itemStore: {},      // itemKey → item object, for detail panel
    allFolders: [],     // flat folder list from API
    bgLoadGeneration: 0, // incremented on each refresh to cancel stale bg loads
  };

  // Zephyr folderType per resource
  const FOLDER_TYPE = { testcases: 'TEST_CASE', testcycles: 'TEST_CYCLE', testplans: 'TEST_PLAN' };
  // API path per resource
  const ITEM_PATH = { testcases: '/testcases', testcycles: '/testcycles', testplans: '/testplans', testexecutions: '/testexecutions' };
  // Human-readable titles
  const TITLES = { testcases: 'Test Cases', testcycles: 'Test Cycles', testplans: 'Test Plans', testexecutions: 'Test Executions' };

  /* ══════════════════════════════════════════════════════════
     UTILITIES
     ══════════════════════════════════════════════════════════ */
  function esc(s) { return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function fmtDate(d) { if (!d) return '—'; try { return new Date(d).toLocaleDateString(); } catch(_) { return String(d); } }
  function $id(id) { return document.getElementById(id); }

  function statusClass(s) {
    const l = String(s || '').toLowerCase();
    if (l === 'approved' || l.includes('active') || l.includes('pass')) return 'pass';
    if (l === 'deprecated') return 'deprecated';
    if (l === 'draft') return 'draft';
    if (l.includes('fail')) return 'fail';
    if (l.includes('block')) return 'blocked';
    if (l.includes('progress') || l.includes('wip')) return 'wip';
    return 'draft';
  }
  function priorityClass(p) {
    const l = String(p || '').toLowerCase();
    if (l.includes('high') || l.includes('critical')) return 'high';
    if (l.includes('medium') || l.includes('normal')) return 'medium';
    if (l.includes('low')) return 'low';
    return '';
  }

  function showLoading(msg) {
    const c = $id('z-content');
    if (c) c.innerHTML = `<div class="zephyr-loading"><div class="zephyr-spinner"></div><p>${esc(msg || 'Loading…')}</p></div>`;
  }
  function showError(msg) {
    const c = $id('z-content');
    if (c) c.innerHTML = `<div class="zephyr-error-box">⚠️ ${esc(msg)}</div>`;
  }

  /* ── generic paginated fetch (loads ALL pages) ── */
  async function fetchAll(path, extra) {
    if (!Z.token) { showError('Connect first.'); return null; }
    let all = [], startAt = 0;
    while (true) {
      const params = new URLSearchParams({ token: Z.token, projectKey: Z.project, maxResults: 200, startAt, ...(extra || {}) });
      let res, data;
      try {
        res = await fetch(`/api/zephyr${path}?${params}`);
        data = await res.json();
      } catch (e) { showError(`Network error: ${e.message}`); return null; }
      if (!res.ok) { showError(`API ${res.status}: ${data.message || data.error || JSON.stringify(data)}`); return null; }
      const page = data.values || (Array.isArray(data) ? data : []);
      all = all.concat(page);
      if (data.isLast || page.length === 0 || all.length >= (data.total || all.length)) break;
      startAt += page.length;
    }
    return all;
  }

  /* ══════════════════════════════════════════════════════════
     CONNECT
     ══════════════════════════════════════════════════════════ */
  function zephyrConnect() {
    const t = ($id('z-token') || {}).value || '';
    const p = ($id('z-project') || {}).value || DEFAULT_PROJECT;
    if (!t) { alert('Please enter your Zephyr access token.'); return; }
    Z.token = t.trim();
    Z.project = p.trim() || DEFAULT_PROJECT;
    zephyrLoad();
  }
  window.zephyrConnect = zephyrConnect;

  /* ══════════════════════════════════════════════════════════
     AUTO-INIT — pre-populate token from server .env on first
     Zephyr tab activation; auto-connects if token present.
     ══════════════════════════════════════════════════════════ */
  let _zephyrInitDone = false;
  async function zephyrAutoInit() {
    if (_zephyrInitDone) return;
    _zephyrInitDone = true;
    try {
      const res = await fetch('/api/zephyr/env');
      if (!res.ok) return;
      const { token, projectKey } = await res.json();
      const tEl = $id('z-token');
      const pEl = $id('z-project');
      if (token && tEl && !tEl.value) tEl.value = token;
      if (projectKey && pEl && !pEl.value) pEl.value = projectKey;
      if (token) zephyrConnect();
    } catch (_) { /* server unavailable — user fills manually */ }
  }
  window.zephyrAutoInit = zephyrAutoInit;

  /* ══════════════════════════════════════════════════════════
     CREATE TEST CYCLE / TEST PLAN
     ══════════════════════════════════════════════════════════ */

  // Load folders into a <select> — folderType: TEST_CYCLE or TEST_PLAN
  async function zcdLoadFolders(selectId, folderType = 'TEST_CYCLE') {
    const sel = $id(selectId);
    if (!sel) return;
    if (!Z.token) { sel.innerHTML = '<option value="">— Connect first —</option>'; return; }
    sel.innerHTML = '<option value="">— Loading… —</option>';
    try {
      const res = await fetch(`/api/zephyr/folders?token=${encodeURIComponent(Z.token)}&projectKey=${encodeURIComponent(Z.project)}&folderType=${folderType}&maxResults=500`);
      const data = await res.json();
      const folders = data.values || data || [];
      sel.innerHTML = '<option value="">— Select folder —</option>';
      // Build path strings by walking parentId references
      const byId = {};
      folders.forEach(f => { byId[f.id] = f; });
      function getPath(f) {
        if (!f) return '';
        const parts = [];
        let cur = f;
        while (cur) { parts.unshift(cur.name); cur = byId[cur.parentId]; }
        return '/' + parts.join('/');
      }
      const sorted = folders.slice().sort((a, b) => getPath(a).localeCompare(getPath(b)));
      sorted.forEach(f => {
        const opt = document.createElement('option');
        opt.value = f.id;
        opt.dataset.path = getPath(f);
        opt.textContent = getPath(f);
        sel.appendChild(opt);
      });
    } catch (e) {
      sel.innerHTML = `<option value="">— Error: ${e.message} —</option>`;
    }
  }

  // ── Custom fields cache ───────────────────────────────────────────────────
  // Fetched once per session from GET /v2/customfields?projectKey=...
  // Response values array: { id, name, type, options: [{id,name}], ... }
  let _zephyrCustomFields = null; // null = not yet fetched

  async function zcdLoadCustomFields() {
    if (_zephyrCustomFields) return _zephyrCustomFields;
    if (!Z.token) { _zephyrCustomFields = []; return []; }
    try {
      const res = await fetch(`/api/zephyr/customfields?token=${encodeURIComponent(Z.token)}&projectKey=${encodeURIComponent(Z.project)}&maxResults=500`);
      if (!res.ok) { _zephyrCustomFields = []; return []; }
      const data = await res.json();
      const arr = data.values || (Array.isArray(data) ? data : []);
      _zephyrCustomFields = arr;
    } catch (_) {
      _zephyrCustomFields = [];
    }
    return _zephyrCustomFields;
  }

  // Build a customFields payload object correctly typed per Zephyr's schema.
  // fields = { 'Field Name': value } where value is a plain string or array.
  // This function looks up each field's type and wraps strings in arrays for
  // list/multiselect types, passes scalars as-is for text/number types.
  // Known list-type custom fields in this project (from observed API errors).
  // When /customfields endpoint is unavailable, these are wrapped as arrays.
  const KNOWN_LIST_FIELDS = new Set(['Test Classification', 'Platform']);

  function zcdBuildCustomFields(fields, customFieldDefs) {
    const defs = Array.isArray(customFieldDefs) ? customFieldDefs : [];
    const result = {};
    for (const [name, value] of Object.entries(fields)) {
      if (!value && value !== 0) continue;

      const def = defs.find(f => f.name === name);
      let isList;
      if (def) {
        const type = (def.type || '').toLowerCase();
        isList = type.includes('list') || type.includes('multiselect') || type.includes('checkbox');
      } else {
        // No field def available — fall back to known list fields
        isList = KNOWN_LIST_FIELDS.has(name);
      }

      if (isList) {
        const arr = Array.isArray(value) ? value : [value];
        if (def && def.options && def.options.length) {
          result[name] = arr.map(v => {
            const opt = def.options.find(o => o.name === v || o.id === v);
            return opt ? { id: opt.id } : { name: v };
          });
        } else {
          result[name] = arr;
        }
      } else {
        result[name] = Array.isArray(value) ? value[0] : value;
      }
    }
    return result;
  }

  // ── Date formatter for artifact names: Jul07-2026 ────────────────────────
  const _MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  function zcdNameDate(d) {
    d = d || new Date();
    const mon = _MONTHS[d.getMonth()];
    const day = String(d.getDate()).padStart(2,'0');
    return `${mon}${day}-${d.getFullYear()}`;
  }

  // ── Platform chip toggle ──────────────────────────────────────────────────
  function zcdTogglePlatform(chip, dialog) {
    chip.classList.toggle('selected');
    const platform = chip.dataset.value;
    // Show/hide the corresponding per-platform name row
    const namesContainer = $id(dialog === 'cycle' ? 'zcd-cycle-platform-names' : 'zcd-plan-platform-names');
    if (namesContainer) {
      const row = namesContainer.querySelector(`[data-platform="${platform}"]`);
      if (row) row.style.display = chip.classList.contains('selected') ? 'flex' : 'none';
    }
    if (dialog === 'cycle') zcdRebuildCycleName();
    if (dialog === 'plan')  zcdRebuildPlanName();
  }
  window.zcdTogglePlatform = zcdTogglePlatform;

  function zcdGetPlatforms(groupId) {
    const group = $id(groupId);
    if (!group) return [];
    return Array.from(group.querySelectorAll('.zcd-platform-chip.selected'))
      .map(c => c.dataset.value);
  }

  // ── Cycle folder tree (flat list, cached per dialog open) ──
  let _cycleFolderTree = [];

  async function zcdLoadCycleFolderTree() {
    if (!Z.token) return;
    try {
      const res = await fetch(`/api/zephyr/folders?token=${encodeURIComponent(Z.token)}&projectKey=${encodeURIComponent(Z.project)}&folderType=TEST_CYCLE&maxResults=500`);
      const data = await res.json();
      _cycleFolderTree = data.values || data || [];
    } catch (_) { _cycleFolderTree = []; }
  }

  // ── Priority id → name cache ──────────────────────────────────────────────
  let _priorityMap = {}; // { id: 'High', id: 'Medium', ... }

  async function zcdLoadPriorityMap() {
    if (Object.keys(_priorityMap).length) return;
    if (!Z.token) return;
    try {
      const res = await fetch(`/api/zephyr/priorities?token=${encodeURIComponent(Z.token)}&projectKey=${encodeURIComponent(Z.project)}&maxResults=50`);
      const data = await res.json();
      const list = data.values || (Array.isArray(data) ? data : []);
      list.forEach(p => { if (p.id && p.name) _priorityMap[p.id] = p.name; });
    } catch (_) {}
  }

  // ── Test case folder tree — needed to resolve root app folderId for filtering ──
  let _tcFolderTree = [];

  async function zcdLoadTcFolderTree() {
    if (!Z.token) return;
    if (_tcFolderTree.length) return; // cached for session
    try {
      const res = await fetch(`/api/zephyr/folders?token=${encodeURIComponent(Z.token)}&projectKey=${encodeURIComponent(Z.project)}&folderType=TEST_CASE&maxResults=500`);
      const data = await res.json();
      _tcFolderTree = data.values || data || [];
    } catch (_) { _tcFolderTree = []; }
  }

  function zcdCycleFolderById() {
    const map = {};
    _cycleFolderTree.forEach(f => { map[f.id] = f; });
    return map;
  }

  function zcdCycleFolderPath(folderId, byId) {
    const parts = [];
    let cur = byId[folderId];
    while (cur) { parts.unshift(cur.name); cur = byId[cur.parentId]; }
    return parts.length ? '/' + parts.join('/') : '';
  }

  function zcdFillCycleL1() {
    const sel = $id('zcd-cycle-folder-l1');
    if (!sel) return;
    const byId = zcdCycleFolderById();
    const roots = _cycleFolderTree.filter(f => !f.parentId || !byId[f.parentId]);
    sel.innerHTML = '<option value="">— Quarter (Level 1) —</option>';
    roots.sort((a,b) => a.name.localeCompare(b.name)).forEach(f => {
      const o = document.createElement('option');
      o.value = f.id; o.textContent = f.name; sel.appendChild(o);
    });
    if (roots.length) {
      const last = roots.reduce((a,b) => (b.id > a.id ? b : a));
      sel.value = last.id;
    }
    zcdCycleFolderCascade(1);
  }

  function zcdCycleFolderCascade(level) {
    const byId = zcdCycleFolderById();
    const l1v = ($id('zcd-cycle-folder-l1') || {}).value || '';

    if (level <= 1) {
      const sel2 = $id('zcd-cycle-folder-l2');
      sel2.innerHTML = '<option value="">— App / Team (Level 2) —</option>';
      sel2.disabled = !l1v;
      if (l1v) {
        const children = _cycleFolderTree.filter(f => String(f.parentId) === String(l1v));
        children.sort((a,b) => a.name.localeCompare(b.name)).forEach(f => {
          const o = document.createElement('option'); o.value = f.id; o.textContent = f.name; sel2.appendChild(o);
        });
        if (children.length) {
          const last = children.reduce((a,b) => (b.id > a.id ? b : a));
          sel2.value = last.id;
        }
        sel2.disabled = children.length === 0;
      }
      const sel3 = $id('zcd-cycle-folder-l3');
      sel3.innerHTML = '<option value="">— Release / Branch (Level 3) —</option>';
      sel3.disabled = true;
      zcdCycleFolderCascade(2);
      return;
    }

    if (level === 2) {
      const sel3 = $id('zcd-cycle-folder-l3');
      const curL2 = ($id('zcd-cycle-folder-l2') || {}).value || '';
      sel3.innerHTML = '<option value="">— Release / Branch (Level 3) —</option>';
      sel3.disabled = !curL2;
      if (curL2) {
        const children = _cycleFolderTree.filter(f => String(f.parentId) === String(curL2));
        children.sort((a,b) => a.name.localeCompare(b.name)).forEach(f => {
          const o = document.createElement('option'); o.value = f.id; o.textContent = f.name; sel3.appendChild(o);
        });
        if (children.length) {
          const last = children.reduce((a,b) => (b.id > a.id ? b : a));
          sel3.value = last.id;
        }
        sel3.disabled = children.length === 0;
      }
    }
    zcdUpdateCycleFolderDisplay();
  }
  window.zcdCycleFolderCascade = zcdCycleFolderCascade;

  function zcdUpdateCycleFolderDisplay() {
    const byId = zcdCycleFolderById();
    const l3v = ($id('zcd-cycle-folder-l3') || {}).value || '';
    const l2v = ($id('zcd-cycle-folder-l2') || {}).value || '';
    const l1v = ($id('zcd-cycle-folder-l1') || {}).value || '';
    const fid = l3v || l2v || l1v;
    const disp = $id('zcd-cycle-folder-display');
    if (disp) {
      if (fid) { disp.textContent = zcdCycleFolderPath(fid, byId); disp.style.display = 'block'; }
      else { disp.style.display = 'none'; }
    }
  }

  // ── Auto-construct cycle name ──
  function zcdRebuildCycleName() {
    const platforms = zcdGetPlatforms('zcd-cycle-platforms');
    const build     = ($id('zcd-cycle-build')  || {}).value || '';
    const cls       = ($id('zcd-cycle-class')  || {}).value || 'Regression';
    const modFilter = ($id('zcd-cycle-module') || {}).value || '';
    const datePart  = zcdNameDate();
    // Auto-populate per-platform name fields only
    const container = $id('zcd-cycle-platform-names');
    if (container) {
      platforms.forEach(plat => {
        const inp = container.querySelector(`[data-cycle-platform-name="${plat}"]`);
        if (inp && !inp.dataset.userEdited) {
          inp.value = [plat, cls, build, modFilter, datePart].filter(Boolean).join('-');
        }
      });
    }
  }
  window.zcdRebuildCycleName = zcdRebuildCycleName;

  window.zcdUpdateCycleFolder = zcdRebuildCycleName;

  function zcdSetStatus(msgId, type, text) {
    const el = $id(msgId);
    if (!el) return;
    el.className = `zcd-status-msg ${type}`;
    el.textContent = text;
  }

  function zcdClearStatus(msgId) {
    const el = $id(msgId);
    if (el) { el.className = 'zcd-status-msg'; el.textContent = ''; }
  }

  // ── Open / Close Cycle dialog ──
  async function zephyrOpenCreateCycle() {
    const overlay = $id('zcd-cycle-overlay');
    if (!overlay) return;
    _cycleMatchedTests = [];
    const tcList = $id('zcd-cycle-tc-list'); if (tcList) tcList.style.display = 'none';
    const tcCount = $id('zcd-cycle-tc-count'); if (tcCount) tcCount.textContent = '';
    zcdClearStatus('zcd-cycle-status-msg');
    const today = new Date().toISOString().slice(0, 10);
    const s = $id('zcd-cycle-start'); if (s) s.value = today;
    const e = $id('zcd-cycle-end');   if (e) e.value = today;
    // Reset platforms to iOS + Android default
    ($id('zcd-cycle-platforms') || {querySelectorAll:()=>[]}).querySelectorAll('.zcd-platform-chip').forEach(c => {
      c.classList.toggle('selected', c.dataset.value === 'iOS' || c.dataset.value === 'Android');
    });
    // Show iOS + Android name rows, hide Web
    ($id('zcd-cycle-platform-names') || {querySelectorAll:()=>[]}).querySelectorAll('.zcd-platform-name-row').forEach(row => {
      const plat = row.dataset.platform;
      row.style.display = (plat === 'iOS' || plat === 'Android') ? 'flex' : 'none';
    });
    // Clear per-platform name overrides
    ($id('zcd-cycle-platform-names') || {querySelectorAll:()=>[]}).querySelectorAll('input').forEach(i => {
      i.value = ''; delete i.dataset.userEdited;
    });
    // Reset cascade selects
    ['zcd-cycle-folder-l2','zcd-cycle-folder-l3'].forEach(id => {
      const sel = $id(id); if (sel) { sel.innerHTML = '<option value="">—</option>'; sel.disabled = true; }
    });
    overlay.style.display = 'flex';
    await Promise.all([zcdLoadCycleFolderTree(), zcdLoadCustomFields(), zcdLoadTcFolderTree(), zcdLoadPriorityMap()]);
    zcdFillCycleL1();
    zcdRebuildCycleName();
  }
  window.zephyrOpenCreateCycle = zephyrOpenCreateCycle;

  function zephyrCloseCreateCycle() {
    const overlay = $id('zcd-cycle-overlay');
    if (overlay) overlay.style.display = 'none';
  }
  window.zephyrCloseCreateCycle = zephyrCloseCreateCycle;

  // ── Submit Cycle — creates one cycle per selected platform ──
  async function zcdSubmitCycle() {
    const cls       = ($id('zcd-cycle-class')  || {}).value || 'Regression';
    const modFilter = ($id('zcd-cycle-module') || {}).value || '';
    const build   = ($id('zcd-cycle-build')  || {}).value || '';
    const status  = ($id('zcd-cycle-status') || {}).value || 'Not Executed';
    const start   = ($id('zcd-cycle-start')  || {}).value || '';
    const end     = ($id('zcd-cycle-end')    || {}).value || '';
    const desc    = ($id('zcd-cycle-desc')   || {}).value || '';
    const l3v     = ($id('zcd-cycle-folder-l3') || {}).value || '';
    const l2v     = ($id('zcd-cycle-folder-l2') || {}).value || '';
    const l1v     = ($id('zcd-cycle-folder-l1') || {}).value || '';
    const folderId = l3v || l2v || l1v;
    const platforms = zcdGetPlatforms('zcd-cycle-platforms');

    if (!platforms.length) { zcdSetStatus('zcd-cycle-status-msg', 'error', 'Select at least one platform.'); return; }
    if (!Z.token)          { zcdSetStatus('zcd-cycle-status-msg', 'error', 'Not connected — enter token and connect first.'); return; }

    const btn = $id('zcd-cycle-submit');
    if (btn) { btn.disabled = true; btn.textContent = `Creating ${platforms.length} cycle(s)…`; }
    zcdClearStatus('zcd-cycle-status-msg');

    const results = [];

    for (const plat of platforms) {
      // Per-platform name: use the override field if filled, else auto-generate
      const nameContainer = $id('zcd-cycle-platform-names');
      const nameInp = nameContainer ? nameContainer.querySelector(`[data-cycle-platform-name="${plat}"]`) : null;
      const autoName = [plat, cls, build, modFilter, zcdNameDate()].filter(Boolean).join('-');
      const cycleName = (nameInp && nameInp.value.trim()) ? nameInp.value.trim() : autoName;

      const rawFields = {};
      if (cls)       rawFields['Test Classification'] = cls;
      if (modFilter) rawFields['Module'] = modFilter;
      if (build)  rawFields['Build Version'] = build;
      rawFields['Platform'] = [plat];
      const customFields = zcdBuildCustomFields(rawFields, _zephyrCustomFields || []);

      const payload = {
        token: Z.token,
        projectKey: Z.project,
        name: cycleName,
        description: desc,
        plannedStartDate: start ? `${start}T00:00:00.000+0000` : new Date().toISOString(),
        plannedEndDate:   end   ? `${end}T23:59:59.000+0000`   : new Date().toISOString(),
        status,
        ...(folderId ? { folderId: Number(folderId) } : {}),
        customFields,
      };

      if (btn) btn.textContent = `Creating ${plat} cycle…`;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 40000);
        const res = await fetch('/api/zephyr/testcycles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        clearTimeout(timer);
        let data = {};
        try { data = await res.json(); } catch (_) {}
        if (res.ok) {
          const cycleKey = data.key || data.id || '';
          let added = 0, failed = 0;
          // Add matched test cases
          if (cycleKey && _cycleMatchedTests.length) {
            if (btn) btn.textContent = `Adding tests to ${plat}…`;
            const BATCH = 10;
            for (let i = 0; i < _cycleMatchedTests.length; i += BATCH) {
              const batch = _cycleMatchedTests.slice(i, i + BATCH);
              await Promise.all(batch.map(async tc => {
                try {
                  const r = await fetch(`/api/zephyr/testexecutions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: Z.token, projectKey: Z.project, testCaseKey: tc.key, testCycleKey: cycleKey, statusName: 'Not Executed' }),
                  });
                  if (r.ok) added++; else failed++;
                } catch (_) { failed++; }
              }));
            }
          }
          results.push({ plat, key: cycleKey, added, failed, ok: true });
        } else {
          const msg = data.message || data.errorMessage || data.error || JSON.stringify(data);
          results.push({ plat, ok: false, msg: `${res.status}: ${msg}` });
        }
      } catch (err) {
        results.push({ plat, ok: false, msg: err.name === 'AbortError' ? 'Timed out' : err.message });
      }
    }

    // Summary
    const ok  = results.filter(r => r.ok);
    const err = results.filter(r => !r.ok);
    if (ok.length) {
      const lines = ok.map(r => `${r.plat}: ${r.key}${r.added ? ` (+${r.added} tests)` : ''}`).join(' · ');
      zcdSetStatus('zcd-cycle-status-msg', err.length ? 'wip' : 'success',
        `✓ Created: ${lines}${err.length ? `  ⚠ Errors: ${err.map(r=>r.plat+' '+r.msg).join(', ')}` : ''}`);
    } else {
      zcdSetStatus('zcd-cycle-status-msg', 'error', `Errors: ${err.map(r => r.plat + ' — ' + r.msg).join(' | ')}`);
    }
    if (btn) { btn.disabled = false; btn.textContent = 'Create & Add Tests'; }
    if (Z.resource === 'testcycles') setTimeout(zephyrLoad, 800);
  }
  window.zcdSubmitCycle = zcdSubmitCycle;

  // ── Plan folder tree (flat list cached once per dialog open) ──
  let _planFolderTree = []; // all TEST_PLAN folders fetched from Zephyr

  async function zcdLoadPlanFolderTree() {
    if (!Z.token) return;
    try {
      const res = await fetch(`/api/zephyr/folders?token=${encodeURIComponent(Z.token)}&projectKey=${encodeURIComponent(Z.project)}&folderType=TEST_PLAN&maxResults=500`);
      const data = await res.json();
      _planFolderTree = data.values || data || [];
    } catch (_) { _planFolderTree = []; }
  }

  // Build parent-path map from flat folder list
  function zcdPlanFolderById() {
    const map = {};
    _planFolderTree.forEach(f => { map[f.id] = f; });
    return map;
  }

  function zcdPlanFolderPath(folderId, byId) {
    const parts = [];
    let cur = byId[folderId];
    while (cur) { parts.unshift(cur.name); cur = byId[cur.parentId]; }
    return parts.length ? '/' + parts.join('/') : '';
  }

  // Populate a dropdown with root-level folders (no parentId)
  function zcdFillPlanL1() {
    const sel = $id('zcd-plan-folder-l1');
    if (!sel) return;
    const byId = zcdPlanFolderById();
    const roots = _planFolderTree.filter(f => !f.parentId || !byId[f.parentId]);
    sel.innerHTML = '<option value="">— Quarter (Level 1) —</option>';
    roots.sort((a,b) => a.name.localeCompare(b.name)).forEach(f => {
      const o = document.createElement('option');
      o.value = f.id; o.textContent = f.name; sel.appendChild(o);
    });
    // Default to last folder (most recently created = highest id among roots)
    if (roots.length) {
      const last = roots.reduce((a,b) => (b.id > a.id ? b : a));
      sel.value = last.id;
    }
    zcdPlanFolderCascade(1);
  }

  // Cascade: level = 1|2|3 just changed → repopulate deeper levels
  function zcdPlanFolderCascade(level) {
    const byId = zcdPlanFolderById();
    const l1v = ($id('zcd-plan-folder-l1') || {}).value || '';
    const l2v = ($id('zcd-plan-folder-l2') || {}).value || '';

    if (level <= 1) {
      // Fill L2 with children of L1
      const sel2 = $id('zcd-plan-folder-l2');
      sel2.innerHTML = '<option value="">— App / Team (Level 2) —</option>';
      sel2.disabled = !l1v;
      if (l1v) {
        const children = _planFolderTree.filter(f => String(f.parentId) === String(l1v));
        children.sort((a,b) => a.name.localeCompare(b.name)).forEach(f => {
          const o = document.createElement('option'); o.value = f.id; o.textContent = f.name; sel2.appendChild(o);
        });
        if (children.length) {
          const last = children.reduce((a,b) => (b.id > a.id ? b : a));
          sel2.value = last.id;
        }
        sel2.disabled = children.length === 0;
      }
      // Reset L3
      const sel3 = $id('zcd-plan-folder-l3');
      sel3.innerHTML = '<option value="">— Release / Branch (Level 3) —</option>';
      sel3.disabled = true;
      zcdPlanFolderCascade(2);
      return;
    }

    if (level === 2) {
      const sel3 = $id('zcd-plan-folder-l3');
      const curL2 = ($id('zcd-plan-folder-l2') || {}).value || '';
      sel3.innerHTML = '<option value="">— Release / Branch (Level 3) —</option>';
      sel3.disabled = !curL2;
      if (curL2) {
        const children = _planFolderTree.filter(f => String(f.parentId) === String(curL2));
        children.sort((a,b) => a.name.localeCompare(b.name)).forEach(f => {
          const o = document.createElement('option'); o.value = f.id; o.textContent = f.name; sel3.appendChild(o);
        });
        if (children.length) {
          const last = children.reduce((a,b) => (b.id > a.id ? b : a));
          sel3.value = last.id;
        }
        sel3.disabled = children.length === 0;
      }
    }
    zcdUpdatePlanFolderDisplay();
  }
  window.zcdPlanFolderCascade = zcdPlanFolderCascade;

  function zcdUpdatePlanFolderDisplay() {
    const byId = zcdPlanFolderById();
    // Deepest selected level wins
    const l3v = ($id('zcd-plan-folder-l3') || {}).value || '';
    const l2v = ($id('zcd-plan-folder-l2') || {}).value || '';
    const l1v = ($id('zcd-plan-folder-l1') || {}).value || '';
    const fid = l3v || l2v || l1v;
    const disp = $id('zcd-plan-folder-display');
    if (disp) {
      if (fid) { disp.textContent = zcdPlanFolderPath(fid, byId); disp.style.display = 'block'; }
      else { disp.style.display = 'none'; }
    }
  }

  // ── Auto-construct plan name: Branch-BuildNum-Iteration-DDMMYYYY ──
  function zcdRebuildPlanName() {
    const platforms = zcdGetPlatforms('zcd-plan-platforms');
    const branch   = ($id('zcd-plan-branch')   || {}).value || '';
    const buildnum = ($id('zcd-plan-buildnum')  || {}).value || '';
    const iter     = ($id('zcd-plan-iter')      || {}).value || '';
    const datePart = zcdNameDate();
    // Auto-populate per-platform name fields only
    const container = $id('zcd-plan-platform-names');
    if (container) {
      platforms.forEach(plat => {
        const inp = container.querySelector(`[data-plan-platform-name="${plat}"]`);
        if (inp && !inp.dataset.userEdited) {
          inp.value = [plat, branch, buildnum, iter, datePart].filter(Boolean).join('-');
        }
      });
    }
  }
  window.zcdRebuildPlanName = zcdRebuildPlanName;



  // ── Auto-increment iteration by counting existing plans in selected folder ──
  async function zcdFetchPlanIteration() {
    if (!Z.token) return;
    const lbl = $id('zcd-plan-iter-loading');
    if (lbl) lbl.style.display = 'inline';
    try {
      // Get all plans, count those matching current branch+buildnum in folder
      const branch   = ($id('zcd-plan-branch')  || {}).value || '';
      const buildnum = ($id('zcd-plan-buildnum') || {}).value || '';
      const prefix   = [branch, buildnum].filter(Boolean).join('-');

      const res = await fetch(`/api/zephyr/testplans?token=${encodeURIComponent(Z.token)}&projectKey=${encodeURIComponent(Z.project)}&maxResults=500`);
      const data = await res.json();
      const plans = data.values || [];
      // Count plans whose name starts with the same prefix
      const count = plans.filter(p => prefix ? p.name.startsWith(prefix) : true).length;
      const nextIter = `TI${count + 1}`;
      const iterEl = $id('zcd-plan-iter');
      if (iterEl) iterEl.value = nextIter;
      zcdRebuildPlanName();
    } catch (_) {}
    if (lbl) lbl.style.display = 'none';
  }
  window.zcdFetchPlanIteration = zcdFetchPlanIteration;

  // ── Open / Close Plan dialog ──
  async function zephyrOpenCreatePlan() {
    const overlay = $id('zcd-plan-overlay');
    if (!overlay) return;
    zcdClearStatus('zcd-plan-status-msg');
    const today = new Date().toISOString().slice(0, 10);
    const s = $id('zcd-plan-start'); if (s) s.value = today;
    const e = $id('zcd-plan-end');   if (e) e.value = today;
    // Reset platforms to iOS + Android default
    ($id('zcd-plan-platforms') || {querySelectorAll:()=>[]}).querySelectorAll('.zcd-platform-chip').forEach(c => {
      c.classList.toggle('selected', c.dataset.value === 'iOS' || c.dataset.value === 'Android');
    });
    // Show iOS + Android name rows, hide Web
    ($id('zcd-plan-platform-names') || {querySelectorAll:()=>[]}).querySelectorAll('.zcd-platform-name-row').forEach(row => {
      const plat = row.dataset.platform;
      row.style.display = (plat === 'iOS' || plat === 'Android') ? 'flex' : 'none';
    });
    // Clear per-platform name overrides
    ($id('zcd-plan-platform-names') || {querySelectorAll:()=>[]}).querySelectorAll('input').forEach(i => {
      i.value = ''; delete i.dataset.userEdited;
    });
    // Reset cascade selects
    ['zcd-plan-folder-l2','zcd-plan-folder-l3'].forEach(id => {
      const sel = $id(id); if (sel) { sel.innerHTML = `<option value="">—</option>`; sel.disabled = true; }
    });
    overlay.style.display = 'flex';
    await Promise.all([zcdLoadPlanFolderTree(), zcdLoadCustomFields()]);
    zcdFillPlanL1();
    await zcdFetchPlanIteration();
  }
  window.zephyrOpenCreatePlan = zephyrOpenCreatePlan;

  function zephyrCloseCreatePlan() {
    const overlay = $id('zcd-plan-overlay');
    if (overlay) overlay.style.display = 'none';
  }
  window.zephyrCloseCreatePlan = zephyrCloseCreatePlan;

  // ── Submit Plan — creates one plan per selected platform ──
  async function zcdSubmitPlan() {
    const branch   = ($id('zcd-plan-branch')   || {}).value || '';
    const buildnum = ($id('zcd-plan-buildnum')  || {}).value || '';
    const status   = ($id('zcd-plan-status')    || {}).value || 'Not Executed';
    const start    = ($id('zcd-plan-start')     || {}).value || '';
    const end      = ($id('zcd-plan-end')       || {}).value || '';
    const desc     = ($id('zcd-plan-desc')      || {}).value || '';
    const l3v      = ($id('zcd-plan-folder-l3') || {}).value || '';
    const l2v      = ($id('zcd-plan-folder-l2') || {}).value || '';
    const l1v      = ($id('zcd-plan-folder-l1') || {}).value || '';
    const folderId  = l3v || l2v || l1v;
    const platforms = zcdGetPlatforms('zcd-plan-platforms');

    if (!platforms.length) { zcdSetStatus('zcd-plan-status-msg', 'error', 'Select at least one platform.'); return; }
    if (!Z.token)          { zcdSetStatus('zcd-plan-status-msg', 'error', 'Not connected — enter token and connect first.'); return; }

    const btn = $id('zcd-plan-submit');
    if (btn) { btn.disabled = true; btn.textContent = `Creating ${platforms.length} plan(s)…`; }
    zcdClearStatus('zcd-plan-status-msg');

    const results = [];

    for (const plat of platforms) {
      // Per-platform name: use override field if filled, else auto-generate
      const nameContainer = $id('zcd-plan-platform-names');
      const nameInp = nameContainer ? nameContainer.querySelector(`[data-plan-platform-name="${plat}"]`) : null;
      const iter    = ($id('zcd-plan-iter') || {}).value || '';
      const autoName = [plat, branch, buildnum, iter, zcdNameDate()].filter(Boolean).join('-');
      const planName = (nameInp && nameInp.value.trim()) ? nameInp.value.trim() : autoName;

      const rawFields = {};
      if (branch)   rawFields['Branch'] = branch;
      if (buildnum) rawFields['Build Number'] = buildnum;
      rawFields['Platform'] = [plat];
      const customFields = zcdBuildCustomFields(rawFields, _zephyrCustomFields || []);

      const payload = {
        token: Z.token,
        projectKey: Z.project,
        name: planName,
        description: desc,
        plannedStartDate: start ? `${start}T00:00:00.000+0000` : new Date().toISOString(),
        plannedEndDate:   end   ? `${end}T23:59:59.000+0000`   : new Date().toISOString(),
        status,
        ...(folderId ? { folderId: Number(folderId) } : {}),
        customFields,
      };

      if (btn) btn.textContent = `Creating ${plat} plan…`;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 40000);
        const res = await fetch('/api/zephyr/testplans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        clearTimeout(timer);
        let data = {};
        try { data = await res.json(); } catch (_) {}
        if (res.ok) {
          results.push({ plat, key: data.key || data.id || '(created)', ok: true });
        } else {
          const msg = data.message || data.errorMessage || data.error || JSON.stringify(data);
          results.push({ plat, ok: false, msg: `${res.status}: ${msg}` });
        }
      } catch (err) {
        results.push({ plat, ok: false, msg: err.name === 'AbortError' ? 'Timed out' : err.message });
      }
    }

    const ok  = results.filter(r => r.ok);
    const err = results.filter(r => !r.ok);
    if (ok.length) {
      const lines = ok.map(r => `${r.plat}: ${r.key}`).join(' · ');
      zcdSetStatus('zcd-plan-status-msg', err.length ? 'wip' : 'success',
        `✓ Created: ${lines}${err.length ? `  ⚠ ${err.map(r => r.plat+' '+r.msg).join(', ')}` : ''}`);
    } else {
      zcdSetStatus('zcd-plan-status-msg', 'error', `Errors: ${err.map(r => r.plat + ' — ' + r.msg).join(' | ')}`);
    }
    if (btn) { btn.disabled = false; btn.textContent = 'Create Plan'; }
    if (Z.resource === 'testplans') setTimeout(zephyrLoad, 800);
  }
  window.zcdSubmitPlan = zcdSubmitPlan;

  window.zcdUpdateCycleFolderDisplay = zcdUpdateCycleFolderDisplay;
  window.zcdUpdatePlanFolderDisplay  = zcdUpdatePlanFolderDisplay;

  // ── Fetch test cases matching current cycle filters ────────────────────────
  let _cycleMatchedTests = []; // cached result from last preview fetch

  /* ── Fetch all pages for a single folderId (silent — no showError) ── */
  async function _fetchTestCasesForFolder(folderId) {
    let all = [], startAt = 0;
    while (true) {
      const params = new URLSearchParams({ token: Z.token, projectKey: Z.project, maxResults: 200, startAt, folderId });
      let res, data;
      try {
        res = await fetch(`/api/zephyr/testcases?${params}`);
        data = await res.json();
      } catch (e) { console.error('[zcd] folder fetch error:', e.message); break; }
      if (!res.ok) { console.error('[zcd] folder fetch API error:', data.message || data.error); break; }
      const page = data.values || (Array.isArray(data) ? data : []);
      all = all.concat(page);
      if (data.isLast || page.length === 0 || all.length >= (data.total || all.length)) break;
      startAt += page.length;
    }
    return all;
  }

  async function zcdFetchMatchingTests(modFilter, cls, appFilter, priority) {
    if (!Z.token) return [];
    try {
      let cases = [];

      if (appFilter && _tcFolderTree.length) {
        // Build folder ID → folder map
        const tcById = {};
        _tcFolderTree.forEach(f => { tcById[f.id] = f; });

        // Find root folder matching app dropdown selection
        const root = _tcFolderTree.find(f =>
          (!f.parentId || !tcById[f.parentId]) &&
          f.name.toLowerCase() === appFilter.toLowerCase()
        );

        if (root) {
          // Collect root + all descendant folder IDs
          const folderIds = [];
          const stack = [root.id];
          while (stack.length) {
            const id = stack.pop();
            folderIds.push(id);
            _tcFolderTree.filter(f => String(f.parentId) === String(id)).forEach(f => stack.push(f.id));
          }

          // Fetch test cases per folder in parallel, batched to avoid overwhelming the API
          const BATCH = 5;
          for (let i = 0; i < folderIds.length; i += BATCH) {
            const batch = folderIds.slice(i, i + BATCH);
            const results = await Promise.all(batch.map(id => _fetchTestCasesForFolder(id)));
            results.forEach(r => cases = cases.concat(r));
          }

          // Deduplicate by key (a test case could theoretically appear in multiple folders)
          const seen = new Set();
          cases = cases.filter(tc => {
            if (!tc.key || seen.has(tc.key)) return false;
            seen.add(tc.key);
            return true;
          });
        }
      } else {
        // No app filter — fall back to full project fetch (paginated)
        cases = await fetchAll('/testcases') || [];
      }

      // Filter by Test Classification custom field
      if (cls) {
        cases = cases.filter(tc => {
          const cf = tc.customFields || {};
          const tcCls = (cf['Test Classification'] || []);
          const clsArr = Array.isArray(tcCls) ? tcCls.map(v => (v.name || v).toLowerCase()) : [String(tcCls).toLowerCase()];
          return clsArr.includes(cls.toLowerCase());
        });
      }
      // Filter by Module custom field
      if (modFilter) {
        const modLower = modFilter.toLowerCase();
        cases = cases.filter(tc => {
          const cf = tc.customFields || {};
          const raw = cf['Module'];
          const modVal = Array.isArray(raw)
            ? raw.map(v => (v && v.name ? v.name : String(v)).toLowerCase())
            : [String(raw || '').toLowerCase()];
          return modVal.includes(modLower);
        });
      }
      // Filter by Priority — resolve via _priorityMap (list endpoint only returns id, not name)
      // priority value may be pipe-separated e.g. "high|medium"
      // Zephyr API uses "Normal" where the UI shows "Medium" — normalise before comparing
      if (priority) {
        const prioSet = priority.toLowerCase().split('|').map(p => p === 'medium' ? 'normal' : p);
        cases = cases.filter(tc => {
          const name = (tc.priority?.name || (tc.priority?.id ? (_priorityMap[tc.priority.id] || '') : '') || tc.priorityName || '').toLowerCase();
          return prioSet.some(p => name.includes(p));
        });
      }
      return cases;
    } catch (e) {
      console.error('[zcd] fetch test cases error:', e.message);
      return [];
    }
  }

  async function zcdPreviewCycleTests() {
    const cls       = ($id('zcd-cycle-class')    || {}).value || '';
    const modFilter = ($id('zcd-cycle-module')   || {}).value || '';
    const appFilter = ($id('zcd-cycle-app')      || {}).value || '';
    const priority  = ($id('zcd-cycle-priority') || {}).value || '';
    const btn    = $id('zcd-cycle-preview-btn');
    const list   = $id('zcd-cycle-tc-list');
    const count  = $id('zcd-cycle-tc-count');
    if (!Z.token) { if (count) count.textContent = 'Not connected'; return; }
    if (btn) { btn.disabled = true; btn.textContent = 'Loading…'; }
    if (list) { list.style.display = 'block'; list.innerHTML = '<em style="color:var(--text-muted)">Fetching…</em>'; }

    _cycleMatchedTests = await zcdFetchMatchingTests(modFilter, cls, appFilter, priority);

    if (count) count.textContent = `${_cycleMatchedTests.length} found`;
    if (list) {
      if (!_cycleMatchedTests.length) {
        list.innerHTML = '<em style="color:var(--text-muted)">No matching test cases found</em>';
      } else {
        list.innerHTML = _cycleMatchedTests.map(tc =>
          `<div style="padding:2px 0;border-bottom:1px solid var(--border);display:flex;gap:6px;">
            <span style="font-family:monospace;color:var(--cvs-red);font-size:10px;flex-shrink:0;">${tc.key}</span>
            <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${tc.name || ''}</span>
           </div>`
        ).join('');
      }
    }
    if (btn) { btn.disabled = false; btn.textContent = '↻ Fetch'; }
  }
  window.zcdPreviewCycleTests = zcdPreviewCycleTests;

  /* ══════════════════════════════════════════════════════════
     SET VIEW (sidebar nav click)
     ══════════════════════════════════════════════════════════ */
  function zephyrSetView(resource) {
    Z.resource = resource;
    Z.folderCache = {};
    Z.folderRendered = new Set();
    Z.rootCache = null;
    Z.itemStore = {};
    Z.allFolders = [];
    document.querySelectorAll('.zephyr-nav-item').forEach(n =>
      n.classList.toggle('active', n.dataset.zView === resource)
    );
    const t = $id('z-main-title');
    if (t) t.textContent = TITLES[resource] || resource;
    const fi = $id('z-search');
    if (fi) fi.value = '';
    $id('z-pagination').style.display = 'none';
    zephyrLoad();
  }
  window.zephyrSetView = zephyrSetView;

  /* ══════════════════════════════════════════════════════════
     MAIN LOAD — builds folder tree or flat list
     ══════════════════════════════════════════════════════════ */
  async function zephyrLoad() {
    Z.folderCache = {};
    Z.folderRendered = new Set();
    Z.rootCache = null;
    Z.itemStore = {};
    Z.allFolders = [];
    Z.bgLoadGeneration++;
    const fi = $id('z-search');
    if (fi) fi.value = '';
    $id('z-pagination').style.display = 'none';

    // Test executions have no folder concept — flat list
    if (Z.resource === 'testexecutions') {
      await loadFlatList();
      return;
    }

    const folderType = FOLDER_TYPE[Z.resource];
    showLoading(`Loading ${TITLES[Z.resource]} folders…`);

    const folders = await fetchAll('/folders', { folderType });
    if (!folders) return;
    Z.allFolders = folders;

    // Reset sidebar count to 0 — will increment as background load fills in
    const countEl = $id(`z-count-${Z.resource}`);
    if (countEl) countEl.textContent = '0';

    renderFolderTree(folders);

    // Kick off background loading of all folder item counts (non-blocking)
    backgroundLoadAllFolders(folders, Z.bgLoadGeneration);
  }
  window.zephyrLoad = zephyrLoad;

  /* ── background: fetch all folders concurrently, update counts as they arrive ── */
  async function backgroundLoadAllFolders(folders, generation) {
    const countEl = $id(`z-count-${Z.resource}`);
    let totalItems = 0;
    const BATCH = 5; // concurrent requests at a time

    for (let i = 0; i < folders.length; i += BATCH) {
      // Abort if a newer refresh has started
      if (Z.bgLoadGeneration !== generation) return;

      await Promise.all(
        folders.slice(i, i + BATCH).map(async folder => {
          if (Z.bgLoadGeneration !== generation) return;
          if (Z.folderCache[folder.id] !== undefined) {
            totalItems += Z.folderCache[folder.id].length;
            return;
          }

          const items = await fetchAll(ITEM_PATH[Z.resource], { folderId: folder.id });
          if (Z.bgLoadGeneration !== generation) return; // stale
          if (!items) { Z.folderCache[folder.id] = []; return; }

          Z.folderCache[folder.id] = items;
          items.forEach(item => { Z.itemStore[String(item.key || item.id)] = item; });
          totalItems += items.length;

          // Update the folder's own count badge
          const badge = $id(`zfc-${folder.id}`);
          if (badge) badge.textContent = items.length;

          // Update sidebar running total
          if (countEl) countEl.textContent = totalItems;
        })
      );
    }
  }

  /* ── flat list fallback (test executions) ── */
  async function loadFlatList() {
    showLoading('Loading Test Executions…');
    const items = await fetchAll(ITEM_PATH[Z.resource]);
    if (!items) return;
    items.forEach(i => { Z.itemStore[i.key || i.id] = i; });
    const c = $id('z-content');
    if (!c) return;
    if (!items.length) { c.innerHTML = '<div class="zephyr-empty"><div class="zephyr-empty-icon">📭</div><h3>No Executions</h3><p>No test executions found for this project.</p></div>'; return; }
    c.innerHTML = items.map(item => renderItemRow(item, 0)).join('');
    const countEl = $id(`z-count-${Z.resource}`);
    if (countEl) countEl.textContent = items.length;
  }

  /* ══════════════════════════════════════════════════════════
     FOLDER TREE RENDERING
     ══════════════════════════════════════════════════════════ */
  function buildTree(folders) {
    const map = {};
    folders.forEach(f => { map[f.id] = { ...f, children: [] }; });
    const roots = [];
    folders.forEach(f => {
      if (f.parentId && map[f.parentId]) map[f.parentId].children.push(map[f.id]);
      else roots.push(map[f.id]);
    });
    // Sort alphabetically at each level
    function sortNodes(nodes) { nodes.sort((a,b) => a.name.localeCompare(b.name)); nodes.forEach(n => sortNodes(n.children)); }
    sortNodes(roots);
    return roots;
  }

  function renderFolderTree(folders) {
    const c = $id('z-content');
    if (!c) return;
    if (!folders.length) {
      c.innerHTML = '<div class="zephyr-empty"><div class="zephyr-empty-icon">📂</div><h3>No Folders</h3><p>No folders found. Items may exist without folders.</p></div>';
      // Still offer to load root items
      c.innerHTML += `<div style="padding:12px;"><button class="btn btn-primary" style="font-size:12px;" onclick="zephyrLoadRoot()">Load items without folder</button></div>`;
      return;
    }
    const tree = buildTree(folders);
    c.innerHTML = `<div class="z-folder-tree">${renderNodes(tree, 0)}<div id="z-root-section"></div></div>`;
  }

  function renderNodes(nodes, depth) {
    return nodes.map(node => `
      <div class="z-folder-section" id="zfs-${node.id}" data-folder-id="${node.id}">
        <div class="z-folder-row" style="padding-left:${10 + depth * 18}px" onclick="zephyrToggleFolder(${node.id}, this)">
          <span class="z-folder-toggle">▶</span>
          <span class="z-folder-icon">📁</span>
          <span class="z-folder-name">${esc(node.name)}</span>
          <span class="z-folder-count" id="zfc-${node.id}">—</span>
        </div>
        <div class="z-folder-children" id="zfi-${node.id}">
          ${node.children.length ? renderNodes(node.children, depth + 1) : ''}
        </div>
      </div>`).join('');
  }

  /* ══════════════════════════════════════════════════════════
     TOGGLE FOLDER (expand / collapse)
     ══════════════════════════════════════════════════════════ */
  async function zephyrToggleFolder(folderId, rowEl) {
    const childrenEl = $id(`zfi-${folderId}`);
    if (!childrenEl) return;

    const isOpen = rowEl.classList.contains('open');
    if (isOpen) {
      rowEl.classList.remove('open');
      childrenEl.classList.remove('open');
      return;
    }

    rowEl.classList.add('open');
    childrenEl.classList.add('open');

    // Items already rendered in DOM — nothing to do
    if (Z.folderRendered.has(folderId)) return;

    const existingSubfolders = childrenEl.querySelectorAll('.z-folder-section');
    const insertRef = existingSubfolders.length
      ? existingSubfolders[existingSubfolders.length - 1].nextSibling
      : null;

    let items = Z.folderCache[folderId];

    if (items === undefined) {
      // Background hasn't fetched this folder yet — fetch inline with spinner
      const spinner = document.createElement('div');
      spinner.className = 'z-loading-items';
      spinner.innerHTML = `<div class="zephyr-spinner" style="width:14px;height:14px;border-width:2px;"></div><span>Loading items…</span>`;
      childrenEl.insertBefore(spinner, insertRef);
      rowEl.classList.add('loading');

      items = await fetchAll(ITEM_PATH[Z.resource], { folderId });
      rowEl.classList.remove('loading');
      spinner.remove();

      if (!items) { Z.folderCache[folderId] = []; items = []; }
      else {
        Z.folderCache[folderId] = items;
        items.forEach(i => { Z.itemStore[String(i.key || i.id)] = i; });
        // Update count badge (may have already been set by bg loader, but sync it)
        const badge = $id(`zfc-${folderId}`);
        if (badge) badge.textContent = items.length;
      }
    }

    // Render item rows from cache into the DOM
    Z.folderRendered.add(folderId);
    const depth = getDepth(folderId);
    if (!items.length) {
      childrenEl.insertAdjacentHTML('beforeend', `<div class="z-no-items">No items in this folder</div>`);
    } else {
      childrenEl.insertAdjacentHTML('beforeend',
        items.map(item => renderItemRow(item, depth)).join('')
      );
    }
  }
  window.zephyrToggleFolder = zephyrToggleFolder;

  function getDepth(folderId) {
    const folder = Z.allFolders.find(f => f.id === folderId);
    if (!folder || !folder.parentId) return 1;
    return 1 + getDepth(folder.parentId);
  }

  /* ── load items with no folder (root items) ── */
  async function zephyrLoadRoot() {
    const sec = $id('z-root-section');
    if (!sec) return;
    if (Z.rootCache !== null) return; // already loaded

    sec.innerHTML = `<div class="z-root-label">📄 Items without folder</div><div class="z-loading-items"><div class="zephyr-spinner" style="width:14px;height:14px;border-width:2px;"></div><span>Loading…</span></div>`;

    const items = await fetchAll(ITEM_PATH[Z.resource]);
    Z.rootCache = items || [];

    // Filter out items that belong to a folder already shown in the tree
    const folderIds = new Set(Z.allFolders.map(f => String(f.id)));
    const rootItems = Z.rootCache.filter(i => {
      const fid = i.folder?.id || i.folderId;
      return !fid || !folderIds.has(String(fid));
    });

    rootItems.forEach(i => { Z.itemStore[String(i.key || i.id)] = i; });

    sec.innerHTML = rootItems.length
      ? `<div class="z-root-label">📄 Items without folder (${rootItems.length})</div>${rootItems.map(i => renderItemRow(i, 1)).join('')}`
      : `<div class="z-root-label" style="color:var(--text-muted)">No items outside folders</div>`;
  }
  window.zephyrLoadRoot = zephyrLoadRoot;

  /* ══════════════════════════════════════════════════════════
     ITEM ROW
     ══════════════════════════════════════════════════════════ */
  function renderItemRow(item, depth) {
    const k = String(item.key || item.id || '');
    const name = esc(item.name || item.title || item.summary || '(untitled)');
    const status = String(item.status?.name || item.executionStatus || item.status || '');
    const priority = String(item.priority?.name || item.priority || '');
    const indent = 10 + depth * 18 + 18; // align with folder name
    return `<div class="z-item-row" style="padding-left:${indent}px" onclick="zephyrOpenItem('${esc(k).replace(/'/g,'\\\'')}')" data-key="${esc(k)}">
      <span class="z-item-key">${esc(k)}</span>
      <span class="z-item-name" title="${name}">${name}</span>
      <div class="z-item-badges">
        ${status ? `<span class="zephyr-badge ${statusClass(status)}" style="font-size:10px;padding:1px 5px;">${esc(status)}</span>` : ''}
        ${priority ? `<span class="zephyr-badge ${priorityClass(priority)}" style="font-size:10px;padding:1px 5px;">${esc(priority)}</span>` : ''}
      </div>
    </div>`;
  }

  /* ══════════════════════════════════════════════════════════
     EXPAND ALL
     ══════════════════════════════════════════════════════════ */
  async function zephyrExpandAll() {
    if (!Z.token) { alert('Connect first.'); return; }
    if (Z.resource === 'testexecutions') return;
    const folderSections = document.querySelectorAll('.z-folder-section[data-folder-id]');
    for (const sec of folderSections) {
      const folderId = parseInt(sec.dataset.folderId);
      const rowEl = sec.querySelector('.z-folder-row');
      if (rowEl && !rowEl.classList.contains('open')) {
        await zephyrToggleFolder(folderId, rowEl);
      }
    }
    // Also load root items
    zephyrLoadRoot();
  }
  window.zephyrExpandAll = zephyrExpandAll;

  /* ══════════════════════════════════════════════════════════
     FILTER — combines text search + priority + status dropdowns
     ══════════════════════════════════════════════════════════ */
  function applyAllFilters() {
    const q       = (($id('z-search')          || {}).value || '').toLowerCase().trim();
    const filterP = (($id('z-filter-priority') || {}).value || '').toLowerCase();
    const filterS = (($id('z-filter-status')   || {}).value || '').toLowerCase();
    const noFilters = !q && !filterP && !filterS;

    document.querySelectorAll('.z-folder-section').forEach(s => s.style.display = '');
    document.querySelectorAll('.z-no-items').forEach(s => s.style.display = '');

    document.querySelectorAll('.z-item-row').forEach(r => {
      if (noFilters) { r.style.display = ''; return; }
      const item = Z.itemStore[r.dataset.key] || {};
      const p = String(item.priority?.name || item.priority || '').toLowerCase();
      const s = String(item.status?.name || item.executionStatus || item.status || '').toLowerCase();
      let show = true;
      if (q && !r.textContent.toLowerCase().includes(q)) show = false;
      if (filterP && !filterP.split('|').map(fp => fp === 'medium' ? 'normal' : fp).some(fp => p.includes(fp))) show = false;
      if (filterS && !s.includes(filterS)) show = false;
      r.style.display = show ? '' : 'none';
    });

    if (!noFilters) {
      // Collapse folders that have no matching items or subfolders
      Array.from(document.querySelectorAll('.z-folder-section')).reverse().forEach(sec => {
        const items = sec.querySelectorAll(':scope > .z-folder-children > .z-item-row:not([style*="none"])');
        const subs  = sec.querySelectorAll(':scope > .z-folder-children > .z-folder-section:not([style*="none"])');
        sec.style.display = (items.length || subs.length) ? '' : 'none';
      });
    }
  }

  function zephyrFilterLocal()  { applyAllFilters(); }
  window.zephyrFilterLocal = zephyrFilterLocal;

  function zephyrApplyFilters() { applyAllFilters(); }
  window.zephyrApplyFilters = zephyrApplyFilters;

  // Stub — pagination not used in folder view
  function zephyrPage() {}
  window.zephyrPage = zephyrPage;
  function zephyrLoadAll() { zephyrExpandAll(); }
  window.zephyrLoadAll = zephyrLoadAll;

  /* ══════════════════════════════════════════════════════════
     DETAIL PANEL
     ══════════════════════════════════════════════════════════ */
  function zephyrOpenItem(key) {
    const item = Z.itemStore[key];
    if (!item) return;
    openDetailPanel(item);
  }
  window.zephyrOpenItem = zephyrOpenItem;

  function openDetailPanel(item) {
    const panel = $id('z-detail-panel');
    const body  = $id('z-detail-body');
    const keyEl = $id('z-detail-key');
    const nameEl= $id('z-detail-name');
    if (!panel || !body) return;

    // Highlight selected row
    document.querySelectorAll('.z-item-row.selected').forEach(r => r.classList.remove('selected'));
    const k = String(item.key || item.id || '');
    const row = document.querySelector(`.z-item-row[data-key="${CSS.escape(k)}"]`);
    if (row) row.classList.add('selected');

    if (keyEl) keyEl.textContent = k;
    if (nameEl) nameEl.textContent = item.name || item.title || item.summary || '';
    body.innerHTML = buildDetailHTML(item);
    panel.classList.add('open');

    if (Z.resource === 'testcases' && k) loadTestSteps(k, body);
  }

  function zephyrCloseDetail() {
    const p = $id('z-detail-panel');
    if (p) p.classList.remove('open');
    document.querySelectorAll('.z-item-row.selected').forEach(r => r.classList.remove('selected'));
  }
  window.zephyrCloseDetail = zephyrCloseDetail;

  function buildDetailHTML(item) {
    const rows = [];
    const add = (label, val) => {
      if (val !== undefined && val !== null && val !== '') {
        rows.push(`<tr><td class="zephyr-detail-label">${esc(label)}</td><td style="font-size:12px;">${esc(String(val))}</td></tr>`);
      }
    };
    add('Key', item.key || item.id);
    add('Name', item.name || item.title || item.summary);
    add('Status', item.status?.name || item.executionStatus || item.status);
    add('Priority', item.priority?.name || item.priority);
    add('Folder', item.folder?.name);
    add('Project', item.projectKey || item.project?.key);
    add('Owner', item.owner?.displayName || item.assignee?.displayName);
    add('Created On', fmtDate(item.createdOn || item.createdDate));
    add('Updated On', fmtDate(item.updatedOn || item.updatedDate));
    add('Planned Start', fmtDate(item.plannedStartDate));
    add('Planned End', fmtDate(item.plannedEndDate));
    add('Actual Start', fmtDate(item.actualStartDate));
    add('Actual End', fmtDate(item.actualEndDate));
    add('Objective', item.objective);
    add('Description', item.description);
    add('Precondition', item.precondition);
    add('Est. Time (ms)', item.estimatedTime);
    add('Labels', Array.isArray(item.labels) ? item.labels.join(', ') : item.labels);
    add('Components', Array.isArray(item.components) ? item.components.map(c => c.name || c).join(', ') : '');

    let html = `<table class="zephyr-detail-table"><tbody>${rows.join('')}</tbody></table>`;

    if (item.customFields && Object.keys(item.customFields).length) {
      const cfRows = Object.entries(item.customFields).map(([k,v]) =>
        `<tr><td class="zephyr-detail-label">${esc(k)}</td><td style="font-size:12px;">${esc(typeof v === 'object' ? JSON.stringify(v) : v)}</td></tr>`
      ).join('');
      html += `<h4 style="margin:16px 0 8px;font-size:12px;font-weight:700;color:var(--text)">Custom Fields</h4>
               <table class="zephyr-detail-table"><tbody>${cfRows}</tbody></table>`;
    }

    if (Z.resource === 'testcases') {
      html += `<div id="z-steps-placeholder" style="margin-top:16px;">
        <div class="zephyr-loading" style="padding:12px;gap:8px;">
          <div class="zephyr-spinner" style="width:16px;height:16px;border-width:2px;"></div>
          <span style="font-size:12px;">Loading test steps…</span>
        </div>
      </div>`;
    }
    return html;
  }

  async function loadTestSteps(key, container) {
    try {
      const params = new URLSearchParams({ token: Z.token });
      const res  = await fetch(`/api/zephyr/testcases/${encodeURIComponent(key)}/teststeps?${params}`);
      const data = await res.json();
      const ph   = container.querySelector('#z-steps-placeholder');
      if (!ph) return;
      const steps = data.values || data.testSteps || (Array.isArray(data) ? data : []);
      if (!steps.length) { ph.innerHTML = '<p style="font-size:12px;color:var(--text-muted);margin-top:12px;">No test steps defined.</p>'; return; }
      const rows = steps.map((s,i) => `<tr>
        <td style="width:28px;text-align:center;font-weight:600;">${i+1}</td>
        <td>${esc(s.inline?.description || s.description || s.step || '')}</td>
        <td>${esc(s.inline?.testData || s.testData || s.data || '')}</td>
        <td>${esc(s.inline?.expectedResult || s.expectedResult || s.result || '')}</td>
      </tr>`).join('');
      ph.innerHTML = `<h4 style="margin:16px 0 8px;font-size:12px;font-weight:700;color:var(--text)">Test Steps</h4>
        <table class="zephyr-steps-table">
          <thead><tr><th>#</th><th>Description</th><th>Test Data</th><th>Expected Result</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`;
    } catch(_) { /* silent */ }
  }

  /* ══════════════════════════════════════════════════════════
     KEYBOARD
     ══════════════════════════════════════════════════════════ */
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') zephyrCloseDetail();
  });
})();
