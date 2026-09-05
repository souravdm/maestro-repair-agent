#!/usr/bin/env node

/**
 * Load Credentials from JavaScript Modules
 * 
 * Automatically detects environment from BUILD_CONFIG and loads appropriate credentials
 * Usage: eval "$(node scripts/setup/load-credentials.js)"
 * 
 * Environment Detection:
 * - BUILD_CONFIG=debug → QA credentials
 * - BUILD_CONFIG=adhoc/alpha/release → Production credentials
 * - Defaults to QA if not specified
 */

const path = require('path');

// Auto-detect environment from BUILD_CONFIG
let environment = 'qa'; // Default to QA

if (process.env.BUILD_CONFIG) {
  const buildConfig = process.env.BUILD_CONFIG.toLowerCase();
  
  if (buildConfig === 'debug') {
    environment = 'qa';
  } else if (['adhoc', 'alpha', 'release'].includes(buildConfig)) {
    environment = 'prod';
  }
}

// Load credentials from JS module
const credentialsPath = path.join(__dirname, '../../.maestro/config', `credentials.${environment}.js`);

try {
  const credentials = require(credentialsPath);
  
  // Get environment variables
  const envVars = credentials.toEnvVars();
  
  // Output export statements for bash eval
  Object.entries(envVars).forEach(([key, value]) => {
    // Escape single quotes in values
    const escapedValue = String(value).replace(/'/g, "'\"'\"'");
    console.log(`export ${key}='${escapedValue}'`);
  });
  
} catch (error) {
  // Silent fail - credentials not found
  process.exit(0);
}
