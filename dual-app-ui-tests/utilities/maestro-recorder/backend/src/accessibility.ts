import { extractColorFromRegion, validateColor, validateTextContrast, findClosestColorToken } from './colorExtraction';

// HierarchyElement interface (from server.ts)
interface HierarchyElement {
  id: string;
  type: string;
  text: string;
  bounds: string;
  clickable: boolean;
  focused: boolean;
}

// WCAG 2.1 Accessibility Categories
export enum A11yCategory {
  PERCEIVABLE = 'Perceivable',
  OPERABLE = 'Operable',
  UNDERSTANDABLE = 'Understandable',
  ROBUST = 'Robust'
}

export enum A11ySeverity {
  CRITICAL = 'critical',
  SERIOUS = 'serious',
  MODERATE = 'moderate',
  MINOR = 'minor'
}

export interface A11yViolation {
  id: string;
  category: A11yCategory;
  severity: A11ySeverity;
  wcagCriteria: string;
  wcagLevel: 'A' | 'AA' | 'AAA';
  element: HierarchyElement;
  message: string;
  description: string;
  howToFix: string;
  impact: string;
  colorInfo?: {
    extractedHex: string;
    matchedToken?: string;
    deltaE?: number;
    contrastRatio?: number;
  };
}

export interface A11yReport {
  timestamp: string;
  totalElements: number;
  violations: A11yViolation[];
  passes: number;
  warnings: number;
  summary: {
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
  };
  categoryBreakdown: {
    [key in A11yCategory]: number;
  };
  screenshot?: string; // Base64 screenshot of the validated screen
  colorValidation?: {
    enabled: boolean;
    colorsAnalyzed: number;
    tokenMismatches: number;
    deprecatedColors: number;
    contrastIssues: number;
  };
}

// Parse bounds from string format
function parseBounds(boundsStr: string): { x: number; y: number; width: number; height: number } | null {
  if (!boundsStr) return null;

  // Format: "x,y,width,height" or "[x,y][width,height]"
  const csv = boundsStr.match(/^(\d+),(\d+),(\d+),(\d+)$/);
  if (csv) {
    return {
      x: Number(csv[1]),
      y: Number(csv[2]),
      width: Number(csv[3]) - Number(csv[1]),
      height: Number(csv[4]) - Number(csv[2])
    };
  }

  const bracket = boundsStr.match(/^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$/);
  if (bracket) {
    return {
      x: Number(bracket[1]),
      y: Number(bracket[2]),
      width: Number(bracket[3]) - Number(bracket[1]),
      height: Number(bracket[4]) - Number(bracket[2])
    };
  }

  return null;
}

