#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

/**
 * Docs-Based Subflow Registry
 * Provides subflow lookup by action description and functional area.
 * All subflow data is derived from docs/maestro/ documentation.
 */

// Complete subflow catalog extracted from docs/maestro/agents.md and feature docs
const SUBFLOW_CATALOG = [
  // === Common ===
  {
    path: '../../subflows/common/launchApp.yaml',
    area: 'common',
    type: 'launch',
    description: 'Launch application with clearState',
    keywords: ['launch', 'start', 'open', 'app', 'begin', 'initialize'],
    requiredScreens: []
  },
  {
    path: '../../subflows/common/disable_network.yaml',
    area: 'common',
    type: 'network',
    description: 'Simulate network disconnection',
    keywords: ['disable', 'network', 'offline', 'disconnect', 'no internet', 'airplane'],
    requiredScreens: []
  },
  {
    path: '../../subflows/common/enable_network.yaml',
    area: 'common',
    type: 'network',
    description: 'Re-enable network connection',
    keywords: ['enable', 'network', 'online', 'reconnect', 'internet'],
    requiredScreens: []
  },
  {
    path: '../../subflows/common/backgroundApp.yaml',
    area: 'common',
    type: 'lifecycle',
    description: 'Background the app',
    keywords: ['background', 'minimize', 'suspend'],
    requiredScreens: []
  },
  {
    path: '../../subflows/common/foregroundApp.yaml',
    area: 'common',
    type: 'lifecycle',
    description: 'Foreground the app',
    keywords: ['foreground', 'resume', 'restore', 'maximize'],
    requiredScreens: []
  },
  {
    path: '../../subflows/common/dismiss_modal_if_present.yaml',
    area: 'common',
    type: 'utility',
    description: 'Dismiss modal dialog if present',
    keywords: ['dismiss', 'modal', 'dialog', 'popup', 'close'],
    requiredScreens: ['common_modal']
  },

  // === Account / Authentication ===
  {
    path: '../../subflows/account/complete_signin_and_otp_dob.yaml',
    area: 'Account',
    type: 'authentication',
    description: 'Complete sign-in with OTP and DOB verification',
    keywords: ['sign in', 'signin', 'login', 'authenticate', 'otp', 'dob', 'credentials', 'email', 'password'],
    requiredScreens: ['account_signIn', 'account_onboarding']
  },
  {
    path: '../../subflows/account/complete_authenticated_login.yaml',
    area: 'Account',
    type: 'authentication',
    description: 'Complete authenticated login and verify homescreen loads',
    keywords: ['login', 'authenticated', 'full login', 'complete login', 'sign in and verify'],
    requiredScreens: ['account_signIn', 'account_onboarding']
  },
  {
    path: '../../subflows/account/logout.yaml',
    area: 'Account',
    type: 'authentication',
    description: 'Logout from the app',
    keywords: ['logout', 'sign out', 'signout', 'log out'],
    requiredScreens: ['account_dashboard']
  },

  // === Home / Homescreen ===
  {
    path: '../../subflows/Home/homescreen_loaded_successful.yaml',
    area: 'Home',
    type: 'verification',
    description: 'Verify homescreen loaded successfully with splitview and activity',
    keywords: ['homescreen', 'home loaded', 'verify home', 'home screen', 'splitview', 'loaded'],
    requiredScreens: ['homescreen_splitview', 'homescreen_activity']
  },
  {
    path: '../../subflows/Home/discover_nba_loaded.yaml',
    area: 'Home',
    type: 'verification',
    description: 'Verify discovery zone NBA cards loaded',
    keywords: ['discovery', 'discover', 'nba', 'dnba', 'cards', 'recommendations'],
    requiredScreens: ['homescreen_discover']
  },

  // === Search & Navigation ===
  {
    path: '../../subflows/searchNav/bottom_nav_loaded.yaml',
    area: 'SearchNav',
    type: 'verification',
    description: 'Verify bottom navigation bar loaded with all tabs',
    keywords: ['bottom nav', 'navigation', 'nav bar', 'tabs', 'tab bar', 'navigation loaded'],
    requiredScreens: ['searchNav_bottomNav', 'searchnav_header']
  },
  {
    path: '../../subflows/searchNav/perform_search.yaml',
    area: 'SearchNav',
    type: 'action',
    description: 'Execute a search and wait for results',
    keywords: ['search', 'find', 'query', 'look for', 'search for'],
    requiredScreens: ['searchNav_search', 'searchNav_results']
  },
  {
    path: '../../subflows/searchNav/switch_nav_tab.yaml',
    area: 'SearchNav',
    type: 'navigation',
    description: 'Switch between bottom navigation tabs',
    keywords: ['switch tab', 'change tab', 'navigate tab', 'tab switch'],
    requiredScreens: ['searchNav_bottomNav']
  },

  // === Benefits ===
  {
    path: '../../subflows/benefits/benefits_loaded_successful.yaml',
    area: 'Benefits',
    type: 'verification',
    description: 'Verify benefits screen loaded with plan summary visible',
    keywords: ['benefits', 'benefits loaded', 'plan summary', 'insurance', 'coverage'],
    requiredScreens: ['benefits_landing']
  },
  {
    path: '../../subflows/benefits/view_plan_details.yaml',
    area: 'Benefits',
    type: 'action',
    description: 'Open plan details and verify coverage information',
    keywords: ['plan details', 'coverage details', 'deductible', 'copay', 'plan info'],
    requiredScreens: ['benefits_plan', 'benefits_landing']
  },
  {
    path: '../../subflows/benefits/view_id_card.yaml',
    area: 'Benefits',
    type: 'action',
    description: 'Open and display digital ID card',
    keywords: ['id card', 'member id', 'digital id', 'insurance card'],
    requiredScreens: ['benefits_idcard', 'benefits_landing']
  },

  // === Pharmacy ===
  {
    path: '../../subflows/pharmacy/refill_prescription.yaml',
    area: 'Pharmacy',
    type: 'action',
    description: 'Refill a prescription',
    keywords: ['refill', 'prescription', 'rx', 'medication', 'pharmacy'],
    requiredScreens: ['homescreen_pharmacy']
  },

  // === Shop ===
  {
    path: '../../subflows/shop/search_products.yaml',
    area: 'Shop',
    type: 'action',
    description: 'Search for products in the shop',
    keywords: ['search product', 'find product', 'shop search', 'product search'],
    requiredScreens: ['shop_search', 'shop_product']
  },
  {
    path: '../../subflows/shop/checkout_flow.yaml',
    area: 'Shop',
    type: 'action',
    description: 'Complete checkout process',
    keywords: ['checkout', 'payment', 'purchase', 'buy', 'cart'],
    requiredScreens: ['shop_cart']
  },

  // === Homescreen subflows (from Homescreen directory in subflows) ===
  {
    path: '../../subflows/Homescreen/homescreen_loaded_successful.yaml',
    area: 'Home',
    type: 'verification',
    description: 'Verify homescreen loaded (alternate path)',
    keywords: ['homescreen loaded', 'home verify'],
    requiredScreens: ['homescreen_splitview']
  },

  // === SuperApp ===
  {
    path: '../../subflows/SuperApp/home_screen_verification.yaml',
    area: 'Home',
    type: 'verification',
    description: 'Verify super app home screen',
    keywords: ['super app', 'home verification'],
    requiredScreens: []
  }
];

