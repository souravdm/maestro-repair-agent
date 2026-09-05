#!/usr/bin/env node

/**
 * Upload Test Results to Zephyr Scale
 * Parses Maestro test results and uploads to Zephyr
 */

const fs = require('fs');
const path = require('path');
const ZephyrScaleClient = require('./zephyr-scale-client');
const CycleSummaryFormatter = require('./format-cycle-summary');
const config = require('./zephyr-config');
const credentials = require('../../.maestro/config/zephyr-credentials');

class TestResultsUploader {
  constructor(options = {}) {
    this.client = new ZephyrScaleClient(credentials.getConfig());
    this.resultsFile = options.resultsFile || options.results;
    this.cycleKey = options.cycleKey;
    this.platform = options.platform || 'iOS';
    this.environment = options.environment || 'QA';
    this.buildNumber = options.buildNumber || 'N/A';
    this.reportUrl = options.reportUrl;
    this.cicdJobUrl = options.cicdJobUrl || options.jobUrl;
    this.mapper = this.loadMapper();
  }

  /**
   * Load test case mapper
   */
  loadMapper() {
    const mapperPath = path.join(__dirname, 'test-case-mapper.json');
    if (fs.existsSync(mapperPath)) {
      return JSON.parse(fs.readFileSync(mapperPath, 'utf8'));
    }
    return { mappings: {} };
  }

  /**
   * Save test case mapper
   */
  saveMapper() {
    const mapperPath = path.join(__dirname, 'test-case-mapper.json');
    this.mapper._last_sync = new Date().toISOString();
    fs.writeFileSync(mapperPath, JSON.stringify(this.mapper, null, 2));
  }

  /**
   * Parse test results from file
   */
  parseResults() {
    if (!fs.existsSync(this.resultsFile)) {
      throw new Error(`Results file not found: ${this.resultsFile}`);
    }

    const content = fs.readFileSync(this.resultsFile, 'utf8');
    
    // Try JSON first
    try {
      return JSON.parse(content);
    } catch (e) {
      // Parse JUnit XML
      return this.parseJUnitXml(content);
    }
  }

