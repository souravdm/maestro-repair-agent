'use strict';

/**
 * Pulse Component Validator
 *
 * Analyzes captured UI hierarchy data and validates elements against
 * CVS Pulse design system standards — platform-aware (iOS and Android).
 *
 *   iOS rules: https://github.com/cvs-health-source-code/digital-pulse-ios
 *   Android rules: https://github.com/cvs-health-source-code/digital-pulse-android
 *
 * Rules are derived directly from the Pulse component source code, NOT generic WCAG rules
 * (those are already covered by the separate A11y feature). This validator checks:
 *   - CVS Pulse-specific component contracts (iOS: PSTextField requires labelText,
 *     PSStandaloneLink requires accessibilityHint, PSToggle requires a parent label;
 *     Android: PulseIconButton requires contentDescription, PulseSwitch requires text)
 *   - Component identity (e.g. a link rendered as a button is a Pulse violation)
 *   - Touch target minimums: 44pt for iOS (iOS HIG), 48dp for Android (Material Design)
 *
 * DIFFERENCE FROM A11y FEATURE:
 *   - A11y: generic WCAG 2.1 checks (contrast, touch target size, focus indicator, keyboard nav)
 *            — runs with hardcoded/example values, independent of actual UI
 *   - Pulse: CVS design-system–specific checks against REAL hierarchy data captured
 *            from the running app. Checks component rules only meaningful in the
 *            context of the iOS (Swift/SwiftUI) or Android (Kotlin/Compose) Pulse library.
 *
 * Full Pulse iOS component inventory (Sources/Components/):
 *   Avatar, BottomDialog, Button, ButtonGroup, Card, Chip, Choice Button,
 *   Error Display, FileInput, Filter Results, FullScreenModal, Horizontal Scroll,
 *   Important Note, Info Tag, InfoTip, List, Menu, Navigation View, Order Tracker,
 *   Page Control, Picker, Pop Up Button, Progress Bar, Search Field,
 *   Section Header Text, Segmented Control, Sheet, Slider, Sliding Tabs, Snackbar,
 *   Spinning Progress Indicator, Standalone Link, Status Tag, Step Tracker,
 *   Tab Bar, Table, Text, Text Field, Text Lockup, Tile, Toggle
 *
 * Usage (standalone):
 *   node pulse-component-validator.js <report-dir>
 *
 * Usage (as module):
 *   const { validateReportDir } = require('./pulse-component-validator');
 *   const pulseData = validateReportDir('/path/to/report');
 */

const fs = require('fs');
const path = require('path');

function _str(v) {
  return (v == null ? '' : String(v)).trim();
}

function _lc(v) {
  return _str(v).toLowerCase();
}

function _mergedAttributes(el = {}) {
  return {
    ...(el.attributes || {}),
    identifier: el.attributes?.identifier || el.identifier || '',
    label: el.attributes?.label || el.label || '',
    value: el.attributes?.value || el.value || '',
    bounds: el.attributes?.bounds || el.bounds || '',
    'resource-id': el.attributes?.['resource-id'] || el.resourceId || el.identifier || '',
    'content-desc': el.attributes?.['content-desc'] || el.contentDesc || el.label || ''
  };
}

/**
 * Infers the UI role purely from element TYPE and IDENTIFIER — never from
 * visible text/label content. This keeps detection dynamic and screen-agnostic.
 *
 * Priority:
 *   1. Explicit element type from the OS hierarchy (most reliable)
 *   2. Identifier keywords (structural naming convention set by developers)
 *   3. Fallback to 'text' (static label / unknown)
 */
function _inferUiRole(text, id, label, type) {
  const ty = _lc(type);
  const i = _lc(id);

  // 1. Type-based detection (OS hierarchy type is the strongest signal)
  if (/(edittext|text.?field|securetext|search.?field|uitextfield|textinput)/.test(ty)) return 'textfield';
  if (/(switch|toggle|uiswitch)/.test(ty)) return 'switch';
  if (/(checkbox|check.?box)/.test(ty)) return 'checkbox';
  if (/^link$/.test(ty) || /\blink\b/.test(ty)) return 'link';
  if (/(progressindicator|progressbar|progressview|spinner|activityindicator)/.test(ty)) return 'progressindicator';
  if (/^(image|icon|img)$/.test(ty) || /(uiimage|imageview)/.test(ty)) return 'image';
  if (/^button$/.test(ty) || /(uibutton|android\.widget\.button)/.test(ty)) return 'button';

  // 2. Identifier-based (developer-set structural names)
  if (/(text.?field|edit.?text|input.?field|_field$|_input$|search.?bar)/.test(i)) return 'textfield';
  if (/(switch|toggle)/.test(i)) return 'switch';
  if (/(checkbox|check.?box)/.test(i)) return 'checkbox';
  if (/(link|href|url)/.test(i)) return 'link';
  if (/(progress|spinner|loading|activity.?indicator)/.test(i)) return 'progressindicator';
  if (/(avatar|profile.?image|user.?image)/.test(i)) return 'image';
  if (/(btn|button|_cta$)/.test(i)) return 'button';

  // 3. Fallback — if type contains a known keyword buried in a compound class name
  if (ty.includes('button')) return 'button';
  if (ty.includes('edittext') || ty.includes('textfield')) return 'textfield';
  if (ty.includes('switch')) return 'switch';
  if (ty.includes('image')) return 'image';

  return 'text';
}

function _normalizeElement(el = {}) {
  const attributes = _mergedAttributes(el);
  const text = _str(el.text || attributes.label || attributes.value || '');
  const identifier = _str(attributes.identifier || attributes['resource-id']);
  const label = _str(attributes.label || attributes['content-desc'] || text);
  const rawType = _str(el.type || attributes.type || el.className || 'unknown');
  const inferredType = _inferUiRole(text, identifier, label, rawType);

  const width = Number(el.width || 0);
  const height = Number(el.height || 0);
  if (!attributes.bounds && width > 0 && height > 0) {
    attributes.bounds = `[0,0][${width},${height}]`;
  }

  const normalized = {
    ...el,
    text,
    type: rawType === 'unknown' || rawType === '' ? inferredType : rawType,
    attributes,
    isVisible: typeof el.isVisible === 'boolean' ? el.isVisible :
      (typeof el.visible === 'boolean' ? el.visible : true),
    isInteractive: typeof el.isInteractive === 'boolean' ? el.isInteractive :
      (typeof el.interactive === 'boolean' ? el.interactive : ['button', 'textfield', 'switch', 'checkbox', 'link'].includes(inferredType)),
    depth: el.depth || 0,
    _uiRole: inferredType
  };

  return normalized;
}

/* No content-based helpers — detection is purely type/trait/identifier-driven. */

