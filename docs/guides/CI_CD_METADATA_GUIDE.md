# CI/CD Metadata Integration Guide

## Overview

The Maestro test framework now automatically captures CI/CD context for every test run, providing full traceability from code commit to test execution.

## Features

### Automatic Detection

The metadata collector automatically detects:
- ✅ Git repository information
- ✅ CI/CD provider (Jenkins, GitLab, GitHub Actions, etc.)
- ✅ Build context (number, job name, URL)
- ✅ Pull Request information
- ✅ Environment details
- ✅ System information

### Zero Configuration

No setup required! The collector:
- Runs automatically before each test
- Detects CI environment variables
- Falls back to local Git commands
- Never blocks test execution

## What Gets Captured

### Git Information
```json
{
  "commit": "57905333db4baebbabc46bc81544aa57d1dca11a",
  "commitShort": "5790533",
  "branch": "main",
  "author": "John Doe",
  "message": "Fix login flow",
  "commitDate": "2026-04-28 10:30:00 -0500",
  "tag": "v1.2.3",
  "remoteUrl": "https://github.com/org/repo.git"
}
```

### CI/CD Context
```json
{
  "provider": "GitHub Actions",
  "buildNumber": "123",
  "jobName": "iOS Tests",
  "buildUrl": "https://github.com/org/repo/actions/runs/123",
  "trigger": "Pull Request",
  "triggeredBy": "john.doe"
}
```

### Pull Request Data
```json
{
  "number": "456",
  "title": "Add new feature",
  "sourceBranch": "feature/new-feature",
  "targetBranch": "main"
}
```

### Environment
```json
{
  "name": "QA",
  "platform": "ios",
  "appVersion": "2.1.0",
  "buildType": "Debug"
}
```

## Usage

### View in HTML Report

1. Run any test:
   ```bash
   bash scripts/testing/test.sh .maestro/flows/Account/H100_ACCT_TC001_dashboardNavigation.yaml
   ```

2. Open the HTML report

3. Look for the **"CI/CD Context"** section below the metadata grid

4. Click **"View Build →"** link to jump to CI build logs (if available)

### Access JSON Data

```bash
# Run test
bash scripts/testing/test.sh .maestro/flows/Account/H100_ACCT_TC001_dashboardNavigation.yaml

# View CI metadata
cat test-reports/IOS_*/ci-metadata.json | jq .

# View full JSON export
cat test-reports/IOS_*/test-report-*.json | jq .ciMetadata
```

### Standalone Collection

```bash
# Collect metadata to custom location
node scripts/utils/ci-metadata-collector.js /path/to/output.json

# Print to console
node scripts/utils/ci-metadata-collector.js /tmp/metadata.json --print
```

## CI/CD Integration

### GitHub Actions

```yaml
name: iOS Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Run Maestro Tests
        env:
          ENVIRONMENT: QA
          APP_VERSION: ${{ github.ref_name }}
        run: |
          bash scripts/testing/test.sh .maestro/flows/suites/smoke-suite.yaml
```

**Automatically Captured:**
- ✅ Git commit, branch, author
- ✅ Build number (`GITHUB_RUN_NUMBER`)
- ✅ Job name (`GITHUB_JOB`)
- ✅ Build URL (constructed from `GITHUB_SERVER_URL`)
- ✅ PR number (`GITHUB_PR_NUMBER`)
- ✅ Trigger type (push/PR/schedule)

### Jenkins

```groovy
pipeline {
    agent any
    
    environment {
        ENVIRONMENT = 'QA'
        APP_VERSION = "${env.BUILD_NUMBER}"
    }
    
    stages {
        stage('Test') {
            steps {
                sh 'bash scripts/testing/test.sh .maestro/flows/suites/smoke-suite.yaml'
            }
        }
    }
}
```

**Automatically Captured:**
- ✅ Git commit, branch, author
- ✅ Build number (`BUILD_NUMBER`)
- ✅ Job name (`JOB_NAME`)
- ✅ Build URL (`BUILD_URL`)
- ✅ Triggered by (`BUILD_USER`)
- ✅ Trigger cause (`BUILD_CAUSE`)

### GitLab CI

```yaml
test:
  stage: test
  script:
    - bash scripts/testing/test.sh .maestro/flows/suites/smoke-suite.yaml
  variables:
    ENVIRONMENT: QA
    APP_VERSION: $CI_COMMIT_TAG
```

**Automatically Captured:**
- ✅ Git commit, branch, author
- ✅ Build number (`CI_BUILD_NUMBER`)
- ✅ Job name (`CI_JOB_NAME`)
- ✅ Pipeline URL (`CI_PIPELINE_URL`)
- ✅ MR number (`CI_MERGE_REQUEST_IID`)
- ✅ Trigger source (`CI_PIPELINE_SOURCE`)

## Custom Environment Variables

### Override Detection

```bash
# Set custom environment
export ENVIRONMENT=STAGING
export APP_VERSION=2.1.0-beta
export BUILD_TYPE=Release

# Run test
bash scripts/testing/test.sh .maestro/flows/Account/H100_ACCT_TC001_dashboardNavigation.yaml
```

