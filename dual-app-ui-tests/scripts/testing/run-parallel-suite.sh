#!/bin/bash
# run-parallel-suite.sh — run one Maestro suite on the iOS simulator AND the Android
# emulator simultaneously, without interference.
#
# This is a thin setup wrapper, not a new concurrency engine: it boots/verifies both
# devices sequentially (device setup is destructive to shared ADB/simulator state and
# must never run while the other platform's run is live), then hands off to the
# existing, already-correct parallel runner scripts/testing/run-both-platforms.sh —
# which staggers the two launches to dodge a port-7001 race, runs both children with
# PARALLEL_MODE=true (so neither's cleanup kills the other), and does a single unified
# cleanup once both finish.
#
# Every preflight check below is the exact same check run-ios-test.sh / run-android-test.sh
# perform — same logic, same order, not reinvented — only keys-file-driven instead of
# hardcoded. In particular: run-ios-test.sh never verifies the app itself is installed
# (it only installs the Maestro driver host app and trusts ios-build.sh ran); this
# script doesn't either, for exact parity. run-android-test.sh finds the app by scanning
# all connected devices rather than checking one specific device; this script does
# the same scan.
#
# Usage:
#   ./run-parallel-suite.sh <suite-path> [report-suffix]
#   ./run-parallel-suite.sh .maestro/apps/health100/suites/H100-Smoke.yaml
#   ./run-parallel-suite.sh .maestro/apps/health100/suites/benefits_providers.yaml Providers
#
# report-suffix (optional): appended to both platforms' test-reports/ folder name
# (e.g. IOS_20260902_071127_Providers) so results from different suites can be told
# apart at a glance — same convention already used for manually-renamed folders.

set -euo pipefail

###############################################################################
# 0 — Load config from keys file
###############################################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# keys lives in scripts/build/ (not this script's own directory) — never
# assume same-directory here, since keys stays put even if this script moves.
KEYS_FILE="$PROJECT_ROOT/scripts/build/keys"
[ -f "$KEYS_FILE" ] || { echo "ERROR: keys file not found at $KEYS_FILE"; exit 1; }
source "$KEYS_FILE"

SUITE="${1:?Usage: $0 <suite-path> [report-suffix]}"
[ -f "$PROJECT_ROOT/$SUITE" ] || { echo "ERROR: suite not found: $PROJECT_ROOT/$SUITE"; exit 1; }
export REPORT_SUFFIX="${2:-}"

SIMULATOR_ID="${SIMULATOR_ID:?'SIMULATOR_ID not set — add it to the keys file'}"
EMULATOR_NAME="${EMULATOR_NAME:?'EMULATOR_NAME not set — add it to the keys file'}"
ANDROID_APP_ID="${ANDROID_APP_ID:?'ANDROID_APP_ID not set — add it to the keys file'}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
banner() {
  echo ""
  echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
  printf "${BLUE}║  %-58s║${NC}\n" "$1"
  echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
}
ok()   { echo -e "${GREEN}✓ $*${NC}"; }
info() { echo -e "${BLUE}  $*${NC}"; }
warn() { echo -e "${YELLOW}⚠  $*${NC}"; }
die()  { echo -e "${RED}✗ $*${NC}" >&2; exit 1; }

###############################################################################
# Step 1 — Boot iOS simulator (same check as run-ios-test.sh Preflight)
###############################################################################

banner "Step 1 — Boot iOS simulator ($SIMULATOR_ID)"
SIM_STATE=$(xcrun simctl list devices 2>/dev/null | grep "$SIMULATOR_ID" | head -1)
[ -n "$SIM_STATE" ] || die "Simulator $SIMULATOR_ID not found. Run ios-build.sh first."
if ! echo "$SIM_STATE" | grep -q "Booted"; then
  info "Booting simulator $SIMULATOR_ID..."
  xcrun simctl boot "$SIMULATOR_ID"
  open -a Simulator &>/dev/null || true
  sleep 3
