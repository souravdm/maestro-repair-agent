#!/usr/bin/env node

/**
 * Performance Tester for Maestro Tests
 * Collects and analyzes performance metrics during test execution
 * Validates app performance against defined thresholds
 */

const fs = require('fs');
const path = require('path');

class PerformanceTester {
  constructor(reportDir = process.cwd()) {
    this.reportDir = reportDir;
    this.metrics = [];
    this.thresholds = {
      appLaunchTime:     5000,   // ms
      screenLoadTime:    3000,   // ms
      apiResponseTime:   2000,   // ms
      animationFrameRate:  30,   // fps (higher is better)
      memoryUsage:        500,   // MB
      cpuUsage:            80,   // %
      batteryDrain:        10,   // %/hour
      jankRate:             5,   // % janky frames (Android only)
    };
    this.issues = [];
    this.checks = [];
  }

  recordMetric(testName, metricName, value, unit = 'ms') {
    const metric = {
      testName,
      metricName,
      value,
      unit,
      timestamp: new Date().toISOString(),
      passed: this.validateMetric(metricName, value)
    };

    this.metrics.push(metric);
    return metric;
  }

  validateMetric(metricName, value) {
    const threshold = this.thresholds[metricName];
    if (threshold == null) return true;

    // Higher-is-better
    if (metricName === 'animationFrameRate') return value >= threshold;
    // Lower-is-better for everything else
    return value <= threshold;
  }

  checkAppLaunchTime(testName, launchTime) {
    const passed = launchTime <= this.thresholds.appLaunchTime;

    return this.recordCheck(testName, 'App Launch Time', passed, {
      severity: passed ? 'none' : 'high',
      details: `Launch time: ${launchTime}ms (threshold: ${this.thresholds.appLaunchTime}ms)`,
      remediation: 'Optimize app initialization and reduce startup time'
    });
  }

  checkScreenLoadTime(testName, screenName, loadTime) {
    const passed = loadTime <= this.thresholds.screenLoadTime;

    return this.recordCheck(testName, `Screen Load Time - ${screenName}`, passed, {
      severity: passed ? 'none' : 'medium',
      details: `${screenName} load time: ${loadTime}ms (threshold: ${this.thresholds.screenLoadTime}ms)`,
      remediation: 'Optimize screen rendering and data loading'
    });
  }

  checkAPIResponseTime(testName, endpoint, responseTime) {
    const passed = responseTime <= this.thresholds.apiResponseTime;

    return this.recordCheck(testName, `API Response Time - ${endpoint}`, passed, {
      severity: passed ? 'none' : 'medium',
      details: `${endpoint} response time: ${responseTime}ms (threshold: ${this.thresholds.apiResponseTime}ms)`,
      remediation: 'Optimize API endpoint or server response time'
    });
  }

  checkMemoryUsage(testName, memoryMB) {
    const passed = memoryMB <= this.thresholds.memoryUsage;

    return this.recordCheck(testName, 'Memory Usage', passed, {
      severity: passed ? 'none' : 'high',
      details: `Memory usage: ${memoryMB}MB (threshold: ${this.thresholds.memoryUsage}MB)`,
      remediation: 'Reduce memory footprint, check for memory leaks'
    });
  }

  checkCPUUsage(testName, cpuPercent) {
    const passed = cpuPercent <= this.thresholds.cpuUsage;

    return this.recordCheck(testName, 'CPU Usage', passed, {
      severity: passed ? 'none' : 'medium',
      details: `CPU usage: ${cpuPercent}% (threshold: ${this.thresholds.cpuUsage}%)`,
      remediation: 'Optimize CPU-intensive operations, reduce background tasks'
    });
  }

  checkAnimationFrameRate(testName, fps) {
    const passed = fps >= this.thresholds.animationFrameRate;

    return this.recordCheck(testName, 'Animation Frame Rate', passed, {
      severity: passed ? 'none' : 'medium',
      details: `Frame rate: ${fps}fps (threshold: ${this.thresholds.animationFrameRate}fps)`,
      remediation: 'Optimize animations, reduce rendering complexity'
    });
  }

  checkBatteryDrain(testName, drainPercentPerHour) {
    const passed = drainPercentPerHour <= this.thresholds.batteryDrain;

    return this.recordCheck(testName, 'Battery Drain', passed, {
      severity: passed ? 'none' : 'medium',
      details: `Battery drain: ${drainPercentPerHour}%/hour (threshold: ${this.thresholds.batteryDrain}%/hour)`,
      remediation: 'Reduce background activity, optimize power consumption'
    });
  }

