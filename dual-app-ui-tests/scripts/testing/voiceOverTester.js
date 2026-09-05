/**
 * VoiceOver Accessibility Testing Module
 * Validates screen reader compatibility and announcements for iOS accessibility
 * Supports WCAG 2.1 Level AA/AAA compliance for assistive technology
 */

class VoiceOverTester {
  constructor(outputDir = './test-reports') {
    this.outputDir = outputDir;
    this.checks = [];
    this.issues = [];
  }

  /**
   * Check element accessibility label
   * Validates that elements have proper labels for VoiceOver announcement
   * WCAG 1.3.1 - Info and Relationships
   */
  checkAccessibilityLabel(testName, elementId, hasLabel, expectedLabel) {
    const check = {
      testName,
      checkType: 'Accessibility Label',
      elementId,
      wcagCriteria: '1.3.1',
      wcagLevel: 'A',
      severity: 'critical',
      passed: hasLabel,
      details: {
        hasLabel,
        expectedLabel,
        message: hasLabel 
          ? `✓ Element "${elementId}" has accessibility label: "${expectedLabel}"`
          : `✗ Element "${elementId}" missing accessibility label`
      }
    };

    this.checks.push(check);
    if (!hasLabel) {
      this.issues.push({
        ...check,
        remediation: `Add accessibility label to element "${elementId}" with descriptive text`
      });
    }
    return check;
  }

  /**
   * Check element accessibility traits
   * Validates that elements declare proper traits (button, link, header, etc.)
   * WCAG 1.3.1 - Info and Relationships
   */
  checkAccessibilityTraits(testName, elementId, expectedTraits, actualTraits) {
    const hasAllTraits = expectedTraits.every(trait => actualTraits.includes(trait));
    const check = {
      testName,
      checkType: 'Accessibility Traits',
      elementId,
      wcagCriteria: '1.3.1',
      wcagLevel: 'A',
      severity: 'high',
      passed: hasAllTraits,
      details: {
        expectedTraits,
        actualTraits,
        message: hasAllTraits
          ? `✓ Element "${elementId}" has correct traits: ${actualTraits.join(', ')}`
          : `✗ Element "${elementId}" missing traits: ${expectedTraits.filter(t => !actualTraits.includes(t)).join(', ')}`
      }
    };

    this.checks.push(check);
    if (!hasAllTraits) {
      this.issues.push({
        ...check,
        remediation: `Add missing traits to element "${elementId}": ${expectedTraits.filter(t => !actualTraits.includes(t)).join(', ')}`
      });
    }
    return check;
  }

  /**
   * Check element accessibility hint
   * Validates that complex elements have hints for VoiceOver users
   * WCAG 2.5.4 - Target Size (Enhanced)
   */
  checkAccessibilityHint(testName, elementId, hasHint, hintText) {
    const check = {
      testName,
      checkType: 'Accessibility Hint',
      elementId,
      wcagCriteria: '2.5.4',
      wcagLevel: 'AAA',
      severity: 'medium',
      passed: hasHint,
      details: {
        hasHint,
        hintText,
        message: hasHint
          ? `✓ Element "${elementId}" has accessibility hint: "${hintText}"`
          : `✗ Element "${elementId}" missing accessibility hint`
      }
    };

    this.checks.push(check);
    if (!hasHint) {
      this.issues.push({
        ...check,
        remediation: `Add accessibility hint to element "${elementId}" to explain how to interact with it`
      });
    }
    return check;
  }

  /**
   * Check VoiceOver navigation order
   * Validates that elements are announced in logical reading order
   * WCAG 1.3.2 - Meaningful Sequence
   */
  checkNavigationOrder(testName, elementIds, isLogical) {
    const check = {
      testName,
      checkType: 'Navigation Order',
      wcagCriteria: '1.3.2',
      wcagLevel: 'A',
      severity: 'high',
      passed: isLogical,
      details: {
        elementCount: elementIds.length,
        elements: elementIds,
        message: isLogical
          ? `✓ VoiceOver navigation order is logical for ${elementIds.length} elements`
          : `✗ VoiceOver navigation order is not logical`
      }
    };

    this.checks.push(check);
    if (!isLogical) {
      this.issues.push({
        ...check,
        remediation: `Adjust accessibilityElements order to match visual reading order: ${elementIds.join(' → ')}`
      });
    }
    return check;
  }

