#!/usr/bin/env node

/**
 * Unified Maestro Report Generator
 * Generates comprehensive HTML reports for both single tests and test suites
 * with screenshots, failure reasons, execution steps, and device element hierarchy
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const pulseValidator = require('../utils/accessibility/pulse-component-validator');
const screenshotDeduplicator = require('../utils/visual/screenshot-deduplicator');
let a11yValidator = null;
try { a11yValidator = require('../utils/accessibility/a11y-hierarchy-validator'); } catch (_) {}
let failureLocationParser = null;
try { failureLocationParser = require('../utils/analysis/parseFailureLocation'); } catch (_) {}
let failureAnalyzer = null;
try { failureAnalyzer = require('../utils/analysis/failure-analyzer'); } catch (_) {}
// performance-monitor.js is a standalone process (no module.exports); load data directly from disk
let mlEngine = null;
try { mlEngine = require('../utils/analysis/ml-analysis-engine'); } catch (_) {}

// Separate feature flags from positional arguments so callers can pass
// --pulse and/or --a11y in any position without disturbing the existing
// positional arg protocol: <results.xml> <report.html> [platform] [video]
const _argv       = process.argv.slice(2);
const RUN_PULSE          = _argv.includes('--pulse');
const RUN_A11Y           = _argv.includes('--a11y');
const RUN_FIGMA          = _argv.includes('--figma-diff');
const NETWORK_CAPTURE    = _argv.includes('--network-capture');
const _positional = _argv.filter(a => !a.startsWith('--'));

const RESULTS_FILE = _positional[0];
const REPORT_FILE  = _positional[1];
const PLATFORM     = _positional[2] || 'ios';
const VIDEO_FILE   = _positional[3] || '';

// ── Inline SVG platform icons (used in HTML reports instead of emoji) ──
const SVG_APPLE = '<svg width="12" height="12" viewBox="0 0 384 512" fill="currentColor" style="vertical-align:-1px;"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184 4 273.5c0 26.2 4.8 53.3 14.4 81.2 12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/></svg>';
const SVG_ANDROID = '<svg width="12" height="12" viewBox="0 0 576 512" fill="currentColor" style="vertical-align:-1px;"><path d="M420.55 301.93a24 24 0 1 1 24-24 24 24 0 0 1-24 24m-265.1 0a24 24 0 1 1 24-24 24 24 0 0 1-24 24m273.7-144.48 47.94-83a10 10 0 1 0-17.27-10l-48.54 84.07a306.2 306.2 0 0 0-134.63 0l-48.54-84.07a10 10 0 1 0-17.27 10l47.94 83C175.07 198.44 120.25 277.93 120.25 368h335.5c0-90.07-54.82-169.56-126.6-210.55M120.25 368v116a36 36 0 0 0 72 0V368zm263.5 0v116a36 36 0 0 0 72 0V368zM84.25 256a36 36 0 0 0-36 36v116a36 36 0 0 0 72 0V292a36 36 0 0 0-36-36zm407.5 0a36 36 0 0 0-36 36v116a36 36 0 0 0 72 0V292a36 36 0 0 0-36-36z"/></svg>';
function platformIcon(p) { return (p === 'android') ? SVG_ANDROID : SVG_APPLE; }
const VIDEO_EXISTS = VIDEO_FILE && fs.existsSync(VIDEO_FILE);

if (!RESULTS_FILE || !REPORT_FILE) {
  console.error('Usage: generate-unified-report.js <results.xml> <report.html> [platform]');
  process.exit(1);
}

if (!fs.existsSync(RESULTS_FILE)) {
  console.error(`Results file not found: ${RESULTS_FILE}`);
  process.exit(1);
}

const REPORT_DIR = path.dirname(REPORT_FILE);

// Parse timestamp (format: YYYYMMDD_HHMMSS)
function formatTimestamp(timestamp) {
  if (!timestamp) return new Date().toLocaleString();
  const match = timestamp.match(/(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/);
  if (match) {
    const [, year, month, day, hour, min, sec] = match;
    const date = new Date(year, month - 1, day, hour, min, sec);
    return date.toLocaleString();
  }
  return new Date().toLocaleString();
}

// Extract timestamp from report file path
function extractTimestampFromPath(filePath) {
  const match = filePath.match(/(\d{8}_\d{6})/);
  return match ? match[1] : '';
}

function detectReportBrand(reportDir) {
  // BRAND env var takes priority — set by parallel-test.sh which derives it from build_config.yaml
  const envBrand = (process.env.BRAND || '').trim().toLowerCase();
  if (envBrand === 'health100') return { key: 'health100', appId: '', label: 'Health 100' };
  if (envBrand === 'cvshealth') return { key: 'cvshealth', appId: '', label: 'CVS Health' };

  const defaultBrand = {
    key: 'cvshealth',
    appId: '',
    label: 'CVS Health'
  };

  try {
    const logFile = path.join(reportDir, 'logs', 'maestro-test.log');
    if (!fs.existsSync(logFile)) return defaultBrand;

    const logContent = fs.readFileSync(logFile, 'utf8');
    const appIdMatch = logContent.match(/APP_ID:\s*([^\s\n]+)/i);
    const brandEnvMatch = logContent.match(/--env\s+BRAND="([^"]+)"/i);
    const brandHeaderMatch = logContent.match(/^\s*BRAND:\s*([^\s\n]+)/im);

    const appId = appIdMatch ? appIdMatch[1].trim().toLowerCase() : '';
    const brandEnv = brandEnvMatch ? brandEnvMatch[1].trim().toLowerCase() : '';
    const brandHeader = brandHeaderMatch ? brandHeaderMatch[1].trim().toLowerCase() : '';

    if (brandEnv.includes('health100') || brandHeader.includes('health100') || appId.includes('health100')) {
      return { key: 'health100', appId, label: 'Health 100' };
    }

    if (brandEnv.includes('cvshealth') || brandHeader.includes('cvshealth') || appId.includes('cvspharmacy')) {
      return { key: 'cvshealth', appId, label: 'CVS Health' };
    }

    return { ...defaultBrand, appId };
  } catch (_) {
    return defaultBrand;
  }
}

function getBrandTheme(brandKey) {
  const cvsTheme = {
    gradientStart: process.env.REPORT_THEME_CVS_START || '#cc0000',
    gradientEnd: process.env.REPORT_THEME_CVS_END || '#8f0017',
    accent: process.env.REPORT_THEME_CVS_ACCENT || '#cc0000'
  };

  const health100Theme = {
    gradientStart: process.env.REPORT_THEME_HEALTH100_START || '#1A6680',
    gradientEnd: process.env.REPORT_THEME_HEALTH100_END || '#000000',
    accent: process.env.REPORT_THEME_HEALTH100_ACCENT || '#1A6680'
  };

  return brandKey === 'health100' ? health100Theme : cvsTheme;
}

const CVS_LOGO_SVG_PATHS = [
  path.join(__dirname, 'assets', 'cvs-logo.svg'),
  path.join(process.cwd(), 'scripts', 'reporting', 'assets', 'cvs-logo.svg')
];

const CVS_LOGO_PNG_PATHS = [
  path.join(__dirname, 'assets', 'cvs-logo.png'),
  path.join(process.cwd(), 'scripts', 'reporting', 'assets', 'cvs-logo.png')
];

function getCVSLogoMarkup() {
  try {
    // Try PNG first
    const pngPath = CVS_LOGO_PNG_PATHS.find(p => fs.existsSync(p));
    if (pngPath) {
      const pngBase64 = fs.readFileSync(pngPath).toString('base64');
      return `<div class="brand-logo-pill cvs-logo-pill" aria-label="CVS Health logo"><img class="cvs-logo" src="data:image/png;base64,${pngBase64}" alt="CVS Health logo"></div>`;
    }

    // Try SVG
    const svgPath = CVS_LOGO_SVG_PATHS.find(p => fs.existsSync(p));
    if (svgPath) {
      let svgMarkup = fs.readFileSync(svgPath, 'utf8').trim();
      if (!svgMarkup.includes('class="cvs-logo"')) {
        svgMarkup = svgMarkup.replace('<svg ', '<svg class="cvs-logo" ');
      }
      return `<div class="brand-logo-pill cvs-logo-pill" aria-label="CVS Health logo">${svgMarkup}</div>`;
    }
  } catch (_) {}
  // Fallback to text if logo file not found
  return `<div class="brand-logo-pill cvs-logo-pill" aria-label="CVS Health logo"><span class="cvs-logo-text">CVS Health</span></div>`;
}

const CVS_LOGO_MARKUP = getCVSLogoMarkup();

const HEALTH100_LOGO_ASSET_PATHS = [
  path.join(__dirname, 'assets', 'health100-logo.svg'),
  path.join(process.cwd(), 'scripts', 'reporting', 'assets', 'health100-logo.svg')
];

const HEALTH100_LOGO_PNG_PATHS = [
  path.join(__dirname, 'assets', 'health100-logo.png'),
  path.join(process.cwd(), 'scripts', 'reporting', 'assets', 'health100-logo.png')
];

function getHealth100LogoMarkup() {
  try {
    const pngPath = HEALTH100_LOGO_PNG_PATHS.find(p => fs.existsSync(p));
    if (pngPath) {
      const pngBase64 = fs.readFileSync(pngPath).toString('base64');
      return `<div class="brand-logo-pill" aria-label="Health 100 logo"><img class="health100-logo" src="data:image/png;base64,${pngBase64}" alt="Health 100 logo"></div>`;
    }

    const logoPath = HEALTH100_LOGO_ASSET_PATHS.find(p => fs.existsSync(p));
    if (!logoPath) throw new Error('Health100 logo asset not found');
    let svgMarkup = fs.readFileSync(logoPath, 'utf8').trim();
    if (!svgMarkup.includes('class="health100-logo"')) {
      svgMarkup = svgMarkup.replace('<svg ', '<svg class="health100-logo" ');
    }
    return `<div class="brand-logo-pill" aria-label="Health 100 logo">${svgMarkup}</div>`;
  } catch (_) {
    return `<div class="brand-logo-pill" aria-label="Health 100 logo"><span class="cvs-logo">Health 100</span></div>`;
  }
}

function getBrandLogoMarkup(brandKey) {
  if (brandKey === 'health100') {
    return getHealth100LogoMarkup();
  }

  return CVS_LOGO_MARKUP;
}

function formatPlatformLabel(platform) {
  const normalized = (platform || '').toLowerCase();
  if (normalized === 'ios') return 'iOS';
  if (normalized === 'android') return 'Android';
  return platform || '';
}

// Load configuration from config.yaml
function loadConfig() {
  try {
    const yaml = require('js-yaml');
    const configPath = path.join(__dirname, '..', '..', '.maestro', 'config', 'config.yaml');

    if (!fs.existsSync(configPath)) {
      return {};
    }

    const configContent = fs.readFileSync(configPath, 'utf8');
    const config = yaml.load(configContent);

    // Flatten env vars into simple key-value object
    if (config && config.env) {
      return config.env;
    }

    return config || {};
  } catch (e) {
    console.warn(`[Report] Failed to load config.yaml: ${e.message}`);
    return {};
  }
}

// Parse detailed failure information from Maestro logs
function parseDetailedFailureInfo(logContent) {
  if (!logContent) return null;

  const failureInfo = {
    lineNumber: null,
    fileName: null,
    expectedElement: null,
    failureType: null,
    rawError: null
  };

  // Extract line number and file from error messages
  // Pattern: "file.yaml:42" or "at line 42"
  const lineMatch = logContent.match(/([\w-]+\.yaml):(\d+)|at line (\d+)/i);
  if (lineMatch) {
    failureInfo.fileName = lineMatch[1] || null;
    failureInfo.lineNumber = parseInt(lineMatch[2] || lineMatch[3]);
  }

  // Extract expected element from various error patterns
  const elementPatterns = [
    /Element not found[:\s]+["']?([^"'\n]+)["']?/i,
    /Unable to find[:\s]+["']?([^"'\n]+)["']?/i,
    /Could not find[:\s]+["']?([^"'\n]+)["']?/i,
    /assertVisible[:\s]+["']?([^"'\n]+)["']?/i,
    /tapOn[:\s]+["']?([^"'\n]+)["']?/i,
    /Text matching regex[:\s]+["']?([^"'\n]+)["']?/i,
    /visible[:\s]+["']?([^"'\n]+)["']?/i
  ];

  for (const pattern of elementPatterns) {
    const match = logContent.match(pattern);
    if (match && match[1]) {
      failureInfo.expectedElement = match[1].trim();
      break;
    }
  }

  // Determine failure type
  if (logContent.match(/Element not found|Unable to find|Could not find/i)) {
    failureInfo.failureType = 'Element Not Found';
  } else if (logContent.match(/timeout|timed out/i)) {
    failureInfo.failureType = 'Timeout';
  } else if (logContent.match(/assertion.*failed/i)) {
    failureInfo.failureType = 'Assertion Failed';
  } else {
    failureInfo.failureType = 'Test Failed';
  }

  // Extract raw error message (first error line)
  const errorLineMatch = logContent.match(/^.*(?:error|failed|exception)[:\s]+(.+)$/im);
  if (errorLineMatch) {
    failureInfo.rawError = errorLineMatch[1].trim();
  }

  return failureInfo;
}

// Parse XML results
function parseXMLResults(xmlData, reportDir) {
  const tests = [];
  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  // Extract test suite info
  const suiteMatch = xmlData.match(/<testsuite[^>]*tests="(\d+)"[^>]*failures="(\d+)"[^>]*>/);
  if (suiteMatch) {
    totalTests = parseInt(suiteMatch[1]);
    failedTests = parseInt(suiteMatch[2]);
    passedTests = totalTests - failedTests;
  }

  // Extract individual test cases with proper handling of nested elements
  // Use non-greedy [^>]*? so `name=` matches the first attribute, not the `name=` inside `classname=`
  const testcaseRegex = /<testcase[^>]*?\bname="([^"]*)"[^>]*time="([^"]*)"[^>]*>([\s\S]*?)<\/testcase>/g;
  let match;
  let testIndex = 0;

  while ((match = testcaseRegex.exec(xmlData)) !== null) {
    const name = match[1];
    const duration = parseFloat(match[2]);
    const content = match[3];

    // Check if test has failure element
    const failureMatch = content.match(/<failure[^>]*(?:message="([^"]*)")?[^>]*>([^<]*)<\/failure>/);
    const status = failureMatch ? 'failed' : 'passed';
    let failureReason = failureMatch ? (failureMatch[1] || failureMatch[2] || 'Test failed').trim() : '';
    // Preserve the raw XML reason so findFailureLocation can parse the real assertion target,
    // even when we later enrich failureReason with hierarchy/log analysis.
    // Decode common HTML entities so regex patterns can match literal " chars etc.
    const xmlFailureReason = failureReason
      .replace(/&quot;/g, '"').replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'");

    // For failed tests, try to load detailed failure info from logs and hierarchy
    let detailedFailure = null;
    if (status === 'failed') {
      // Determine if the XML already provided a meaningful Maestro assertion message.
      // If so, we keep it as-is and only use hierarchy/log as supplementary detail.
      const isGenericReason = !failureReason ||
        failureReason === 'Unknown error' ||
        failureReason === 'timeout' ||
        /^Test (execution )?failed/.test(failureReason);

      // First, try to get expected element from hierarchy data
      let expectedElementFromHierarchy = null;
      const hierarchyDir = path.join(reportDir, 'hierarchies');
      if (fs.existsSync(hierarchyDir)) {
        try {
          const hierarchyFiles = fs.readdirSync(hierarchyDir).filter(f => f.endsWith('.json'));
          if (hierarchyFiles.length > 0) {
            // Get the most recent hierarchy file
            const hierarchyFile = path.join(hierarchyDir, hierarchyFiles[hierarchyFiles.length - 1]);
            const hierarchyData = JSON.parse(fs.readFileSync(hierarchyFile, 'utf8'));
            if (hierarchyData.failureAnalysis && hierarchyData.failureAnalysis.expectedElement) {
              expectedElementFromHierarchy = hierarchyData.failureAnalysis.expectedElement;
            }
          }
        } catch (e) {
          // Continue without hierarchy data
        }
      }
      
      // Build meaningful failure reason — only enriched when there is no real XML message
      if (isGenericReason && expectedElementFromHierarchy) {
        failureReason = `Element not found: "${expectedElementFromHierarchy}"`;
      } else if (isGenericReason) {
        // Generic failure - try to extract from logs
        const logFile = path.join(reportDir, 'logs', 'maestro-test.log');
        if (fs.existsSync(logFile)) {
          try {
            const logContent = fs.readFileSync(logFile, 'utf8');
            detailedFailure = parseDetailedFailureInfo(logContent);
            
            if (detailedFailure && detailedFailure.expectedElement) {
              failureReason = `Element not found: "${detailedFailure.expectedElement}"`;
            } else {
              // Last resort: provide generic but helpful message
              failureReason = `Test execution failed (timeout or element not found)\nCheck the "Expected vs Actual Elements" section below for details`;
            }
          } catch (e) {
            failureReason = `Test execution failed\nCheck the "Expected vs Actual Elements" section below for details`;
          }
        } else {
          failureReason = `Test execution failed\nCheck the "Expected vs Actual Elements" section below for details`;
        }
      }
      // If !isGenericReason: keep the real Maestro assertion message from XML as-is
    }

    tests.push({
      name: name,
      status: status,
      duration: duration,
      failureReason: failureReason,
      xmlFailureReason: xmlFailureReason,
      detailedFailure: detailedFailure,
      index: testIndex++
    });
  }

  return {
    tests,
    summary: {
      total: totalTests || tests.length,
      passed: passedTests || tests.filter(t => t.status === 'passed').length,
      failed: failedTests || tests.filter(t => t.status === 'failed').length
    }
  };
}

// Get booted simulator device ID
function getBootedSimulatorId() {
  try {
    const output = execSync('xcrun simctl list devices | grep "Booted"', { encoding: 'utf8' });
    const match = output.match(/([A-F0-9]{8}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{12})/);
    return match ? match[1] : null;
  } catch (error) {
    return null;
  }
}

// Capture UI hierarchy from device
function captureHierarchy() {
  const deviceId = getBootedSimulatorId();
  if (!deviceId) {
    return null;
  }

  try {
    let output = '';
    
    // Try xcrun simctl get_accessibility_tree
    try {
      output = execSync(`xcrun simctl io "${deviceId}" get_accessibility_tree 2>/dev/null || echo ""`, {
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024,
        timeout: 5000
      });
    } catch (e) {
      // Fallback to maestro hierarchy
    }
    
    if (!output.trim()) {
      try {
        output = execSync(`maestro hierarchy 2>/dev/null || echo ""`, {
          encoding: 'utf8',
          maxBuffer: 10 * 1024 * 1024,
          timeout: 5000
        });
      } catch (e) {
        // Both methods failed
      }
    }

    if (!output.trim()) {
      return null;
    }

    return parseHierarchy(output);
  } catch (error) {
    return null;
  }
}

// Recursively walk a JSON hierarchy node (Maestro >=2.6.0) into the flat
// element array the rest of the report pipeline expects.
function walkJSONHierarchy(node, depth, counter) {
  const elements = [];

  if (Array.isArray(node)) {
    node.forEach(item => elements.push(...walkJSONHierarchy(item, depth, counter)));
    return elements;
  }
  if (!node || typeof node !== 'object') return elements;

  const attrs = node.attributes || {};
  const text = String(
    attrs.text || attrs.accessibilityText || attrs.title || attrs.value || node.title || ''
  ).trim();
  const rawType = String(
    attrs.type || attrs.role || attrs.elementType || node.type || ''
  ).toLowerCase();

  if (text) {
    elements.push({
      id: counter.n++,
      depth,
      text,
      attributes: attrs,
      isButton: /button|btn/.test(rawType) || /button|tap|press/i.test(text),
      isTextField: /textfield|edittext|input|secure/.test(rawType) || /text field|input|password/i.test(text),
      isLabel: /label|statictext/.test(rawType) || (/label|text/i.test(text) && !/button|field/i.test(text)),
      isVisible: attrs.enabled !== false && attrs.enabled !== 'false' &&
                 !/hidden|off-screen/i.test(JSON.stringify(attrs).toLowerCase())
    });
  }

  const children = node.children || node.childNodes || [];
  children.forEach(child => elements.push(...walkJSONHierarchy(child, depth + 1, counter)));
  return elements;
}

// Parse accessibility tree into structured format.
// Maestro >=2.6.0 outputs pure JSON; older versions output an indented text tree.
// JSON is tried first; the text parser is kept as a fallback for older Maestro installs.
function parseHierarchy(treeOutput) {
  const lines = treeOutput.split('\n');

  // JSON path (Maestro >=2.6.0): find first { line and parse from there.
  const jsonIdx = lines.findIndex(l => l.trim().startsWith('{'));
  if (jsonIdx >= 0) {
    try {
      const jsonData = JSON.parse(lines.slice(jsonIdx).join('\n'));
      if (jsonData && typeof jsonData === 'object') {
        return walkJSONHierarchy(jsonData, 0, { n: 0 });
      }
    } catch (e) {
      // Fall through to legacy text parser
    }
  }

  // Legacy text-tree path (Maestro <2.6.0)
  const elements = [];
  lines.forEach((line, index) => {
    if (!line.trim()) return;

    const depthMatch = line.match(/^(\s*)/);
    const depth = depthMatch ? Math.floor(depthMatch[1].length / 2) : 0;

    const content = line.trim();
    const textMatch = content.match(/^([^\[\]]+)/);
    const text = textMatch ? textMatch[1].trim() : content;

    const attributes = {};
    const attrRegex = /(\w+)=([^,\]]+)/g;
    let match;
    while ((match = attrRegex.exec(content)) !== null) {
      attributes[match[1]] = match[2].trim();
    }

    if (text && text.length > 0) {
      elements.push({
        id: index,
        depth: depth,
        text: text,
        attributes: attributes,
        isButton: /button|tap|press/i.test(text),
        isTextField: /text field|input|password/i.test(text),
        isLabel: /label|text/i.test(text) && !/button|field/i.test(text),
        isVisible: !/hidden|off-screen/i.test(content)
      });
    }
  });

  return elements;
}

// Generate HTML for hierarchy display with failure analysis
function generateHierarchyHTML(hierarchyData, expectedElement) {
  if (!hierarchyData) {
    return '<p>No hierarchy data available</p>';
  }

  // If we have failure analysis, use it
  if (hierarchyData.failureAnalysis) {
    const { failureAnalysis } = hierarchyData;
    let html = `<div class="failure-section">`;
    
    // Determine which expected element to use (prioritize failureAnalysis.expectedElement)
    const actualExpectedElement = failureAnalysis.expectedElement || expectedElement || failureAnalysis.failedElement;
    
    // Show the failed element that Maestro tried to interact with
    html += `
      <div class="expected-vs-actual">
        <div class="expected-element-box">
          <h5>❌ Maestro Failed on This Element</h5>
          <div class="element-details">`;
    
    if (actualExpectedElement) {
      html += `
            <p><strong>Element Maestro Was Looking For:</strong> <code>${actualExpectedElement}</code></p>
            <p><strong>Status:</strong> <span class="status-not-found">Not Found on Screen</span></p>`;
      
      // Show debugging hints
      html += `
            <div style="margin-top: 15px; padding: 10px; background: #fff; border-left: 3px solid #ffc107; border-radius: 4px;">
              <p style="margin: 0; font-size: 13px; color: #856404;"><strong>🔍 Debugging Tips:</strong></p>
              <ul style="margin: 8px 0 0 20px; padding: 0; font-size: 12px; color: #856404;">
                <li>Check if the element text has changed in the app</li>
                <li>Verify the element is visible on screen (not hidden or scrolled off)</li>
                <li>Try using a more specific selector (ID or accessibility label)</li>
                <li>Add a wait/scroll command before interacting with this element</li>
              </ul>
            </div>`;
    } else {
      html += `
            <p><em>Unable to extract expected element from test logs</em></p>`;
    }
    
    html += `
          </div>
        </div>
      </div>`;
    
    // Show count of actual elements found (collapsed by default)
    // Filter out iOS system / status-bar elements so that only actual app-level
    // elements are shown in the "View All Elements on Screen" section.
    const _isSystemEl = (name) => {
      const t = (name || '').trim();
      return (
        /^\d{1,2}:\d{2}(\s?(AM|PM))?$/i.test(t) ||
        /^\d{1,3}%$/.test(t) ||
        /^(no signal|not charging|charging)$/i.test(t) ||
        /\d+\s+of\s+\d+\s+(wi-fi|wifi|cellular)\s+bars/i.test(t) ||
        /ssid/i.test(t) ||
        /^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i.test(t) ||
        /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(t)
      );
    };
    const appScreenElements = (failureAnalysis.screenElements || []).filter(
      el => !_isSystemEl(el.name)
    );

    if (appScreenElements.length > 0) {
      const captureInfo = failureAnalysis.captureCount
        ? `Automatically captured ${failureAnalysis.captureCount} time(s) during test execution`
        : (failureAnalysis.captureSource === 'failure_step'
            ? 'Captured at failure step'
            : 'Captured during test execution');
      
      html += `
      <details style="margin-top: 15px;">
        <summary style="cursor: pointer; padding: 10px; background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 4px; font-weight: 600; color: var(--brand-accent);">
          📋 View All Elements on Screen (${appScreenElements.length} found) - Click to expand
        </summary>
        <div style="margin-top: 5px; padding: 8px; background: #e7f3ff; border-left: 3px solid #2196F3; border-radius: 4px;">
          <p style="margin: 0; font-size: 12px; color: #1976D2;">
            ✅ <strong>Automatic Runtime Capture:</strong> ${captureInfo}
          </p>
        </div>
        <div style="margin-top: 10px; padding: 15px; background: #f8f9fa; border: 1px solid #e9ecef; border-radius: 4px;">
          <p style="font-size: 12px; color: #6c757d; margin-bottom: 10px;">These are all UI elements present on screen at failure. Use this if you need to find alternative selectors.</p>
          <table class="elements-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Element Name</th>
                <th>Identifier</th>
                <th>Label</th>
                <th>Interactive</th>
              </tr>
            </thead>
            <tbody>`;
      
      appScreenElements.forEach((el, idx) => {
        const identifier = el.identifier ? `<code>${el.identifier}</code>` : '<em>N/A</em>';
        const label = el.label ? `<code>${el.label}</code>` : '<em>N/A</em>';
        const interactive = el.interactive ? '✓' : '✗';
        const rowClass = el.interactive ? 'interactive-row' : '';
        
        html += `
            <tr class="${rowClass}">
              <td>${idx + 1}</td>
              <td><strong>${el.name}</strong></td>
              <td>${identifier}</td>
              <td>${label}</td>
              <td class="interactive-cell">${interactive}</td>
            </tr>`;
      });
      
      html += `
            </tbody>
          </table>
        </div>
      </details>`;
    } else {
      html += `
      <div style="margin-top: 15px; padding: 15px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px;">
        <p style="margin: 0; font-size: 13px; color: #856404;">⚠️ <strong>No screen elements captured.</strong> The app may have crashed or the screen was not accessible at failure point.</p>
      </div>`;
    }
    
    html += `</div>`;
    return html;
  }

  // Fallback to old element tree display if no failure analysis
  const elements = hierarchyData.elements || [];
  if (!elements || elements.length === 0) {
    return '<p>No UI elements captured</p>';
  }

  let html = `
    <div class="hierarchy-section">
      <h4>UI Element Hierarchy at Failure Point</h4>
      <div class="hierarchy-stats">
        <p><strong>Total Elements:</strong> ${elements.length}</p>
        <p><strong>Visible Elements:</strong> ${elements.filter(e => e.isVisible).length}</p>
      </div>
      
      <div class="hierarchy-tree">
        <pre class="hierarchy-content">`;

  elements.forEach(el => {
    const indent = '  '.repeat(el.depth);
    const visibility = el.isVisible ? '✓' : '✗';
    html += `${indent}[${visibility}] ${el.text}\n`;
  });

  html += `</pre>
      </div>
      
      <details class="hierarchy-details">
        <summary>View Full Element Details</summary>
        <table class="hierarchy-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Depth</th>
              <th>Text</th>
              <th>Type</th>
              <th>Visible</th>
            </tr>
          </thead>
          <tbody>`;

  elements.forEach((el, idx) => {
    html += `
            <tr>
              <td>${idx}</td>
              <td>${el.depth}</td>
              <td>${el.text}</td>
              <td>${el.type || 'element'}</td>
              <td>${el.isVisible ? '✓' : '✗'}</td>
            </tr>`;
  });

  html += `
          </tbody>
        </table>
      </details>
    </div>`;

  return html;
}

// Embed an image file as a base64 data URI so the HTML is self-contained.
// Returns null when the file cannot be read (missing or permission error).
function imageToDataUri(filePath) {
  try {
    const ext = path.extname(filePath).toLowerCase();
    const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
    const data = fs.readFileSync(filePath).toString('base64');
    return `data:${mime};base64,${data}`;
  } catch (e) {
    return null;
  }
}

// Recursively find all screenshots in a directory.
// Each entry carries an inline base64 data URI so the generated HTML is
// fully self-contained and renders correctly after artifact download.
function findScreenshots(dir, screenshots = []) {
  try {
    if (!fs.existsSync(dir)) return screenshots;

    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const fullPath = path.join(dir, file);

      try {
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          findScreenshots(fullPath, screenshots);
        } else if (file.toLowerCase().endsWith('.png') ||
                   file.toLowerCase().endsWith('.jpg') ||
                   file.toLowerCase().endsWith('.jpeg')) {
          if (!screenshots.find(s => s.path === fullPath)) {
            screenshots.push({
              name: file,
              path: fullPath,
              dataUri: imageToDataUri(fullPath)
            });
          }
        }
      } catch (statError) {
        // Skip files that can't be stat'd
      }
    });
  } catch (e) {
    // Silently ignore directory read errors
  }

  return screenshots;
}

// Returns true if an element has valid, human-readable text (not a raw JSON fragment)
function isValidElement(el) {
  const name = el.name || el.text || '';
  if (!name || name.trim().length === 0) return false;
  // Reject lines that look like raw JSON property fragments from accessibility output
  if (/^\s*"[a-zA-Z]+" ?\:/.test(name)) return false;
  if (/^\s*[\{\}\[\],]/.test(name)) return false;
  if (name.length > 200) return false;
  return true;
}

// Normalize a raw element (with nested attributes) to the flat format expected by the report
function normalizeElement(el) {
  if (!el) return null;
  const attributes = el.attributes || {};
  return {
    name:        el.text || attributes.label || el.name || null,
    type:        el.type || 'element',
    identifier:  attributes.identifier || attributes.id || el.identifier || null,
    label:       attributes.label || el.label || el.text || null,
    value:       attributes.value || el.value || null,
    enabled:     attributes.enabled !== 'false' && el.enabled !== false,
    visible:     el.isVisible !== false,
    interactive: el.isInteractive === true || el.interactive === true,
    bounds:      attributes.bounds || el.bounds || null,
    depth:       el.depth || 0
  };
}

// Load hierarchy data from captured files
// testName is optional — when provided (suite runs), filters hierarchy files
// to only those matching this specific test.
function loadHierarchyData(reportDir, testName) {
  try {
    let hierarchyDir = path.join(reportDir, 'hierarchies');

    // For suite runs, per-test dirs (e.g. REPORT_DIR/basic-chat-interaction/) don't
    // have their own hierarchies/ subfolder. The suite runner captures all hierarchies
    // into the top-level REPORT_DIR/hierarchies/ directory, with filenames prefixed by
    // test name (e.g. basic-chat-interaction_failure_step_*.json). Check the parent
    // directory if the local hierarchies/ doesn't exist.
    if (!fs.existsSync(hierarchyDir)) {
      const parentHierarchyDir = path.join(path.dirname(reportDir), 'hierarchies');
      if (fs.existsSync(parentHierarchyDir)) {
        hierarchyDir = parentHierarchyDir;
        // If no testName was provided, derive it from the reportDir folder name
        if (!testName) {
          testName = path.basename(reportDir);
        }
      } else {
        return null;
      }
    }

    let hierarchyFiles = fs.readdirSync(hierarchyDir).filter(f => f.endsWith('.json'));

    // When testName is provided, filter to only files matching this test
    if (testName && hierarchyFiles.length > 0) {
      const filtered = hierarchyFiles.filter(f => f.startsWith(testName));
      // Only apply filter if it produces results — avoids dropping everything
      // when the naming convention doesn't match
      if (filtered.length > 0) {
        hierarchyFiles = filtered;
      }
    }

    if (hierarchyFiles.length === 0) {
      return null;
    }

    // Separate runtime captures from failure captures
    const runtimeFiles = hierarchyFiles.filter(f => f.includes('_runtime_'));
    const failureFiles = hierarchyFiles.filter(f => !f.includes('_runtime_'));

    let failureAnalysis = null;
    let screenElements = [];
    let elements = [];
    let summary = null;

    // Step 1: Load the failure-step file — this is the authoritative source
    if (failureFiles.length > 0) {
      const failureFile = path.join(hierarchyDir, failureFiles[failureFiles.length - 1]);
      const failureData = JSON.parse(fs.readFileSync(failureFile, 'utf8'));
      failureAnalysis = failureData.failureAnalysis || null;
      elements = failureData.elements || [];
      summary = failureData.summary || null;
    }

    // Step 2: Build the screen element list from the FAILURE FILE first
    // failureAnalysis.screenElements is already normalized (has name, identifier, label at top-level)
    if (failureAnalysis && Array.isArray(failureAnalysis.screenElements) && failureAnalysis.screenElements.length > 0) {
      const validFromFailure = failureAnalysis.screenElements.filter(el => isValidElement(el));
      if (validFromFailure.length > 0) {
        // Good data already exists — use it, skip runtime files entirely
        screenElements = validFromFailure;
        failureAnalysis.captureSource = 'failure_step';
      }
    }

    // Step 3: If failure file had no usable screen elements, try the elements[] array from the failure file
    if (screenElements.length === 0 && elements.length > 0) {
      const normalized = elements.map(el => normalizeElement(el)).filter(el => el && isValidElement(el));
      if (normalized.length > 0) {
        screenElements = normalized;
        if (failureAnalysis) {
          failureAnalysis.screenElements = screenElements;
          failureAnalysis.captureSource = 'failure_step';
        } else {
          failureAnalysis = { screenElements, expectedElement: null, captureSource: 'failure_step' };
        }
      }
    }

    // Step 4: Last resort — look for a runtime capture file whose elements pass validation
    // (Some runtime files contain raw JSON lines parsed as 1000+ fake elements — skip those)
    if (screenElements.length === 0 && runtimeFiles.length > 0) {
      const sorted = runtimeFiles.slice().sort((a, b) => {
        const ta = a.match(/runtime_(.+)\.json/)?.[1] || '';
        const tb = b.match(/runtime_(.+)\.json/)?.[1] || '';
        return tb.localeCompare(ta);
      });

      for (const rf of sorted) {
        const runtimeData = JSON.parse(fs.readFileSync(path.join(hierarchyDir, rf), 'utf8'));
        const rawEls = runtimeData.elements || [];
        const normalized = rawEls.map(el => normalizeElement(el)).filter(el => el && isValidElement(el));
        if (normalized.length > 0 && normalized.length < 200) {
          // De-duplicate by identifier
          screenElements = normalized.reduce((acc, el) => {
            const dup = acc.some(e => e.identifier && el.identifier && e.identifier === el.identifier);
            return dup ? acc : [...acc, el];
          }, []);
          if (failureAnalysis) {
            failureAnalysis.screenElements = screenElements;
            failureAnalysis.captureSource = 'runtime';
          } else {
            failureAnalysis = {
              screenElements,
              expectedElement: null,
              captureTimestamp: runtimeData.timestamp,
              captureSource: 'runtime'
            };
          }
          break;
        }
      }
    }

    // Return merged hierarchy data
    return {
      elements: screenElements.length > 0 ? screenElements : elements,
      failureAnalysis: failureAnalysis,
      summary: summary,
      hasRuntimeCapture: runtimeFiles.length > 0
    };
  } catch (e) {
    console.error(`Error loading hierarchy data: ${e.message}`);
    return null;
  }
}

// Load API calls data from file
function loadAPICallsData(reportDir) {
  try {
    // First try network subdirectory
    let apiCallsFile = path.join(reportDir, 'network', 'api-calls.json');
    if (!fs.existsSync(apiCallsFile)) {
      // Fallback to root directory
      apiCallsFile = path.join(reportDir, 'api-calls.json');
    }
    if (!fs.existsSync(apiCallsFile)) {
      return null;
    }

    const apiCallsData = JSON.parse(fs.readFileSync(apiCallsFile, 'utf8'));
    return apiCallsData;
  } catch (e) {
    return null;
  }
}

// Load CI/CD metadata from file
function loadCIMetadata(reportDir) {
  try {
    const metadataFile = path.join(reportDir, 'ci-metadata.json');
    if (!fs.existsSync(metadataFile)) {
      return null;
    }
    return JSON.parse(fs.readFileSync(metadataFile, 'utf8'));
  } catch (e) {
    return null;
  }
}

// Extract metadata from maestro log and system info for the report metadata grid
function extractReportMetadata(reportDir, platform) {
  const meta = {};
  try {
    const logFile = path.join(reportDir, 'logs', 'maestro-test.log');
    if (fs.existsSync(logFile)) {
      const logContent = fs.readFileSync(logFile, 'utf8');
      const platformMatch = logContent.match(/Platform:\s*([^\n]+)/i);
      if (platformMatch) meta.platform = platformMatch[1].trim();
      const appIdMatch = logContent.match(/APP_ID:\s*([^\s\n]+)/i);
      if (appIdMatch) meta.appId = appIdMatch[1].trim();
      const timeoutMatch = logContent.match(/Execution Timeout:\s*([^\n]+)/i);
      if (timeoutMatch) meta.executionTimeout = timeoutMatch[1].trim();
      const startMatch = logContent.match(/Execution started:\s*([^\n]+)/i);
      if (startMatch) meta.executionStarted = startMatch[1].trim();
      const envMatch = logContent.match(/--env\s+ENVIRONMENT="([^"]+)"/i);
      if (envMatch) meta.environment = envMatch[1].trim();
      const buildMatch = logContent.match(/--env\s+BUILD_CONFIG="([^"]+)"/i);
      if (buildMatch) meta.buildConfig = buildMatch[1].trim();
    }
  } catch (_) {}

  // Add platform info
  if (!meta.platform) meta.platform = platform;

  // Try to get device info
  try {
    if (platform.toLowerCase() === 'ios') {
      const simInfo = execSync('xcrun simctl list devices booted -j 2>/dev/null', { encoding: 'utf8', timeout: 5000 });
      const simData = JSON.parse(simInfo);
      for (const runtime of Object.keys(simData.devices || {})) {
        const booted = (simData.devices[runtime] || []).find(d => d.state === 'Booted');
        if (booted) {
          meta.deviceName = booted.name;
          const osMatch = runtime.match(/iOS[- ](.+)/i) || runtime.match(/(\d+[\d.]+)/);
          if (osMatch) meta.osVersion = 'iOS ' + osMatch[1].replace(/-/g, '.');
          break;
        }
      }
    }
  } catch (_) {}

  // Maestro version
  try {
    const maestroVersion = execSync('maestro --version 2>/dev/null', { encoding: 'utf8', timeout: 5000 }).trim();
    if (maestroVersion) meta.maestroVersion = maestroVersion;
  } catch (_) {}

  return meta;
}

// Load and parse the commands-(testname.yaml).json that Maestro writes when
// --test-output-dir is used.  Returns null when the file is not found.
function loadCommandsJson(reportDir, testName) {
  try {
    // Maestro writes: commands-(test_name_from_yaml).json
    // For suite runs, the directory name might be the filename (TC002_...)
    // but the commands JSON uses the YAML name: field (Launch App Cold Start)

    // First try the exact test name
    let candidate = path.join(reportDir, `commands-(${testName}.yaml).json`);

    // If not found, search for any commands-*.json file in the directory
    if (!fs.existsSync(candidate)) {
      try {
        const files = fs.readdirSync(reportDir);
        const commandsFile = files.find(f => f.startsWith('commands-') && f.endsWith('.json'));
        if (commandsFile) {
          candidate = path.join(reportDir, commandsFile);
        }
      } catch (e) {
        return null;
      }
    }
    
    // If still not found, check debug/ and its nested subdirectories.
    // Maestro writes debug output to debug/<flow-name>/ when --flatten-debug-output
    // is not honoured, so we need to recurse one level deep.
    if (!fs.existsSync(candidate)) {
      const debugDir = path.join(reportDir, 'debug');
      if (fs.existsSync(debugDir)) {
        try {
          const found = (function searchDir(dir) {
            const entries = fs.readdirSync(dir);
            const direct = entries.find(f => f.startsWith('commands-') && f.endsWith('.json'));
            if (direct) return path.join(dir, direct);
            for (const e of entries) {
              const sub = path.join(dir, e);
              try {
                if (fs.statSync(sub).isDirectory()) {
                  const nested = searchDir(sub);
                  if (nested) return nested;
                }
              } catch (_) {}
            }
            return null;
          })(debugDir);
          if (found) candidate = found;
        } catch (e) {
          return null;
        }
      }
    }

    if (fs.existsSync(candidate)) {
      const raw = JSON.parse(fs.readFileSync(candidate, 'utf8'));
      const steps = raw
        .filter(e => e && e.metadata)
        .sort((a, b) => (a.metadata.timestamp || 0) - (b.metadata.timestamp || 0));
      
      // Build set of nested command indices to exclude from duration calculation
      // (runFlowCommand durations already include their nested commands)
      // NOTE: repeatCommand iterations are NOT hidden — they display inline
      const nestedIndices = new Set();
      steps.forEach((s, idx) => {
        const cmd = s.command || {};
        
        // Only hide runFlowCommand nested children, NOT repeatCommand children
        if (cmd.runFlowCommand) {
          const runFlowCmd = cmd.runFlowCommand || {};
          const nestedCommands = (runFlowCmd.commands || []).filter(c => c && Object.keys(c).length > 0);
          if (nestedCommands.length > 0) {
            // Mark subsequent steps as nested if they match the nested command count
            // This is a heuristic since nested commands aren't explicitly indexed
            for (let i = idx + 1; i < idx + 1 + nestedCommands.length && i < steps.length; i++) {
              nestedIndices.add(i);
            }
          }
        }
        // repeatCommand children are intentionally NOT added to nestedIndices
      });
      
      let totalDuration = 0;
      let completedCount = 0;
      let skippedCount = 0;
      steps.forEach((s, idx) => {
        // Skip nested commands to avoid double-counting with their parent runFlow
        if (!nestedIndices.has(idx)) {
          const ms = s.metadata.duration || 0;
          totalDuration += ms;
        }
        if (s.metadata.status === 'COMPLETED') completedCount++;
        else if (s.metadata.status === 'SKIPPED') skippedCount++;
      });
      return { steps, totalDuration, completedCount, skippedCount, nestedIndices };
    }
    // Try without .yaml extension (fallback for different naming schemes)
    const candidateNoExt = path.join(reportDir, `commands-(${testName}).json`);
    if (fs.existsSync(candidateNoExt)) {
      const raw = JSON.parse(fs.readFileSync(candidateNoExt, 'utf8'));
      const steps = raw
        .filter(e => e && e.metadata)
        .sort((a, b) => (a.metadata.timestamp || 0) - (b.metadata.timestamp || 0));
      
      // Build set of nested command indices to exclude from duration calculation
      // (runFlowCommand durations already include their nested commands)
      // NOTE: repeatCommand iterations are NOT hidden — they display inline
      const nestedIndices = new Set();
      steps.forEach((s, idx) => {
        const cmd = s.command || {};
        
        // Only hide runFlowCommand nested children, NOT repeatCommand children
        if (cmd.runFlowCommand) {
          const runFlowCmd = cmd.runFlowCommand || {};
          const nestedCommands = (runFlowCmd.commands || []).filter(c => c && Object.keys(c).length > 0);
          if (nestedCommands.length > 0) {
            // Mark subsequent steps as nested if they match the nested command count
            // This is a heuristic since nested commands aren't explicitly indexed
            for (let i = idx + 1; i < idx + 1 + nestedCommands.length && i < steps.length; i++) {
              nestedIndices.add(i);
            }
          }
        }
        // repeatCommand children are intentionally NOT added to nestedIndices
      });
      
      let totalDuration = 0;
      let completedCount = 0;
      let skippedCount = 0;
      steps.forEach((s, idx) => {
        // Skip nested commands to avoid double-counting with their parent runFlow
        if (!nestedIndices.has(idx)) {
          const ms = s.metadata.duration || 0;
          totalDuration += ms;
        }
        if (s.metadata.status === 'COMPLETED') completedCount++;
        else if (s.metadata.status === 'SKIPPED') skippedCount++;
      });
      return { steps, totalDuration, completedCount, skippedCount, nestedIndices };
    }
    return null;
  } catch (e) {
    return null;
  }
}

// Cache for screen objects to avoid repeated file reads (shared across all formatCommandStep calls)
const screenObjectCache = {};
let screenFilesMapping = null; // Cache for screen file paths

// Auto-scan .maestro/screens directory to build screen name -> file path mapping
function buildScreenFilesMapping() {
  if (screenFilesMapping) return screenFilesMapping; // Return cached
  
  screenFilesMapping = {};
  try {
    const screensDir = path.join(process.cwd(), '.maestro', 'screens');
    if (!fs.existsSync(screensDir)) return screenFilesMapping;
    
    // Recursively scan all .js files in screens directory
    function scanDir(dir, relativePath = '') {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
        
        if (entry.isDirectory()) {
          scanDir(fullPath, relPath);
        } else if (entry.name.endsWith('.js')) {
          // Read file to find output variable name
          const content = fs.readFileSync(fullPath, 'utf8');
          
          // Extract output variable name from: output.{name} = {
          const outputMatch = content.match(/output\.(\w+)\s*=/);
          if (outputMatch) {
            const varName = outputMatch[1];
            screenFilesMapping[varName] = relPath;
          }
        }
      }
    }
    
    scanDir(screensDir);
  } catch (e) {
    // Silently fail if screens dir doesn't exist
  }
  
  return screenFilesMapping;
}

// Build a human-readable label + icon for a single commands-*.json entry.
function formatCommandStep(entry) {
  const cmd = entry.command || {};
  const evCmd = (entry.metadata && entry.metadata.evaluatedCommand) || cmd;
  const type = Object.keys(cmd)[0] || 'unknown';

  
  // Load and parse screen object file to get actual selector value
  function getScreenObjectValue(varPath) {
    // Parse variable like "output.homescreen_error_somethingWentWrong"
    const parts = varPath.split('.');
    if (parts.length < 2 || parts[0] !== 'output') return null;
    
    // Extract screen name and property
    // Patterns: output.homescreen.error_somethingWentWrong or output.homescreen_error_somethingWentWrong
    const screenKey = parts[1]; // e.g., "homescreen" or "account_health100_onboarding"
    
    // Check cache first
    const cacheKey = varPath;
    if (cacheKey in screenObjectCache) {
      return screenObjectCache[cacheKey];
    }
    
    try {
      // Try to find screen file in .maestro/screens
      const screensDir = path.join(process.cwd(), '.maestro', 'screens');
      
      // Build screen files mapping from auto-scan
      const mapping = buildScreenFilesMapping();
      
      const screenFile = mapping[screenKey];
      if (!screenFile) {
        screenObjectCache[cacheKey] = null;
        return null;
      }
      
      const screenPath = path.join(screensDir, screenFile);
      if (!fs.existsSync(screenPath)) {
        screenObjectCache[cacheKey] = null;
        return null;
      }
      
      // Read and parse the screen file
      const fileContent = fs.readFileSync(screenPath, 'utf8');
      
      // Extract the property value from output object
      // Looking for patterns like: error_somethingWentWrong: { text: "Something went wrong.*" }
      const propertyName = parts.length > 2 ? parts.slice(2).join('.') : screenKey.split('_').slice(1).join('_');
      
      // Try to extract the selector value
      const propertyRegex = new RegExp(`${propertyName}\\s*:\\s*\\{[^}]*(?:text|textRegex|id|label)\\s*:\\s*["']([^"']+)["']`, 'i');
      const match = fileContent.match(propertyRegex);
      
      if (match && match[1]) {
        screenObjectCache[cacheKey] = match[1];
        return match[1];
      }
      
      // Also try simple string assignment: property: "value"
      const simpleRegex = new RegExp(`${propertyName}\\s*:\\s*["']([^"']+)["']`, 'i');
      const simpleMatch = fileContent.match(simpleRegex);
      
      if (simpleMatch && simpleMatch[1]) {
        screenObjectCache[cacheKey] = simpleMatch[1];
        return simpleMatch[1];
      }
      
      screenObjectCache[cacheKey] = null;
      return null;
    } catch (e) {
      screenObjectCache[cacheKey] = null;
      return null;
    }
  }

  // Clean variable syntax for display - look up actual screen object or strip ${...}
  function cleanVariableSyntax(str) {
    if (!str) return '';
    // If it's a variable like ${output.homescreen_error_somethingWentWrong}
    if (str.startsWith('${') && str.endsWith('}')) {
      const varPath = str.slice(2, -1); // Remove ${ and }
      
      // Try to get actual value from screen object
      const actualValue = getScreenObjectValue(varPath);
      if (actualValue) return actualValue;
      
      // Fallback: extract just the last part after the last dot for display
      const parts = varPath.split('.');
      const lastPart = parts[parts.length - 1];
      // Convert camelCase/snake_case to readable format
      return lastPart.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim();
    }
    return str;
  }

  // Extract text from a selector or condition-visible object (may be string or {textRegex,text,...})
  function textOf(val) {
    if (!val) return '';
    if (typeof val === 'string') return cleanVariableSyntax(val);
    const text = val.textRegex || val.text || val.id || val.label || '';
    return cleanVariableSyntax(text);
  }

  switch (type) {
    case 'tapOnElement': {
      const t = textOf((evCmd.tapOnElement || {}).selector || (cmd.tapOnElement || {}).selector);
      return { icon: '🖱️', label: `Tap${t ? ': ' + t : ''}` };
    }
    case 'inputTextCommand': {
      const rawText = (evCmd.inputTextCommand || cmd.inputTextCommand || {}).text || '';
      const t = cleanVariableSyntax(rawText);
      return { icon: '⌨️', label: `Type${t ? ': "' + t + '"' : ''}` };
    }
    case 'assertConditionCommand': {
      const ev = evCmd.assertConditionCommand || cmd.assertConditionCommand || {};
      const cond = ev.condition || {};
      const vis = textOf(cond.visible);
      const notVis = textOf(cond.notVisible);
      if (vis) return { icon: '✅', label: `Assert visible: "${vis}"` };
      if (notVis) return { icon: '🚫', label: `Assert not visible: "${notVis}"` };
      return { icon: '✅', label: 'Assert condition' };
    }
    case 'waitForAnimationToEndCommand':
      return { icon: '⏳', label: 'Wait for animation to end' };
    case 'runFlowCommand': {
      const rf = evCmd.runFlowCommand || cmd.runFlowCommand || {};
      const file = rf.file || rf.path || rf.sourceDescription || '';
      // Show relative path (strip leading ../../ etc.) for context
      const displayPath = file ? file.replace(/^(?:\.\.\/)+/, '') : '';
      const name = file ? path.basename(file, '.yaml') : '';
      const condVis = textOf((rf.condition || {}).visible);
      if (condVis) return { icon: '📂', label: `Run flow: ${displayPath || name || 'unknown'} (when: "${condVis}")` };
      return { icon: '📂', label: `Run flow${displayPath ? ': ' + displayPath : (name ? ': ' + name : '')}` };
    }
    case 'runScriptCommand': {
      const rs = evCmd.runScriptCommand || cmd.runScriptCommand || {};
      const sourceDesc = rs.sourceDescription || '';
      const name = sourceDesc ? path.basename(sourceDesc) : '';
      // Only use metadata.output if it exists (actual execution output, not the script source)
      const output = entry.metadata && entry.metadata.output ? entry.metadata.output : '';
      // Only show expandable if there's actual execution output (not the script source code)
      const hasOutput = output && output.trim().length > 0 && output.length < 10000;
      return { 
        icon: '📜', 
        label: `Run script${name ? ': ' + name : ''}`, 
        expandable: hasOutput, 
        details: hasOutput ? output : '' 
      };
    }
    case 'applyConfigurationCommand': {
      const ac = evCmd.applyConfigurationCommand || cmd.applyConfigurationCommand || {};
      const file = ac.file || ac.path || '';
      const name = file ? path.basename(file, '.yaml') : '';
      return { icon: '⚙️', label: `Apply config${name ? ': ' + name : ''}` };
    }
    case 'defineVariablesCommand':
      return { icon: '📌', label: 'Define variables' };
    case 'scrollUntilVisible': {
      const sv = evCmd.scrollUntilVisible || cmd.scrollUntilVisible || {};
      const t = textOf(sv.selector || sv.element || {});
      return { icon: '📜', label: `Scroll until visible${t ? ': "' + t + '"' : ''}` };
    }
    case 'repeatCommand': {
      // Use evaluatedCommand to get actual number instead of ${NUMBER_OF_ACTIONS}
      const rc = evCmd.repeatCommand || cmd.repeatCommand || {};
      const times = rc.times || '?';
      return { icon: '🔁', label: `Repeat ${times} times` };
    }
    case 'swipeCommand': {
      const sw = evCmd.swipeCommand || cmd.swipeCommand || {};
      const dir = sw.direction || '?';
      return { icon: '👆', label: `Swipe ${dir}` };
    }
    case 'backCommand':
      return { icon: '⬅️', label: 'Back' };
    default:
      return { icon: '▶️', label: type.replace(/Command$/, '') };
  }
}

// Extract HAIO Chat Log entries from commands JSON data.
// Returns an array of { question, responseCheck, screenshotName, status } objects.
// Returns empty array for non-HAIO flows.
function extractHAIOChatLog(commandsData, testName) {
  if (!commandsData) return [];
  if (!testName || !testName.toLowerCase().includes('haio')) return [];
  
  // Commands JSON can be either an array or an object with a steps property
  const steps = Array.isArray(commandsData) ? commandsData : (commandsData.steps || []);
  if (steps.length === 0) return [];

  const entries = [];

  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    const cmd = s.command || {};
    const meta = s.metadata || {};
    const evCmd = meta.evaluatedCommand || cmd;
    const type = Object.keys(cmd)[0] || '';

    // Only match inputTextCommand where the RAW template is ${MESSAGE}
    // This filters out login inputs (email, password, DOB, OTP)
    if (type === 'inputTextCommand') {
      const rawText = (cmd.inputTextCommand || {}).text || '';

      // Only include HAIO message inputs — the send-message.yaml subflow uses ${MESSAGE}
      if (rawText !== '${MESSAGE}') continue;

      // Get the actual evaluated text (the real question sent)
      const evalInput = evCmd.inputTextCommand || cmd.inputTextCommand || {};
      const actualText = evalInput.text || rawText;
      if (!actualText || actualText === '${MESSAGE}') continue;

      const entry = {
        question: actualText,
        responseCheck: null,
        screenshotName: null,
        status: meta.status || 'UNKNOWN'
      };

      // Scan ahead for HAIO-specific assertions and takeScreenshot
      for (let j = i + 1; j < Math.min(i + 20, steps.length); j++) {
        const next = steps[j];
        const nextCmd = next.command || {};
        const nextMeta = next.metadata || {};
        const nextEvCmd = nextMeta.evaluatedCommand || nextCmd;
        const nextType = Object.keys(nextCmd)[0] || '';

        // Stop scanning if we hit another ${MESSAGE} input (next question)
        if (nextType === 'inputTextCommand') {
          const nextRaw = (nextCmd.inputTextCommand || {}).text || '';
          if (nextRaw === '${MESSAGE}') break;
        }

        if (nextType === 'assertConditionCommand' && !entry.responseCheck) {
          // Use the RAW condition to identify HAIO-specific assertions
          const rawCond = (nextCmd.assertConditionCommand || {}).condition || {};
          const rawVis = rawCond.visible;
          const rawVisText = typeof rawVis === 'string' ? rawVis : (rawVis ? (rawVis.textRegex || rawVis.text || '') : '');

          // Only capture assertions that are HAIO response checks (regex patterns or known HAIO selectors)
          const isHAIOAssert = /\(\?i\)/.test(rawVisText) ||
            /\$\{output\.haio_chat\.botThinkingIndicator\}/.test(rawVisText) ||
            /\$\{EXPECTED_RESPONSE\}/.test(rawVisText) ||
            /\$\{EXPECTED_CTA\}/.test(rawVisText);

          if (isHAIOAssert) {
            // Use the evaluated (resolved) text for display
            const evCond = (nextEvCmd.assertConditionCommand || {}).condition || {};
            const evVis = evCond.visible;
            const evVisText = typeof evVis === 'string' ? evVis : (evVis ? (evVis.textRegex || evVis.text || '') : '');
            const displayText = evVisText || rawVisText;
            entry.responseCheck = displayText
              .replace(/\(\?i\)/g, '').replace(/\.\*/g, ' ').replace(/\|/g, ' | ')
              .replace(/[\\()]/g, '').replace(/\s{2,}/g, ' ').trim();
            entry.status = nextMeta.status || entry.status;
          }
        }

        if (nextType === 'takeScreenshotCommand') {
          // Use evaluated command path if available (resolves ${SCENARIO_NAME} etc.)
          const evScreenshot = (nextEvCmd.takeScreenshotCommand || {}).path || '';
          const rawScreenshot = (nextCmd.takeScreenshotCommand || {}).path || '';
          const screenshotLabel = evScreenshot || rawScreenshot;
          if (screenshotLabel && /HAIO/i.test(screenshotLabel)) {
            entry.screenshotName = screenshotLabel;
          }
        }
      }

      entries.push(entry);
    }
  }

  return entries;
}