function _roleFromComponentKey(key, fallbackRole) {
  const map = {
    button: 'button',
    iconbutton: 'icon-button',
    textfield: 'textfield',
    standalonelink: 'link',
    toggle: 'switch',
    checkbox: 'checkbox',
    avatar: 'image',
    card: 'card',
    tile: 'tile',
    progress: 'progressindicator'
  };
  return map[key] || fallbackRole || 'text';
}

// ---------------------------------------------------------------------------
// iOS COMPONENT PATTERNS
// Detection is PURELY based on element type and identifier from the OS
// hierarchy — NEVER on visible text/label content. This ensures dynamic
// validation that works on any screen of any app without hardcoded strings.
//
// Order matters — first match wins. More specific patterns come first.
// ---------------------------------------------------------------------------
const IOS_COMPONENT_PATTERNS = [
  // PSAvatar — Sources/Components/Avatar/PSAvatar.swift
  {
    key: 'avatar',
    name: 'PSAvatar',
    category: 'Avatar',
    detect: (el) =>
      /\bavatar\b/i.test(el.attributes?.identifier || '')
  },

  // PSStandaloneLink — type "link" in hierarchy
  {
    key: 'standalonelink',
    name: 'PSStandaloneLink',
    category: 'Standalone Link',
    detect: (el) =>
      _lc(el.type) === 'link' ||
      /(link|url|href)/.test((el.attributes?.identifier || '').toLowerCase())
  },

  // PSToggle — type "switch" in hierarchy
  {
    key: 'toggle',
    name: 'PSToggle',
    category: 'Toggle',
    detect: (el) =>
      _lc(el.type) === 'switch' ||
      /(toggle|switch)/.test((el.attributes?.identifier || '').toLowerCase())
  },

  // PSProgressBar / PSSpinningProgressIndicator
  {
    key: 'progress',
    name: 'PSProgressBar / PSSpinningProgressIndicator',
    category: 'Progress',
    detect: (el) =>
      /(progressindicator|progressview|activityindicator)/.test(_lc(el.type)) ||
      /(progress|spinner|spinning|loading|activity.?indicator)/.test((el.attributes?.identifier || '').toLowerCase())
  },

  // PSTile — identifier-based only
  {
    key: 'tile',
    name: 'PSTile',
    category: 'Tile',
    detect: (el) =>
      /\btile\b/i.test(el.attributes?.identifier || '')
  },

  // PSCheckbox — type "checkbox" in hierarchy
  {
    key: 'checkbox',
    name: 'PSCheckbox',
    category: 'Checkbox',
    detect: (el) =>
      _lc(el.type) === 'checkbox' ||
      /(checkbox|check.?box)/.test((el.attributes?.identifier || '').toLowerCase())
  },

  // Image — type "image" (excluding avatars already matched above)
  {
    key: 'image',
    name: 'Image',
    category: 'Image',
    detect: (el) =>
      _lc(el.type) === 'image' &&
      !/\bavatar\b/i.test(el.attributes?.identifier || '')
  },

  // PSCard — identifier-based
  {
    key: 'card',
    name: 'PSCard',
    category: 'Card',
    detect: (el) =>
      /\bcard\b/i.test(el.attributes?.identifier || '')
  },

  // PSTextField — type "textfield" or identifier with field/input suffix
  // Detection: OS type is the primary signal. Identifier is secondary.
  // NO content-based matching — works for any screen dynamically.
  {
    key: 'textfield',
    name: 'PSTextField',
    category: 'Text Field',
    detect: (el) => {
      const ty = _lc(el.type);
      // Type-based: OS reports the element as a text field
      if (ty === 'textfield' || /(text.?field|securetext|search.?field|edittext|textinput|uitextfield)/.test(ty)) {
        return true;
      }
      // Identifier-based: developer named it as a field
      const id = (el.attributes?.identifier || '').toLowerCase();
      if (/(text.?field|edit.?text|input.?field|_field$|_input$|search.?bar)/.test(id)) {
        return true;
      }
      return false;
    }
  },

  // PSButton — type "button" in hierarchy (catch-all for interactive buttons)
  // This is LAST because all more-specific patterns are matched above.
  // Any element with type="button" that wasn't caught by avatar/link/toggle/etc.
  // is a button. No content matching needed.
  {
    key: 'button',
    name: 'PSButton',
    category: 'Button',
    detect: (el) => {
      const ty = _lc(el.type);
      const id = (el.attributes?.identifier || '').toLowerCase();
      // Skip if identifier clearly names a text field
      if (/(text.?field|edit.?text|input.?field|_field$|_input$)/.test(id)) {
        return false;
      }
      // Type-based: OS reports it as a button
      if (ty === 'button') return true;
      // Identifier-based: developer named it as a button
      if (/(btn|button|_cta$)/.test(id)) return true;
      return false;
    }
  }
];

// ---------------------------------------------------------------------------
// iOS PULSE RULES
// Rules are sourced from the actual Pulse iOS component Swift implementations.
// Each rule: id, severity ('error'|'warning'|'info'), description, check fn.
// check(el) returns true when the rule is VIOLATED.
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Shared bound-parsing helper for touch-target rules
// ---------------------------------------------------------------------------
function _parseBounds(el) {
  const bounds = el.attributes?.bounds || '';
  const m = bounds.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
  if (m) return { w: parseInt(m[3]) - parseInt(m[1]), h: parseInt(m[4]) - parseInt(m[2]) };
  if (el.width > 0 && el.height > 0) return { w: el.width, h: el.height };
  return null;
}

