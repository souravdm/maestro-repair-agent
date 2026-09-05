#!/bin/bash

###############################################################################
# iOS Simulator & Build Setup - Consolidated Script
# Handles: Simulator setup, iOS build, CocoaPods, diagnostics
# Merged from: setup_simulator.sh, build_from_repo_ios.sh, 
#              build_ios_app.sh, fix-ios-build.sh, diagnose-ios-build.sh
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

# Final verification
if [ ! -d "$PROJECT_ROOT/.maestro" ]; then
  echo -e "${RED}❌ Could not determine project root${NC}"
  echo "Expected .maestro directory at: $PROJECT_ROOT/.maestro"
  echo "SCRIPT_DIR: $SCRIPT_DIR"
  echo "Current directory: $(pwd)"
  exit 1
fi

ACTION="${1:-boot}"
SIMULATOR_NAME="${2:-}"
BUILD_TYPE="${3:-local}"

# Repo URLs — CVS Health migrated to a new GitHub org; Health100 stays on the original.
# The active scheme in build_config.yaml determines which URL is used.
CONFIG_FILE="$PROJECT_ROOT/build_config.yaml"
IOS_CVSHEALTH_REPO_URL="https://github.com/cvs-health-pcw-source-code/digital-flagship-ios.git"
IOS_HEALTH100_REPO_URL="https://github.com/cvs-health-source-code/digital-flagship-ios.git"
if [ -f "$CONFIG_FILE" ]; then
  _scheme=$(grep -A 20 "^ios:" "$CONFIG_FILE" | grep "scheme:" | grep -v "^[[:space:]]*#" | sed 's/.*scheme: *"\(.*\)".*/\1/')
  _cvs_url=$(grep -A 20 "^ios:" "$CONFIG_FILE" | grep "cvshealth_repo_url:" | grep -v "^[[:space:]]*#" | sed 's/.*cvshealth_repo_url: *"\(.*\)".*/\1/')
  _h100_url=$(grep -A 20 "^ios:" "$CONFIG_FILE" | grep "repo_url:" | grep -v "^[[:space:]]*#" | sed 's/.*repo_url: *"\(.*\)".*/\1/')
  [ -n "$_cvs_url" ]  && IOS_CVSHEALTH_REPO_URL="$_cvs_url"
  [ -n "$_h100_url" ] && IOS_HEALTH100_REPO_URL="$_h100_url"
  if [ "$_scheme" = "CVSOnlineiPhone" ]; then
    IOS_REPO_URL="$IOS_CVSHEALTH_REPO_URL"
  else
    IOS_REPO_URL="$IOS_HEALTH100_REPO_URL"
  fi
else
  IOS_REPO_URL="$IOS_HEALTH100_REPO_URL"
fi

case "$ACTION" in
  boot|build|fix|diagnose)
    ;;
  *)
    echo -e "${BLUE}iOS Simulator & Build Setup${NC}"
    echo ""
    echo "Usage: $0 <action> [simulator_name] [build_type]"
    echo ""
    echo "Actions:"
    echo "  boot       - Boot iOS simulator"
    echo "  build      - Build iOS app"
    echo "  fix        - Fix iOS build issues (CocoaPods, etc)"
    echo "  diagnose   - Diagnose iOS build issues"
    echo ""
    echo "Build types:"
    echo "  local      - Build from local workspace (default)"
    echo "  repo       - Build from GitHub repository"
    echo ""
    echo "Examples:"
    echo "  $0 boot"
    echo "  $0 boot 'iPhone 17 Pro'"
    echo "  $0 build local"
    echo "  $0 build repo"
    echo "  $0 fix"
    echo "  $0 diagnose"
    exit 1
    ;;
esac

