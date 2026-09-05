#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

/**
 * Docs-Based Screen Object Registry
 * Parses output.* definitions from docs/maestro/ markdown files
 * and provides lookup by functional area.
 */

const DOCS_ROOT = path.join(__dirname, '..', '..', '..', 'docs', 'maestro');

// Map functional areas to the screen object prefixes they need
const AREA_TO_SCREEN_PREFIXES = {
  Home: ['homescreen_', 'searchnav_', 'searchNav_', 'account_onboarding', 'account_signIn'],
  Homescreen: ['homescreen_', 'searchnav_', 'searchNav_', 'account_onboarding', 'account_signIn'],
  Account: ['account_', 'searchnav_', 'searchNav_'],
  Benefits: ['benefits_', 'searchnav_', 'searchNav_', 'common_'],
  Search: ['searchNav_', 'searchnav_'],
  SearchNav: ['searchNav_', 'searchnav_'],
  Pharmacy: ['pharmacy_', 'homescreen_pharmacy', 'searchnav_', 'searchNav_'],
  Shop: ['shop_', 'searchnav_', 'searchNav_'],
  Health: ['health_', 'homescreen_healthServices', 'searchnav_', 'searchNav_'],
  MCCore: ['mccore_', 'searchnav_', 'searchNav_'],
  NGS: ['ngs_', 'searchnav_', 'searchNav_'],
  VM: ['vm_', 'searchnav_', 'searchNav_'],
  Chatbot: ['chatbot_', 'searchnav_', 'searchNav_'],
  H100: ['h100_', 'searchnav_', 'searchNav_'],
  General: ['common_', 'searchnav_', 'searchNav_', 'account_']
};

let _cache = null;

/**
 * Parse all output.* definitions from a markdown file's JS code blocks
 */
function parseScreenObjectsFromMarkdown(content) {
  const screenObjects = {};

  // Match JavaScript code blocks containing output.* definitions
  const codeBlockRegex = /```javascript\n([\s\S]*?)```/g;
  let blockMatch;

  while ((blockMatch = codeBlockRegex.exec(content)) !== null) {
    const block = blockMatch[1];

    // Match output.screenName = { ... } patterns
    const outputRegex = /output\.(\w+)\s*=\s*\{([^}]+)\}/g;
    let outputMatch;

    while ((outputMatch = outputRegex.exec(block)) !== null) {
      const screenName = outputMatch[1];
      const propsBlock = outputMatch[2];

      if (!screenObjects[screenName]) {
        screenObjects[screenName] = {};
      }

      // Extract key: "value" pairs
      const propRegex = /(\w+)\s*:\s*["']([^"']+)["']/g;
      let propMatch;
      while ((propMatch = propRegex.exec(propsBlock)) !== null) {
        const elementName = propMatch[1];
        const selector = propMatch[2];
        screenObjects[screenName][elementName] = selector;
      }
    }
  }

  // Also match inline output.* definitions outside code blocks (YAML validation examples etc.)
  const inlineRegex = /output\.(\w+)\.(\w+)/g;
  let inlineMatch;
  while ((inlineMatch = inlineRegex.exec(content)) !== null) {
    const screenName = inlineMatch[1];
    const elementName = inlineMatch[2];
    if (!screenObjects[screenName]) {
      screenObjects[screenName] = {};
    }
    // Only add if we don't already have a selector for it
    if (!screenObjects[screenName][elementName]) {
      screenObjects[screenName][elementName] = `[from reference: ${screenName}.${elementName}]`;
    }
  }

  return screenObjects;
}

/**
 * Load and parse all docs files
 */
async function loadAllScreenObjects() {
  if (_cache) return _cache;

  const allScreenObjects = {};

  const docFiles = [
    'agents.md',
    'h100.md',
    'features/benefits.md',
    'features/search_navigation.md',
    'features/homescreen/overview-homescreen.md',
    'features/homescreen/homescreen-discover-nbas.md',
    'features/homescreen/homescreen-business-units.md',
    'features/homescreen/homescreen-activity-zone.md'
  ];

  for (const docFile of docFiles) {
    const filePath = path.join(DOCS_ROOT, docFile);
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const parsed = parseScreenObjectsFromMarkdown(content);

      // Merge into allScreenObjects (later files override earlier ones for same keys)
      for (const [screenName, elements] of Object.entries(parsed)) {
        if (!allScreenObjects[screenName]) {
          allScreenObjects[screenName] = {};
        }
        for (const [elemName, selector] of Object.entries(elements)) {
          // Only override if we have a real selector (not a reference placeholder)
          if (!selector.startsWith('[from reference:') || !allScreenObjects[screenName][elemName]) {
            allScreenObjects[screenName][elemName] = selector;
          }
        }
      }
    } catch (e) {
      // File not found or read error — skip silently
    }
  }

  _cache = allScreenObjects;
  return allScreenObjects;
}

/**
 * Get screen objects relevant to a functional area
 */
