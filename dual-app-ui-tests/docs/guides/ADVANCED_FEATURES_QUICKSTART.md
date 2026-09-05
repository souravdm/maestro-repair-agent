# Advanced Features Quick Start Guide

Get started with performance monitoring, failure analysis, and live dashboard in 5 minutes.

## Prerequisites

```bash
# Install WebSocket dependency for live dashboard
npm install ws

# Or if using yarn
yarn add ws
```

## 1. Performance Monitoring ⚡

### Basic Usage

```bash
# Enable performance monitoring
export ENABLE_PERFORMANCE_MONITORING=true

# Run any test
bash scripts/testing/test.sh .maestro/flows/Account/H100_ACCT_TC001_dashboardNavigation.yaml

# View performance report
cat test-reports/IOS_*/performance.json | jq .
```

### Standalone Monitoring

```bash
# Monitor for 30 seconds
node scripts/utils/performance-monitor.js ios "device-id" "com.cvs.cvsapp" 30000

# Output saved to performance.json
```

### What You'll See

```json
{
  "memory": {
    "min": "145.32 MB",
    "max": "289.67 MB",
    "avg": "198.45 MB"
  },
  "cpu": {
    "min": "12.50%",
    "max": "78.90%",
    "avg": "34.20%"
  },
  "battery": {
    "drain": "2%"
  }
}
```

## 2. Failure Analysis 🔍

### Automatic Analysis

Failure analysis runs automatically when tests fail. No configuration needed!

### View Results

**In HTML Report:**
1. Run test that fails
2. Open HTML report
3. Click "Failures" tab
4. See categorization, patterns, and recommendations

**In JSON:**
```bash
cat test-reports/IOS_*/test-report-*.json | jq .failureAnalysis
```

### Example Output

```json
{
  "totalFailures": 3,
  "categories": {
    "Element Not Found": {
      "count": 2,
      "severity": "high"
    },
    "Timeout": {
      "count": 1,
      "severity": "medium"
    }
  },
  "recommendations": [
    {
      "priority": "high",
      "title": "Fix recurring failures",
      "action": "These tests need immediate attention"
    }
  ]
}
```

## 3. Live Dashboard 📊

### Start Dashboard

```bash
# Start server (default port 8080)
node scripts/reporting/live-dashboard-server.js ./test-reports

# Custom port
node scripts/reporting/live-dashboard-server.js ./test-reports 9000
```

### Open Dashboard

```bash
# Open in browser
open http://localhost:8080
```

### Run Tests

In another terminal:
```bash
bash scripts/testing/test.sh .maestro/flows/suites/smoke-suite.yaml
```

### Watch Live Updates

The dashboard will show:
- ✅ Real-time test counts
- ✅ Pass/fail status
- ✅ Live event feed
- ✅ Performance metrics (if enabled)

## 4. All Together 🚀

### Complete Workflow

```bash
# Terminal 1: Start dashboard
node scripts/reporting/live-dashboard-server.js ./test-reports 8080

# Terminal 2: Run tests with performance monitoring
export ENABLE_PERFORMANCE_MONITORING=true
bash scripts/testing/test.sh .maestro/flows/suites/regression-suite.yaml

# Browser: Watch live
open http://localhost:8080

# After tests complete, view full report
open test-reports/IOS_*/test-report-*.html
```

## 5. CI/CD Integration 🔧

### GitHub Actions

```yaml
name: Advanced Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Install Dependencies
        run: npm install ws
      
      - name: Run Tests with Monitoring
        env:
          ENABLE_PERFORMANCE_MONITORING: true
        run: |
          bash scripts/testing/test.sh .maestro/flows/suites/smoke-suite.yaml
      
      - name: Upload Reports
        uses: actions/upload-artifact@v3
        with:
          name: test-reports
          path: |
            test-reports/**/test-report-*.html
            test-reports/**/test-report-*.json
            test-reports/**/performance.json
```

## 6. Interpreting Results 📈

### Performance Metrics

**Good:**
- Memory: Stable, < 300 MB
- CPU: Average < 50%
- Battery: Drain < 5%

**Investigate:**
- Memory: Growing trend (leak?)
- CPU: Spikes > 80% (bottleneck?)
- Battery: Drain > 10% (power issue?)

