# Network Capture - Complete Guide

**Status:** ✅ Production Ready (April 2026)  
**Platforms:** iOS & Android  
**Apps:** CVSOnlineiPhone, Health100, Android apps

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [How It Works](#how-it-works)
3. [What Gets Captured](#what-gets-captured)
4. [Implementation Details](#implementation-details)
5. [Manual Capture](#manual-capture)
6. [Querying API Call Data](#querying-api-call-data)
7. [Troubleshooting](#troubleshooting)
8. [Advanced Options](#advanced-options)
9. [Technical Architecture](#technical-architecture)
10. [Migration Notes](#migration-notes)

---

## Quick Start

### Run Tests with Network Capture

**Option 1: iOS Logs (Automatic, URLs redacted)**
```bash
./scripts/testing/test.sh .maestro/flows/Account/login-and-logout.yaml --network-capture
```

**Option 2: App Internal Logs (Full URLs, DEBUG builds only)**
```bash
./scripts/testing/test.sh .maestro/flows/Account/login-and-logout.yaml --network-debugger
```

**Option 3: Both (Recommended for DEBUG builds)**
```bash
./scripts/testing/test.sh .maestro/flows/Account/login-and-logout.yaml --network-capture --network-debugger
```

**Android:**
```bash
./scripts/testing/test.sh .maestro/flows/Account/login-and-logout.yaml --platform android --network-capture
```

### View Results

Network calls are automatically included in the HTML test report:
```
test-reports/IOS_20260408_123456/test-report-IOS-20260408_123456.html
```

### Expected Output

```
📡 Starting network capture from simulator...
   Device: 50E4578E-CED8-40BE-A546-28A44A4025F7
   App: com.cvsenterpriseiphone.health100
✅ Network capture started (PID: 12345)

... test runs ...

Parsing network logs...
📱 Parsing iOS network logs...
✅ Captured 15 network calls
   Successful: 14
   Failed: 1
   Avg response time: 285ms
   File: test-reports/IOS_20260408_123456/network/api-calls.json
```

---

## How It Works

### Overview

Network capture uses **native iOS/Android logging** - no code injection or app modifications required!

### iOS Network Capture

**Method:** Native CFNetwork logging via `xcrun simctl`

1. **Capture Phase** - Start logging during test execution
   ```bash
   xcrun simctl spawn <device-id> log stream \
     --predicate "processImagePath CONTAINS \"<app-id>\" AND subsystem == \"com.apple.CFNetwork\"" \
     --level debug
   ```

2. **Parse Phase** - Extract API calls from logs
   - Parses CFNetwork task logs
   - Extracts URLs, methods, status codes, response times
   - Filters CVS/Health100 domains only
   - Excludes static assets (images, fonts, analytics)

3. **Report Phase** - Generate JSON for HTML report
   ```json
   {
     "summary": {
       "totalCalls": 15,
       "successfulCalls": 14,
       "failedCalls": 1,
       "avgResponseTime": 285
     },
     "calls": [...]
   }
   ```

### App Internal Log Extraction (Full URLs)

**Method:** Read directly from app's internal debug logs

**Advantages:**
- ✅ **Full URLs** (not redacted like iOS logs)
- ✅ **Exact HTTP methods**
- ✅ **Complete endpoint paths**
- ✅ **No UI interaction needed** (simple and fast)
- ✅ **Works automatically** (no shaking or tapping)

**Requirements:**
- **DEBUG builds only** (production builds don't log network calls)
- App must store network logs in internal storage
- Common frameworks: Proxyman, Charles, or custom logging

**How it works:**

1. **Locate app container** - Find the app's data directory
   ```bash
   xcrun simctl get_app_container <udid> <app-id> data
   ```

2. **Search for network logs** - Check common locations:
   - `Library/Preferences/<app-id>.plist` (UserDefaults)
   - `Library/Caches/NetworkLogs.json`
   - `Documents/network-logs.json`
   - Custom app-specific paths

3. **Parse and normalize** - Convert to standard format
   ```javascript
   {
     method: "POST",
     url: "https://www-qa2.cvs.com/api/v1/login",
     status: 201,
     responseTime: 421
   }
   ```

4. **Merge with iOS logs** - Combine for complete coverage
   - App internal calls have full URLs
   - iOS log calls fill in any gaps
   - Duplicates removed automatically

**For Production Builds:**

Use `--network-capture` flag instead (iOS logs only):
```bash
./scripts/testing/test.sh test.yaml --network-capture
```

### Android Network Capture

**Method:** OkHttp logging via `adb logcat`

1. **Capture Phase** - Log OkHttp interceptor output
   ```bash
   adb logcat -s "OkHttp:D" "HttpLoggingInterceptor:D"
   ```

2. **Parse Phase** - Extract API calls from logcat
   - Parses OkHttp request/response logs
   - Extracts timing and status information
   - Same filtering as iOS

3. **Report Phase** - Same JSON format as iOS

**Requirement:** App must have OkHttp logging interceptor enabled in DEBUG builds (standard practice).

---

## What Gets Captured

### ✅ Captured Data

- **HTTP Methods:** GET, POST (inferred from request body size)
- **URLs:** Redacted by iOS for privacy (shows as `<URL redacted by iOS>`)
- **Status Codes:** 200, 201, 400, 404, 500, 504, etc.
- **Response Times:** Milliseconds
- **Timestamps:** When each call occurred
- **Task IDs:** For correlation and debugging

### ❌ Not Captured (By Design)

- **Request/Response Bodies:** Too large for logs, privacy concerns
- **Headers:** Privacy/security concerns
- **Static Assets:** Images, fonts, CSS, JS
- **Analytics:** Google Analytics, Firebase, Datadog
- **CDN Requests:** cdn.*, static.*, assets.*

### 🎯 Filtered Domains

Only captures calls to:
- `*.cvs.com`
- `*.cvshealth.com`
- `*.caremark.com`
- `*.aetna.com`
- `*.health100.com`

All other domains are filtered out.

---

## Implementation Details

### File Structure

```
scripts/network/
├── parse-network-logs.js          # ⭐ Main parser (iOS & Android system logs)
├── extract-app-internal-logs.js   # ⭐ App internal debugger extractor
└── capture-network-logs.js        # Legacy fallback parser

scripts/testing/test.sh                    # Main test runner (uses --network-capture flag)

test-reports/*/network/
├── simulator-network.log        # Raw iOS logs
├── android-network.log          # Raw Android logs
└── api-calls.json              # Parsed output
```

### Integration Points

**1. test.sh (Main Test Runner)**
- Line 768-800: Start network capture
- Line 1188-1203: Parse network logs
- Passes `--network-capture` flag to enable

**2. parse-network-logs.js (Universal Parser)**
- Handles iOS CFNetwork logs
- Handles Android OkHttp logs
- Filters CVS/Health100 domains
- Generates api-calls.json

**3. generate-unified-report.js (HTML Report)**
- Reads api-calls.json
- Displays network calls in report
- Shows success/failure metrics

### Example Output

**Console Output**

```
📱 Parsing iOS network logs...
✅ Captured 83 network calls
   Successful: 74
   Failed: 9
   Avg response time: 1033ms
   File: test-reports/IOS_20260408_165806/network/api-calls.json
```

**JSON Output (`api-calls.json`)**

**Note:** iOS redacts URLs for privacy. Calls are identified by Task ID and status/timing.

```json
{
  "timestamp": "2026-04-09T15:58:36.643Z",
  "source": "network-logs",
  "summary": {
    "totalCalls": 83,
    "successfulCalls": 74,
    "failedCalls": 9,
    "avgResponseTime": 1033
  },
  "calls": [
    {
      "method": "POST",
      "endpoint": "API Call (Task 9)",
      "url": "<URL redacted by iOS>",
      "status": 201,
      "responseTime": 85,
      "timestamp": "2026-04-08 16:58:06"
    },
    {
      "method": "HTTP",
      "endpoint": "API Call (Task 1)",
      "url": "<URL redacted by iOS>",
      "status": 504,
      "responseTime": 8480,
      "timestamp": "2026-04-08 16:58:10"
    },
    {
      "method": "GET",
      "endpoint": "API Call (Task 5)",
      "url": "<URL redacted by iOS>",
      "status": 200,
      "responseTime": 156,
      "timestamp": "2026-04-08 16:58:11"
    }
  ]
}
```

**HTML Report:**
```
Network Calls (15 total, 1 failed)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Method  Endpoint                    Status  Time    Timestamp
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
POST    /api/v1/auth/login          201     421ms   17:05:33
GET     /api/v1/user/profile        200     156ms   17:05:34
POST    /api/v1/prescriptions       404     293ms   17:05:35  ❌
GET     /api/v1/stores/nearby       200     178ms   17:05:36
...
```

---

## Manual Capture

If you need to capture API calls outside of the automatic `scripts/testing/test.sh` pipeline, use `capture-system-logs.sh` directly.

### Command Reference

```bash
# Start capturing logs
./scripts/capture-system-logs.sh start <test-name>

# Stop capturing and parse logs
./scripts/capture-system-logs.sh stop <test-name>

# Parse an existing log file
./scripts/capture-system-logs.sh parse <log-file> <test-name>

# Clear previous API calls
./scripts/capture-system-logs.sh clear

# Show current configuration (bundle ID, report directory)
./scripts/capture-system-logs.sh info

# Show help
./scripts/capture-system-logs.sh help
```

### Manual Workflow

```bash
# Terminal 1: Start capture
./scripts/capture-system-logs.sh start test_simple_login

# Terminal 2: Run test
maestro test .maestro/flows/Account/login-and-logout.yaml

# Terminal 1: Stop capture (Ctrl+C or new terminal)
./scripts/capture-system-logs.sh stop test_simple_login
```

Logs are written to `test-reports/logs/{test_name}_api.log` and parsed into `test-reports/api-calls.json`.

---

## Querying API Call Data

The `api-calls.json` file supports structured queries with `jq`. These examples assume per-test output (as produced by `auto-api-capture.sh` or `capture-system-logs.sh`).

### View API Call Summary

```bash
# Total API calls for a test
jq '.tests.test_simple_login.summary.totalCalls' test-reports/api-calls.json

# Successful vs failed
jq '.tests.test_simple_login.summary | {successful: .successfulCalls, failed: .failedCalls}' \
  test-reports/api-calls.json

# Average response time
jq '.tests.test_simple_login.summary.avgResponseTime' test-reports/api-calls.json

# All unique endpoints called
jq '.tests.test_simple_login.summary.endpoints' test-reports/api-calls.json
```

### Filter API Calls by Status

```bash
# View only successful API calls (2xx-3xx)
jq '.tests.test_simple_login.apiCalls[] | select(.statusCode >= 200 and .statusCode < 400)' \
  test-reports/api-calls.json

# View only failed API calls (4xx-5xx)
jq '.tests.test_simple_login.apiCalls[] | select(.statusCode >= 400)' \
  test-reports/api-calls.json
```

### Find Slow API Calls

```bash
# Find API calls slower than 500ms across all tests
jq '.tests[].apiCalls[] | select(.responseTime > 500)' test-reports/api-calls.json
```

### Generate API Performance Report

```bash
# Create a per-test performance summary
jq '.tests | to_entries[] | {
  test: .key,
  totalCalls: .value.summary.totalCalls,
  successful: .value.summary.successfulCalls,
  failed: .value.summary.failedCalls,
  avgResponseTime: .value.summary.avgResponseTime,
  endpoints: .value.summary.endpoints
}' test-reports/api-calls.json
```

---

## Troubleshooting

### Issue: No Network Calls Captured

**Symptom:**
```
✓ API calls file created (no calls captured)
```

**Solutions:**

**1. Check simulator/emulator is running**
```bash
# iOS
xcrun simctl list devices | grep Booted

# Android
adb devices
```

**2. Verify app is making network calls**
- Open app manually
- Perform actions that should trigger API calls
- Check if app shows data

**3. Check log file has content**
```bash
# iOS
ls -lh test-reports/*/network/simulator-network.log
tail -f test-reports/*/network/simulator-network.log

# Android
ls -lh test-reports/*/network/android-network.log
```

**4. Verify app bundle ID is correct**
```bash
# Check build_config.yaml
grep bundle_id build_config.yaml

# Should match your app:
# CVSOnlineiPhone: com.cvsenterpriseiphone.cvsonline
# Health100: com.cvsenterpriseiphone.health100
```

**5. Check CFNetwork logs are being captured**
```bash
# During test execution, in another terminal:
tail -f test-reports/*/network/simulator-network.log | grep -i "task\|http"
# Should show CFNetwork logs
```

**6. Verify parser is running**
```bash
# Check test output for:
Parsing network logs...
📱 Parsing iOS network logs...
```

### Issue: Wrong App Being Monitored

**Symptom:** Logs show activity from wrong app

**Solution:** Update `APP_ID` in test command or `build_config.yaml`

```bash
# Option 1: Use APP_ID from build_config.yaml (automatic)
./scripts/testing/test.sh test.yaml --network-capture

# Option 2: Override APP_ID
maestro test test.yaml --env APP_ID="com.cvsenterpriseiphone.health100"
```

**Verify in build_config.yaml:**
```yaml
ios:
  scheme: "Health100"
  bundle_id: "com.cvsenterpriseiphone.health100"
```

### Issue: Android Not Working

**Symptom:** No Android network calls captured

**Requirements:**
1. App must use OkHttp with logging interceptor
2. Logging must be enabled in DEBUG builds
3. Emulator must be running

**Solution:** Verify OkHttp logging interceptor in app:

```kotlin
// In app's OkHttpClient builder (should already exist in DEBUG builds)
if (BuildConfig.DEBUG) {
    val logging = HttpLoggingInterceptor()
    logging.level = HttpLoggingInterceptor.Level.BASIC
    addInterceptor(logging)
}
```

**Check logcat output:**
```bash
adb logcat -s "OkHttp:D" | head -20
# Should show OkHttp logs
```

### Issue: Incomplete URLs in Logs

**Symptom:** Some URLs are truncated or missing

**Cause:** iOS CFNetwork sometimes truncates URLs in logs

**Workaround:** Parser extracts what's available and filters by domain. For complete URLs, use the app's internal network debugger with `--network-debugger` flag.

### Issue: Parser Errors

**Symptom:** Parser fails or crashes

**Solutions:**

**1. Check Node.js is installed**
```bash
node --version
# Should show v14+ or higher
```

**2. Check log file is readable**
```bash
cat test-reports/*/network/simulator-network.log | head -20
```

**3. Run parser manually for debugging**
```bash
node scripts/network/parse-network-logs.js test-reports/IOS_20260408_123456
```

---

## Advanced Options

### Option 1: Atlantis Integration (For Request/Response Bodies)

Atlantis is a professional network debugging SDK that provides:
- Full request/response bodies
- Headers and cookies
- WebSocket support
- Professional debugging UI (Proxyman app)

**Setup:**
```bash
./scripts/network/setup-atlantis.sh
```

**Requirements:**
- Proxyman app (free download)
- App code changes (adds Atlantis.start())
- Pod install (iOS) or Gradle dependency (Android)

**Usage:**
1. Install Proxyman app
2. Run tests with `--network-capture`
3. View traffic in Proxyman UI
4. Export to JSON for reports

**Note:** Atlantis requires app modifications, so it's optional. The default solution works without any app changes.

### Option 2: mitmproxy (Native iOS + Flutter)

mitmproxy captures all HTTP/HTTPS traffic through a local proxy, including Flutter/Dart networking that native CFNetwork logging cannot see.

**Setup:**
```bash
# 1. Install mitmproxy
brew install mitmproxy

# 2. Start mitmdump with capture script
REPORT_DIR=./test-reports mitmdump \
  --mode regular \
  --listen-port 8080 \
  -s scripts/mitmproxy_capture.py

# 3. Configure simulator proxy
# Settings > Wi-Fi > Configure Proxy > Manual
# Server: localhost, Port: 8080

# 4. Install and trust CA certificate
# Open http://mitm.it in simulator browser, tap Install
# Settings > General > VPN & Device Management > mitmproxy certificate > Trust
```

**Tradeoffs:** Free, CI/CD friendly, captures request/response bodies. Requires proxy and certificate configuration on each simulator.

### Option 2: Charles Proxy (GUI-Based)

Charles Proxy provides a visual GUI for inspecting traffic. Useful for debugging but less suited for CI/CD.

**Setup:**
```bash
# 1. Download from https://www.charlesproxy.com/ (~$50 license)
# 2. Proxy > Proxy Settings > Port: 8888
# 3. Configure simulator proxy (same as mitmproxy, port 8888)
# 4. Help > SSL Proxying > Install Charles Root Certificate on a Mobile Device
# 5. Export session: File > Export Session > HTTP Archive (.har)
# 6. Parse HAR file:
node scripts/captureApiCalls.js parse-har traffic.har test_name
```

**Tradeoffs:** GUI interface for visual inspection, export to HAR format. Paid tool, not CI/CD friendly.

### Capture Method Comparison

| Feature | System Log (default) | mitmproxy | Charles Proxy |
|---------|---------------------|-----------|---------------|
| **Native iOS** | Yes | Yes | Yes |
| **Flutter/Dart** | No | Yes | Yes |
| **Setup Complexity** | None | Medium | Medium |
| **Cost** | Free | Free | ~$50 |
| **Request/Response Bodies** | No | Yes | Yes |
| **CI/CD Friendly** | Yes | Yes | No |
| **Automatic Integration** | Yes | Manual | Manual |

### Option 4: Custom Domain Filtering

Edit `scripts/network/parse-network-logs.js` to customize which domains and patterns are captured.

**Domain allowlist** (only traffic to these domains is recorded):

```javascript
const CVS_DOMAINS = [
  'cvs.com',
  'cvshealth.com',
  'caremark.com',
  'aetna.com',
  'health100.com',
  'your-custom-domain.com'  // Add here
];
```

If you are using `captureApiCalls.js` (manual/auto-api-capture workflow), the equivalent setting is `ALLOWED_HOSTNAMES`:

```javascript
const ALLOWED_HOSTNAMES = [
  'www.cvs.com',
  'www-qa2.cvs.com',
  'api.example.com',      // Add your API host
  'backend.example.com'   // Add another host
];
```

**Exclusion patterns** (static assets, analytics, and tracking are filtered out):

```javascript
const EXCLUDE_PATTERNS = [
  /\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|css|js|map)(\?|$)/i,
  /google-analytics/i,
  /googletagmanager/i,
  /firebase/i,
  /crashlytics/i,
  /appsflyer/i,
  /branch\.io/i,
  /amplitude/i,
  /mixpanel/i,
  /segment\.io/i,
  /newrelic/i,
  /dynatrace/i,
  /your-custom-pattern/i  // Add here
];
```

### Option 5: Network Call Assertions

Add network call assertions to your tests:

```yaml
# .maestro/flows/Account/login-and-logout.yaml
- runScript: |
    const apiCalls = JSON.parse(
      await maestro.readFile('${REPORT_DIR}/network/api-calls.json')
    );
    
    // Assert login call succeeded
    const loginCall = apiCalls.calls.find(c => 
      c.endpoint.includes('/auth/login')
    );
    
    if (!loginCall || loginCall.status !== 201) {
      throw new Error('Login API call failed');
    }
    
    // Assert no failed calls
    if (apiCalls.summary.failedCalls > 0) {
      throw new Error(`${apiCalls.summary.failedCalls} API calls failed`);
    }
```

---

## Technical Architecture

### Design Principles

1. **No Code Injection** - Uses native platform logging
2. **Zero App Changes** - Works with existing apps
3. **Platform Native** - Leverages iOS/Android built-in capabilities
4. **Fail-Safe** - Continues even if capture fails
5. **Privacy-First** - Doesn't capture sensitive data

### Why This Approach?

**Previous Approach (Removed):**
- ❌ Custom Swift/Kotlin logger injection
- ❌ Method swizzling (fragile, breaks with OS updates)
- ❌ Xcode project manipulation (path conflicts)
- ❌ Complex build-time injection
- ❌ Never worked reliably

**Current Approach (Working):**
- ✅ Native iOS CFNetwork logging
- ✅ Native Android OkHttp logging
- ✅ No app modifications required
- ✅ Reliable and maintainable
- ✅ Works with iOS 18, Android 14+

### Parser Implementation

**parse-network-logs.js** is a universal parser that:

1. **Detects Platform**
   - Checks for `ios-network.log` or `simulator-network.log` (iOS)
   - Checks for `android-network.log` (Android)

2. **Parses Logs**
   - **iOS:** Parses CFNetwork task format
     ```
     Task <UUID>.<N> sent request, body S 123
     Task <UUID>.<N> received response, status 200
     Task <UUID>.<N> summary {...transaction_duration_ms=123...}
     ```
   - **Android:** Parses OkHttp format
     ```
     --> POST https://api.cvs.com/v1/login
     <-- 200 OK https://api.cvs.com/v1/login (123ms)
     ```

3. **Filters Calls**
   - Matches CVS/Health100 domains
   - Excludes static assets
   - Excludes analytics/tracking

4. **Generates Output**
   - Creates `api-calls.json`
   - Includes summary metrics
   - Sorted by timestamp

### Performance Impact

- **Capture:** Minimal (native logging)
- **Parse:** ~100ms for typical test
- **Storage:** ~50KB per test run
- **App Performance:** Zero impact (no code in app)

---

## Migration Notes

### What Changed (April 2026)

**Removed (Broken Implementations):**
- ❌ `inject-network-interceptor.sh` - Custom iOS injection
- ❌ `inject-android-network-logger.sh` - Custom Android injection
- ❌ `auto-inject-network-logging.swift` - Standalone Swift file
- ❌ `auto-inject-network-logging.kt` - Standalone Kotlin file
- ❌ `add-network-logger-to-xcode.sh` - Manual Xcode script
- ❌ `setup-network-capture.sh` - Generic setup script

**Added (Working Solution):**
- ✅ `parse-network-logs.js` - Universal parser
- ✅ Updated `test.sh` - Enhanced logging
- ✅ `network-capture.sh` - Optional helper

**Why the Change?**

1. **Reliability** - Native logging is more stable than custom injection
2. **Simplicity** - No code injection = fewer bugs
3. **Maintenance** - Works with iOS/Android updates
4. **Performance** - No runtime overhead

### Cleanup

If you have old MaestroNetworkLogger.swift in your Xcode project, remove it:

```bash
cd /Users/z312636/.maestro-builds/ios/digital-flagship-ios
ruby << 'RUBYSCRIPT'
require 'xcodeproj'
project = Xcodeproj::Project.open('./IOS/CVSOnlineiPhone/CVSOnlineiPhone.xcodeproj')

# Remove from all targets
project.targets.each do |target|
  target.source_build_phase.files.each do |build_file|
    if build_file.file_ref && build_file.file_ref.path && build_file.file_ref.path.include?('MaestroNetwork')
      build_file.remove_from_project
    end
  end
end

# Remove file reference
project.files.each do |file_ref|
  if file_ref.path && file_ref.path.include?('MaestroNetwork')
    file_ref.remove_from_project
  end
end

project.save
puts "✅ Removed MaestroNetworkLogger from Xcode project"
RUBYSCRIPT
```

---

## FAQ

### Q: Do I need to modify app code?

**A:** No! iOS network capture works out-of-the-box using native logging.

For Android, the app should already have OkHttp logging in DEBUG builds (standard practice).

### Q: Why don't I see request/response bodies?

**A:** iOS CFNetwork logs don't include bodies for privacy/security. Use the app's internal network debugger with `--network-debugger` flag if the app has built-in network logging.

### Q: Can I capture production API calls?

**A:** No, network capture only works with DEBUG builds on simulators/emulators. Production builds don't log network traffic.

### Q: How do I capture WebSocket traffic?

**A:** WebSocket capture requires the app's internal network debugger. Native system logging doesn't support WebSockets.

### Q: Can I filter specific endpoints?

**A:** Yes! Edit `parse-network-logs.js` and modify the `CVS_DOMAINS` or `EXCLUDE_PATTERNS` arrays.

### Q: Does this work with both CVSOnlineiPhone and Health100?

**A:** Yes! The parser automatically detects the app based on `APP_ID` from `build_config.yaml`.

### Q: What if I switch between apps?

**A:** Just update `build_config.yaml`:
```yaml
ios:
  scheme: "Health100"  # or "CVSOnlineiPhone"
  bundle_id: "com.cvsenterpriseiphone.health100"  # or cvsonline
```

### Q: Can I run multiple tests with network capture?

**A:** Yes! Each test run creates a separate report directory with its own network logs.

---

## Summary

✅ **Production-Ready Network Capture Solution**

**Features:**
- No code injection required
- Works for iOS (CVSOnlineiPhone & Health100)
- Ready for Android (needs OkHttp logging)
- Clean, maintainable codebase
- Comprehensive documentation
- Easy to use (`--network-capture` flag)

**Captures:**
- HTTP methods, URLs, status codes
- Response times, timestamps
- Success/failure metrics
- CVS/Health100 APIs only

**Does NOT Capture:**
- Request/response bodies (use `--network-debugger` if app has internal logging)
- Headers (privacy/security)
- Static assets (filtered out)

**Usage:**
```bash
./scripts/testing/test.sh test.yaml --network-capture

# Result:
✅ Captured 15 network calls
   Successful: 14
   Failed: 1
   Avg response time: 285ms
```

---

**Last Updated:** April 9, 2026  
**Status:** Production Ready ✅  
**Maintained By:** Maestro Test Framework Team
