# Accessibility Testing - Complete Guide

Comprehensive guide for accessibility testing in Maestro UI tests with WCAG 2.1/2.2 compliance validation, VoiceOver/TalkBack automation, and standalone HTML reporting.

## Overview

The Maestro UI testing framework provides two complementary accessibility testing layers:

1. **Automatic hierarchy-based validation** (recommended) — Runs when `--a11y` is passed to `scripts/testing/test.sh`. Analyses the real UI hierarchy JSON files captured during the test run and generates a **standalone `accessibility-report.html`**. Covers WCAG 2.1/2.2 rules and a dedicated VoiceOver/TalkBack rule set.

2. **Programmatic checks** (legacy) — JavaScript API in `scripts/testing/accessibilityTester.js` for writing explicit assertions in custom scripts.

## Quick Start

### Run Tests with Accessibility Report

```bash
# Run test with WCAG + VoiceOver/TalkBack validation
bash scripts/testing/test.sh .maestro/flows/Account/login-and-logout.yaml --a11y

# Combined with Pulse design system report
bash scripts/testing/test.sh .maestro/flows/Account/login-and-logout.yaml --a11y --pulse

# Generate manually from an existing report directory
node scripts/reporting/generate-unified-report.js \
  "test-reports/IOS_20260318_135502/results-IOS-20260318_135502.xml" \
  "test-reports/IOS_20260318_135502/test-report-IOS-20260318_135502.html" \
  "ios" "" --a11y

# The standalone report auto-opens in browser. Or open manually:
open test-reports/IOS_20260318_135502/accessibility-report.html
```

### Programmatic Usage

```javascript
const AccessibilityTester = require('./scripts/accessibilityTester');
const tester = new AccessibilityTester('./test-reports');

// Perform accessibility checks
tester.checkColorContrast('loginTest', 'rgb(0,0,0)', 'rgb(255,255,255)', 4.5);
tester.checkTextSize('loginTest', 14, 12);
tester.checkTouchTargetSize('loginTest', 48, 48, 44);
tester.checkLabelPresence('loginTest', 'email input', true);
tester.checkImageAltText('loginTest', 'logo.png', true, 'Company Logo');

// Generate report
tester.exportAccessibilityReport();
console.log(tester.generateAccessibilitySummary());
```

## Accessibility Checks

### 1. Color Contrast (WCAG 1.4.3)

**Purpose:** Ensure text has sufficient contrast against background

**Method:**
```javascript
tester.checkColorContrast(testName, foreground, background, minRatio)
```

**Parameters:**
- `testName`: Name of the test
- `foreground`: Foreground color (RGB format: 'rgb(r,g,b)')
- `background`: Background color (RGB format: 'rgb(r,g,b)')
- `minRatio`: Minimum contrast ratio (default: 4.5 for AA, 7 for AAA)

**Example:**
```javascript
tester.checkColorContrast('loginForm', 'rgb(0,0,0)', 'rgb(255,255,255)', 4.5);
// Result: ✓ Contrast ratio: 21.00:1 (required: 4.5:1)
```

**Standards:**
- Level AA: 4.5:1 for normal text, 3:1 for large text
- Level AAA: 7:1 for normal text, 4.5:1 for large text

**Severity:** High

### 2. Text Size (WCAG 1.4.4)

**Purpose:** Ensure text is large enough to read

**Method:**
```javascript
tester.checkTextSize(testName, fontSize, minSize)
```

**Standards:**
- Minimum 12pt for body text
- 14pt+ recommended for better readability

**Severity:** Medium

### 3. Touch Target Size (WCAG 2.5.5)

**Purpose:** Ensure interactive elements are large enough to tap

**Method:**
```javascript
tester.checkTouchTargetSize(testName, width, height, minSize)
```

**Standards:**
- Minimum 44x44pt for touch targets (Apple HIG)
- 48x48pt recommended for better accessibility

**Severity:** High

### 4. Label Presence (WCAG 1.3.1)

**Purpose:** Ensure form fields have associated labels

**Method:**
```javascript
tester.checkLabelPresence(testName, elementType, hasLabel)
```

**Example:**
```javascript
tester.checkLabelPresence('loginForm', 'email input', true);
// Result: ✓ email input has associated label
```

**Severity:** High

### 5. Image Alt Text (WCAG 1.1.1)

**Purpose:** Provide text alternatives for images

**Method:**
```javascript
tester.checkImageAltText(testName, imageName, hasAltText, altText)
```

**Example:**
```javascript
tester.checkImageAltText('homepage', 'logo.png', true, 'Company Logo');
// Result: ✓ Alt Text for logo.png: "Company Logo"
```

**Severity:** High

### 6. Heading Structure (WCAG 1.3.1)

**Purpose:** Ensure logical heading hierarchy

**Method:**
```javascript
tester.checkHeadingStructure(testName, headings)
```

**Example:**
```javascript
tester.checkHeadingStructure('homepage', ['H1', 'H2', 'H2', 'H3']);
// Result: ✓ Heading sequence: H1 → H2 → H2 → H3 (valid)
```

**Severity:** Medium

### 7. Keyboard Navigation (WCAG 2.1.1)

**Purpose:** Ensure all interactive elements are keyboard accessible

**Method:**
```javascript
tester.checkKeyboardNavigation(testName, isNavigable)
```

**Example:**
```javascript
tester.checkKeyboardNavigation('loginForm', true);
// Result: ✓ Keyboard Navigation: All interactive elements are keyboard accessible
```

**Severity:** Critical

### 8. Focus Indicator (WCAG 2.4.7)

**Purpose:** Ensure keyboard focus is visually indicated

