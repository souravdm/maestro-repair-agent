# Diagnostics and Auto-Fix Guide

## Overview

The Maestro test framework includes comprehensive diagnostic tools with **automatic issue resolution** capabilities. When you run diagnostics with the `--fix` flag, common problems are automatically detected and fixed.

---

## Table of Contents

1. [Diagnostic Scripts](#diagnostic-scripts)
2. [Auto-Fix Capabilities](#auto-fix-capabilities)
3. [Usage Examples](#usage-examples)
4. [What Gets Fixed Automatically](#what-gets-fixed-automatically)
5. [Manual Intervention Required](#manual-intervention-required)
6. [Integration with Build Workflow](#integration-with-build-workflow)
7. [Troubleshooting](#troubleshooting)

---

## Diagnostic Scripts

### 1. `scripts/setup/diagnose.sh`
Comprehensive diagnostic tool with auto-fix for iOS, Android, app, and credentials issues.

### 2. `scripts/build/detect-build-config.sh`
Build configuration detector with auto-creation of missing config files.

---

## Auto-Fix Capabilities

### iOS Issues

#### 1. **Missing CocoaPods**
**Problem:** CocoaPods not installed  
**Auto-Fix:** Installs CocoaPods via `gem install cocoapods`

```bash
❌ CocoaPods not found
🔧 Installing CocoaPods...
✅ CocoaPods installed successfully
```

#### 2. **Missing Podfile**
**Problem:** Podfile not found in project directory  
**Auto-Fix:** 
- Checks if project exists in `~/.maestro-builds/ios/digital-flagship-ios`
- Runs `pod init` to create default Podfile

```bash
❌ Podfile not found
🔧 Checking if project exists...
🔧 Initializing Podfile...
✅ Podfile created
```

#### 3. **Missing Pods Directory**
**Problem:** Dependencies not installed  
**Auto-Fix:** Runs `pod install --repo-update` to install all dependencies

```bash
⚠️  Pods directory not found
🔧 Installing CocoaPods dependencies...
✅ Pods installed successfully
```

#### 4. **Missing Xcode Workspace**
**Problem:** `.xcworkspace` not found  
**Auto-Fix:** Automatically created when `pod install` runs

```bash
❌ Xcode workspace not found
⚠️  Workspace is created by 'pod install' - run with --fix to install Pods
```

#### 5. **No Simulator Running**
**Problem:** No iOS simulator booted  
**Auto-Fix:** Boots iPhone 17 Pro (or 16/15 Pro as fallback)

```bash
⚠️  No simulators running
🔧 Booting iPhone 17 Pro simulator...
✅ Simulator booted successfully
```

### Build Configuration Issues

#### 6. **Missing build_config.yaml**
**Problem:** Build configuration file not found  
**Auto-Fix:** Creates default `config/build_config.yaml` with proper structure

```bash
🔧 Creating build_config.yaml...
✅ Created build_config.yaml with default configuration
```

**Generated file:**
```yaml
# Build Configuration
configuration: "debug"

ios:
  scheme: "CVSOnlineiPhone"
  configuration: "Debug"
  sdk: "iphonesimulator"
  
android:
  buildType: "debug"
  flavor: "dev"

environment:
  debug:
    api_url: "https://api-dev.cvs.com"
  qa:
    api_url: "https://api-qa.cvs.com"
  qa2:
    api_url: "https://api-qa2.cvs.com"
  prod:
    api_url: "https://api.cvs.com"
```

---

## Usage Examples

### Run Diagnostics with Auto-Fix

```bash
# Fix all issues
./scripts/setup/diagnose.sh all --fix

# Fix only iOS issues
./scripts/setup/diagnose.sh ios --fix

# Fix only Android issues
./scripts/setup/diagnose.sh android --fix

# Just diagnose (no fixes)
./scripts/setup/diagnose.sh all
```

### Complete iOS Setup from Scratch

```bash
# 1. Run diagnostic with auto-fix
./scripts/setup/diagnose.sh ios --fix

# This will automatically:
# ✅ Install CocoaPods if missing
# ✅ Create Podfile if missing
# ✅ Install Pods dependencies
# ✅ Create Xcode workspace
# ✅ Boot simulator

# 2. Build the app
./scripts/build.sh ios repo

# 3. Run tests
./scripts/testing/test.sh .maestro/flows/Account/login-and-logout.yaml
```

### Fix Broken iOS Build

```bash
# If your build is broken, run:
./scripts/setup/diagnose.sh ios --fix

# Common fixes:
# - Reinstalls Pods if corrupted
# - Recreates workspace
# - Boots simulator if needed
```

### Quick Health Check

```bash
# Check everything without fixing
./scripts/setup/diagnose.sh all

# Review the output to see what needs attention
# Then run with --fix to resolve issues
./scripts/setup/diagnose.sh all --fix
```

---

## What Gets Fixed Automatically

| Issue | Detection | Auto-Fix Action |
|-------|-----------|-----------------|
| CocoaPods not installed | `command -v pod` fails | `gem install cocoapods` |
| Podfile missing | File not found | `pod init` |
| Pods not installed | Directory missing | `pod install --repo-update` |
| Workspace missing | `.xcworkspace` not found | Created by `pod install` |
| Simulator not running | No booted devices | `xcrun simctl boot "iPhone 17 Pro"` |
| build_config.yaml missing | File not found | Create default config |

---

## Manual Intervention Required

Some issues cannot be auto-fixed and require manual action:

### 1. **Xcode Not Installed**
```bash
❌ Xcode not found
```
**Solution:** Install Xcode from App Store

### 2. **Android SDK Not Installed**
```bash
❌ Android SDK not found
```
**Solution:** Install Android Studio or SDK tools

### 3. **No iOS Simulators Available**
```bash
❌ No simulators found
```
**Solution:** Install iOS simulators via Xcode preferences

### 4. **Project Repository Not Cloned**
```bash
⚠️  Project directory not found - clone repo first
```
**Solution:** Run `./scripts/build.sh ios repo` to clone

---

## Integration with Build Workflow

The auto-fix can be integrated into your build workflow:

```bash
# In scripts/build.sh or scripts/testing/test.sh
# Run diagnostic with auto-fix before building
./scripts/setup/diagnose.sh ios --fix

# Then proceed with build
xcodebuild -workspace ...
```

### CI/CD Integration

```bash
# Ensure environment is ready in CI/CD pipeline
./scripts/setup/diagnose.sh all --fix || exit 1

# Run tests
./scripts/testing/test.sh --suite smoke
```

---

## Diagnostic Output

### Before Auto-Fix
```
[3/7] Podfile
❌ Podfile not found

[4/7] Pods directory
⚠️  Pods directory not found

[5/7] Xcode workspace
❌ Xcode workspace not found

[7/7] Simulator status
⚠️  No simulators running
```

### After Auto-Fix
```
[3/7] Podfile
✓ Podfile found

[4/7] Pods directory
✓ Pods directory exists

[5/7] Xcode workspace
✓ Xcode workspace found: CVSOnlineiPhone.xcworkspace

[7/7] Simulator status
✓ 1 simulator(s) running
```

---

## Troubleshooting

### Auto-fix not working

**Check permissions:**
```bash
# CocoaPods installation requires sudo
sudo gem install cocoapods
```

**Check project location:**
```bash
# Verify project exists
ls -la ~/.maestro-builds/ios/digital-flagship-ios
```

**Check for errors:**
```bash
# Run with verbose output
./scripts/setup/diagnose.sh ios --fix 2>&1 | tee diagnostic.log
```

### Pods installation fails

```bash
# Clear CocoaPods cache
pod cache clean --all

# Update CocoaPods repo
pod repo update

# Try manual installation
cd ~/.maestro-builds/ios/digital-flagship-ios
pod install --repo-update --verbose
```

### Simulator won't boot

```bash
# Kill existing simulator processes
killall Simulator

# Reset simulator
xcrun simctl shutdown all
xcrun simctl erase all

# Try booting manually
xcrun simctl boot "iPhone 17 Pro"
```

---

## Diagnostic Types

### All Diagnostics
```bash
./scripts/setup/diagnose.sh all
```
Runs all diagnostic checks:
- Android SDK and emulator setup
- iOS simulator and build setup
- App launch and configuration
- Credentials and environment

### iOS Diagnostics
```bash
./scripts/setup/diagnose.sh ios
```
Checks:
1. Xcode installation
2. CocoaPods installation
3. Podfile existence
4. Pods directory
5. Xcode workspace
6. iOS simulators
7. Simulator status

### Android Diagnostics
```bash
./scripts/setup/diagnose.sh android
```
Checks:
1. Android SDK
2. adb command
3. emulator command
4. adb server
5. Connected devices
6. Available emulators
7. PATH configuration
8. APP_ID

### App Diagnostics
```bash
./scripts/setup/diagnose.sh app
```
Checks:
1. Maestro installation
2. Test flows directory
3. Configuration files
4. Build scripts
5. Reports directory

### Credentials Diagnostics
```bash
./scripts/setup/diagnose.sh credentials
```
Checks:
1. Environment variables
2. Test user credentials
3. Encrypted credentials
4. Configuration files
5. Shell configuration
6. Maestro wrapper function

---

## Best Practices

1. **Run diagnostics before building**
   ```bash
   ./scripts/setup/diagnose.sh ios --fix
   ./scripts/build.sh ios repo
   ```

2. **Use --fix for CI/CD pipelines**
   ```bash
   # Ensure environment is ready
   ./scripts/setup/diagnose.sh all --fix || exit 1
   ```

3. **Check specific issues**
   ```bash
   # Only fix iOS issues
   ./scripts/setup/diagnose.sh ios --fix
   
   # Only check Android (no fix)
   ./scripts/setup/diagnose.sh android
   ```

4. **Review before fixing**
   ```bash
   # First, see what's wrong
   ./scripts/setup/diagnose.sh all
   
   # Then fix issues
   ./scripts/setup/diagnose.sh all --fix
   ```

---

## Summary

The diagnostic scripts provide:

✅ **Automatic detection** of common setup issues  
✅ **One-command fixes** for most problems  
✅ **Clear feedback** on what was fixed  
✅ **Safe defaults** for configuration  
✅ **No manual intervention** for routine issues  

Just run `./scripts/setup/diagnose.sh all --fix` and most setup problems will be resolved automatically!

---

## Related Documentation

- [Environment Setup](../guides/ENVIRONMENT_SETUP.md) - Initial setup guide
- [First Time Setup](../guides/FIRST_TIME_SETUP.md) - Complete setup walkthrough
- [Troubleshooting](../guides/TROUBLESHOOTING_COMMON_ISSUES.md) - Common issues and solutions
- [Build and Installation](../guides/BUILD_AND_INSTALLATION.md) - Build process details
