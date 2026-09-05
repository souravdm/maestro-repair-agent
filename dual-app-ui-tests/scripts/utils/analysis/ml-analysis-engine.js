#!/usr/bin/env node

/**
 * ML-Powered Test Analysis Engine
 * Provides failure prediction, root cause detection, and intelligent insights
 * using pattern recognition and historical data analysis
 */

const fs = require('fs');
const path = require('path');

/**
 * Historical Test Database (in-memory for now, can be migrated to SQLite)
 */
class TestHistoryDB {
  constructor(dbPath = '.maestro-history') {
    this.dbPath = dbPath;
    this.history = this.loadHistory();
  }

  loadHistory() {
    try {
      if (!fs.existsSync(this.dbPath)) {
        fs.mkdirSync(this.dbPath, { recursive: true });
      }
      
      const historyFile = path.join(this.dbPath, 'test-history.json');
      if (fs.existsSync(historyFile)) {
        return JSON.parse(fs.readFileSync(historyFile, 'utf8'));
      }
    } catch (e) {
      console.error('Failed to load history:', e.message);
    }
    
    return {
      runs: [],
      tests: {},
      failures: [],
      patterns: {},
    };
  }

  saveHistory() {
    try {
      const historyFile = path.join(this.dbPath, 'test-history.json');
      fs.writeFileSync(historyFile, JSON.stringify(this.history, null, 2), 'utf8');
    } catch (e) {
      console.error('Failed to save history:', e.message);
    }
  }

  addTestRun(runData) {
    const run = {
      id: `run_${Date.now()}`,
      timestamp: new Date().toISOString(),
      platform: runData.platform,
      environment: runData.environment,
      ciMetadata: runData.ciMetadata,
      summary: runData.summary,
      tests: runData.tests,
      performance: runData.performance,
    };

    this.history.runs.push(run);

    // Update per-test history
    runData.tests.forEach(test => {
      const testKey = this.getTestKey(test.name);
      if (!this.history.tests[testKey]) {
        this.history.tests[testKey] = {
          name: test.name,
          runs: [],
          totalRuns: 0,
          totalPasses: 0,
          totalFailures: 0,
          flakiness: 0,
          avgDuration: 0,
        };
      }

      const testHistory = this.history.tests[testKey];
      testHistory.runs.push({
        runId: run.id,
        timestamp: run.timestamp,
        status: test.status,
        duration: test.duration,
        failureReason: test.failureReason,
      });

      testHistory.totalRuns++;
      if (test.status === 'passed') testHistory.totalPasses++;
      if (test.status === 'failed') {
        testHistory.totalFailures++;
        
        // Track failure
        this.history.failures.push({
          testName: test.name,
          timestamp: run.timestamp,
          reason: test.failureReason,
          platform: runData.platform,
          environment: runData.environment,
        });
      }

      // Calculate flakiness score (0-100)
      testHistory.flakiness = this.calculateFlakiness(testHistory.runs);

      // Calculate average duration
      const durations = testHistory.runs.filter(r => r.duration).map(r => r.duration);
      testHistory.avgDuration = durations.length > 0
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : 0;
    });

    // Keep only last 100 runs
    if (this.history.runs.length > 100) {
      this.history.runs = this.history.runs.slice(-100);
    }

    this.saveHistory();
    return run.id;
  }

  getTestKey(testName) {
    return testName.toLowerCase().replace(/[^a-z0-9]/g, '_');
  }

  calculateFlakiness(runs) {
    if (runs.length < 2) return 0;

    let transitions = 0;
    for (let i = 1; i < runs.length; i++) {
      if (runs[i].status !== runs[i - 1].status) {
        transitions++;
      }
    }

    // Flakiness = (transitions / possible transitions) * 100
    return Math.round((transitions / (runs.length - 1)) * 100);
  }

  getTestHistory(testName, limit = 10) {
    const testKey = this.getTestKey(testName);
    const testHistory = this.history.tests[testKey];
    
    if (!testHistory) return null;

    return {
      ...testHistory,
      runs: testHistory.runs.slice(-limit),
    };
  }