**Method:**
```javascript
tester.checkFocusIndicator(testName, hasFocusIndicator)
```

**Example:**
```javascript
tester.checkFocusIndicator('loginForm', true);
// Result: ✓ Focus Indicator: Focus indicator is visible
```

**Severity:** High

### 9. Color Not Alone (WCAG 1.4.1)

**Purpose:** Ensure information isn't conveyed by color alone

**Method:**
```javascript
tester.checkColorNotAlone(testName, usesColorOnly)
```

**Example:**
```javascript
tester.checkColorNotAlone('form', false);
// Result: ✓ Color Not Alone: Uses additional visual cues
```

**Severity:** Medium

### 10. Form Labels (WCAG 1.3.1)

**Purpose:** Ensure all form fields have labels

**Method:**
```javascript
tester.checkFormLabels(testName, formFields)
```

**Example:**
```javascript
tester.checkFormLabels('loginForm', [
  { name: 'email', hasLabel: true },
  { name: 'password', hasLabel: true },
  { name: 'remember', hasLabel: true }
]);
// Result: ✓ Form Labels: 3/3 fields have labels
```

**Severity:** High

### 11. VoiceOver Accessibility (WCAG 1.3.1, 2.1.1)

**Purpose:** Ensure screen reader compatibility and proper announcements for VoiceOver users

**Methods:**
```javascript
tester.checkAccessibilityLabel(testName, elementId, hasLabel, expectedLabel)
tester.checkAccessibilityTraits(testName, elementId, expectedTraits, actualTraits)
tester.checkAccessibilityHint(testName, elementId, hasHint, hintText)
tester.checkNavigationOrder(testName, elementIds, isLogical)
tester.checkCustomActions(testName, elementId, expectedActions, actualActions)
tester.checkDynamicAnnouncements(testName, elementId, shouldAnnounce, announcementText)
tester.checkRotorSupport(testName, rotorCategories, supportedCategories)
tester.checkFormFieldAccessibility(testName, formFields)
tester.checkImageAccessibility(testName, images)
tester.checkHeadingAccessibility(testName, headings)
tester.checkButtonAccessibility(testName, buttons)
tester.checkLinkAccessibility(testName, links)
```

**Example:**
```javascript
tester.checkAccessibilityLabel('loginForm', 'emailInput', true, 'Email address');
// Result: ✓ Element "emailInput" has accessibility label: "Email address"

tester.checkAccessibilityTraits('loginForm', 'submitBtn', ['button'], ['button']);
// Result: ✓ Element "submitBtn" has correct traits: button

tester.checkNavigationOrder('loginForm', ['emailInput', 'passwordInput', 'submitBtn'], true);
// Result: ✓ VoiceOver navigation order is logical for 3 elements
```

**Standards:**
- Accessibility labels for all interactive elements
- Proper traits (button, link, header, etc.) for semantic meaning
- Hints for complex interactions
- Logical navigation order matching visual flow
- Custom actions for gesture-based interactions
- Dynamic content announcements via UIAccessibilityPostNotification
- Rotor support for headings, links, images, etc.

**Severity:** Critical (VoiceOver is essential for blind/low-vision users)

### 12. Additional Checks

- **Animation Preferences** (WCAG 2.3.3) - Respect motion preferences
- **Language Declaration** (WCAG 3.1.1) - Declare primary language
- **Error Messages** (WCAG 3.3.1) - Validate error clarity
- **Text Alternatives** (WCAG 1.1.1) - Validate text alternatives
- **Reading Order** (WCAG 1.3.2) - Ensure logical content order

## Automatic WCAG & VoiceOver Validation

### How It Works

1. During a test run, `captureScreenHierarchyStart.yaml` saves a JSON hierarchy snapshot to `hierarchies/` for each named screen.
2. When `--a11y` is passed, `generate-unified-report.js` calls `scripts/utils/a11y-hierarchy-validator.js` against every collected snapshot.
3. A standalone **`accessibility-report.html`** is written to the report directory and auto-opened.

### Report Structure

The standalone report contains:

#### Header Tiles (unified counts)
| Tile | Content |
|---|---|
| **Errors** | Total WCAG errors + VoiceOver errors (sub-label shows per-source split, e.g. `2 WCAG · 1 VO`) |
| **Warnings** | Total WCAG warnings + VoiceOver warnings |
| **Screens** | Number of screens analysed |
| **Elements** | Total elements inspected (sub-label shows VO-checked count) |

#### Per-Screen WCAG Section
- WCAG 2.1/2.2 rule violations table (Rule ID, criterion, element, remediation)
- Interactive element × rule matrix showing ✅/❌ per check

#### Per-Screen VoiceOver / TalkBack Section
- Full **element × rule matrix** — every captured element as a row, 4 VO rule columns
- Remediation detail table listing only violated rules
- Navigation order issues table when DOM order mismatches visual top-to-bottom order

---

## VoiceOver / TalkBack Validation Rules

Four rules run against every element in every captured hierarchy snapshot.

### Rule: `vo-icon-only-label`

**Criterion:** WCAG 1.1.1 / 4.1.2  
**Applies to:** Interactive elements (buttons, links) with no visible text  
**Trigger:** Element type is `button` or `link`, label is blank or matches an SF Symbol pattern (e.g. `square.and.arrow.up`, `xmark.circle.fill`)  
**Issue:** VoiceOver/TalkBack announces nothing or reads a raw symbol name  
**Fix:** Add `accessibilityLabel` (iOS) / `contentDescription` (Android)

### Rule: `vo-textfield-value-no-label`

