#!/usr/bin/env node

/**
 * Failure Analyzer
 * Auto-categorizes failures, detects patterns, and provides root cause suggestions
 */

const fs = require('fs');
const path = require('path');

/**
 * Failure categories based on error patterns
 */
const FAILURE_CATEGORIES = {
  ELEMENT_NOT_FOUND: {
    name: 'Element Not Found',
    patterns: [
      /element not found/i,
      /could not find/i,
      /no element matching/i,
      /element.*not.*visible/i,
      /selector.*not.*found/i,
    ],
    severity: 'high',
    commonCauses: [
      'Element selector changed in app',
      'Screen loaded too slowly',
      'Element is hidden or off-screen',
      'Wrong screen/state',
    ],
    suggestions: [
      'Verify element exists in current app version',
      'Add wait/scroll before interacting',
      'Check if element is conditionally shown',
      'Use more specific selector (ID or accessibility label)',
    ],
  },
  
  TIMEOUT: {
    name: 'Timeout',
    patterns: [
      /timeout/i,
      /timed out/i,
      /exceeded.*time/i,
      /wait.*failed/i,
      /command.*timeout/i,
    ],
    severity: 'medium',
    commonCauses: [
      'App performance degradation',
      'Network latency',
      'Animation/loading too slow',
      'Infinite loading state',
    ],
    suggestions: [
      'Increase timeout value',
      'Check app performance metrics',
      'Verify network connectivity',
      'Add explicit wait for loading indicators',
    ],
  },
  
  ASSERTION_FAILED: {
    name: 'Assertion Failed',
    patterns: [
      /assertion.*failed/i,
      /expected.*but.*got/i,
      /assert.*visible.*failed/i,
      /not.*equal/i,
      /mismatch/i,
    ],
    severity: 'high',
    commonCauses: [
      'Unexpected app state',
      'Data changed',
      'UI regression',
      'Test data issue',
    ],
    suggestions: [
      'Verify expected vs actual values',
      'Check if app behavior changed',
      'Review test data setup',
      'Update test expectations if intentional change',
    ],
  },
  
  NETWORK_ERROR: {
    name: 'Network Error',
    patterns: [
      /network.*error/i,
      /connection.*failed/i,
      /api.*failed/i,
      /http.*error/i,
      /status.*[45]\d\d/i,
      /no.*internet/i,
    ],
    severity: 'critical',
    commonCauses: [
      'Backend service down',
      'API endpoint changed',
      'Network connectivity issue',
      'Authentication failure',
    ],
    suggestions: [
      'Check backend service status',
      'Verify API endpoints',
      'Test network connectivity',
      'Check authentication tokens',
    ],
  },
  
  APP_CRASH: {
    name: 'App Crash',
    patterns: [
      /crash/i,
      /terminated/i,
      /app.*stopped/i,
      /force.*close/i,
      /segmentation fault/i,
    ],
    severity: 'critical',
    commonCauses: [
      'Memory leak',
      'Null pointer exception',
      'Unhandled exception',
      'Resource exhaustion',
    ],
    suggestions: [
      'Check crash logs',
      'Review memory usage',
      'Verify error handling',
      'Test on different devices',
    ],
  },
  
  DRIVER_ERROR: {
    name: 'Driver/Infrastructure Error',
    patterns: [
      /driver.*error/i,
      /maestro.*failed/i,
      /xctest.*error/i,
      /appium.*error/i,
      /connection.*lost/i,
      /port.*7001/i,
    ],
    severity: 'low',
    commonCauses: [
      'Test infrastructure issue',
      'Driver disconnection',
      'Simulator/emulator problem',
      'Port conflict',
    ],
    suggestions: [
      'Restart simulator/emulator',
      'Check driver logs',
      'Verify port availability',
      'Update test framework',
    ],
  },
  
  PERMISSION_DENIED: {
    name: 'Permission Denied',
    patterns: [
      /permission.*denied/i,
      /access.*denied/i,
      /not.*authorized/i,
      /forbidden/i,
    ],
    severity: 'medium',
    commonCauses: [
      'Missing app permissions',
      'User not authenticated',
      'Insufficient privileges',
      'Permission dialog not handled',
    ],
    suggestions: [
      'Grant required permissions',
      'Handle permission dialogs',
      'Verify user authentication',
      'Check app entitlements',
    ],
  },
  
  DATA_ISSUE: {
    name: 'Test Data Issue',
    patterns: [
      /invalid.*data/i,
      /data.*not.*found/i,
      /user.*not.*found/i,
      /account.*locked/i,
      /credentials.*invalid/i,
    ],
    severity: 'medium',
    commonCauses: [
      'Test data corrupted',
      'User account issue',
      'Database state problem',
      'Environment mismatch',
    ],
    suggestions: [
      'Reset test data',
      'Verify user credentials',
      'Check database state',
      'Use correct environment',
    ],
  },
};

/**
 * Analyze failure and categorize
 */