// Match HAIO screenshot name to actual screenshot file in report directory
function findHAIOScreenshot(screenshotName, screenshots) {
  if (!screenshotName || !screenshots || screenshots.length === 0) return null;
  const normalizedName = screenshotName.toLowerCase().replace(/[^a-z0-9]/g, '');
  return screenshots.find(s => {
    const fn = s.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    return fn.includes(normalizedName);
  }) || null;
}

// Extract test details from XML results file and Maestro flow files
function getTestDetails(testName, reportDir) {
  let steps = [];
  let screenshots = [];
  let hierarchy = null;
  let dedupeMetadata = null;

  try {
    // Extract steps from Maestro flow file
    const flowFile = path.join(path.dirname(path.dirname(reportDir)), '.maestro', 'flows', '**', `${testName}.yaml`);
    try {
      const flowFiles = execSync(`find "${path.dirname(path.dirname(reportDir))}/.maestro/flows" -name "${testName}.yaml" 2>/dev/null || echo ""`, {
        encoding: 'utf8',
        maxBuffer: 5 * 1024 * 1024,
        timeout: 5000
      });
      
      if (flowFiles.trim()) {
        const flowPath = flowFiles.trim().split('\n')[0];
        if (fs.existsSync(flowPath)) {
          const flowData = fs.readFileSync(flowPath, 'utf8');
          const lines = flowData.split('\n');
          
          lines.forEach((line) => {
            const trimmed = line.trim();
            // Extract step commands from YAML
            if (trimmed && (
              trimmed.startsWith('- tapOn:') ||
              trimmed.startsWith('- assertVisible:') ||
              trimmed.startsWith('- inputText:') ||
              trimmed.startsWith('- wait:') ||
              trimmed.startsWith('- scroll:') ||
              trimmed.startsWith('- swipe:') ||
              trimmed.startsWith('- runFlow:') ||
              trimmed.startsWith('- hideKeyboard') ||
              trimmed.startsWith('- launchApp')
            )) {
              // Clean up the step text
              const stepText = trimmed.replace(/^-\s+/, '').replace(/:\s*["']?([^"']+)["']?.*/, ': $1');
              if (!steps.includes(stepText)) {
                steps.push(stepText);
              }
            }
          });
        }
      }
    } catch (e) {
      // Continue if flow file not found
    }

    // Recursively find screenshots in all subdirectories
    // Start from report directory and search all nested folders
    screenshots = findScreenshots(reportDir);

    // Also check for test-specific subdirectories
    const testSpecificDir = path.join(reportDir, testName);
    if (fs.existsSync(testSpecificDir)) {
      findScreenshots(testSpecificDir, screenshots);
    }

    // Deduplicate screenshots if enabled
    const config = loadConfig();
    if (config.REPORTS_DEDUPLICATE_SCREENSHOTS === 'true' && screenshots.length > 0) {
      const dedupeOptions = {
        similarityThreshold: parseFloat(config.REPORTS_SIMILARITY_THRESHOLD || '0.95'),
        minTimeGapMs: parseInt(config.REPORTS_MIN_TIME_GAP_MS || '2000'),
        preserveFailures: true,
        preserveFirst: true
      };

      //console.log(`[Report] Deduplicating ${screenshots.length} screenshots (threshold=${dedupeOptions.similarityThreshold}, minGap=${dedupeOptions.minTimeGapMs}ms)`);
      const dedupeResult = screenshotDeduplicator.deduplicateScreenshots(screenshots, dedupeOptions);
      screenshots = dedupeResult.uniqueScreenshots;

      // Store metadata for report
      dedupeMetadata = {
        originalCount: dedupeResult.originalCount,
        uniqueCount: dedupeResult.uniqueCount,
        duplicateCount: dedupeResult.duplicateCount
      };

      //console.log(`[Report] Kept ${dedupeResult.uniqueCount} unique screenshots, filtered ${dedupeResult.duplicateCount} duplicates`);
    }

    // Load hierarchy data if available
    // Pass testName so suite runs can filter to the correct test's hierarchy files
    hierarchy = loadHierarchyData(reportDir, testName);
  } catch (e) {
    // Silently ignore if files don't exist
  }

  const commandsData = loadCommandsJson(reportDir, testName);

  return { steps, screenshots, hierarchy, commandsData, dedupeMetadata };
}

// Read and parse results
let results;
try {
  const xmlData = fs.readFileSync(RESULTS_FILE, 'utf8');
  results = parseXMLResults(xmlData, REPORT_DIR);
} catch (error) {
  console.error(`Failed to parse results file: ${error.message}`);
  process.exit(1);
}

const timestamp = extractTimestampFromPath(REPORT_FILE);
const formattedDate = formatTimestamp(timestamp);
const summary = results.summary;
const passPercentage = summary.total > 0 ? Math.round((summary.passed / summary.total) * 100) : 0;
const reportName = path.basename(REPORT_FILE, '.html');

// Derive a human-readable report title from the test names / suite path.
// Priority: TEST_SUITE env var path → single test name → common prefix of multiple tests → fallback.
function deriveReportTitle(tests) {
  // 1. TEST_SUITE env var (e.g. ".maestro/suites/Benefits/smoke.yaml" → "Benefits · Smoke")
  const suiteEnv = process.env.TEST_SUITE || '';
  if (suiteEnv) {
    const parts = suiteEnv.replace(/\.ya?ml$/i, '').split(/[\\/]/);
    const meaningful = parts.filter(p => !['', '.', '..', '.maestro', 'suites', 'flows', 'subflows'].includes(p));
    if (meaningful.length) {
      return meaningful.map(p => p.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())).join(' · ');
    }
  }
  // 2. Single test — use its name directly
  if (tests.length === 1) {
    return tests[0].name.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
  // 3. Multiple tests — find the longest common path prefix across names
  if (tests.length > 1) {
    const names = tests.map(t => t.name);
    const segments = names.map(n => n.split(/[\\/]/));
    const minLen = Math.min(...segments.map(s => s.length));
    let common = [];
    for (let i = 0; i < minLen - 1; i++) {
      if (segments.every(s => s[i] === segments[0][i])) common.push(segments[0][i]);
      else break;
    }
    if (common.length) {
      const label = common.filter(p => !['flows', 'subflows', '.maestro'].includes(p))
        .map(p => p.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase())).join(' · ');
      if (label) return `${label} (${tests.length} tests)`;
    }
    return `${tests.length} Tests`;
  }
  return 'Test Report';
}
const reportTitle = deriveReportTitle(results.tests);

const reportBrand = detectReportBrand(REPORT_DIR);
const brandTheme = getBrandTheme(reportBrand.key);
const platformLabel = formatPlatformLabel(PLATFORM);

// Compute skipped count (total - passed - failed)
const skippedCount = Math.max(0, summary.total - summary.passed - summary.failed);

// Extract metadata for the metadata grid
const reportMetadata = extractReportMetadata(REPORT_DIR, PLATFORM);

// Compute total duration from individual tests
const totalDurationSec = results.tests.reduce((sum, t) => sum + (t.duration || 0), 0);
const totalDurationFormatted = totalDurationSec >= 60
  ? `${Math.floor(totalDurationSec / 60)}m ${Math.round(totalDurationSec % 60)}s`
  : `${Math.round(totalDurationSec * 10) / 10}s`;

// Load API calls data only when --network-capture flag was explicitly passed
const apiCallsData = (NETWORK_CAPTURE && results.tests.length === 1) ? loadAPICallsData(REPORT_DIR) : null;

// Feature 3: Load environment info
const envInfoPath = path.join(REPORT_DIR, 'meta', 'env-info.json');
let envInfo = null;
try { if (fs.existsSync(envInfoPath)) envInfo = JSON.parse(fs.readFileSync(envInfoPath, 'utf8')); } catch(_) {}

// Feature 5: Load run history for sparkline
const historyPath = path.join(REPORT_DIR, '..', 'run-history.json');
let runHistory = [];
try { if (fs.existsSync(historyPath)) runHistory = JSON.parse(fs.readFileSync(historyPath, 'utf8')); } catch(_) {}
runHistory = runHistory.slice(-20);

// Executive summary: derive feature-area pass/fail from test name codes
// Matches H100_BEN_, CVSH_SNAPP_, H100_SS_, etc. — falls back to "Other"
const FEATURE_CODE_MAP = {
  BEN: 'Benefits', SNAPP: 'Search & Nav', SS: 'Smart Scheduler',
  HAIO: 'HAIO', HOME: 'Home', SHOP: 'Shop', MENU: 'Menu',
  ACCT: 'Account', PHARM: 'Pharmacy', HLTH: 'Health',
};
function featureAreaFromTestName(name) {
  const m = name.match(/(?:H100|CVSH)_([A-Z]+)_/);
  return (m && FEATURE_CODE_MAP[m[1]]) || 'Other';
}
const featureAreaMap = {};
results.tests.forEach(t => {
  const area = featureAreaFromTestName(t.name);
  if (!featureAreaMap[area]) featureAreaMap[area] = { passed: 0, failed: 0 };
  featureAreaMap[area][t.status === 'passed' ? 'passed' : 'failed']++;
});
const featureAreas = Object.entries(featureAreaMap)
  .map(([name, counts]) => ({ name, ...counts, total: counts.passed + counts.failed }))
  .sort((a, b) => b.failed - a.failed || a.name.localeCompare(b.name));

// Pass rate and trend delta vs last run
const currentPassRate = summary.total > 0 ? Math.round((summary.passed / summary.total) * 100) : 0;
const prevRun = runHistory.length >= 2 ? runHistory[runHistory.length - 2] : null;
const prevPassRate = prevRun && prevRun.total > 0 ? Math.round((prevRun.passed / prevRun.total) * 100) : null;
const passRateDelta = prevPassRate !== null ? currentPassRate - prevPassRate : null;

// Release readiness verdict
function releaseVerdict(passRate, hasFailed, featureAreas) {
  const failedAreas = featureAreas.filter(a => a.failed > 0).map(a => a.name);
  if (passRate === 100) return { color: '#16a34a', icon: '✅', text: 'All tests passing — safe to release' };
  if (passRate >= 80 && failedAreas.length <= 2)
    return { color: '#d97706', icon: '⚠️', text: `Minor failures in: ${failedAreas.join(', ')} — review before release` };
  return { color: '#dc2626', icon: '🔴', text: `Failures in: ${failedAreas.join(', ')} — blocking release` };
}
const verdict = summary.total > 1 ? releaseVerdict(currentPassRate, summary.failed > 0, featureAreas) : null;

// Load CI/CD metadata if available
const ciMetadata = loadCIMetadata(REPORT_DIR);

// Run failure analysis on failed tests
let failureReport = null;
if (failureAnalyzer && results.tests.some(t => t.status === 'failed')) {
  try {
    failureReport = failureAnalyzer.generateFailureReport(results.tests);
  } catch (e) {
    console.error('Failure analysis failed:', e.message);
  }
}

// Load performance data if available
const performanceData = (() => {
  const p = path.join(REPORT_DIR, 'performance', 'perf-samples.json');
  if (!fs.existsSync(p)) return null;
  try {
    const d = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (d.durationMs != null && !d.duration) d.duration = { seconds: Math.round(d.durationMs / 1000) };
    return d;
  } catch (_) { return null; }
})();

// Extract HAIO Chat Log for HAIO test flows
let haioChatLog = [];
if (results.tests.length > 0) {
  // For suite runs with multiple tests, aggregate all HAIO chat logs
  const allChatLogs = [];
  
  //console.error(`\n🔍 Searching for HAIO chat logs in ${results.tests.length} tests...`);
  
  for (const test of results.tests) {
    // Check if this is a HAIO test
    if (!test.name || !test.name.toLowerCase().includes('haio')) {
      //console.error(`  ⏭️  Skipping non-HAIO test: ${test.name}`);
      continue;
    }
    
    //console.error(`  🔎 Processing HAIO test: ${test.name}`);
    
    let testDir = REPORT_DIR;
    const candidate = path.join(REPORT_DIR, test.name);
    if (fs.existsSync(candidate)) {
      testDir = candidate;
      console.error(`     ✓ Found test directory: ${candidate}`);
    }
    
    const cd = loadCommandsJson(testDir, test.name);
    //console.error(`     Commands JSON loaded: ${cd ? 'YES' : 'NO'}`);
    
    const log = extractHAIOChatLog(cd, test.name);
    //console.error(`     Chat log entries found: ${log.length}`);
    
    if (log.length > 0) {
      // Add test name prefix to each chat entry for suite context
      const prefixedLog = log.map(entry => ({
        ...entry,
        testName: test.name,
        testDisplayName: test.name.replace(/^TC\d+_HAIO_intent_/, '').replace(/_/g, ' ')
      }));
      allChatLogs.push(...prefixedLog);
      //console.error(`     ✅ Added ${log.length} chat entries`);
    }
  }
  
  //console.error(`\n📊 Total HAIO chat log entries: ${allChatLogs.length}\n`);
  
  haioChatLog = allChatLogs;
  
  // Also collect all HAIO screenshots (named HAIO_*)
  if (haioChatLog.length > 0) {
    const allScreenshots = findScreenshots(REPORT_DIR);
    haioChatLog.forEach(entry => {
      if (entry.screenshotName) {
        const match = findHAIOScreenshot(entry.screenshotName, allScreenshots);
        if (match) { entry.screenshotPath = match.dataUri || match.path; entry.screenshotIsDataUri = !!match.dataUri; }
      }
    });
  }
}