**Criterion:** WCAG 1.3.1  
**Applies to:** Text fields that have a value but no label  
**Trigger:** Element is a text field, `value` is non-empty, `label` is blank  
**Issue:** Screen reader reads the value but cannot identify what the field represents  
**Fix:** Add `labelText` / `accessibilityLabel` to the field

### Rule: `vo-disabled-missing-label`

**Criterion:** WCAG 4.1.2  
**Applies to:** Disabled interactive elements  
**Trigger:** `enabled: false`, `label` is blank  
**Issue:** Disabled elements with no label are silently skipped by VoiceOver — users lose context  
**Fix:** Provide an `accessibilityLabel` even for disabled controls

### Rule: `vo-label-type-redundancy`

**Criterion:** WCAG 1.3.1 (best practice)  
**Applies to:** All labelled elements  
**Trigger:** The label ends with the element’s role/type name (e.g. label = `"Close Button"` on a button)  
**Issue:** VoiceOver announces both the label and the role, resulting in "Close Button button"  
**Fix:** Remove the redundant role suffix from `accessibilityLabel`

---

## Navigation Order Analysis

For each screen, the validator compares the element’s **DOM position** (order in the hierarchy JSON) with its **visual position** (computed from `bounds.y` top-to-bottom, then left-to-right).

Mismatches surface in a table inside the VoiceOver section:

| Column | Meaning |
|---|---|
| Element | Label or identifier |
| DOM position | Index in hierarchy tree |
| Visual position | Index after sorting by screen coordinates |
| Bounds | `{x, y, width, height}` of the element |

A mismatch means a keyboard / switch-control / VoiceOver user encounters elements in a different order than what is visually presented — which violates WCAG 1.3.2 and 2.4.3.

---

## Native Platform Scanner Integration

In addition to Maestro's hierarchy-based WCAG validation, the framework integrates **native iOS XCTest Accessibility Audit** and **Google Accessibility Scanner** to provide platform-specific checks that go beyond what hierarchy analysis alone can detect.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              Maestro Recorder / test.sh --a11y              │
│                                                             │
│  1. Capture UI hierarchy from simulator/emulator            │
│  2. Run Maestro WCAG 2.1 validation                        │
│  3. Detect platform (iOS / Android / Both)                  │
│  4. Run native platform scanners in parallel                │
│  5. Merge and deduplicate all findings                      │
│  6. Generate unified HTML report                            │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
        ▼                             ▼
┌──────────────────┐         ┌──────────────────┐
│ iOS XCTest Audit │         │ Android Scanner  │
│                  │         │                  │
│ - xcrun simctl   │         │ - adb shell      │
│ - Accessibility  │         │ - uiautomator    │
│   Inspector      │         │ - Scanner API    │
│ - System logs    │         │ - Logcat         │
└──────────────────┘         └──────────────────┘
```

### iOS XCTest Accessibility Audit

Integrates with Apple's native XCTest Accessibility Audit API (Xcode 14+, iOS 16+).

**Accessibility properties checked:**
`accessibilityLabel`, `accessibilityHint`, `accessibilityTraits`, `accessibilityValue`, `accessibilityFrame`, `isAccessibilityElement`, `accessibilityIdentifier`

**Audit categories:**

| Category | What It Checks |
|----------|---------------|
| Contrast | Text/background contrast meets 4.5:1 ratio |
| Element Detection | Unlabeled interactive elements |
| Hit Region | 44x44pt minimum touch targets |
| Clipped Text | Text truncation with Dynamic Type / larger fonts |
| Trait | Correct accessibility traits assigned |
| Dynamic Type | Font scaling support |

**How it works:** The scanner obtains the booted simulator UDID, captures accessibility logs from the system, runs the accessibility inspector via `simctl`, parses element properties, validates against iOS HIG standards, and returns issues with fix suggestions.

**Requirements:** Xcode 14+, iOS 16+ simulator booted, app running on the simulator.

### Android Accessibility Scanner

Integrates with Google Accessibility Scanner and UI Automator hierarchy analysis.

**Accessibility properties checked:**
`contentDescription`, `hint`, `accessibilityLiveRegion`, `importantForAccessibility`, `accessibilityHeading`, `accessibilityTraversalBefore/After`

**Scanner categories:**

| Category | What It Checks |
|----------|---------------|
| Touch Target Size | 48dp minimum validation |
| Content Labeling | Missing `contentDescription` |
| Text Contrast | Color contrast ratios |
| Clickable Spans | Clickable text issues in TextViews |
| Implementation | Proper widget usage |
| Text Scaling | sp units usage |

**How it works:** The scanner connects to the device/emulator via ADB, captures the UI hierarchy via `uiautomator`, parses accessibility properties from XML, optionally runs Google Accessibility Scanner if installed, validates against Material Design standards, and returns issues with fix suggestions.

**Requirements:** Android SDK, device/emulator connected via ADB, app running. Google Accessibility Scanner app is optional (basic checks run without it).

### Merged Report Structure

When native scanners run alongside Maestro validation, the results are merged into a single report. Duplicate findings across scanners are deduplicated, and all issues are assigned a unified severity level.

```json
{
  "violations": [
    {
      "id": "a11y-1",
      "category": "Perceivable",
      "severity": "critical",
      "wcagCriteria": "1.1.1 Non-text Content",
      "element": { "type": "image", "id": "profile_image" },
      "message": "Image missing alternative text",
      "howToFix": "iOS: Set accessibilityLabel. Android: Set contentDescription"
    },
    {
      "id": "native-ios-1",
      "category": "Native Scanner",
      "severity": "critical",
      "wcagCriteria": "Native iOS Check",
      "element": { "type": "native", "id": "submit_button", "bounds": "{{10, 20}, {40, 40}}" },
      "message": "Touch target too small: 40x40pt (minimum 44x44pt)",
      "howToFix": "Increase frame size to 44x44pt minimum"
    }
  ],
  "summary": { "critical": 3, "serious": 6, "moderate": 5, "minor": 3 },
  "categoryBreakdown": { "Perceivable": 5, "Operable": 7, "Understandable": 3, "Robust": 2 }
}
```

The HTML report shows platform badges (iOS / Android / WCAG) next to each violation so the source scanner is always clear.

### Performance

| Scanner | Typical Time | Scope |
|---------|-------------|-------|
| Maestro WCAG 2.1 | 2-5 seconds | All elements |
| iOS XCTest Audit | 5-10 seconds | Interactive elements |
| Android Scanner | 5-15 seconds | All elements |
| **Combined** | **10-30 seconds** | **All elements** |

### Configuration

Both native scanners run automatically when their platform is detected. To disable either scanner or adjust timeouts, edit the constants in `server.ts`:

```typescript
// Enable/disable native scanners
const ENABLE_IOS_SCANNER = true;      // set false to disable
const ENABLE_ANDROID_SCANNER = true;  // set false to disable

