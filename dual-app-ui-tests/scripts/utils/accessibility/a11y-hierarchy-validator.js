'use strict';

/**
 * A11y Hierarchy Validator
 *
 * Analyses every captured hierarchy JSON in <reportDir>/hierarchies/ and runs
 * WCAG 2.1 / 2.2 checks against the real element data — producing per-screen
 * results identical in structure to the Pulse validator so the report renders
 * a full start-to-end screen journey instead of a single aggregate result.
 *
 * WCAG criteria checked (from actual element attributes):
 *   1.1.1  Non-text Content        (A)  — images without accessibility labels
 *   1.3.1  Info and Relationships  (A)  — form fields without visible labels
 *   2.4.4  Link Purpose            (A)  — links with no descriptive text/hint
 *   2.5.5  Target Size             (AAA)— touch targets < 44pt (iOS) / 48dp (Android)
 *   2.5.8  Target Size (Minimum)   (AA) — WCAG 2.2 successor of 2.5.5
 *   4.1.2  Name, Role, Value       (A)  — interactive elements missing name/role
 *
 * DIFFERENCE FROM EXISTING accessibilityTester.js / voiceOverTester.js:
 *   Those files use hardcoded/example values and produce one aggregate report.
 *   This validator reads REAL captured element data and generates per-screen
 *   panels that the report can show alongside the Pulse section.
 *
 * Usage (module):
 *   const a11y = require('./a11y-hierarchy-validator');
 *   const data = a11y.validateReportDir('/path/to/report', 'ios');
 *
 * Usage (CLI):
 *   node a11y-hierarchy-validator.js <report-dir> [platform]
 */

const fs   = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function _str(v) { return (v == null ? '' : String(v)).trim(); }
function _lc(v)  { return _str(v).toLowerCase(); }

function _label(el) {
  return _str(
    el.attributes?.label ||
    el.attributes?.['content-desc'] ||
    el.attributes?.contentDesc ||
    el.label ||
    el.text || ''
  );
}

function _identifier(el) {
  return _str(
    el.attributes?.identifier ||
    el.attributes?.['resource-id'] ||
    el.identifier || ''
  );
}

function _parseBounds(el) {
  const bounds = _str(el.attributes?.bounds || el.bounds || '');
  const m = bounds.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
  if (m) {
    return {
      w: parseInt(m[3]) - parseInt(m[1]),
      h: parseInt(m[4]) - parseInt(m[2])
    };
  }
  return {
    w: Number(el.width  || 0),
    h: Number(el.height || 0)
  };
}

function _isInteractive(el) {
  if (typeof el.isInteractive === 'boolean') return el.isInteractive;
  if (typeof el.interactive  === 'boolean') return el.interactive;
  const role = _lc(el.type || el._uiRole || '');
  return ['button', 'textfield', 'switch', 'checkbox', 'link'].includes(role);
}

function _uiRole(el) {
  const raw = _lc(el.type || el._uiRole || '');
  if (raw) return raw;
  const id  = _lc(_identifier(el));
  const lbl = _lc(_label(el));
  if (/(password|email|mobile|phone|username|search|input|field)/.test(id)) return 'textfield';
  if (/(link|href)/.test(id) || /(terms|privacy|learn more|read more)/.test(lbl)) return 'link';
  if (raw.includes('switch') || raw.includes('toggle')) return 'switch';
  if (raw.includes('image') || raw.includes('icon'))    return 'image';
  return raw || 'unknown';
}

