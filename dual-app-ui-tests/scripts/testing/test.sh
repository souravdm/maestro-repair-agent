#!/bin/bash

###############################################################################
# Maestro Test Runner - Consolidated Script
# Handles: Test execution with reporting, platform detection, device setup
# Merged from: maestro-unified.sh, maestro_wrapper.sh, run-tests-with-report.sh
###############################################################################

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ============================================================================
# Reset Android driver state between runs.
#
# The "Maestro Android driver did not start up in time --- dadb.open( tcp:NNNNN )"
# timeout after 2-3 test runs is caused by state the JVM doesn't clean up on
# exit:
#   1. `adb forward` entries pile up — each run reserves a random local port
#      (49561, 49562, ...) and never releases it, so dadb eventually can't
#      bind a fresh forward.
#   2. The on-device instrumentation packages (dev.mobile.maestro and
#      dev.mobile.maestro.test) are left running/half-attached; the next
#      session times out waiting for them to respond.
#   3. The adb daemon itself gets into a degraded state after many sessions.
#
# Safe to call whether the last platform was iOS or Android — all commands
# are no-ops if adb isn't available or no device is connected.
# ============================================================================
cleanup_android_driver_state() {
  command -v adb >/dev/null 2>&1 || return 0

  # Skip entirely if no Android device is attached — avoids noisy adb output
  # and needless work on iOS-only runs.
  local android_device
  android_device=$(adb devices 2>/dev/null | grep -v "List of devices" | grep "device$" | awk '{print $1}' | head -1)
  [ -z "$android_device" ] && return 0

  # 1. Drop every adb forward for this device. Prevents the local-port leak
  #    that eventually makes dadb.open() time out.
  adb -s "$android_device" forward --remove-all 2>/dev/null || true

  # 2. Force-stop the Maestro instrumentation packages on device. If a prior
  #    run's driver process is still attached, the next `maestro test` will
  #    hang waiting for it to hand off.
  adb -s "$android_device" shell am force-stop dev.mobile.maestro 2>/dev/null || true
  adb -s "$android_device" shell am force-stop dev.mobile.maestro.test 2>/dev/null || true
  # Stop any lingering instrumentation runners for the same test package
  adb -s "$android_device" shell 'pm list instrumentation 2>/dev/null | grep dev.mobile.maestro | sed "s/instrumentation://;s/ .*//" | xargs -r -I{} am force-stop $(echo {} | cut -d/ -f1)' 2>/dev/null || true

  # 3. Settle: wait for the adb server to report the device as fully back in
  #    "device" state before returning. Without this, the very next
  #    `maestro test` invocation can race the forward --remove-all / force-stop
  #    above and open a new dadb forward against a transport that hasn't
  #    settled yet, producing "Command failed (tcp:NNNNN): closed" immediately
  #    on the deviceInfo call. Poll briefly instead of a flat sleep.
  local _settle_retry=0
  while [ $_settle_retry -lt 10 ]; do
    local _state
    _state=$(adb -s "$android_device" get-state 2>/dev/null || true)
    [ "$_state" = "device" ] && break
    sleep 0.3
    ((_settle_retry++))
  done
}

# ============================================================================
# Kill Maestro XCTest driver daemon so the next test starts with a clean
# connection on port 7001.  Stale daemons cause the
# "Failed to connect to /127.0.0.1:7001" error on permissions setup.
# Safe to call whether the test passed or failed.
# ============================================================================
kill_maestro_daemon() {
  # In parallel-platform mode, another test.sh / run-test-suite.sh invocation
  # is running concurrently on the other platform. The global pkill patterns
  # below would nuke the other run's processes too, so skip cleanup entirely
  # and let the parent wrapper (run-both-platforms.sh) do a single final sweep.
  if [ "${PARALLEL_MODE:-}" = "true" ]; then
    echo "🔗 PARALLEL_MODE=true — skipping Maestro cleanup (parent wrapper handles it)"
    return 0
  fi

  # Send SIGTERM to all patterns at once, wait once, then SIGKILL survivors.
  # Batch approach costs ~1s total vs. the old per-pattern sleep(1) loop
  # that cost up to 14s.
  #
  # DO NOT include broad patterns like 'xctest', 'SimulatorBridge',
  # 'SpringBoard.*accessibility', or bare 'accessibility' here — those match
  # macOS/simulator internals whose SIGKILL leaves the simulator in a
  # corrupted state (SpringBoard segfaults, XCTAutomationSession dangling
  # observer, etc). See ~/Library/Logs/DiagnosticReports/SpringBoard-*.ips
  # for the crash reports our earlier version caused before this trim.
  local _patterns=(
    'maestro-driver-ios'   # XCTest runner injected into the simulator
    'maestro.*server'      # maestro gRPC/HTTP server holding port 7001
    'maestro.*driver'      # generic maestro driver bridge
    'dadb'                 # Maestro's ADB library (Android transport)
    'XCTAutomationSupport' # Xcode accessibility bridge (Maestro-owned copy)
    'XCTestSupport'        # Xcode test-runner bridge (Maestro-owned copy)
    'idevice'              # libimobiledevice helpers Maestro spawns
  )

  for _p in "${_patterns[@]}"; do
    pkill -TERM -f "$_p" 2>/dev/null || true
  done
  sleep 0.5
  for _p in "${_patterns[@]}"; do
    pkill -9 -f "$_p" 2>/dev/null || true
  done

  # Android-side cleanup: reset device-side driver state that accumulates
  # across runs and causes the "Maestro Android driver did not start up in
  # time --- dadb.open(...)" timeout after 2-3 tests.
  cleanup_android_driver_state

  # Release port 7001 if anything else grabbed it
  local port_pids
  port_pids=$(lsof -ti tcp:7001 2>/dev/null || true)
  if [ -n "$port_pids" ]; then
    echo "$port_pids" | xargs kill -TERM 2>/dev/null || true
    sleep 0.5
    port_pids=$(lsof -ti tcp:7001 2>/dev/null || true)
    if [ -n "$port_pids" ]; then
      echo "$port_pids" | xargs kill -9 2>/dev/null || true
    fi
  fi
  # Brief wait for port release (was 2s; 0.5s is enough after SIGKILL)
  sleep 0.5
  local retry=0
  while [ $retry -lt 3 ]; do
    if ! lsof -ti tcp:7001 >/dev/null 2>&1; then
      break
    fi
    sleep 0.5
    ((retry++))
  done
}

# ============================================================================
# Cleanup handler — called on script exit or signal (SIGTERM, SIGINT)
# Ensures maestro processes are killed even if test script is interrupted
# ============================================================================
cleanup_on_exit() {
  local exit_code=$?

  echo -e "${YELLOW}Cleaning up maestro processes...${NC}"
  kill_maestro_daemon

  # In parallel mode, the sibling platform's `test.sh` is running its own
  # `maestro test ...` / `tail -F ... maestro.log` / inspector processes. All
  # of the pattern-based pkills below (`maestro test`, `android-ui-inspector`,
  # `android-network-monitor`, `tail ... maestro.log`) match by name only —
  # they can't distinguish this run's processes from the sibling's, so calling
  # them here will kill the sibling mid-flow (SIGKILL → exit 137). The parent
  # `run-both-platforms.sh` does a single final sweep once both children have
  # exited; that's the correct place for global pattern kills.
  #
  # Still safe to run in parallel mode: our own known-PID reapers (CAPTURE_PID
  # and NETWORK_PID were captured by THIS script when it spawned them).
  #
  # Even outside parallel mode, DO NOT SIGKILL "maestro test" directly. Killing
  # the maestro CLI (and by extension its embedded xctest runner) with SIGKILL
  # on iOS 26.x leaves XCTAutomationSession holding a stale accessibility
  # observer inside SpringBoard. When SpringBoard next fires that observer
  # callback the block dereferences a freed dataSource → EXC_BAD_ACCESS →
  # SpringBoard segfaults. Use SIGTERM first, give the JVM ~1s to finalize its
  # DebugLogStore + release the a11y hook, then SIGKILL only if it survives.
  if [ "${PARALLEL_MODE:-}" != "true" ]; then
    pkill -TERM -f "maestro test" 2>/dev/null || true
    sleep 1
    pkill -9   -f "maestro test" 2>/dev/null || true
  fi

  # Kill background monitoring loops AND their children (node, sleep, tail -F).
  # pkill -P first to reap children, then kill the subshell, then wait to
  # prevent zombies. Without this, orphaned grandchild processes (tail -F,
  # node) keep pipes open and the script hangs.
  if [ -n "${CAPTURE_PID:-}" ]; then
    pkill -P "$CAPTURE_PID" 2>/dev/null || true
    kill "$CAPTURE_PID" 2>/dev/null || true
  fi
  if [ -n "${NETWORK_PID:-}" ]; then
    pkill -P "$NETWORK_PID" 2>/dev/null || true
    kill "$NETWORK_PID" 2>/dev/null || true
  fi

  # Extra safety: kill any stray inspector/monitor/tail processes.
  # Skipped in parallel mode — see comment above; these would also match the
  # sibling run's helpers by name.
  if [ "${PARALLEL_MODE:-}" != "true" ]; then
    pkill -f "android-ui-inspector.js" 2>/dev/null || true
    pkill -f "android-network-monitor.js" 2>/dev/null || true
    pkill -f "tail.*-F.*maestro.log" 2>/dev/null || true
    pkill -f "performance-monitor.js" 2>/dev/null || true
  fi

  exit $exit_code
}

trap cleanup_on_exit EXIT SIGTERM SIGINT

# ============================================================================
# Grant iOS clipboard (pasteboard) permission via TCC database.
# ─── Cached simulator UDID ───────────────────────────────────────────────────
# xcrun simctl list devices is slow (~200-400ms). Call it once and cache.
_SIM_UDID_CACHE=""
get_booted_sim_udid() {
  if [ -z "$_SIM_UDID_CACHE" ]; then
    _SIM_UDID_CACHE=$(xcrun simctl list devices 2>/dev/null | grep "(Booted)" | grep -E -o '[0-9A-F-]{36}' | head -1)
  fi
  echo "$_SIM_UDID_CACHE"
}
# Call this to invalidate after a boot/shutdown event
invalidate_sim_udid_cache() { _SIM_UDID_CACHE=""; }

# xcrun simctl privacy does not cover kTCCServicePasteboard, so we inject the
# record directly. This prevents the "Allow Paste" alert from appearing during
# tests. Call this after the simulator is booted and the app is installed.
# ============================================================================
grant_ios_clipboard_permission() {
  local app_id="$1"

  # Find the booted simulator UDID
  local sim_udid
  sim_udid=$(xcrun simctl list devices 2>/dev/null | grep "(Booted)" | grep -E -o '[0-9A-F-]{36}' | head -1)

  if [ -z "$sim_udid" ]; then
    echo -e "${YELLOW}⚠️  No booted simulator found – skipping clipboard permission grant${NC}"
    return 0
  fi

  local tcc_db="$HOME/Library/Developer/CoreSimulator/Devices/$sim_udid/data/Library/TCC/TCC.db"

  if [ ! -f "$tcc_db" ]; then
    echo -e "${YELLOW}⚠️  TCC database not found at $tcc_db – skipping clipboard permission grant${NC}"
    return 0
  fi

  echo -e "${BLUE}Granting clipboard (pasteboard) permission for $app_id...${NC}"

  # auth_value 2 = allow, auth_reason 4 = system-set, client_type 0 = bundleID
  sqlite3 "$tcc_db" \
    "INSERT OR REPLACE INTO access (service, client, client_type, auth_value, auth_reason, auth_version) \
     VALUES ('kTCCServicePasteboard', '$app_id', 0, 2, 4, 1);" 2>/dev/null \
    && echo -e "${GREEN}✓ Clipboard permission granted for $app_id${NC}" \
    || echo -e "${YELLOW}⚠️  Could not write to TCC database – 'Allow Paste' alert may still appear${NC}"
}

# ============================================================================
# Clear iOS app state via simctl (no XCTest/port-7001 required).
# Terminates the app, wipes its data container, and resets permissions.
# Called before every iOS test run so flows can start with a clean slate
# without using Maestro's clearState command (which reinstalls the app and
# then requires the XCTest driver on port 7001, causing connection failures).
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

  # 3. Reset only TCC-backed permissions (NOT all) then re-grant.
  #
  # Why NOT "reset all":
  #   xcrun simctl privacy reset all also resets notification permissions, which
  #   are controlled by the UserNotifications framework (NOT TCC). simctl has no
  #   "grant notifications" command, so once reset the notification dialog appears
  #   at every run. Tapping system dialogs on iOS 26.x / Maestro 2.3.0 causes the
  #   XCTest driver (port 7001) to disconnect mid-test.
  #
  # Strategy: reset only TCC services we can re-grant. Notification/bluetooth
  # permission from previous runs is preserved (they are NOT in the TCC database
  # and survive the data-container wipe above). On first run they will prompt once;
  # after that they persist across runs just like a real user session.
  if command -v applesimutils &>/dev/null; then
    applesimutils --byId "$sim_udid" --bundle "$app_id" --setPermissions \
      "location=always,camera=YES,microphone=YES,notifications=YES,bluetooth=YES" \
      2>/dev/null && echo -e "${GREEN}  ✓ Permissions set via applesimutils${NC}" || true
  else
    # Reset individual TCC permissions (skip notifications + bluetooth — no simctl support)
    for svc in location camera microphone contacts photos reminders calendar siri; do
      xcrun simctl privacy "$sim_udid" reset "$svc" "$app_id" 2>/dev/null || true
    done

    # Re-grant location (as always), camera, microphone
    xcrun simctl privacy "$sim_udid" grant location-always "$app_id" 2>/dev/null || true
    xcrun simctl privacy "$sim_udid" grant camera "$app_id" 2>/dev/null || true
    xcrun simctl privacy "$sim_udid" grant microphone "$app_id" 2>/dev/null || true

    # Patch locationd to Authorization=3 (Always Allow).
    # xcrun simctl privacy grant location-always incorrectly sets Authorization=4
    # (When In Use) on iOS 26.x, causing the "Keep Only While Using" upgrade dialog
    # which also disconnects the XCTest driver. Direct plist patch fixes this.
    local grant_script="$SCRIPT_DIR/utils/state-management/grant-location-always.py"
    if [ -f "$grant_script" ] && command -v python3 &>/dev/null; then
      python3 "$grant_script" "$sim_udid" "$app_id" 2>/dev/null \
        && echo -e "${GREEN}  ✓ Location pre-granted as Always Allow${NC}" \
        || echo -e "${YELLOW}  ⚠️  Location always-patch failed – location dialog may appear${NC}"
    fi
    echo -e "${YELLOW}  ⚠️  applesimutils not found – notifications/bluetooth grant on first run only${NC}"
  fi

  echo -e "${GREEN}✓ App state cleared for $app_id${NC}"
}