// Map functional areas to relevant subflow areas
const AREA_MAPPING = {
  Home: ['common', 'Account', 'Home', 'SearchNav', 'Homescreen', 'SuperApp'],
  Homescreen: ['common', 'Account', 'Home', 'SearchNav', 'Homescreen', 'SuperApp'],
  Account: ['common', 'Account'],
  Benefits: ['common', 'Account', 'Benefits', 'SearchNav'],
  Search: ['common', 'Account', 'SearchNav'],
  SearchNav: ['common', 'Account', 'SearchNav'],
  Pharmacy: ['common', 'Account', 'Pharmacy', 'SearchNav'],
  Shop: ['common', 'Account', 'Shop', 'SearchNav'],
  Health: ['common', 'Account', 'Health', 'SearchNav'],
  MCCore: ['common', 'Account', 'MCCore', 'SearchNav'],
  NGS: ['common', 'Account', 'NGS', 'SearchNav'],
  VM: ['common', 'Account', 'VM', 'SearchNav'],
  Chatbot: ['common', 'Account', 'Chatbot', 'SearchNav'],
  H100: ['common', 'Account', 'Home', 'SearchNav'],
  General: ['common', 'Account', 'SearchNav']
};

/**
 * Get all subflows relevant to a functional area
 */
function getSubflowsForArea(functionalArea) {
  const normalizedArea = Object.keys(AREA_MAPPING).find(
    k => k.toLowerCase() === functionalArea.toLowerCase()
  ) || 'General';

  const relevantAreas = AREA_MAPPING[normalizedArea] || AREA_MAPPING.General;

  return SUBFLOW_CATALOG.filter(sf =>
    relevantAreas.some(a => a.toLowerCase() === sf.area.toLowerCase())
  );
}