// Timeout configuration
const IOS_AUDIT_TIMEOUT = 10000;      // 10 seconds
const ANDROID_SCANNER_TIMEOUT = 15000; // 15 seconds
```

### Using in Maestro Recorder

1. Start recording on an iOS or Android device.
2. Navigate to the screen you want to validate.
3. Click "Validate Accessibility" in the Recorder UI.
4. Wait for the combined scan (10-30 seconds).
5. Review violations in the report panel; download the HTML report for sharing.

### Native Scanner Troubleshooting

**iOS -- "No booted simulator found"**
Boot a simulator first: `xcrun simctl boot "iPhone 16 Pro"`

**iOS -- "Failed to run iOS accessibility audit"**
Ensure Xcode 14+ is installed and the simulator is running with the app launched.

**iOS -- "No accessibility logs captured"**
Enable accessibility logging in the simulator's Settings > Accessibility.

**Android -- "No Android device/emulator found"**
Verify the device is connected: `adb devices`

**Android -- "Failed to capture UI hierarchy"**
Ensure the app is running and ADB has the required permissions.

**Android -- "Google Accessibility Scanner not installed"**
The enhanced scanner app is optional; basic checks still run without it.

---

## WCAG 2.1 Compliance

### Compliance Levels

| Level | Description | Target |
|-------|-------------|--------|
| **A** | Basic accessibility | Minimum requirement |
| **AA** | Enhanced accessibility | Standard target (recommended) |
| **AAA** | Advanced accessibility | Optimal for specialized content |

### Checks by Level

**Level A Checks:**
- Non-text content (images, icons)
- Keyboard accessibility
- Heading structure
- Form labels
- Language declaration
- Error identification
- Reading order
- Text alternatives

**Level AA Checks** (includes Level A):
- Color contrast (4.5:1)
- Text resizing
- Focus visible
- Animation preferences

**Level AAA Checks** (includes A & AA):
- Enhanced color contrast (7:1)
- Touch target size (48x48pt)
- Extended audio descriptions

## VoiceOver Testing Integration

### Integrated Accessibility Testing (Recommended)

The `IntegratedAccessibilityTester` combines standard WCAG 2.1 checks with VoiceOver screen reader testing into a single unified report:

```javascript
const IntegratedAccessibilityTester = require('./scripts/testing/integratedAccessibilityTester');
const tester = new IntegratedAccessibilityTester('./test-reports');

// Run all accessibility checks (standard + VoiceOver)
const results = tester.runAllAccessibilityChecks('loginTest', {
  colorContrast: true,
  textSize: true,
  touchTargets: true,
  formLabels: true,
  keyboardNav: true,
  focusIndicator: true,
  voiceOverLabels: true,
  voiceOverTraits: true,
  voiceOverNavOrder: true,
  voiceOverImages: true,
  voiceOverHeadings: true,
  voiceOverButtons: true
});

// Generate unified report
tester.exportUnifiedReport();
tester.printUnifiedAccessibilitySummary();
```

### Standalone VoiceOver Testing

For VoiceOver-only testing:

```javascript
const VoiceOverTester = require('./scripts/testing/voiceOverTester');
const tester = new VoiceOverTester('./test-reports');

// Perform VoiceOver accessibility checks
tester.checkAccessibilityLabel('loginTest', 'emailInput', true, 'Email address');
tester.checkAccessibilityTraits('loginTest', 'submitBtn', ['button'], ['button']);
tester.checkNavigationOrder('loginTest', ['emailInput', 'passwordInput', 'submitBtn'], true);

// Generate report
tester.exportVoiceOverReport();
console.log(tester.generateVoiceOverSummary());
tester.printVoiceOverResults();
```

## Usage Examples

### Example 1: Login Form Testing

```javascript
const AccessibilityTester = require('./scripts/accessibilityTester');
const tester = new AccessibilityTester();

function testLoginFormAccessibility() {
  const testName = 'loginForm';
  
  // Check color contrast
  tester.checkColorContrast(testName, 'rgb(0,0,0)', 'rgb(255,255,255)', 4.5);
  
  // Check text size
  tester.checkTextSize(testName, 14, 12);
  
  // Check touch targets
  tester.checkTouchTargetSize(testName, 48, 48, 44);
  
  // Check form labels
  tester.checkLabelPresence(testName, 'email input', true);
  tester.checkLabelPresence(testName, 'password input', true);
  
  // Check keyboard navigation
  tester.checkKeyboardNavigation(testName, true);
  
  // Check focus indicator
  tester.checkFocusIndicator(testName, true);
  
  // Generate report
  tester.exportAccessibilityReport();
  console.log(tester.generateAccessibilitySummary());
}

