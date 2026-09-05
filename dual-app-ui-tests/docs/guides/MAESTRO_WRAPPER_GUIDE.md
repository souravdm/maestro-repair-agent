# Maestro Wrapper Guide: Complete Documentation

## Overview

The framework provides a **project-local `bin/maestro` wrapper** that intercepts `maestro test` and routes it through `scripts/testing/test.sh`. This means you type plain `maestro test` in your terminal and get:

- `APP_ID` automatically resolved from `build_config.yaml`
- Auto-build + install of the app if it is missing from the booted simulator
- Credential loading and environment variable injection
- HTML report generation

All other `maestro` subcommands (`studio`, `hierarchy`, `download`, etc.) are forwarded unchanged to the real Maestro CLI — nothing breaks.

## Features

✓ **Automatic APP_ID Resolution** - Reads `bundle_id` from `build_config.yaml`, no manual `export APP_ID`
✓ **Auto-Build & Install** - Builds and installs the app if not found on the booted simulator
✓ **Automatic Report Generation** - HTML reports generated for every test run
✓ **Credential Management** - Automatic loading and decryption of test credentials
✓ **Simulator Management** - Automatic simulator boot and permissions setup
✓ **Screenshot Capture** - Automatic screenshot and log collection
✓ **Failure Analysis** - Detailed failure tracking and analysis
✓ **Platform Support** - iOS and Android with explicit platform forwarding
✓ **Browser Integration** - Automatic report opening in browser
✓ **Transparent Passthrough** - Non-test subcommands forwarded to real Maestro CLI

---

## Quick Start (One-Time Setup)

### Step 1: Boot the simulator (injects PATH automatically)
```bash
./scripts/setup/ios-setup.sh boot
source ~/.zshrc
```

This appends `export PATH="<project>/bin:$PATH"` to `~/.zshrc` once. Every new terminal session will pick it up. The `bin/maestro` wrapper takes priority over the system Maestro CLI only for `maestro test` — everything else passes through.

### Step 2: Run Your First Test
```bash
# iOS (default) — app auto-installed if missing
mastero test .maestro/flows/Account/login-and-logout.yaml

# App already installed? Skip the install check
mastero test .maestro/flows/Account/login-and-logout.yaml --skip-setup

# Android
mastero test .maestro/flows/Account/login-and-logout.yaml --platform android
```

---

## Usage

### Basic Syntax
```bash
maestro [test|run] [flow_path] [options]
```

### Common Commands

**Development - Single Test with Report**
```bash
maestro test flows/Account/login.yaml
```

**CI/CD - Build and Test**
```bash
maestro test flows/Account/login.yaml --build --no-browser
```

**Quick Test - No Report**
```bash
maestro test flows/Account/login.yaml --no-report
```

**Android Testing**
```bash
maestro test flows/Account/login.yaml --platform android
```

**Full Test Suite**
```bash
maestro test tests/suites/suite-smoke-critical-paths.yaml --build
```

**Test Directory**
```bash
maestro test flows/Account/
```

**With Custom Config**
```bash
maestro test flows/Account/login.yaml -c config/config.qa.yaml
```

**From GitHub Repository**
```bash
maestro test flows/Account/login.yaml --from-repo --branch develop
```

**Skip Simulator Setup**
```bash
maestro test flows/Account/login.yaml --skip-setup
```

**Don't Open Browser**
```bash
maestro test flows/Account/login.yaml --no-browser
```

---

## Options Reference

| Option | Description | Example |
|--------|-------------|---------|
| `--skip-setup` | Skip simulator boot and auto-install check | `maestro test flows/login.yaml --skip-setup` |
| `--no-report` | Skip report generation | `maestro test flows/login.yaml --no-report` |
| `--no-browser` | Don't open report in browser | `maestro test flows/login.yaml --no-browser` |
| `--platform ios\|android` | Sets execution platform and app ID resolution (default: ios) | `maestro test flows/login.yaml --platform android` |
| `--network-capture` | Capture network API calls during test execution | `maestro test flows/login.yaml --network-capture` |
| `--video` | Record video of the test run | `maestro test flows/login.yaml --video` |
| `--a11y` | Run WCAG accessibility validation and include in report | `maestro test flows/login.yaml --a11y` |
| `--pulse` | Run Pulse design system validation and include in report | `maestro test flows/login.yaml --pulse` |
| `--help` | Show help message | `maestro --help` |

