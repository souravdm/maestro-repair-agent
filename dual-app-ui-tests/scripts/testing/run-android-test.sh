#!/bin/bash
# run-android-test.sh — Run Maestro test suite on Android emulator after android-build.sh
#
# Prerequisite: android-build.sh must have already been run.
#
# What this script does:
#   1. Finds the connected Android device/emulator where android-build.sh
#      installed com.health100.launchers.
#   2. Runs the specified Maestro suite via run-test-suite.sh.
#
# Usage:
#   ./run-android-test.sh
#   ./run-android-test.sh .maestro/apps/health100/suites/H100-Smoke.yaml
#
# Arguments:
#   $1  — suite YAML path, relative to repo root
#          (default: .maestro/apps/health100/suites/H100-Smoke.yaml)

set -euo pipefail

###############################################################################
# Paths
###############################################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

ANDROID_APP_ID="${ANDROID_APP_ID:-com.health100.launchers}"

MCP_MODE="false"
if [ "${1:-}" = "--mcp-mode" ]; then
  MCP_MODE="true"
  shift
fi

SUITE="${1:-.maestro/apps/health100/suites/H100-Smoke.yaml}"

###############################################################################
# Colors / helpers — same as android-build.sh
###############################################################################

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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
# Locate real Maestro binary (same logic as run-ios-test.sh)
###############################################################################

_KNOWN_MAESTRO="/Users/c113157/Documents/Test-Automation/framework/maestro/bin/maestro"
if [ -x "$_KNOWN_MAESTRO" ]; then
  MAESTRO_BIN="$_KNOWN_MAESTRO"
elif command -v maestro &>/dev/null; then
  MAESTRO_BIN="$(command -v maestro)"
else
  die "maestro binary not found at $_KNOWN_MAESTRO and not in PATH."
fi

###############################################################################
# Preflight
###############################################################################

banner "Preflight"

# adb must be available
command -v adb &>/dev/null || die "adb not found. Is Android SDK in PATH?"
ok "adb found"

[ -f "$PROJECT_ROOT/$SUITE" ] || die "Suite not found: $PROJECT_ROOT/$SUITE"
ok "Suite: $SUITE"

bash "$SCRIPT_DIR/../validate/cross-platform-check.sh" || die "Cross-platform check failed"

# Find the device where android-build.sh installed the app.
# Check all connected devices; pick the one with the app installed.
DEVICE_ID=""
while IFS= read -r _line; do
  _serial=$(echo "$_line" | awk '{print $1}')
  _state=$(echo "$_line"  | awk '{print $2}')
  [ "$_state" = "device" ] || continue
  if adb -s "$_serial" shell pm list packages 2>/dev/null \
      | grep -q "package:$ANDROID_APP_ID"; then
    DEVICE_ID="$_serial"
    break
  fi
done < <(adb devices 2>/dev/null | grep -v "^List" | grep -v "^$")

[ -n "$DEVICE_ID" ] \
  || die "No connected device has $ANDROID_APP_ID installed. Run android-build.sh first."

ok "Device: $DEVICE_ID ($ANDROID_APP_ID is installed)"

# Verify device is fully booted
BOOT=$(adb -s "$DEVICE_ID" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r\n' || true)
[ "$BOOT" = "1" ] || die "Device $DEVICE_ID is not fully booted yet. Wait and retry."
ok "Device is fully booted"

###############################################################################
# MCP Mode — output JSON manifest and exit (Claude Code drives execution)
###############################################################################

if [ "$MCP_MODE" = "true" ]; then
  banner "MCP Mode — generating test manifest"
  cd "$PROJECT_ROOT"
  bash scripts/testing/mcp-test-manifest.sh \
    --suite "$SUITE" \
    --platform android \
    --device "$DEVICE_ID"
  exit 0
fi

###############################################################################
# Run test suite
###############################################################################

banner "Run Maestro suite: $(basename "$SUITE")"

cd "$PROJECT_ROOT"

export MAESTRO_BIN_OVERRIDE="$MAESTRO_BIN"

bash scripts/analysis/pre-run-gate.sh --gate 1

bash scripts/testing/run-test-suite.sh \
  "$SUITE" \
  --platform android \
  --device "$DEVICE_ID"