// ---------------------------------------------------------------------------
// WCAG rules — each returns { passed, issue } where issue is null when OK
// ---------------------------------------------------------------------------
const WCAG_RULES = [
  // 4.1.2 Name, Role, Value — all interactive elements need an accessible name
  {
    id:       '4.1.2-interactive-missing-name',
    criterion:'4.1.2 Name, Role, Value',
    level:    'A',
    severity: 'error',
    applies:  (el) => _isInteractive(el) && !['image'].includes(_uiRole(el)),
    check:    (el) => {
      const lbl = _label(el);
      const txt = _str(el.text || '');
      // Pass if there is a visible label, accessible label, or non-empty button text
      return lbl === '' && txt === '';
    },
    message:  (el) => {
      const role = _uiRole(el) || 'element';
      return `Interactive ${role} (${_identifier(el) || 'unknown id'}) has no accessible name — VoiceOver/TalkBack reads nothing`;
    },
    remediation: 'Set accessibilityLabel on the element, or ensure visible text is present.'
  },

  // 1.1.1 Non-text Content — images need alt text
  {
    id:       '1.1.1-image-missing-alt',
    criterion:'1.1.1 Non-text Content',
    level:    'A',
    severity: 'error',
    applies:  (el) => _uiRole(el) === 'image',
    check:    (el) => _label(el) === '' && _str(el.text || '') === '',
    message:  (el) => `Image (${_identifier(el) || 'unknown id'}) has no accessibility label — screen readers cannot describe it`,
    remediation: 'Provide an accessibilityLabel describing the image purpose, or use .accessibilityHidden(true) for purely decorative images.'
  },

  // 1.3.1 Info and Relationships — text fields need labels
  {
    id:       '1.3.1-textfield-missing-label',
    criterion:'1.3.1 Info and Relationships',
    level:    'A',
    severity: 'error',
    applies:  (el) => _uiRole(el) === 'textfield',
    check:    (el) => _label(el) === '',
    message:  (el) => `Text field (${_identifier(el) || 'unknown id'}) has no label — users cannot determine what to enter`,
    remediation: 'Set labelText or accessibilityLabelText on PSTextField (iOS) / labelText on PulseTextInputField (Android).'
  },

  // 2.4.4 Link Purpose — links need descriptive accessible names
  {
    id:       '2.4.4-link-missing-description',
    criterion:'2.4.4 Link Purpose (In Context)',
    level:    'A',
    severity: 'warning',
    applies:  (el) => _uiRole(el) === 'link',
    check:    (el) => {
      const lbl = _label(el);
      const txt = _str(el.text || '');
      // Generic or empty — fails
      return lbl === '' && txt === '';
    },
    message:  (el) => `Link (${_identifier(el) || 'unknown id'}) has no accessible name`,
    remediation: 'Provide a clear link label or use PSStandaloneLink/PulseStandaloneLink with text. Avoid links with empty labels.'
  },

  // 2.5.5 / 2.5.8 Target Size — touch targets < 44pt (iOS) or 48dp (Android)
  {
    id:       '2.5.5-touch-target-too-small',
    criterion:'2.5.5 Target Size (WCAG 2.1 AAA) / 2.5.8 Target Size Minimum (WCAG 2.2 AA)',
    level:    'AA',  // 2.5.8 is AA in WCAG 2.2
    severity: 'warning',
    applies:  (el) => _isInteractive(el),
    check:    (el, platform) => {
      const { w, h } = _parseBounds(el);
      if (w === 0 && h === 0) return false; // no bounds → skip
      const min = platform === 'android' ? 48 : 44;
      return w < min || h < min;
    },
    message:  (el, platform) => {
      const { w, h } = _parseBounds(el);
      const min = platform === 'android' ? 48 : 44;
      return `Touch target ${w}×${h}${platform === 'android' ? 'dp' : 'pt'} — below ${min}×${min} minimum (${_label(el) || _str(el.text || '') || _identifier(el) || 'unknown'})`;
    },
    remediation: 'Increase touch target to at least 44×44pt (iOS) or 48×48dp (Android).'
  },

  // 4.1.2 — switches and checkboxes need an accessible name
  {
    id:       '4.1.2-toggle-missing-name',
    criterion:'4.1.2 Name, Role, Value',
    level:    'A',
    severity: 'error',
    applies:  (el) => ['switch', 'checkbox'].includes(_uiRole(el)),
    check:    (el) => _label(el) === '' && _str(el.text || '') === '',
    message:  (el) => `${_uiRole(el)} (${_identifier(el) || 'unknown id'}) has no accessible name — VoiceOver/TalkBack cannot announce its purpose`,
    remediation: 'Set accessibilityLabel on the parent container (PSToggle) or text param (PulseSwitch).'
  }
];