# ============================================================================
# Check if Android app is installed and auto-install if missing
# ============================================================================
check_and_install_android_app() {
  local app_id="$1"  # Accept APP_ID as parameter
  local config_file="$PROJECT_ROOT/build_config.yaml"
  local build_variant=""
  local gradle_module="CVS"
  
  # If app_id not provided, read from build_config.yaml (fallback)
  if [ -z "$app_id" ] && [ -f "$config_file" ]; then
    app_id=$(grep -A 30 "^android:" "$config_file" | grep "app_id:" | grep -v "^[[:space:]]*#" | sed 's/.*app_id: *"\(.*\)".*/\1/')
    build_variant=$(grep -A 30 "^android:" "$config_file" | grep "build_variant:" | grep -v "^[[:space:]]*#" | sed 's/.*build_variant: *"\(.*\)".*/\1/')
    gradle_module=$(grep -A 30 "^android:" "$config_file" | grep "gradle_module:" | grep -v "^[[:space:]]*#" | sed 's/.*gradle_module: *"\(.*\)".*/\1/')
  fi
  
  [ -z "$app_id" ] && app_id="com.cvs.launchers.cvs"
  [ -z "$build_variant" ] && build_variant="shopDebug"
  [ -z "$gradle_module" ] && gradle_module="CVS"
  
  # Check if emulator is running
  local emulator_running
  emulator_running=$(adb devices 2>/dev/null | grep -c "emulator" | head -1 || echo "0")
  
  if [ "$emulator_running" -eq 0 ]; then
    echo -e "${RED}❌ No Android emulator detected${NC}"
    echo -e "${YELLOW}   Boot emulator first or run: ./scripts/setup/android-setup.sh boot${NC}"
    exit 1
  fi
  
  # Check if app is installed
  echo "Checking if app is installed..."
  
  if adb shell pm list packages 2>/dev/null | grep -q "package:$app_id"; then
    echo -e "${GREEN}✓ App already installed${NC}"
    return 0
  fi
  
  # App not installed - check if APK exists from recent build
  echo -e "${YELLOW}⚠️  App not installed${NC}"
  echo ""
  
  # Look for APK in build output directory
  local apk_path=""
  local build_dir="$HOME/.maestro-builds/android/digital-flagship-android"
  
  if [ -d "$build_dir/$gradle_module/build/outputs/apk" ]; then
    echo "Searching for APK in build output..."
    
    # Try to find APK matching the build variant first
    apk_path=$(find "$build_dir/$gradle_module/build/outputs/apk" -name "*.apk" -type f 2>/dev/null | grep -i "$build_variant" | head -n 1)
    
    # If not found, try to find any APK (may be from different variant)
    if [ -z "$apk_path" ]; then
      echo -e "${YELLOW}  No APK found for variant '$build_variant'${NC}"
      echo "  Searching for any available APK..."
      apk_path=$(find "$build_dir/$gradle_module/build/outputs/apk" -name "*.apk" -type f 2>/dev/null | head -n 1)
      
      if [ -n "$apk_path" ]; then
        local apk_name=$(basename "$apk_path")
        echo -e "${YELLOW}  Found different variant: $apk_name${NC}"
        echo -e "${YELLOW}  ⚠️  This may not match your build_config.yaml settings!${NC}"
        echo -e "${YELLOW}  To build the correct variant ($build_variant), run:${NC}"
        echo -e "${YELLOW}    bash scripts/build.sh android repo${NC}"
      fi
    fi
  fi
  
  if [ -n "$apk_path" ] && [ -f "$apk_path" ]; then
    echo -e "${GREEN}Found APK: $apk_path${NC}"
    echo -e "${BLUE}Installing APK on emulator...${NC}"

    if adb install -r "$apk_path" 2>&1 | tee /dev/tty | grep -q "Success"; then
      echo -e "${GREEN}✓ App installed successfully${NC}"
      echo -e "${GREEN}  Package: $app_id${NC}"
      return 0
    else
      echo -e "${RED}❌ APK installation failed${NC}"
    fi
  else
    echo -e "${YELLOW}⚠️  No APK found in build output${NC}"
  fi

  # No APK found or install failed — build from source automatically
  echo ""
  echo -e "${BLUE}Building Android app automatically...${NC}"
  echo ""

  local build_script="$PROJECT_ROOT/scripts/build/build.sh"
  if [ -f "$build_script" ]; then
    # Pass device parameter to build script if specified
    if [ -n "$DEVICE" ]; then
      bash "$build_script" android repo main "$DEVICE" || {
        echo -e "${RED}❌ Android build failed${NC}"
        echo ""
        echo "You can also install a pre-built APK manually:"
        echo "  adb install path/to/app.apk"
        exit 1
      }
    else
      bash "$build_script" android repo || {
        echo -e "${RED}❌ Android build failed${NC}"
        echo ""
        echo "You can also install a pre-built APK manually:"
        echo "  adb install path/to/app.apk"
        exit 1
      }
    fi

    # After build, look for the APK again and install it
    if [ -d "$build_dir/$gradle_module/build/outputs/apk" ]; then
      apk_path=$(find "$build_dir/$gradle_module/build/outputs/apk" -name "*.apk" -type f 2>/dev/null | head -n 1)
    fi

    if [ -n "$apk_path" ] && [ -f "$apk_path" ]; then
      echo -e "${BLUE}Installing freshly built APK...${NC}"
      if adb install -r "$apk_path" 2>&1 | tee /dev/tty | grep -q "Success"; then
        echo -e "${GREEN}✓ App built and installed successfully${NC}"
        return 0
      fi
    fi

    # Verify the build script installed the app itself (some build scripts do adb install)
    if adb shell pm list packages 2>/dev/null | grep -q "package:$app_id"; then
      echo -e "${GREEN}✓ App installed by build script${NC}"
      return 0
    fi

    echo -e "${RED}❌ App still not installed after build${NC}"
    echo "  Try manually: adb install path/to/app.apk"
    exit 1
  else
    echo -e "${RED}❌ Build script not found: $build_script${NC}"
    echo ""
    echo "Install a pre-built APK manually:"
    echo "  adb install path/to/app.apk"
    exit 1
  fi
}

# ============================================================================
# Check if app is installed on simulator and auto-install if missing
# Reads app configuration from build_config.yaml
# ============================================================================
check_and_install_app() {
  local platform="$1"
  local app_id="$2"  # Accept APP_ID as parameter
  
  if [ "$platform" = "android" ]; then
    check_and_install_android_app "$app_id"
    return $?
  fi
  
  # Use provided APP_ID (bundle_id for iOS), or read from build_config.yaml as fallback
  local bundle_id="$app_id"
  
  if [ -z "$bundle_id" ]; then
    local config_file="$PROJECT_ROOT/build_config.yaml"
    if [ -f "$config_file" ]; then
      local _cfg_key
      _cfg_key=$(grep -E "^configuration:" "$config_file" | grep -v "^[[:space:]]*#" | sed 's/.*configuration: *"\(.*\)".*/\1/' | tr '[:upper:]' '[:lower:]')
      bundle_id=$(grep -A 30 "^ios:" "$config_file" | grep -A 10 "bundle_ids:" | grep "^[[:space:]]*${_cfg_key}:" | grep -v "^[[:space:]]*#" | sed 's/.*: *"\(.*\)".*/\1/' | head -1)
      [ -z "$bundle_id" ] && bundle_id=$(grep -A 15 "^ios:" "$config_file" | grep "bundle_id:" | grep -v "bundle_ids\|^[[:space:]]*#" | sed 's/.*bundle_id: *"\(.*\)".*/\1/' | head -1)
    fi
  fi
  
  if [ -z "$bundle_id" ]; then
    echo -e "${YELLOW}⚠️  Could not determine bundle_id${NC}"
    echo -e "${YELLOW}   Skipping app installation check${NC}"
    return 0
  fi
  
  # Check if simulator is booted
  local sim_udid
  sim_udid=$(xcrun simctl list devices 2>/dev/null | grep "(Booted)" | grep -E -o '[0-9A-F-]{36}' | head -1)
  
  if [ -z "$sim_udid" ]; then
    echo -e "${RED}❌ No booted simulator found${NC}"
    echo -e "${YELLOW}   Boot simulator first: ./scripts/setup/ios-setup.sh boot${NC}"
    exit 1
  fi
  
  # Check if app is installed
  echo -e "${BLUE}Checking if app is installed: $bundle_id${NC}"

  if xcrun simctl listapps "$sim_udid" 2>/dev/null | grep -q "$bundle_id"; then
    echo -e "${GREEN}✓ App is already installed${NC}"
    # Clear app state since app is installed
    # echo -e "${BLUE}Clearing app state for existing installation...${NC}"
    clear_ios_app_state "$bundle_id"
    return 0
  fi
  
  # App not installed - build and install it
  echo -e "${YELLOW}⚠️  App not found on simulator${NC}"
  echo -e "${BLUE}Building and installing app automatically...${NC}"
  echo ""
  
  # Get the booted simulator UUID to pass to build.sh (more reliable than name)
  BOOTED_SIM_UUID=$(xcrun simctl list devices 2>/dev/null | grep "(Booted)" | grep "iPhone" | head -1 | grep -E -o '[0-9A-F-]{36}' | head -1)
  
  # Check if iOS source code is available locally
  if [ -f "$PROJECT_ROOT/IOS/CVSOnlineiPhone/Podfile" ]; then
    # Build from local workspace
    echo -e "${BLUE}Building from local workspace...${NC}"
    BUNDLE_ID_OVERRIDE="$bundle_id" DEVICE_UUID="$BOOTED_SIM_UUID" "$PROJECT_ROOT/scripts/build/build.sh" ios local || {
      echo -e "${RED}❌ Build failed${NC}"
      exit 1
    }
  else
    # Build from GitHub repository
    echo -e "${BLUE}Building from GitHub repository...${NC}"
    BUNDLE_ID_OVERRIDE="$bundle_id" DEVICE_UUID="$BOOTED_SIM_UUID" "$PROJECT_ROOT/scripts/build/build.sh" ios repo main || {
      echo -e "${RED}❌ Build failed${NC}"
      exit 1
    }
  fi
  
  # Give the simulator a moment to register the newly installed app before querying listapps
  sleep 3

  # Verify app is now installed (re-detect sim_udid since it's local to this function)
  local verify_udid
  verify_udid=$(xcrun simctl list devices 2>/dev/null | grep "(Booted)" | grep -E -o '[0-9A-F-]{36}' | head -1)
  
  if [ -z "$verify_udid" ]; then
    echo -e "${RED}❌ Simulator shut down after build${NC}"
    exit 1
  fi
  
  echo -e "${BLUE}Verifying app installation on simulator: $verify_udid${NC}"
  echo -e "${BLUE}Looking for bundle ID: $bundle_id${NC}"
  
  # Debug: List all installed apps to see what's there
  echo -e "${BLUE}Installed apps (first 10):${NC}"
  xcrun simctl listapps "$verify_udid" 2>/dev/null | head -10
  
  if xcrun simctl listapps "$verify_udid" 2>/dev/null | grep -q "$bundle_id"; then
    echo -e "${GREEN}✓ App installed successfully${NC}"
    echo ""
  else
    echo -e "${RED}❌ App installation failed${NC}"
    echo -e "${YELLOW}Debugging info:${NC}"
    echo -e "${YELLOW}  Simulator UDID: $verify_udid${NC}"
    echo -e "${YELLOW}  Bundle ID: $bundle_id${NC}"
    echo -e "${YELLOW}  Try running: xcrun simctl listapps '$verify_udid' | grep '$bundle_id'${NC}"
    exit 1
  fi
}

# Pick the REAL Maestro binary — never the project wrapper (bin/maestro),
# which would recurse back into this script.
#
# Preference order:
#   1. $MAESTRO_BIN_OVERRIDE (explicit escape hatch for one-off testing)
#   2. Homebrew's /opt/homebrew/bin/maestro (Apple Silicon, version-managed)
#   3. Homebrew's /usr/local/bin/maestro (Intel Mac fallback)
#   4. ~/.maestro/bin/maestro (installer-managed, often stale on 2.0.3
#      which has XCTest teardown races that segfault SpringBoard)
if [ -n "${MAESTRO_BIN_OVERRIDE:-}" ] && [ -x "$MAESTRO_BIN_OVERRIDE" ]; then
  MAESTRO_BIN="$MAESTRO_BIN_OVERRIDE"
elif [ -x /opt/homebrew/bin/maestro ]; then
  MAESTRO_BIN=/opt/homebrew/bin/maestro
elif [ -x /usr/local/bin/maestro ]; then
  MAESTRO_BIN=/usr/local/bin/maestro
elif [ -x "${HOME}/.maestro/bin/maestro" ]; then
  MAESTRO_BIN="${HOME}/.maestro/bin/maestro"
else
  MAESTRO_BIN="maestro"  # last resort — PATH resolution
fi
# echo -e "Using MAESTRO_BIN: $MAESTRO_BIN"

# Ensure Maestro default log root exists.
# Some Maestro builds throw NoSuchFileException if ~/Library/Logs/maestro is missing.
MAESTRO_LOG_ROOT="$HOME/Library/Logs/maestro"
mkdir -p "$MAESTRO_LOG_ROOT" 2>/dev/null || true

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

# ── Load .env from project root ───────────────────────────────────────────────
# Populates environment from a gitignored `.env` file at the repo root.
# Shell exports win — only sets vars not already defined in the environment.
# Silently skipped if .env doesn't exist (CI sets vars directly).
if [ -f "$PROJECT_ROOT/.env" ]; then
  while IFS= read -r _env_line || [ -n "$_env_line" ]; do
    [[ "$_env_line" =~ ^[[:space:]]*# ]] && continue          # skip comments
    [[ -z "${_env_line//[[:space:]]/}" ]] && continue          # skip blank lines
    if [[ "$_env_line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
      _env_key="${BASH_REMATCH[1]}"
      _env_val="${BASH_REMATCH[2]}"
      # Strip surrounding single or double quotes
      _env_val="${_env_val%\"}" ; _env_val="${_env_val#\"}"
      _env_val="${_env_val%\'}" ; _env_val="${_env_val#\'}"
      # Only export if not already set (shell export wins)
      [ -z "${!_env_key+x}" ] && export "$_env_key"="$_env_val"
    fi
  done < "$PROJECT_ROOT/.env"
  echo -e "${BLUE}[env] Loaded .env${NC}"
fi

# Load configuration from config.yaml
load_config() {
  local config_file="$PROJECT_ROOT/.maestro/config/config.yaml"
  
  if [ ! -f "$config_file" ]; then
    echo -e "${YELLOW}⚠️  Config file not found: $config_file${NC}"
    return 1
  fi
  
  # Parse YAML and extract env variables
  # Using grep to extract values from config.yaml
  RECORD_VIDEO=$(grep -A 10 "# RECORDING CONFIGURATION" "$config_file" | grep "RECORD_VIDEO:" | awk '{print $2}' | tr -d '"')
  RECORDING_OUTPUT_DIR=$(grep "RECORDING_OUTPUT_DIR:" "$config_file" | awk '{print $2}' | tr -d '"')
  
  ENABLE_LOGGING=$(grep "ENABLE_LOGGING:" "$config_file" | awk '{print $2}' | tr -d '"')
  LOG_OUTPUT_DIR=$(grep "LOG_OUTPUT_DIR:" "$config_file" | awk '{print $2}' | tr -d '"')
  
  EXECUTION_TIMEOUT=$(grep "EXECUTION_TIMEOUT:" "$config_file" | awk '{print $2}' | tr -d '"')
  CONTINUE_ON_FAILURE=$(grep "CONTINUE_ON_FAILURE:" "$config_file" | awk '{print $2}' | tr -d '"')
  
  REPORTS_ENABLED=$(grep "REPORTS_ENABLED:" "$config_file" | awk '{print $2}' | tr -d '"')
  REPORTS_OUTPUT_DIR=$(grep "REPORTS_OUTPUT_DIR:" "$config_file" | awk '{print $2}' | tr -d '"')
  REPORTS_SCREENSHOT_ON_SUCCESS=$(grep "REPORTS_SCREENSHOT_ON_SUCCESS:" "$config_file" | awk '{print $2}' | tr -d '"')
  REPORTS_SCREENSHOT_ON_FAILURE=$(grep "REPORTS_SCREENSHOT_ON_FAILURE:" "$config_file" | awk '{print $2}' | tr -d '"')

  # Set defaults if not found in config
  RECORD_VIDEO="${RECORD_VIDEO:-true}"
  RECORDING_OUTPUT_DIR="${RECORDING_OUTPUT_DIR:-../../test-reports/videos}"
  ENABLE_LOGGING="${ENABLE_LOGGING:-true}"
  LOG_OUTPUT_DIR="${LOG_OUTPUT_DIR:-../../test-reports/logs}"
  EXECUTION_TIMEOUT="${EXECUTION_TIMEOUT:-300000}"
  CONTINUE_ON_FAILURE="${CONTINUE_ON_FAILURE:-true}"
  REPORTS_ENABLED="${REPORTS_ENABLED:-true}"
  REPORTS_OUTPUT_DIR="${REPORTS_OUTPUT_DIR:-../../test-reports}"
  REPORTS_SCREENSHOT_ON_SUCCESS="${REPORTS_SCREENSHOT_ON_SUCCESS:-false}"
  REPORTS_SCREENSHOT_ON_FAILURE="${REPORTS_SCREENSHOT_ON_FAILURE:-true}"
}

# Parse arguments
PLATFORM="ios"
SKIP_SETUP="false"
NO_BROWSER="false"
TEST_PATH=""
RUN_A11Y="false"
RUN_PULSE="false"
RUN_PERF="false"
RUN_SLACK="false"
ADD_ZEPHYR_EXECUTION="false"
NETWORK_CAPTURE="false"
NETWORK_DEBUGGER="false"
DISABLE_UI_INSPECTOR="false"
DISABLE_NETWORK_MONITOR="false"
RECORD_VIDEO_FILE=""
VIDEO_ENABLED="false"
VIDEO_RECORD_PID=""
VIDEO_FILE=""
DEVICE=""
SKIP_VALIDATION="false"
SKIP_PRELAUNCH="true"
SKIP_PRELOAD="false"
NUM_OF_ADHOC_ACTIONS=""
RETRY_COUNT=0
FAIL_FAST="false"
DOWNLOAD_INSTALL_FIREBASE="false"

# Load config first
load_config

# Set report generation based on config
GENERATE_REPORT="$REPORTS_ENABLED"

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
    --no-report)
      GENERATE_REPORT="false"
      shift
      ;;
    --a11y)
      RUN_A11Y="true"
      shift
      ;;
    --heal)
      RUN_HEAL="true"
      shift
      ;;
    --heal-dry-run)
      RUN_HEAL="true"
      HEAL_DRY_RUN="true"
      shift
      ;;
    --pulse)
      RUN_PULSE="true"
      shift
      ;;
    --perf)
      RUN_PERF="true"
      shift
      ;;
    --network-capture)
      NETWORK_CAPTURE="true"
      shift
      ;;
    --network-debugger)
      NETWORK_DEBUGGER="true"
      shift
      ;;
    --no-ui-inspector)
      DISABLE_UI_INSPECTOR="true"
      shift
      ;;
    --no-network-monitor)
      DISABLE_NETWORK_MONITOR="true"
      shift
      ;;
    --minimal-monitoring)
      DISABLE_UI_INSPECTOR="true"
      DISABLE_NETWORK_MONITOR="true"
      shift
      ;;
    --record-output)
      RECORD_VIDEO_FILE="$2"
      shift 2
      ;;
    --video|--record)
      VIDEO_ENABLED="true"
      shift
      ;;
    --slack)
      RUN_SLACK="true"
      shift
      ;;
    --slack-webhook)
      SLACK_WEBHOOK_URL="$2"
      export SLACK_WEBHOOK_URL
      shift 2
      ;;
    --add-zephyr-execution)
      ADD_ZEPHYR_EXECUTION="true"
      shift
      ;;
    --device)
      DEVICE="$2"
      shift 2
      ;;
    --skip-validation)
      SKIP_VALIDATION="true"
      shift
      ;;
    --skip-prelaunch)
      SKIP_PRELAUNCH="true"
      shift
      ;;
    --skip-preload)
      SKIP_PRELOAD="true"
      shift
      ;;
    --enable-prelaunch)
      SKIP_PRELAUNCH="false"
      shift
      ;;
    --num-of-adhoc-actions)
      NUM_OF_ADHOC_ACTIONS="$2"
      shift 2
      ;;
    --retry)
      RETRY_COUNT="$2"
      shift 2
      ;;
    --fail-fast)
      FAIL_FAST="true"
      shift
      ;;
    --download-and-install-latest-firebase)
      DOWNLOAD_INSTALL_FIREBASE="true"
      shift
      ;;
    *)
      TEST_PATH="$1"
      shift
      ;;
  esac