fi
ok "Simulator $SIMULATOR_ID is Booted"

###############################################################################
# Step 2 — Locate Android SDK tools (same block as android-install.sh step 2)
###############################################################################

banner "Step 2 — Locate Android SDK tools"
if [ -z "${ANDROID_HOME:-}" ]; then
  for _sdk in \
    "$HOME/Library/Android/sdk" \
    "$HOME/Android/Sdk" \
    "/usr/local/share/android-sdk" \
    "/opt/homebrew/share/android-commandlinetools"; do
    [ -d "$_sdk" ] && export ANDROID_HOME="$_sdk" && break
  done
fi
[ -n "${ANDROID_HOME:-}" ] || die "Android SDK not found — set ANDROID_HOME or run scripts/setup/android-setup.sh install"
export PATH="$ANDROID_HOME/cmdline-tools/latest/bin:$ANDROID_HOME/emulator:$ANDROID_HOME/platform-tools:$PATH"

command -v adb      &>/dev/null || die "adb not found — check ANDROID_HOME/platform-tools"
command -v emulator &>/dev/null || die "emulator not found — check ANDROID_HOME/emulator"
ok "Android SDK: $ANDROID_HOME"

###############################################################################
# Step 3 — Boot Android emulator (same block as android-install.sh step 3)
###############################################################################

banner "Step 3 — Boot Android emulator ($EMULATOR_NAME)"

RUNNING_STATE=$(adb devices 2>/dev/null | grep "emulator" | awk '{print $2}' | head -1 || true)
if [ "$RUNNING_STATE" = "device" ]; then
  ok "Emulator already running"
else
  adb kill-server 2>/dev/null || true
  adb start-server

  nohup emulator -avd "$EMULATOR_NAME" \
    -no-window -no-audio -no-boot-anim -no-snapshot \
    -memory 4096 -cores 4 \
    > /tmp/android-emulator.log 2>&1 &
  info "Emulator PID: $!"

  _waited=0
  until adb devices 2>/dev/null | grep -q "emulator"; do
    sleep 5; _waited=$((_waited + 5))
    [ "$_waited" -ge 240 ] && { tail -50 /tmp/android-emulator.log; die "Emulator did not appear within 4 minutes"; }
  done

  for i in $(seq 1 30); do
    STATE=$(adb devices 2>/dev/null | grep "emulator" | awk '{print $2}' | head -1 || true)
    [ "$STATE" = "device" ] && { ok "ADB authorized"; break; }
    [ "$i" -eq 30 ] && { tail -50 /tmp/android-emulator.log; die "Emulator stuck in '$STATE' state"; }
    sleep 2
  done

  for i in $(seq 1 60); do
    BOOT=$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r\n' || true)
    [ "$BOOT" = "1" ] && { ok "Emulator booted"; break; }
    [ "$i" -eq 60 ] && { tail -50 /tmp/android-emulator.log; die "Emulator boot timed out"; }
    sleep 5
  done
  ok "Emulator ready"
fi

###############################################################################
# Step 4 — Maestro driver jar + cross-platform check (same checks as
# run-ios-test.sh / run-android-test.sh Preflight — run once, shared by both platforms)
###############################################################################

banner "Step 4 — Maestro driver + cross-platform check"

_KNOWN_MAESTRO="/Users/c113157/Documents/Test-Automation/framework/maestro/bin/maestro"
if [ -x "$_KNOWN_MAESTRO" ]; then
  MAESTRO_BIN="$_KNOWN_MAESTRO"
elif command -v maestro &>/dev/null; then
  MAESTRO_BIN="$(command -v maestro)"
else
  die "maestro binary not found at $_KNOWN_MAESTRO and not in PATH."
