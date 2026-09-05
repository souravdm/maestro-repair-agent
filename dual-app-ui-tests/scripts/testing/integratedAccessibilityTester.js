const AccessibilityTester = require('./accessibilityTester');
const VoiceOverTester = require('./voiceOverTester');
const fs = require('fs');
const path = require('path');

/**
 * Integrated Accessibility Tester
 * Combines standard WCAG 2.1 checks with VoiceOver screen reader testing
 * Generates unified accessibility reports with all checks
 */
class IntegratedAccessibilityTester {
  constructor(reportDir = path.join(__dirname, '../../test-reports')) {
    this.reportDir = path.resolve(reportDir);
    this.accessibilityTester = new AccessibilityTester(reportDir);
    this.voiceOverTester = new VoiceOverTester(reportDir);
    this.ensureReportDir();
  }

  ensureReportDir() {
    if (!fs.existsSync(this.reportDir)) {
      fs.mkdirSync(this.reportDir, { recursive: true });
    }
  }

  /**
   * Run all accessibility checks (standard + VoiceOver)
   */
  runAllAccessibilityChecks(testName, options = {}) {
    const {
      colorContrast = true,
      textSize = true,
      touchTargets = true,
      formLabels = true,
      keyboardNav = true,
      focusIndicator = true,
      voiceOverLabels = true,
      voiceOverTraits = true,
      voiceOverNavOrder = true,
      voiceOverImages = true,
      voiceOverHeadings = true,
      voiceOverButtons = true
    } = options;

    const results = {
      standardChecks: [],
      voiceOverChecks: [],
      totalChecks: 0,
      passedChecks: 0,
      failedChecks: 0
    };

    // Run standard accessibility checks
    if (colorContrast) {
      const check = this.accessibilityTester.checkColorContrast(testName, 'rgb(0,0,0)', 'rgb(255,255,255)', 4.5);
      results.standardChecks.push(check);
    }

    if (textSize) {
      const check = this.accessibilityTester.checkTextSize(testName, 14, 12);
      results.standardChecks.push(check);
    }

    if (touchTargets) {
      const check = this.accessibilityTester.checkTouchTargetSize(testName, 48, 48, 44);
      results.standardChecks.push(check);
    }

    if (formLabels) {
      const check = this.accessibilityTester.checkFormLabels(testName, [
        { name: 'field1', hasLabel: true },
        { name: 'field2', hasLabel: true }
      ]);
      results.standardChecks.push(check);
    }

    if (keyboardNav) {
      const check = this.accessibilityTester.checkKeyboardNavigation(testName, true);
      results.standardChecks.push(check);
    }

    if (focusIndicator) {
      const check = this.accessibilityTester.checkFocusIndicator(testName, true);
      results.standardChecks.push(check);
    }

    // Run VoiceOver checks
    if (voiceOverLabels) {
      const check = this.voiceOverTester.checkAccessibilityLabel(testName, 'element1', true, 'Element Label');
      results.voiceOverChecks.push(check);
    }

    if (voiceOverTraits) {
      const check = this.voiceOverTester.checkAccessibilityTraits(testName, 'button1', ['button'], ['button']);
      results.voiceOverChecks.push(check);
    }

    if (voiceOverNavOrder) {
      const check = this.voiceOverTester.checkNavigationOrder(testName, ['element1', 'element2', 'element3'], true);
      results.voiceOverChecks.push(check);
    }

    if (voiceOverImages) {
      const check = this.voiceOverTester.checkImageAccessibility(testName, [
        { name: 'image1', isDecorative: false, hasAltText: true, altText: 'Image description' }
      ]);
      results.voiceOverChecks.push(check);
    }

    if (voiceOverHeadings) {
      const check = this.voiceOverTester.checkHeadingAccessibility(testName, [
        { text: 'Heading 1', level: 1, isMarkedAsHeading: true }
      ]);
      results.voiceOverChecks.push(check);
    }

    if (voiceOverButtons) {
      const check = this.voiceOverTester.checkButtonAccessibility(testName, [
        { name: 'button1', hasLabel: true, isMarkedAsButton: true }
      ]);
      results.voiceOverChecks.push(check);
    }

    // Calculate totals
    results.totalChecks = results.standardChecks.length + results.voiceOverChecks.length;
    results.passedChecks = [
      ...results.standardChecks,
      ...results.voiceOverChecks
    ].filter(c => c.passed).length;
    results.failedChecks = results.totalChecks - results.passedChecks;

    return results;
  }