done

# Number of random actions for adhoc monkey test (default: 10)
NUMBER_OF_ACTIONS="${NUM_OF_ADHOC_ACTIONS:-10}"

# Check for device UDID from environment variable
if [ -z "$DEVICE" ] && [ -n "$MAESTRO_DEVICE_UDID" ]; then
  DEVICE="$MAESTRO_DEVICE_UDID"
  echo -e "${BLUE}Using device from environment variable: $DEVICE${NC}"
fi

# Validate platform
if [ "$PLATFORM" != "ios" ] && [ "$PLATFORM" != "android" ]; then
  echo -e "${RED}❌ Invalid platform: $PLATFORM${NC}"
  echo "Valid platforms: ios, android"
  exit 1
fi

# --download-and-install-latest-firebase is Android-only (Firebase App
# Distribution is only wired up for Android APKs — see scripts/build/firebase-setup.sh)
if [ "$DOWNLOAD_INSTALL_FIREBASE" = "true" ] && [ "$PLATFORM" != "android" ]; then
  echo -e "${RED}❌ --download-and-install-latest-firebase is Android-only${NC}"
  echo "Pass --platform android, or omit the flag for iOS runs."
  exit 1
fi

# Validate test path
if [ -z "$TEST_PATH" ]; then
  echo -e "${RED}❌ Test path required${NC}"
  echo ""
  echo "Usage: $0 <test_path> [options]"
  echo ""
  echo "Options:"
  echo "  --platform <ios|android>  - Target platform (default: ios)"
  echo "  --skip-setup              - Skip device setup"
  echo "  --no-browser              - Don't open report in browser"
  echo "  --no-report               - Don't generate HTML report"
  echo "  --a11y                    - Run WCAG 2.1 / 2.2 accessibility validation and include results in the HTML report"
  echo "  --pulse                   - Run Pulse design system component validation and include results in the HTML report"
  echo "  --perf                    - Run performance tests and generate performance report"
  echo "  --network-capture         - Capture network API calls during test execution (iOS logs)"
  echo "  --network-debugger        - Extract network calls from app's built-in debugger (full URLs)"
  echo "  --no-ui-inspector         - Disable background Android UI hierarchy capture (reduces CPU/adb load)"
  echo "  --no-network-monitor      - Disable background Android network/logcat capture (reduces CPU/adb load)"
  echo "  --minimal-monitoring      - Shorthand for --no-ui-inspector --no-network-monitor (use on resource-constrained hosts)"
  echo "  --video                   - Record video of the test execution (single test only, not suites)"
  echo "  --slack                   - Send Slack notification on completion (requires SLACK_WEBHOOK_URL env var)"
  echo "  --slack-webhook <url>     - Slack webhook URL (overrides SLACK_WEBHOOK_URL env var)"
  echo "  --add-zephyr-execution    - After a suite run, create a Zephyr Scale test cycle and record"
  echo "                              Pass/Fail executions for tests tagged with a Zephyr key (suites only)"
  echo "  --retry <N>               - Retry failed test up to N times (default: 0)"
  echo "  --fail-fast               - Stop suite on first failure"
  echo "  --download-and-install-latest-firebase"
  echo "                            - Android only. Skip the local Gradle build entirely and"
  echo "                              instead download + install the latest 'main'-branch APK"
  echo "                              from Firebase App Distribution (see scripts/build/firebase-setup.sh)"
  echo ""
  echo "Examples:"
  echo "  $0 .maestro/flows/Account/ --platform android"
  echo "  $0 .maestro/flows/Account/test_login.yaml --a11y"
  echo "  $0 .maestro/flows/Account/test_login.yaml --network-capture"
  echo "  $0 .maestro/flows/suites/test_suite_account.yaml"
  echo "  $0 .maestro/apps/health100/suites/smoke.yaml --platform android --download-and-install-latest-firebase"
  exit 1
fi

# ============================================================================
# SET APP_ID EARLY (before suite detection)
# ============================================================================
# Read from build_config.yaml for both iOS and Android
CONFIG_FILE="$SCRIPT_DIR/../build_config.yaml"

if [ "$PLATFORM" = "android" ]; then
  # Check if APP_ID is already set via environment variable
  if [ -n "$APP_ID" ]; then
    echo -e "${GREEN}✓ Using APP_ID from environment variable: $APP_ID${NC}"
  # Check for ANDROID_APP_ID_OVERRIDE (same as build.sh uses)
  elif [ -n "$ANDROID_APP_ID_OVERRIDE" ]; then
    export APP_ID="$ANDROID_APP_ID_OVERRIDE"
    echo -e "${GREEN}✓ Using APP_ID from ANDROID_APP_ID_OVERRIDE: $APP_ID${NC}"
  elif [ -f "$CONFIG_FILE" ]; then
    # Read app_id from build_config.yaml for Android
    ANDROID_APP_ID=$(grep -A 30 "^android:" "$CONFIG_FILE" | grep "app_id:" | grep -v "^[[:space:]]*#" | sed 's/.*app_id: *"\(.*\)".*/\1/')
    if [ -n "$ANDROID_APP_ID" ]; then
      export APP_ID="$ANDROID_APP_ID"
      echo -e "${GREEN}✓ Using APP_ID from build_config.yaml: $APP_ID${NC}"
    else
      export APP_ID="com.cvs.launchers.cvs"
      echo -e "${YELLOW}⚠️  No app_id found in build_config.yaml, using default: $APP_ID${NC}"
    fi
  else
    export APP_ID="${APP_ID:-com.cvs.launchers.cvs}"
    echo -e "${YELLOW}⚠️  build_config.yaml not found, using default: $APP_ID${NC}"
  fi
else
  # Check if APP_ID is already set via environment variable
  if [ -n "$APP_ID" ]; then
    echo -e "${GREEN}✓ Using APP_ID from environment variable: $APP_ID${NC}"
  # Check for BUNDLE_ID_OVERRIDE (same as build.sh uses)
  elif [ -n "$BUNDLE_ID_OVERRIDE" ]; then
    export APP_ID="$BUNDLE_ID_OVERRIDE"
    echo -e "${GREEN}✓ Using APP_ID from BUNDLE_ID_OVERRIDE: $APP_ID${NC}"
  elif [ -f "$CONFIG_FILE" ]; then
    # Read per-config bundle_id from build_config.yaml for iOS
    _cfg_key=$(grep -E "^configuration:" "$CONFIG_FILE" | grep -v "^[[:space:]]*#" | sed 's/.*configuration: *"\(.*\)".*/\1/' | tr '[:upper:]' '[:lower:]' | head -1)
    BUNDLE_ID=$(grep -A 30 "^ios:" "$CONFIG_FILE" | grep -A 10 "bundle_ids:" | grep "^[[:space:]]*${_cfg_key}:" | grep -v "^[[:space:]]*#" | sed 's/.*: *"\(.*\)".*/\1/' | head -1)
    # Fall back to single bundle_id field if bundle_ids map not present
    [ -z "$BUNDLE_ID" ] && BUNDLE_ID=$(grep -A 15 "^ios:" "$CONFIG_FILE" | grep "bundle_id:" | grep -v "bundle_ids\|^[[:space:]]*#" | sed 's/.*bundle_id: *"\(.*\)".*/\1/' | head -1)
    if [ -n "$BUNDLE_ID" ]; then
      export APP_ID="$BUNDLE_ID"
      echo -e "${GREEN}✓ Using APP_ID from build_config.yaml (config: ${_cfg_key:-unknown}): $APP_ID${NC}"
    else
      export APP_ID="com.cvsenterpriseiphone.cvspharmacy"
      echo -e "${YELLOW}⚠️  No bundle_id found in build_config.yaml, using default: $APP_ID${NC}"
    fi
  else
    export APP_ID="${APP_ID:-com.cvsenterpriseiphone.cvspharmacy}"
    echo -e "${YELLOW}⚠️  build_config.yaml not found, using default: $APP_ID${NC}"
  fi
fi

# ============================================================================
# DETECT SUITE FILES AND ROUTE TO SUITE RUNNER
# ============================================================================
# Check if TEST_PATH is a suite file (contains "suites" in path and has runFlow commands)
is_suite_file() {
  local file="$1"
  if [[ "$file" == *"/suites/"* ]] && [[ "$file" == *.yaml ]]; then
    # Additional check: verify it contains runFlow commands
    if grep -q "runFlow:" "$file" 2>/dev/null; then
      return 0
    fi
  fi
  return 1
}

if is_suite_file "$TEST_PATH"; then
  echo -e "${BLUE}Detected suite file - using suite runner${NC}"
  echo ""
  
  # Build suite runner arguments
  SUITE_ARGS="$TEST_PATH"
  [ "$SKIP_SETUP" = "true" ] && SUITE_ARGS="$SUITE_ARGS --skip-setup"
  [ "$NO_BROWSER" = "true" ] && SUITE_ARGS="$SUITE_ARGS --no-browser"
  [ "$PLATFORM" != "ios" ] && SUITE_ARGS="$SUITE_ARGS --platform $PLATFORM"
  [ -n "$DEVICE" ] && SUITE_ARGS="$SUITE_ARGS --device $DEVICE"
  [ "$RUN_SLACK" = "true" ] && SUITE_ARGS="$SUITE_ARGS --slack"
  [ -n "${SLACK_WEBHOOK_URL:-}" ] && SUITE_ARGS="$SUITE_ARGS --slack-webhook $SLACK_WEBHOOK_URL"
  [ "$ADD_ZEPHYR_EXECUTION" = "true" ] && SUITE_ARGS="$SUITE_ARGS --add-zephyr-execution"

  # Run suite runner and exit
  bash "$SCRIPT_DIR/testing/run-test-suite.sh" $SUITE_ARGS
  exit $?
fi

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║           Maestro Test Runner                              ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Setup environment
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$ANDROID_HOME/tools/bin:$PATH"

# ============================================================================
# Platform Device Validation
# When both iOS simulator and Android emulator are running, ensure Maestro
# connects to the correct device based on --platform flag.
#
# SKIPPED in parallel mode: run-both-platforms.sh intentionally has BOTH
# a booted iOS simulator and a booted Android emulator at the same time.
# Shutting down "the other" platform here would kill the sibling run's device
# (that's exactly what caused the "Device … was requested, but it is not
# connected" failures). Maestro is pinned to the correct device via --device
# in parallel mode, so this auto-shutdown safety net is unnecessary anyway.
# ============================================================================
if [ "${PARALLEL_MODE:-false}" = "true" ]; then
  echo -e "${BLUE}🔗 PARALLEL_MODE=true — skipping cross-platform device shutdown (sibling run in progress)${NC}"
elif [ "$PLATFORM" = "android" ]; then
  # Check if Android emulator is running
  ANDROID_RUNNING=$(adb devices 2>/dev/null | grep -c "emulator" | head -1 || echo "0")
  if [ "$ANDROID_RUNNING" -eq 0 ]; then
    echo -e "${YELLOW}⚠️  Warning: --platform android specified but no Android emulator detected${NC}"
    echo -e "${YELLOW}   Maestro may connect to iOS simulator if it's running${NC}"
  fi
  
  # Check if iOS simulator is also running (potential conflict)
  IOS_RUNNING=$(xcrun simctl list devices 2>/dev/null | grep -c "(Booted)" | head -1 || echo "0")
  if [ "$IOS_RUNNING" -gt 0 ] && [ "$ANDROID_RUNNING" -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Warning: Both iOS simulator and Android emulator are running${NC}"
    echo -e "${YELLOW}   Shutting down iOS simulator to ensure Maestro connects to Android...${NC}"
    xcrun simctl shutdown all 2>/dev/null || true
    sleep 2
  fi
elif [ "$PLATFORM" = "ios" ]; then
  # Check if iOS simulator is running
  IOS_RUNNING=$(xcrun simctl list devices 2>/dev/null | grep -c "(Booted)" | head -1 || echo "0")
  if [ "$IOS_RUNNING" -eq 0 ]; then
    echo -e "${YELLOW}⚠️  Warning: --platform ios specified but no iOS simulator detected${NC}"
    echo -e "${YELLOW}   Maestro may connect to Android emulator if it's running${NC}"
  fi
  
  # Check if Android emulator is also running (potential conflict)
  ANDROID_RUNNING=$(adb devices 2>/dev/null | grep -c "emulator" | head -1 || echo "0")
  if [ "$ANDROID_RUNNING" -gt 0 ] && [ "$IOS_RUNNING" -gt 0 ]; then
    echo -e "${YELLOW}⚠️  Warning: Both iOS simulator and Android emulator are running${NC}"
    echo -e "${YELLOW}   Shutting down Android emulator to ensure Maestro connects to iOS...${NC}"
    adb emu kill 2>/dev/null || true
    sleep 2
  fi
fi

# Derive app-specific output paths from APP_ID
# This enables the unified config.yaml to resolve per-app settings
case "$APP_ID" in
  *health100*)
    export RECORDING_OUTPUT_DIR="${RECORDING_OUTPUT_DIR:-../../test-reports/videos/health100}"
    export LOG_OUTPUT_DIR="${LOG_OUTPUT_DIR:-../../test-reports/logs/health100}"
    export REPORTS_OUTPUT_DIR="${REPORTS_OUTPUT_DIR:-../../test-reports/health100}"
    ;;
  *)
    export RECORDING_OUTPUT_DIR="${RECORDING_OUTPUT_DIR:-../../test-reports/videos}"
    export LOG_OUTPUT_DIR="${LOG_OUTPUT_DIR:-../../test-reports/logs}"
    export REPORTS_OUTPUT_DIR="${REPORTS_OUTPUT_DIR:-../../test-reports}"
    ;;
esac

echo -e "${BLUE}Configuration:${NC}"
echo "  Platform: $PLATFORM"
echo "  APP_ID: $APP_ID"
echo "  Test Path: $TEST_PATH"
echo "  Skip Setup: $SKIP_SETUP"
echo "  Generate Report: $GENERATE_REPORT"
echo ""

# ============================================================================
# SETUP DEVICES
# ============================================================================
if [ "$SKIP_SETUP" = "false" ]; then
  echo -e "${BLUE}Setting up $PLATFORM device...${NC}"
  
  if [ "$PLATFORM" = "android" ]; then
    bash "$SCRIPT_DIR/setup/android-setup.sh" boot || {
      echo -e "${RED}❌ Failed to setup Android emulator${NC}"
      exit 1
    }
  else
    # Check if a specific device was requested via --device flag
    if [ -n "$DEVICE" ]; then
      # User specified a device - boot that one
      echo -e "${BLUE}Booting specified iOS simulator: $DEVICE${NC}"
      bash "$SCRIPT_DIR/setup/ios-setup.sh" boot "$DEVICE" || {
        echo -e "${RED}❌ Failed to setup iOS simulator: $DEVICE${NC}"
        exit 1
      }
    else
      # No specific device requested - get booted simulator name (iPhone ONLY - exclude iPad, Apple Watch, Apple TV)
      IOS_BOOTED_SIMULATOR_NAME=$(xcrun simctl list devices 2>/dev/null | \
        grep "(Booted)" | grep "iPhone" | head -1 | \
        sed 's/(.*//' | sed 's/^[[:space:]]*//' | sed 's/[[:space:]]*$//')

      if [ -n "$IOS_BOOTED_SIMULATOR_NAME" ]; then
        echo -e "${BLUE}Using booted iOS simulator from simctl: $IOS_BOOTED_SIMULATOR_NAME${NC}"
        bash "$SCRIPT_DIR/setup/ios-setup.sh" boot "$IOS_BOOTED_SIMULATOR_NAME" || {
          echo -e "${RED}❌ Failed to setup iOS simulator${NC}"
          exit 1
        }
      else
        bash "$SCRIPT_DIR/setup/ios-setup.sh" boot || {
          echo -e "${RED}❌ Failed to setup iOS simulator${NC}"
          exit 1
        }
      fi
    fi
  fi
  
  echo ""