### Supported Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `ENVIRONMENT` | Environment name | `QA`, `STAGING`, `PROD` |
| `APP_VERSION` | Application version | `2.1.0`, `v1.2.3-beta` |
| `BUILD_TYPE` | Build configuration | `Debug`, `Release` |
| `TEST_SUITE` | Test suite name | `smoke`, `regression` |
| `PLATFORM` | Platform override | `ios`, `android` |

## Troubleshooting

### No CI Metadata in Report

**Check:**
1. Is Node.js installed? `node --version`
2. Is the collector script present? `ls scripts/utils/ci-metadata-collector.js`
3. Check test.sh output for collection status

**Debug:**
```bash
# Test collector manually
node scripts/utils/ci-metadata-collector.js /tmp/test.json --print

# Check if file was created
ls -la test-reports/IOS_*/ci-metadata.json
```

### Missing Git Information

**Possible Causes:**
- Not in a Git repository
- Git not installed
- Detached HEAD state

**Fix:**
```bash
# Verify Git is available
git --version

# Check repository status
git status

# Ensure you're on a branch
git checkout main
```

### CI Provider Not Detected

**Check Environment Variables:**
```bash
# List all CI-related variables
env | grep -E 'BUILD|CI|GITHUB|GITLAB|JENKINS'
```

**Manual Override:**
```bash
export BUILD_NUMBER=123
export JOB_NAME="iOS Tests"
export BUILD_URL="https://ci.example.com/job/123"
```

## Best Practices

### 1. Set Environment Variables in CI

Always set these in your CI pipeline:
```bash
export ENVIRONMENT=QA
export APP_VERSION=${VERSION}
export BUILD_TYPE=Release
```

### 2. Use Semantic Versioning

```bash
export APP_VERSION=$(git describe --tags --abbrev=0)
```

### 3. Link to Requirements

Include ticket/story numbers in commit messages:
```bash
git commit -m "JIRA-123: Fix login flow"
```

### 4. Tag Releases

```bash
git tag -a v1.2.3 -m "Release 1.2.3"
git push origin v1.2.3
```

## Advanced Usage

### Custom Metadata

Extend the collector for custom fields:

```javascript
// scripts/utils/ci-metadata-collector.js
const metadata = collectMetadata();

// Add custom fields
metadata.custom = {
  releaseCandidate: process.env.RC_VERSION,
  deploymentTarget: process.env.DEPLOY_TARGET,
  testPlan: process.env.TEST_PLAN_ID,
};

saveMetadata(outputPath);
```

### Programmatic Access

```javascript
const { loadMetadata } = require('./scripts/utils/ci-metadata-collector');

const metadata = loadMetadata('./test-reports/IOS_*/ci-metadata.json');

console.log(`Testing commit: ${metadata.git.commitShort}`);
console.log(`On branch: ${metadata.git.branch}`);
console.log(`Build #: ${metadata.ci.buildNumber}`);
```

### Integration with External Tools

```bash
# Send to Slack
METADATA=$(cat test-reports/IOS_*/ci-metadata.json)
curl -X POST https://hooks.slack.com/... \
  -d "Test completed for commit $(echo $METADATA | jq -r .git.commitShort)"

# Update JIRA
COMMIT=$(cat test-reports/IOS_*/ci-metadata.json | jq -r .git.commit)
curl -X POST https://jira.example.com/api/... \
  -d "{\"commit\": \"$COMMIT\", \"status\": \"tested\"}"
```

## Examples

### Local Development

```bash
# Run test locally
bash scripts/testing/test.sh .maestro/flows/Account/H100_ACCT_TC001_dashboardNavigation.yaml

# Metadata shows:
# - Provider: Local
# - Trigger: Manual
# - Git info from local repository
```

### CI/CD Pipeline

```bash
# Run in GitHub Actions
# Metadata automatically includes:
# - Provider: GitHub Actions
# - Build #: 123
# - PR #: 456
# - Commit, branch, author
# - Build URL (clickable link)
```

### Pull Request

```bash
# PR from feature branch to main
# Metadata shows:
# - Source: feature/new-feature
# - Target: main
# - PR #: 456
# - PR Title: "Add new feature"
```

## FAQ

**Q: Does this slow down tests?**  
A: No! Collection takes <100ms and runs in parallel with test setup.

**Q: What if Git is not available?**  
A: The collector gracefully falls back to environment variables only.

**Q: Can I disable metadata collection?**  
A: Yes, but not recommended. It's non-blocking and provides valuable context.

**Q: Is sensitive data captured?**  
A: No. Only public Git info and CI metadata. No credentials or secrets.

**Q: Can I customize what's collected?**  
A: Yes! Edit `scripts/utils/ci-metadata-collector.js` to add custom fields.

## Support

For issues or feature requests:
1. Check this guide
2. Review `ci-metadata.json` in report directory
3. Test collector standalone: `node scripts/utils/ci-metadata-collector.js /tmp/test.json --print`
4. Check test.sh output for collection status

---

**Last Updated:** April 28, 2026  
**Version:** 1.0.0  
**Status:** Production Ready ✅
