# Zephyr Scale Integration Scripts

Automated integration between Maestro UI tests and Zephyr Scale test management.

## Scripts Overview

### Core Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `zephyr-scale-client.js` | API client for Zephyr Scale | Used by other scripts |
| `zephyr-config.js` | Configuration settings | Edit to customize behavior |
| `create-test-cycle.js` | Create test cycles | `node create-test-cycle.js --name "..." --environment "QA"` |
| `upload-test-results.js` | Upload test results | `node upload-test-results.js --results ... --cycle-key ...` |
| `sync-test-cases.js` | Sync test cases | `node sync-test-cases.js --push` |
| `generate-report-url.js` | Generate report URLs | `node generate-report-url.js --platform circleci --job-id 123` |
| `format-cycle-summary.js` | Format cycle summaries | Used by upload-test-results.js |

### Configuration Files

| File | Purpose |
|------|---------|
| `test-case-mapper.json` | Maps Maestro test IDs to Zephyr keys |
| `../../.maestro/config/zephyr-credentials.js` | Credentials loader |

## Quick Start

### 1. Configure Credentials

```bash
export ZEPHYR_API_TOKEN="your-token"
export ZEPHYR_PROJECT_KEY="TLPCWHSAM"
```

### 2. Test Connection

```bash
node zephyr-scale-client.js
```

### 3. Sync Test Cases

```bash
node sync-test-cases.js --push
```

### 4. Create Cycle & Upload Results

```bash
# Create cycle
CYCLE_KEY=$(node create-test-cycle.js --name "Test Run" --environment "QA")

# Upload results
node upload-test-results.js \
  --results ../../../test-reports/IOS_*/results.xml \
  --cycle-key "$CYCLE_KEY" \
  --platform "iOS"
```

## Environment Variables

Required:
- `ZEPHYR_API_TOKEN` - API token from Zephyr Scale
- `ZEPHYR_PROJECT_KEY` - Project key (default: TLPCWHSAM)

Optional:
- `ZEPHYR_BASE_URL` - API base URL (default: https://api.zephyrscale.smartbear.com/v2)
- `JIRA_BASE_URL` - JIRA base URL (default: https://cvsdigital.atlassian.net)

## Documentation

See [ZEPHYR_SCALE_INTEGRATION.md](../../../docs/guides/ZEPHYR_SCALE_INTEGRATION.md) for complete documentation.

## Folder Structure in Zephyr

```
TLPCWHSAM/
├── Manual/          (Existing manual tests)
└── Automated/       (Maestro tests)
    ├── Account/
    ├── Benefits/
    ├── HAIO/
    └── ...
```

## CI/CD Integration

### CircleCI

```yaml
- run:
    name: Upload to Zephyr
    command: |
      REPORT_URL=$(node scripts/integrations/zephyr/generate-report-url.js \
        --platform circleci --job-id $CIRCLE_BUILD_NUM)
      CYCLE_KEY=$(node scripts/integrations/zephyr/create-test-cycle.js \
        --name "Build $CIRCLE_BUILD_NUM" --report-url "$REPORT_URL")
      node scripts/integrations/zephyr/upload-test-results.js \
        --results test-reports/*/results.xml \
        --cycle-key "$CYCLE_KEY" \
        --report-url "$REPORT_URL"
```

## Troubleshooting

**401 Unauthorized:**
- Check `ZEPHYR_API_TOKEN` is set correctly
- Verify token hasn't expired

**429 Rate Limit:**
- Scripts auto-retry with backoff
- Reduce concurrent requests if persistent

**Test case not found:**
- Run `sync-test-cases.js --push` first
- Or let upload script auto-create test cases

## Support

For detailed help, see [ZEPHYR_SCALE_INTEGRATION.md](../../../docs/guides/ZEPHYR_SCALE_INTEGRATION.md)
