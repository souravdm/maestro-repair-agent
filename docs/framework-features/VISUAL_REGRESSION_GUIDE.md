# Visual Regression Testing Guide

## Table of Contents

1. [Overview](#overview)
2. [What is Visual Regression Testing](#what-is-visual-regression-testing)
3. [Approaches](#approaches)
4. [Figma-Backed Regression](#figma-backed-regression)
5. [Component-Level Screenshot Baseline](#component-level-screenshot-baseline)
6. [CI/CD Integration](#cicd-integration)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)
9. [Advanced Features](#advanced-features)
10. [Maintenance](#maintenance)

---

## Overview

Visual regression testing ensures that Pulse components maintain consistent appearance across updates. This framework supports two complementary approaches: Figma-backed regression (comparing against live design files) and component-level screenshot baselines (comparing against previously captured golden screenshots).

## What is Visual Regression Testing?

Visual regression testing automatically compares screenshots of UI components across different versions to detect unintended visual changes.

### Benefits
- **Catch Visual Bugs**: Detect unintended design changes
- **Prevent Regressions**: Ensure updates don't break existing designs
- **Design Validation**: Verify design token implementation
- **Cross-Platform Consistency**: Ensure iOS and Android look consistent
- **Theme Validation**: Verify light and dark mode consistency

---

## Approaches

This framework supports three complementary visual regression approaches:

| Approach | Best For | Baseline Source | Script |
|---|---|---|---|
| **Figma-backed regression** | Full-screen design fidelity | Live Figma design files | `--figma-diff` |
| **Component-level screenshot baseline** | Fine-grained component states (focused, disabled, error) | Previously captured app screenshots | `figma-baseline-sync.js` |
| **Native screenshot comparison** | Any test, no Figma required, works offline | Screenshots captured by `scripts/testing/test.sh` | `scripts/visual-regression/compare.sh` |

All three can run independently or together. The sections below cover each in detail.

---

## Native Screenshot Comparison (compare.sh)

The simplest approach — no Figma account, no extra config. Captures screenshots from a normal `scripts/testing/test.sh` run and diffs them against a stored baseline.

### Requirements

```bash
# Recommended (PSNR comparison — catches small regressions)
brew install imagemagick

# Without ImageMagick: falls back to MD5 hash (any pixel change = regression)
```

### Workflow

```bash
# 1. Run a test (screenshots are captured automatically)
bash scripts/testing/test.sh .maestro/flows/Account/login-and-logout.yaml

# 2. Approve those screenshots as the visual baseline
bash scripts/visual-regression/compare.sh approve login-and-logout

# 3. After future runs, check for visual regressions
bash scripts/visual-regression/compare.sh check login-and-logout

# 4. Check all tests with approved baselines at once
bash scripts/visual-regression/compare.sh check-all

# 5. List all tests with baselines
bash scripts/visual-regression/compare.sh list
```

### Storage

- **Baselines**: `.maestro/visual-baselines/<test-name>/` — commit these to version control
- **Diffs**: `test-reports/<run>/visual-diffs/<test-name>/` — ephemeral, excluded from git

### Comparison method

| ImageMagick available? | Method | Threshold |
|---|---|---|
| Yes | PSNR (Peak Signal-to-Noise Ratio) | PSNR < 30 = regression |
| No | MD5 hash | Any pixel change = regression |

Override threshold with `DIFF_THRESHOLD=<pct>` env var.

---

---

## Figma-Backed Regression

Validate the running app's appearance directly against live Figma design files using pixel-level comparison. Baselines come from the designer's source of truth -- no manually captured "golden" screenshots needed.

### How It Works

```
figma-mapping.json
      |
      v
figma-baseline-sync.js  --(HTTP/Figma API)-->  Figma Cloud
      |                                          (returns PNG URLs)
      |  saves PNGs
      v
visual-regression-baselines/figma/*.png
      |
      v
figma-visual-diff.js   --(pixelmatch)-->  diff image + %
      |
      v
generate-unified-report.js  -->  Figma Visual Diff section in HTML report
```

1. `figma-baseline-sync.js` calls `GET /v1/images/{fileKey}?ids={nodeId}&format=png&scale=2` and downloads the PNG.
2. `figma-visual-diff.js` loads each PNG pair, runs `pixelmatch`, and writes a diff image to `test-reports/<run>/figma-diffs/`.
3. The HTML report embeds all three images per screen (Figma | App | Diff) with pass/fail badges.

**Why Figma as the baseline?**

- **Single source of truth** -- baselines always reflect the actual design intent, not a previously captured app state.
- **No baseline drift** -- re-sync whenever a design is updated.
- **Side-by-side in report** -- Figma design, app screenshot, and pixel diff rendered together in the HTML report.

### Figma Prerequisites

#### 1. npm packages

Already declared in `package.json`:

```bash
npm install   # installs pixelmatch and pngjs
```

#### 2. Figma Personal Access Token

Generate one at **figma.com -> Settings -> Personal access tokens**.

```bash
# Set in your shell (do not hardcode in any file)
export FIGMA_ACCESS_TOKEN=figd_xxxxxxxxxxxxxxxx
```

Add to `~/.zshrc` for persistence:

```bash
echo 'export FIGMA_ACCESS_TOKEN=figd_xxxxxxxxxxxxxxxx' >> ~/.zshrc
source ~/.zshrc
```

#### 3. figma-mapping.json populated

See [Configuring figma-mapping.json](#configuring-figma-mappingjson) below.

### Figma Quick Start

```bash
# 1. Add your Figma token
export FIGMA_ACCESS_TOKEN=figd_xxxxxxxxxxxxxxxx

# 2. Open figma-mapping.json and fill in fileKey + nodeId for each screen

# 3. Sync baselines from Figma
node scripts/utils/figma-baseline-sync.js

# 4. Run tests with visual diff
./scripts/testing/test.sh .maestro/flows/Account/login-and-logout.yaml --figma-diff
```

The HTML report will contain a **Figma Visual Diff** section.

### Configuring figma-mapping.json

`figma-mapping.json` lives at the project root. It maps logical screen names to Figma design nodes.

#### Anatomy

```json
{
  "_readme": ["...instructions..."],
  "defaults": {
    "scale": 2,
    "diffThreshold": 0.1,
    "maxDiffPercent": 5.0
  },
  "screens": {
    "login": {
      "fileKey": "AbCdEfGhIjKl",
      "nodeId": "1:23",
      "description": "Login / sign-in screen",
      "screenshotKey": "login"
    }
  }
}
```

#### Finding fileKey and nodeId

**fileKey** -- extract from the Figma URL:
```
https://www.figma.com/design/<fileKey>/Project-Name?...
                              ^^^^^^^^^
```

**nodeId** -- right-click the frame in Figma -> **Copy link**. The URL contains `node-id=1-234`. Convert dashes to colons: `1-234` -> `1:234`.

```
https://www.figma.com/design/AbCdEfGhIjKl/...?node-id=1-234
                                                        ^----
                                                     Use "1:234"
```

#### screenshotKey

The `screenshotKey` is matched (case-insensitively, partial match) against filenames in `test-reports/<run>/screenshots/`. Set it to a unique substring that appears in the screenshot filename for that screen.

#### Per-screen overrides

Any `defaults` key can be overridden per screen:

```json
"login": {
  "fileKey": "AbCdEfGhIjKl",
  "nodeId": "1:23",
  "diffThreshold": 0.15,
  "maxDiffPercent": 8.0
}
```

### Syncing Figma Baselines

```bash
# Sync all configured screens
FIGMA_ACCESS_TOKEN=<token> node scripts/utils/figma-baseline-sync.js

# Custom mapping or output path
FIGMA_ACCESS_TOKEN=<token> node scripts/utils/figma-baseline-sync.js \
  --mapping figma-mapping.json \
  --output  visual-regression-baselines/figma \
  --scale   2
```

Baselines are saved to `visual-regression-baselines/figma/<screen-name>.png`.

**When to re-sync:**
- After any design is updated in Figma
- When adding new screen entries to `figma-mapping.json`
- As part of a CI job that runs before the test suite

**What the sync script does:**

1. Reads every `screens` entry in `figma-mapping.json`.
2. Skips entries where `fileKey` or `nodeId` is empty.
3. Calls Figma REST API with your access token to get a presigned PNG URL.
4. Downloads the PNG and saves it as `<screen-name>.png`.
5. Exits with code `1` if any screen fails (for CI fail-fast).

### Running with --figma-diff

Pass `--figma-diff` to any test invocation:

```bash
# Single test
./scripts/testing/test.sh .maestro/flows/Benefits/Spending/test_stcob_plan_spending.yaml \
  --figma-diff

# Multiple flags together
./scripts/testing/test.sh .maestro/flows/Account/login-and-logout.yaml \
  --figma-diff --pulse --a11y

# Android
PLATFORM=android ./scripts/testing/test.sh .maestro/flows/Account/login-and-logout.yaml \
  --figma-diff
```

Diff images are written to `test-reports/<run>/figma-diffs/`.

### Reading the Figma Report

The **Figma Visual Diff** section appears in `test-report-*.html` after the API Calls section.

#### Badge meanings

| Badge | Meaning |
|---|---|
| MATCH | Pixel diff <= `maxDiffPercent` -- screen looks correct |
| DIFF | Pixel diff > `maxDiffPercent` -- visual regression detected |
| SIZE MISMATCH | Figma PNG and app screenshot have different dimensions |
| NO BASELINE | Baseline not yet synced for this screen |
| NO SCREENSHOT | No matching screenshot found in the test report |
| SKIPPED | `fileKey` / `nodeId` not configured, or deps missing |
| ERROR | Unexpected error reading PNGs |

#### Three-column layout

| Column | Content |
|---|---|
| Figma Design | Baseline PNG downloaded from Figma |
| App Screenshot | Screenshot captured by Maestro during the test run |
| Diff | Red-highlighted pixel differences (from pixelmatch) |

Each row also shows the **diff percentage** and **pixel count**.

### Figma Configuration Reference

#### figma-mapping.json defaults

| Key | Type | Default | Description |
|---|---|---|---|
| `scale` | number | `2` | Figma export scale (use `2` for @2x, `3` for @3x) |
| `diffThreshold` | number | `0.1` | Per-pixel tolerance passed to pixelmatch (0-1) |
| `maxDiffPercent` | number | `5.0` | Maximum diff % before status becomes `DIFF` |

#### CLI flags

**`figma-baseline-sync.js`**

| Flag | Description |
|---|---|
| `--mapping <path>` | Path to `figma-mapping.json` (default: project root) |
| `--output <dir>` | Baseline output directory (default: `visual-regression-baselines/figma`) |
| `--scale <n>` | Override export scale for all screens |

**`figma-visual-diff.js` (standalone)**

```bash
node scripts/reporting/figma-visual-diff.js <report-dir>
```

Exits `1` if any screen has status `DIFF` or `SIZE_MISMATCH`.

### Scale and Size Matching

Figma designs are exported at a chosen scale (default `2` = @2x). iOS simulators typically capture screenshots at @2x as well. If you see `SIZE_MISMATCH`:

1. Check your simulator's display scale: `xcrun simctl list | grep -i booted`
2. Adjust `scale` in `figma-mapping.json` to match:
   - Most iPhone simulators -> `scale: 2` or `scale: 3` (ProMotion)
   - Android pixel densities vary -- check your emulator's `dpi` setting

A `SIZE_MISMATCH` is non-blocking in the report but does not produce a diff image.

### Figma File Reference

| File | Description |
|---|---|
| `figma-mapping.json` | Screen -> Figma node mapping (project root) |
| `scripts/utils/figma-baseline-sync.js` | Downloads Figma PNGs as baselines |
| `scripts/reporting/figma-visual-diff.js` | Runs pixel comparison, builds HTML section |
| `visual-regression-baselines/figma/` | Saved Figma baseline PNGs |
| `test-reports/<run>/figma-diffs/` | Per-screen diff images from each test run |

---

## Component-Level Screenshot Baseline

Capture baseline screenshots of individual Pulse components, then compare on each run. This approach is useful for fine-grained component state coverage (focused, disabled, error states, etc.) where full-screen Figma frames don't exist.

### Setup

#### 1. Initialize Visual Regression Framework

```bash
node scripts/visual-regression-setup.js
```

This creates:
- Baseline screenshot directories
- Configuration files
- Comparison scripts
- Documentation

#### 2. Directory Structure

```
project-root/
├── visual-regression-baselines/
│   ├── buttons/
│   ├── forms/
│   ├── cards/
│   ├── lists/
│   ├── navigation/
│   ├── modals/
│   ├── accessibility/
│   ├── design-tokens/
│   └── manifest.json
├── test-reports/
│   ├── PLATFORM_YYYYMMDD_HHMMSS/
│   │   ├── screenshots/
│   │   ├── visual-regression-results/
│   │   │   ├── baseline/
│   │   │   ├── current/
│   │   │   ├── diff/
│   │   │   └── report.html
```

### Baseline Screenshots

#### Naming Convention

```
{component}_{state}_{variant}_{theme}.png
```

#### Examples

**Buttons**
- `primary_button_default_light.png`
- `primary_button_focused_light.png`
- `primary_button_pressed_light.png`
- `primary_button_disabled_light.png`
- `primary_button_default_dark.png`

**Forms**
- `textfield_default_light.png`
- `textfield_focused_light.png`
- `textfield_filled_light.png`
- `textfield_error_light.png`
- `dropdown_default_light.png`
- `dropdown_open_light.png`

**Cards**
- `card_default_light.png`
- `expandable_card_collapsed_light.png`
- `expandable_card_expanded_light.png`

#### States

| State | Description |
|-------|-------------|
| **default** | Initial/normal state |
| **focused** | Keyboard focus state |
| **pressed** | Pressed/active state |
| **disabled** | Disabled state |
| **loading** | Loading state |
| **error** | Error state |
| **filled** | Filled with content |
| **open** | Expanded/open state |
| **closed** | Collapsed/closed state |

#### Themes

- **light**: Light mode (default)
- **dark**: Dark mode

### Running Component-Level Tests

#### Capture Baseline Screenshots

```bash
# Capture all baselines
npm run test:visual-regression:capture

# Capture specific component
npm run test:visual-regression:capture -- buttons

# Capture specific platform
PLATFORM=ios npm run test:visual-regression:capture
```

#### Compare Against Baselines

```bash
# Run visual regression tests
npm run test:visual-regression

# Run with verbose output
npm run test:visual-regression -- --verbose

# Generate detailed report
npm run test:visual-regression -- --report
```

#### Update Baselines

```bash
# Update all baselines
npm run test:visual-regression:update

# Update specific component
npm run test:visual-regression:update -- buttons

# Update after approved design changes
npm run test:visual-regression:update -- --approved
```

### Component-Level Configuration

#### visual-regression-config.json

```json
{
  "baseline": {
    "directory": "visual-regression-baselines",
    "platforms": ["ios", "android"],
    "themes": ["light", "dark"]
  },
  "comparison": {
    "threshold": 0.01,
    "ignoreAreas": [
      {
        "name": "timestamp",
        "x": 0,
        "y": 0,
        "width": 100,
        "height": 20
      }
    ]
  },
  "components": {
    "buttons": {
      "states": ["default", "focused", "pressed", "disabled"],
      "variants": ["primary", "secondary", "tertiary"]
    }
  }
}
```

#### Threshold

Default pixel difference threshold: **1%**. Screenshots with differences > 1% are flagged as failures.

#### Ignore Areas

Certain areas are automatically ignored:
- Timestamps
- Dynamic content
- Animations
- Transient UI elements

### Component-Level Report

The visual regression report includes:
- Summary statistics (passed/failed)
- Side-by-side baseline and current screenshots
- Difference highlighting
- Detailed metrics

**Report location:**

```
test-reports/PLATFORM_YYYYMMDD_HHMMSS/visual-regression-results/report.html
```

### Component-Level Workflow

#### 1. Initial Setup

```bash
node scripts/visual-regression-setup.js
npm run test:visual-regression:capture
```

#### 2. Development

```bash
npm run test:visual-regression
open test-reports/PLATFORM_YYYYMMDD_HHMMSS/visual-regression-results/report.html
```

#### 3. Design Changes

```bash
# After design approval
npm run test:visual-regression:capture
npm run test:visual-regression:update
npm run test:visual-regression
```

---

## CI/CD Integration

### Figma-backed regression in CI

```yaml
# GitHub Actions example
- name: Sync Figma baselines
  env:
    FIGMA_ACCESS_TOKEN: ${{ secrets.FIGMA_ACCESS_TOKEN }}
  run: node scripts/utils/figma-baseline-sync.js

- name: Run tests with visual diff
  run: ./scripts/testing/test.sh .maestro/flows/... --figma-diff
```

**Important:** Store `FIGMA_ACCESS_TOKEN` as a CI secret -- never commit it to the repository.

#### Cache Figma baselines between runs

```yaml
- uses: actions/cache@v3
  with:
    path: visual-regression-baselines/figma
    key: figma-baselines-${{ hashFiles('figma-mapping.json') }}
```

This avoids hitting the Figma API on every CI run; baselines are only refreshed when `figma-mapping.json` changes.

### Component-level regression in CI

```yaml
# CircleCI example
- run:
    name: Visual Regression Tests
    command: npm run test:visual-regression

- store_artifacts:
    path: test-reports/visual-regression-results
    destination: visual-regression
```

---

## Best Practices

### Baseline Management

- Capture baselines on consistent device/simulator
- Use consistent test data
- Review all baseline changes before committing
- Document why baselines changed
- Do not update baselines without review

### Screenshot Quality

- Use high-quality screenshots
- Ensure consistent lighting/rendering conditions
- Test on multiple devices
- Include all component states
- Do not include transient content

### Threshold Management

- Use appropriate thresholds (1% for component-level, 5% for Figma full-screen)
- Adjust for platform differences
- Document threshold changes
- Do not set thresholds too high

### Ignore Areas

- Ignore dynamic content (timestamps, user names)
- Ignore animations
- Document ignored areas
- Do not ignore important content

---

## Troubleshooting

### Figma-Specific Issues

**`FIGMA_ACCESS_TOKEN env var is required`**

Set the token before running:
```bash
export FIGMA_ACCESS_TOKEN=figd_xxxxxxxxxxxxxxxx
```

**`No image URL returned by Figma`**

- Verify `fileKey` and `nodeId` are correct.
- Ensure your token has access to the Figma file.
- Confirm `nodeId` uses colons, not dashes (`1:23` not `1-23`).

**`pixelmatch / pngjs not installed`**

```bash
npm install
```

**All screens show `NO_BASELINE`**

Baselines haven't been synced yet:
```bash
FIGMA_ACCESS_TOKEN=<token> node scripts/utils/figma-baseline-sync.js
```

**All screens show `NO_SCREENSHOT`**

Check that `screenshotKey` in `figma-mapping.json` matches a substring of the screenshot filename. Run `ls test-reports/<latest>/screenshots/` to see actual filenames.

**`SIZE_MISMATCH` for all screens**

The Figma scale doesn't match the simulator's pixel ratio. Adjust `scale` in `figma-mapping.json` -- usually `2` for standard Retina, `3` for Pro/Max models.

**Diff % is unexpectedly high despite correct design**

Common causes:
- Dynamic content (timestamps, user names) -- consider cropping or excluding those frames
- Status bar differences -- Figma frames typically omit the status bar; crop screenshots using a screen anchor below the status bar
- Font rendering anti-aliasing differences across OS versions -- raise `diffThreshold` slightly (e.g. `0.15`)

### Component-Level Issues

**Screenshots Don't Match**

1. Review differences in the report
2. Identify root cause
3. Fix component or design
4. Re-run tests

**False Positives**

1. Increase threshold slightly
2. Add area to ignore list
3. Recapture baseline on same device
4. Update baseline if change is approved

**Missing Baselines**

1. Capture baseline screenshot
2. Add to baseline directory
3. Update manifest.json
4. Re-run tests

**Platform Differences**

1. Maintain separate baselines per platform
2. Document platform-specific differences
3. Adjust threshold if needed
4. Test on actual devices

---

## Advanced Features

### Custom Comparison

```javascript
// Compare specific regions
compareRegion(baseline, current, {
  x: 100,
  y: 100,
  width: 200,
  height: 200
});
```

### Batch Processing

```bash
npm run test:visual-regression:batch -- buttons forms cards
```

### Diff Highlighting

```bash
npm run test:visual-regression -- --highlight-diff
```

---

## Maintenance

### Regular Tasks

- **Weekly**: Review visual regression reports
- **Monthly**: Update baselines for approved changes; re-sync Figma baselines if designs changed
- **Quarterly**: Audit baseline coverage; verify `figma-mapping.json` entries are current
- **Annually**: Review and optimize configuration

### Cleanup

```bash
# Remove old visual regression results
npm run clean:visual-regression

# Archive baselines
npm run archive:baselines
```

---

## Resources

- [Pixelmatch Documentation](https://github.com/mapbox/pixelmatch)
- [Resemble.js Documentation](https://resmemble.js.org/)
- [Figma REST API - Image Exports](https://www.figma.com/developers/api#get-images-endpoint)
- [Digital Pulse Design System](https://pulse.cvs.com/)
- [REPORTING_COMPLETE_GUIDE.md](REPORTING_COMPLETE_GUIDE.md) -- full report flag reference
- [PULSE_COMPLETE_GUIDE.md](PULSE_COMPLETE_GUIDE.md) -- Pulse design system structural validation

## Support

For issues or questions:

1. Check the visual regression report (component-level or Figma diff section)
2. Review baseline screenshots
3. Consult the troubleshooting section above
4. Check CI/CD logs
5. Contact the design system team
