#!/bin/bash

###############################################################################
# Android SDK & Emulator Setup - Consolidated Script
# Handles: Download, Install, Configure, and Create Android environment
# Merged from: download-android-sdk.sh, install-android-sdk.sh, 
#              install-sdk-components-auto.sh, setup-android-sdk.sh,
#              setup-android-from-studio.sh, setup-android-path.sh,
#              create-android-emulator.sh, ensure-android-ready.sh
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

# Parse arguments
ACTION="${1:-verify}"
EMULATOR_NAME="${2:-}"

case "$ACTION" in
  download|install|setup|verify|create|boot|diagnose)
    ;;
  *)
    echo -e "${BLUE}Android SDK & Emulator Setup${NC}"
    echo ""
    echo "Usage: $0 <action> [emulator_name]"
    echo ""
    echo "Actions:"
    echo "  download    - Download Android SDK command-line tools from Google"
    echo "  install     - Install SDK components (Platform, Build-Tools, Emulator)"
    echo "  setup       - Configure PATH and environment variables"
    echo "  verify      - Verify Android SDK installation"
    echo "  create      - Create Android emulator"
    echo "  boot        - Boot Android emulator"
    echo "  diagnose    - Diagnose Android setup issues"
    echo ""
    echo "Examples:"
    echo "  $0 download"
    echo "  $0 install"
    echo "  $0 setup"
    echo "  $0 verify"
    echo "  $0 create Pixel_6_API_34"
    echo "  $0 boot Pixel_6_API_34"
    echo "  $0 diagnose"
    exit 1
    ;;
esac

# Setup environment
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$ANDROID_HOME/tools/bin:$PATH"

