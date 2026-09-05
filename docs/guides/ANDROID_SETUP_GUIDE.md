# Android Setup & Testing Guide

Complete guide for setting up Android SDK, emulator, building the app, and running Maestro tests on Android devices.

## Table of Contents

1. [Quick Start](#quick-start)
2. [Complete Setup](#complete-setup)
3. [Android SDK Installation](#android-sdk-installation)
4. [Emulator Setup](#emulator-setup)
5. [Building & Installing the App](#building--installing-the-app)
6. [Running Tests](#running-tests)
7. [Troubleshooting](#troubleshooting)
8. [Reference](#reference)

---

## Quick Start

### For Users with Android Studio Already Installed

```bash
# 1. Configure Android SDK PATH
source ~/.zshrc

# 2. Verify installation
bash scripts/android-setup.sh verify

# 3. Create emulator (if needed)
bash scripts/android-setup.sh create

# 4. Run test
bash scripts/testing/test.sh .maestro/flows/Account/test_simple_login.yaml --platform android
```

### For New Users

```bash
# 1. Download and install Android SDK
bash scripts/android-setup.sh download
bash scripts/android-setup.sh setup
source ~/.zshrc

# 2. Install SDK components
bash scripts/android-setup.sh install

# 3. Verify installation
bash scripts/android-setup.sh verify

# 4. Create emulator
bash scripts/android-setup.sh create

# 5. Boot emulator
bash scripts/android-setup.sh boot

# 6. Run test
bash scripts/testing/test.sh .maestro/flows/Account/test_simple_login.yaml --platform android
```

---

## Complete Setup

### Step 1: Download Android SDK Command-line Tools

```bash
bash scripts/android-setup.sh download
```

**What it does:**
- Downloads official Android SDK command-line tools from Google
- Extracts to `~/Library/Android/sdk/cmdline-tools/latest/`
- No Homebrew required (Homebrew formula is discontinued)

**Time:** 2-5 minutes

### Step 2: Configure PATH

```bash
bash scripts/android-setup.sh setup
source ~/.zshrc
```

**What it does:**
- Adds Android SDK tools to `~/.zshrc`
- Configures `ANDROID_HOME` environment variable
- Makes `sdkmanager`, `avdmanager`, `adb`, `emulator` available

**Verification:**
```bash
which sdkmanager
which adb
which emulator
```

### Step 3: Install SDK Components

```bash
bash scripts/android-setup.sh install
```

**What it installs:**
- ✅ Android SDK Platform 34
- ✅ Android SDK Build-Tools 34.0.0
- ✅ Android Emulator
- ✅ Android SDK Platform-Tools
- ✅ Accepts SDK licenses automatically

**Time:** 5-10 minutes (depends on internet speed)

### Step 4: Verify Installation

```bash
bash scripts/android-setup.sh verify
```

**Checks:**
- ✅ Android SDK directory
- ✅ sdkmanager availability
- ✅ avdmanager availability
- ✅ adb availability
- ✅ emulator availability
- ✅ SDK Platform 34
- ✅ Build-Tools 34.0.0

### Step 5: Create Android Emulator

```bash
bash scripts/android-setup.sh create [emulator_name]
```

**Examples:**
```bash
bash scripts/android-setup.sh create                    # Creates Pixel_6_API_34
bash scripts/android-setup.sh create Pixel_9_Pro_XL    # Creates custom emulator
```

**What it does:**
- Downloads Android API 34 system image
- Creates Pixel 6 emulator (or custom name)
- Verifies emulator creation

**Time:** 5-10 minutes

### Step 6: Boot Emulator

```bash
bash scripts/android-setup.sh boot [emulator_name]
```

**What it does:**
- Starts emulator automatically
- Waits for full boot (up to 120 seconds)
- Verifies device is responsive

**Manual boot:**
```bash
emulator -avd Pixel_6_API_34 -no-snapshot-load &
```

---

## Android SDK Installation

### Official Installation Method

Since `brew install android-sdk` is discontinued, use the official method:

```bash
bash scripts/android-setup.sh download
```

This downloads from: `https://dl.google.com/android/repository/commandlinetools-mac-11076708_latest.zip`

### Manual Installation (Alternative)

1. Visit: https://developer.android.com/studio/command-line-tools
2. Download "Command line tools for macOS"
3. Extract to: `~/Library/Android/sdk/cmdline-tools/latest/`
4. Run: `bash scripts/android-setup.sh setup`

### Using Android Studio

If you have Android Studio installed:

1. Open Android Studio
2. Tools → SDK Manager
3. Install:
   - Android SDK Platform 34
   - Android SDK Build-Tools 34.0.0
   - Android Emulator
   - Android SDK Platform-Tools
   - Android SDK Command-line Tools
4. Run: `bash scripts/android-setup.sh setup`

---

## Emulator Setup

### Available Emulators

List all available emulators:
```bash
emulator -list-avds
```

### Create Custom Emulator

```bash
bash scripts/android-setup.sh create MyCustomEmulator
```

### Boot Emulator

```bash
bash scripts/android-setup.sh boot MyEmulator
```

Or manually:
```bash
emulator -avd MyEmulator -no-snapshot-load &
```

### Check Connected Devices

```bash
adb devices
```

### Emulator Properties

Check emulator is responsive:
```bash
adb shell getprop ro.boot.serialno
```

---

## Building & Installing the App

To run Maestro tests on Android, you need to build and install the CVS Pharmacy Android app on the emulator.

### Method 1: Build from GitHub Repository (Recommended)

This method clones the official CVS Pharmacy Android repository and builds the app.

**Prerequisites:**
- Artifactory credentials configured (see [ANDROID_BUILD_CREDENTIALS.md](ANDROID_BUILD_CREDENTIALS.md))

```bash
bash scripts/build.sh android repo main
```

**What this does:**
- Clones the Android repository from GitHub
- Builds the debug APK
- Installs it on the connected emulator
- Takes 5-15 minutes depending on internet speed

**Note:** If you get "Missing cvsJfrogUsername gradle property" error, see [ANDROID_BUILD_CREDENTIALS.md](ANDROID_BUILD_CREDENTIALS.md) for setup instructions.

### Method 2: Build from Local Workspace

If you have the Android source code locally:

```bash
bash scripts/build.sh android local
```

**Prerequisites:**
- Android source code in local workspace
- `build.gradle` file present
- Gradle configured

### Method 3: Manual APK Installation

If you have a pre-built APK file:

```bash
# Install APK on emulator
adb install path/to/app.apk

# Verify installation
adb shell pm list packages | grep cvs
```

### Method 4: Build Using Android Studio

If you prefer to use Android Studio:

1. Open Android Studio
2. File → Open → Select Android repository directory
3. Click "Build" → "Build Bundle(s) / APK(s)" → "Build APK(s)"
4. Wait for build to complete
5. Install on emulator:
   ```bash
   adb install app/build/outputs/apk/debug/app-debug.apk
   ```

### Verify App Installation

```bash
# Check if app is installed
adb shell pm list packages | grep cvs

# Expected output:
# package:com.cvs.launchers.cvs

# Check app version
adb shell dumpsys package com.cvs.launchers.cvs | grep versionName

# Launch app manually
adb shell am start -n com.cvs.launchers.cvs/.MainActivity
```

---

## Running Tests

### Basic Test Run

```bash
bash scripts/testing/test.sh .maestro/flows/Account/test_simple_login.yaml --platform android
```

### Run All Tests in Directory

```bash
bash scripts/testing/test.sh .maestro/flows/ --platform android
```

### Run Without Device Setup

```bash
bash scripts/testing/test.sh .maestro/flows/test.yaml --platform android --skip-setup
```

### Run Without Report Generation

```bash
bash scripts/testing/test.sh .maestro/flows/test.yaml --platform android --no-report
```

### Run Without Opening Browser

```bash
bash scripts/testing/test.sh .maestro/flows/test.yaml --platform android --no-browser
```

### What Happens Automatically

1. ✅ Emulator boots (if not running)
2. ✅ Waits for full boot
3. ✅ Verifies device is responsive
4. ✅ Runs Maestro tests
5. ✅ Generates HTML report
6. ✅ Opens report in browser

---

## Troubleshooting

### Issue: "Unable to launch app undefined"

**Cause:** APP_ID environment variable not being passed to Maestro, or app not installed

**Solution:**
```bash
# 1. Build and install the app
bash scripts/build.sh android repo main

# 2. Verify installation
adb shell pm list packages | grep cvs

# 3. Run test (APP_ID will be passed automatically)
maestro test .maestro/flows/Account/test_simple_login.yaml --platform android
```

**Note:** The test.sh script now automatically passes the APP_ID environment variable to Maestro, allowing `${APP_ID}` to be properly expanded in test flows.

### Issue: "0 devices connected"

**Cause:** Emulator not running or not detected

**Solution:**
```bash
# Check if emulator is running
adb devices

# Start emulator manually
emulator -avd Pixel_9_Pro_XL -no-snapshot-load &

# Wait 30-60 seconds for boot
sleep 60

# Check again
adb devices
```

### Issue: "build.gradle not found"

**Cause:** Building from local workspace but source code not present

**Solution:**
```bash
# Build from GitHub repository instead
bash scripts/build.sh android repo main
```

### Issue: "Gradle build failed"

**Cause:** Missing dependencies or build configuration issues

**Solution:**
```bash
# Clean and rebuild
bash scripts/build.sh android repo main
```

### Issue: "App not installing"

**Cause:** Emulator not running or adb connection issue

**Solution:**
```bash
# Check emulator is running
adb devices

# If not running, boot it
bash scripts/android-setup.sh boot

# Try installation again
bash scripts/build.sh android repo main
```

### Issue: "Permission denied" during build

**Cause:** Insufficient permissions

**Solution:**
```bash
# Fix permissions
chmod -R u+w ~/Library/Android/sdk

# Try again
bash scripts/build.sh android repo main
```

### Issue: "Missing cvsJfrogUsername gradle property"

**Cause:** Artifactory credentials not configured

**Solution:** See [ANDROID_BUILD_CREDENTIALS.md](ANDROID_BUILD_CREDENTIALS.md) for detailed setup instructions.

Quick fix:
```bash
# 1. Create gradle.properties file
mkdir -p ~/.gradle
touch ~/.gradle/gradle.properties

# 2. Add your credentials
echo "cvsJfrogUsername=YOUR_USERNAME" >> ~/.gradle/gradle.properties
echo "cvsJfrogPassword=YOUR_API_TOKEN" >> ~/.gradle/gradle.properties

# 3. Replace YOUR_USERNAME and YOUR_API_TOKEN with your actual credentials
# Get credentials from: https://cvsdigital.atlassian.net/wiki/spaces/DRE/pages/2763063926/Setting+up+local+Artifactory+credentials

# 4. Try building again
bash scripts/build.sh android repo main
```

### Issue: "sdkmanager not found"

**Cause:** PATH not configured or shell not reloaded

**Solution:**
```bash
# Reload shell
source ~/.zshrc

# Verify
which sdkmanager

# If still not found, run setup
bash scripts/android-setup.sh setup
source ~/.zshrc
```

### Issue: "emulator: command not found"

**Cause:** Emulator not in PATH

**Solution:**
```bash
# Reload shell
source ~/.zshrc

# Verify
which emulator

# If still not found, check installation
bash scripts/android-setup.sh verify
```

### Issue: "No emulators available"

**Cause:** No emulator created yet

**Solution:**
```bash
# Create emulator
bash scripts/android-setup.sh create

# Verify creation
emulator -list-avds
```

### Issue: Emulator boots but tests fail

**Cause:** Emulator not fully responsive

**Solution:**
```bash
# Check if device is responsive
adb shell getprop ro.boot.serialno

# If no output, wait longer and try again
sleep 30
adb shell getprop ro.boot.serialno

# If still failing, restart adb
adb kill-server
adb start-server
adb devices
```

### Issue: "No space left on device"

**Cause:** Android SDK requires ~10GB

**Solution:**
```bash
# Check available space
df -h

# Free up space or use external drive
```

### Issue: Permission denied

**Cause:** Write permissions issue

**Solution:**
```bash
# Fix permissions
chmod -R u+w ~/Library/Android/sdk
```

---

## Diagnostics

### Run Full Diagnostic

```bash
bash scripts/diagnose.sh all
```

### Run Specific Diagnostic

```bash
bash scripts/diagnose.sh android    # Android setup
bash scripts/diagnose.sh app        # App configuration
bash scripts/diagnose.sh credentials # Credentials
```

### Manual Diagnostic Commands

```bash
# Check Android SDK
echo $ANDROID_HOME

# Check PATH
echo $PATH | grep -o "[^:]*android[^:]*"

# Check adb
adb version

# Check emulator
emulator -version

# Check available emulators
emulator -list-avds

# Check connected devices
adb devices

# Check device properties
adb shell getprop
```

---

## Reference

### Environment Variables

```bash
# Set in ~/.zshrc
export ANDROID_HOME=$HOME/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/cmdline-tools/latest/bin
export PATH=$PATH:$ANDROID_HOME/emulator
export PATH=$PATH:$ANDROID_HOME/platform-tools
```

### Directory Structure

```
~/Library/Android/sdk/
├── cmdline-tools/
│   └── latest/
│       ├── bin/
│       │   ├── sdkmanager
│       │   └── avdmanager
│       └── lib/
├── platforms/
│   └── android-34/
├── build-tools/
│   └── 34.0.0/
├── emulator/
│   └── emulator
├── platform-tools/
│   └── adb
└── system-images/
    └── android-34/
        └── google_apis/
            └── x86_64/
```

### Consolidated Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `android-setup.sh` | Android SDK & emulator | `./android-setup.sh <action>` |
| `ios-setup.sh` | iOS simulator & build | `./ios-setup.sh <action>` |
| `test.sh` | Run tests | `./test.sh <test_path> [options]` |
| `build.sh` | Build apps | `./build.sh <platform> [type]` |
| `diagnose.sh` | Diagnose issues | `./diagnose.sh [type]` |
| `utils.sh` | Testing utilities | `./utils.sh <utility>` |

### Common Commands

```bash
# Setup
bash scripts/android-setup.sh download
bash scripts/android-setup.sh setup
source ~/.zshrc
bash scripts/android-setup.sh install
bash scripts/android-setup.sh verify

# Emulator
bash scripts/android-setup.sh create
bash scripts/android-setup.sh boot
emulator -list-avds
adb devices

# Testing
bash scripts/testing/test.sh .maestro/flows/test.yaml --platform android
bash scripts/diagnose.sh android

# Utilities
bash scripts/utils.sh verify-creds
bash scripts/utils.sh capture-logs
```

### APP_ID Configuration

Android app ID: `com.cvs.launchers.cvs`

Set in environment:
```bash
export APP_ID=com.cvs.launchers.cvs
```

Or update in `~/.zshrc`:
```bash
echo 'export APP_ID=com.cvs.launchers.cvs' >> ~/.zshrc
source ~/.zshrc
```

---

## Complete Setup Time

- Download SDK: 2-5 minutes
- Configure PATH: 1 minute
- Install components: 5-10 minutes
- Create emulator: 5-10 minutes
- Boot emulator: 1-2 minutes
- Run first test: 1-2 minutes

**Total: 15-30 minutes (first time only)**

---

## Next Steps

1. Run: `bash scripts/android-setup.sh download`
2. Run: `bash scripts/android-setup.sh setup`
3. Run: `source ~/.zshrc`
4. Run: `bash scripts/android-setup.sh install`
5. Run: `bash scripts/android-setup.sh verify`
6. Run: `bash scripts/android-setup.sh create`
7. Run: `bash scripts/testing/test.sh .maestro/flows/Account/test_simple_login.yaml --platform android`

---

## Support

For issues or questions:
1. Run: `bash scripts/diagnose.sh all`
2. Check troubleshooting section above
3. Review logs in `test-reports/` directory
4. Check `scripts/CONSOLIDATION_SUMMARY.md` for script reference

---

**You're all set! Your Android testing environment is ready to use.** 🚀
