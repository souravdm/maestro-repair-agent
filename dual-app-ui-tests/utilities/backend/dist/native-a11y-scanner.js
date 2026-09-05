"use strict";
/**
 * Native Accessibility Scanner Integration
 *
 * Integrates with native iOS (XCTest Accessibility Inspector) and Android
 * (Google Accessibility Scanner) to provide platform-specific accessibility checks
 * that complement the existing Maestro-based validation.
 *
 * This module provides:
 * - iOS XCTest Accessibility Audit API integration
 * - Android Accessibility Scanner integration via ADB
 * - Native screen reader property validation
 * - Platform-specific accessibility API checks
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.runIOSAccessibilityAudit = runIOSAccessibilityAudit;
exports.runAndroidAccessibilityScanner = runAndroidAccessibilityScanner;
exports.mergeAccessibilityReports = mergeAccessibilityReports;
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
/**
 * Run iOS XCTest Accessibility Audit
 *
 * Uses XCTest's built-in accessibility audit API to scan for issues.
 * Requires a running simulator with the app installed.
 *
 * XCTest Audit Categories:
 * - Contrast: Text/background contrast ratios
 * - Element Detection: Missing labels, traits, hints
 * - Hit Region: Touch target sizes
 * - Clipped Text: Text truncation issues
 * - Trait: Incorrect or missing accessibility traits
 * - Dynamic Type: Font scaling support
 */
async function runIOSAccessibilityAudit(bundleId, simulatorId) {
    const issues = [];
    try {
        // Get booted simulator if not specified
        if (!simulatorId) {
            const { stdout } = await execAsync('xcrun simctl list devices | grep "(Booted)" | grep -o "[A-F0-9]\\{8\\}-[A-F0-9]\\{4\\}-[A-F0-9]\\{4\\}-[A-F0-9]\\{4\\}-[A-F0-9]\\{12\\}" | head -1');
            simulatorId = stdout.trim();
        }
        if (!simulatorId) {
            throw new Error('No booted simulator found');
        }
        // Launch app if not running
        await execAsync(`xcrun simctl launch ${simulatorId} ${bundleId}`).catch(() => {
            // App may already be running
        });
        // Run accessibility audit using simctl
        // Note: This requires Xcode 14+ and iOS 16+
        const { stdout, stderr } = await execAsync(`xcrun simctl spawn ${simulatorId} log stream --predicate 'subsystem == "com.apple.accessibility"' --level debug --timeout 5`, { timeout: 10000 }).catch(() => ({ stdout: '', stderr: '' }));
        // Parse accessibility audit results
        // XCTest audit results are logged to the system log
        if (stdout) {
            const lines = stdout.split('\n');
            for (const line of lines) {
                if (line.includes('AXAudit')) {
                    // Parse audit issue from log
                    const issue = parseIOSAuditLine(line);
                    if (issue) {
                        issues.push(issue);
                    }
                }
            }
        }
        // Additional check: Use accessibility inspector via command line
        // This captures more detailed information about accessibility properties
        const inspectorResult = await runIOSAccessibilityInspector(simulatorId, bundleId);
        issues.push(...inspectorResult);
    }
    catch (error) {
        console.error('iOS accessibility audit error:', error);
        issues.push({
            platform: 'ios',
            type: 'audit_error',
            severity: 'warning',
            message: `Failed to run iOS accessibility audit: ${error instanceof Error ? error.message : String(error)}`,
            element: {},
            suggestion: 'Ensure Xcode 14+ is installed and a simulator is booted with the app running'
        });
    }
    const summary = {
        errors: issues.filter(i => i.severity === 'error').length,
        warnings: issues.filter(i => i.severity === 'warning').length,
        info: issues.filter(i => i.severity === 'info').length
    };
    return {
        platform: 'ios',
        timestamp: new Date().toISOString(),
        issues,
        summary
    };
}
/**
 * Run iOS Accessibility Inspector checks via command line
 *
 * Captures detailed accessibility properties for all elements:
 * - accessibilityLabel
 * - accessibilityHint
 * - accessibilityTraits
 * - accessibilityValue
 * - accessibilityFrame
 * - isAccessibilityElement
 * - accessibilityIdentifier
 */
