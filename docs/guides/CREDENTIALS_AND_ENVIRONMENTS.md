# Credentials and Environment Configuration

Complete guide for how credentials flow from `build_config.yaml` through to test execution, covering multi-app and multi-environment testing.

## Overview

The framework automatically selects credentials based on the build configuration. The flow is:

1. `build_config.yaml` defines the app (`bundle_id`) and build type (`configuration`)
2. `scripts/testing/test.sh` reads the config, maps it to an environment, and exports variables
3. Maestro receives `APP_ID`, `ENVIRONMENT`, and `BUILD_CONFIG` via `--env` flags
4. `credentials-loader.js` detects the environment and loads the correct user data
5. Tests access credentials via `${output.user.email}`, `${output.user.password}`, etc.

No manual credential management is needed -- `scripts/testing/test.sh` handles everything automatically.

## Complete Flow Diagram

```
build_config.yaml
    |
    | (test.sh reads bundle_id and configuration)
    |
    +---> APP_ID exported (from bundle_id)
    +---> BUILD_CONFIG determines ENVIRONMENT (debug=qa, release=prod)
             |
          test.sh exports:
             - APP_ID
             - ENVIRONMENT
             - BUILD_CONFIG
                |
             Passes to Maestro via --env flags:
                --env APP_ID=$APP_ID
                --env ENVIRONMENT=$ENVIRONMENT
                --env BUILD_CONFIG=$BUILD_CONFIG
                   |
                credentials-loader.js receives env vars:
                   - Detects environment from BUILD_CONFIG or ENVIRONMENT
                   - Loads QA or PROD user data
                   - Returns user object based on loginData parameter
                      |
                   Test flow uses:
                      ${output.user.email}
                      ${output.user.password}
                      ${output.user.dob}
```

## Build Configuration Mapping

The system maps build configurations to credential environments:

| Build Config | Environment | Credentials File     | Use Case                      |
|--------------|-------------|----------------------|-------------------------------|
| `debug`      | `qa`        | `credentials.qa.js`  | Local development, QA testing |
| `adhoc`      | `prod`      | `credentials.prod.js`| Ad-hoc testing, staging       |
| `alpha`      | `prod`      | `credentials.prod.js`| Alpha testing, pre-release    |
| `release`    | `prod`      | `credentials.prod.js`| Production release testing    |

All non-debug build configs use `credentials.prod.js`. Usernames remain the same across builds, but passwords and other fields may differ between QA and Prod.

### Detection Order

The build configuration is detected in this priority:

1. **Explicit override** -- `BUILD_CONFIG` environment variable (highest priority)
2. **Config file** -- `configuration` field in `build_config.yaml`
3. **Default** -- Falls back to `debug` (QA credentials)

## Configuration Files

### build_config.yaml (Single Source of Truth)

```yaml
# Global settings
branch: "main"
configuration: "Debug"  # Debug = QA, Release = PROD

# iOS Configuration
ios:
  scheme: "CVSOnlineiPhone"          # App to build
  bundle_id: "com.cvsenterpriseiphone.cvspharmacy"  # APP_ID

# Android Configuration
android:
  repo_url: "..."
  gradle_module: "app"
  build_variant: "debug"  # or adhoc, alpha, release
  app_id: "com.cvs.launchers.cvs"
```

This file controls which app to build (`scheme`), which app to test (`bundle_id` becomes `APP_ID`), and which credentials to use (`configuration` determines `ENVIRONMENT`).

### credentials-loader.js (Environment Detection)

Located at `.maestro/config/credentials-loader.js`. Detects the environment and returns user data:

```javascript
function detectEnvironment() {
    const buildConfig = (process.env.BUILD_CONFIG || '').toLowerCase();
    if (buildConfig === 'debug') return 'qa';
    if (['adhoc', 'alpha', 'release'].includes(buildConfig)) return 'prod';

    const env = (process.env.ENVIRONMENT || '').toLowerCase();
    if (env === 'prod' || env === 'production') return 'prod';
    if (env === 'qa' || env === 'quality' || env === 'staging') return 'qa';

    return 'qa';  // Default to QA (safest)
}

// Get loginData from YAML env parameter
const loginData = process.env.loginData || 'LOA2';
const selectedUser = TEST_DATA[loginData] || TEST_DATA.LOA2;
output.user = selectedUser;
```

### Credential Files (QA vs Prod)

**QA** (`.maestro/config/credentials.qa.js`) -- Used for `debug` builds:

