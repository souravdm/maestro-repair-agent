#!/bin/bash

###############################################################################
# Maestro Testing Environment Diagnostic - Consolidated Script
# Handles: Android setup, iOS build, app launch, credentials diagnostics
# Merged from: diagnose-android-setup.sh, diagnose-app-launch.sh,
#              diagnose-credentials.sh, verify-credentials.sh
###############################################################################

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# If PROJECT_ROOT is still not correct, try alternative method
if [ ! -d "$PROJECT_ROOT/.maestro" ]; then
  # Try going up one more level
  PROJECT_ROOT="$(dirname "$PROJECT_ROOT")"
fi

DIAGNOSTIC="${1:-all}"
AUTO_FIX="${2:-false}"

case "$DIAGNOSTIC" in
  all|android|ios|app|credentials|npm)
    ;;
  *)
    echo -e "${BLUE}Maestro Testing Environment Diagnostic${NC}"
    echo ""
    echo "Usage: $0 [diagnostic_type] [--fix]"
    echo ""
    echo "Diagnostic types:"
    echo "  all         - Run all diagnostics (default)"
    echo "  npm         - NPM workspace dependencies"
    echo "  android     - Android SDK and emulator setup"
    echo "  ios        - iOS simulator and build setup"
    echo "  app        - App launch and configuration"
    echo "  credentials - Test credentials and environment"
    echo ""
    echo "Options:"
    echo "  --fix       - Automatically fix detected issues"
    echo ""
    echo "Examples:"
    echo "  $0"
    echo "  $0 all --fix"
    echo "  $0 ios --fix"
    echo "  $0 android"
    exit 1
    ;;
esac

# Check for --fix flag
if [ "$2" = "--fix" ] || [ "$1" = "--fix" ]; then
  AUTO_FIX="true"
fi

# ============================================================================
# ANDROID DIAGNOSTIC
# ============================================================================
run_android_diagnostic() {
  echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║         Android Setup Diagnostic Report                    ║${NC}"
  echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
  echo ""

  export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
  export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$PATH"

  echo -e "${BLUE}[1/8] Android SDK${NC}"
  if [ -d "$ANDROID_HOME" ]; then
    echo -e "${GREEN}✓ Found at: $ANDROID_HOME${NC}"
  else
    echo -e "${RED}❌ Not found${NC}"
  fi
  echo ""

  echo -e "${BLUE}[2/8] adb${NC}"
  if command -v adb &> /dev/null; then
    echo -e "${GREEN}✓ Found: $(which adb)${NC}"
  else
    echo -e "${RED}❌ Not found${NC}"
  fi
  echo ""

  echo -e "${BLUE}[3/8] emulator command${NC}"
  if command -v emulator &> /dev/null; then
    echo -e "${GREEN}✓ Found: $(which emulator)${NC}"
  else
    echo -e "${RED}❌ Not found${NC}"
  fi
  echo ""

  echo -e "${BLUE}[4/8] adb server${NC}"
  if adb devices > /dev/null 2>&1; then
    echo -e "${GREEN}✓ adb server running${NC}"
  else
    echo -e "${RED}❌ adb server error${NC}"
  fi
  echo ""

  echo -e "${BLUE}[5/8] Connected devices${NC}"
  DEVICES=$(adb devices 2>/dev/null | grep "device$" | awk '{print $1}')
  if [ -n "$DEVICES" ]; then
    echo -e "${GREEN}✓ Devices connected:${NC}"
    echo "$DEVICES" | sed 's/^/  - /'
  else
    echo -e "${RED}❌ No devices connected${NC}"
  fi
  echo ""

  echo -e "${BLUE}[6/8] Available emulators${NC}"
  EMULATORS=$(emulator -list-avds 2>/dev/null)
  if [ -n "$EMULATORS" ]; then
    echo -e "${GREEN}✓ Available:${NC}"
    echo "$EMULATORS" | sed 's/^/  - /'
  else
    echo -e "${YELLOW}⚠️  No emulators found${NC}"
  fi
  echo ""

  echo -e "${BLUE}[7/8] PATH configuration${NC}"
  if echo "$PATH" | grep -q "platform-tools"; then
    echo -e "${GREEN}✓ platform-tools in PATH${NC}"
  else
    echo -e "${YELLOW}⚠️  platform-tools not in PATH${NC}"
  fi
  echo ""

  echo -e "${BLUE}[8/8] APP_ID${NC}"
  if [ -n "$APP_ID" ]; then
    echo -e "${GREEN}✓ APP_ID set: $APP_ID${NC}"
  else
    echo -e "${YELLOW}⚠️  APP_ID not set (default: com.cvs.launchers.cvs)${NC}"
  fi
  echo ""
}

