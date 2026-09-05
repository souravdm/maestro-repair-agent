# First Time Setup Guide

This guide walks you through the first-time setup of the Maestro UI Tests framework.

## Understanding the Project Structure

The test framework is **separate** from the iOS/Android app source code:

```
Your Machine:
├── MaestroUITests/                    # Test framework (this repo)
│   ├── .maestro/flows/                # Test flows
│   ├── scripts/                       # Test scripts
│   └── docs/                          # Documentation
│
└── ~/.maestro-builds/                 # Built apps (created during build)
    ├── ios/
    │   └── digital-flagship-ios/      # iOS app source (cloned from GitHub)
    └── android/
        └── digital-flagship-android/  # Android app source (cloned from GitHub)
```

## Step 1: Clone Test Framework

```bash
git clone https://github.com/cvs-health-source-code/maestro-ui-tests.git
cd MaestroUITests
```

## Step 2: Install Dependencies

```bash
# Install Maestro CLI
brew install maestro

# Verify Maestro
maestro --version

# Install Node.js dependencies
npm install

# Verify Node.js
node --version  # Should be 16+
```

## Step 3: Run Diagnostics

```bash
# Check your environment
./scripts/setup/diagnose.sh
```

**Expected Output for First Time:**

```
❌ Podfile not found
❌ Pods directory not found
❌ Xcode workspace not found
```

**This is NORMAL!** The iOS app source code hasn't been cloned yet. It will be cloned when you build the app.

## Step 4: Build the App (This Clones the Source Code)

### For iOS:

```bash
# Build from GitHub repository
./scripts/build/build.sh ios repo

# This will:
# 1. Clone digital-flagship-ios to ~/.maestro-builds/ios/
# 2. Install CocoaPods dependencies
# 3. Build the app for iOS Simulator
```

**First build takes 10-15 minutes** (downloading dependencies, building).

### For Android:

```bash
# Build from GitHub repository
./scripts/build/build.sh android repo

# This will:
# 1. Clone digital-flagship-android to ~/.maestro-builds/android/
# 2. Install Gradle dependencies
# 3. Build the app for Android Emulator
```

## Step 5: Verify Build Success

After build completes, run diagnostics again:

```bash
./scripts/setup/diagnose.sh
```

**Expected Output After Build:**

```
✓ Podfile found
✓ Pods directory found
✓ Xcode workspace found
```

## Step 6: Activate `maestro test` (PATH Setup)

The framework ships with a `bin/maestro` wrapper so you can type plain `maestro test` instead of `./scripts/testing/test.sh`. The setup script adds `bin/` to your shell profile automatically:

```bash
# Run boot — this sets up the simulator AND updates ~/.zshrc once
./scripts/setup/ios-setup.sh boot

# Apply to your current shell
source ~/.zshrc

# Verify the wrapper is active (should show the project bin/ path)
which maestro
```

After this, `maestro` in any terminal tab will use the project wrapper.

## Step 7: Run Your First Test

```bash
# App already on simulator? Use --skip-setup for a fast run
mastero test .maestro/flows/Account/login-and-logout.yaml --skip-setup

# Let the wrapper auto-build & install the app if missing (default behaviour)
mastero test .maestro/flows/Account/login-and-logout.yaml

# View the report
open test-reports/test-report-latest.html
```

## Troubleshooting First Time Setup

### Issue: "Podfile not found" after running diagnose.sh

**Solution:** This is normal on first run. The iOS app source code is cloned during the build process.

```bash
# Build the app (this clones the source code)
./scripts/build/build.sh ios repo

# Then run diagnostics again
./scripts/setup/diagnose.sh
```

### Issue: Build fails with "CocoaPods not installed"

**Solution:** Install CocoaPods

```bash
brew install cocoapods
pod setup
```

### Issue: Build fails with "Xcode not found"

**Solution:** Install Xcode command line tools

```bash
xcode-select --install

# Or set Xcode path
sudo xcode-select --switch /Applications/Xcode.app/Contents/Developer
```

### Issue: Build fails with "ANDROID_HOME not set"

**Solution:** Set Android SDK path

```bash
# Add to ~/.zshrc
export ANDROID_HOME=~/Library/Android/sdk
export PATH=$PATH:$ANDROID_HOME/emulator:$ANDROID_HOME/tools/bin

# Reload shell
source ~/.zshrc

# Verify
echo $ANDROID_HOME
```

## What Gets Created During First Build

After running `./scripts/build/build.sh ios repo`, these directories are created:

```
~/.maestro-builds/
└── ios/
    └── digital-flagship-ios/          # iOS app source code
        ├── CVSOnlineiPhone.xcworkspace
        ├── Podfile
        ├── Pods/
        └── ... (app source files)
```

The test framework can now:
- ✅ Access the Podfile
- ✅ Access the Xcode workspace
- ✅ Inject NetworkLogger into the app
- ✅ Build and test the app

## Next Steps

1. ✅ Clone test framework
2. ✅ Install dependencies
3. ✅ Run diagnostics (expect failures on first run)
4. ✅ Build the app (clones source code)
5. ✅ Run diagnostics again (should pass)
6. ✅ Run `./scripts/setup/ios-setup.sh boot` → PATH injected into `~/.zshrc`
7. ✅ Run your first test with plain `maestro test <flow>`
8. ✅ View the HTML report

## Quick Reference

```bash
# One-time setup
git clone https://github.com/cvs-health-source-code/maestro-ui-tests.git
cd MaestroUITests
brew install maestro
npm install

# Boot simulator — also injects bin/ into PATH automatically
./scripts/setup/ios-setup.sh boot
source ~/.zshrc

# Build the app (first time — skipped on subsequent runs if already installed)
./scripts/build/build.sh ios repo

# Run tests (wrapper handles APP_ID, credentials, reports)
mastero test .maestro/flows/Account/login-and-logout.yaml

# Already installed? Skip the build/install check
mastero test .maestro/flows/Account/login-and-logout.yaml --skip-setup

# View report
open test-reports/test-report-latest.html
```

## FAQ

**Q: Why is the app source code separate?**
A: The test framework is open source, but the app source code is proprietary. They're kept in separate repositories.

**Q: Will the app be re-cloned every time I run tests?**
A: No. After the first build, the source code is cached at `~/.maestro-builds/`. Subsequent builds use the cached version.

**Q: Can I use a local copy of the app source?**
A: Yes, use `./scripts/build/build.sh ios local` if you have the app source code locally.

**Q: What if I want to update the app source code?**
A: The build script will automatically pull the latest changes from the specified branch.

```bash
./scripts/build/build.sh ios repo main    # Latest from main
./scripts/build/build.sh ios repo develop # Latest from develop
```

**Q: How do I know the build succeeded?**
A: Run diagnostics and check for the Podfile and Xcode workspace:

```bash
./scripts/setup/diagnose.sh
```

All checks should pass (✓) after a successful build.
