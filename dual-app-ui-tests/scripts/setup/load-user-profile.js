#!/usr/bin/env node
/**
 * Load a named test user profile from test-users.json.
 * Resolves ${ENV_VAR} placeholders against process.env.
 * Outputs `export KEY=VALUE` lines for bash eval.
 *
 * Usage:
 *   eval "$(node scripts/setup/load-user-profile.js aetna-member)"
 *
 * Exit codes:
 *   0  — profile loaded (or profile is "default", nothing to export beyond qa.js)
 *   1  — profile not found
 *   2  — required env vars missing
 */

const fs = require('fs');
const path = require('path');

const profileName = process.argv[2] || 'default';
const profilesPath = path.join(__dirname, 'test-users.json');

if (!fs.existsSync(profilesPath)) {
  process.stderr.write(`test-users.json not found at ${profilesPath}\n`);
  process.exit(0);
}

const config = JSON.parse(fs.readFileSync(profilesPath, 'utf8'));
const profiles = config.profiles || {};

if (!profiles[profileName]) {
  process.stderr.write(`Unknown user profile: "${profileName}"\n`);
  process.stderr.write(`Available profiles: ${Object.keys(profiles).join(', ')}\n`);
  process.exit(1);
}

const profile = profiles[profileName];

if (profileName === 'default' || profile._source) {
  // Default profile — credentials already loaded from credentials.qa.js
  process.exit(0);
}

// Check required env vars
const required = profile._required_env || [];
const missing = required.filter(k => !process.env[k]);
if (missing.length > 0) {
  process.stderr.write(`Profile "${profileName}" requires env vars not set: ${missing.join(', ')}\n`);
  process.exit(2);
}

// Resolve values and emit export statements
const CRED_KEYS = ['COMMON_USER', 'COMMON_PASSWORD', 'COMMON_OTP', 'COMMON_DOB', 'STATIC_OTP', 'DOB'];

CRED_KEYS.forEach(key => {
  const raw = profile[key];
  if (!raw) return;

  // Resolve ${ENV_VAR} placeholders
  const resolved = String(raw).replace(/\$\{([^}]+)\}/g, (_, varName) => {
    return process.env[varName] || '';
  });

  if (resolved) {
    const escaped = resolved.replace(/'/g, "'\"'\"'");
    console.log(`export ${key}='${escaped}'`);
  }
});
