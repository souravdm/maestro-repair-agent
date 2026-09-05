#!/usr/bin/env node

/**
 * Format Test Cycle Summary
 * Creates detailed execution summary for Zephyr test cycles
 */

const fs = require('fs');
const path = require('path');

class CycleSummaryFormatter {
  constructor(options = {}) {
    this.results = options.results || {};
    this.reportUrl = options.reportUrl;
    this.platform = options.platform || 'iOS';
    this.environment = options.environment || 'QA';
    this.buildNumber = options.buildNumber || 'N/A';
    this.duration = options.duration || 0;
    this.cicdJobUrl = options.cicdJobUrl;
    this.failedTests = options.failedTests || [];
    this.screenshotUrls = options.screenshotUrls || {};
  }

  /**
   * Format duration in human-readable format
   */
  formatDuration(seconds) {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  }

  /**
   * Format timestamp
   */
  formatTimestamp(date = new Date()) {
    return date.toISOString().replace('T', ' ').substring(0, 19) + ' UTC';
  }

  /**
   * Generate test statistics section
   */
  generateStatsSection() {
    const { total = 0, passed = 0, failed = 0, skipped = 0 } = this.results;
    
    return [
      '## 🧪 Test Execution Report',
      '',
      `**📊 Results:** ${passed} Passed | ${failed} Failed | ${skipped} Skipped (Total: ${total})`,
      `**📱 Platform:** ${this.platform}`,
      `**🌍 Environment:** ${this.environment}`,
      `**🏗️ Build:** #${this.buildNumber}`,
      `**⏱️ Duration:** ${this.formatDuration(this.duration)}`,
      `**📅 Executed:** ${this.formatTimestamp()}`,
      ''
    ].join('\n');
  }

  /**
   * Generate report URL section
   */
  generateReportSection() {
    if (!this.reportUrl) {
      return '### 📄 Report\nLocal execution - no shareable report URL\n';
    }

    return [
      '### 🔗 Full Report',
      `[View Detailed HTML Report](${this.reportUrl})`,
      ''
    ].join('\n');
  }

  /**
   * Generate failed tests section
   */
  generateFailedTestsSection() {
    if (!this.failedTests || this.failedTests.length === 0) {
      return '';
    }

    const lines = [
      `### ❌ Failed Tests (${this.failedTests.length})`,
      ''
    ];

    this.failedTests.forEach((test, index) => {
      const testName = test.name || test.testName || `Test ${index + 1}`;
      const error = test.error || test.message || 'No error message';
      const screenshotUrl = this.screenshotUrls[testName] || test.screenshotUrl;

      lines.push(`${index + 1}. **${testName}**${screenshotUrl ? ` - [Screenshot](${screenshotUrl})` : ''}`);
      lines.push(`   - Error: ${error}`);
    });

    lines.push('');
    return lines.join('\n');
  }

  /**
   * Generate CI/CD job section
   */
  generateCicdSection() {
    if (!this.cicdJobUrl) {
      return '';
    }

    const platform = this.cicdJobUrl.includes('circleci') ? 'CircleCI' : 
                     this.cicdJobUrl.includes('github') ? 'GitHub Actions' : 'CI/CD';

    return [
      '### 🔧 CI/CD Job',
      `[${platform} Job #${this.buildNumber}](${this.cicdJobUrl})`,
      ''
    ].join('\n');
  }

  /**
   * Generate complete summary
   */
  format() {
    const sections = [
      this.generateStatsSection(),
      this.generateReportSection(),
      this.generateFailedTestsSection(),
      this.generateCicdSection()
    ];

    return sections.filter(s => s).join('\n');
  }

  /**
   * Parse test results from JUnit XML or JSON
   */
  static parseResults(resultsFile) {
    if (!fs.existsSync(resultsFile)) {
      throw new Error(`Results file not found: ${resultsFile}`);
    }

    const content = fs.readFileSync(resultsFile, 'utf8');
    
    // Try JSON first
    try {
      const json = JSON.parse(content);
      return {
        total: json.total || 0,
        passed: json.passed || 0,
        failed: json.failed || 0,
        skipped: json.skipped || 0,
        duration: json.duration || 0,
        failedTests: json.failedTests || []
      };
    } catch (e) {
      // Try XML parsing
      return CycleSummaryFormatter.parseJUnitXml(content);
    }
  }

  /**
   * Parse JUnit XML results
   */
  static parseJUnitXml(xml) {
    const results = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      duration: 0,
      failedTests: []
    };

    // Simple regex-based parsing (for production, use a proper XML parser)
    const testsuiteMatch = xml.match(/<testsuite[^>]*tests="(\d+)"[^>]*failures="(\d+)"[^>]*time="([\d.]+)"/);
    if (testsuiteMatch) {
      results.total = parseInt(testsuiteMatch[1], 10);
      results.failed = parseInt(testsuiteMatch[2], 10);
      results.duration = Math.round(parseFloat(testsuiteMatch[3]));
      results.passed = results.total - results.failed;
    }

    // Extract failed test names
    const failureMatches = xml.matchAll(/<testcase[^>]*name="([^"]+)"[^>]*>.*?<failure[^>]*message="([^"]*)"[^>]*>/gs);
    for (const match of failureMatches) {
      results.failedTests.push({
        name: match[1],
        error: match[2]
      });
    }

    return results;
  }
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, '');
    const value = args[i + 1];
    
    if (key === 'results-file') {
      const results = CycleSummaryFormatter.parseResults(value);
      Object.assign(options, { results });
    } else if (key === 'failed-tests') {
      options.failedTests = JSON.parse(value);
    } else if (key === 'screenshot-urls') {
      options.screenshotUrls = JSON.parse(value);
    } else {
      options[key] = value;
    }
  }

  try {
    const formatter = new CycleSummaryFormatter(options);
    const summary = formatter.format();
    console.log(summary);
    process.exit(0);
  } catch (error) {
    console.error('Error formatting cycle summary:', error.message);
    process.exit(1);
  }
}

module.exports = CycleSummaryFormatter;
