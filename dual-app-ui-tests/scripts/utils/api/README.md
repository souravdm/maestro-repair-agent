# Axios-Based API Test Suite

A modular, expandable API test suite using Axios with individual request modules organized in a folder structure.

## Quick Start
# See all available user keys from testdata
npm run list:users

# Run suite for specific users, sequentially (default)
node runner.js --suite authenticated --users LOA2,SUMMER_PE,FALL_PE

# Run for specific users, in parallel (faster, logs interleave)
node runner.js --suite authenticated --users LOA2,SUMMER_PE,FALL_PE --parallel

# Run all users in testdata, sequentially
node runner.js --suite all --users all

# All users, parallel
npm run test:users:parallel

### Installation

```bash
cd scripts/utils/api
npm install
```

### Run Tests

```bash
# Run all requests
npm test

# Run specific suite
npm run test:auth
npm run test:health
npm run test:shop

# Run with custom base URL
node runner.js --suite auth --base-url https://api.prod.cvs.com
```

### View Results

Reports are generated in `artifacts/api/tests/api-test-report-TIMESTAMP/`:
- `report.json` - Machine-readable results
- `report.html` - Visual report (open in browser)
- `responses/` - Individual API response files

## Test Data Runner (CVS + Health100)

The test data runner executes all API request suites and generates an HTML report with a **CVS** tab and a **Health100** tab — both using the same set of test users.

### Run Commands

```bash
# Both CVS + H100 (default)
npm run test:data-report

# Both, in parallel (faster)
npm run test:data-report:parallel

# CVS only
npm run test:data-report:cvs

# H100 only
npm run test:data-report:h100

# H100 only, in parallel
npm run test:data-report:h100:parallel

# Specific users, both apps
node test-data-runner.js --users ELIZABETH_MILLER,CARL_GREEN

# Retry all failed users from last report
npm run test:data-report:retry-failed
```

### CVS vs H100 — Key Differences

| | CVS | Health100 (H100) |
|---|---|---|
| **Base URL** | `https://www-qa2.cvs.com` | `https://api.qa2.health100.com` |
| **x-app-name** | `CVS_APP` | `H100_APP` |
| **Request suite** | `requests/01-authenticated/`<br>`requests/02-pe/` | `requests/h100/01-authenticated/`<br>`requests/h100/02-pe/` |
| **Profile request** | `profile_retrieve` | `h100_profile_retrieve` |
| **PE requests** | `PE-health`, `PE-shop`<br>`PE-discovery`, `PE-med-reminder` | `H100-PE-health`<br>`H100-PE-discovery`, `H100-PE-med-reminder` |
| **Feature badges** | Caremark, Aetna, Specialty<br>RxC, Counsel, MRN, Oak Street | CVS Linked, Caremark, Aetna |
| **PE-Shop** | ✅ Available | ❌ Not available |
| **Auth flow** | CVS MFA | Mixed: guest token via CVS,<br>auth via H100 (`lob: h100`) |

### Report Tabs

The generated HTML report has two tabs:
- **💊 CVS** — Profile, PE-Health, PE-Shop, PE-Discovery, PE-Med-Reminder
- **🏥 Health100** — H100 Profile (with CVS Linked badge), H100 PE-Health, PE-Discovery, PE-Med-Reminder

Switching tabs resets all active filters.

### `--app` Flag

```bash
# Scope to a single app
node test-data-runner.js --app cvs
node test-data-runner.js --app h100
node test-data-runner.js --app both   # default
```

---

## Folder Structure

```
scripts/utils/api/
├── lib/
│   ├── request-helper.js          # Axios wrapper
│   ├── report-generator.js         # Report generation
│   └── postman-converter.js        # Postman collection converter
├── requests/
│   ├── auth/                       # Authentication requests
│   │   ├── guest-token.js
│   │   ├── account-lookup.js
│   │   ├── otp-generate.js
│   │   ├── otp-verify.js
│   │   └── login.js
│   ├── health/                     # Health-related requests
│   │   └── user-health-info.js
│   └── shop/                       # Shopping requests
│       └── pe-shop.js
├── runner.js                       # Main test runner
├── convert-postman.js              # Postman collection converter CLI
├── package.json                    # Dependencies
├── AXIOS-SETUP.md                  # Complete documentation
├── AXIOS-QUICKSTART.md             # Quick start guide
├── MIGRATION-GUIDE.md              # Migration from Postman
└── IMPLEMENTATION-SUMMARY.md       # Implementation overview
```

## Creating New Requests

### Template

Create a new file in `requests/suite/request-name.js`:

```javascript
const RequestHelper = require('../../lib/request-helper');

module.exports = {
  name: 'request_name',
  description: 'What this request does',
  method: 'POST',
  
  async execute(config = {}) {
    const client = new RequestHelper({
      baseURL: config.baseURL || 'https://www-qa2.cvs.com'
    });

    client.setHeaders({
      'x-api-key': config.apiKey || 'default-key',
      'Content-Type': 'application/json'
    });

    const response = await client.post('/api/endpoint', { data: 'value' });

    return {
      name: this.name,
      method: this.method,
      url: '/api/endpoint',
      statusCode: response.statusCode,
      statusMessage: response.statusMessage,
      timing: response.timing,
      success: response.success,
      data: response.data,
      error: response.error
    };
  }
};
```

### Run Tests

```bash
npm test
```

Your new request is automatically discovered and executed.

## Converting Postman Collections

### Convert a Postman Collection

```bash
node convert-postman.js /path/to/postman-collection.json
```

This automatically:
1. Parses the Postman collection JSON
2. Converts each request to an Axios module
3. Organizes requests by folder
4. Replaces Postman variables with config references
5. Saves files to `requests/` folder