// ---------------------------------------------------------------------------
// VoiceOver-specific rules — complementary to the WCAG rules above.
// These are derived purely from the element attributes available in the
// Maestro hierarchy capture (identifier, label, value, enabled, bounds, type).
// iOS: VoiceOver   Android: TalkBack
// ---------------------------------------------------------------------------
const SF_SYMBOL_RE = /\.(fill|circle|slash|square|rectangle|triangle|arrow|badge|dashed|mini|small|large|rtl|ltr)$|\.\w+\.(fill|circle|slash)$|^(magnifyingglass|checkmark|xmark|chevron|info|gear|bell|cart|person|house|paperplane|pencil|trash|bookmark|star|heart|mic|camera|phone|envelope|lock|eye|minus|plus|ellipsis|map|doc|folder|square|clock|calendar|flag|tag|link|textformat|paintbrush|wand|cube|bolt|cpu|wifi|antenna|chart|qrcode|barcode|scanner|shield|key|creditcard|wrench|hammer|screwdriver|bandage|cross|pills|stethoscope)$/i;

const VOICEOVER_RULES = [
  // VO-1: SF Symbol identifier used verbatim as the announced label
  // Pattern: label is empty and identifier looks like an SF Symbol name, OR label == identifier
  // when identifier is a symbol name. VoiceOver reads the identifier literally.
  {
    id:          'vo-icon-only-label',
    category:    'Label Quality',
    criterion:   'VoiceOver Announcement Quality',
    wcag:        '1.1.1 / 4.1.2',
    level:       'A',
    severity:    'error',
    applies:     (el) => {
      const id = _identifier(el);
      return id !== '' && SF_SYMBOL_RE.test(id);
    },
    check:       (el) => {
      const id  = _identifier(el);
      const lbl = _label(el);
      // Violation: label == identifier (raw symbol name) OR label is empty on an interactive element
      return lbl === id || (lbl === '' && _isInteractive(el));
    },
    message:     (el) => {
      const id  = _identifier(el);
      const lbl = _label(el);
      return lbl === '' || lbl === id
        ? `VoiceOver announces "${id || '(no label)'}" — a system icon name, not a human-readable description`
        : `VoiceOver label "${lbl}" mirrors the SF Symbol identifier "${id}"`;
    },
    remediation: 'Set accessibilityLabel to a human-readable description (e.g., "Search" instead of "magnifyingglass", "Record audio" instead of "mic.fill").'
  },

  // VO-2: Text field has a value/placeholder but no label
  // VoiceOver announces the value/placeholder without any field context.
  {
    id:          'vo-textfield-value-no-label',
    category:    'Form Accessibility',
    criterion:   'VoiceOver Text Field Announcement',
    wcag:        '1.3.1',
    level:       'A',
    severity:    'warning',
    applies:     (el) => _uiRole(el) === 'textfield' && _str(el.attributes?.value || '') !== '',
    check:       (el) => _label(el) === '',
    message:     (el) => `Text field has value "${el.attributes?.value}" but no accessibility label — VoiceOver announces the value without field context`,
    remediation: 'Add accessibilityLabel so VoiceOver announces both label and current value in sequence.'
  },

  // VO-3: Disabled interactive element has no label
  // VoiceOver says "dimmed" but cannot say what is dimmed.
  {
    id:          'vo-disabled-missing-label',
    category:    'State Announcement',
    criterion:   'VoiceOver Disabled Element',
    wcag:        '4.1.2',
    level:       'A',
    severity:    'warning',
    applies:     (el) => _isInteractive(el) && el.attributes?.enabled === false,
    check:       (el) => _label(el) === '' && _str(el.text || '') === '',
    message:     (el) => `Disabled element (${_identifier(el) || 'unknown'}) has no label — VoiceOver announces "dimmed" without identifying what is dimmed`,
    remediation: 'Provide an accessibilityLabel even on disabled controls so VoiceOver users know what they cannot activate.'
  },

  // VO-4: Label prefixed with the element type (role redundancy)
  // VoiceOver appends the role automatically, so "button Settings" becomes
  // "button Settings, button" — a double-announcement anti-pattern.
  {
    id:          'vo-label-type-redundancy',
    category:    'Label Quality',
    criterion:   'VoiceOver Label Redundancy',
    wcag:        '4.1.2',
    level:       'A',
    severity:    'warning',
    applies:     (el) => _isInteractive(el) && _label(el) !== '',
    check:       (el) => {
      const lbl  = _lc(_label(el));
      const role = _uiRole(el);
      return lbl === role || lbl.startsWith(role + ' ');
    },
    message:     (el) => `Label "${_label(el)}" starts with element type "${_uiRole(el)}" — VoiceOver announces the role automatically, producing a double-announcement`,
    remediation: 'Remove the element type prefix from the label. VoiceOver handles role announcement separately.'
  }
];

