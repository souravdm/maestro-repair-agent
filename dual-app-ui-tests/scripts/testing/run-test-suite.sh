#!/bin/bash

###############################################################################
# Maestro Test Suite Runner
# Executes individual tests from a suite and aggregates results
# Provides detailed per-test reporting with pass/fail status
###############################################################################

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Ensure suite paths and report output are always resolved from repo root.
cd "$PROJECT_ROOT" || exit 1

# ============================================================================
# Clear iOS app state between tests
# Ensures each test starts with a clean slate without reinstalling the app
# ============================================================================
clear_ios_app_state() {
  local app_id="$1"

  local sim_udid
  sim_udid=$(xcrun simctl list devices 2>/dev/null | grep "(Booted)" | grep -E -o '[0-9A-F-]{36}' | head -1)

  if [ -z "$sim_udid" ]; then
    echo -e "${YELLOW}⚠️  No booted simulator found – skipping app state clear${NC}"
    return 0
  fi

  # echo -e "${BLUE}Clearing app state for $app_id...${NC}"

  # 1. Terminate the running app (ignore "nothing to terminate")
  xcrun simctl terminate "$sim_udid" "$app_id" 2>/dev/null || true
  sleep 0.3

  # 2. Wipe the app's data container (Documents, Library, tmp) without reinstalling
  local container_path
  container_path=$(xcrun simctl get_app_container "$sim_udid" "$app_id" data 2>/dev/null)
  if [ -n "$container_path" ] && [ -d "$container_path" ]; then
    find "$container_path" -mindepth 1 -maxdepth 1 -exec rm -rf {} + 2>/dev/null || true
    echo -e "${GREEN}  ✓ Data container wiped${NC}"
  else
    echo -e "${YELLOW}  ⚠️  Data container not found – app may not be installed yet${NC}"
  fi

  # 3. Reset keychain — clears cross-test Keychain contamination (e.g. partial
  #    auth tokens from a failed login test that cause the edu2 loop to spin
  #    indefinitely on subsequent guest-flow tests).
  xcrun simctl keychain "$sim_udid" reset 2>/dev/null || true
  echo -e "${GREEN}  ✓ Keychain reset${NC}"

  # 4. Grant clipboard permission (required for some tests)
  xcrun simctl privacy "$sim_udid" grant "com.apple.UIKit.pasteboard" "$app_id" 2>/dev/null || true
  echo -e "${GREEN}  ✓ Clipboard permission granted${NC}"
}

# ============================================================================
# Android emulator snapshot management — prevents fatigue from accumulating
# test state across a long suite run.
#
# setup_android_snapshot: saves a clean snapshot before the first test.
# reload_android_snapshot: restores that snapshot at configured intervals.
#
# Usage: ./run-test-suite.sh <suite> --platform android --snapshot-interval 11
# ============================================================================
_get_android_device_id() {
  adb devices 2>/dev/null | grep -v "List of devices" | grep "device$" | awk '{print $1}' | head -1
}

setup_android_snapshot() {
  local snapshot_name="${ANDROID_SNAPSHOT_NAME:-clean_boot}"
  local device_id
  device_id=$(_get_android_device_id)

  if [ -z "$device_id" ]; then
    echo -e "${YELLOW}⚠️  No Android device found — skipping snapshot setup${NC}"
    return 0
  fi

  echo -e "${BLUE}📸 Saving Android snapshot '$snapshot_name' (one-time setup)...${NC}"
  local attempt output
  for attempt in 1 2; do
    # `adb emu` only reports whether it delivered the console command — it exits 0
    # even when the emulator console replies "KO: ...". The actual result is in the
    # reply text, so it must be inspected directly rather than trusting $?.
    output=$(adb -s "$device_id" emu avd snapshot save "$snapshot_name" 2>&1)
    if echo "$output" | grep -q "^OK"; then
      echo -e "${GREEN}  ✓ Snapshot saved — will reload every $SNAPSHOT_INTERVAL tests${NC}"
      return 0
    fi
    if [ "$attempt" -eq 1 ]; then
      echo -e "${YELLOW}  ⚠️  Snapshot save failed (${output}), retrying once...${NC}"
      sleep 3
    fi
  done

  echo -e "${YELLOW}  ⚠️  Snapshot save failed after retry (${output}) — snapshot reloads skipped this run${NC}"
  SNAPSHOT_INTERVAL=0
}

reload_android_snapshot() {
  local snapshot_name="${ANDROID_SNAPSHOT_NAME:-clean_boot}"
  local device_id
  device_id=$(_get_android_device_id)

  if [ -z "$device_id" ]; then
    echo -e "${YELLOW}⚠️  No Android device found — skipping snapshot reload${NC}"
    return 0
  fi

  echo -e "${BLUE}🔄 Reloading Android snapshot '$snapshot_name'...${NC}"
  local attempt loaded="false" output
  for attempt in 1 2; do
    # Same caveat as setup_android_snapshot: `adb emu` exits 0 even on a "KO: ..."
    # console reply, so the reply text — not $? — is the real success signal.
    output=$(adb -s "$device_id" emu avd snapshot load "$snapshot_name" 2>&1)
    if echo "$output" | grep -q "^OK"; then
      loaded="true"
      break
    fi
    if [ "$attempt" -eq 1 ]; then
      echo -e "${YELLOW}  ⚠️  Snapshot load failed (${output}), retrying once...${NC}"
      sleep 3
    fi
  done

  if [ "$loaded" != "true" ]; then
    echo -e "${YELLOW}  ⚠️  Snapshot load failed after retry (${output}) — disabling further snapshot reloads this run${NC}"
    SNAPSHOT_INTERVAL=0
    return 0
  fi

  # A snapshot load re-attaches adb almost immediately, but the guest OS can
  # still be mid-boot for several more seconds. Proceeding before
  # sys.boot_completed=1 would resume testing against a half-booted emulator —
  # exactly the kind of silent flakiness this snapshot mechanism is meant to
  # eliminate, so wait for a real boot-completed signal instead of a flat sleep.
  adb -s "$device_id" wait-for-device 2>/dev/null || true

  local waited=0
  local max_wait=60
  local boot_completed=""
  while [ "$waited" -lt "$max_wait" ]; do
    boot_completed=$(adb -s "$device_id" shell getprop sys.boot_completed 2>/dev/null | tr -d '[:space:]')
    [ "$boot_completed" = "1" ] && break
    sleep 2
    waited=$((waited + 2))
  done

  if [ "$boot_completed" = "1" ]; then
    echo -e "${GREEN}  ✓ Snapshot reloaded — emulator booted and ready (${waited}s)${NC}"
  else
    echo -e "${YELLOW}  ⚠️  Emulator did not report boot_completed within ${max_wait}s — continuing anyway${NC}"
  fi
}