  getRecentFailures(limit = 50) {
    return this.history.failures.slice(-limit);
  }

  getAllTests() {
    return Object.values(this.history.tests);
  }
}

/**
 * ML-Powered Failure Predictor
 */
class FailurePredictor {
  constructor(db) {
    this.db = db;
  }

  /**
   * Predict likelihood of test failure based on historical data
   */
  predictFailure(testName) {
    const history = this.db.getTestHistory(testName, 20);
    
    if (!history || history.totalRuns < 5) {
      return {
        testName,
        prediction: 'insufficient_data',
        confidence: 0,
        failureProbability: 0,
        reasoning: 'Not enough historical data (minimum 5 runs required)',
      };
    }

    // Calculate failure rate
    const failureRate = history.totalFailures / history.totalRuns;

    // Recent trend (last 10 runs)
    const recentRuns = history.runs.slice(-10);
    const recentFailures = recentRuns.filter(r => r.status === 'failed').length;
    const recentFailureRate = recentFailures / recentRuns.length;

    // Flakiness factor
    const flakinessScore = history.flakiness / 100;

    // Weighted prediction
    const failureProbability = (
      failureRate * 0.4 +           // Overall history: 40%
      recentFailureRate * 0.5 +     // Recent trend: 50%
      flakinessScore * 0.1          // Flakiness: 10%
    );

    // Confidence based on data volume and consistency
    const dataVolumeScore = Math.min(history.totalRuns / 20, 1);
    const consistencyScore = 1 - flakinessScore;
    const confidence = Math.round((dataVolumeScore * 0.6 + consistencyScore * 0.4) * 100);

    // Prediction
    let prediction = 'stable';
    if (failureProbability > 0.7) prediction = 'high_risk';
    else if (failureProbability > 0.4) prediction = 'moderate_risk';
    else if (failureProbability > 0.2) prediction = 'low_risk';

    // Reasoning
    const reasoning = this.generatePredictionReasoning(
      failureRate,
      recentFailureRate,
      history.flakiness,
      history.totalRuns
    );

    return {
      testName,
      prediction,
      confidence,
      failureProbability: Math.round(failureProbability * 100),
      metrics: {
        overallFailureRate: Math.round(failureRate * 100),
        recentFailureRate: Math.round(recentFailureRate * 100),
        flakiness: history.flakiness,
        totalRuns: history.totalRuns,
      },
      reasoning,
    };
  }

  generatePredictionReasoning(overallRate, recentRate, flakiness, totalRuns) {
    const reasons = [];

    if (recentRate > overallRate * 1.5) {
      reasons.push('Recent failure rate is significantly higher than historical average');
    } else if (recentRate < overallRate * 0.5) {
      reasons.push('Recent runs show improvement over historical average');
    }

    if (flakiness > 50) {
      reasons.push('High flakiness detected - test is unstable');
    } else if (flakiness > 30) {
      reasons.push('Moderate flakiness - occasional instability');
    } else if (flakiness < 10) {
      reasons.push('Very stable test with consistent results');
    }

    if (totalRuns > 50) {
      reasons.push('Strong prediction based on extensive historical data');
    } else if (totalRuns < 10) {
      reasons.push('Limited historical data - prediction may be less accurate');
    }

    return reasons.length > 0 ? reasons : ['Normal test behavior with no significant patterns'];
  }

  /**
   * Predict failures for entire test suite
   */
  predictSuiteFailures(testNames) {
    const predictions = testNames.map(name => this.predictFailure(name));
    
    const highRisk = predictions.filter(p => p.prediction === 'high_risk');
    const moderateRisk = predictions.filter(p => p.prediction === 'moderate_risk');
    const lowRisk = predictions.filter(p => p.prediction === 'low_risk');
    const stable = predictions.filter(p => p.prediction === 'stable');

    return {
      summary: {
        total: predictions.length,
        highRisk: highRisk.length,
        moderateRisk: moderateRisk.length,
        lowRisk: lowRisk.length,
        stable: stable.length,
      },
      predictions,
      recommendations: this.generateSuiteRecommendations(highRisk, moderateRisk),
    };
  }