  checkJankRate(testName, jankRatePct) {
    const passed = jankRatePct <= this.thresholds.jankRate;
    return this.recordCheck(testName, 'Animation Jank Rate', passed, {
      severity: passed ? 'none' : (jankRatePct > 15 ? 'high' : 'medium'),
      details: `Jank rate: ${jankRatePct.toFixed(1)}% janky frames (threshold: ${this.thresholds.jankRate}%)`,
      remediation: 'Profile UI rendering with Android GPU Inspector; reduce overdraw and complex layouts'
    });
  }

  checkScreenTransition(testName, screenName, durationMs) {
    const passed = durationMs <= this.thresholds.screenLoadTime;
    return this.recordCheck(testName, `Screen Transition: ${screenName}`, passed, {
      severity: passed ? 'none' : (durationMs > 5000 ? 'high' : 'medium'),
      details: `${screenName}: ${durationMs}ms (threshold: ${this.thresholds.screenLoadTime}ms)`,
      remediation: 'Reduce network calls on screen open; lazy-load non-critical content'
    });
  }

  recordCheck(testName, checkName, passed, details = {}) {
    const check = {
      testName,
      checkName,
      passed,
      timestamp: new Date().toISOString(),
      ...details
    };

    this.checks.push(check);

    if (!passed) {
      this.issues.push({
        testName,
        checkName,
        severity: details.severity || 'medium',
        details: details.details || '',
        remediation: details.remediation || ''
      });
    }

    return check;
  }

  setThreshold(metricName, value) {
    if (this.thresholds.hasOwnProperty(metricName)) {
      this.thresholds[metricName] = value;
    }
  }

