#!/bin/bash
# reset-app-state.sh — shared app state reset utility
#
# Usage: bash scripts/utils/state-management/reset-app-state.sh <platform> <app_id>
#
# Called by test.sh and run-test-suite.sh before every test.
# Both platforms use clearState: false in Maestro (clearState: true breaks
# iOS port-7001). This script handles the external data wipe instead.
#
# iOS:     Wipes simctl data container, re-grants permissions, pre-launches.
# Android: Wipes data via run-as (debuggable builds) or pm clear fallback.
#          Does NOT use pm clear as the primary method — it causes blank white
#          screens on Compose/WebView apps. run-as deletes only the data
#          directories, leaving the package intact so Compose initializes cleanly.

set -euo pipefail

PLATFORM="${1:-ios}"
APP_ID="${2:-}"
DEVICE_ID="${3:-}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

if [ -z "$APP_ID" ]; then
  echo -e "${RED}Usage: $0 <ios|android> <app_id> [device_id]${NC}" >&2
  exit 1
fi

# ─────────────────────────────────────────────────────────────────────────────
# iOS
# ─────────────────────────────────────────────────────────────────────────────
reset_ios() {
  local sim_udid="$DEVICE_ID"
  
  # If no device specified, find the booted simulator
  if [ -z "$sim_udid" ]; then
    sim_udid=$(xcrun simctl list devices 2>/dev/null | grep "(Booted)" | \
      grep -E -o '[0-9A-F-]{36}' | head -1)
  fi

  if [ -z "$sim_udid" ]; then
    echo -e "${YELLOW}⚠️  No booted iOS simulator — skipping app state reset${NC}"
    return 0
  fi

  echo -e "${BLUE}Resetting iOS app state: $APP_ID${NC}"

  # 1. Terminate the running app
  xcrun simctl terminate "$sim_udid" "$APP_ID" 2>/dev/null || true
  sleep 0.3

  # 2. Wipe the data container (removes UserDefaults, Keychain sandbox, caches)
  #    This is the crucial step — clearState: false in Maestro does NOT do this.
  local container
  container=$(xcrun simctl get_app_container "$sim_udid" "$APP_ID" data 2>/dev/null || true)
  if [ -n "$container" ] && [ -d "$container" ]; then
    find "$container" -mindepth 1 -maxdepth 1 -exec rm -rf {} + 2>/dev/null || true
    echo -e "${GREEN}  ✓ Data container wiped${NC}"
  else
    echo -e "${YELLOW}  ⚠️  Data container not found (app may not be installed yet)${NC}"
  fi

  # 3. Re-grant permissions — data wipe resets TCC entries for this app
  if command -v applesimutils &>/dev/null; then
    applesimutils --byId "$sim_udid" --bundle "$APP_ID" \
      --setPermissions "location=always,camera=YES,microphone=YES,notifications=YES,bluetooth=YES" \
      2>/dev/null && echo -e "${GREEN}  ✓ Permissions granted via applesimutils${NC}" || true
  else
    xcrun simctl privacy "$sim_udid" grant location-always "$APP_ID" 2>/dev/null || true
    xcrun simctl privacy "$sim_udid" grant camera          "$APP_ID" 2>/dev/null || true
    xcrun simctl privacy "$sim_udid" grant microphone      "$APP_ID" 2>/dev/null || true
    # Patch location to Authorization=3 (Always Allow) — xcrun sets 4 (When In Use)
    # which shows an upgrade dialog that disconnects the XCTest driver on iOS 26.x
    local grant_script
    grant_script="$(dirname "$0")/grant-location-always.py"
    if [ -f "$grant_script" ] && command -v python3 &>/dev/null; then
      python3 "$grant_script" "$sim_udid" "$APP_ID" 2>/dev/null \
        && echo -e "${GREEN}  ✓ Location Always Allow patched${NC}" || true
    fi
  fi

  # 4. Re-grant clipboard (prevents "Allow Paste" alert during tests)
  local tcc_db="$HOME/Library/Developer/CoreSimulator/Devices/$sim_udid/data/Library/TCC/TCC.db"
  if [ -f "$tcc_db" ]; then
    sqlite3 "$tcc_db" \
      "INSERT OR REPLACE INTO access
         (service, client, client_type, auth_value, auth_reason, auth_version)
       VALUES ('kTCCServicePasteboard', '$APP_ID', 0, 2, 4, 1);" \
      2>/dev/null && echo -e "${GREEN}  ✓ Clipboard permission granted${NC}" || true
  fi

  # 5. Pre-launch the app so Maestro's XCTest driver connects to a running process.
  #    On iOS 26 + Maestro 2.3.0, launchApp: from YAML kills and relaunches the app
  #    which would break port-7001. By pre-launching here, the XCTest driver connects
  #    to the already-running app; launchApp: clearState: false just restarts it without
  #    reinstalling, so the driver stays connected.
  xcrun simctl launch "$sim_udid" "$APP_ID" 2>/dev/null \
    && echo -e "${GREEN}  ✓ App pre-launched${NC}" || true
  sleep 2   # let the app reach its first screen before Maestro connects

  echo -e "${GREEN}✓ iOS state reset complete${NC}"
}

