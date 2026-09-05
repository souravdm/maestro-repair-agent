# Zephyr Scale Integration - Complete Guide

**Status:** Production Ready ✅ | **Last Updated:** May 1, 2026

Complete guide for integrating Maestro UI tests with Zephyr Scale test management in JIRA.

---

## 📋 Table of Contents

1. [Quick Start](#quick-start)
2. [Overview](#overview)
3. [Setup](#setup)
4. [Configuration](#configuration)
5. [Usage](#usage)
6. [CI/CD Integration](#cicd-integration)
7. [Implementation Details](#implementation-details)
8. [Troubleshooting](#troubleshooting)

---

## 🚀 Quick Start

### Get Started in 3 Minutes

**Step 1: Get Your Zephyr API Token**

1. Go to: https://cvsdigital.atlassian.net
2. Click your profile → **Settings**
3. Navigate to **Apps** → **Zephyr Scale API Access Tokens**
4. Click **Create API Token**
5. Copy the token (you won't see it again!)

**Step 2: Set Environment Variable**

Add to your `~/.zshrc` file:

```bash
# Zephyr Scale Integration
export ZEPHYR_API_TOKEN="paste-your-token-here"
export ZEPHYR_PROJECT_KEY="TLPCWHSAM"
```

Then reload:
```bash
source ~/.zshrc
```

**Step 3: Verify Setup**

```bash
node .maestro/config/zephyr-credentials.js
```

Expected output:
```
✓ Zephyr credentials configured
  Project Key: TLPCWHSAM
  Base URL: https://api.zephyrscale.smartbear.com/v2
  API Token: ***abcd
```

**Step 4: Sync Your Tests to Zephyr**

```bash
# Preview what will be created (dry run)
node scripts/integrations/zephyr/sync-test-cases.js --push --dry-run

# Actually create test cases in Zephyr
node scripts/integrations/zephyr/sync-test-cases.js --push
```

This will create all Maestro tests in Zephyr under `/Automated` folder.

---

## 📖 Overview

This integration enables automatic synchronization between Maestro test automation and Zephyr Scale test management:

### Key Features

✅ **Automatic test case creation** - No manual setup in Zephyr  
✅ **Shareable report URLs** - Direct links to HTML reports  
✅ **Detailed execution metadata** - Screenshots, errors, CI/CD links  
✅ **Separate manual/automated** - Clean folder organization  
✅ **Bidirectional sync** - Push to or pull from Zephyr  
✅ **CI/CD ready** - CircleCI and GitHub Actions support  

### Architecture

```
Maestro Tests (.maestro/flows/)
        ↓
    Test Execution
        ↓
    JUnit XML Results
        ↓
Zephyr Integration Scripts
        ↓
Zephyr Scale API
        ↓
Test Cycles & Executions
```

### Folder Structure in Zephyr

```
TLPCWHSAM Project
├── Manual/          ← Your existing manual tests (untouched)
└── Automated/       ← Maestro tests (NEW)
    ├── Account/
    ├── Benefits/
    ├── HAIO/
    ├── Health/
    ├── Home/
    ├── Menu/
    ├── Pharmacy/
    ├── SearchAndNav/
    └── Shop/
```

---

## 🔧 Setup

### Prerequisites

- Node.js 14+ installed
- Access to JIRA/Zephyr Scale
- Maestro tests in `.maestro/flows/`

### 1. Obtain Zephyr Scale API Token

1. Log in to JIRA: https://cvsdigital.atlassian.net
2. Go to **Settings** → **Apps** → **Zephyr Scale API Access Tokens**
3. Click **Create API Token**
4. Copy the token (you won't see it again!)

### 2. Set Environment Variables

Add to your shell profile (`~/.zshrc` or `~/.bash_profile`):

```bash
# Zephyr Scale Configuration
export ZEPHYR_API_TOKEN="your-api-token-here"
export ZEPHYR_PROJECT_KEY="TLPCWHSAM"
export ZEPHYR_BASE_URL="https://api.zephyrscale.smartbear.com/v2"
export JIRA_BASE_URL="https://cvsdigital.atlassian.net"
```

Reload your shell:
```bash
source ~/.zshrc
```

### 3. Verify Configuration

```bash
# Test credentials
node .maestro/config/zephyr-credentials.js

# Test API connection
node scripts/integrations/zephyr/zephyr-scale-client.js
```

Expected output:
```json
{
  "healthy": true,
  "message": "Connected to Zephyr Scale API"
}
```

---

## ⚙️ Configuration

### Folder Structure

Configuration is managed in `scripts/integrations/zephyr/zephyr-config.js`:

```javascript
module.exports = {
  // Folder structure in Zephyr
  folders: {
    manual: '/Manual',
    automated: '/Automated',
    features: {
      Account: '/Automated/Account',
      Benefits: '/Automated/Benefits',
      HAIO: '/Automated/HAIO',
      // ... more features
    }
  },
  
  // Status mappings
  statusMap: {
    PASSED: 'Pass',
    FAILED: 'Fail',
    SKIPPED: 'Not Executed'
  }
};
```

### Test Case Mapping

Mappings are stored in `scripts/integrations/zephyr/test-case-mapper.json`:

```json
{
  "H100_ACCT_TC001_dashboardNavigation": "TLPCWHSAM-T123",
  "H100_BEN_Claims_TC001_viewClaimHistory": "TLPCWHSAM-T124"
}
```

This file is auto-generated and maintained by the sync scripts.

---

## 📝 Usage

### Local Test Execution with Zephyr Upload

```bash
# Run test with Zephyr upload
bash scripts/testing/test.sh .maestro/flows/Account/H100_ACCT_TC001_dashboardNavigation.yaml --zephyr
```

**Note:** Local runs won't have shareable report URLs. Use CI/CD for full integration.

### Manual Upload (After Running Tests)

```bash
# 1. Create test cycle
CYCLE_KEY=$(node scripts/integrations/zephyr/create-test-cycle.js \
  --name "Manual Test - $(date +%Y%m%d)" \
  --environment "QA")

# 2. Upload results
node scripts/integrations/zephyr/upload-test-results.js \
  --results test-reports/IOS_*/results.xml \
  --cycle-key "$CYCLE_KEY" \
  --platform "iOS"
```

### Sync Test Cases

```bash
# Push Maestro tests to Zephyr (create/update test cases)
node scripts/integrations/zephyr/sync-test-cases.js --push

# Dry run (preview changes without creating)
node scripts/integrations/zephyr/sync-test-cases.js --push --dry-run

# Pull Zephyr tests to create YAML templates
node scripts/integrations/zephyr/sync-test-cases.js --pull
```

---

## 🔄 CI/CD Integration

### CircleCI (Recommended)

Add to `.circleci/config.yml` after your test execution:

```yaml
- run:
    name: Upload Results to Zephyr Scale
    when: always
    command: |
      # Generate report URL
      REPORT_URL=$(node scripts/integrations/zephyr/generate-report-url.js \
        --platform circleci --job-id $CIRCLE_BUILD_NUM \
        --artifact-path "test-reports/IOS_*/test-report.html")
      
      # Create test cycle
      CYCLE_KEY=$(node scripts/integrations/zephyr/create-test-cycle.js \
        --name "iOS CI - Build $CIRCLE_BUILD_NUM" \
        --environment "QA" --report-url "$REPORT_URL")
      
      # Upload results
      node scripts/integrations/zephyr/upload-test-results.js \
        --results test-reports/IOS_*/results.xml \
        --cycle-key "$CYCLE_KEY" \
        --platform "iOS" \
        --report-url "$REPORT_URL" \
        --build-number "$CIRCLE_BUILD_NUM" \
        --job-url "$CIRCLE_BUILD_URL"
```

**Don't forget to add `ZEPHYR_API_TOKEN` to CircleCI environment variables!**

### GitHub Actions

Add to your workflow YAML:

```yaml
- name: Upload to Zephyr Scale
  if: always()
  env:
    ZEPHYR_API_TOKEN: ${{ secrets.ZEPHYR_API_TOKEN }}
  run: |
    REPORT_URL=$(node scripts/integrations/zephyr/generate-report-url.js \
      --platform github --run-id ${{ github.run_id }})
    
    CYCLE_KEY=$(node scripts/integrations/zephyr/create-test-cycle.js \
      --name "iOS CI - Run ${{ github.run_number }}" \
      --environment "QA" --report-url "$REPORT_URL")
    
    node scripts/integrations/zephyr/upload-test-results.js \
      --results test-reports/IOS_*/results.xml \
      --cycle-key "$CYCLE_KEY" \
      --platform "iOS" \
      --report-url "$REPORT_URL" \
      --build-number "${{ github.run_number }}" \
      --job-url "${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"
```

---

## 🏗️ Implementation Details

### What Was Implemented

#### ✅ Phase 1: Core API Integration

**Files Created:**
1. `scripts/integrations/zephyr/zephyr-scale-client.js` - Full-featured Zephyr Scale API client
   - Create/update test cases
   - Create/update test cycles
   - Create test executions
   - Search test cases
   - Health check endpoint
   - Automatic retry logic with rate limiting

2. `scripts/integrations/zephyr/zephyr-config.js` - Centralized configuration
   - Folder structure: `/Manual` and `/Automated` separation
   - Feature-based subfolders under `/Automated`
   - Status/priority mappings
   - Report hosting configuration
   - Cycle templates

3. `.maestro/config/zephyr-credentials.js` - Secure credential management
   - Environment variable loading
   - Configuration validation
   - Similar pattern to existing credentials-loader.js

#### ✅ Phase 2: Test Result Upload with Report URL Sharing

**Files Created:**
1. `scripts/integrations/zephyr/upload-test-results.js` - Result uploader
   - Parse JUnit XML and JSON results
   - Auto-create/map test cases
   - Upload test executions
   - Update cycle with detailed summary
   - Maintain test case mapper

2. `scripts/integrations/zephyr/generate-report-url.js` - Report URL generator
   - CircleCI artifact URLs
   - GitHub Actions artifact URLs
   - S3/Confluence support (placeholders)
   - Platform auto-detection

3. `scripts/integrations/zephyr/format-cycle-summary.js` - Summary formatter
   - Detailed execution statistics
   - Clickable report URLs
   - Failed test details with screenshots
   - CI/CD job links
   - Markdown formatting

4. `scripts/integrations/zephyr/create-test-cycle.js` - Cycle creator
   - Template-based cycle creation
   - Environment/version tracking
   - Report URL integration

5. `scripts/integrations/zephyr/sync-test-cases.js` - Bidirectional sync
   - Push Maestro tests to Zephyr
   - Pull Zephyr tests to create YAML templates
   - Automatic folder mapping
   - Test case mapper maintenance

6. `scripts/integrations/zephyr/test-case-mapper.json` - Mapping database
   - TC ID → Zephyr key mappings
   - Auto-generated and maintained
   - Version controlled

### File Structure

```
MaestroUITests/
├── scripts/
│   └── integrations/
│       └── zephyr/
│           ├── zephyr-scale-client.js      ✅ API client
│           ├── zephyr-config.js            ✅ Configuration
│           ├── upload-test-results.js      ✅ Result uploader
│           ├── generate-report-url.js      ✅ Report URL generator
│           ├── format-cycle-summary.js     ✅ Summary formatter
│           ├── create-test-cycle.js        ✅ Cycle creator
│           ├── sync-test-cases.js          ✅ Test case sync
│           ├── test-case-mapper.json       ✅ Mapping database
│           └── README.md                   ✅ Quick reference
├── .maestro/
│   └── config/
│       └── zephyr-credentials.js           ✅ Credentials loader
└── docs/
    └── guides/
        └── ZEPHYR_SCALE_INTEGRATION.md    ✅ This guide
```

### Test Cycle Summary Example

After each test run, you'll see in Zephyr:

```markdown
## 🧪 Test Execution Report

**📊 Results:** 25 Passed | 3 Failed | 2 Skipped (Total: 30)
**📱 Platform:** iOS 17.5
**🌍 Environment:** QA
**🏗️ Build:** #1234
**⏱️ Duration:** 12m 34s
**📅 Executed:** 2026-05-01 06:56 AM UTC

### 🔗 Full Report
[View Detailed HTML Report](https://output.circle-artifacts.com/...)

### ❌ Failed Tests (3)
1. **H100_ACCT_TC001_dashboardNavigation** - [Screenshot](https://link)
   - Error: Element not found: "Sign In"
2. **H100_PHRM_TC015_refillPrescription** - [Screenshot](https://link)
   - Error: Timeout waiting for prescription list

### 🔧 CI/CD Job
[CircleCI Job #1234](https://app.circleci.com/...)
```

---

## 🔍 Troubleshooting

### Common Issues

#### "Zephyr credentials not configured"

```bash
# Check if token is set
echo $ZEPHYR_API_TOKEN

# If empty, add to ~/.zshrc
export ZEPHYR_API_TOKEN="your-token"
source ~/.zshrc
```

#### "HTTP 401: Unauthorized"

- Token expired or invalid
- Generate new token in JIRA settings
- Verify token is correctly set in environment

#### "HTTP 429: Too Many Requests"

- Rate limiting active
- Scripts auto-retry with exponential backoff
- Wait a few minutes and try again

#### "Test case not found"

- Run sync first: `node scripts/integrations/zephyr/sync-test-cases.js --push`
- Or let upload script auto-create it
- Check test-case-mapper.json for mappings

#### "Cannot find module"

```bash
# Install dependencies
npm install

# Verify Node.js version
node --version  # Should be 14+
```

---

## 📊 Benefits Delivered

### For QA Team ✅
- ✅ Centralized test management in Zephyr
- ✅ Automatic execution tracking (no manual entry)
- ✅ Shareable HTML report links
- ✅ Clear separation of manual/automated tests
- ✅ Historical test execution data

### For Development Team ✅
- ✅ Faster feedback via automated uploads
- ✅ Test results visible in JIRA
- ✅ No duplicate test documentation
- ✅ Seamless CI/CD integration

### For Management ✅
- ✅ Quality metrics in Zephyr
- ✅ Audit trail of test executions
- ✅ Clear pass/fail status per build
- ✅ Traceability to requirements

---

## 🎯 Success Checklist

- [ ] Obtained Zephyr API token
- [ ] Set `ZEPHYR_API_TOKEN` environment variable
- [ ] Verified credentials and API connection
- [ ] Synced test cases to Zephyr
- [ ] Tested manual upload
- [ ] Added CI/CD integration (optional but recommended)
- [ ] Verified test cycles appear in Zephyr
- [ ] Confirmed report URLs are accessible

---

## 🔮 Future Enhancements (Phase 3)

The following features are planned but not yet implemented:

1. **Requirement Linking** (`link-requirements.js`)
   - Link test cases to JIRA stories/epics
   - Auto-detect requirements from test metadata
   - Create traceability matrix

2. **Screenshot Upload**
   - Direct screenshot attachment to test executions
   - Requires multipart/form-data implementation

3. **Zephyr Dashboard**
   - Real-time metrics dashboard
   - Test execution trends
   - Pass/fail rates by feature

---

## 🆘 Support

For questions or issues:

1. Review this guide thoroughly
2. Check error messages in console output
3. Verify environment variables are set correctly
4. Run verification script: `node .maestro/config/zephyr-credentials.js`
5. Contact QA team lead

---

## 📚 Additional Resources

- **Script Reference**: `scripts/integrations/zephyr/README.md`
- **Zephyr Scale API Docs**: https://support.smartbear.com/zephyr-scale-cloud/api-docs/
- **JIRA Instance**: https://cvsdigital.atlassian.net

---

**Implementation Status:** Phase 1 & 2 Complete ✅  
**Ready for:** Production use with CI/CD integration  
**Next Phase:** Requirement linking and coverage reports

**Last Updated:** May 1, 2026