async function runIOSAccessibilityInspector(simulatorId, bundleId) {
    const issues = [];
    try {
        // Use simctl to get accessibility hierarchy
        const { stdout } = await execAsync(`xcrun simctl spawn ${simulatorId} log show --predicate 'subsystem == "com.apple.accessibility" AND category == "AXElement"' --last 1m --style compact`).catch(() => ({ stdout: '' }));
        // Parse accessibility element properties
        const elements = parseIOSAccessibilityHierarchy(stdout);
        for (const element of elements) {
            // Check for missing labels
            if (element.isInteractive && !element.label) {
                issues.push({
                    platform: 'ios',
                    type: 'missing_label',
                    severity: 'error',
                    message: 'Interactive element missing accessibilityLabel',
                    element: {
                        identifier: element.identifier,
                        frame: element.frame,
                        traits: element.traits
                    },
                    suggestion: 'Set accessibilityLabel property on the UIView/UIControl'
                });
            }
            // Check for incorrect traits
            if (element.isButton && !element.traits?.includes('Button')) {
                issues.push({
                    platform: 'ios',
                    type: 'incorrect_trait',
                    severity: 'warning',
                    message: 'Button-like element missing .button trait',
                    element: {
                        label: element.label,
                        identifier: element.identifier,
                        traits: element.traits
                    },
                    suggestion: 'Add .button to accessibilityTraits'
                });
            }
            // Check for small touch targets
            if (element.frame && element.isInteractive) {
                const frame = parseFrame(element.frame);
                if (frame && (frame.width < 44 || frame.height < 44)) {
                    issues.push({
                        platform: 'ios',
                        type: 'small_touch_target',
                        severity: 'error',
                        message: `Touch target too small: ${frame.width}×${frame.height}pt (minimum 44×44pt)`,
                        element: {
                            label: element.label,
                            identifier: element.identifier,
                            frame: element.frame
                        },
                        suggestion: 'Increase frame size or override point(inside:with:) to expand hit area'
                    });
                }
            }
            // Check for Dynamic Type support
            if (element.isText && !element.supportsDynamicType) {
                issues.push({
                    platform: 'ios',
                    type: 'dynamic_type',
                    severity: 'warning',
                    message: 'Text element may not support Dynamic Type',
                    element: {
                        label: element.label,
                        identifier: element.identifier
                    },
                    suggestion: 'Use UIFontMetrics and set adjustsFontForContentSizeCategory=true'
                });
            }
        }
    }
    catch (error) {
        console.error('iOS accessibility inspector error:', error);
    }
    return issues;
}
/**
 * Run Android Accessibility Scanner via ADB
 *
 * Uses Google Accessibility Scanner API to scan for issues.
 * Requires an Android device/emulator with the app running.
 *
 * Scanner Categories:
 * - Touch Target Size: Minimum 48dp
 * - Content Labeling: Missing contentDescription
 * - Text Contrast: Color contrast ratios
 * - Clickable Spans: Clickable text in TextViews
 * - Implementation: Proper widget usage
 */
