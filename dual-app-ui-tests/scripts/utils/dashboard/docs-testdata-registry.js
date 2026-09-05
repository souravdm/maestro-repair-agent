#!/usr/bin/env node

/**
 * Docs-Based Test Data Registry
 * Maps functional areas and scenario types to appropriate test users
 * and generates the correct onFlowStart YAML for test data loading.
 * All data derived from docs/maestro/ documentation.
 */

// Complete test user catalog from docs
const TEST_USERS = {
  LOA2: {
    key: 'LOA2',
    description: 'Basic authenticated user',
    email: 'senior.usavior@gmail.com',
    dob: '09011956',
    loa: 2,
    capabilities: ['basic_auth', 'homescreen', 'general'],
    areas: ['Home', 'Account', 'Search', 'Health', 'General']
  },
  QL_ONLY_3: {
    key: 'QL_ONLY_3',
    description: 'Caremark/Aetna user for benefits',
    email: 'harry.benefit@qa2.com',
    dob: '09091990',
    capabilities: ['benefits', 'caremark', 'aetna', 'claims', 'plan_details'],
    areas: ['Benefits']
  },
  LOA2_CAREGIVER: {
    key: 'LOA2_CAREGIVER',
    description: 'Caregiver with dependents',
    email: 'dadone.savior@gmail.com',
    dob: '09041989',
    capabilities: ['caregiver', 'dependents', 'family'],
    areas: ['Benefits']
  },
  PRADHI_THIDHI: {
    key: 'PRADHI_THIDHI',
    description: 'User with multiple insurance plans',
    email: 'pradhi@qa2.com',
    dob: null,
    capabilities: ['multi_plan', 'caremark', 'rx'],
    areas: ['Benefits', 'Pharmacy']
  },
  ReadyRx: {
    key: 'ReadyRx',
    description: 'User with ready prescriptions',
    email: 'mayflowers@qa2.com',
    dob: '01011990',
    capabilities: ['pharmacy', 'rx_ready', 'rx_pickup', 'prescriptions'],
    areas: ['Pharmacy', 'Home']
  },
  RxWithPriorityCards: {
    key: 'RxWithPriorityCards',
    description: 'User with priority NBA cards (not filled)',
    email: 'almond@qa2.com',
    dob: '01011990',
    capabilities: ['pharmacy', 'priority_nba', 'not_filled', 'anba'],
    areas: ['Home', 'Pharmacy']
  },
  WERE_WORKING_ON_IT_NBA: {
    key: 'WERE_WORKING_ON_IT_NBA',
    description: 'User with "Working on it" prescription status',
    email: 'spring.pe@qa2.com',
    dob: '09091990',
    capabilities: ['pharmacy', 'working_on_it', 'anba'],
    areas: ['Home']
  },
  DELAYED_NBA: {
    key: 'DELAYED_NBA',
    description: 'User with delayed prescriptions',
    email: 'Winter.pe@qa2.com',
    dob: '09091990',
    capabilities: ['pharmacy', 'delayed', 'anba'],
    areas: ['Home']
  },
  SUMMER_PE: {
    key: 'SUMMER_PE',
    description: 'EC Plus user for personalized recommendations',
    email: 'summer.pe@qa2.com',
    dob: '09091990',
    capabilities: ['extracare_plus', 'personalized', 'recommendations', 'ec_plus'],
    areas: ['Home', 'Shop']
  }
};