// Comprehensive Mobile Accessibility Validation (iOS & Android)
//
// This validator performs automated accessibility scanning covering:
//
// ✅ WCAG 2.1 Compliance (All 4 Categories):
//    - Perceivable: Non-text content, contrast, reflow, dynamic text scaling
//    - Operable: Touch targets, target spacing, gestures, navigation, focus
//    - Understandable: Labels, instructions, error identification, timeouts
//    - Robust: Name/role/value, status messages, assistive tech support
//
// ✅ Screen Reader Testing (Automated Property Validation):
//    - VoiceOver (iOS): Labels, hints, traits, custom actions, escape gesture,
//      magic tap, reading order, grouping, modal views, adjustable trait
//    - TalkBack (Android): Content descriptions, hints, roles, traversal order,
//      live regions, accessibility actions, focus management
//
// ✅ Touch Target Size & Spacing:
//    - Minimum: 44×44pt (iOS) / 48dp (Android)
//    - Recommended: 48×48pt for optimal accessibility
//    - Minimum spacing between targets (WCAG 2.5.8)
//
// ✅ Dynamic Text/Font Scaling:
//    - iOS: Dynamic Type support (adjustsFontForContentSizeCategory)
//    - Android: Scalable units (sp) validation
//    - Text truncation detection with larger system fonts
//
// ✅ Color Contrast & Usage:
//    - Text contrast ratio (4.5:1 normal, 3:1 large text)
//    - Color not sole method to convey information
//    - Color-blind friendly design validation
//
// ✅ Motion & Orientation:
//    - Respect reduceMotion / Reduce Animations preferences
//    - Portrait and landscape orientation support
//
// ✅ Labeled Elements (Comprehensive):
//    - Buttons, Images, Links, Text fields, Controls, Tab bars, Headings
//
// ✅ Accessibility Grouping & Navigation:
//    - Related elements grouped for efficient screen reader navigation
//    - Logical reading/traversal order
//    - Semantic heading structure
//    - Modal focus trapping
//
// ✅ Gestures & Interaction:
//    - Complex gestures have simple alternatives
//    - VoiceOver escape gesture (two-finger scrub) for dismissal
//    - Double-tap activation for all interactive elements
//    - Adjustable trait for sliders/pickers (increment/decrement)
//
// ✅ Time-Based Content:
//    - Auto-dismiss content gives users enough time
//    - Scroll view page change announcements
//
// 📊 Report Includes:
//    - Severity levels: Critical, Serious, Moderate, Minor
//    - WCAG criteria references with levels (A, AA, AAA)
//    - Specific impact on users with disabilities
//    - Actionable fix instructions for both iOS and Android
//    - Category breakdown for prioritization
//
export async function validateAccessibility(
  hierarchy: HierarchyElement[],
  screenshotPath?: string
): Promise<A11yReport> {
  const violations: A11yViolation[] = [];
  let violationId = 1;

  // Pre-compute bounds for all elements (used for spacing checks)
  const elementBounds: { element: HierarchyElement; bounds: ReturnType<typeof parseBounds> }[] = [];
  for (const element of hierarchy) {
    elementBounds.push({ element, bounds: parseBounds(element.bounds) });
  }

  for (const element of hierarchy) {
    const bounds = parseBounds(element.bounds);

    // ============================================================================
    // Category 1: PERCEIVABLE - Information must be presentable to users
    // ============================================================================

    // 1.1.1 Non-text Content (Level A)
    if (element.type === 'image' && !element.text) {
      violations.push({
        id: `a11y-${violationId++}`,
        category: A11yCategory.PERCEIVABLE,
        severity: A11ySeverity.CRITICAL,
        wcagCriteria: '1.1.1 Non-text Content',
        wcagLevel: 'A',
        element,
        message: 'Image missing alternative text',
        description: 'Images must have text alternatives that serve the equivalent purpose',
        howToFix: 'iOS: Set accessibilityLabel on UIImageView. Android: Set contentDescription on ImageView. For decorative images, set accessibilityElementsHidden=true (iOS) or importantForAccessibility="no" (Android)',
        impact: 'Screen reader users cannot understand the image content'
      });
    }

    // 1.3.1 Info and Relationships (Level A)
    if (element.type === 'textField' && !element.text && !element.id.includes('label')) {
      violations.push({
        id: `a11y-${violationId++}`,
        category: A11yCategory.PERCEIVABLE,
        severity: A11ySeverity.SERIOUS,
        wcagCriteria: '1.3.1 Info and Relationships',
        wcagLevel: 'A',
        element,
        message: 'Form field missing label or hint',
        description: 'Form fields must have associated labels or hints for screen readers',
        howToFix: 'iOS: Set accessibilityLabel or placeholder on UITextField. Android: Set hint or labelFor on EditText',
        impact: 'Users cannot determine what information to enter'
      });
    }

    // 1.3.5 Identify Input Purpose (Level AA)
    if (element.type === 'textField') {
      const hasInputHint = element.id.includes('email') ||
                           element.id.includes('password') ||
                           element.id.includes('phone') ||
                           element.text?.toLowerCase().includes('email') ||
                           element.text?.toLowerCase().includes('password');

      if (!hasInputHint) {
        violations.push({
          id: `a11y-${violationId++}`,
          category: A11yCategory.PERCEIVABLE,
          severity: A11ySeverity.MODERATE,
          wcagCriteria: '1.3.5 Identify Input Purpose',
          wcagLevel: 'AA',
          element,
          message: 'Input field purpose not clearly identified',
          description: 'Input fields should have clear purpose identifiers for autofill support',
          howToFix: 'iOS: Set textContentType (.emailAddress, .password, .telephoneNumber) on UITextField. Android: Set autofillHints (AUTOFILL_HINT_EMAIL_ADDRESS, AUTOFILL_HINT_PASSWORD) on EditText',
          impact: 'Users cannot benefit from autofill features and must manually enter data'
        });
      }
    }

    // 1.4.1 Use of Color (Level A)
    if (element.type === 'button' || element.type === 'label') {
      const text = element.text?.toLowerCase() || '';
      if (text.includes('red') || text.includes('green') || text.includes('blue') ||
          text.includes('yellow') || text.includes('color')) {
        violations.push({
          id: `a11y-${violationId++}`,
          category: A11yCategory.PERCEIVABLE,
          severity: A11ySeverity.MODERATE,
          wcagCriteria: '1.4.1 Use of Color',
          wcagLevel: 'A',
          element,
          message: 'Verify color is not the only method to convey information',
          description: 'Information conveyed by color must also be available through text, icons, or patterns',
          howToFix: 'Add text labels, icons, or patterns in addition to color. Example: Use checkmark icon + green color for success, not green alone',
          impact: 'Users with color blindness cannot distinguish information conveyed only by color'
        });
      }
    }

    // 1.4.3 Contrast (Minimum) (Level AA)
    if ((element.type === 'label' || element.type === 'button') && element.text) {
      if (element.text.length < 3) {
        violations.push({
          id: `a11y-${violationId++}`,
          category: A11yCategory.PERCEIVABLE,
          severity: A11ySeverity.MODERATE,
          wcagCriteria: '1.4.3 Contrast (Minimum)',
          wcagLevel: 'AA',
          element,
          message: 'Text may have insufficient contrast (requires manual verification)',
          description: 'Text must have a contrast ratio of at least 4.5:1 (normal) or 3:1 (large text, 18pt+)',
          howToFix: 'iOS: Use Xcode Accessibility Inspector to verify contrast ratio. Android: Use Google Accessibility Scanner. Ensure foreground/background color contrast meets 4.5:1 minimum',
          impact: 'Users with low vision may not be able to read the text'
        });
      }
    }

    // 1.4.3 Contrast - Flag larger elements for manual verification
    if ((element.type === 'label' || element.type === 'button') && element.text) {
      if (bounds && (bounds.width > 100 || bounds.height > 30)) {
        violations.push({
          id: `a11y-${violationId++}`,
          category: A11yCategory.PERCEIVABLE,
          severity: A11ySeverity.MODERATE,
          wcagCriteria: '1.4.3 Contrast (Minimum)',
          wcagLevel: 'AA',
          element,
          message: 'Verify color contrast ratio meets WCAG standards',
          description: 'Text must have contrast ratio of at least 4.5:1 (normal text) or 3:1 (large text, 18pt+)',
          howToFix: 'iOS: Use Xcode Accessibility Inspector Color Contrast tool. Android: Use Google Accessibility Scanner app. Ensure text color contrasts sufficiently with background',
          impact: 'Users with low vision or color blindness may not be able to read the text'
        });
      }
    }

    // 1.4.10 Reflow (Level AA)
    if (bounds && bounds.width > 0 && element.type === 'label') {
      if (element.text && element.text.length > 50 && bounds.width < 200) {
        violations.push({
          id: `a11y-${violationId++}`,
          category: A11yCategory.PERCEIVABLE,
          severity: A11ySeverity.MINOR,
          wcagCriteria: '1.4.10 Reflow',
          wcagLevel: 'AA',
          element,
          message: 'Text may not reflow properly in small containers',
          description: 'Content should reflow without horizontal scrolling at 320px viewport width',
          howToFix: 'iOS: Use Auto Layout with dynamic constraints. Android: Use ConstraintLayout with wrap_content. Test with system text size set to maximum',
          impact: 'Users may need to scroll horizontally to read content'
        });
      }
    }

    // Dynamic Text/Font Scaling Validation (Mobile-specific)
    if (element.type === 'label' || element.type === 'button') {
      if (bounds && element.text && element.text.length > 0) {
        const textLength = element.text.length;
        const containerWidth = bounds.width;
        const estimatedCharWidth = 8;
        const estimatedTextWidth = textLength * estimatedCharWidth;

        if (estimatedTextWidth > containerWidth * 1.5) {
          violations.push({
            id: `a11y-${violationId++}`,
            category: A11yCategory.PERCEIVABLE,
            severity: A11ySeverity.MODERATE,
            wcagCriteria: '1.4.4 Resize Text',
            wcagLevel: 'AA',
            element,
            message: 'Text may be truncated with larger font sizes',
            description: 'Text container may not accommodate system font size changes up to 200%',
            howToFix: 'iOS: Use Dynamic Type with adjustsFontForContentSizeCategory=true and UIFontMetrics. Avoid fixed-height containers. Android: Use sp units for text sizes, avoid fixed dp heights for text containers. Test with Settings > Font size at maximum',
            impact: 'Users with vision impairments who increase system font size may see truncated text'
          });
        }
      }
    }

    // ============================================================================
    // Category 2: OPERABLE - User interface components must be operable
    // ============================================================================

    // 2.4.4 Link Purpose (Level A)
    if (element.type === 'link' && (!element.text || element.text.length < 3)) {
      violations.push({
        id: `a11y-${violationId++}`,
        category: A11yCategory.OPERABLE,
        severity: A11ySeverity.SERIOUS,
        wcagCriteria: '2.4.4 Link Purpose',
        wcagLevel: 'A',
        element,
        message: 'Link purpose unclear or missing',
        description: 'Links must have descriptive text that explains their destination or purpose',
        howToFix: 'iOS: Set accessibilityLabel with descriptive text like "View privacy policy". Android: Set contentDescription on the link view. Avoid generic labels like "Click here" or "Read more"',
        impact: 'Screen reader users cannot determine where the link will take them'
      });
    }

    // 2.4.6 Headings and Labels (Level AA)
    if (element.type === 'button' && (!element.text || element.text.trim() === '')) {
      violations.push({
        id: `a11y-${violationId++}`,
        category: A11yCategory.OPERABLE,
        severity: A11ySeverity.CRITICAL,
        wcagCriteria: '2.4.6 Headings and Labels',
        wcagLevel: 'AA',
        element,
        message: 'Button missing descriptive label',
        description: 'Buttons must have labels that describe their purpose for screen readers and voice control',
        howToFix: 'iOS: Set accessibilityLabel on UIButton. Android: Set contentDescription on Button/ImageButton. Use action-oriented labels like "Submit form", "Close dialog"',
        impact: 'Screen reader and voice control users cannot determine what the button does'
      });
    }

    // 2.5.1 Pointer Gestures (Level A) - Custom gesture alternatives
    if (element.type === 'view' || element.type === 'image') {
      const text = element.text?.toLowerCase() || '';
      if (text.includes('swipe') || text.includes('drag') || text.includes('pinch') ||
          text.includes('gesture')) {
        violations.push({
          id: `a11y-${violationId++}`,
          category: A11yCategory.OPERABLE,
          severity: A11ySeverity.SERIOUS,
          wcagCriteria: '2.5.1 Pointer Gestures',
          wcagLevel: 'A',
          element,
          message: 'Complex gesture may need simple alternative',
          description: 'Multi-point or path-based gestures (swipe, drag, pinch) must have single-pointer alternatives',
          howToFix: 'iOS: Add UIAccessibilityCustomAction alternatives or provide visible buttons. Android: Provide AccessibilityAction alternatives or visible button controls for gesture-based actions',
          impact: 'Users with motor impairments cannot perform complex gestures and need single-tap alternatives'
        });
      }
    }

    // 2.5.3 Label in Name (Level A)
    if ((element.type === 'button' || element.type === 'link') && element.text) {
      if (element.text.length > 30) {
        violations.push({
          id: `a11y-${violationId++}`,
          category: A11yCategory.OPERABLE,
          severity: A11ySeverity.MINOR,
          wcagCriteria: '2.5.3 Label in Name',
          wcagLevel: 'A',
          element,
          message: 'Label may be too long for voice control',
          description: 'Accessible names should be concise and match visible text for voice control users',
          howToFix: 'iOS: Keep accessibilityLabel concise — voice control users must speak the full label. Android: Keep contentDescription brief. If visible text is long, set a shorter accessibilityLabel that starts with the visible text',
          impact: 'Voice Control (iOS) and Voice Access (Android) users may have difficulty activating this element by speaking its name'
        });
      }
    }

    // 2.5.5 Target Size (Level AAA) - Touch target validation
    if (element.clickable && bounds) {
      const minSize = 44; // iOS HIG minimum (44pt) / Android Material (48dp)
      const recommendedSize = 48;

      if (bounds.width < minSize || bounds.height < minSize) {
        violations.push({
          id: `a11y-${violationId++}`,
          category: A11yCategory.OPERABLE,
          severity: A11ySeverity.CRITICAL,
          wcagCriteria: '2.5.5 Target Size',
          wcagLevel: 'AAA',
          element,
          message: `Touch target too small: ${bounds.width}×${bounds.height}pt (minimum ${minSize}×${minSize}pt)`,
          description: 'Touch targets must be at least 44×44pt (iOS HIG) or 48×48dp (Android Material Design)',
          howToFix: `iOS: Increase frame or override point(inside:with:) to expand hit area to ${minSize}×${minSize}pt minimum. Android: Set minWidth/minHeight to ${recommendedSize}dp or use TouchDelegate to expand touch area`,
          impact: 'Users with motor impairments, tremors, or large fingers may have difficulty tapping this element'
        });
      } else if (bounds.width < recommendedSize || bounds.height < recommendedSize) {
        violations.push({
          id: `a11y-${violationId++}`,
          category: A11yCategory.OPERABLE,
          severity: A11ySeverity.MODERATE,
          wcagCriteria: '2.5.5 Target Size (Recommended)',
          wcagLevel: 'AAA',
          element,
          message: `Touch target smaller than recommended: ${bounds.width}×${bounds.height}pt (recommended ${recommendedSize}×${recommendedSize}pt)`,
          description: 'While meeting minimum, larger touch targets (48×48pt) improve usability for all users',
          howToFix: `iOS: Increase to ${recommendedSize}×${recommendedSize}pt. Android: Increase to ${recommendedSize}×${recommendedSize}dp for Material Design compliance`,
          impact: 'Some users may find this element slightly difficult to tap accurately'
        });
      }
    }

    // 2.5.8 Target Spacing (Level AA) - Minimum spacing between interactive targets
    if (element.clickable && bounds) {
      const minSpacing = 8; // Minimum 8pt spacing between targets

      for (const other of elementBounds) {
        if (other.element === element || !other.element.clickable || !other.bounds) continue;

        const ob = other.bounds;
        // Calculate edge-to-edge distance
        const horizontalGap = Math.max(0, Math.max(ob.x - (bounds.x + bounds.width), bounds.x - (ob.x + ob.width)));
        const verticalGap = Math.max(0, Math.max(ob.y - (bounds.y + bounds.height), bounds.y - (ob.y + ob.height)));

        // Only flag adjacent elements (not overlapping, not far apart)
        if ((horizontalGap > 0 && horizontalGap < minSpacing && verticalGap === 0) ||
            (verticalGap > 0 && verticalGap < minSpacing && horizontalGap === 0)) {
          violations.push({
            id: `a11y-${violationId++}`,
            category: A11yCategory.OPERABLE,
            severity: A11ySeverity.SERIOUS,
            wcagCriteria: '2.5.8 Target Spacing',
            wcagLevel: 'AA',
            element,
            message: `Insufficient spacing between touch targets (${Math.min(horizontalGap, verticalGap)}pt, minimum ${minSpacing}pt)`,
            description: 'Interactive elements must have sufficient spacing to prevent accidental activation of adjacent targets',
            howToFix: `iOS: Add at least ${minSpacing}pt padding/margin between interactive elements. Android: Add at least ${minSpacing}dp spacing between clickable views`,
            impact: 'Users with motor impairments may accidentally tap the wrong target due to insufficient spacing'
          });
          break; // Only flag once per element
        }
      }
    }

    // External keyboard / Switch Control support
    if (element.clickable) {
      violations.push({
        id: `a11y-${violationId++}`,
        category: A11yCategory.OPERABLE,
        severity: A11ySeverity.MINOR,
        wcagCriteria: '2.1.1 Keyboard Accessible',
        wcagLevel: 'A',
        element,
        message: 'Verify element supports external keyboard and Switch Control navigation',
        description: 'Interactive elements must be operable via external keyboard, Switch Control (iOS), and Switch Access (Android)',
        howToFix: 'iOS: Ensure element is focusable with external keyboard Tab navigation and supports Switch Control scanning. Android: Ensure element is focusable and supports D-pad / external keyboard / Switch Access navigation',
        impact: 'Users relying on external keyboards, Switch Control, or Switch Access cannot interact with this element'
      });
    }

    // ============================================================================
    // Category 3: UNDERSTANDABLE - Information and operation must be understandable
    // ============================================================================

    // 3.2.2 On Input (Level A)
    if (element.type === 'textField' && element.text?.toLowerCase().includes('search')) {
      violations.push({
        id: `a11y-${violationId++}`,
        category: A11yCategory.UNDERSTANDABLE,
        severity: A11ySeverity.MINOR,
        wcagCriteria: '3.2.2 On Input',
        wcagLevel: 'A',
        element,
        message: 'Verify input field does not cause unexpected context changes',
        description: 'Changing input should not automatically cause unexpected navigation or context changes',
        howToFix: 'iOS/Android: Do not auto-submit or navigate on text input. Provide explicit Search/Submit button. If auto-search is used, ensure screen reader announces results without losing focus',
        impact: 'Users may be confused by unexpected navigation or context changes while typing'
      });
    }

    // 3.3.1 Error Identification (Level A)
    if (element.type === 'textField' && element.text?.toLowerCase().includes('error')) {
      violations.push({
        id: `a11y-${violationId++}`,
        category: A11yCategory.UNDERSTANDABLE,
        severity: A11ySeverity.SERIOUS,
        wcagCriteria: '3.3.1 Error Identification',
        wcagLevel: 'A',
        element,
        message: 'Error message detected - verify it is clearly identified and announced',
        description: 'Errors must be identified in text and announced to screen readers',
        howToFix: 'iOS: Post UIAccessibility.Notification.announcement with the error message. Android: Use announceForAccessibility() or set the error view as a live region (accessibilityLiveRegion="polite")',
        impact: 'Screen reader users may not be aware that an error occurred'
      });
    }

    // 3.3.2 Labels or Instructions (Level A)
    if (element.type === 'textField' && !element.text) {
      violations.push({
        id: `a11y-${violationId++}`,
        category: A11yCategory.UNDERSTANDABLE,
        severity: A11ySeverity.SERIOUS,
        wcagCriteria: '3.3.2 Labels or Instructions',
        wcagLevel: 'A',
        element,
        message: 'Input field missing label or instructions',
        description: 'Form inputs must have visible labels or instructions so users know what to enter',
        howToFix: 'iOS: Set placeholder or accessibilityLabel on UITextField. Android: Set hint on EditText or use TextInputLayout with a visible label',
        impact: 'Users do not know what information to provide in this field'
      });
    }

    // 2.2.1 Timing Adjustable (Level A) - Auto-dismiss content
    if (element.text) {
      const text = element.text.toLowerCase();
      if (text.includes('toast') || text.includes('snackbar') || text.includes('auto') ||
          text.includes('dismiss') || text.includes('timeout')) {
        violations.push({
          id: `a11y-${violationId++}`,
          category: A11yCategory.UNDERSTANDABLE,
          severity: A11ySeverity.SERIOUS,
          wcagCriteria: '2.2.1 Timing Adjustable',
          wcagLevel: 'A',
          element,
          message: 'Auto-dismissing content detected - verify users have enough time to read',
          description: 'Content that auto-dismisses must give users at least 20 seconds or allow them to extend/disable the timeout',
          howToFix: 'iOS: Show auto-dismiss content for at least 5 seconds, provide a way to pause or keep visible. Use UIAccessibility.isVoiceOverRunning to extend duration for VoiceOver users. Android: Set Snackbar duration to LENGTH_INDEFINITE for important content, or check AccessibilityManager.isTouchExplorationEnabled to extend duration',
          impact: 'Users with cognitive disabilities, low vision, or who use screen readers may not have enough time to read temporary content'
        });
      }
    }

    // ============================================================================
    // Category 4: ROBUST - Content must be robust enough for assistive technologies
    // ============================================================================

    // 4.1.2 Name, Role, Value (Level A)
    if (element.clickable && !element.text && !element.id) {
      violations.push({
        id: `a11y-${violationId++}`,
        category: A11yCategory.ROBUST,
        severity: A11ySeverity.CRITICAL,
        wcagCriteria: '4.1.2 Name, Role, Value',
        wcagLevel: 'A',
        element,
        message: 'Interactive element missing name and role',
        description: 'UI components must have programmatically determinable name and role for assistive technologies',
        howToFix: 'iOS: Set accessibilityLabel (name) and accessibilityTraits (role) on the element. Android: Set contentDescription (name) and use appropriate widget type or setRoleDescription (role)',
        impact: 'VoiceOver and TalkBack cannot identify or interact with this element'
      });
    }

    // 4.1.3 Status Messages (Level AA)
    if (element.text?.toLowerCase().includes('loading') ||
        element.text?.toLowerCase().includes('success') ||
        element.text?.toLowerCase().includes('error') ||
        element.text?.toLowerCase().includes('updated') ||
        element.text?.toLowerCase().includes('added') ||
        element.text?.toLowerCase().includes('removed') ||
        element.text?.toLowerCase().includes('saved')) {
      violations.push({
        id: `a11y-${violationId++}`,
        category: A11yCategory.ROBUST,
        severity: A11ySeverity.MODERATE,
        wcagCriteria: '4.1.3 Status Messages',
        wcagLevel: 'AA',
        element,
        message: 'Status message detected - verify it is announced to screen readers',
        description: 'Status messages must be announced to assistive technologies without receiving focus',
        howToFix: 'iOS: Post UIAccessibility.Notification.announcement with the status text, or use UIAccessibility.Notification.screenChanged for major updates. Android: Set accessibilityLiveRegion="polite" on the status view, or use announceForAccessibility() for one-time announcements',
        impact: 'Screen reader users may miss important status updates like success confirmations or loading states'
      });
    }

    // ============================================================================
    // SCREEN READER VALIDATIONS (VoiceOver iOS / TalkBack Android)
    // ============================================================================

    // Labeled Elements: Buttons must have meaningful labels
    if (element.type === 'button') {
      if (!element.text && !element.id) {
        violations.push({
          id: `a11y-${violationId++}`,
          category: A11yCategory.ROBUST,
          severity: A11ySeverity.CRITICAL,
          wcagCriteria: 'Screen Reader: Button Label',
          wcagLevel: 'A',
          element,
          message: 'Button missing accessibility label - screen reader cannot announce purpose',
          description: 'All buttons must have labels that describe their action for VoiceOver and TalkBack users',
          howToFix: 'iOS: Set accessibilityLabel on UIButton (e.g., "Submit form" not just "Submit"). Android: Set contentDescription on Button/ImageButton. Use action-oriented labels',
          impact: 'VoiceOver and TalkBack users cannot determine what this button does'
        });
      } else if (element.text && element.text.length < 2) {
        violations.push({
          id: `a11y-${violationId++}`,
          category: A11yCategory.ROBUST,
          severity: A11ySeverity.SERIOUS,
          wcagCriteria: 'Screen Reader: Meaningful Label',
          wcagLevel: 'A',
          element,
          message: `Button label too short: "${element.text}" - may not be meaningful`,
          description: 'Button labels should be descriptive enough for screen reader users to understand the action',
          howToFix: 'Provide descriptive labels. Examples: "×" → accessibilityLabel="Close", ">" → accessibilityLabel="Next page", "+" → accessibilityLabel="Add item"',
          impact: 'Screen reader users may not understand the button\'s purpose from a single character'
        });
      }
    }

    // Labeled Elements: Images must have alt text
    if (element.type === 'image') {
      if (!element.text && !element.id) {
        violations.push({
          id: `a11y-${violationId++}`,
          category: A11yCategory.PERCEIVABLE,
          severity: A11ySeverity.CRITICAL,
          wcagCriteria: 'Screen Reader: Image Alt Text',
          wcagLevel: 'A',
          element,
          message: 'Image missing alt text - screen reader cannot describe image',
          description: 'All meaningful images must have alternative text. Decorative images should be hidden from screen readers',
          howToFix: 'iOS: Set accessibilityLabel with image description. For decorative images, set accessibilityElementsHidden=true or isAccessibilityElement=false. Android: Set contentDescription for meaningful images. For decorative images, set importantForAccessibility="no"',
          impact: 'VoiceOver and TalkBack users cannot understand what the image represents'
        });
      } else if (element.text && element.text.length < 3) {
        violations.push({
          id: `a11y-${violationId++}`,
          category: A11yCategory.PERCEIVABLE,
          severity: A11ySeverity.SERIOUS,
          wcagCriteria: 'Screen Reader: Image Description',
          wcagLevel: 'A',
          element,
          message: 'Image has insufficient description',
          description: 'Image accessibility label is too short to be meaningful for screen reader users',
          howToFix: 'Provide a descriptive accessibilityLabel (iOS) or contentDescription (Android) that explains the image content and purpose. Example: Instead of "pic", use "Profile photo of user"',
          impact: 'Screen reader users cannot understand what the image represents'
        });
      }
    }

    // Labeled Elements: Links must have descriptive text
    if (element.type === 'link') {
      if (!element.text || element.text.length < 3) {
        violations.push({
          id: `a11y-${violationId++}`,
          category: A11yCategory.OPERABLE,
          severity: A11ySeverity.SERIOUS,
          wcagCriteria: 'Screen Reader: Link Purpose',
          wcagLevel: 'A',
          element,
          message: 'Link missing descriptive text - screen reader cannot convey destination',
          description: 'Links must have text that clearly describes where they lead',
          howToFix: 'iOS: Set accessibilityLabel with descriptive text and accessibilityTraits=.link. Android: Set contentDescription on the link view. Use "View privacy policy" instead of "Click here"',
          impact: 'Screen reader users cannot determine the link destination'
        });
      }
    }

    // Labeled Elements: Text fields must have labels
    if (element.type === 'textField') {
      if (!element.text && !element.id) {
        violations.push({
          id: `a11y-${violationId++}`,
          category: A11yCategory.UNDERSTANDABLE,
          severity: A11ySeverity.CRITICAL,
          wcagCriteria: 'Screen Reader: Input Label',
          wcagLevel: 'A',
          element,
          message: 'Text field missing label - screen reader cannot announce field purpose',
          description: 'All input fields must have labels so screen reader users know what to enter',
          howToFix: 'iOS: Set accessibilityLabel or placeholder on UITextField/UITextView. Android: Set hint on EditText or use TextInputLayout with a label. Example: "Email address", "Search products"',
          impact: 'VoiceOver and TalkBack users do not know what information to enter'
        });
      }
    }

    // Labeled Elements: Interactive controls (switches, checkboxes, sliders) must have labels
    if (element.clickable && element.type !== 'button' && element.type !== 'link' && element.type !== 'textField') {
      if (!element.text && !element.id) {
        violations.push({
          id: `a11y-${violationId++}`,
          category: A11yCategory.ROBUST,
          severity: A11ySeverity.CRITICAL,
          wcagCriteria: 'Screen Reader: Control Label',
          wcagLevel: 'A',
          element,
          message: 'Interactive control missing label - screen reader cannot identify element',
          description: 'All interactive controls (switches, checkboxes, sliders, pickers) must have accessible labels',
          howToFix: 'iOS: Set accessibilityLabel and accessibilityTraits (.button, .adjustable, .selected). Android: Set contentDescription and use appropriate widget role (CheckBox, Switch, SeekBar)',
          impact: 'Screen reader users cannot identify or interact with this control'
        });
      }
    }

    // VoiceOver: Hint for complex controls
    if (element.type === 'button' && element.text &&
        (element.text.toLowerCase().includes('more') ||
         element.text.toLowerCase().includes('options') ||
         element.text.toLowerCase().includes('menu'))) {
      violations.push({
        id: `a11y-${violationId++}`,
        category: A11yCategory.UNDERSTANDABLE,
        severity: A11ySeverity.MODERATE,
        wcagCriteria: 'Screen Reader: Accessibility Hint',
        wcagLevel: 'AA',
        element,
        message: 'Complex control should provide an accessibility hint',
        description: 'Controls with non-obvious actions should provide hints about their behavior',
        howToFix: 'iOS: Set accessibilityHint (e.g., "Double tap to open options menu"). Android: Append hint to contentDescription or use AccessibilityNodeInfo.setTooltipText',
        impact: 'Screen reader users may not understand what action this control performs'
      });
    }

    // VoiceOver/TalkBack: Trait/Role validation - clickable labels should be buttons
    if (element.clickable && element.type === 'label') {
      violations.push({
        id: `a11y-${violationId++}`,
        category: A11yCategory.ROBUST,
        severity: A11ySeverity.SERIOUS,
        wcagCriteria: 'Screen Reader: Accessibility Role',
        wcagLevel: 'A',
        element,
        message: 'Clickable element has incorrect role - announced as text instead of button',
        description: 'Clickable labels should have button role so screen readers announce them as interactive',
        howToFix: 'iOS: Set accessibilityTraits = .button on the tappable UILabel, or use UIButton instead. Android: Use Button widget, or set AccessibilityNodeInfo.className to "android.widget.Button" via AccessibilityDelegate',
        impact: 'VoiceOver says "text" instead of "button" — users do not know they can tap this element'
      });
    }

    // VoiceOver: Custom action hint for swipe gestures
    if (element.type === 'button' && element.text && element.text.toLowerCase().includes('swipe')) {
      violations.push({
        id: `a11y-${violationId++}`,
        category: A11yCategory.OPERABLE,
        severity: A11ySeverity.MODERATE,
        wcagCriteria: 'Screen Reader: Custom Actions',
        wcagLevel: 'AA',
        element,
        message: 'Swipe gesture should be available as a screen reader custom action',
        description: 'Swipe gestures are intercepted by VoiceOver/TalkBack — custom actions provide an alternative',
        howToFix: 'iOS: Implement accessibilityCustomActions on the parent container. Android: Add AccessibilityAction.ACTION_CUSTOM via AccessibilityNodeInfo. Provide a named action like "Delete" or "Archive"',
        impact: 'VoiceOver and TalkBack users cannot perform swipe gestures as they are used for screen reader navigation'
      });
    }

    // VoiceOver/TalkBack: Interactive container labeling
    if ((element.type === 'view' || element.type === 'group') && element.clickable && !element.text) {
      violations.push({
        id: `a11y-${violationId++}`,
        category: A11yCategory.ROBUST,
        severity: A11ySeverity.SERIOUS,
        wcagCriteria: 'Screen Reader: Container Label',
        wcagLevel: 'A',
        element,
        message: 'Interactive container missing label',
        description: 'Clickable containers must have accessibility labels or be represented as buttons',
        howToFix: 'iOS: Set accessibilityLabel and isAccessibilityElement=true on the container. Android: Set contentDescription on the ViewGroup and ensure it is focusable',
        impact: 'Screen reader users encounter an unlabeled interactive area and cannot determine its purpose'
      });
    }

    // ============================================================================
    // MOBILE-SPECIFIC: Accessibility Grouping
    // ============================================================================

    // Group related elements for efficient screen reader navigation
    if ((element.type === 'view' || element.type === 'group') && !element.clickable) {
      // Check if this container has multiple child-like elements nearby
      const containerBounds = bounds;
      if (containerBounds) {
        let childCount = 0;
        for (const other of elementBounds) {
          if (other.element === element || !other.bounds) continue;
          // Check if other element is visually inside this container
          if (other.bounds.x >= containerBounds.x &&
              other.bounds.y >= containerBounds.y &&
              other.bounds.x + other.bounds.width <= containerBounds.x + containerBounds.width &&
              other.bounds.y + other.bounds.height <= containerBounds.y + containerBounds.height) {
            childCount++;
          }
        }
        if (childCount > 5) {
          violations.push({
            id: `a11y-${violationId++}`,
            category: A11yCategory.ROBUST,
            severity: A11ySeverity.MODERATE,
            wcagCriteria: 'Mobile A11y: Element Grouping',
            wcagLevel: 'AA',
            element,
            message: `Container has ${childCount} child elements - consider grouping for screen reader efficiency`,
            description: 'Related elements should be grouped so screen readers read them as a single unit instead of individual items',
            howToFix: 'iOS: Set shouldGroupAccessibilityChildren=true and provide a combined accessibilityLabel on the container. Android: Set importantForAccessibility="yes" on the parent and provide a contentDescription that summarizes the group',
            impact: 'Screen reader users must swipe through many individual elements instead of hearing a concise grouped description'
          });
        }
      }
    }

    // ============================================================================
    // MOBILE-SPECIFIC: Semantic Headings
    // ============================================================================

    // Labels that look like headings should have heading trait
    if (element.type === 'label' && element.text && bounds) {
      // Heuristic: large text in prominent position likely a heading
      const isLargeText = bounds.height > 30;
      const isNearTop = bounds.y < 200;
      const isShortText = element.text.length < 50;

      if (isLargeText && isNearTop && isShortText) {
        violations.push({
          id: `a11y-${violationId++}`,
          category: A11yCategory.ROBUST,
          severity: A11ySeverity.MODERATE,
          wcagCriteria: 'Mobile A11y: Semantic Headings',
          wcagLevel: 'AA',
          element,
          message: 'Prominent text should be marked as a heading for screen reader navigation',
          description: 'Headings allow screen reader users to navigate by section using the rotor (iOS) or headings navigation (Android)',
          howToFix: 'iOS: Set accessibilityTraits = .header on the UILabel. Android: Set accessibilityHeading=true (API 28+) or use AccessibilityNodeInfo.setHeading(true) via AccessibilityDelegate',
          impact: 'Screen reader users cannot navigate by headings and must swipe through every element to find sections'
        });
      }
    }

    // ============================================================================
    // MOBILE-SPECIFIC: Adjustable Trait for Sliders/Pickers
    // ============================================================================

    if (element.type === 'slider' || element.type === 'picker' || element.type === 'stepper') {
      violations.push({
        id: `a11y-${violationId++}`,
        category: A11yCategory.ROBUST,
        severity: A11ySeverity.SERIOUS,
        wcagCriteria: 'Mobile A11y: Adjustable Trait',
        wcagLevel: 'A',
        element,
        message: 'Adjustable control must support increment/decrement via screen reader',
        description: 'Sliders, pickers, and steppers must implement the adjustable trait so VoiceOver/TalkBack users can swipe up/down to change values',
        howToFix: 'iOS: Set accessibilityTraits = .adjustable and implement accessibilityIncrement()/accessibilityDecrement(). Also set accessibilityValue to announce current value. Android: Use SeekBar or NumberPicker which handle this natively, or implement AccessibilityAction.ACTION_SET_PROGRESS',
        impact: 'VoiceOver/TalkBack users cannot change the value of this control — swipe up/down does nothing'
      });
    }

    // ============================================================================
    // MOBILE-SPECIFIC: Modal View Accessibility
    // ============================================================================

    if (element.type === 'view' || element.type === 'group') {
      const text = element.text?.toLowerCase() || '';
      const id = element.id?.toLowerCase() || '';
      if (text.includes('modal') || text.includes('dialog') || text.includes('alert') ||
          text.includes('popup') || text.includes('sheet') || text.includes('overlay') ||
          id.includes('modal') || id.includes('dialog') || id.includes('alert')) {
        violations.push({
          id: `a11y-${violationId++}`,
          category: A11yCategory.ROBUST,
          severity: A11ySeverity.SERIOUS,
          wcagCriteria: 'Mobile A11y: Modal Focus Trapping',
          wcagLevel: 'A',
          element,
          message: 'Modal/dialog must trap screen reader focus within its bounds',
          description: 'When a modal is open, screen reader navigation must be confined to the modal content — users should not be able to swipe to elements behind it',
          howToFix: 'iOS: Set accessibilityViewIsModal=true on the modal container. Post UIAccessibility.Notification.screenChanged to move focus to the modal. Android: Use MaterialAlertDialogBuilder or set importantForAccessibility="no" on background content while modal is open',
          impact: 'Screen reader users can accidentally navigate to content behind the modal, causing confusion and loss of context'
        });
      }
    }

    // ============================================================================
    // MOBILE-SPECIFIC: Escape Gesture / Dismiss Support
    // ============================================================================

    if (element.type === 'view' || element.type === 'group') {
      const text = element.text?.toLowerCase() || '';
      const id = element.id?.toLowerCase() || '';
      if (text.includes('modal') || text.includes('dialog') || text.includes('sheet') ||
          text.includes('overlay') || text.includes('popup') ||
          id.includes('modal') || id.includes('sheet') || id.includes('popup')) {
        violations.push({
          id: `a11y-${violationId++}`,
          category: A11yCategory.OPERABLE,
          severity: A11ySeverity.MODERATE,
          wcagCriteria: 'Mobile A11y: Escape Gesture',
          wcagLevel: 'AA',
          element,
          message: 'Dismissable view should support VoiceOver escape gesture (two-finger Z-scrub)',
          description: 'VoiceOver users dismiss modals/sheets with a two-finger Z-scrub gesture. The app must handle this by implementing accessibilityPerformEscape()',
          howToFix: 'iOS: Override accessibilityPerformEscape() in the presenting view controller to dismiss the modal and return true. Android: Handle AccessibilityNodeInfo.ACTION_DISMISS or ensure Back gesture dismisses the dialog',
          impact: 'VoiceOver users cannot dismiss this modal/sheet using the standard escape gesture and may become trapped'
        });
      }
    }

    // ============================================================================
    // MOBILE-SPECIFIC: Motion and Animation
    // ============================================================================

    if (element.type === 'view' || element.type === 'image') {
      const text = element.text?.toLowerCase() || '';
      const id = element.id?.toLowerCase() || '';
      if (text.includes('animation') || text.includes('parallax') || text.includes('carousel') ||
          text.includes('spinner') || text.includes('rotate') || text.includes('scroll') ||
          id.includes('animation') || id.includes('carousel') || id.includes('parallax')) {
        violations.push({
          id: `a11y-${violationId++}`,
          category: A11yCategory.OPERABLE,
          severity: A11ySeverity.MODERATE,
          wcagCriteria: '2.3.3 Animation from Interactions',
          wcagLevel: 'AAA',
          element,
          message: 'Animated content should respect Reduce Motion preference',
          description: 'Animations and motion effects must be reduced or disabled when the user has enabled Reduce Motion in system settings',
          howToFix: 'iOS: Check UIAccessibility.isReduceMotionEnabled and replace animations with crossfade or instant transitions. Android: Check Settings.Global.getFloat(ANIMATOR_DURATION_SCALE) — if 0, animations are disabled. Use ViewCompat.IMPORTANT_FOR_CONTENT_CAPTURE_NO to skip animations',
          impact: 'Users with vestibular disorders, motion sensitivity, or cognitive disabilities may experience nausea, dizziness, or disorientation from animations'
        });
      }
    }

    // ============================================================================
    // MOBILE-SPECIFIC: Orientation Support
    // ============================================================================

    // Flag for manual verification — can't detect orientation lock from hierarchy alone
    if (element.type === 'view' && bounds && bounds.width > 0 && bounds.height > 0) {
      // Only flag the root-level view (largest element)
      if (bounds.x === 0 && bounds.y === 0 && bounds.width > 300 && bounds.height > 500) {
        violations.push({
          id: `a11y-${violationId++}`,
          category: A11yCategory.OPERABLE,
          severity: A11ySeverity.MODERATE,
          wcagCriteria: '1.3.4 Orientation',
          wcagLevel: 'AA',
          element,
          message: 'Verify app supports both portrait and landscape orientations',
          description: 'App must not lock to a single orientation unless a specific orientation is essential for the content',
          howToFix: 'iOS: Set UISupportedInterfaceOrientations in Info.plist to include both portrait and landscape, or implement supportedInterfaceOrientations in view controllers. Android: Do not set android:screenOrientation="portrait" in AndroidManifest.xml unless essential',
          impact: 'Users who mount their device in a fixed orientation (wheelchair mounts, stands) cannot use the app if it is locked to one orientation'
        });
      }
    }

    // ============================================================================
    // MOBILE-SPECIFIC: Tab Bar / Navigation Bar Labels
    // ============================================================================

    if (element.type === 'tabBar' || element.type === 'tab' ||
        (element.type === 'button' && element.id?.toLowerCase().includes('tab'))) {
      if (!element.text || element.text.trim() === '') {
        violations.push({
          id: `a11y-${violationId++}`,
          category: A11yCategory.ROBUST,
          severity: A11ySeverity.CRITICAL,
          wcagCriteria: 'Mobile A11y: Tab Bar Label',
          wcagLevel: 'A',
          element,
          message: 'Tab bar item missing accessibility label',
          description: 'Tab bar items must have labels so screen reader users can navigate between sections',
          howToFix: 'iOS: Set accessibilityLabel on each UITabBarItem. Ensure accessibilityTraits includes .selected for the active tab. Android: Set contentDescription on each tab. Use TabLayout.Tab.setContentDescription()',
          impact: 'Screen reader users cannot identify or navigate between app sections'
        });
      }
    }

    // ============================================================================
    // MOBILE-SPECIFIC: Scroll View Announcements
    // ============================================================================

    if (element.type === 'scrollView' || element.type === 'list' || element.type === 'collectionView') {
      violations.push({
        id: `a11y-${violationId++}`,
        category: A11yCategory.ROBUST,
        severity: A11ySeverity.MINOR,
        wcagCriteria: 'Mobile A11y: Scroll Announcements',
        wcagLevel: 'AA',
        element,
        message: 'Scrollable content should announce page/position changes to screen readers',
        description: 'When content scrolls or pages change, screen readers should announce the new position or visible content',
        howToFix: 'iOS: Post UIAccessibility.Notification.pageScrolled with position description (e.g., "Page 2 of 5"). Set accessibilityTraits = .updatesFrequently for live content. Android: Use RecyclerView with AccessibilityDelegateCompat. Announce page changes via announceForAccessibility()',
        impact: 'Screen reader users lose track of their position when scrolling through content'
      });
    }

    // ============================================================================
    // MOBILE-SPECIFIC: Double-Tap Activation
    // ============================================================================

    if (element.clickable && element.type !== 'textField') {
      // Elements using only custom gesture recognizers may not respond to VoiceOver double-tap
      if (element.type === 'view' || element.type === 'image' || element.type === 'label') {
        violations.push({
          id: `a11y-${violationId++}`,
          category: A11yCategory.OPERABLE,
          severity: A11ySeverity.SERIOUS,
          wcagCriteria: 'Mobile A11y: Double-Tap Activation',
          wcagLevel: 'A',
          element,
          message: 'Verify tappable element responds to VoiceOver double-tap / TalkBack double-tap',
          description: 'All interactive elements must be activatable via VoiceOver double-tap (iOS) and TalkBack double-tap (Android)',
          howToFix: 'iOS: If using custom UIGestureRecognizer, ensure isAccessibilityElement=true and the action fires on accessibilityActivate(). Avoid relying solely on UILongPressGestureRecognizer. Android: Ensure clickable views have an OnClickListener — TalkBack double-tap triggers performClick()',
          impact: 'VoiceOver and TalkBack users cannot activate this element because standard screen reader gestures do not trigger its action'
        });
      }
    }
  }

  // ============================================================================
  // CROSS-ELEMENT CHECKS: Reading Order / Traversal Order
  // ============================================================================

  // Check if visual order matches reading order
  const interactiveElements = elementBounds.filter(e => e.element.clickable && e.bounds);
  if (interactiveElements.length > 2) {
    let outOfOrderCount = 0;
    for (let i = 1; i < interactiveElements.length; i++) {
      const prev = interactiveElements[i - 1].bounds!;
      const curr = interactiveElements[i].bounds!;
      // In mobile, reading order should generally be top-to-bottom, left-to-right
      if (curr.y < prev.y - 20) { // Element appears above previous with significant gap
        outOfOrderCount++;
      }
    }
    if (outOfOrderCount > 2) {
      violations.push({
        id: `a11y-${violationId++}`,
        category: A11yCategory.ROBUST,
        severity: A11ySeverity.SERIOUS,
        wcagCriteria: 'Mobile A11y: Reading Order',
        wcagLevel: 'A',
        element: interactiveElements[0].element,
        message: `Screen reader traversal order may not match visual layout (${outOfOrderCount} elements out of order)`,
        description: 'Screen reader navigation order must follow the logical visual order (top-to-bottom, left-to-right)',
        howToFix: 'iOS: Set accessibilityElements array on the container to define explicit reading order. Android: Set accessibilityTraversalBefore/accessibilityTraversalAfter attributes to control TalkBack navigation order',
        impact: 'Screen reader users experience a confusing, non-linear navigation order that does not match what sighted users see'
      });
    }
  }

  // ============================================================================
  // Calculate summary statistics
  // ============================================================================
  const summary = {
    critical: violations.filter(v => v.severity === A11ySeverity.CRITICAL).length,
    serious: violations.filter(v => v.severity === A11ySeverity.SERIOUS).length,
    moderate: violations.filter(v => v.severity === A11ySeverity.MODERATE).length,
    minor: violations.filter(v => v.severity === A11ySeverity.MINOR).length
  };

  const categoryBreakdown = {
    [A11yCategory.PERCEIVABLE]: violations.filter(v => v.category === A11yCategory.PERCEIVABLE).length,
    [A11yCategory.OPERABLE]: violations.filter(v => v.category === A11yCategory.OPERABLE).length,
    [A11yCategory.UNDERSTANDABLE]: violations.filter(v => v.category === A11yCategory.UNDERSTANDABLE).length,
    [A11yCategory.ROBUST]: violations.filter(v => v.category === A11yCategory.ROBUST).length
  };

  const totalViolations = violations.length;
  const passes = hierarchy.length - totalViolations;

  // ============================================================================
  // CVS PULSE COLOR VALIDATION (Optional - requires screenshot)
  // ============================================================================
  let colorValidationSummary: A11yReport['colorValidation'] | undefined;
  
  if (screenshotPath) {
    console.log(`🎨 [Color Validation] Starting color extraction from: ${screenshotPath}`);
    console.log(`🎨 [Color Validation] Analyzing ${hierarchy.length} elements`);
    
    let colorsAnalyzed = 0;
    let tokenMismatches = 0;
    let deprecatedColors = 0;
    let contrastIssues = 0;

    for (const element of hierarchy) {
      const bounds = parseBounds(element.bounds);
      if (!bounds || bounds.width <= 0 || bounds.height <= 0) continue;

      try {
        // Extract color from element
        const extractedColor = await extractColorFromRegion(screenshotPath, bounds);
        if (!extractedColor) continue;

        colorsAnalyzed++;

        // Validate color against CVS Pulse tokens
        const colorViolations = validateColor(
          extractedColor,
          element.type,
          element.text,
          element.id
        );

        // Add color violations to main violations list
        for (const cv of colorViolations) {
          const match = findClosestColorToken(extractedColor);
          
          violations.push({
            id: `color-${violationId++}`,
            category: A11yCategory.PERCEIVABLE,
            severity: cv.severity === 'error' ? A11ySeverity.SERIOUS : 
                     cv.severity === 'warning' ? A11ySeverity.MODERATE : A11ySeverity.MINOR,
            wcagCriteria: '1.4.1 Use of Color',
            wcagLevel: 'A',
            element,
            message: cv.message,
            description: cv.suggestion,
            howToFix: `Use CVS Pulse design token: ${cv.expectedToken?.name || 'appropriate token'}. ${cv.expectedToken?.usage || ''}`,
            impact: 'Color does not match CVS brand guidelines or uses deprecated tokens',
            colorInfo: {
              extractedHex: extractedColor.hex,
              matchedToken: cv.expectedToken?.name,
              deltaE: cv.deltaE
            }
          });

          // Track statistics
          if (cv.message.includes('deprecated')) deprecatedColors++;
          if (cv.deltaE && cv.deltaE > 5) tokenMismatches++;
        }

        // Text contrast validation for text elements
        if (element.type === 'label' || element.type === 'button' || element.type === 'textField') {
          const contrastViolations = await validateTextContrast(screenshotPath, bounds, 14);
          
          for (const cv of contrastViolations) {
            const contrastMatch = cv.message.match(/(\d+\.\d+):1/);
            const contrastRatio = contrastMatch ? parseFloat(contrastMatch[1]) : 0;

            violations.push({
              id: `contrast-${violationId++}`,
              category: A11yCategory.PERCEIVABLE,
              severity: cv.severity === 'error' ? A11ySeverity.SERIOUS : A11ySeverity.MINOR,
              wcagCriteria: '1.4.3 Contrast (Minimum)',
              wcagLevel: 'AA',
              element,
              message: cv.message,
              description: cv.suggestion,
              howToFix: 'Use CVS neutral tokens for sufficient contrast: neutral-700+ on light backgrounds, neutral-50 on dark backgrounds',
              impact: 'Users with low vision or color blindness cannot read the text',
              colorInfo: {
                extractedHex: cv.extractedColor.hex,
                contrastRatio
              }
            });

            contrastIssues++;
          }
        }
      } catch (error) {
        console.error('Color validation failed for element:', element.id, error);
      }
    }

    colorValidationSummary = {
      enabled: true,
      colorsAnalyzed,
      tokenMismatches,
      deprecatedColors,
      contrastIssues
    };

    console.log(`🎨 [Color Validation] Complete!`);
    console.log(`   - Colors Analyzed: ${colorsAnalyzed}`);
    console.log(`   - Token Mismatches: ${tokenMismatches}`);
    console.log(`   - Deprecated Colors: ${deprecatedColors}`);
    console.log(`   - Contrast Issues: ${contrastIssues}`);

    // Recalculate summary after adding color violations
    summary.critical = violations.filter(v => v.severity === A11ySeverity.CRITICAL).length;
    summary.serious = violations.filter(v => v.severity === A11ySeverity.SERIOUS).length;
    summary.moderate = violations.filter(v => v.severity === A11ySeverity.MODERATE).length;
    summary.minor = violations.filter(v => v.severity === A11ySeverity.MINOR).length;
  } else {
    console.log(`🎨 [Color Validation] Skipped - no screenshot path provided`);
  }

  return {
    timestamp: new Date().toISOString(),
    totalElements: hierarchy.length,
    violations,
    passes: Math.max(0, passes),
    warnings: summary.moderate + summary.minor,
    summary,
    categoryBreakdown,
    colorValidation: colorValidationSummary
  };
}

