#!/usr/bin/env node

/**
 * Test Categorizer
 * Extracts and categorizes tests based on tags, file paths, and naming conventions
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

/**
 * Extract tags from a Maestro flow file
 */
function extractTagsFromFlow(flowPath) {
  try {
    if (!fs.existsSync(flowPath)) return [];
    
    const content = fs.readFileSync(flowPath, 'utf8');
    const parsed = yaml.load(content);
    
    if (parsed && parsed.tags) {
      return Array.isArray(parsed.tags) ? parsed.tags : [parsed.tags];
    }
    
    return [];
  } catch (e) {
    return [];
  }
}

/**
 * Categorize test based on file path and name
 */
function categorizeTest(testPath, testName) {
  const categories = {
    tags: [],
    feature: 'Unknown',
    priority: 'Medium',
    type: 'Functional',
    suite: '',
  };
  
  // Extract tags from flow file
  if (testPath && fs.existsSync(testPath)) {
    categories.tags = extractTagsFromFlow(testPath);
  }
  
  // Determine feature from path
  const pathParts = testPath.split(path.sep);
  const flowsIndex = pathParts.indexOf('flows');
  if (flowsIndex >= 0 && flowsIndex < pathParts.length - 1) {
    categories.feature = pathParts[flowsIndex + 1];
  }
  
  // Determine test type from tags or name
  const lowerName = testName.toLowerCase();
  const lowerTags = categories.tags.map(t => t.toLowerCase());
  
  if (lowerTags.includes('smoke') || lowerName.includes('smoke')) {
    categories.type = 'Smoke';
    categories.priority = 'Critical';
  } else if (lowerTags.includes('regression')) {
    categories.type = 'Regression';
  } else if (lowerTags.includes('integration')) {
    categories.type = 'Integration';
  } else if (lowerTags.includes('e2e') || lowerName.includes('e2e')) {
    categories.type = 'E2E';
  } else if (lowerTags.includes('ui')) {
    categories.type = 'UI';
  } else if (lowerTags.includes('api')) {
    categories.type = 'API';
  }
  
  // Determine priority from tags
  if (lowerTags.includes('critical') || lowerTags.includes('p0')) {
    categories.priority = 'Critical';
  } else if (lowerTags.includes('high') || lowerTags.includes('p1')) {
    categories.priority = 'High';
  } else if (lowerTags.includes('low') || lowerTags.includes('p3')) {
    categories.priority = 'Low';
  }
  
  // Determine suite from path
  if (testPath.includes('/suites/')) {
    const suiteMatch = testPath.match(/\/suites\/([^/]+)/);
    if (suiteMatch) categories.suite = suiteMatch[1];
  }
  
  return categories;
}

/**
 * Generate category summary from test results
 */
function generateCategorySummary(tests) {
  const summary = {
    byFeature: {},
    byType: {},
    byPriority: {},
    byTag: {},
    totalTags: new Set(),
  };
  
  tests.forEach(test => {
    const cat = test.categories || {};
    
    // By feature
    const feature = cat.feature || 'Unknown';
    if (!summary.byFeature[feature]) {
      summary.byFeature[feature] = { total: 0, passed: 0, failed: 0 };
    }
    summary.byFeature[feature].total++;
    if (test.status === 'passed') summary.byFeature[feature].passed++;
    if (test.status === 'failed') summary.byFeature[feature].failed++;
    
    // By type
    const type = cat.type || 'Functional';
    if (!summary.byType[type]) {
      summary.byType[type] = { total: 0, passed: 0, failed: 0 };
    }
    summary.byType[type].total++;
    if (test.status === 'passed') summary.byType[type].passed++;
    if (test.status === 'failed') summary.byType[type].failed++;
    
    // By priority
    const priority = cat.priority || 'Medium';
    if (!summary.byPriority[priority]) {
      summary.byPriority[priority] = { total: 0, passed: 0, failed: 0 };
    }
    summary.byPriority[priority].total++;
    if (test.status === 'passed') summary.byPriority[priority].passed++;
    if (test.status === 'failed') summary.byPriority[priority].failed++;
    
    // By tag
    if (cat.tags && Array.isArray(cat.tags)) {
      cat.tags.forEach(tag => {
        summary.totalTags.add(tag);
        if (!summary.byTag[tag]) {
          summary.byTag[tag] = { total: 0, passed: 0, failed: 0 };
        }
        summary.byTag[tag].total++;
        if (test.status === 'passed') summary.byTag[tag].passed++;
        if (test.status === 'failed') summary.byTag[tag].failed++;
      });
    }
  });
  
  summary.totalTags = Array.from(summary.totalTags);
  
  return summary;
}

module.exports = {
  extractTagsFromFlow,
  categorizeTest,
  generateCategorySummary,
};