# Parse arguments
SUITE_FILE=""
PLATFORM="ios"
SKIP_SETUP="false"
NO_BROWSER="false"
SLACK_ENABLED="false"
ZEPHYR_EXECUTION_ENABLED="false"
DEVICE=""
USER_PROFILE=""
ANDROID_SNAPSHOT_NAME="clean_boot"
SNAPSHOT_INTERVAL=0

while [[ $# -gt 0 ]]; do
  case $1 in
    --platform)
      PLATFORM="$2"
      shift 2
      ;;
    --skip-setup)
      SKIP_SETUP="true"
      shift
      ;;
    --no-browser)
      NO_BROWSER="true"
      shift
      ;;
    --slack)
      SLACK_ENABLED="true"
      shift
      ;;
    --slack-webhook)
      SLACK_WEBHOOK_URL="$2"
      export SLACK_WEBHOOK_URL
      shift 2
      ;;
    --add-zephyr-execution)
      ZEPHYR_EXECUTION_ENABLED="true"
      shift
      ;;
    --device)
      DEVICE="$2"
      shift 2
      ;;
    --user-profile)
      USER_PROFILE="$2"
      shift 2
      ;;
    --android-snapshot)
      ANDROID_SNAPSHOT_NAME="$2"
      shift 2
      ;;
    --snapshot-interval)
      SNAPSHOT_INTERVAL="$2"
      shift 2
      ;;
    *)
      SUITE_FILE="$1"
      shift
      ;;
  esac
done

if [ -z "$SUITE_FILE" ]; then
  echo -e "${RED}❌ Suite file required${NC}"
  echo "Usage: $0 <suite_file> [options]"
  exit 1
fi

if [ ! -f "$SUITE_FILE" ]; then
  if [ -f "$PROJECT_ROOT/$SUITE_FILE" ]; then
    SUITE_FILE="$PROJECT_ROOT/$SUITE_FILE"
  else
    echo -e "${RED}❌ Suite file not found: $SUITE_FILE${NC}"
    exit 1
  fi
fi

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║           Maestro Test Suite Runner                        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# ============================================================================
# Kill Maestro XCTest driver daemon between tests to prevent stale
# port-7001 connections ("Failed to connect to /127.0.0.1:7001").
# ============================================================================
kill_maestro_daemon() {
  # In parallel-platform mode, another Maestro suite is running concurrently on
  # a different platform. The global pkill patterns below would nuke the other
  # run's processes too, so skip cleanup entirely and let the parent wrapper
  # handle it once both runs finish.
  if [ "${PARALLEL_MODE:-}" = "true" ]; then
    echo "🔗 PARALLEL_MODE=true — skipping Maestro cleanup (parent wrapper handles it)"
    return 0
  fi
  echo "🧹 Cleaning up Maestro processes..."

  # ── Step 1: SIGTERM first ──────────────────────────────────────────────────
  # SIGTERM lets maestro-driver-ios (the XCTest bundle) cleanly unregister its
  # accessibility session from SpringBoard before it exits. SIGKILL without this
  # step leaves a stale a11y observer inside SpringBoard; when SpringBoard fires
  # that callback later it dereferences a freed pointer → EXC_BAD_ACCESS →
  # SpringBoard crash (seen in ~/Library/Logs/DiagnosticReports/SpringBoard-*.ips).
  pkill -TERM -f 'maestro-driver-ios'  2>/dev/null || true
  pkill -TERM -f 'maestro.*driver'     2>/dev/null || true
  pkill -TERM -f 'maestro.*server'     2>/dev/null || true
  pkill -TERM -f "maestro test"        2>/dev/null || true
  pkill -TERM -f 'java.*maestro'       2>/dev/null || true
  sleep 1

  # ── Step 2: SIGKILL anything still alive after SIGTERM ────────────────────
  pkill -9 -f 'maestro-driver-ios'         2>/dev/null || true
  pkill -9 -f 'maestro.*server'            2>/dev/null || true
  pkill -9 -f 'maestro.*driver'            2>/dev/null || true
  pkill -9 -f 'dadb'                       2>/dev/null || true
  pkill -9 -f "maestro test"               2>/dev/null || true
  pkill -9 -f 'java.*maestro'              2>/dev/null || true
  pkill -9 -f 'java.*-classpath.*maestro'  2>/dev/null || true
  pkill -9 -f 'java.*-jar.*maestro'        2>/dev/null || true
  pkill -9 -f "tail -n +1 -F.*maestro.log" 2>/dev/null || true
  pkill -9 -f "bash scripts/testing/test.sh"       2>/dev/null || true

  # ── NOTE: SpringBoard, SimulatorBridge, XCTAutomationSupport, XCTestSupport,
  # xctest, and accessibility are intentionally NOT killed here. ──────────────
  #
  # Killing SpringBoard forces a 30–60s simulator cycle plus another 30–60s for
  # the XCTest driver to reconnect — that overhead (×14 tests = ~14–28 min) was
  # the primary driver of the 2-hour suite runtime.
  #
  # The SpringBoard crashes seen in prior CI were caused by SIGKILL on
  # maestro-driver-ios without a prior SIGTERM. The SIGTERM above (Step 1)
  # fixes that root cause; killing SpringBoard was masking the symptom, not
  # fixing it.

  # ── Step 3: Release port 7001 / 8080 ──────────────────────────────────────
  local port7001_pids
  port7001_pids=$(lsof -ti tcp:7001 2>/dev/null || true)
  if [ -n "$port7001_pids" ]; then
    echo "$port7001_pids" | xargs kill -9 2>/dev/null || true
  fi

  local port8080_pids
  port8080_pids=$(lsof -ti tcp:8080 2>/dev/null || true)
  if [ -n "$port8080_pids" ]; then
    echo "$port8080_pids" | xargs kill -9 2>/dev/null || true
  fi

  # ── Step 4: Final Java sweep ───────────────────────────────────────────────
  local java_pids
  java_pids=$(pgrep -f 'java.*maestro' 2>/dev/null || true)
  if [ -n "$java_pids" ]; then
    echo "🔥 Force-killing remaining Maestro Java processes: $java_pids"
    echo "$java_pids" | xargs kill -9 2>/dev/null || true
  fi

  echo "✅ Maestro process cleanup completed"
}