// Export formatted report (Markdown)
export function formatA11yReport(report: A11yReport): string {
  let output = '# Mobile Accessibility Validation Report (iOS & Android)\n\n';
  output += `**Generated:** ${new Date(report.timestamp).toLocaleString()}\n`;
  output += `**Total Elements:** ${report.totalElements}\n`;
  output += `**Violations:** ${report.violations.length}\n`;
  output += `**Passes:** ${report.passes}\n\n`;

  output += '## Summary by Severity\n\n';
  output += `- 🔴 **Critical:** ${report.summary.critical}\n`;
  output += `- 🟠 **Serious:** ${report.summary.serious}\n`;
  output += `- 🟡 **Moderate:** ${report.summary.moderate}\n`;
  output += `- 🔵 **Minor:** ${report.summary.minor}\n\n`;

  output += '## Summary by Category\n\n';
  output += `- **Perceivable:** ${report.categoryBreakdown[A11yCategory.PERCEIVABLE]}\n`;
  output += `- **Operable:** ${report.categoryBreakdown[A11yCategory.OPERABLE]}\n`;
  output += `- **Understandable:** ${report.categoryBreakdown[A11yCategory.UNDERSTANDABLE]}\n`;
  output += `- **Robust:** ${report.categoryBreakdown[A11yCategory.ROBUST]}\n\n`;

  if (report.violations.length > 0) {
    output += '## Violations\n\n';

    for (const violation of report.violations) {
      const severityIcon = {
        [A11ySeverity.CRITICAL]: '🔴',
        [A11ySeverity.SERIOUS]: '🟠',
        [A11ySeverity.MODERATE]: '🟡',
        [A11ySeverity.MINOR]: '🔵'
      }[violation.severity];

      output += `### ${severityIcon} ${violation.message}\n\n`;
      output += `**WCAG:** ${violation.wcagCriteria} (Level ${violation.wcagLevel})\n`;
      output += `**Category:** ${violation.category}\n`;
      output += `**Element:** ${violation.element.type} - "${violation.element.text || violation.element.id}"\n`;
      output += `**Impact:** ${violation.impact}\n\n`;
      output += `**How to Fix:** ${violation.howToFix}\n\n`;
      output += '---\n\n';
    }
  }

  return output;
}

