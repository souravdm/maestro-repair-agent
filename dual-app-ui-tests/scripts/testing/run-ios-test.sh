#!/bin/bash
# run-ios-test.sh — Run Maestro test suite on iOS simulator after ios-build.sh
#
# Prerequisite: ios-build.sh must have already been run.
#
# What this script does:
#   1. Installs the Maestro XCTest host app (maestro-driver-ios) on the simulator.
#      Xcode 26+ no longer auto-installs the UITargetApp during xcodebuild
#      test-without-building, so Maestro's driver never starts without this step.
#   2. Runs the specified Maestro suite via run-test-suite.sh.
#
# Usage:
#   ./run-ios-test.sh
#   SIMULATOR_ID=<udid> ./run-ios-test.sh
#   SIMULATOR_ID=<udid> SUITE=.maestro/apps/health100/suites/H100-Smoke.yaml ./run-ios-test.sh
#
# Optional env vars:
#   SIMULATOR_ID  — UDID of the booted simulator (default: same as ios-build.sh)
#   SUITE         — path to the suite YAML, relative to repo root
#                   (default: .maestro/apps/health100/suites/H100-Smoke.yaml)

set -euo pipefail

###############################################################################
# Colors / helpers
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
# Paths
###############################################################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

MCP_MODE="false"
if [ "${1:-}" = "--mcp-mode" ]; then
  MCP_MODE="true"
  shift
fi

SIMULATOR_ID="${SIMULATOR_ID:-8DEBB443-8602-4443-9E72-E73D74A88333}"
SUITE="${1:-.maestro/apps/health100/suites/H100-Smoke.yaml}"

# Locate the real maestro CLI install directory.
# command -v may return a project-local wrapper; resolve to the actual install.
_KNOWN_MAESTRO="/Users/c113157/Documents/Test-Automation/framework/maestro/bin/maestro"
if [ -x "$_KNOWN_MAESTRO" ]; then
  MAESTRO_BIN="$_KNOWN_MAESTRO"
elif command -v maestro &>/dev/null; then
  MAESTRO_BIN="$(command -v maestro)"
else
  echo "✗ maestro binary not found at $_KNOWN_MAESTRO and not in PATH." >&2
  exit 1
fi

MAESTRO_LIB_DIR="$(dirname "$(dirname "$MAESTRO_BIN")")/lib"
IOS_DRIVER_JAR="$MAESTRO_LIB_DIR/maestro-ios-driver.jar"

###############################################################################
# Step 1 — Preflight
###############################################################################

banner "Preflight"

SIM_STATE=$(xcrun simctl list devices 2>/dev/null | grep "$SIMULATOR_ID" | head -1)
[ -n "$SIM_STATE" ] || die "Simulator $SIMULATOR_ID not found. Run ios-build.sh first."
if ! echo "$SIM_STATE" | grep -q "Booted"; then
  info "Booting simulator $SIMULATOR_ID..."
  xcrun simctl boot "$SIMULATOR_ID"
  open -a Simulator &>/dev/null || true
  sleep 3
fi
ok "Simulator $SIMULATOR_ID is Booted"

[ -f "$IOS_DRIVER_JAR" ] || die "maestro-ios-driver.jar not found at $IOS_DRIVER_JAR"
ok "maestro-ios-driver.jar found"

[ -f "$PROJECT_ROOT/$SUITE" ] || die "Suite not found: $PROJECT_ROOT/$SUITE"
ok "Suite: $SUITE"

bash "$SCRIPT_DIR/../validate/cross-platform-check.sh" || die "Cross-platform check failed"

###############################################################################
# Step 2 — Install Maestro host app (Xcode 26 workaround)
#
# Xcode 26 no longer auto-installs the UITargetApp referenced in the xctestrun.
# Without dev.mobile.maestro-driver-ios on the simulator, the XCTest bundle
# starts but crashes immediately — port 22087 never opens and every test times
# out with "iOS driver not ready in time".
###############################################################################

banner "Install Maestro driver host app"

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
# MCP Mode — output JSON manifest and exit (Claude Code drives execution)
###############################################################################

if [ "$MCP_MODE" = "true" ]; then
  banner "MCP Mode — generating test manifest"
  cd "$PROJECT_ROOT"
  bash scripts/testing/mcp-test-manifest.sh \
    --suite "$SUITE" \
    --platform ios \
    --device "$SIMULATOR_ID"
  exit 0
fi

###############################################################################
# Step 3 — Run test suite
###############################################################################

banner "Run Maestro suite: $(basename "$SUITE")"

cd "$PROJECT_ROOT"

export MAESTRO_BIN_OVERRIDE="$MAESTRO_BIN"

bash scripts/analysis/pre-run-gate.sh --gate 1

bash scripts/testing/run-test-suite.sh \
  "$SUITE" \
  --platform ios \
  --device "$SIMULATOR_ID"