// Run ML analysis if available
let mlReport = null;
if (mlEngine) {
  try {
    const engine = new mlEngine.MLAnalysisEngine(path.join(REPORT_DIR, '..', '.maestro-history'));
    
    // Record this test run for future predictions
    engine.recordTestRun({
      platform: PLATFORM,
      environment: process.env.BUILD_CONFIG || 'qa',
      ciMetadata: ciMetadata,
      summary: summary,
      tests: results.tests,
      performance: performanceData,
    });
    
    // Generate ML analysis report
    mlReport = engine.generateMLReport(results.tests);
  } catch (e) {
    console.error('ML analysis failed:', e.message);
  }
}

// Run Pulse component validation against all captured hierarchies (non-blocking)
// Only executes when --pulse flag is passed to the report generator.
let pulseData = null;
let a11yData  = null;
if (RUN_PULSE) try {
  pulseData = pulseValidator.validateReportDir(REPORT_DIR, PLATFORM.toLowerCase());

  // On iOS, runtime hierarchy captures are disabled to prevent XCTest driver
  // instability. As a fallback, parse the Maestro debug log for screen visits
  // and inject them as lightweight "ios_visited" entries so the Pulse section
  // shows the full start-to-end screen journey (without element data).
  if (pulseData && PLATFORM.toLowerCase() === 'ios') {
    const hasRuntimeScreens = pulseData.screens.some(s => !s.isFailureCapture && s.stepName !== 'ios_visited');
    if (!hasRuntimeScreens) {
      try {
        const debugBase = path.join(REPORT_DIR, 'debug', '.maestro', 'tests');
        if (fs.existsSync(debugBase)) {
          const testDirs = fs.readdirSync(debugBase)
            .filter(f => { try { return fs.statSync(path.join(debugBase, f)).isDirectory(); } catch(_) { return false; } })
            .sort();
          const maestroLog = testDirs.length ? path.join(debugBase, testDirs[0], 'maestro.log') : null;
          if (maestroLog && fs.existsSync(maestroLog)) {
            const lines = fs.readFileSync(maestroLog, 'utf8').split('\n');
            const visited = [];
            const seenNames = new Set();
            for (const line of lines) {
              const m = line.match(/JsConsole: DEBUG: Stored screen name as: (.+)/);
              if (m) {
                const name = m[1].trim();
                if (name && !seenNames.has(name)) {
                  seenNames.add(name);
                  const ts = line.match(/^(\d{2}:\d{2}:\d{2})/)?.[1] || '';
                  visited.push({ name, timestamp: ts });
                }
              }
            }
            // Insert before existing screens (failure captures come last)
            visited.reverse().forEach((v, idx) => {
              pulseData.screens.unshift({
                id: `ios-visited-${idx}-${v.name.replace(/\s+/g, '_')}`,
                name: v.name,
                displayName: v.name,
                elementCount: 0,
                violationCount: 0,
                passedCount: 0,
                timestamp: v.timestamp,
                stepName: 'ios_visited',
                rawTestName: '',
                isFailureCapture: false,
                fileName: ''
              });
            });
          }
        }
      } catch (_) {}
    }
  }

  if (pulseData && pulseData.totalChecked > 0) {
    if (pulseData.totalViolations > 0) {
      console.log(`\u26a0\ufe0f  Pulse: ${pulseData.totalViolations} violation(s) across ${pulseData.totalChecked} elements (informational only)`);
    } else {
      console.log(`\u2705 Pulse: All ${pulseData.totalChecked} elements passed design system validation`);
    }
  }
} catch (_) {
  // Never let Pulse validation break the report
}

// Run A11y WCAG validation (uses same hierarchy JSONs, different rule set)
// Only executes when --a11y flag is passed to the report generator.
if (RUN_A11Y) try {
  if (a11yValidator) {
    a11yData = a11yValidator.validateReportDir(REPORT_DIR, PLATFORM.toLowerCase());
    // On iOS, inject visited screens from debug log (same approach as Pulse)
    if (a11yData && PLATFORM.toLowerCase() === 'ios') {
      // Only skip injection when there are real runtime (non-failure) screens captured.
      // A failure_step screen is not a runtime screen, so visited screens should still be injected.
      const hasRealScreens = a11yData.screens.some(s => !s.isFailureCapture && s.stepName !== 'ios_visited');
      if (!hasRealScreens) {
        try {
          const debugBase = path.join(REPORT_DIR, 'debug', '.maestro', 'tests');
          if (fs.existsSync(debugBase)) {
            const testDirs = fs.readdirSync(debugBase)
              .filter(f => { try { return fs.statSync(path.join(debugBase, f)).isDirectory(); } catch(_) { return false; } })
              .sort();
            const maestroLog = testDirs.length ? path.join(debugBase, testDirs[0], 'maestro.log') : null;
            if (maestroLog && fs.existsSync(maestroLog)) {
              const lines = fs.readFileSync(maestroLog, 'utf8').split('\n');
              const visited = [];
              const seenNames = new Set();
              for (const line of lines) {
                const m = line.match(/JsConsole: DEBUG: Stored screen name as: (.+)/);
                if (m) {
                  const name = m[1].trim();
                  if (name && !seenNames.has(name)) {
                    seenNames.add(name);
                    const ts = line.match(/^(\d{2}:\d{2}:\d{2})/)?.[1] || '';
                    visited.push({ name, timestamp: ts });
                  }
                }
              }
              visited.reverse().forEach((v, idx) => {
                a11yData.screens.unshift({
                  id: `a11y-ios-visited-${idx}-${v.name.replace(/\s+/g, '_')}`,
                  name: v.name,
                  displayName: v.name,
                  elementCount: 0,
                  violationCount: 0,
                  passedCount: 0,
                  timestamp: v.timestamp,
                  stepName: 'ios_visited',
                  rawTestName: '',
                  isFailureCapture: false,
                  fileName: ''
                });
              });
            }
          }
        } catch (_) {}
      }
    }
    if (a11yData && a11yData.totalViolations > 0) {
      console.log(`\u26a0\ufe0f  A11y: ${a11yData.totalViolations} WCAG violation(s) across ${a11yData.totalChecked} elements (informational only)`);
    }
  }
} catch (_) {
  // Never let A11y validation break the report
}

// Run Figma visual diff — compares Maestro screenshots against Figma baselines.
// Only executes when --figma-diff flag is passed to the report generator.
let figmaDiffData = null;
let figmaDiffModule = null;
try { figmaDiffModule = require('./figma-visual-diff'); } catch (_) {}
if (RUN_FIGMA && figmaDiffModule) try {
  figmaDiffData = figmaDiffModule.runFigmaDiff(REPORT_DIR);
  if (figmaDiffData && figmaDiffData.total > 0) {
    if (figmaDiffData.failed > 0) {
      console.log(`\u26a0\ufe0f  Figma Diff: ${figmaDiffData.failed} screen(s) differ from Figma design (${figmaDiffData.total} total)`);
    } else {
      console.log(`\u2705 Figma Diff: All ${figmaDiffData.passed} screen(s) match Figma design`);
    }
  } else if (figmaDiffData && figmaDiffData.error) {
    console.warn(`\u26a0\ufe0f  Figma Diff: ${figmaDiffData.error}`);
  }
} catch (_) {
  // Never let Figma diff break the report
}