```javascript
TEST_DATA = {
    LOA2: {
        email: 'Elizabeth.miller@qa2.com',
        password: 'Retail@4321',
        dob: '09011956',
        firstName: 'Elizabeth',
        lastName: 'Miller'
    },
    ELIZABETH_MILLER: { ... },
    BENJAMIN: { ... },
    // 60+ predefined users
};
```

**Production** (`.maestro/config/credentials.prod.js`) -- Used for `adhoc`, `alpha`, `release` builds. Same user keys as QA but with production-specific values.

### Environment Variables Set by test.sh

| Variable           | Description                                    |
|--------------------|------------------------------------------------|
| `APP_ID`           | Bundle ID from `build_config.yaml`             |
| `BUILD_CONFIG`     | Detected build configuration (debug, release)  |
| `ENVIRONMENT`      | Mapped environment (qa or prod)                |
| `CREDENTIALS_FILE` | Path to the selected credentials file          |

These are passed to Maestro as:
```bash
ENV_ARGS="--env APP_ID=$APP_ID --env ENVIRONMENT=$ENVIRONMENT --env BUILD_CONFIG=$BUILD_CONFIG"
```

## Environment Configurations

### Fallback APP_ID Pattern

All YAML files use the fallback pattern so tests work even without explicit config:

```yaml
appId: ${APP_ID:-com.cvsenterpriseiphone.cvspharmacy}
```

If `APP_ID` is set via config, that value is used. Otherwise, the default CVS Health bundle ID is used.

### Running Tests by Environment

**QA (default for local development):**
```bash
bash scripts/testing/test.sh .maestro/flows/Account/login-and-logout.yaml
# or explicitly:
maestro test --config config/config.qa.yaml .maestro/flows/Account/login-and-logout.yaml
```

**Production:**
```bash
BUILD_CONFIG=release bash scripts/testing/test.sh .maestro/flows/Account/login-and-logout.yaml
# or:
maestro test --config .maestro/config/config.yaml .maestro/flows/Account/login-and-logout.yaml
```

**With performance optimizations (30-40% faster):**
```bash
maestro test --config config/performance.yaml .maestro/flows/Account/login-and-logout.yaml
```

### NPM Scripts

```bash
npm test              # Default environment
npm run test:qa       # QA environment
npm run test:prod     # Production environment
npm run test:performance  # With performance config
npm run test:parallel     # Parallel execution
```

## Usage Examples

### CVS Health + QA Environment

**Configure `build_config.yaml`:**
```yaml
configuration: "Debug"
ios:
  scheme: "CVSOnlineiPhone"
  bundle_id: "com.cvsenterpriseiphone.cvspharmacy"
```

**Run:**
```bash
bash scripts/testing/test.sh .maestro/flows/Account/login-and-logout.yaml
```

Result: `APP_ID=com.cvsenterpriseiphone.cvspharmacy`, `ENVIRONMENT=qa`, credentials loaded from `credentials.qa.js`.

### Health100 + PROD Environment

**Configure `build_config.yaml`:**
```yaml
configuration: "Release"
ios:
  scheme: "Health100"
  bundle_id: "com.cvsenterpriseiphone.health100"
```

**Run:**
```bash
bash scripts/testing/test.sh .maestro/flows/Account/login-and-logout.yaml
```

Result: `APP_ID=com.cvsenterpriseiphone.health100`, `ENVIRONMENT=prod`, credentials loaded from `credentials.prod.js`.

### Using Different Test Users

Specify the `loginData` parameter when loading credentials in a flow:

```yaml
- runScript:
    file: ../../config/credentials-loader.js
    env:
      loginData: ELIZABETH_MILLER  # Must match a TEST_DATA key exactly

- tapOn: "Email"
- inputText: ${output.user.email}
```

Available users include: `LOA2`, `ELIZABETH_MILLER`, `BENJAMIN`, `STELLA_GORDAN`, `DEAN_FANT`, and 55+ others defined in the credential files.

### Override Environment Explicitly

```bash
# Force QA credentials even for a release build
BUILD_CONFIG=release ENVIRONMENT=qa bash scripts/testing/test.sh .maestro/flows/Account/login-and-logout.yaml
```

## Advanced Configuration

### Custom Build Configs

To add a custom build configuration (e.g., `staging`), modify the mapping in the test runner:

```bash
case "$BUILD_CONFIG_LOWER" in
  debug)      ENVIRONMENT="qa" ;;
  staging)    ENVIRONMENT="staging" ;;
  adhoc|alpha|release) ENVIRONMENT="prod" ;;
esac
```