# ============================================================================
# BOOT ACTION
# ============================================================================
if [ "$ACTION" = "boot" ]; then
  echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║           iOS Simulator Setup                              ║${NC}"
  echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
  echo ""

  # If SIMULATOR_NAME is provided, use it (could be name or UDID)
  # Otherwise, prefer currently booted iOS simulator
  if [ -z "$SIMULATOR_NAME" ]; then
    # Get booted simulator name (iPhone ONLY - exclude iPad, Apple Watch, Apple TV)
    SIMULATOR_NAME=$(xcrun simctl list devices 2>/dev/null | \
      grep "(Booted)" | grep "iPhone" | head -1 | \
      sed 's/(.*//' | sed 's/^[[:space:]]*//' | sed 's/[[:space:]]*$//')

    # Fallback: pick latest available iPhone simulator if none is currently booted
    if [ -z "$SIMULATOR_NAME" ]; then
      SIMULATOR_NAME=$(xcrun simctl list devices available 2>/dev/null | \
        grep "iPhone" | tail -1 | \
        sed 's/(.*//' | sed 's/^[[:space:]]*//' | sed 's/[[:space:]]*$//')
    fi
  else
    # SIMULATOR_NAME was provided - verify it exists
    if ! xcrun simctl list devices 2>/dev/null | grep -q "$SIMULATOR_NAME"; then
      echo -e "${RED}❌ Simulator not found: $SIMULATOR_NAME${NC}"
      echo -e "${BLUE}Available simulators:${NC}"
      xcrun simctl list devices 2>/dev/null | grep "iPhone" | head -5
      exit 1
    fi
  fi

  if [ -z "$SIMULATOR_NAME" ]; then
    echo -e "${RED}❌ No simulator found${NC}"
    exit 1
  fi

  echo -e "${GREEN}✓ Using simulator: $SIMULATOR_NAME${NC}"
  echo ""

  # Boot simulator
  echo "Booting simulator..."
  xcrun simctl boot "$SIMULATOR_NAME" 2>/dev/null || true
  
  # Wait for simulator to be ready
  echo "Waiting for simulator to be ready..."
  MAX_ATTEMPTS=30
  ATTEMPT=0
  
  while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
    if xcrun simctl getenv "$SIMULATOR_NAME" HOME > /dev/null 2>&1; then
      echo -e "${GREEN}✓ Simulator is ready${NC}"
      break
    fi
    ATTEMPT=$((ATTEMPT + 1))
    sleep 1
  done

  if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
    echo -e "${YELLOW}⚠️  Simulator may not be fully ready${NC}"
  fi

  echo -e "${GREEN}✓ iOS simulator setup complete${NC}"

  # ── NPM workspace install: single install for all utilities ──────────────
  if [ ! -d "$PROJECT_ROOT/node_modules" ]; then
    echo ""
    echo -e "${BLUE}Installing NPM workspace dependencies...${NC}"
    cd "$PROJECT_ROOT" && npm install --legacy-peer-deps 2>&1 | tail -3
    if [ -d "$PROJECT_ROOT/node_modules" ]; then
      echo -e "${GREEN}✓ All workspace dependencies installed (gui, recorder, api, etc.)${NC}"
    else
      echo -e "${YELLOW}⚠️  npm install failed - run 'npm install' manually from project root${NC}"
    fi
  else
    echo -e "${GREEN}✓ NPM dependencies already installed${NC}"
  fi
  # ──────────────────────────────────────────────────────────────────────────

  # ── PATH setup: add project bin/ to shell profile (once per machine) ──────
  # This enables plain "maestro test <flow>" without typing ./scripts/testing/test.sh
  BIN_PATH="$PROJECT_ROOT/bin"
  PATH_EXPORT="export PATH=\"$BIN_PATH:\$PATH\""
  SHELL_PROFILE="$HOME/.zshrc"
  # Fall back to .bash_profile for bash users
  if [ -n "$BASH_VERSION" ] && [ ! -f "$HOME/.zshrc" ]; then
    SHELL_PROFILE="$HOME/.bash_profile"
  fi

  if ! grep -qF "$BIN_PATH" "$SHELL_PROFILE" 2>/dev/null; then
    echo ""
    echo -e "${BLUE}Adding project bin/ to PATH in $SHELL_PROFILE...${NC}"
    {
      echo ""
      echo "# MaestroUITests: project-local maestro wrapper (added by ios-setup.sh)"
      echo "$PATH_EXPORT"
    } >> "$SHELL_PROFILE"
    echo -e "${GREEN}✓ PATH updated. Run: source $SHELL_PROFILE${NC}"
    echo -e "${BLUE}  You can now run: maestro test <flow>${NC}"
    # Apply to the current session immediately
    export PATH="$BIN_PATH:$PATH"
  else
    echo -e "${GREEN}✓ Project bin/ already in PATH${NC}"
    export PATH="$BIN_PATH:$PATH"
  fi
  # ──────────────────────────────────────────────────────────────────────────

  exit 0
fi

# ============================================================================
# BUILD ACTION
# ============================================================================
if [ "$ACTION" = "build" ]; then
  echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║           Build iOS App                                    ║${NC}"
  echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
  echo ""

  if [ "$BUILD_TYPE" = "repo" ]; then
    echo "Building from GitHub repository..."
    
    BUILD_DIR="$HOME/.maestro-builds/ios"
    mkdir -p "$BUILD_DIR"
    
    if [ ! -d "$BUILD_DIR/digital-flagship-ios" ]; then
      echo "Cloning iOS repository..."
      git clone "$IOS_REPO_URL" "$BUILD_DIR/digital-flagship-ios"
    fi
    
    cd "$BUILD_DIR/digital-flagship-ios/IOS/CVSOnlineiPhone" || exit 1
  else
    echo "Building from local workspace..."
    cd "$PROJECT_ROOT" || exit 1
  fi

  # Install CocoaPods dependencies
  echo "Installing CocoaPods dependencies..."
  if [ ! -f "Podfile" ]; then
    echo -e "${RED}❌ Podfile not found${NC}"
    echo "Expected location: $(pwd)/Podfile"
    echo "Run: $0 fix"
    exit 1
  fi

  pod install || {
    echo -e "${RED}❌ CocoaPods install failed${NC}"
    exit 1
  }

  # Build app
  echo "Building iOS app..."
  xcodebuild -workspace CVSOnlineiPhone.xcworkspace \
    -scheme CVSOnlineiPhone \
    -configuration Debug \
    -derivedDataPath build \
    -sdk iphonesimulator \
    build || {
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
  }

  echo -e "${GREEN}✓ iOS app built successfully${NC}"
  exit 0