const IOS_PULSE_RULES = {
  // =========================================================================
  // PSButton — Sources/Components/Button/PSButton.swift
  // Styles: pulseFilled, pulseTinted, pulsePlain, pulseIconOnlyFilled, etc.
  // .frame(minWidth: 44, minHeight: 44) enforced in source (HIG minimum).
  // Minimum button height for Pulse filled/tinted = 48pt (design token).
  // =========================================================================
  button: [
    {
      id: 'psbutton-icon-only-missing-label',
      severity: 'error',
      description: 'PSButton (icon-only) is missing an accessibility label. Icon-only PSButtons have no title text for VoiceOver — an explicit accessibilityLabel is required (PSButton.swift)',
      check: (el) => {
        const text = (el.text || '').trim();
        const label = (el.attributes?.label || '').trim();
        const looksIconOnly = text === '' || /^[^\w\s]{1,3}$/.test(text) || /^(x|X|\+|>|<|←|→|✕|✖)$/.test(text);
        return looksIconOnly && label === '';
      }
    },
    {
      id: 'psbutton-missing-label',
      severity: 'error',
      description: 'PSButton has no accessible label (text or accessibilityLabel). VoiceOver cannot announce the button purpose. Provide title text or set accessibilityLabel.',
      check: (el) => {
        const text = (el.text || '').trim();
        const label = (el.attributes?.label || '').trim();
        return text === '' && label === '';
      }
    },
    {
      id: 'psbutton-touch-target-too-small',
      severity: 'error',
      description: 'PSButton is below the 44×44pt minimum touch target (Constants.HIG.minimumTappableWidth/Height). Pulse enforces .frame(minWidth: 44, minHeight: 44).',
      check: (el) => {
        const identifier = (el.attributes?.identifier || '').toLowerCase();
        if (/(clear|visibility|eye)/.test(identifier)) return false;
        const b = _parseBounds(el);
        if (!b || b.w <= 0 || b.h <= 0) return false;
        return b.w < 44 || b.h < 44;
      }
    },
    {
      id: 'psbutton-missing-identifier',
      severity: 'warning',
      description: 'PSButton has no accessibility identifier. Buttons should have an accessibilityIdentifier for automated test targeting.',
      check: (el) => !el.attributes?.identifier || el.attributes.identifier.trim() === ''
    },
    {
      id: 'psbutton-height-below-design-token',
      severity: 'warning',
      description: 'PSButton height appears below the Pulse design token minimum of 48pt for filled/tinted styles. Verify button style and height match Pulse specs.',
      check: (el) => {
        const b = _parseBounds(el);
        if (!b || b.h <= 0) return false;
        // Only flag if height is between 44-47 (below design token but above HIG minimum)
        return b.h >= 44 && b.h < 48;
      }
    }
  ],

  // =========================================================================
  // PSTextField — Sources/Components/Text Field/PSTextField.swift
  // REQUIRES labelText or accessibilityLabelText at init.
  // accessibilityLabel = [accessibilityLabelText ?? labelText, helperText, prefixText, error].joined(" ")
  // Minimum field height: 56pt (design token for standard text field).
  // =========================================================================
  textfield: [
    {
      id: 'pstextfield-missing-label',
      severity: 'error',
      description: 'PSTextField is missing an accessibility label. PSTextField requires labelText or accessibilityLabelText at init — the accessibility label is composed from these fields (PSTextField.swift)',
      check: (el) => !el.attributes?.label || el.attributes.label.trim() === ''
    },
    {
      id: 'pstextfield-missing-identifier',
      severity: 'warning',
      description: 'PSTextField has no accessibility identifier. Text fields must have an accessibilityIdentifier for automated test input.',
      check: (el) => !el.attributes?.identifier || el.attributes.identifier.trim() === ''
    },
    {
      id: 'pstextfield-missing-value-hint',
      severity: 'info',
      description: 'PSTextField has no accessibility hint. Consider adding a hint to describe expected input format (e.g. "Enter 10-digit phone number").',
      check: (el) => {
        const hint = (el.attributes?.hint || '').trim();
        const value = (el.attributes?.value || '').trim();
        return hint === '' && value === '';
      }
    }
  ],

  // =========================================================================
  // PSStandaloneLink — Sources/Components/Standalone Link/PSStandaloneLink.swift
  // .accessibilityAddTraits(.isLink) + .accessibilityRemoveTraits(.isButton)
  // accessibilityLabel = "\(title), \(linkImage.altText)"
  // accessibilityHint is required (default: "Opens in browser", "Opens email", "View PDF")
  // =========================================================================
  standalonelink: [
    {
      id: 'psstandalonelink-missing-label',
      severity: 'error',
      description: 'PSStandaloneLink is missing an accessibility label. PSStandaloneLink constructs its label from title + icon alt text (PSStandaloneLink.swift)',
      check: (el) => !el.attributes?.label || el.attributes.label.trim() === ''
    },
    {
      id: 'psstandalonelink-missing-hint',
      severity: 'warning',
      description: 'PSStandaloneLink has no accessibility hint. PSStandaloneLink requires an accessibilityHint (e.g. "Opens in browser", "Opens email", "View PDF")',
      check: (el) => !el.attributes?.hint || el.attributes.hint.trim() === ''
    },
    {
      id: 'psstandalonelink-wrong-trait',
      severity: 'error',
      description: 'Expected "link" role but element appears as "button". PSStandaloneLink uses .accessibilityAddTraits(.isLink) / .accessibilityRemoveTraits(.isButton)',
      check: (el) => el.type === 'button' && /\blink\b/i.test(el.attributes?.identifier || '')
    },
    {
      id: 'psstandalonelink-touch-target',
      severity: 'warning',
      description: 'PSStandaloneLink may be below the 44×44pt minimum touch target. Links must be tappable per iOS HIG.',
      check: (el) => {
        if (!el.isInteractive) return false;
        const b = _parseBounds(el);
        if (!b || b.w <= 0 || b.h <= 0) return false;
        return b.w < 44 || b.h < 44;
      }
    }
  ],

  // =========================================================================
  // PSToggle — Sources/Components/Toggle/PSToggle.swift
  // Toggle(isOn:) { } .labelsHidden() — parent view MUST supply .accessibilityLabel()
  // =========================================================================
  toggle: [
    {
      id: 'pstoggle-missing-label',
      severity: 'error',
      description: 'PSToggle has no accessibility label. PSToggle uses .labelsHidden() — the parent view must set .accessibilityLabel() (PSToggle.swift)',
      check: (el) => !el.attributes?.label || el.attributes.label.trim() === ''
    },
    {
      id: 'pstoggle-missing-identifier',
      severity: 'warning',
      description: 'PSToggle has no accessibility identifier. Toggles should have an accessibilityIdentifier for automated test targeting.',
      check: (el) => !el.attributes?.identifier || el.attributes.identifier.trim() === ''
    },
    {
      id: 'pstoggle-touch-target',
      severity: 'warning',
      description: 'PSToggle may be below the 44×44pt minimum touch target (iOS HIG).',
      check: (el) => {
        const b = _parseBounds(el);
        if (!b || b.w <= 0 || b.h <= 0) return false;
        return b.w < 44 || b.h < 44;
      }
    }
  ],

  // =========================================================================
  // PSAvatar — Sources/Components/Avatar/PSAvatar.swift
  // Placeholder → .accessibilityHidden(true). With initials → .speechSpellsOutCharacters(true).
  // =========================================================================
  avatar: [
    {
      id: 'psavatar-missing-label',
      severity: 'warning',
      description: 'PSAvatar with content (initials or photo) is missing an accessibility label. PSAvatar uses .speechSpellsOutCharacters(true) — ensure the user\'s name is accessible (PSAvatar.swift)',
      check: (el) => !el.attributes?.label || el.attributes.label.trim() === ''
    },
    {
      id: 'psavatar-size-too-small',
      severity: 'info',
      description: 'PSAvatar appears smaller than the recommended minimum of 32×32pt for readability.',
      check: (el) => {
        const b = _parseBounds(el);
        if (!b || b.w <= 0 || b.h <= 0) return false;
        return b.w < 32 || b.h < 32;
      }
    }
  ],

  // =========================================================================
  // PSCard — Sources/Components/Card/Vertical/PSVerticalCard.swift etc.
  // Interactive cards must be labelled. Minimum card padding: 16pt (design token).
  // =========================================================================
  card: [
    {
      id: 'pscard-interactive-missing-label',
      severity: 'error',
      description: 'Interactive PSCard is missing an accessibility label. Tappable cards must have an accessibilityLabel (PSVerticalCard.swift)',
      check: (el) => el.isInteractive && (!el.attributes?.label || el.attributes.label.trim() === '')
    },
    {
      id: 'pscard-missing-identifier',
      severity: 'warning',
      description: 'PSCard has no accessibility identifier. Cards should have an accessibilityIdentifier for automated test targeting.',
      check: (el) => el.isInteractive && (!el.attributes?.identifier || el.attributes.identifier.trim() === '')
    },
    {
      id: 'pscard-touch-target',
      severity: 'warning',
      description: 'Interactive PSCard may be below the 44×44pt minimum touch target (iOS HIG).',
      check: (el) => {
        if (!el.isInteractive) return false;
        const b = _parseBounds(el);
        if (!b || b.w <= 0 || b.h <= 0) return false;
        return b.w < 44 || b.h < 44;
      }
    }
  ],

  // =========================================================================
  // Progress indicators — PSProgressBar / PSSpinningProgressIndicator
  // =========================================================================
  progress: [
    {
      id: 'psprogress-missing-label',
      severity: 'warning',
      description: 'Progress indicator is missing an accessibility label. Screen readers must announce loading state to users.',
      check: (el) => !el.attributes?.label || el.attributes.label.trim() === ''
    }
  ],

  // =========================================================================
  // PSTile — interactive content tiles
  // =========================================================================
  tile: [
    {
      id: 'pstile-missing-label',
      severity: 'error',
      description: 'PSTile is missing an accessibility label. Tappable tiles must have a label describing their action.',
      check: (el) => el.isInteractive && (!el.attributes?.label || el.attributes.label.trim() === '')
    },
    {
      id: 'pstile-missing-identifier',
      severity: 'warning',
      description: 'PSTile has no accessibility identifier for automated test targeting.',
      check: (el) => el.isInteractive && (!el.attributes?.identifier || el.attributes.identifier.trim() === '')
    },
    {
      id: 'pstile-touch-target',
      severity: 'warning',
      description: 'PSTile may be below the 44×44pt minimum touch target (iOS HIG).',
      check: (el) => {
        if (!el.isInteractive) return false;
        const b = _parseBounds(el);
        if (!b || b.w <= 0 || b.h <= 0) return false;
        return b.w < 44 || b.h < 44;
      }
    }
  ],

  // =========================================================================
  // PSCheckbox — checkbox components require a label for VoiceOver
  // =========================================================================
  checkbox: [
    {
      id: 'pscheckbox-missing-label',
      severity: 'error',
      description: 'PSCheckbox is missing an accessibility label. Checkboxes must have a label so VoiceOver can announce their purpose.',
      check: (el) => !el.attributes?.label || el.attributes.label.trim() === ''
    },
    {
      id: 'pscheckbox-missing-identifier',
      severity: 'warning',
      description: 'PSCheckbox has no accessibility identifier for automated test targeting.',
      check: (el) => !el.attributes?.identifier || el.attributes.identifier.trim() === ''
    },
    {
      id: 'pscheckbox-touch-target',
      severity: 'warning',
      description: 'PSCheckbox may be below the 44×44pt minimum touch target (iOS HIG).',
      check: (el) => {
        const b = _parseBounds(el);
        if (!b || b.w <= 0 || b.h <= 0) return false;
        return b.w < 44 || b.h < 44;
      }
    }
  ],

  // =========================================================================
  // Image elements — decorative images should be hidden, meaningful images need labels
  // =========================================================================
  image: [
    {
      id: 'psimage-missing-label',
      severity: 'warning',
      description: 'Image has no accessibility label and is not hidden. Meaningful images need an accessibilityLabel; decorative images should use .accessibilityHidden(true).',
      check: (el) => {
        const label = (el.attributes?.label || '').trim();
        const hint = (el.attributes?.hint || '').trim();
        return label === '' && hint === '';
      }
    },
    {
      id: 'psimage-interactive-missing-label',
      severity: 'error',
      description: 'Tappable image is missing an accessibility label. Interactive images must have a label describing the action.',
      check: (el) => {
        if (!el.isInteractive) return false;
        const label = (el.attributes?.label || '').trim();
        return label === '';
      }
    }
  ]
};