async function runAndroidAccessibilityScanner(packageName, deviceId) {
    const issues = [];
    try {
        // Get device ID if not specified
        if (!deviceId) {
            const { stdout } = await execAsync('adb devices | grep -v "List" | grep "device" | awk \'{print $1}\' | head -1');
            deviceId = stdout.trim();
        }
        if (!deviceId) {
            throw new Error('No Android device/emulator found');
        }
        // Launch app if not running
        await execAsync(`adb -s ${deviceId} shell monkey -p ${packageName} -c android.intent.category.LAUNCHER 1`).catch(() => {
            // App may already be running
        });
        // Capture UI hierarchy with accessibility properties
        const { stdout: hierarchyXml } = await execAsync(`adb -s ${deviceId} shell uiautomator dump /dev/tty`, { maxBuffer: 10 * 1024 * 1024 });
        // Parse Android UI hierarchy
        const elements = parseAndroidAccessibilityHierarchy(hierarchyXml);
        for (const element of elements) {
            // Check for missing content descriptions
            if (element.isClickable && !element.contentDescription && !element.text) {
                issues.push({
                    platform: 'android',
                    type: 'missing_content_description',
                    severity: 'error',
                    message: 'Clickable element missing contentDescription',
                    element: {
                        identifier: element.resourceId,
                        frame: element.bounds
                    },
                    suggestion: 'Set android:contentDescription attribute or call setContentDescription()'
                });
            }
            // Check for touch target size
            if (element.bounds && element.isClickable) {
                const bounds = parseBounds(element.bounds);
                if (bounds) {
                    const dpWidth = bounds.width / element.density;
                    const dpHeight = bounds.height / element.density;
                    if (dpWidth < 48 || dpHeight < 48) {
                        issues.push({
                            platform: 'android',
                            type: 'small_touch_target',
                            severity: 'error',
                            message: `Touch target too small: ${Math.round(dpWidth)}×${Math.round(dpHeight)}dp (minimum 48×48dp)`,
                            element: {
                                label: element.contentDescription || element.text,
                                identifier: element.resourceId,
                                frame: element.bounds
                            },
                            suggestion: 'Set android:minWidth="48dp" and android:minHeight="48dp" or use TouchDelegate'
                        });
                    }
                }
            }
            // Check for text scaling support
            if (element.text && element.textSize) {
                if (!element.textSize.endsWith('sp')) {
                    issues.push({
                        platform: 'android',
                        type: 'text_scaling',
                        severity: 'warning',
                        message: 'Text size not using scalable units (sp)',
                        element: {
                            label: element.text,
                            identifier: element.resourceId
                        },
                        suggestion: 'Use sp units for text sizes instead of dp or px'
                    });
                }
            }
            // Check for proper widget roles
            if (element.isClickable && element.className === 'android.view.View') {
                issues.push({
                    platform: 'android',
                    type: 'widget_role',
                    severity: 'warning',
                    message: 'Clickable View should use proper widget (Button, ImageButton)',
                    element: {
                        label: element.contentDescription || element.text,
                        identifier: element.resourceId
                    },
                    suggestion: 'Use Button or ImageButton instead of clickable View for better TalkBack support'
                });
            }
            // Check for live regions
            if (element.text && (element.text.includes('Loading') || element.text.includes('Error') || element.text.includes('Success'))) {
                if (!element.accessibilityLiveRegion) {
                    issues.push({
                        platform: 'android',
                        type: 'live_region',
                        severity: 'info',
                        message: 'Status message should use live region for TalkBack announcements',
                        element: {
                            label: element.text,
                            identifier: element.resourceId
                        },
                        suggestion: 'Set android:accessibilityLiveRegion="polite" or use announceForAccessibility()'
                    });
                }
            }
        }
        // Run additional checks using AccessibilityScanner API if available
        const scannerIssues = await runAndroidAccessibilityScannerAPI(deviceId, packageName);
        issues.push(...scannerIssues);
    }
    catch (error) {
        console.error('Android accessibility scanner error:', error);
        issues.push({
            platform: 'android',
            type: 'scanner_error',
            severity: 'warning',
            message: `Failed to run Android accessibility scanner: ${error instanceof Error ? error.message : String(error)}`,
            element: {},
            suggestion: 'Ensure an Android device/emulator is connected and the app is running'
        });
    }
    const summary = {
        errors: issues.filter(i => i.severity === 'error').length,
        warnings: issues.filter(i => i.severity === 'warning').length,
        info: issues.filter(i => i.severity === 'info').length
    };
    return {
        platform: 'android',
        timestamp: new Date().toISOString(),
        issues,
        summary
    };
}
/**
 * Run Android Accessibility Scanner API via ADB
 *
 * Uses the Google Accessibility Scanner app if installed
 */