fi

# ============================================================================
# FIX ACTION
# ============================================================================
if [ "$ACTION" = "fix" ]; then
  echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║           Fix iOS Build Issues                             ║${NC}"
  echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
  echo ""

  # Check for Podfile in iOS app directory
  BUILD_DIR="$HOME/.maestro-builds/ios"
  IOS_APP_DIR="$BUILD_DIR/digital-flagship-ios/IOS/CVSOnlineiPhone"
  
  if [ ! -f "$IOS_APP_DIR/Podfile" ]; then
    echo -e "${YELLOW}Podfile not found, cloning iOS repository...${NC}"
    
    mkdir -p "$BUILD_DIR"
    
    if [ ! -d "$BUILD_DIR/digital-flagship-ios" ]; then
      git clone "$IOS_REPO_URL" "$BUILD_DIR/digital-flagship-ios"
    fi
  fi
  
  cd "$IOS_APP_DIR" || exit 1

  # Install CocoaPods
  echo "Installing CocoaPods..."
  if ! command -v pod &> /dev/null; then
    echo "Installing CocoaPods gem..."
    sudo gem install cocoapods
  fi

  # Update CocoaPods repo
  echo "Updating CocoaPods repository..."
  pod repo update

  # Install dependencies
  echo "Installing pod dependencies..."
  pod install || {
    echo -e "${RED}❌ CocoaPods install failed${NC}"
    echo "Try:"
    echo "  rm -rf Pods Podfile.lock"
    echo "  pod install"
    exit 1
  }

  echo -e "${GREEN}✓ iOS build issues fixed${NC}"
  exit 0
fi

# ============================================================================
# DIAGNOSE ACTION
# ============================================================================
if [ "$ACTION" = "diagnose" ]; then
  echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║         iOS Build Diagnostic Report                        ║${NC}"
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
    echo "Install: sudo gem install cocoapods"
  fi
  echo ""

  echo -e "${BLUE}[3/7] Podfile${NC}"
  IOS_APP_DIR="$HOME/.maestro-builds/ios/digital-flagship-ios/IOS/CVSOnlineiPhone"
  if [ -f "$IOS_APP_DIR/Podfile" ]; then
    echo -e "${GREEN}✓ Podfile found${NC}"
  else
    echo -e "${RED}❌ Podfile not found${NC}"
    echo "Clone iOS repo: git clone $IOS_REPO_URL"
  fi
  echo ""

  echo -e "${BLUE}[4/7] Pods directory${NC}"
  if [ -d "$IOS_APP_DIR/Pods" ]; then
    echo -e "${GREEN}✓ Pods directory exists${NC}"
  else
    echo -e "${YELLOW}⚠️  Pods directory not found${NC}"
    echo "Run: pod install"
  fi
  echo ""

  echo -e "${BLUE}[5/7] Xcode workspace${NC}"
  if [ -d "$IOS_APP_DIR/CVSOnlineiPhone.xcworkspace" ]; then
    echo -e "${GREEN}✓ Xcode workspace found${NC}"
  else
    echo -e "${RED}❌ Xcode workspace not found${NC}"
  fi
  echo ""

  echo -e "${BLUE}[6/7] Xcode project${NC}"
  if [ -d "$IOS_APP_DIR/CVSOnlineiPhone.xcodeproj" ]; then
    echo -e "${GREEN}✓ Xcode project found${NC}"
  else
    echo -e "${RED}❌ Xcode project not found${NC}"
  fi
  echo ""

  echo -e "${BLUE}[7/7] iOS simulators${NC}"
  SIMULATORS=$(xcrun simctl list devices available | grep "iPhone" | wc -l)
  if [ "$SIMULATORS" -gt 0 ]; then
    echo -e "${GREEN}✓ Found $SIMULATORS simulators${NC}"
  else
    echo -e "${RED}❌ No simulators found${NC}"
  fi
  echo ""

  echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}Diagnostic complete${NC}"
  exit 0
fi
