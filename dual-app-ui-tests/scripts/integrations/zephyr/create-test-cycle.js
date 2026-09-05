#!/usr/bin/env node

/**
 * Create Test Cycle in Zephyr Scale
 * Creates a new test cycle for test execution tracking
 */

const ZephyrScaleClient = require('./zephyr-scale-client');
const config = require('./zephyr-config');
const credentials = require('../../.maestro/config/zephyr-credentials');

class TestCycleCreator {
  constructor(options = {}) {
    this.client = new ZephyrScaleClient(credentials.getConfig());
    this.name = options.name;
    this.description = options.description || '';
    this.version = options.version;
    this.environment = options.environment || 'QA';
    this.folder = options.folder || '/Automated';
    this.reportUrl = options.reportUrl;
    this.template = options.template || 'ci';
  }

  /**
   * Apply template to cycle name
   */
  applyTemplate(template, replacements) {
    let result = template;
    for (const [key, value] of Object.entries(replacements)) {
      result = result.replace(`{${key}}`, value);
    }
    return result;
  }

  /**
   * Generate cycle name from template
   */
  generateCycleName() {
    if (this.name) {
      return this.name;
    }

    const template = config.cycleTemplates[this.template];
    if (!template) {
      throw new Error(`Unknown cycle template: ${this.template}`);
    }

    const replacements = {
      BUILD_NUMBER: process.env.CIRCLE_BUILD_NUM || process.env.GITHUB_RUN_NUMBER || 'local',
      PLATFORM: process.env.PLATFORM || 'iOS',
      FEATURE: process.env.FEATURE || 'General',
      ENVIRONMENT: this.environment
    };

    return this.applyTemplate(template.name, replacements);
  }

  /**
   * Generate cycle description
   */
  generateDescription() {
    if (this.description) {
      return this.description;
    }

    const parts = [
      'Automated test execution',
      `Environment: ${this.environment}`,
      `Version: ${this.version || 'N/A'}`
    ];

    if (this.reportUrl) {
      parts.push(`Report: ${this.reportUrl}`);
    }

    return parts.join('\n');
  }

  /**
   * Create test cycle
   */
  async create() {
    const cycleName = this.generateCycleName();
    const description = this.generateDescription();
    
    const today = new Date().toISOString().split('T')[0];

    const cycleData = {
      name: cycleName,
      description,
      startDate: today,
      endDate: today,
      folder: this.folder,
      status: 'In Progress',
      customFields: {
        Environment: this.environment,
        Version: this.version || 'N/A',
        'Report URL': this.reportUrl || 'N/A'
      }
    };

    console.error(`Creating test cycle: ${cycleName}`);
    const result = await this.client.createTestCycle(cycleData);
    
    console.error(`✓ Test cycle created: ${result.key}`);
    return result;
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

  const creator = new TestCycleCreator(options);
  
  creator.create()
    .then(result => {
      console.log(result.key); // Output cycle key for use in scripts
      process.exit(0);
    })
    .catch(error => {
      console.error('Error creating test cycle:', error.message);
      process.exit(1);
    });
}

module.exports = TestCycleCreator;