fi
MAESTRO_LIB_DIR="$(dirname "$(dirname "$MAESTRO_BIN")")/lib"
IOS_DRIVER_JAR="$MAESTRO_LIB_DIR/maestro-ios-driver.jar"
[ -f "$IOS_DRIVER_JAR" ] || die "maestro-ios-driver.jar not found at $IOS_DRIVER_JAR"
ok "maestro-ios-driver.jar found"

bash "$SCRIPT_DIR/../validate/cross-platform-check.sh" || die "Cross-platform check failed"

###############################################################################
# Step 5 — Install Maestro driver host app on iOS (Xcode 26 workaround,
# same block as run-ios-test.sh Step 2)
###############################################################################

banner "Step 5 — Install Maestro driver host app (iOS)"

DRIVER_ALREADY_INSTALLED=$(xcrun simctl get_app_container \
  "$SIMULATOR_ID" dev.mobile.maestro-driver-ios 2>/dev/null || true)

if [ -n "$DRIVER_ALREADY_INSTALLED" ]; then
  ok "maestro-driver-ios already installed — skipping"
else
  info "Extracting maestro-driver-ios from JAR..."
  EXTRACT_DIR="$(mktemp -d /tmp/maestro-driver-XXXXXX)"
  trap 'rm -rf "$EXTRACT_DIR"' EXIT

  (cd "$EXTRACT_DIR" && jar xf "$IOS_DRIVER_JAR" \
    "driver-iPhoneSimulator/Debug-iphonesimulator/maestro-driver-ios.zip")

  unzip -qo \
    "$EXTRACT_DIR/driver-iPhoneSimulator/Debug-iphonesimulator/maestro-driver-ios.zip" \
    -d "$EXTRACT_DIR/app"

  info "Installing maestro-driver-ios on simulator $SIMULATOR_ID..."
  xcrun simctl install "$SIMULATOR_ID" "$EXTRACT_DIR/app/maestro-driver-ios.app" \
    || die "simctl install failed for maestro-driver-ios"

  ok "maestro-driver-ios installed"
fi

###############################################################################
# Step 6 — Find Android device with the app installed (same scan as
# run-android-test.sh Preflight — exact logic, not simplified to "the device we
# just booted", since run-android-test.sh doesn't assume that either)
###############################################################################

banner "Step 6 — Find Android device with app installed"

ANDROID_DEVICE_ID=""
while IFS= read -r _line; do
  _serial=$(echo "$_line" | awk '{print $1}')
  _state=$(echo "$_line"  | awk '{print $2}')
  [ "$_state" = "device" ] || continue
  if adb -s "$_serial" shell pm list packages 2>/dev/null | grep -q "package:$ANDROID_APP_ID"; then
    ANDROID_DEVICE_ID="$_serial"
    break
  fi
done < <(adb devices 2>/dev/null | grep -v "^List" | grep -v "^$")

[ -n "$ANDROID_DEVICE_ID" ] \
  || die "No connected device has $ANDROID_APP_ID installed. Run android-install.sh or android-build.sh first."
ok "Device: $ANDROID_DEVICE_ID ($ANDROID_APP_ID is installed)"

BOOT=$(adb -s "$ANDROID_DEVICE_ID" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r\n' || true)
[ "$BOOT" = "1" ] || die "Device $ANDROID_DEVICE_ID is not fully booted yet. Wait and retry."
ok "Device is fully booted"

###############################################################################
# Step 7 — Hand off to the existing parallel concurrency engine
###############################################################################

banner "Step 7 — Run suite on both platforms in parallel"
info "Suite: $SUITE"
info "iOS device:     $SIMULATOR_ID"
info "Android device: $ANDROID_DEVICE_ID"
[ -n "$REPORT_SUFFIX" ] && info "Report suffix:  $REPORT_SUFFIX"

bash "$PROJECT_ROOT/scripts/testing/run-both-platforms.sh" "$SUITE" \
  --ios-device "$SIMULATOR_ID" --android-device "$ANDROID_DEVICE_ID" --skip-setup