function analyzeFailure(failureReason, testName = '', testPath = '') {
  if (!failureReason) {
    return {
      category: 'Unknown',
      severity: 'unknown',
      confidence: 0,
      suggestions: [],
    };
  }

  const lowerReason = failureReason.toLowerCase();
  let bestMatch = null;
  let highestConfidence = 0;

  // Try to match against known patterns
  for (const [key, category] of Object.entries(FAILURE_CATEGORIES)) {
    for (const pattern of category.patterns) {
      if (pattern.test(failureReason)) {
        const confidence = calculateConfidence(failureReason, pattern);
        if (confidence > highestConfidence) {
          highestConfidence = confidence;
          bestMatch = {
            category: category.name,
            categoryKey: key,
            severity: category.severity,
            confidence,
            commonCauses: category.commonCauses,
            suggestions: category.suggestions,
          };
        }
      }
    }
  }

  if (bestMatch) {
    return bestMatch;
  }

  // No match found
  return {
    category: 'Uncategorized',
    severity: 'unknown',
    confidence: 0,
    suggestions: [
      'Review failure reason manually',
      'Check test logs for details',
      'Compare with similar failures',
    ],
  };
}

/**
 * Calculate confidence score for pattern match
 */
function calculateConfidence(text, pattern) {
  // Simple confidence based on pattern specificity
  const match = text.match(pattern);
  if (!match) return 0;

  // Longer matches = higher confidence
  const matchLength = match[0].length;
  const textLength = text.length;
  
  return Math.min(100, (matchLength / textLength) * 100 + 50);
}

/**
 * Detect failure patterns across multiple test runs
 */
function detectPatterns(failures) {
  const patterns = {
    recurring: [],      // Same test failing repeatedly
    flaky: [],          // Tests that pass/fail intermittently
    environmental: [],  // Failures specific to environment
    regression: [],     // New failures (not seen before)
  };

  // Group failures by test name
  const failuresByTest = {};
  failures.forEach(f => {
    const key = f.testName || f.name || 'unknown';
    if (!failuresByTest[key]) {
      failuresByTest[key] = [];
    }
    failuresByTest[key].push(f);
  });

  // Analyze each test's failure history
  for (const [testName, testFailures] of Object.entries(failuresByTest)) {
    if (testFailures.length >= 3) {
      // Check if same error repeats
      const errorCounts = {};
      testFailures.forEach(f => {
        const error = f.failureReason || 'unknown';
        errorCounts[error] = (errorCounts[error] || 0) + 1;
      });

      const maxCount = Math.max(...Object.values(errorCounts));
      if (maxCount >= 3) {
        patterns.recurring.push({
          testName,
          failureCount: testFailures.length,
          mostCommonError: Object.keys(errorCounts).find(k => errorCounts[k] === maxCount),
          occurrences: maxCount,
        });
      }
    }
  }

  return patterns;
}

/**
 * Generate failure report with categorization
 */
function generateFailureReport(tests) {
  const failures = tests.filter(t => t.status === 'failed');
  
  if (failures.length === 0) {
    return {
      totalFailures: 0,
      categories: {},
      patterns: {},
      recommendations: [],
    };
  }

  // Categorize each failure
  const categorized = failures.map(test => {
    const analysis = analyzeFailure(test.failureReason, test.name, test.path);
    return {
      ...test,
      analysis,
    };
  });

  // Group by category
  const categories = {};
  categorized.forEach(test => {
    const cat = test.analysis.category;
    if (!categories[cat]) {
      categories[cat] = {
        count: 0,
        severity: test.analysis.severity,
        tests: [],
      };
    }
    categories[cat].count++;
    categories[cat].tests.push({
      name: test.name,
      reason: test.failureReason,
      confidence: test.analysis.confidence,
    });
  });

  // Detect patterns
  const patterns = detectPatterns(failures);

  // Generate recommendations
  const recommendations = generateRecommendations(categories, patterns);

  return {
    totalFailures: failures.length,
    categories,
    patterns,
    recommendations,
    categorizedTests: categorized,
  };
}

/**
 * Generate actionable recommendations
 */
function generateRecommendations(categories, patterns) {
  const recommendations = [];

  // Recommendations based on categories
  const criticalCategories = Object.entries(categories)
    .filter(([_, data]) => data.severity === 'critical')
    .sort((a, b) => b[1].count - a[1].count);

  if (criticalCategories.length > 0) {
    const [category, data] = criticalCategories[0];
    recommendations.push({
      priority: 'critical',
      title: `Address ${category} failures first`,
      description: `${data.count} test(s) failing due to ${category.toLowerCase()}`,
      action: 'Investigate and fix critical issues before proceeding',
    });
  }

  // Recommendations based on patterns
  if (patterns.recurring && patterns.recurring.length > 0) {
    recommendations.push({
      priority: 'high',
      title: 'Fix recurring failures',
      description: `${patterns.recurring.length} test(s) failing consistently`,
      action: 'These tests need immediate attention - likely real bugs',
    });
  }

  if (patterns.flaky && patterns.flaky.length > 0) {
    recommendations.push({
      priority: 'medium',
      title: 'Stabilize flaky tests',
      description: `${patterns.flaky.length} test(s) showing intermittent failures`,
      action: 'Add waits, improve selectors, or fix race conditions',
    });
  }

  return recommendations;
}

/**
 * Save failure analysis to file
 */
function saveFailureAnalysis(report, outputPath) {
  try {
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error(`Failed to save failure analysis: ${e.message}`);
    return false;
  }
}

/**
 * Load failure analysis from file
 */
function loadFailureAnalysis(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    return null;
  }
}

module.exports = {
  analyzeFailure,
  detectPatterns,
  generateFailureReport,
  saveFailureAnalysis,
  loadFailureAnalysis,
  FAILURE_CATEGORIES,
};