testLoginFormAccessibility();
```

### Example 1b: Login Form with Integrated A11y + VoiceOver Testing

```javascript
const IntegratedAccessibilityTester = require('./scripts/testing/integratedAccessibilityTester');
const tester = new IntegratedAccessibilityTester();

function testLoginFormWithIntegratedA11y() {
  const testName = 'loginForm';
  
  // Run all accessibility checks (standard + VoiceOver) in one call
  const results = tester.runAllAccessibilityChecks(testName, {
    colorContrast: true,
    textSize: true,
    touchTargets: true,
    formLabels: true,
    keyboardNav: true,
    focusIndicator: true,
    voiceOverLabels: true,
    voiceOverTraits: true,
    voiceOverNavOrder: true,
    voiceOverImages: true,
    voiceOverHeadings: true,
    voiceOverButtons: true
  });
  
  // Generate unified report combining standard A11y + VoiceOver
  tester.exportUnifiedReport();
  tester.printUnifiedAccessibilitySummary();
}

testLoginFormWithIntegratedA11y();
```

### Example 2: Image Accessibility

```javascript
function testImageAccessibility() {
  const testName = 'homepage';
  
  // Check all images have alt text
  tester.checkImageAltText(testName, 'hero-banner.png', true, 'Hero banner showing product features');
  tester.checkImageAltText(testName, 'logo.png', true, 'Company Logo');
  tester.checkImageAltText(testName, 'user-avatar.png', true, 'User profile picture');
  
  // Check text alternatives
  tester.checkTextAlternatives(testName, [
    { name: 'icon-search', hasAlternative: true },
    { name: 'icon-menu', hasAlternative: true },
    { name: 'icon-user', hasAlternative: true }
  ]);
  
  tester.exportAccessibilityReport();
}

testImageAccessibility();
```

### Example 3: Comprehensive Page Testing

```javascript
function testPageAccessibility() {
  const testName = 'productPage';
  
  // Structure checks
  tester.checkHeadingStructure(testName, ['H1', 'H2', 'H2', 'H3', 'H3']);
  tester.checkReadingOrder(testName, true);
  
  // Visual checks
  tester.checkColorContrast(testName, 'rgb(51,51,51)', 'rgb(255,255,255)', 7);
  tester.checkColorNotAlone(testName, false);
  
  // Interactive checks
  tester.checkKeyboardNavigation(testName, true);
  tester.checkFocusIndicator(testName, true);
  tester.checkTouchTargetSize(testName, 48, 48, 44);
  
  // Content checks
  tester.checkFormLabels(testName, [
    { name: 'quantity', hasLabel: true },
    { name: 'size', hasLabel: true },
    { name: 'color', hasLabel: true }
  ]);
  
  tester.exportAccessibilityReport();
}

testPageAccessibility();
```

### Example 4: VoiceOver-Specific Testing

```javascript
const VoiceOverTester = require('./scripts/voiceOverTester');
const tester = new VoiceOverTester();

function testVoiceOverAccessibility() {
  const testName = 'productPage';
  
  // Check button accessibility
  tester.checkButtonAccessibility(testName, [
    { name: 'addToCart', hasLabel: true, isMarkedAsButton: true },
    { name: 'favorite', hasLabel: true, isMarkedAsButton: true },
    { name: 'share', hasLabel: true, isMarkedAsButton: true }
  ]);
  
  // Check link accessibility
  tester.checkLinkAccessibility(testName, [
    { name: 'relatedProduct1', hasLabel: true, isMarkedAsLink: true },
    { name: 'relatedProduct2', hasLabel: true, isMarkedAsLink: true }
  ]);
  
  // Check image accessibility
  tester.checkImageAccessibility(testName, [
    { name: 'productImage', isDecorative: false, hasAltText: true, altText: 'Red running shoe' },
    { name: 'decorativePattern', isDecorative: true }
  ]);
  
  // Check heading accessibility
  tester.checkHeadingAccessibility(testName, [
    { text: 'Product Details', level: 1, isMarkedAsHeading: true },
    { text: 'Specifications', level: 2, isMarkedAsHeading: true },
    { text: 'Reviews', level: 2, isMarkedAsHeading: true }
  ]);
  
  // Check custom actions
  tester.checkCustomActions(testName, 'productImage', 
    [{ name: 'zoom' }, { name: 'share' }],
    [{ name: 'zoom' }, { name: 'share' }]
  );
  
  // Check dynamic announcements
  tester.checkDynamicAnnouncements(testName, 'cartBadge', true, 'Item added to cart');
  
  // Check rotor support
  tester.checkRotorSupport(testName, 
    ['headings', 'links', 'images', 'buttons'],
    ['headings', 'links', 'images', 'buttons']
  );
  
  // Generate report
  tester.exportVoiceOverReport();
  tester.printVoiceOverResults();
}