> **Auto-install behaviour**: by default (without `--skip-setup`) the wrapper checks whether the `bundle_id` from `build_config.yaml` is installed on the booted simulator. If it is missing it runs `scripts/build/build.sh ios repo` automatically. Pass `--skip-setup` to suppress this check when you know the app is already installed.

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `APP_ID` | Override app ID | Platform-specific |
| `MAESTRO_DRIVER_STARTUP_TIMEOUT` | Driver startup timeout (ms) | 20000 |
| `MAESTRO_WAIT_TIMEOUT` | Conditional wait timeout (ms) | 3000 |
| `OPEN_BROWSER` | Open report in browser | true |

### Setting Environment Variables

```bash
# Set for single command
APP_ID=com.cvs.launchers.cvs maestro test flows/Account/login.yaml

# Set for session
export APP_ID=com.cvs.launchers.cvs
maestro test flows/Account/login.yaml

# Set driver timeout
export MAESTRO_DRIVER_STARTUP_TIMEOUT=30000
maestro test flows/Account/login.yaml

# Set multiple variables
export APP_ID=com.cvs.launchers.cvs
export MAESTRO_DRIVER_STARTUP_TIMEOUT=30000
export OPEN_BROWSER=false
maestro test flows/Account/login.yaml --build
```

---

## Platform-Specific App IDs

### iOS (Default)
```bash
# Default (iOS)
maestro test flows/Account/login.yaml

# Explicit iOS
maestro test flows/Account/login.yaml --platform ios
```
**App ID:** `com.cvsenterpriseiphone.cvspharmacy`

When both iOS and Android devices are connected, always pass `--platform` explicitly.

### Android
```bash
# Android platform
maestro test flows/Account/login.yaml --platform android
```
**App ID:** `com.cvs.launchers.cvs`

### Override App ID (Advanced)
```bash
# Use environment variable to override
APP_ID=com.custom.app.id maestro test flows/Account/login.yaml
```

---

## Automatic Features

The wrapper automatically handles:

✓ **Credential Loading** - Decrypts test credentials from `maestro_secrets.qa.json`
✓ **Credential Injection** - Passes credentials to Maestro as environment variables
✓ **Fallback Handling** - Uses BRAYDEN credentials if COMMON credentials unavailable
✓ **Variable Mapping** - Maps COMMON_USER to USERNAME, etc.
✓ **Simulator Boot** - Starts iOS simulator if not running
✓ **App Installation** - Installs pre-built app on simulator
✓ **Installation Verification** - Checks app is installed before running tests
✓ **Report Generation** - Creates HTML report with screenshots
✓ **Log Collection** - Gathers test execution logs and debug output
✓ **Browser Opening** - Opens report in default browser (optional)
✓ **Android Driver Cleanup** - Resets `adb forward` entries and on-device instrumentation between runs to prevent the "Android driver did not start up in time" timeout after 2-3 tests
✓ **Driver-Failure Detection** - Skips HTML / Pulse / accessibility / Slack report generation (and removes the empty report folder) when the Maestro driver never starts, so `test-reports/` doesn't accumulate empty artifacts

### Credential Variables Automatically Loaded

```bash
COMMON_USER
COMMON_PASSWORD
COMMON_OTP
COMMON_DOB

MULTI_LOB_USER
MULTI_LOB_PASSWORD
MULTI_LOB_OTP
MULTI_LOB_DOB

# And many more...
```

---

## Report Generation

### Report Location

```
test-reports/
├── test-report-latest.html           # Latest HTML report
├── test-report_YYYYMMDD_HHMMSS.html  # Timestamped HTML report
├── results_YYYYMMDD_HHMMSS.json      # Test results JSON
├── logs/                              # Test execution logs
│   ├── test_name_*.log               # Test logs
│   ├── test_name_*_api.log           # API call logs
│   └── test_name_*_debug/            # Debug output
└── screenshots/                       # Test screenshots
    └── test_name_YYYYMMDD_HHMMSS/
        ├── failure_*.png             # Failure screenshots
        └── step_*.png                # Step screenshots
```

### Accessing Reports

**Latest Report**
```bash
open test-reports/test-report-latest.html
```

**Specific Report**
```bash
open test-reports/test-report_20260303_143000.html
```

**View All Reports**
```bash
ls -la test-reports/
```

### Report Features

- **Pass/Fail/Skip Statistics** with percentage rates
- **Failure Screenshots** automatically captured on test failures
- **Detailed Error Messages** with timestamps and stack traces
- **Test Duration Tracking** with average and total metrics
- **Interactive Dashboard** with visual progress indicators