// Map functional areas to required onFlowStart screen scripts
const AREA_SCREEN_SCRIPTS = {
  Account: [
    '../../screens/Common/CommonScreen.js',
    '../../screens/Account/accountObjects.js'
  ],
  Home: [
    '../../screens/Home/homescreenObjects.js',
    '../../screens/SearchAndNav/searchNavObjects.js'
  ],
  Homescreen: [
    '../../screens/Home/homescreenObjects.js',
    '../../screens/SearchAndNav/searchNavObjects.js'
  ],
  Benefits: [
    '../../screens/SearchAndNav/searchNavObjects.js'
  ],
  Search: [
    '../../screens/SearchAndNav/searchNavObjects.js'
  ],
  SearchNav: [
    '../../screens/SearchAndNav/searchNavObjects.js'
  ],
  Pharmacy: [
    '../../screens/Common/CommonScreen.js',
    '../../screens/Pharmacy/pharmacyObjects.js'
  ],
  Shop: [
    '../../screens/Common/CommonScreen.js',
    '../../screens/Shop/shopObjects.js'
  ],
  Health: [
    '../../screens/Common/CommonScreen.js',
    '../../screens/Health/healthObjects.js'
  ],
  MCCore: [
    '../../screens/Common/CommonScreen.js',
    '../../screens/MCCore/mccoreObjects.js'
  ],
  NGS: [
    '../../screens/Common/CommonScreen.js',
    '../../screens/NGS/ngsObjects.js'
  ],
  H100: [
    '../../screens/Home/h100Objects.js',
    '../../screens/SearchAndNav/searchNavObjects.js'
  ],
  General: [
    '../../screens/Common/CommonScreen.js'
  ]
};

/**
 * Determine whether a scenario requires authentication
 */
function requiresAuth(scenarioDescription, testSteps) {
  const text = `${scenarioDescription} ${testSteps}`.toLowerCase();
  // Guest scenarios explicitly don't need auth
  if (text.includes('guest') || text.includes('unauthenticated') || text.includes('not signed in')) {
    return false;
  }
  // These patterns imply auth is needed
  const authPatterns = [
    'sign in', 'signin', 'login', 'log in', 'authenticated',
    'prescription', 'pharmacy', 'benefits', 'plan', 'claims',
    'account dashboard', 'profile', 'caregiver', 'dependent',
    'activity zone', 'anba', 'nba', 'rewards', 'extracare',
    'logout', 'sign out'
  ];
  return authPatterns.some(p => text.includes(p));
}

/**
 * Get the best test user for a given functional area and scenario
 */
function getTestUserForScenario(functionalArea, scenarioDescription, testSteps) {
  const text = `${scenarioDescription} ${testSteps || ''}`.toLowerCase();
  const area = functionalArea || 'General';

  // Check if this is a guest scenario
  if (!requiresAuth(scenarioDescription, testSteps || '')) {
    return null; // No test user needed
  }

  // Feature-specific user selection
  const areaLower = area.toLowerCase();

  // Benefits-specific users
  if (areaLower.includes('benefit')) {
    if (text.includes('caregiver') || text.includes('dependent')) return TEST_USERS.LOA2_CAREGIVER;
    if (text.includes('multi') || text.includes('multiple plan')) return TEST_USERS.PRADHI_THIDHI;
    return TEST_USERS.QL_ONLY_3; // Default benefits user
  }

  // Pharmacy-specific users
  if (areaLower.includes('pharma')) {
    if (text.includes('ready') || text.includes('pickup')) return TEST_USERS.ReadyRx;
    if (text.includes('refill') || text.includes('renewal')) return TEST_USERS.ReadyRx;
    if (text.includes('delayed')) return TEST_USERS.DELAYED_NBA;
    if (text.includes('not filled') || text.includes('priority')) return TEST_USERS.RxWithPriorityCards;
    return TEST_USERS.ReadyRx;
  }

  // Home-specific — ANBA tests need specific users
  if (areaLower.includes('home')) {
    if (text.includes('not filled') || text.includes('priority')) return TEST_USERS.RxWithPriorityCards;
    if (text.includes('delayed')) return TEST_USERS.DELAYED_NBA;
    if (text.includes('working on it')) return TEST_USERS.WERE_WORKING_ON_IT_NBA;
    if (text.includes('ready for pickup') || text.includes('ready')) return TEST_USERS.ReadyRx;
    if (text.includes('extracare') || text.includes('ec plus')) return TEST_USERS.SUMMER_PE;
    if (text.includes('renewal')) return TEST_USERS.ReadyRx;
  }

  // Shop — EC Plus user for personalization
  if (areaLower.includes('shop')) {
    if (text.includes('personalized') || text.includes('recommendation') || text.includes('extracare')) {
      return TEST_USERS.SUMMER_PE;
    }
  }

  // Default authenticated user
  return TEST_USERS.LOA2;
}

/**
 * Get the onFlowStart screen scripts for a functional area
 */