# ─────────────────────────────────────────────────────────────────────────────
# Android
# ─────────────────────────────────────────────────────────────────────────────
reset_android() {
  local android_device_id="$DEVICE_ID"
  
  # If no device specified, find the first connected device
  if [ -z "$android_device_id" ]; then
    android_device_id=$(adb devices 2>/dev/null | grep -v "List of devices" | grep "device$" | awk '{print $1}' | head -1)
  fi
  
  if [ -z "$android_device_id" ]; then
    echo -e "${YELLOW}⚠️  No Android device/emulator connected — skipping app state reset${NC}"
    return 0
  fi

  echo -e "${BLUE}Resetting Android app state: $APP_ID (device: $android_device_id)${NC}"

  # 1. Force-stop the app
  adb -s "$android_device_id" shell am force-stop "$APP_ID" 2>/dev/null || true
  echo -e "${GREEN}  ✓ App force-stopped${NC}"

  # 2. Wipe app data directories via run-as (debuggable builds).
  #    Unlike pm clear, this preserves the package registration and native
  #    library cache, so Compose/WebView initializes cleanly on next launch
  #    instead of showing a blank white screen.
  #
  #    IMPORTANT: The entire "run-as … sh -c '…'" must be wrapped in double
  #    quotes so adb shell receives it as a single string.  Without them, the
  #    host shell strips the single quotes and run-as splits the args — sh -c
  #    sees only 'rm' with no arguments and silently fails.
  if adb -s "$android_device_id" shell run-as "$APP_ID" ls shared_prefs >/dev/null 2>&1; then
    adb -s "$android_device_id" shell "run-as $APP_ID sh -c 'rm -rf shared_prefs databases cache files app_webview app_webview_* no_backup code_cache app_flutter app_textures'" 2>/dev/null || true

    # Verify the wipe actually worked
    local remaining
    remaining=$(adb -s "$android_device_id" shell "run-as $APP_ID sh -c 'ls shared_prefs 2>/dev/null | wc -l'" 2>/dev/null | tr -d '[:space:]')
    if [ "${remaining:-0}" = "0" ]; then
      echo -e "${GREEN}  ✓ App data wiped via run-as${NC}"
    else
      echo -e "${YELLOW}  ⚠️  run-as rm may have partially failed, falling back to pm clear${NC}"
      adb -s "$android_device_id" shell pm clear "$APP_ID" >/dev/null 2>&1 || true
      echo -e "${GREEN}  ✓ App data cleared via pm clear${NC}"
    fi
  else
    # Fallback: run-as failed (non-debuggable build). Try pm clear but allow
    # extra time for the app to re-initialize on next launch.
    echo -e "${YELLOW}  ⚠️  run-as unavailable (non-debuggable build), falling back to pm clear${NC}"
    adb -s "$android_device_id" shell pm clear "$APP_ID" >/dev/null 2>&1 || true
    echo -e "${GREEN}  ✓ App data cleared via pm clear${NC}"
  fi

  # 3. Grant runtime permissions (cleared by data wipe).
  #    Batched into a single `adb shell` round-trip instead of 8 separate
  #    invocations — each adb shell call pays its own process-spawn/transport
  #    overhead, so this cuts ~7 round-trips worth of latency per test.
  adb -s "$android_device_id" shell "pm grant $APP_ID android.permission.ACCESS_FINE_LOCATION; \
    pm grant $APP_ID android.permission.ACCESS_COARSE_LOCATION; \
    pm grant $APP_ID android.permission.POST_NOTIFICATIONS; \
    pm grant $APP_ID android.permission.CAMERA; \
    pm grant $APP_ID android.permission.RECORD_AUDIO; \
    pm grant $APP_ID android.permission.READ_CONTACTS; \
    pm grant $APP_ID android.permission.BLUETOOTH_CONNECT; \
    pm grant $APP_ID android.permission.BLUETOOTH_SCAN" 2>/dev/null || true
  echo -e "${GREEN}  ✓ Runtime permissions granted${NC}"

  # 4. Pre-launch the app so it starts with a clean state.
  #    After pm clear, the app is completely reset. Pre-launching ensures Maestro's
  #    launchApp: clearState: false connects to a freshly initialized app
  #    instead of resuming a stale session.
  if adb shell monkey -p "$APP_ID" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1; then
    echo -e "${GREEN}  ✓ App pre-launched${NC}"
    sleep 2   # brief settle before polling; the responsiveness loop below
              # covers the rest of Compose/WebView init instead of a flat wait

    # Wait for app to be fully responsive (check if main activity is visible)
    local max_wait=10
    local waited=0
    while [ $waited -lt $max_wait ]; do
      if adb shell dumpsys window windows 2>/dev/null | grep -q "mCurrentFocus.*$APP_ID"; then
        echo -e "${GREEN}  ✓ App is responsive${NC}"
        break
      fi
      sleep 1
      waited=$((waited + 1))
    done
  else
    echo -e "${YELLOW}  ⚠️  Pre-launch failed (app may not be installed)${NC}"
  fi

  echo -e "${GREEN}✓ Android state reset complete${NC}"
}

# ─────────────────────────────────────────────────────────────────────────────
# Dispatch
# ─────────────────────────────────────────────────────────────────────────────
case "$PLATFORM" in
  ios)     reset_ios     ;;
  android) reset_android ;;
  *)
    echo -e "${RED}Unknown platform: $PLATFORM (expected ios or android)${NC}" >&2
    exit 1
    ;;
esac
