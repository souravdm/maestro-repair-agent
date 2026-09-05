# Multi-App Flow Management Guide

## Overview

This framework supports testing multiple apps (CVS Pharmacy and Health 100) using a **shared flows + app-specific configuration** pattern. Most test flows are shared and reused, while app-specific configurations and credentials are isolated.

## Architecture

```
.maestro/
├── flows/              # ✅ SHARED flows - used by all apps
│   ├── Account/
│   ├── Benefits/
│   ├── Health/
│   └── ...
├── subflows/           # ✅ SHARED subflows - reusable components
│   ├── Account/
│   ├── Common/
│   └── ...
├── screens/            # ✅ SHARED screens - POM definitions
│   ├── Account/
│   ├── Common/
│   └── ...
├── config/             # ✅ SHARED config - credentials and settings
│   ├── config.yaml
│   ├── credentials-loader.js   # Universal credential loader
│   ├── credentials.qa.js       # QA credentials (both apps)
│   └── credentials.prod.js     # Production credentials (both apps)
└── apps/               # 🔀 APP-SPECIFIC configs and suites only
    ├── cvshealth/
    │   ├── config.env          # Bundle ID, app name, brand
    │   └── suites/             # CVS Health test suites
    │       ├── account.yaml
    │       ├── benefits.yaml
    │       └── smoke.yaml
    └── health100/
        ├── config.env          # Bundle ID, app name, brand
        └── suites/             # Health 100 test suites
            ├── account.yaml
            ├── benefits.yaml
            └── smoke.yaml
```

---

## What Goes Where?

### ✅ Shared Flows (`.maestro/flows/`)

**Use for flows that work across both apps with minimal/no changes:**

- ✅ Authentication (login, logout)
- ✅ Profile management
- ✅ Health records
- ✅ Benefits/insurance
- ✅ Pharmacy features (if Health 100 also has pharmacy)
- ✅ Common UI patterns (navigation, search)

**Example:** `.maestro/flows/Account/login-and-logout.yaml`

```yaml
appId: ${APP_ID}  # ✅ Uses environment variable - works for both apps
tags:
  - account
  - login
---
- runFlow: ../../subflows/Account/onboarding/launchAppWithNotificationHandling.yaml
- runFlow: ../../subflows/Account/authentication/login.yaml
- assertVisible: "Hi,.*|Sign out"
```

### 🔀 App-Specific Features (Handle with Conditionals)

**Use conditional logic in shared flows for app-specific features:**

- 🔀 App-specific onboarding screens
- 🔀 Branded features (e.g., "HealthHUB" only in Health 100)
- 🔀 Different navigation patterns
- 🔀 White-label specific features

**Example:** `.maestro/flows/Health/health-hub-navigation.yaml`

```yaml
appId: ${APP_ID}  # ✅ Works for both apps
name: Health Hub Navigation
tags:
  - health
  - navigation
---
# Health100-specific feature with conditional check
- runFlow:
    when:
      visible: "HealthHUB"
    commands:
      - tapOn: "HealthHUB"
      - assertVisible: "Welcome to HealthHUB"
      - tapOn: "Get Started"
      - assertVisible: "Your Health Dashboard"

# CVS Health users skip HealthHUB section automatically
- assertVisible: "Home|Account"
```

**Note:** App-specific flow directories (`.maestro/apps/{app}/flows/`) are NOT used. All flows live in `.maestro/flows/` and use conditional logic for app-specific behavior.

### 🎯 App Configuration (`.maestro/apps/{app}/config.env`)

Each app has its own config with:
- `APP_ID` - Bundle identifier
- `APP_NAME` - Display name
- `BRAND` - Brand identifier
- `ENVIRONMENT` - Default environment (qa/prod)
- `BUILD_CONFIG` - Default build config (debug/release)

**CVS Health:**
```bash
APP_ID=com.cvsenterpriseiphone.cvspharmacy
APP_NAME=CVS Pharmacy
BRAND=cvshealth
```