// ---------------------------------------------------------------------------
// VoiceOver navigation order analysis.
// Parses bounds for all visible interactive elements and checks whether their
// DOM order matches the expected visual top→bottom, left→right reading order.
// Mismatches cause confusing VoiceOver swipe navigation.
// ---------------------------------------------------------------------------
function _analyzeNavOrder(elements) {
  const parsed = elements
    .map((el, domIdx) => {
      const bounds = _str(el.attributes?.bounds || el.bounds || '');
      const m = bounds.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
      if (!m) return null;
      const x1 = parseInt(m[1]), y1 = parseInt(m[2]);
      const x2 = parseInt(m[3]), y2 = parseInt(m[4]);
      return {
        domIdx,
        el,
        x1, y1, x2, y2,
        label: _label(el) || _str(el.text || '') || '(no label)',
        id:    _identifier(el)
      };
    })
    .filter(Boolean);

  if (parsed.length < 2) return [];

  // Sort visually: top-to-bottom, then left-to-right within the same row
  // Two elements are "same row" if their top edges are within 20pt/dp.
  const visual = [...parsed].sort((a, b) => {
    const yDiff = a.y1 - b.y1;
    if (Math.abs(yDiff) > 20) return yDiff;
    return a.x1 - b.x1;
  });

  const issues = [];
  visual.forEach((item, visualIdx) => {
    if (item.domIdx !== visualIdx) {
      issues.push({
        elementName: item.label,
        identifier:  item.id,
        domPosition: item.domIdx + 1,
        visualPosition: visualIdx + 1,
        bounds: `[${item.x1},${item.y1}][${item.x2},${item.y2}]`
      });
    }
  });
  return issues;
}

// Runs per-element VoiceOver checks and nav-order analysis for one screen.
function _auditVoiceOver(elements, platform) {
  const visible = elements.filter(el => {
    return typeof el.isVisible === 'boolean' ? el.isVisible : (typeof el.visible === 'boolean' ? el.visible : true);
  });

  const elementChecks = visible.map(el => {
    const { w, h } = _parseBounds(el);
    const checks = VOICEOVER_RULES.map(rule => {
      const applies = rule.applies(el, platform);
      const violated = applies ? rule.check(el, platform) : false;
      return {
        id:          rule.id,
        category:    rule.category,
        criterion:   rule.criterion,
        wcag:        rule.wcag,
        level:       rule.level,
        severity:    rule.severity,
        applies,
        result:      applies ? !violated : null,   // true=pass, false=fail, null=N/A
        message:     applies && violated ? rule.message(el) : null,
        remediation: rule.remediation
      };
    });
    return {
      elementName:   _label(el) || _str(el.text || '') || '(no label)',
      identifier:    _identifier(el),
      type:          _uiRole(el),
      dimensions:    w > 0 && h > 0 ? `${w}\u00d7${h}${platform === 'android' ? 'dp' : 'pt'}` : '',
      depth:         el.depth || 0,
      enabled:       el.attributes?.enabled !== false,
      checks
    };
  });

  const navOrderIssues = _analyzeNavOrder(
    visible.filter(el => _isInteractive(el))
  );

  return { elementChecks, navOrderIssues };
}