function getScreenScriptsForArea(functionalArea) {
  const normalized = Object.keys(AREA_SCREEN_SCRIPTS).find(
    k => k.toLowerCase() === functionalArea.toLowerCase()
  );
  return AREA_SCREEN_SCRIPTS[normalized] || AREA_SCREEN_SCRIPTS.General;
}

/**
 * Generate the complete onFlowStart YAML block
 * @param {string} functionalArea - The functional area (Home, Account, etc.)
 * @param {string} scenarioDescription - Test scenario description
 * @param {string} testSteps - Test steps
 * @param {object} detectedTestData - Optional detected test data from email+DOB (from detectTestData)
 */
function generateOnFlowStart(functionalArea, scenarioDescription, testSteps, detectedTestData = null) {
  const scripts = getScreenScriptsForArea(functionalArea);
  
  // Use detected test data if available, otherwise use scenario-based selection
  let testUser;
  if (detectedTestData && detectedTestData.detected) {
    // Use the detected user key directly
    testUser = {
      key: detectedTestData.userKey,
      description: `Detected from test data: ${detectedTestData.email || 'unknown'}`
    };
  } else {
    testUser = getTestUserForScenario(functionalArea, scenarioDescription, testSteps);
  }

  const lines = ['onFlowStart:'];

  // Add screen object scripts
  for (const script of scripts) {
    lines.push(`  - runScript: ${script}`);
  }

  // Add test data loading if auth is needed
  if (testUser) {
    lines.push('  - runScript:');
    lines.push('      file: ../../testdata/users_qa.js');
    lines.push('      env:');
    lines.push(`        loginData: ${testUser.key}`);
  }

  return lines.join('\n');
}

/**
 * Generate appropriate tags based on area and scenario
 */
function generateTags(functionalArea, scenarioDescription) {
  const tags = new Set();
  const area = (functionalArea || 'general').toLowerCase();
  const desc = (scenarioDescription || '').toLowerCase();

  // Area tag
  tags.add(area.replace(/\s+/g, '_'));

  // Scenario type tags
  if (desc.includes('smoke') || desc.includes('loads') || desc.includes('basic')) tags.add('smoke');
  if (desc.includes('regression')) tags.add('regression');
  if (desc.includes('negative') || desc.includes('invalid') || desc.includes('error')) tags.add('negative');
  if (desc.includes('edge case') || desc.includes('timeout') || desc.includes('boundary')) tags.add('edge_case');

  // User type tags
  if (desc.includes('guest') || desc.includes('unauthenticated')) tags.add('guest');
  if (desc.includes('authenticated') || desc.includes('signed in') || desc.includes('login')) tags.add('authenticated');
  if (desc.includes('caregiver')) tags.add('caregiver');

  // Feature tags
  if (desc.includes('anba') || desc.includes('activity')) tags.add('anba');
  if (desc.includes('dnba') || desc.includes('discovery')) tags.add('dnba');
  if (desc.includes('splitview') || desc.includes('split view')) tags.add('splitview');
  if (desc.includes('search')) tags.add('search');
  if (desc.includes('navigation') || desc.includes('nav')) tags.add('navigation');
  if (desc.includes('prescription') || desc.includes('rx')) tags.add('pharmacy');
  if (desc.includes('benefits') || desc.includes('plan') || desc.includes('claims')) tags.add('benefits');

  return Array.from(tags);
}

module.exports = {
  TEST_USERS,
  AREA_SCREEN_SCRIPTS,
  getTestUserForScenario,
  getScreenScriptsForArea,
  generateOnFlowStart,
  generateTags,
  requiresAuth
};

// CLI usage
if (require.main === module) {
  const area = process.argv[2] || 'Benefits';
  const scenario = process.argv[3] || 'View plan summary for authenticated user';
  const steps = process.argv[4] || '1. Launch app\n2. Sign in\n3. Navigate to benefits';

  console.log(`\n=== Test Data for "${area}" — "${scenario}" ===\n`);

  const user = getTestUserForScenario(area, scenario, steps);
  console.log('Recommended user:', user ? `${user.key} (${user.description})` : 'Guest (no auth)');

  console.log('\nonFlowStart:');
  console.log(generateOnFlowStart(area, scenario, steps));

  console.log('\nTags:', generateTags(area, scenario));
}