  /**
   * Check custom actions for VoiceOver
   * Validates that custom actions are properly defined and announced
   * WCAG 2.1.1 - Keyboard
   */
  checkCustomActions(testName, elementId, expectedActions, actualActions) {
    const hasAllActions = expectedActions.every(action => 
      actualActions.some(a => a.name === action.name)
    );

    const check = {
      testName,
      checkType: 'Custom Actions',
      elementId,
      wcagCriteria: '2.1.1',
      wcagLevel: 'A',
      severity: 'high',
      passed: hasAllActions,
      details: {
        expectedActions: expectedActions.map(a => a.name),
        actualActions: actualActions.map(a => a.name),
        message: hasAllActions
          ? `✓ Element "${elementId}" has all custom actions: ${actualActions.map(a => a.name).join(', ')}`
          : `✗ Element "${elementId}" missing actions: ${expectedActions.filter(e => !actualActions.some(a => a.name === e.name)).map(a => a.name).join(', ')}`
      }
    };

    this.checks.push(check);
    if (!hasAllActions) {
      this.issues.push({
        ...check,
        remediation: `Add missing custom actions to element "${elementId}"`
      });
    }
    return check;
  }

  /**
   * Check dynamic content announcements
   * Validates that dynamic content changes are announced to VoiceOver
   * WCAG 4.1.3 - Status Messages
   */
  checkDynamicAnnouncements(testName, elementId, shouldAnnounce, announcementText) {
    const check = {
      testName,
      checkType: 'Dynamic Announcements',
      elementId,
      wcagCriteria: '4.1.3',
      wcagLevel: 'AA',
      severity: 'high',
      passed: shouldAnnounce,
      details: {
        shouldAnnounce,
        announcementText,
        message: shouldAnnounce
          ? `✓ Dynamic content in "${elementId}" is announced: "${announcementText}"`
          : `✗ Dynamic content in "${elementId}" is not announced to VoiceOver`
      }
    };

    this.checks.push(check);
    if (!shouldAnnounce) {
      this.issues.push({
        ...check,
        remediation: `Add UIAccessibilityPostNotification to announce changes in "${elementId}"`
      });
    }
    return check;
  }

  /**
   * Check rotor support
   * Validates that elements are properly categorized for VoiceOver rotor
   * WCAG 1.3.1 - Info and Relationships
   */
  checkRotorSupport(testName, rotorCategories, supportedCategories) {
    const allSupported = rotorCategories.every(cat => supportedCategories.includes(cat));
    
    const check = {
      testName,
      checkType: 'Rotor Support',
      wcagCriteria: '1.3.1',
      wcagLevel: 'AA',
      severity: 'medium',
      passed: allSupported,
      details: {
        requestedCategories: rotorCategories,
        supportedCategories,
        message: allSupported
          ? `✓ All rotor categories are supported: ${supportedCategories.join(', ')}`
          : `✗ Missing rotor categories: ${rotorCategories.filter(c => !supportedCategories.includes(c)).join(', ')}`
      }
    };

    this.checks.push(check);
    if (!allSupported) {
      this.issues.push({
        ...check,
        remediation: `Implement rotor support for: ${rotorCategories.filter(c => !supportedCategories.includes(c)).join(', ')}`
      });
    }
    return check;
  }