// ---------------------------------------------------------------------------
// ANDROID COMPONENT PATTERNS
// Derived from Pulse Android digital-pulse-android-compose Kotlin source files.
// Element types in Maestro Android hierarchy use Android class names (or Compose role names).
// Order matters — first match wins. Icon buttons are matched before generic buttons.
// ---------------------------------------------------------------------------

/** Returns the primary accessible label for an Android element (checks multiple attrs). */
function _androidLabel(el) {
  return (
    el.attributes?.['content-desc'] ||
    el.attributes?.contentDesc ||
    el.attributes?.label ||
    el.text ||
    ''
  ).trim();
}

/** Returns the resource-id of an Android element, lower-cased for pattern matching. */
function _androidResId(el) {
  return (
    el.attributes?.['resource-id'] ||
    el.attributes?.resourceId ||
    el.attributes?.identifier ||
    ''
  ).toLowerCase();
}

const ANDROID_COMPONENT_PATTERNS = [
  // PulseAvatar (Horizontal/Vertical) — avatar/PulseAvatarHorizontal.kt
  // Both label: String? and contentDescription: String? are nullable.
  // assembleContentDescription(initials, label, contentDescription) is called:
  // if BOTH are null the result is an empty string → TalkBack reads nothing.
  {
    key: 'avatar',
    name: 'PulseAvatar (Android)',
    category: 'Avatar',
    detect: (el) =>
      /\bavatar\b/.test(_androidResId(el)) ||
      /\bavatar\b/i.test(el.text || '')
  },

  // PulseStandaloneLink — link/PulseStandaloneLink.kt
  // text: String is the visible link text and the primary accessible label.
  // Uses clickable() with onClickLabel from R.string.pulse_standalone_link_click_label.
  {
    key: 'standalonelink',
    name: 'PulseStandaloneLink (Android)',
    category: 'Standalone Link',
    detect: (el) =>
      _lc(el.type) === 'link' || /\blink\b/.test(_androidResId(el))
  },

  // PulseSwitch — selection/PulseSwitch.kt
  // text: String is a required parameter but CAN be empty string.
  // semantics { contentDescription = assembleContentDescription(text, groupLabel) }
  // If text is empty AND groupLabel is null → empty contentDescription → TalkBack reads nothing.
  {
    key: 'toggle',
    name: 'PulseSwitch (Android)',
    category: 'Toggle / Switch',
    detect: (el) =>
      _lc(el.type) === 'switch' ||
      _lc(el.type) === 'android.widget.switch' ||
      /\bswitch\b/.test(_androidResId(el))
  },

  // PulseCheckBox — selection/PulseCheckBox.kt
  // text parameter is the accessible label.
  {
    key: 'checkbox',
    name: 'PulseCheckBox (Android)',
    category: 'Checkbox',
    detect: (el) =>
      _lc(el.type) === 'checkbox' ||
      _lc(el.type) === 'android.widget.checkbox' ||
      /\bcheckbox\b/.test(_androidResId(el))
  },

  // Progress indicator — progressindicator/
  {
    key: 'progress',
    name: 'PulseProgressIndicator (Android)',
    category: 'Progress',
    detect: (el) =>
      _lc(el.type) === 'android.widget.progressbar' ||
      _lc(el.type) === 'progressindicator' ||
      /\b(progress|spinner)\b/.test(_androidResId(el))
  },

  // PulseTile — tile/ components
  {
    key: 'tile',
    name: 'PulseTile (Android)',
    category: 'Tile',
    detect: (el) =>
      /\btile\b/.test(_androidResId(el))
  },

  // PulseCard (Horizontal/Vertical) — card/PulseHorizontalCard.kt, PulseVerticalCard.kt
  // onClick: (() -> Unit)? — when set, card is interactive and needs semantic title.
  // Uses semantics(mergeDescendants = true) — merges child semantics.
  {
    key: 'card',
    name: 'PulseCard (Android)',
    category: 'Card',
    detect: (el) =>
      /\bcard\b/.test(_androidResId(el))
  },

  // PulseTextInputField — textinputfield/PulseTextInputField.kt
  // labelText: String? = null — if null, no label Composable is created.
  // TalkBack has no field label to read when labelText is absent.
  {
    key: 'textfield',
    name: 'PulseTextInputField (Android)',
    category: 'Text Input Field',
    detect: (el) =>
      _lc(el.type) === 'android.widget.edittext' ||
      _lc(el.type) === 'edittext' ||
      _lc(el.type) === 'textfield' ||
      /\b(textfield|text_input|edittext|input_field|search_field|_field$|_input$)\b/.test(_androidResId(el)) ||
      /\b(edittext|textfield|textinput)\b/i.test(el.type || '')
  },

  // PulseIconButton — button/PulseIconButton.kt
  // contentDescription: String (non-nullable!) is a REQUIRED parameter in every variant.
  // An empty contentDescription in the hierarchy means this contract was violated.
  // Matched BEFORE generic buttons since icon buttons are a subset.
  {
    key: 'iconbutton',
    name: 'PulseIconButton (Android)',
    category: 'Icon Button',
    detect: (el) =>
      /icon[_\-]?button/.test(_androidResId(el)) ||
      /icon[_\-]?btn/.test(_androidResId(el))
  },

  // PulseButton (Contained/Outlined/Text) — button/PulseButton.kt
  // text: String is a required non-nullable parameter for all button variants.
  {
    key: 'button',
    name: 'PulseButton (Android)',
    category: 'Button',
    detect: (el) =>
      (_lc(el.type) === 'button' || _lc(el.type) === 'android.widget.button') ||
      /\b(btn|button)\b/.test(_androidResId(el))
  }
];