// ---------------------------------------------------------------------------
// Screen-type predictive checklist for iOS visited screens (no element data)
// Same idea as Pulse predictive checklist but WCAG-focussed.
// ---------------------------------------------------------------------------
function predictiveA11yChecklist(screenName) {
  const n = _lc(screenName || '');
  const checks = [];

  const row = (wcag, level, sev, item) => ({ wcag, level, sev, item });

  if (/(sign.?in|log.?in|login|authentication|onboarding)/.test(n)) {
    checks.push(row('1.3.1', 'A',  'error',   'Email/phone field must have a visible label (not just placeholder text) — screen readers read the label, not the placeholder'));
    checks.push(row('1.3.1', 'A',  'error',   'Password field must be labelled AND marked as secure text entry'));
    checks.push(row('4.1.2', 'A',  'error',   'All interactive elements (Sign in button, links) must have an accessible name'));
    checks.push(row('2.5.5', 'AA', 'warning', '"Sign in" and "Continue" buttons must be ≥ 44×44pt (iOS HIG / WCAG 2.5.8)'));
    checks.push(row('2.4.4', 'A',  'warning', '"Forgot password?" link must have descriptive text (not just an icon)'));
  } else if (/(otp|code|verif|two.?factor|mfa)/.test(n)) {
    checks.push(row('1.3.1', 'A',  'error',   'OTP/verification code field must have a visible label'));
    checks.push(row('4.1.2', 'A',  'error',   '"Confirm" / "Verify" button must have an accessible name'));
    checks.push(row('2.4.4', 'A',  'warning', '"Resend code" link must have descriptive text'));
  } else if (/(home|dashboard|welcome|landing)/.test(n)) {
    checks.push(row('1.1.1', 'A',  'error',   'All images and icons must have accessibilityLabel or .accessibilityHidden(true)'));
    checks.push(row('4.1.2', 'A',  'error',   'All tappable cards/tiles must have an accessible name describing the action'));
    checks.push(row('2.5.5', 'AA', 'warning', 'All interactive elements must be ≥ 44×44pt (iOS)'));
  } else if (/(account|profile|settings)/.test(n)) {
    checks.push(row('4.1.2', 'A',  'error',   'All interactive buttons/toggles must have accessible names'));
    checks.push(row('4.1.2', 'A',  'error',   'Toggle/switch controls must have a parent label — PSToggle uses .labelsHidden()'));
    checks.push(row('2.5.5', 'AA', 'warning', 'Action buttons ("Edit", "Save", "Sign out") ≥ 44×44pt'));
  } else {
    checks.push(row('4.1.2', 'A',  'error',   'All interactive elements (buttons, links, fields) must have an accessible name'));
    checks.push(row('1.1.1', 'A',  'error',   'All images and icons must have alt text or be marked decorative'));
    checks.push(row('2.5.5', 'AA', 'warning', 'Touch targets ≥ 44×44pt (iOS) / 48×48dp (Android)'));
    checks.push(row('1.3.1', 'A',  'error',   'Form fields must have visible labels (not just placeholders)'));
  }
  return checks;
}

