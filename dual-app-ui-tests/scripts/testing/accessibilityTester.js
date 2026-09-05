const fs = require('fs');
const path = require('path');

/**
 * Validate and sanitize file path to prevent path traversal
 */
function sanitizeFilePath(filePath, allowedDir) {
  const resolvedPath = path.resolve(filePath);
  const resolvedAllowedDir = path.resolve(allowedDir);
  
  if (!resolvedPath.startsWith(resolvedAllowedDir)) {
    throw new Error('Security: Path traversal detected');
  }
  return resolvedPath;
}

class AccessibilityTester {
  constructor(reportDir = path.join(__dirname, '../../test-reports')) {
    // Security: Use resolved path (project root/test-reports)
    this.reportDir = path.resolve(reportDir);
    this.accessibilityFile = path.join(this.reportDir, 'accessibility-report.json');
    this.issues = [];
    this.checks = [];
    this.ensureReportDir();
  }

  ensureReportDir() {
    if (!fs.existsSync(this.reportDir)) {
      fs.mkdirSync(this.reportDir, { recursive: true });
    }
  }

  recordCheck(testName, checkName, passed, details = {}) {
    const check = {
      testName,
      checkName,
      passed,
      timestamp: new Date().toISOString(),
      wcagLevel: details.wcagLevel || 'AA',
      criterion: details.criterion || 'Unknown',
      severity: details.severity || 'medium',
      details: details.details || '',
      remediation: details.remediation || ''
    };

    this.checks.push(check);

    if (!passed) {
      this.issues.push(check);
      console.log(`❌ Accessibility Issue: ${checkName} - ${details.details}`);
    } else {
      console.log(`✓ Accessibility Check Passed: ${checkName}`);
    }

    return check;
  }

  checkColorContrast(testName, foreground, background, minRatio = 4.5) {
    const luminance = (rgb) => {
      const [r, g, b] = rgb.match(/\d+/g).map(x => parseInt(x) / 255);
      const [rs, gs, bs] = [r, g, b].map(x =>
        x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)
      );
      return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
    };

    const l1 = luminance(foreground);
    const l2 = luminance(background);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    const ratio = (lighter + 0.05) / (darker + 0.05);

    const passed = ratio >= minRatio;