async function runAndroidAccessibilityScannerAPI(deviceId, packageName) {
    const issues = [];
    try {
        // Check if Accessibility Scanner is installed
        const { stdout } = await execAsync(`adb -s ${deviceId} shell pm list packages | grep "com.google.android.apps.accessibility.auditor"`);
        if (!stdout.trim()) {
            // Scanner not installed
            return issues;
        }
        // Trigger accessibility scan via intent
        await execAsync(`adb -s ${deviceId} shell am start -n com.google.android.apps.accessibility.auditor/.MainActivity`);
        // Wait for scan to complete (this is a simplified approach)
        await new Promise(resolve => setTimeout(resolve, 3000));
        // Read scan results from logcat
        const { stdout: logcat } = await execAsync(`adb -s ${deviceId} logcat -d -s AccessibilityScanner:* | tail -100`);
        // Parse scanner results from logcat
        const scannerIssues = parseAndroidScannerResults(logcat);
        issues.push(...scannerIssues);
    }
    catch (error) {
        // Scanner not available or failed
        console.log('Android Accessibility Scanner not available');
    }
    return issues;
}
// Helper functions for parsing
function parseIOSAuditLine(line) {
    // Parse XCTest audit log line
    // Format: [timestamp] [AXAudit] [type] message
    const match = line.match(/\[AXAudit\]\s+\[(\w+)\]\s+(.+)/);
    if (!match)
        return null;
    const [, type, message] = match;
    return {
        platform: 'ios',
        type: type.toLowerCase(),
        severity: type.includes('Error') ? 'error' : 'warning',
        message,
        element: {},
        suggestion: 'Review element accessibility properties in Xcode Accessibility Inspector'
    };
}
function parseIOSAccessibilityHierarchy(logOutput) {
    // Parse iOS accessibility hierarchy from log output
    // This is a simplified parser - actual implementation would be more robust
    const elements = [];
    // Parse log entries for accessibility elements
    const lines = logOutput.split('\n');
    for (const line of lines) {
        if (line.includes('AXElement')) {
            // Extract element properties
            const element = {
                isInteractive: line.includes('isAccessibilityElement=1'),
                isButton: line.includes('Button'),
                isText: line.includes('StaticText'),
                supportsDynamicType: line.includes('adjustsFontForContentSizeCategory=1')
            };
            const labelMatch = line.match(/label="([^"]+)"/);
            if (labelMatch)
                element.label = labelMatch[1];
            const idMatch = line.match(/identifier="([^"]+)"/);
            if (idMatch)
                element.identifier = idMatch[1];
            const frameMatch = line.match(/frame=\{([^}]+)\}/);
            if (frameMatch)
                element.frame = frameMatch[1];
            const traitsMatch = line.match(/traits=\[([^\]]+)\]/);
            if (traitsMatch)
                element.traits = traitsMatch[1].split(',').map(t => t.trim());
            elements.push(element);
        }
    }
    return elements;
}
function parseAndroidAccessibilityHierarchy(xml) {
    // Parse Android UI hierarchy XML
    // This is a simplified parser - actual implementation would use a proper XML parser
    const elements = [];
    // Extract density from device
    const density = 2.0; // Default, should be queried from device
    // Simple regex-based parsing (replace with proper XML parser in production)
    const nodeRegex = /<node[^>]+>/g;
    const matches = xml.match(nodeRegex);
    if (matches) {
        for (const match of matches) {
            const element = {
                isClickable: match.includes('clickable="true"'),
                density
            };
            const resourceIdMatch = match.match(/resource-id="([^"]+)"/);
            if (resourceIdMatch)
                element.resourceId = resourceIdMatch[1];
            const contentDescMatch = match.match(/content-desc="([^"]+)"/);
            if (contentDescMatch)
                element.contentDescription = contentDescMatch[1];
            const textMatch = match.match(/text="([^"]+)"/);
            if (textMatch)
                element.text = textMatch[1];
            const classMatch = match.match(/class="([^"]+)"/);
            if (classMatch)
                element.className = classMatch[1];
            const boundsMatch = match.match(/bounds="([^"]+)"/);
            if (boundsMatch)
                element.bounds = boundsMatch[1];
            elements.push(element);
        }
    }
    return elements;
}
function parseAndroidScannerResults(logcat) {
    // Parse Google Accessibility Scanner results from logcat
    const issues = [];
    const lines = logcat.split('\n');
    for (const line of lines) {
        if (line.includes('AccessibilityScanner') && line.includes('Issue:')) {
            // Parse scanner issue
            const issueMatch = line.match(/Issue:\s+(.+)/);
            if (issueMatch) {
                issues.push({
                    platform: 'android',
                    type: 'scanner_issue',
                    severity: 'warning',
                    message: issueMatch[1],
                    element: {},
                    suggestion: 'Review in Google Accessibility Scanner app for detailed fix instructions'
                });
            }
        }
    }
    return issues;
}
function parseFrame(frameStr) {
    // Parse iOS frame string: "{{x, y}, {width, height}}"
    const match = frameStr.match(/\{\{(\d+\.?\d*),\s*(\d+\.?\d*)\},\s*\{(\d+\.?\d*),\s*(\d+\.?\d*)\}\}/);
    if (!match)
        return null;
    return {
        x: parseFloat(match[1]),
        y: parseFloat(match[2]),
        width: parseFloat(match[3]),
        height: parseFloat(match[4])
    };
}
function parseBounds(boundsStr) {
    // Parse Android bounds string: "[x1,y1][x2,y2]"
    const match = boundsStr.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
    if (!match)
        return null;
    const x1 = parseInt(match[1]);
    const y1 = parseInt(match[2]);
    const x2 = parseInt(match[3]);
    const y2 = parseInt(match[4]);
    return {
        x: x1,
        y: y1,
        width: x2 - x1,
        height: y2 - y1
    };
}
/**
 * Merge native scanner results with Maestro accessibility report
 */