# ============================================================================
# iOS DIAGNOSTIC
# ============================================================================
run_ios_diagnostic() {
  echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║         iOS Setup Diagnostic Report                        ║${NC}"
  echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
  echo ""

  echo -e "${BLUE}[1/7] Xcode${NC}"
  if command -v xcode-select &> /dev/null; then
    XCODE_PATH=$(xcode-select -p)
    echo -e "${GREEN}✓ Xcode found: $XCODE_PATH${NC}"
  else
    echo -e "${RED}❌ Xcode not found${NC}"
  fi
  echo ""

  echo -e "${BLUE}[2/7] CocoaPods${NC}"
  if command -v pod &> /dev/null; then
    POD_VERSION=$(pod --version)
    echo -e "${GREEN}✓ CocoaPods found: $POD_VERSION${NC}"
  else
    echo -e "${RED}❌ CocoaPods not found${NC}"
    if [ "$AUTO_FIX" = "true" ]; then
      echo -e "${YELLOW}🔧 Installing CocoaPods...${NC}"
      sudo gem install cocoapods --quiet 2>/dev/null
      if command -v pod &> /dev/null; then
        echo -e "${GREEN}✅ CocoaPods installed successfully${NC}"
      else
        echo -e "${RED}❌ Failed to install CocoaPods${NC}"
      fi
    fi
  fi
  echo ""

  echo -e "${BLUE}[3/7] Podfile${NC}"
  BUILD_DIR="$HOME/.maestro-builds/ios/digital-flagship-ios/IOS/CVSOnlineiPhone"
  
  if [ -f "$BUILD_DIR/Podfile" ]; then
    echo -e "${GREEN}✓ Podfile found${NC}"
  elif [ -f "Podfile" ]; then
    echo -e "${GREEN}✓ Podfile found${NC}"
  else
    echo -e "${RED}❌ Podfile not found${NC}"
    if [ "$AUTO_FIX" = "true" ]; then
      echo -e "${YELLOW}⚠️  Podfile should exist in the iOS app repository${NC}"
      echo -e "${YELLOW}   Run: ./scripts/build.sh ios repo${NC}"
      echo -e "${YELLOW}   This will clone the repository with the Podfile${NC}"
    fi
  fi
  echo ""

  echo -e "${BLUE}[4/7] Pods directory${NC}"
  
  if [ -d "$BUILD_DIR/Pods" ]; then
    echo -e "${GREEN}✓ Pods directory exists${NC}"
  elif [ -d "Pods" ]; then
    echo -e "${GREEN}✓ Pods directory exists${NC}"
  else
    echo -e "${YELLOW}⚠️  Pods directory not found${NC}"
    if [ "$AUTO_FIX" = "true" ]; then
      echo -e "${YELLOW}🔧 Installing CocoaPods dependencies...${NC}"
      if [ -d "$BUILD_DIR" ]; then
        cd "$BUILD_DIR" || return
        if [ -f "Podfile" ]; then
          pod install --repo-update 2>&1 | grep -v "^\[" || true
          if [ -d "Pods" ]; then
            echo -e "${GREEN}✅ Pods installed successfully${NC}"
          else
            echo -e "${RED}❌ Failed to install Pods${NC}"
          fi
        else
          echo -e "${YELLOW}⚠️  Podfile not found - cannot install Pods${NC}"
        fi
      fi
    fi
  fi
  echo ""

  echo -e "${BLUE}[5/7] Xcode workspace${NC}"
  
  WORKSPACE_FOUND=false
  if [ -d "$BUILD_DIR" ]; then
    WORKSPACE=$(find "$BUILD_DIR" -maxdepth 1 -name "*.xcworkspace" | head -1)
    if [ -n "$WORKSPACE" ]; then
      echo -e "${GREEN}✓ Xcode workspace found: $(basename "$WORKSPACE")${NC}"
      WORKSPACE_FOUND=true
    fi
  fi
  
  if [ "$WORKSPACE_FOUND" = "false" ]; then
    if [ -d "CVSOnlineiPhone.xcworkspace" ]; then
      echo -e "${GREEN}✓ Xcode workspace found${NC}"
    else
      echo -e "${RED}❌ Xcode workspace not found${NC}"
      if [ "$AUTO_FIX" = "true" ]; then
        echo -e "${YELLOW}⚠️  Workspace is created by 'pod install' - running pod install...${NC}"
        if [ -d "$BUILD_DIR" ] && [ -f "$BUILD_DIR/Podfile" ]; then
          cd "$BUILD_DIR" || return
          pod install --repo-update 2>&1 | grep -v "^\[" || true
          if [ -d "*.xcworkspace" ] || [ -d "CVSOnlineiPhone.xcworkspace" ]; then
            echo -e "${GREEN}✅ Workspace created successfully${NC}"
          else
            echo -e "${RED}❌ Failed to create workspace${NC}"
          fi
        fi
      fi
    fi
  fi
  echo ""

  echo -e "${BLUE}[6/7] iOS simulators${NC}"
  SIMULATORS=$(xcrun simctl list devices available 2>/dev/null | grep "iPhone" | wc -l)
  if [ "$SIMULATORS" -gt 0 ]; then
    echo -e "${GREEN}✓ Found $SIMULATORS simulators${NC}"
  else
    echo -e "${RED}❌ No simulators found${NC}"
  fi
  echo ""

  echo -e "${BLUE}[7/7] Simulator status${NC}"
  RUNNING=$(xcrun simctl list | grep "(Booted)" | wc -l)
  if [ "$RUNNING" -gt 0 ]; then
    echo -e "${GREEN}✓ $RUNNING simulator(s) running${NC}"
  else
    echo -e "${YELLOW}⚠️  No simulators running${NC}"
    if [ "$AUTO_FIX" = "true" ]; then
      echo -e "${YELLOW}🔧 Booting iPhone 17 Pro simulator...${NC}"
      xcrun simctl boot "iPhone 17 Pro" 2>/dev/null || \
      xcrun simctl boot "iPhone 16 Pro" 2>/dev/null || \
      xcrun simctl boot "iPhone 15 Pro" 2>/dev/null || true
      
      sleep 2
      RUNNING=$(xcrun simctl list | grep "(Booted)" | wc -l)
      if [ "$RUNNING" -gt 0 ]; then
        echo -e "${GREEN}✅ Simulator booted successfully${NC}"
      else
        echo -e "${RED}❌ Failed to boot simulator${NC}"
      fi
    fi
  fi
  echo ""
}

