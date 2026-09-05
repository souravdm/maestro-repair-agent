# Visual Regression

Screenshot comparison for Maestro tests using ImageMagick (or MD5 fallback).

## Setup

```bash
# macOS
brew install imagemagick

# Or use without ImageMagick (MD5 hash fallback — any pixel change = regression)
```

## Workflow

```bash
# 1. Run a test to generate screenshots
bash scripts/testing/test.sh .maestro/flows/Account/login-and-logout.yaml

# 2. Approve those screenshots as the visual baseline
bash scripts/visual-regression/compare.sh approve login-and-logout

# 3. After future runs, check for visual regressions
bash scripts/visual-regression/compare.sh check login-and-logout

# 4. Check all tests with baselines at once
bash scripts/visual-regression/compare.sh check-all

# 5. List tests that have baselines
bash scripts/visual-regression/compare.sh list
```

Baselines are stored in `.maestro/visual-baselines/` — commit these to version control to share across the team. Visual diffs are written to `test-reports/<run>/visual-diffs/` alongside the report.