testVoiceOverAccessibility();
```

## Reports and Metrics

### Accessibility Score

The accessibility score is calculated as:

```
Score = (Passed Checks / Total Checks) × 100
```

**Score Interpretation:**
- 95-100%: Excellent (AAA compliant)
- 80-94%: Good (AA compliant)
- 60-79%: Fair (A compliant)
- <60%: Poor (needs improvement)

### Report Structure

```json
{
  "timestamp": "2026-01-09T23:46:00.000Z",
  "summary": {
    "totalChecks": 50,
    "passedChecks": 48,
    "failedChecks": 2,
    "accessibilityScore": 96,
    "wcagCompliance": {
      "levelA": 25,
      "levelAA": 20,
      "levelAAA": 5
    }
  },
  "issues": {
    "critical": 0,
    "high": 2,
    "medium": 0
  },
  "details": {
    "allChecks": [...],
    "issues": [...],
    "recommendations": [...]
  }
}
```

### HTML Report

The HTML report includes:
- **Accessibility Score Card** - Overall percentage with color coding
- **Summary Dashboard** - Total tests, passed, failed, A11y score
- **Screen Screenshot** - Visual context of the validated screen (automatically captured)
- **Issue Severity Breakdown** - Critical/High/Medium counts
- **Detailed Issues List** - Each issue with remediation guidance
- **WCAG Compliance Breakdown** - Level A, AA, AAA checks
- **Recommendations** - Priority-based action items

**Screenshot Feature:**
- 📸 Automatically captures the screen during validation
- Embedded in the downloadable HTML report
- Provides visual context for developers reviewing violations
- Helps identify which screen/state was tested
- No manual screenshot needed - fully automated

**Interactive Filtering:**
- 🎯 Click severity badges (Critical, Serious, Moderate, Minor) to filter violations
- Shows only violations of the selected severity level
- Click again to toggle filter off
- "Show All" button to reset filter
- Smooth scroll to violations section
- Visual feedback with active state highlighting

**Color Coding:**
- 🟢 Green (90%+) - Excellent accessibility
- 🟡 Yellow (70-89%) - Needs improvement
- 🔴 Red (<70%) - Critical issues

### Example Report Output

**Passing All Checks:**
```
♿ Accessibility Testing Results

A11y Score: 100%
Total Checks: 50
🔴 Critical: 0
🟠 High: 0
🟡 Medium: 0

✓ No accessibility issues found! All checks passed.

WCAG Compliance Levels:
Level A: 20 checks
Level AA: 25 checks
Level AAA: 5 checks
```

**With Issues:**
```
♿ Accessibility Testing Results

A11y Score: 82%
Total Checks: 50
🔴 Critical: 1
🟠 High: 3
🟡 Medium: 5

Accessibility Issues:

┌─────────────────────────────────────────────────────────────┐
│ Keyboard Navigation                         [CRITICAL]       │
│ Test: test_checkout | WCAG: A - 2.1.1 Keyboard             │
│ Issue: All interactive elements are not keyboard accessible │
│ ✓ Remediation: Ensure all interactive elements can be      │
│   accessed via keyboard                                     │
└─────────────────────────────────────────────────────────────┘

Recommendations:
1. [CRITICAL] 1 critical accessibility issue(s) found. These must be fixed immediately.
2. [HIGH] 3 high-priority accessibility issue(s) found. These should be addressed soon.
3. [MEDIUM] Accessibility score is 82%. Target 95%+ for WCAG AA compliance.
```

## CI/CD Integration

### CircleCI

```yaml
# .circleci/config.yml
- run:
    name: Run Tests with Accessibility
    command: |
      cd IOS/CVSOnlineiPhone/MaestroUITests
      npm test

- store_artifacts:
    path: IOS/CVSOnlineiPhone/MaestroUITests/test-reports
    destination: test-reports

# Fail build on critical A11y issues
- run:
    name: Check Accessibility Score
    command: |
      A11Y_SCORE=$(jq -r '.summary.accessibilityScore' test-reports/accessibility-report.json)
      if [ "$A11Y_SCORE" -lt 90 ]; then
        echo "Accessibility score too low: $A11Y_SCORE%"
        exit 1
      fi
```

### GitHub Actions

```yaml
# .github/workflows/maestro-tests.yml
- name: Run Tests with Accessibility
  run: |
    cd IOS/CVSOnlineiPhone/MaestroUITests
    npm test

- name: Upload Test Reports
  uses: actions/upload-artifact@v3
  with:
    name: test-reports
    path: IOS/CVSOnlineiPhone/MaestroUITests/test-reports/

- name: Check Accessibility Compliance
  run: |
    A11Y_SCORE=$(jq -r '.summary.accessibilityScore' test-reports/accessibility-report.json)
    echo "Accessibility Score: $A11Y_SCORE%"
    if [ "$A11Y_SCORE" -lt 90 ]; then
      echo "::error::Accessibility score below 90%"
      exit 1
    fi
```

## VoiceOver Best Practices

### 1. Accessibility Labels

Always provide clear, concise labels for interactive elements:

```swift
// Good: Clear, descriptive label
emailInput.accessibilityLabel = "Email address"
submitButton.accessibilityLabel = "Sign in"

// Bad: Vague or missing labels
emailInput.accessibilityLabel = "Input"
submitButton.accessibilityLabel = nil
```

### 2. Accessibility Traits

Use proper traits to indicate element type and behavior:

```swift
// Buttons
submitButton.accessibilityTraits = .button

// Text fields
emailInput.accessibilityTraits = .searchField
passwordInput.accessibilityTraits = .secureTextField

// Links
learnMoreLink.accessibilityTraits = .link

// Headers
sectionTitle.accessibilityTraits = .header

// Custom combinations
customControl.accessibilityTraits = [.button, .allowsDirectInteraction]
```

### 3. Accessibility Hints

Provide hints for complex interactions:

```swift
// Good: Explains how to interact
zoomButton.accessibilityHint = "Double-tap to zoom in"
deleteButton.accessibilityHint = "Long press to delete"

