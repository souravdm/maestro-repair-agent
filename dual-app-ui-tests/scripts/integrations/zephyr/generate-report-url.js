#!/usr/bin/env node

/**
 * Generate Report URL
 * Creates shareable URLs for HTML test reports from CI/CD artifacts
 */

const fs = require('fs');
const path = require('path');

class ReportUrlGenerator {
  constructor(options = {}) {
    this.platform = options.platform || this.detectPlatform();
    this.jobId = options.jobId || process.env.CIRCLE_BUILD_NUM || process.env.GITHUB_RUN_ID;
    this.artifactPath = options.artifactPath || 'test-reports/test-report.html';
    this.runId = options.runId || process.env.GITHUB_RUN_ID;
    this.artifactName = options.artifactName || 'maestro-reports';
    this.repo = options.repo || process.env.GITHUB_REPOSITORY;
  }

  /**
   * Detect CI/CD platform
   */
  detectPlatform() {
    if (process.env.CIRCLECI) return 'circleci';
    if (process.env.GITHUB_ACTIONS) return 'github';
    if (process.env.AWS_EXECUTION_ENV) return 's3';
    return 'local';
  }

  /**
   * Generate CircleCI artifact URL
   */
  generateCircleCiUrl() {
    if (!this.jobId) {
      throw new Error('CircleCI job ID not found. Set CIRCLE_BUILD_NUM or pass --job-id');
    }

    // CircleCI artifact URL format
    const baseUrl = 'https://output.circle-artifacts.com/output/job';
    const artifactPath = this.artifactPath.replace(/^test-reports\//, '');
    
    return `${baseUrl}/${this.jobId}/artifacts/0/test-reports/${artifactPath}`;
  }

  /**
   * Generate GitHub Actions artifact URL
   */
  generateGitHubUrl() {
    if (!this.runId || !this.repo) {
      throw new Error('GitHub run ID and repository required. Set GITHUB_RUN_ID and GITHUB_REPOSITORY');
    }

    // GitHub artifact download URL (requires authentication)
    // Note: This generates a link to the Actions run page, not direct artifact download
    return `https://github.com/${this.repo}/actions/runs/${this.runId}`;
  }

  /**
   * Generate S3 URL (placeholder - requires upload implementation)
   */
  generateS3Url() {
    const bucketUrl = process.env.S3_BUCKET_URL;
    if (!bucketUrl) {
      throw new Error('S3_BUCKET_URL environment variable not set');
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `${bucketUrl}/test-reports/${timestamp}/test-report.html`;
  }

  /**
   * Generate Confluence attachment URL (placeholder)
   */
  generateConfluenceUrl() {
    const confluenceUrl = process.env.CONFLUENCE_BASE_URL || 'https://cvsdigital.atlassian.net/wiki';
    const pageId = process.env.CONFLUENCE_PAGE_ID;
    
    if (!pageId) {
      throw new Error('CONFLUENCE_PAGE_ID environment variable not set');
    }

    return `${confluenceUrl}/pages/${pageId}`;
  }

  /**
   * Generate report URL based on platform
   */
  generate() {
    switch (this.platform) {
      case 'circleci':
        return this.generateCircleCiUrl();
      case 'github':
        return this.generateGitHubUrl();
      case 's3':
        return this.generateS3Url();
      case 'confluence':
        return this.generateConfluenceUrl();
      case 'local':
        return null; // No public URL for local execution
      default:
        throw new Error(`Unsupported platform: ${this.platform}`);
    }
  }

  /**
   * Get report metadata
   */
  getMetadata() {
    return {
      platform: this.platform,
      jobId: this.jobId,
      runId: this.runId,
      artifactPath: this.artifactPath,
      timestamp: new Date().toISOString(),
      hasPublicUrl: this.platform !== 'local'
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

  try {
    const generator = new ReportUrlGenerator(options);
    const url = generator.generate();
    const metadata = generator.getMetadata();

    if (url) {
      console.log(url);
      if (process.env.VERBOSE) {
        console.error('Metadata:', JSON.stringify(metadata, null, 2));
      }
      process.exit(0);
    } else {
      console.error('No public URL available for local execution');
      process.exit(1);
    }
  } catch (error) {
    console.error('Error generating report URL:', error.message);
    process.exit(1);
  }
}

module.exports = ReportUrlGenerator;