**Health 100:**
```bash
APP_ID=com.cvsenterpriseiphone.health100
APP_NAME=Health 100
BRAND=health100
```

### 🔐 User Credentials (`.maestro/testdata/users_*.js`)

**Centralized credential management** - All test users for both apps are stored in a single location:

- **`.maestro/config/credentials-loader.js`** - Universal loader that auto-detects environment (QA/PROD)
- **`.maestro/testdata/users_qa.js`** - QA test users for all apps (60+ test users)
- **`.maestro/testdata/users_prod.js`** - Production test users for all apps

**Why centralized?**
- ✅ Single source of truth - no duplication
- ✅ Easier maintenance - update once, works everywhere
- ✅ Both apps share most test users
- ✅ Automatic environment detection via `BUILD_CONFIG`

**Usage in flows:**

```yaml
# All flows use the centralized loader
- runScript:
    file: ../../config/credentials-loader.js
    env:
      loginData: LOA2
      BUILD_CONFIG: ${BUILD_CONFIG}
      ENVIRONMENT: ${ENVIRONMENT}

# Credentials are now available via ${output.user.*}
- inputText: ${output.user.email}
- inputText: ${output.user.password}
```

**App-specific test users** (if needed) can be added to the centralized files with naming conventions:

```javascript
// .maestro/testdata/users_qa.js
TEST_DATA = {
  LOA2: { ... },                    // Shared user
  ELIZABETH_MILLER: { ... },        // Shared user
  H100_MEDICARE_USER: { ... },      // Health100-specific (prefix: H100_)
  CVS_EXTRACARE_USER: { ... }       // CVS Health-specific (prefix: CVS_)
}
```

---

## Running Tests for Specific Apps

### Method 1: Export Environment Variable

```bash
# Set the app context
export APP_ID=com.cvsenterpriseiphone.health100

# Run shared flow
./scripts/testing/test.sh .maestro/flows/Account/login-and-logout.yaml
```

### Method 2: Pass --env Flag

```bash
# Run with explicit APP_ID
./scripts/testing/test.sh .maestro/flows/Account/login-and-logout.yaml \
  --env APP_ID=com.cvsenterpriseiphone.health100
```

### Method 3: Run App-Specific Suite

```bash
# Run Health 100 account suite
./scripts/testing/test.sh .maestro/apps/health100/suites/account.yaml

# Run CVS Health smoke suite
./scripts/testing/test.sh .maestro/apps/cvshealth/suites/smoke.yaml
```

**Suite files automatically inject `APP_ID`:**

```yaml
# .maestro/apps/health100/suites/account.yaml
appId: ${APP_ID}
env:
  APP_ID: ${APP_ID}  # Injects from config.env
---
- runFlow:
    file: ../../../flows/Account/login-and-logout.yaml  # Shared flow
```

---

## Working with GitHub Code

You provided: https://github.com/cvs-health-pcw-source-code/digital-flagship-ios/tree/main/IOS/Packages/Account/Sources/Account/UI

### How to Use GitHub Code

1. **Map UI Components to Screen Files**

Look at `AccountView.swift` or similar files to identify:
- Element labels
- Button text
- Accessibility IDs
- Navigation structure

**Example from GitHub:**
```swift
// AccountView.swift
Button("Sign In") {
    showLogin = true
}
.accessibilityIdentifier("account_signInButton")
```

**Maps to Screen File:**
```yaml
# .maestro/screens/Account/AccountDashboardScreen.yaml
env:
  SIGN_IN_BTN: ${SIGN_IN_BTN:-"Sign In"}
  SIGN_IN_BTN_ID: ${SIGN_IN_BTN_ID:-"account_signInButton"}
```

2. **Extract Flow Patterns**

Look at SwiftUI view hierarchies to understand navigation:
```swift
NavigationStack {
    AccountDashboardView()
    .navigationDestination(for: Route.self) { route in
        switch route {
        case .profile: ProfileView()
        case .insurance: InsuranceView()
        }
    }
}
```