fi

# ============================================================================
# ALWAYS CLEAR iOS APP STATE BEFORE TESTS
# ============================================================================
# Clear app state regardless of --skip-setup flag to ensure test reproducibility.
# This terminates the app, wipes data container, and resets permissions.
if [ "$PLATFORM" = "ios" ]; then
  echo -e "${BLUE}Clearing iOS app state for fresh test run...${NC}"
  clear_ios_app_state "$APP_ID"
  echo ""
fi

# Grant clipboard (pasteboard) permission for iOS to prevent "Allow Paste" alerts.
# kTCCServicePasteboard is not covered by xcrun simctl privacy, so we write to
# the TCC database directly. Must run AFTER clear_ios_app_state (which resets
# permissions) so the grant is not wiped out before the test starts.
if [ "$PLATFORM" = "ios" ]; then
  grant_ios_clipboard_permission "$APP_ID"
  echo ""
fi

# Clear Android app state before every test run.
# Uses run-as to wipe data directories (not pm clear, which causes blank white
# screens on Compose/WebView apps). Permissions are re-granted after the wipe.
if [ "$PLATFORM" = "android" ]; then
  RESET_SCRIPT="$SCRIPT_DIR/utils/state-management/reset-app-state.sh"
  if [ -f "$RESET_SCRIPT" ]; then
    # Get the Android device ID to pass to reset script
    android_device_id="$DEVICE"
    if [ -z "$android_device_id" ]; then
      android_device_id=$(adb devices 2>/dev/null | grep -v "List of devices" | grep "device$" | awk '{print $1}' | head -1)
    fi
    bash "$RESET_SCRIPT" android "$APP_ID" "$android_device_id"
  else
    echo -e "${BLUE}Clearing Android app state for ${APP_ID}...${NC}"
    adb shell am force-stop "$APP_ID" 2>/dev/null || true
    adb shell run-as "$APP_ID" sh -c 'rm -rf shared_prefs databases cache files app_webview no_backup' 2>/dev/null || true
  fi
  echo ""
  # NOTE: Android pre-launch is now handled by reset-app-state.sh (step 4).
  # This ensures the app starts with a clean state after data wipe, matching
  # the iOS behavior where simctl launch happens in the reset script.

  # Disable mobile data for offline testing scenarios
  echo -e "${BLUE}Disabling mobile data on emulator...${NC}"

  # Get list of connected emulators
  EMULATOR_LIST=$(adb devices 2>/dev/null | grep "emulator" | awk '{print $1}')
  EMULATOR_COUNT=$(echo "$EMULATOR_LIST" | grep -c "emulator" || echo "0")

  if [ "$EMULATOR_COUNT" -gt 1 ]; then
    # Multiple emulators active - target the first one
    TARGET_DEVICE=$(echo "$EMULATOR_LIST" | head -1)
    echo -e "${YELLOW}  Multiple emulators detected, targeting: $TARGET_DEVICE${NC}"
    if adb -s "$TARGET_DEVICE" shell svc data disable > /dev/null 2>&1; then
      echo -e "${GREEN}  ✓ Mobile data disabled on $TARGET_DEVICE${NC}"
    else
      echo -e "${YELLOW}  ⚠️  Could not disable mobile data on $TARGET_DEVICE${NC}"
    fi
  else
    # Single emulator - use default device
    if adb shell svc data disable > /dev/null 2>&1; then
      echo -e "${GREEN}  ✓ Mobile data disabled${NC}"
    else
      echo -e "${YELLOW}  ⚠️  Could not disable mobile data${NC}"
    fi
  fi
  echo ""
fi

# Pre-launch the app via simctl BEFORE starting Maestro.
# DISABLED BY DEFAULT: This workaround was for iOS 26 + Maestro 2.3.0 XCTest driver issues,
# but causes double app launches (simctl launch + launchApp in flow).
# With clearState: false in flows, launchApp does NOT kill/relaunch the app,
# so XCTest disconnection should not occur.
#
# To re-enable pre-launch if XCTest port-7001 errors reappear:
# Set SKIP_PRELAUNCH=false in environment or pass --enable-prelaunch flag
#
if [ "$PLATFORM" = "ios" ] && [ "$SKIP_PRELAUNCH" = "false" ]; then
  PRE_LAUNCH_UDID=$(get_booted_sim_udid)
  if [ -n "$PRE_LAUNCH_UDID" ]; then
    echo -e "${BLUE}Pre-launching app via simctl...${NC}"
    xcrun simctl launch "$PRE_LAUNCH_UDID" "$APP_ID" 2>/dev/null \
      && echo -e "${GREEN}✓ App pre-launched, waiting for initialization...${NC}" \
      || echo -e "${YELLOW}⚠️  Pre-launch failed (app may not be installed)${NC}"
    sleep 3  # Let the app reach its first screen before Maestro's XCTest connects
    echo ""
  fi
elif [ "$PLATFORM" = "ios" ]; then
  # echo -e "${BLUE}ℹ️  App pre-launch disabled (prevents double launch)${NC}"
  # echo -e "${BLUE}   App will be launched by Maestro's launchApp command${NC}"
  echo ""
fi

# ============================================================================
# RUN TESTS

# NETWORK CAPTURE SETUP (NO INJECTION NEEDED)
# ============================================================================
# Network capture uses native iOS/Android logging - no code injection required

# Check if app is installed and auto-install if missing (skip when --skip-setup is set).
#
# --download-and-install-latest-firebase takes over this step entirely and runs
# regardless of --skip-setup: the whole point of the flag is "never run the local
# Gradle build, always pull the latest 'main' APK from Firebase App Distribution".
if [ "$DOWNLOAD_INSTALL_FIREBASE" = "true" ]; then
  echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║  Step 2: Install Latest Firebase Release (main)            ║${NC}"
  echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
  echo ""
  # Resolve the Firebase app (CVS Health "shop" vs Health100) from the already
  # -resolved APP_ID, mirroring the *health100*/else pattern used elsewhere in
  # this file (see the RECORDING_OUTPUT_DIR case above).
  _fb_variant_override="shopDebug"
  case "$APP_ID" in
    *health100*) _fb_variant_override="healthDebug" ;;
  esac
  ANDROID_BUILD_VARIANT_OVERRIDE="$_fb_variant_override" \
    bash "$SCRIPT_DIR/build/firebase-setup.sh" download-and-install-latest --device "$DEVICE" || {
      echo -e "${RED}❌ Firebase download/install failed${NC}"
      exit 1
    }
  echo ""
elif [ "$SKIP_SETUP" = "false" ]; then
  echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${BLUE}║  Step 2: Verify App Installation                          ║${NC}"
  echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
  echo ""
  check_and_install_app "$PLATFORM" "$APP_ID"
  echo ""
fi

# Start each run with a clean maestro daemon to prevent port 7001 conflicts.
# Stale daemons from previous runs can prevent maestro from connecting.
kill_maestro_daemon

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Step 3: Running Tests                                    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

REPORT_DIR="$PROJECT_ROOT/test-reports"
mkdir -p "$REPORT_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
PLATFORM_NAME=$(echo "$PLATFORM" | tr '[:lower:]' '[:upper:]')
DATE_TIME_FOLDER="${PLATFORM_NAME}_${TIMESTAMP}"
DATED_REPORT_DIR="$REPORT_DIR/$DATE_TIME_FOLDER"

# Subdirectory paths — defined here so they're available for ENV_ARGS and network capture,
# but the actual mkdir calls are deferred to create_report_dirs() which runs only when
# tests are about to start (app verified + GENERATE_REPORT=true).
SCREENSHOTS_DIR="$DATED_REPORT_DIR/screenshots"
LOGS_DIR="$DATED_REPORT_DIR/logs"
HIERARCHIES_DIR="$DATED_REPORT_DIR/hierarchies"
PERFORMANCE_DIR="$DATED_REPORT_DIR/performance"
ACCESSIBILITY_DIR="$DATED_REPORT_DIR/accessibility"
NETWORK_DIR="$DATED_REPORT_DIR/network"

# Set video output path if recording enabled (suite execution not supported)
if [ "$VIDEO_ENABLED" = "true" ]; then
  VIDEO_DIR="$DATED_REPORT_DIR/video"
  TEST_NAME_CLEAN=$(basename "$TEST_PATH" .yaml | tr ' ' '_' | tr '[:upper:]' '[:lower:]')
  VIDEO_FILE="$VIDEO_DIR/${TEST_NAME_CLEAN}_${TIMESTAMP}.mp4"
fi

create_report_dirs() {
  mkdir -p "$DATED_REPORT_DIR"
  mkdir -p "$SCREENSHOTS_DIR" "$LOGS_DIR" "$HIERARCHIES_DIR"
  if [[ "$RUN_PERF_TESTS" == "true" ]]; then
    mkdir -p "$PERFORMANCE_DIR"
  fi
  if [[ "$RUN_A11Y_TESTS" == "true" ]]; then
    mkdir -p "$ACCESSIBILITY_DIR"
  fi
  if [ "$VIDEO_ENABLED" = "true" ] && [ -n "${VIDEO_DIR:-}" ]; then
    mkdir -p "$VIDEO_DIR"
  fi
}

# Network folder is created on-demand by network capture script
# but we set the path for use in the scripts

REPORT_FILE="$DATED_REPORT_DIR/test-report-${PLATFORM_NAME}-$TIMESTAMP.html"
RESULTS_FILE="$DATED_REPORT_DIR/results-${PLATFORM_NAME}-$TIMESTAMP.xml"
API_CALLS_FILE="$NETWORK_DIR/api-calls.json"

# Change to project root to ensure test-reports is created at correct location
cd "$PROJECT_ROOT" || exit 1

# Validate Maestro relative paths before running tests.
# This prevents local/CI failures caused by broken runFlow/runScript references.
PATH_CHECKER="$SCRIPT_DIR/utils/validation/check-maestro-paths.js"
if [ -f "$PATH_CHECKER" ] && [ "$SKIP_VALIDATION" = "false" ]; then
  echo -e "${BLUE}Validating Maestro flow/screen paths...${NC}"
  if ! node "$PATH_CHECKER"; then
    echo -e "${RED}❌ Path validation failed. Fix runFlow/runScript references before running tests.${NC}"
    echo -e "${YELLOW}💡 Use --skip-validation to bypass path checking for single test runs${NC}"
    exit 1
  fi
elif [ "$SKIP_VALIDATION" = "true" ]; then
  echo -e "${YELLOW}⚠️  Skipping Maestro path validation${NC}"
fi

# ============================================================================
# CLEANUP OLD REPORTS (Keep only 5 most recent dated folders)
# ============================================================================
cleanup_old_reports() {
  local max_reports=5
  
  # Find all report folders with timestamps (both iOS and Android)
  # Patterns:
  # - IOS_YYYYMMDD_HHMMSS (iOS new format)
  # - ANDROID_YYYYMMDD_HHMMSS (Android new format)
  # - YYYY-MM-DD_HHMMSS (old format)
  local all_folders=$(find "$REPORT_DIR" -maxdepth 1 -type d 2>/dev/null | \
    grep -E "(IOS_[0-9]{8}_[0-9]{6}|ANDROID_[0-9]{8}_[0-9]{6}|[0-9]{4}-[0-9]{2}-[0-9]{2}_[0-9]{6})")
  
  local folder_count=$(echo "$all_folders" | grep -c '^' | head -1 2>/dev/null || echo 0)
  
  if [ "$folder_count" -gt "$max_reports" ]; then
    local folders_to_delete=$((folder_count - max_reports))
    echo -e "${BLUE}Cleaning up old report folders (keeping $max_reports most recent across all platforms)...${NC}"
    
    # Sort by modification time (newest last) and delete oldest
    echo "$all_folders" | \
      xargs -I {} stat -f '%m %N' {} 2>/dev/null | \
      sort -n | \
      head -n "$folders_to_delete" | \
      awk '{print $NF}' | \
      while read -r old_folder; do
        if [ -d "$old_folder" ]; then
          echo -e "${YELLOW}  Removing: $(basename "$old_folder")${NC}"
          rm -rf "$old_folder"
        fi
      done
  fi
}

cleanup_old_reports

# Detect build configuration (auto-detect environment)
# Build config mapping: debug -> qa, adhoc/alpha/release -> prod
# Priority: BUILD_CONFIG env var → build_config.yaml → "debug" default
if [ -z "${BUILD_CONFIG:-}" ] && [ -f "$CONFIG_FILE" ]; then
  _cfg_from_yaml=$(grep -E "^configuration:" "$CONFIG_FILE" | grep -v "^[[:space:]]*#" | sed 's/.*configuration: *"\(.*\)".*/\1/' | head -1)
  [ -n "$_cfg_from_yaml" ] && BUILD_CONFIG="$_cfg_from_yaml"
fi
BUILD_CONFIG="${BUILD_CONFIG:-debug}"
BUILD_CONFIG_LOWER=$(echo "$BUILD_CONFIG" | tr '[:upper:]' '[:lower:]')

# Export BUILD_CONFIG for reference
export BUILD_CONFIG="$BUILD_CONFIG_LOWER"

# Set ENVIRONMENT based on BUILD_CONFIG
if [ "$BUILD_CONFIG_LOWER" = "debug" ]; then
  ENVIRONMENT="qa"
else
  ENVIRONMENT="prod"
fi

echo "Build Config: $BUILD_CONFIG_LOWER"
echo "Environment: $ENVIRONMENT"
echo ""

# Export environment variables for credential loader
export ENVIRONMENT="$ENVIRONMENT"
export BUILD_CONFIG="$BUILD_CONFIG_LOWER"

# Build environment arguments for maestro test
# Pass ENVIRONMENT and BUILD_CONFIG to credentials-loader.js
# Also pass REPORT_DIR so captureScreenHierarchy.js knows where to write hierarchy files
# Quote values to prevent shell interpretation of dots in APP_ID
ENV_ARGS="--env APP_ID=\"$APP_ID\" --env ENVIRONMENT=\"$ENVIRONMENT\" --env BUILD_CONFIG=\"$BUILD_CONFIG_LOWER\" --env REPORT_DIR=\"$DATED_REPORT_DIR\" --env NUMBER_OF_ACTIONS=\"$NUMBER_OF_ACTIONS\""
[ -n "${TAP_WEIGHT:-}" ]   && ENV_ARGS="$ENV_ARGS --env TAP_WEIGHT=\"$TAP_WEIGHT\""
[ -n "${SWIPE_WEIGHT:-}" ] && ENV_ARGS="$ENV_ARGS --env SWIPE_WEIGHT=\"$SWIPE_WEIGHT\""
[ -n "${BACK_WEIGHT:-}" ]  && ENV_ARGS="$ENV_ARGS --env BACK_WEIGHT=\"$BACK_WEIGHT\""

# Network capture flag (using iOS simulator network logging)
if [ "$NETWORK_CAPTURE" = "true" ]; then
  echo ""
  echo -e "${BLUE}Network capture enabled (iOS simulator network logging)${NC}"
  
  # Create network directory
  mkdir -p "$DATED_REPORT_DIR/network"
  
  # Get booted simulator device ID
  DEVICE_ID=$(get_booted_sim_udid)
  
  if [ -n "$DEVICE_ID" ]; then
    # Start capturing network logs from simulator
    NETWORK_LOG_FILE="$DATED_REPORT_DIR/network/simulator-network.log"
    echo -e "${BLUE}📡 Starting network capture from simulator...${NC}"
    echo "   Device: $DEVICE_ID"
    echo "   App: $APP_ID"

    # Enable full URL visibility in logs — works for BOTH debug and prod builds.
    # private_data:on disables iOS log privacy redaction for CFNetwork so full
    # URLs appear instead of <private>. CFNETWORK_DIAGNOSTICS=3 adds verbose
    # request/response detail. Neither requires app code changes or SSL interception,
    # so cert pinning in production builds is never triggered.
    xcrun simctl spawn "$DEVICE_ID" log config \
      --subsystem com.apple.CFNetwork \
      --mode private_data:on 2>/dev/null || true
    xcrun simctl spawn "$DEVICE_ID" log config \
      --subsystem com.apple.network \
      --mode private_data:on 2>/dev/null || true
    xcrun simctl spawn "$DEVICE_ID" launchctl setenv CFNETWORK_DIAGNOSTICS 3 2>/dev/null || true

    # Capture comprehensive network logs across CFNetwork + Network.framework
    xcrun simctl spawn "$DEVICE_ID" log stream \
      --predicate "(subsystem == \"com.apple.CFNetwork\" OR subsystem == \"com.apple.network\" OR category == \"NSURLSession\" OR category == \"HTTP\") AND (processImagePath CONTAINS \"$APP_ID\" OR processImagePath CONTAINS \"CVSOnline\" OR processImagePath CONTAINS \"Health100\")" \
      --level debug \
      > "$NETWORK_LOG_FILE" 2>&1 &
    NETWORK_LOG_PID=$!
    
    echo "$NETWORK_LOG_PID" > "$DATED_REPORT_DIR/network/capture.pid"
    echo -e "${GREEN}✅ Network capture started (PID: $NETWORK_LOG_PID)${NC}"
    echo ""
  else
    echo -e "${YELLOW}⚠️  No booted simulator found - network capture disabled${NC}"
  fi