Then create the corresponding credentials file: `.maestro/config/credentials.staging.js`

### Platform-Specific Credentials

If iOS and Android need different credentials, create separate files:
- `credentials.qa.ios.json`
- `credentials.qa.android.json`

Update the loader to select based on the `PLATFORM` variable.

### Adding New Test Users

Add entries to the appropriate credentials file (`credentials.qa.js` or `credentials.prod.js`):

```javascript
TEST_DATA = {
    NEW_USER: {
        email: 'newuser@qa2.com',
        password: 'Password123',
        dob: '01011990',
        firstName: 'New',
        lastName: 'User'
    },
    // ... existing users
};
```

## CI/CD Integration

### GitHub Actions

```yaml
jobs:
  test-qa:
    runs-on: macos-latest
    steps:
      - name: Decrypt Credentials
        run: node scripts/decrypt_env.js qa
        env:
          ENCRYPTION_KEY: ${{ secrets.ENCRYPTION_KEY }}
      - name: Run Tests (QA)
        run: maestro test --config config/config.qa.yaml tests/suites/suite-smoke-critical-paths.yaml

  test-prod:
    runs-on: macos-latest
    steps:
      - name: Decrypt Credentials
        run: node scripts/decrypt_env.js prod
        env:
          ENCRYPTION_KEY: ${{ secrets.ENCRYPTION_KEY }}
      - name: Run Tests (Production)
        run: maestro test --config .maestro/config/config.yaml tests/suites/suite-full-regression.yaml
```

### Jenkins

```groovy
pipeline {
    agent any
    stages {
        stage('Test QA') {
            steps {
                sh 'node scripts/decrypt_env.js qa'
                sh 'maestro test --config config/config.qa.yaml tests/suites/suite-smoke-critical-paths.yaml'
            }
        }
        stage('Test Production') {
            steps {
                sh 'node scripts/decrypt_env.js prod'
                sh 'maestro test --config .maestro/config/config.yaml tests/suites/suite-full-regression.yaml'
            }
        }
    }
}
```

### Decrypting Credentials

Before running tests in CI/CD, decrypt credentials for your environment:

```bash
node scripts/decrypt_env.js qa    # QA credentials
node scripts/decrypt_env.js prod  # Production credentials
```

The `scripts/testing/test.sh` wrapper handles decryption automatically for local runs.

## Troubleshooting

### Wrong Environment Credentials

**Symptom:** Test uses QA credentials when expecting Prod, or vice versa.

**Fix:** Check that `configuration` in `build_config.yaml` matches expectations (`Debug` = QA, `Release`/`Adhoc`/`Alpha` = Prod). Verify with:

```bash
bash scripts/testing/test.sh .maestro/flows/Account/login-and-logout.yaml | grep "Environment:"
```

### User Not Found (Falls Back to LOA2)

**Symptom:** Log shows "User SOMEUSER not found, falling back to LOA2."

**Fix:** The `loginData` parameter must exactly match a key in `TEST_DATA`. Check available keys in the credentials file for your environment.

### "undefined" in Email/Password Fields

**Symptom:** Screenshot shows "undefined" typed into login form.

**Fix:** Verify that `test.sh` passes environment variables to Maestro:

```bash
grep "ENVIRONMENT=\$ENVIRONMENT" scripts/testing/test.sh
# Should find the ENV_ARGS line passing ENVIRONMENT and BUILD_CONFIG
```

Also confirm that `credentials-loader.js` is called before the input step in your flow.

### "Unable to launch app undefined"

**Symptom:** Maestro cannot find the app to launch.

**Fix:** Ensure the flow file uses the fallback pattern:

```yaml
appId: ${APP_ID:-com.cvsenterpriseiphone.cvspharmacy}
```

And verify `build_config.yaml` has a valid `bundle_id`.

### Build Config Not Detected

If neither `BUILD_CONFIG` env var nor `build_config.yaml` is set, the system defaults to `debug` (QA). To fix:

```bash
# Option 1: Set explicitly
BUILD_CONFIG=release bash scripts/testing/test.sh ...

# Option 2: Check build_config.yaml has the configuration field
grep configuration .maestro/config/build_config.yaml
```

---

**Related Documentation:**
- [Multi-App Management](./MULTI_APP_MANAGEMENT.md)
- [Build and Installation](./BUILD_AND_INSTALLATION.md)
- [First Time Setup](./FIRST_TIME_SETUP.md)
- [Troubleshooting Common Issues](./TROUBLESHOOTING_COMMON_ISSUES.md)