# ============================================================================
# Cleanup handler — called on script exit or signal (SIGTERM, SIGINT)
# Ensures maestro processes are killed even if suite script is interrupted
# ============================================================================
cleanup_on_exit() {
  local exit_code=$?

  echo -e "${YELLOW}Cleaning up maestro processes...${NC}"
  kill_maestro_daemon

  # In parallel mode the sibling platform's runner has its own live
  # `maestro test`, inspector, tail -F, java-maestro, and port-7001 owner.
  # Every pkill / pgrep below matches by NAME or by PORT and can't tell the
  # two runs apart — running them here will SIGKILL the sibling mid-flow
  # (that's what caused the exit-code-137 failures we just chased).
  # `run-both-platforms.sh` performs a single final sweep once both children
  # have exited; that's the correct place for global pattern kills.
  #
  # Still safe to run in parallel mode: known-PID reapers below (CAPTURE_PID,
  # NETWORK_PID) — those PIDs were captured by THIS script when it spawned
  # them, so they can't collide with the sibling.
  if [ "${PARALLEL_MODE:-}" != "true" ]; then
    pkill -9 -f "maestro test" 2>/dev/null || true
  fi

  # Kill background monitoring loops AND their children (node, sleep, tail -F).
  # pkill -P first to reap children, then kill the subshell. Without this,
  # orphaned grandchild processes keep pipes open and the script hangs.
  if [ -n "${CAPTURE_PID:-}" ]; then
    pkill -P "$CAPTURE_PID" 2>/dev/null || true
    kill "$CAPTURE_PID" 2>/dev/null || true
  fi
  if [ -n "${NETWORK_PID:-}" ]; then
    pkill -P "$NETWORK_PID" 2>/dev/null || true
    kill "$NETWORK_PID" 2>/dev/null || true
  fi

  # Extra safety: kill any stray inspector/monitor/tail processes.
  # Skipped in parallel mode — see comment above.
  if [ "${PARALLEL_MODE:-}" != "true" ]; then
    pkill -9 -f "android-ui-inspector.js" 2>/dev/null || true
    pkill -9 -f "android-network-monitor.js" 2>/dev/null || true
    pkill -f "tail.*-F.*maestro.log" 2>/dev/null || true

    # Final sweep: kill any remaining Java processes from this Maestro session.
    # These zombies consume CPU/memory after the suite finishes and prevent
    # the next suite run from binding port 7001.
    local remaining_java
    remaining_java=$(pgrep -f 'java.*maestro' 2>/dev/null || true)
    if [ -n "$remaining_java" ]; then
      echo "$remaining_java" | xargs kill -9 2>/dev/null || true
    fi

    # Ensure port 7001 is free for the next run
    local exit_port_pids
    exit_port_pids=$(lsof -ti tcp:7001 2>/dev/null || true)
    if [ -n "$exit_port_pids" ]; then
      echo "$exit_port_pids" | xargs kill -9 2>/dev/null || true
    fi
  fi

  exit $exit_code
}

trap cleanup_on_exit EXIT INT TERM

# ============================================================================
# AUTO-DETECT APP CONFIG FROM SUITE PATH
# ============================================================================
# Load app-specific config.env — the single source of truth for suite configuration.
# config.env provides IOS_APP_ID, ANDROID_APP_ID, APP_NAME, BRAND, ENVIRONMENT, BUILD_CONFIG.
# APP_ID is then resolved from the platform-correct variable (no build_config.yaml needed).
if [[ "$SUITE_FILE" == *".maestro/apps/health100/suites/"* ]]; then
  APP_CONFIG_FILE="$PROJECT_ROOT/.maestro/apps/health100/config.env"
  SUITE_LABEL="Health100"
elif [[ "$SUITE_FILE" == *".maestro/apps/cvshealth/suites/"* ]]; then
  APP_CONFIG_FILE="$PROJECT_ROOT/.maestro/apps/cvshealth/config.env"
  SUITE_LABEL="CVS Health"
else
  APP_CONFIG_FILE=""
  SUITE_LABEL=""
fi

if [ -n "$APP_CONFIG_FILE" ] && [ -f "$APP_CONFIG_FILE" ]; then
  echo -e "${BLUE}📱 Detected ${SUITE_LABEL} suite${NC}"
  echo -e "${BLUE}   Loading config from: $APP_CONFIG_FILE${NC}"
  source "$APP_CONFIG_FILE"

  # Select the platform-correct APP_ID.
  # ANDROID_BUILD_VARIANT comes from config.env (already sourced above).
  if [ "$PLATFORM" = "android" ]; then
    export APP_ID="${ANDROID_APP_ID:-com.cvs.launchers.cvs}"
    export ANDROID_BUILD_VARIANT="${ANDROID_BUILD_VARIANT:-healthDebug}"
  else
    export APP_ID="${IOS_APP_ID:-com.cvsenterpriseiphone.cvspharmacy}"
  fi

  echo -e "${GREEN}✓ ${SUITE_LABEL} config loaded:${NC}"
  echo -e "${GREEN}  • APP_ID:   $APP_ID${NC}"
  echo -e "${GREEN}  • APP_NAME: ${APP_NAME:-}${NC}"
  echo -e "${GREEN}  • BRAND:    ${BRAND:-cvshealth}${NC}"
  echo -e "${GREEN}  • Platform: $PLATFORM${NC}"
  [ "$PLATFORM" = "android" ] && echo -e "${GREEN}  • Build Variant: $ANDROID_BUILD_VARIANT${NC}"
  echo ""
elif [ -z "$APP_ID" ]; then
  echo -e "${YELLOW}⚠️  No app config.env found for suite path — APP_ID must be set via environment${NC}"
  exit 1
fi

echo "APP_ID: $APP_ID"

# BUILD_CONFIG comes from config.env (sourced above) or an explicit env var override.
# Mapping: debug -> qa credentials, adhoc/alpha/release -> prod credentials.
# Fall back to "adhoc" if neither config.env nor the env provided a value.
BUILD_CONFIG="${BUILD_CONFIG:-adhoc}"
BUILD_CONFIG_LOWER=$(echo "$BUILD_CONFIG" | tr '[:upper:]' '[:lower:]')

# Export BUILD_CONFIG so load-credentials.js can auto-detect environment
export BUILD_CONFIG="$BUILD_CONFIG_LOWER"

# Derive ENVIRONMENT from BUILD_CONFIG for reporting/slack (if not already set)
if [ -z "$ENVIRONMENT" ]; then
  case "$BUILD_CONFIG_LOWER" in
    debug)              ENVIRONMENT="qa" ;;
    adhoc|alpha|release) ENVIRONMENT="prod" ;;
    *)                  ENVIRONMENT="qa" ;;
  esac
  export ENVIRONMENT
fi

echo "Build Config: $BUILD_CONFIG_LOWER (Environment: $ENVIRONMENT)"
echo "Loading credentials automatically..."

# Load credentials using Node.js (auto-detects environment from BUILD_CONFIG)
if command -v node &> /dev/null; then
  eval "$(node "$SCRIPT_DIR/../setup/load-credentials.js")"
  echo "✓ Credentials loaded successfully"