**Maps to Subflow:**
```yaml
# .maestro/subflows/Account/navigateToProfile.yaml
- tapOn: "Account"
- assertVisible: "Profile|Account Settings"
- tapOn: "Profile"
- assertVisible: "Edit Profile|Personal Information"
```

3. **Identify Differences Between Apps**

Compare Account package code for CVS Pharmacy vs Health 100:
- Different branding strings
- Feature flags (e.g., ExtraCare only in CVS)
- Navigation differences

If **90% similar** → Use shared flow with conditional logic
If **<90% similar** → Create app-specific flows

---

## Creating New Flows

### Scenario 1: Feature Exists in Both Apps (Use Shared Flow)

**Feature:** Update profile email address

**Steps:**

1. **Create shared flow:**
```bash
# .maestro/flows/Account/test_profile_email_update.yaml
```

2. **Use `${APP_ID}` so it works for both apps:**
```yaml
appId: ${APP_ID}
tags:
  - account
  - profile
---
- runFlow: ../../subflows/Account/authentication/login.yaml
- tapOn: "Profile"
- tapOn: "Email"
- inputText: "newemail@example.com"
- tapOn: "Save"
- assertVisible: "Email updated successfully"
```

3. **Reference from both app suites:**
```yaml
# .maestro/apps/health100/suites/account.yaml
- runFlow:
    file: ../../../flows/Account/test_profile_email_update.yaml

# .maestro/apps/cvshealth/suites/account.yaml
- runFlow:
    file: ../../../flows/Account/test_profile_email_update.yaml
```

---

### Scenario 2: Feature is App-Specific (Use Conditionals)

**Feature:** Health 100 has a "HealthHUB Dashboard" not in CVS Pharmacy

**Steps:**

1. **Create shared flow with conditional logic:**
```bash
# .maestro/flows/Health/healthhub-dashboard-navigation.yaml
```

2. **Use conditional checks for app-specific features:**
```yaml
appId: ${APP_ID}  # ✅ Works for both apps
name: HealthHUB Dashboard Navigation
tags:
  - health
  - healthhub
---
- runFlow: ../../subflows/Account/authentication/login.yaml

# Health 100-specific feature (CVS Health skips this automatically)
- runFlow:
    when:
      visible: "HealthHUB"
    commands:
      - tapOn: "HealthHUB"
      - assertVisible: "Your Health Dashboard"
      - assertVisible: "Wellness Score"
      - assertVisible: "Activity Goals"

# Both apps continue from here
- assertVisible: "Home|Account"
```

3. **Reference from both app suites:**
```yaml
# .maestro/apps/health100/suites/health.yaml
- runFlow:
    file: ../../../flows/Health/healthhub-dashboard-navigation.yaml

# .maestro/apps/cvshealth/suites/health.yaml (optional - CVS skips HealthHUB)
- runFlow:
    file: ../../../flows/Health/healthhub-dashboard-navigation.yaml
```

---

### Scenario 3: Feature is 90% Similar with Small Differences

**Feature:** Account dashboard has different branding text

**Option A: Conditional Logic in Shared Flow**

```yaml
# .maestro/flows/Account/test_dashboard.yaml
appId: ${APP_ID}
---
- runFlow: ../../subflows/Account/authentication/login.yaml

# Check which app is running
- runFlow:
    when:
      visible: "CVS Pharmacy"  # CVS Health branding
    commands:
      - assertVisible: "ExtraCare"
      - assertVisible: "Pharmacy"

- runFlow:
    when:
      visible: "Health 100"  # Health 100 branding
    commands:
      - assertVisible: "HealthHUB"
      - assertVisible: "Wellness"

# Common assertions for both
- assertVisible: "Account"
- assertVisible: "Profile"
```

**Option B: Screen File Parameters**