/**
 * Find the best matching subflow(s) for a natural-language action description
 * Returns { bestMatch, matches: [...], confidence }
 */
function getSubflowsForAction(actionDescription) {
  const desc = actionDescription.toLowerCase().trim();
  const descWords = desc.split(/[\s_-]+/).filter(w => w.length > 2);

  const scored = SUBFLOW_CATALOG.map(sf => {
    let score = 0;

    // Keyword matching
    for (const keyword of sf.keywords) {
      if (desc.includes(keyword)) {
        score += 40 + (keyword.length * 2); // Longer keyword matches are more specific
      }
    }

    // Word overlap with keywords
    for (const word of descWords) {
      for (const keyword of sf.keywords) {
        const kwWords = keyword.split(/\s+/);
        for (const kwWord of kwWords) {
          if (kwWord === word) score += 15;
          else if (kwWord.includes(word) || word.includes(kwWord)) score += 8;
        }
      }
    }

    // Description matching
    const sfDescLower = sf.description.toLowerCase();
    for (const word of descWords) {
      if (sfDescLower.includes(word)) score += 10;
    }

    // Type bonus
    if (desc.includes('verify') || desc.includes('assert') || desc.includes('check')) {
      if (sf.type === 'verification') score += 20;
    }
    if (desc.includes('launch') || desc.includes('start') || desc.includes('open app')) {
      if (sf.type === 'launch') score += 30;
    }
    if (desc.includes('login') || desc.includes('sign in') || desc.includes('authenticate')) {
      if (sf.type === 'authentication') score += 30;
    }
    if (desc.includes('logout') || desc.includes('sign out')) {
      if (sf.type === 'authentication' && sf.path.includes('logout')) score += 50;
    }

    return { subflow: sf, score };
  })
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score);

  return {
    bestMatch: scored[0] ? scored[0].subflow : null,
    matches: scored.slice(0, 5).map(s => ({ ...s.subflow, score: s.score })),
    confidence: scored[0] ? Math.min(scored[0].score, 100) : 0
  };
}

/**
 * Format subflows as context for LLM prompts
 */
function formatSubflowsForPrompt(functionalArea) {
  const subflows = getSubflowsForArea(functionalArea);
  return subflows.map(sf =>
    `- ${sf.path} — ${sf.description} [type: ${sf.type}]`
  ).join('\n');
}

module.exports = {
  SUBFLOW_CATALOG,
  getSubflowsForArea,
  getSubflowsForAction,
  formatSubflowsForPrompt
};

// CLI usage
if (require.main === module) {
  const action = process.argv[2] || 'sign in with credentials';
  const result = getSubflowsForAction(action);
  console.log(`\n=== Subflow Match for "${action}" ===`);
  console.log(`Best match: ${result.bestMatch ? result.bestMatch.path : 'none'}`);
  console.log(`Confidence: ${result.confidence}`);
  console.log(`\nTop matches:`);
  result.matches.forEach((m, i) => {
    console.log(`  ${i + 1}. ${m.path} (score: ${m.score}) — ${m.description}`);
  });
}