### Example

```bash
# Convert your Postman collection
node convert-postman.js ~/Downloads/my-collection.json

# View converted requests
ls -la requests/
```

## RequestHelper API

### Methods

```javascript
const client = new RequestHelper({
  baseURL: 'https://api.example.com',
  timeout: 30000
});

// GET
const response = await client.get('/endpoint');

// POST
const response = await client.post('/endpoint', { data: 'value' });

// PUT
const response = await client.put('/endpoint', { data: 'value' });

// PATCH
const response = await client.patch('/endpoint', { data: 'value' });

// DELETE
const response = await client.delete('/endpoint');
```

### Headers

```javascript
// Set single header
client.setHeader('x-api-key', 'my-key');

// Set multiple headers
client.setHeaders({
  'x-api-key': 'my-key',
  'x-visitor-id': 'visitor-123'
});

// Set authorization
client.setAuth('my-token', 'Bearer');

// Clear headers
client.clearHeaders();
```

### Response Format

```javascript
{
  statusCode: 200,
  statusMessage: 'OK',
  headers: { /* response headers */ },
  data: { /* response body */ },
  timing: 1234,              // milliseconds
  success: true              // statusCode >= 200 && < 300
}
```

## Configuration

### Environment Variables

```bash
export CVS_API_KEY="your-api-key"
export CVS_VISITOR_ID="your-visitor-id"
export CVS_USER_EMAIL="test@example.com"

npm test
```

### Config Object

```javascript
const config = {
  baseURL: 'https://www-qa2.cvs.com',
  apiKey: 'your-key',
  visitorId: 'your-visitor-id',
  userEmail: 'test@example.com',
  guestToken: 'Bearer token...',
  authToken: 'Bearer token...',
  timeout: 30000
};
```

## Test Reports

### JSON Report

```json
{
  "timestamp": "2024-04-13T17:30:45.123Z",
  "suite": "auth",
  "totalRequests": 5,
  "totalPassed": 5,
  "totalFailed": 0,
  "summary": {
    "passRate": "100.00%"
  },
  "results": [
    {
      "name": "guest_token",
      "method": "POST",
      "statusCode": 200,
      "timing": 1234,
      "success": true,
      "data": { /* response */ }
    }
  ]
}
```

### HTML Report

Visual report with:
- Summary statistics
- Pass/fail indicators
- Response timing
- Responsive design

## Common Patterns

### GET Request

```javascript
const response = await client.get('/api/users/123');
```

### POST with Headers

```javascript
client.setHeaders({
  'Authorization': 'Bearer token',
  'x-api-key': 'key'
});

const response = await client.post('/api/endpoint', { data: 'value' });
```

### PUT/PATCH Request

```javascript
const response = await client.put('/api/users/123', {
  firstName: 'John',
  lastName: 'Doe'
});
```

### DELETE Request

```javascript
const response = await client.delete('/api/users/123');
```

## CI/CD Integration

### GitHub Actions

```yaml
- name: Run API Tests
  run: |
    cd scripts/utils/api
    npm install
    npm test
```

### GitLab CI

```yaml
api_tests:
  image: node:16
  script:
    - cd scripts/utils/api
    - npm install
    - npm test
```

## Troubleshooting

### "Cannot find module 'axios'"

```bash
npm install
```

### "No requests found"

- Check files are in `requests/` folder
- Ensure files export a module with `execute` function
- Files shouldn't start with underscore `_`

### "Request timeout"

Increase timeout in request:

```javascript
const client = new RequestHelper({
  baseURL: config.baseURL,
  timeout: 60000  // 60 seconds
});
```

### "Response data is undefined"

Check response structure:

```javascript
console.log(response.data);      // Full response object
console.log(response.statusCode);
console.log(response.error);
```

## Available Requests

### Authentication (`requests/auth/`)

- **guest-token.js** - Generate guest token
- **account-lookup.js** - Lookup account by email
- **otp-generate.js** - Generate OTP
- **otp-verify.js** - Verify OTP code
- **login.js** - Authenticate user

### Health (`requests/health/`)

- **user-health-info.js** - Get user health information

### Shop (`requests/shop/`)

- **pe-shop.js** - Get shop/shopping experience

## Adding New Requests

1. Create file in `requests/suite/request-name.js`
2. Implement `execute()` function
3. Run `npm test`
4. Check reports in `artifacts/api/tests/`

## Documentation

- **AXIOS-SETUP.md** - Complete technical reference
- **AXIOS-QUICKSTART.md** - Quick start guide
- **MIGRATION-GUIDE.md** - Migration from Postman
- **IMPLEMENTATION-SUMMARY.md** - Implementation overview

## Features

✅ **Modular** - Each request is a separate file  
✅ **Maintainable** - Easy to find and update requests  
✅ **Scalable** - Add new requests without modifying core code  
✅ **Testable** - Can unit test individual requests  
✅ **Collaborative** - Git-friendly file structure  
✅ **Flexible** - Full JavaScript capabilities  
✅ **CI/CD Ready** - Native npm integration  
✅ **Lightweight** - Axios is the only dependency  
✅ **Postman Compatible** - Convert collections with `convert-postman.js`  

## Next Steps

1. Install: `npm install`
2. Run: `npm test`
3. Create: Add new requests in `requests/` folder
4. Convert: Use `convert-postman.js` for existing collections
5. Integrate: Add to CI/CD pipeline

## Support

For detailed information, see:
- `AXIOS-SETUP.md` - Complete API reference
- `AXIOS-QUICKSTART.md` - Quick start guide
- `requests/` folder - Request examples
