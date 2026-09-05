# Build and Installation Guide

Complete guide for building iOS and Android apps, installing on simulators/emulators, and running Maestro tests.

## Quick Start

### iOS - CVS Health App

```bash
# Build and install CVS Health (automated)
./scripts/install-and-test.sh \
  /path/to/ios-app \
  CVSOnlineiPhone \
  Debug \
  .maestro/apps/cvshealth/suites/smoke.yaml \
  "iPhone 15 Pro"
```

### iOS - Health 100 App

```bash
# Build and install Health 100 (automated)
./scripts/install-and-test.sh \
  /path/to/ios-app \
  Health100 \
  Debug \
  .maestro/apps/health100/suites/smoke.yaml \
  "iPhone 15 Pro"
```

### Android

```bash
# Build and install (automated)
./scripts/build_from_repo.sh --platform android --clean
```

## iOS Build Process

### Prerequisites

- Xcode 15.0 or later
- CocoaPods installed: `brew install cocoapods`
- iOS simulator available

### Step 1: Install CocoaPods Dependencies

```bash
cd /path/to/ios-app
pod install --repo-update
```

**What this does:**
- Downloads all dependencies (Adobe SDKs, Braze, LaunchDarkly, NewRelic, 50+ frameworks)
- Creates `Pods/` directory
- Generates xcconfig files
- Updates Xcode workspace

### Step 2: Build App for Simulator

```bash
xcodebuild build-for-testing \
  -workspace CVSOnlineiPhone.xcworkspace \
  -scheme CVSOnlineiPhone \
  -configuration Debug \
  -derivedDataPath build \
  -sdk iphonesimulator \
  -arch arm64 \
  -destination "generic/platform=iOS Simulator"
```

**Output:** `build/Debug-iphonesimulator/CVSOnlineiPhone.app`

### Step 3: Boot Simulator

```bash
# List available simulators
xcrun simctl list devices

# Boot specific simulator
xcrun simctl boot "iPhone 17 Pro Max"

# Or boot by UDID
SIMULATOR_UDID=$(xcrun simctl list devices | grep "iPhone 17 Pro Max" | grep -oE '[A-F0-9]{8}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{12}' | head -1)
xcrun simctl boot "$SIMULATOR_UDID"

# Wait for boot
sleep 10
```

### Step 4: Install App on Simulator

```bash
# Get app path
APP_PATH=$(find build -name "*.app" -type d | head -1)

# Install app
xcrun simctl install "$SIMULATOR_UDID" "$APP_PATH"

# Verify installation
xcrun simctl listapps "$SIMULATOR_UDID" | grep cvspharmacy
```

### Step 5: Run Maestro Tests