// Bad: Redundant or unclear
zoomButton.accessibilityHint = "Button"
deleteButton.accessibilityHint = "Deletes"
```

### 4. Navigation Order

Ensure logical reading order matches visual layout:

```swift
// Set custom navigation order
view.accessibilityElements = [
  emailInput,
  passwordInput,
  rememberMeSwitch,
  submitButton,
  forgotPasswordLink
]
```

### 5. Dynamic Content Announcements

Announce changes to VoiceOver users:

```swift
// Announce when item is added to cart
UIAccessibility.post(notification: .announcement, argument: "Item added to cart")

// Announce when page loads
UIAccessibility.post(notification: .pageScrolled, argument: "Product details loaded")

// Announce validation errors
UIAccessibility.post(notification: .announcement, argument: "Email format is invalid")
```

### 6. Custom Actions

Provide custom actions for gesture-based interactions:

```swift
// Add custom actions to element
productImage.accessibilityCustomActions = [
  UIAccessibilityCustomAction(name: "Zoom", target: self, selector: #selector(zoomImage)),
  UIAccessibilityCustomAction(name: "Share", target: self, selector: #selector(shareImage))
]
```

### 7. Rotor Support

Implement rotor support for quick navigation:

```swift
// Headings rotor
headingElements = [sectionTitle1, sectionTitle2, sectionTitle3]

// Links rotor
linkElements = [learnMoreLink, privacyLink, termsLink]

// Images rotor
imageElements = [productImage, reviewImage1, reviewImage2]
```

## Best Practices

### 1. Test Early and Often

Run accessibility tests during development, not just at the end:

```bash
# Run tests with accessibility checks on every commit
npm test
```

### 2. Automate Accessibility Testing

Integrate into CI/CD pipeline:

```yaml
# .github/workflows/maestro-tests.yml
- name: Run Accessibility Tests
  run: npm test
  
- name: Upload Accessibility Report
  uses: actions/upload-artifact@v3
  with:
    name: accessibility-report
    path: test-reports/accessibility-report.json
```

### 3. Set Accessibility Targets

Define minimum accessibility standards:

```javascript
const minimumScore = 95; // Target 95% accessibility score
const maxCriticalIssues = 0;
const maxHighIssues = 2;

if (score < minimumScore || criticalIssues > maxCriticalIssues) {
  throw new Error('Accessibility standards not met');
}
```

### 4. Document Accessibility Decisions

Record why certain checks are skipped or modified:

```javascript
// Skip color contrast check for decorative element
// Decorative elements don't require contrast ratio per WCAG 1.4.3
tester.checkColorContrast(testName, fg, bg, 0); // Skip check
```

### 5. Regular Audits

Perform quarterly accessibility audits:

```bash
# Generate comprehensive accessibility report
node scripts/accessibilityTester.js --full-audit
```

### 6. Run A11y Tests Regularly

```bash
# Before every commit
npm test

# Before every release
npm run test:full

# Run VoiceOver tests specifically
node scripts/testing/voiceOverTester.js
```

### 7. VoiceOver Testing in CI/CD

```yaml
# .github/workflows/maestro-tests.yml
- name: Run VoiceOver Accessibility Tests
  run: |
    cd IOS/CVSOnlineiPhone/MaestroUITests
    node scripts/testing/voiceOverTester.js
    
- name: Check VoiceOver Score
  run: |
    VOICEOVER_SCORE=$(jq -r '.summary.voiceOverScore' test-reports/voiceover-report.json)
    echo "VoiceOver Score: $VOICEOVER_SCORE%"
    if [ "$VOICEOVER_SCORE" -lt 90 ]; then
      echo "::error::VoiceOver accessibility score below 90%"
      exit 1
    fi
```

## Troubleshooting

### Issue: Low Accessibility Score

**Cause:** Multiple accessibility violations

**Solution:**
1. Review the detailed report: `test-reports/accessibility-report.json`
2. Focus on critical and high-priority issues first
3. Use remediation suggestions provided in the report
4. Re-run tests after fixes

### Issue: Color Contrast Failures

**Cause:** Insufficient contrast between text and background

**Solution:**
```javascript
// Check current contrast ratio
tester.checkColorContrast(testName, 'rgb(100,100,100)', 'rgb(200,200,200)', 4.5);
// Result: ✗ Contrast ratio: 1.5:1 (required: 4.5:1)

// Adjust colors to meet requirement
tester.checkColorContrast(testName, 'rgb(0,0,0)', 'rgb(255,255,255)', 4.5);
// Result: ✓ Contrast ratio: 21.00:1 (required: 4.5:1)
```

### Issue: Touch Target Too Small

**Cause:** Interactive elements below minimum size

**Solution:**
```javascript
// Increase button size from 40x40 to 48x48
tester.checkTouchTargetSize(testName, 48, 48, 44);
// Result: ✓ Target size: 48x48pt (minimum: 44x44pt)
```

### Issue: Missing Form Labels

**Cause:** Form fields without associated labels

**Solution:**
```javascript
// Add labels to all form fields
tester.checkLabelPresence(testName, 'email input', true);
tester.checkLabelPresence(testName, 'password input', true);
```

### Issue: No Alt Text for Images

**Cause:** Images missing descriptive alt text

**Solution:**
```javascript
// Add meaningful alt text
tester.checkImageAltText(testName, 'product-image.png', true, 
  'Red running shoe with white stripes, size 10');
```

### Issue: Missing VoiceOver Labels

**Cause:** Elements lack accessibility labels for screen reader announcement

**Solution:**
```swift
// Add accessibility labels to all interactive elements
emailInput.accessibilityLabel = "Email address"
submitButton.accessibilityLabel = "Sign in"
closeButton.accessibilityLabel = "Close"

// Verify with VoiceOver tester
voiceOverTester.checkAccessibilityLabel(testName, 'emailInput', true, 'Email address');
```

### Issue: Incorrect VoiceOver Traits

**Cause:** Elements not properly marked with accessibility traits

**Solution:**
```swift
// Assign correct traits
submitButton.accessibilityTraits = .button
emailInput.accessibilityTraits = .searchField
learnMoreLink.accessibilityTraits = .link

// Verify with VoiceOver tester
voiceOverTester.checkAccessibilityTraits(testName, 'submitBtn', ['button'], ['button']);
```

### Issue: Poor Navigation Order

**Cause:** VoiceOver navigation order doesn't match visual reading order

**Solution:**
```swift
// Set proper navigation order
view.accessibilityElements = [
  emailInput,
  passwordInput,
  submitButton,
  forgotPasswordLink
]

// Verify with VoiceOver tester
voiceOverTester.checkNavigationOrder(testName, ['emailInput', 'passwordInput', 'submitBtn'], true);
```

### Issue: Missing Dynamic Announcements

**Cause:** Content changes not announced to VoiceOver users

**Solution:**
```swift
// Announce dynamic changes
UIAccessibility.post(notification: .announcement, argument: "Item added to cart")

// Verify with VoiceOver tester
voiceOverTester.checkDynamicAnnouncements(testName, 'cartBadge', true, 'Item added to cart');
```

## Accessibility Standards

### Target Compliance
- **WCAG 2.1 Level AA** - Primary target
- **Minimum Score:** 95%
- **Critical Issues:** 0
- **High Issues:** < 3

### Severity Levels

**Critical** - Must fix immediately
- Keyboard navigation failures
- Missing form labels
- No focus indicators

**High** - Should fix soon
- Color contrast issues
- Touch target size problems
- Missing alt text

**Medium** - Address when possible
- Text size issues
- Heading structure problems
- Reading order issues

## Integration with Test Runner

Accessibility tests are automatically integrated with the test runner:

```javascript
// scripts/testRunner.js
const AccessibilityTester = require('./accessibilityTester');

class MaestroTestRunner {
  constructor(options) {
    this.accessibilityTester = new AccessibilityTester(options.outputDir);
  }
  
  async runFlow(flowPath) {
    // Run test
    const result = await this.executeFlow(flowPath);
    
    // Run accessibility checks
    await this.performAccessibilityChecks(result);
    
    // Generate combined report
    return this.generateReport();
  }
}
```

## Support and Resources

### Documentation
- WCAG 2.1 Guidelines: https://www.w3.org/WAI/WCAG21/quickref/
- Apple Human Interface Guidelines: https://developer.apple.com/design/human-interface-guidelines/
- Accessibility Best Practices: https://www.a11y-101.com/

### Tools
- Color Contrast Checker: https://webaim.org/resources/contrastchecker/
- WAVE Browser Extension: https://wave.webaim.org/extension/
- Accessibility Inspector (Xcode): Built-in to Xcode

### Training
- WebAIM: https://webaim.org/
- Deque University: https://dequeuniversity.com/
- A11y Project: https://www.a11yproject.com/

## Unified Accessibility Testing

### IntegratedAccessibilityTester Features

The `IntegratedAccessibilityTester` provides:

- **Combined Reporting** - Single unified report with standard A11y + VoiceOver checks
- **Flexible Configuration** - Enable/disable specific checks as needed
- **Dual Scoring** - Separate scores for standard A11y and VoiceOver, plus overall score
- **Unified Issue Tracking** - All issues categorized by type and severity
- **Comprehensive Recommendations** - Organized by category (Standard A11y vs VoiceOver)

### Usage in Test Runners

```javascript
// In your test runner or CI/CD pipeline
const IntegratedAccessibilityTester = require('./scripts/testing/integratedAccessibilityTester');

async function runTestWithA11y(flowPath) {
  const tester = new IntegratedAccessibilityTester('./test-reports');
  
  // Run your Maestro test
  const testResult = await maestroRunner.runFlow(flowPath);
  
  // Run integrated accessibility checks
  tester.runAllAccessibilityChecks(testResult.testName);
  
  // Export unified report
  tester.exportUnifiedReport();
  tester.printUnifiedAccessibilitySummary();
  
  return testResult;
}
```

## Summary

✅ **Standalone `accessibility-report.html`** — Generated with `--a11y`; auto-opens after test  
✅ **WCAG 2.1/2.2 Compliance** — Level A, AA, AAA checks from real hierarchy snapshots  
✅ **VoiceOver / TalkBack Rules** — 4 automated rules: icon-only labels, field labels, disabled labels, redundancy  
✅ **Navigation Order Analysis** — DOM order vs visual order mismatch detection  
✅ **Per-element matrix** — every captured element shown as a row with ✅/❌ per rule  
✅ **Unified header tiles** — combined WCAG + VO error/warning counts with per-source breakdown  
✅ **Detailed Reports** — HTML report with per-screen WCAG table + VO matrix + nav order table  
✅ **CI/CD Integration** — Automated testing in pipelines via `--a11y` flag  
✅ **Programmatic API** — 25+ checks via `scripts/testing/accessibilityTester.js`  
✅ **Severity Classification** — Critical/High/Medium prioritization  

Accessibility testing is a core part of the Maestro testing framework, ensuring your app is usable by everyone, including users with disabilities using assistive technologies like VoiceOver and TalkBack.
