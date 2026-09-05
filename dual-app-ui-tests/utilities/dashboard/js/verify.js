// ── Verify checks ────────────────────────────────────────────────────────────

async function runCheck(row) {
  const id = row.id.replace('chk-', '');
  const cmd = row.dataset.cmd;
  const isCountOk = row.dataset.countOk === 'true';
  const icon = row.querySelector('.chk-icon');
  const out = row.querySelector('.chk-output');

  icon.textContent = '⏳';
  out.textContent = '';
  row.classList.remove('chk-ok', 'chk-fail');

  try {
    const res = await fetch('/api/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cmd, timeout: 10000 })
    });
    const data = await res.json();
    let ok = data.ok;
    const output = (data.output || '').trim();

    if (isCountOk) {
      const n = parseInt(output, 10);
      ok = !isNaN(n) && n > 0;
    }
    if (['chk-emulator','chk-simbooted','chk-cvs-ios','chk-h100-ios','chk-cvs-android'].includes(row.id)) {
      ok = output.length > 0 && output !== '0';
    }

    icon.textContent = ok ? '✅' : '❌';
    row.classList.add(ok ? 'chk-ok' : 'chk-fail');
    out.textContent = output.split('\n')[0].slice(0, 60) || (ok ? 'OK' : 'Not found');
    return ok;
  } catch (e) {
    icon.textContent = '❌';
    row.classList.add('chk-fail');
    out.textContent = 'Error';
    return false;
  }
}

async function runAllChecks() {
  const rows = [...document.querySelectorAll('.check-row')];
  const summary = document.getElementById('verify-summary');
  summary.textContent = 'Running…';

  const results = await Promise.all(rows.map(row => runCheck(row)));
  const passed = results.filter(Boolean).length;
  const total = results.length;
  summary.textContent = `${passed}/${total} passed`;
  summary.style.color = passed === total ? 'var(--green)' : passed > total * 0.6 ? 'var(--yellow)' : '#ff6b6b';
}