  generateSuiteRecommendations(highRisk, moderateRisk) {
    const recommendations = [];

    if (highRisk.length > 0) {
      recommendations.push({
        priority: 'critical',
        title: `${highRisk.length} high-risk test(s) detected`,
        action: 'Review and stabilize these tests before running full suite',
        tests: highRisk.map(p => p.testName),
      });
    }

    if (moderateRisk.length > 5) {
      recommendations.push({
        priority: 'high',
        title: `${moderateRisk.length} tests showing instability`,
        action: 'Consider investigating these tests for potential issues',
        tests: moderateRisk.slice(0, 5).map(p => p.testName),
      });
    }

    return recommendations;
  }
}

/**
 * Root Cause Analyzer
 */
class RootCauseAnalyzer {
  constructor(db) {
    this.db = db;
  }

  /**
   * Analyze root cause of test failure using historical patterns
   */
  analyzeRootCause(testName, currentFailureReason) {
    const history = this.db.getTestHistory(testName, 50);
    
    if (!history || history.totalFailures === 0) {
      return {
        testName,
        rootCause: 'unknown',
        confidence: 0,
        analysis: 'No historical failure data available',
      };
    }

    // Get all historical failures for this test
    const failures = history.runs.filter(r => r.status === 'failed' && r.failureReason);

    // Pattern analysis
    const patterns = this.extractFailurePatterns(failures);
    const currentPattern = this.categorizeFailure(currentFailureReason);

    // Find matching historical pattern
    const matchingPattern = patterns.find(p => p.category === currentPattern.category);

    if (matchingPattern && matchingPattern.frequency > 2) {
      return {
        testName,
        rootCause: this.inferRootCause(matchingPattern, currentPattern),
        confidence: Math.min(95, matchingPattern.frequency * 15),
        analysis: this.generateRootCauseAnalysis(matchingPattern, currentPattern, history),
        historicalOccurrences: matchingPattern.frequency,
        suggestedFixes: this.suggestFixes(matchingPattern.category),
      };
    }

    // New failure pattern
    return {
      testName,
      rootCause: 'new_failure_pattern',
      confidence: 30,
      analysis: 'This failure pattern has not been seen before for this test',
      currentError: currentPattern.category,
      suggestedFixes: this.suggestFixes(currentPattern.category),
    };
  }

  extractFailurePatterns(failures) {
    const patternMap = {};

    failures.forEach(failure => {
      const pattern = this.categorizeFailure(failure.failureReason);
      const key = pattern.category;

      if (!patternMap[key]) {
        patternMap[key] = {
          category: key,
          frequency: 0,
          examples: [],
          timestamps: [],
        };
      }

      patternMap[key].frequency++;
      if (patternMap[key].examples.length < 3) {
        patternMap[key].examples.push(failure.failureReason);
      }
      patternMap[key].timestamps.push(failure.timestamp);
    });

    return Object.values(patternMap).sort((a, b) => b.frequency - a.frequency);
  }