```yaml
# .maestro/screens/Account/AccountDashboardScreen.yaml
env:
  DASHBOARD_TITLE: ${DASHBOARD_TITLE:-"Account"}
  PRIMARY_FEATURE: ${PRIMARY_FEATURE:-"Profile"}
  BRAND_SPECIFIC_BUTTON: ${BRAND_SPECIFIC_BUTTON:-"Settings"}
```

Pass different values per app:
```yaml
# In health100 suite
- runFlow:
    file: ../../../flows/Account/test_dashboard.yaml
    env:
      DASHBOARD_TITLE: "HealthHUB"
      BRAND_SPECIFIC_BUTTON: "Wellness"
```

---

## Sharing Components with Figma Integration

When you integrate Figma designs:

1. **GitHub Code → Screen Objects:**
   - Extract accessibility IDs, button labels from Swift/Kotlin
   - Map to `.maestro/screens/` POM files

2. **Figma Designs → Verifyability:**
   - Use Figma links to validate element positions, colors, text
   - Create visual regression tests (if using `--visual` flag)

3. **Component Reuse:**
   - Identify reusable UI components (login form, navigation bar)
   - Create subflows in `.maestro/subflows/Common/`
   - Reference from both app flows

**Example:**

**GitHub Code (Swift):**
```swift
struct LoginForm: View {
    var body: some View {
        TextField("Email", text: $email)
            .accessibilityIdentifier("login_emailField")
        SecureField("Password", text: $password)
            .accessibilityIdentifier("login_passwordField")
        Button("Sign In") { login() }
            .accessibilityIdentifier("login_submitButton")
    }
}
```

**Figma Design:**
- Email field placeholder: "Email or mobile number"
- Password field: Standard iOS SecureField
- Button: Primary blue button, 48pt height

**Maps to Screen Object:**
```yaml
# .maestro/screens/Account/LoginScreen.yaml
env:
  EMAIL_FIELD: ${EMAIL_FIELD:-"Email or mobile number"}
  EMAIL_FIELD_ID: ${EMAIL_FIELD_ID:-"login_emailField"}
  PASSWORD_FIELD: ${PASSWORD_FIELD:-"Password"}
  PASSWORD_FIELD_ID: ${PASSWORD_FIELD_ID:-"login_passwordField"}
  SIGN_IN_BTN: ${SIGN_IN_BTN:-"Sign In"}
  SIGN_IN_BTN_ID: ${SIGN_IN_BTN_ID:-"login_submitButton"}
```

**Maps to Subflow:**
```yaml
# .maestro/subflows/Account/authentication/login.yaml
- runScript: ../../../screens/Account/LoginScreen.js
- tapOn: ${output.account_login.emailField}
- inputText: ${output.user.email}
- tapOn: ${output.account_login.passwordField}
- inputText: ${output.user.password}
- tapOn: ${output.account_login.signInBtn}
```

---

## Best Practices

### ✅ DO:

1. **Start with shared flows** - Assume flows are shared unless proven otherwise
2. **Use `${APP_ID}` everywhere** - Let the environment inject the correct bundle ID
3. **Leverage screen objects** - Keep element locators in `.maestro/screens/`
4. **Document app-specific features** - Add comments explaining why a flow is app-specific
5. **Keep credentials separate** - Never mix CVS Health and Health 100 test users
6. **Test with both apps** - Run shared flows against both apps to validate reusability

### ❌ DON'T:

1. **Don't hardcode bundle IDs in shared flows** - Use `${APP_ID}` instead
2. **Don't duplicate flows unnecessarily** - 90% similar? Use conditional logic
3. **Don't mix credentials** - Health 100 users ≠ CVS Health users
4. **Don't skip environment setup** - Always source the correct `config.env`
5. **Don't ignore navigation differences** - Account for brand-specific UI patterns
6. **Don't forget to update both suites** - When adding shared flows, update both app suites

---

## Example: Adding a New Shared Feature

**Scenario:** Both apps now support "Favorite Pharmacies"