    return this.recordCheck(testName, 'Color Contrast', passed, {
      wcagLevel: 'AA',
      criterion: '1.4.3 Contrast (Minimum)',
      severity: passed ? 'none' : 'high',
      details: `Contrast ratio: ${ratio.toFixed(2)}:1 (required: ${minRatio}:1)`,
      remediation: 'Adjust foreground or background color to meet minimum contrast ratio'
    });
  }

  checkTextSize(testName, fontSize, minSize = 12) {
    const passed = fontSize >= minSize;

    return this.recordCheck(testName, 'Text Size', passed, {
      wcagLevel: 'AA',
      criterion: '1.4.4 Resize Text',
      severity: passed ? 'none' : 'medium',
      details: `Font size: ${fontSize}pt (minimum: ${minSize}pt)`,
      remediation: 'Increase font size to meet minimum requirements'
    });
  }

  checkTouchTargetSize(testName, width, height, minSize = 44) {
    const passed = width >= minSize && height >= minSize;

    return this.recordCheck(testName, 'Touch Target Size', passed, {
      wcagLevel: 'AAA',
      criterion: '2.5.5 Target Size',
      severity: passed ? 'none' : 'high',
      details: `Target size: ${width}x${height}pt (minimum: ${minSize}x${minSize}pt)`,
      remediation: 'Increase touch target size to meet minimum requirements'
    });
  }

  checkLabelPresence(testName, elementType, hasLabel) {
    return this.recordCheck(testName, `Label for ${elementType}`, hasLabel, {
      wcagLevel: 'A',
      criterion: '1.3.1 Info and Relationships',
      severity: hasLabel ? 'none' : 'high',
      details: `${elementType} ${hasLabel ? 'has' : 'missing'} associated label`,
      remediation: 'Add descriptive label to form element'
    });
  }

  checkImageAltText(testName, imageName, hasAltText, altText = '') {
    const passed = hasAltText && altText.length > 0;

    return this.recordCheck(testName, `Alt Text for ${imageName}`, passed, {
      wcagLevel: 'A',
      criterion: '1.1.1 Non-text Content',
      severity: passed ? 'none' : 'high',
      details: `Image "${imageName}" ${passed ? 'has' : 'missing'} alt text${passed ? `: "${altText}"` : ''}`,
      remediation: 'Provide meaningful alt text describing the image'
    });
  }

  checkHeadingStructure(testName, headings) {
    const isValid = this.validateHeadingHierarchy(headings);

    return this.recordCheck(testName, 'Heading Structure', isValid, {
      wcagLevel: 'A',
      criterion: '1.3.1 Info and Relationships',
      severity: isValid ? 'none' : 'medium',
      details: `Heading sequence: ${headings.join(' → ')} ${isValid ? '(valid)' : '(invalid - skips levels)'}`,
      remediation: 'Ensure headings follow proper hierarchy (H1, H2, H3, etc.)'
    });
  }

  validateHeadingHierarchy(headings) {
    if (headings.length === 0) return true;

    const levels = headings.map(h => parseInt(h.match(/\d+/)[0]));
    for (let i = 1; i < levels.length; i++) {
      if (levels[i] - levels[i - 1] > 1) {
        return false;
      }
    }
    return true;
  }

  checkKeyboardNavigation(testName, isNavigable) {
    return this.recordCheck(testName, 'Keyboard Navigation', isNavigable, {
      wcagLevel: 'A',
      criterion: '2.1.1 Keyboard',
      severity: isNavigable ? 'none' : 'critical',
      details: `All interactive elements ${isNavigable ? 'are' : 'are not'} keyboard accessible`,
      remediation: 'Ensure all interactive elements can be accessed via keyboard'
    });
  }

  checkFocusIndicator(testName, hasFocusIndicator) {
    return this.recordCheck(testName, 'Focus Indicator', hasFocusIndicator, {
      wcagLevel: 'AA',
      criterion: '2.4.7 Focus Visible',
      severity: hasFocusIndicator ? 'none' : 'high',
      details: `Focus indicator ${hasFocusIndicator ? 'is' : 'is not'} visible`,
      remediation: 'Ensure keyboard focus is visually indicated'
    });
  }

  checkColorNotAlone(testName, usesColorOnly) {
    const passed = !usesColorOnly;

    return this.recordCheck(testName, 'Color Not Alone', passed, {
      wcagLevel: 'A',
      criterion: '1.4.1 Use of Color',
      severity: passed ? 'none' : 'medium',
      details: `Information ${usesColorOnly ? 'relies solely on color' : 'uses additional visual cues'}`,
      remediation: 'Use additional visual cues beyond color to convey information'
    });
  }

  checkAnimationPreference(testName, respectsMotion) {
    return this.recordCheck(testName, 'Animation Preferences', respectsMotion, {
      wcagLevel: 'AAA',
      criterion: '2.3.3 Animation from Interactions',
      severity: respectsMotion ? 'none' : 'medium',
      details: `App ${respectsMotion ? 'respects' : 'ignores'} motion preferences`,
      remediation: 'Respect user motion preferences (prefers-reduced-motion)'
    });
  }

  checkLanguageDeclaration(testName, hasLanguage, language = '') {
    return this.recordCheck(testName, 'Language Declaration', hasLanguage, {
      wcagLevel: 'A',
      criterion: '3.1.1 Language of Page',
      severity: hasLanguage ? 'none' : 'medium',
      details: `Language ${hasLanguage ? `declared as: ${language}` : 'not declared'}`,
      remediation: 'Declare the primary language of the app'
    });
  }

  checkErrorMessages(testName, hasErrorMessages, errorClarity = 'clear') {
    const passed = hasErrorMessages && errorClarity === 'clear';

    return this.recordCheck(testName, 'Error Messages', passed, {
      wcagLevel: 'A',
      criterion: '3.3.1 Error Identification',
      severity: passed ? 'none' : 'high',
      details: `Error messages ${passed ? 'are clear and helpful' : 'are missing or unclear'}`,
      remediation: 'Provide clear, specific error messages that help users correct issues'
    });
  }

  checkFormLabels(testName, formFields) {
    const allLabeled = formFields.every(field => field.hasLabel);
    const details = `${formFields.filter(f => f.hasLabel).length}/${formFields.length} fields have labels`;

    return this.recordCheck(testName, 'Form Labels', allLabeled, {
      wcagLevel: 'A',
      criterion: '1.3.1 Info and Relationships',
      severity: allLabeled ? 'none' : 'high',
      details: details,
      remediation: 'Ensure all form fields have associated labels'
    });
  }

  checkTextAlternatives(testName, elements) {
    const allHaveAlternatives = elements.every(el => el.hasAlternative);
    const details = `${elements.filter(e => e.hasAlternative).length}/${elements.length} elements have text alternatives`;

    return this.recordCheck(testName, 'Text Alternatives', allHaveAlternatives, {
      wcagLevel: 'A',
      criterion: '1.1.1 Non-text Content',
      severity: allHaveAlternatives ? 'none' : 'high',
      details: details,
      remediation: 'Provide text alternatives for all non-text content'
    });
  }

  checkReadingOrder(testName, isLogical) {
    return this.recordCheck(testName, 'Reading Order', isLogical, {
      wcagLevel: 'A',
      criterion: '1.3.2 Meaningful Sequence',
      severity: isLogical ? 'none' : 'medium',
      details: `Reading order is ${isLogical ? 'logical and meaningful' : 'confusing or illogical'}`,
      remediation: 'Ensure content reading order is logical and meaningful'
    });
  }

  getAccessibilityScore() {
    if (this.checks.length === 0) {
      return 100;
    }

    const passedChecks = this.checks.filter(c => c.passed).length;
    return parseFloat(((passedChecks / this.checks.length) * 100).toFixed(2));
  }

  getIssuesBySeverity(severity) {
    return this.issues.filter(i => i.severity === severity);
  }

  getCriticalIssues() {
    return this.getIssuesBySeverity('critical');
  }

  getHighIssues() {
    return this.getIssuesBySeverity('high');
  }

  getMediumIssues() {
    return this.getIssuesBySeverity('medium');
  }

  getIssuesByTest(testName) {
    return this.issues.filter(i => i.testName === testName);
  }

  getIssuesByWCAGLevel(level) {
    return this.issues.filter(i => i.wcagLevel === level);
  }

  generateAccessibilityReport() {
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalChecks: this.checks.length,
        passedChecks: this.checks.filter(c => c.passed).length,
        failedChecks: this.issues.length,
        accessibilityScore: this.getAccessibilityScore(),
        wcagCompliance: {
          levelA: this.checks.filter(c => c.wcagLevel === 'A').length,
          levelAA: this.checks.filter(c => c.wcagLevel === 'AA').length,
          levelAAA: this.checks.filter(c => c.wcagLevel === 'AAA').length
        }
      },
      issues: {
        critical: this.getCriticalIssues().length,
        high: this.getHighIssues().length,
        medium: this.getMediumIssues().length
      },
      details: {
        allChecks: this.checks,
        issues: this.issues,
        recommendations: this.generateRecommendations()
      }
    };

    return report;
  }

  generateRecommendations() {
    const recommendations = [];

    const criticalIssues = this.getCriticalIssues();
    if (criticalIssues.length > 0) {
      recommendations.push({
        priority: 'critical',
        message: `${criticalIssues.length} critical accessibility issue(s) found. These must be fixed immediately.`,
        issues: criticalIssues.map(i => ({
          check: i.checkName,
          test: i.testName,
          remediation: i.remediation
        }))
      });
    }

    const highIssues = this.getHighIssues();
    if (highIssues.length > 0) {
      recommendations.push({
        priority: 'high',
        message: `${highIssues.length} high-priority accessibility issue(s) found. These should be addressed soon.`,
        issues: highIssues.map(i => ({
          check: i.checkName,
          test: i.testName,
          remediation: i.remediation
        }))
      });
    }

    const score = this.getAccessibilityScore();
    if (score < 80) {
      recommendations.push({
        priority: 'medium',
        message: `Accessibility score is ${score}%. Target 95%+ for WCAG AA compliance.`,
        action: 'Review and fix remaining accessibility issues'
      });
    }

    return recommendations;
  }

  exportAccessibilityReport(filename = 'accessibility-report.json') {
    const report = this.generateAccessibilityReport();
    const filepath = path.join(this.reportDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`✓ Accessibility report exported to: ${filepath}`);
    return filepath;
  }

  generateAccessibilitySummary() {
    const report = this.generateAccessibilityReport();
    const score = report.summary.accessibilityScore;

    const summary = `
=== ACCESSIBILITY TEST SUMMARY ===
Accessibility Score: ${score}%

Checks Performed: ${report.summary.totalChecks}
  ✓ Passed: ${report.summary.passedChecks}
  ✗ Failed: ${report.summary.failedChecks}

Issues by Severity:
  🔴 Critical: ${report.issues.critical}
  🟠 High: ${report.issues.high}
  🟡 Medium: ${report.issues.medium}

WCAG Compliance:
  Level A: ${report.summary.wcagCompliance.levelA} checks
  Level AA: ${report.summary.wcagCompliance.levelAA} checks
  Level AAA: ${report.summary.wcagCompliance.levelAAA} checks

${report.details.recommendations.length > 0 ? 'Recommendations:\n' + report.details.recommendations.map((r, i) => `  ${i + 1}. [${r.priority.toUpperCase()}] ${r.message}`).join('\n') : 'No recommendations - all checks passed!'}
    `;

    return summary;
  }

  clear() {
    this.issues = [];
    this.checks = [];
    console.log('✓ Accessibility tester cleared');
  }

  getCheckCount() {
    return this.checks.length;
  }

  getIssueCount() {
    return this.issues.length;
  }

  hasIssues() {
    return this.issues.length > 0;
  }

  hasCriticalIssues() {
    return this.getCriticalIssues().length > 0;
  }
}

module.exports = AccessibilityTester;