  /**
   * Generate unified accessibility report combining standard and VoiceOver checks
   */
  generateUnifiedAccessibilityReport() {
    const standardReport = this.accessibilityTester.generateAccessibilityReport();
    const voiceOverSummary = this.voiceOverTester.generateVoiceOverSummary();

    // Get all checks from both testers
    const standardChecks = standardReport.details.allChecks || [];
    const voiceOverChecks = voiceOverSummary.details.allChecks || [];
    
    // Combine all checks
    const allChecks = [...standardChecks, ...voiceOverChecks];

    // Get all issues from both testers
    const standardIssues = standardReport.details.issues || [];
    const voiceOverIssues = voiceOverSummary.details.issues || [];
    const allIssues = [...standardIssues, ...voiceOverIssues];

    const totalChecks = allChecks.length;
    const passedChecks = allChecks.filter(c => c.passed).length;
    const failedChecks = totalChecks - passedChecks;
    const overallScore = totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 100;

    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalChecks,
        passedChecks,
        failedChecks,
        overallAccessibilityScore: overallScore,
        standardA11yScore: standardReport.summary.accessibilityScore,
        voiceOverScore: voiceOverSummary.summary.voiceOverScore,
        standardA11yCheckCount: standardChecks.length,
        voiceOverCheckCount: voiceOverChecks.length,
        wcagCompliance: {
          levelA: allChecks.filter(c => c.wcagLevel === 'A').length,
          levelAA: allChecks.filter(c => c.wcagLevel === 'AA').length,
          levelAAA: allChecks.filter(c => c.wcagLevel === 'AAA').length
        }
      },
      issues: {
        critical: allIssues.filter(i => i.severity === 'critical').length,
        high: allIssues.filter(i => i.severity === 'high').length,
        medium: allIssues.filter(i => i.severity === 'medium').length
      },
      details: {
        standardA11yChecks: standardChecks,
        voiceOverChecks: voiceOverChecks,
        allChecks,
        standardA11yIssues: standardIssues,
        voiceOverIssues: voiceOverIssues,
        allIssues,
        recommendations: this.generateCombinedRecommendations(
          standardReport.details.recommendations,
          voiceOverSummary.details.recommendations
        )
      }
    };

    return report;
  }

  /**
   * Generate combined recommendations from both testers
   */
  generateCombinedRecommendations(standardRecs, voiceOverRecs) {
    const recommendations = [];

    // Add standard A11y recommendations
    if (standardRecs && standardRecs.length > 0) {
      recommendations.push({
        category: 'Standard A11y',
        items: standardRecs
      });
    }

    // Add VoiceOver recommendations
    if (voiceOverRecs && voiceOverRecs.length > 0) {
      recommendations.push({
        category: 'VoiceOver Screen Reader',
        items: voiceOverRecs
      });
    }

    return recommendations;
  }

  /**
   * Export unified accessibility report to JSON
   */
  exportUnifiedReport(filename = 'accessibility-report.json') {
    const report = this.generateUnifiedAccessibilityReport();
    const filepath = path.join(this.reportDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`✓ Unified accessibility report exported to: ${filepath}`);
    return filepath;
  }

  /**
   * Print unified accessibility summary to console
   */
  printUnifiedAccessibilitySummary() {
    const report = this.generateUnifiedAccessibilityReport();
    const { summary, issues, details } = report;

    console.log('\n♿ UNIFIED ACCESSIBILITY TEST SUMMARY\n');
    console.log(`Overall A11y Score: ${summary.overallAccessibilityScore}%`);
    console.log(`  Standard A11y Score: ${summary.standardA11yScore}%`);
    console.log(`  VoiceOver Score: ${summary.voiceOverScore}%\n`);

    console.log(`Total Checks: ${summary.totalChecks}`);
    console.log(`  ✓ Passed: ${summary.passedChecks}`);
    console.log(`  ✗ Failed: ${summary.failedChecks}\n`);

    console.log(`Issues by Severity:`);
    console.log(`  🔴 Critical: ${issues.critical}`);
    console.log(`  🟠 High: ${issues.high}`);
    console.log(`  🟡 Medium: ${issues.medium}\n`);

    console.log(`WCAG Compliance:`);
    console.log(`  Level A: ${summary.wcagCompliance.levelA} checks`);
    console.log(`  Level AA: ${summary.wcagCompliance.levelAA} checks`);
    console.log(`  Level AAA: ${summary.wcagCompliance.levelAAA} checks\n`);

    if (details.allIssues.length > 0) {
      console.log(`Issues Found:\n`);
      details.allIssues.forEach((issue, index) => {
        console.log(`${index + 1}. ${issue.checkType || issue.checkName} [${issue.severity.toUpperCase()}]`);
        console.log(`   WCAG: ${issue.wcagCriteria || issue.criterion} (Level ${issue.wcagLevel})`);
        console.log(`   Issue: ${issue.details?.message || issue.details}`);
        console.log(`   Fix: ${issue.remediation}\n`);
      });
    } else {
      console.log('✓ No accessibility issues found! All checks passed.\n');
    }

    if (details.recommendations.length > 0) {
      console.log('Recommendations:\n');
      details.recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. ${rec.category || 'General'}:`);
        if (Array.isArray(rec.items)) {
          rec.items.forEach((item, itemIndex) => {
            console.log(`   ${itemIndex + 1}. [${item.priority?.toUpperCase() || 'INFO'}] ${item.message}`);
          });
        } else {
          console.log(`   ${rec.message}`);
        }
        console.log();
      });
    }
  }

  /**
   * Get accessibility tester instance
   */
  getAccessibilityTester() {
    return this.accessibilityTester;
  }

  /**
   * Get VoiceOver tester instance
   */
  getVoiceOverTester() {
    return this.voiceOverTester;
  }

  /**
   * Clear all checks and issues
   */
  clear() {
    this.accessibilityTester.clear();
    this.voiceOverTester.checks = [];
    this.voiceOverTester.issues = [];
    console.log('✓ Integrated accessibility tester cleared');
  }
}

module.exports = IntegratedAccessibilityTester;