**Step 1: Check GitHub code**
```bash
# Check if feature exists in both apps
# CVS: IOS/Packages/Pharmacy/Sources/Pharmacy/FavoritePharmacyView.swift
# Health100: (check equivalent package structure)
```

**Step 2: Extract UI elements**
```swift
// Common elements:
Button("Add to Favorites").accessibilityIdentifier("pharmacy_addFavoriteButton")
Text("Favorite Pharmacies").accessibilityIdentifier("pharmacy_favoritesTitle")
```

**Step 3: Create screen object**
```yaml
# .maestro/screens/Pharmacy/PharmacyScreen.yaml
env:
  FAVORITES_TITLE: ${FAVORITES_TITLE:-"Favorite Pharmacies"}
  ADD_FAVORITE_BTN: ${ADD_FAVORITE_BTN:-"Add to Favorites"}
  REMOVE_FAVORITE_BTN: ${REMOVE_FAVORITE_BTN:-"Remove Favorite"}
```

**Step 4: Create shared flow**
```yaml
# .maestro/flows/Pharmacy/test_favorite_pharmacies.yaml
appId: ${APP_ID}
tags:
  - pharmacy
  - favorites
---
- runFlow: ../../subflows/Account/authentication/login.yaml
- runFlow: ../../subflows/Pharmacy/navigateToPharmacy.yaml
- tapOn: "Find a Pharmacy"
- tapOn: "Search"
- inputText: "10001"
- tapOn: "Search"
- assertVisible: "CVS Pharmacy"
- tapOn:
    index: 0
- tapOn: "Add to Favorites"
- assertVisible: "Added to favorites"
```

**Step 5: Add to both app suites**
```yaml
# .maestro/apps/health100/suites/pharmacy.yaml
- runFlow:
    file: ../../../flows/Pharmacy/test_favorite_pharmacies.yaml

# .maestro/apps/cvshealth/suites/pharmacy.yaml
- runFlow:
    file: ../../../flows/Pharmacy/test_favorite_pharmacies.yaml
```

**Step 6: Run tests for both apps**
```bash
# Test Health 100
export APP_ID=com.cvsenterpriseiphone.health100
./scripts/testing/test.sh .maestro/flows/Pharmacy/test_favorite_pharmacies.yaml

# Test CVS Pharmacy
export APP_ID=com.cvsenterpriseiphone.cvspharmacy
./scripts/testing/test.sh .maestro/flows/Pharmacy/test_favorite_pharmacies.yaml
```

---

## Quick Reference Commands

```bash
# List all apps
ls .maestro/apps

# Check app config
cat .maestro/apps/health100/config.env

# Run Health 100 suite
./scripts/testing/test.sh .maestro/apps/health100/suites/smoke.yaml

# Run CVS Health suite
./scripts/testing/test.sh .maestro/apps/cvshealth/suites/smoke.yaml

# Run shared flow with specific app
export APP_ID=com.cvsenterpriseiphone.health100
./scripts/testing/test.sh .maestro/flows/Account/login-and-logout.yaml

# Run with recording (single test only)
./scripts/testing/test.sh .maestro/flows/Account/login-and-logout.yaml --video
```

---

## Building Apps Locally

Both CVS Health and Health 100 apps are built from the same Xcode workspace with different schemes. This section explains how to build each app for testing.

### Prerequisites

Before building, ensure you have:

```bash
# Install Xcode Command Line Tools
xcode-select --install

# Install CocoaPods
sudo gem install cocoapods

# Navigate to iOS project directory
cd /path/to/digital-flagship-ios/IOS/CVSOnlineiPhone
```

### Building CVS Health App

**Scheme:** `CVSOnlineiPhone`  
**Bundle ID:** `com.cvsenterpriseiphone.cvspharmacy`

#### Step-by-Step Build