// ---------------------------------------------------------------------------
// ANDROID PULSE RULES
// Sourced from Pulse Android Kotlin/Compose component implementations.
// Each rule: id, severity ('error'|'warning'|'info'), description, check fn.
// check(el) returns true when the rule is VIOLATED.
// ---------------------------------------------------------------------------
const ANDROID_PULSE_RULES = {
  // =========================================================================
  // PulseIconButton — button/PulseIconButton.kt
  // contentDescription: String is NON-NULLABLE and REQUIRED for all variants.
  // =========================================================================
  iconbutton: [
    {
      id: 'pulse-android-iconbutton-missing-content-desc',
      severity: 'error',
      description: 'PulseIconButton is missing contentDescription. All PulseIconButton variants require a non-empty contentDescription: String — icon buttons have no visible text for TalkBack (PulseIconButton.kt)',
      check: (el) => _androidLabel(el) === ''
    },
    {
      id: 'pulse-android-iconbutton-touch-target',
      severity: 'error',
      description: 'PulseIconButton is below the 48dp minimum touch target. Pulse Android enforces minimumInteractiveComponentSize() (Material3 = 48dp).',
      check: (el) => {
        const b = _parseBounds(el);
        if (!b || b.w <= 0 || b.h <= 0) return false;
        return b.w < 48 || b.h < 48;
      }
    }
  ],

  // =========================================================================
  // PulseButton (Contained/Outlined/Text) — button/PulseButton.kt
  // text: String is NON-NULLABLE and REQUIRED for all variants.
  // =========================================================================
  button: [
    {
      id: 'pulse-android-button-missing-label',
      severity: 'error',
      description: 'PulseButton has no visible text or contentDescription. All PulseButton variants require text: String (PulseButton.kt)',
      check: (el) => (el.text || '').trim() === '' && _androidLabel(el) === ''
    },
    {
      id: 'pulse-android-button-touch-target',
      severity: 'error',
      description: 'PulseButton is below the 48dp minimum touch target (Material Design / Pulse Android).',
      check: (el) => {
        const b = _parseBounds(el);
        if (!b || b.w <= 0 || b.h <= 0) return false;
        return b.w < 48 || b.h < 48;
      }
    },
    {
      id: 'pulse-android-button-missing-resource-id',
      severity: 'warning',
      description: 'PulseButton has no resource-id for automated test targeting.',
      check: (el) => _androidResId(el) === ''
    }
  ],

  // =========================================================================
  // PulseTextInputField — textinputfield/PulseTextInputField.kt
  // labelText: String? = null — if null, no label Composable is created.
  // =========================================================================
  textfield: [
    {
      id: 'pulse-android-textfield-missing-label',
      severity: 'error',
      description: 'PulseTextInputField is missing labelText. When null, no label Composable is rendered — TalkBack cannot announce the field purpose (PulseTextInputField.kt)',
      check: (el) => _androidLabel(el) === ''
    },
    {
      id: 'pulse-android-textfield-missing-resource-id',
      severity: 'warning',
      description: 'PulseTextInputField has no resource-id for automated test input targeting.',
      check: (el) => _androidResId(el) === ''
    }
  ],

  // =========================================================================
  // PulseStandaloneLink — link/PulseStandaloneLink.kt
  // text: String is required for all variants.
  // =========================================================================
  standalonelink: [
    {
      id: 'pulse-android-link-missing-label',
      severity: 'error',
      description: 'PulseStandaloneLink is missing visible text. text: String is required — it serves as the accessible label for TalkBack (PulseStandaloneLink.kt)',
      check: (el) => (el.text || '').trim() === '' && _androidLabel(el) === ''
    },
    {
      id: 'pulse-android-link-touch-target',
      severity: 'warning',
      description: 'PulseStandaloneLink may be below the 48dp minimum touch target.',
      check: (el) => {
        if (!el.isInteractive) return false;
        const b = _parseBounds(el);
        if (!b || b.w <= 0 || b.h <= 0) return false;
        return b.w < 48 || b.h < 48;
      }
    }
  ],

  // =========================================================================
  // PulseSwitch — selection/PulseSwitch.kt
  // =========================================================================
  toggle: [
    {
      id: 'pulse-android-switch-missing-label',
      severity: 'error',
      description: 'PulseSwitch has no accessible label. assembleContentDescription(text, groupLabel) produces empty string — TalkBack silent (PulseSwitch.kt)',
      check: (el) => (el.text || '').trim() === '' && _androidLabel(el) === ''
    },
    {
      id: 'pulse-android-switch-touch-target',
      severity: 'error',
      description: 'PulseSwitch is below the 48dp minimum touch target (Material Design).',
      check: (el) => {
        const b = _parseBounds(el);
        if (!b || b.w <= 0 || b.h <= 0) return false;
        return b.w < 48 || b.h < 48;
      }
    },
    {
      id: 'pulse-android-switch-missing-resource-id',
      severity: 'warning',
      description: 'PulseSwitch has no resource-id for automated test targeting.',
      check: (el) => _androidResId(el) === ''
    }
  ],

  // =========================================================================
  // PulseCheckBox — selection/PulseCheckBox.kt
  // =========================================================================
  checkbox: [
    {
      id: 'pulse-android-checkbox-missing-label',
      severity: 'error',
      description: 'PulseCheckBox has no accessible label. text parameter provides the label for TalkBack (PulseCheckBox.kt)',
      check: (el) => (el.text || '').trim() === '' && _androidLabel(el) === ''
    },
    {
      id: 'pulse-android-checkbox-touch-target',
      severity: 'warning',
      description: 'PulseCheckBox may be below the 48dp minimum touch target.',
      check: (el) => {
        const b = _parseBounds(el);
        if (!b || b.w <= 0 || b.h <= 0) return false;
        return b.w < 48 || b.h < 48;
      }
    }
  ],

  // =========================================================================
  // PulseAvatar — avatar/PulseAvatarHorizontal.kt
  // =========================================================================
  avatar: [
    {
      id: 'pulse-android-avatar-missing-label',
      severity: 'warning',
      description: 'PulseAvatar is missing both label and contentDescription — TalkBack cannot announce the avatar (PulseAvatarHorizontal.kt)',
      check: (el) => (el.text || '').trim() === '' && _androidLabel(el) === ''
    }
  ],

  // =========================================================================
  // PulseCard — card/PulseHorizontalCard.kt, PulseVerticalCard.kt
  // =========================================================================
  card: [
    {
      id: 'pulse-android-card-interactive-missing-label',
      severity: 'error',
      description: 'Interactive PulseCard has no title or contentDescription — TalkBack cannot announce its purpose (PulseHorizontalCard.kt)',
      check: (el) => el.isInteractive && (el.text || '').trim() === '' && _androidLabel(el) === ''
    },
    {
      id: 'pulse-android-card-missing-resource-id',
      severity: 'warning',
      description: 'Interactive PulseCard has no resource-id for automated test targeting.',
      check: (el) => el.isInteractive && _androidResId(el) === ''
    }
  ],

  // =========================================================================
  // PulseProgressIndicator
  // =========================================================================
  progress: [
    {
      id: 'pulse-android-progress-missing-label',
      severity: 'warning',
      description: 'Progress indicator is missing contentDescription. TalkBack must announce loading state.',
      check: (el) => _androidLabel(el) === ''
    }
  ],

  // =========================================================================
  // PulseTile
  // =========================================================================
  tile: [
    {
      id: 'pulse-android-tile-missing-label',
      severity: 'error',
      description: 'PulseTile is missing an accessible label. Tappable tiles must have contentDescription or visible text.',
      check: (el) => el.isInteractive && (el.text || '').trim() === '' && _androidLabel(el) === ''
    },
    {
      id: 'pulse-android-tile-touch-target',
      severity: 'warning',
      description: 'PulseTile may be below the 48dp minimum touch target.',
      check: (el) => {
        if (!el.isInteractive) return false;
        const b = _parseBounds(el);
        if (!b || b.w <= 0 || b.h <= 0) return false;
        return b.w < 48 || b.h < 48;
      }
    }
  ]
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Detects which Pulse component an element represents, using the platform's
 * detection patterns (ios → IOS_COMPONENT_PATTERNS, android → ANDROID_COMPONENT_PATTERNS).
 */
function detectComponentType(el, platform) {
  const patterns = platform === 'android' ? ANDROID_COMPONENT_PATTERNS : IOS_COMPONENT_PATTERNS;
  for (const pattern of patterns) {
    if (pattern.detect(el)) {
      return pattern;
    }
  }
  return null;
}

/**
 * Converts a test name like "test_authentication" into "Authentication Screen".
 * Handles names that already contain readable words (e.g. "Sign In Screen")
 * without double-appending " Screen".
 */
function formatScreenName(testName) {
  if (!testName) return 'Unknown Screen';
  // Already a human-readable label with spaces and mixed case — use as-is
  if (/\s/.test(testName) && /[A-Z]/.test(testName)) return testName;
  // Convert snake_case/slug to Title Case
  const pretty = testName
    .replace(/^test_/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
  // Only append " Screen" if the name doesn't already end with "Screen"
  return /\bscreen\b$/i.test(pretty) ? pretty : pretty + ' Screen';
}

/**
 * Validates an array of UI elements against Pulse rules.
 * Returns an array of violation objects.
 */
/**
 * Validates an array of UI elements against Pulse rules for the given platform.
 * Returns an array of violation objects.
 *
 * @param {Array}  elements   - Elements from the captured hierarchy JSON.
 * @param {string} screenName - Human-readable name of the screen.
 * @param {string} platform   - 'ios' or 'android' (default 'ios').
 */
function validateElements(elements, screenRef, platform) {
  const rules = platform === 'android' ? ANDROID_PULSE_RULES : IOS_PULSE_RULES;
  const violations = [];
  const resolvedScreenName = typeof screenRef === 'string'
    ? screenRef
    : ((screenRef && screenRef.name) || 'Unknown Screen');
  const resolvedScreenId = typeof screenRef === 'object' && screenRef
    ? (screenRef.id || resolvedScreenName)
    : resolvedScreenName;

  for (const el of elements) {
    const normalized = _normalizeElement(el);
    // Skip hidden or zero-size elements
    if (!normalized.isVisible) continue;

    const componentPattern = detectComponentType(normalized, platform);
    if (!componentPattern) continue;

    const componentRules = rules[componentPattern.key] || [];

    for (const rule of componentRules) {
      if (rule.check(normalized)) {
        // Build detailed element information
        const elementLabel = normalized.attributes?.label ||
                            normalized.attributes?.['content-desc'] ||
                            normalized.text ||
                            normalized.attributes?.identifier ||
                            'Unknown element';
        
        // Extract bounds dimensions
        let dimensions = '';
        const bounds = normalized.attributes?.bounds || '';
        const boundsMatch = bounds.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
        if (boundsMatch) {
          const width = parseInt(boundsMatch[3]) - parseInt(boundsMatch[1]);
          const height = parseInt(boundsMatch[4]) - parseInt(boundsMatch[2]);
          dimensions = `${width}×${height}pt`;
        } else if (normalized.width && normalized.height) {
          dimensions = `${normalized.width}×${normalized.height}pt`;
        }

        violations.push({
          component: componentPattern.name,
          componentType: componentPattern.category,
          uiRole: _roleFromComponentKey(componentPattern.key, normalized._uiRole),
          screen: resolvedScreenName,
          screenId: resolvedScreenId,
          rule: rule.description,
          element: elementLabel,
          elementType: normalized.type || 'unknown',
          elementId: normalized.attributes?.identifier || normalized.attributes?.['resource-id'] || 'none',
          dimensions: dimensions,
          depth: normalized.depth || 0,
          severity: rule.severity,
          ruleId: rule.id
        });
      }
    }
  }

  return violations;
}

// ---------------------------------------------------------------------------
// Main entry point (module export)
// ---------------------------------------------------------------------------

/**
 * Scans all hierarchy JSON files in <reportDir>/hierarchies/ and returns
 * a Pulse validation result object.
 *
 * @param {string} reportDir - Absolute path to the test report directory.
 * @returns {{ timestamp, totalChecked, totalViolations, violations[] }}
 */
/**
 * Scans all hierarchy JSON files in <reportDir>/hierarchies/ and returns
 * a Pulse validation result object.
 *
 * @param {string} reportDir - Absolute path to the test report directory.
 * @param {string} platform  - 'ios' or 'android'. Defaults to 'ios'.
 * @returns {{ timestamp, platform, totalChecked, totalViolations, violations[] }}
 */
function validateReportDir(reportDir, platform = 'ios') {
  let resolvedPlatform = (platform || 'ios').toLowerCase();
  const empty = { timestamp: new Date().toISOString(), platform: resolvedPlatform, totalChecked: 0, totalViolations: 0, violations: [], screens: [] };

  try {
    const hierarchyDir = path.join(reportDir, 'hierarchies');
    if (!fs.existsSync(hierarchyDir)) return empty;

    const hierarchyFiles = fs
      .readdirSync(hierarchyDir)
      .filter((f) => f.endsWith('.json'));

    if (hierarchyFiles.length === 0) return empty;
    
    // Auto-detect platform from first hierarchy file if not explicitly provided or unclear
    if (!platform || platform === 'ios') {
      try {
        const firstFile = path.join(hierarchyDir, hierarchyFiles[0]);
        const firstData = JSON.parse(fs.readFileSync(firstFile, 'utf8'));
        const firstElements = firstData.elements || [];
        
        // Check for Android-specific element types
        const hasAndroidElements = firstElements.some(el => {
          const type = (el.type || '').toLowerCase();
          return type.includes('android.') || 
                 type === 'edittext' ||
                 el.attributes?.['resource-id'] ||
                 el.attributes?.resourceId;
        });
        
        // Check for iOS-specific element types
        const hasIOSElements = firstElements.some(el => {
          const type = (el.type || '').toLowerCase();
          return type.includes('xcui') || 
                 type.includes('uikit') ||
                 type.includes('swiftui') ||
                 el.attributes?.accessibilityIdentifier;
        });
        
        if (hasAndroidElements && !hasIOSElements) {
          resolvedPlatform = 'android';
        } else if (hasIOSElements && !hasAndroidElements) {
          resolvedPlatform = 'ios';
        }
        // If both or neither, keep the provided platform
      } catch (_) {
        // If auto-detection fails, use provided platform
      }
    }

    const allViolations = [];
    let totalChecked = 0;
    // screens: ordered list of every captured screen occurrence.
    const screens = [];

    // Parse first so we can remap failure snapshots to the most recent runtime screen
    // (instead of creating synthetic "Authentication Screen" from test name).
    const parsedEntries = [];
    const runtimeOrderedScreens = [];

    for (const file of hierarchyFiles) {
      try {
        const filePath = path.join(hierarchyDir, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        const stepName = String(data.stepName || '');
        const elements = data.elements || [];
        const screenName = formatScreenName(data.testName);
        const ts = data.timestamp || '';

        parsedEntries.push({ stepName, elements, screenName, ts, rawTestName: String(data.testName || ''), file });

        if (stepName === 'runtime' && screenName) {
          runtimeOrderedScreens.push(screenName);
        }
      } catch (_) {
        // Skip malformed hierarchy files
      }
    }

    // Ensure report ordering follows actual execution order, not filesystem order.
    parsedEntries.sort((a, b) => {
      const at = Date.parse(a.ts || '') || 0;
      const bt = Date.parse(b.ts || '') || 0;
      if (at !== bt) return at - bt;
      return String(a.file || '').localeCompare(String(b.file || ''));
    });

    const screenNameCounts = new Map();
    const runtimeCaptureNames = new Set(
      parsedEntries
        .filter((entry) => entry.stepName === 'runtime')
        .map((entry) => entry.screenName)
    );

    for (const entry of parsedEntries) {
      try {
        const { stepName, elements, screenName, ts, file, rawTestName } = entry;

        // Re-label failure snapshots to the latest runtime screen if available.
        // This prevents test-name-derived labels like "Authentication Screen".
        let effectiveScreenName = screenName;
        if (stepName === 'failure_step' && runtimeOrderedScreens.length > 0) {
          effectiveScreenName = runtimeOrderedScreens[runtimeOrderedScreens.length - 1];
        }

        // All captures are shown (runtime AND failure) so the user sees the full
        // start-to-end journey. Failure captures get a distinct label suffix.
        const isFailureCapture = stepName === 'failure_step';
        const nextCount = (screenNameCounts.get(effectiveScreenName) || 0) + 1;
        screenNameCounts.set(effectiveScreenName, nextCount);
        const baseName = nextCount > 1 ? `${effectiveScreenName} (${nextCount})` : effectiveScreenName;
        const displayName = isFailureCapture ? `${baseName} · Failure` : baseName;
        const screenId = `${effectiveScreenName}#${nextCount}${isFailureCapture ? '-failure' : ''}`;

        totalChecked += elements.length;
        const violations = validateElements(
          elements,
          { id: screenId, name: displayName },
          resolvedPlatform
        );
        allViolations.push(...violations);

        // Count unique elements that have at least one violation
        const violatedEls = new Set(violations.map(v => `${v.elementId}::${v.element}`));
        const violationCount = violations.length;
        const passedCount = Math.max(0, elements.length - violatedEls.size);

        screens.push({
          id: screenId,
          name: effectiveScreenName,
          displayName,
          elementCount: elements.length,
          violationCount,
          passedCount,
          timestamp: ts,
          stepName,
          rawTestName: rawTestName || '',
          isFailureCapture,
          fileName: file
        });
      } catch (_) {
        // Skip malformed entries
      }
    }

    // Deduplicate violations: same screen occurrence + element + ruleId
    const seen = new Set();
    const deduped = allViolations.filter((v) => {
      const key = `${v.screenId || v.screen}::${v.element}::${v.ruleId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return {
      timestamp: new Date().toISOString(),
      platform: resolvedPlatform,
      totalChecked,
      totalViolations: deduped.length,
      violations: deduped,
      screens
    };
  } catch (_) {
    return empty;
  }
}

module.exports = { validateReportDir, formatScreenName, validateElements };

// ---------------------------------------------------------------------------
// CLI: node pulse-component-validator.js <report-dir>
// ---------------------------------------------------------------------------
if (require.main === module) {
  // --stdin <hierarchy-json> mode: validate a single maestro hierarchy JSON file
  // Usage: maestro hierarchy --output /tmp/h.json && node pulse-component-validator.js --stdin /tmp/h.json [screenName]
  if (process.argv[2] === '--stdin') {
    const hierarchyFile = process.argv[3];
    const screenLabel   = process.argv[4] || 'Manual Audit Screen';
    if (!hierarchyFile || !fs.existsSync(hierarchyFile)) {
      console.error('Usage: node pulse-component-validator.js --stdin <hierarchy.json> ["Screen Name"]');
      console.error('  First capture: maestro hierarchy --output /tmp/h.json');
      process.exit(1);
    }
    try {
      // maestro hierarchy --output writes a JSON file with a top-level "rawHierarchy" key
      // or the entire tree directly. Accept both shapes.
      const raw = JSON.parse(fs.readFileSync(hierarchyFile, 'utf8'));
      // Flatten the Maestro hierarchy tree into a flat element array
      function flattenMaestroTree(node, depth) {
        if (!node || typeof node !== 'object') return [];
        const children = node.children || [];
        const el = {
          text: node.text || node.accessibilityLabel || node.label || '',
          type: node.type || node.role || 'unknown',
          attributes: {
            identifier: node.accessibilityIdentifier || node.id || '',
            label: node.accessibilityLabel || node.label || node.text || '',
            hint: node.accessibilityHint || '',
            value: node.accessibilityValue || node.value || '',
            bounds: node.bounds || '',
          },
          isVisible: node.isEnabled !== false,
          isInteractive: node.isClickable !== false && ['button', 'textfield', 'switch', 'checkbox', 'link'].includes((node.type || '').toLowerCase()),
          depth,
          width: node.width || 0,
          height: node.height || 0,
        };
        return [el, ...children.flatMap(c => flattenMaestroTree(c, depth + 1))];
      }
      const tree = raw.rawHierarchy || raw.hierarchy || raw;
      const elements = Array.isArray(tree) ? tree : flattenMaestroTree(tree, 0);
      
      // Auto-detect platform from hierarchy if not explicitly provided
      let platform = process.argv[5];
      if (!platform || platform === 'undefined') {
        // Check for Android-specific element types
        const hasAndroidElements = elements.some(el => {
          const type = (el.type || '').toLowerCase();
          return type.includes('android.') || 
                 type === 'edittext' ||
                 el.attributes?.['resource-id'] ||
                 el.attributes?.resourceId;
        });
        
        // Check for iOS-specific element types
        const hasIOSElements = elements.some(el => {
          const type = (el.type || '').toLowerCase();
          return type.includes('xcui') || 
                 type.includes('uikit') ||
                 type.includes('swiftui') ||
                 el.attributes?.accessibilityIdentifier;
        });
        
        if (hasAndroidElements && !hasIOSElements) {
          platform = 'android';
          console.log('🤖 Auto-detected platform: Android');
        } else if (hasIOSElements && !hasAndroidElements) {
          platform = 'ios';
          console.log('🍎 Auto-detected platform: iOS');
        } else {
          // Default to iOS if unclear
          platform = 'ios';
          console.log('⚠️  Could not auto-detect platform, defaulting to iOS');
        }
      }
      
      const violations = validateElements(elements, { id: 'manual', name: screenLabel }, platform.toLowerCase());
      if (violations.length === 0) {
        console.log(`\u2705 Pulse Audit \u2014 "${screenLabel}": All ${elements.length} elements passed`);
      } else {
        console.log(`\u26a0\ufe0f  Pulse Audit \u2014 "${screenLabel}": ${violations.length} violation(s) across ${elements.length} elements`);
        violations.forEach((v) => {
          const icon = v.severity === 'error' ? '\ud83d\udd34' : v.severity === 'warning' ? '\ud83d\udfe1' : '\ud83d\udd35';
          console.log(`  ${icon} ${v.component} ("${v.element}") \u2014 ${v.rule}`);
        });
      }
    } catch (err) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
    process.exit(0);
  }

  const reportDir = process.argv[2];
  if (!reportDir) {
    console.error('Usage: node pulse-component-validator.js <report-dir>');
    process.exit(1);
  }

  try {
    const result = validateReportDir(reportDir);
    const outputFile = path.join(reportDir, 'pulse-validation.json');
    fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));

    if (result.violations.length > 0) {
      console.log(`⚠️  Pulse Validation: ${result.violations.length} violation(s) found across ${result.totalChecked} elements`);
      result.violations.forEach((v) => {
        const icon = v.severity === 'error' ? '🔴' : v.severity === 'warning' ? '🟡' : '🔵';
        console.log(`  ${icon} [${v.screen}] ${v.component} — ${v.rule} (element: "${v.element}")`);
      });
      console.log(`📄 Results written to: ${outputFile}`);
    } else {
      console.log(`✅ Pulse Validation: All ${result.totalChecked} checked elements meet Pulse standards`);
    }
  } catch (err) {
    console.error(`Pulse validator error: ${err.message}`);
    process.exit(1);
  }
}