  categorizeFailure(failureReason) {
    if (!failureReason) {
      return { category: 'unknown', keywords: [] };
    }

    const lower = failureReason.toLowerCase();
    const categories = {
      element_not_found: ['element not found', 'could not find', 'no element', 'selector'],
      timeout: ['timeout', 'timed out', 'exceeded time'],
      network: ['network', 'connection', 'api', 'http', '404', '500'],
      assertion: ['assertion', 'expected', 'actual', 'mismatch'],
      crash: ['crash', 'terminated', 'segmentation'],
      permission: ['permission', 'denied', 'unauthorized'],
      data: ['invalid data', 'null', 'undefined'],
    };

    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(kw => lower.includes(kw))) {
        return { category, keywords: keywords.filter(kw => lower.includes(kw)) };
      }
    }

    return { category: 'other', keywords: [] };
  }

  inferRootCause(matchingPattern, currentPattern) {
    const rootCauses = {
      element_not_found: 'UI element selector changed or element timing issue',
      timeout: 'Performance degradation or slow network response',
      network: 'Backend service instability or API endpoint change',
      assertion: 'Application behavior changed or test expectation outdated',
      crash: 'Application stability issue or memory leak',
      permission: 'Missing permissions or authentication failure',
      data: 'Test data corruption or environment configuration issue',
    };

    return rootCauses[matchingPattern.category] || 'Unknown root cause';
  }

  generateRootCauseAnalysis(matchingPattern, currentPattern, history) {
    const analysis = [];

    analysis.push(`This test has failed ${matchingPattern.frequency} times with similar error patterns.`);

    // Temporal analysis
    const timestamps = matchingPattern.timestamps.map(t => new Date(t));
    const now = new Date();
    const recentFailures = timestamps.filter(t => (now - t) < 7 * 24 * 60 * 60 * 1000).length;

    if (recentFailures > matchingPattern.frequency * 0.7) {
      analysis.push('Most failures occurred recently, suggesting a recent regression.');
    } else if (recentFailures === 0) {
      analysis.push('This failure pattern was previously resolved but has reappeared.');
    }

    // Flakiness analysis
    if (history.flakiness > 40) {
      analysis.push('Test shows high flakiness, indicating environmental or timing issues.');
    }

    return analysis.join(' ');
  }

  suggestFixes(category) {
    const fixes = {
      element_not_found: [
        'Update element selectors to match current app version',
        'Add explicit waits before element interaction',
        'Verify element is not conditionally rendered',
        'Use more robust selectors (accessibility IDs)',
      ],
      timeout: [
        'Increase timeout values for slow operations',
        'Optimize app performance',
        'Add retry logic for flaky operations',
        'Check network connectivity',
      ],
      network: [
        'Verify backend service availability',
        'Check API endpoint URLs',
        'Review authentication tokens',
        'Add network error handling',
      ],
      assertion: [
        'Update test expectations to match current behavior',
        'Verify test data is correct',
        'Check for recent app changes',
        'Review assertion logic',
      ],
      crash: [
        'Review crash logs',
        'Check for memory leaks',
        'Verify error handling',
        'Test on different devices',
      ],
      permission: [
        'Grant required permissions',
        'Handle permission dialogs',
        'Verify authentication flow',
        'Check app entitlements',
      ],
      data: [
        'Reset test data',
        'Verify database state',
        'Check environment configuration',
        'Validate input data',
      ],
    };

    return fixes[category] || ['Review test logs and app behavior'];
  }

  /**
   * Analyze correlation between failures across tests
   */
  analyzeFailureCorrelation() {
    const recentFailures = this.db.getRecentFailures(100);
    
    if (recentFailures.length < 10) {
      return {
        correlations: [],
        insights: 'Insufficient failure data for correlation analysis',
      };
    }

    // Group by timestamp (same run)
    const failuresByRun = {};
    recentFailures.forEach(failure => {
      const runKey = failure.timestamp.split('T')[0]; // Group by date
      if (!failuresByRun[runKey]) {
        failuresByRun[runKey] = [];
      }
      failuresByRun[runKey].push(failure);
    });

    // Find common failure patterns
    const correlations = [];
    Object.entries(failuresByRun).forEach(([date, failures]) => {
      if (failures.length > 1) {
        const categories = failures.map(f => this.categorizeFailure(f.reason).category);
        const uniqueCategories = [...new Set(categories)];
        
        if (uniqueCategories.length === 1) {
          correlations.push({
            date,
            count: failures.length,
            category: uniqueCategories[0],
            tests: failures.map(f => f.testName),
            insight: `Multiple tests failed with ${uniqueCategories[0]} errors`,
          });
        }
      }
    });

    return {
      correlations: correlations.slice(0, 10),
      insights: this.generateCorrelationInsights(correlations),
    };
  }

  generateCorrelationInsights(correlations) {
    if (correlations.length === 0) {
      return 'No significant failure correlations detected';
    }

    const insights = [];
    const categoryCount = {};

    correlations.forEach(c => {
      categoryCount[c.category] = (categoryCount[c.category] || 0) + 1;
    });

    const topCategory = Object.entries(categoryCount).sort((a, b) => b[1] - a[1])[0];
    
    if (topCategory) {
      insights.push(`Most common correlated failure: ${topCategory[0]} (${topCategory[1]} occurrences)`);
    }

    if (correlations.some(c => c.count > 5)) {
      insights.push('Detected widespread failures affecting multiple tests simultaneously');
    }

    return insights.join('. ');
  }
}

