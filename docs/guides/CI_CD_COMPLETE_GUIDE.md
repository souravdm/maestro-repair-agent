# CI/CD Complete Guide for Maestro UI Tests

Comprehensive guide for CI/CD pipeline integration with iOS and Android CVS app repositories using GitHub Actions and CircleCI.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Files Created](#files-created)
4. [Required GitHub Secrets](#required-github-secrets)
5. [Setup Instructions](#setup-instructions)
6. [GitHub Actions (iOS & Android)](#github-actions-ios--android)
7. [CircleCI (iOS Alternative)](#circleci-ios-alternative)
8. [Workflow Execution](#workflow-execution)
9. [Test Execution Flow](#test-execution-flow)
10. [Parallel Test Execution](#parallel-test-execution)
11. [Credential Management](#credential-management)
12. [Report Artifacts](#report-artifacts)
13. [PR Integration](#pr-integration)
14. [Slack Notifications](#slack-notifications)
15. [Performance Optimization](#performance-optimization)
16. [Troubleshooting](#troubleshooting)
17. [Maintenance](#maintenance)
18. [Best Practices](#best-practices)

---

## Overview

This guide covers CI/CD pipeline integration for Maestro UI tests with:

- **GitHub Actions**: Primary CI/CD platform for iOS and Android (all triggers manual)
- **CircleCI**: Health100 iOS only (API-triggered)
- **Parallel Execution**: Multiple simulators/emulators via `maestro-parallel-tests.yml`
- **Suite Sync**: Automated PR check ensuring workflow dropdowns match suite files on disk
- **Credential Management**: App identity from `config.env`, secrets from GHA/CircleCI
- **Report Generation**: HTML reports with CI/CD metadata

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    GitHub Actions Workflows                  │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐         ┌──────────────────┐         │
│  │  iOS Pipeline    │         │ Android Pipeline │         │
│  │                  │         │                  │         │
│  │ 1. Build App     │         │ 1. Build APK     │         │
│  │ 2. Run Tests     │         │ 2. Run Tests     │         │
│  │ 3. Generate      │         │ 3. Generate      │         │
│  │    Reports       │         │    Reports       │         │
│  └──────────────────┘         └──────────────────┘         │
│           │                            │                     │
│           └────────────┬───────────────┘                     │
│                        ▼                                     │
│              ┌──────────────────┐                           │
│              │ Publish Results  │                           │
│              │ - Artifacts      │                           │
│              │ - PR Comments    │                           │
│              │ - Slack Notify   │                           │
│              └──────────────────┘                           │
└─────────────────────────────────────────────────────────────┘
```

---

## Files Created

### GitHub Actions Workflows

All GHA workflows are triggered **manually only** (`workflow_dispatch`). There are no cron schedules or automatic push/PR triggers.

#### 1. `.github/workflows/maestro-ios-tests.yml`

**Purpose:** CVS Health iOS build and Maestro test execution

**Trigger:** Manual — `workflow_dispatch` / `workflow_call`

**Runner:** `[pcw-mac-runner, xcode-26]`

**Inputs:** `suite`, `environment` (qa/adhoc), `branch`

**Key Features:**
- JFrog CocoaPods spec authentication via Vault
- App identity sourced from `.maestro/apps/cvshealth/config.env`
- Artifact retention 30 days

---

#### 2. `.github/workflows/maestro-android-tests.yml`

**Purpose:** CVS Health + Health100 Android build and Maestro test execution

**Trigger:** Manual — `workflow_dispatch` / `workflow_call`

**Runner:** `self-hosted-large-virt` (KVM for emulator)

**Inputs:** `app` (cvshealth/health100), `test_suite`, `environment`, `branch`

**Key Features:**
- Android emulator with KVM hardware acceleration
- App identity sourced from `.maestro/apps/{flavor}/config.env`
- Gradle + JFrog credentials via secrets

---

#### 3. `.github/workflows/maestro-parallel-tests.yml`

**Purpose:** Parallel test execution across multiple simulators/emulators for both apps

**Trigger:** Manual — `workflow_dispatch`

**Runner:** platform-dependent (ios → `pcw-mac-runner`; android → `self-hosted-large-virt`)

**Inputs:** `platform` (ios/android), `cvshealth_suite`, `health100_suite`, `simulator_count`

**Key Features:**
- Distributes flows across `simulator_count` simulators/emulators via `scripts/parallel-test.sh`
- Separate suite selection per app
- App config sourced from `config.env` via `APP_FLAVOR`

---

#### 4. `.github/workflows/suite-sync-check.yml`

**Purpose:** PR check ensuring workflow suite dropdown options match `.yaml` files on disk

**Trigger:** Pull request touching `.maestro/apps/*/suites/**` or relevant workflow files

**Runner:** `ubuntu-latest`

**How it works:** Runs `scripts/check-suite-sync.sh` which diffs `options:` in workflow files against actual suite files. Exits non-zero if any check fails, blocking the PR.

---

### CircleCI Configuration

#### `.circleci/config.yml`

**Purpose:** Health100 iOS pipeline — the only app/platform combination still using CircleCI

**Trigger:** API call only (no cron schedule)

**Jobs:**
1. **lint-and-validate**: Validates YAML flows and screen objects
2. **build-and-test-ios**: Builds Health100 app and runs tests on CircleCI `macos.m1.large` (xcode 15.2.0)

---

### Documentation Files

#### `.github/CICD_SETUP_CHECKLIST.md`

Step-by-step checklist for:
- Pre-requisites verification
- GitHub secrets configuration
- File deployment to repositories
- Testing and validation
- Troubleshooting
- Success criteria

---

## Required GitHub Secrets

Add these secrets to your GitHub repository settings:

### All Repositories

```
GH_PAT                          # GitHub Personal Access Token for repo access
MAESTRO_ENCRYPTION_SALT         # Encryption salt for credential decryption
```

### iOS Repository (`cvs-app-ios`)

```
IOS_CERTIFICATE_BASE64          # Base64 encoded signing certificate
IOS_CERTIFICATE_PASSWORD        # Certificate password
IOS_PROVISIONING_PROFILE_BASE64 # Base64 encoded provisioning profile
```

### Android Repository (`cvs-app-android`)

```
ANDROID_KEYSTORE_FILE           # Path to keystore file
ANDROID_KEYSTORE_PASSWORD       # Keystore password
ANDROID_KEY_ALIAS               # Key alias
ANDROID_KEY_PASSWORD            # Key password
```

### Test Repository (`cvs-app-e2e-automation`)

```
SLACK_WEBHOOK_URL               # Slack webhook for notifications (optional)
```

---

## Setup Instructions

### 1. Add Workflows to iOS App Repository

```bash
# Clone iOS app repository
git clone https://github.com/cvshealthcorp/cvs-app-ios.git
cd cvs-app-ios

# Copy workflow files
mkdir -p .github/workflows
cp /path/to/MaestroUITests/.github/workflows/maestro-ios-tests.yml .github/workflows/

# Commit and push
git add .github/workflows/maestro-ios-tests.yml
git commit -m "Add Maestro UI test automation pipeline"
git push origin main
```

### 2. Add Workflows to Android App Repository

```bash
# Clone Android app repository
git clone https://github.com/cvshealthcorp/cvs-app-android.git
cd cvs-app-android

# Copy workflow files
mkdir -p .github/workflows
cp /path/to/MaestroUITests/.github/workflows/maestro-android-tests.yml .github/workflows/

# Commit and push
git add .github/workflows/maestro-android-tests.yml
git commit -m "Add Maestro UI test automation pipeline"
git push origin main
```

### 3. Add Scheduled Tests to Test Repository

```bash
# In the Maestro test repository
cd /path/to/MaestroUITests

# Workflow is already created in .github/workflows/
git add .github/workflows/maestro-scheduled-tests.yml
git commit -m "Add scheduled regression and smoke tests"
git push origin main
```

### 4. Configure GitHub Secrets

1. Go to repository Settings → Secrets and variables → Actions
2. Add all required secrets listed above
3. Verify secrets are accessible in workflow runs

### 5. Setup CircleCI (Optional)

1. Go to https://circleci.com/
2. Sign in with GitHub
3. Select your iOS app repository
4. Click "Set Up Project"
5. CircleCI detects `.circleci/config.yml`
6. Add environment variables in Project Settings

---

## GitHub Actions (iOS & Android)

### Manual Trigger

**iOS Tests:**
```
1. Go to Actions tab in GitHub
2. Select "Maestro UI Tests - iOS"
3. Click "Run workflow"
4. Select:
   - Branch
   - Test suite (smoke/regression/all)
   - Environment (qa/staging/prod)
5. Click "Run workflow"
```

**Android Tests:**
```
1. Go to Actions tab in GitHub
2. Select "Maestro UI Tests - Android"
3. Click "Run workflow"
4. Select:
   - Branch
   - Test suite (smoke/regression/all)
   - Environment (qa/staging/prod)
5. Click "Run workflow"
```

### CLI Trigger

```bash
# CVS Health iOS — QA smoke
gh workflow run maestro-ios-tests.yml -f suite=smoke -f environment=qa

# Android — Health100 regression
gh workflow run maestro-android-tests.yml -f app=health100 -f test_suite=regression -f environment=qa

# Parallel — both apps, 3 simulators
gh workflow run maestro-parallel-tests.yml \
  -f platform=ios \
  -f cvshealth_suite=smoke \
  -f health100_suite=smoke \
  -f simulator_count=3
```

> All triggers are manual only. There are no scheduled runs or automatic push/PR triggers.

---

## CircleCI (iOS Alternative)

### Overview

CircleCI configuration now supports **multi-app testing** for both CVS Health and Health 100 apps with feature-based parallel execution.

**Key Features:**
- ✅ **Multi-app support** - Test CVS Health and Health 100 independently or together
- ✅ **Feature-based execution** - Run tests by feature area (Account, Benefits, Health, Pharmacy, Shop)
- ✅ **Parallel execution** - Run multiple feature tests simultaneously for faster feedback
- ✅ **Video recording** - Optional video capture for debugging
- ✅ **Network capture** - Monitor API calls during test execution
- ✅ **Scheduled testing** - Nightly regression and smoke tests

**📖 Full Documentation:** See [`.circleci/README.md`](../../.circleci/README.md) for complete guide.

---

### Quick Start

#### 1. Setup CircleCI Project

1. Go to https://circleci.com/
2. Sign in with GitHub
3. Select your repository
4. Click "Set Up Project" - CircleCI auto-detects `.circleci/config.yml`

#### 2. Configure Environment Variables

Set in CircleCI Project Settings → Environment Variables:

```bash
# iOS Build Credentials
GITHUB_TOKEN="ghp_xxxxxxxxxxxx"
FASTLANE_USER="your-apple-id@cvs.com"
FASTLANE_PASSWORD="your-password"

# Test Credentials
BRAYDEN_USER="encrypted_value"
BRAYDEN_PASSWORD="encrypted_value"
BRAYDEN_OTP="999999"
BRAYDEN_DOB="09/17/1982"
```

#### 3. Trigger Test Runs

**Via CircleCI UI:**
1. Go to your project
2. Click "Trigger Pipeline"
3. Select parameters:
   - `flavor`: cvshealth, health100, or all
   - `ui-tests-by-feature`: account, benefits, health, etc.
   - `parallel-execution`: true/false
4. Click "Trigger Pipeline"

**Via API:**
```bash
# Run Account tests for CVS Health
curl -X POST \
  https://circleci.com/api/v2/project/github/your-org/MaestroUITests/pipeline \
  -H "Circle-Token: $CIRCLE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "parameters": {
      "flavor": "cvshealth",
      "ui-tests-by-feature": "account"
    }
  }'
```

---

### Configuration Parameters

#### App Selection (`flavor`)

```yaml
flavor:
  - cvshealth     # CVS Pharmacy app only
  - health100     # Health 100 app only
  - all           # Both apps
```

#### Feature Selection (`ui-tests-by-feature`)

```yaml
ui-tests-by-feature:
  - none          # No feature tests
  - account       # Account/authentication tests
  - benefits      # Benefits/insurance tests
  - health        # Health records tests
  - pharmacy      # Pharmacy tests
  - shop          # Shopping cart/checkout tests
  - smoke         # Smoke test suite
  - regression    # Regression test suite
  - all           # All tests
```

#### Execution Options

```yaml
parallel-execution: true/false      # Run features in parallel
video-recording: true/false         # Enable video capture
network-capture: true/false         # Enable network monitoring
```

---

### Workflows

#### 1. PR Validation (`pr-validation`)
**Trigger:** All pull requests  
**Jobs:** Lint and validate YAML flows, screen objects, and app configs  
**Duration:** ~2-3 minutes

#### 2. Feature Tests - CVS Health (`feature-tests-cvshealth`)
**Trigger:** API call with `flavor=cvshealth` + `ui-tests-by-feature`  
**Jobs:** Build CVS Health app → Run feature tests  
**Duration:** ~15-20 minutes per feature

#### 3. Feature Tests - Health 100 (`feature-tests-health100`)
**Trigger:** API call with `flavor=health100` + `ui-tests-by-feature`  
**Jobs:** Build Health 100 app → Run feature tests  
**Duration:** ~15-20 minutes per feature

#### 4. Parallel Feature Tests (`parallel-feature-tests`)
**Trigger:** API call with `parallel-execution=true`  
**Jobs:**
- CVS Health: Account, Benefits, Health, Pharmacy, Shop (5 parallel jobs)
- Health 100: Account, Benefits, Health (3 parallel jobs)
**Duration:** ~20-25 minutes (8 executors)

#### 5. Nightly Regression (`nightly-regression`)
**Trigger:** Scheduled (2:00 AM UTC daily)  
**Jobs:** Full regression suite for both apps  
**Duration:** ~25-30 minutes (parallel)

#### 6. Main Branch Smoke Tests (`main-branch-smoke`)
**Trigger:** Commits to `main` branch  
**Jobs:** Smoke tests for both apps  
**Duration:** ~15-20 minutes

---

### Usage Examples

**Example 1: Run Smoke Tests for Both Apps**
```bash
curl -X POST \
  https://circleci.com/api/v2/project/github/your-org/MaestroUITests/pipeline \
  -H "Circle-Token: $CIRCLE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "parameters": {
      "flavor": "all",
      "ui-tests-by-feature": "smoke"
    }
  }'
```

**Example 2: Run Parallel Tests with Video**
```bash
curl -X POST \
  https://circleci.com/api/v2/project/github/your-org/MaestroUITests/pipeline \
  -H "Circle-Token: $CIRCLE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "parameters": {
      "parallel-execution": true,
      "video-recording": true
    }
  }'
```

**Example 3: Run Benefits Tests for Health 100**
```bash
curl -X POST \
  https://circleci.com/api/v2/project/github/your-org/MaestroUITests/pipeline \
  -H "Circle-Token: $CIRCLE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "parameters": {
      "flavor": "health100",
      "ui-tests-by-feature": "benefits"
    }
  }'
```

---

### App-Specific Configuration

#### CVS Health App
```yaml
Scheme: CVSOnlineiPhone
Bundle ID: com.cvsenterpriseiphone.cvspharmacy
App Name: CVSPharmacy.app
Config: .maestro/apps/cvshealth/config.env
Suites: .maestro/apps/cvshealth/suites/
```

#### Health 100 App
```yaml
Scheme: Health100
Bundle ID: com.cvsenterpriseiphone.health100
App Name: Health100.app
Config: .maestro/apps/health100/config.env
Suites: .maestro/apps/health100/suites/
```

---

### CircleCI vs GitHub Actions

| | CircleCI | GitHub Actions |
|--|----------|----------------|
| **Apps** | Health100 iOS only | CVS Health iOS + CVS Health/Health100 Android |
| **Trigger** | API call | `workflow_dispatch` (manual) |
| **Runner** | `macos.m1.large` (xcode 15.2.0) | `pcw-mac-runner` (iOS), `self-hosted-large-virt` (Android) |
| **Parallel execution** | In-job parallel | `maestro-parallel-tests.yml` across simulators |
| **Scheduled tests** | None | None |

**Summary:** GitHub Actions is the primary CI platform covering all CVS Health tests and Health100 Android. CircleCI handles only Health100 iOS.

---

### Migration Path

To migrate from legacy CircleCI config to new multi-app config:

1. **Backup existing config:**
   ```bash
   cp .circleci/config.yml .circleci/config.yml.backup
   ```

2. **Update config.yml** with new multi-app version (already done in this framework)

3. **Test with CVS Health app first:**
   ```bash
   # Trigger CVS Health smoke tests
   curl -X POST ... -d '{"parameters": {"flavor": "cvshealth", "ui-tests-by-feature": "smoke"}}'
   ```

4. **Add Health 100 test suites** (see Multi-App Management Guide)

5. **Enable parallel execution** once both apps are validated

---

### Performance Benchmarks

**Sequential Execution (Old Config):**
- Single feature: ~15-20 minutes
- Full regression: ~60-75 minutes

**Parallel Execution (New Config):**
- All features: ~20-25 minutes (8 executors)
- Full regression: ~25-30 minutes (parallel)

**Speed Improvement:** 3x faster for full regression

**Cost Impact:**
- Sequential: $5-10 per run (single executor)
- Parallel: $40-50 per run (8 executors)
- Recommendation: Use parallel for nightly/main branch, sequential for PRs

---

### Troubleshooting

**Issue 1: App Build Fails**
```bash
# Check scheme name
# CVS Health: CVSOnlineiPhone
# Health 100: Health100

# Verify workspace path
echo $IOS_APP_PATH/IOS/CVSOnlineiPhone/CVSOnlineiPhone.xcworkspace
```

**Issue 2: Test Suite Not Found**
```bash
# Verify suite file exists
ls .maestro/apps/cvshealth/suites/
ls .maestro/apps/health100/suites/
```

**Issue 3: Simulator Boot Fails**
```bash
# List available simulators
xcrun simctl list devices available

# Create simulator if needed
xcrun simctl create maestro-test-sim "iPhone 17 Pro"
```

**Full Troubleshooting Guide:** See [`.circleci/README.md`](../../.circleci/README.md#troubleshooting)

---

### Setup CircleCI (Legacy - Deprecated)

> **⚠️ Note:** The section below describes the legacy single-app CircleCI setup. Use the multi-app configuration above instead.

<details>
<summary>Click to expand legacy setup instructions</summary>

1. Connect repository to CircleCI (https://circleci.com/)
2. Set environment variables in Project Settings:
   - `FASTLANE_USER`: Apple ID email
   - `FASTLANE_PASSWORD`: Apple ID password (app-specific)
   - `MATCH_PASSWORD`: Match certificate password
   - `REPO_URL`: iOS app repository URL
   - `SCHEME`: CVSOnlineiPhone
   - `CONFIG`: Debug
   - `SIMULATOR_DEVICE`: iPhone 15
   - `SIMULATOR_OS`: 17.0

3. Pipeline runs automatically on schedule

### Pipeline Configuration (Legacy)

The pipeline runs nightly at 2 AM UTC:

```yaml
workflows:
  nightly-ios-tests:
    triggers:
      - schedule:
          cron: "0 2 * * *"
          filters:
            branches:
              only:
                - main
    jobs:
      - lint-and-validate
      - build-and-test-ios:
          requires:
            - lint-and-validate
```

</details>

---

## Test Execution Flow

### iOS Pipeline

```
1. Checkout iOS app repository
2. Setup Xcode 15.2
3. Install CocoaPods dependencies
4. Build app for iOS Simulator
5. Create .app bundle artifact
   ↓
6. Checkout Maestro test repository
7. Download app bundle
8. Install Maestro CLI
9. Start iOS Simulator (iPhone 15 Pro)
10. Install app on simulator
11. Decrypt test credentials
12. Run Maestro tests (parallel by suite)
13. Generate HTML reports with Phase 1 enhancements
14. Upload artifacts (reports, screenshots, logs)
15. Comment on PR with results
```

### Android Pipeline

```
1. Checkout Android app repository
2. Setup JDK 17
3. Setup Android SDK
4. Build debug APK with Gradle
5. Upload APK artifact
   ↓
6. Checkout Maestro test repository
7. Download APK
8. Setup Android emulator (API 34)
9. Enable KVM for hardware acceleration
10. Start emulator
11. Install APK on emulator
12. Install Maestro CLI
13. Decrypt test credentials
14. Run Maestro tests (parallel by suite)
15. Generate HTML reports with Phase 1 enhancements
16. Upload artifacts (reports, screenshots, logs)
17. Comment on PR with results
```

---

## Parallel Test Execution

`maestro-parallel-tests.yml` distributes flows across multiple simulators/emulators concurrently via `scripts/parallel-test.sh`. Both apps (CVS Health and Health100) run their selected suites in parallel.

**Inputs:**
- `platform`: `ios` or `android`
- `cvshealth_suite`: suite name for CVS Health (e.g. `smoke`)
- `health100_suite`: suite name for Health100 (e.g. `smoke`)
- `simulator_count`: number of simulators/emulators to distribute across

**App config** is sourced from `.maestro/apps/{flavor}/config.env` via the `APP_FLAVOR` environment variable set in the workflow job.

**Local equivalent:**
```bash
bash scripts/parallel-test.sh .maestro/flows/Benefits/ --simulators 3
```

---

## Credential Management

### Decryption Process

```bash
# In workflow step
export MAESTRO_ENV="qa"
export MAESTRO_ENCRYPTION_SALT="${{ secrets.MAESTRO_ENCRYPTION_SALT }}"

# Decrypt and export credentials
eval "$(node scripts/decrypt_env.js)"

# Export to GitHub environment
echo "COMMON_USER=${COMMON_USER}" >> $GITHUB_ENV
echo "COMMON_PASSWORD=${COMMON_PASSWORD}" >> $GITHUB_ENV
echo "BRAYDEN_USER=${BRAYDEN_USER}" >> $GITHUB_ENV
echo "BRAYDEN_PASSWORD=${BRAYDEN_PASSWORD}" >> $GITHUB_ENV
```

### Credential Fallback

The pipeline automatically falls back to BRAYDEN credentials if COMMON_PASSWORD fails to decrypt:

```bash
if [ -z "$COMMON_PASSWORD" ] && [ -n "$BRAYDEN_USER" ]; then
  export COMMON_USER="${BRAYDEN_USER}"
  export COMMON_PASSWORD="${BRAYDEN_PASSWORD}"
fi
```

### Passing Credentials to Maestro

```bash
# Pass credentials via --env flags
maestro test $TEST_FILE \
  --env COMMON_USER="$COMMON_USER" \
  --env COMMON_PASSWORD="$COMMON_PASSWORD" \
  --env STATIC_OTP="$STATIC_OTP" \
  --env DOB="$DOB"
```

---

## Report Artifacts

### Generated Artifacts

**Per Test Suite:**
- `maestro-reports-{platform}-{suite}`: HTML reports, screenshots, logs
- `maestro-results-{platform}-{suite}`: JSON test results

**Combined:**
- `maestro-combined-reports-{platform}`: All reports merged

### Artifact Retention

- Test reports: 30 days
- App bundles: 7 days
- Combined reports: 30 days

### Accessing Reports

1. Go to Actions tab in GitHub
2. Click on workflow run
3. Scroll to "Artifacts" section
4. Download desired artifact
5. Extract and open HTML report

---

## PR Integration

### Automatic PR Comments

Automatic PR comments include:

```markdown
## 🧪 Maestro UI Tests - Account Tests

**Platform:** iOS 17.2
**Environment:** qa

| Status | Count |
|--------|-------|
| ✅ Passed | 15 |
| ❌ Failed | 2 |
| 📊 Total | 17 |

[View Full Report](https://github.com/cvshealthcorp/cvs-app-ios/actions/runs/123456)
```

### Status Checks

- Tests must pass before merging (configurable)
- Status shown in PR checks section
- Link to workflow run provided

---

## Slack Notifications

Scheduled test results are sent to Slack:

```
🧪 Maestro UI Test Results

Test Type: regression
Environment: qa
iOS Status: success
Android Status: success

[View Results]
```

### Setup Slack Integration

1. Create Slack webhook: https://api.slack.com/messaging/webhooks
2. Add `SLACK_WEBHOOK_URL` to GitHub Secrets
3. Workflow automatically sends notifications

---

## Performance Optimization

### iOS

- CocoaPods cache: Speeds up dependency installation
- Derived data cache: Faster builds
- Parallel test execution: 3x faster than sequential

### Android

- Gradle cache: Speeds up dependency resolution
- AVD snapshot cache: Faster emulator startup
- Hardware acceleration (KVM): 5x faster emulator
- Parallel test execution: 4x faster than sequential

### Expected Execution Times

**iOS:**
- Build: 10-15 minutes
- Test suite (parallel): 15-20 minutes
- Total: 25-35 minutes

**Android:**
- Build: 8-12 minutes
- Test suite (parallel): 20-25 minutes
- Total: 28-37 minutes

---

## Troubleshooting

### iOS Build Fails

**Issue:** Xcode build fails with signing errors

**Solution:**
1. Verify iOS signing secrets are correct
2. Check provisioning profile validity
3. Ensure certificate is not expired
4. Verify Xcode version compatibility

### Android Emulator Timeout

**Issue:** Emulator fails to start or times out

**Solution:**
1. Increase emulator timeout in workflow
2. Verify KVM is enabled
3. Check AVD cache is valid
4. Check runner resources

### Credential Decryption Fails

**Issue:** Tests show "undefined" in credential fields

**Solution:**
1. Verify `MAESTRO_ENCRYPTION_SALT` secret is set
2. Check `maestro_secrets.qa.json` is committed
3. Ensure `decrypt_env.js` is in repository
4. Verify fallback to BRAYDEN credentials works

### Test Artifacts Not Uploaded

**Issue:** Reports not available in artifacts

**Solution:**
1. Check test execution completed
2. Verify `test-reports/` directory exists
3. Ensure `upload-artifact` step runs even on failure (`if: always()`)

### CocoaPods Install Fails

**Issue:** CocoaPods dependency installation fails

**Solution:**
1. Update CocoaPods: `gem install cocoapods`
2. Clear cache: `rm -rf ~/.cocoapods`
3. Run with verbose: `pod install --verbose`

### Gradle Build Fails

**Issue:** Gradle build fails

**Solution:**
1. Check Java version (17 required)
2. Verify Gradle configuration
3. Check dependencies in build.gradle

---

## Maintenance

### Updating Maestro Version

Update `MAESTRO_VERSION` in workflow files:

```yaml
env:
  MAESTRO_VERSION: '1.38.1'  # Update this
```

### Adding New Test Suites

Add to matrix in workflow files:

```yaml
matrix:
  test_suite:
    - name: 'New Suite'
      path: '.maestro/flows/NewSuite'
      tags: 'new,smoke'
```

### Changing Test Schedule

Update cron expressions in `maestro-scheduled-tests.yml`:

```yaml
schedule:
  - cron: '0 2 * * *'  # Daily at 2 AM UTC
  - cron: '0 */4 * * *'  # Every 4 hours
```

### Customizing Repository Names

If your repository names differ, update these lines in the workflow files:

**iOS Workflow:**
```yaml
# Line 32
repository: cvshealthcorp/cvs-app-ios  # Update this

# Line 95
repository: cvshealthcorp/cvs-app-e2e-automation  # Update this
```

**Android Workflow:**
```yaml
# Line 32
repository: cvshealthcorp/cvs-app-android  # Update this

# Line 87
repository: cvshealthcorp/cvs-app-e2e-automation  # Update this
```

---

## Best Practices

1. **Always run smoke tests on PR** - Catch issues early
2. **Use parallel execution** - Faster feedback
3. **Monitor artifact storage** - Clean up old artifacts
4. **Review failed tests promptly** - Don't let failures accumulate
5. **Keep credentials secure** - Never commit unencrypted secrets
6. **Update dependencies regularly** - Maestro, Xcode, Android SDK
7. **Cache aggressively** - Speeds up builds significantly
8. **Use meaningful commit messages** - Helps track test failures
9. **Monitor build times** - Optimize slow steps
10. **Test on multiple platforms** - Ensure cross-platform compatibility

---

## Summary

### Created Files

✅ 3 GitHub Actions workflow files
✅ CircleCI configuration (optional)
✅ Comprehensive CI/CD integration documentation
✅ Step-by-step setup checklist

### Features

✅ Parallel test execution (3-4x faster)
✅ Automatic credential management
✅ Phase 1 report integration
✅ PR comments and status checks
✅ Scheduled regression tests
✅ Slack notifications
✅ Artifact management (30-day retention)
✅ iOS and Android support

### Next Steps

1. Review all created files
2. Customize repository names if needed
3. Deploy workflows to iOS and Android repos
4. Configure GitHub Secrets
5. Test workflows manually
6. Monitor first few runs
7. Optimize based on results

---

## Support

For issues or questions:
- Check workflow logs in GitHub Actions
- Review test reports in artifacts
- Consult `agents.md` for framework details
- Contact QA automation team

## References

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [CircleCI Documentation](https://circleci.com/docs/)
- [Maestro Documentation](https://maestro.mobile.dev/docs)
- [Xcode Command Line Tools](https://developer.apple.com/xcode/)
- [Android Emulator](https://developer.android.com/studio/run/emulator)
