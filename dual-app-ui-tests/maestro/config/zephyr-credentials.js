#!/usr/bin/env node

/**
 * Zephyr Scale Credentials Loader
 * Loads Zephyr API credentials from environment variables
 * Similar pattern to credentials-loader.js
 */

module.exports = {
  // Zephyr Scale API configuration
  apiToken: process.env.ZEPHYR_API_TOKEN || '',
  projectKey: process.env.ZEPHYR_PROJECT_KEY || 'TLPCWHSAM',
  baseUrl: process.env.ZEPHYR_BASE_URL || 'https://api.zephyrscale.smartbear.com/v2',
  
  // JIRA configuration (for linking)
  jiraBaseUrl: process.env.JIRA_BASE_URL || 'https://cvsdigital.atlassian.net',
  jiraEmail: process.env.JIRA_EMAIL || '',
  jiraApiToken: process.env.JIRA_API_TOKEN || '',
  
  // Validation
  isConfigured() {
    return !!this.apiToken;
  },
  
  // Get configuration object
  getConfig() {
    if (!this.isConfigured()) {
      throw new Error('Zephyr credentials not configured. Set ZEPHYR_API_TOKEN environment variable.');
    }
    
    return {
      apiToken: this.apiToken,
      projectKey: this.projectKey,
      baseUrl: this.baseUrl,
      jiraBaseUrl: this.jiraBaseUrl
    };
  }
};

// CLI usage - test credentials
if (require.main === module) {
  const creds = module.exports;
  
  if (creds.isConfigured()) {
    console.log('✓ Zephyr credentials configured');
    console.log('  Project Key:', creds.projectKey);
    console.log('  Base URL:', creds.baseUrl);
    console.log('  API Token:', creds.apiToken ? '***' + creds.apiToken.slice(-4) : 'NOT SET');
    process.exit(0);
  } else {
    console.error('✗ Zephyr credentials not configured');
    console.error('  Set ZEPHYR_API_TOKEN environment variable');
    process.exit(1);
  }
}
