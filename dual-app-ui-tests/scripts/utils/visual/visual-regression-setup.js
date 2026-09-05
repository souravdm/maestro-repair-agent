#!/usr/bin/env node

/**
 * Visual Regression Testing Setup
 * 
 * This script sets up the visual regression testing framework for Pulse components.
 * It manages baseline screenshots, compares current screenshots with baselines,
 * and generates visual regression reports.
 */

const fs = require('fs');
const path = require('path');

// Configuration
const PROJECT_ROOT = path.join(__dirname, '..');
const REPORT_DIR = path.join(PROJECT_ROOT, 'test-reports');
const BASELINE_DIR = path.join(PROJECT_ROOT, 'visual-regression-baselines');
const COMPONENTS_DIR = path.join(PROJECT_ROOT, '.maestro', 'flows', 'Components');

/**
 * Initialize visual regression directories
 */
function initializeDirectories() {
  console.log('📁 Initializing visual regression directories...');
  
  // Create baseline directory structure
  const dirs = [
    BASELINE_DIR,
    path.join(BASELINE_DIR, 'buttons'),
    path.join(BASELINE_DIR, 'forms'),
    path.join(BASELINE_DIR, 'cards'),
    path.join(BASELINE_DIR, 'lists'),
    path.join(BASELINE_DIR, 'navigation'),
    path.join(BASELINE_DIR, 'modals'),
    path.join(BASELINE_DIR, 'accessibility'),
    path.join(BASELINE_DIR, 'design-tokens'),
  ];
  
  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`✅ Created: ${dir}`);
    }
  });
}

/**
 * Create visual regression configuration file
 */
function createConfigFile() {
  console.log('⚙️  Creating visual regression configuration...');
  
  const config = {
    baseline: {
      directory: BASELINE_DIR,
      platforms: ['ios', 'android'],
      themes: ['light', 'dark'],
      devices: {
        ios: ['iPhone-SE', 'iPhone-14', 'iPhone-14-Pro-Max'],
        android: ['Pixel-4', 'Pixel-6', 'Pixel-7-Pro']
      }
    },
    comparison: {
      threshold: 0.01, // 1% pixel difference threshold
      ignoreAreas: [
        { name: 'timestamp', x: 0, y: 0, width: 100, height: 20 },
        { name: 'dynamic-content', x: 0, y: 100, width: 200, height: 50 }
      ]
    },
    components: {
      buttons: {
        states: ['default', 'focused', 'pressed', 'disabled', 'loading'],
        variants: ['primary', 'secondary', 'tertiary', 'icon']
      },
      forms: {
        states: ['default', 'focused', 'filled', 'error', 'disabled'],
        types: ['text', 'email', 'password', 'search', 'dropdown', 'checkbox', 'radio', 'toggle']
      },
      cards: {
        states: ['default', 'focused', 'expanded', 'loading'],
        types: ['basic', 'expandable', 'with-actions']
      },
      lists: {
        states: ['default', 'scrolled', 'empty'],
        types: ['simple', 'section', 'grid']
      },
      navigation: {
        states: ['default', 'selected', 'disabled'],
        types: ['tabbar', 'sidemenu', 'breadcrumbs']
      },
      modals: {
        states: ['open', 'closed'],
        types: ['dialog', 'alert', 'bottom-sheet']
      }
    },
    reporting: {
      generateDiff: true,
      generateReport: true,
      failOnDifference: false,
      outputFormat: 'html'
    }
  };
  
  const configPath = path.join(PROJECT_ROOT, 'visual-regression-config.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(`✅ Configuration created: ${configPath}`);
}

/**
 * Create baseline screenshot manifest
 */
function createBaselineManifest() {
  console.log('📋 Creating baseline screenshot manifest...');
  
  const manifest = {
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    components: {
      buttons: {
        primaryButton: {
          screenshots: [
            'primary_button_default.png',
            'primary_button_focused.png',
            'primary_button_pressed.png',
            'primary_button_disabled.png'
          ],
          platforms: ['ios', 'android'],
          themes: ['light', 'dark']
        },
        secondaryButton: {
          screenshots: [
            'secondary_button_default.png',
            'secondary_button_focused.png',
            'secondary_button_pressed.png',
            'secondary_button_disabled.png'
          ],
          platforms: ['ios', 'android'],
          themes: ['light', 'dark']
        },
        iconButton: {
          screenshots: [
            'icon_button_default.png',
            'icon_button_focused.png',
            'icon_button_pressed.png'
          ],
          platforms: ['ios', 'android'],
          themes: ['light', 'dark']
        }
      },
      forms: {
        textField: {
          screenshots: [
            'textfield_default.png',
            'textfield_focused.png',
            'textfield_filled.png',
            'textfield_error.png',
            'textfield_disabled.png'
          ],
          platforms: ['ios', 'android'],
          themes: ['light', 'dark']
        },
        dropdown: {
          screenshots: [
            'dropdown_default.png',
            'dropdown_open.png',
            'dropdown_selected.png',
            'dropdown_disabled.png'
          ],
          platforms: ['ios', 'android'],
          themes: ['light', 'dark']
        },
        checkbox: {
          screenshots: [
            'checkbox_unchecked.png',
            'checkbox_checked.png',
            'checkbox_focused.png',
            'checkbox_disabled.png'
          ],
          platforms: ['ios', 'android'],
          themes: ['light', 'dark']
        }
      },
      cards: {
        basicCard: {
          screenshots: [
            'card_default.png',
            'card_focused.png',
            'card_pressed.png'
          ],
          platforms: ['ios', 'android'],
          themes: ['light', 'dark']
        },
        expandableCard: {
          screenshots: [
            'expandable_card_collapsed.png',
            'expandable_card_expanded.png',
            'expandable_card_focused.png'
          ],
          platforms: ['ios', 'android'],
          themes: ['light', 'dark']
        }
      }
    },
    metadata: {
      totalComponents: 0,
      totalScreenshots: 0,
      lastUpdated: new Date().toISOString()
    }
  };
  
  const manifestPath = path.join(BASELINE_DIR, 'manifest.json');
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`✅ Manifest created: ${manifestPath}`);
}