else
  echo "⚠️  Node.js not found, credentials not loaded"
fi

# Override with named user profile if --user-profile was supplied.
# The profile loader resolves ${ENV_VAR} placeholders and exports
# COMMON_USER / COMMON_PASSWORD / COMMON_OTP / COMMON_DOB / STATIC_OTP / DOB
# overriding whatever load-credentials.js set above.
if [ -n "$USER_PROFILE" ] && [ "$USER_PROFILE" != "default" ] && command -v node &>/dev/null; then
  echo "Loading user profile: $USER_PROFILE"
  PROFILE_EXPORTS=$(node "$SCRIPT_DIR/../setup/load-user-profile.js" "$USER_PROFILE" 2>/tmp/profile-err)
  PROFILE_EXIT=$?
  if [ $PROFILE_EXIT -ne 0 ]; then
    echo -e "${RED}❌ User profile load failed:${NC}"
    cat /tmp/profile-err 2>/dev/null
    exit 1
  fi
  eval "$PROFILE_EXPORTS"
  echo "✓ User profile loaded: $USER_PROFILE"
fi

echo ""

echo -e "${BLUE}Configuration:${NC}"
echo "  Platform: $PLATFORM"
echo "  Suite File: $SUITE_FILE"
echo "  APP_ID: $APP_ID"
echo "  BRAND: ${BRAND:-cvshealth}"
echo "  APP_NAME: ${APP_NAME:-CVS Health}"
echo "  Build Config: $BUILD_CONFIG_LOWER"
echo "  Environment: $ENVIRONMENT"
echo "  Skip Setup: $SKIP_SETUP"
echo "  Credentials: Loaded"
echo ""

# Setup device if needed
if [ "$SKIP_SETUP" = "false" ]; then
  echo -e "${BLUE}Setting up $PLATFORM device...${NC}"
  if [ "$PLATFORM" = "ios" ]; then
    if [ -n "$DEVICE" ]; then
      echo -e "${BLUE}Using specified device: $DEVICE${NC}"
      bash "$SCRIPT_DIR/../setup/ios-setup.sh" boot "$DEVICE" || {
        echo -e "${RED}❌ Failed to setup iOS simulator: $DEVICE${NC}"
        exit 1
      }
    else
      bash "$SCRIPT_DIR/../setup/ios-setup.sh" boot || {
        echo -e "${RED}❌ Failed to setup iOS simulator${NC}"
        exit 1
      }
    fi
  elif [ "$PLATFORM" = "android" ]; then
    bash "$SCRIPT_DIR/../setup/android-setup.sh" boot || {
      echo -e "${RED}❌ Failed to setup Android emulator${NC}"
      exit 1
    }
  fi
  echo ""
  
  # Check if app is installed and auto-install if missing
  echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║  Verify App Installation                                  ║${NC}"
  echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
  echo ""
  
  if [ "$PLATFORM" = "ios" ]; then
    # Check if iOS app is installed
    BUNDLE_ID="$APP_ID"
    SIM_UDID=$(xcrun simctl list devices 2>/dev/null | grep "(Booted)" | grep -E -o '[0-9A-F-]{36}' | head -1)
    
    if [ -z "$SIM_UDID" ]; then
      echo -e "${RED}❌ No booted simulator found${NC}"
      exit 1
    fi
    
    echo -e "${BLUE}Checking if app is installed: $BUNDLE_ID${NC}"
    
    if xcrun simctl listapps "$SIM_UDID" 2>/dev/null | grep -q "$BUNDLE_ID"; then
      echo -e "${GREEN}✓ App is already installed${NC}"
    else
      echo -e "${YELLOW}⚠️  App not found on simulator${NC}"
      echo -e "${BLUE}Building and installing app automatically...${NC}"
      echo ""
      
      # Build and install app
      if [ -f "$PROJECT_ROOT/IOS/CVSOnlineiPhone/Podfile" ]; then
        BUNDLE_ID_OVERRIDE="$BUNDLE_ID" bash "$SCRIPT_DIR/../build/build.sh" ios local || {
          echo -e "${RED}❌ Build failed${NC}"
          exit 1
        }
      else
        BUNDLE_ID_OVERRIDE="$BUNDLE_ID" bash "$SCRIPT_DIR/../build/build.sh" ios repo main || {
          echo -e "${RED}❌ Build failed${NC}"
          exit 1
        }
      fi
      
      # Verify app is now installed
      if xcrun simctl listapps "$SIM_UDID" 2>/dev/null | grep -q "$BUNDLE_ID"; then
        echo -e "${GREEN}✓ App installed successfully${NC}"
      else
        echo -e "${RED}❌ App installation failed${NC}"
        exit 1
      fi
    fi
  elif [ "$PLATFORM" = "android" ]; then
    # Check if Android app is installed
    echo -e "${BLUE}Checking if app is installed: $APP_ID${NC}"
    
    if adb shell pm list packages 2>/dev/null | grep -q "package:$APP_ID"; then
      echo -e "${GREEN}✓ App already installed${NC}"
    else
      echo -e "${YELLOW}⚠️  App not installed${NC}"
      echo -e "${BLUE}Building and installing app automatically...${NC}"
      echo ""
      
      # Build and install app
      bash "$SCRIPT_DIR/../build/build.sh" android repo || {
        echo -e "${RED}❌ Android build failed${NC}"
        exit 1
      }
      
      # Verify app is now installed
      if adb shell pm list packages 2>/dev/null | grep -q "package:$APP_ID"; then
        echo -e "${GREEN}✓ App installed successfully${NC}"
      else
        echo -e "${RED}❌ App installation failed${NC}"
        exit 1
      fi
    fi
  fi
  echo ""
fi

# Create report directory
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
PLATFORM_NAME=$(echo "$PLATFORM" | tr '[:lower:]' '[:upper:]')
REPORT_DIR="$PROJECT_ROOT/test-reports/${PLATFORM_NAME}_${TIMESTAMP}${REPORT_SUFFIX:+_$REPORT_SUFFIX}"
mkdir -p "$REPORT_DIR"
mkdir -p "$REPORT_DIR/logs"

# Create maestro-test.log for report branding detection
# This log file is read by generate-unified-report.js to detect app brand
MAESTRO_LOG="$REPORT_DIR/logs/maestro-test.log"
{
  echo "╔════════════════════════════════════════════════════════════╗"
  echo "║           Maestro Test Suite Execution Log                 ║"
  echo "╚════════════════════════════════════════════════════════════╝"
  echo ""
  echo "Test Information:"
  echo "  Suite File: $(basename "$SUITE_FILE")"
  echo "  Platform: $PLATFORM"
  echo "  APP_ID: $APP_ID"
  echo "  BRAND: ${BRAND:-cvshealth}"
  echo "  APP_NAME: ${APP_NAME:-CVS Health}"
  echo ""
  echo "Execution started: $(date '+%Y-%m-%d %H:%M:%S')"
  echo "═══════════════════════════════════════════════════════════"
  echo ""
} > "$MAESTRO_LOG"