  /**
   * Check form field accessibility
   * Validates that form fields have proper labels and hints for VoiceOver
   * WCAG 1.3.1 - Info and Relationships
   */
  checkFormFieldAccessibility(testName, formFields) {
    const results = [];
    let allPassed = true;

    formFields.forEach(field => {
      const hasLabel = field.hasLabel !== false;
      const hasValue = field.hasValue !== false;
      const passed = hasLabel && hasValue;

      if (!passed) allPassed = false;

      results.push({
        fieldName: field.name,
        hasLabel,
        hasValue,
        passed,
        message: passed
          ? `✓ Form field "${field.name}" is properly accessible`
          : `✗ Form field "${field.name}" missing: ${!hasLabel ? 'label' : ''} ${!hasValue ? 'value' : ''}`
      });
    });

    const check = {
      testName,
      checkType: 'Form Field Accessibility',
      wcagCriteria: '1.3.1',
      wcagLevel: 'A',
      severity: 'critical',
      passed: allPassed,
      details: {
        totalFields: formFields.length,
        passedFields: results.filter(r => r.passed).length,
        results,
        message: allPassed
          ? `✓ All ${formFields.length} form fields are accessible`
          : `✗ ${results.filter(r => !r.passed).length} form fields have accessibility issues`
      }
    };

    this.checks.push(check);
    if (!allPassed) {
      results.filter(r => !r.passed).forEach(result => {
        this.issues.push({
          ...check,
          elementId: result.fieldName,
          remediation: `Fix form field "${result.fieldName}": ${result.message}`
        });
      });
    }
    return check;
  }

  /**
   * Check image accessibility for VoiceOver
   * Validates that images have proper alt text or are marked as decorative
   * WCAG 1.1.1 - Non-text Content
   */
  checkImageAccessibility(testName, images) {
    const results = [];
    let allPassed = true;

    images.forEach(image => {
      const isAccessible = image.isDecorative || (image.hasAltText && image.altText);
      if (!isAccessible) allPassed = false;

      results.push({
        imageName: image.name,
        isDecorative: image.isDecorative,
        hasAltText: image.hasAltText,
        altText: image.altText,
        passed: isAccessible,
        message: isAccessible
          ? `✓ Image "${image.name}" is accessible`
          : `✗ Image "${image.name}" missing alt text or decorative marking`
      });
    });

    const check = {
      testName,
      checkType: 'Image Accessibility',
      wcagCriteria: '1.1.1',
      wcagLevel: 'A',
      severity: 'high',
      passed: allPassed,
      details: {
        totalImages: images.length,
        accessibleImages: results.filter(r => r.passed).length,
        results,
        message: allPassed
          ? `✓ All ${images.length} images are accessible`
          : `✗ ${results.filter(r => !r.passed).length} images need alt text`
      }
    };

    this.checks.push(check);
    if (!allPassed) {
      results.filter(r => !r.passed).forEach(result => {
        this.issues.push({
          ...check,
          elementId: result.imageName,
          remediation: `Add alt text to image "${result.imageName}" or mark as decorative`
        });
      });
    }
    return check;
  }

  /**
   * Check heading accessibility for VoiceOver
   * Validates that headings are properly marked and announced
   * WCAG 1.3.1 - Info and Relationships
   */
  checkHeadingAccessibility(testName, headings) {
    const results = [];
    let allPassed = true;

    headings.forEach((heading, index) => {
      const isProperlyMarked = heading.isMarkedAsHeading !== false;
      const hasProperLevel = heading.level && heading.level > 0;
      const passed = isProperlyMarked && hasProperLevel;

      if (!passed) allPassed = false;

      results.push({
        headingText: heading.text,
        level: heading.level,
        isMarkedAsHeading: isProperlyMarked,
        passed,
        message: passed
          ? `✓ Heading "${heading.text}" is properly marked as H${heading.level}`
          : `✗ Heading "${heading.text}" not properly marked for VoiceOver`
      });
    });

    const check = {
      testName,
      checkType: 'Heading Accessibility',
      wcagCriteria: '1.3.1',
      wcagLevel: 'A',
      severity: 'high',
      passed: allPassed,
      details: {
        totalHeadings: headings.length,
        properHeadings: results.filter(r => r.passed).length,
        results,
        message: allPassed
          ? `✓ All ${headings.length} headings are properly marked`
          : `✗ ${results.filter(r => !r.passed).length} headings need proper marking`
      }
    };

    this.checks.push(check);
    if (!allPassed) {
      results.filter(r => !r.passed).forEach(result => {
        this.issues.push({
          ...check,
          elementId: result.headingText,
          remediation: `Mark "${result.headingText}" as heading with proper level`
        });
      });
    }
    return check;
  }