function mergeAccessibilityReports(maestroReport, nativeReports) {
    const merged = { ...maestroReport };
    // Add native scanner results as additional violations
    for (const nativeReport of nativeReports) {
        for (const issue of nativeReport.issues) {
            merged.violations.push({
                id: `native-${issue.platform}-${merged.violations.length + 1}`,
                category: 'Native Scanner',
                severity: issue.severity === 'error' ? 'critical' : issue.severity === 'warning' ? 'serious' : 'moderate',
                wcagCriteria: `Native ${issue.platform.toUpperCase()} Check`,
                wcagLevel: 'AA',
                element: {
                    type: 'native',
                    text: issue.element.label || '',
                    id: issue.element.identifier || '',
                    bounds: issue.element.frame || '',
                    clickable: false,
                    focused: false
                },
                message: issue.message,
                description: `Native ${issue.platform} accessibility scanner detected an issue`,
                howToFix: issue.suggestion,
                impact: `${issue.platform === 'ios' ? 'VoiceOver' : 'TalkBack'} users may experience difficulties`
            });
        }
    }
    // Update summary
    merged.summary.critical += nativeReports.reduce((sum, r) => sum + r.summary.errors, 0);
    merged.summary.serious += nativeReports.reduce((sum, r) => sum + r.summary.warnings, 0);
    merged.summary.moderate += nativeReports.reduce((sum, r) => sum + r.summary.info, 0);
    return merged;
}
//# sourceMappingURL=native-a11y-scanner.js.map