# ============================================================================
# DOWNLOAD ACTION
# ============================================================================
if [ "$ACTION" = "download" ]; then
  echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║   Download Android SDK Command-line Tools                  ║${NC}"
  echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
  echo ""

  mkdir -p "$ANDROID_HOME/cmdline-tools"
  echo -e "${BLUE}Downloading Android SDK Command-line Tools...${NC}"
  
  DOWNLOAD_URL="https://dl.google.com/android/repository/commandlinetools-mac-11076708_latest.zip"
  TEMP_DIR="/tmp/android-sdk-download"
  mkdir -p "$TEMP_DIR"

  if ! curl -L -o "$TEMP_DIR/cmdline-tools.zip" "$DOWNLOAD_URL"; then
    echo -e "${RED}❌ Failed to download${NC}"
    exit 1
  fi

  echo -e "${GREEN}✓ Download complete${NC}"
  echo ""
  echo -e "${BLUE}Extracting tools...${NC}"

  if ! unzip -q "$TEMP_DIR/cmdline-tools.zip" -d "$TEMP_DIR"; then
    echo -e "${RED}❌ Failed to extract${NC}"
    exit 1
  fi

  if [ -d "$TEMP_DIR/cmdline-tools" ]; then
    mv "$TEMP_DIR/cmdline-tools"/* "$ANDROID_HOME/cmdline-tools/latest/" 2>/dev/null || true
  fi

  if [ ! -d "$ANDROID_HOME/cmdline-tools/latest" ]; then
    mkdir -p "$ANDROID_HOME/cmdline-tools/latest"
    mv "$TEMP_DIR/cmdline-tools"/* "$ANDROID_HOME/cmdline-tools/latest/" 2>/dev/null || true
  fi

  rm -rf "$TEMP_DIR"

  echo -e "${GREEN}✓ Tools extracted${NC}"
  echo ""
  echo "Next: $0 setup"
  exit 0
fi

# ============================================================================
# SETUP ACTION
# ============================================================================
if [ "$ACTION" = "setup" ]; then
  echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║   Configure Android SDK PATH                              ║${NC}"
  echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
  echo ""

  SHELL_RC="$HOME/.zshrc"
  if [ ! -f "$SHELL_RC" ]; then
    SHELL_RC="$HOME/.bashrc"
  fi

  if ! grep -q "cmdline-tools/latest/bin" "$SHELL_RC"; then
    echo "" >> "$SHELL_RC"
    echo "# Android SDK Configuration" >> "$SHELL_RC"
    echo "export ANDROID_HOME=\$HOME/Library/Android/sdk" >> "$SHELL_RC"
    echo "export PATH=\$PATH:\$ANDROID_HOME/cmdline-tools/latest/bin:\$ANDROID_HOME/emulator:\$ANDROID_HOME/platform-tools" >> "$SHELL_RC"
    echo -e "${GREEN}✓ Added to $SHELL_RC${NC}"
  else
    echo -e "${GREEN}✓ Already configured${NC}"
  fi

  echo ""
  echo "Reload shell: source $SHELL_RC"
  echo "Next: $0 install"
  exit 0
fi

# ============================================================================
# INSTALL ACTION
# ============================================================================
if [ "$ACTION" = "install" ]; then
  echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║   Installing Android SDK Components                        ║${NC}"
  echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
  echo ""

  if ! command -v sdkmanager &> /dev/null; then
    echo -e "${RED}❌ sdkmanager not found${NC}"
    echo "Run: source ~/.zshrc"
    exit 1
  fi

  echo -e "${BLUE}Accepting licenses...${NC}"
  yes | sdkmanager --licenses > /dev/null 2>&1 || true

  echo -e "${BLUE}Installing Android SDK Platform 34...${NC}"
  sdkmanager "platforms;android-34" > /dev/null 2>&1

  echo -e "${BLUE}Installing Build-Tools 34.0.0...${NC}"
  sdkmanager "build-tools;34.0.0" > /dev/null 2>&1

  echo -e "${BLUE}Installing Android Emulator...${NC}"
  sdkmanager "emulator" > /dev/null 2>&1

  echo -e "${BLUE}Installing Platform-Tools...${NC}"
  sdkmanager "platform-tools" > /dev/null 2>&1

  echo -e "${GREEN}✓ All components installed${NC}"
  echo ""
  echo "Next: $0 verify"
  exit 0
fi

# ============================================================================
# VERIFY ACTION
# ============================================================================
if [ "$ACTION" = "verify" ]; then
  echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║        Android SDK Setup and Verification                  ║${NC}"
  echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
  echo ""

  TOOLS_FOUND=0
  TOOLS_TOTAL=7

  echo -e "${BLUE}[1/7] Android SDK${NC}"
  if [ -d "$ANDROID_HOME" ]; then
    echo -e "${GREEN}✓ Found at: $ANDROID_HOME${NC}"
    TOOLS_FOUND=$((TOOLS_FOUND + 1))
  else
    echo -e "${RED}❌ Not found${NC}"
  fi
  echo ""

  echo -e "${BLUE}[2/7] sdkmanager${NC}"
  if command -v sdkmanager &> /dev/null; then
    echo -e "${GREEN}✓ Found: $(which sdkmanager)${NC}"
    TOOLS_FOUND=$((TOOLS_FOUND + 1))
  else
    echo -e "${RED}❌ Not found${NC}"
  fi
  echo ""

  echo -e "${BLUE}[3/7] avdmanager${NC}"
  if command -v avdmanager &> /dev/null; then
    echo -e "${GREEN}✓ Found: $(which avdmanager)${NC}"
    TOOLS_FOUND=$((TOOLS_FOUND + 1))
  else
    echo -e "${RED}❌ Not found${NC}"
  fi
  echo ""

  echo -e "${BLUE}[4/7] adb${NC}"
  if command -v adb &> /dev/null; then
    echo -e "${GREEN}✓ Found: $(which adb)${NC}"
    TOOLS_FOUND=$((TOOLS_FOUND + 1))
  else
    echo -e "${RED}❌ Not found${NC}"
  fi
  echo ""

  echo -e "${BLUE}[5/7] emulator${NC}"
  if [ -d "$ANDROID_HOME/emulator" ]; then
    echo -e "${GREEN}✓ Found: $ANDROID_HOME/emulator${NC}"
    TOOLS_FOUND=$((TOOLS_FOUND + 1))
  else
    echo -e "${RED}❌ Not found${NC}"
  fi
  echo ""

  echo -e "${BLUE}[6/7] SDK Platform 34${NC}"
  if [ -d "$ANDROID_HOME/platforms/android-34" ]; then
    echo -e "${GREEN}✓ Installed${NC}"
    TOOLS_FOUND=$((TOOLS_FOUND + 1))
  else
    echo -e "${RED}❌ Not installed${NC}"
  fi
  echo ""

  echo -e "${BLUE}[7/7] Build-Tools 34.0.0${NC}"
  if [ -d "$ANDROID_HOME/build-tools/34.0.0" ]; then
    echo -e "${GREEN}✓ Installed${NC}"
    TOOLS_FOUND=$((TOOLS_FOUND + 1))
  else
    echo -e "${RED}❌ Not installed${NC}"
  fi
  echo ""

  # ── NPM workspace install ──────────────────────────────────────────────
  if [ ! -d "$PROJECT_ROOT/node_modules" ]; then
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
  echo ""
  # ──────────────────────────────────────────────────────────────────────────

  if [ $TOOLS_FOUND -eq $TOOLS_TOTAL ]; then
    echo -e "${GREEN}✓ Android SDK is ready!${NC}"
    echo ""
    echo "Next: $0 create [emulator_name]"
    exit 0
  else
    echo -e "${YELLOW}⚠️  Some components missing${NC}"
    echo "Run: $0 install"
    exit 1
  fi
fi

# ============================================================================
# CREATE ACTION
# ============================================================================
if [ "$ACTION" = "create" ]; then
  echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║           Create Android Emulator                          ║${NC}"
  echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
  echo ""

  if ! command -v emulator &> /dev/null; then
    echo -e "${RED}❌ emulator command not found${NC}"
    exit 1
  fi

  EXISTING=$(emulator -list-avds 2>/dev/null | grep -v "^$" || echo "")

  if [ -n "$EXISTING" ]; then
    echo -e "${GREEN}✓ Emulators already exist:${NC}"
    echo "$EXISTING" | sed 's/^/  - /'
    echo ""
    echo "No need to create a new one."
    exit 0
  fi

  EMULATOR_NAME="${EMULATOR_NAME:-Pixel_9_Pro_XL}"

  echo "Creating emulator: $EMULATOR_NAME"
  echo "Downloading system image..."
  sdkmanager "system-images;android-36;google_apis;x86_64" --accept-licenses > /dev/null 2>&1

  echo "Creating AVD..."
  echo "no" | avdmanager create avd \
    -n "$EMULATOR_NAME" \
    -k "system-images;android-34;google_apis;x86_64" \
    -d "Pixel 9" \
    --force > /dev/null 2>&1

  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Emulator created: $EMULATOR_NAME${NC}"
    echo ""
    echo "Next: $0 boot $EMULATOR_NAME"
    exit 0
  else
    echo -e "${RED}❌ Failed to create emulator${NC}"
    exit 1
  fi
fi

# ============================================================================
# BOOT ACTION
# ============================================================================
if [ "$ACTION" = "boot" ]; then
  echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║           Boot Android Emulator                            ║${NC}"
  echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
  echo ""

  if [ -z "$EMULATOR_NAME" ]; then
    EMULATOR_NAME=$(emulator -list-avds 2>/dev/null | head -1)
  fi

  if [ -z "$EMULATOR_NAME" ]; then
    echo -e "${RED}❌ No emulator specified or found${NC}"
    exit 1
  fi

  echo "Restarting adb server..."
  adb kill-server > /dev/null 2>&1 || true
  sleep 1
  adb start-server > /dev/null 2>&1
  sleep 2

  RUNNING=$(adb devices 2>/dev/null | grep "device$" | awk '{print $1}' | head -1)

  if [ -n "$RUNNING" ]; then
    echo -e "${GREEN}✓ Emulator already running: $RUNNING${NC}"
  else
    echo "Starting emulator: $EMULATOR_NAME"
    emulator -avd "$EMULATOR_NAME" -no-snapshot-load -no-window > /dev/null 2>&1 &
    
    echo "Waiting for emulator to boot..."
    MAX_ATTEMPTS=120
    ATTEMPT=0
    
    while [ $ATTEMPT -lt $MAX_ATTEMPTS ]; do
      RUNNING=$(adb devices 2>/dev/null | grep "device$" | awk '{print $1}' | head -1)
      if [ -n "$RUNNING" ]; then
        echo -e "${GREEN}✓ Emulator connected: $RUNNING${NC}"
        break
      fi
      ATTEMPT=$((ATTEMPT + 1))
      if [ $((ATTEMPT % 10)) -eq 0 ]; then
        echo "⏳ Waiting... ${ATTEMPT}s"
      fi
      sleep 1
    done

    if [ $ATTEMPT -eq $MAX_ATTEMPTS ]; then
      echo -e "${RED}❌ Emulator failed to boot${NC}"
      exit 1
    fi
  fi

  echo "Waiting for device to be responsive..."
  MAX_WAIT=60
  WAITED=0
  while [ $WAITED -lt $MAX_WAIT ]; do
    if adb shell getprop ro.boot.serialno > /dev/null 2>&1; then
      echo -e "${GREEN}✓ Device is responsive${NC}"
      break
    fi
    WAITED=$((WAITED + 1))
    sleep 1
  done

  echo -e "${GREEN}✓ Android emulator is ready${NC}"

  # ── PATH setup: add project bin/ to shell profile (once per machine) ──────
  # This enables plain "maestro test <flow>" without typing ./scripts/testing/test.sh
  BIN_PATH="$PROJECT_ROOT/bin"
  PATH_EXPORT="export PATH=\"$BIN_PATH:\$PATH\""
  SHELL_PROFILE="$HOME/.zshrc"
  if [ -n "$BASH_VERSION" ] && [ ! -f "$HOME/.zshrc" ]; then
    SHELL_PROFILE="$HOME/.bash_profile"
  fi

  if ! grep -qF "$BIN_PATH" "$SHELL_PROFILE" 2>/dev/null; then
    echo ""
    echo -e "${BLUE}Adding project bin/ to PATH in $SHELL_PROFILE...${NC}"
    {
      echo ""
      echo "# MaestroUITests: project-local maestro wrapper (added by android-setup.sh)"
      echo "$PATH_EXPORT"
    } >> "$SHELL_PROFILE"
    echo -e "${GREEN}✓ PATH updated. Run: source $SHELL_PROFILE${NC}"
    echo -e "${BLUE}  You can now run: maestro test <flow>${NC}"
    export PATH="$BIN_PATH:$PATH"
  else
    echo -e "${GREEN}✓ Project bin/ already in PATH${NC}"
    export PATH="$BIN_PATH:$PATH"
  fi
  # ──────────────────────────────────────────────────────────────────────────

  exit 0
fi

# ============================================================================
# DIAGNOSE ACTION
# ============================================================================
if [ "$ACTION" = "diagnose" ]; then
  echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║         Android Setup Diagnostic Report                    ║${NC}"
  echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
  echo ""

  echo -e "${BLUE}[1/8] Android SDK${NC}"
  if [ -d "$ANDROID_HOME" ]; then
    echo -e "${GREEN}✓ Found at: $ANDROID_HOME${NC}"
  else
    echo -e "${RED}❌ Not found at: $ANDROID_HOME${NC}"
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

  echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
  echo -e "${GREEN}Diagnostic complete${NC}"
  exit 0
fi