/**
 * ML Analysis Engine - Main Interface
 */
class MLAnalysisEngine {
  constructor(dbPath) {
    this.db = new TestHistoryDB(dbPath);
    this.predictor = new FailurePredictor(this.db);
    this.rootCauseAnalyzer = new RootCauseAnalyzer(this.db);
  }

  /**
   * Record test run for ML training
   */
  recordTestRun(runData) {
    return this.db.addTestRun(runData);
  }

  /**
   * Get failure prediction for a test
   */
  predictFailure(testName) {
    return this.predictor.predictFailure(testName);
  }

  /**
   * Get failure predictions for test suite
   */
  predictSuiteFailures(testNames) {
    return this.predictor.predictSuiteFailures(testNames);
  }

  /**
   * Analyze root cause of failure
   */
  analyzeRootCause(testName, failureReason) {
    return this.rootCauseAnalyzer.analyzeRootCause(testName, failureReason);
  }

  /**
   * Get comprehensive ML analysis report
   */
  generateMLReport(testResults) {
    const testNames = testResults.map(t => t.name);
    const predictions = this.predictSuiteFailures(testNames);
    
    const failedTests = testResults.filter(t => t.status === 'failed');
    const rootCauseAnalysis = failedTests.map(test => 
      this.analyzeRootCause(test.name, test.failureReason)
    );

    const correlations = this.rootCauseAnalyzer.analyzeFailureCorrelation();

    // Flaky test detection
    const allTests = this.db.getAllTests();
    const flakyTests = allTests
      .filter(t => t.flakiness > 30 && t.totalRuns >= 5)
      .sort((a, b) => b.flakiness - a.flakiness)
      .slice(0, 10);

    return {
      predictions,
      rootCauseAnalysis,
      correlations,
      flakyTests: flakyTests.map(t => ({
        name: t.name,
        flakiness: t.flakiness,
        totalRuns: t.totalRuns,
        failureRate: Math.round((t.totalFailures / t.totalRuns) * 100),
      })),
      insights: this.generateInsights(predictions, rootCauseAnalysis, flakyTests),
    };
  }

  generateInsights(predictions, rootCauseAnalysis, flakyTests) {
    const insights = [];

    if (predictions.summary.highRisk > 0) {
      insights.push({
        type: 'warning',
        title: 'High-Risk Tests Detected',
        message: `${predictions.summary.highRisk} test(s) have high failure probability`,
        action: 'Review and stabilize before running full suite',
      });
    }

    if (rootCauseAnalysis.length > 0) {
      const commonRootCause = this.findMostCommonRootCause(rootCauseAnalysis);
      if (commonRootCause) {
        insights.push({
          type: 'info',
          title: 'Common Root Cause Identified',
          message: commonRootCause.rootCause,
          action: 'Address this issue to fix multiple tests',
        });
      }
    }

    if (flakyTests.length > 0) {
      insights.push({
        type: 'warning',
        title: 'Flaky Tests Detected',
        message: `${flakyTests.length} test(s) showing instability`,
        action: 'Stabilize flaky tests to improve reliability',
      });
    }

    return insights;
  }

  findMostCommonRootCause(rootCauseAnalysis) {
    const causeCount = {};
    rootCauseAnalysis.forEach(analysis => {
      const cause = analysis.rootCause;
      causeCount[cause] = (causeCount[cause] || 0) + 1;
    });

    const entries = Object.entries(causeCount);
    if (entries.length === 0) return null;

    const [rootCause, count] = entries.sort((a, b) => b[1] - a[1])[0];
    return count > 1 ? { rootCause, count } : null;
  }
}

module.exports = {
  MLAnalysisEngine,
  TestHistoryDB,
  FailurePredictor,
  RootCauseAnalyzer,
};