# Parse suite file to extract test flows
echo -e "${BLUE}Parsing suite file...${NC}"
SUITE_DIR=$(dirname "$SUITE_FILE")

# Extract runFlow file references from suite (skip commented lines)
TEST_FILES=()
while IFS= read -r line || [[ -n "$line" ]]; do
  # Skip lines that start with # (commented out)
  [[ $line =~ ^[[:space:]]*# ]] && continue
  # Only match file: in uncommented lines
  if [[ $line =~ file:\ (.+\.yaml) ]]; then
    TEST_FILE="${BASH_REMATCH[1]}"
    # Resolve relative path
    if [[ $TEST_FILE == /* ]]; then
      FULL_PATH="$TEST_FILE"
    else
      FULL_PATH="$SUITE_DIR/$TEST_FILE"
    fi
    if [ -f "$FULL_PATH" ]; then
      TEST_FILES+=("$FULL_PATH")
    fi
  fi
done < "$SUITE_FILE"

if [ ${#TEST_FILES[@]} -eq 0 ]; then
  echo -e "${RED}❌ No test files found in suite${NC}"
  exit 1
fi

echo "Found ${#TEST_FILES[@]} tests"
echo ""

# Run tests and collect results
PASSED=0
FAILED=0
TOTAL=${#TEST_FILES[@]}
RESULTS_JSON="$REPORT_DIR/suite-results.json"

# Timeout for driver startup — the XCTest driver on iOS can take 90-120s to
# install, especially after a process cleanup cycle. 240s matches run-maestro.sh.
export MAESTRO_DRIVER_STARTUP_TIMEOUT=${MAESTRO_DRIVER_STARTUP_TIMEOUT:-240000}

# Helper function to escape JSON strings
escape_json() {
  local string="$1"
  # Escape backslashes, quotes, and control characters
  printf '%s\n' "$string" | sed 's/\\/\\\\/g; s/"/\\"/g; s/	/\\t/g'
}

# Initialize JSON results file with proper structure
{
  echo "{"
  echo '  "suite": "'$(escape_json "$(basename "$SUITE_FILE")")'",'
  echo '  "platform": "'$PLATFORM'",'
  echo '  "timestamp": "'$TIMESTAMP'",'
  echo '  "tests": ['
} > "$RESULTS_JSON"

FIRST_TEST=true

echo -e "${BLUE}Running tests...${NC}"
echo ""
SUITE_START_SECS=$SECONDS

for TEST_FILE in "${TEST_FILES[@]}"; do
  TEST_NAME=$(basename "$TEST_FILE" .yaml)
  TEST_DIR="$REPORT_DIR/$TEST_NAME"
  mkdir -p "$TEST_DIR"
  
  # Option B: only kill the Maestro daemon when necessary.
  # A passing test leaves the XCTest driver alive and listening on port 7001.
  # The next `maestro test` can reconnect to it in ~5s instead of the 60–120s
  # a full driver restart takes after SpringBoard is cycled.
  # Kill unconditionally for: (a) the first test — no driver exists yet;
  # (b) after any failure — the driver may be stuck or in an inconsistent state.
  if [ $((PASSED + FAILED)) -eq 0 ] || [ "${PREV_TEST_STATUS:-}" = "failed" ]; then
    echo "  Preparing for test $((PASSED + FAILED + 1))/$TOTAL (cleaning stale driver)..."
    kill_maestro_daemon
  else
    echo "  ⚡ [$((PASSED + FAILED + 1))/$TOTAL] Previous test passed — reusing live XCTest driver"
  fi

  # At snapshot interval boundaries (Android only): ensure Maestro is dead, then reload.
  if [ "$PLATFORM" = "android" ] && [ "${SNAPSHOT_INTERVAL:-0}" -gt 0 ]; then
    _TEST_SEQ=$((PASSED + FAILED + 1))
    if [ "$_TEST_SEQ" -gt 1 ] && [ $(( (_TEST_SEQ - 1) % SNAPSHOT_INTERVAL )) -eq 0 ]; then
      kill_maestro_daemon
      reload_android_snapshot
    fi
  fi

  if [ $((PASSED + FAILED)) -eq 0 ]; then
    # Pre-launch the app on the first test to seed the data container.
    # clear_ios_app_state wipes it before every test; this launch ensures the
    # container exists so the first state-reset and Maestro connect succeed.
    if [ "$PLATFORM" = "ios" ]; then
      _PRE_SIM=$(xcrun simctl list devices 2>/dev/null | grep "(Booted)" | grep -E -o '[0-9A-F-]{36}' | head -1)
      if [ -n "$_PRE_SIM" ]; then
        echo -e "${BLUE}Pre-launching app to seed data container: $APP_ID${NC}"
        xcrun simctl launch "$_PRE_SIM" "$APP_ID" 2>/dev/null || true
        sleep 3
        xcrun simctl terminate "$_PRE_SIM" "$APP_ID" 2>/dev/null || true
        sleep 1
        echo -e "${GREEN}  ✓ App pre-launch complete${NC}"
      fi
    fi
  fi

  # ── Validate device is still connected ────────────────────────────────────
  # Prevents the "Device ... was requested, but it is not connected" cascade
  # that fails every remaining test when a simulator reboots or is replaced.
  reset_device_id="$DEVICE"
  if [ -z "$reset_device_id" ]; then
    if [ "$PLATFORM" = "android" ]; then
      reset_device_id=$(adb devices 2>/dev/null | grep -v "List of devices" | grep "device$" | awk '{print $1}' | head -1)
    else
      reset_device_id=$(xcrun simctl list devices 2>/dev/null | grep "(Booted)" | grep -E -o '[0-9A-F-]{36}' | head -1)
    fi
  fi

  if [ "$PLATFORM" = "ios" ] && [ -n "$reset_device_id" ]; then
    # Verify the UDID is actually booted — simctl getenv fails for non-booted devices
    if ! xcrun simctl getenv "$reset_device_id" HOME > /dev/null 2>&1; then
      echo -e "${YELLOW}⚠️  Simulator $reset_device_id is no longer booted — re-detecting...${NC}"
      reset_device_id=$(xcrun simctl list devices 2>/dev/null | grep "(Booted)" | grep -E -o '[0-9A-F-]{36}' | head -1)
      if [ -z "$reset_device_id" ]; then
        echo -e "${RED}❌ No booted iOS simulator found — cannot continue${NC}"
        # Record remaining tests as failed and break
        TEST_EXIT_CODE=1
        echo -e "${RED}FAILED${NC} (no simulator)"
        ((FAILED++))
        STATUS="failed"
        PREV_TEST_STATUS="$STATUS"
        if [ "$FIRST_TEST" = false ]; then echo "," >> "$RESULTS_JSON"; fi
        FIRST_TEST=false
        { echo "    {"; echo '      "name": "'$(escape_json "$TEST_NAME")'",'; echo '      "file": "'$(escape_json "$TEST_FILE")'",'; echo '      "status": "failed",'; echo '      "duration": 0'; echo -n "    }"; } >> "$RESULTS_JSON"
        continue
      fi
      echo -e "${GREEN}  ✓ Re-detected booted simulator: $reset_device_id${NC}"
      # Update DEVICE so subsequent tests and the maestro --device flag use the right UDID
      DEVICE="$reset_device_id"
    fi
  elif [ "$PLATFORM" = "ios" ] && [ -z "$reset_device_id" ]; then
    echo -e "${RED}❌ No booted iOS simulator found — cannot continue${NC}"
    TEST_EXIT_CODE=1
    echo -e "${RED}FAILED${NC} (no simulator)"
    ((FAILED++))
    STATUS="failed"
    PREV_TEST_STATUS="$STATUS"
    if [ "$FIRST_TEST" = false ]; then echo "," >> "$RESULTS_JSON"; fi
    FIRST_TEST=false
    { echo "    {"; echo '      "name": "'$(escape_json "$TEST_NAME")'",'; echo '      "file": "'$(escape_json "$TEST_FILE")'",'; echo '      "status": "failed",'; echo '      "duration": 0'; echo -n "    }"; } >> "$RESULTS_JSON"
    continue
  fi

  # One-time: save Android snapshot before first test (clean pre-suite state).
  if [ "$PLATFORM" = "android" ] && [ "${SNAPSHOT_INTERVAL:-0}" -gt 0 ] && [ $((PASSED + FAILED)) -eq 0 ]; then
    setup_android_snapshot
  fi

  # Reset app state between tests for test isolation
  bash "$SCRIPT_DIR/../utils/state-management/reset-app-state.sh" "${PLATFORM:-ios}" "$APP_ID" "$reset_device_id"
  
  echo -n "  [$((PASSED + FAILED + 1))/$TOTAL] $TEST_NAME ... "

  # ──────────────────────────────────────────────────────────────────────────
  # Screen preloader: auto-inject all required screen runScript entries into
  # the flow's onFlowStart so every subflow has access to output.* variables.
  # ──────────────────────────────────────────────────────────────────────────
  PRELOADED_TEST_FILE="$TEST_FILE"
  SCREEN_PRELOADER="$SCRIPT_DIR/../utils/screen-management/screen-preloader.js"
  if [ -f "$SCREEN_PRELOADER" ] && command -v node &>/dev/null; then
    PRELOADED_TEST_FILE=$(node "$SCREEN_PRELOADER" "$TEST_FILE" --generate-temp 2>/dev/null)
    if [ -z "$PRELOADED_TEST_FILE" ] || [ ! -f "$PRELOADED_TEST_FILE" ]; then
      PRELOADED_TEST_FILE="$TEST_FILE"
    fi
  fi

  # Build environment arguments for maestro test
  TEST_ENV_ARGS="--env APP_ID=$APP_ID --env BRAND=${BRAND:-cvshealth} --env BUILD_CONFIG=$BUILD_CONFIG_LOWER"

  # Pass all loaded credentials
  if [ -n "$COMMON_USER" ]; then
    TEST_ENV_ARGS="$TEST_ENV_ARGS --env COMMON_USER=$COMMON_USER"
  fi
  if [ -n "$COMMON_PASSWORD" ]; then
    TEST_ENV_ARGS="$TEST_ENV_ARGS --env COMMON_PASSWORD=$COMMON_PASSWORD"
  fi
  if [ -n "$COMMON_OTP" ]; then
    TEST_ENV_ARGS="$TEST_ENV_ARGS --env COMMON_OTP=$COMMON_OTP"
  fi
  if [ -n "$COMMON_DOB" ]; then
    TEST_ENV_ARGS="$TEST_ENV_ARGS --env COMMON_DOB=$COMMON_DOB"
  fi
  if [ -n "$STATIC_OTP" ]; then
    TEST_ENV_ARGS="$TEST_ENV_ARGS --env STATIC_OTP=$STATIC_OTP"
  fi
  if [ -n "$DOB" ]; then
    TEST_ENV_ARGS="$TEST_ENV_ARGS --env DOB=$DOB"
  fi
  
  # Ensure Android device is online before starting test
  if [ "$PLATFORM" = "android" ]; then
    ANDROID_DEVICE_ID=$(adb devices | grep -v "List of devices" | grep "device$" | awk '{print $1}' | head -1)
    if [ -n "$ANDROID_DEVICE_ID" ]; then
      for i in 1 2 3; do
        DEVICE_STATE=$(adb -s "$ANDROID_DEVICE_ID" get-state 2>/dev/null || echo "offline")
        if [ "$DEVICE_STATE" = "device" ]; then
          break
        fi
        echo -n "(waiting for device...) "
        sleep 5
      done
    fi
  fi

  # Clear iOS app state before each test (for test isolation)
  if [ "$PLATFORM" = "ios" ]; then
    echo -e "${BLUE}Resetting iOS app state: $APP_ID${NC}"
    clear_ios_app_state "$APP_ID"
    echo ""
  fi

  # Run test with environment variables and timeout
  START_TIME=$(date +%s%N)
  SUITE_DEVICE_FLAG=""
  [ -n "$DEVICE" ] && SUITE_DEVICE_FLAG="--device $DEVICE"

  # Set timeout (5 minutes default, can be overridden via TEST_TIMEOUT env var)
  TEST_TIMEOUT=${TEST_TIMEOUT:-650}

  echo "  ⏱️  Test timeout set to ${TEST_TIMEOUT}s"

  # Run test with timeout to prevent hanging (macOS compatible)
  # Set Java heap size to prevent memory-related kills
  export JAVA_OPTS="-Xmx2g -Xms512m"
  maestro --platform "$PLATFORM" $SUITE_DEVICE_FLAG test "$PRELOADED_TEST_FILE" \
    $TEST_ENV_ARGS \
    --format junit \
    --output "$TEST_DIR/results.xml" \
    --test-output-dir "$TEST_DIR" \
    --debug-output "$TEST_DIR/debug" \
    --flatten-debug-output \
    > "$TEST_DIR/test.log" 2>&1 &
  MAESTRO_PID=$!
  
  # Wait for test to complete or timeout (poll every 2s instead of blocking)
  ELAPSED=0
  TEST_EXIT_CODE=""
  while [ $ELAPSED -lt $TEST_TIMEOUT ]; do
    if ! kill -0 $MAESTRO_PID 2>/dev/null; then
      # Process finished — capture its exit code
      wait $MAESTRO_PID
      TEST_EXIT_CODE=$?
      break
    fi
    sleep 2
    ELAPSED=$((ELAPSED + 2))
  done

  # If loop ended without the process exiting, it timed out
  if [ -z "$TEST_EXIT_CODE" ]; then
    echo -e "${YELLOW}⚠️  Test timed out after ${TEST_TIMEOUT}s - killing hanging process${NC}"

    # Kill child processes (Java, XCTest driver) BEFORE the parent.
    # If we kill the parent first, children get re-parented to PID 1 (launchd)
    # and pkill -P can no longer find them — leaving orphaned JVMs at 120% CPU.
    pkill -9 -P $MAESTRO_PID 2>/dev/null || true
    sleep 1

    # Now kill the Maestro CLI wrapper itself
    kill $MAESTRO_PID 2>/dev/null || true
    sleep 1
    kill -9 $MAESTRO_PID 2>/dev/null || true

    # Reap the zombie so `wait` doesn't block
    wait $MAESTRO_PID 2>/dev/null || true

    # Kill any hanging Maestro processes for this test.
    # Skipped in parallel mode — both platforms may be running the SAME flow
    # file simultaneously, so name-scoped pkill by $TEST_NAME would match the
    # sibling platform's live JVM. The XCT/port-7001 kills are also global and
    # would tear down whichever platform currently owns port 7001.
    if [ "${PARALLEL_MODE:-}" != "true" ]; then
      pkill -9 -f "maestro.*test.*$TEST_NAME" 2>/dev/null || true
      pkill -9 -f "java.*maestro.*$TEST_NAME" 2>/dev/null || true

      # Force kill accessibility processes that might be hanging
      pkill -9 -f 'XCTAutomationSupport' 2>/dev/null || true
      pkill -9 -f 'XCTestSupport'       2>/dev/null || true

      # Release port 7001 so the next test can bind
      timeout_port_pids=$(lsof -ti tcp:7001 2>/dev/null || true)
      if [ -n "$timeout_port_pids" ]; then
        echo "$timeout_port_pids" | xargs kill -9 2>/dev/null || true
      fi
    fi

    TEST_EXIT_CODE=1
    echo "Test execution timed out after ${TEST_TIMEOUT} seconds" >> "$TEST_DIR/test.log"
  fi
  
  # Move Maestro output files from timestamped subfolder to test directory
  # Maestro creates a subfolder like "2026-04-17_151655" inside test-output-dir
  MAESTRO_TIMESTAMP_FOLDER=$(find "$TEST_DIR" -maxdepth 1 -type d -name "????-??-??_??????" 2>/dev/null | head -1)
  if [ -n "$MAESTRO_TIMESTAMP_FOLDER" ] && [ -d "$MAESTRO_TIMESTAMP_FOLDER" ]; then
    # Move all artifacts to test directory root
    find "$MAESTRO_TIMESTAMP_FOLDER" -maxdepth 1 -type f \( -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" \) -exec mv {} "$TEST_DIR/" \; 2>/dev/null || true
    find "$MAESTRO_TIMESTAMP_FOLDER" -maxdepth 1 -type f -name "*.json" -exec mv {} "$TEST_DIR/" \; 2>/dev/null || true
    find "$MAESTRO_TIMESTAMP_FOLDER" -maxdepth 1 -type f -name "*.html" -exec mv {} "$TEST_DIR/" \; 2>/dev/null || true
    # Remove the empty timestamped subfolder
    rmdir "$MAESTRO_TIMESTAMP_FOLDER" 2>/dev/null || true
  fi
  
  # Clean up temp preloaded flow file — ONLY if it is a known temp file.
  # Safety guard: never delete source files. If the path does not contain
  # .tmp_preloaded_ or /tmp/ it is not a temp file and must not be removed.
  if [ -f "$PRELOADED_TEST_FILE" ] && \
     [[ "$PRELOADED_TEST_FILE" == *"/.tmp_preloaded_"* || \
        "$PRELOADED_TEST_FILE" == *"/tmp/"* || \
        "$PRELOADED_TEST_FILE" == *"/var/folders/"* ]]; then
    rm -f "$PRELOADED_TEST_FILE"
  elif [ "$PRELOADED_TEST_FILE" != "$TEST_FILE" ] && [ -f "$PRELOADED_TEST_FILE" ]; then
    echo -e "${YELLOW}⚠  [screen-preloader] skipping cleanup — not a recognised temp path: $PRELOADED_TEST_FILE${NC}" >&2
  fi

  # Capture hierarchy on failure while device is still running
  if [ $TEST_EXIT_CODE -ne 0 ]; then
    echo "Capturing device element hierarchy..."
     node "$SCRIPT_DIR/../utils/ui-capture/capture-hierarchy-on-failure.js" "$TEST_NAME" "failure_step" "$REPORT_DIR" "$PLATFORM" 2>/dev/null || true
  fi

  # Kill any child Java processes that survived this test's Maestro CLI exit.
  # The EXIT trap handles final cleanup, but orphaned JVMs between tests spin
  # at 120% CPU and compete with the next test for resources.
  #
  # Skipped in parallel mode — pgrep-by-name would match the sibling
  # platform's live Maestro JVM and kill it mid-flow. The wrapper
  # (run-both-platforms.sh) does the final unified sweep once both children exit.
  if [ "${PARALLEL_MODE:-}" != "true" ]; then
    orphan_java_pids=$(pgrep -f "java.*maestro" 2>/dev/null || true)
    if [ -n "$orphan_java_pids" ]; then
      echo "$orphan_java_pids" | xargs kill -9 2>/dev/null || true
    fi
  fi

  END_TIME=$(date +%s%N)
  DURATION=$(awk "BEGIN {printf \"%.3f\", ($END_TIME - $START_TIME) / 1000000000}")
  
  if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}PASSED${NC} (${DURATION}s)"
    ((PASSED++))
    STATUS="passed"
  else
    echo -e "${RED}FAILED${NC} (${DURATION}s)"
    ((FAILED++))
    STATUS="failed"
  fi
  PREV_TEST_STATUS="$STATUS"

  # Add to JSON results with proper escaping
  if [ "$FIRST_TEST" = false ]; then
    echo "," >> "$RESULTS_JSON"
  fi
  FIRST_TEST=false
  
  {
    echo "    {"
    echo '      "name": "'$(escape_json "$TEST_NAME")'",'
    echo '      "file": "'$(escape_json "$TEST_FILE")'",'
    echo '      "status": "'$STATUS'",'
    echo '      "duration": '$DURATION
    echo -n "    }"
  } >> "$RESULTS_JSON"
done

# Close JSON structure
{
  echo ""
  echo "  ],"
  echo '  "summary": {'
  echo '    "total": '$TOTAL','
  echo '    "passed": '$PASSED','
  echo '    "failed": '$FAILED
  echo "  }"
  echo "}"
} >> "$RESULTS_JSON"

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Test Summary${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo "Total:  $TOTAL"
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo ""

# Generate HTML report using unified report generator
if command -v node &> /dev/null; then
  echo -e "${BLUE}Generating HTML report...${NC}"
  
  # Create a temporary XML file for the unified report generator
  TEMP_XML="$REPORT_DIR/suite-results-temp.xml"
  
  # Convert JSON results to JUnit XML format with actual failure messages from per-test results.xml
  node -e "
    const fs = require('fs');
    const path = require('path');
    const results = JSON.parse(fs.readFileSync('$RESULTS_JSON', 'utf8'));
    
    let xml = '<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n';
    xml += '<testsuite name=\"' + results.suite + '\" tests=\"' + results.summary.total + '\" failures=\"' + results.summary.failed + '\" time=\"0\">\n';
    
    results.tests.forEach(test => {
      xml += '  <testcase name=\"' + test.name + '\" time=\"' + test.duration + '\">\n';
      if (test.status === 'failed') {
        // Try to read the actual failure message from the per-test results.xml
        let failureMsg = 'Test execution failed';
        const testResultsXml = path.join('$REPORT_DIR', test.name, 'results.xml');
        try {
          if (fs.existsSync(testResultsXml)) {
            const testXmlContent = fs.readFileSync(testResultsXml, 'utf8');
            const failureMatch = testXmlContent.match(/<failure[^>]*>([^<]+)<\/failure>/);
            if (failureMatch && failureMatch[1]) {
              failureMsg = failureMatch[1].trim();
            }
          }
        } catch (e) {
          // Use default message if file read fails
        }
        xml += '    <failure message=\"' + failureMsg.replace(/\"/g, '&quot;') + '\">' + failureMsg.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</failure>\n';
      }
      xml += '  </testcase>\n';
    });
    
    xml += '</testsuite>\n';
    fs.writeFileSync('$TEMP_XML', xml);
  " || {
    echo -e "${YELLOW}⚠️  Failed to convert results to XML${NC}"
  }
  
  # Generate report using unified generator
  # Pass REPORT_DIR as environment variable so report generator can find per-test artifacts
  if [ -f "$TEMP_XML" ]; then
    REPORT_FILE="$REPORT_DIR/suite-report.html"
    REPORT_DIR="$REPORT_DIR" node "$SCRIPT_DIR/../reporting/generate-unified-report.js" "$TEMP_XML" "$REPORT_FILE" "$PLATFORM" || {
      echo -e "${YELLOW}⚠️  Failed to generate HTML report${NC}"
    }
    rm -f "$TEMP_XML"
  fi
fi

REPORT_FILE="$REPORT_DIR/suite-report.html"
if [ -f "$REPORT_FILE" ]; then
  echo -e "${GREEN}✓ Report generated: $REPORT_FILE${NC}"
  
  if [ "$NO_BROWSER" = "false" ]; then
    echo ""
    echo -e "${BLUE}Opening report...${NC}"
    open "$REPORT_FILE"
  fi
fi

echo ""
echo -e "${GREEN}✓ Suite execution complete${NC}"

# Append completion info to maestro-test.log
{
  echo ""
  echo "═══════════════════════════════════════════════════════════"
  echo "Execution ended: $(date '+%Y-%m-%d %H:%M:%S')"
  echo "Suite Results: $PASSED passed, $FAILED failed, $TOTAL total"
  echo "═══════════════════════════════════════════════════════════"
} >> "$MAESTRO_LOG"

# Send Slack notification (non-blocking — never fails the test pipeline)
if [ "$SLACK_ENABLED" = "true" ] && command -v node &>/dev/null; then
  _SUITE_ELAPSED=$(( SECONDS - SUITE_START_SECS ))
  _SUITE_MIN=$(( _SUITE_ELAPSED / 60 ))
  _SUITE_SEC=$(( _SUITE_ELAPSED % 60 ))
  _SUITE_DURATION="${_SUITE_MIN}m ${_SUITE_SEC}s"
  _SUITE_STATUS=$( [ $FAILED -gt 0 ] && echo "failed" || echo "passed" )
  _SUITE_DISPLAY=$(basename "$SUITE_FILE" .yaml | tr '_' ' ')
  REPORT_FILE="$REPORT_DIR/suite-report.html"
  node "$SCRIPT_DIR/../integrations/slack/slack-notify.js" \
    --status       "$_SUITE_STATUS" \
    --suite-name   "$_SUITE_DISPLAY" \
    --platform     "$PLATFORM" \
    --app          "${APP_NAME:-}" \
    --environment  "${ENVIRONMENT:-qa}" \
    --total        $TOTAL \
    --passed       $PASSED \
    --failed       $FAILED \
    --duration     "$_SUITE_DURATION" \
    --duration-seconds "$_SUITE_ELAPSED" \
    --report-path  "$REPORT_FILE" \
    --results-json "$RESULTS_JSON" 2>/dev/null || true
fi

# Report results to Zephyr Scale (non-blocking — never fails the test pipeline).
# Creates a "<area>-regression" test cycle and a Pass/Fail execution for every
# test whose Maestro flow YAML carries a Zephyr test case key tag
# (e.g. TLPCWHSAM-T639). Tests without such a tag are skipped.
if [ "$ZEPHYR_EXECUTION_ENABLED" = "true" ] && command -v node &>/dev/null; then
  echo ""
  echo -e "${BLUE}Reporting results to Zephyr Scale...${NC}"
  REPORT_FILE="$REPORT_DIR/suite-report.html"
  node "$SCRIPT_DIR/../integrations/zephyr/zephyr-run-reporter.js" \
    --suite-file   "$SUITE_FILE" \
    --results-json "$RESULTS_JSON" \
    --platform     "$PLATFORM" \
    --environment  "${ENVIRONMENT:-qa}" \
    --report-url   "file://$REPORT_FILE" || {
    echo -e "${YELLOW}⚠️  Zephyr reporting failed (non-fatal)${NC}"
  }
fi

# Exit with appropriate code
if [ $FAILED -gt 0 ]; then
  exit 1
else
  exit 0
fi
