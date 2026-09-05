# Maestro Test Reporting - Complete Guide

Comprehensive guide for test reporting, metrics, and result analysis in the Maestro UI testing framework.

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Report Components](#report-components)
4. [Report Output Structure](#report-output-structure)
5. [Running Tests with Reports](#running-tests-with-reports)
6. [Report Formats](#report-formats)
7. [Configuration](#configuration)
8. [Programmatic Usage](#programmatic-usage)
9. [CI/CD Integration](#cicd-integration)
10. [Report Features](#report-features)
11. [Troubleshooting](#troubleshooting)
12. [Best Practices](#best-practices)

---

## Overview

Automatic report generation for every Maestro test run with:
- ✅ Pass/Fail/Skipped status for all tests
- ✅ Screenshots for passed AND failed tests
- ✅ Detailed failure reasons
- ✅ Execution time per test
- ✅ Total suite execution time
- ✅ Centralized timestamped report directories (`{PLATFORM}_{YYYYMMDD_HHMMSS}/`)
- ✅ JUnit XML results for CI/CD pipelines
- ✅ Interactive HTML dashboard
- ✅ Automatic retry on failures (`--retry N`)
- ✅ **Standalone `accessibility-report.html`** with WCAG 2.1/2.2 + VoiceOver/TalkBack (via `--a11y`)
- ✅ **Standalone `pulse-report.html`** with Pulse design system validation (via `--pulse`)
- ✅ **Inline `🎨 Figma Visual Diff` section** with pixel-level comparison against Figma designs (via `--figma-diff`)

### July 2026 Report Upgrades

The HTML report now includes:

| Feature | Description |
|---|---|
| **Environment info bar** | Device name, OS version, app version, build number — read from `meta/env-info.json` |
| **Run history sparkline** | SVG trend graph of pass rates across last 20 runs (from `test-reports/run-history.json`) |
| **Passing tests collapsed** | Passing test cards are hidden by default; toggle with "Show Passing" button |
| **Live test search** | Filter test results by name in real time |
| **Failed test deep links** | Per-test anchor `#test-<slug>` + copy-link 🔗 button |
| **CSV export** | Download test results or API call data as CSV |
| **Slow API highlighting** | API rows highlighted amber (>3s) or red (>8s) |
| **API call search** | Filter API calls table by URL/endpoint |
| **Native API calls section** | Real iOS/Android network calls (no SSL interception needed) |

---

## Quick Start

### Run Tests with Automatic Reports

```bash
cd MaestroUITests

# Main test report only
bash scripts/testing/test.sh .maestro/flows/Account/login-and-logout.yaml

# With Pulse design system report (standalone)
bash scripts/testing/test.sh .maestro/flows/Account/login-and-logout.yaml --pulse

# With WCAG + VoiceOver/TalkBack accessibility report (standalone)
bash scripts/testing/test.sh .maestro/flows/Account/login-and-logout.yaml --a11y

# Retry failed test automatically up to 3 times
bash scripts/testing/test.sh .maestro/flows/Account/login-and-logout.yaml --retry 3

# Stop suite on first failure
bash scripts/testing/test.sh .maestro/apps/cvshealth/suites/smoke.yaml --fail-fast

# With Figma pixel-level visual regression (inline section in main report)
bash scripts/testing/test.sh .maestro/flows/Account/login-and-logout.yaml --figma-diff

# All reports together
bash scripts/testing/test.sh .maestro/flows/Account/login-and-logout.yaml --pulse --a11y --figma-diff
```

All specified reports auto-open in the browser after the test completes.

### View Reports

```bash
# Open HTML report
open test-reports/test-report-latest.html

# Or view JSON report
cat test-reports/maestro-report.json
```

---

## Report Components

### 1. **reportGenerator.js** (`scripts/reportGenerator.js`)

Core reporting engine that tracks and generates test reports.

**Key Features:**
- Records test start, pass, failure, and skip events
- Captures failure screenshots automatically
- Generates JSON reports with complete test data
- Generates interactive HTML reports with visualizations
- Calculates statistics: pass rate, fail rate, skip rate, duration metrics
- Stores test results with error messages and timestamps

**Main Methods:**
```javascript
recordTestStart(testName, flowPath)        // Initialize test tracking
recordTestPass(testResult)                 // Mark test as passed
recordTestFailure(testResult, error, screenshotPath)  // Mark test as failed
recordTestSkip(testResult, reason)         // Mark test as skipped
getStatistics()                            // Get pass/fail/skip metrics
generateJSONReport()                       // Create JSON report
generateHTMLReport()                       // Create interactive HTML report
generateReport()                           // Generate all reports + console output
```

### 2. **testRunner.js** (`scripts/testRunner.js`)

Test execution orchestrator that manages flow discovery and execution with reporting integration.

**Key Features:**
- Discovers flows by pattern matching
- Executes flows sequentially or in parallel
- Supports automatic retry on failures
- Runs tests by feature, tag, or individual flow
- Integrates with reportGenerator for automatic reporting
- CLI interface for easy command-line usage
- Environment variable configuration

**Main Methods:**
```javascript
discoverFlows(pattern)                     // Find flows matching pattern
runFlow(flowPath)                          // Execute single flow
runFlows(flows)                            // Execute multiple flows
runFlowsWithRetry(flows)                   // Execute with automatic retry
runByTag(tag)                              // Run flows with specific tag
runByFeature(feature)                      // Run all flows in feature directory
generateReport()                           // Generate final report
getStatistics()                            // Get execution statistics
```

**CLI Commands:**
```bash
node scripts/testRunner.js all             # Run all flows
node scripts/testRunner.js tag <tag>       # Run flows with tag
node scripts/testRunner.js feature <name>  # Run feature flows
node scripts/testRunner.js flow <path>     # Run single flow
```

### 3. **package.json** (`package.json`)

NPM configuration with convenient test scripts.

**Available Scripts:**
```bash
npm test                    # Run all tests with reporting
npm run test:qa            # Run tests against QA environment
npm run test:prod          # Run tests against Prod environment
npm run test:smoke         # Run smoke tests (by tag)
npm run test:critical      # Run critical tests (by tag)
npm run test:account       # Run Account feature tests
npm run test:shop          # Run Shop feature tests
npm run test:pharmacy      # Run Pharmacy feature tests
npm run test:health        # Run Health feature tests
npm run test:retry         # Run all tests with 2 retries
npm run test:parallel      # Run tests in parallel
npm run clean              # Remove test-reports directory
```

---

## Report Output Structure

### Directory Structure

Each test run creates a timestamped directory under `test-reports/`:

```
test-reports/
└── IOS_20260318_135502/                  # Timestamped directory ({PLATFORM}_{TIMESTAMP})
    ├── test-report-IOS-20260318_135502.html  # Main HTML report (always generated)
    ├── accessibility-report.html            # WCAG + VoiceOver report (--a11y flag)
    ├── pulse-report.html                    # Pulse design system report (--pulse flag)
    ├── results-IOS-20260318_135502.xml      # JUnit XML results
    ├── hierarchies/                         # UI hierarchy JSON snapshots (feeds a11y & pulse)
    ├── screenshots/                         # Test screenshots
    ├── logs/                                # Execution logs
    └── network/                             # Network call logs (--network-capture)
```

### Standalone Report Flags

| Flag | Report file | Contents |
|------|------------|----------|
| _(default)_ | `test-report-*.html` | Pass/fail, screenshots, logs, failure context |
| `--a11y` | `accessibility-report.html` | WCAG 2.1/2.2 violations + VoiceOver/TalkBack matrix + nav order |
| `--pulse` | `pulse-report.html` | Pulse component violations with element details (type, ID, size, depth) |

### Quick Access

```bash
# Open main report
open test-reports/IOS_*/test-report-*.html

# Open accessibility report
open test-reports/IOS_*/accessibility-report.html

# Open Pulse report
open test-reports/IOS_*/pulse-report.html
```

---

## Running Tests with Reports

### Using Maestro Wrapper Script

```bash
# Run with automatic report generation
./scripts/run-tests-with-report.sh .maestro/flows/Account/

# Run specific test
./scripts/run-tests-with-report.sh .maestro/flows/Account/test_simple_login.yaml

# Run with options
./scripts/run-tests-with-report.sh .maestro/flows/ --platform android --record
```

### Using NPM Scripts

```bash
# Smoke tests
npm run test:smoke

# Account tests
npm run test:account

# Full regression
npm test

# With retries
npm run test:retry

# In parallel
npm run test:parallel
```

### Using Maestro CLI Directly

```bash
# Run single test
maestro test .maestro/flows/Account/test_simple_login.yaml

# Run all tests in directory
maestro test .maestro/flows/Account/

# Run with environment variables
maestro test --env COMMON_USER=user@example.com .maestro/flows/Account/
```

---

## Report Formats

### JSON Report Format

```json
{
  "timestamp": "2026-01-09T23:46:00.000Z",
  "duration": 45230,
  "statistics": {
    "total": 10,
    "passed": 8,
    "failed": 1,
    "skipped": 1,
    "passRate": "80.00",
    "failRate": "10.00",
    "skipRate": "10.00",
    "totalDuration": 45230,
    "averageDuration": "4523.00"
  },
  "testResults": [
    {
      "testName": "validLoginAndLogout",
      "flowPath": ".maestro/flows/Account/validLoginAndLogout.yaml",
      "status": "passed",
      "duration": 10000,
      "error": null,
      "screenshot": null
    },
    {
      "testName": "cartCheckoutFlow",
      "flowPath": ".maestro/flows/Shop/cartCheckoutFlow.yaml",
      "status": "failed",
      "duration": 9000,
      "error": {
        "message": "assertVisible: Payment Method - Element not found",
        "timestamp": "2026-01-09T23:45:35.000Z"
      },
      "screenshot": "cartCheckoutFlow_1234567890.png"
    }
  ]
}
```

### HTML Report Features

**Dashboard Section:**
- Total test count with color-coded statistics
- Pass/Fail/Skip counts with percentages
- Total and average execution duration
- Visual progress bar showing pass rate

**Failed Tests Section:**
- Dedicated list of failed tests
- Error messages with full context
- Clickable failure screenshots
- Execution timestamps

**Complete Test List:**
- All tests with status indicators
- Color-coded by status (green/red/yellow)
- Execution duration for each test
- Error details for failures
- Skip reasons for skipped tests

---

## Configuration

### Environment Variables

```bash
MAESTRO_CONFIG=config/config.qa.yaml      # Config file (default: .maestro/config/config.yaml)
FLOWS_DIR=flows                           # Flows directory (default: flows)
REPORT_DIR=./test-reports                 # Report output (default: ./test-reports)
PARALLEL=true                             # Parallel execution (default: false)
MAX_RETRIES=2                             # Retry failed tests (default: 0)
TIMEOUT=600000                            # Timeout per flow in ms (default: 300000)
```

### Example Usage

```bash
# Run QA tests with retries
MAESTRO_CONFIG=config/config.qa.yaml \
MAX_RETRIES=1 \
node scripts/testRunner.js all

# Run tests in parallel with custom report directory
PARALLEL=true \
REPORT_DIR=./ci-reports \
npm test

# Run feature tests with longer timeout
TIMEOUT=600000 \
node scripts/testRunner.js feature Account
```

### Maestro Wrapper Configuration

The wrapper script (`scripts/run-tests-with-report.sh`) includes:

```bash
# Report directory
REPORT_DIR="test-reports"

# Screenshots directory
SCREENSHOTS_DIR="$REPORT_DIR/screenshots"

# Logs directory
LOGS_DIR="$REPORT_DIR/logs"

# Videos directory (if recording enabled)
VIDEOS_DIR="$REPORT_DIR/videos"
```

---

## Programmatic Usage

### Using testRunner.js

```javascript
const MaestroTestRunner = require('./scripts/testRunner');

const runner = new MaestroTestRunner({
  configFile: 'config/config.qa.yaml',
  flowsDir: 'flows',
  outputDir: './test-reports',
  parallel: false,
  maxRetries: 1,
  timeout: 300000
});

runner.discoverFlows();
runner.runFlows().then(() => {
  runner.generateReport();
  const stats = runner.getStatistics();
  console.log(`Pass Rate: ${stats.passRate}%`);
});
```

### Using reportGenerator.js

```javascript
const ReportGenerator = require('./scripts/reportGenerator');

const reporter = new ReportGenerator({
  outputDir: './test-reports',
  screenshotDir: './test-reports/screenshots'
});

// Record test events
reporter.recordTestStart('loginTest', 'flows/Account/login.yaml');
reporter.recordTestPass({
  testName: 'loginTest',
  duration: 5000
});

// Generate reports
reporter.generateReport();
const stats = reporter.getStatistics();
console.log(`Total: ${stats.total}, Passed: ${stats.passed}`);
```

---

## CI/CD Integration

### GitHub Actions

```yaml
- name: Run Maestro Tests
  working-directory: MaestroUITests
  env:
    MAESTRO_CONFIG: config/config.qa.yaml
    MAX_RETRIES: 1
  run: npm test

- name: Upload Reports
  if: always()
  uses: actions/upload-artifact@v2
  with:
    name: maestro-reports
    path: MaestroUITests/test-reports/
```

### Jenkins Pipeline

```groovy
stage('Run Maestro Tests') {
  steps {
    dir('MaestroUITests') {
      sh '''
        export MAESTRO_CONFIG=config/config.qa.yaml
        npm test
      '''
    }
  }
}

stage('Archive Reports') {
  steps {
    archiveArtifacts artifacts: 'MaestroUITests/test-reports/**'
    publishHTML([
      reportDir: 'MaestroUITests/test-reports',
      reportFiles: 'maestro-report.html',
      reportName: 'Maestro Test Report'
    ])
  }
}
```

### CircleCI

Reports are automatically generated and uploaded as artifacts in CircleCI.

**Access Reports in CircleCI:**
1. Go to your CircleCI job
2. Click **Artifacts** tab
3. Open `test-reports/test-report-latest.html`

---

## Report Features

### What's Included

- ✅ Test summary dashboard
- ✅ Pass/Fail/Skipped counts
- ✅ Execution times
- ✅ Screenshots for all tests
- ✅ Failure reasons
- ✅ Success rate percentage
- ✅ Duration metrics
- ✅ Error details
- ✅ Timestamp information
- ✅ JSON export

### Key Capabilities

| Feature | Details |
|---------|---------|
| **Pass/Fail Tracking** | Automatic tracking of test outcomes with percentage rates |
| **Failure Screenshots** | Automatically captured on test failures for debugging |
| **Error Details** | Full error messages with timestamps and stack traces |
| **Duration Metrics** | Total and average execution time per test |
| **HTML Dashboard** | Interactive report with visual progress indicators |
| **JSON Export** | Machine-readable format for CI/CD integration |
| **Retry Logic** | Automatic retry of failed tests with configurable attempts |
| **Parallel Execution** | Optional parallel test execution for faster feedback |
| **Feature/Tag Filtering** | Run tests by feature area or tag for targeted testing |
| **Environment Config** | Flexible configuration via environment variables |

---

## Troubleshooting

### Reports Not Generated

**Problem:** Test runs but no reports are created

**Solutions:**
1. Verify `test-reports/` directory exists or is writable
2. Check that `reportGenerator.js` is in `scripts/`
3. Ensure test execution completed successfully
4. Check for errors in test logs

```bash
# Create reports directory if missing
mkdir -p test-reports

# Check permissions
ls -la test-reports/
```

### Screenshots Not Captured

**Problem:** Report shows no screenshots for failed tests

**Solutions:**
1. Verify `screenshots/` directory exists in `test-reports/`
2. Check that failures are being captured
3. Ensure Maestro has permission to capture screenshots

```bash
# Create screenshots directory
mkdir -p test-reports/screenshots

# Check for screenshot files
ls -la test-reports/screenshots/
```

### Report Not Opening

**Problem:** HTML report won't open in browser

**Solutions:**
1. Verify the file exists: `ls test-reports/maestro-report.html`
2. Try opening with different browser
3. Check file permissions: `chmod 644 test-reports/maestro-report.html`

### Statistics Incorrect

**Problem:** Pass/fail counts don't match actual results

**Solutions:**
1. Clear old reports: `npm run clean`
2. Verify test execution completed
3. Check for duplicate test names
4. Review test logs for errors

---

## Best Practices

1. **Always review failed tests** - Check screenshots and error messages
2. **Monitor execution times** - Track performance trends
3. **Archive old reports** - Keep test-reports directory clean
4. **Use meaningful test names** - Makes reports easier to read
5. **Run smoke tests first** - Catch issues early
6. **Enable retries in CI/CD** - Reduce flaky test failures
7. **Monitor pass rates** - Track quality over time
8. **Use tags for filtering** - Organize tests by category
9. **Automate report uploads** - Store reports for analysis
10. **Review reports regularly** - Identify patterns and trends

---

## Files Created

1. `scripts/reportGenerator.js` - Core reporting engine (700+ lines)
2. `scripts/testRunner.js` - Test execution orchestrator (400+ lines)
3. `scripts/run-tests-with-report.sh` - Wrapper script with reporting
4. `package.json` - NPM configuration with test scripts
5. `docs/REPORTING_COMPLETE_GUIDE.md` - This comprehensive documentation

---

## Next Steps

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Run Tests:**
   ```bash
   npm test
   ```

3. **View Reports:**
   - HTML: `open test-reports/maestro-report.html`
   - JSON: `cat test-reports/maestro-report.json`

4. **Customize Configuration:**
   - Update `package.json` scripts as needed
   - Set environment variables for different environments
   - Modify report output directory as required

---

## Support

For detailed information, refer to:
- `scripts/reportGenerator.js` - Implementation details
- `scripts/testRunner.js` - Execution logic
- `package.json` - Available test scripts
- `scripts/run-tests-with-report.sh` - Wrapper script documentation