```bash
# 1. Verify scheme exists
xcodebuild -workspace CVSOnlineiPhone.xcworkspace -list

# Output should show "CVSOnlineiPhone" in schemes list

# 2. Install dependencies
pod install --repo-update

# 3. Boot simulator
xcrun simctl boot "iPhone 17 Pro"

# 4. Build for simulator
xcodebuild \
  -workspace CVSOnlineiPhone.xcworkspace \
  -scheme CVSOnlineiPhone \
  -sdk iphonesimulator \
  -configuration Debug \
  -derivedDataPath ./build

# 5. Install app
xcrun simctl install booted ./build/Build/Products/Debug-iphonesimulator/CVSPharmacy.app

# 6. Launch app
xcrun simctl launch booted com.cvsenterpriseiphone.cvspharmacy
```

#### Quick Build (All-in-One)

```bash
cd /path/to/digital-flagship-ios/IOS/CVSOnlineiPhone && \
pod install --repo-update && \
xcrun simctl boot "iPhone 17 Pro" && \
xcodebuild -workspace CVSOnlineiPhone.xcworkspace \
  -scheme CVSOnlineiPhone \
  -sdk iphonesimulator \
  -configuration Debug \
  -derivedDataPath ./build && \
xcrun simctl install booted ./build/Build/Products/Debug-iphonesimulator/CVSPharmacy.app && \
xcrun simctl launch booted com.cvsenterpriseiphone.cvspharmacy
```

---

### Building Health 100 App

**Scheme:** `Health100` (or similar - check with `-list`)  
**Bundle ID:** `com.cvsenterpriseiphone.health100`

#### Step-by-Step Build

```bash
# 1. Find exact Health 100 scheme name
xcodebuild -workspace CVSOnlineiPhone.xcworkspace -list | grep -i health

# Output examples:
#   - Health100
#   - Health100Debug
#   - Health100Release
# Use the appropriate scheme name below

# 2. Install dependencies (if not already done)
pod install --repo-update

# 3. Boot simulator
xcrun simctl boot "iPhone 17 Pro"

# 4. Build for simulator
xcodebuild \
  -workspace CVSOnlineiPhone.xcworkspace \
  -scheme Health100 \
  -sdk iphonesimulator \
  -configuration Debug \
  -derivedDataPath ./build

# 5. Install app
xcrun simctl install booted ./build/Build/Products/Debug-iphonesimulator/Health100.app

# 6. Launch app
xcrun simctl launch booted com.cvsenterpriseiphone.health100
```

#### Quick Build (All-in-One)

```bash
cd /path/to/digital-flagship-ios/IOS/CVSOnlineiPhone && \
pod install --repo-update && \
xcrun simctl boot "iPhone 17 Pro" && \
xcodebuild -workspace CVSOnlineiPhone.xcworkspace \
  -scheme Health100 \
  -sdk iphonesimulator \
  -configuration Debug \
  -derivedDataPath ./build && \
xcrun simctl install booted ./build/Build/Products/Debug-iphonesimulator/Health100.app && \
xcrun simctl launch booted com.cvsenterpriseiphone.health100
```

---

### Using Framework Build Scripts

The framework provides automated build scripts that handle these steps:

#### Configure build_config.yaml

```yaml
# CVS Health — migrated to new GitHub org
ios:
  cvshealth_repo_url: "https://github.com/cvs-health-pcw-source-code/digital-flagship-ios.git"
  repo_url: "https://github.com/cvs-health-source-code/digital-flagship-ios.git"  # Health100 repo
  scheme: "CVSOnlineiPhone"
  workspace_path: "IOS/CVSOnlineiPhone/CVSOnlineiPhone.xcworkspace"
  bundle_id: "com.cvsenterpriseiphone.cvspharmacy"
  app_name: "CVSPharmacy.app"

# For Health 100: change scheme and bundle_id only — repo_url stays as-is
ios:
  cvshealth_repo_url: "https://github.com/cvs-health-pcw-source-code/digital-flagship-ios.git"
  repo_url: "https://github.com/cvs-health-source-code/digital-flagship-ios.git"  # Health100 repo
  scheme: "Health100"
  workspace_path: "IOS/CVSOnlineiPhone/CVSOnlineiPhone.xcworkspace"
  bundle_id: "com.cvsenterpriseiphone.health100"
  app_name: "Health100.app"
```