async function getScreenObjectsForArea(functionalArea) {
  const all = await loadAllScreenObjects();
  const normalized = functionalArea.charAt(0).toUpperCase() + functionalArea.slice(1).toLowerCase();

  // Find matching prefixes
  let prefixes = AREA_TO_SCREEN_PREFIXES[normalized] || AREA_TO_SCREEN_PREFIXES[functionalArea];
  if (!prefixes) {
    // Try case-insensitive match
    const key = Object.keys(AREA_TO_SCREEN_PREFIXES).find(
      k => k.toLowerCase() === functionalArea.toLowerCase()
    );
    prefixes = key ? AREA_TO_SCREEN_PREFIXES[key] : AREA_TO_SCREEN_PREFIXES.General;
  }

  const filtered = {};
  for (const [screenName, elements] of Object.entries(all)) {
    const matches = prefixes.some(prefix => screenName.startsWith(prefix) || screenName === prefix.replace(/_$/, ''));
    if (matches) {
      filtered[screenName] = elements;
    }
  }

  return filtered;
}

/**
 * Get all screen objects
 */
async function getAllScreenObjects() {
  return await loadAllScreenObjects();
}

/**
 * Resolve an element description to the best output.* path
 * Returns { path: 'output.screenName.elementName', selector: '...', confidence: N } or null
 */
async function resolveElement(description, functionalArea, contextHint) {
  const areaObjects = await getScreenObjectsForArea(functionalArea || 'General');
  const desc = description.toLowerCase().trim();

  let bestMatch = null;
  let bestScore = 0;

  for (const [screenName, elements] of Object.entries(areaObjects)) {
    for (const [elementName, selector] of Object.entries(elements)) {
      let score = 0;
      const elemLower = elementName.toLowerCase();
      const selectorLower = selector.toLowerCase();
      const screenLower = screenName.toLowerCase();

      // Track element-level match score separately from screen-level score
      let elementScore = 0;

      // Exact element name match
      if (desc === elemLower) elementScore += 100;
      // Exact selector match
      if (desc === selectorLower) elementScore += 100;
      // Element name contained in description
      if (desc.includes(elemLower) && elemLower.length > 3) elementScore += 70;
      // Description contained in element name
      if (elemLower.includes(desc) && desc.length > 3) elementScore += 65;
      // Selector contained in description
      if (desc.includes(selectorLower) && selectorLower.length > 3) elementScore += 60;
      // Description contained in selector
      if (selectorLower.includes(desc) && desc.length > 3) elementScore += 55;
      // Word overlap between description and element name
      const descWords = desc.split(/[\s_-]+/).filter(w => w.length > 2);
      const elemWords = elemLower.split(/(?=[A-Z])|[\s_-]+/).map(w => w.toLowerCase()).filter(w => w.length > 2);
      const overlap = descWords.filter(w => elemWords.some(e => e.includes(w) || w.includes(e))).length;
      if (overlap > 0) elementScore += overlap * 20;

      score += elementScore;

      // Screen name relevance
      const screenWords = screenLower.split('_').filter(w => w.length > 2);
      const screenOverlap = descWords.filter(w => screenWords.some(s => s.includes(w) || w.includes(s))).length;
      if (screenOverlap > 0) score += screenOverlap * 10;

      // Context hint boost: only apply when there's already a meaningful element-level match
      // This prevents screen-name-only matches from being falsely boosted
      if (contextHint && elementScore > 0) {
        if (contextHint === 'header' && screenLower.includes('header')) {
          score += 30;
        } else if (contextHint === 'bottomNav' && (screenLower.includes('bottomnav') || screenLower.includes('bottom_nav'))) {
          score += 30;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = {
          path: `\${output.${screenName}.${elementName}}`,
          screenName,
          elementName,
          selector,
          confidence: Math.min(score, 100)
        };
      }
    }
  }

  return bestMatch;
}

/**
 * Format screen objects as a string for LLM prompt context
 */
async function formatScreenObjectsForPrompt(functionalArea) {
  const objects = await getScreenObjectsForArea(functionalArea);
  const lines = [];

  for (const [screenName, elements] of Object.entries(objects)) {
    lines.push(`output.${screenName} = {`);
    for (const [elemName, selector] of Object.entries(elements)) {
      lines.push(`  ${elemName}: "${selector}"`);
    }
    lines.push('}');
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Clear the cache (useful for testing)
 */
function clearCache() {
  _cache = null;
}

module.exports = {
  getScreenObjectsForArea,
  getAllScreenObjects,
  resolveElement,
  formatScreenObjectsForPrompt,
  clearCache,
  AREA_TO_SCREEN_PREFIXES
};

// CLI usage
if (require.main === module) {
  const area = process.argv[2] || 'Home';
  getScreenObjectsForArea(area).then(objects => {
    console.log(`\n=== Screen Objects for "${area}" ===\n`);
    for (const [screenName, elements] of Object.entries(objects)) {
      console.log(`output.${screenName}:`);
      for (const [elem, sel] of Object.entries(elements)) {
        console.log(`  ${elem}: "${sel}"`);
      }
      console.log('');
    }
  }).catch(console.error);
}
