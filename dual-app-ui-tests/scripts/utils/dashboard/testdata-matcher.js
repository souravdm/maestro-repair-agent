#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Parse users_qa.js to extract email/DOB mappings
 * Returns a Map of email+dob -> userKey
 */
function loadTestUsers() {
  const testDataPath = path.join(__dirname, '..', '..', '..', '.maestro', 'testdata', 'users_qa.js');
  
  try {
    const content = fs.readFileSync(testDataPath, 'utf8');
    const users = new Map();
    
    // Parse user entries: USER_KEY: { email: 'x@y.com', dob: '12345678' }
    const userBlockRegex = /(\w+):\s*\{[^}]*email:\s*['"]([^'"]+)['"][^}]*dob:\s*['"](\d{8})['"][^}]*\}/gi;
    
    let match;
    while ((match = userBlockRegex.exec(content)) !== null) {
      const userKey = match[1];
      const email = match[2].toLowerCase();
      const dob = match[3];
      
      // Store both with and without case sensitivity for matching
      const emailDobKey = `${email}|${dob}`;
      users.set(emailDobKey, userKey);
      
      // Also store email-only for partial matching
      if (!users.has(`email:${email}`)) {
        users.set(`email:${email}`, userKey);
      }
    }
    
    return users;
  } catch (error) {
    console.error('⚠️  Error loading test users:', error.message);
    return new Map();
  }
}

/**
 * Match test data input to a user key
 * Supports formats:
 *  - "hayesl@cvs.com 09091990"
 *  - "hayesl@cvs.com\n09091990"
 *  - "Email: hayesl@cvs.com DOB: 09091990"
 */
function matchTestData(testDataInput) {
  if (!testDataInput || typeof testDataInput !== 'string') {
    return null;
  }
  
  const users = loadTestUsers();
  const input = testDataInput.toLowerCase().trim();
  
  // Extract email and DOB
  const emailMatch = input.match(/([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i);
  const dobMatch = input.match(/\b(\d{8})\b/);
  
  if (!emailMatch) {
    return null;
  }
  
  const email = emailMatch[1].toLowerCase();
  const dob = dobMatch ? dobMatch[1] : null;
  
  // Try exact email+dob match first
  if (dob) {
    const key = `${email}|${dob}`;
    if (users.has(key)) {
      return {
        userKey: users.get(key),
        email,
        dob,
        matchType: 'exact'
      };
    }
  }
  
  // Fall back to email-only match
  const emailKey = `email:${email}`;
  if (users.has(emailKey)) {
    return {
      userKey: users.get(emailKey),
      email,
      dob: dob || null,
      matchType: 'email-only'
    };
  }
  
  return null;
}

/**
 * Determine LOA type from user key or test data
 * Returns: LOA1, LOA2, HAYES_LUCAS, etc.
 */
function determineLoginDataKey(testDataInput) {
  const match = matchTestData(testDataInput);
  
  if (!match) {
    // Default to LOA2 if no match
    return 'LOA2';
  }
  
  // Return the matched user key (e.g., HAYES_LUCAS)
  return match.userKey;
}

module.exports = {
  loadTestUsers,
  matchTestData,
  determineLoginDataKey
};

// CLI usage
if (require.main === module) {
  const testInput = process.argv[2] || 'hayesl@cvs.com 09091990';
  
  console.log('Testing:', testInput);
  const result = matchTestData(testInput);
  
  if (result) {
    console.log('✅ Match found:');
    console.log('  User Key:', result.userKey);
    console.log('  Email:', result.email);
    console.log('  DOB:', result.dob);
    console.log('  Match Type:', result.matchType);
    console.log('\nLoginData Key:', determineLoginDataKey(testInput));
  } else {
    console.log('❌ No match found (will use default LOA2)');
  }
}
