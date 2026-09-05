#!/usr/bin/env node

/**
 * CI/CD Metadata Collector
 * Collects build information, Git context, and environment details
 * for inclusion in test reports
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Execute command and return output, or default value on error
 */
function exec(cmd, defaultValue = '') {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim();
  } catch (e) {
    return defaultValue;
  }
}

/**
 * Collect all CI/CD metadata
 */
function collectMetadata() {
  const metadata = {
    timestamp: new Date().toISOString(),
    
    // Git information
    git: {
      commit: process.env.GIT_COMMIT || process.env.CI_COMMIT_SHA || exec('git rev-parse HEAD'),
      commitShort: process.env.GIT_COMMIT_SHORT || exec('git rev-parse --short HEAD'),
      branch: process.env.GIT_BRANCH || process.env.CI_COMMIT_BRANCH || exec('git rev-parse --abbrev-ref HEAD'),
      author: exec('git log -1 --pretty=format:"%an"'),
      authorEmail: exec('git log -1 --pretty=format:"%ae"'),
      message: exec('git log -1 --pretty=format:"%s"'),
      commitDate: exec('git log -1 --pretty=format:"%ci"'),
      tag: exec('git describe --tags --exact-match 2>/dev/null', ''),
      remoteUrl: exec('git config --get remote.origin.url'),
    },
    
    // CI/CD environment
    ci: {
      provider: detectCIProvider(),
      buildNumber: process.env.BUILD_NUMBER || process.env.CI_BUILD_NUMBER || process.env.GITHUB_RUN_NUMBER || '',
      buildId: process.env.BUILD_ID || process.env.CI_BUILD_ID || process.env.GITHUB_RUN_ID || '',
      jobName: process.env.JOB_NAME || process.env.CI_JOB_NAME || process.env.GITHUB_JOB || '',
      buildUrl: process.env.BUILD_URL || process.env.CI_JOB_URL || process.env.GITHUB_SERVER_URL ? 
        `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : '',
      pipelineUrl: process.env.CI_PIPELINE_URL || '',
      triggeredBy: process.env.BUILD_USER || process.env.GITLAB_USER_NAME || process.env.GITHUB_ACTOR || '',
      trigger: process.env.BUILD_CAUSE || detectTrigger(),
    },
    
    // Pull Request / Merge Request info
    pr: {
      number: process.env.CHANGE_ID || process.env.CI_MERGE_REQUEST_IID || process.env.GITHUB_PR_NUMBER || '',
      title: process.env.CHANGE_TITLE || process.env.CI_MERGE_REQUEST_TITLE || '',
      url: process.env.CHANGE_URL || process.env.CI_MERGE_REQUEST_PROJECT_URL || '',
      sourceBranch: process.env.CHANGE_BRANCH || process.env.CI_MERGE_REQUEST_SOURCE_BRANCH_NAME || process.env.GITHUB_HEAD_REF || '',
      targetBranch: process.env.CHANGE_TARGET || process.env.CI_MERGE_REQUEST_TARGET_BRANCH_NAME || process.env.GITHUB_BASE_REF || '',
    },
    
    // Environment
    environment: {
      name: process.env.ENVIRONMENT || process.env.ENV || process.env.MAESTRO_ENV || 'unknown',
      platform: process.env.PLATFORM || 'ios',
      appVersion: process.env.APP_VERSION || '',
      buildType: process.env.BUILD_TYPE || process.env.CONFIGURATION || 'Debug',
      testSuite: process.env.TEST_SUITE || '',
    },
    
    // System info
    system: {
      os: process.platform,
      osVersion: exec('sw_vers -productVersion 2>/dev/null || uname -r'),
      hostname: exec('hostname'),
      user: process.env.USER || process.env.USERNAME || '',
      nodeVersion: process.version,
      maestroVersion: exec('maestro --version 2>/dev/null | head -1', 'unknown'),
    },
  };
  
  return metadata;
}

/**
 * Detect CI provider
 */
function detectCIProvider() {
  if (process.env.JENKINS_URL) return 'Jenkins';
  if (process.env.GITLAB_CI) return 'GitLab CI';
  if (process.env.GITHUB_ACTIONS) return 'GitHub Actions';
  if (process.env.CIRCLECI) return 'CircleCI';
  if (process.env.TRAVIS) return 'Travis CI';
  if (process.env.BITBUCKET_PIPELINE_UUID) return 'Bitbucket Pipelines';
  if (process.env.TEAMCITY_VERSION) return 'TeamCity';
  if (process.env.BUILDKITE) return 'Buildkite';
  if (process.env.CI) return 'Generic CI';
  return 'Local';
}

/**
 * Detect build trigger type
 */
function detectTrigger() {
  if (process.env.GITHUB_EVENT_NAME === 'schedule') return 'Scheduled';
  if (process.env.GITHUB_EVENT_NAME === 'pull_request') return 'Pull Request';
  if (process.env.GITHUB_EVENT_NAME === 'push') return 'Push';
  if (process.env.CI_PIPELINE_SOURCE === 'schedule') return 'Scheduled';
  if (process.env.CI_PIPELINE_SOURCE === 'merge_request_event') return 'Merge Request';
  if (process.env.BUILD_CAUSE === 'TIMERTRIGGER') return 'Scheduled';
  if (process.env.BUILD_CAUSE === 'SCMTRIGGER') return 'SCM Change';
  return 'Manual';
}

/**
 * Save metadata to file
 */
function saveMetadata(outputPath) {
  const metadata = collectMetadata();
  fs.writeFileSync(outputPath, JSON.stringify(metadata, null, 2), 'utf8');
  return metadata;
}

/**
 * Load metadata from file
 */
function loadMetadata(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return null;
  }
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  const outputPath = args[0] || path.join(process.cwd(), 'ci-metadata.json');
  
  const metadata = saveMetadata(outputPath);
  console.log(`✓ CI/CD metadata saved to: ${outputPath}`);
  
  if (args.includes('--print')) {
    console.log(JSON.stringify(metadata, null, 2));
  }
}

module.exports = {
  collectMetadata,
  saveMetadata,
  loadMetadata,
};