---

## Simulator Management

### Automatic Setup

The wrapper automatically:
1. Boots simulator if not running
2. Installs pre-built app on simulator
3. Verifies app is installed before running tests

### Skip Setup

```bash
# If simulator is already running and app is installed
maestro test flows/Account/login.yaml --skip-setup
```

### Build and Install

```bash
# Build from local workspace
maestro test flows/Account/login.yaml --build

# Build from GitHub repository
maestro test flows/Account/login.yaml --from-repo

# Build from specific branch
maestro test flows/Account/login.yaml --from-repo --branch develop
```

---

## CI/CD Integration

### GitHub Actions

```yaml
jobs:
  test:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run tests with automatic reports
        run: ./scripts/run-maestro.sh test .maestro/flows/Account/login-and-logout.yaml --build
      - name: Upload reports
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: test-reports
          path: test-reports/
```

### GitLab CI

```yaml
test:
  script:
    - ./scripts/run-maestro.sh test .maestro/flows/Account/login-and-logout.yaml --build
  artifacts:
    paths:
      - test-reports/
    when: always
```

### Jenkins

```groovy
stage('Test') {
  steps {
    sh './scripts/run-maestro.sh test .maestro/flows/Account/login-and-logout.yaml --build'
    publishHTML([
      reportDir: 'test-reports',
      reportFiles: 'test-report-latest.html',
      reportName: 'Maestro Test Report'
    ])
  }
}
```

---

## Troubleshooting

### App Not Found

**Error:** "App is not installed on the simulator"

**Solution:**
```bash
maestro test flows/Account/login.yaml --build
```

### Credentials Not Loaded

**Error:** "COMMON_USER is empty"

**Solution:**
1. Verify `maestro_secrets.qa.json` exists
2. Check encryption key is correct
3. Run decryption manually: `node scripts/decrypt_env.js`

### Simulator Not Running

**Error:** "Cannot connect to simulator"

**Solution:**
```bash
# Let wrapper boot simulator
maestro test flows/Account/login.yaml

# Or boot manually
xcrun simctl boot <simulator-id>
```

### Report Not Generated

**Error:** "HTML report not found"

**Solution:**
1. Check `test-reports/` directory exists
2. Verify `scripts/reporting/generate-unified-report.js` exists
3. Check for errors in test execution logs

**Expected on driver failure:** If the console shows `Maestro driver failed to start — the test never ran`, the report was **intentionally skipped**. Nothing executed, so nothing was worth reporting. Fix the underlying driver error and re-run.

### Android Driver Startup Timeout

**Error:**
```
Maestro Android driver did not start up in time  ---  emulator [ emulator-5554 ] & port [ dadb.open( tcp:49561 ) ]
```

**When:** Typically after 2-3 consecutive runs on the same emulator.

**Solution:** Already handled automatically by the wrapper. Between runs it calls `cleanup_android_driver_state()`, which:
- Removes all leaked `adb forward` entries for the device
- Force-stops the on-device Maestro instrumentation packages (`dev.mobile.maestro`, `dev.mobile.maestro.test`)

The cleanup runs both at the end of every test and as a pre-flight check before the next `maestro test` invocation, so even a run that crashed without cleanup can't poison the next one.

If it still occurs, restart adb manually:
```bash
adb forward --remove-all
adb kill-server && adb start-server
```

### Browser Won't Open

**Error:** "Report generated but browser didn't open"

**Solution:**
```bash
# Disable browser opening
maestro test flows/Account/login.yaml --no-browser

# Open manually
open test-reports/test-report-latest.html
```

### Undefined Email Field in Tests

**Error:** "Element not found" or email field shows undefined value

**Solution:**
```bash
# Verify credentials are loading
eval "$(node scripts/setup/load-credentials.js)"
echo "$COMMON_USER"

# Run test with correct path (note: .maestro/ prefix)
maestro test .maestro/flows/Account/test_simple_login.yaml
```

---

## Suite Runner Integration

### Overview

The suite runner is fully integrated with the maestro wrapper. When you run `maestro test` with a suite file, it automatically detects it and uses the suite runner instead of the standard test runner, providing **per-test reporting** without any additional configuration.

### Suite File Auto-Detection

The wrapper automatically detects suite files by checking:

1. **Path contains `/suites/`** - Suite files are in the suites directory
2. **File is `.yaml`** - YAML format
3. **Contains `runFlow:` commands** - Multiple test flows defined