  /**
   * Check button accessibility for VoiceOver
   * Validates that buttons have proper labels and are announced correctly
   * WCAG 1.3.1 - Info and Relationships
   */
  checkButtonAccessibility(testName, buttons) {
    const results = [];
    let allPassed = true;

    buttons.forEach(button => {
      const hasLabel = button.hasLabel !== false;
      const isMarkedAsButton = button.isMarkedAsButton !== false;
      const passed = hasLabel && isMarkedAsButton;

      if (!passed) allPassed = false;

      results.push({
        buttonName: button.name,
        hasLabel,
        isMarkedAsButton,
        passed,
        message: passed
          ? `✓ Button "${button.name}" is properly accessible`
          : `✗ Button "${button.name}" missing: ${!hasLabel ? 'label' : ''} ${!isMarkedAsButton ? 'button trait' : ''}`
      });
    });

    const check = {
      testName,
      checkType: 'Button Accessibility',
      wcagCriteria: '1.3.1',
      wcagLevel: 'A',
      severity: 'critical',
      passed: allPassed,
      details: {
        totalButtons: buttons.length,
        accessibleButtons: results.filter(r => r.passed).length,
        results,
        message: allPassed
          ? `✓ All ${buttons.length} buttons are accessible`
          : `✗ ${results.filter(r => !r.passed).length} buttons need fixes`
      }
    };

    this.checks.push(check);
    if (!allPassed) {
      results.filter(r => !r.passed).forEach(result => {
        this.issues.push({
          ...check,
          elementId: result.buttonName,
          remediation: `Fix button "${result.buttonName}": ${result.message}`
        });
      });
    }
    return check;
  }

  /**
   * Check link accessibility for VoiceOver
   * Validates that links have proper labels and are announced correctly
   * WCAG 1.3.1 - Info and Relationships
   */
  checkLinkAccessibility(testName, links) {
    const results = [];
    let allPassed = true;

    links.forEach(link => {
      const hasLabel = link.hasLabel !== false;
      const isMarkedAsLink = link.isMarkedAsLink !== false;
      const passed = hasLabel && isMarkedAsLink;

      if (!passed) allPassed = false;

      results.push({
        linkName: link.name,
        hasLabel,
        isMarkedAsLink,
        passed,
        message: passed
          ? `✓ Link "${link.name}" is properly accessible`
          : `✗ Link "${link.name}" missing: ${!hasLabel ? 'label' : ''} ${!isMarkedAsLink ? 'link trait' : ''}`
      });
    });

    const check = {
      testName,
      checkType: 'Link Accessibility',
      wcagCriteria: '1.3.1',
      wcagLevel: 'A',
      severity: 'high',
      passed: allPassed,
      details: {
        totalLinks: links.length,
        accessibleLinks: results.filter(r => r.passed).length,
        results,
        message: allPassed
          ? `✓ All ${links.length} links are accessible`
          : `✗ ${results.filter(r => !r.passed).length} links need fixes`
      }
    };

    this.checks.push(check);
    if (!allPassed) {
      results.filter(r => !r.passed).forEach(result => {
        this.issues.push({
          ...check,
          elementId: result.linkName,
          remediation: `Fix link "${result.linkName}": ${result.message}`
        });
      });
    }
    return check;
  }

  /**
   * Generate VoiceOver accessibility summary
   */
  generateVoiceOverSummary() {
    const totalChecks = this.checks.length;
    const passedChecks = this.checks.filter(c => c.passed).length;
    const failedChecks = totalChecks - passedChecks;
    // Return 100 if no checks have been run yet (not 0), or calculate actual score
    const score = totalChecks === 0 ? 100 : Math.round((passedChecks / totalChecks) * 100);

    const criticalIssues = this.issues.filter(i => i.severity === 'critical').length;
    const highIssues = this.issues.filter(i => i.severity === 'high').length;
    const mediumIssues = this.issues.filter(i => i.severity === 'medium').length;

    return {
      timestamp: new Date().toISOString(),
      summary: {
        totalChecks,
        passedChecks,
        failedChecks,
        voiceOverScore: score,
        wcagCompliance: {
          levelA: this.checks.filter(c => c.wcagLevel === 'A').length,
          levelAA: this.checks.filter(c => c.wcagLevel === 'AA').length,
          levelAAA: this.checks.filter(c => c.wcagLevel === 'AAA').length
        }
      },
      issues: {
        critical: criticalIssues,
        high: highIssues,
        medium: mediumIssues
      },
      details: {
        allChecks: this.checks,
        issues: this.issues,
        recommendations: this.generateRecommendations()
      }
    };
  }

