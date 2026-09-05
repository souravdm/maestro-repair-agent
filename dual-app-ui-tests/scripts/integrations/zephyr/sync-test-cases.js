#!/usr/bin/env node

/**
 * Sync Test Cases between Maestro and Zephyr Scale
 * Bidirectional synchronization of test cases
 */

const fs = require('fs');
const path = require('path');
const { glob } = require('glob');
const ZephyrScaleClient = require('./zephyr-scale-client');
const config = require('./zephyr-config');
const credentials = require('../../.maestro/config/zephyr-credentials');

class TestCaseSync {
  constructor(options = {}) {
    this.client = new ZephyrScaleClient(credentials.getConfig());
    this.mode = options.mode || 'push'; // push, pull, sync
    this.folder = options.folder;
    this.dryRun = options.dryRun || false;
    this.mapper = this.loadMapper();
    this.flowsDir = path.join(__dirname, '../../../.maestro/flows');
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
   * Find all Maestro test flows
   */
  async findMaestroTests() {
    const pattern = path.join(this.flowsDir, '**/TC*.yaml');
    const files = await glob(pattern);
    
    return files.map(file => {
      const relativePath = path.relative(this.flowsDir, file);
      const testName = path.basename(file, '.yaml');
      const featureMatch = relativePath.match(/^([^\/]+)\//);
      const feature = featureMatch ? featureMatch[1] : 'General';
      
      return {
        file,
        testName,
        feature,
        folder: config.featureFolderMapping[feature] || '/Automated/General'
      };
    });
  }

  /**
   * Parse test metadata from YAML
   */
  parseTestMetadata(file) {
    const content = fs.readFileSync(file, 'utf8');
    const metadata = {
      tags: [],
      priority: 'Normal',
      description: ''
    };

    // Extract tags
    const tagsMatch = content.match(/tags:\s*\n((?:\s+-\s+.+\n)+)/);
    if (tagsMatch) {
      metadata.tags = tagsMatch[1]
        .split('\n')
        .map(line => line.trim().replace(/^-\s+/, ''))
        .filter(Boolean);
    }

    // Extract description from comments
    const descMatch = content.match(/^#\s+(.+)$/m);
    if (descMatch) {
      metadata.description = descMatch[1];
    }

    // Infer priority from tags
    if (metadata.tags.includes('smoke') || metadata.tags.includes('critical')) {
      metadata.priority = 'High';
    }

    return metadata;
  }

  /**
   * Push Maestro tests to Zephyr
   */
  async pushToZephyr() {
    console.error('Finding Maestro test flows...');
    const tests = await this.findMaestroTests();
    console.error(`Found ${tests.length} test flows`);

    let created = 0;
    let updated = 0;
    let skipped = 0;

    for (const test of tests) {
      try {
        const metadata = this.parseTestMetadata(test.file);
        
        // Check if already mapped
        if (this.mapper.mappings[test.testName]) {
          console.error(`Skipping ${test.testName} - already mapped to ${this.mapper.mappings[test.testName]}`);
          skipped++;
          continue;
        }

        if (this.dryRun) {
          console.error(`[DRY RUN] Would create: ${test.testName} in ${test.folder}`);
          continue;
        }

        // Create test case in Zephyr
        const testCase = await this.client.createTestCase({
          name: test.testName,
          folder: test.folder,
          objective: metadata.description || `Automated test: ${test.testName}`,
          labels: [...config.defaultLabels, test.feature.toLowerCase(), ...metadata.tags],
          priority: metadata.priority,
          status: 'Approved'
        });

        this.mapper.mappings[test.testName] = testCase.key;
        console.error(`✓ Created: ${test.testName} -> ${testCase.key}`);
        created++;

        // Rate limiting - wait between requests
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (e) {
        console.error(`Error syncing ${test.testName}:`, e.message);
      }
    }

    if (!this.dryRun) {
      this.saveMapper();
    }

    return { created, updated, skipped, total: tests.length };
  }

  /**
   * Pull Zephyr tests to create YAML templates
   */
  async pullFromZephyr() {
    console.error('Fetching test cases from Zephyr...');
    
    const searchParams = this.folder ? { folder: this.folder } : {};
    const results = await this.client.searchTestCases(searchParams);
    
    console.error(`Found ${results.values?.length || 0} test cases in Zephyr`);

    let created = 0;

    for (const testCase of results.values || []) {
      try {
        // Check if already exists
        const testName = testCase.name;
        const feature = testCase.folder?.split('/').pop() || 'General';
        const targetFile = path.join(this.flowsDir, feature, `${testName}.yaml`);

        if (fs.existsSync(targetFile)) {
          console.error(`Skipping ${testName} - file already exists`);
          continue;
        }

        if (this.dryRun) {
          console.error(`[DRY RUN] Would create: ${targetFile}`);
          continue;
        }

        // Create YAML template
        const template = this.generateYamlTemplate(testCase);
        
        // Ensure directory exists
        const dir = path.dirname(targetFile);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(targetFile, template);
        console.error(`✓ Created: ${targetFile}`);
        created++;
      } catch (e) {
        console.error(`Error creating template for ${testCase.name}:`, e.message);
      }
    }

    return { created, total: results.values?.length || 0 };
  }

  /**
   * Generate YAML template from Zephyr test case
   */
  generateYamlTemplate(testCase) {
    const lines = [
      `# ${testCase.name}`,
      `# ${testCase.objective || 'No description'}`,
      `# Zephyr Key: ${testCase.key}`,
      '',
      'appId: ${APP_ID}',
      'tags:'
    ];

    // Add labels as tags
    if (testCase.labels && testCase.labels.length > 0) {
      testCase.labels.forEach(label => {
        lines.push(`  - ${label}`);
      });
    } else {
      lines.push('  - automated');
    }

    lines.push('');
    lines.push('---');
    lines.push('');
    lines.push('# TODO: Implement test steps');
    lines.push('- launchApp');
    lines.push('');

    return lines.join('\n');
  }

  /**
   * Sync (bidirectional)
   */
  async sync() {
    console.error('Starting bidirectional sync...');
    
    const pushResults = await this.pushToZephyr();
    console.error('\nPush results:', pushResults);
    
    const pullResults = await this.pullFromZephyr();
    console.error('\nPull results:', pullResults);
    
    return { push: pushResults, pull: pullResults };
  }

  /**
   * Execute sync based on mode
   */
  async execute() {
    switch (this.mode) {
      case 'push':
        return this.pushToZephyr();
      case 'pull':
        return this.pullFromZephyr();
      case 'sync':
        return this.sync();
      default:
        throw new Error(`Unknown sync mode: ${this.mode}`);
    }
  }
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = { mode: 'push' };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--push') {
      options.mode = 'push';
    } else if (arg === '--pull') {
      options.mode = 'pull';
    } else if (arg === '--sync') {
      options.mode = 'sync';
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--folder') {
      options.folder = args[++i];
    }
  }

  if (!credentials.isConfigured()) {
    console.error('Error: Zephyr credentials not configured');
    console.error('Set ZEPHYR_API_TOKEN environment variable');
    process.exit(1);
  }

  const sync = new TestCaseSync(options);
  
  sync.execute()
    .then(result => {
      console.log('\n✓ Sync complete');
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch(error => {
      console.error('Error during sync:', error.message);
      process.exit(1);
    });
}

module.exports = TestCaseSync;