# ============================================================================
# APP LAUNCH DIAGNOSTIC
# ============================================================================
run_app_diagnostic() {
  echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║         App Launch Diagnostic Report                       ║${NC}"
  echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
  echo ""

  echo -e "${BLUE}[1/5] Maestro installation${NC}"
  if command -v maestro &> /dev/null; then
    echo -e "${GREEN}✓ Maestro found: $(which maestro)${NC}"
  else
    echo -e "${RED}❌ Maestro not found${NC}"
  fi
  echo ""

  echo -e "${BLUE}[2/5] Test flows directory${NC}"
  if [ -d "$PROJECT_ROOT/.maestro/flows" ]; then
    FLOW_COUNT=$(find "$PROJECT_ROOT/.maestro/flows" -name "*.yaml" | wc -l)
    echo -e "${GREEN}✓ Found $FLOW_COUNT test flows${NC}"
  else
    echo -e "${RED}❌ Test flows directory not found${NC}"
  fi
  echo ""

  echo -e "${BLUE}[3/5] Configuration files${NC}"
  if [ -d "$PROJECT_ROOT/.maestro/config" ]; then
    echo -e "${GREEN}✓ Config directory found${NC}"
  else
    echo -e "${RED}❌ Config directory not found${NC}"
  fi
  echo ""

  echo -e "${BLUE}[4/5] Build scripts${NC}"
  if [ -d "$PROJECT_ROOT/.maestro/scripts" ]; then
    SCRIPT_COUNT=$(find "$PROJECT_ROOT/.maestro/scripts" -name "*.sh" | wc -l)
    echo -e "${GREEN}✓ Found $SCRIPT_COUNT build scripts${NC}"
  else
    echo -e "${RED}❌ Scripts directory not found${NC}"
  fi
  echo ""

  echo -e "${BLUE}[5/5] Reports directory${NC}"
  if [ -d "$PROJECT_ROOT/test-reports" ]; then
    REPORT_COUNT=$(find "$PROJECT_ROOT/test-reports" -name "*.html" | wc -l)
    echo -e "${GREEN}✓ Found $REPORT_COUNT reports${NC}"
  else
    echo -e "${YELLOW}⚠️  Reports directory not found (will be created)${NC}"
  fi
  echo ""
}

