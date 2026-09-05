// network-toggle.js
// Blocks/unblocks HTTP/HTTPS for iOS Simulator network tests.
//
// Requires proxy_server.py running (started by run-maestro-h100-ios.sh).
// Sends /block or /unblock to the control endpoint on MAESTRO_PROXY_PORT+1.
//
// Usage:
//   runScript:
//     file: ../../config/network-toggle.js
//     env:
//         NETWORK_ACTION: block    # or: unblock

var action = '';
try { action = (typeof NETWORK_ACTION !== 'undefined' && NETWORK_ACTION) ? String(NETWORK_ACTION) : ''; } catch (e) {}

var proxyPort = '';
try { proxyPort = (typeof MAESTRO_PROXY_PORT !== 'undefined' && MAESTRO_PROXY_PORT) ? String(MAESTRO_PROXY_PORT) : ''; } catch (e) {}

if (proxyPort) {
    var controlPort = String(parseInt(proxyPort, 10) + 1);
    var controlBase = 'http://127.0.0.1:' + controlPort;

    if (action === 'block') {
        try { http.get(controlBase + '/block'); } catch(e) {}
        output.network_blocked = true;
    } else if (action === 'unblock') {
        try { http.get(controlBase + '/unblock'); } catch(e) {}
        output.network_blocked = false;
    }
} else {
    // No control server configured — run via ./scripts/run-maestro-h100-ios.sh
    output.network_blocked = (action === 'block');
}