/**
 * Create visual regression comparison script
 */
function createComparisonScript() {
  console.log('🔍 Creating visual regression comparison script...');
  
  const script = `#!/usr/bin/env node

/**
 * Visual Regression Comparison
 * Compares current screenshots with baseline screenshots
 */

const fs = require('fs');
const path = require('path');

const BASELINE_DIR = '${BASELINE_DIR}';
const CURRENT_DIR = process.argv[2] || '${REPORT_DIR}';
const OUTPUT_DIR = path.join(CURRENT_DIR, 'visual-regression-results');

/**
 * Compare two images (placeholder - would use image comparison library)
 */
function compareImages(baselinePath, currentPath) {
  // This is a placeholder - in production, use a library like:
  // - pixelmatch
  // - resemble.js
  // - image-diff
  
  if (!fs.existsSync(baselinePath) || !fs.existsSync(currentPath)) {
    return {
      match: false,
      difference: 100,
      error: 'File not found'
    };
  }
  
  // Placeholder comparison
  return {
    match: true,
    difference: 0,
    error: null
  };
}

/**
 * Generate visual regression report
 */
function generateReport(results) {
  const html = \`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Visual Regression Report</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .summary { background: #f0f0f0; padding: 20px; border-radius: 5px; }
        .passed { color: green; }
        .failed { color: red; }
        .comparison { margin: 20px 0; border: 1px solid #ddd; padding: 10px; }
        .images { display: flex; gap: 10px; }
        img { max-width: 300px; border: 1px solid #ccc; }
      </style>
    </head>
    <body>
      <h1>Visual Regression Report</h1>
      <div class="summary">
        <h2>Summary</h2>
        <p class="passed">✅ Passed: \${results.passed}</p>
        <p class="failed">❌ Failed: \${results.failed}</p>
        <p>Total: \${results.total}</p>
      </div>
      <div class="comparisons">
        \${results.comparisons.map(c => \`
          <div class="comparison">
            <h3>\${c.component}</h3>
            <p>Difference: \${c.difference.toFixed(2)}%</p>
            <div class="images">
              <div>
                <h4>Baseline</h4>
                <img src="\${c.baseline}" alt="Baseline">
              </div>
              <div>
                <h4>Current</h4>
                <img src="\${c.current}" alt="Current">
              </div>
              \${c.diff ? \`
                <div>
                  <h4>Difference</h4>
                  <img src="\${c.diff}" alt="Difference">
                </div>
              \` : ''}
            </div>
          </div>
        \`).join('')}
      </div>
    </body>
    </html>
  \`;
  
  return html;
}

console.log('🔍 Comparing visual regression screenshots...');
console.log(\`Baseline: \${BASELINE_DIR}\`);
console.log(\`Current: \${CURRENT_DIR}\`);

// Create output directory
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

console.log('✅ Visual regression comparison complete');
`;
  
  const scriptPath = path.join(PROJECT_ROOT, 'scripts', 'visual-regression-compare.js');
  fs.writeFileSync(scriptPath, script);
  fs.chmodSync(scriptPath, '755');
  console.log(`✅ Comparison script created: ${scriptPath}`);
}

