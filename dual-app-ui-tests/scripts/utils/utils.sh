#!/bin/bash

###############################################################################
# Maestro Testing Utilities - Consolidated Script
# Handles: Credentials, app configuration, debugging, hierarchy capture
# Merged from: test-with-credentials.sh, update-appid-to-env.sh,
#              verify-credentials.sh, capture-ui-hierarchy.sh,
#              capture-system-logs.sh, debug-cli.sh
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

UTILITY="${1:-help}"

case "$UTILITY" in
  test-with-creds|update-appid|verify-creds|capture-hierarchy|capture-logs|debug)
    ;;
  help|*)
    echo -e "${BLUE}Maestro Testing Utilities${NC}"
    echo ""
    echo "Usage: $0 <utility> [options]"
    echo ""
    echo "Utilities:"
    echo "  test-with-creds    - Run test with specific credentials"
    echo "  update-appid       - Update APP_ID in environment"
    echo "  verify-creds       - Verify test credentials"
    echo "  capture-hierarchy  - Capture UI hierarchy"
    echo "  capture-logs       - Capture system logs"
    echo "  debug              - Debug CLI tool"
    echo "  help               - Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 test-with-creds .maestro/flows/Account/test_login.yaml"
    echo "  $0 update-appid com.cvs.launchers.cvs"
    echo "  $0 verify-creds"
    echo "  $0 capture-hierarchy"
    echo "  $0 capture-logs"
    echo "  $0 debug"
    exit 0
    ;;
esac

# ============================================================================
# TEST WITH CREDENTIALS
# ============================================================================
if [ "$UTILITY" = "test-with-creds" ]; then
  TEST_FILE="${2:-.maestro/flows/Account/test_simple_login.yaml}"
  CREDS_FILE="${3:-.maestro/config/test_users.yaml}"
  
  echo -e "${BLUE}Running test with credentials...${NC}"
  echo "Test: $TEST_FILE"
  echo "Credentials: $CREDS_FILE"
  echo ""
  
  if [ ! -f "$TEST_FILE" ]; then
    echo -e "${RED}❌ Test file not found: $TEST_FILE${NC}"
    exit 1
  fi
  
  if [ ! -f "$CREDS_FILE" ]; then
    echo -e "${RED}❌ Credentials file not found: $CREDS_FILE${NC}"
    exit 1
  fi
  
  # Load credentials
  export COMMON_USER=$(grep "username:" "$CREDS_FILE" | head -1 | awk '{print $2}')
  export COMMON_PASSWORD=$(grep "password:" "$CREDS_FILE" | head -1 | awk '{print $2}')
  
  echo "Running test with credentials..."
  maestro test "$TEST_FILE"
  
  exit $?
fi

# ============================================================================
# UPDATE APP_ID
# ============================================================================
if [ "$UTILITY" = "update-appid" ]; then
  NEW_APP_ID="${2:-}"
  
  if [ -z "$NEW_APP_ID" ]; then
    echo -e "${RED}❌ APP_ID required${NC}"
    echo "Usage: $0 update-appid <app_id>"
    exit 1
  fi
  
  echo -e "${BLUE}Updating APP_ID...${NC}"
  echo "New APP_ID: $NEW_APP_ID"
  echo ""
  
  # Update in shell config
  SHELL_RC="$HOME/.zshrc"
  if [ ! -f "$SHELL_RC" ]; then
    SHELL_RC="$HOME/.bashrc"
  fi
  
  if grep -q "export APP_ID=" "$SHELL_RC"; then
    sed -i '' "s/export APP_ID=.*/export APP_ID=$NEW_APP_ID/" "$SHELL_RC"
    echo -e "${GREEN}✓ Updated in $SHELL_RC${NC}"
  else
    echo "export APP_ID=$NEW_APP_ID" >> "$SHELL_RC"
    echo -e "${GREEN}✓ Added to $SHELL_RC${NC}"
  fi
  
  # Export for current session
  export APP_ID="$NEW_APP_ID"
  
  echo ""
  echo "Reload shell: source $SHELL_RC"
  exit 0
fi