### Failure Categories

**Critical (Fix Immediately):**
- Network Error
- App Crash

**High (Fix Soon):**
- Element Not Found
- Assertion Failed

**Medium (Stabilize):**
- Timeout
- Permission Denied
- Test Data Issue

**Low (Infrastructure):**
- Driver Error

### Patterns

**Recurring:** Same test, same error → Real bug  
**Flaky:** Intermittent failures → Add waits/improve selectors  
**Environmental:** Specific to env → Check config

## 7. Troubleshooting 🔧

### Performance Monitoring Not Working

```bash
# Check if device is running
xcrun simctl list devices | grep Booted

# Check if app is installed
xcrun simctl listapps booted | grep cvs

# Test monitor standalone
node scripts/utils/performance-monitor.js ios "" "com.cvs.cvsapp" 5000
```

### Dashboard Not Updating

```bash
# Check if server is running
lsof -i :8080

# Check WebSocket connection in browser console
# Should see: "Connected to live dashboard"

# Verify report directory
ls -la test-reports/IOS_*/
```

### Failure Analysis Missing

```bash
# Check if analyzer loaded
node -e "console.log(require('./scripts/utils/failure-analyzer'))"

# Verify failures exist
cat test-reports/IOS_*/results.xml | grep failures
```

## 8. Advanced Usage 💡

### Custom Performance Thresholds

```javascript
// Create custom monitor
const { PerformanceMonitor } = require('./scripts/utils/performance-monitor');

const monitor = new PerformanceMonitor('ios', deviceId, appId);
monitor.start(1000); // 1s interval for detailed tracking

// After test
const report = monitor.stop();

if (report.memory.max > 500) {
  console.error('Memory threshold exceeded!');
  process.exit(1);
}
```

### Custom Failure Categories

```javascript
// Edit scripts/utils/failure-analyzer.js
const FAILURE_CATEGORIES = {
  // Add your custom category
  CUSTOM_ERROR: {
    name: 'Custom Error Type',
    patterns: [/your pattern here/i],
    severity: 'high',
    commonCauses: ['...'],
    suggestions: ['...'],
  },
  // ... existing categories
};
```

### Dashboard Customization

```javascript
// Edit scripts/reporting/live-dashboard-server.js
// Customize HTML, add charts, change styling
generateDashboardHTML() {
  return `
    <!-- Your custom dashboard HTML -->
  `;
}
```

## 9. Best Practices ✨

### DO:
- ✅ Enable performance monitoring for critical tests
- ✅ Review failure recommendations
- ✅ Use live dashboard for debugging
- ✅ Export JSON for trend analysis
- ✅ Set up CI/CD integration

### DON'T:
- ❌ Enable monitoring on every test (overhead)
- ❌ Ignore recurring failures
- ❌ Skip failure analysis review
- ❌ Run dashboard in production
- ❌ Commit performance.json to git

## 10. Next Steps 🎯

1. **Run your first monitored test**
   ```bash
   export ENABLE_PERFORMANCE_MONITORING=true
   bash scripts/testing/test.sh .maestro/flows/Account/H100_ACCT_TC001_dashboardNavigation.yaml
   ```

2. **Start the live dashboard**
   ```bash
   node scripts/reporting/live-dashboard-server.js ./test-reports
   ```

3. **Review the enhanced HTML report**
   - Check Failures tab for analysis
   - Review performance metrics
   - Read recommendations

4. **Integrate into CI/CD**
   - Add to GitHub Actions
   - Upload artifacts
   - Set up notifications

5. **Explore advanced features**
   - Custom thresholds
   - Pattern detection
   - Trend analysis

---

## 📚 Additional Resources

- [Phase 3 & 4 Documentation](../PHASE3_4_ADVANCED_FEATURES.md)
- [CI/CD Metadata Guide](./CI_CD_METADATA_GUIDE.md)
- [Failure Analyzer Source](../../scripts/utils/failure-analyzer.js)
- [Performance Monitor Source](../../scripts/utils/performance-monitor.js)
- [Live Dashboard Source](../../scripts/reporting/live-dashboard-server.js)

---

**Questions?** Check the troubleshooting section or review the source code for detailed implementation.

**Ready to go!** 🚀