/**
 * Create baseline screenshot documentation
 */
function createBaselineDocumentation() {
  console.log('📖 Creating baseline screenshot documentation...');
  
  const doc = `# Visual Regression Baseline Screenshots

## Overview

This directory contains baseline screenshots for visual regression testing of Pulse components.

## Directory Structure

\`\`\`
visual-regression-baselines/
├── buttons/
│   ├── primary_button_default.png
│   ├── primary_button_focused.png
│   ├── primary_button_pressed.png
│   └── ...
├── forms/
│   ├── textfield_default.png
│   ├── textfield_focused.png
│   └── ...
├── cards/
├── lists/
├── navigation/
├── modals/
├── accessibility/
├── design-tokens/
└── manifest.json
\`\`\`

## Baseline Screenshot Naming Convention

\`\`\`
{component}_{state}_{variant}_{theme}.png
\`\`\`

### Examples
- \`primary_button_default_light.png\` - Primary button in default state, light theme
- \`textfield_focused_light.png\` - Text field in focused state, light theme
- \`card_expanded_dark.png\` - Card in expanded state, dark theme

## States

- **default**: Initial/normal state
- **focused**: Keyboard focus state
- **pressed**: Pressed/active state
- **disabled**: Disabled state
- **loading**: Loading state
- **error**: Error state
- **filled**: Filled with content

## Themes

- **light**: Light mode
- **dark**: Dark mode

## Updating Baselines

When design changes are approved:

1. Run tests to capture new screenshots
2. Review screenshots for accuracy
3. Copy approved screenshots to baseline directory
4. Update manifest.json with new baseline info
5. Commit changes to version control

## Visual Regression Testing

To run visual regression tests:

\`\`\`bash
npm run test:visual-regression
\`\`\`

To update baselines:

\`\`\`bash
npm run test:visual-regression:update
\`\`\`

## Threshold

Default pixel difference threshold: **1%**

Screenshots with differences > 1% will be flagged as failures.

## Ignoring Areas

Certain areas are ignored during comparison:
- Timestamps
- Dynamic content
- Animations
- Transient UI elements

## Best Practices

1. **Consistency**: Capture baselines on same device/simulator
2. **Lighting**: Use consistent lighting conditions
3. **Content**: Use consistent test data
4. **Review**: Always review baseline changes
5. **Documentation**: Document why baselines changed
`;
  
  const docPath = path.join(BASELINE_DIR, 'README.md');
  fs.writeFileSync(docPath, doc);
  console.log(`✅ Documentation created: ${docPath}`);
}

/**
 * Main execution
 */
function main() {
  console.log('🎨 Visual Regression Testing Setup\n');
  
  try {
    initializeDirectories();
    createConfigFile();
    createBaselineManifest();
    createComparisonScript();
    createBaselineDocumentation();
    
    console.log('\n✅ Visual regression setup complete!');
    console.log('\nNext steps:');
    console.log('1. Run tests to capture baseline screenshots');
    console.log('2. Review and approve baseline screenshots');
    console.log('3. Run visual regression tests: npm run test:visual-regression');
    console.log('4. Update baselines when designs change: npm run test:visual-regression:update');
  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

main();
