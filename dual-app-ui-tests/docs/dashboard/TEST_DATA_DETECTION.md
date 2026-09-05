# Test Data Detection and User Mapping

## Overview

The test generator now automatically detects test user credentials (email + DOB) from test steps or notes and maps them to the correct `loginData` key in `users_qa.js`.

## How It Works

### 1. Detection
The generator scans test steps and notes for email+DOB patterns:

**Supported Formats:**
- `hayesl@cvs.com 09091990`
- `hayesl@cvs.com\n09091990` (multi-line)
- `Email: hayesl@cvs.com DOB: 09091990`
- `Login with reynoldsn@cvs.com01011990` (inline)

### 2. Matching
The system matches against all users in `.maestro/testdata/users_qa.js`:

**Match Priority:**
1. **Exact match** (email + DOB): `hayesl@cvs.com` + `09091990` → `HAYES_LUCAS`
2. **Email-only match**: `reynoldsn@cvs.com` → `REYNOLDS_NOAH`
3. **Default fallback**: No match → `LOA2`

### 3. Generation
The detected user key is automatically inserted into the `onFlowStart` block:

```yaml
onFlowStart:
  - runScript: ../../screens/Home/homescreenObjects.js
  - runScript: ../../screens/SearchAndNav/searchNavObjects.js
  - runScript:
      file: ../../testdata/users_qa.js
      env:
        loginData: HAYES_LUCAS  # ← Automatically detected from email+DOB
```

## Examples

### Example 1: Notes Field
**Input:**
```
Test ID: med_reminder_navigation
Functional Area: Home
Test Scenario: Med Reminders Navigation
Notes: Test user: hayesl@cvs.com 09091990
Test Steps:
  1. Launch app
  2. Complete sign in process
  3. Verify Med reminders complete state is displayed
```

**Generated `onFlowStart`:**
```yaml
onFlowStart:
  - runScript: ../../screens/Home/homescreenObjects.js
  - runScript: ../../screens/SearchAndNav/searchNavObjects.js
  - runScript:
      file: ../../testdata/users_qa.js
      env:
        loginData: HAYES_LUCAS
```

### Example 2: Test Steps Field
**Input:**
```
Test Steps:
  1. Launch app
  2. Login with reynoldsn@cvs.com 01011990
  3. Verify home screen is displayed
```

**Generated `onFlowStart`:**
```yaml
onFlowStart:
  - runScript: ../../screens/Common/CommonScreen.js
  - runScript:
      file: ../../testdata/users_qa.js
      env:
        loginData: REYNOLDS_NOAH
```

### Example 3: No Test Data (Default)
**Input:**
```
Test Steps:
  1. Launch app
  2. Complete sign in process
  3. Verify home screen is displayed
```

**Generated `onFlowStart`:**
```yaml
onFlowStart:
  - runScript: ../../screens/Common/CommonScreen.js
  - runScript:
      file: ../../testdata/users_qa.js
      env:
        loginData: LOA2  # ← Default user
```

## Available Test Users

The system can detect any user defined in `.maestro/testdata/users_qa.js`. Common users include:

- `LOA2` - Default authenticated user
- `HAYES_LUCAS` - hayesl@cvs.com / 09091990
- `REYNOLDS_NOAH` - reynoldsn@cvs.com / 01011990
- `ELIZABETH_MILLER` - Elizabeth.miller@qa2.com / 01031960
- `MONTANA_MONT` - montana.mont@qa2.com / 08281989
- And 100+ more users...

## Usage in Dashboard

When creating tests via the Electron Dashboard or CLI:

1. **Add test data to Notes field**: `hayesl@cvs.com 09091990`
2. **Or inline in Test Steps**: `Login with hayesl@cvs.com 09091990`
3. **Generate test**: The system automatically detects and uses the correct user

## Technical Details

### Files Modified
- `scripts/utils/dashboard/testdata-matcher.js` - New module for parsing and matching
- `scripts/utils/dashboard/enhance-steps.js` - Added `detectTestData()` function
- `scripts/utils/dashboard/docs-testdata-registry.js` - Updated `generateOnFlowStart()` to accept detected data
- `scripts/utils/dashboard/hybrid-test-generator.js` - Integrated detection into both template and LLM modes

### API

**`detectTestData(testSteps, notes)`**
```javascript
const { detectTestData } = require('./scripts/utils/dashboard/enhance-steps');

const result = detectTestData('hayesl@cvs.com', '09091990');
// {
//   detected: true,
//   userKey: 'HAYES_LUCAS',
//   email: 'hayesl@cvs.com',
//   dob: '09091990',
//   matchType: 'exact'
// }
```

**`matchTestData(input)`**
```javascript
const { matchTestData } = require('./scripts/utils/dashboard/testdata-matcher');

const result = matchTestData('hayesl@cvs.com 09091990');
// {
//   userKey: 'HAYES_LUCAS',
//   email: 'hayesl@cvs.com',
//   dob: '09091990',
//   matchType: 'exact'
// }
```

## Benefits

1. **No manual user key lookup** - Just paste email+DOB from test requirements
2. **Accurate user selection** - Exact matching prevents wrong user data
3. **Flexible input** - Works with various formats and locations
4. **Backwards compatible** - Falls back to smart defaults when no data provided
5. **Type safety** - Only uses valid user keys from `users_qa.js`