fi

# Check Maestro version and determine if --record-output is supported
check_maestro_version() {
  local maestro_version=$(maestro --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
  
  if [ -z "$maestro_version" ]; then
    echo "false"
    return
  fi
  
  # Extract major version
  local major=$(echo "$maestro_version" | cut -d. -f1)
  
  # --record-output is supported in Maestro 1.35.0+
  if [ "$major" -gt 1 ] || ([ "$major" -eq 1 ] && [ "$(echo "$maestro_version" | cut -d. -f2)" -ge 35 ]); then
    echo "true"
  else
    echo "false"
  fi
}

# Run maestro test with environment variables
# MAESTRO_DRIVER_STARTUP_TIMEOUT: how long (ms) to wait for the Maestro driver
# to become ready on port 7001. Default is often too short on slow emulators/simulators.
# Android with large APKs (1.3GB+) needs longer timeout than iOS.
export MAESTRO_DRIVER_STARTUP_TIMEOUT=${MAESTRO_DRIVER_STARTUP_TIMEOUT:-240000}  # 4 minutes
TEST_EXIT_CODE=0
if [ "$GENERATE_REPORT" = "true" ]; then
  # Create report directories now that tests are about to start
  create_report_dirs

  # Capture maestro output to log file
  MAESTRO_LOG="$LOGS_DIR/maestro-test.log"
  
  
  # ──────────────────────────────────────────────────────────────────────────
  # Collect CI/CD metadata for enhanced reporting
  # ──────────────────────────────────────────────────────────────────────────
  CI_METADATA_COLLECTOR="$SCRIPT_DIR/utils/reporting/ci-metadata-collector.js"
  CI_METADATA_FILE="$REPORT_DIR/ci-metadata.json"
  if [ -f "$CI_METADATA_COLLECTOR" ] && command -v node &>/dev/null; then
    # echo -e "${BLUE}Collecting CI/CD metadata...${NC}"
    if node "$CI_METADATA_COLLECTOR" "$CI_METADATA_FILE" 2>/dev/null; then
      echo -e "${GREEN}  ✓ CI/CD metadata captured${NC}"
    else
      echo -e "${YELLOW}  ⚠️  CI/CD metadata collection failed${NC}"
    fi
  fi
  echo ""

  # ──────────────────────────────────────────────────────────────────────────
  # Screen preloader: auto-inject all required screen runScript entries into
  # the flow's onFlowStart so every subflow has access to output.* variables
  # without needing its own runScript calls. This avoids redundant JS
  # evaluation and prevents GraalJS crashes from undefined variables.
  # ──────────────────────────────────────────────────────────────────────────
  PRELOADED_TEST_PATH="$TEST_PATH"
  SCREEN_PRELOADER="$SCRIPT_DIR/utils/screen-preloader.js"
  if [ "$SKIP_PRELOAD" != "true" ] && [ -f "$SCREEN_PRELOADER" ] && command -v node &>/dev/null; then
    echo -e "${BLUE}Auto-preloading screen dependencies...${NC}"
    # echo -e "${BLUE}[DEBUG] Original TEST_PATH=$TEST_PATH${NC}"
    PRELOADED_TEST_PATH=$(node "$SCREEN_PRELOADER" "$TEST_PATH" --generate-temp 2>/dev/null)
    # echo -e "${BLUE}[DEBUG] Preloader returned: $PRELOADED_TEST_PATH${NC}"
    if [ -n "$PRELOADED_TEST_PATH" ] && [ -f "$PRELOADED_TEST_PATH" ]; then
      echo -e "${GREEN}  ✓ Screen preload injected into temp flow${NC}"
      # echo -e "${BLUE}[DEBUG] Using temp file: $PRELOADED_TEST_PATH${NC}"
    else
      # Fallback: use the original flow if preloader failed
      PRELOADED_TEST_PATH="$TEST_PATH"
      echo -e "${YELLOW}  ⚠️  Preloader failed, using original flow${NC}"
    fi
  else
    echo -e "${YELLOW}Skipping screen preloader (--skip-preload flag)${NC}"
    PRELOADED_TEST_PATH="$TEST_PATH"
  fi

  # Build maestro command with recording if enabled
  # All output goes directly into the dated report directory
  # --debug-output captures per-step JSON files (including console.log from every runScript)
  # NOTE: --format junit is intentionally OMITTED here. On iOS 26.2 / Maestro 2.3.0 the
  # JUnit formatter causes the XCTest driver (port 7001) to disconnect ~5 seconds after
  # startup with "CommandFailed: Failed to connect to /127.0.0.1:7001".  The JUnit XML is
  # synthesised from the maestro log after the test finishes (see below).
  #
  # --config .maestro/config.yaml: workspace-level config that sets
  #   platform.ios.snapshotKeyHonorModalViews: false
  #   This prevents the XCTest driver from crashing when iOS system permission dialogs
  #   (notifications, bluetooth) are visible during hierarchy snapshots on iOS 26.x.
  WORKSPACE_CONFIG="$PROJECT_ROOT/.maestro/config.yaml"
  # Always pass platform explicitly so Maestro does not auto-pick a device
  # from the wrong OS when both iOS and Android are connected.
  # For iOS, detect the booted simulator's device ID to avoid stale device caching
  DEVICE_FLAG=""
  if [ -n "$DEVICE" ]; then
    DEVICE_FLAG="--device \"$DEVICE\""
  elif [ "$PLATFORM" = "ios" ]; then
    # Verify iOS simulator is still booted (may have crashed during setup)
    BOOTED_SIM_ID=$(get_booted_sim_udid)

    if [ -z "$BOOTED_SIM_ID" ]; then
      # No booted simulator found - attempt to boot one
      echo -e "${YELLOW}⚠️  No booted iOS simulator detected - attempting to boot...${NC}"
      bash "$SCRIPT_DIR/setup/ios-setup.sh" boot || {
        echo -e "${RED}❌ Failed to boot iOS simulator${NC}"
        exit 1
      }
      # Re-detect device ID after booting (invalidate stale cache first)
      invalidate_sim_udid_cache
      BOOTED_SIM_ID=$(get_booted_sim_udid)
    fi

    if [ -n "$BOOTED_SIM_ID" ]; then
      DEVICE_FLAG="--device \"$BOOTED_SIM_ID\""
      echo -e "${BLUE}Using booted iOS simulator: $BOOTED_SIM_ID${NC}"
    else
      echo -e "${RED}❌ Could not detect booted iOS simulator${NC}"
      exit 1
    fi
  fi
  MAESTRO_CMD="$MAESTRO_BIN --platform \"$PLATFORM\" $DEVICE_FLAG test \"$PRELOADED_TEST_PATH\" $ENV_ARGS --test-output-dir \"$DATED_REPORT_DIR\" --debug-output \"$DATED_REPORT_DIR/debug\""
  if [ -f "$WORKSPACE_CONFIG" ]; then
    MAESTRO_CMD="$MAESTRO_CMD --config \"$WORKSPACE_CONFIG\""
  fi
  
  # echo -e "${BLUE}Maestro command:${NC}"
  # echo "$MAESTRO_CMD"
  echo ""

  # --record-output is not available in Maestro 2.x; video uses native platform recording (see below)
  
  # Log execution details if logging enabled
  if [ "$ENABLE_LOGGING" = "true" ]; then
    {
      echo "╔════════════════════════════════════════════════════════════╗"
      echo "║           Maestro Test Execution Log                       ║"
      echo "╚════════════════════════════════════════════════════════════╝"
      echo ""
      echo "Test Information:"
      echo "  Test Name: $(basename "$TEST_PATH" .yaml)"
      echo "  Test Path: $TEST_PATH"
      echo "  Platform: $PLATFORM"
      echo "  APP_ID: $APP_ID"
      echo ""
      echo "Execution Configuration:"
      echo "  Execution Timeout: ${EXECUTION_TIMEOUT}ms"
      echo "  Continue on Failure: $CONTINUE_ON_FAILURE"
      echo "  Record Timings: $RECORD_TIMINGS"
      echo "  Network Capture: $NETWORK_CAPTURE"
      echo "  UI Inspector: $([ "$DISABLE_UI_INSPECTOR" = "true" ] && echo "disabled" || echo "enabled")"
      echo "  Network Monitor: $([ "$DISABLE_NETWORK_MONITOR" = "true" ] && echo "disabled" || echo "enabled")"
      echo "  Logging Enabled: $ENABLE_LOGGING"
      echo ""
      echo "Environment Variables Loaded:"
      # [ -n "$COMMON_USER" ] && echo "  ✓ COMMON_USER: ${COMMON_USER:0:3}***"
      # [ -n "$COMMON_PASSWORD" ] && echo "  ✓ COMMON_PASSWORD: [loaded]"
      # [ -n "$STATIC_OTP" ] && echo "  ✓ STATIC_OTP: [loaded]"
      # [ -n "$DOB" ] && echo "  ✓ DOB: [loaded]"
      echo ""
      # echo "Maestro Command:"
      # echo "  $MAESTRO_CMD"
      echo ""
      echo "═══════════════════════════════════════════════════════════"
      echo "Execution started: $(date '+%Y-%m-%d %H:%M:%S')"
      echo "═══════════════════════════════════════════════════════════"
      echo ""
    } > "$MAESTRO_LOG"
  fi
  
  # Execute maestro test and capture output with timestamps
  # Start background capture in parallel with test execution
  CAPTURE_PID=""
  NETWORK_PID=""
  PERF_MONITOR_PID=""

  # Start background UI and network monitoring (non-blocking, uses native platform tools)
  if [ "$GENERATE_REPORT" = "true" ]; then
    TEST_NAME=$(basename "$TEST_PATH" .yaml)
    
    # Android-only background monitors.
    # On iOS, parallel inspector/network scripts can compete with the active
    # Maestro XCTest driver and trigger 127.0.0.1:7001 disconnects. iOS report
    # data comes from the dedicated runtime/failure capture pipeline instead.
    if [ "$PLATFORM" != "ios" ]; then
      UI_INSPECTOR="$SCRIPT_DIR/utils/ui-capture/android-ui-inspector.js"

      if [ "$DISABLE_UI_INSPECTOR" = "true" ]; then
        echo -e "${YELLOW}⚠️  UI inspector disabled (--no-ui-inspector)${NC}"
      else
      (
          # Wait for the Maestro driver to actually connect. The CLI prints
          # "Running on <device>" to stdout the moment the driver session is
          # established (well before any flow step) — "Running flow" is NOT
          # what appears in this log; that string only exists in Maestro's
          # separate internal debug log under debug/.maestro/tests/*/maestro.log.
          # Bails out early if it never connects, so we don't burn 20-30s
          # (or the whole run) capturing hierarchy snapshots for a test that
          # never started. CI is slower, so we allow more time there.
        _driver_wait=0
        _driver_wait_max=90
        [ "${CI}" = "true" ] && _driver_wait_max=120
        while [ "$_driver_wait" -lt "$_driver_wait_max" ]; do
          grep -q "Running on " "$MAESTRO_LOG" 2>/dev/null && break
          grep -qE "^WATCHDOG: Maestro driver did not connect|Maestro Android driver did not start up in time" "$MAESTRO_LOG" 2>/dev/null && exit 0
          sleep 2
          _driver_wait=$((_driver_wait + 2))
        done
        [ "$_driver_wait" -ge "$_driver_wait_max" ] && exit 0
        while true; do
          node "$UI_INSPECTOR" "$TEST_NAME" "$DATED_REPORT_DIR" 2>/dev/null || true
          sleep 5
        done
      ) &
      CAPTURE_PID=$!
      fi

      # Capture network data (logcat with both debug OkHttp tags and
      # broader system tags that surface errors in production builds too).
      # Skippable via --no-network-monitor when the host is resource-constrained
      # (e.g. multiple emulators running) since this spawns a persistent adb
      # logcat process plus a polling node script for the whole test duration.
      NETWORK_MONITOR="$SCRIPT_DIR/utils/network-monitoring/android-network-monitor.js"
      ANDROID_NET_LOG="$DATED_REPORT_DIR/network/android-network.log"

      if [ "$DISABLE_NETWORK_MONITOR" = "true" ]; then
        echo -e "${YELLOW}⚠️  Network monitor disabled (--no-network-monitor)${NC}"
      else
      mkdir -p "$DATED_REPORT_DIR/network"

      # Verbose logcat tags:
      # - OkHttp / HttpLoggingInterceptor : full request+response (debug builds)
      # - NetworkSecurityConfig            : TLS/cert errors (all builds)
      # - ConnectivityService              : network state changes (all builds)
      # - System.err / AndroidRuntime      : uncaught HTTP exceptions (all builds)
      (
        sleep 8
        adb logcat -s \
          "OkHttp:V" "HttpLoggingInterceptor:V" \
          "NetworkSecurityConfig:W" "ConnectivityService:W" \
          "System.err:W" "AndroidRuntime:E" \
          >> "$ANDROID_NET_LOG" 2>/dev/null || true
      ) &
      ANDROID_NET_PID=$!

      if [ -f "$NETWORK_MONITOR" ]; then
        (
          # Same driver-connect gate as the UI inspector above — no point
          # polling network state for a test that never started.
          _driver_wait=0
          _driver_wait_max=90
          [ "${CI}" = "true" ] && _driver_wait_max=120
          while [ "$_driver_wait" -lt "$_driver_wait_max" ]; do
            grep -q "Running on " "$MAESTRO_LOG" 2>/dev/null && break
            grep -qE "^WATCHDOG: Maestro driver did not connect|Maestro Android driver did not start up in time" "$MAESTRO_LOG" 2>/dev/null && exit 0
            sleep 2
            _driver_wait=$((_driver_wait + 2))
          done
          [ "$_driver_wait" -ge "$_driver_wait_max" ] && exit 0
          while true; do
            node "$NETWORK_MONITOR" "$TEST_NAME" "$DATED_REPORT_DIR" 2>/dev/null || true
            sleep 5
          done
        ) &
        NETWORK_PID=$!
      fi
      fi
    fi
  fi

  # A11y element data is extracted from the Maestro debug log post-test
  # (see a11y-extract-from-log.js below).  No background process needed.

  # Start background performance monitor when --perf is set.
  # iOS: polls host `ps` for the simulator process (CPU % + RSS MB).
  # Android: polls adb dumpsys for CPU, memory, battery, and gfxinfo for FPS/jank.
  # Writes incremental JSONL and a final perf-samples.json on stop.
  if [ "$RUN_PERF" = "true" ]; then
    _PERF_DIR="$DATED_REPORT_DIR/performance"
    mkdir -p "$_PERF_DIR"
    _PERF_DEVICE_ID=""
    if [ "$PLATFORM" = "ios" ]; then
      _PERF_DEVICE_ID=$(get_booted_sim_udid)
    else
      _PERF_DEVICE_ID=$(adb devices 2>/dev/null | grep -v "List of devices" | grep "device$" | awk '{print $1}' | head -1)
    fi
    if [ -n "$_PERF_DEVICE_ID" ]; then
      node "$SCRIPT_DIR/utils/analysis/performance-monitor.js" \
        "$PLATFORM" "$_PERF_DEVICE_ID" "$APP_ID" "$_PERF_DIR" 2000 \
        >> "$LOGS_DIR/perf-monitor.log" 2>&1 &
      PERF_MONITOR_PID=$!
      echo -e "${BLUE}📊 Performance monitor started (PID: $PERF_MONITOR_PID)${NC}"
    else
      echo -e "${YELLOW}⚠️  No device found — performance monitor skipped${NC}"
    fi
  fi

  # Start native screen recording if --video flag was passed
  if [ "$VIDEO_ENABLED" = "true" ]; then
    if [ "$PLATFORM" = "ios" ]; then
      SIM_UDID=$(get_booted_sim_udid)
      if [ -n "$SIM_UDID" ]; then
        xcrun simctl io "$SIM_UDID" recordVideo --type mp4 "$VIDEO_FILE" &
        VIDEO_RECORD_PID=$!
        echo -e "${BLUE}📹 Screen recording started (iOS simulator) -> $(basename "$VIDEO_FILE")${NC}"
      else
        echo -e "${YELLOW}⚠️  No booted iOS simulator found - video recording skipped${NC}"
        VIDEO_ENABLED="false"
      fi
    elif [ "$PLATFORM" = "android" ]; then
      DEVICE_VIDEO_PATH="/sdcard/maestro_rec_${TIMESTAMP}.mp4"
      adb shell "screenrecord --time-limit 600 $DEVICE_VIDEO_PATH" &
      VIDEO_RECORD_PID=$!
      echo -e "${BLUE}📹 Screen recording started (Android emulator) -> $(basename "$VIDEO_FILE")${NC}"
    fi
  fi

  run_maestro_once() {
    mkdir -p "$MAESTRO_LOG_ROOT" 2>/dev/null || true
    if [ "$ENABLE_LOGGING" = "true" ]; then
      local _RUNTIME_WATCHER_PID=""

      # Runtime hierarchy capture is disabled during active iOS test execution.
      # On iOS 26.x, concurrent hierarchy snapshots can destabilize the Maestro
      # XCTest driver and cause 127.0.0.1:7001 disconnects mid-flow.
      # Runtime hierarchy capture is temporarily disabled on Android to prevent
      # potential resource contention with the main maestro test execution.
      # The background UI inspector (android-ui-inspector.js) already captures
      # hierarchy data every 5 seconds during test runs.
      # if [ "$PLATFORM" != "ios" ]; then
      #   (
      #     _WATCH_LOG=""
      #     for _i in $(seq 1 40); do
      #       _WATCH_LOG=$(find "$DATED_REPORT_DIR/debug/.maestro/tests" -type f -name "maestro.log" 2>/dev/null | head -1)
      #       [ -n "$_WATCH_LOG" ] && break
      #       sleep 1
      #     done
      #
      #     [ -z "$_WATCH_LOG" ] && exit 0
      #
      #     tail -n +1 -F "$_WATCH_LOG" 2>/dev/null | while IFS= read -r _dbg_line; do
      #       if echo "$_dbg_line" | grep -q 'JsConsole: DEBUG: Stored screen name as:'; then
      #         _RUNTIME_SCREEN_NAME=$(echo "$_dbg_line" | sed 's/.*JsConsole: DEBUG: Stored screen name as: //' | tr -cd 'a-zA-Z0-9 _-')
      #         _RUNTIME_SCREEN_SLUG=$(echo "$_RUNTIME_SCREEN_NAME" | tr ' ' '_')
      #         if [ -n "$_RUNTIME_SCREEN_SLUG" ]; then
      #           sleep 1
      #           node "$SCRIPT_DIR/utils/ui-capture/capture-hierarchy-on-failure.js" "$_RUNTIME_SCREEN_SLUG" "runtime" "$DATED_REPORT_DIR" "$PLATFORM" >/dev/null 2>&1 || true
      #         fi
      #       fi
      #     done
      #   ) &
      #   _RUNTIME_WATCHER_PID=$!
      # fi

      # Use tee directly to avoid pipe buffering issues that can cause hangs.
      # The while-read loop was creating a subshell that could block waiting for output.
      
      # Final port check before execution to prevent "dadb.open( tcp:7001 )" timeout.
      #
      # SKIPPED ENTIRELY IN PARALLEL MODE. Even a PLATFORM=ios-scoped
      # `lsof -ti tcp:7001 | xargs kill -9` is unsafe when Android is
      # concurrently running its own Maestro CLI, because:
      #   1. Android's maestro (JVM) itself opens outbound TCP client sockets
      #      to localhost:7001 during shard init — `lsof -ti tcp:7001`
      #      returns that JVM's PID alongside any true listener PID.
      #   2. adb-server may be forwarding tcp:7001 → tcp:<android-device-port>
      #      as part of Android's own driver setup, and appears in lsof too.
      #   3. `xargs kill -9` on the merged PID list SIGKILLs Android's maestro
      #      (exit 137 in the Android log) even though iOS was only trying to
      #      clean up its own port. That's the exact symptom that produced
      #      "Android goes running→done as soon as iOS Maestro starts".
      #
      # The wrapper `run-both-platforms.sh` already does a one-shot port-7001
      # sweep BEFORE launching either platform. Once launched, both platforms
      # negotiate their own ports; anything on 7001 mid-run is legitimate and
      # must not be killed by the sibling.
      if [ "${PARALLEL_MODE:-}" != "true" ]; then
        local port_check
        port_check=$(lsof -ti tcp:7001 2>/dev/null || true)
        if [ -n "$port_check" ]; then
          echo -e "${YELLOW}⚠️  Port 7001 is in use, forcing cleanup...${NC}"
          echo "$port_check" | xargs kill -9 2>/dev/null || true
          sleep 1
        fi
      fi

      # Android pre-flight: clear stale adb forwards + on-device driver state
      # from the previous run. Without this, the 3rd/4th test consistently
      # fails with "Maestro Android driver did not start up in time".
      if [ "$PLATFORM" = "android" ]; then
        cleanup_android_driver_state
      fi

      echo -e "${BLUE}Starting Maestro test execution...${NC}"

      # ────────────────────────────────────────────────────────────────────
      # Connect watchdog: fail fast if the Maestro driver never connects
      # within a short grace period, instead of silently waiting out the
      # full MAESTRO_DRIVER_STARTUP_TIMEOUT (default 4 minutes). Without
      # this, a dead/half-attached driver connection just hangs the whole
      # run for 4 minutes before Maestro itself reports "did not start up
      # in time" — during which background monitors keep capturing
      # hierarchy/network data for a test that never started.
      #
      # Connection signal: the CLI prints "Running on <device>" the moment
      # the driver session is established, well before any flow step runs.
      # NOTE: "Running flow" is NOT the right string to grep for here — that
      # only appears in Maestro's separate internal debug log
      # (debug/.maestro/tests/*/maestro.log), never in this console-tee'd
      # $MAESTRO_LOG. Grepping for it here would make this watchdog fire on
      # every single run after the grace period, killing healthy in-progress
      # tests.
      #
      # Safe in parallel mode: it targets processes whose command line
      # contains this run's own (unique, per-invocation) temp flow path,
      # never the sibling platform's flow.
      local _DRIVER_CONNECT_GRACE_SECS=${DRIVER_CONNECT_GRACE_SECS:-90}
      local _watchdog_pid=""
      if [ "${DISABLE_CONNECT_WATCHDOG:-false}" != "true" ]; then
        (
          _elapsed=0
          while [ "$_elapsed" -lt "$_DRIVER_CONNECT_GRACE_SECS" ]; do
            if grep -qE 'Running on |CommandFailed|ERROR' "$MAESTRO_LOG" 2>/dev/null; then
              exit 0
            fi
            sleep 2
            _elapsed=$((_elapsed + 2))
          done
          echo "" >> "$MAESTRO_LOG"
          echo "WATCHDOG: Maestro driver did not connect within ${_DRIVER_CONNECT_GRACE_SECS}s — terminating early." >> "$MAESTRO_LOG"
          pkill -f "$PRELOADED_TEST_PATH" 2>/dev/null || true
        ) &
        _watchdog_pid=$!
      fi

      eval "$MAESTRO_CMD" 2>&1 | tee -a "$MAESTRO_LOG"
      local _RUN_EXIT=${PIPESTATUS[0]}

      if [ -n "$_watchdog_pid" ]; then
        kill "$_watchdog_pid" 2>/dev/null || true
        wait "$_watchdog_pid" 2>/dev/null || true
      fi

      if [ -n "$_RUNTIME_WATCHER_PID" ]; then
        # Kill the entire process tree: the subshell, tail -F, and the while-read pipe.
        # pkill -P only reaches direct children, but tail -F is a grandchild of the
        # subshell (spawned by the pipe), so we must also kill by process group.
        kill "$_RUNTIME_WATCHER_PID" 2>/dev/null || true
        pkill -P "$_RUNTIME_WATCHER_PID" 2>/dev/null || true
        # Kill any orphaned tail still following the maestro debug log
        pkill -f "tail.*-F.*maestro.log" 2>/dev/null || true
        wait "$_RUNTIME_WATCHER_PID" 2>/dev/null || true
      fi

      return $_RUN_EXIT
    fi

    eval "$MAESTRO_CMD" 2>&1 | tee -a "$MAESTRO_LOG"
    return ${PIPESTATUS[0]}
  }

  _TEST_START_TIME=$(date +%s)
  TEST_EXIT_CODE=0
  ATTEMPT=0
  while true; do
    ATTEMPT=$((ATTEMPT + 1))
    run_maestro_once
    TEST_EXIT_CODE=$?
    if [ "$TEST_EXIT_CODE" -eq 0 ] || [ "$ATTEMPT" -gt "$RETRY_COUNT" ]; then
      break
    fi
    echo ""
    echo -e "${YELLOW}🔄 Retry $ATTEMPT/$RETRY_COUNT (test failed, retrying...)${NC}"
    echo ""
  done
  if [ "$RETRY_COUNT" -gt 0 ] && [ "$ATTEMPT" -gt 1 ] && [ "$TEST_EXIT_CODE" -eq 0 ]; then
    echo -e "${GREEN}✓ Passed after $ATTEMPT attempt(s)${NC}"
  fi

  # ──────────────────────────────────────────────────────────────────────────
  # Detect "test never actually started" failures — driver-side crashes from
  # Maestro itself (Android driver timeout, iOS 7001 connect failure). In
  # these cases there are no test steps to report on, so generating an HTML
  # report / Slack card / etc. just adds noise. Skip everything downstream
  # and surface the raw console error to the user.
  #
  # IMPORTANT: The same exception signatures (dadb.open(...), gRPC UNAVAILABLE)
  # can also appear when the driver dies MID-FLOW after several steps already
  # completed (e.g. the on-device dev.mobile.maestro[.test] instrumentation
  # gets force-stopped/uninstalled partway through — deletePackageX in
  # logcat). That's a real, reportable failure with useful screenshots/
  # hierarchy/logs already captured — it must NOT be treated as "never ran"
  # or we destroy the only evidence of where/why it crashed. Distinguish the
  # two by checking whether the log shows the driver actually connected
  # ("Running on <device>") and/or any step " COMPLETED" before the error.
  # ──────────────────────────────────────────────────────────────────────────
  DRIVER_STARTUP_FAILED=false
  if [ "$TEST_EXIT_CODE" -ne 0 ] && [ -f "$MAESTRO_LOG" ]; then
    if grep -qE \
      'Maestro Android driver did not start up in time|MaestroDriverStartupException|AndroidDriverTimeoutException|IOSDriverTimeoutException|Failed to connect to /127\.0\.0\.1:7001|dadb\.open\(|^WATCHDOG: Maestro driver did not connect' \
      "$MAESTRO_LOG" 2>/dev/null; then
      if grep -qE 'Running on |COMPLETED' "$MAESTRO_LOG" 2>/dev/null; then
        echo ""
        echo -e "${RED}❌ Maestro driver crashed mid-flow (see below for how far it got).${NC}"
        echo -e "${YELLOW}   Report/screenshots/hierarchy are preserved for debugging.${NC}"
        echo ""
      else
        DRIVER_STARTUP_FAILED=true
        echo ""
        echo -e "${RED}❌ Maestro driver failed to start — the test never ran.${NC}"
        echo -e "${YELLOW}   Skipping HTML report / Slack / artifact generation (nothing to report).${NC}"
        echo -e "${YELLOW}   See console output above for the underlying driver error.${NC}"
        echo ""
        # Remove the empty dated report directory so test-reports/ doesn't fill
        # up with useless folders for runs that never produced test output.
        if [ -n "${DATED_REPORT_DIR:-}" ] && [ -d "$DATED_REPORT_DIR" ]; then
          rm -rf "$DATED_REPORT_DIR" 2>/dev/null || true
        fi
      fi
    fi
  fi

  if [ "$FAIL_FAST" = "true" ] && [ "$TEST_EXIT_CODE" -ne 0 ]; then
    echo -e "${RED}💥 Fail-fast: stopping on first failure${NC}"
  fi

  # ──────────────────────────────────────────────────────────────────────────
  # Self-Heal: on failure, capture UI hierarchy and attempt to fix broken
  # element selectors in screen files before the maestro daemon is killed.
  # Activated by --heal or --heal-dry-run flags.
  # ──────────────────────────────────────────────────────────────────────────
  if [ "${RUN_HEAL:-false}" = "true" ] && [ "$TEST_EXIT_CODE" -ne 0 ] && [ "$DRIVER_STARTUP_FAILED" != "true" ]; then
    HEAL_AGENT="$SCRIPT_DIR/self-heal/heal-agent.js"
    if command -v node &>/dev/null && [ -f "$HEAL_AGENT" ]; then
      echo ""
      echo -e "${YELLOW}🔧 Self-Heal triggered (test failed)...${NC}"

      # Capture hierarchy while maestro driver is still alive
      HEAL_HIERARCHY="$DATED_REPORT_DIR/heal-hierarchy.json"
      maestro hierarchy > "$HEAL_HIERARCHY" 2>/dev/null || true

      HEAL_FLAGS="--test \"$TEST_PATH\" --log \"${MAESTRO_LOG:-/dev/null}\" --hierarchy \"$HEAL_HIERARCHY\" --platform \"$PLATFORM\""
      [ "${HEAL_DRY_RUN:-false}" = "true" ] && HEAL_FLAGS="$HEAL_FLAGS --dry-run"

      eval "node \"$HEAL_AGENT\" $HEAL_FLAGS" || true
      echo ""
    else
      echo -e "${YELLOW}⚠️  Self-heal skipped (node or heal-agent.js not found)${NC}"
    fi
  fi

  # Clean up temp preloaded flow file (if created by screen-preloader)
  # IMPORTANT: Normalize both paths to absolute for comparison to avoid deleting the original file
  # Use realpath if available (Linux), otherwise use Python for cross-platform compatibility
  if command -v realpath &>/dev/null; then
    TEST_PATH_ABS=$(realpath "$TEST_PATH" 2>/dev/null || echo "$TEST_PATH")
  elif command -v python3 &>/dev/null; then
    TEST_PATH_ABS=$(python3 -c "import os; print(os.path.abspath('$TEST_PATH'))" 2>/dev/null || echo "$TEST_PATH")
  else
    # Fallback to bash resolution (may not be perfect but safer than before)
    TEST_PATH_ABS="$(cd "$(dirname "$TEST_PATH")" 2>/dev/null && pwd)/$(basename "$TEST_PATH")"
  fi
  
  # Debug output (only if paths differ)
  if [ "$PRELOADED_TEST_PATH" != "$TEST_PATH_ABS" ]; then
    echo -e "${BLUE}Cleanup check:${NC}"
    echo -e "  Original: $TEST_PATH_ABS"
    echo -e "  Preloaded: $PRELOADED_TEST_PATH"
  fi
  
  # Only delete if:
  # 1. The preloaded path is different from the original
  # 2. The preloaded file exists
  # 3. The preloaded path is a temp file (contains .tmp_preloaded_ or is in /tmp/ or /var/folders/)
  if [ "$PRELOADED_TEST_PATH" != "$TEST_PATH_ABS" ] && \
     [ -f "$PRELOADED_TEST_PATH" ] && \
     [[ "$PRELOADED_TEST_PATH" == *"/.tmp_preloaded_"* || \
        "$PRELOADED_TEST_PATH" == *"/tmp/"* || \
        "$PRELOADED_TEST_PATH" == *"/var/folders/"* ]]; then
    echo -e "${GREEN}  ✓ Removing temp preloaded file: $(basename "$PRELOADED_TEST_PATH")${NC}"
    rm -f "$PRELOADED_TEST_PATH"
  elif [ "$PRELOADED_TEST_PATH" = "$TEST_PATH_ABS" ]; then
    echo -e "${YELLOW}  ⚠️  Skipping cleanup - preloaded path matches original (no temp file created)${NC}"
  else
    echo -e "${YELLOW}  ⚠️  Skipping cleanup - file not in temp directory or doesn't match temp pattern${NC}"
  fi

  # Stop background monitoring processes (kill entire process tree, not just outer subshell).
  # The while-true loops spawn child processes (node, sleep) that become orphaned
  # if only the subshell is killed, causing the script to hang waiting for them.
  if [ -n "$CAPTURE_PID" ]; then
    pkill -P "$CAPTURE_PID" 2>/dev/null || true
    kill "$CAPTURE_PID" 2>/dev/null || true
    wait "$CAPTURE_PID" 2>/dev/null || true
  fi
  if [ -n "$NETWORK_PID" ]; then
    pkill -P "$NETWORK_PID" 2>/dev/null || true
    kill "$NETWORK_PID" 2>/dev/null || true
    wait "$NETWORK_PID" 2>/dev/null || true
  fi
  if [ -n "${ANDROID_NET_PID:-}" ]; then
    pkill -P "$ANDROID_NET_PID" 2>/dev/null || true
    kill "$ANDROID_NET_PID" 2>/dev/null || true
    wait "$ANDROID_NET_PID" 2>/dev/null || true
  fi
  # Stop performance monitor (SIGTERM → writes final perf-samples.json)
  if [ -n "$PERF_MONITOR_PID" ]; then
    kill "$PERF_MONITOR_PID" 2>/dev/null || true
    wait "$PERF_MONITOR_PID" 2>/dev/null || true
    PERF_MONITOR_PID=""
  fi
  # Belt-and-suspenders: kill any orphaned inspector/monitor node processes
  pkill -f "android-ui-inspector.js" 2>/dev/null || true
  pkill -f "android-network-monitor.js" 2>/dev/null || true
  pkill -f "performance-monitor.js" 2>/dev/null || true

  # Stop screen recording and finalise video file
  if [ "$VIDEO_ENABLED" = "true" ] && [ -n "$VIDEO_RECORD_PID" ]; then
    # SIGINT is required so the encoder writes the MP4 trailer before exiting
    kill -SIGINT "$VIDEO_RECORD_PID" 2>/dev/null || true
    wait "$VIDEO_RECORD_PID" 2>/dev/null || true
    if [ "$PLATFORM" = "android" ] && [ -n "$DEVICE_VIDEO_PATH" ]; then
      sleep 1
      adb pull "$DEVICE_VIDEO_PATH" "$VIDEO_FILE" 2>/dev/null || true
      adb shell rm -f "$DEVICE_VIDEO_PATH" 2>/dev/null || true
    fi
    if [ -f "$VIDEO_FILE" ] && [ -s "$VIDEO_FILE" ]; then
      echo -e "${GREEN}✅ Video saved: $VIDEO_FILE${NC}"
    else
      echo -e "${YELLOW}⚠️  Video file not found or empty: $VIDEO_FILE${NC}"
      VIDEO_FILE=""
    fi
  fi
  
  # Synthesize a JUnit XML from the maestro log so the HTML report generator has the
  # data it needs without requiring --format junit (which breaks XCTest on iOS 26.2).
  synthesize_junit_xml() {
    local log_file="$1"
    local xml_file="$2"
    local test_name="$3"
    local exit_code="$4"
    local duration=0
    local failure_msg=""

    if [ -f "$log_file" ]; then
      # Parse duration from "Execution started/ended: YYYY-MM-DD HH:MM:SS" lines
      local t_start t_end
      t_start=$(grep -m1 'Execution started:' "$log_file" 2>/dev/null | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}')
      t_end=$(grep 'Execution ended:' "$log_file" 2>/dev/null | tail -1 | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}')
      if [ -n "$t_start" ] && [ -n "$t_end" ]; then
        local s1 s2
        s1=$(date -j -f "%Y-%m-%d %H:%M:%S" "$t_start" "+%s" 2>/dev/null || echo 0)
        s2=$(date -j -f "%Y-%m-%d %H:%M:%S" "$t_end" "+%s" 2>/dev/null || echo 0)
        duration=$((s2 - s1))
      fi
      # Fallback: use commands JSON timestamps if log parsing failed
      if [ "$duration" -eq 0 ]; then
        local commands_json
        commands_json=$(find "$(dirname "$xml_file")" -name "commands-*.json" 2>/dev/null | head -1)
        if [ -n "$commands_json" ] && [ -f "$commands_json" ]; then
          duration=$(python3 -c "
import json, sys
try:
    data = json.load(open('$commands_json'))
    if isinstance(data, list) and len(data) > 1:
        timestamps = [i['metadata']['timestamp'] for i in data if 'metadata' in i and 'timestamp' in i['metadata']]
        if timestamps:
            print(round((max(timestamps) - min(timestamps)) / 1000))
        else:
            print(0)
except:
    print(0)
" 2>/dev/null || echo 0)
        fi
      fi

      # Check for assertion failures in log (even if exit code is 0 due to CONTINUE_ON_FAILURE)
      failure_msg=$(grep -m1 -E 'Assertion is false|CommandFailed|Element not found|not found:|FAILED|failed' "$log_file" 2>/dev/null \
        | sed 's/^\[[^]]*\] //' | head -c 500 || echo "")
    fi

    local failures=0
    # Mark as failure if: exit code is non-zero OR assertion failure found in log
    if [ "$exit_code" -ne 0 ] || [ -n "$failure_msg" ]; then
      failures=1
      # If no failure message from exit code, use the one from log
      if [ -z "$failure_msg" ] && [ "$exit_code" -ne 0 ]; then
        failure_msg="Test failed with exit code $exit_code"
      fi
    fi
    
    local failure_block=""
    if [ $failures -eq 1 ]; then
      failure_msg_escaped=$(echo "$failure_msg" | sed 's/&/\&amp;/g; s/</\&lt;/g; s/>/\&gt;/g; s/"/\&quot;/g')
      failure_block="<failure message=\"${failure_msg_escaped}\">$failure_msg_escaped</failure>"
    fi

    cat > "$xml_file" <<XML
<?xml version="1.0" encoding="UTF-8"?>
<testsuites>
  <testsuite name="${test_name}" tests="1" failures="${failures}" time="${duration}">
    <testcase name="${test_name}" classname="MaestroUITests" time="${duration}">${failure_block}</testcase>
  </testsuite>
</testsuites>
XML
  }

  if [ "$DRIVER_STARTUP_FAILED" != "true" ]; then
    MAESTRO_LOG_FOR_XML="$LOGS_DIR/maestro-test.log"
    [ ! -f "$MAESTRO_LOG_FOR_XML" ] && MAESTRO_LOG_FOR_XML=""
    synthesize_junit_xml "$MAESTRO_LOG_FOR_XML" "$RESULTS_FILE" "$(basename "$TEST_PATH" .yaml)" "$TEST_EXIT_CODE"
  fi
  
  # Move Maestro output files from timestamped subfolder to correct locations
  # Maestro creates a subfolder like "2026-03-10_111147" inside test-output-dir
  MAESTRO_TIMESTAMP_FOLDER=$(find "$DATED_REPORT_DIR" -maxdepth 1 -type d -name "????-??-??_??????" 2>/dev/null | head -1)
  if [ -n "$MAESTRO_TIMESTAMP_FOLDER" ] && [ -d "$MAESTRO_TIMESTAMP_FOLDER" ]; then
    #echo "Moving Maestro output files from timestamped subfolder..."
    
    # Move screenshots to screenshots directory
    if [ -d "$MAESTRO_TIMESTAMP_FOLDER" ]; then
      find "$MAESTRO_TIMESTAMP_FOLDER" -maxdepth 1 -type f \( -name "*.png" -o -name "*.jpg" -o -name "*.jpeg" \) -exec mv {} "$SCREENSHOTS_DIR/" \; 2>/dev/null || true
      find "$MAESTRO_TIMESTAMP_FOLDER" -maxdepth 1 -type f -name "*.json" -exec mv {} "$DATED_REPORT_DIR/" \; 2>/dev/null || true
      find "$MAESTRO_TIMESTAMP_FOLDER" -maxdepth 1 -type f -name "*.html" -exec mv {} "$DATED_REPORT_DIR/" \; 2>/dev/null || true
    fi
    
    # Remove the empty timestamped subfolder
    rmdir "$MAESTRO_TIMESTAMP_FOLDER" 2>/dev/null || true
  fi
  
  # Log test results
  if [ "$ENABLE_LOGGING" = "true" ]; then
    {
      echo ""
      echo "═══════════════════════════════════════════════════════════"
      if [ $TEST_EXIT_CODE -eq 0 ]; then
        echo "Test Result: ✓ PASSED"
      else
        echo "Test Result: ✗ FAILED (Exit Code: $TEST_EXIT_CODE)"
      fi
      echo "Execution ended: $(date '+%Y-%m-%d %H:%M:%S')"
      echo "═══════════════════════════════════════════════════════════"
    } >> "$MAESTRO_LOG"
  fi
  
  # ── Post-test data extraction ─────────────────────────────────────────────
  # Log-based extractors (a11y, perf timing) only read from disk — start them
  # in the background immediately so they overlap with the device-dependent
  # hierarchy captures that run next. Wait for all before generating reports.
  _POSTTEST_PIDS=()
  _MAESTRO_DEBUG_LOG=$(find "$DATED_REPORT_DIR/debug/.maestro/tests" -type f -name "maestro.log" 2>/dev/null | head -1)

  # a11y log extractor (background) — reads maestro.log, writes hierarchies/
  if [ "$RUN_A11Y" = "true" ] && [ "$PLATFORM" = "ios" ] && \
     [ -n "$_MAESTRO_DEBUG_LOG" ] && [ -f "$_MAESTRO_DEBUG_LOG" ]; then
    echo -e "${BLUE}📋 Extracting per-screen a11y elements from debug log...${NC}"
    node "$SCRIPT_DIR/utils/ui-capture/a11y-extract-from-log.js" \
      "$_MAESTRO_DEBUG_LOG" "$HIERARCHIES_DIR" "$(basename "$TEST_PATH" .yaml)" 2>/dev/null &
    _POSTTEST_PIDS+=($!)
  fi

  # Perf log extractor (background) — reads maestro.log, writes performance/
  if [ "$RUN_PERF" = "true" ] && [ -n "$_MAESTRO_DEBUG_LOG" ] && [ -f "$_MAESTRO_DEBUG_LOG" ]; then
    _PERF_DIR="$DATED_REPORT_DIR/performance"
    mkdir -p "$_PERF_DIR"
    node "$SCRIPT_DIR/utils/performance/perf-extract-from-log.js" \
      "$_MAESTRO_DEBUG_LOG" "$_PERF_DIR" 2>/dev/null &
    _POSTTEST_PIDS+=($!)
  fi

  # Capture hierarchy on failure while device is still running (needs live device)
  if [ $TEST_EXIT_CODE -ne 0 ]; then
    echo "Capturing device element hierarchy..."
    node "$SCRIPT_DIR/utils/ui-capture/capture-hierarchy-on-failure.js" "$(basename "$TEST_PATH" .yaml)" "failure_step" "$DATED_REPORT_DIR" "$PLATFORM" 2>/dev/null || true
  fi

  # Capture per-screen runtime hierarchies from Maestro debug log (needs live device).
  _HAS_RUNTIME_CAPTURE=$(find "$HIERARCHIES_DIR" -maxdepth 1 -type f -name '*_runtime_*.json' -print -quit 2>/dev/null)
  if [ -z "$_HAS_RUNTIME_CAPTURE" ] && [ -n "$_MAESTRO_DEBUG_LOG" ] && [ -f "$_MAESTRO_DEBUG_LOG" ]; then
    grep 'JsConsole: DEBUG: Stored screen name as:' "$_MAESTRO_DEBUG_LOG" 2>/dev/null | \
      sed 's/.*JsConsole: DEBUG: Stored screen name as: //' | \
      awk 'NF' | \
      sort -u | \
      while IFS= read -r _RUNTIME_SCREEN_NAME; do
        _RUNTIME_SCREEN_SLUG=$(echo "$_RUNTIME_SCREEN_NAME" | tr -cd 'a-zA-Z0-9 _-' | tr ' ' '_')
        if [ -n "$_RUNTIME_SCREEN_SLUG" ]; then
          node "$SCRIPT_DIR/utils/ui-capture/capture-hierarchy-on-failure.js" "$_RUNTIME_SCREEN_SLUG" "runtime" "$DATED_REPORT_DIR" "$PLATFORM" >/dev/null 2>&1 || true
        fi
      done
  fi

  # Fallback: if a11y log extraction produced nothing, capture final device state.
  if [ "$PLATFORM" = "ios" ] && [ "$RUN_A11Y" = "true" ]; then
    # Wait for background a11y extractor before checking the count
    for _pid in "${_POSTTEST_PIDS[@]}"; do wait "$_pid" 2>/dev/null || true; done
    _POSTTEST_PIDS=()
    _HIERARCHY_COUNT=$(find "$HIERARCHIES_DIR" -maxdepth 1 -type f -name '*.json' 2>/dev/null | wc -l | tr -d ' ')
    if [ "${_HIERARCHY_COUNT:-0}" -eq 0 ]; then
      echo "Capturing final-state hierarchy for a11y validation (fallback)..."
      node "$SCRIPT_DIR/utils/ui-capture/capture-hierarchy-on-failure.js" "$(basename "$TEST_PATH" .yaml)" "final_state" "$DATED_REPORT_DIR" "$PLATFORM" 2>/dev/null || true
    fi
  fi

  # Wait for any remaining background extractors before generating reports
  for _pid in "${_POSTTEST_PIDS[@]}"; do wait "$_pid" 2>/dev/null || true; done
  _POSTTEST_PIDS=()

  # Capture simulator screenshot while device is still running (iOS only)
  # Respects REPORTS_SCREENSHOT_ON_SUCCESS and REPORTS_SCREENSHOT_ON_FAILURE settings
  if [ "$PLATFORM" = "ios" ]; then
    _SIM_UDID=$(get_booted_sim_udid)
    if [ -n "$_SIM_UDID" ]; then
      _STATUS_LABEL="pass"
      _SHOULD_SCREENSHOT="$REPORTS_SCREENSHOT_ON_SUCCESS"
      if [ $TEST_EXIT_CODE -ne 0 ]; then
        _STATUS_LABEL="fail"
        _SHOULD_SCREENSHOT="$REPORTS_SCREENSHOT_ON_FAILURE"
      fi

      # Only take screenshot if enabled for this status
      if [ "$_SHOULD_SCREENSHOT" = "true" ]; then
        _SCREENSHOT_FILE="$SCREENSHOTS_DIR/screenshot_${_STATUS_LABEL}_$(date '+%Y%m%d_%H%M%S').png"
        xcrun simctl io "$_SIM_UDID" screenshot "$_SCREENSHOT_FILE" 2>/dev/null && \
          echo "📸 Screenshot saved: $(basename "$_SCREENSHOT_FILE")" || true
      fi
    fi
  fi

  # Kill Maestro daemon after every test (pass or fail) to prevent stale
  # port-7001 connections on subsequent runs.
  echo -e "${BLUE}Stopping Maestro daemon...${NC}"
  kill_maestro_daemon
  if [ "$NETWORK_CAPTURE" = "true" ]; then
    echo ""
    echo -e "${BLUE}Stopping network capture and parsing logs...${NC}"
    
    # Stop the network capture process
    if [ -f "$DATED_REPORT_DIR/network/capture.pid" ]; then
      NETWORK_LOG_PID=$(cat "$DATED_REPORT_DIR/network/capture.pid")
      if ps -p "$NETWORK_LOG_PID" > /dev/null 2>&1; then
        kill "$NETWORK_LOG_PID" 2>/dev/null || true
        sleep 1
      fi
      rm -f "$DATED_REPORT_DIR/network/capture.pid"
    fi

    # Reset log privacy and diagnostics env var so normal simulator behavior is restored
    if [ -n "${DEVICE_ID:-}" ]; then
      xcrun simctl spawn "$DEVICE_ID" log config \
        --subsystem com.apple.CFNetwork \
        --mode private_data:reset 2>/dev/null || true
      xcrun simctl spawn "$DEVICE_ID" log config \
        --subsystem com.apple.network \
        --mode private_data:reset 2>/dev/null || true
      xcrun simctl spawn "$DEVICE_ID" launchctl unsetenv CFNETWORK_DIAGNOSTICS 2>/dev/null || true
    fi
    
    # Parse the captured network logs to JSON
    if [ -f "$DATED_REPORT_DIR/network/simulator-network.log" ]; then
      node "$SCRIPT_DIR/network/parse-simulator-logs.js" \
        "$DATED_REPORT_DIR/network/simulator-network.log" \
        "$DATED_REPORT_DIR/network/api-calls.json" 2>/dev/null || {
        # If parsing fails, create empty api-calls.json
        echo '{"timestamp":"'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'","summary":{"totalCalls":0,"successfulCalls":0,"failedCalls":0,"avgResponseTime":0},"calls":[]}' > "$DATED_REPORT_DIR/network/api-calls.json"
      }
    else
      # No logs captured, create empty api-calls.json
      echo '{"timestamp":"'$(date -u +"%Y-%m-%dT%H:%M:%SZ")'","summary":{"totalCalls":0,"successfulCalls":0,"failedCalls":0,"avgResponseTime":0},"calls":[]}' > "$DATED_REPORT_DIR/network/api-calls.json"
    fi
    
    echo -e "${GREEN}✅ Network capture complete${NC}"
  fi
  
  # Parse network calls only when explicitly requested.
  if [ "$NETWORK_CAPTURE" = "true" ]; then
    if command -v node &> /dev/null; then
      # Use new unified parser for iOS and Android
      if [ -f "$SCRIPT_DIR/network/parse-network-logs.js" ]; then
        echo ""
        echo -e "${BLUE}Parsing network logs...${NC}"
        node "$SCRIPT_DIR/network/parse-network-logs.js" "$DATED_REPORT_DIR" || {
          echo -e "${YELLOW}⚠️  Failed to parse network logs${NC}"
        }
      else
        # Fallback to legacy parser
        node "$SCRIPT_DIR/network/capture-network-logs.js" "$DATED_REPORT_DIR" "$(basename "$TEST_PATH" .yaml)" 2>/dev/null || true
      fi
    fi
  fi
  
  # Extract network calls from app's built-in debugger
  if [ "$NETWORK_DEBUGGER" = "true" ]; then
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║  Extracting Network Calls from App Debugger               ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    
    # Run Node.js script to extract app internal logs
    EXTRACT_SCRIPT="$SCRIPT_DIR/network/extract-app-internal-logs.js"
    
    if [ -f "$EXTRACT_SCRIPT" ]; then
      echo -e "${BLUE}Extracting network calls from app internal logs...${NC}"
      
      # Run the extraction script directly with Node.js
      node "$EXTRACT_SCRIPT" "$DATED_REPORT_DIR" "$APP_ID" 2>&1 | tee "$DATED_REPORT_DIR/network/debugger-extraction.log" || {
        echo -e "${YELLOW}⚠️  App internal log extraction failed (non-fatal)${NC}"
        echo -e "${YELLOW}   Check log: $DATED_REPORT_DIR/network/debugger-extraction.log${NC}"
      }
      
      # Merge app internal calls with iOS logs if both exist
      if [ -f "$DATED_REPORT_DIR/network/app-internal-calls.json" ]; then
        echo ""
        echo -e "${BLUE}Merging app internal calls with network logs...${NC}"
        
        # Use Node.js to merge app-internal-calls.json with api-calls.json
        node -e "
          const fs = require('fs');
          const path = require('path');
          
          const networkDir = '$DATED_REPORT_DIR/network';
          const appInternalFile = path.join(networkDir, 'app-internal-calls.json');
          const apiCallsFile = path.join(networkDir, 'api-calls.json');
          
          try {
            // Read app internal calls
            const appInternalData = JSON.parse(fs.readFileSync(appInternalFile, 'utf8'));
            const appInternalCalls = appInternalData.calls || [];
            
            // Read existing api-calls.json (from iOS logs) or create empty
            let iosLogCalls = [];
            if (fs.existsSync(apiCallsFile)) {
              const iosData = JSON.parse(fs.readFileSync(apiCallsFile, 'utf8'));
              iosLogCalls = iosData.calls || [];
            }
            
            // Merge: prioritize app internal calls (have full URLs)
            const mergedCalls = [...appInternalCalls, ...iosLogCalls];
            
            // Remove duplicates based on URL and status
            const uniqueCalls = [];
            const seen = new Set();
            for (const call of mergedCalls) {
              const key = \`\${call.method}-\${call.url}-\${call.status}\`;
              if (!seen.has(key)) {
                seen.add(key);
                uniqueCalls.push(call);
              }
            }
            
            // Update summary
            const summary = {
              totalCalls: uniqueCalls.length,
              successfulCalls: uniqueCalls.filter(c => c.status >= 200 && c.status < 300).length,
              failedCalls: uniqueCalls.filter(c => c.status >= 400).length,
              avgResponseTime: uniqueCalls.length > 0
                ? Math.round(uniqueCalls.reduce((sum, c) => sum + (c.responseTime || 0), 0) / uniqueCalls.length)
                : 0
            };
            
            // Save merged data
            const finalData = {
              timestamp: new Date().toISOString(),
              source: 'app-internal-logs-and-network-logs',
              summary,
              calls: uniqueCalls
            };
            
            fs.writeFileSync(apiCallsFile, JSON.stringify(finalData, null, 2));
            
            console.log(\`✅ Merged network calls:\`);
            console.log(\`   App internal logs: \${appInternalCalls.length} calls\`);
            console.log(\`   iOS network logs: \${iosLogCalls.length} calls\`);
            console.log(\`   Total unique: \${uniqueCalls.length} calls\`);
          } catch (error) {
            console.error(\`⚠️  Failed to merge network calls: \${error.message}\`);
          }
        " || {
          echo -e "${YELLOW}⚠️  Failed to merge network calls${NC}"
        }
      else
        echo -e "${YELLOW}⚠️  No app internal calls found${NC}"
        echo -e "${YELLOW}   The app may not be logging network calls in DEBUG builds${NC}"
      fi
    else
      echo -e "${YELLOW}⚠️  Extraction script not found: $EXTRACT_SCRIPT${NC}"
      echo -e "${YELLOW}   Skipping app internal log extraction${NC}"
    fi
    
    echo ""
  fi
  
  # ──────────────────────────────────────────────────────────────────────────
  # Capture environment metadata for the HTML report (env-info.json).
  # All commands are error-tolerant — failures here must never fail the run.
  # ──────────────────────────────────────────────────────────────────────────
  if [ "$DRIVER_STARTUP_FAILED" != "true" ]; then
    _META_DIR="$DATED_REPORT_DIR/meta"
    mkdir -p "$_META_DIR" 2>/dev/null || true

    _DEVICE_NAME="Unknown"
    _OS_VERSION="Unknown"
    _APP_VERSION="Unknown"
    _BUILD_NUMBER="Unknown"

    if [ "$PLATFORM" = "ios" ]; then
      _SIM_INFO=$(xcrun simctl list devices booted --json 2>/dev/null)
      if [ -n "$_SIM_INFO" ]; then
        _DEVICE_NAME=$(echo "$_SIM_INFO" | python3 -c "
import sys, json
data = json.load(sys.stdin)
for runtime, devices in data.get('devices', {}).items():
    for d in devices:
        if d.get('state') == 'Booted':
            print(d.get('name', 'Unknown'))
            break
    else:
        continue
    break
" 2>/dev/null || echo "Unknown")
        _OS_VERSION=$(echo "$_SIM_INFO" | python3 -c "
import sys, json, re
data = json.load(sys.stdin)
for runtime, devices in data.get('devices', {}).items():
    for d in devices:
        if d.get('state') == 'Booted':
            m = re.search(r'iOS-(\d+-\d+)', runtime)
            print(m.group(1).replace('-', '.') if m else runtime.split('.')[-1])
            break
    else:
        continue
    break
" 2>/dev/null | sed 's/com.apple.CoreSimulator.SimRuntime.iOS-/iOS /;s/-/./g' || echo "Unknown")
      fi
      # Use DEVICE_ID if set, otherwise fall back to the booted simulator
      _VER_UDID="${DEVICE_ID:-$(xcrun simctl list devices booted 2>/dev/null | grep -oE '[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}' | head -1)}"
      if [ -n "$_VER_UDID" ]; then
        _APP_CONTAINER=$(xcrun simctl get_app_container "$_VER_UDID" "$APP_ID" app 2>/dev/null)
        # If APP_ID lookup failed, scan all installed non-Apple apps and pick the first match
        if [ -z "$_APP_CONTAINER" ]; then
          _INSTALLED_BID=$(xcrun simctl listapps "$_VER_UDID" 2>/dev/null \
            | grep -E '^\s+"com\.' | grep -v '"com\.apple\.' \
            | head -1 | sed 's/.*"\(com\.[^"]*\)".*/\1/')
          if [ -n "$_INSTALLED_BID" ]; then
            _APP_CONTAINER=$(xcrun simctl get_app_container "$_VER_UDID" "$_INSTALLED_BID" app 2>/dev/null)
          fi
        fi
        if [ -n "$_APP_CONTAINER" ]; then
          _APP_VERSION=$(defaults read "$_APP_CONTAINER/Info" CFBundleShortVersionString 2>/dev/null || echo "Unknown")
          _BUILD_NUMBER=$(defaults read "$_APP_CONTAINER/Info" CFBundleVersion 2>/dev/null || echo "Unknown")
        fi
      fi
    elif [ "$PLATFORM" = "android" ]; then
      _DEVICE_NAME=$(adb shell getprop ro.product.model 2>/dev/null | tr -d '\r' || echo "Unknown")
      _OS_VERSION="Android $(adb shell getprop ro.build.version.release 2>/dev/null | tr -d '\r' || echo 'Unknown')"
      _APP_VERSION=$(adb shell dumpsys package "$APP_ID" 2>/dev/null | grep versionName | head -1 | sed 's/.*versionName=//' | tr -d '\r ' || echo "Unknown")
      _BUILD_NUMBER=$(adb shell dumpsys package "$APP_ID" 2>/dev/null | grep versionCode | head -1 | sed 's/.*versionCode=//' | awk '{print $1}' | tr -d '\r' || echo "Unknown")
    fi

    cat > "$_META_DIR/env-info.json" << EOF
{
  "device": "${_DEVICE_NAME}",
  "os": "${_OS_VERSION}",
  "appVersion": "${_APP_VERSION}",
  "buildNumber": "${_BUILD_NUMBER}",
  "platform": "${PLATFORM}"
}
EOF

    # ──────────────────────────────────────────────────────────────────────
    # Append to run history for trend tracking ($REPORT_DIR/run-history.json)
    # ──────────────────────────────────────────────────────────────────────
    _HISTORY_FILE="$REPORT_DIR/run-history.json"
    _RUN_TOTAL=1
    _RUN_PASSED=$( [ $TEST_EXIT_CODE -eq 0 ] && echo 1 || echo 0 )
    _RUN_FAILED=$( [ $TEST_EXIT_CODE -ne 0 ] && echo 1 || echo 0 )

    if [ -f "$RESULTS_FILE" ] && command -v python3 &>/dev/null; then
      _PARSED=$(python3 -c "
import sys, re
try:
    content = open('$RESULTS_FILE').read()
    tests = len(re.findall(r'<testcase\b', content))
    failures = len(re.findall(r'<failure\b', content))
    print(f'{tests} {failures}')
except:
    print('1 0')
" 2>/dev/null)
      _RUN_TOTAL=$(echo "$_PARSED" | awk '{print $1}')
      _RUN_FAILED=$(echo "$_PARSED" | awk '{print $2}')
      _RUN_PASSED=$(( _RUN_TOTAL - _RUN_FAILED ))
    fi

    _FLOW_NAME=$(basename "$TEST_PATH" .yaml)
    _RUN_DATE=$(date '+%Y-%m-%d %H:%M:%S')
    _REPORT_ID=$(basename "$DATED_REPORT_DIR")
    _DURATION_SECS=$(( $(date +%s) - ${_TEST_START_TIME:-$(date +%s)} ))

    _NEW_ENTRY="{\"date\":\"$_RUN_DATE\",\"flowName\":\"$_FLOW_NAME\",\"total\":$_RUN_TOTAL,\"passed\":$_RUN_PASSED,\"failed\":$_RUN_FAILED,\"durationSecs\":$_DURATION_SECS,\"platform\":\"$PLATFORM\",\"reportId\":\"$_REPORT_ID\"}"

    python3 -c "
import json, sys
history_file = '$_HISTORY_FILE'
new_entry = $_NEW_ENTRY
try:
    with open(history_file) as f:
        history = json.load(f)
    if not isinstance(history, list):
        history = []
except:
    history = []
history.append(new_entry)
history = history[-50:]  # keep last 50
with open(history_file, 'w') as f:
    json.dump(history, f, indent=2)
" 2>/dev/null || true
  fi

  # Generate HTML report even if tests failed — but NOT when the driver never
  # started (nothing to report on; console shows the underlying error).
  if [ "$DRIVER_STARTUP_FAILED" = "true" ]; then
    :  # skip HTML/pulse/a11y reports entirely
  elif [ -f "$RESULTS_FILE" ]; then
    if command -v node &> /dev/null; then
      # Build flag list for the report generator (--pulse / --a11y are optional)
      REPORT_FLAGS=""
      [ "$RUN_PULSE"       = "true" ] && REPORT_FLAGS="$REPORT_FLAGS --pulse"
      [ "$RUN_A11Y"        = "true" ] && REPORT_FLAGS="$REPORT_FLAGS --a11y"
      [ "$NETWORK_CAPTURE" = "true" ] && REPORT_FLAGS="$REPORT_FLAGS --network-capture"

      # shellcheck disable=SC2086
      node "$SCRIPT_DIR/reporting/generate-unified-report.js" \
        "$RESULTS_FILE" \
        "$REPORT_FILE" \
        "$PLATFORM" \
        "${VIDEO_FILE:-}" \
        $REPORT_FLAGS || {
        echo -e "${YELLOW}⚠️  Failed to generate HTML report${NC}"
      }
      
      if [ -f "$REPORT_FILE" ]; then
        echo -e "${GREEN}✓ Report generated: $REPORT_FILE${NC}"
        
        # Open report in browser if not suppressed
        if [ "$NO_BROWSER" = "false" ]; then
          echo ""
          echo -e "${BLUE}Opening report...${NC}"
          open "$REPORT_FILE"
        fi
      fi
    else
      echo -e "${YELLOW}⚠️  Node.js not found, skipping HTML report generation${NC}"
    fi
  else
    echo -e "${YELLOW}⚠️  No test results file found at $RESULTS_FILE${NC}"
  fi
  
  # Open standalone accessibility report if --a11y was set
  if [ "$RUN_A11Y" = "true" ]; then
    A11Y_REPORT="$DATED_REPORT_DIR/accessibility-report.html"
    if [ -f "$A11Y_REPORT" ]; then
      echo ""
      echo -e "${GREEN}✓ Accessibility report: $A11Y_REPORT${NC}"
      if [ "$NO_BROWSER" = "false" ]; then
        echo -e "${BLUE}Opening accessibility report...${NC}"
        open "$A11Y_REPORT"
      fi
    else
      echo -e "${YELLOW}⚠️  Accessibility report not found (no hierarchy data captured)${NC}"
    fi
  fi

  # Open standalone Pulse report if --pulse was set
  if [ "$RUN_PULSE" = "true" ]; then
    PULSE_REPORT="$DATED_REPORT_DIR/pulse-report.html"
    if [ -f "$PULSE_REPORT" ]; then
      echo ""
      echo -e "${GREEN}✓ Pulse report: $PULSE_REPORT${NC}"
      if [ "$NO_BROWSER" = "false" ]; then
        echo -e "${BLUE}Opening Pulse report...${NC}"
        open "$PULSE_REPORT"
      fi
    else
      echo -e "${YELLOW}⚠️  Pulse report not found (no hierarchy data captured)${NC}"
    fi
  fi
  
  # Run performance analysis if --perf flag is set
  if [ "$RUN_PERF" = "true" ]; then
    echo ""
    echo -e "${BLUE}⚡ Running performance analysis...${NC}"
    if command -v node &> /dev/null; then
      _PERF_DIR="$DATED_REPORT_DIR/performance"
      mkdir -p "$_PERF_DIR"

      # Step 1 (timing extraction) already ran in background earlier — nothing to do here.

      # Step 2: Generate combined performance report (JSON + HTML)
      node "$SCRIPT_DIR/testing/run-performance-tests.js" \
        "$(basename "$TEST_PATH" .yaml)" \
        "$DATED_REPORT_DIR" \
        "$PLATFORM" || {
        echo -e "${YELLOW}⚠️  Performance analysis completed with warnings${NC}"
      }

      # Step 3: Surface the report path
      _PERF_HTML="$_PERF_DIR/performance-report.html"
      if [ -f "$_PERF_HTML" ]; then
        echo -e "${GREEN}✓ Performance report: $_PERF_HTML${NC}"
        if [ "${OPEN_REPORT:-true}" = "true" ] && command -v open &>/dev/null; then
          open "$_PERF_HTML" 2>/dev/null || true
        fi
      fi
    else
      echo -e "${YELLOW}⚠️  Node.js not found, skipping performance analysis${NC}"
    fi
  fi
  
  
  # Cleanup old reports after generating new report
  cleanup_old_reports

  # Send Slack notification (non-blocking — never fails the test pipeline).
  # Suppress on driver-startup failures: the test never ran, so notifying is noise.
  if [ "$RUN_SLACK" = "true" ] && [ "$DRIVER_STARTUP_FAILED" != "true" ] && command -v node &>/dev/null; then
    _SLACK_STATUS=$( [ $TEST_EXIT_CODE -eq 0 ] && echo "passed" || echo "failed" )
    _SLACK_PASS=$( [ $TEST_EXIT_CODE -eq 0 ] && echo 1 || echo 0 )
    _SLACK_FAIL=$( [ $TEST_EXIT_CODE -ne 0 ] && echo 1 || echo 0 )
    node "$SCRIPT_DIR/integrations/slack/slack-notify.js" \
      --status      "$_SLACK_STATUS" \
      --test-name   "$(basename "$TEST_PATH" .yaml | tr '_' ' ')" \
      --platform    "$PLATFORM" \
      --app         "${APP_NAME:-}" \
      --environment "${ENVIRONMENT:-qa}" \
      --total       1 \
      --passed      "$_SLACK_PASS" \
      --failed      "$_SLACK_FAIL" \
      --duration-seconds "$SECONDS" \
      --report-path "$REPORT_FILE" 2>/dev/null || true
  fi

  echo ""
  echo -e "${GREEN}✓ Tests completed${NC}"

  # Exit with test exit code after report generation
  if [ $TEST_EXIT_CODE -ne 0 ]; then
    exit $TEST_EXIT_CODE
  fi
else
  export MAESTRO_DRIVER_STARTUP_TIMEOUT=${MAESTRO_DRIVER_STARTUP_TIMEOUT:-240000}
  mkdir -p "$MAESTRO_LOG_ROOT" 2>/dev/null || true
  $MAESTRO_BIN test --platform "$PLATFORM" "$TEST_PATH" \
  --env APP_ID="$APP_ID" || {
    echo -e "${RED}❌ Tests failed${NC}"
  }
  # Kill daemon even in no-report mode
  kill_maestro_daemon
fi

echo ""
echo -e "${GREEN}✓ Test run complete${NC}"
