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
export interface NativeA11yIssue {
    platform: 'ios' | 'android';
    type: string;
    severity: 'error' | 'warning' | 'info';
    message: string;
    element: {
        label?: string;
        identifier?: string;
        frame?: string;
        traits?: string[];
    };
    suggestion: string;
}
export interface NativeA11yReport {
    platform: 'ios' | 'android';
    timestamp: string;
    issues: NativeA11yIssue[];
    summary: {
        errors: number;
        warnings: number;
        info: number;
    };
}
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
export declare function runIOSAccessibilityAudit(bundleId: string, simulatorId?: string): Promise<NativeA11yReport>;
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
export declare function runAndroidAccessibilityScanner(packageName: string, deviceId?: string): Promise<NativeA11yReport>;
/**
 * Merge native scanner results with Maestro accessibility report
 */
export declare function mergeAccessibilityReports(maestroReport: any, nativeReports: NativeA11yReport[]): any;
//# sourceMappingURL=native-a11y-scanner.d.ts.map