#### Run Framework Build

```bash
# Build using framework scripts
cd /path/to/MaestroUITests

# For CVS Health
./scripts/build/build.sh ios repo

# For Health 100 (after updating build_config.yaml)
./scripts/build/build.sh ios repo
```

The script automatically:
- ✅ Clones/updates repo
- ✅ Installs CocoaPods dependencies
- ✅ Builds with correct scheme
- ✅ Boots simulator
- ✅ Installs app
- ✅ Launches app

---

### Troubleshooting Build Issues

#### Issue: "Scheme not found"

```bash
# List all available schemes
xcodebuild -workspace CVSOnlineiPhone.xcworkspace -list

# If Health100 scheme doesn't exist, check for variations:
#   - Health100Debug
#   - Health100Release
#   - health100 (lowercase)
```

**Solution:** Use the exact scheme name shown in the list.

---

#### Issue: "Pod install fails"

```bash
# Clear CocoaPods cache
pod cache clean --all
rm -rf Pods/ Podfile.lock

# Reinstall
pod install --repo-update
```

---

#### Issue: "Build succeeds but app doesn't appear"

**Common Causes:**
1. Wrong `.app` file name in install command
2. Wrong bundle ID in launch command

**Solution:**

```bash
# Find actual .app name
ls ./build/Build/Products/Debug-iphonesimulator/

# Example outputs:
#   - CVSPharmacy.app
#   - Health100.app
#   - CVSHealth.app

# Use the exact name found above
xcrun simctl install booted ./build/Build/Products/Debug-iphonesimulator/<ACTUAL_NAME>.app
```

---

#### Issue: "Simulator boot fails"

```bash
# List available simulators
xcrun simctl list devices available

# Boot specific device by UDID
xcrun simctl boot <UDID>

# Or use device name
xcrun simctl boot "iPhone 16 Pro"
```

---

### Verification

After building and installing, verify the app is ready for testing:

```bash
# Check app is installed
xcrun simctl listapps booted | grep -i "health\|cvs"

# Expected output:
com.cvsenterpriseiphone.cvspharmacy = {
    ApplicationType = User;
    CFBundleDisplayName = "CVS Pharmacy";
    ...
}

com.cvsenterpriseiphone.health100 = {
    ApplicationType = User;
    CFBundleDisplayName = "Health 100";
    ...
}

# Run a quick test
export APP_ID=com.cvsenterpriseiphone.health100
./scripts/testing/test.sh .maestro/flows/General/test_app_launch.yaml
```

---

### Build Comparison Table

| Aspect | CVS Health | Health 100 |
|--------|------------|------------|
| **Xcode Scheme** | `CVSOnlineiPhone` | `Health100` |
| **Bundle ID** | `com.cvsenterpriseiphone.cvspharmacy` | `com.cvsenterpriseiphone.health100` |
| **App Name** | `CVSPharmacy.app` | `Health100.app` |
| **Config Path** | `.maestro/apps/cvshealth/config.env` | `.maestro/apps/health100/config.env` |
| **Workspace** | `IOS/CVSOnlineiPhone/CVSOnlineiPhone.xcworkspace` | Same workspace |
| **Build Time** | ~5-8 minutes | ~5-8 minutes |
| **Dependency Overlap** | 95% shared pods | 95% shared pods |

**Key Difference:** Only the scheme name changes during build - everything else is identical.

---

## Related Documentation

- [Framework Features - Multi-Environment](../framework-features/MULTI_ENVIRONMENT_GUIDE.md)
- [Platform Configuration](PLATFORM_CONFIGURATION_GUIDE.md)
- [Environment Setup](ENVIRONMENT_SETUP.md)
- [Build and Installation](BUILD_AND_INSTALLATION.md)
