# Debugging Guide - Complete Reference

Comprehensive debugging guide for Maestro UI tests with troubleshooting, tools, and best practices.

## Quick Reference

### Common Issues

| Issue | Solution |
|-------|----------|
| App won't launch | Use `--device` not `--device-id` |
| Undefined variables | Check screen YAML files are loaded |
| Element not found | Use Maestro Studio to inspect UI |
| Test timeout | Increase `timeout` in `extendedWaitUntil` |
| Build fails | Run `pod install --repo-update` (iOS) |
| `Android driver did not start up in time` after 2-3 runs | Handled automatically by `scripts/testing/test.sh` — see [Common Errors §6](#6-android-driver-did-not-start-up-in-time) |
| No HTML report generated after failure | Expected when the driver never started — console shows the real error |

### Debug Commands

```bash
# Launch Maestro Studio (UI Inspector)
maestro studio

# Run test with debug output
maestro test <test-file> --debug-output

# Check app installation
xcrun simctl listapps <simulator-udid> | grep cvspharmacy  # iOS
adb shell pm list packages | grep cvs                       # Android

# View simulator logs
tail -f ~/Library/Logs/CoreSimulator/<udid>/system.log     # iOS
adb logcat                                                  # Android
```

## Maestro Studio

Maestro Studio is an interactive UI inspector for debugging tests.

### Launch Studio

```bash
# Launch on current device
maestro studio

# Launch on specific device
maestro studio --device <device-id>

# Launch with specific app
maestro studio --app-id com.cvsenterpriseiphone.cvspharmacy
```

### Features

- **Live UI Hierarchy**: See all elements in real-time
- **Element Inspector**: Click elements to see properties
- **Selector Testing**: Test selectors before adding to flows
- **Screenshot Capture**: Take screenshots for documentation
- **Flow Recording**: Record interactions as Maestro commands

### Using Studio

1. Launch Studio: `maestro studio`
2. Navigate to the screen you want to inspect
3. Click elements to see their properties
4. Copy selectors to use in your flows
5. Test assertions before adding to tests

## Debugging Test Failures

### Step 1: Identify the Failure

Check the test output:

```
❌ Assert that "Login" is visible

Assertion '"Login" is visible' failed.
Possible causes:
- Element selector may be incorrect
- Element may be temporarily unavailable
- This could be a real regression
```

### Step 2: Inspect the UI

```bash
# Launch Studio
maestro studio --device <device-id>

# Navigate to the failing screen
# Click on elements to see their actual properties
```

### Step 3: Check Debug Artifacts

Maestro saves debug artifacts in `~/.maestro/flows/<timestamp>/`:

```bash
# View latest test artifacts
ls -la ~/.maestro/flows/$(ls -t ~/.maestro/flows/ | head -1)

# Common files:
# - screenshot.png - Screenshot at failure point
# - hierarchy.txt - UI hierarchy dump
# - logs.txt - Test execution logs
```

### Step 4: Fix the Issue

Common fixes:

**Element selector is wrong:**
```yaml
# Wrong
- assertVisible: "Login"

# Correct (use regex for flexibility)
- assertVisible: "Log in|Sign in"
```

**Element takes time to appear:**
```yaml
# Add wait
- extendedWaitUntil:
    visible: "Login"
    timeout: 10000
```

**Element is in a different location:**
```yaml
# Use more specific selector
- assertVisible:
    id: "login_button"
```

## Common Errors

### 1. "Unable to launch app"

**Error:**
```
[Failed] test_authentication (4s) (Unable to launch app com.cvsenterpriseiphone.cvspharmacy)
```

**Causes:**
- Wrong Maestro CLI flag
- App not installed
- Wrong bundle ID

**Solutions:**

```bash
# Use correct flag
maestro test <test-file> --device <device-id>  # ✅ Correct
maestro test <test-file> --device-id <device-id>  # ❌ Wrong

# Check app is installed
xcrun simctl listapps <device-id> | grep cvspharmacy

# Install app if missing
xcrun simctl install <device-id> /path/to/app.app
```

### 2. "Assertion is false: undefined is visible"

**Error:**
```
❌ Assert that "undefined" is visible
```

**Cause:** Environment variables not resolved. This commonly occurs with screen object variables (e.g., `${output.account_login.emailField}`) or credential variables (e.g., `${COMMON_USER}`, `${COMMON_PASSWORD}`).

**Solutions for screen variables:**

```yaml
# Option 1: Load screen files
- runFlow: ../../.maestro/screens/Common/CommonScreen.yaml

# Option 2: Pass variables via CLI
maestro test <test-file> --env HOME_TAB="Home" --env SHOP_TAB="Shop"

# Option 3: Define in test file
appId: com.cvsenterpriseiphone.cvspharmacy
env:
  HOME_TAB: "Home"
  SHOP_TAB: "Shop"
```

**Solutions for credential variables (COMMON_USER, COMMON_PASSWORD, etc.):**

```bash
# Option A: Use the test wrapper (recommended) - credentials are auto-loaded
bash scripts/testing/test.sh .maestro/flows/Account/login-and-logout.yaml

# Option B: Manually pass credentials via CLI
maestro test .maestro/flows/Account/login-and-logout.yaml \
  --env COMMON_USER=your_user@example.com \
  --env COMMON_PASSWORD=your_password \
  --env STATIC_OTP=999999 \
  --env DOB=07121979

# Option C: Load from config file
maestro test .maestro/flows/Account/login-and-logout.yaml -c .maestro/config/config.qa.yaml
```

**Verify credentials are loading:**
```bash
# Check if decryption works
node scripts/decrypt_env.js

# Should output something like:
# COMMON_USER=user@example.com
# COMMON_PASSWORD=password123
```

### 3. "Element not found"

**Error:**
```
❌ Tap on "Submit"
Element not found: "Submit"
```

**Solutions:**

```bash
# Use Maestro Studio to find correct selector
maestro studio

# Try different selectors
- tapOn: "Submit"                    # Text match
- tapOn: { id: "submit_button" }     # ID match
- tapOn: { text: "Submit|Send" }     # Regex match
- tapOn: { index: 0 }                # First matching element
```

### 4. "Test timeout"

**Error:**
```
❌ Test timed out after 30000ms
```

**Solutions:**

```yaml
# Increase timeout
- extendedWaitUntil:
    visible: "Element"
    timeout: 60000  # 60 seconds

# Add explicit waits
- wait: 5000  # Wait 5 seconds

# Check for loading indicators
- extendedWaitUntil:
    notVisible: "Loading..."
    timeout: 30000
```

### 5. "Build failed"

**Error (iOS):**
```
error: Unable to open base configuration reference file
```

**Solution:**
```bash
# Install CocoaPods dependencies
cd /path/to/ios-app
pod install --repo-update

# Clean and rebuild
rm -rf ~/Library/Developer/Xcode/DerivedData/*
xcodebuild clean -workspace CVSOnlineiPhone.xcworkspace -scheme CVSOnlineiPhone
```

**Error (Android):**
```
Gradle build failed
```

**Solution:**
```bash
# Clean Gradle cache
cd /path/to/android-app
./gradlew clean

# Rebuild
./gradlew assembleDebug
```

### 6. "Android driver did not start up in time"

**Error:**
```
Maestro Android driver did not start up in time  ---  emulator [ emulator-5554 ] & port [ dadb.open( tcp:49561 ) ]
maestro.MaestroDriverStartupException$AndroidDriverTimeoutException: ...
```

**When it happens:** Typically on the 3rd or 4th consecutive test run without restarting the emulator.

**Root cause:** State the Maestro JVM does not clean up on exit accumulates across runs:

1. `adb forward` entries pile up — each run reserves a random local port (49561, 49562, …) and never releases it, so `dadb.open()` eventually can't bind a fresh forward.
2. The on-device instrumentation packages (`dev.mobile.maestro` and `dev.mobile.maestro.test`) are left half-attached; the next `maestro test` hangs waiting for a handoff that never comes.
3. The adb daemon itself degrades after many sessions.

**Fix:** Already handled by `scripts/testing/test.sh` via the `cleanup_android_driver_state()` function, which runs:
- At the end of every run (via `kill_maestro_daemon`)
- As a **pre-flight** check right before `maestro test` launches — so even if the prior run crashed without cleanup, the current run starts clean

What it does:
```bash
adb -s <device> forward --remove-all               # drop stale port forwards
adb -s <device> shell am force-stop dev.mobile.maestro
adb -s <device> shell am force-stop dev.mobile.maestro.test
```

**If it still happens:** Manually reset:
```bash
adb forward --remove-all
adb shell am force-stop dev.mobile.maestro
adb shell am force-stop dev.mobile.maestro.test
adb kill-server && adb start-server           # last resort
```

**Note on reports:** When the driver never starts, `scripts/testing/test.sh` intentionally **skips** HTML / Pulse / accessibility / Slack report generation and removes the empty dated report folder — nothing ran, so nothing meaningful to report. The console output contains the underlying error. This behavior is triggered by any of these log signatures:
- `Maestro Android driver did not start up in time`
- `MaestroDriverStartupException` / `AndroidDriverTimeoutException` / `IOSDriverTimeoutException`
- `Failed to connect to /127.0.0.1:7001`
- `dadb.open(`

Non-zero exit code still propagates so CI knows the run failed.

## Common Issues

### Test Reports in Wrong Directory

**Problem:** Test reports are created in `.maestro/test-reports/` instead of the project root `test-reports/` directory.

**Cause:** The test was run directly with `maestro test` instead of using `scripts/testing/test.sh`, which sets the correct report directory.

**Solution:**

Always use the test wrapper to ensure reports go to the correct location:

```bash
# Reports will be in: test-reports/test-report-latest.html
bash scripts/testing/test.sh .maestro/flows/Account/login-and-logout.yaml
```

Verify the report location:
```bash
# Check correct location
ls -la test-reports/

# Should contain:
# - test-report-latest.html
# - test-report_YYYYMMDD_HHMMSS.html
# - results_YYYYMMDD_HHMMSS.json
# - logs/
# - screenshots/
```

If reports ended up in the wrong location:
```bash
# Move reports to correct location
mv .maestro/test-reports/* test-reports/ 2>/dev/null || true

# Clean up empty directory
rmdir .maestro/test-reports 2>/dev/null || true
```

### HTML Report Not Opening Automatically

**Problem:** Test completes but the HTML report does not automatically open in the browser.

**Cause:** Browser opening may be disabled, the report file path may be incorrect, or the `open` command may not be available on the system.

**Solutions:**

```bash
# The test wrapper enables browser opening by default
bash scripts/testing/test.sh .maestro/flows/Account/login-and-logout.yaml

# Force browser opening explicitly
bash scripts/testing/test.sh .maestro/flows/Account/login-and-logout.yaml --no-browser=false

# Or open the report manually
open test-reports/test-report-latest.html
```

Verify the `open` command is available:
```bash
# macOS
command -v open

# Linux - use xdg-open instead
command -v xdg-open
```

Check that the report file exists:
```bash
test -f test-reports/test-report-latest.html && echo "File exists" || echo "File not found"
```

### Test Runs On Android When iOS Was Expected

**Problem:** Running `maestro test` starts execution on an Android emulator when you expected iOS, because both platforms are connected.

**Cause:** No explicit `--platform` flag was passed, so device selection drifts based on which devices are connected.

**Solution:**

Always pass the platform explicitly when both iOS and Android devices are active:

```bash
# iOS
bash scripts/testing/test.sh .maestro/flows/Account/login-and-logout.yaml --platform ios

# Android
bash scripts/testing/test.sh .maestro/flows/Account/login-and-logout.yaml --platform android
```

If calling Maestro directly (without the wrapper), also pass `--udid` for strict device pinning:

```bash
~/.maestro/bin/maestro test --platform ios --udid <IOS_UDID> .maestro/flows/Account/login-and-logout.yaml
```

## Debugging Scripts

### 1. Verify App Launch

```bash
./scripts/verify-app-launch.sh <simulator-udid> <bundle-id>
```

Checks:
- Simulator status
- App installation
- App launch capability
- App permissions
- Simulator logs
- Maestro compatibility

### 2. Diagnose iOS Build

```bash
./scripts/diagnose-ios-build.sh /path/to/ios-app CVSOnlineiPhone
```

Checks:
- Podfile exists
- Pods directory exists
- xcconfig files present
- Xcode workspace configured
- CocoaPods installed
- Build settings valid

### 3. Fix iOS Build

```bash
./scripts/fix-ios-build.sh /path/to/ios-app CVSOnlineiPhone
```

Fixes:
- Installs CocoaPods
- Cleans build artifacts
- Updates CocoaPods repo
- Installs dependencies
- Cleans Xcode cache
- Verifies workspace

## Best Practices

### 1. Use Descriptive Assertions

```yaml
# Bad - Generic error
- assertVisible: "Button"

# Good - Specific error
- assertVisible:
    text: "Submit Claim"
    timeout: 5000
```

### 2. Add Wait Times

```yaml
# Always wait for elements
- extendedWaitUntil:
    visible: "Login"
    timeout: 8000
- tapOn: "Login"
```

### 3. Use Flexible Selectors

```yaml
# Use regex for variations
- assertVisible: "Log in|Sign in|Login"

# Use partial matches
- assertVisible: ".*Submit.*"
```

### 4. Check Element State

```yaml
# Verify element is enabled
- assertVisible:
    id: "submit_button"
    enabled: true

# Verify element is not loading
- assertNotVisible: "Loading..."
```

### 5. Add Debug Comments

```yaml
# Step 1: Navigate to login screen
- tapOn: "Account"
- extendedWaitUntil:
    visible: "Sign in"
    timeout: 5000

# Step 2: Enter credentials
- tapOn: { id: "email_field" }
- inputText: ${USERNAME}
```

## Logging and Monitoring

### Enable Debug Output

```bash
# Run with debug output
maestro test <test-file> --debug-output

# Save debug output to file
maestro test <test-file> --debug-output > debug.log 2>&1
```

### View Test Artifacts

```bash
# Find latest test run
ls -t ~/.maestro/flows/ | head -1

# View artifacts
cd ~/.maestro/flows/<timestamp>
open screenshot.png
cat hierarchy.txt
cat logs.txt
```

### Monitor Simulator Logs

```bash
# iOS
tail -f ~/Library/Logs/CoreSimulator/<udid>/system.log | grep CVS

# Android
adb logcat | grep CVS
```

## Performance Debugging

### Identify Slow Tests

```bash
# Run with timing
time maestro test <test-file>

# Check individual step times in output
```

### Optimize Slow Steps

```yaml
# Reduce wait times
- extendedWaitUntil:
    visible: "Element"
    timeout: 5000  # Reduce from 10000

# Skip unnecessary steps
- runFlow:
    when:
      visible: "Skip"
    commands:
      - tapOn: "Skip"

# Use faster selectors (ID > text)
- tapOn: { id: "button" }  # Faster
- tapOn: "Button Text"     # Slower
```

## Troubleshooting Checklist

Before asking for help, verify:

- [ ] App is installed on device
- [ ] Device is booted and ready
- [ ] Correct Maestro CLI syntax (`--device` not `--device-id`)
- [ ] Environment variables are defined
- [ ] Screen files are loaded in flows
- [ ] Element selectors match actual UI
- [ ] Timeouts are sufficient
- [ ] No syntax errors in YAML
- [ ] Latest Maestro version installed
- [ ] Using test wrapper: `bash scripts/testing/test.sh .maestro/flows/...`
- [ ] Credentials loaded: `node scripts/decrypt_env.js`
- [ ] Report directory correct: `ls -la test-reports/`
- [ ] HTML report exists: `ls -la test-reports/test-report-latest.html`
- [ ] Browser opening enabled: No `--no-browser` flag
- [ ] `open` command available: `command -v open`
- [ ] Platform explicit when both emulators are up: `--platform ios|android`

## Getting Help

### Check Documentation

1. This debugging guide
2. Maestro documentation: https://maestro.mobile/
3. Project README.md

### Use Maestro Studio

```bash
maestro studio
```

### Check Debug Artifacts

```bash
cd ~/.maestro/flows/<timestamp>
```

### Review Test Logs

```bash
maestro test <test-file> --debug-output
```

## Summary

✅ **Maestro Studio** - Interactive UI inspector  
✅ **Debug Artifacts** - Screenshots, hierarchy, logs  
✅ **Verification Scripts** - Diagnose and fix issues  
✅ **Best Practices** - Flexible selectors, wait times, comments  
✅ **Performance** - Optimize slow tests  
✅ **Troubleshooting** - Common errors and solutions  

Use Maestro Studio as your primary debugging tool for inspecting UI and testing selectors.
