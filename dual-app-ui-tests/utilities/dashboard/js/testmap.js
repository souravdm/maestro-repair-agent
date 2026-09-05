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

