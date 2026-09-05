// ── Terminal drawer ──────────────────────────────────────────────────────────
function toggleTermDrawer() {
  const drawer = document.getElementById('term-drawer');
  const layout = document.querySelector('.layout');
  drawer.classList.toggle('expanded');
  layout.classList.toggle('term-expanded');
}
function openTermDrawer() {
  const drawer = document.getElementById('term-drawer');
  const layout = document.querySelector('.layout');
  drawer.classList.add('expanded');
  layout.classList.add('term-expanded');
}

// ── Report viewer ─────────────────────────────────────────────────────────────
async function loadLatestReport() {
  const iframe = document.getElementById('report-iframe');
  const placeholder = document.getElementById('report-placeholder');
  const status = document.getElementById('report-status');
  try {
    const data = await fetch('/api/latest-report').then(r => r.json());
    if (data.url) {
      const ts = data.timestamp ? new Date(data.timestamp).toLocaleTimeString() : '';
      status.textContent = ts ? 'Updated ' + ts : '';
      if (iframe.src !== window.location.origin + data.url) {
        iframe.src = data.url;
      } else {
        iframe.contentWindow && iframe.contentWindow.location.reload();
      }
      iframe.style.display = 'block';
      placeholder.style.display = 'none';
    } else {
      iframe.style.display = 'none';
      placeholder.style.display = 'flex';
      status.textContent = 'No reports found';
    }
  } catch (e) {
    status.textContent = 'Error loading report';
  }
}
function openReportExternal() {
  const iframe = document.getElementById('report-iframe');
  if (iframe.src && iframe.src !== 'about:blank' && !iframe.src.endsWith('/')) {
    window.open(iframe.src, '_blank');
  } else {
    fetch('/api/latest-report').then(r => r.json()).then(d => { if (d.url) window.open(d.url, '_blank'); });
  }
}