### Running Suite Files

```bash
# Automatically uses suite runner with per-test reporting
maestro test .maestro/flows/suites/suite-account-features.yaml
```

**That's it!** No need to call `scripts/run-test-suite.sh` directly.

### Suite File Format

Suite files should be in `.maestro/flows/suites/` directory:

```yaml
appId: ${APP_ID}
env:
  APP_ID: ${APP_ID}
---
# Clear app state
- launchApp:
    appId: ${APP_ID}
    clearState: true

# Run individual tests
- runFlow:
    file: ../Account/login-and-logout.yaml

- runFlow:
    file: ../Account/edit-profile-information.yaml

- runFlow:
    file: ../Account/update-insurance-information.yaml
```

### Suite Command Options

All standard maestro options work with suite files:

```bash
# Skip device setup
maestro test .maestro/flows/suites/suite-account-features.yaml --skip-setup

# Don't open report in browser
maestro test .maestro/flows/suites/suite-account-features.yaml --no-browser

# Run on Android
maestro test .maestro/flows/suites/suite-account-features.yaml --platform android

# Combine options
maestro test .maestro/flows/suites/suite-account-features.yaml \
  --platform android \
  --skip-setup \
  --no-browser
```

### Suite Report Output

#### Directory Structure

```
test-reports/
├── IOS_20260305_162119/
│   ├── suite-report.html              # Main report (open in browser)
│   ├── suite-results.json             # Raw results
│   ├── login-and-logout/
│   │   ├── results.xml
│   │   ├── test.log
│   │   └── artifacts/
│   ├── test_profile_edit/
│   │   ├── results.xml
│   │   ├── test.log
│   │   └── artifacts/
│   └── ... (one folder per test)
```

#### Report Features

The HTML report shows:

- **Summary Cards**: Total, Passed, Failed, Pass Rate %
- **Test Results List**: Individual test status with badges
- **Execution Duration**: Per-test timing
- **File Paths**: For reference
- **Visual Indicators**: Green (✓) for passed, Red (✕) for failed

### Suite Execution Example

```bash
maestro test .maestro/flows/suites/suite-account-features.yaml
```

**Output:**
```
╔════════════════════════════════════════════════════════════╗
║           Maestro Test Suite Runner                        ║
╚════════════════════════════════════════════════════════════╝

Configuration:
  Platform: ios
  Suite File: .maestro/flows/suites/suite-account-features.yaml
  Skip Setup: false

Running tests...

  [1/5] login-and-logout ... PASSED (45.234s)
  [2/5] test_profile_edit ... PASSED (32.156s)
  [3/5] test_insurance ... FAILED (28.945s)
  [4/5] test_addresses ... PASSED (25.123s)
  [5/5] test_payment_methods ... PASSED (19.876s)

════════════════════════════════════════════════════════════
Test Summary
════════════════════════════════════════════════════════════
Total:  5
Passed: 4
Failed: 1

✓ Report generated: test-reports/IOS_20260305_162119/suite-report.html

Opening report...

✓ Suite execution complete
```

### Suite vs Single Test Comparison

| Feature | Single Test | Suite File |
|---------|------------|-----------|
| **Individual test visibility** | ❌ No | ✅ Yes |
| **Per-test pass/fail** | ❌ No | ✅ Yes |
| **Per-test duration** | ❌ No | ✅ Yes |
| **HTML report** | ✅ Yes | ✅ Yes (enhanced) |
| **Test isolation** | ❌ No | ✅ Yes |
| **Per-test logs** | ❌ No | ✅ Yes |
| **Command** | `maestro test flow.yaml` | `maestro test suite.yaml` |

### Creating New Suite Files

1. Create file in `.maestro/flows/suites/suite-myfeature.yaml`
2. Add test flows using `runFlow:` commands
3. Run with: `maestro test .maestro/flows/suites/suite-myfeature.yaml`

### Suite Troubleshooting

**Suite Not Detected**

Ensure:
1. File is in `.maestro/flows/suites/` directory
2. File has `.yaml` extension
3. File contains `runFlow:` commands

```bash
# Verify file structure
cat .maestro/flows/suites/suite-account-features.yaml | grep -c "runFlow:"
```

**Tests Not Found in Suite**

Verify relative paths in suite file:

```yaml
# Correct
- runFlow:
    file: ../Account/login-and-logout.yaml

# Incorrect (won't work)
- runFlow:
    file: ../../flows/Account/login-and-logout.yaml
```