  getAverageMetric(metricName) {
    const values = this.metrics
      .filter(m => m.metricName === metricName)
      .map(m => m.value);

    if (values.length === 0) return 0;
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  getMetricsByTest(testName) {
    return this.metrics.filter(m => m.testName === testName);
  }

  getMetricsByName(metricName) {
    return this.metrics.filter(m => m.metricName === metricName);
  }

  getPerformanceScore() {
    if (this.checks.length === 0) {
      return 100;
    }

    const passedChecks = this.checks.filter(c => c.passed).length;
    return parseFloat(((passedChecks / this.checks.length) * 100).toFixed(2));
  }

  getIssuesBySeverity(severity) {
    return this.issues.filter(i => i.severity === severity);
  }

  getCriticalIssues() {
    return this.getIssuesBySeverity('critical');
  }

  getHighIssues() {
    return this.getIssuesBySeverity('high');
  }

  getMediumIssues() {
    return this.getIssuesBySeverity('medium');
  }

  generatePerformanceReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalChecks: this.checks.length,
        passedChecks: this.checks.filter(c => c.passed).length,
        failedChecks: this.issues.length,
        performanceScore: this.getPerformanceScore()
      },
      issues: {
        critical: this.getCriticalIssues().length,
        high: this.getHighIssues().length,
        medium: this.getMediumIssues().length
      },
      metrics: {
        appLaunchTime: {
          average: this.getAverageMetric('appLaunchTime'),
          threshold: this.thresholds.appLaunchTime,
          unit: 'ms',
          available: this.getMetricsByName('appLaunchTime').length > 0,
        },
        screenLoadTime: {
          average: this.getAverageMetric('screenLoadTime'),
          threshold: this.thresholds.screenLoadTime,
          unit: 'ms',
          available: this.getMetricsByName('screenLoadTime').length > 0,
        },
        apiResponseTime: {
          average: this.getAverageMetric('apiResponseTime'),
          threshold: this.thresholds.apiResponseTime,
          unit: 'ms',
          available: this.getMetricsByName('apiResponseTime').length > 0,
        },
        memoryUsage: {
          average: this.getAverageMetric('memoryUsage'),
          threshold: this.thresholds.memoryUsage,
          unit: 'MB',
          available: this.getMetricsByName('memoryUsage').length > 0,
        },
        cpuUsage: {
          average: this.getAverageMetric('cpuUsage'),
          threshold: this.thresholds.cpuUsage,
          unit: '%',
          available: this.getMetricsByName('cpuUsage').length > 0,
        },
        animationFrameRate: {
          average: this.getAverageMetric('animationFrameRate'),
          threshold: this.thresholds.animationFrameRate,
          unit: 'fps',
          available: this.getMetricsByName('animationFrameRate').length > 0,
        },
        batteryDrain: {
          average: this.getAverageMetric('batteryDrain'),
          threshold: this.thresholds.batteryDrain,
          unit: '%/hour',
          available: this.getMetricsByName('batteryDrain').length > 0,
        },
        jankRate: {
          average: this.getAverageMetric('jankRate'),
          threshold: this.thresholds.jankRate,
          unit: '% janky frames',
          available: this.getMetricsByName('jankRate').length > 0,
        },
      },
      details: {
        allChecks: this.checks,
        allMetrics: this.metrics,
        issues: this.issues,
        recommendations: this.generateRecommendations()
      }
    };

    return report;
  }

  generateRecommendations() {
    const recommendations = [];

    const criticalIssues = this.getCriticalIssues();
    if (criticalIssues.length > 0) {
      recommendations.push({
        priority: 'critical',
        message: `${criticalIssues.length} critical performance issue(s) found. These must be fixed immediately.`,
        issues: criticalIssues.map(i => ({
          check: i.checkName,
          test: i.testName,
          remediation: i.remediation
        }))
      });
    }

    const highIssues = this.getHighIssues();
    if (highIssues.length > 0) {
      recommendations.push({
        priority: 'high',
        message: `${highIssues.length} high-priority performance issue(s) found. These should be addressed soon.`,
        issues: highIssues.map(i => ({
          check: i.checkName,
          test: i.testName,
          remediation: i.remediation
        }))
      });
    }

    const score = this.getPerformanceScore();
    if (score < 80) {
      recommendations.push({
        priority: 'medium',
        message: `Performance score is ${score}%. Target 95%+ for optimal app performance.`,
        action: 'Review and fix remaining performance issues'
      });
    }

    return recommendations;
  }

  generatePerformanceSummary() {
    const report = this.generatePerformanceReport();
    const score = report.summary.performanceScore;

    const summary = `
=== PERFORMANCE TEST SUMMARY ===
Performance Score: ${score}%

Checks Performed: ${report.summary.totalChecks}
  ✓ Passed: ${report.summary.passedChecks}
  ✗ Failed: ${report.summary.failedChecks}

Issues by Severity:
  🔴 Critical: ${report.issues.critical}
  🟠 High: ${report.issues.high}
  🟡 Medium: ${report.issues.medium}

Average Metrics:
  App Launch Time: ${report.metrics.appLaunchTime.average.toFixed(0)}ms (threshold: ${report.metrics.appLaunchTime.threshold}ms)
  Screen Load Time: ${report.metrics.screenLoadTime.average.toFixed(0)}ms (threshold: ${report.metrics.screenLoadTime.threshold}ms)
  API Response Time: ${report.metrics.apiResponseTime.average.toFixed(0)}ms (threshold: ${report.metrics.apiResponseTime.threshold}ms)
  Memory Usage: ${report.metrics.memoryUsage.average.toFixed(0)}MB (threshold: ${report.metrics.memoryUsage.threshold}MB)
  CPU Usage: ${report.metrics.cpuUsage.average.toFixed(1)}% (threshold: ${report.metrics.cpuUsage.threshold}%)
  Animation Frame Rate: ${report.metrics.animationFrameRate.average.toFixed(1)}fps (threshold: ${report.metrics.animationFrameRate.threshold}fps)
  Battery Drain: ${report.metrics.batteryDrain.average.toFixed(1)}%/hour (threshold: ${report.metrics.batteryDrain.threshold}%/hour)

${report.details.recommendations.length > 0 ? 'Recommendations:\n' + report.details.recommendations.map((r, i) => `  ${i + 1}. [${r.priority.toUpperCase()}] ${r.message}`).join('\n') : 'No recommendations - all checks passed!'}
    `;

    return summary;
  }

  exportPerformanceReport(filename = 'performance-report.json') {
    const report = this.generatePerformanceReport();
    const filepath = path.join(this.reportDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`✓ Performance report exported to: ${filepath}`);
    return filepath;
  }

  clear() {
    this.metrics = [];
    this.issues = [];
    this.checks = [];
    console.log('✓ Performance tester cleared');
  }

  getCheckCount() {
    return this.checks.length;
  }

  getIssueCount() {
    return this.issues.length;
  }

  hasIssues() {
    return this.issues.length > 0;
  }

  hasCriticalIssues() {
    return this.getCriticalIssues().length > 0;
  }
}

module.exports = PerformanceTester;