# ============================================================================
# VERIFY CREDENTIALS
# ============================================================================
if [ "$UTILITY" = "verify-creds" ]; then
  echo -e "${BLUE}Verifying test credentials...${NC}"
  echo ""
  
  CREDS_FILE="${PROJECT_ROOT}/.maestro/config/test_users.yaml"
  
  if [ ! -f "$CREDS_FILE" ]; then
    echo -e "${RED}❌ Credentials file not found: $CREDS_FILE${NC}"
    exit 1
  fi
  
  echo -e "${BLUE}Checking credentials file...${NC}"
  
  if grep -q "username:" "$CREDS_FILE"; then
    echo -e "${GREEN}✓ Username found${NC}"
  else
    echo -e "${RED}❌ Username not found${NC}"
  fi
  
  if grep -q "password:" "$CREDS_FILE"; then
    echo -e "${GREEN}✓ Password found${NC}"
  else
    echo -e "${RED}❌ Password not found${NC}"
  fi
  
  if grep -q "otp:" "$CREDS_FILE"; then
    echo -e "${GREEN}✓ OTP found${NC}"
  else
    echo -e "${YELLOW}⚠️  OTP not found${NC}"
  fi
  
  echo ""
  echo -e "${GREEN}✓ Credentials verification complete${NC}"
  exit 0
fi

# ============================================================================
# CAPTURE UI HIERARCHY
# ============================================================================
if [ "$UTILITY" = "capture-hierarchy" ]; then
  echo -e "${BLUE}Capturing UI hierarchy...${NC}"
  echo ""
  
  DEVICE_ID="${2:-}"
  OUTPUT_FILE="${3:-ui-hierarchy.json}"
  
  if [ -z "$DEVICE_ID" ]; then
    echo "Getting first connected device..."
    DEVICE_ID=$(adb devices | grep "device$" | awk '{print $1}' | head -1)
  fi
  
  if [ -z "$DEVICE_ID" ]; then
    echo -e "${RED}❌ No connected device found${NC}"
    exit 1
  fi
  
  echo "Device: $DEVICE_ID"
  echo "Output: $OUTPUT_FILE"
  echo ""
  
  echo "Capturing hierarchy..."
  adb -s "$DEVICE_ID" shell uiautomator dump /tmp/hierarchy.xml
  adb -s "$DEVICE_ID" pull /tmp/hierarchy.xml "$OUTPUT_FILE"
  
  if [ -f "$OUTPUT_FILE" ]; then
    echo -e "${GREEN}✓ Hierarchy captured: $OUTPUT_FILE${NC}"
  else
    echo -e "${RED}❌ Failed to capture hierarchy${NC}"
    exit 1
  fi
  
  exit 0
fi

# ============================================================================
# CAPTURE SYSTEM LOGS
# ============================================================================
if [ "$UTILITY" = "capture-logs" ]; then
  echo -e "${BLUE}Capturing system logs...${NC}"
  echo ""
  
  DEVICE_ID="${2:-}"
  OUTPUT_FILE="${3:-system-logs.txt}"
  
  if [ -z "$DEVICE_ID" ]; then
    echo "Getting first connected device..."
    DEVICE_ID=$(adb devices | grep "device$" | awk '{print $1}' | head -1)
  fi
  
  if [ -z "$DEVICE_ID" ]; then
    echo -e "${RED}❌ No connected device found${NC}"
    exit 1
  fi
  
  echo "Device: $DEVICE_ID"
  echo "Output: $OUTPUT_FILE"
  echo ""
  
  echo "Capturing logs..."
  adb -s "$DEVICE_ID" logcat > "$OUTPUT_FILE" &
  LOGCAT_PID=$!
  
  echo "Capturing for 30 seconds..."
  sleep 30
  
  kill $LOGCAT_PID 2>/dev/null || true
  
  if [ -f "$OUTPUT_FILE" ]; then
    LINES=$(wc -l < "$OUTPUT_FILE")
    echo -e "${GREEN}✓ Logs captured: $OUTPUT_FILE ($LINES lines)${NC}"
  else
    echo -e "${RED}❌ Failed to capture logs${NC}"
    exit 1
  fi
  
  exit 0
fi

# ============================================================================
# DEBUG CLI
# ============================================================================
if [ "$UTILITY" = "debug" ]; then
  echo -e "${BLUE}Maestro Debug CLI${NC}"
  echo ""
  echo "Available debug commands:"
  echo ""
  echo "Device Commands:"
  echo "  adb devices                    - List connected devices"
  echo "  adb shell getprop ro.build.version.release  - Get Android version"
  echo "  adb logcat                     - View device logs"
  echo ""
  echo "Emulator Commands:"
  echo "  emulator -list-avds            - List available emulators"
  echo "  emulator -avd <name>           - Start emulator"
  echo ""
  echo "Simulator Commands:"
  echo "  xcrun simctl list devices      - List iOS simulators"
  echo "  xcrun simctl boot <udid>       - Boot simulator"
  echo ""
  echo "Maestro Commands:"
  echo "  maestro --version              - Show Maestro version"
  echo "  maestro test <flow>            - Run test flow"
  echo ""
  echo "Configuration:"
  echo "  ANDROID_HOME: $ANDROID_HOME"
  echo "  APP_ID: $APP_ID"
  echo "  PATH: $PATH"
  echo ""
  
  exit 0
fi