> **Preferred**: use plain `maestro test` after PATH setup (see [First Time Setup](FIRST_TIME_SETUP.md#step-6-activate-maestro-test-path-setup)). The wrapper reads `build_config.yaml` for `APP_ID` automatically — no `export APP_ID` needed.

```bash
# Run via wrapper (reads build_config.yaml for APP_ID)
mastero test .maestro/flows/Account/login-and-logout.yaml

# Skip build/install check when app is already on the simulator
mastero test .maestro/flows/Account/login-and-logout.yaml --skip-setup

# Direct Maestro CLI (manual APP_ID required)
export APP_ID=com.cvsenterpriseiphone.cvspharmacy
maestro test .maestro/flows/Account/login-and-logout.yaml --device "$SIMULATOR_UDID"
```

---

## Multi-App Support: CVS Health vs Health 100

This framework supports testing **two separate apps** from the same codebase:

| App | Bundle ID (Debug/Adhoc) | Scheme Name | Configuration |
|-----|------------------------|-------------|---------------|
| **CVS Health** | `com.cvsenterpriseiphone.cvspharmacy` | `CVSOnlineiPhone` | `.maestro/apps/cvshealth/` |
| **Health 100** | `com.cvsenterpriseiphone.health100` | `Health100` | `.maestro/apps/health100/` |

> **Note:** Bundle IDs vary by build configuration. Debug and Adhoc share the enterprise bundle IDs above; Alpha and Release use distinct IDs. See `build_config.yaml` `bundle_ids` / `cvshealth_bundle_ids` maps for the full matrix.

### Building Health 100 App

The Health 100 app uses a **different scheme** in the same Xcode workspace.

#### Step 1: Find the Health 100 Scheme

```bash
cd /path/to/digital-flagship-ios/IOS/CVSOnlineiPhone

# List all available schemes
xcodebuild -workspace CVSOnlineiPhone.xcworkspace -list

# Look for:
# - Health100
# - Health 100
# - CVSHealth100
```

#### Step 2: Build Health 100 for Simulator

```bash
# Replace "Health100" with actual scheme name from Step 1
SCHEME_NAME="Health100"

xcodebuild \
  -workspace CVSOnlineiPhone.xcworkspace \
  -scheme "$SCHEME_NAME" \
  -configuration Debug \
  -sdk iphonesimulator \
  -derivedDataPath ./build \
  clean build
```

**Output:** `./build/Build/Products/Debug-iphonesimulator/Health100.app`

#### Step 3: Install Health 100 on Simulator

```bash
# Boot simulator
UDID=$(xcrun simctl list devices | grep "iPhone 15 Pro" | grep -v "unavailable" | grep -oE '[A-F0-9-]{36}' | head -1)
xcrun simctl boot "$UDID" || echo "Already booted"

# Find and install the app
APP_PATH=$(find ./build/Build/Products/Debug-iphonesimulator -name "Health100.app" -o -name "*.app" | head -1)
xcrun simctl install "$UDID" "$APP_PATH"

# Verify installation
xcrun simctl listapps "$UDID" | grep health100
```

#### Step 4: Launch Health 100

```bash
# Launch the app
xcrun simctl launch "$UDID" com.cvsenterpriseiphone.health100

# Or use Maestro
export APP_ID=com.cvsenterpriseiphone.health100
./scripts/testing/test.sh .maestro/apps/health100/suites/smoke.yaml
```

#### Quick Build Command (All-in-One)

```bash
# Single command to build and install Health 100
cd /path/to/digital-flagship-ios/IOS/CVSOnlineiPhone && \
pod install --repo-update && \
xcodebuild -workspace CVSOnlineiPhone.xcworkspace -scheme Health100 -configuration Debug -sdk iphonesimulator -derivedDataPath ./build clean build && \
UDID=$(xcrun simctl list devices | grep "iPhone 15 Pro" | grep -oE '[A-F0-9-]{36}' | head -1) && \
xcrun simctl boot "$UDID" || true && \
APP_PATH=$(find ./build/Build/Products/Debug-iphonesimulator -name "*.app" | head -1) && \
xcrun simctl install "$UDID" "$APP_PATH" && \
xcrun simctl launch "$UDID" com.cvsenterpriseiphone.health100
```

#### Updating build_config.yaml for Health 100

```yaml
# File: build_config.yaml
ios:
  # CVS Health → new repo (migrated org)
  cvshealth_repo_url: "https://github.com/cvs-health-pcw-source-code/digital-flagship-ios.git"
  # Health100 → original repo
  repo_url: "https://github.com/cvs-health-source-code/digital-flagship-ios.git"
  scheme: "Health100"            # Change from CVSOnlineiPhone to Health100
  bundle_ids:                    # Auto-resolved by scripts based on configuration — do not set bundle_id manually
    debug: "com.cvsenterpriseiphone.health100"
    debug_dev: "com.cvsenterpriseiphone.health100"
    adhoc: "com.cvsenterpriseiphone.health100"
    alpha: "com.health100.h100.alpha"
    release: "com.health100.h100.app"
  workspace_path: "IOS/CVSOnlineiPhone/CVSOnlineiPhone.xcworkspace"  # Same workspace — Health100 is a different scheme within it
```

> **Switching apps:** change `scheme:` only. The correct bundle ID is auto-resolved from the `bundle_ids` map based on the active `configuration`. Valid configuration values: `Debug`, `Release`, `Adhoc`.

Then build and run — the wrapper resolves the bundle ID automatically:
```bash
# Build the new scheme
./scripts/build/build.sh ios repo

# Run tests — bin/maestro reads bundle_id from build_config.yaml
mastero test .maestro/flows/Benefits/Spending/test_stcob_plan_spending.yaml
```

> **Note:** `build_config.yaml` alone does NOT install the app. You must run `./scripts/build/build.sh ios repo` at least once after changing the scheme or configuration. After that, `maestro test` will auto-detect whether the app is installed and rebuild only when missing.

---

## Platform-Specific App IDs

The framework supports both iOS and Android with different app identifiers:

| Platform | CVS Health App ID | Health 100 App ID |
|----------|-------------------|-------------------|
| **iOS** | `com.cvsenterpriseiphone.cvspharmacy` | `com.cvsenterpriseiphone.health100` |
| **Android** | `com.cvs.launchers.cvs` | *(same codebase, different build variant)* |

The default configuration in `config.yaml` falls back to the iOS app ID when `APP_ID` is not set:

```yaml
env:
  APP_ID: ${APP_ID:-com.cvsenterpriseiphone.cvspharmacy}
  PLATFORM: ${PLATFORM:-ios}
```

### Platform Selection Behavior

- The wrapper-backed `maestro test` command forwards `--platform` to the underlying Maestro CLI.
- If you omit `--platform`, the framework default is `ios`.
- When both iOS and Android devices are connected, always pass `--platform ios` or `--platform android` for deterministic execution.

```bash
# Explicit platform selection (recommended when both devices are connected)
maestro test .maestro/flows/Benefits/Claims/submit-prescription-claim.yaml --platform ios
maestro test .maestro/flows/Account/login-and-logout.yaml --platform android
```

### Platform-Specific Configuration Files

You can create separate config files for each platform instead of relying on environment variables:

**`.maestro/config.ios.yaml`:**
```yaml
env:
  APP_ID: "com.cvsenterpriseiphone.cvspharmacy"
  PLATFORM: "ios"
```

**`.maestro/config.android.yaml`:**
```yaml
env:
  APP_ID: "com.cvs.launchers.cvs"
  PLATFORM: "android"
```

Then run tests with the `--config` flag:
```bash
maestro test --config .maestro/config.ios.yaml .maestro/flows/Account/
maestro test --config .maestro/config.android.yaml .maestro/flows/Account/
```

---

## Android Build Process

### Prerequisites

- Android Studio with Android SDK
- Java 17 or later
- Android emulator created

### Step 1: Build Debug APK

```bash
cd /path/to/android-app

# Build debug APK
./gradlew assembleDebug \
  -x lint \
  -x lintVitalRelease \
  --no-daemon \
  --stacktrace

# Build test APK
./gradlew assembleAndroidTest \
  -x lint \
  -x lintVitalRelease \
  --no-daemon \
  --stacktrace
```

**Output:** `app/build/outputs/apk/debug/app-debug.apk`

### Step 2: Start Emulator

```bash
# List available emulators
emulator -list-avds

# Start emulator
emulator -avd Pixel_6_API_34 &

# Wait for emulator
adb wait-for-device
sleep 10

# Unlock emulator
adb shell input keyevent 82
```

### Step 3: Install App on Emulator

```bash
# Find APK
APK_PATH=$(find . -name "*debug.apk" -type f | grep -v androidTest | head -1)

# Install app
adb install "$APK_PATH"

# Verify installation
adb shell pm list packages | grep cvs
```

### Step 4: Run Maestro Tests

```bash
# Run test
maestro test .maestro/flows/Account/login-and-logout.yaml

# Run with output format
maestro test .maestro/flows/Account/login-and-logout.yaml \
  --format junit \
  --output test-results/auth.xml
```

## Creating Android Emulators

If you do not have an Android emulator configured, follow these steps.

### List Available System Images

```bash
sdkmanager --list | grep "system-images"
```

### Install a System Image

```bash
# Android 14 (API 34) with Google APIs
sdkmanager "system-images;android-34;google_apis;x86_64"

# Or with Play Store
sdkmanager "system-images;android-34;google_apis_playstore;x86_64"
```

### Create an Emulator

```bash
# Create Pixel 6 emulator
avdmanager create avd \
  -n Pixel_6_API_34 \
  -k "system-images;android-34;google_apis;x86_64" \
  -d "Pixel 6"

# Create Pixel 5 emulator
avdmanager create avd \
  -n Pixel_5_API_34 \
  -k "system-images;android-34;google_apis;x86_64" \
  -d "Pixel 5"
```

### List All Emulators

```bash
emulator -list-avds
```

### Start an Emulator Manually

```bash
emulator -avd Pixel_6_API_34 -no-snapshot-load
```

---

## Automated Scripts

### iOS: install-and-test.sh

Complete build, install, and test workflow:

```bash
./scripts/install-and-test.sh \
  <repo-dir> \
  <scheme> \
  <config> \
  <test-file> \
  <simulator>
```

**Example:**
```bash
./scripts/install-and-test.sh \
  /Users/user/.maestro-builds/digital-flagship-ios/IOS/CVSOnlineiPhone \
  CVSOnlineiPhone \
  Debug \
  .maestro/flows/Account/login-and-logout.yaml \
  "iPhone 17 Pro Max"
```

**Steps:**
1. Verifies repository
2. Installs CocoaPods (if needed)
3. Builds app for simulator
4. Locates built app
5. Boots simulator
6. Uninstalls previous version
7. Installs app on simulator
8. Verifies installation
9. Runs Maestro tests

### iOS: run-test-on-simulator.sh

Run tests with correct Maestro syntax:

```bash
./scripts/run-test-on-simulator.sh <simulator-udid> <test-file>
```

**Example:**
```bash
./scripts/run-test-on-simulator.sh \
  94B870A1-067F-4BEF-A27F-BFB2178CF537 \
  .maestro/flows/Account/login-and-logout.yaml
```

### Diagnostic Scripts

**verify-app-launch.sh** - Diagnose app launch issues:
```bash
./scripts/verify-app-launch.sh <simulator-udid> <bundle-id>
```

**diagnose-ios-build.sh** - Check build configuration:
```bash
./scripts/diagnose-ios-build.sh /path/to/ios-app CVSOnlineiPhone
```

**fix-ios-build.sh** - Fix CocoaPods and build issues:
```bash
./scripts/fix-ios-build.sh /path/to/ios-app CVSOnlineiPhone
```

## Troubleshooting

### iOS Build Fails: Missing xcconfig Files

**Error:**
```
error: Unable to open base configuration reference file
'.../Pods-SharedPods-CVSOnlineiPhone.debug.xcconfig'
```

**Cause:** CocoaPods dependencies not installed

**Solution:**
```bash
cd /path/to/ios-app
rm -rf Pods Podfile.lock
pod install --repo-update
```

### iOS App Won't Launch

**Error:**
```
[Failed] test_authentication (4s) (Unable to launch app com.cvsenterpriseiphone.cvspharmacy)
```

**Causes:**
1. Wrong Maestro CLI flag
2. App not installed
3. Wrong bundle ID

**Solutions:**
```bash
# Use correct flag
maestro test <test-file> --device <udid>  # ✅ Correct
maestro test <test-file> --device-id <udid>  # ❌ Wrong

# Check app is installed
xcrun simctl listapps <udid> | grep cvspharmacy

# Install app if missing
xcrun simctl install <udid> /path/to/app.app
```

### Android Build Fails

**Error:**
```
Gradle build failed
```

**Solutions:**
```bash
# Clean Gradle cache
./gradlew clean

# Check Java version (17 required)
java -version

# Rebuild
./gradlew assembleDebug --stacktrace
```

### Simulator/Emulator Not Found

**iOS:**
```bash
# List available simulators
xcrun simctl list devices

# Create simulator if needed
xcrun simctl create "test-sim" \
  "com.apple.CoreSimulator.SimDeviceType.iPhone-17-Pro-Max" \
  "com.apple.CoreSimulator.SimRuntime.iOS-18-0"
```

**Android:**
```bash
# List available emulators
emulator -list-avds

# Create emulator if needed
avdmanager create avd \
  -n Pixel_6_API_34 \
  -k "system-images;android-34;google_apis;x86_64" \
  -d "Pixel 6"
```

### Test Timeout

**Error:**
```
❌ Test timed out after 30000ms
```

**Solutions:**
```yaml
# Increase timeout
- extendedWaitUntil:
    visible: "Element"
    timeout: 60000  # 60 seconds

# Add explicit waits
- wait: 5000  # Wait 5 seconds

# Disable animations (iOS)
xcrun simctl spawn <udid> defaults write com.apple.Accessibility ReduceMotionEnabled -int 1
```

## Performance Optimization

### Faster iOS Builds

```bash
# Skip unnecessary build phases
xcodebuild build-for-testing \
  -x lint \
  -x lintVitalRelease \
  -x SwiftLint \
  ...

# Use incremental builds (don't clean)
# Only clean when necessary

# Build only for arm64 (not x86_64)
-arch arm64
```

### Faster Android Builds

```bash
# Skip lint checks
./gradlew assembleDebug -x lint -x lintVitalRelease

# Use Gradle daemon
./gradlew assembleDebug --daemon

# Parallel execution
./gradlew assembleDebug --parallel
```

### Faster Simulator Operations

```bash
# Disable animations (iOS)
xcrun simctl spawn <udid> defaults write com.apple.Accessibility ReduceMotionEnabled -int 1

# Disable keyboard (iOS)
xcrun simctl spawn <udid> defaults write com.apple.Preferences AppleKeyboardsExpanded -int 0

# Reduce motion (iOS)
xcrun simctl spawn <udid> defaults write com.apple.Accessibility ReduceMotionEnabled -int 1
```

## Best Practices

### 1. Always Clean Before Full Rebuild

```bash
# iOS
rm -rf ~/Library/Developer/Xcode/DerivedData/*
xcodebuild clean -workspace CVSOnlineiPhone.xcworkspace -scheme CVSOnlineiPhone

# Android
./gradlew clean
```

### 2. Verify App Before Testing

```bash
# iOS
xcrun simctl listapps <udid> | grep cvspharmacy
xcrun simctl launch <udid> com.cvsenterpriseiphone.cvspharmacy

# Android
adb shell pm list packages | grep cvs
adb shell am start -n com.cvs.android/.MainActivity
```

### 3. Use Consistent Simulator/Emulator

```bash
# Always use same device for consistency
export SIMULATOR_DEVICE="iPhone 17 Pro Max"
export SIMULATOR_UDID="94B870A1-067F-4BEF-A27F-BFB2178CF537"
```

### 4. Log Everything

```bash
# Capture build logs
xcodebuild build-for-testing ... > build.log 2>&1

# Capture test logs
maestro test ... > test.log 2>&1

# Check logs for errors
grep -i error build.log
```

### 5. Clean Up After Tests

```bash
# iOS
xcrun simctl uninstall <udid> com.cvsenterpriseiphone.cvspharmacy
xcrun simctl shutdown <udid>

# Android
adb uninstall com.cvs.android
adb emu kill
```

## App ID Migration (Historical)

All 200 YAML test files have been migrated from hardcoded app IDs to the `${APP_ID}` environment variable, enabling single-codebase multi-platform testing.

**Before:**
```yaml
appId: com.cvsenterpriseiphone.cvspharmacy
```

**After:**
```yaml
appId: ${APP_ID}
```

**Scope:** 150+ flow files, 50+ test files, and 3 config files (config.yaml, config.qa.yaml, config.prod.yaml) across all feature directories (Account, Benefits, Chatbot, Common, General, Health, MCCore, NGS, Pharmacy, Shop, SuperApp, VM).

To verify no hardcoded app IDs remain:
```bash
# Should return no results (or only config default values)
grep -r "appId: com.cvsenterpriseiphone.cvspharmacy" .maestro/
grep -r "appId: com.cvs.launchers.cvs" .maestro/
```

---

## Summary

✅ **iOS Build** - CocoaPods → Xcodebuild → Install → Test  
✅ **Android Build** - Gradle → Install → Test  
✅ **Automated Scripts** - Complete build and test workflows  
✅ **Diagnostic Tools** - Verify, diagnose, and fix issues  
✅ **Performance** - Optimizations for faster builds and tests  
✅ **Best Practices** - Clean, verify, log, and clean up  

Use automated scripts for simplicity, or follow manual steps for more control.