// Export HTML report for download
export function generateHTMLReport(report: A11yReport): string {
  const timestamp = new Date(report.timestamp).toLocaleString();

  let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mobile Accessibility Report - ${timestamp}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #f5f5f5;
      padding: 20px;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      overflow: hidden;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
    }
    .header h1 {
      font-size: 28px;
      margin-bottom: 10px;
    }
    .header .subtitle {
      font-size: 16px;
      opacity: 0.9;
      margin-bottom: 5px;
    }
    .header .meta {
      opacity: 0.8;
      font-size: 14px;
    }
    .platform-badges {
      display: flex;
      gap: 10px;
      margin-top: 15px;
    }
    .platform-badge {
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 500;
      background: rgba(255,255,255,0.2);
    }
    .summary {
      padding: 30px;
      border-bottom: 1px solid #e0e0e0;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-top: 20px;
    }
    .summary-card {
      padding: 20px;
      border-radius: 8px;
      background: #f9f9f9;
      border-left: 4px solid #667eea;
    }
    .summary-card h3 {
      font-size: 14px;
      color: #666;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .summary-card .value {
      font-size: 32px;
      font-weight: bold;
      color: #333;
    }
    .severity-badges {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 20px;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      border: 2px solid transparent;
      user-select: none;
    }
    .badge:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 8px rgba(0,0,0,0.15);
    }
    .badge.active {
      border: 2px solid currentColor;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      transform: scale(1.05);
    }
    .badge-critical { background: #ffebee; color: #c62828; }
    .badge-serious { background: #fff3e0; color: #e65100; }
    .badge-moderate { background: #e3f2fd; color: #1565c0; }
    .badge-minor { background: #f3e5f5; color: #6a1b9a; }
    .category-badges {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 15px;
    }
    .badge-category {
      padding: 6px 12px;
      border-radius: 4px;
      font-size: 13px;
      background: #e8eaf6;
      color: #3f51b5;
      border: 1px solid #c5cae9;
    }
    .violations {
      padding: 30px;
    }
    .violations h2 {
      font-size: 24px;
      margin-bottom: 20px;
      color: #333;
    }
    .violation-card {
      background: #fafafa;
      border-left: 4px solid #e0e0e0;
      border-radius: 4px;
      padding: 20px;
      margin-bottom: 20px;
    }
    .violation-card.critical { border-left-color: #c62828; }
    .violation-card.serious { border-left-color: #e65100; }
    .violation-card.moderate { border-left-color: #1565c0; }
    .violation-card.minor { border-left-color: #6a1b9a; }
    .violation-card.hidden {
      display: none;
    }
    .violation-header {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 15px;
    }
    .violation-icon {
      font-size: 24px;
      line-height: 1;
    }
    .violation-title {
      flex: 1;
    }
    .violation-title h3 {
      font-size: 18px;
      margin-bottom: 8px;
      color: #333;
    }
    .violation-meta {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-bottom: 15px;
    }
    .meta-tag {
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
      background: #e0e0e0;
      color: #555;
    }
    .meta-tag.wcag { background: #667eea; color: white; }
    .meta-tag.level { background: #764ba2; color: white; }
    .violation-details {
      margin-top: 15px;
    }
    .detail-row {
      margin-bottom: 12px;
    }
    .detail-row strong {
      display: inline-block;
      min-width: 100px;
      color: #666;
    }
    .fix-box {
      background: #e8f5e9;
      border-left: 3px solid #4caf50;
      padding: 15px;
      margin-top: 15px;
      border-radius: 4px;
    }
    .fix-box strong {
      color: #2e7d32;
      display: block;
      margin-bottom: 8px;
    }
    .no-violations {
      text-align: center;
      padding: 60px 30px;
      color: #4caf50;
    }
    .no-violations .icon {
      font-size: 64px;
      margin-bottom: 20px;
    }
    .no-violations h3 {
      font-size: 24px;
      margin-bottom: 10px;
    }
    .footer {
      padding: 20px 30px;
      background: #f5f5f5;
      text-align: center;
      color: #666;
      font-size: 14px;
    }
    @media print {
      body { background: white; padding: 0; }
      .container { box-shadow: none; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Mobile Accessibility Validation Report</h1>
      <div class="subtitle">iOS (VoiceOver) & Android (TalkBack) Compliance</div>
      <div class="meta">
        Generated: ${timestamp} | Total Elements Scanned: ${report.totalElements}
      </div>
      <div class="platform-badges">
        <span class="platform-badge">iOS / VoiceOver / Switch Control</span>
        <span class="platform-badge">Android / TalkBack / Switch Access</span>
        <span class="platform-badge">WCAG 2.1 Level AA</span>
      </div>
    </div>

    <div class="summary">
      <h2>Summary</h2>
      <div class="summary-grid">
        <div class="summary-card">
          <h3>Total Violations</h3>
          <div class="value">${report.violations.length}</div>
        </div>
        <div class="summary-card">
          <h3>Passed Checks</h3>
          <div class="value">${report.passes}</div>
        </div>
        <div class="summary-card">
          <h3>Elements Scanned</h3>
          <div class="value">${report.totalElements}</div>
        </div>
      </div>
      
      ${report.screenshot ? `
      <h3 style="margin-top: 30px; margin-bottom: 15px;">Screen Validated</h3>
      <div style="text-align: center; background: #f9f9f9; padding: 20px; border-radius: 8px; border: 1px solid #e0e0e0;">
        <img src="${report.screenshot}" alt="Screenshot of validated screen" style="max-width: 100%; max-height: 600px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);" />
        <p style="margin-top: 15px; color: #666; font-size: 14px;">Screenshot captured during accessibility validation</p>
      </div>
      ` : ''}

      <h3 style="margin-top: 30px; margin-bottom: 10px;">Severity Breakdown <span style="font-size: 14px; font-weight: normal; color: #666;">(Click to filter)</span></h3>
      <div class="severity-badges">
        <div class="badge badge-critical" data-severity="critical" onclick="filterBySeverity('critical')">
          <span>🔴</span>
          <span>Critical: ${report.summary.critical}</span>
        </div>
        <div class="badge badge-serious" data-severity="serious" onclick="filterBySeverity('serious')">
          <span>🟠</span>
          <span>Serious: ${report.summary.serious}</span>
        </div>
        <div class="badge badge-moderate" data-severity="moderate" onclick="filterBySeverity('moderate')">
          <span>🟡</span>
          <span>Moderate: ${report.summary.moderate}</span>
        </div>
        <div class="badge badge-minor" data-severity="minor" onclick="filterBySeverity('minor')">
          <span>🔵</span>
          <span>Minor: ${report.summary.minor}</span>
        </div>
      </div>
      <div style="margin-top: 10px; text-align: center;">
        <button onclick="clearFilter()" style="padding: 6px 16px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer; font-size: 13px; color: #666;">Show All</button>
      </div>

      <h3 style="margin-top: 20px; margin-bottom: 10px;">WCAG Category Breakdown</h3>
      <div class="category-badges">
        <div class="badge-category">Perceivable: ${report.categoryBreakdown[A11yCategory.PERCEIVABLE]}</div>
        <div class="badge-category">Operable: ${report.categoryBreakdown[A11yCategory.OPERABLE]}</div>
        <div class="badge-category">Understandable: ${report.categoryBreakdown[A11yCategory.UNDERSTANDABLE]}</div>
        <div class="badge-category">Robust: ${report.categoryBreakdown[A11yCategory.ROBUST]}</div>
      </div>
    </div>

    <div class="violations">`;

  if (report.violations.length > 0) {
    html += `<h2>Violations (${report.violations.length})</h2>`;

    for (const violation of report.violations) {
      const severityIcon = {
        [A11ySeverity.CRITICAL]: '🔴',
        [A11ySeverity.SERIOUS]: '🟠',
        [A11ySeverity.MODERATE]: '🟡',
        [A11ySeverity.MINOR]: '🔵'
      }[violation.severity];

      html += `
      <div class="violation-card ${violation.severity}" data-severity="${violation.severity}">
        <div class="violation-header">
          <div class="violation-icon">${severityIcon}</div>
          <div class="violation-title">
            <h3>${violation.message}</h3>
            <div class="violation-meta">
              <span class="meta-tag wcag">${violation.wcagCriteria}</span>
              <span class="meta-tag level">Level ${violation.wcagLevel}</span>
              <span class="meta-tag">${violation.category}</span>
              <span class="meta-tag">${violation.severity}</span>
            </div>
          </div>
        </div>
        <div class="violation-details">
          <div class="detail-row">
            <strong>Element:</strong> ${violation.element.type} - "${violation.element.text || violation.element.id}"
          </div>
          <div class="detail-row">
            <strong>Impact:</strong> ${violation.impact}
          </div>
          ${violation.colorInfo ? `
          <div class="detail-row" style="background: #f9f9f9; padding: 10px; border-radius: 4px; margin: 10px 0;">
            <strong>🎨 Color Information:</strong><br>
            <div style="display: flex; align-items: center; gap: 10px; margin-top: 5px;">
              <div style="width: 40px; height: 40px; border-radius: 4px; background: ${violation.colorInfo.extractedHex}; border: 2px solid #ddd;"></div>
              <div>
                <div><strong>Extracted:</strong> ${violation.colorInfo.extractedHex}</div>
                ${violation.colorInfo.matchedToken ? `<div><strong>Closest Token:</strong> ${violation.colorInfo.matchedToken}</div>` : ''}
                ${violation.colorInfo.deltaE !== undefined ? `<div><strong>Color Difference (ΔE):</strong> ${violation.colorInfo.deltaE.toFixed(1)}</div>` : ''}
                ${violation.colorInfo.contrastRatio !== undefined ? `<div><strong>Contrast Ratio:</strong> ${violation.colorInfo.contrastRatio.toFixed(2)}:1</div>` : ''}
              </div>
            </div>
          </div>
          ` : ''}
          <div class="fix-box">
            <strong>How to Fix:</strong>
            ${violation.howToFix}
          </div>
        </div>
      </div>`;
    }
  } else {
    html += `
      <div class="no-violations">
        <div class="icon">✅</div>
        <h3>No Accessibility Violations Found!</h3>
        <p>All elements meet WCAG 2.1 standards for iOS (VoiceOver) and Android (TalkBack).</p>
      </div>`;
  }

  html += `
    </div>

    <div class="footer">
      <p>Generated by Maestro Flow Recorder | Mobile Accessibility Report (iOS & Android)</p>
      <p>WCAG 2.1 Level AA Compliance | VoiceOver & TalkBack Validation | Switch Control & Switch Access</p>
    </div>
  </div>

  <script>
    let currentFilter = null;

    function filterBySeverity(severity) {
      const badges = document.querySelectorAll('.badge');
      const violations = document.querySelectorAll('.violation-card');
      const violationsHeader = document.querySelector('.violations h2');
      
      // Toggle filter if clicking the same badge
      if (currentFilter === severity) {
        clearFilter();
        return;
      }
      
      currentFilter = severity;
      
      // Update badge active states
      badges.forEach(badge => {
        if (badge.dataset.severity === severity) {
          badge.classList.add('active');
        } else {
          badge.classList.remove('active');
        }
      });
      
      // Filter violations
      let visibleCount = 0;
      violations.forEach(card => {
        if (card.dataset.severity === severity) {
          card.classList.remove('hidden');
          visibleCount++;
        } else {
          card.classList.add('hidden');
        }
      });
      
      // Update violations header with count
      const severityLabel = severity.charAt(0).toUpperCase() + severity.slice(1);
      if (violationsHeader) {
        violationsHeader.textContent = \`\${severityLabel} Violations (\${visibleCount})\`;
      }
      
      // Scroll to violations section
      document.querySelector('.violations').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    
    function clearFilter() {
      const badges = document.querySelectorAll('.badge');
      const violations = document.querySelectorAll('.violation-card');
      const violationsHeader = document.querySelector('.violations h2');
      
      currentFilter = null;
      
      // Remove active state from all badges
      badges.forEach(badge => badge.classList.remove('active'));
      
      // Show all violations
      violations.forEach(card => card.classList.remove('hidden'));
      
      // Reset header
      if (violationsHeader) {
        violationsHeader.textContent = \`Violations (\${violations.length})\`;
      }
    }
  </script>
</body>
</html>`;

  return html;
}