---

## Advanced Usage

### Run Multiple Tests with Reports

```bash
# Run all tests in directory
maestro test flows/Account/

# Run test suite with per-test reporting
maestro test .maestro/flows/suites/suite-smoke-critical-paths.yaml

# Run with custom config
maestro test flows/ -c config/config.qa.yaml
```

### Combine Options

```bash
# Build from repo, specific branch, custom config, no browser
maestro test flows/Account/login.yaml \
  --from-repo \
  --branch develop \
  -c config/config.qa.yaml \
  --no-browser
```

### Environment Variable Combinations

```bash
# Set multiple environment variables
export APP_ID=com.cvs.launchers.cvs
export MAESTRO_DRIVER_STARTUP_TIMEOUT=30000
export OPEN_BROWSER=false

maestro test flows/Account/login.yaml --build
```

---

## Performance Tips

1. **Use --skip-setup** if simulator is already running
2. **Use --no-browser** in CI/CD environments
3. **Use --no-report** for quick testing without reports
4. **Batch tests** by running test suites instead of individual tests

---

## Comparison: Before vs After

### Before (Manual Report Script)

```bash
# Had to use separate script
./scripts/testing/test.sh .maestro/flows/Account/login-and-logout.yaml

# Or plain maestro without reports
maestro test flows/Account/login.yaml
```

### After (Unified Wrapper)

```bash
# Single command with automatic reports
maestro test flows/Account/login.yaml

# Or with options
maestro test flows/Account/login.yaml --build --no-browser
```

---

## Files and Scripts

### Main Files

- `scripts/run-maestro.sh` - Unified wrapper script
- `scripts/setup/setup-maestro-wrapper.sh` - Wrapper setup and alias helper
- `scripts/testing/test.sh` - Consolidated test execution with reporting
- `scripts/setup/load-credentials.js` - Credential loader utility

### Configuration Files

- `.maestro/config/config.yaml` - Maestro configuration with report settings
- `.maestro/config/config.qa.yaml` - QA environment configuration
- `.maestro/config/config.prod.yaml` - Production environment configuration
- `.maestro/config/maestro_secrets.qa.json` - Encrypted test credentials

### Report Scripts

- `scripts/reporting/generate-unified-report.js` - HTML report generator
- `scripts/setup/load-credentials.js` - Credential loading utility

---

## What Happens Automatically

When you run `maestro test flows/Account/login.yaml`:

1. ✓ Loads and decrypts test credentials
2. ✓ Boots simulator and installs app (if needed)
3. ✓ Runs tests with Maestro
4. ✓ Generates HTML report with screenshots
5. ✓ Collects logs and debug output
6. ✓ Opens report in browser (optional)

---

## Key Improvements

| Feature | Before | After |
|---------|--------|-------|
| Report Generation | Manual script required | Automatic |
| Credentials | Manual setup | Auto-loaded |
| Simulator Setup | Manual or separate script | Automatic |
| App Installation | Manual or separate script | Automatic |
| Browser Opening | Manual | Automatic |
| Platform Support | Single platform | iOS & Android |
| Single Command | No | Yes ✓ |

---

## Next Steps

1. **Setup wrapper:** `./scripts/setup/setup-maestro-wrapper.sh --install`
2. **Run first test:** `maestro test .maestro/flows/Account/login-and-logout.yaml`
3. **Check report:** `open test-reports/test-report-latest.html`
4. **Explore options:** `maestro --help`

---

## Related Documentation

- [Platform Configuration Guide](./PLATFORM_CONFIGURATION_GUIDE.md)
- [Troubleshooting Common Issues](./TROUBLESHOOTING_COMMON_ISSUES.md)
- [First Time Setup](./FIRST_TIME_SETUP.md)
- [Build and Installation](./BUILD_AND_INSTALLATION.md)
- [Reporting Complete Guide](../framework-features/REPORTING_COMPLETE_GUIDE.md)
- [Maestro Documentation](https://docs.maestro.dev)

---

## Support

For issues or questions:

1. Check troubleshooting section above
2. Review test execution logs in `test-reports/logs/`
3. Check HTML report for detailed failure information
4. Run with `--help` for command options: `maestro --help`
5. Verify credentials: `eval "$(node scripts/setup/load-credentials.js)" && echo "$COMMON_USER"`
6. Check wrapper status: `which maestro` (should point to wrapper)