# ============================================================================
# CREDENTIALS DIAGNOSTIC
# ============================================================================
run_credentials_diagnostic() {
  echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║         Credentials & Environment Diagnostic               ║${NC}"
  echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
  echo ""

  echo -e "${BLUE}[1/6] Environment variables${NC}"
  REQUIRED_VARS=("ANDROID_HOME" "APP_ID")
  MISSING_VARS=()
  
  for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
      MISSING_VARS+=("$var")
    fi
  done

  if [ ${#MISSING_VARS[@]} -eq 0 ]; then
    echo -e "${GREEN}✓ All required environment variables set${NC}"
  else
    echo -e "${YELLOW}⚠️  Missing environment variables:${NC}"
    for var in "${MISSING_VARS[@]}"; do
      echo "  - $var"
    done
  fi
  echo ""

  echo -e "${BLUE}[2/6] Test user credentials${NC}"
  if [ -f "$PROJECT_ROOT/.maestro/config/test_users.yaml" ]; then
    echo -e "${GREEN}✓ Test users file found${NC}"
  else
    echo -e "${YELLOW}⚠️  Test users file not found${NC}"
  fi
  echo ""

  echo -e "${BLUE}[3/6] Encrypted credentials${NC}"
  CRED_FILES=$(find "$PROJECT_ROOT/.maestro/config" -name "maestro_secrets*.json" 2>/dev/null | wc -l)
  if [ "$CRED_FILES" -gt 0 ]; then
    echo -e "${GREEN}✓ Found $CRED_FILES encrypted credential files${NC}"
  else
    echo -e "${YELLOW}⚠️  No encrypted credential files found${NC}"
  fi
  echo ""

  echo -e "${BLUE}[4/6] Configuration files${NC}"
  CONFIG_FILES=$(find "$PROJECT_ROOT/.maestro/config" -name "*.yaml" 2>/dev/null | wc -l)
  if [ "$CONFIG_FILES" -gt 0 ]; then
    echo -e "${GREEN}✓ Found $CONFIG_FILES configuration files${NC}"
  else
    echo -e "${RED}❌ No configuration files found${NC}"
  fi
  echo ""

  echo -e "${BLUE}[5/6] Shell configuration${NC}"
  if grep -q "ANDROID_HOME" "$HOME/.zshrc" 2>/dev/null; then
    echo -e "${GREEN}✓ Android environment configured in ~/.zshrc${NC}"
  else
    echo -e "${YELLOW}⚠️  Android environment not configured${NC}"
  fi
  echo ""

  echo -e "${BLUE}[6/6] Maestro wrapper function${NC}"
  if grep -q "maestro()" "$HOME/.zshrc" 2>/dev/null; then
    echo -e "${GREEN}✓ Maestro wrapper function configured${NC}"
  else
    echo -e "${YELLOW}⚠️  Maestro wrapper function not configured${NC}"
  fi
  echo ""
}

# ============================================================================
# NPM DEPENDENCIES DIAGNOSTIC
# ============================================================================
run_npm_diagnostic() {
  echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║         NPM Dependencies Diagnostic                        ║${NC}"
  echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
  echo ""

  echo -e "${BLUE}[1/3] Node.js${NC}"
  if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✓ Node.js found: $NODE_VERSION${NC}"
  else
    echo -e "${RED}❌ Node.js not found${NC}"
    echo "Install: https://nodejs.org"
  fi
  echo ""

  echo -e "${BLUE}[2/3] npm${NC}"
  if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}✓ npm found: $NPM_VERSION${NC}"
  else
    echo -e "${RED}❌ npm not found${NC}"
  fi
  echo ""

  echo -e "${BLUE}[3/3] Workspace dependencies${NC}"
  if [ -d "$PROJECT_ROOT/node_modules" ]; then
    # Check that workspace symlinks exist
    WORKSPACES=("utilities/dashboard" "utilities/ui-state-mapper" "utilities/maestro-recorder/frontend" "utilities/maestro-recorder/backend" "scripts/utils/api")
    MISSING=0
    for ws in "${WORKSPACES[@]}"; do
      WS_NAME=$(node -e "console.log(require('./$ws/package.json').name)" 2>/dev/null)
      if [ -n "$WS_NAME" ] && [ ! -d "$PROJECT_ROOT/node_modules/$WS_NAME" ] && [ ! -L "$PROJECT_ROOT/node_modules/$WS_NAME" ]; then
        echo -e "${YELLOW}  ⚠️  Workspace not linked: $ws${NC}"
        MISSING=$((MISSING + 1))
      fi
    done
    if [ "$MISSING" -eq 0 ]; then
      echo -e "${GREEN}✓ All workspace dependencies installed${NC}"
    else
      echo -e "${YELLOW}⚠️  $MISSING workspace(s) not linked${NC}"
      if [ "$AUTO_FIX" = "true" ]; then
        echo -e "${YELLOW}🔧 Running npm install...${NC}"
        cd "$PROJECT_ROOT" && npm install --legacy-peer-deps 2>&1 | tail -5
        echo -e "${GREEN}✅ Dependencies installed${NC}"
      else
        echo "  Run: npm install (from project root)"
      fi
    fi
  else
    echo -e "${RED}❌ node_modules not found${NC}"
    if [ "$AUTO_FIX" = "true" ]; then
      echo -e "${YELLOW}🔧 Running npm install...${NC}"
      cd "$PROJECT_ROOT" && npm install --legacy-peer-deps 2>&1 | tail -5
      if [ -d "$PROJECT_ROOT/node_modules" ]; then
        echo -e "${GREEN}✅ Dependencies installed${NC}"
      else
        echo -e "${RED}❌ npm install failed${NC}"
      fi
    else
      echo "  Run: npm install (from project root)"
    fi
  fi
  echo ""
}

# ============================================================================
# RUN DIAGNOSTICS
# ============================================================================

if [ "$DIAGNOSTIC" = "all" ] || [ "$DIAGNOSTIC" = "npm" ]; then
  run_npm_diagnostic
fi

if [ "$DIAGNOSTIC" = "all" ] || [ "$DIAGNOSTIC" = "android" ]; then
  run_android_diagnostic
fi

if [ "$DIAGNOSTIC" = "all" ] || [ "$DIAGNOSTIC" = "ios" ]; then
  run_ios_diagnostic
fi

if [ "$DIAGNOSTIC" = "all" ] || [ "$DIAGNOSTIC" = "app" ]; then
  run_app_diagnostic
fi

if [ "$DIAGNOSTIC" = "all" ] || [ "$DIAGNOSTIC" = "credentials" ]; then
  run_credentials_diagnostic
fi

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}Diagnostic complete${NC}"
