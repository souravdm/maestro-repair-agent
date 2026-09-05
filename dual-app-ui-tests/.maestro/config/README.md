# Centralized Test Data Configuration

## Overview

All test credentials and configuration data for **both CVS Health and Health100 apps** are centralized in this directory. This eliminates duplication and provides a single source of truth.

## Files

### 📋 `credentials-loader.js`
**Universal credential loader** with automatic environment detection.

- Auto-detects QA vs Production based on `BUILD_CONFIG` environment variable
- Used by all test flows via `runScript`
- Returns selected user via `output.user` object

**Usage in flows:**
```yaml
- runScript:
    file: ../../config/credentials-loader.js
    env:
      loginData: LOA2           # User key
      BUILD_CONFIG: ${BUILD_CONFIG}
```

### 👥 `../testdata/users_qa.js`
**QA test credentials** for both apps.

- Contains 60+ test users
- Used when `BUILD_CONFIG=debug`
- Includes users for all test scenarios (LOA2, Caregivers, Medicare, etc.)

### 👥 `../testdata/users_prod.js`
**Production test credentials** for both apps.

- Contains production-safe test users
- Used when `BUILD_CONFIG=release`, `adhoc`, or `alpha`
- Smaller set of verified production test accounts

## Why Centralized?

### ✅ Benefits

1. **Single Source of Truth** - Update once, works everywhere
2. **No Duplication** - Both CVS Health and Health100 share the same user pool
3. **Easier Maintenance** - Add/update users in one location
4. **Cross-Platform** - Works for iOS and Android
5. **CI/CD Ready** - Automatic environment detection in pipelines

### ❌ What We Removed

Previously, we had **4 duplicate credential files**:
- ~~`.maestro/apps/cvshealth/credentials.qa.js`~~ (deleted)
- ~~`.maestro/apps/cvshealth/credentials.prod.js`~~ (deleted)
- ~~`.maestro/apps/health100/credentials.qa.js`~~ (deleted)
- ~~`.maestro/apps/health100/credentials.prod.js`~~ (deleted)

These were either re-exporting the central config or had minimal placeholder data. **No flows were using them.**

## Environment Detection

The loader automatically detects which environment to use:

| BUILD_CONFIG | Environment | Credentials File |
|--------------|-------------|------------------|
| `debug` | QA | `../testdata/users_qa.js` |
| `release` | Production | `../testdata/users_prod.js` |
| `adhoc` | Production | `../testdata/users_prod.js` |
| `alpha` | Production | `../testdata/users_prod.js` |
| (not set) | QA (default) | `../testdata/users_qa.js` |

## Adding New Test Users

### For Both Apps (Most Common)

Add to the `TEST_DATA` object in `users_qa.js` or `users_prod.js`:

```javascript
// .maestro/testdata/users_qa.js
TEST_DATA = {
    // ... existing users ...
    
    NEW_USER: {
        email: 'newuser@qa2.com',
        password: 'Password@1234',
        dob: '01011990',
        firstName: 'Test',
        lastName: 'User',
        hasCvsAccount: true
    }
}
```

Then update the switch statement in `credentials-loader.js`:

```javascript
// .maestro/config/credentials-loader.js
switch(userKey) {
    // ... existing cases ...
    
    case 'NEW_USER':
        selectedUser = TEST_DATA.NEW_USER;
        break;
}
```

### For App-Specific Users (Rare)

If you need users that only work with one app, use naming conventions:

```javascript
TEST_DATA = {
    // Shared users
    LOA2: { ... },
    ELIZABETH_MILLER: { ... },
    
    // CVS Health specific (prefix: CVS_)
    CVS_EXTRACARE_MEMBER: {
        email: 'extracare@qa2.com',
        password: 'CVS@1234',
        ecNumber: '4765181103525'
    },
    
    // Health100 specific (prefix: H100_)
    H100_MEDICARE_USER: {
        email: 'medicare@health100.com',
        password: 'H100@1234',
        medicareId: 'MED123456'
    }
}
```

## Verification

After making changes, verify the setup:

```bash
# Test credential loading for CVS Health
export APP_ID=com.cvsenterpriseiphone.cvspharmacy
bash scripts/testing/test.sh .maestro/flows/Account/login-and-logout.yaml

# Test credential loading for Health100
export APP_ID=com.cvsenterpriseiphone.health100
bash scripts/testing/test.sh .maestro/flows/Account/login-and-logout.yaml
```

## Related Documentation

- [MULTI_APP_MANAGEMENT.md](../../docs/guides/MULTI_APP_MANAGEMENT.md) - Multi-app architecture
- [CLAUDE.md](../../CLAUDE.md) - Framework guidelines
- [BUILD_AND_INSTALLATION.md](../../docs/guides/BUILD_AND_INSTALLATION.md) - Build configuration