// ---------------------------------------------------------------------------
// Core validator — mirrors pulse-component-validator.validateReportDir
// ---------------------------------------------------------------------------
function validateReportDir(reportDir, platform = 'ios') {
  const resolvedPlatform = _lc(platform || 'ios');
  const empty = {
    timestamp: new Date().toISOString(),
    platform: resolvedPlatform,
    totalChecked: 0,
    totalViolations: 0,
    violations: [],
    screens: []
  };

  try {
    const hierarchyDir = path.join(reportDir, 'hierarchies');
    if (!fs.existsSync(hierarchyDir)) return empty;

    const hierarchyFiles = fs.readdirSync(hierarchyDir).filter(f => f.endsWith('.json'));
    if (hierarchyFiles.length === 0) return empty;

    const allViolations = [];
    let totalChecked = 0;
    const screens = [];
    const parsedEntries = [];
    const runtimeOrderedScreens = [];

    for (const file of hierarchyFiles) {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(hierarchyDir, file), 'utf8'));
        const stepName  = _str(data.stepName || '');
        const elements  = data.elements || [];
        const screenName = _formatScreenName(data.testName);
        const ts = data.timestamp || '';
        parsedEntries.push({ stepName, elements, screenName, ts, rawTestName: _str(data.testName || ''), file });
        if (stepName === 'runtime' && screenName) runtimeOrderedScreens.push(screenName);
      } catch (_) {}
    }

    // Sort by timestamp so panels appear in execution order
    parsedEntries.sort((a, b) => {
      const at = Date.parse(a.ts || '') || 0;
      const bt = Date.parse(b.ts || '') || 0;
      return at !== bt ? at - bt : a.file.localeCompare(b.file);
    });

    const screenNameCounts = new Map();

    for (const entry of parsedEntries) {
      try {
        const { stepName, elements, screenName, ts, rawTestName } = entry;
        let effectiveScreenName = screenName;
        if (stepName === 'failure_step' && runtimeOrderedScreens.length > 0) {
          effectiveScreenName = runtimeOrderedScreens[runtimeOrderedScreens.length - 1];
        }

        const isFailureCapture = stepName === 'failure_step';
        const nextCount = (screenNameCounts.get(effectiveScreenName) || 0) + 1;
        screenNameCounts.set(effectiveScreenName, nextCount);
        const baseName    = nextCount > 1 ? `${effectiveScreenName} (${nextCount})` : effectiveScreenName;
        const displayName = isFailureCapture ? `${baseName} · Failure` : baseName;
        const screenId    = `${effectiveScreenName}#${nextCount}${isFailureCapture ? '-failure' : ''}`;

        const violations    = _validateElements(elements, { id: screenId, name: displayName }, resolvedPlatform);
        const elementAudits = _auditAllElements(elements, resolvedPlatform);
        totalChecked += elements.length;
        allViolations.push(...violations);

        const violatedEls    = new Set(violations.map(v => `${v.elementId}::${v.element}`));
        const violationCount = violations.length;
        const passedCount    = Math.max(0, elements.length - violatedEls.size);

        screens.push({
          id: screenId,
          name: effectiveScreenName,
          displayName,
          elementCount: elements.length,
          violationCount,
          passedCount,
          timestamp: ts,
          stepName,
          rawTestName,
          isFailureCapture,
          fileName:     entry.file,
          elementAudits,
          voiceOver: _auditVoiceOver(elements, resolvedPlatform)
        });
      } catch (_) {}
    }

    // Deduplicate
    const seen = new Set();
    const deduped = allViolations.filter(v => {
      const key = `${v.screenId}::${v.elementId}::${v.ruleId}`;
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

function _formatScreenName(testName) {
  if (!testName) return 'Unknown Screen';
  if (/\s/.test(testName) && /[A-Z]/.test(testName)) return testName;
  const pretty = testName
    .replace(/^test_/, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
  return /\bscreen\b$/i.test(pretty) ? pretty : pretty + ' Screen';
}

// Short column headers for the WCAG rule audit matrix table.
const RULE_SHORT_LABELS = {
  '4.1.2-interactive-missing-name': '4.1.2 Name',
  '1.1.1-image-missing-alt':        '1.1.1 Alt',
  '1.3.1-textfield-missing-label':  '1.3.1 Label',
  '2.4.4-link-missing-description': '2.4.4 Link',
  '2.5.5-touch-target-too-small':   '2.5.5 Size',
  '4.1.2-toggle-missing-name':      '4.1.2 Toggle'
};

// Returns a per-element audit matrix: for EVERY visible element, evaluate ALL
// WCAG rules and record result=true(pass)/false(violation)/null(N/A).
// This drives the element-by-element table in the report so passing screens
// show real information instead of a generic "all passed" note.
function _auditAllElements(elements, platform) {
  return elements
    .filter(el => {
      const vis = typeof el.isVisible === 'boolean' ? el.isVisible : (typeof el.visible === 'boolean' ? el.visible : true);
      return vis;
    })
    .map(el => {
      const lbl      = _label(el) || _str(el.text || '');
      const { w, h } = _parseBounds(el);
      const rules    = WCAG_RULES.map(rule => {
        const applies = rule.applies(el);
        return {
          ruleId:     rule.id,
          criterion:  rule.criterion,
          level:      rule.level,
          shortLabel: RULE_SHORT_LABELS[rule.id] || rule.id,
          applies,
          // true = checked and passed, false = violation, null = N/A for this element type
          result:     applies ? !rule.check(el, platform) : null
        };
      });
      return {
        elementName:   lbl || '(no label)',
        identifier:    _identifier(el) || '',
        type:          _uiRole(el),
        rawType:       _str(el.type || ''),
        dimensions:    w > 0 && h > 0 ? `${w}\u00d7${h}${platform === 'android' ? 'dp' : 'pt'}` : '',
        depth:         el.depth || 0,
        isInteractive: _isInteractive(el),
        rules
      };
    });
}

function _validateElements(elements, screenRef, platform) {
  const violations = [];
  const screenName = typeof screenRef === 'string' ? screenRef : (screenRef?.name || 'Unknown Screen');
  const screenId   = typeof screenRef === 'object' && screenRef ? (screenRef.id || screenName) : screenName;

  for (const el of elements) {
    const visible = typeof el.isVisible === 'boolean' ? el.isVisible : (typeof el.visible === 'boolean' ? el.visible : true);
    if (!visible) continue;

    for (const rule of WCAG_RULES) {
      if (!rule.applies(el)) continue;
      const violated = typeof rule.check === 'function'
        ? rule.check(el, platform)
        : false;
      if (!violated) continue;

      const lbl = _label(el) || _str(el.text || '') || 'unknown';
      const { w, h } = _parseBounds(el);

      violations.push({
        ruleId:    rule.id,
        criterion: rule.criterion,
        level:     rule.level,
        severity:  rule.severity,
        screen:    screenName,
        screenId,
        element:   lbl,
        elementId: _identifier(el) || 'none',
        elementType: _str(el.type || 'unknown'),
        dimensions: w > 0 && h > 0 ? `${w}×${h}${platform === 'android' ? 'dp' : 'pt'}` : '',
        depth:     el.depth || 0,
        message:   typeof rule.message === 'function' ? rule.message(el, platform) : rule.message,
        remediation: rule.remediation
      });
    }
  }
  return violations;
}

module.exports = { validateReportDir, predictiveA11yChecklist, RULE_SHORT_LABELS, VOICEOVER_RULES };

// ---------------------------------------------------------------------------
// CLI: node a11y-hierarchy-validator.js <report-dir> [ios|android]
// ---------------------------------------------------------------------------
if (require.main === module) {
  const reportDir = process.argv[2];
  const platform  = process.argv[3] || 'ios';
  if (!reportDir) {
    console.error('Usage: node a11y-hierarchy-validator.js <report-dir> [ios|android]');
    process.exit(1);
  }
  const result = validateReportDir(reportDir, platform);
  if (result.totalViolations === 0) {
    console.log(`✅ A11y: All ${result.totalChecked} elements passed WCAG checks`);
  } else {
    console.log(`⚠️  A11y: ${result.totalViolations} violation(s) across ${result.totalChecked} elements`);
    result.violations.forEach(v => {
      const icon = v.severity === 'error' ? '🔴' : '🟡';
      console.log(`  ${icon} [${v.screen}] WCAG ${v.criterion} — ${v.message}`);
    });
  }
}