  /**
   * Parse JUnit XML
   */
  parseJUnitXml(xml) {
    const results = {
      tests: [],
      summary: {
        total: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: 0
      }
    };

    // Extract testsuite info
    const testsuiteMatch = xml.match(/<testsuite[^>]*tests="(\d+)"[^>]*failures="(\d+)"[^>]*time="([\d.]+)"/);
    if (testsuiteMatch) {
      results.summary.total = parseInt(testsuiteMatch[1], 10);
      results.summary.failed = parseInt(testsuiteMatch[2], 10);
      results.summary.duration = Math.round(parseFloat(testsuiteMatch[3]));
      results.summary.passed = results.summary.total - results.summary.failed;
    }

    // Extract individual test cases
    const testcaseRegex = /<testcase[^>]*name="([^"]+)"[^>]*time="([\d.]+)"[^>]*>(.*?)<\/testcase>/gs;
    const matches = xml.matchAll(testcaseRegex);

    for (const match of matches) {
      const testName = match[1];
      const duration = Math.round(parseFloat(match[2]));
      const content = match[3];
      
      const hasFailure = content.includes('<failure');
      const failureMatch = content.match(/<failure[^>]*message="([^"]*)"/);
      
      results.tests.push({
        name: testName,
        status: hasFailure ? 'failed' : 'passed',
        duration,
        error: failureMatch ? failureMatch[1] : null
      });
    }

    return results;
  }

  /**
   * Get or create test case in Zephyr
   */
  async getOrCreateTestCase(testName) {
    // Check mapper first
    if (this.mapper.mappings[testName]) {
      return this.mapper.mappings[testName];
    }

    // Extract feature from test name (e.g., TC001_Account_login -> Account)
    const featureMatch = testName.match(/TC\d+_([^_]+)_/);
    const feature = featureMatch ? featureMatch[1] : 'General';
    const folder = config.featureFolderMapping[feature] || '/Automated/General';

    // Search for existing test case
    try {
      const searchResults = await this.client.searchTestCases({
        query: testName,
        folder
      });

      if (searchResults.values && searchResults.values.length > 0) {
        const testCase = searchResults.values[0];
        this.mapper.mappings[testName] = testCase.key;
        this.saveMapper();
        return testCase.key;
      }
    } catch (e) {
      console.error(`Warning: Search failed for ${testName}:`, e.message);
    }

    // Create new test case
    try {
      const testCase = await this.client.createTestCase({
        name: testName,
        folder,
        objective: `Automated test: ${testName}`,
        labels: [...config.defaultLabels, feature.toLowerCase()],
        priority: 'Normal',
        status: 'Approved'
      });

      this.mapper.mappings[testName] = testCase.key;
      this.saveMapper();
      console.error(`✓ Created test case: ${testCase.key} for ${testName}`);
      return testCase.key;
    } catch (e) {
      console.error(`Error creating test case for ${testName}:`, e.message);
      return null;
    }
  }

  /**
   * Upload single test execution
   */
  async uploadExecution(test) {
    const testCaseKey = await this.getOrCreateTestCase(test.name);
    if (!testCaseKey) {
      console.error(`Skipping ${test.name} - no test case key`);
      return null;
    }

    const status = config.statusMapping[test.status] || 'Not Executed';
    
    const execution = {
      testCaseKey,
      testCycleKey: this.cycleKey,
      status,
      executionTime: test.duration || 0,
      environment: this.environment,
      comment: test.error || ''
    };

    try {
      const result = await this.client.createTestExecution(execution);
      console.error(`✓ Uploaded execution for ${test.name}: ${status}`);
      return result;
    } catch (e) {
      console.error(`Error uploading execution for ${test.name}:`, e.message);
      return null;
    }
  }

  /**
   * Update cycle with summary
   */
  async updateCycleSummary(results) {
    const failedTests = results.tests
      .filter(t => t.status === 'failed')
      .map(t => ({ name: t.name, error: t.error }));

    const formatter = new CycleSummaryFormatter({
      results: results.summary,
      reportUrl: this.reportUrl,
      platform: this.platform,
      environment: this.environment,
      buildNumber: this.buildNumber,
      duration: results.summary.duration,
      cicdJobUrl: this.cicdJobUrl,
      failedTests
    });

    const summary = formatter.format();

    try {
      await this.client.updateTestCycle(this.cycleKey, {
        description: summary,
        status: results.summary.failed > 0 ? 'Failed' : 'Done'
      });
      console.error('✓ Updated cycle summary');
    } catch (e) {
      console.error('Warning: Failed to update cycle summary:', e.message);
    }
  }

  /**
   * Upload all test results
   */
  async upload() {
    if (!this.cycleKey) {
      throw new Error('Test cycle key is required. Use create-test-cycle.js first.');
    }

    console.error(`Uploading results from: ${this.resultsFile}`);
    const results = this.parseResults();
    
    console.error(`Found ${results.tests.length} test results`);
    console.error(`Summary: ${results.summary.passed} passed, ${results.summary.failed} failed, ${results.summary.skipped} skipped`);

    // Upload executions
    const uploadPromises = results.tests.map(test => this.uploadExecution(test));
    await Promise.all(uploadPromises);

    // Update cycle summary
    await this.updateCycleSummary(results);

    console.error('✓ Upload complete');
    return {
      cycleKey: this.cycleKey,
      uploaded: results.tests.length,
      summary: results.summary
    };
  }
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, '');
    const value = args[i + 1];
    options[key] = value;
  }

  if (!credentials.isConfigured()) {
    console.error('Error: Zephyr credentials not configured');
    console.error('Set ZEPHYR_API_TOKEN environment variable');
    process.exit(1);
  }

  if (!options.results && !options.resultsFile) {
    console.error('Error: --results or --results-file required');
    process.exit(1);
  }

  if (!options.cycleKey) {
    console.error('Error: --cycle-key required');
    process.exit(1);
  }

  const uploader = new TestResultsUploader(options);
  
  uploader.upload()
    .then(result => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch(error => {
      console.error('Error uploading results:', error.message);
      process.exit(1);
    });
}

module.exports = TestResultsUploader;
