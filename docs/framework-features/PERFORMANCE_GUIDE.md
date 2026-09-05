# Maestro Performance Optimization Guide

Complete guide to optimizing Maestro test execution using the latest features and best practices.

## Table of Contents
1. [App Performance Testing](#app-performance-testing)
2. [Performance Configuration](#performance-configuration)
3. [Parallel Execution](#parallel-execution)
4. [Smart Waits & Conditional Flows](#smart-waits--conditional-flows)
5. [Test Caching](#test-caching)
6. [Performance Monitoring](#performance-monitoring)
7. [Test Sharding](#test-sharding)
8. [Best Practices](#best-practices)
9. [Benchmarks](#benchmarks)

---

## App Performance Testing

### Quick Start

Generate app performance reports with the `--perf` flag:

```bash
# Run test with performance metrics
bash scripts/testing/test.sh .maestro/flows/Account/login-and-logout.yaml --perf

# With accessibility and performance testing
bash scripts/testing/test.sh <test_path> --a11y --perf

# With all features (accessibility, performance, network capture)
bash scripts/testing/test.sh <test_path> --a11y --perf --network-capture
```

### Performance Metrics Tracked

The `--perf` flag collects and validates 7 key performance metrics:

| Metric | Threshold | Unit | Description |
|--------|-----------|------|-------------|
| App Launch Time | 5000 | ms | Time to launch and initialize app |
| Screen Load Time | 3000 | ms | Time for screens to render |
| API Response Time | 2000 | ms | Backend API response latency |
| Memory Usage | 500 | MB | Peak memory consumption |
| CPU Usage | 80 | % | Peak CPU utilization |
| Animation Frame Rate | 30 | fps | Minimum acceptable frame rate |
| Battery Drain | 10 | %/hour | Battery consumption rate |

### Performance Report Output

The framework generates two report files:

**1. JSON Report** (`performance-report.json`)
```json
{
  "summary": {
    "totalChecks": 7,
    "passedChecks": 6,
    "failedChecks": 1,
    "performanceScore": 85.7
  },
  "metrics": {
    "appLaunchTime": {
      "average": 2500,
      "threshold": 5000,
      "unit": "ms"
    }
  },
  "issues": {
    "critical": 0,
    "high": 1,
    "medium": 0
  }
}
```

**2. HTML Report** (`performance-report.html`)
- Interactive performance dashboard
- Visual performance score (0-100%)
- Metrics comparison against thresholds
- Issues and recommendations
- Color-coded status indicators

### Performance Score

The performance score is calculated as:
```
Score = (Passed Checks / Total Checks) × 100
```

**Score Interpretation:**
- **90-100%**: Excellent performance ✅
- **70-89%**: Good performance, minor optimizations needed ⚠️
- **Below 70%**: Performance issues requiring attention ❌

### Customizing Thresholds

To modify performance thresholds, edit `scripts/performanceTester.js`:

```javascript
this.thresholds = {
  appLaunchTime: 5000,        // Customize as needed
  screenLoadTime: 3000,
  apiResponseTime: 2000,
  memoryUsage: 500,
  cpuUsage: 80,
  animationFrameRate: 30,
  batteryDrain: 10
};
```

### Integration with CI/CD

Add performance testing to your CI/CD pipeline:

```yaml
# GitHub Actions Example
- name: Run Tests with Performance Metrics
  run: |
    bash scripts/testing/test.sh .maestro/flows/Account/login-and-logout.yaml --perf
```

### Performance Testing Best Practices

1. **Run on consistent hardware** - Use the same device/simulator for comparable results
2. **Monitor trends** - Track performance metrics over time to detect regressions
3. **Test under load** - Run performance tests with realistic network conditions
4. **Baseline establishment** - Establish baseline metrics before optimizations
5. **Regular monitoring** - Include performance testing in your CI/CD pipeline

---

## Performance Configuration

### Using Performance Config

The framework includes a comprehensive performance configuration file:

```bash
maestro test --config config/performance.yaml .maestro/flows/Account/test_login.yaml
```

### Key Performance Settings

```yaml
# config/performance.yaml
optimizations:
  skipAnimations: true           # Skip UI animations (30-40% faster)
  disableHardwareKeyboard: true  # Faster text input
  reduceMotion: true             # Reduce motion effects
  fastTyping: true               # Type without delays
  reuseSimulator: true           # Don't restart simulator
```

### Performance Impact

| Setting | Speed Improvement | Trade-off |
|---------|------------------|-----------|
| `skipAnimations: true` | 30-40% | May miss animation-related bugs |
| `fastTyping: true` | 20-30% | May miss keyboard-related issues |
| `reuseSimulator: true` | 50-60% | Potential state pollution |
| `smartWait: true` | 10-20% | None |

---

## Parallel Execution

### Quick Start

Run tests in parallel for **4x faster** execution:

```bash
# Run with 4 parallel workers
./scripts/parallel-test-runner.sh tests/

# Custom parallelism
MAX_PARALLEL=8 ./scripts/parallel-test-runner.sh .maestro/flows/Account/
```

### How It Works

The parallel runner:
1. Discovers all test files
2. Splits them across N workers
3. Runs tests simultaneously
4. Aggregates results

### Performance Gains

| Tests | Sequential | Parallel (4x) | Speedup |
|-------|-----------|---------------|---------|
| 10 tests | 50s | 15s | **3.3x** |
| 50 tests | 250s | 70s | **3.6x** |
| 100 tests | 500s | 140s | **3.6x** |

### Limitations

- Maximum parallelism limited by CPU cores
- Shared resources (simulators) may cause conflicts
- Memory usage increases linearly

---

## Smart Waits & Conditional Flows

### Smart Waits

Maestro automatically waits for elements to appear. Optimize with:

```yaml
# Instead of fixed waits
- wait: 5000  # ❌ Always waits 5 seconds

# Use smart waits
- assertVisible: "Login Button"  # ✅ Waits only until visible (max 10s)
```

### Conditional Flows

Skip unnecessary steps based on app state:

```yaml
# Conditional login - only if not already logged in
- runFlow:
    when:
      notVisible: "Account"  # Only run if not on Account screen
    commands:
      - runFlow: sub.maestro/flows/Account/authentication/validLogin.yaml
```

### Performance Impact

Smart waits reduce average test time by **15-25%** by eliminating unnecessary delays.

---

## Test Caching

### Credential Caching

Cache decrypted credentials to avoid repeated decryption:

```yaml
# config/performance.yaml
cache:
  enabled: true
  credentials: true      # Cache decrypted credentials
  duration: 3600         # 1 hour TTL
```

### App State Caching

Reuse app state between tests:

```yaml
resources:
  resetAppState: false   # Don't reset app (faster)
  clearCache: false      # Don't clear cache
  terminateApp: false    # Keep app running
```

### Performance Impact

- **Credential caching**: 2-3s saved per test
- **App state reuse**: 5-10s saved per test
- **Combined**: Up to **30% faster** test execution

### Trade-offs

- Potential state pollution between tests
- May miss bugs related to fresh app state
- Recommended for smoke tests, not full regression

---

## Performance Monitoring

### Real-time Monitoring

Track test performance with the monitoring script:

```bash
# Monitor single test
node scripts/performance-monitor.js .maestro/flows/Account/test_login.yaml

# Monitor entire suite
node scripts/performance-monitor.js tests/
```

### Metrics Collected

- **Execution time** per test
- **Memory usage** (heap, RSS)
- **CPU usage**
- **Fastest/slowest tests**
- **Average duration**

### Sample Output

```
📈 PERFORMANCE SUMMARY
============================================================
Total Tests: 26
Passed: 24
Failed: 2
Total Duration: 180.45s
Average Duration: 6.94s
Fastest Test: test_app_launch (2.31s)
Slowest Test: test_checkout_flow (15.67s)
============================================================
```

### Performance Reports

Reports are saved to `test-reports/performance/`:

```json
{
  "summary": {
    "totalTests": 26,
    "totalDuration": 180450,
    "averageDuration": "6.94",
    "fastestTest": {
      "name": "test_app_launch",
      "duration": 2310
    },
    "slowestTest": {
      "name": "test_checkout_flow",
      "duration": 15670
    }
  }
}
```

---

## Test Sharding

### What is Test Sharding?

Split tests across multiple machines/processes for distributed execution.

### Usage

```bash
# Run shard 1 of 4
TOTAL_SHARDS=4 CURRENT_SHARD=1 ./scripts/test-sharding.sh tests/

# Run shard 2 of 4
TOTAL_SHARDS=4 CURRENT_SHARD=2 ./scripts/test-sharding.sh tests/
```

### CI/CD Integration

**GitHub Actions Example:**

```yaml
jobs:
  test:
    strategy:
      matrix:
        shard: [1, 2, 3, 4]
    steps:
      - name: Run Tests (Shard ${{ matrix.shard }})
        run: |
          TOTAL_SHARDS=4 CURRENT_SHARD=${{ matrix.shard }} \
          ./scripts/test-sharding.sh tests/
```

### Performance Gains

| Total Tests | Shards | Time (Sequential) | Time (Sharded) | Speedup |
|-------------|--------|-------------------|----------------|---------|
| 100 tests | 1 | 500s | 500s | 1x |
| 100 tests | 2 | 500s | 260s | **1.9x** |
| 100 tests | 4 | 500s | 140s | **3.6x** |
| 100 tests | 8 | 500s | 80s | **6.3x** |

---

## Best Practices

### 1. **Use Performance Config by Default**

```bash
# Always use performance config
maestro test --config config/performance.yaml tests/
```

### 2. **Optimize Test Order**

Run fast tests first for quicker feedback:

```bash
# Run smoke tests first (fast)
maestro test tests/suites/suite-smoke-critical-paths.yaml

# Then run full regression (slow)
maestro test tests/suites/suite-full-regression.yaml
```

### 3. **Minimize App Resets**

```yaml
# Don't reset app between tests
resources:
  resetAppState: false
  terminateApp: false
```

### 4. **Use Subflows for Common Actions**

```yaml
# Reuse login subflow instead of repeating steps
- runFlow: sub.maestro/flows/Account/authentication/validLogin.yaml
```

### 5. **Avoid Fixed Waits**

```yaml
# ❌ Bad - always waits 5 seconds
- wait: 5000

# ✅ Good - waits only until element appears
- assertVisible: "Button"
```

### 6. **Leverage Parallel Execution**

```bash
# Run tests in parallel for 3-4x speedup
MAX_PARALLEL=4 ./scripts/parallel-test-runner.sh tests/
```

### 7. **Monitor Performance Regularly**

```bash
# Track performance trends
node scripts/performance-monitor.js tests/ > performance-baseline.json
```

### 8. **Use Test Sharding in CI/CD**

Split tests across multiple CI workers for faster builds.

---

## Benchmarks

### Baseline Performance (Sequential)

| Test Suite | Tests | Duration | Avg per Test |
|------------|-------|----------|--------------|
| Smoke | 10 | 45s | 4.5s |
| Account | 13 | 90s | 6.9s |
| Shop | 9 | 120s | 13.3s |
| Benefits | 25 | 300s | 12.0s |
| **Full Regression** | **75** | **600s** | **8.0s** |

### Optimized Performance (Parallel + Performance Config)

| Test Suite | Tests | Duration | Speedup |
|------------|-------|----------|---------|
| Smoke | 10 | 12s | **3.8x** |
| Account | 13 | 25s | **3.6x** |
| Shop | 9 | 35s | **3.4x** |
| Benefits | 25 | 85s | **3.5x** |
| **Full Regression** | **75** | **165s** | **3.6x** |

### Performance Improvements Summary

| Optimization | Impact | Recommended For |
|--------------|--------|-----------------|
| Performance Config | 30-40% faster | All tests |
| Parallel Execution | 3-4x faster | CI/CD, local development |
| Smart Waits | 15-25% faster | All tests |
| Test Caching | 20-30% faster | Smoke tests |
| Test Sharding | 2-8x faster | CI/CD pipelines |
| **Combined** | **Up to 10x faster** | **Production CI/CD** |

---

## Quick Reference

### Run Tests with Maximum Performance

```bash
# Single test (optimized)
maestro test --config config/performance.yaml .maestro/flows/Account/test_login.yaml

# Parallel execution (4x workers)
MAX_PARALLEL=4 ./scripts/parallel-test-runner.sh tests/

# With performance monitoring
node scripts/performance-monitor.js tests/

# Sharded execution (CI/CD)
TOTAL_SHARDS=4 CURRENT_SHARD=1 ./scripts/test-sharding.sh tests/
```

### NPM Scripts

```bash
# Run with performance config
npm run test:performance

# Run with monitoring
npm run test:monitor

# Run in parallel
npm run test:parallel
```

---

## Troubleshooting

### Tests Failing in Parallel Mode

**Issue**: Tests pass sequentially but fail in parallel  
**Solution**: Tests may have shared state dependencies. Run with lower parallelism:

```bash
MAX_PARALLEL=2 ./scripts/parallel-test-runner.sh tests/
```

### Simulator Crashes

**Issue**: Simulator crashes with high parallelism  
**Solution**: Reduce parallel workers or increase simulator resources

### Memory Issues

**Issue**: Out of memory errors  
**Solution**: Disable caching or reduce parallelism:

```yaml
cache:
  enabled: false
```

---

## Future Enhancements

- [ ] GPU acceleration for simulators
- [ ] Distributed test execution across multiple machines
- [ ] AI-powered test optimization
- [ ] Automatic flaky test detection
- [ ] Performance regression detection
- [ ] Test result caching (skip unchanged tests)

---

## Summary

This guide covers two complementary aspects of performance:

1. **Test Execution Performance** - Optimizing how fast your tests run (Sections 2-9)
   - Configuration, parallel execution, smart waits, caching, monitoring, sharding
   - Focus: Reducing CI/CD pipeline time

2. **App Performance Testing** - Validating your app's performance metrics (Section 1)
   - Using the `--perf` flag to measure app performance
   - Metrics: Launch time, screen load time, API response, memory, CPU, frame rate, battery
   - Focus: Ensuring app meets performance standards

Both are essential for comprehensive performance management.

---

**Last Updated**: March 6, 2026  
**Framework Version**: Maestro 1.x  
**Platform**: iOS (CVS Health Digital Flagship App)  
**New Features**: App Performance Testing with `--perf` flag (v1.5)
