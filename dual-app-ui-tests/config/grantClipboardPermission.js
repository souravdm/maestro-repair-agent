/**
 * Grant Clipboard (Pasteboard) Permission for iOS Simulator
 *
 * Inserts a kTCCServicePasteboard record directly into the simulator's TCC
 * database so the app is pre-authorised to read the clipboard. This completely
 * prevents the "Allow Paste" alert from appearing during tests.
 *
 * Background:
 *   - iOS 16+ shows an "Allow Paste" alert whenever an app reads UIPasteboard.
 *   - `xcrun simctl privacy grant all` does NOT cover kTCCServicePasteboard,
 *     so Maestro's built-in `permissions: all: allow` cannot suppress this alert.
 *   - Writing directly to the TCC.db for the booted simulator is the only
 *     reliable way to pre-grant this permission before the app first launches.
 *
 * Called from: .maestro/subflows/Common/launchApp.yaml (after clearState)
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

// APP_ID is injected by the calling YAML via the env block
const appId = (typeof APP_ID !== 'undefined' && APP_ID)
  ? String(APP_ID)
  : 'com.cvsenterpriseiphone.cvspharmacy';

function getBootedSimulatorUdid() {
  try {
    const output = execSync('xcrun simctl list devices 2>/dev/null', { encoding: 'utf8' });
    const match = output.match(/\(Booted\).*?([A-F0-9]{8}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{12})/i)
      || output.match(/([A-F0-9]{8}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{12})[^\n]*\(Booted\)/i);
    if (match) return match[1];
    // Fallback: first UUID on a "Booted" line
    const lines = output.split('\n').filter(l => l.includes('(Booted)'));
    if (lines.length > 0) {
      const m = lines[0].match(/([A-F0-9]{8}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{12})/i);
      if (m) return m[1];
    }
    return null;
  } catch (e) {
    return null;
  }
}

function grantClipboardPermission() {
  const simUdid = getBootedSimulatorUdid();
  if (!simUdid) {
    console.log('⚠️  No booted iOS simulator found – skipping clipboard permission grant');
    return;
  }

  const tccDb = path.join(
    os.homedir(),
    'Library', 'Developer', 'CoreSimulator', 'Devices',
    simUdid, 'data', 'Library', 'TCC', 'TCC.db'
  );

  if (!fs.existsSync(tccDb)) {
    console.log(`⚠️  TCC database not found at ${tccDb} – skipping clipboard permission grant`);
    return;
  }

  // auth_value 2 = allow, auth_reason 4 = system-set, client_type 0 = bundleID
  const sql = `INSERT OR REPLACE INTO access ` +
    `(service, client, client_type, auth_value, auth_reason, auth_version) ` +
    `VALUES ('kTCCServicePasteboard', '${appId}', 0, 2, 4, 1);`;

  try {
    execSync(`sqlite3 "${tccDb}" "${sql}"`, { encoding: 'utf8', stdio: 'pipe' });
    console.log(`✅ Clipboard permission pre-granted for ${appId} (simulator ${simUdid})`);
  } catch (e) {
    console.log(`⚠️  Could not write to TCC database: ${e.message}`);
    console.log('    "Allow Paste" alert may still appear but will be handled by the flow.');
  }
}

grantClipboardPermission();