// ---------------------------------------------------------------------------
// Predictive Pulse checklist for iOS visited screens (no element data available)
// Generates a screen-type-specific manual validation guide based on screen name.
// ---------------------------------------------------------------------------
function predictiveIosPulseChecklist(screenName) {
  const n = (screenName || '').toLowerCase();

  // Map screen-name keywords → expected Pulse components + key rules to verify
  const checks = [];

  // Sign-in / Login screens
  if (/(sign.?in|log.?in|login|authentication|credential|onboarding)/.test(n)) {
    checks.push({ component: 'PSTextField', scope: 'Email / phone number input field', rule: 'Email/phone field must have <code>labelText</code> or <code>accessibilityLabelText</code> set at init (not empty label)', severity: 'error', ref: 'PSTextField.swift' });
    checks.push({ component: 'PSTextField', scope: 'Password input field', rule: 'Password field must have <code>labelText</code> or <code>accessibilityLabelText</code> — and <code>isSecureTextEntry</code> = true', severity: 'error', ref: 'PSTextField.swift' });
    checks.push({ component: 'PSButton', scope: '"Sign in" / "Continue" button', rule: '"Sign in" / "Continue" button must meet 44×44pt minimum touch target (Constants.HIG)', severity: 'warning', ref: 'PSButton.swift' });
    checks.push({ component: 'PSStandaloneLink', scope: '"Forgot password?" link', rule: '"Forgot password?" link must have <code>accessibilityHint</code> (e.g. "Opens password reset") and use <code>.isLink</code> trait not <code>.isButton</code>', severity: 'warning', ref: 'PSStandaloneLink.swift' });
  }

  // OTP / verification code screens
  if (/(otp|code|verif|confirmation|two.?factor|mfa)/.test(n)) {
    checks.push({ component: 'PSTextField', scope: 'OTP / verification code input field', rule: 'OTP/code field must have <code>labelText</code> set and an <code>accessibilityIdentifier</code> for automation', severity: 'error', ref: 'PSTextField.swift' });
    checks.push({ component: 'PSButton', scope: '"Confirm" / "Verify" button', rule: 'Confirm / Verify button must be ≥ 44×44pt and have visible label', severity: 'warning', ref: 'PSButton.swift' });
    checks.push({ component: 'PSStandaloneLink', scope: '"Resend code" link', rule: '"Resend code" link must use <code>.isLink</code> trait with <code>accessibilityHint</code>', severity: 'warning', ref: 'PSStandaloneLink.swift' });
  }

  // Home / dashboard / launch screens
  if (/(home|dashboard|landing|welcome|splash|launch)/.test(n)) {
    checks.push({ component: 'PSCard / PSTile', scope: 'All tappable cards and tiles', rule: 'All tappable cards/tiles must have an <code>accessibilityLabel</code> on the container describing the action', severity: 'warning', ref: 'PSVerticalCard.swift / PSTile.swift' });
    checks.push({ component: 'PSButton', scope: 'Primary CTA / icon-only buttons', rule: 'Primary CTA buttons must be ≥ 44×44pt and have an explicit accessibilityLabel if icon-only', severity: 'warning', ref: 'PSButton.swift' });
  }

  // Account / profile screens
  if (/(account|profile|dashboard|settings)/.test(n)) {
    checks.push({ component: 'PSButton', scope: '"Sign out", "Edit", "Save" buttons', rule: '"Sign out" / "Edit" / "Save" buttons must be ≥ 44×44pt', severity: 'warning', ref: 'PSButton.swift' });
    checks.push({ component: 'PSToggle', scope: 'Preference / notification toggles', rule: 'Any preference toggle must have its parent container provide <code>.accessibilityLabel()</code> — PSToggle uses <code>.labelsHidden()</code>', severity: 'error', ref: 'PSToggle.swift' });
    checks.push({ component: 'PSAvatar', scope: 'User avatar image', rule: 'User avatar (if shown) must have an <code>accessibilityLabel</code> of the user\'s name; placeholder avatars use <code>.accessibilityHidden(true)</code>', severity: 'warning', ref: 'PSAvatar.swift' });
  }

  // Pharmacy screens
  if (/pharmacy/.test(n)) {
    checks.push({ component: 'PSCard / PSTile', scope: 'Prescription / pharmacy cards', rule: 'Prescription/pharmacy cards must have <code>accessibilityLabel</code> with drug name + dosage for screen reader users', severity: 'warning', ref: 'PSVerticalCard.swift' });
    checks.push({ component: 'PSButton', scope: '"Refill", "Transfer" action buttons', rule: 'Action buttons ("Refill", "Transfer", etc.) must be ≥ 44×44pt', severity: 'warning', ref: 'PSButton.swift' });
  }

  // Generic fallback for any captured screen
  if (checks.length === 0) {
    checks.push({ component: 'PSButton', scope: 'All interactive buttons on screen', rule: 'All interactive buttons ≥ 44×44pt; icon-only buttons need explicit <code>accessibilityLabel</code>', severity: 'warning', ref: 'PSButton.swift' });
    checks.push({ component: 'PSTextField', scope: 'All text input fields on screen', rule: 'All text fields need <code>labelText</code> / <code>accessibilityLabelText</code> at init', severity: 'error', ref: 'PSTextField.swift' });
    checks.push({ component: 'PSStandaloneLink', scope: 'All tappable links on screen', rule: 'All links must use <code>.isLink</code> trait (not button) + have <code>accessibilityHint</code>', severity: 'warning', ref: 'PSStandaloneLink.swift' });
  }

  const severityBadge = (s) => s === 'error'
    ? '<span style="background:#fff3f3;color:#c62828;border:1px solid #ef9a9a;border-radius:3px;padding:1px 5px;font-size:10px;font-weight:600;">ERROR</span>'
    : '<span style="background:#fffde7;color:#f57f17;border:1px solid #ffe082;border-radius:3px;padding:1px 5px;font-size:10px;font-weight:600;">WARN</span>';

  const rows = checks.map(c => `
    <tr>
      <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;white-space:nowrap;">
        <code style="background:#f5f5f5;padding:2px 5px;border-radius:3px;font-size:11px;">${c.component}</code>
      </td>
      <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;font-size:12px;color:#555;">
        ${c.scope}
        <div style="font-size:10px;color:#aaa;margin-top:2px;">📋 Manual check — no live element captured</div>
      </td>
      <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;font-size:12px;">${c.rule}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;white-space:nowrap;">${severityBadge(c.severity)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;white-space:nowrap;font-size:10px;color:#888;">${c.ref}</td>
    </tr>`).join('');

  return `
    <div style="background:#f3e5f5;border-left:3px solid #9c27b0;padding:10px 14px;border-radius:0 6px 6px 0;margin-bottom:10px;">
      <strong style="color:#6a1b9a;">📋 Predictive Checklist — Live Element Capture Unavailable</strong>
      <span style="font-size:12px;color:#555;margin-left:6px;">iOS hierarchy capture is suppressed during test execution to prevent XCTest driver instability. The table below lists the <em>specific elements and Pulse rules expected for this screen type</em> — verify each one manually or re-run the hierarchy capture after the test.</span>
    </div>
    <div style="margin-bottom:10px;font-size:12px;color:#555;background:#fff8e1;border-left:3px solid #ffc107;padding:8px 12px;border-radius:0 4px 4px 0;">
      💡 <strong>To get element-specific violations:</strong> navigate to this screen in Simulator, then run:<br>
      <code style="background:#f5f5f5;padding:2px 5px;border-radius:3px;font-size:11px;">maestro hierarchy --output /tmp/h.json &amp;&amp; node scripts/utils/accessibility/pulse-component-validator.js /tmp/h.json</code>
    </div>
    <table style="width:100%;border-collapse:collapse;font-family:inherit;">
      <thead><tr style="background:#f5f5f5;">
        <th style="padding:5px 8px;text-align:left;font-size:11px;font-weight:600;border-bottom:2px solid #e0e0e0;">Component</th>
        <th style="padding:5px 8px;text-align:left;font-size:11px;font-weight:600;border-bottom:2px solid #e0e0e0;">Element / Scope on This Screen</th>
        <th style="padding:5px 8px;text-align:left;font-size:11px;font-weight:600;border-bottom:2px solid #e0e0e0;">Pulse Rule to Verify</th>
        <th style="padding:5px 8px;text-align:left;font-size:11px;font-weight:600;border-bottom:2px solid #e0e0e0;">Severity</th>
        <th style="padding:5px 8px;text-align:left;font-size:11px;font-weight:600;border-bottom:2px solid #e0e0e0;">Source</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// ---------------------------------------------------------------------------
// Generate the Accessibility (WCAG 2.1 / 2.2) Validation section HTML
// Mirrors the structure of generatePulseValidationHTML but shows WCAG criteria,
// levels and remediation guidance instead of Pulse design system rules.
// ---------------------------------------------------------------------------
function generateA11yValidationHTML(data) {
  if (!data || !RUN_A11Y) return '';

  // Filter to critical (error-severity) violations only
  const allViolations = (data.violations || []).filter(v => v.severity === 'error');

  const platIcon = platformIcon(data.platform);
  const platLabel = data.platform === 'android' ? 'Android' : 'iOS';
  const platBadge = `<span class="pulse-platform-badge" style="background:#e3f2fd;color:#1565c0;border-color:#90caf9;">${platIcon} ${platLabel}</span>`;

  if (allViolations.length === 0) {
    return `<div class="pulse-section a11y-section" id="a11y-critical-section">
      <div class="pulse-section-header">
        <h2>♿ Accessibility — Critical Issues ${platBadge}</h2>
        <p class="pulse-subtitle">Informational only — no critical WCAG violations detected.</p>
      </div>
      <div style="margin:16px;padding:12px 16px;background:#e8f5e9;border:1px solid #4caf50;border-radius:8px;color:#2e7d32;">
        ✅ All <strong>${data.totalChecked}</strong> checked UI element${data.totalChecked !== 1 ? 's' : ''} passed WCAG error-level checks.
      </div>
    </div>`;
  }

  // Suite-level deduplication: same screen NAME + criterion + element → one entry.
  // Uses v.screen (the display name) rather than screenId so the same screen
  // visited in multiple tests within a suite is collapsed into a single row.
  const dedupeMap = new Map();
  allViolations.forEach(v => {
    const key = `${v.screen || ''}||${v.criterion || ''}||${v.element || ''}`;
    if (!dedupeMap.has(key)) {
      dedupeMap.set(key, { ...v, occurrences: 0 });
    }
    dedupeMap.get(key).occurrences++;
  });

  const uniqueViolations = Array.from(dedupeMap.values());

  // Group deduplicated results by screen name
  const byScreen = {};
  uniqueViolations.forEach(v => {
    const sn = v.screen || 'Unknown Screen';
    if (!byScreen[sn]) byScreen[sn] = [];
    byScreen[sn].push(v);
  });

  const screenNames = Object.keys(byScreen).sort();
  const totalUnique = uniqueViolations.length;
  const screenCount = screenNames.length;

  const suiteDedupeNote = allViolations.length > totalUnique
    ? `<div style="margin-bottom:12px;padding:8px 12px;background:#e8f4fd;border-left:3px solid #2196f3;border-radius:0 6px 6px 0;font-size:12px;color:#1565c0;">
        ℹ️ Suite deduplication: <strong>${allViolations.length}</strong> raw occurrences condensed to <strong>${totalUnique}</strong> unique issues — same issue on the same screen counted once.
      </div>`
    : '';

  let screenPanels = '';
  screenNames.forEach((screenName, screenIdx) => {
    const items = byScreen[screenName];
    const isFirst = screenIdx === 0;
    const bodyClass = isFirst ? 'pulse-screen-body expanded' : 'pulse-screen-body';
    const chevClass = isFirst ? 'pulse-screen-chevron expanded' : 'pulse-screen-chevron';

    const rows = items.map(v => {
      // Element / button info chips — label, type badge, size badge, resource ID
      const elemLabel = v.element && v.element !== 'unknown'
        ? escapeHtml(v.element)
        : '<em style="color:#bbb;">(no label)</em>';
      const typeChip = v.elementType && v.elementType !== 'unknown'
        ? `<span style="background:#e3f2fd;color:#1565c0;border:1px solid #90caf9;border-radius:3px;padding:1px 5px;font-size:10px;white-space:nowrap;">${escapeHtml(v.elementType)}</span>`
        : '';
      const dimChip = v.dimensions
        ? `<span style="background:#f5f5f5;color:#666;border-radius:3px;padding:1px 5px;font-size:10px;white-space:nowrap;">${escapeHtml(v.dimensions)}</span>`
        : '';
      const idChip = v.elementId && v.elementId !== 'none'
        ? `<code style="background:#f5f5f5;color:#555;border-radius:3px;padding:1px 4px;font-size:10px;">${escapeHtml(v.elementId)}</code>`
        : '';
      const occBadge = v.occurrences > 1
        ? `<span title="Issue found in ${v.occurrences} test run${v.occurrences !== 1 ? 's' : ''}" style="background:#fff3e0;color:#e65100;border:1px solid #ffcc80;border-radius:3px;padding:1px 5px;font-size:10px;">×${v.occurrences} runs</span>`
        : '';

      return `<tr>
        <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;vertical-align:top;">
          <div style="font-weight:600;font-size:12px;margin-bottom:4px;">${elemLabel}</div>
          <div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center;">${typeChip}${dimChip}${idChip}${occBadge}</div>
        </td>
        <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;vertical-align:top;white-space:nowrap;">
          <div style="font-weight:600;font-size:11px;color:#1565c0;">${escapeHtml(v.criterion || '')}</div>
          <div style="font-size:10px;color:#888;">Level ${escapeHtml(v.level || 'A')}</div>
        </td>
        <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;font-size:11px;vertical-align:top;">${escapeHtml(v.message || '')}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f0f0f0;font-size:11px;color:#555;vertical-align:top;">${escapeHtml(v.remediation || '')}</td>
      </tr>`;
    }).join('');

    screenPanels += `
      <div class="pulse-screen-panel a11y-screen-panel" data-screen="${escapeHtml(screenName)}">
        <div class="pulse-screen-header" onclick="togglePulseScreen(this)">
          <span class="${chevClass}">▶</span>
          <span class="pulse-screen-title">${escapeHtml(screenName)}</span>
          <span class="pulse-screen-badges"><span class="pulse-screen-badge pulse-screen-badge-error">🔴 ${items.length}</span></span>
          <span class="pulse-screen-count">${items.length} critical issue${items.length !== 1 ? 's' : ''}</span>
        </div>
        <div class="${bodyClass}">
          <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;font-family:inherit;font-size:11px;">
            <thead>
              <tr style="background:#fff3f3;">
                <th style="padding:6px 10px;text-align:left;border-bottom:2px solid #ef9a9a;font-size:11px;min-width:160px;">Element / Button Info</th>
                <th style="padding:6px 10px;text-align:left;border-bottom:2px solid #ef9a9a;font-size:11px;white-space:nowrap;">WCAG Criterion</th>
                <th style="padding:6px 10px;text-align:left;border-bottom:2px solid #ef9a9a;font-size:11px;min-width:200px;">Issue</th>
                <th style="padding:6px 10px;text-align:left;border-bottom:2px solid #ef9a9a;font-size:11px;min-width:160px;">How to Fix</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          </div>
        </div>
      </div>`;
  });

  return `
    <div class="pulse-section a11y-section" id="a11y-critical-section">
      <div class="pulse-section-header">
        <div class="section-toggle-header" onclick="toggleSection(this)">
          <span class="section-toggle-icon expanded">▶</span>
          <h2>♿ Accessibility — Critical Issues Only ${platBadge}</h2>
        </div>
        <p class="pulse-subtitle">
          Informational only — does not affect pass/fail status. Showing WCAG <strong>error</strong>-level violations only, deduplicated across the suite.
          <strong>${totalUnique}</strong> unique critical issue${totalUnique !== 1 ? 's' : ''} across <strong>${screenCount}</strong> screen${screenCount !== 1 ? 's' : ''}.
        </p>
        <div class="pulse-controls-row">
          <div class="pulse-summary-chips">
            <span class="pulse-chip pulse-chip-error">🔴 ${totalUnique} Critical</span>
            <span class="pulse-chip pulse-chip-info">🖥️ ${screenCount} Screen${screenCount !== 1 ? 's' : ''}</span>
          </div>
          <div class="pulse-action-btns">
            <button class="pulse-action-btn" onclick="expandAllA11y()">Expand All</button>
            <button class="pulse-action-btn" onclick="collapseAllA11y()">Collapse All</button>
          </div>
        </div>
      </div>
      <div class="pulse-screens-container a11y-screens-container" style="padding:0 16px 16px;">
        ${suiteDedupeNote}
        ${screenPanels}
      </div>
    </div>`;
}

// ---------------------------------------------------------------------------
// Build a complete standalone pulse-report.html document.
// Mirrors buildStandaloneA11yHtml but uses Pulse component validation data.
// ---------------------------------------------------------------------------
function buildStandalonePulseHtml(data) {
  if (!data || !data.screens || data.screens.length === 0) return '';
  const platform = data.platform === 'android' ? 'Android' : 'iOS';
  const platIcon = platformIcon(data.platform);
  const violations = data.violations || [];
  const nErr  = violations.filter(v => v.severity === 'error').length;
  const nWarn = violations.filter(v => v.severity === 'warning').length;
  const nInfo = violations.filter(v => v.severity === 'info').length;

  // Rebuild ordered screen list (same logic as generatePulseValidationHTML)
  const allScreens = data.screens.map((s, idx) => ({
    id: s.id || `screen-${idx + 1}`,
    name: s.name || s.displayName || `Screen ${idx + 1}`,
    displayName: s.displayName || s.name || `Screen ${idx + 1}`,
    elementCount: Number(s.elementCount || 0),
    violationCount: Number(s.violationCount || 0),
    passedCount: Number(s.passedCount || 0),
    stepName: s.stepName || '',
    timestamp: s.timestamp || '',
    rawTestName: s.rawTestName || '',
    isFailureCapture: !!s.isFailureCapture
  }));

  const byScreen = {};
  violations.forEach(v => {
    const k = v.screenId || v.screen;
    if (!byScreen[k]) byScreen[k] = [];
    byScreen[k].push(v);
  });

  const orderedScreens = allScreens.slice();
  const seenIds = new Set(orderedScreens.map(s => s.id));
  Object.keys(byScreen).forEach(k => {
    if (!seenIds.has(k)) {
      const fv = byScreen[k][0] || {};
      orderedScreens.push({
        id: k, name: fv.screen || k, displayName: fv.screen || k,
        elementCount: 0, violationCount: 0, passedCount: 0,
        stepName: '', timestamp: '', rawTestName: '', isFailureCapture: false
      });
      seenIds.add(k);
    }
  });

  const sevIcon   = s => s === 'error' ? '🔴' : s === 'warning' ? '🟡' : '🔵';
  const sevLabel  = s => s === 'error' ? 'Error' : s === 'warning' ? 'Warning' : 'Info';
  const sevBg     = s => s === 'error' ? '#fff3f3' : s === 'warning' ? '#fffde7' : '#e3f2fd';
  const sevColor  = s => s === 'error' ? '#c62828' : s === 'warning' ? '#f57f17' : '#1565c0';
  const sevBorder = s => s === 'error' ? '#ef9a9a' : s === 'warning' ? '#ffe082' : '#90caf9';

  let screenSections = '';
  orderedScreens.forEach(screenMeta => {
    const items = byScreen[screenMeta.id] || [];
    const elemCount = Number(screenMeta.elementCount || 0);
    const hasViolations = items.length > 0;
    const hasElements   = elemCount > 0;
    const isVisited     = screenMeta.stepName === 'ios_visited';

    let bodyHtml = '';
    if (isVisited) {
      bodyHtml = predictiveIosPulseChecklist(screenMeta.name || screenMeta.displayName || '');
    } else if (hasViolations) {
      const rows = items.map(v => {
        const details = [
          v.elementType ? `Type: ${v.elementType}` : null,
          v.elementId && v.elementId !== 'none' ? `ID: ${v.elementId}` : null,
          v.dimensions ? `Size: ${v.dimensions}` : null,
          v.depth ? `Depth: ${v.depth}` : null
        ].filter(Boolean).join(' · ');
        return `<tr>
          <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;">
            <div style="font-weight:600;font-size:12px;">${escapeHtml(v.component)}</div>
            <div style="font-size:10px;color:#888;">${escapeHtml(v.componentType)}</div>
            ${v.uiRole ? `<div style="font-size:10px;color:#666;">UI Role: ${escapeHtml(String(v.uiRole).replace(/_/g, ' '))}</div>` : ''}
          </td>
          <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;">
            <div style="font-weight:500;font-size:12px;">${escapeHtml(v.element)}</div>
            ${details ? `<div style="font-size:10px;color:#888;">${details}</div>` : ''}
          </td>
          <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;font-size:11px;">${escapeHtml(v.rule)}</td>
          <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;white-space:nowrap;">
            <span style="background:${sevBg(v.severity)};color:${sevColor(v.severity)};border:1px solid ${sevBorder(v.severity)};border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600;">${sevIcon(v.severity)} ${sevLabel(v.severity)}</span>
          </td>
        </tr>`;
      }).join('');
      bodyHtml = `<table style="width:100%;border-collapse:collapse;font-size:11px;">
        <thead><tr style="background:#f5f5f5;">
          <th style="padding:6px 8px;text-align:left;border-bottom:2px solid #e0e0e0;font-size:11px;">Component</th>
          <th style="padding:6px 8px;text-align:left;border-bottom:2px solid #e0e0e0;font-size:11px;">Element</th>
          <th style="padding:6px 8px;text-align:left;border-bottom:2px solid #e0e0e0;font-size:11px;">Pulse Rule Violated</th>
          <th style="padding:6px 8px;text-align:left;border-bottom:2px solid #e0e0e0;font-size:11px;">Severity</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
    } else if (hasElements) {
      bodyHtml = `<div style="background:#e8f5e9;color:#2e7d32;padding:10px 14px;border-radius:4px;border-left:3px solid #4caf50;font-size:12px;">✅ All <strong>${elemCount}</strong> captured UI elements passed Pulse design system rules.</div>`;
    } else {
      bodyHtml = `<p style="color:#888;font-size:12px;">⏳ No element hierarchy data captured for this screen.</p>`;
    }

    const stepTypeLabel = isVisited ? '🗂️ Visited' : (screenMeta.isFailureCapture ? '⚠️ Failure Screen' : '🔄 Runtime Capture');
    const nV = items.length;
    const statusBar = nV > 0
      ? `<span style="background:#ffebee;color:#c62828;padding:2px 8px;border-radius:3px;font-size:11px;border:1px solid #ef9a9a;">❌ ${nV} violation${nV !== 1 ? 's' : ''}</span>`
      : (hasElements
          ? `<span style="background:#e8f5e9;color:#2e7d32;padding:2px 8px;border-radius:3px;font-size:11px;border:1px solid #a5d6a7;">✅ All checks passed</span>`
          : `<span style="background:#f5f5f5;color:#888;padding:2px 8px;border-radius:3px;font-size:11px;">⏳ No data</span>`);

    let tsLabel = '';
    if (screenMeta.timestamp) {
      if (/^\d{2}:\d{2}:\d{2}$/.test(screenMeta.timestamp)) {
        tsLabel = screenMeta.timestamp;
      } else {
        try {
          const d = new Date(screenMeta.timestamp);
          tsLabel = isNaN(d.getTime()) ? screenMeta.timestamp : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        } catch (_) { tsLabel = screenMeta.timestamp; }
      }
    }

    screenSections += `
      <div style="background:#fff;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,.1);margin-bottom:20px;overflow:hidden;">
        <div style="padding:14px 18px;background:#f8f9fa;border-bottom:1px solid #e0e0e0;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          <span style="font-weight:700;font-size:14px;">${escapeHtml(screenMeta.displayName || screenMeta.name)}</span>
          <span style="font-size:11px;color:#888;background:#fff;border:1px solid #e0e0e0;padding:1px 7px;border-radius:3px;">${stepTypeLabel}</span>
          ${tsLabel ? `<span style="font-size:11px;color:#888;">⏱️ ${tsLabel}</span>` : ''}
          ${screenMeta.rawTestName ? `<span style="font-size:11px;color:#888;">📁 ${escapeHtml(screenMeta.rawTestName)}</span>` : ''}
          ${statusBar}
        </div>
        <div style="padding:16px 18px;">${bodyHtml}</div>
      </div>`;
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Pulse Design System Report — ${platform}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
           margin: 0; padding: 24px; background: #f4f6f8; color: #333; font-size: 13px; }
    a { color: #1565c0; }
    table { border-collapse: collapse; }
    th { font-weight: 600; text-align: left; }
    code { font-family: "SF Mono", Menlo, monospace; }
    @media print { body { background: #fff; padding: 12px; } }
  </style>
</head>
<body>
  <div style="max-width:1200px;margin:0 auto;">
    <div style="margin-bottom:24px;padding:20px 24px;background:#fff;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,.1);">
      <h1 style="margin:0 0 6px;font-size:22px;color:#4a0080;">🎨 Pulse Design System Report <span style="font-size:16px;color:#666;font-weight:400;">— ${platIcon} ${platform}</span></h1>
      <p style="margin:0 0 14px;color:#666;">Generated ${new Date().toLocaleString()} · CVS Pulse Component Standards · Informational only</p>
      <div style="display:flex;gap:16px;flex-wrap:wrap;">
        <div style="background:#fce4ec;padding:10px 16px;border-radius:6px;text-align:center;"><div style="font-size:20px;font-weight:700;color:#c62828;">${nErr}</div><div style="font-size:11px;color:#c62828;">Error${nErr !== 1 ? 's' : ''}</div></div>
        <div style="background:#fff8e1;padding:10px 16px;border-radius:6px;text-align:center;"><div style="font-size:20px;font-weight:700;color:#f57f17;">${nWarn}</div><div style="font-size:11px;color:#f57f17;">Warning${nWarn !== 1 ? 's' : ''}</div></div>
        <div style="background:#e8eaf6;padding:10px 16px;border-radius:6px;text-align:center;"><div style="font-size:20px;font-weight:700;color:#3949ab;">${nInfo}</div><div style="font-size:11px;color:#3949ab;">Info</div></div>
        <div style="background:#e3f2fd;padding:10px 16px;border-radius:6px;text-align:center;"><div style="font-size:20px;font-weight:700;color:#1565c0;">${data.totalChecked}</div><div style="font-size:11px;color:#1565c0;">Elements Checked</div></div>
        <div style="background:#e8f5e9;padding:10px 16px;border-radius:6px;text-align:center;"><div style="font-size:20px;font-weight:700;color:#2e7d32;">${orderedScreens.length}</div><div style="font-size:11px;color:#2e7d32;">Screen${orderedScreens.length !== 1 ? 's' : ''}</div></div>
      </div>
    </div>
    ${screenSections}
    <div style="margin-top:24px;font-size:11px;color:#888;text-align:center;">
      Validated against CVS Pulse design system. Rules cover: Buttons · TextFields · Cards · Links · Toggles · Tiles · Avatars · Progress.<br>
      Results are informational only and do not affect test pass/fail status.
    </div>
  </div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Build a complete standalone accessibility-report.html document.
// Reuses the same element audit data produced by a11y-hierarchy-validator.
// ---------------------------------------------------------------------------
function buildStandaloneA11yHtml(data) {
  if (!data || !data.screens || data.screens.length === 0) return '';
  const platform   = data.platform === 'android' ? 'Android' : 'iOS';
  const platIcon   = platformIcon(data.platform);
  const violations = data.violations || [];
  const nWcagErr   = violations.filter(v => v.severity === 'error').length;
  const nWcagWarn  = violations.filter(v => v.severity === 'warning').length;

  // Count VoiceOver-specific issues across all screens, split by severity
  let nVoErr     = 0;
  let nVoWarn    = 0;
  let nVoChecked = 0;  // total VO rule checks applied
  let nNavIssues = 0;
  data.screens.forEach(s => {
    if (s.voiceOver) {
      (s.voiceOver.elementChecks || []).forEach(ec => {
        ec.checks.forEach(c => {
          if (c.applies) nVoChecked++;
          if (c.result === false) {
            if (c.severity === 'error') nVoErr++;
            else nVoWarn++;
          }
        });
      });
      nNavIssues += (s.voiceOver.navOrderIssues || []).length;
    }
  });

  // Unified totals shown in the header
  const nErr  = nWcagErr  + nVoErr;
  const nWarn = nWcagWarn + nVoWarn;

  // Build per-screen HTML (flat, no accordion — standalone report stays readable)
  let screenSections = '';
  data.screens.forEach((screenMeta, idx) => {
    const elementAudits = screenMeta.elementAudits || [];
    const screenViolations = violations.filter(v => v.screenId === screenMeta.id || v.screen === screenMeta.name);
    const isVisited = screenMeta.stepName === 'ios_visited';

    let bodyHtml = '';
    if (isVisited) {
      const checks = (a11yValidator && a11yValidator.predictiveA11yChecklist)
        ? a11yValidator.predictiveA11yChecklist(screenMeta.name || '')
        : [];
      const rows = checks.map(c => {
        const sev = c.sev === 'error'
          ? '<span style="background:#fff3f3;color:#c62828;padding:1px 6px;border-radius:3px;font-size:10px;border:1px solid #ef9a9a;font-weight:600;">ERROR</span>'
          : '<span style="background:#fffde7;color:#f57f17;padding:1px 6px;border-radius:3px;font-size:10px;border:1px solid #ffe082;font-weight:600;">WARN</span>';
        return `<tr><td style="padding:5px 8px;border-bottom:1px solid #f0f0f0;font-size:11px;font-weight:600;">WCAG ${c.wcag}</td><td style="padding:5px 8px;border-bottom:1px solid #f0f0f0;"><span style="background:#e8f5e9;color:#2e7d32;padding:1px 5px;border-radius:3px;font-size:10px;border:1px solid #a5d6a7;">Level ${c.level}</span></td><td style="padding:5px 8px;border-bottom:1px solid #f0f0f0;font-size:11px;">${escapeHtml(c.item)}</td><td style="padding:5px 8px;border-bottom:1px solid #f0f0f0;">${sev}</td></tr>`;
      }).join('');
      bodyHtml = `
        <div style="background:#e3f2fd;border-left:3px solid #1565c0;padding:8px 12px;border-radius:0 4px 4px 0;margin-bottom:10px;font-size:11px;">
          <strong style="color:#0d47a1;">${SVG_APPLE} iOS Runtime Limitation</strong> — element capture unavailable at runtime. Manual audit checklist shown below.
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:11px;">
          <thead><tr style="background:#f5f5f5;"><th style="padding:5px 8px;text-align:left;">WCAG</th><th style="padding:5px 8px;text-align:left;">Level</th><th style="padding:5px 8px;text-align:left;">What to Check</th><th style="padding:5px 8px;text-align:left;">Severity</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>`;
    } else if (elementAudits.length > 0) {
      // Full element audit matrix
      const ruleHdrs = elementAudits[0].rules.map(r =>
        `<th title="${escapeHtml(r.criterion)} — Level ${r.level}" style="text-align:center;padding:4px 5px;border-bottom:2px solid #90caf9;font-size:10px;font-weight:600;white-space:nowrap;min-width:68px;">${escapeHtml(r.shortLabel || r.ruleId)}</th>`
      ).join('');
      const tRows = elementAudits.map(el => {
        const hasViol  = el.rules.some(r => r.result === false);
        const nameDisp = el.elementName !== '(no label)' ? escapeHtml(el.elementName) : '<em style="color:#bbb;">(no label)</em>';
        const idDisp   = el.identifier ? `<code style="font-size:10px;background:#f5f5f5;padding:1px 3px;border-radius:2px;">${escapeHtml(el.identifier)}</code>` : '<span style="color:#bbb;">—</span>';
        const rCells   = el.rules.map(r => {
          if (r.result === null)  return `<td title="${escapeHtml(r.criterion)} — N/A" style="text-align:center;padding:4px 3px;border-bottom:1px solid #f0f0f0;background:#fafafa;color:#ccc;font-size:11px;">—</td>`;
          if (r.result === true)  return `<td title="${escapeHtml(r.criterion)} — PASS" style="text-align:center;padding:4px 3px;border-bottom:1px solid #f0f0f0;background:#f1f8e9;font-size:11px;">✅</td>`;
          return                          `<td title="${escapeHtml(r.criterion)} — VIOLATION" style="text-align:center;padding:4px 3px;border-bottom:1px solid #f0f0f0;background:#ffebee;font-size:11px;">❌</td>`;
        }).join('');
        return `<tr style="${hasViol ? 'background:#fff8f8;' : ''}">
          <td style="padding:5px 8px;border-bottom:1px solid #f0f0f0;max-width:220px;overflow:hidden;text-overflow:ellipsis;" title="${escapeHtml(el.elementName)}">${nameDisp}</td>
          <td style="padding:5px 8px;border-bottom:1px solid #f0f0f0;font-size:10px;color:#666;white-space:nowrap;">${escapeHtml(el.type || el.rawType || '?')}</td>
          <td style="padding:5px 8px;border-bottom:1px solid #f0f0f0;">${idDisp}</td>
          <td style="padding:5px 8px;border-bottom:1px solid #f0f0f0;font-size:10px;color:#888;white-space:nowrap;">${el.dimensions || '—'}</td>
          <td style="padding:5px 8px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:10px;color:#888;">${el.depth}</td>
          ${rCells}
        </tr>`;
      }).join('');

      // After the matrix, list violations with remediation
      let remTable = '';
      if (screenViolations.length > 0) {
        const remRows = screenViolations.map(v => `<tr>
          <td style="padding:5px 8px;border-bottom:1px solid #f0f0f0;font-size:11px;font-weight:600;color:#c62828;">${escapeHtml(v.criterion || '')}</td>
          <td style="padding:5px 8px;border-bottom:1px solid #f0f0f0;font-size:11px;">${escapeHtml(v.element || '')}${v.elementId && v.elementId !== 'none' ? `<div style="font-size:10px;color:#888;">ID: ${escapeHtml(v.elementId)}</div>` : ''}</td>
          <td style="padding:5px 8px;border-bottom:1px solid #f0f0f0;font-size:11px;">${escapeHtml(v.message || '')}</td>
          <td style="padding:5px 8px;border-bottom:1px solid #f0f0f0;font-size:11px;color:#1565c0;">${escapeHtml(v.remediation || '')}</td>
        </tr>`).join('');
        remTable = `
          <div style="margin-top:14px;">
            <div style="font-size:11px;font-weight:600;color:#c62828;margin-bottom:6px;">⚠️ Violations &amp; Remediation</div>
            <table style="width:100%;border-collapse:collapse;font-size:11px;">
              <thead><tr style="background:#ffebee;"><th style="padding:5px 8px;text-align:left;">WCAG</th><th>Element</th><th>Issue</th><th>How to Fix</th></tr></thead>
              <tbody>${remRows}</tbody>
            </table>
          </div>`;
      }

      const nChecks = elementAudits.reduce((s, el) => s + el.rules.filter(r => r.applies).length, 0);
      bodyHtml = `
        <div style="margin-bottom:8px;font-size:11px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
          <span>Legend:</span>
          <span style="background:#f1f8e9;color:#2e7d32;padding:1px 6px;border-radius:3px;border:1px solid #a5d6a7;">✅ Pass</span>
          <span style="background:#ffebee;color:#c62828;padding:1px 6px;border-radius:3px;border:1px solid #ef9a9a;">❌ Violation</span>
          <span style="background:#fafafa;color:#bbb;padding:1px 6px;border-radius:3px;border:1px solid #e0e0e0;">— N/A</span>
          <span style="color:#888;">${elementAudits.length} element${elementAudits.length !== 1 ? 's' : ''} · ${nChecks} checks performed</span>
        </div>
        <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:11px;">
          <thead><tr style="background:#e3f2fd;">
            <th style="text-align:left;padding:5px 8px;border-bottom:2px solid #90caf9;">Element</th>
            <th style="text-align:left;padding:5px 6px;border-bottom:2px solid #90caf9;font-size:10px;white-space:nowrap;">Role</th>
            <th style="text-align:left;padding:5px 6px;border-bottom:2px solid #90caf9;font-size:10px;">ID</th>
            <th style="text-align:left;padding:5px 6px;border-bottom:2px solid #90caf9;font-size:10px;white-space:nowrap;">Size</th>
            <th style="text-align:center;padding:5px 4px;border-bottom:2px solid #90caf9;font-size:10px;">Depth</th>
            ${ruleHdrs}
          </tr></thead>
          <tbody>${tRows}</tbody>
        </table></div>
        ${remTable}`;
    } else {
      bodyHtml = `<p style="color:#888;font-size:12px;">No element hierarchy data captured for this screen.</p>`;
    }

    const stepTypeLabel = isVisited ? '🗂️ Visited' : (screenMeta.isFailureCapture ? '⚠️ Failure Screen' : '🔄 Runtime Capture');
    const nV = screenViolations.length;
    const statusBar = nV > 0
      ? `<span style="background:#ffebee;color:#c62828;padding:2px 8px;border-radius:3px;font-size:11px;border:1px solid #ef9a9a;">❌ ${nV} violation${nV !== 1 ? 's' : ''}</span>`
      : (elementAudits.length > 0 ? `<span style="background:#e8f5e9;color:#2e7d32;padding:2px 8px;border-radius:3px;font-size:11px;border:1px solid #a5d6a7;">✅ All checks passed</span>` : `<span style="background:#f5f5f5;color:#888;padding:2px 8px;border-radius:3px;font-size:11px;">⏳ No data</span>`);

    // ---------------------------------------------------------
    // VoiceOver validation subsection (iOS VoiceOver / Android TalkBack)
    // ---------------------------------------------------------
    let voHtml = '';
    const vo = screenMeta.voiceOver;
    if (vo && !isVisited) {
      const navIssues = vo.navOrderIssues || [];
      const totalVoElements = (vo.elementChecks || []).length;

      const sevBadge = (sev) => {
        if (sev === 'error')   return `<span style="background:#fff3f3;color:#c62828;border:1px solid #ef9a9a;border-radius:3px;padding:1px 6px;font-size:10px;font-weight:600;">ERROR</span>`;
        if (sev === 'warning') return `<span style="background:#fffde7;color:#f57f17;border:1px solid #ffe082;border-radius:3px;padding:1px 6px;font-size:10px;font-weight:600;">WARN</span>`;
        return `<span style="background:#e8eaf6;color:#3949ab;border:1px solid #9fa8da;border-radius:3px;padding:1px 6px;font-size:10px;font-weight:600;">INFO</span>`;
      };

      let voBody = '';

      if (totalVoElements > 0) {
        // ---- Short column headers for the 4 VO rules ----
        const VO_COL_LABELS = {
          'vo-icon-only-label':          { short: 'Icon Label',   title: 'SF Symbol identifier used as label — VoiceOver reads raw symbol name' },
          'vo-textfield-value-no-label': { short: 'Field Label',  title: 'Text field has value but no accessibility label' },
          'vo-disabled-missing-label':   { short: 'Disabled',     title: 'Disabled element has no label — VoiceOver says "dimmed" without identifying what' },
          'vo-label-type-redundancy':    { short: 'Redundancy',   title: 'Label prefixed with element role — causes double-announcement' }
        };

        // Collect rule column order from the first element
        const ruleOrder = (vo.elementChecks[0]?.checks || []).map(c => c.id);

        const ruleHeaders = ruleOrder.map(id => {
          const col = VO_COL_LABELS[id] || { short: id, title: id };
          return `<th title="${escapeHtml(col.title)}" style="text-align:center;padding:5px 6px;border-bottom:2px solid #b39ddb;font-size:10px;font-weight:600;white-space:nowrap;min-width:72px;">${escapeHtml(col.short)}</th>`;
        }).join('');

        const matrixRows = (vo.elementChecks || []).map(ec => {
          const hasViol   = ec.checks.some(c => c.result === false);
          const nameDisp  = ec.elementName !== '(no label)'
            ? escapeHtml(ec.elementName)
            : '<em style="color:#bbb;">(no label)</em>';
          const idDisp    = ec.identifier
            ? `<code style="font-size:10px;background:#f5f5f5;padding:1px 3px;border-radius:2px;">${escapeHtml(ec.identifier)}</code>`
            : '<span style="color:#bbb;">—</span>';
          const enabledBadge = ec.enabled === false
            ? `<span style="font-size:9px;background:#f5f5f5;color:#888;border:1px solid #e0e0e0;border-radius:3px;padding:0 4px;margin-left:4px;">dimmed</span>`
            : '';
          const ruleCells = ec.checks.map(c => {
            if (c.result === null)  return `<td title="${escapeHtml(VO_COL_LABELS[c.id]?.title || c.id)} — N/A for ${escapeHtml(ec.type)}" style="text-align:center;padding:4px 3px;border-bottom:1px solid #f0f0f0;background:#fafafa;color:#ccc;font-size:12px;">—</td>`;
            if (c.result === true)  return `<td title="${escapeHtml(VO_COL_LABELS[c.id]?.title || c.id)} — PASS" style="text-align:center;padding:4px 3px;border-bottom:1px solid #f0f0f0;background:#f3e5f5;font-size:12px;">✅</td>`;
            return                          `<td title="${escapeHtml(c.message || c.id)} — VIOLATION" style="text-align:center;padding:4px 3px;border-bottom:1px solid #f0f0f0;background:#fff3e0;font-size:12px;">❌</td>`;
          }).join('');
          return `<tr style="${hasViol ? 'background:#fff8f2;' : ''}">
            <td style="padding:5px 8px;border-bottom:1px solid #f0f0f0;max-width:180px;overflow:hidden;text-overflow:ellipsis;" title="${escapeHtml(ec.elementName)}">${nameDisp}${enabledBadge}</td>
            <td style="padding:5px 8px;border-bottom:1px solid #f0f0f0;font-size:10px;color:#666;white-space:nowrap;">${escapeHtml(ec.type || '?')}</td>
            <td style="padding:5px 8px;border-bottom:1px solid #f0f0f0;">${idDisp}</td>
            <td style="padding:5px 8px;border-bottom:1px solid #f0f0f0;font-size:10px;color:#888;white-space:nowrap;">${ec.dimensions || '—'}</td>
            <td style="padding:5px 8px;border-bottom:1px solid #f0f0f0;text-align:center;font-size:10px;color:#888;">${ec.depth}</td>
            ${ruleCells}
          </tr>`;
        }).join('');

        const nChecksApplied = (vo.elementChecks || []).reduce((s, ec) => s + ec.checks.filter(c => c.applies).length, 0);
        const nFailed        = (vo.elementChecks || []).reduce((s, ec) => s + ec.checks.filter(c => c.result === false).length, 0);

        voBody += `
          <div style="margin-bottom:8px;font-size:11px;color:#555;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <strong>VoiceOver Element Audit:</strong>
            <span style="background:#f3e5f5;color:#6a1b9a;padding:1px 7px;border-radius:3px;border:1px solid #ce93d8;">✅ Pass</span>
            <span style="background:#fff3e0;color:#e65100;padding:1px 7px;border-radius:3px;border:1px solid #ffcc80;">❌ Issue</span>
            <span style="background:#fafafa;color:#bbb;padding:1px 7px;border-radius:3px;border:1px solid #e0e0e0;">— N/A</span>
            <span style="color:#888;">${totalVoElements} element${totalVoElements !== 1 ? 's' : ''} · ${nChecksApplied} check${nChecksApplied !== 1 ? 's' : ''} applied</span>
          </div>
          ${nFailed > 0
            ? `<div style="margin-bottom:8px;padding:6px 10px;background:#fff3e0;border-left:3px solid #e65100;border-radius:0 4px 4px 0;font-size:11px;"><strong style="color:#e65100;">⚠️ ${nFailed} VoiceOver issue${nFailed !== 1 ? 's' : ''} found</strong> — orange ❌ cells indicate the specific failed check per element.</div>`
            : `<div style="margin-bottom:8px;padding:5px 10px;background:#f3e5f5;border-left:3px solid #7b1fa2;border-radius:0 4px 4px 0;font-size:11px;color:#6a1b9a;"><strong>✅ All ${nChecksApplied} applicable VoiceOver checks passed</strong></div>`
          }
          <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;font-family:inherit;font-size:11px;">
            <thead>
              <tr style="background:#ede7f6;">
                <th style="text-align:left;padding:5px 8px;border-bottom:2px solid #b39ddb;font-size:11px;font-weight:600;">Element</th>
                <th style="text-align:left;padding:5px 6px;border-bottom:2px solid #b39ddb;font-size:10px;font-weight:600;white-space:nowrap;">Role</th>
                <th style="text-align:left;padding:5px 6px;border-bottom:2px solid #b39ddb;font-size:10px;font-weight:600;">ID</th>
                <th style="text-align:left;padding:5px 6px;border-bottom:2px solid #b39ddb;font-size:10px;font-weight:600;white-space:nowrap;">Size</th>
                <th style="text-align:center;padding:5px 4px;border-bottom:2px solid #b39ddb;font-size:10px;font-weight:600;">Depth</th>
                ${ruleHeaders}
              </tr>
            </thead>
            <tbody>${matrixRows}</tbody>
          </table></div>`;

        // Remediation detail block — only when violations exist
        if (nFailed > 0) {
          const remRows = (vo.elementChecks || []).flatMap(ec =>
            ec.checks.filter(c => c.result === false).map(c => `<tr>
              <td style="padding:5px 8px;border-bottom:1px solid #f0f0f0;font-size:11px;font-weight:600;color:#5e35b1;">${escapeHtml(c.category)}</td>
              <td style="padding:5px 8px;border-bottom:1px solid #f0f0f0;">
                <div style="font-weight:500;font-size:11px;">${ec.elementName !== '(no label)' ? escapeHtml(ec.elementName) : '<em style="color:#bbb;">(no label)</em>'}</div>
                ${ec.identifier ? `<div style="font-size:10px;color:#888;margin-top:2px;"><code style="background:#f5f5f5;padding:1px 3px;border-radius:2px;">${escapeHtml(ec.identifier)}</code></div>` : ''}
              </td>
              <td style="padding:5px 8px;border-bottom:1px solid #f0f0f0;font-size:11px;color:#444;">${escapeHtml(c.message || '')}</td>
              <td style="padding:5px 8px;border-bottom:1px solid #f0f0f0;font-size:11px;color:#1565c0;">${escapeHtml(c.remediation || '')}</td>
              <td style="padding:5px 8px;border-bottom:1px solid #f0f0f0;">${sevBadge(c.severity)}</td>
            </tr>`)
          ).join('');
          voBody += `
            <div style="margin-top:14px;">
              <div style="font-size:11px;font-weight:600;color:#5e35b1;margin-bottom:6px;">⚠️ VoiceOver Issues &amp; Remediation</div>
              <table style="width:100%;border-collapse:collapse;font-size:11px;">
                <thead><tr style="background:#ede7f6;">
                  <th style="padding:5px 8px;border-bottom:2px solid #b39ddb;text-align:left;">Category</th>
                  <th style="padding:5px 8px;border-bottom:2px solid #b39ddb;text-align:left;">Element</th>
                  <th style="padding:5px 8px;border-bottom:2px solid #b39ddb;text-align:left;">Issue</th>
                  <th style="padding:5px 8px;border-bottom:2px solid #b39ddb;text-align:left;">How to Fix</th>
                  <th style="padding:5px 8px;border-bottom:2px solid #b39ddb;">Severity</th>
                </tr></thead>
                <tbody>${remRows}</tbody>
              </table>
            </div>`;
        }
      }

      if (navIssues.length > 0) {
        const navRows = navIssues.map(n => `<tr style="background:#fff8e7;">
          <td style="padding:5px 8px;border-bottom:1px solid #f0f0f0;font-size:11px;font-weight:500;">${escapeHtml(n.elementName)}</td>
          ${n.identifier ? `<td style="padding:5px 8px;border-bottom:1px solid #f0f0f0;"><code style="font-size:10px;background:#f5f5f5;padding:1px 3px;border-radius:2px;">${escapeHtml(n.identifier)}</code></td>` : '<td style="padding:5px 8px;border-bottom:1px solid #f0f0f0;color:#bbb;">—</td>'}
          <td style="padding:5px 8px;border-bottom:1px solid #f0f0f0;font-size:11px;text-align:center;color:#666;">${n.domPosition}</td>
          <td style="padding:5px 8px;border-bottom:1px solid #f0f0f0;font-size:11px;text-align:center;color:#e65100;font-weight:600;">${n.visualPosition}</td>
          <td style="padding:5px 8px;border-bottom:1px solid #f0f0f0;font-size:10px;color:#888;font-family:monospace;">${escapeHtml(n.bounds)}</td>
        </tr>`).join('');
        voBody += `
          <div style="font-size:11px;font-weight:600;color:#e65100;margin-bottom:6px;">🔀 Navigation Order Issues (${navIssues.length} element${navIssues.length !== 1 ? 's' : ''} out of visual order)</div>
          <div style="font-size:11px;color:#888;margin-bottom:6px;">DOM order vs visual top→bottom, left→right reading order. VoiceOver swipe navigation follows DOM order — mismatches cause confusing traversal.</div>
          <table style="width:100%;border-collapse:collapse;font-size:11px;">
            <thead><tr style="background:#fff3e0;">
              <th style="padding:5px 8px;border-bottom:2px solid #ffcc80;font-size:11px;text-align:left;">Element</th>
              <th style="padding:5px 8px;border-bottom:2px solid #ffcc80;font-size:11px;text-align:left;">ID</th>
              <th style="padding:5px 8px;border-bottom:2px solid #ffcc80;font-size:11px;text-align:center;" title="Position in the DOM / hierarchy array">DOM Position</th>
              <th style="padding:5px 8px;border-bottom:2px solid #ffcc80;font-size:11px;text-align:center;" title="Expected visual reading order position">Visual Position</th>
              <th style="padding:5px 8px;border-bottom:2px solid #ffcc80;font-size:11px;text-align:left;">Bounds</th>
            </tr></thead>
            <tbody>${navRows}</tbody>
          </table>`;
      } else if (totalVoElements > 1) {
        voBody += `<div style="font-size:11px;color:#2e7d32;">✅ Navigation order: all ${totalVoElements > 0 ? totalVoElements : ''} interactive elements are in expected visual reading order</div>`;
      }

      if (voBody) {
        voHtml = `
          <div style="margin-top:18px;padding-top:14px;border-top:2px dashed #e8eaf6;">
            <div style="font-size:12px;font-weight:700;color:#5e35b1;margin-bottom:10px;">🎙️ VoiceOver / TalkBack Validation</div>
            ${voBody}
          </div>`;
      }
    }

    screenSections += `
      <div style="background:#fff;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,.1);margin-bottom:20px;overflow:hidden;">
        <div style="padding:14px 18px;background:#f8f9fa;border-bottom:1px solid #e0e0e0;display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
          <span style="font-weight:700;font-size:14px;">${escapeHtml(screenMeta.displayName || screenMeta.name)}</span>
          <span style="font-size:11px;color:#888;background:#fff;border:1px solid #e0e0e0;padding:1px 7px;border-radius:3px;">${stepTypeLabel}</span>
          ${screenMeta.timestamp ? `<span style="font-size:11px;color:#888;">⏱️ ${screenMeta.timestamp}</span>` : ''}
          ${screenMeta.rawTestName ? `<span style="font-size:11px;color:#888;">📁 ${escapeHtml(screenMeta.rawTestName)}</span>` : ''}
          ${statusBar}
        </div>
        <div style="padding:16px 18px;">${bodyHtml}${voHtml}</div>
      </div>`;
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Accessibility Report — ${platform}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
           margin: 0; padding: 24px; background: #f4f6f8; color: #333; font-size: 13px; }
    a { color: #1565c0; }
    table { border-collapse: collapse; }
    th { font-weight: 600; text-align: left; }
    code { font-family: "SF Mono", Menlo, monospace; }
    @media print { body { background: #fff; padding: 12px; } }
  </style>
</head>
<body>
  <div style="max-width:1200px;margin:0 auto;">
    <div style="margin-bottom:24px;padding:20px 24px;background:#fff;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,.1);">
      <h1 style="margin:0 0 6px;font-size:22px;color:#0d47a1;">♿ Accessibility Report <span style="font-size:16px;color:#666;font-weight:400;">— ${platIcon} ${platform}</span></h1>
      <p style="margin:0 0 14px;color:#666;">Generated ${new Date().toLocaleString()} · WCAG 2.1 / 2.2 · VoiceOver validation · Informational only</p>
      <div style="display:flex;gap:16px;flex-wrap:wrap;">
        <div style="background:#fce4ec;padding:10px 16px;border-radius:6px;text-align:center;min-width:90px;">
          <div style="font-size:20px;font-weight:700;color:#c62828;">${nErr}</div>
          <div style="font-size:11px;color:#c62828;font-weight:600;">Error${nErr !== 1 ? 's' : ''}</div>
          ${nWcagErr > 0 || nVoErr > 0 ? `<div style="font-size:9px;color:#e57373;margin-top:3px;">${[nWcagErr > 0 ? `${nWcagErr} WCAG` : '', nVoErr > 0 ? `${nVoErr} VO` : ''].filter(Boolean).join(' · ')}</div>` : ''}
        </div>
        <div style="background:#fff8e1;padding:10px 16px;border-radius:6px;text-align:center;min-width:90px;">
          <div style="font-size:20px;font-weight:700;color:#f57f17;">${nWarn}</div>
          <div style="font-size:11px;color:#f57f17;font-weight:600;">Warning${nWarn !== 1 ? 's' : ''}</div>
          ${nWcagWarn > 0 || nVoWarn > 0 ? `<div style="font-size:9px;color:#ffb74d;margin-top:3px;">${[nWcagWarn > 0 ? `${nWcagWarn} WCAG` : '', nVoWarn > 0 ? `${nVoWarn} VO` : ''].filter(Boolean).join(' · ')}</div>` : ''}
        </div>
        ${nNavIssues > 0 ? `<div style="background:#fff3e0;padding:10px 16px;border-radius:6px;text-align:center;min-width:90px;"><div style="font-size:20px;font-weight:700;color:#e65100;">${nNavIssues}</div><div style="font-size:11px;color:#e65100;font-weight:600;">🔀 Nav Order</div><div style="font-size:9px;color:#ff8a65;margin-top:3px;">VO swipe order</div></div>` : ''}
        <div style="background:#e3f2fd;padding:10px 16px;border-radius:6px;text-align:center;min-width:90px;">
          <div style="font-size:20px;font-weight:700;color:#1565c0;">${data.totalChecked}</div>
          <div style="font-size:11px;color:#1565c0;font-weight:600;">Elements</div>
          <div style="font-size:9px;color:#64b5f6;margin-top:3px;">${nVoChecked} VO checks</div>
        </div>
        <div style="background:#e8f5e9;padding:10px 16px;border-radius:6px;text-align:center;min-width:90px;"><div style="font-size:20px;font-weight:700;color:#2e7d32;">${data.screens.length}</div><div style="font-size:11px;color:#2e7d32;font-weight:600;">Screen${data.screens.length !== 1 ? 's' : ''}</div></div>
      </div>
    </div>
    ${screenSections}
    <div style="margin-top:24px;font-size:11px;color:#888;text-align:center;">
      WCAG criteria: <a href="https://www.w3.org/WAI/WCAG21/quickref/" target="_blank">WCAG 2.1 Quick Reference</a> ·
      <a href="https://www.w3.org/WAI/WCAG22/quickref/" target="_blank">WCAG 2.2 Quick Reference</a> ·
      <a href="https://developer.apple.com/documentation/accessibility/voiceover" target="_blank">VoiceOver Docs</a> ·
      Results are informational only and do not affect test pass/fail status.
    </div>
  </div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Generate the Pulse Component Validation section HTML
// ---------------------------------------------------------------------------
function generatePulseValidationHTML(data) {
  // Nothing to render — no hierarchy files were captured at all
  if (!data || (data.totalChecked === 0 && (!data.screens || data.screens.length === 0))) return '';

  const violations  = data.violations || [];
  const allScreensRaw = data.screens || [];   // every screen capture occurrence
  const allScreens = allScreensRaw.map((s, idx) => ({
    id: s.id || `screen-${idx + 1}`,
    name: s.name || s.displayName || `Screen ${idx + 1}`,
    displayName: s.displayName || s.name || `Screen ${idx + 1}`,
    elementCount: Number(s.elementCount || 0),
    violationCount: Number(s.violationCount || 0),
    passedCount: Number(s.passedCount || 0),
    stepName: s.stepName || '',
    timestamp: s.timestamp || '',
    rawTestName: s.rawTestName || '',
    isFailureCapture: !!s.isFailureCapture
  }));

  const errorCount   = violations.filter((v) => v.severity === 'error').length;
  const warningCount = violations.filter((v) => v.severity === 'warning').length;
  const infoCount    = violations.filter((v) => v.severity === 'info').length;

  const severityIcon  = (s) => s === 'error' ? '🔴' : s === 'warning' ? '🟡' : '🔵';
  const severityLabel = (s) => s === 'error' ? 'Error' : s === 'warning' ? 'Warning' : 'Info';
  const severityClass = (s) => s === 'error' ? 'pulse-sev-error' : s === 'warning' ? 'pulse-sev-warning' : 'pulse-sev-info';

  // Group violations by screen occurrence id (falls back to screen name for legacy data)
  const byScreen = {};
  violations.forEach((v) => {
    const screenKey = v.screenId || v.screen;
    if (!byScreen[screenKey]) byScreen[screenKey] = [];
    byScreen[screenKey].push(v);
  });

  // Build the full screen list in test-flow order, then append legacy violation-only screens.
  const orderedScreens = allScreens.slice();
  const seenScreenIds = new Set(orderedScreens.map((s) => s.id));
  Object.keys(byScreen).forEach((screenKey) => {
    if (!seenScreenIds.has(screenKey)) {
      const firstViolation = byScreen[screenKey][0] || {};
      orderedScreens.push({
        id: screenKey,
        name: firstViolation.screen || screenKey,
        displayName: firstViolation.screen || screenKey,
        elementCount: 0,
        violationCount: 0,
        passedCount: 0,
        stepName: '',
        timestamp: '',
        rawTestName: '',
        isFailureCapture: false
      });
      seenScreenIds.add(screenKey);
    }
  });

  const screenCount = orderedScreens.length;
  const isSuite     = screenCount > 3;

  // ------------------------------------------------------------------ panels
  let screenPanels = '';
  orderedScreens.forEach((screenMeta, screenIdx) => {
    const screenKey = screenMeta.id;
    const screenName = screenMeta.displayName;
    const items = byScreen[screenKey] || [];
    const elemCount = Number(screenMeta.elementCount || 0);

    const sErr  = items.filter((v) => v.severity === 'error').length;
    const sWarn = items.filter((v) => v.severity === 'warning').length;
    const sInfo = items.filter((v) => v.severity === 'info').length;

    const hasViolations = items.length > 0;
    const hasElements   = elemCount > 0;

    // Badge row for screen header
    let headerBadges = '';
    if (hasViolations) {
      headerBadges = [
        sErr  > 0 ? `<span class="pulse-screen-badge pulse-screen-badge-error">🔴 ${sErr}</span>`   : '',
        sWarn > 0 ? `<span class="pulse-screen-badge pulse-screen-badge-warning">🟡 ${sWarn}</span>` : '',
        sInfo > 0 ? `<span class="pulse-screen-badge pulse-screen-badge-info">🔵 ${sInfo}</span>`   : ''
      ].join('');
    } else if (hasElements) {
      headerBadges = '<span class="pulse-screen-badge pulse-screen-badge-pass">✅ Pass</span>';
    } else {
      headerBadges = '<span class="pulse-screen-badge pulse-screen-badge-nodata">⏳ No data</span>';
    }

    // Screen body content
    let bodyContent = '';
    if (hasViolations) {
      let rows = '';
      items.forEach((v) => {
        const roleBadge = v.uiRole
          ? `<div class="pulse-component-category">UI Role: ${escapeHtml(String(v.uiRole).replace(/_/g, ' '))}</div>`
          : '';
        const details = [
          v.elementType ? `Type: ${v.elementType}` : null,
          v.elementId && v.elementId !== 'none' ? `ID: ${v.elementId}` : null,
          v.dimensions ? `Size: ${v.dimensions}` : null,
          v.depth ? `Depth: ${v.depth}` : null
        ].filter(Boolean).join(' • ');
        const detailsHtml = details ? `<div class="pulse-details">${details}</div>` : '';

        rows += `
          <tr data-sev="${v.severity}">
            <td>
              <div class="pulse-component-name">${escapeHtml(v.component)}</div>
              <div class="pulse-component-category">${escapeHtml(v.componentType)}</div>
              ${roleBadge}
            </td>
            <td class="pulse-element-cell">
              <div class="pulse-element-label">${escapeHtml(v.element)}</div>
              ${detailsHtml}
            </td>
            <td class="pulse-rule-cell">${escapeHtml(v.rule)}</td>
            <td><span class="pulse-severity ${severityClass(v.severity)}">${severityIcon(v.severity)} ${severityLabel(v.severity)}</span></td>
          </tr>`;
      });
      bodyContent = `
        <table class="pulse-screen-table">
          <thead>
            <tr>
              <th>Component</th>
              <th>Element</th>
              <th>Pulse Rule Violated</th>
              <th>Severity</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>`;
    } else if (hasElements) {
      bodyContent = `<div class="pulse-screen-pass-note">✅ All <strong>${elemCount}</strong> captured UI elements on this screen passed Pulse design system rules.</div>`;
    } else {
      bodyContent = `<div class="pulse-screen-nodata-note">⏳ <strong>Hierarchy not captured</strong> for this screen — the accessibility tree snapshot could not be taken while the Maestro test was executing this step. Re-run the test with a stable network connection to capture element data.</div>`;
    }

    // ios_visited: screen was reached during the test but no element hierarchy was
    // captured on iOS (runtime capture disabled to prevent XCTest driver instability).
    // Show a screen-type-specific predictive Pulse checklist so QA can manually audit.
    if (screenMeta.stepName === 'ios_visited') {
      bodyContent = predictiveIosPulseChecklist(screenMeta.name || screenMeta.displayName || '');
    }

    // Step-type badge and test-name chip for the header
    const isFailureCapture = screenMeta.isFailureCapture;
    const isIosVisited = screenMeta.stepName === 'ios_visited';
    const stepBadge = isFailureCapture
      ? '<span class="pulse-step-badge pulse-step-badge-failure">⚠️ Failure</span>'
      : isIosVisited
        ? '<span class="pulse-step-badge pulse-step-badge-visited">🗂️ Visited</span>'
        : (screenMeta.stepName
            ? '<span class="pulse-step-badge pulse-step-badge-runtime">🔄 Runtime</span>'
            : '');
    const rawTest = screenMeta.rawTestName || '';
    const testNameChip = rawTest
      ? `<span class="pulse-test-name-chip" title="${escapeHtml(rawTest)}">${escapeHtml(rawTest)}</span>`
      : '';

    // Timestamp label — screenMeta.timestamp may be a raw "HH:MM:SS" string (from
    // the Maestro debug log) or a fuller ISO date string; handle both gracefully.
    let tsLabel = '';
    if (screenMeta.timestamp) {
      // If it already looks like HH:MM:SS just use it directly.
      if (/^\d{2}:\d{2}:\d{2}$/.test(screenMeta.timestamp)) {
        tsLabel = screenMeta.timestamp;
      } else {
        try {
          const d = new Date(screenMeta.timestamp);
          tsLabel = isNaN(d.getTime()) ? screenMeta.timestamp : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        } catch (e) { tsLabel = screenMeta.timestamp; }
      }
    }

    // Metadata row shown at the very top of the collapsed body
    const metaParts = [
      rawTest   ? `<span class="pulse-meta-item">📁 ${escapeHtml(rawTest)}</span>` : null,
      tsLabel   ? `<span class="pulse-meta-item">⏱️ ${tsLabel}</span>` : null,
      elemCount ? `<span class="pulse-meta-item">🔍 ${elemCount} element${elemCount !== 1 ? 's' : ''} checked</span>` : null,
      items.length > 0
        ? `<span class="pulse-meta-item pulse-meta-violations">⚠️ ${items.length} violation${items.length !== 1 ? 's' : ''}</span>`
        : null,
      screenMeta.passedCount > 0
        ? `<span class="pulse-meta-item pulse-meta-passed">✅ ${screenMeta.passedCount} passed</span>`
        : null
    ].filter(Boolean).join('');
    const metaRow = metaParts ? `<div class="pulse-screen-meta">${metaParts}</div>` : '';

    // Pass-count footer (only shown when there are also violations so it isn't duplicated)
    const passFooter = (hasViolations && screenMeta.passedCount > 0)
      ? `<div class="pulse-pass-footer">✅ ${screenMeta.passedCount} element${screenMeta.passedCount !== 1 ? 's' : ''} passed Pulse validation</div>`
      : '';

    // First screen always expanded; rest collapsed
    const isFirst    = (screenIdx === 0);
    const bodyClass  = isFirst ? 'pulse-screen-body expanded' : 'pulse-screen-body';
    const chevClass  = isFirst ? 'pulse-screen-chevron expanded' : 'pulse-screen-chevron';
    const countLabel = hasViolations
      ? `${items.length} violation${items.length !== 1 ? 's' : ''}`
      : hasElements ? `${elemCount} elements checked` : 'no data';

    screenPanels += `
      <div class="pulse-screen-panel" data-screen="${escapeHtml(screenName)}">
        <div class="pulse-screen-header" onclick="togglePulseScreen(this)">
          <span class="${chevClass}">▶</span>
          <span class="pulse-screen-title">${escapeHtml(screenName)}</span>
          ${stepBadge}
          ${testNameChip}
          <span class="pulse-screen-badges">${headerBadges}</span>
          <span class="pulse-screen-count">${countLabel}</span>
        </div>
        <div class="${bodyClass}">
          ${metaRow}
          ${bodyContent}
          ${passFooter}
        </div>
      </div>`;
  });

  // ---------------------------------------------------------------- summary
  const suiteNote = isSuite
    ? `<p class="pulse-suite-note">📋 ${screenCount} screens captured — each panel below represents one screen in the test flow.</p>`
    : '';

  const noViolationsNote = violations.length === 0
    ? `<div class="pulse-pass-banner">✅ All <strong>${data.totalChecked}</strong> checked UI elements passed Pulse design system validation.</div>`
    : '';

  return `
    <div class="pulse-section">
      <div class="pulse-section-header">
        <div class="section-toggle-header" onclick="toggleSection(this)">
          <span class="section-toggle-icon expanded">▶</span>
          <h2>🎨 Pulse Component Validation
            <span class="pulse-platform-badge">${platformIcon(data.platform)} ${data.platform === 'android' ? 'Android' : 'iOS'}</span>
          </h2>
        </div>
        <p class="pulse-subtitle">
          Informational only — these results do not affect pass/fail status.
          Validated <strong>${data.totalChecked}</strong> UI element${data.totalChecked !== 1 ? 's' : ''} across <strong>${screenCount}</strong> screen${screenCount !== 1 ? 's' : ''}.
        </p>
        ${violations.length > 0 ? `
        <div class="pulse-controls-row">
          <div class="pulse-summary-chips">
            ${errorCount   > 0 ? `<span class="pulse-chip pulse-chip-error">🔴 ${errorCount} Error${errorCount   !== 1 ? 's' : ''}</span>` : ''}
            ${warningCount > 0 ? `<span class="pulse-chip pulse-chip-warning">🟡 ${warningCount} Warning${warningCount !== 1 ? 's' : ''}</span>` : ''}
            ${infoCount    > 0 ? `<span class="pulse-chip pulse-chip-info">🔵 ${infoCount} Info</span>` : ''}
          </div>
          <div class="pulse-action-btns">
            <button class="pulse-action-btn" onclick="expandAllPulse()">Expand All</button>
            <button class="pulse-action-btn" onclick="collapseAllPulse()">Collapse All</button>
          </div>
        </div>
        <div class="pulse-filter-row">
          <span class="pulse-filter-label">Filter by severity:</span>
          <button class="pulse-filter-btn active" data-filter="all"     onclick="filterPulse(this,'all')">All</button>
          <button class="pulse-filter-btn"         data-filter="error"   onclick="filterPulse(this,'error')">🔴 Errors</button>
          <button class="pulse-filter-btn"         data-filter="warning" onclick="filterPulse(this,'warning')">🟡 Warnings</button>
          <button class="pulse-filter-btn"         data-filter="info"    onclick="filterPulse(this,'info')">🔵 Info</button>
        </div>` : `
        <div class="pulse-controls-row">
          <div class="pulse-action-btns">
            <button class="pulse-action-btn" onclick="expandAllPulse()">Expand All</button>
            <button class="pulse-action-btn" onclick="collapseAllPulse()">Collapse All</button>
          </div>
        </div>`}
      </div>

      <div class="section-collapsible-body expanded">
        ${suiteNote}
        ${noViolationsNote}
        <div class="pulse-screens-list">
          ${screenPanels}
        </div>
        <p class="pulse-footer-note">
          Pulse rules cover: Buttons · TextFields · Cards · Links · Toggles · Tiles · Avatars · Progress.
          Fix violations by updating the relevant screen component to meet CVS Pulse design system standards.
        </p>
      </div>
    </div>
  `;
}

// HTML-escape helper (only used for Pulse section content from external data)
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Count deduplicated critical (error) a11y violations for the tab badge.
// Dedup key mirrors generateA11yValidationHTML: screen name + criterion + element.
const a11yCriticalCount = (() => {
  if (!RUN_A11Y || !a11yData || !a11yData.violations) return 0;
  const seen = new Set();
  return a11yData.violations.filter(v => {
    if (v.severity !== 'error') return false;
    const key = `${v.screen || ''}||${v.criterion || ''}||${v.element || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).length;
})();

const html =`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${reportTitle} - ${reportName}</title>
  <style>
    :root {
      --brand-gradient-start: ${brandTheme.gradientStart};
      --brand-gradient-end: ${brandTheme.gradientEnd};
      --brand-accent: ${brandTheme.accent};
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, var(--brand-gradient-start) 0%, var(--brand-gradient-end) 100%);
      min-height: 100vh;
      padding: 0;
      margin: 0;
    }

    .container {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      background: #f0f4f8;
    }
    
    .header {
      background: linear-gradient(135deg, var(--brand-gradient-start) 0%, var(--brand-gradient-end) 100%);
      color: white;
      padding: 20px 28px;
      text-align: left;
      position: relative;
    }
    .header::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      right: 0;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
    }

    .brand-logo-wrap {
      display: flex;
      justify-content: flex-start;
      margin-bottom: 8px;
    }

    .brand-logo-pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 4px 8px;
      background: #ffffff;
      border: 1px solid rgba(255, 255, 255, 0.4);
      border-radius: 8px;
      box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
    }

    .cvs-logo-pill {
      padding: 3px 8px;
    }

    .health100-logo {
      width: 70px;
      height: auto;
      display: block;
    }

    .cvs-logo {
      height: 22px;
      width: auto;
      display: block;
    }
    
    .header h1 {
      font-size: 24px;
      margin-bottom: 2px;
    }
    
    .header p {
      font-size: 12px;
      font-weight: 500;
      letter-spacing: 0.2px;
      line-height: 1.3;
      opacity: 0.96;
      font-family: 'SF Pro Text', 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
    }
    
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 16px;
      padding: 24px 28px;
      background: #f8f9fb;
      border-bottom: 1px solid #edf0f4;
    }

    .summary-card {
      text-align: center;
      padding: 18px 14px;
      background: white;
      border-radius: 12px;
      border: 1px solid #edf0f4;
      border-left: 4px solid var(--brand-accent);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    .summary-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    }

    .summary-card.passed {
      border-left-color: #22c55e;
    }

    .summary-card.failed {
      border-left-color: #ef4444;
    }

    .summary-card.total {
      border-left-color: var(--brand-accent);
    }

    .summary-card .number {
      font-size: 28px;
      font-weight: 700;
      color: var(--brand-accent);
      letter-spacing: -0.5px;
    }

    .summary-card.passed .number {
      color: #22c55e;
    }

    .summary-card.failed .number {
      color: #ef4444;
    }

    .summary-card .label {
      font-size: 11px;
      color: #94a3b8;
      margin-top: 6px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      font-weight: 500;
    }

    .progress-bar {
      width: 100%;
      height: 6px;
      background: #e2e8f0;
      border-radius: 3px;
      overflow: hidden;
      margin-top: 20px;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #22c55e, #10b981);
      width: ${passPercentage}%;
      transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
      border-radius: 3px;
    }

    .progress-text {
      font-size: 12px;
      color: #94a3b8;
      margin-top: 8px;
    }

    /* ── Donut Chart ── */
    .header-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .header-left { flex: 1; }
    .donut-wrap {
      width: 90px;
      height: 90px;
      flex-shrink: 0;
      margin-left: 20px;
      position: relative;
    }
    .donut-wrap svg { width: 100%; height: 100%; }
    .donut-label {
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      font-size: 18px;
      font-weight: 700;
      color: white;
    }

    /* ── Tabs ── */
    .report-tabs {
      display: flex;
      gap: 0;
      border-bottom: 2px solid #edf0f4;
      padding: 0 28px;
      background: #fff;
      position: sticky;
      top: 0;
      z-index: 100;
      box-shadow: 0 1px 4px rgba(0,0,0,0.07);
    }
    .report-tab {
      padding: 14px 20px;
      font-size: 13px;
      font-weight: 600;
      color: #64748b;
      cursor: pointer;
      border-bottom: 2px solid transparent;
      margin-bottom: -2px;
      transition: color 0.15s, border-color 0.15s;
      display: flex;
      align-items: center;
      gap: 6px;
      user-select: none;
    }
    .report-tab:hover { color: #1e293b; }
    .report-tab.active {
      color: var(--brand-accent);
      border-bottom-color: var(--brand-accent);
    }
    .report-tab .tab-count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 20px;
      height: 20px;
      padding: 0 6px;
      border-radius: 10px;
      font-size: 11px;
      font-weight: 600;
      background: #f1f5f9;
      color: #64748b;
    }
    .report-tab.active .tab-count {
      background: var(--brand-accent);
      color: #fff;
    }
    .report-tab-panel { display: none; }
    .report-tab-panel.active { display: block; }

    /* ── Inline Summary Bar (Allure-style) ── */
    .inline-summary {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 28px;
      border-bottom: 1px solid #edf0f4;
      background: #fff;
    }
    .inline-summary-left {
      font-size: 14px;
      color: #475569;
      font-weight: 600;
    }
    .inline-summary-left .total-number {
      font-size: 22px;
      font-weight: 700;
      color: #1e293b;
      display: block;
    }
    .inline-summary-right {
      display: flex;
      gap: 24px;
      align-items: center;
    }
    .inline-stat {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      font-weight: 600;
      color: #475569;
    }
    .inline-stat-bar {
      width: 3px;
      height: 18px;
      border-radius: 2px;
    }
    .inline-stat-bar.failed { background: #ef4444; }
    .inline-stat-bar.passed { background: #22c55e; }
    .inline-stat-bar.skipped { background: #64748b; }

    /* ── Metadata Grid ── */
    .metadata-section {
      padding: 20px 28px;
      border-bottom: 1px solid #edf0f4;
    }
    .metadata-title {
      font-size: 14px;
      font-weight: 700;
      color: #1e293b;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .metadata-title .meta-count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 20px;
      height: 20px;
      padding: 0 6px;
      border-radius: 10px;
      font-size: 11px;
      font-weight: 600;
      background: #f1f5f9;
      color: #64748b;
    }
    .metadata-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px 40px;
    }
    .metadata-item {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 13px;
    }
    .metadata-key {
      color: #94a3b8;
      min-width: 120px;
      flex-shrink: 0;
    }
    .metadata-value {
      color: #1e293b;
      font-weight: 500;
      background: #f1f5f9;
      padding: 3px 10px;
      border-radius: 6px;
      font-size: 12px;
      max-width: 300px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* ── Search & Filter Bar ── */
    .search-filter-bar {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 16px 28px;
      border-bottom: 1px solid #edf0f4;
    }
    .search-box {
      flex: 1;
      display: flex;
      align-items: center;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      padding: 8px 12px;
      background: #fff;
      transition: border-color 0.15s;
    }
    .search-box:focus-within { border-color: var(--brand-accent); }
    .search-box svg {
      width: 16px;
      height: 16px;
      color: #94a3b8;
      margin-right: 8px;
      flex-shrink: 0;
    }
    .search-box input {
      border: none;
      outline: none;
      font-size: 13px;
      width: 100%;
      font-family: inherit;
      color: #1e293b;
    }
    .search-box input::placeholder { color: #94a3b8; }

    /* ── Filter Tabs (pill-style) ── */
    .filter-tabs {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .filter-pill {
      display: flex;
      align-items: center;
      gap: 5px;
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid #e2e8f0;
      background: #fff;
      color: #475569;
      transition: all 0.15s;
      user-select: none;
    }
    .filter-pill:hover { background: #f8f9fb; }
    .filter-pill.active {
      background: #f1f5f9;
      border-color: #cbd5e1;
      color: #1e293b;
    }
    .filter-pill .pill-count {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 18px;
      height: 18px;
      padding: 0 5px;
      border-radius: 9px;
      font-size: 10px;
      font-weight: 700;
      color: #fff;
    }
    .pill-count.total-bg   { background: #64748b; }
    .pill-count.failed-bg  { background: #ef4444; }
    .pill-count.passed-bg  { background: #22c55e; }
    .pill-count.skipped-bg { background: #64748b; }

    /* ── Sort Control ── */
    .sort-control {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: #94a3b8;
      padding: 0 28px 12px;
    }
    .sort-control select {
      border: 1px solid #d1d5db;
      border-radius: 6px;
      padding: 4px 8px;
      font-size: 12px;
      font-family: inherit;
      color: #1e293b;
      background: #fff;
      cursor: pointer;
    }

    .tests-section {
      padding: 32px 28px;
    }

    .tests-section h2 {
      font-size: 18px;
      margin-bottom: 20px;
      color: #1e293b;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .tests-section h2::after {
      content: '';
      flex: 1;
      height: 1px;
      background: linear-gradient(90deg, #e2e8f0, transparent);
    }

    .test-list {
      list-style: none;
    }

    .test-item-wrapper {
      margin-bottom: 10px;
    }

    .test-item-header {
      display: flex;
      align-items: center;
      padding: 12px 16px;
      border: 1px solid #edf0f4;
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.2s ease;
      background: white;
    }

    .test-item-header:hover {
      background: #fafbfc;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
      border-color: #d1d5db;
    }

    .test-item-header.passed {
      border-left: 4px solid #22c55e;
    }

    .test-item-header.failed {
      border-left: 4px solid #ef4444;
    }
    
    .test-expand-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 18px;
      height: 18px;
      margin-right: 8px;
      font-size: 14px;
      transition: transform 0.2s ease;
      color: var(--brand-accent);
    }
    
    .test-expand-icon.expanded {
      transform: rotate(90deg);
    }
    
    .test-status {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 30px;
      height: 30px;
      border-radius: 8px;
      margin-right: 12px;
      font-weight: 600;
      color: white;
      flex-shrink: 0;
      font-size: 13px;
    }

    .test-status.passed {
      background: linear-gradient(135deg, #22c55e, #16a34a);
    }

    .test-status.failed {
      background: linear-gradient(135deg, #ef4444, #dc2626);
    }
    
    .test-info {
      flex: 1;
    }
    
    .test-name {
      font-weight: 600;
      color: #1e293b;
      margin-bottom: 2px;
      font-size: 14px;
    }

    .test-file {
      font-size: 11px;
      color: #94a3b8;
      word-break: break-all;
    }

    .test-duration {
      font-size: 11px;
      color: #94a3b8;
      margin-left: 10px;
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
    }

    .badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 10px;
      font-weight: 600;
      margin-left: 6px;
    }

    .badge.passed {
      background: #dcfce7;
      color: #166534;
    }

    .badge.failed {
      background: #fee2e2;
      color: #991b1b;
    }
    
    .test-details {
      display: none;
      padding: 20px 20px 24px;
      background: #f8f9fb;
      border: 1px solid #edf0f4;
      border-top: none;
      border-radius: 0 0 12px 12px;
    }

    .test-details.expanded {
      display: block;
    }

    .test-details-section {
      margin-bottom: 24px;
    }

    .test-details-section:last-child {
      margin-bottom: 0;
    }

    .test-details-title {
      font-weight: 600;
      color: #475569;
      margin-bottom: 12px;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .test-details-title::before {
      content: '';
      width: 3px;
      height: 14px;
      background: var(--brand-accent);
      border-radius: 2px;
      flex-shrink: 0;
    }
    
    .failure-reason {
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-left: 4px solid #f59e0b;
      padding: 14px 16px;
      border-radius: 8px;
      font-family: 'SF Mono', 'Monaco', 'Menlo', 'Courier New', monospace;
      font-size: 12px;
      color: #92400e;
      word-break: break-word;
      white-space: pre-wrap;
      line-height: 1.5;
    }

    .failure-location {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      margin-top: 10px;
      padding: 10px 14px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-left: 4px solid #3b82f6;
      border-radius: 8px;
      font-size: 12px;
    }

    .failure-location-icon {
      font-size: 14px;
    }

    .failure-location-label {
      color: #1d4ed8;
      font-weight: 600;
    }

    .failure-location-path {
      background: #fff;
      padding: 3px 10px;
      border-radius: 6px;
      border: 1px solid #dbeafe;
      color: #1e40af;
      font-family: 'SF Mono', 'Monaco', 'Menlo', 'Courier New', monospace;
      font-size: 12px;
    }

    .failure-location-path strong {
      color: #dc2626;
    }

    .failure-step-content {
      width: 100%;
      margin-top: 6px;
      color: #475569;
    }

    .failure-step-content code {
      background: #f1f5f9;
      padding: 2px 8px;
      border-radius: 4px;
      font-family: 'SF Mono', 'Monaco', 'Menlo', 'Courier New', monospace;
      font-size: 11px;
      border: 1px solid #e2e8f0;
    }
    
    .failed-step-banner {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-left: 4px solid #dc2626;
      border-radius: 8px;
      font-size: 12px;
      flex-wrap: wrap;
    }
    .failed-step-num {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      color: #dc2626;
      background: #fee2e2;
      border: 1px solid #fecaca;
      border-radius: 4px;
      padding: 2px 7px;
      white-space: nowrap;
    }
    .failed-step-cmd {
      font-family: 'SF Mono', 'Monaco', 'Menlo', 'Courier New', monospace;
      font-size: 12px;
      color: #7f1d1d;
      flex: 1;
    }
    .failed-step-dur {
      font-size: 11px;
      color: #991b1b;
      white-space: nowrap;
    }

    .steps-list {
      list-style: none;
      padding: 0;
    }

    .steps-list li {
      padding: 8px 14px;
      background: white;
      border-left: 3px solid var(--brand-accent);
      margin-bottom: 6px;
      border-radius: 6px;
      font-family: 'SF Mono', 'Monaco', 'Menlo', 'Courier New', monospace;
      font-size: 12px;
      color: #334155;
      border: 1px solid #f1f5f9;
      border-left: 3px solid var(--brand-accent);
      transition: background 0.15s ease;
    }
    .steps-list li:hover {
      background: #f8fafc;
    }

    .steps-list li:last-child {
      margin-bottom: 0;
    }

    .no-steps {
      color: #94a3b8;
      font-style: italic;
      padding: 12px;
    }

    .screenshots-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 16px;
      margin-top: 10px;
    }

    .dedupe-info {
      font-size: 0.85em;
      color: #666;
      font-weight: normal;
      margin-left: 8px;
      font-style: italic;
    }

    .screenshot-item {
      background: white;
      border: 1px solid #edf0f4;
      border-radius: 12px;
      overflow: hidden;
      transition: all 0.25s ease;
    }

    .screenshot-item:hover {
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
      transform: translateY(-2px);
    }

    .screenshot-image {
      width: 100%;
      height: 200px;
      object-fit: cover;
      background: #f1f5f9;
      cursor: pointer;
      transition: opacity 0.2s ease;
    }
    .screenshot-image:hover {
      opacity: 0.92;
    }

    .screenshot-name {
      padding: 10px 14px;
      font-size: 11px;
      color: #94a3b8;
      background: #fafbfc;
      border-top: 1px solid #edf0f4;
      word-break: break-word;
    }

    /* ── Execution timeline (commands-*.json) ─────────────────────────── */
    .cmd-timeline-details {
      margin-top: 8px;
      border: 1px solid #edf0f4;
      border-radius: 10px;
      overflow: hidden;
    }
    .cmd-timeline-summary {
      cursor: pointer;
      padding: 10px 14px;
      background: #f8f9fb;
      font-size: 12px;
      color: #475569;
      user-select: none;
      list-style: none;
      font-weight: 500;
      transition: background 0.15s ease;
    }
    .cmd-timeline-summary:hover { background: #f1f5f9; }
    .cmd-timeline-summary::-webkit-details-marker { display: none; }
    .cmd-expand-hint { color: #94a3b8; font-size: 11px; margin-left: 6px; }
    .cmd-table-wrap { overflow-x: auto; max-height: 480px; overflow-y: auto; }
    .cmd-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
    }
    .cmd-table thead th {
      background: #f1f5f9;
      padding: 6px 10px;
      text-align: left;
      font-weight: 600;
      color: #64748b;
      position: sticky;
      top: 0;
      z-index: 1;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .cmd-table tbody tr { border-bottom: 1px solid #f1f5f9; }
    .cmd-table tbody tr:last-child { border-bottom: none; }
    .cmd-row-ok td { background: #fff; color: #334155; }
    .cmd-row-failed td { background: #fef2f2; color: #dc2626; border-left: 3px solid #ef4444; }
    .cmd-row-skipped td { background: #fafbfc; color: #a1a1aa; }
    .cmd-row-slow td { background: #fffbeb; color: #334155; }
    /* Hide setup steps by default (Define variables, Run script for screens, Apply config) */
    tr[data-step-type="setup"] { display: none; }
    .cmd-seq { width: 32px; padding: 4px 8px; color: #cbd5e1; font-size: 10px; font-variant-numeric: tabular-nums; }
    .cmd-icon { width: 24px; padding: 4px 2px; text-align: center; font-size: 12px; }
    .cmd-label { padding: 4px 10px; word-break: break-word; }
    .cmd-dur { width: 70px; padding: 4px 8px; white-space: nowrap; color: #64748b; font-family: 'SF Mono', monospace; font-size: 10px; font-variant-numeric: tabular-nums; }
    .cmd-status { width: 80px; padding: 4px 8px; }
    .cmd-pill { display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 9px; font-weight: 600; }
    .cmd-pill-ok { background: #dcfce7; color: #166534; }
    .cmd-pill-fail { background: #fee2e2; color: #991b1b; }
    .cmd-pill-skip { background: #f1f5f9; color: #a1a1aa; }
    .cmd-slow-badge { margin-left: 6px; font-size: 10px; color: #f57c00; }
    .cmd-slow-callout {
      margin-bottom: 6px;
      padding: 6px 10px;
      background: #fff8e1;
      border-left: 3px solid #f9a825;
      border-radius: 0 4px 4px 0;
      font-size: 11px;
      color: #5d4037;
    }
    .cmd-slow-chip {
      display: inline-block;
      margin: 3px 6px 0 0;
      padding: 2px 8px;
      background: #fff3e0;
      border: 1px solid #ffe0b2;
      border-radius: 10px;
      font-size: 11px;
    }
    .cmd-nested-container {
      display: none;
      margin: 0;
      padding: 0 0 0 28px;
      border-left: 2px solid #cbd5e1;
      margin-left: 18px;
      background: #f8fafc;
    }
    .cmd-nested-container .cmd-nested-item {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 3px 8px 3px 0;
      font-size: 11px;
      color: #475569;
      border-bottom: 1px solid #f1f5f9;
      position: relative;
    }
    .cmd-nested-container .cmd-nested-item::before {
      content: '├─';
      color: #94a3b8;
      font-family: monospace;
      font-size: 11px;
      flex-shrink: 0;
    }
    .cmd-nested-container .cmd-nested-item:last-child::before {
      content: '└─';
    }
    .cmd-nested-container .cmd-nested-seq {
      color: #94a3b8;
      font-size: 10px;
      font-variant-numeric: tabular-nums;
      min-width: 16px;
    }
    .cmd-nested-container .cmd-nested-icon {
      font-size: 11px;
    }
    .cmd-nested-container .cmd-nested-label {
      font-size: 11px;
      color: #475569;
    }
    /* Hide page object scripts and applyConfig in nested steps by default */
    .cmd-nested-container .cmd-nested-item[data-nested-type="setup"] {
      display: none;
    }
    .cmd-step-toggle {
      color: #0066cc;
      text-decoration: underline;
      cursor: pointer;
      font-weight: 500;
    }
    .cmd-step-toggle:hover {
      color: #0052a3;
    }
    .cmd-step-toggle.expanded::before {
      content: '▼ ';
    }
    .cmd-step-toggle:not(.expanded)::before {
      content: '▶ ';
    }
    .cmd-details-row {
      background: #f9f9f9 !important;
    }
    .cmd-nested-details-row {
      background: #f5f5f5 !important;
    }
    .cmd-details-cell {
      padding: 0 !important;
    }
    .cmd-step-details-content {
      padding: 8px 12px;
      background: #f5f5f5;
      border-left: 3px solid #0066cc;
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 10px;
      color: #333;
      white-space: pre-wrap;
      word-break: break-word;
      max-height: 250px;
      overflow-y: auto;
      line-height: 1.3;
      max-width: 100%;
    }
    /* ────────────────────────────────────────────────────────────────────── */

    .screenshot-modal {
      display: none;
      position: fixed;
      z-index: 9999;
      left: 0;
      top: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.85);
      overflow: hidden; /* prevent body bleed-through */
    }
    
    .screenshot-modal.active {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .screenshot-modal-content {
      position: relative;
      max-width: 92vw;
      max-height: 92vh;
      overflow-y: auto;
      overflow-x: hidden;
      border-radius: 12px;
      background: #111;
      box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
    }
    
    .screenshot-modal-image {
      display: block;
      width: auto;
      height: auto;
      max-width: 100%;
      max-height: 88vh;   /* never taller than viewport – keeps close btn accessible */
      object-fit: contain;
    }
    
    .screenshot-modal-close {
      position: absolute;
      top: 12px;
      right: 12px;
      color: white;
      font-size: 28px;
      font-weight: bold;
      cursor: pointer;
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 10px;
      width: 36px;
      height: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s ease;
    }

    .screenshot-modal-close:hover {
      background: rgba(255, 255, 255, 0.2);
    }
    
    .hierarchy-section {
      background: white;
      border: 1px solid #edf0f4;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 16px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    }

    .hierarchy-section h4 {
      color: #1e293b;
      margin-bottom: 14px;
      font-size: 14px;
      font-weight: 600;
    }

    .hierarchy-stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 12px;
      margin-bottom: 16px;
    }

    .hierarchy-stats p {
      font-size: 12px;
      color: #94a3b8;
      margin: 0;
      padding: 8px 12px;
      background: #f8f9fb;
      border-radius: 8px;
      border: 1px solid #f1f5f9;
    }

    .hierarchy-stats strong {
      color: #334155;
    }

    .hierarchy-tree {
      background: #f8f9fb;
      border: 1px solid #edf0f4;
      border-radius: 10px;
      padding: 14px;
      margin-bottom: 12px;
      overflow-x: auto;
    }

    .hierarchy-content {
      font-family: 'SF Mono', 'Monaco', 'Menlo', 'Courier New', monospace;
      font-size: 11px;
      color: #334155;
      margin: 0;
      white-space: pre-wrap;
      word-wrap: break-word;
      line-height: 1.5;
    }

    .hierarchy-details {
      margin-top: 12px;
    }

    .hierarchy-details summary {
      cursor: pointer;
      color: var(--brand-accent);
      font-weight: 600;
      font-size: 12px;
      padding: 10px 14px;
      background: #f8f9fb;
      border: 1px solid #edf0f4;
      border-radius: 8px;
      user-select: none;
      transition: all 0.15s ease;
    }

    .hierarchy-details summary:hover {
      background: #f1f5f9;
    }

    .hierarchy-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      margin-top: 12px;
      font-size: 11px;
      border: 1px solid #edf0f4;
      border-radius: 10px;
      overflow: hidden;
    }

    .hierarchy-table thead {
      background: #f1f5f9;
    }

    .hierarchy-table th {
      padding: 10px 12px;
      text-align: left;
      font-weight: 600;
      color: #64748b;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 1px solid #e2e8f0;
      border-right: 1px solid #edf0f4;
    }

    .hierarchy-table th:last-child {
      border-right: none;
    }

    .hierarchy-table td {
      padding: 10px 12px;
      border-bottom: 1px solid #f1f5f9;
      border-right: 1px solid #f1f5f9;
      color: #64748b;
    }

    .hierarchy-table td:last-child {
      border-right: none;
    }

    .hierarchy-table tbody tr:hover {
      background: #f8fafc;
    }
    .hierarchy-table tbody tr:last-child td {
      border-bottom: none;
    }
    
    .failure-section {
      background: #fff;
      border-radius: 12px;
      padding: 20px;
    }

    .expected-vs-actual {
      margin-bottom: 24px;
    }

    .expected-element-box {
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-left: 4px solid #f59e0b;
      border-radius: 12px;
      padding: 18px;
      margin-bottom: 16px;
    }

    .expected-element-box h5 {
      color: #92400e;
      font-size: 13px;
      font-weight: 700;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .element-details {
      background: white;
      border-radius: 8px;
      padding: 14px;
      border: 1px solid rgba(245, 158, 11, 0.15);
    }

    .element-details p {
      margin: 8px 0;
      font-size: 13px;
      color: #334155;
    }

    .element-details code {
      background: #f8f9fb;
      padding: 2px 8px;
      border-radius: 4px;
      font-family: 'SF Mono', 'Monaco', 'Menlo', 'Courier New', monospace;
      font-size: 12px;
      color: #be185d;
      border: 1px solid #edf0f4;
    }

    .status-not-found {
      color: #dc2626;
      font-weight: 600;
      padding: 3px 10px;
      background: #fee2e2;
      border-radius: 6px;
      font-size: 11px;
    }

    .actual-elements-section {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      border-left: 4px solid #22c55e;
      border-radius: 12px;
      padding: 18px;
    }

    .actual-elements-section h5 {
      color: #166534;
      font-size: 13px;
      font-weight: 700;
      margin-bottom: 12px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .section-description {
      font-size: 12px;
      color: #166534;
      margin-bottom: 16px;
      font-style: italic;
    }

    .elements-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      background: white;
      border-radius: 10px;
      overflow: hidden;
      font-size: 12px;
      margin-bottom: 16px;
      border: 1px solid #dcfce7;
    }

    .elements-table thead {
      background: linear-gradient(135deg, #22c55e, #16a34a);
      color: white;
    }

    .elements-table th {
      padding: 10px 14px;
      text-align: left;
      font-weight: 600;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .elements-table td {
      padding: 10px 14px;
      border-bottom: 1px solid #f1f5f9;
      color: #334155;
    }

    .elements-table tbody tr:hover {
      background: #f8fafc;
    }

    .elements-table .interactive-row {
      background: #eff6ff;
    }

    .elements-table .interactive-row:hover {
      background: #dbeafe;
    }
    .elements-table tbody tr:last-child td {
      border-bottom: none;
    }

    .element-type {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 6px;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      background: #f1f5f9;
      color: #64748b;
    }
    
    .interactive-cell {
      text-align: center;
      font-size: 16px;
      color: #28a745;
    }
    
    .help-text {
      background: white;
      border-radius: 10px;
      padding: 16px;
      border: 1px solid #edf0f4;
      border-left: 4px solid var(--brand-accent);
    }

    .help-text p {
      margin: 0 0 8px 0;
      font-size: 13px;
      color: #334155;
    }

    .help-text ul {
      margin: 8px 0 0 20px;
      padding: 0;
    }

    .help-text li {
      margin: 6px 0;
      font-size: 12px;
      color: #64748b;
      line-height: 1.6;
    }

    .warning-text {
      color: #92400e;
      font-size: 13px;
      font-style: italic;
      margin: 10px 0;
    }
    
    .api-calls-section {
      background: white;
      border-top: 1px solid #edf0f4;
    }

    .api-calls-section .section-toggle-header {
      padding: 20px 28px 16px 28px;
      margin-bottom: 0;
    }

    .api-calls-summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      gap: 16px;
      padding: 20px 28px;
      background: #f8f9fb;
      border-top: 1px solid #edf0f4;
      border-bottom: 1px solid #edf0f4;
    }

    .api-summary-card {
      background: white;
      border: 1px solid #edf0f4;
      border-radius: 12px;
      padding: 18px 14px;
      text-align: center;
      border-left: 4px solid var(--brand-accent);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    .api-summary-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    }

    .api-summary-card.success {
      border-left-color: #22c55e;
    }

    .api-summary-card.error {
      border-left-color: #ef4444;
    }

    .api-summary-number {
      font-size: 28px;
      font-weight: 700;
      color: var(--brand-accent);
      margin-bottom: 4px;
      letter-spacing: -0.5px;
    }

    .api-summary-card.success .api-summary-number {
      color: #22c55e;
    }

    .api-summary-card.error .api-summary-number {
      color: #ef4444;
    }

    .api-summary-label {
      font-size: 11px;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      font-weight: 500;
    }
    
    .api-calls-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      font-size: 12px;
      table-layout: fixed;
      border: 1px solid #edf0f4;
      border-radius: 10px;
      overflow: hidden;
    }

    .api-calls-table-wrap {
      padding: 20px 28px 28px 28px;
    }

    .api-calls-table thead {
      background: #f1f5f9;
    }

    .api-calls-table th {
      padding: 10px 14px;
      text-align: left;
      font-weight: 600;
      color: #64748b;
      border-right: 1px solid #edf0f4;
      border-bottom: 1px solid #e2e8f0;
      position: relative;
      resize: horizontal;
      overflow: auto;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .api-calls-table th:last-child {
      border-right: none;
    }
    
    .api-calls-table th .resizer {
      position: absolute;
      top: 0;
      right: 0;
      width: 5px;
      cursor: col-resize;
      user-select: none;
      height: 100%;
      background: transparent;
    }
    
    .api-calls-table th .resizer:hover {
      background: #007bff;
    }
    
    .api-calls-table td {
      padding: 10px 12px;
      border-bottom: 1px solid #e9ecef;
      border-right: 1px solid #e9ecef;
      color: #6c757d;
      word-break: break-word;
    }
    
    .api-calls-table td:last-child {
      border-right: none;
    }
    
    .api-calls-table tbody tr:hover {
      background: #f8f9fa;
    }
    
    .api-method {
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 10px;
      display: inline-block;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    .api-method.get {
      background: #e0f2fe;
      color: #0369a1;
    }

    .api-method.post {
      background: #dcfce7;
      color: #166534;
    }

    .api-method.put {
      background: #fef9c3;
      color: #854d0e;
    }

    .api-method.delete {
      background: #fee2e2;
      color: #991b1b;
    }

    .api-method.patch {
      background: #f3e8ff;
      color: #6b21a8;
    }

    .api-status {
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 10px;
      display: inline-block;
      font-weight: 600;
    }

    .api-status.success {
      background: #dcfce7;
      color: #166534;
    }

    .api-status.error {
      background: #fee2e2;
      color: #991b1b;
    }

    .api-status.warning {
      background: #fef9c3;
      color: #854d0e;
    }
    
    .api-url {
      font-family: 'Monaco', 'Menlo', 'Courier New', monospace;
      font-size: 11px;
      color: #495057;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .success-call {
      background: #f8fff9;
    }
    
    .failed-call {
      background: #fff5f5;
    }
    
    .api-calls-table tbody tr.success-call:hover {
      background: #e8f5e9;
    }
    
    .api-calls-table tbody tr.failed-call:hover {
      background: #ffebee;
    }
    
    .api-calls-empty {
      padding: 20px;
      text-align: center;
      color: #6c757d;
      background: #f8f9fa;
      border-radius: 4px;
    }
    
    .footer {
      background: #f8f9fb;
      padding: 20px 28px;
      border-top: 1px solid #edf0f4;
      font-size: 12px;
      color: #94a3b8;
      text-align: center;
    }

    /* ---- Expand/Collapse for Pulse and API sections ---- */
    .section-toggle-header {
      cursor: pointer;
      user-select: none;
      padding: 0;
      margin-bottom: 20px;
      transition: opacity 0.15s ease;
    }

    .section-toggle-header:hover {
      opacity: 0.75;
    }

    .section-toggle-header h2 {
      display: flex;
      align-items: center;
      margin: 0;
      font-size: 18px;
      font-weight: 600;
      color: #1e293b;
    }

    .section-toggle-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-right: 10px;
      width: 24px;
      height: 24px;
      font-size: 14px;
      transition: transform 0.2s ease;
      color: var(--brand-accent);
      flex-shrink: 0;
      background: rgba(0,0,0,0.03);
      border-radius: 6px;
    }

    .section-toggle-icon.expanded { transform: rotate(90deg); }

    .section-collapsible-body {
      display: none;
      margin-top: 16px;
    }

    .section-collapsible-body.expanded { display: block; }

    /* ---- Test Recording section ---- */
    .video-section {
      padding: 32px 28px;
      background: white;
      border-top: 1px solid #edf0f4;
    }

    .video-section h2 {
      font-size: 18px;
      color: #1e293b;
      margin: 0;
      font-weight: 600;
    }

    .test-video {
      width: 100%;
      max-width: 920px;
      display: block;
      border-radius: 12px;
      border: 1px solid #edf0f4;
      background: #000;
      margin: 0 auto;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
    }

    .video-path {
      font-size: 11px;
      color: #94a3b8;
      text-align: center;
      margin-top: 10px;
      word-break: break-all;
    }

    /* ---- Pulse Component Validation section ---- */

    /* Shared element-level atom styles */
    .pulse-component-name {
      font-weight: 600;
      color: #4a5568;
      font-size: 13px;
      margin-bottom: 2px;
    }

    .pulse-component-category {
      font-size: 11px;
      color: #718096;
      font-weight: 500;
      background: #edf2f7;
      padding: 2px 7px;
      border-radius: 3px;
      display: inline-block;
      margin-top: 3px;
    }

    .pulse-element-label {
      font-weight: 500;
      color: #2d3748;
      margin-bottom: 4px;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }

    .pulse-details {
      font-size: 11px;
      color: #718096;
      font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace;
      background: #f7fafc;
      padding: 3px 8px;
      border-radius: 3px;
      margin-top: 4px;
      border-left: 2px solid #cbd5e0;
      word-wrap: break-word;
      overflow-wrap: break-word;
      white-space: normal;
      line-height: 1.4;
    }

    .pulse-rule-cell {
      line-height: 1.5;
      word-wrap: break-word;
      overflow-wrap: break-word;
    }

    .pulse-element-cell {
      min-width: 200px;
      max-width: 300px;
    }

    .pulse-severity {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      white-space: nowrap;
    }

    .pulse-sev-error   { background: #f8d7da; color: #721c24; }
    .pulse-sev-warning { background: #fff3cd; color: #856404; }
    .pulse-sev-info    { background: #d1ecf1; color: #0c5460; }

    /* Outer section */
    .pulse-section {
      padding: 40px;
      background: white;
      border-top: 3px solid #f7a825;
    }

    .pulse-section-header h2 {
      font-size: 20px;
      color: #333;
      margin-bottom: 8px;
      font-weight: 600;
    }

    .pulse-subtitle {
      font-size: 13px;
      color: #6c757d;
      margin-bottom: 12px;
    }

    .pulse-suite-note {
      font-size: 12px;
      color: #555;
      background: #f0f7ff;
      border: 1px solid #bdd7f0;
      border-radius: 6px;
      padding: 8px 14px;
      margin-bottom: 14px;
    }

    /* Controls row: chips + bulk buttons */
    .pulse-controls-row {
      display: flex;
      align-items: center;
      gap: 14px;
      flex-wrap: wrap;
      margin-bottom: 10px;
    }

    .pulse-summary-chips {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .pulse-chip {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
    }

    .pulse-chip-error   { background: #f8d7da; color: #721c24; }
    .pulse-chip-warning { background: #fff3cd; color: #856404; }
    .pulse-chip-info    { background: #d1ecf1; color: #0c5460; }

    .pulse-action-btns {
      margin-left: auto;
      display: flex;
      gap: 6px;
    }

    .pulse-action-btn {
      padding: 4px 12px;
      border-radius: 4px;
      border: 1px solid #d0d5dd;
      background: #f9f9f9;
      color: #344054;
      font-size: 12px;
      cursor: pointer;
      transition: background 0.15s;
    }

    .pulse-action-btn:hover { background: #eef2f7; }

    /* Filter bar */
    .pulse-filter-row {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 18px;
      flex-wrap: wrap;
    }

    .pulse-filter-label {
      font-size: 12px;
      color: #6c757d;
      font-weight: 500;
      margin-right: 2px;
    }

    .pulse-filter-btn {
      padding: 3px 11px;
      border-radius: 14px;
      border: 1px solid #d0d5dd;
      background: #f0f0f0;
      color: #555;
      font-size: 12px;
      cursor: pointer;
      transition: background 0.15s, border-color 0.15s;
    }

    .pulse-filter-btn:hover    { background: #e0e6f0; }
    .pulse-filter-btn.active   { background: #f7a825; border-color: #e09010; color: #fff; font-weight: 600; }

    .pulse-platform-badge {
      display: inline-block;
      margin-left: 10px;
      padding: 2px 10px;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 600;
      background: #e8f0fe;
      color: #1a56a0;
      vertical-align: middle;
    }

    /* Per-screen accordion */
    .pulse-screens-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 16px;
    }

    .pulse-screen-panel {
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow: hidden;
    }

    .pulse-screen-header {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 11px 16px;
      background: #fef9ee;
      border-bottom: 1px solid #f0e6c0;
      cursor: pointer;
      user-select: none;
      transition: background 0.15s;
    }

    .pulse-screen-header:hover { background: #fef3d0; }

    .pulse-screen-chevron {
      font-size: 11px;
      color: #b07d10;
      transition: transform 0.2s;
      display: inline-block;
      width: 14px;
    }

    .pulse-screen-chevron.expanded { transform: rotate(90deg); }

    .pulse-screen-title {
      font-weight: 600;
      color: #4a3800;
      font-size: 14px;
      flex: 1;
    }

    .pulse-screen-badges {
      display: flex;
      gap: 5px;
      align-items: center;
    }

    .pulse-screen-badge {
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 11px;
      font-weight: 700;
    }

    .pulse-screen-badge-error   { background: #f8d7da; color: #721c24; }
    .pulse-screen-badge-warning { background: #fff3cd; color: #856404; }
    .pulse-screen-badge-info    { background: #d1ecf1; color: #0c5460; }
    .pulse-screen-badge-pass    { background: #d4edda; color: #155724; }
    .pulse-screen-badge-nodata  { background: #f0f0f0; color: #6c757d; }

    /* Step-type badges shown in screen panel header */
    .pulse-step-badge {
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 11px;
      font-weight: 700;
      margin-left: 6px;
      white-space: nowrap;
    }
    .pulse-step-badge-runtime { background: #e8f5e9; color: #2e7d32; }
    .pulse-step-badge-failure { background: #fff3e0; color: #e65100; }
    .pulse-step-badge-visited  { background: #f3e5f5; color: #6a1b9a; }

    /* Test-name chip shown in screen panel header */
    .pulse-test-name-chip {
      font-size: 11px;
      color: #4a6fa5;
      background: #e8eef7;
      padding: 2px 8px;
      border-radius: 10px;
      margin-left: 6px;
      max-width: 220px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* Metadata row at top of each screen panel body */
    .pulse-screen-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding: 8px 14px;
      background: #f8f9fa;
      border-bottom: 1px solid #e9ecef;
    }
    .pulse-meta-item       { font-size: 11px; color: #555; white-space: nowrap; }
    .pulse-meta-violations { color: #856404; font-weight: 600; }
    .pulse-meta-passed     { color: #155724; font-weight: 600; }

    /* Pass-count footer inside screen panel body */
    .pulse-pass-footer {
      padding: 8px 14px;
      font-size: 12px;
      color: #155724;
      background: #f0faf3;
      border-top: 1px solid #c3e6cb;
      text-align: right;
    }

    .pulse-screen-count {
      font-size: 11px;
      color: #8a7040;
      margin-left: 8px;
      white-space: nowrap;
    }

    /* Collapsible screen body */
    .pulse-screen-body {
      display: none;
      overflow-x: auto;
    }

    .pulse-screen-body.expanded { display: block; }

    /* Per-screen violations table */
    .pulse-screen-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      table-layout: auto;
    }

    .pulse-screen-table thead {
      background: #fafafa;
      border-bottom: 1px solid #e2e8f0;
    }

    .pulse-screen-table th {
      padding: 8px 12px;
      text-align: left;
      font-weight: 600;
      color: #4a5568;
      border-right: 1px solid #e8ecf0;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .pulse-screen-table th:last-child { border-right: none; }

    .pulse-screen-table th:nth-child(1) { width: 18%; }  /* Component */
    .pulse-screen-table th:nth-child(2) { width: 24%; }  /* Element */
    .pulse-screen-table th:nth-child(3) { width: 48%; }  /* Rule */
    .pulse-screen-table th:nth-child(4) { width: 10%; }  /* Severity */

    .pulse-screen-table td {
      padding: 9px 12px;
      border-bottom: 1px solid #f0f0f0;
      border-right: 1px solid #f0f0f0;
      color: #333;
      vertical-align: top;
    }

    .pulse-screen-table td:last-child { border-right: none; }

    .pulse-screen-table tbody tr:hover { background: #fffdf0; }

    /* Hidden row when filtered */
    .pulse-screen-table tr[data-sev].hidden { display: none; }

    .pulse-footer-note {
      font-size: 11px;
      color: #999;
      margin: 0;
      padding-top: 6px;
      border-top: 1px solid #f0f0f0;
    }

    .pulse-pass-banner {
      background: #d4edda;
      border: 1px solid #c3e6cb;
      color: #155724;
      border-radius: 6px;
      padding: 14px 18px;
      font-size: 14px;
      margin-bottom: 12px;
    }

    .pulse-screen-pass-note {
      padding: 14px 18px;
      background: #f0fff4;
      color: #276749;
      font-size: 13px;
      border-top: 1px solid #c6f6d5;
    }

    .pulse-screen-nodata-note {
      padding: 14px 18px;
      background: #fafafa;
      color: #718096;
      font-size: 13px;
      border-top: 1px solid #e2e8f0;
      font-style: italic;
    }

    /* ── Glass UI Theme ─────────────────────────────────────────────────── */
    :root {
      --glass-bg:        rgba(255, 255, 255, 0.78);
      --glass-bg-strong: rgba(255, 255, 255, 0.90);
      --glass-bg-subtle: rgba(255, 255, 255, 0.40);
      --glass-blur:        blur(22px);
      --glass-blur-subtle: blur(14px);
      --glass-border:        rgba(255, 255, 255, 0.42);
      --glass-border-strong: rgba(255, 255, 255, 0.65);
      --glass-shadow:       0 8px 32px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.07);
      --glass-shadow-hover: 0 14px 44px rgba(0,0,0,0.20), 0 4px 14px rgba(0,0,0,0.10);
    }

    /* Decorative orbs – visible through the frosted container */
    body {
      position: relative;
      overflow-x: hidden;
      background-attachment: fixed;
    }
    body::before {
      content: '';
      position: fixed;
      top: -20%; right: -10%;
      width: 60vw; height: 60vw;
      max-width: 720px; max-height: 720px;
      background: radial-gradient(circle, rgba(255,255,255,0.14) 0%, transparent 70%);
      border-radius: 50%;
      pointer-events: none;
      z-index: 0;
    }
    body::after {
      content: '';
      position: fixed;
      bottom: -15%; left: -10%;
      width: 55vw; height: 55vw;
      max-width: 640px; max-height: 640px;
      background: radial-gradient(circle, rgba(255,255,255,0.09) 0%, transparent 70%);
      border-radius: 50%;
      pointer-events: none;
      z-index: 0;
    }

    .container {
      position: relative;
      z-index: 1;
    }

    .header {
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
    }

    .summary {
      background: var(--glass-bg-subtle) !important;
      backdrop-filter: var(--glass-blur-subtle);
      -webkit-backdrop-filter: var(--glass-blur-subtle);
    }

    .summary-card {
      background: var(--glass-bg) !important;
      backdrop-filter: var(--glass-blur-subtle);
      -webkit-backdrop-filter: var(--glass-blur-subtle);
      border: 1px solid var(--glass-border) !important;
      box-shadow: var(--glass-shadow);
    }
    .summary-card:hover {
      background: var(--glass-bg-strong) !important;
      box-shadow: var(--glass-shadow-hover);
    }

    .report-tabs {
      background: var(--glass-bg) !important;
      backdrop-filter: var(--glass-blur-subtle);
      -webkit-backdrop-filter: var(--glass-blur-subtle);
    }

    .inline-summary,
    .search-filter-bar,
    .metadata-section {
      background: var(--glass-bg-subtle) !important;
    }

    .search-box {
      background: var(--glass-bg) !important;
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      border-color: var(--glass-border) !important;
    }

    .metadata-value {
      background: var(--glass-bg) !important;
      border: 1px solid var(--glass-border) !important;
    }

    .test-item-header {
      background: var(--glass-bg) !important;
      backdrop-filter: var(--glass-blur-subtle);
      -webkit-backdrop-filter: var(--glass-blur-subtle);
      border-color: var(--glass-border) !important;
    }
    .test-item-header:hover {
      background: var(--glass-bg-strong) !important;
      box-shadow: var(--glass-shadow-hover);
    }

    .test-details {
      background: rgba(248, 249, 251, 0.80) !important;
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border-color: var(--glass-border) !important;
    }

    .screenshot-item {
      background: var(--glass-bg) !important;
      backdrop-filter: var(--glass-blur-subtle);
      -webkit-backdrop-filter: var(--glass-blur-subtle);
      border-color: var(--glass-border) !important;
    }
    .screenshot-name {
      background: var(--glass-bg-subtle) !important;
      border-top-color: var(--glass-border) !important;
    }

    .hierarchy-section {
      background: var(--glass-bg) !important;
      backdrop-filter: var(--glass-blur-subtle);
      -webkit-backdrop-filter: var(--glass-blur-subtle);
      border-color: var(--glass-border) !important;
    }
    .hierarchy-tree,
    .hierarchy-stats p {
      background: rgba(248, 249, 251, 0.65) !important;
      border-color: rgba(237, 240, 244, 0.55) !important;
    }
    .hierarchy-details summary {
      background: var(--glass-bg-subtle) !important;
      border-color: var(--glass-border) !important;
    }
    .hierarchy-details summary:hover {
      background: var(--glass-bg) !important;
    }

    .api-calls-section {
      background: var(--glass-bg-subtle) !important;
    }
    .api-summary-card {
      background: var(--glass-bg) !important;
      backdrop-filter: var(--glass-blur-subtle);
      -webkit-backdrop-filter: var(--glass-blur-subtle);
      border-color: var(--glass-border) !important;
    }
    .api-summary-card:hover {
      background: var(--glass-bg-strong) !important;
      box-shadow: var(--glass-shadow-hover);
    }

    .filter-pill {
      background: var(--glass-bg-subtle) !important;
      border-color: var(--glass-border) !important;
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
    }
    .filter-pill:hover { background: var(--glass-bg) !important; }
    .filter-pill.active {
      background: var(--glass-bg) !important;
      border-color: rgba(203, 213, 225, 0.55) !important;
    }

    .cmd-timeline-details {
      background: var(--glass-bg-subtle) !important;
      border-color: var(--glass-border) !important;
    }
    .cmd-timeline-summary { background: var(--glass-bg-subtle) !important; }
    .cmd-timeline-summary:hover { background: var(--glass-bg) !important; }

    .steps-list li {
      background: var(--glass-bg) !important;
      border-color: var(--glass-border) !important;
      backdrop-filter: blur(4px);
      -webkit-backdrop-filter: blur(4px);
    }
    .steps-list li:hover { background: var(--glass-bg-strong) !important; }

    .help-text {
      background: var(--glass-bg) !important;
      border-color: var(--glass-border) !important;
    }

    .failure-section { background: var(--glass-bg) !important; }

    .element-details {
      background: var(--glass-bg) !important;
      border-color: rgba(245, 158, 11, 0.18) !important;
    }

    .failure-location-path { background: var(--glass-bg) !important; }
    /* ── End Glass UI Theme ──────────────────────────────────────────────── */

    /* ── Feature 1: Slow API call highlighting ── */
    .api-calls-table tr.api-slow td { background: #fffbeb !important; }
    .api-calls-table tr.api-very-slow td { background: #fff1f2 !important; }
    .api-slow .api-rt { color: #d97706; font-weight: 700; }
    .api-very-slow .api-rt { color: #dc2626; font-weight: 700; }

    /* ── Feature 2: Live search filter bars ── */
    .filter-bar { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; padding: 0 28px; }
    .filter-bar input { flex: 1; max-width: 400px; padding: 8px 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 13px; outline: none; }
    .filter-bar input:focus { border-color: #cc0000; box-shadow: 0 0 0 2px rgba(204,0,0,0.1); }
    .filter-count { font-size: 11px; color: #94a3b8; }

    /* ── Full-screen app shell ── */
    .app-body {
      display: flex;
      flex: 1;
      align-items: flex-start;
    }
    .app-sidebar {
      width: 256px;
      flex-shrink: 0;
      background: #1a2035;
      position: sticky;
      top: 48px;
      height: calc(100vh - 48px);
      overflow-y: auto;
      scrollbar-width: thin;
      scrollbar-color: rgba(255,255,255,0.14) transparent;
    }
    .app-sidebar::-webkit-scrollbar { width: 4px; }
    .app-sidebar::-webkit-scrollbar-track { background: transparent; }
    .app-sidebar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 2px; }
    .sidebar-resizer {
      width: 5px;
      flex-shrink: 0;
      cursor: col-resize;
      background: rgba(255,255,255,0.06);
      position: sticky;
      top: 48px;
      height: calc(100vh - 48px);
      transition: background 0.15s;
      z-index: 10;
    }
    .sidebar-resizer:hover,
    .sidebar-resizer.dragging { background: #1A6680; }
    .app-main {
      flex: 1;
      min-width: 0;
      background: #f8f9fb;
    }
    .sidebar-section {
      padding: 16px 18px;
      border-bottom: 1px solid rgba(255,255,255,0.06);
    }
    .sidebar-title {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #4a5568;
      font-weight: 700;
      margin: 0 0 10px;
    }
    .sidebar-stat {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 3px 0;
      font-size: 12px;
      color: #6b7280;
    }
    .sidebar-stat strong {
      font-size: 14px;
      font-weight: 700;
      color: #c8d6e8;
    }
    .sidebar-stat strong.s-passed  { color: #4ade80; }
    .sidebar-stat strong.s-failed  { color: #f87171; }
    .sidebar-stat strong.s-total   { color: #93c5fd; }
    .sidebar-stat strong.s-dur     { color: #fbbf24; font-size: 12px; }
    .sidebar-nav-item {
      display: flex;
      align-items: center;
      gap: 9px;
      padding: 7px 18px;
      color: #8897aa;
      font-size: 11.5px;
      line-height: 1.35;
      cursor: pointer;
      text-decoration: none;
      transition: background 0.1s, color 0.1s, border-color 0.1s;
      border-left: 2px solid transparent;
    }
    .sidebar-nav-item:hover {
      background: rgba(255,255,255,0.05);
      color: #dde6f0;
      border-left-color: rgba(255,255,255,0.18);
    }
    .sidebar-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      flex-shrink: 0;
    }
    .sidebar-dot.passed  { background: #4ade80; }
    .sidebar-dot.failed  { background: #f87171; box-shadow: 0 0 5px rgba(248,113,113,0.65); }
    .sidebar-dot.skipped { background: #4a5568; }
    .sidebar-test-name {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    /* When sidebar is manually widened, allow names to wrap */
    .app-sidebar[style*="width"] .sidebar-test-name {
      white-space: normal;
      word-break: break-all;
      text-overflow: clip;
    }

    /* ── Feature 3: Environment info bar ── */
    .env-info-bar { display: flex; gap: 8px; flex-wrap: wrap; padding: 8px 28px; background: #f1f5f9; border-bottom: 1px solid #e2e8f0; }
    .env-chip { font-size: 11px; background: white; border: 1px solid #e2e8f0; border-radius: 20px; padding: 3px 10px; color: #475569; font-weight: 500; }
    .env-chip.env-platform { background: #cc0000; color: white; border-color: #cc0000; }

    /* ── Executive Summary Card ── */
    .exec-summary {
      margin: 16px 24px 0;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      background: white;
      overflow: hidden;
    }
    .exec-summary-top {
      display: flex;
      align-items: center;
      gap: 24px;
      padding: 16px 20px;
      border-bottom: 1px solid #f1f5f9;
      flex-wrap: wrap;
    }
    .exec-pass-rate {
      display: flex;
      flex-direction: column;
      align-items: center;
      min-width: 72px;
    }
    .exec-pass-rate .rate-num {
      font-size: 32px;
      font-weight: 700;
      line-height: 1;
    }
    .exec-pass-rate .rate-label {
      font-size: 10px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-top: 2px;
    }
    .exec-pass-rate .rate-delta {
      font-size: 11px;
      font-weight: 600;
      margin-top: 3px;
    }
    .exec-divider { width: 1px; height: 48px; background: #e2e8f0; flex-shrink: 0; }
    .exec-stat-group { display: flex; flex-direction: column; gap: 4px; }
    .exec-stat-row { display: flex; align-items: center; gap: 8px; font-size: 12px; }
    .exec-stat-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
    .exec-stat-dot.passed { background: #16a34a; }
    .exec-stat-dot.failed { background: #dc2626; }
    .exec-stat-val { font-weight: 700; color: #1e293b; min-width: 20px; }
    .exec-stat-lbl { color: #64748b; }
    .exec-verdict {
      margin-left: auto;
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 14px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      border: 1px solid;
    }
    .exec-heatmap {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      padding: 12px 20px;
      background: #fafafa;
    }
    .heatmap-chip {
      display: flex;
      align-items: center;
      gap: 5px;
      padding: 4px 10px;
      border-radius: 20px;
      border: 1px solid;
      font-size: 11px;
      font-weight: 600;
    }
    .heatmap-chip.all-pass { background: #f0fdf4; border-color: #bbf7d0; color: #15803d; }
    .heatmap-chip.has-fail { background: #fef2f2; border-color: #fecaca; color: #dc2626; }
    .heatmap-chip.mixed  { background: #fffbeb; border-color: #fde68a; color: #92400e; }
    .heatmap-chip .chip-counts { font-weight: 400; opacity: 0.8; font-size: 10px; }

    /* ── Feature 4: Toggle passing tests button ── */
    .toggle-btn { padding: 6px 14px; border: 1px solid #e2e8f0; border-radius: 8px; background: white; font-size: 12px; cursor: pointer; color: #475569; }

    /* ── Feature 5: Sparkline wrap ── */
    .sparkline-wrap { display: inline-flex; align-items: center; gap: 6px; margin-left: 16px; }

    /* ── Feature 6: Copy link button ── */
    .copy-link-btn { background: none; border: none; cursor: pointer; font-size: 12px; padding: 2px 4px; opacity: 0.4; border-radius: 4px; }
    .copy-link-btn:hover { opacity: 1; background: rgba(0,0,0,0.05); }

    /* ── Feature 7: Export CSV button ── */
    .export-btn { padding: 6px 14px; border: 1px solid #e2e8f0; border-radius: 8px; background: white; font-size: 12px; cursor: pointer; color: #475569; }
    .export-btn:hover { background: #f8fafc; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-row">
        <div class="header-left">
          <div class="brand-logo-wrap">${getBrandLogoMarkup(reportBrand.key)}</div>
          <h1>${reportTitle}</h1>
          <p>${reportName} • ${platformLabel} • ${reportBrand.label} • ${formattedDate}</p>
        </div>
        <div class="donut-wrap">
          <svg viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e2e8f0" stroke-width="3"></circle>
            ${summary.failed > 0 ? `<circle cx="18" cy="18" r="15.9" fill="none" stroke="#ef4444" stroke-width="3"
              stroke-dasharray="${(summary.failed / summary.total * 100).toFixed(1)} ${100 - (summary.failed / summary.total * 100)}"
              stroke-dashoffset="25" stroke-linecap="round"></circle>` : ''}
            ${summary.passed > 0 ? `<circle cx="18" cy="18" r="15.9" fill="none" stroke="#22c55e" stroke-width="3"
              stroke-dasharray="${(summary.passed / summary.total * 100).toFixed(1)} ${100 - (summary.passed / summary.total * 100)}"
              stroke-dashoffset="${25 - (summary.failed / summary.total * 100)}" stroke-linecap="round"></circle>` : ''}
          </svg>
          <div class="donut-label">${passPercentage}%</div>
          ${runHistory.length >= 2 ? (() => {
            const rates = runHistory.map(r => r.total > 0 ? r.passed / r.total : 0);
            const W = 120, H = 36, pad = 4;
            const xs = rates.map((_, i) => pad + (i / (rates.length - 1)) * (W - pad * 2));
            const ys = rates.map(r => pad + (1 - r) * (H - pad * 2));
            const pts = xs.map((x, i) => `${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
            const lastRate = Math.round(rates[rates.length - 1] * 100);
            const color = lastRate >= 80 ? '#22c55e' : lastRate >= 50 ? '#f59e0b' : '#ef4444';
            return `<div class="sparkline-wrap" title="Pass rate trend (last ${runHistory.length} runs)">
              <svg width="${W}" height="${H}" style="overflow:visible">
                <polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>
                <circle cx="${xs[xs.length-1].toFixed(1)}" cy="${ys[ys.length-1].toFixed(1)}" r="3" fill="${color}"/>
              </svg>
              <span style="font-size:11px;color:${color};font-weight:600;">${lastRate}%</span>
            </div>`;
          })() : ''}
        </div>
      </div>
    </div>

    ${envInfo ? `
    <div class="env-info-bar">
      <span class="env-chip">📱 ${envInfo.device || 'Unknown Device'}</span>
      <span class="env-chip">🖥 ${envInfo.os || ''}</span>
      ${envInfo.appVersion ? `<span class="env-chip">📦 v${envInfo.appVersion} (${envInfo.buildNumber || ''})</span>` : ''}
      <span class="env-chip env-platform">${(envInfo.platform || 'ios').toUpperCase()}</span>
    </div>
    ` : ''}

    <!-- Executive Summary Card (suite runs or any run with verdict data) -->
    ${(() => {
      // Show for suite runs (multiple tests) OR single tests that have feature area data
      if (summary.total < 1) return '';
      const rateColor = currentPassRate === 100 ? '#16a34a' : currentPassRate >= 80 ? '#d97706' : '#dc2626';
      const deltaHtml = passRateDelta !== null
        ? `<span class="rate-delta" style="color:${passRateDelta >= 0 ? '#16a34a' : '#dc2626'}">${passRateDelta >= 0 ? '▲' : '▼'} ${Math.abs(passRateDelta)}% vs last run</span>`
        : '';
      const heatmapHtml = featureAreas.length > 0 ? featureAreas.map(a => {
        const cls = a.failed === 0 ? 'all-pass' : a.passed === 0 ? 'has-fail' : 'mixed';
        const icon = a.failed === 0 ? '✓' : '✕';
        return `<span class="heatmap-chip ${cls}" title="${a.passed} passed, ${a.failed} failed">
          <span>${icon}</span>
          <span>${a.name}</span>
          ${a.total > 1 ? `<span class="chip-counts">${a.passed}/${a.total}</span>` : ''}
        </span>`;
      }).join('') : '';
      const verdictHtml = verdict
        ? `<div class="exec-verdict" style="color:${verdict.color};border-color:${verdict.color};background:${verdict.color}11">
            <span>${verdict.icon}</span><span>${verdict.text}</span>
          </div>`
        : '';
      return `<div class="exec-summary">
        <div class="exec-summary-top">
          <div class="exec-pass-rate">
            <span class="rate-num" style="color:${rateColor}">${currentPassRate}%</span>
            <span class="rate-label">Pass Rate</span>
            ${deltaHtml}
          </div>
          <div class="exec-divider"></div>
          <div class="exec-stat-group">
            <div class="exec-stat-row"><span class="exec-stat-dot passed"></span><span class="exec-stat-val">${summary.passed}</span><span class="exec-stat-lbl">Passed</span></div>
            <div class="exec-stat-row"><span class="exec-stat-dot failed"></span><span class="exec-stat-val">${summary.failed}</span><span class="exec-stat-lbl">Failed</span></div>
          </div>
          ${verdictHtml}
        </div>
        ${heatmapHtml ? `<div class="exec-heatmap">${heatmapHtml}</div>` : ''}
      </div>`;
    })()}

    <!-- Tabs -->
    <div class="report-tabs">
      <div class="report-tab active" data-tab="results" onclick="switchTab(this, 'results')">
        Results <span class="tab-count">${summary.total}</span>
      </div>
      <div class="report-tab" data-tab="failures" onclick="switchTab(this, 'failures')">
        Failures ${summary.failed > 0 ? `<span class="tab-count" style="background:#ef4444;color:#fff;">${summary.failed}</span>` : '<span class="tab-count">0</span>'}
      </div>
      ${mlReport && mlReport.predictions ? `
      <div class="report-tab" data-tab="predictions" onclick="switchTab(this, 'predictions')">
        🤖 ML Predictions <span class="tab-count">${mlReport.predictions.summary.highRisk + mlReport.predictions.summary.moderateRisk}</span>
      </div>
      ` : ''}
      ${haioChatLog.length > 0 ? `
      <div class="report-tab" data-tab="haio-chat" onclick="switchTab(this, 'haio-chat')">
        💬 HAIO Chat Log <span class="tab-count">${haioChatLog.length}</span>
      </div>
      ` : ''}
      ${RUN_A11Y && a11yData ? `
      <div class="report-tab" data-tab="a11y" onclick="switchTab(this, 'a11y')">
        ♿ A11y ${a11yCriticalCount > 0 ? `<span class="tab-count" style="background:#c62828;color:#fff;">${a11yCriticalCount}</span>` : '<span class="tab-count">✓</span>'}
      </div>
      ` : ''}
    </div><!-- /report-tabs -->

    <div class="app-body">
      <aside class="app-sidebar">
        <div class="sidebar-section">
          <div class="sidebar-title">Run Summary</div>
          <div class="sidebar-stat">Total <strong class="s-total">${summary.total}</strong></div>
          <div class="sidebar-stat">Passed <strong class="s-passed">${summary.passed}</strong></div>
          ${summary.failed > 0 ? `<div class="sidebar-stat">Failed <strong class="s-failed">${summary.failed}</strong></div>` : ''}
          ${skippedCount > 0 ? `<div class="sidebar-stat">Skipped <strong>${skippedCount}</strong></div>` : ''}
          <div class="sidebar-stat">Duration <strong class="s-dur">${totalDurationFormatted}</strong></div>
        </div>
        <div class="sidebar-section" style="padding-bottom: 8px;">
          <div class="sidebar-title">Tests</div>
        </div>
        ${results.tests.map(test => {
          const _slug = test.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
          return `<a class="sidebar-nav-item" onclick="scrollToTest('${_slug}')">
            <span class="sidebar-dot ${test.status}"></span>
            <span class="sidebar-test-name">${test.name.replace(/</g, '&lt;')}</span>
          </a>`;
        }).join('')}
      </aside>
      <div class="sidebar-resizer" id="sidebarResizer"></div>
      <main class="app-main">

    <!-- Inline Summary Bar -->
    <div class="inline-summary">
      <div class="inline-summary-left">
        Total
        <span class="total-number">${summary.total}</span>
      </div>
      <div class="inline-summary-right">
        ${summary.failed > 0 ? `<div class="inline-stat"><div class="inline-stat-bar failed"></div>Failed<strong>${summary.failed}</strong></div>` : ''}
        ${summary.passed > 0 ? `<div class="inline-stat"><div class="inline-stat-bar passed"></div>Passed<strong>${summary.passed}</strong></div>` : ''}
        ${skippedCount > 0 ? `<div class="inline-stat"><div class="inline-stat-bar skipped"></div>Skipped<strong>${skippedCount}</strong></div>` : ''}
      </div>
    </div>

    <!-- Metadata Grid -->
    ${(() => {
      const metaItems = [];
      if (reportMetadata.platform) metaItems.push(['Platform', reportMetadata.platform]);
      if (reportMetadata.deviceName) metaItems.push(['Device', reportMetadata.deviceName]);
      if (reportMetadata.osVersion) metaItems.push(['OS Version', reportMetadata.osVersion]);
      if (reportMetadata.appId) metaItems.push(['App ID', reportMetadata.appId]);
      if (reportMetadata.environment) metaItems.push(['Environment', reportMetadata.environment]);
      if (reportMetadata.buildConfig) metaItems.push(['Build Config', reportMetadata.buildConfig]);
      if (reportMetadata.maestroVersion) metaItems.push(['Maestro Version', reportMetadata.maestroVersion]);
      if (totalDurationFormatted) metaItems.push(['Total Duration', totalDurationFormatted]);
      if (reportMetadata.executionTimeout) metaItems.push(['Timeout', reportMetadata.executionTimeout]);
      if (metaItems.length === 0) return '';
      return `<div class="metadata-section">
        <div class="metadata-title">Metadata <span class="meta-count">${metaItems.length}</span></div>
        <div class="metadata-grid">
          ${metaItems.map(([k, v]) => `<div class="metadata-item"><span class="metadata-key">${k}</span><span class="metadata-value" title="${escapeHtml(String(v))}">${escapeHtml(String(v))}</span></div>`).join('')}
        </div>
      </div>`;
    })()}

    <!-- CI/CD Metadata Section -->
    ${ciMetadata ? (() => {
      const ciItems = [];
      
      // Git information
      if (ciMetadata.git) {
        const git = ciMetadata.git;
        if (git.branch) ciItems.push(['Branch', git.branch, '🌿']);
        if (git.commitShort) {
          const commitDisplay = git.message ? `${git.commitShort} - ${git.message.substring(0, 50)}${git.message.length > 50 ? '...' : ''}` : git.commitShort;
          ciItems.push(['Commit', commitDisplay, '📝']);
        }
        if (git.author) ciItems.push(['Author', git.author, '👤']);
        if (git.tag) ciItems.push(['Tag', git.tag, '🏷️']);
      }
      
      // CI/CD information
      if (ciMetadata.ci) {
        const ci = ciMetadata.ci;
        if (ci.provider && ci.provider !== 'Local') ciItems.push(['CI Provider', ci.provider, '🔧']);
        if (ci.buildNumber) ciItems.push(['Build #', ci.buildNumber, '🔢']);
        if (ci.jobName) ciItems.push(['Job', ci.jobName, '⚙️']);
        if (ci.trigger) ciItems.push(['Trigger', ci.trigger, '▶️']);
        if (ci.triggeredBy) ciItems.push(['Triggered By', ci.triggeredBy, '👤']);
      }
      
      // Pull Request information
      if (ciMetadata.pr && ciMetadata.pr.number) {
        const pr = ciMetadata.pr;
        ciItems.push(['PR #', pr.number, '🔀']);
        if (pr.title) ciItems.push(['PR Title', pr.title, '📋']);
        if (pr.sourceBranch) ciItems.push(['Source', pr.sourceBranch, '→']);
        if (pr.targetBranch) ciItems.push(['Target', pr.targetBranch, '←']);
      }
      
      // Environment information
      if (ciMetadata.environment) {
        const env = ciMetadata.environment;
        if (env.name && env.name !== 'unknown') ciItems.push(['Environment', env.name.toUpperCase(), '🌍']);
        if (env.appVersion) ciItems.push(['App Version', env.appVersion, '📱']);
        if (env.buildType) ciItems.push(['Build Type', env.buildType, '🔨']);
      }
      
      if (ciItems.length === 0) return '';
      
      return `<div class="metadata-section" style="margin-top:16px;">
        <div class="metadata-title">
          CI/CD Context 
          <span class="meta-count">${ciItems.length}</span>
          ${ciMetadata.ci && ciMetadata.ci.buildUrl ? `<a href="${ciMetadata.ci.buildUrl}" target="_blank" style="margin-left:8px;font-size:11px;color:#3b82f6;text-decoration:none;">View Build →</a>` : ''}
        </div>
        <div class="metadata-grid">
          ${ciItems.map(([k, v, icon]) => `<div class="metadata-item"><span class="metadata-key">${icon} ${k}</span><span class="metadata-value" title="${escapeHtml(String(v))}">${escapeHtml(String(v))}</span></div>`).join('')}
        </div>
      </div>`;
    })() : ''}

    <!-- Performance Metrics Section -->
    ${performanceData ? (() => {
      const perfItems = [];
      
      if (performanceData.duration) {
        perfItems.push(['Duration', performanceData.duration.seconds + 's', '⏱️']);
      }
      
      if (performanceData.memory) {
        perfItems.push(['Memory Avg', performanceData.memory.avg + ' MB', '💾']);
        perfItems.push(['Memory Peak', performanceData.memory.max + ' MB', '📈']);
      }
      
      if (performanceData.cpu) {
        perfItems.push(['CPU Avg', performanceData.cpu.avg + '%', '⚡']);
        perfItems.push(['CPU Peak', performanceData.cpu.max + '%', '🔥']);
      }
      
      if (performanceData.battery && performanceData.battery.drain > 0) {
        perfItems.push(['Battery Drain', performanceData.battery.drain + '%', '🔋']);
      }
      
      if (perfItems.length === 0) return '';
      
      return `<div class="metadata-section" style="margin-top:16px;">
        <div class="metadata-title">
          ⚡ Performance Metrics 
          <span class="meta-count">${perfItems.length}</span>
        </div>
        <div class="metadata-grid">
          ${perfItems.map(([k, v, icon]) => `<div class="metadata-item"><span class="metadata-key">${icon} ${k}</span><span class="metadata-value">${v}</span></div>`).join('')}
        </div>
        ${performanceData.memory || performanceData.cpu ? `
        <div style="margin-top:12px;padding:12px;background:#f0f9ff;border-radius:8px;font-size:11px;color:#0369a1;">
          <strong>ℹ️ Note:</strong> Performance metrics collected at ${performanceData.samples ? performanceData.samples.interval + 'ms' : '2s'} intervals during test execution.
        </div>
        ` : ''}
      </div>`;
    })() : ''}

    <!-- ML Insights Section -->
    ${mlReport && mlReport.insights && mlReport.insights.length > 0 ? `
      <div class="metadata-section" style="margin-top:16px;">
        <div class="metadata-title">
          🤖 ML-Powered Insights 
          <span class="meta-count">${mlReport.insights.length}</span>
        </div>
        ${mlReport.insights.map(insight => `
          <div style="margin-top:12px;padding:12px;background:${insight.type === 'warning' ? '#fef3c7' : '#dbeafe'};border-left:4px solid ${insight.type === 'warning' ? '#f59e0b' : '#3b82f6'};border-radius:8px;">
            <div style="font-weight:600;color:#1e293b;margin-bottom:4px;">${insight.title}</div>
            <div style="font-size:13px;color:#475569;margin-bottom:4px;">${insight.message}</div>
            <div style="font-size:12px;color:#64748b;font-style:italic;">→ ${insight.action}</div>
          </div>
        `).join('')}
      </div>
    ` : ''}

    <!-- Results Tab Panel -->
    <div class="report-tab-panel active" id="panel-results">

    <!-- Search & Filter Bar -->
    <div class="search-filter-bar">
      <div class="search-box">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
        <input type="text" placeholder="Name or ID" oninput="filterTests(this.value)">
      </div>
    </div>

    <!-- Filter Pills -->
    <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 28px;">
      <div class="filter-tabs">
        <div class="filter-pill active" onclick="filterByStatus(this, 'all')">Total <span class="pill-count total-bg">${summary.total}</span></div>
        ${summary.failed > 0 ? `<div class="filter-pill" onclick="filterByStatus(this, 'failed')">Failed <span class="pill-count failed-bg">${summary.failed}</span></div>` : ''}
        ${summary.passed > 0 ? `<div class="filter-pill" onclick="filterByStatus(this, 'passed')">Passed <span class="pill-count passed-bg">${summary.passed}</span></div>` : ''}
        ${skippedCount > 0 ? `<div class="filter-pill" onclick="filterByStatus(this, 'skipped')">Skipped <span class="pill-count skipped-bg">${skippedCount}</span></div>` : ''}
      </div>
      <div class="sort-control">
        Sort by:
        <select onchange="sortTests(this.value)">
          <option value="order">Order Earliest</option>
          <option value="name">Name A-Z</option>
          <option value="duration">Duration</option>
          <option value="status">Status</option>
        </select>
      </div>
    </div>

    <div class="tests-section">
      <h2>Test Results</h2>
      <div class="filter-bar">
        <input type="text" id="testFilter" placeholder="Filter tests by name..." oninput="filterTests(this.value)">
        <span class="filter-count" id="testFilterCount"></span>
        <button onclick="togglePassingTests(this)" class="toggle-btn">Hide Passing</button>
        <button onclick="exportTestsCsv()" class="export-btn">⬇ Export Results</button>
      </div>
      <div class="test-list">
        ${results.tests.map((test) => {
          // For suite runs, find the directory containing this test's results
          // Directory names may be based on filename (TC002_...) or test name (Launch App...)
          let testDir = REPORT_DIR;
          if (results.tests.length > 1) {
            // First try the test name directly
            let candidate = path.join(REPORT_DIR, test.name);
            if (fs.existsSync(candidate)) {
              testDir = candidate;
            } else {
              // Search for directory containing commands file for this test
              try {
                const dirs = fs.readdirSync(REPORT_DIR).filter(f => {
                  const fullPath = path.join(REPORT_DIR, f);
                  return fs.statSync(fullPath).isDirectory();
                });
                for (const dir of dirs) {
                  const dirPath = path.join(REPORT_DIR, dir);
                  const files = fs.readdirSync(dirPath);
                  // Look for commands file matching this test's name
                  if (files.some(f => f.startsWith('commands-') && f.includes(test.name))) {
                    testDir = dirPath;
                    break;
                  }
                }
              } catch (e) {
                // Fall back to REPORT_DIR if search fails
              }
            }
          }
          const details = getTestDetails(test.name, testDir);
          let failureLocation = null;
          if (test.status === 'failed' && failureLocationParser) {
            try {
              // Derive project root from the results XML file (always inside the dated report
              // dir which is always inside test-reports/ which is inside the project root).
              // Using RESULTS_FILE avoids the REPORT_FILE path being /tmp/ during ad-hoc runs.
              const reportedDatedDir = path.dirname(RESULTS_FILE);
              const projectRoot = path.dirname(path.dirname(reportedDatedDir));
              const flowSearch = execSync(
                `find "${projectRoot}/.maestro/flows" -name "${test.name}.yaml" 2>/dev/null | head -1`,
                { encoding: 'utf8', maxBuffer: 1024 * 1024, timeout: 5000 }
              ).trim();
              if (flowSearch) {
                const relPath = path.relative(projectRoot, flowSearch);
                failureLocation = failureLocationParser.findFailureLocation(relPath, test.xmlFailureReason || test.failureReason || '');
              }
            } catch (_) {}
          }
          const testSlug = test.name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
          return `
            <div class="test-item-wrapper" id="test-${testSlug}" data-order="${test.index}" data-status="${test.status}">
              <div class="test-item-header ${test.status}" onclick="toggleTestDetails(this)">
                <div class="test-expand-icon">▶</div>
                <div class="test-status ${test.status}">
                  ${test.status === 'passed' ? '✓' : '✕'}
                </div>
                <div class="test-info">
                  <div class="test-name">
                    ${test.name}
                    <span class="badge ${test.status}">${test.status.toUpperCase()}</span>
                    <button class="copy-link-btn" title="Copy link to this test" onclick="event.stopPropagation(); copyTestLink('${testSlug}')">🔗</button>
                  </div>
                </div>
                <div class="test-duration">${test.duration}s</div>
              </div>
              <div class="test-details">
                ${test.failureReason ? `
                  <div class="test-details-section">
                    <div class="test-details-title">Failure Reason</div>
                    <div class="failure-reason">${test.failureReason}</div>
                    ${failureLocation && failureLocation.file && failureLocation.line ? `
                    <div class="failure-location">
                      <span class="failure-location-icon">📍</span>
                      <span class="failure-location-label">Failed at:</span>
                      <code class="failure-location-path">${escapeHtml(failureLocation.file)}:<strong>${escapeHtml(String(failureLocation.line))}</strong></code>
                      ${failureLocation.content ? `<div class="failure-step-content"><code>${escapeHtml(failureLocation.content)}</code></div>` : ''}
                    </div>` : ''}
                  </div>
                ` : ''}
                ${(() => {
                  // Step-level failure detail: find the first FAILED command step
                  if (test.status !== 'failed') return '';
                  const cd = details.commandsData;
                  if (!cd || !cd.steps || cd.steps.length === 0) return '';
                  const failedStep = cd.steps.find(s => s.metadata && s.metadata.status === 'FAILED');
                  if (!failedStep) return '';
                  const cmd = failedStep.command || {};
                  // Derive a human-readable command description
                  let cmdType = Object.keys(cmd)[0] || 'unknown';
                  let cmdDesc = '';
                  const cmdBody = cmd[cmdType] || {};
                  if (cmdType === 'assertVisibleCommand') {
                    const el = cmdBody.predicate || cmdBody;
                    cmdDesc = el.value ? `assertVisible: "${el.value}"` : `assertVisible (${el.type || 'element'})`;
                  } else if (cmdType === 'tapOnCommand') {
                    const el = cmdBody.selector || cmdBody;
                    cmdDesc = el.value ? `tapOn: "${el.value}"` : `tapOn (${el.type || 'element'})`;
                  } else if (cmdType === 'inputTextCommand') {
                    cmdDesc = `inputText: "${cmdBody.text || ''}"`;
                  } else if (cmdType === 'scrollCommand') {
                    cmdDesc = `scroll ${cmdBody.direction || ''}`.trim();
                  } else if (cmdType === 'runFlowCommand') {
                    cmdDesc = `runFlow: ${cmdBody.path || cmdBody.file || ''}`;
                  } else {
                    cmdDesc = cmdType.replace(/Command$/, '');
                    if (cmdBody.text) cmdDesc += `: "${cmdBody.text}"`;
                    else if (cmdBody.value) cmdDesc += `: "${cmdBody.value}"`;
                  }
                  const stepIdx = cd.steps.indexOf(failedStep) + 1;
                  const durationMs = failedStep.metadata.duration || 0;
                  const durationStr = durationMs >= 1000 ? `${(durationMs/1000).toFixed(1)}s` : `${durationMs}ms`;
                  return `<div class="test-details-section">
                    <div class="test-details-title">Failed Step</div>
                    <div class="failed-step-banner">
                      <span class="failed-step-num">Step ${stepIdx}</span>
                      <code class="failed-step-cmd">${escapeHtml(cmdDesc)}</code>
                      <span class="failed-step-dur">${durationStr}</span>
                    </div>
                  </div>`;
                })()}
                ${test.status === 'failed' && details.hierarchy ? `
                  <div class="test-details-section">
                    <div class="test-details-title">Expected vs Actual Elements</div>
                    ${generateHierarchyHTML(details.hierarchy, test.detailedFailure?.expectedElement)}
                  </div>
                ` : ''}
                ${details.screenshots && details.screenshots.length > 0 ? `
                  <div class="test-details-section">
                    <div class="test-details-title">
                      Screenshots (${details.screenshots.length})
                      ${details.dedupeMetadata && details.dedupeMetadata.duplicateCount > 0
                        ? `<span class="dedupe-info">(${details.dedupeMetadata.duplicateCount} similar screenshot${details.dedupeMetadata.duplicateCount > 1 ? 's' : ''} filtered)</span>`
                        : ''}
                    </div>
                    <div class="screenshots-grid">
                      ${details.screenshots.map((screenshot, idx) => `
                        <div class="screenshot-item">
                          <img class="screenshot-image"
                               src="${screenshot.dataUri || `file://${screenshot.path}`}"
                               alt="${screenshot.name}"
                               onclick="openScreenshotModal('${screenshot.dataUri || screenshot.path}', '${screenshot.name}', ${!!screenshot.dataUri})"
                               onerror="this.style.display='none'">
                          <div class="screenshot-name">${screenshot.name}</div>
                        </div>
                      `).join('')}
                    </div>
                  </div>
                ` : ''}
                ${(() => {
                  const cd = details.commandsData;
                  if (!cd || !cd.steps || cd.steps.length === 0) return '';
                  const totalMs = cd.totalDuration;
                  const totalSec = totalMs >= 60000
                    ? `${Math.floor(totalMs/60000)}m ${Math.round((totalMs%60000)/1000)}s`
                    : totalMs >= 1000
                      ? `${(totalMs/1000).toFixed(1)}s`
                      : `${totalMs}ms`;
                  // Find top-3 slowest steps for callout
                  const sorted = [...cd.steps].sort((a,b) => (b.metadata.duration||0) - (a.metadata.duration||0));
                  const top3 = sorted.slice(0,3).filter(s => (s.metadata.duration||0) > 500);
                  const summaryId = `cmd-steps-${test.name.replace(/[^a-zA-Z0-9]/g,'_')}`;
                  
                  // Filter out SKIPPED conditional runFlow wrappers (those with inline commands but no file)
                  // AND filter out nested steps that are already shown inside their parent runFlow
                  const visibleSteps = cd.steps.filter((s, idx) => {
                    // First, exclude nested steps (already displayed within their parent runFlow)
                    if (cd.nestedIndices && cd.nestedIndices.has(idx)) {
                      return false;
                    }
                    
                    const cmd = s.command || {};
                    const isRunFlow = Object.keys(cmd)[0] === 'runFlowCommand';
                    if (!isRunFlow) return true; // Keep non-runFlow steps
                    
                    const runFlowCmd = cmd.runFlowCommand || {};
                    const hasFile = runFlowCmd.file || runFlowCmd.path;
                    const hasInlineCommands = (runFlowCmd.commands || []).filter(c => c && Object.keys(c).length > 0).length > 0;
                    const isSkipped = s.metadata.status === 'SKIPPED';
                    
                    // Hide SKIPPED conditional wrappers (inline commands, no file)
                    if (isSkipped && hasInlineCommands && !hasFile) return false;
                    
                    return true; // Keep everything else
                  });
                  
                  const rows = visibleSteps.map((s, i, arr) => {
                    const status = s.metadata.status || 'UNKNOWN';
                    const dur = s.metadata.duration || 0;
                    const durLabel = dur >= 1000 ? `${(dur/1000).toFixed(2)}s` : `${dur}ms`;
                    const isSlow = dur >= 3000;
                    const isSkipped = status === 'SKIPPED';
                    // Mark last step as failed if test failed but all steps show as completed
                    const isLastStep = i === arr.length - 1;
                    const isFailed = test.status === 'failed' && isLastStep && status === 'COMPLETED';
                    const stepInfo = formatCommandStep(s);
                    const { icon, label, expandable, details } = stepInfo;
                    const rowClass = isFailed ? 'cmd-row-failed' : isSkipped ? 'cmd-row-skipped' : isSlow ? 'cmd-row-slow' : 'cmd-row-ok';
                    const statusPill = isFailed
                      ? `<span class="cmd-pill cmd-pill-fail">✗ FAILED</span>`
                      : isSkipped
                      ? `<span class="cmd-pill cmd-pill-skip">⏭ SKIPPED</span>`
                      : `<span class="cmd-pill cmd-pill-ok">✓</span>`;
                    const slowBadge = isSlow ? `<span class="cmd-slow-badge">⚠️ slow</span>` : '';
                    
                    // Check if this is a runFlow command
                    const cmd = s.command || {};
                    const isRunFlow = Object.keys(cmd)[0] === 'runFlowCommand';
                    const runFlowCmd = cmd.runFlowCommand || {};
                    const nestedCommands = (runFlowCmd.commands || []).filter(c => c && Object.keys(c).length > 0);
                    const hasNestedSteps = nestedCommands.length > 0;
                    
                    const stepId = `step-${test.name.replace(/[^a-zA-Z0-9]/g,'_')}-${i}`;
                    // Make runFlow steps collapsible if they have nested commands
                    const isExpandable = expandable || hasNestedSteps;
                    
                    // Identify setup steps (onFlowStart boilerplate + animation waits)
                    const cmdType = Object.keys(cmd)[0] || 'unknown';
                    const isSetupStep = 
                      cmdType === 'defineVariablesCommand' || 
                      cmdType === 'applyConfigurationCommand' ||
                      cmdType === 'waitForAnimationToEndCommand' ||
                      (cmdType === 'runScriptCommand' && (label.includes('Screen.js') || /Objects?\.js$/i.test(label)));
                    const stepTypeAttr = isSetupStep ? ' data-step-type="setup"' : '';
                    
                    // Sequential numbering (i+1) instead of metadata.sequenceNumber for cleaner display
                    const displayNumber = i + 1;
                    
                    let rowHtml = `<tr class="${rowClass}" id="${stepId}"${stepTypeAttr}>
                      <td class="cmd-seq">${displayNumber}</td>
                      <td class="cmd-icon">${icon}</td>
                      <td class="cmd-label">${isExpandable ? `<a href="#" class="cmd-step-toggle" data-step="${stepId}" onclick="event.preventDefault(); toggleStepDetails('${stepId}');">${escapeHtml(label)}</a>` : escapeHtml(label)}</td>
                      <td class="cmd-dur">${durLabel}${slowBadge}</td>
                      <td class="cmd-status">${statusPill}</td>
                    </tr>`;
                    
                    // Add expandable details row below if needed (for script output)
                    if (expandable && details) {
                      rowHtml += `<tr class="cmd-details-row" id="${stepId}-details" style="display: none !important;">
                        <td colspan="5" class="cmd-details-cell">
                          <div class="cmd-step-details-content">${escapeHtml(details)}</div>
                        </td>
                      </tr>`;
                    }
                    
                    // Add nested steps from runFlow commands as an indented container
                    // NOTE: Nested steps are shown for reference but don't have individual timing
                    // because they're part of the parent runFlow step's total duration
                    if (hasNestedSteps) {
                      const nestedItems = nestedCommands.map((nc, ni) => {
                        const nCmdType = Object.keys(nc)[0] || 'unknown';
                        const nStepInfo = formatCommandStep({ command: nc, metadata: {} });
                        const { icon: nIcon, label: nLabel } = nStepInfo;
                        // Identify setup-type nested steps: page object scripts and applyConfig
                        const isNestedSetup = nCmdType === 'applyConfigurationCommand' ||
                          (nCmdType === 'runScriptCommand' && /Objects?\.js$/i.test(nLabel));
                        const nestedTypeAttr = isNestedSetup ? ' data-nested-type="setup"' : '';
                        return `<div class="cmd-nested-item"${nestedTypeAttr}>
                          <span class="cmd-nested-seq">${ni + 1}</span>
                          <span class="cmd-nested-icon">${nIcon}</span>
                          <span class="cmd-nested-label">${escapeHtml(nLabel)}</span>
                        </div>`;
                      }).join('');
                      
                      rowHtml += `<tr class="cmd-nested-container-row" id="${stepId}-nested-container" style="display: none !important;">
                        <td colspan="5" style="padding:0 !important;border:none !important;">
                          <div class="cmd-nested-container" style="display:block;">
                            ${nestedItems}
                          </div>
                        </td>
                      </tr>`;
                    }
                    
                    return rowHtml;
                  }).join('');
                  const slowCallout = top3.length > 0 ? `
                    <div class="cmd-slow-callout">
                      <strong>⚠️ Slowest steps:</strong>
                      ${top3.map(s => {
                        const dur = s.metadata.duration || 0;
                        const durLabel = dur >= 1000 ? `${(dur/1000).toFixed(2)}s` : `${dur}ms`;
                        const { icon, label } = formatCommandStep(s);
                        return `<span class="cmd-slow-chip">${icon} ${escapeHtml(label)} — <strong>${durLabel}</strong></span>`;
                      }).join('')}
                    </div>` : '';
                  return `
                  <div class="test-details-section">
                    <div class="test-details-title">Execution Timeline</div>
                    <div style="margin:8px 0;padding:8px 12px;background:#f0f9ff;border-left:3px solid #3b82f6;border-radius:4px;font-size:11px;color:#1e40af;">
                      <strong>ℹ️ Note:</strong> Steps with nested commands (like <code>runFlow</code> or <code>login.yaml</code>) show their <strong>total duration</strong>. 
                      Click expandable steps to see what's included. Nested steps don't have individual timings—they're part of the parent step's duration.
                    </div>
                    ${slowCallout}
                    <details class="cmd-timeline-details" id="${summaryId}">
                      <summary class="cmd-timeline-summary">
                        📋 <strong>${visibleSteps.length}</strong> steps &nbsp;·&nbsp;
                        ✅ <strong>${cd.completedCount}</strong> completed &nbsp;·&nbsp;
                        ⏭ <strong>${cd.skippedCount}</strong> skipped &nbsp;·&nbsp;
                        ⏱ <strong>${totalSec}</strong> total
                        <span class="cmd-expand-hint">— click to expand</span>
                      </summary>
                      <div style="padding:8px 12px;background:#f8fafc;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;gap:8px;">
                        <label style="font-size:11px;color:#64748b;cursor:pointer;display:flex;align-items:center;gap:6px;user-select:none;">
                          <input type="checkbox" id="toggle-setup-${summaryId}" onchange="toggleSetupSteps(this, '${summaryId}')" style="cursor:pointer;">
                          Show setup steps (Define variables, Page objects, Apply config, Wait for animation)
                        </label>
                      </div>
                      <div class="cmd-table-wrap">
                        <table class="cmd-table">
                          <thead><tr>
                            <th>#</th><th></th><th>Step</th><th>Duration</th><th>Status</th>
                          </tr></thead>
                          <tbody>${rows}</tbody>
                        </table>
                      </div>
                    </details>
                  </div>`;
                })()}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
    </div><!-- /panel-results -->

    <!-- Failures Tab Panel -->
    <div class="report-tab-panel" id="panel-failures">
      <div class="tests-section">
        <h2>Failures Analysis</h2>
        
        ${mlReport && mlReport.rootCauseAnalysis && mlReport.rootCauseAnalysis.length > 0 ? `
          <!-- ML Root Cause Analysis -->
          <div style="background:#f0fdf4;border:1px solid #86efac;border-radius:12px;padding:20px;margin-bottom:24px;">
            <div style="font-weight:700;font-size:16px;color:#166534;margin-bottom:12px;">🤖 ML-Powered Root Cause Analysis</div>
            ${mlReport.rootCauseAnalysis.map(analysis => `
              <details style="margin-bottom:12px;border:1px solid #d1fae5;border-radius:8px;padding:12px;background:white;">
                <summary style="cursor:pointer;font-weight:600;color:#1e293b;">
                  ${analysis.testName}
                  <span style="background:#22c55e;color:white;padding:2px 8px;border-radius:12px;font-size:11px;margin-left:8px;">${analysis.confidence}% confidence</span>
                </summary>
                <div style="margin-top:12px;padding-top:12px;border-top:1px solid #e2e8f0;">
                  <div style="margin-bottom:8px;">
                    <strong style="color:#166534;">Root Cause:</strong>
                    <div style="font-size:13px;color:#475569;margin-top:4px;">${analysis.rootCause}</div>
                  </div>
                  <div style="margin-bottom:8px;">
                    <strong style="color:#166534;">Analysis:</strong>
                    <div style="font-size:13px;color:#475569;margin-top:4px;">${analysis.analysis}</div>
                  </div>
                  ${analysis.suggestedFixes ? `
                  <div>
                    <strong style="color:#166534;">Suggested Fixes:</strong>
                    <ul style="font-size:13px;color:#475569;margin-top:4px;margin-left:20px;">
                      ${analysis.suggestedFixes.slice(0, 3).map(fix => `<li>${fix}</li>`).join('')}
                    </ul>
                  </div>
                  ` : ''}
                </div>
              </details>
            `).join('')}
          </div>
        ` : ''}
        
        ${failureReport && failureReport.totalFailures > 0 ? `
          <!-- Failure Summary Cards -->
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:24px;">
            <div style="background:#fff5f5;border:1px solid #fecaca;border-radius:8px;padding:16px;">
              <div style="font-size:32px;font-weight:700;color:#ef4444;margin-bottom:4px;">${failureReport.totalFailures}</div>
              <div style="font-size:12px;color:#64748b;text-transform:uppercase;">Total Failures</div>
            </div>
            <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:16px;">
              <div style="font-size:32px;font-weight:700;color:#f59e0b;margin-bottom:4px;">${Object.keys(failureReport.categories).length}</div>
              <div style="font-size:12px;color:#64748b;text-transform:uppercase;">Categories</div>
            </div>
            ${failureReport.patterns && failureReport.patterns.recurring ? `
            <div style="background:#fee2e2;border:1px solid #fecaca;border-radius:8px;padding:16px;">
              <div style="font-size:32px;font-weight:700;color:#dc2626;margin-bottom:4px;">${failureReport.patterns.recurring.length}</div>
              <div style="font-size:12px;color:#64748b;text-transform:uppercase;">Recurring</div>
            </div>
            ` : ''}
          </div>
          
          <!-- Recommendations -->
          ${failureReport.recommendations && failureReport.recommendations.length > 0 ? `
          <div style="background:#dbeafe;border-left:4px solid #3b82f6;border-radius:8px;padding:16px;margin-bottom:24px;">
            <div style="font-weight:600;color:#1e40af;margin-bottom:12px;">💡 Recommendations</div>
            ${failureReport.recommendations.map(rec => `
              <div style="margin-bottom:8px;">
                <span style="display:inline-block;padding:2px 8px;background:${rec.priority === 'critical' ? '#ef4444' : rec.priority === 'high' ? '#f59e0b' : '#3b82f6'};color:white;border-radius:4px;font-size:10px;font-weight:600;text-transform:uppercase;margin-right:8px;">${rec.priority}</span>
                <strong>${rec.title}</strong>
                <div style="font-size:13px;color:#475569;margin-top:4px;margin-left:24px;">${rec.description}</div>
                <div style="font-size:12px;color:#64748b;margin-top:2px;margin-left:24px;font-style:italic;">${rec.action}</div>
              </div>
            `).join('')}
          </div>
          ` : ''}
          
          <!-- Failure Categories -->
          <div style="margin-bottom:24px;">
            <h3 style="font-size:16px;margin-bottom:12px;color:#1e293b;">Failures by Category</h3>
            ${Object.entries(failureReport.categories).map(([category, data]) => `
              <details style="margin-bottom:12px;border:1px solid #e2e8f0;border-radius:8px;padding:12px;background:white;">
                <summary style="cursor:pointer;font-weight:600;color:#1e293b;">
                  ${category} 
                  <span style="background:#ef4444;color:white;padding:2px 8px;border-radius:12px;font-size:11px;margin-left:8px;">${data.count}</span>
                  <span style="background:${data.severity === 'critical' ? '#dc2626' : data.severity === 'high' ? '#f59e0b' : data.severity === 'medium' ? '#3b82f6' : '#94a3b8'};color:white;padding:2px 8px;border-radius:12px;font-size:10px;margin-left:4px;text-transform:uppercase;">${data.severity}</span>
                </summary>
                <div style="margin-top:12px;padding-top:12px;border-top:1px solid #e2e8f0;">
                  ${data.tests.map(test => `
                    <div style="margin-bottom:8px;padding:8px;background:#f8fafc;border-radius:4px;">
                      <div style="font-size:13px;font-weight:600;color:#334155;margin-bottom:4px;">${test.name}</div>
                      <div style="font-size:12px;color:#64748b;font-family:monospace;">${escapeHtml(test.reason)}</div>
                      ${test.confidence ? `<div style="font-size:10px;color:#94a3b8;margin-top:4px;">Confidence: ${test.confidence.toFixed(0)}%</div>` : ''}
                    </div>
                  `).join('')}
                </div>
              </details>
            `).join('')}
          </div>
        ` : '<p style="color:#94a3b8;font-size:13px;">No failures detected.</p>'}
        
        <!-- Individual Failures -->
        <h3 style="font-size:16px;margin-bottom:12px;color:#1e293b;">All Failures</h3>
        ${results.tests.filter(t => t.status === 'failed').length === 0
          ? '<p style="color:#94a3b8;font-size:13px;">No failures detected.</p>'
          : results.tests.filter(t => t.status === 'failed').map(test => `
          <div style="margin-bottom:16px;padding:14px 18px;border:1px solid #fecaca;border-left:4px solid #ef4444;border-radius:10px;background:#fff5f5;">
            <div style="font-weight:600;color:#1e293b;margin-bottom:6px;">${test.name}</div>
            <div style="font-size:12px;color:#ef4444;font-family:monospace;white-space:pre-wrap;word-break:break-word;">${escapeHtml(test.failureReason || 'Unknown failure')}</div>
            ${test.duration ? `<div style="font-size:11px;color:#94a3b8;margin-top:6px;">Duration: ${test.duration.toFixed(1)}s</div>` : ''}
          </div>`).join('')
        }
      </div>
    </div><!-- /panel-failures -->

    <!-- ML Predictions Tab Panel -->
    ${mlReport && mlReport.predictions ? `
    <div class="report-tab-panel" id="panel-predictions">
      <div class="tests-section">
        <h2>🤖 ML-Powered Predictions</h2>
        
        <!-- Prediction Summary -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px;margin-bottom:24px;">
          <div style="background:#fee2e2;border:1px solid #fecaca;border-radius:8px;padding:16px;">
            <div style="font-size:32px;font-weight:700;color:#dc2626;margin-bottom:4px;">${mlReport.predictions.summary.highRisk}</div>
            <div style="font-size:12px;color:#64748b;text-transform:uppercase;">High Risk</div>
          </div>
          <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:16px;">
            <div style="font-size:32px;font-weight:700;color:#f59e0b;margin-bottom:4px;">${mlReport.predictions.summary.moderateRisk}</div>
            <div style="font-size:12px;color:#64748b;text-transform:uppercase;">Moderate Risk</div>
          </div>
          <div style="background:#dbeafe;border:1px solid #bfdbfe;border-radius:8px;padding:16px;">
            <div style="font-size:32px;font-weight:700;color:#3b82f6;margin-bottom:4px;">${mlReport.predictions.summary.lowRisk}</div>
            <div style="font-size:12px;color:#64748b;text-transform:uppercase;">Low Risk</div>
          </div>
          <div style="background:#d1fae5;border:1px solid #a7f3d0;border-radius:8px;padding:16px;">
            <div style="font-size:32px;font-weight:700;color:#059669;margin-bottom:4px;">${mlReport.predictions.summary.stable}</div>
            <div style="font-size:12px;color:#64748b;text-transform:uppercase;">Stable</div>
          </div>
        </div>

        <!-- Recommendations -->
        ${mlReport.predictions.recommendations && mlReport.predictions.recommendations.length > 0 ? `
        <div style="background:#fef3c7;border-left:4px solid #f59e0b;border-radius:8px;padding:16px;margin-bottom:24px;">
          <div style="font-weight:600;color:#92400e;margin-bottom:12px;">⚠️ Recommendations</div>
          ${mlReport.predictions.recommendations.map(rec => `
            <div style="margin-bottom:12px;">
              <span style="display:inline-block;padding:2px 8px;background:#dc2626;color:white;border-radius:4px;font-size:10px;font-weight:600;text-transform:uppercase;margin-right:8px;">${rec.priority}</span>
              <strong>${rec.title}</strong>
              <div style="font-size:13px;color:#475569;margin-top:4px;margin-left:24px;">${rec.action}</div>
            </div>
          `).join('')}
        </div>
        ` : ''}

        <!-- High Risk Tests -->
        ${mlReport.predictions.predictions.filter(p => p.prediction === 'high_risk').length > 0 ? `
        <div style="margin-bottom:24px;">
          <h3 style="font-size:16px;margin-bottom:12px;color:#dc2626;">🔴 High Risk Tests</h3>
          ${mlReport.predictions.predictions.filter(p => p.prediction === 'high_risk').map(pred => `
            <div style="margin-bottom:12px;padding:14px;border:1px solid #fecaca;border-left:4px solid #dc2626;border-radius:8px;background:#fff5f5;">
              <div style="font-weight:600;color:#1e293b;margin-bottom:6px;">${pred.testName}</div>
              <div style="display:flex;gap:12px;margin-bottom:8px;">
                <div style="font-size:12px;color:#64748b;">
                  <strong>Failure Probability:</strong> ${pred.failureProbability}%
                </div>
                <div style="font-size:12px;color:#64748b;">
                  <strong>Confidence:</strong> ${pred.confidence}%
                </div>
              </div>
              <div style="font-size:12px;color:#475569;margin-bottom:6px;">
                ${pred.reasoning ? pred.reasoning.join('. ') : 'No historical data available'}
              </div>
              ${pred.metrics ? `
              <div style="font-size:11px;color:#94a3b8;">
                Overall: ${pred.metrics.overallFailureRate || 0}% | Recent: ${pred.metrics.recentFailureRate || 0}% | Flakiness: ${pred.metrics.flakiness || 0}%
              </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
        ` : ''}

        <!-- Moderate Risk Tests -->
        ${mlReport.predictions.predictions.filter(p => p.prediction === 'moderate_risk').length > 0 ? `
        <details style="margin-bottom:24px;">
          <summary style="cursor:pointer;font-size:16px;font-weight:600;color:#f59e0b;margin-bottom:12px;">
            🟡 Moderate Risk Tests (${mlReport.predictions.predictions.filter(p => p.prediction === 'moderate_risk').length})
          </summary>
          <div style="margin-top:12px;">
            ${mlReport.predictions.predictions.filter(p => p.prediction === 'moderate_risk').map(pred => `
              <div style="margin-bottom:12px;padding:12px;border:1px solid #fde68a;border-left:4px solid #f59e0b;border-radius:8px;background:#fefce8;">
                <div style="font-weight:600;color:#1e293b;margin-bottom:4px;">${pred.testName}</div>
                <div style="font-size:12px;color:#64748b;">
                  Failure Probability: ${pred.failureProbability}% | Confidence: ${pred.confidence}%
                </div>
              </div>
            `).join('')}
          </div>
        </details>
        ` : ''}

        <!-- Flaky Tests -->
        ${mlReport.flakyTests && mlReport.flakyTests.length > 0 ? `
        <div style="margin-bottom:24px;">
          <h3 style="font-size:16px;margin-bottom:12px;color:#8b5cf6;">⚡ Flaky Tests Detected</h3>
          <div style="background:#faf5ff;border:1px solid #e9d5ff;border-radius:8px;padding:16px;margin-bottom:12px;">
            <div style="font-size:13px;color:#6b21a8;margin-bottom:8px;">
              <strong>What are flaky tests?</strong> Tests that intermittently pass and fail without code changes. High flakiness indicates timing issues, race conditions, or environmental dependencies.
            </div>
          </div>
          ${mlReport.flakyTests.map(test => `
            <div style="margin-bottom:12px;padding:12px;border:1px solid #e9d5ff;border-left:4px solid #8b5cf6;border-radius:8px;background:white;">
              <div style="font-weight:600;color:#1e293b;margin-bottom:4px;">${test.name}</div>
              <div style="display:flex;gap:16px;font-size:12px;color:#64748b;">
                <div><strong>Flakiness:</strong> ${test.flakiness}%</div>
                <div><strong>Failure Rate:</strong> ${test.failureRate}%</div>
                <div><strong>Total Runs:</strong> ${test.totalRuns}</div>
              </div>
            </div>
          `).join('')}
        </div>
        ` : ''}

        <!-- All Predictions -->
        <details>
          <summary style="cursor:pointer;font-size:16px;font-weight:600;color:#1e293b;margin-bottom:12px;">
            All Test Predictions (${mlReport.predictions.predictions.length})
          </summary>
          <div style="margin-top:12px;">
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
              <thead>
                <tr style="background:#f8fafc;border-bottom:2px solid #e2e8f0;">
                  <th style="padding:8px;text-align:left;">Test Name</th>
                  <th style="padding:8px;text-align:center;">Prediction</th>
                  <th style="padding:8px;text-align:center;">Probability</th>
                  <th style="padding:8px;text-align:center;">Confidence</th>
                  <th style="padding:8px;text-align:center;">Flakiness</th>
                </tr>
              </thead>
              <tbody>
                ${mlReport.predictions.predictions.map(pred => `
                  <tr style="border-bottom:1px solid #e2e8f0;">
                    <td style="padding:8px;">${pred.testName}</td>
                    <td style="padding:8px;text-align:center;">
                      <span style="padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;background:${
                        pred.prediction === 'high_risk' ? '#fee2e2' : 
                        pred.prediction === 'moderate_risk' ? '#fef3c7' :
                        pred.prediction === 'low_risk' ? '#dbeafe' : '#d1fae5'
                      };color:${
                        pred.prediction === 'high_risk' ? '#dc2626' :
                        pred.prediction === 'moderate_risk' ? '#f59e0b' :
                        pred.prediction === 'low_risk' ? '#3b82f6' : '#059669'
                      };">${pred.prediction.replace('_', ' ')}</span>
                    </td>
                    <td style="padding:8px;text-align:center;">${pred.failureProbability || 0}%</td>
                    <td style="padding:8px;text-align:center;">${pred.confidence || 0}%</td>
                    <td style="padding:8px;text-align:center;">${pred.metrics ? pred.metrics.flakiness : 0}%</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </details>
      </div>
    </div><!-- /panel-predictions -->
    ` : ''}

    <!-- HAIO Chat Log Tab Panel -->
    ${haioChatLog.length > 0 ? `
    <div class="report-tab-panel" id="panel-haio-chat">
      <div class="tests-section">
        <h2>💬 HAIO Chat Log</h2>
        <p style="color:#64748b;font-size:13px;margin-bottom:20px;">
          Questions sent to the Health AI Assistant and the verified bot responses during test execution.
        </p>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-bottom:24px;">
          <div style="background:#dbeafe;border:1px solid #bfdbfe;border-radius:8px;padding:14px;">
            <div style="font-size:28px;font-weight:700;color:#2563eb;">${haioChatLog.length}</div>
            <div style="font-size:11px;color:#64748b;text-transform:uppercase;">Questions Asked</div>
          </div>
          <div style="background:#d1fae5;border:1px solid #a7f3d0;border-radius:8px;padding:14px;">
            <div style="font-size:28px;font-weight:700;color:#059669;">${haioChatLog.filter(e => e.status === 'COMPLETED').length}</div>
            <div style="font-size:11px;color:#64748b;text-transform:uppercase;">Verified OK</div>
          </div>
          <div style="background:#fee2e2;border:1px solid #fecaca;border-radius:8px;padding:14px;">
            <div style="font-size:28px;font-weight:700;color:#dc2626;">${haioChatLog.filter(e => e.status === 'FAILED').length}</div>
            <div style="font-size:11px;color:#64748b;text-transform:uppercase;">Failed</div>
          </div>
        </div>

        ${(() => {
          // Group by intent/test for suite reports
          const intentGroups = {};
          haioChatLog.forEach(entry => {
            if (entry.testDisplayName) {
              if (!intentGroups[entry.testDisplayName]) {
                intentGroups[entry.testDisplayName] = { total: 0, passed: 0, failed: 0 };
              }
              intentGroups[entry.testDisplayName].total++;
              if (entry.status === 'COMPLETED') intentGroups[entry.testDisplayName].passed++;
              if (entry.status === 'FAILED') intentGroups[entry.testDisplayName].failed++;
            }
          });
          
          if (Object.keys(intentGroups).length > 1) {
            return `
            <div style="margin-bottom:24px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;">
              <h3 style="font-size:14px;font-weight:600;color:#1e293b;margin:0 0 12px 0;">📊 Intent Breakdown</h3>
              <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;">
                ${Object.entries(intentGroups).map(([intent, stats]) => `
                  <div style="background:white;border:1px solid #e2e8f0;border-radius:8px;padding:12px;">
                    <div style="font-size:12px;font-weight:600;color:#475569;margin-bottom:6px;text-transform:uppercase;">${escapeHtml(intent)}</div>
                    <div style="display:flex;gap:8px;font-size:11px;">
                      <span style="color:#2563eb;">📝 ${stats.total}</span>
                      <span style="color:#059669;">✅ ${stats.passed}</span>
                      ${stats.failed > 0 ? `<span style="color:#dc2626;">❌ ${stats.failed}</span>` : ''}
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
            `;
          }
          return '';
        })()}

        <div style="display:flex;flex-direction:column;gap:16px;">
          ${haioChatLog.map((entry, idx) => {
            const statusIcon = entry.status === 'COMPLETED' ? '✅' : entry.status === 'FAILED' ? '❌' : '⏭';
            const statusColor = entry.status === 'COMPLETED' ? '#059669' : entry.status === 'FAILED' ? '#dc2626' : '#94a3b8';
            const borderColor = entry.status === 'COMPLETED' ? '#a7f3d0' : entry.status === 'FAILED' ? '#fecaca' : '#e2e8f0';
            const bgColor = entry.status === 'COMPLETED' ? '#f0fdf4' : entry.status === 'FAILED' ? '#fef2f2' : '#f8fafc';
            const responseLabel = entry.responseCheck
              ? entry.responseCheck.substring(0, 120) + (entry.responseCheck.length > 120 ? '...' : '')
              : 'Response verified';
            // Show test name for suite reports with multiple HAIO tests
            const testNameBadge = entry.testDisplayName 
              ? `<span style="background:#dbeafe;color:#2563eb;padding:3px 10px;border-radius:12px;font-size:10px;font-weight:600;text-transform:uppercase;">${escapeHtml(entry.testDisplayName)}</span>`
              : '';
            return `
            <div style="border:1px solid ${borderColor};border-left:4px solid ${statusColor};border-radius:10px;padding:16px;background:${bgColor};">
              <div style="display:flex;align-items:flex-start;gap:12px;">
                <div style="flex:1;">
                  <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap;">
                    <span style="background:#e2e8f0;color:#475569;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;">Q${idx + 1}</span>
                    <span style="font-size:12px;">${statusIcon}</span>
                    ${testNameBadge}
                  </div>
                  <div style="font-size:14px;font-weight:600;color:#1e293b;margin-bottom:6px;padding:8px 12px;background:rgba(0,0,0,0.04);border-radius:8px;">
                    🗣️ "${escapeHtml(entry.question)}"
                  </div>
                  <div style="font-size:12px;color:#64748b;padding:6px 12px;background:rgba(0,0,0,0.02);border-radius:8px;border-left:3px solid ${statusColor};">
                    🤖 ${escapeHtml(responseLabel)}
                  </div>
                </div>
                ${entry.screenshotPath ? `
                <div style="flex-shrink:0;">
                  <img src="${entry.screenshotIsDataUri ? entry.screenshotPath : `file://${entry.screenshotPath}`}" alt="Q${idx + 1} Screenshot"
                       style="width:120px;border-radius:8px;border:1px solid #e2e8f0;cursor:pointer;"
                       onclick="openScreenshotModal('${entry.screenshotPath}', 'Q${idx + 1}: ${escapeHtml(entry.question)}', ${!!entry.screenshotIsDataUri})"
                       onerror="this.style.display='none'">
                </div>
                ` : ''}
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>
    </div><!-- /panel-haio-chat -->
    ` : ''}

    ${RUN_A11Y && a11yData ? `
    <!-- Accessibility Critical Issues Tab Panel -->
    <div class="report-tab-panel" id="panel-a11y">
      ${generateA11yValidationHTML(a11yData)}
    </div><!-- /panel-a11y -->
    ` : ''}

    <script>
      // ── Tab switching ──
      function switchTab(tabEl, tabId) {
        document.querySelectorAll('.report-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.report-tab-panel').forEach(p => p.classList.remove('active'));
        tabEl.classList.add('active');
        const panel = document.getElementById('panel-' + tabId);
        if (panel) panel.classList.add('active');
      }

      // ── Search filter ──
      function filterTests(q) {
        const rows = document.querySelectorAll('.test-item-wrapper');
        let shown = 0;
        rows.forEach(row => {
          const name = row.querySelector('.test-name') ? row.querySelector('.test-name').textContent : '';
          const match = !q || name.toLowerCase().includes(q.toLowerCase());
          row.style.display = match ? '' : 'none';
          if (match) shown++;
        });
        const el = document.getElementById('testFilterCount');
        if (el) el.textContent = q ? shown + ' shown' : '';
      }

      // ── API call filter ──
      function filterApiCalls(q) {
        const rows = document.querySelectorAll('#apiCallsTable tbody tr');
        let shown = 0;
        rows.forEach(row => {
          const text = row.textContent || '';
          const match = !q || text.toLowerCase().includes(q.toLowerCase());
          row.style.display = match ? '' : 'none';
          if (match) shown++;
        });
        const el = document.getElementById('apiFilterCount');
        if (el) el.textContent = q ? shown + ' shown' : '';
      }

      // ── Toggle passing tests visibility ──
      function togglePassingTests(btn) {
        const passing = document.querySelectorAll('.test-item-wrapper[data-status="passed"]');
        const isHidden = passing.length > 0 && passing[0].style.display === 'none';
        passing.forEach(function(w) { w.style.display = isHidden ? '' : 'none'; });
        btn.textContent = isHidden ? 'Hide Passing' : 'Show Passing';
      }

      // ── Collapse passing tests on load ──
      function collapsePassingTests() {
        document.querySelectorAll('.test-item-wrapper[data-status="passed"] .test-details').forEach(function(d) {
          d.classList.remove('expanded');
          d.style.display = '';
        });
        document.querySelectorAll('.test-item-wrapper[data-status="passed"] .test-expand-icon').forEach(function(i) {
          i.classList.remove('expanded');
          i.textContent = '▶';
        });
      }

      // ── Copy test deep link ──
      function copyTestLink(slug) {
        const url = window.location.href.split('#')[0] + '#test-' + slug;
        navigator.clipboard.writeText(url).then(function() {
          const btn = document.querySelector('#test-' + slug + ' .copy-link-btn');
          if (btn) { btn.textContent = '✓'; setTimeout(function() { btn.textContent = '🔗'; }, 1500); }
        });
      }

      // ── CSV export helpers ──
      function exportApiCsv() {
        const headers = ['Method','URL','Status','Response Time (ms)','Time'];
        const rows = [];
        document.querySelectorAll('#apiCallsTable tbody tr').forEach(function(tr) {
          const cells = tr.querySelectorAll('td');
          if (cells.length >= 5) {
            rows.push([
              cells[0].textContent.trim(),
              cells[1].title || cells[1].textContent.trim(),
              cells[2].textContent.trim(),
              cells[3].textContent.replace('ms','').trim(),
              cells[4].textContent.trim()
            ].map(function(v) { return '"' + v.replace(/"/g,'""') + '"'; }).join(','));
          }
        });
        downloadCsv('api-calls.csv', [headers.join(',')].concat(rows).join('\\n'));
      }

      function exportTestsCsv() {
        const headers = ['Test Name','Status','Duration (s)'];
        const rows = [];
        document.querySelectorAll('.test-item-wrapper').forEach(function(w) {
          const nameEl = w.querySelector('.test-name');
          const name = nameEl ? (nameEl.textContent.split('\\n')[0] || '').trim() : '';
          const status = w.dataset.status || '';
          const durEl = w.querySelector('.test-duration');
          const dur = durEl ? durEl.textContent.trim() : '';
          rows.push([name, status, dur.replace('s','')].map(function(v) { return '"' + v.replace(/"/g,'""') + '"'; }).join(','));
        });
        downloadCsv('test-results.csv', [headers.join(',')].concat(rows).join('\\n'));
      }

      function downloadCsv(filename, content) {
        const a = document.createElement('a');
        a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(content);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }

      function scrollToTest(slug) {
        var panel = document.getElementById('panel-results');
        if (panel && !panel.classList.contains('active')) {
          var tab = document.querySelector('[data-tab="results"]');
          if (tab) switchTab(tab, 'results');
        }
        setTimeout(function() {
          var el = document.getElementById('test-' + slug);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
      }

      // ── Status filter ──
      function filterByStatus(pill, status) {
        document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        document.querySelectorAll('.test-item-wrapper').forEach(item => {
          if (status === 'all') { item.style.display = ''; return; }
          const header = item.querySelector('.test-item-header');
          const isMatch = header && header.classList.contains(status);
          item.style.display = isMatch ? '' : 'none';
        });
      }

      // ── Sort tests ──
      function sortTests(mode) {
        const list = document.querySelector('.test-list');
        if (!list) return;
        const items = Array.from(list.querySelectorAll('.test-item-wrapper'));
        items.sort((a, b) => {
          if (mode === 'name') {
            const na = (a.querySelector('.test-name') || {}).textContent || '';
            const nb = (b.querySelector('.test-name') || {}).textContent || '';
            return na.localeCompare(nb);
          }
          if (mode === 'duration') {
            const da = parseFloat((a.querySelector('.test-duration') || {}).textContent) || 0;
            const db = parseFloat((b.querySelector('.test-duration') || {}).textContent) || 0;
            return db - da;
          }
          if (mode === 'status') {
            const sa = (a.querySelector('.test-item-header.failed')) ? 0 : 1;
            const sb = (b.querySelector('.test-item-header.failed')) ? 0 : 1;
            return sa - sb;
          }
          // order — use original DOM order attribute
          const oa = parseInt(a.dataset.order) || 0;
          const ob = parseInt(b.dataset.order) || 0;
          return oa - ob;
        });
        items.forEach(item => list.appendChild(item));
      }

      function toggleTestDetails(header) {
        const details = header.nextElementSibling;
        const icon = header.querySelector('.test-expand-icon');
        
        details.classList.toggle('expanded');
        icon.classList.toggle('expanded');
      }
      
      function toggleStepDetails(stepId) {
        const detailsRow = document.getElementById(stepId + '-details');
        const nestedContainerRow = document.getElementById(stepId + '-nested-container');
        const stepRow = document.getElementById(stepId);
        if (!stepRow) return;
        
        const link = stepRow.querySelector('.cmd-step-toggle');
        const isCurrentlyExpanded = link && link.classList.contains('expanded');
        
        // Toggle details row if it exists (script output)
        if (detailsRow) {
          detailsRow.style.display = isCurrentlyExpanded ? 'none' : 'table-row';
        }
        
        // Toggle nested container visibility for runFlow commands
        if (nestedContainerRow) {
          nestedContainerRow.style.display = isCurrentlyExpanded ? 'none' : 'table-row';
        }
        
        // Toggle expanded class on link
        if (link) {
          link.classList.toggle('expanded');
        }
      }
      
      // Toggle setup steps visibility (Define variables, Run script for screens, Apply config, Wait for animation)
      function toggleSetupSteps(checkbox, tableId) {
        const table = document.getElementById(tableId);
        if (!table) return;
        
        const setupSteps = table.querySelectorAll('tr[data-step-type="setup"]');
        setupSteps.forEach(row => {
          row.style.display = checkbox.checked ? 'table-row' : 'none';
        });
        
        // Renumber all visible steps sequentially (1, 2, 3...)
        const allStepRows = table.querySelectorAll('tbody tr:not(.cmd-details-row):not(.cmd-nested-container-row)');
        let visibleCount = 0;
        allStepRows.forEach(row => {
          // Check both inline style and computed style
          const inlineDisplay = row.style.display;
          const computedDisplay = window.getComputedStyle(row).display;
          if (inlineDisplay !== 'none' && computedDisplay !== 'none') {
            visibleCount++;
            const seqCell = row.querySelector('.cmd-seq');
            if (seqCell) {
              seqCell.textContent = visibleCount;
            }
          }
        });
      }
      
      function toggleSection(header) {
        const section = header.closest('.pulse-section, .api-calls-section, .video-section');
        const body = section.querySelector('.section-collapsible-body');
        const icon = header.querySelector('.section-toggle-icon');
        
        if (body.style.display === 'none' || !body.style.display) {
          body.style.display = 'block';
          icon.textContent = '▼';
        } else {
          body.style.display = 'none';
          icon.textContent = '▶';
        }
      }
      
      // Initialize step numbering on page load (setup steps hidden by default)
      function initializeStepNumbering() {
        // Renumber all test timelines with setup steps hidden
        document.querySelectorAll('.cmd-timeline-details').forEach(timeline => {
          const tableId = timeline.id;
          const allStepRows = timeline.querySelectorAll('tbody tr:not(.cmd-details-row):not(.cmd-nested-container-row)');
          let visibleCount = 0;
          allStepRows.forEach(row => {
            // Check computed style to respect CSS display: none
            const computedDisplay = window.getComputedStyle(row).display;
            if (computedDisplay !== 'none') {
              visibleCount++;
              const seqCell = row.querySelector('.cmd-seq');
              if (seqCell) {
                seqCell.textContent = visibleCount;
              }
            }
          });
        });
      }
      
      // Run on DOMContentLoaded
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
          initializeStepNumbering();
          collapsePassingTests();
        });
      } else {
        // If DOM is already loaded, run immediately
        initializeStepNumbering();
        collapsePassingTests();
      }

      // Also run after a small delay to ensure all styles are applied
      setTimeout(function() { initializeStepNumbering(); collapsePassingTests(); }, 100);
      
      // Resizable table columns
      document.addEventListener('DOMContentLoaded', function() {
        const table = document.getElementById('apiCallsTable');
        if (!table) return;
        
        const cols = table.querySelectorAll('th');
        
        cols.forEach((col, index) => {
          const resizer = col.querySelector('.resizer');
          if (!resizer) return;
          
          let startX, startWidth;
          
          resizer.addEventListener('mousedown', function(e) {
            startX = e.pageX;
            startWidth = col.offsetWidth;
            
            document.addEventListener('mousemove', resize);
            document.addEventListener('mouseup', stopResize);
            
            e.preventDefault();
          });
          
          function resize(e) {
            const width = startWidth + (e.pageX - startX);
            col.style.width = width + 'px';
          }
          
          function stopResize() {
            document.removeEventListener('mousemove', resize);
            document.removeEventListener('mouseup', stopResize);
          }
        });
      });

      // --- Pulse accordion helpers ---

      function togglePulseScreen(header) {
        const panel   = header.closest('.pulse-screen-panel');
        const body    = panel.querySelector('.pulse-screen-body');
        const chevron = header.querySelector('.pulse-screen-chevron');
        body.classList.toggle('expanded');
        chevron.classList.toggle('expanded');
      }

      function expandAllPulse() {
        document.querySelectorAll('.pulse-screen-body').forEach((b) => b.classList.add('expanded'));
        document.querySelectorAll('.pulse-screen-chevron').forEach((c) => c.classList.add('expanded'));
      }

      function collapseAllPulse() {
        document.querySelectorAll('.pulse-screen-body').forEach((b) => b.classList.remove('expanded'));
        document.querySelectorAll('.pulse-screen-chevron').forEach((c) => c.classList.remove('expanded'));
      }

      function filterPulse(btn, severity) {
        // Update active button
        document.querySelectorAll('.pulse-filter-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');

        // Show/hide rows across all open screen tables
        document.querySelectorAll('.pulse-screen-table tr[data-sev]').forEach((row) => {
          if (severity === 'all' || row.dataset.sev === severity) {
            row.classList.remove('hidden');
          } else {
            row.classList.add('hidden');
          }
        });
      }

      // --- A11y section accordion helpers (scoped to .a11y-section) ---

      function expandAllA11y() {
        document.querySelectorAll('.a11y-section .pulse-screen-body').forEach((b) => b.classList.add('expanded'));
        document.querySelectorAll('.a11y-section .pulse-screen-chevron').forEach((c) => c.classList.add('expanded'));
      }

      function collapseAllA11y() {
        document.querySelectorAll('.a11y-section .pulse-screen-body').forEach((b) => b.classList.remove('expanded'));
        document.querySelectorAll('.a11y-section .pulse-screen-chevron').forEach((c) => c.classList.remove('expanded'));
      }
      
      function openScreenshotModal(imageSrc, imageName, isDataUri) {
        const src = isDataUri ? imageSrc : \`file://\${imageSrc}\`;
        const modal = document.createElement('div');
        modal.className = 'screenshot-modal active';
        modal.innerHTML = \`
          <div class="screenshot-modal-content">
            <button class="screenshot-modal-close">×</button>
            <img class="screenshot-modal-image" src="\${src}" alt="\${imageName}">
          </div>
        \`;
        document.body.appendChild(modal);

        // Lock page scroll so background content cannot slide over the fixed overlay
        document.body.style.overflow = 'hidden';

        function closeModal() {
          modal.remove();
          document.body.style.overflow = '';
          document.removeEventListener('keydown', keyHandler);
        }

        // Close button
        modal.querySelector('.screenshot-modal-close').addEventListener('click', closeModal);

        // Close on backdrop click (not on content)
        modal.addEventListener('click', function(e) {
          if (e.target === modal) closeModal();
        });

        // Close on Escape
        function keyHandler(e) {
          if (e.key === 'Escape') closeModal();
        }
        document.addEventListener('keydown', keyHandler);
      }

    // ── Sidebar resize ──────────────────────────────────────────
    (function() {
      var resizer = document.getElementById('sidebarResizer');
      var sidebar = document.querySelector('.app-sidebar');
      if (!resizer || !sidebar) return;
      var startX, startW;
      resizer.addEventListener('mousedown', function(e) {
        startX = e.clientX;
        startW = sidebar.getBoundingClientRect().width;
        resizer.classList.add('dragging');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        e.preventDefault();
      });
      document.addEventListener('mousemove', function(e) {
        if (!resizer.classList.contains('dragging')) return;
        var newW = Math.max(180, Math.min(600, startW + (e.clientX - startX)));
        sidebar.style.width = newW + 'px';
      });
      document.addEventListener('mouseup', function() {
        resizer.classList.remove('dragging');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      });
    })();
    </script>
    
    ${VIDEO_EXISTS ? `
    <div class="video-section">
      <div class="section-toggle-header" onclick="toggleSection(this)">
        <span class="section-toggle-icon expanded">▶</span>
        <h2>📹 Test Recording</h2>
      </div>
      <div class="section-collapsible-body expanded">
        <video class="test-video" controls preload="metadata">
          <source src="file://${VIDEO_FILE}" type="video/mp4">
          Your browser does not support the video element.
        </video>
        <p class="video-path">${VIDEO_FILE}</p>
      </div>
    </div>
    ` : ''}

    ${apiCallsData && apiCallsData.summary && apiCallsData.summary.totalCalls > 0 ? `
    <div class="api-calls-section">
      <div class="section-toggle-header" onclick="toggleSection(this)">
        <h2>
          <span class="section-toggle-icon">▼</span>
          🌐 Native API Calls
        </h2>
      </div>
      <div class="section-collapsible-body" style="display: block;">
        <div class="api-calls-summary">
          <div class="api-summary-card">
            <div class="api-summary-number">${apiCallsData.summary.totalCalls || 0}</div>
            <div class="api-summary-label">Total Calls</div>
          </div>
          <div class="api-summary-card success">
            <div class="api-summary-number">${apiCallsData.summary.successfulCalls || 0}</div>
            <div class="api-summary-label">Successful</div>
          </div>
          <div class="api-summary-card error">
            <div class="api-summary-number">${apiCallsData.summary.failedCalls || 0}</div>
            <div class="api-summary-label">Failed</div>
          </div>
          <div class="api-summary-card">
            <div class="api-summary-number">${apiCallsData.summary.avgResponseTime || 0}ms</div>
            <div class="api-summary-label">Avg Response</div>
          </div>
        </div>
        ${apiCallsData.calls && apiCallsData.calls.length > 0 ? `
        <div class="filter-bar" style="padding: 12px 28px 0;">
          <input type="text" id="apiFilter" placeholder="Filter by URL or method..." oninput="filterApiCalls(this.value)">
          <span class="filter-count" id="apiFilterCount"></span>
          <button onclick="exportApiCsv()" class="export-btn">⬇ Export CSV</button>
        </div>
        <div class="api-calls-table-wrap">
          <table class="api-calls-table" id="apiCallsTable">
            <colgroup>
              <col style="width: 80px">
              <col>
              <col style="width: 90px">
              <col style="width: 110px">
              <col style="width: 90px">
            </colgroup>
            <thead>
              <tr>
                <th>Method</th>
                <th>API Endpoint URL</th>
                <th>Status</th>
                <th>Response Time</th>
                <th>Time</th>
              </tr>
            </thead>
            <tbody>
              ${apiCallsData.calls.map(call => {
                const methodClass = call.method ? call.method.toLowerCase() : 'get';
                const isFailed = call.status >= 400;
                const statusClass = call.status >= 200 && call.status < 300 ? 'success' :
                                   call.status >= 400 ? 'error' : 'warning';
                const displayTime = call.timestamp ? (call.timestamp.split(' ')[1] || '') : '';
                const rt = call.responseTime || 0;
                const speedClass = rt >= 8000 ? 'api-very-slow' : rt >= 3000 ? 'api-slow' : '';
                const baseClass = isFailed ? 'failed-call' : 'success-call';
                const trClass = speedClass ? `${baseClass} ${speedClass}` : baseClass;
                return `
                  <tr class="${trClass}">
                    <td><span class="api-method ${methodClass}">${call.method || 'HTTP'}</span></td>
                    <td class="api-url" title="${call.url || call.endpoint || 'N/A'}">${call.url || call.endpoint || 'N/A'}</td>
                    <td><span class="api-status ${statusClass}">${call.status || 'N/A'}</span></td>
                    <td><span class="api-rt">${call.responseTime ? call.responseTime + 'ms' : 'N/A'}</span></td>
                    <td style="font-size: 10px; color: #94a3b8; white-space: nowrap;">${displayTime}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
        ` : ''}
      </div>
    </div>
    ` : ''}
    
    ${figmaDiffData && figmaDiffData.results && figmaDiffData.results.length > 0 && figmaDiffModule
      ? figmaDiffModule.buildFigmaDiffHtml(figmaDiffData, REPORT_DIR)
      : ''}

    <div class="footer">
      <p>Generated on ${new Date().toLocaleString()} • Maestro Test Report</p>
    </div>
      </main>
    </div><!-- /app-body -->
  </div><!-- /container -->
</body>
</html>`;

// Write HTML report
try {
  fs.writeFileSync(REPORT_FILE, html, 'utf8');
  //console.log(`✓ Report generated: ${REPORT_FILE}`);
} catch (error) {
  console.error(`Failed to write report: ${error.message}`);
  process.exit(1);
}

// When --a11y is active, also write a standalone accessibility-report.html
if (RUN_A11Y && a11yData && a11yData.screens && a11yData.screens.length > 0) {
  try {
    const a11yReportPath = path.join(REPORT_DIR, 'accessibility-report.html');
    const a11yHtml = buildStandaloneA11yHtml(a11yData);
    if (a11yHtml) {
      fs.writeFileSync(a11yReportPath, a11yHtml, 'utf8');
      console.log(`\u2713 Accessibility report: ${a11yReportPath}`);
    }
  } catch (_) {}
}

// When --pulse is active, also write a standalone pulse-report.html
if (RUN_PULSE && pulseData && pulseData.screens && pulseData.screens.length > 0) {
  try {
    const pulseReportPath = path.join(REPORT_DIR, 'pulse-report.html');
    const pulseHtml = buildStandalonePulseHtml(pulseData);
    if (pulseHtml) {
      fs.writeFileSync(pulseReportPath, pulseHtml, 'utf8');
      console.log(`\u2713 Pulse report: ${pulseReportPath}`);
    }
  } catch (_) {}
}

// Export test results as JSON for programmatic access
try {
  const jsonExport = {
    metadata: {
      generatedAt: new Date().toISOString(),
      platform: PLATFORM,
      reportFile: path.basename(REPORT_FILE),
      totalDuration: totalDurationSec,
      totalDurationFormatted,
    },
    summary: {
      total: summary.total,
      passed: summary.passed,
      failed: summary.failed,
      skipped: skippedCount,
      passRate: passPercentage,
    },
    ciMetadata: ciMetadata || null,
    tests: results.tests.map(test => ({
      name: test.name,
      status: test.status,
      duration: test.duration,
      failureReason: test.failureReason || null,
      tags: test.tags || [],
    })),
    failureAnalysis: failureReport ? {
      totalFailures: failureReport.totalFailures,
      categories: Object.keys(failureReport.categories).map(cat => ({
        name: cat,
        count: failureReport.categories[cat].count,
        severity: failureReport.categories[cat].severity,
      })),
      patterns: failureReport.patterns,
      recommendations: failureReport.recommendations,
    } : null,
    mlAnalysis: mlReport ? {
      predictions: mlReport.predictions ? {
        summary: mlReport.predictions.summary,
        highRiskTests: mlReport.predictions.predictions.filter(p => p.prediction === 'high_risk').map(p => p.testName),
        recommendations: mlReport.predictions.recommendations,
      } : null,
      rootCauseAnalysis: mlReport.rootCauseAnalysis ? mlReport.rootCauseAnalysis.map(rc => ({
        testName: rc.testName,
        rootCause: rc.rootCause,
        confidence: rc.confidence,
      })) : null,
      flakyTests: mlReport.flakyTests ? mlReport.flakyTests.map(t => ({
        name: t.name,
        flakiness: t.flakiness,
        failureRate: t.failureRate,
      })) : null,
      insights: mlReport.insights,
    } : null,
    performance: performanceData ? {
      duration: performanceData.duration,
      memory: performanceData.memory,
      cpu: performanceData.cpu,
      battery: performanceData.battery,
      samples: performanceData.samples,
    } : null,
    apiCalls: apiCallsData ? {
      summary: apiCallsData.summary,
      totalCalls: apiCallsData.calls ? apiCallsData.calls.length : 0,
    } : null,
    pulse: pulseData ? {
      totalChecked: pulseData.totalChecked,
      totalViolations: pulseData.violations ? pulseData.violations.length : 0,
    } : null,
    accessibility: a11yData ? {
      totalChecked: a11yData.totalChecked,
      totalViolations: a11yData.violations ? a11yData.violations.length : 0,
    } : null,
  };
  
  const jsonPath = REPORT_FILE.replace('.html', '.json');
  fs.writeFileSync(jsonPath, JSON.stringify(jsonExport, null, 2), 'utf8');
  //console.log(`\u2713 JSON export: ${jsonPath}`);
} catch (e) {
  // Non-critical, don't fail if JSON export fails
}
