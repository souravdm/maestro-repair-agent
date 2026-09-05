// ── Setup step pre-verification ─────────────────────────────────────────────

const SETUP_CHECKS = {
  'setup-maestro':     { cmd: 'maestro --version' },
  'setup-nodedeps':    { cmd: 'test -d node_modules && echo "$(ls node_modules | wc -l | tr -d \' \') packages"' },
  'setup-ios-sim':     { cmd: 'xcrun simctl list devices available 2>/dev/null | grep -c iPhone', countOk: true },
  'setup-android-sdk': { cmd: 'test -n "$ANDROID_HOME" && echo "$ANDROID_HOME"' },
  'setup-wrapper':     { cmd: 'test -f ~/bin/maestro && echo "wrapper present" || (which maestro | grep -v "/usr/local" | head -1)', optional: true },
  'setup-ios':         { cmd: 'xcrun simctl listapps booted 2>/dev/null | grep cvspharmacy | head -1' },
  'setup-android':     { cmd: 'adb shell pm list packages 2>/dev/null | grep "com.cvs" | head -1' },
};

// Setup check batching and prioritization
const SETUP_CHECK_PRIORITY = {
  'setup-maestro': 1,      // High priority - core dependency
  'setup-nodedeps': 2,     // High priority - required for functionality
  'setup-ios-sim': 3,      // Medium priority - platform specific
  'setup-android': 4,      // Medium priority - platform specific
  'setup-wrapper': 5       // Low priority - optional
};

async function checkSetupStep(id) {
  const cfg  = SETUP_CHECKS[id];
  const icon = document.getElementById(id + '-icon');
  const ver  = document.getElementById(id + '-ver');
  const btn  = document.getElementById(id + '-btn');
  const card = document.getElementById(id);

  if (!icon || !card) return;

  // Batch DOM updates
  const updates = [];
  
  updates.push(() => {
    icon.textContent = '⏳';
    card.classList.remove('step-done', 'step-fail');
  });

  // Apply initial updates
  requestAnimationFrame(() => {
    updates.forEach(update => update());
  });

  try {
    const res  = await fetch('/api/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cmd: cfg.cmd, timeout: 10000 })
    });
    const data   = await res.json();
    const output = (data.output || '').trim();

    let ok = data.ok && output.length > 0 && output !== '0';
    if (cfg.countOk) {
      const n = parseInt(output, 10);
      ok = !isNaN(n) && n > 0;
    }

    // Batch result updates
    const resultUpdates = [];
    
    if (ok) {
      resultUpdates.push(() => {
        icon.textContent = '✅';
        card.classList.add('step-done');
        if (ver) ver.textContent = output.split('\n')[0].slice(0, 60);
        // Optional steps: always keep button enabled even when check passes
        if (btn && !cfg.optional) {
          btn.disabled = true;
          btn.title    = 'Already complete';
        }
      });
    } else {
      resultUpdates.push(() => {
        icon.textContent = cfg.optional ? '⬜' : '❌';
        if (!cfg.optional) card.classList.add('step-fail');
        if (ver) ver.textContent = '';
        if (btn) { 
          btn.disabled = false; 
          btn.removeAttribute('title'); 
        }
      });
    }

    // Apply result updates in next animation frame
    requestAnimationFrame(() => {
      resultUpdates.forEach(update => update());
    });

  } catch (_) {
    // Batch error updates
    requestAnimationFrame(() => {
      icon.textContent = cfg.optional ? '⬜' : '❌';
      if (!cfg.optional) card.classList.add('step-fail');
      if (btn) btn.disabled = false;
    });
  }
}

async function runSetupChecks() {
  // Sort checks by priority
  const sortedIds = Object.keys(SETUP_CHECKS).sort((a, b) => {
    const priorityA = SETUP_CHECK_PRIORITY[a] || 999;
    const priorityB = SETUP_CHECK_PRIORITY[b] || 999;
    return priorityA - priorityB;
  });

  // Run checks with controlled concurrency (max 2 at a time)
  const maxConcurrency = 2;
  const results = [];
  
  for (let i = 0; i < sortedIds.length; i += maxConcurrency) {
    const batch = sortedIds.slice(i, i + maxConcurrency);
    const batchPromises = batch.map(id => checkSetupStep(id));
    
    // Wait for current batch before starting next
    await Promise.all(batchPromises);
    
    // Small delay between batches to prevent overwhelming
    if (i + maxConcurrency < sortedIds.length) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
  
  return results;
}

function runSetupStep(id, cmd, label) {
  runCmd(cmd, label);
  // Re-verify after a delay once command stream ends
  const observer = new MutationObserver(() => {
    const status = document.getElementById('term-status');
    if (status && (status.classList.contains('success') || status.classList.contains('error'))) {
      observer.disconnect();
      setTimeout(() => checkSetupStep(id), 800);
    }
  });
  observer.observe(document.getElementById('term-status'), { attributes: true, attributeFilter: ['class'] });
}

function runIOSSetup() {
  const device = state.device || '';
  const deviceSelect = document.getElementById('device-select');
  const selectedValue = deviceSelect?.value || '';
  
  console.log('[runIOSSetup] state.device:', device, 'dropdown value:', selectedValue);
  
  let cmd = 'bash scripts/setup/ios-setup.sh boot';
  const finalDevice = device || selectedValue;
  
  if (finalDevice) {
    // Escape device name for shell
    const escapedDevice = finalDevice.replace(/'/g, "'\\''");
    cmd += ` '${escapedDevice}'`;
    console.log('[runIOSSetup] Using device:', finalDevice, 'Command:', cmd);
  } else {
    console.warn('[runIOSSetup] No device selected, using default');
  }
  runSetupStep('setup-ios-sim', cmd, 'iOS Simulator Setup');
}