  /**
   * Generate recommendations based on issues found
   */
  generateRecommendations() {
    const recommendations = [];
    const criticalIssues = this.issues.filter(i => i.severity === 'critical').length;
    const highIssues = this.issues.filter(i => i.severity === 'high').length;

    if (criticalIssues > 0) {
      recommendations.push({
        priority: 'CRITICAL',
        count: criticalIssues,
        message: `${criticalIssues} critical VoiceOver accessibility issue(s) found. These must be fixed immediately.`
      });
    }

    if (highIssues > 0) {
      recommendations.push({
        priority: 'HIGH',
        count: highIssues,
        message: `${highIssues} high-priority VoiceOver accessibility issue(s) found. These should be addressed soon.`
      });
    }

    const score = this.checks.length > 0 
      ? Math.round((this.checks.filter(c => c.passed).length / this.checks.length) * 100)
      : 0;

    if (score < 95) {
      recommendations.push({
        priority: 'MEDIUM',
        count: 1,
        message: `VoiceOver accessibility score is ${score}%. Target 95%+ for WCAG AA compliance.`
      });
    }

    return recommendations;
  }

  /**
   * Export VoiceOver report to JSON
   */
  exportVoiceOverReport(filename = 'voiceover-report.json') {
    const fs = require('fs');
    const path = require('path');
    const reportPath = path.join(this.outputDir, filename);
    const report = this.generateVoiceOverSummary();

    try {
      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`✓ VoiceOver report exported to ${reportPath}`);
      return reportPath;
    } catch (error) {
      console.error(`✗ Failed to export VoiceOver report: ${error.message}`);
      return null;
    }
  }

  /**
   * Print VoiceOver test results to console
   */
  printVoiceOverResults() {
    const summary = this.generateVoiceOverSummary();
    const { summary: s, issues: i, details: d } = summary;

    console.log('\n♿ VoiceOver Accessibility Testing Results\n');
    console.log(`VoiceOver Score: ${s.voiceOverScore}%`);
    console.log(`Total Checks: ${s.totalChecks}`);
    console.log(`🔴 Critical: ${i.critical}`);
    console.log(`🟠 High: ${i.high}`);
    console.log(`🟡 Medium: ${i.medium}\n`);

    if (d.issues.length === 0) {
      console.log('✓ No VoiceOver accessibility issues found! All checks passed.\n');
    } else {
      console.log('VoiceOver Accessibility Issues:\n');
      d.issues.forEach((issue, index) => {
        console.log(`${index + 1}. ${issue.checkType} [${issue.severity.toUpperCase()}]`);
        console.log(`   Element: ${issue.elementId || 'N/A'}`);
        console.log(`   WCAG: ${issue.wcagCriteria} (Level ${issue.wcagLevel})`);
        console.log(`   Issue: ${issue.details.message}`);
        console.log(`   Fix: ${issue.remediation}\n`);
      });
    }

    console.log('WCAG Compliance Levels:');
    console.log(`Level A: ${s.wcagCompliance.levelA} checks`);
    console.log(`Level AA: ${s.wcagCompliance.levelAA} checks`);
    console.log(`Level AAA: ${s.wcagCompliance.levelAAA} checks\n`);

    if (d.recommendations.length > 0) {
      console.log('Recommendations:\n');
      d.recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. [${rec.priority}] ${rec.message}`);
      });
    }
  }
}

module.exports = VoiceOverTester;
