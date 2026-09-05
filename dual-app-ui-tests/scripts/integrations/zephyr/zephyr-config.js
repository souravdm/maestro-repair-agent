#!/usr/bin/env node

/**
 * Zephyr Scale Configuration
 * Centralized configuration for Zephyr Scale integration
 */

module.exports = {
  // Project configuration
  projectKey: process.env.ZEPHYR_PROJECT_KEY || 'TLPCWHSAM',
  
  // Folder structure - all automated tests under /Automated
  folders: {
    automated: '/Automated',
    account: '/Automated/Account',
    benefits: '/Automated/Benefits',
    haio: '/Automated/HAIO',
    pharmacy: '/Automated/Pharmacy',
    shop: '/Automated/Shop',
    health: '/Automated/Health',
    menu: '/Automated/Menu',
    snapp: '/Automated/SearchAndNav',
    smartscheduler: '/Automated/SmartScheduler'
  },
  
  // Custom field mappings
  customFields: {
    automationStatus: 'Automated',
    framework: 'Maestro',
    platform: ['iOS', 'Android']
  },
  
  // Status mapping: Maestro → Zephyr
  statusMapping: {
    passed: 'Pass',
    failed: 'Fail',
    skipped: 'Not Executed',
    error: 'Fail'
  },
  
  // Priority mapping
  priorityMapping: {
    critical: 'High',
    high: 'High',
    medium: 'Normal',
    low: 'Low',
    smoke: 'High',
    regression: 'Normal'
  },
  
  // Report hosting configuration
  reportHosting: {
    type: process.env.ZEPHYR_REPORT_HOSTING || 'circleci-artifacts',
    baseUrl: {
      'circleci-artifacts': 'https://output.circle-artifacts.com/output/job',
      'github-artifacts': 'https://github.com',
      's3': process.env.S3_BUCKET_URL || '',
      'confluence': process.env.CONFLUENCE_BASE_URL || 'https://cvsdigital.atlassian.net/wiki'
    }
  },
  
  // Test cycle templates
  cycleTemplates: {
    smoke: {
      name: 'Smoke Tests - Build {BUILD_NUMBER}',
      description: 'Automated smoke test execution',
      folder: '/Automated/Smoke'
    },
    regression: {
      name: 'Regression Tests - Build {BUILD_NUMBER}',
      description: 'Automated regression test execution',
      folder: '/Automated/Regression'
    },
    feature: {
      name: '{FEATURE} Tests - Build {BUILD_NUMBER}',
      description: 'Automated feature test execution',
      folder: '/Automated/{FEATURE}'
    },
    ci: {
      name: '{PLATFORM} CI - Build {BUILD_NUMBER}',
      description: 'Automated CI/CD test execution',
      folder: '/Automated/CI'
    }
  },
  
  // Feature to folder mapping (from test file paths)
  featureFolderMapping: {
    'Account': '/Automated/Account',
    'Benefits': '/Automated/Benefits',
    'HAIO': '/Automated/HAIO',
    'Pharmacy': '/Automated/Pharmacy',
    'Shop': '/Automated/Shop',
    'Health': '/Automated/Health',
    'SuperApp': '/Automated/SuperApp',
    'MCCore': '/Automated/MCCore',
    'NGS': '/Automated/NGS',
    'VM': '/Automated/VM',
    'Chatbot': '/Automated/Chatbot',
    'General': '/Automated/General'
  },
  
  // Labels to apply to test cases
  defaultLabels: ['automated', 'maestro'],
  
  // Execution summary format
  summaryFormat: {
    includeReportUrl: true,
    includeScreenshots: true,
    includeFailedTests: true,
    includeCicdJobUrl: true,
    includeEnvironment: true,
    includePlatform: true,
    includeBuildNumber: true,
    includeDuration: true,
    includeTimestamp: true
  },
  
  // Retry configuration for API calls
  retry: {
    maxRetries: 3,
    retryDelay: 2000,
    retryOn429: true
  }
};
