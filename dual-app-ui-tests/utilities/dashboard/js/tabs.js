// ── Tabs ──────────────────────────────────────────────────────────────────────
// ── Tabs ──────────────────────────────────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('tab-' + tab.dataset.tab).classList.add('active');
    
    // Toggle report panel visibility for Test Map tab (needs full width)
    const panelLeft = document.querySelector('.panel-left');
    const reportPanel = document.getElementById('report-panel');
    if (tab.dataset.tab === 'testmap' || tab.dataset.tab === 'zephyr') {
      reportPanel.classList.add('hidden');
      panelLeft.classList.add('fullwidth');
      if (tab.dataset.tab === 'zephyr') zephyrAutoInit();
    } else if (tab.dataset.tab === 'run') {
      reportPanel.classList.remove('hidden');
      panelLeft.classList.remove('fullwidth');
    } else {
      // Hide report panel for all other tabs
      reportPanel.classList.add('hidden');
      panelLeft.classList.remove('fullwidth');
    }
  });
});

// ── Test Map iframe handlers ──────────────────────────────────────────────────

function handleTestMapError() {
  const iframe = document.getElementById('testmap-iframe');
  const error = document.getElementById('testmap-error');
  iframe.style.display = 'none';
  error.style.display = 'flex';
}

function retryTestMap() {
  const iframe = document.getElementById('testmap-iframe');
  const error = document.getElementById('testmap-error');
  const btn = error.querySelector('button');
  if (btn) { btn.disabled = true; btn.textContent = 'Checking…'; }
  fetch('http://localhost:3030/api/graph')
    .then(r => {
      if (r.ok) {
        error.style.display = 'none';
        iframe.src = 'http://localhost:3030';
        iframe.style.display = 'block';
      } else {
        handleTestMapError();
      }
    })
    .catch(() => handleTestMapError())
    .finally(() => {
      if (btn) { btn.disabled = false; btn.textContent = '🔄 Retry Connection'; }
    });
}

// Probe ui-state-mapper with retries (server starts async alongside Electron)
function probeTestMap(attemptsLeft) {
  if (attemptsLeft === undefined) attemptsLeft = 8;
  const iframe = document.getElementById('testmap-iframe');
  if (iframe.style.display === 'block') return;
  fetch('http://localhost:3030/api/graph')
    .then(r => {
      if (r.ok) {
        document.getElementById('testmap-error').style.display = 'none';
        iframe.src = 'http://localhost:3030';
        iframe.style.display = 'block';
      } else if (attemptsLeft > 0) {
        setTimeout(() => probeTestMap(attemptsLeft - 1), 1000);
      } else {
        handleTestMapError();
      }
    })
    .catch(() => {
      if (attemptsLeft > 0) {
        setTimeout(() => probeTestMap(attemptsLeft - 1), 1000);
      } else {
        handleTestMapError();
      }
    });
}

// Check if Test Map server is running on tab switch
document.querySelector('[data-tab="testmap"]').addEventListener('click', () => {
  const iframe = document.getElementById('testmap-iframe');
  if (iframe.style.display === 'block') return; // already loaded, skip probe
  probeTestMap(8); // retry up to 8 times (1s apart) while server boots
});


// ── Collapsible sections ─────────────────────────────────────────────────────
document.querySelectorAll('.section-header').forEach(header => {
  const chev = document.createElement('span');
  chev.className = 'chev';
  chev.textContent = '▾';
  header.appendChild(chev);
  header.addEventListener('click', () => {
    header.parentElement.classList.toggle('collapsed');
  });
});

// ── Tab switch hook — run setup checks when Setup tab activated ──────────────
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    if (tab.dataset.tab === 'setup') {
      // Only run setup checks if they haven't been run recently (within last 30 seconds)
      const lastCheck = localStorage.getItem('setupChecksLastRun');
      const now = Date.now();
      if (!lastCheck || (now - parseInt(lastCheck)) > 30000) {
        runSetupChecks();
        localStorage.setItem('setupChecksLastRun', now.toString());
      }
    }
  });
});

// ── Resizable panel divider ──────────────────────────────────────────────────
(function() {
  const resizer = document.getElementById('panel-resizer');
  const panelLeft = document.querySelector('.panel-left');
  
  if (!resizer || !panelLeft) {
    console.warn('Panel resizer or panel-left not found');
    return;
  }
  
  let isResizing = false;
  let startX = 0;
  let startWidth = 0;

  resizer.addEventListener('mousedown', (e) => {
    isResizing = true;
    startX = e.clientX;
    startWidth = panelLeft.getBoundingClientRect().width;
    resizer.classList.add('active');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    const dx = e.clientX - startX;
    const newWidth = Math.max(320, Math.min(startWidth + dx, window.innerWidth - 280));
    panelLeft.style.width = newWidth + 'px';
  });

  document.addEventListener('mouseup', () => {
    if (!isResizing) return;
    isResizing = false;
    resizer.classList.remove('active');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });
})();

// ── Device Recovery ───────────────────────────────────────────────────────────
async function refreshDevice() {
  const platform = document.querySelector('[data-group="platform"].active')?.dataset.val || 'android';
  const device = state.device || '';
  const btn = event.target;
  const originalText = btn.textContent;

  btn.disabled = true;
  btn.textContent = '⏳ Refreshing...';

  try {
    const res = await fetch('/api/refresh-device', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform, device })
    });

    if (!res.ok) throw new Error('Failed to start refresh');

    const { jobId } = await res.json();

    // Stream output to terminal
    const termOutput = document.querySelector('.term-output');
    const termStatus = document.querySelector('.term-status');
    const termTitle = document.querySelector('.term-title');

    openTermDrawer();
    termTitle.textContent = `Device Recovery (${platform.toUpperCase()})`;
    termStatus.textContent = 'running';
    termStatus.className = 'term-status running';
    termOutput.textContent = '';

    const eventSource = new EventSource(`/api/stream/${jobId}`);

    eventSource.onmessage = (e) => {
      const msg = JSON.parse(e.data);

      if (msg.type === 'stdout' || msg.type === 'stderr') {
        const line = document.createElement('div');
        line.className = msg.type === 'stderr' ? 'line-stderr' : 'line-stdout';
        line.textContent = msg.data;
        termOutput.appendChild(line);
        termOutput.scrollTop = termOutput.scrollHeight;
      } else if (msg.type === 'done') {
        eventSource.close();
        termStatus.textContent = msg.data.code === 0 ? 'success' : 'error';
        termStatus.className = `term-status ${msg.data.code === 0 ? 'success' : 'error'}`;
        btn.disabled = false;
        btn.textContent = originalText;
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      termStatus.textContent = 'error';
      termStatus.className = 'term-status error';
      btn.disabled = false;
      btn.textContent = originalText;
    };
  } catch (err) {
    console.error('Refresh failed:', err);
    btn.disabled = false;
    btn.textContent = originalText;
    alert('Failed to refresh device: ' + err.message);
  }
}

