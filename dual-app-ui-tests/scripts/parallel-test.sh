#!/bin/bash
###############################################################################
# Parallel Test Runner
# Distributes test flows across multiple simulators and runs them concurrently.
#
# Usage:
#   bash scripts/parallel-test.sh .maestro/flows/Benefits/ --simulators 2
#   bash scripts/parallel-test.sh .maestro/flows/suites/suite-smoke.yaml --simulators 3
#   bash scripts/parallel-test.sh file1.yaml file2.yaml file3.yaml --simulators 2
#
# Flags:
#   --simulators N     Number of parallel simulators to use (default: 2)
#   --platform <ios|android>  Platform (default: ios)
#   --no-browser       Don't open reports automatically
###############################################################################

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

# ── Resolve app IDs from config.env (preferred) or build_config.yaml (fallback) ──
LOCAL_IOS_APP_ID=""
LOCAL_ANDROID_APP_ID=""
LOCAL_BRAND=""

if [ -n "${APP_FLAVOR:-}" ]; then
  # CI or local run with APP_FLAVOR set — source the canonical config.env
  _config_env="$PROJECT_ROOT/.maestro/apps/${APP_FLAVOR}/config.env"
  if [ -f "$_config_env" ]; then
    # shellcheck source=/dev/null
    source "$_config_env"
    LOCAL_IOS_APP_ID="${IOS_APP_ID:-}"
    LOCAL_ANDROID_APP_ID="${ANDROID_APP_ID:-}"
    LOCAL_BRAND="${BRAND:-$APP_FLAVOR}"
    echo -e "${BLUE}App config (from config.env: ${APP_FLAVOR}):${NC}"
  else
    echo -e "${RED}Error: APP_FLAVOR='${APP_FLAVOR}' but config not found: ${_config_env}${NC}"
    exit 1
  fi
else
  # Local dev without APP_FLAVOR — fall back to build_config.yaml
  BUILD_CONFIG_FILE="$PROJECT_ROOT/build_config.yaml"
  if [ -f "$BUILD_CONFIG_FILE" ]; then
    _scheme=$(grep -E "^[[:space:]]*scheme:" "$BUILD_CONFIG_FILE" | sed 's/.*scheme:[[:space:]]*//' | tr -d '"' | tr -d "'" | head -1)
    _config=$(grep -E "^configuration:" "$BUILD_CONFIG_FILE" | sed 's/.*configuration:[[:space:]]*//' | tr -d '"' | tr -d "'" | tr '[:upper:]' '[:lower:]' | head -1)
    if [ "$_scheme" = "CVSOnlineiPhone" ]; then
      LOCAL_BRAND="cvshealth"
      LOCAL_IOS_APP_ID=$(grep -A 10 "cvshealth_bundle_ids:" "$BUILD_CONFIG_FILE" | grep -E "^[[:space:]]*${_config}:" | sed 's/.*:[[:space:]]*//' | tr -d '"' | tr -d "'" | head -1)
      [ -z "$LOCAL_IOS_APP_ID" ] && LOCAL_IOS_APP_ID="com.cvsenterpriseiphone.cvspharmacy"
    else
      LOCAL_BRAND="health100"
      LOCAL_IOS_APP_ID=$(grep -A 10 "bundle_ids:" "$BUILD_CONFIG_FILE" | grep -v "cvshealth" | grep -E "^[[:space:]]*${_config}:" | sed 's/.*:[[:space:]]*//' | tr -d '"' | tr -d "'" | head -1)
      [ -z "$LOCAL_IOS_APP_ID" ] && LOCAL_IOS_APP_ID="com.cvsenterpriseiphone.health100"
    fi
    LOCAL_ANDROID_APP_ID=$(grep -E "^[[:space:]]*app_id:" "$BUILD_CONFIG_FILE" | sed 's/.*app_id:[[:space:]]*//' | tr -d '"' | tr -d "'" | head -1)
  fi
  echo -e "${BLUE}App config (from build_config.yaml — set APP_FLAVOR to use config.env):${NC}"
fi

echo "   iOS App ID:     ${LOCAL_IOS_APP_ID:-<not resolved>}"
echo "   Android App ID: ${LOCAL_ANDROID_APP_ID:-<not resolved>}"
echo ""

# ── Defaults ─────────────────────────────────────────────────────────────────
MAX_PARALLEL=2
PLATFORM="ios"
NO_BROWSER="false"
FLOW_ARGS=()

# ── Argument parsing ──────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    --simulators|--simulator) MAX_PARALLEL="$2"; shift 2 ;;
    --platform)   PLATFORM="$2"; shift 2 ;;
    --no-browser) NO_BROWSER="true"; shift ;;
    --help|-h)
      echo "Usage: bash scripts/parallel-test.sh <flow(s)> [--simulators N] [--platform ios|android]"
      echo ""
      echo "  <flow(s)>          One or more .yaml flow files or a directory"
      echo "  --simulators N     Max concurrent simulators (default: 2)"
      echo "  --platform         ios or android (default: ios)"
      echo "  --no-browser       Don't auto-open reports"
      exit 0 ;;
    *) FLOW_ARGS+=("$1"); shift ;;
  esac
done

if [ ${#FLOW_ARGS[@]} -eq 0 ]; then
  echo -e "${RED}Error: No flow files or directory specified${NC}"
  echo "Usage: bash scripts/parallel-test.sh <flow(s)> [--simulators N]"
  exit 1
fi

# ── Collect flow files ────────────────────────────────────────────────────────
FLOWS=()
for arg in "${FLOW_ARGS[@]}"; do
  if [ -d "$arg" ]; then
    while IFS= read -r -d '' f; do
      FLOWS+=("$f")
    done < <(find "$arg" -name "*.yaml" -not -name "suite-*" -print0 | sort -z)
  elif [ -f "$arg" ]; then
    FLOWS+=("$arg")
  else
    echo -e "${YELLOW}Warning: Not found, skipping: $arg${NC}"
  fi
done

if [ ${#FLOWS[@]} -eq 0 ]; then
  echo -e "${RED}No flow files found${NC}"; exit 1
fi

echo -e "${BLUE}Parallel Test Runner${NC}"
echo "   Flows:       ${#FLOWS[@]}"
echo "   Simulators:  $MAX_PARALLEL"
echo "   Platform:    $PLATFORM"
echo ""

# ── Get available device IDs ──────────────────────────────────────────────────
get_device_ids() {
  if [ "$PLATFORM" = "ios" ]; then
    xcrun simctl list devices booted --json 2>/dev/null \
      | python3 -c "
import sys, json
data = json.load(sys.stdin)
ids = []
for runtime, devices in data.get('devices', {}).items():
    for d in devices:
        if d.get('state') == 'Booted':
            ids.append(d['udid'])
print('\n'.join(ids))
" 2>/dev/null
  else
    adb devices 2>/dev/null | grep -E '\bdevice\b' | awk '{print $1}' | grep -v '^List'
  fi
}

DEVICE_IDS=()
while IFS= read -r id; do
  [ -n "$id" ] && DEVICE_IDS+=("$id")
done < <(get_device_ids)

# Auto-boot simulators if not enough are running
if [ "$PLATFORM" = "ios" ] && [ ${#DEVICE_IDS[@]} -lt "$MAX_PARALLEL" ]; then
  needed=$(( MAX_PARALLEL - ${#DEVICE_IDS[@]} ))
  echo -e "${YELLOW}Only ${#DEVICE_IDS[@]} simulator(s) booted; booting $needed more...${NC}"

  # Get Shutdown simulator UDIDs (excluding already-booted ones)
  SHUTDOWN_IDS=()
  while IFS= read -r id; do
    [ -n "$id" ] && SHUTDOWN_IDS+=("$id")
  done < <(xcrun simctl list devices available --json 2>/dev/null \
    | python3 -c "
import sys, json
data = json.load(sys.stdin)
booted = set($(printf '"%s",' "${DEVICE_IDS[@]:-}" | sed 's/,$//'))
for devices in data.get('devices', {}).values():
    for d in devices:
        if d.get('state') == 'Shutdown' and d['udid'] not in booted:
            print(d['udid'])
" 2>/dev/null | head -n "$needed")

  for udid in "${SHUTDOWN_IDS[@]}"; do
    echo -e "  Booting simulator $udid..."
    xcrun simctl boot "$udid" 2>/dev/null || true
    DEVICE_IDS+=("$udid")
  done

  if [ ${#SHUTDOWN_IDS[@]} -gt 0 ]; then
    echo -e "  Waiting for simulators to become ready (up to 90s)..."
    deadline=$(( $(date +%s) + 90 ))
    remaining=("${SHUTDOWN_IDS[@]}")
    while [ ${#remaining[@]} -gt 0 ] && [ "$(date +%s)" -lt "$deadline" ]; do
      still_waiting=()
      for udid in "${remaining[@]}"; do
        count=$(xcrun simctl list devices booted 2>/dev/null | grep -c "$udid" || true)
        [ "$count" -eq 0 ] && still_waiting+=("$udid")
      done
      remaining=("${still_waiting[@]:-}")
      [ ${#remaining[@]} -gt 0 ] && sleep 3
    done
    [ ${#remaining[@]} -gt 0 ] && echo -e "${YELLOW}  Warning: some simulators may not be fully ready${NC}"
    # Extra settle time for SpringBoard to initialise
    sleep 5
  fi
fi

if [ ${#DEVICE_IDS[@]} -eq 0 ]; then
  echo -e "${RED}No simulators available. Connect a device or install a simulator.${NC}"
  exit 1
fi

# Cap parallelism to available devices
if [ ${#DEVICE_IDS[@]} -lt "$MAX_PARALLEL" ]; then
  echo -e "${YELLOW}Warning: Only ${#DEVICE_IDS[@]} simulator(s) available, using ${#DEVICE_IDS[@]} (requested $MAX_PARALLEL)${NC}"
  MAX_PARALLEL=${#DEVICE_IDS[@]}
fi

echo "   Devices:     ${DEVICE_IDS[*]}"
echo ""

# ── Pre-flight: check app is installed on each device; build+install if missing ──
BUILD_SCRIPT="$SCRIPT_DIR/build/build.sh"
APP_INSTALLED_ON_DEVICES=()  # tracks which device UDIDs we installed on (for post-run cleanup)

if [ "$PLATFORM" = "ios" ] && [ -n "$LOCAL_IOS_APP_ID" ]; then
  echo -e "${BLUE}Checking app installation on simulators...${NC}"
  for udid in "${DEVICE_IDS[@]::$MAX_PARALLEL}"; do
    installed=$(xcrun simctl listapps "$udid" 2>/dev/null | grep -c "\"$LOCAL_IOS_APP_ID\"" || true)
    if [ "$installed" -gt 0 ]; then
      echo -e "  ${GREEN}✓${NC} $LOCAL_IOS_APP_ID installed on $udid"
    else
      echo -e "  ${YELLOW}⚠️  App not installed on $udid — building from repo and installing...${NC}"
      if [ -f "$BUILD_SCRIPT" ]; then
        DEVICE_UUID="$udid" bash "$BUILD_SCRIPT" ios repo main "$udid" || {
          echo -e "${RED}❌ Build/install failed for $udid — aborting${NC}"
          exit 1
        }
        APP_INSTALLED_ON_DEVICES+=("$udid")
      else
        echo -e "${RED}❌ Build script not found: $BUILD_SCRIPT${NC}"
        exit 1
      fi
    fi
  done
  echo ""
elif [ "$PLATFORM" = "android" ] && [ -n "$LOCAL_ANDROID_APP_ID" ]; then
  echo -e "${BLUE}Checking app installation on emulators...${NC}"
  for device in "${DEVICE_IDS[@]::$MAX_PARALLEL}"; do
    installed=$(adb -s "$device" shell pm list packages 2>/dev/null | grep -c "$LOCAL_ANDROID_APP_ID" || true)
    if [ "$installed" -gt 0 ]; then
      echo -e "  ${GREEN}✓${NC} $LOCAL_ANDROID_APP_ID installed on $device"
    else
      echo -e "  ${YELLOW}⚠️  App not installed on $device — building from repo and installing...${NC}"
      if [ -f "$BUILD_SCRIPT" ]; then
        bash "$BUILD_SCRIPT" android repo main "$device" || {
          echo -e "${RED}❌ Build/install failed for $device — aborting${NC}"
          exit 1
        }
        APP_INSTALLED_ON_DEVICES+=("$device")
      else
        echo -e "${RED}❌ Build script not found: $BUILD_SCRIPT${NC}"
        exit 1
      fi
    fi
  done
  echo ""
fi

# ── Run flows in parallel ─────────────────────────────────────────────────────
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
RUN_START_EPOCH=$(date +%s)
PARALLEL_REPORT_DIR="$PROJECT_ROOT/test-reports/PARALLEL_${PLATFORM^^}_$TIMESTAMP"
mkdir -p "$PARALLEL_REPORT_DIR"

# ── Dispatch flows (round-robin device assignment) ────────────────────────────
echo -e "${BLUE}Dispatching ${#FLOWS[@]} flows across $MAX_PARALLEL simulators...${NC}"
echo ""

FLOW_TIMEOUT=300  # 5 minutes per flow

run_flow() {
  local flow="$1"
  local device="$2"
  local slot="$3"
  local log="$PARALLEL_REPORT_DIR/run-${slot}.log"

  # Select the right app ID for the current platform
  local _app_id=""
  if [ "$PLATFORM" = "ios" ]; then
    _app_id="$LOCAL_IOS_APP_ID"
  else
    _app_id="$LOCAL_ANDROID_APP_ID"
  fi

  APP_ID="$_app_id" PARALLEL_MODE=true bash "$SCRIPT_DIR/testing/test.sh" "$flow" \
    --platform "$PLATFORM" \
    --device "$device" \
    --skip-setup \
    --no-browser \
    --no-report \
    > "$log" 2>&1 &
  local test_pid=$!

  # Kill the flow if it exceeds the timeout
  ( sleep "$FLOW_TIMEOUT" && kill "$test_pid" 2>/dev/null ) &
  local killer=$!

  wait "$test_pid"
  local rc=$?
  kill "$killer" 2>/dev/null
  wait "$killer" 2>/dev/null
  return $rc
}

SLOT_PIDS=()
SLOT_FLOWS=()

for ((i=0; i<${#FLOWS[@]}; i++)); do
  flow="${FLOWS[$i]}"
  device="${DEVICE_IDS[$((i % MAX_PARALLEL))]}"
  slot_num=$(( i % MAX_PARALLEL + 1 ))

  echo -e "  [slot ${slot_num}/${MAX_PARALLEL}] Starting: $(basename "$flow")"

  run_flow "$flow" "$device" "$i" &
  SLOT_PIDS[$i]=$!
  SLOT_FLOWS[$i]="$flow"
done

echo ""
echo -e "${BLUE}Waiting for all flows to complete...${NC}"

# ── Collect results ───────────────────────────────────────────────────────────
PASSED=0; FAILED=0
SLOT_RESULTS=()
for i in "${!SLOT_PIDS[@]}"; do
  pid=${SLOT_PIDS[$i]}
  flow=${SLOT_FLOWS[$i]}
  if wait "$pid" 2>/dev/null; then
    echo -e "  ${GREEN}PASS${NC}  $(basename "$flow")"
    ((PASSED++)) || true
    SLOT_RESULTS[$i]="passed"
  else
    echo -e "  ${RED}FAIL${NC}  $(basename "$flow")"
    ((FAILED++)) || true
    SLOT_RESULTS[$i]="failed"
  fi
done

# ── Post-run: uninstall app from all devices ─────────────────────────────────
if [ "$PLATFORM" = "ios" ] && [ -n "$LOCAL_IOS_APP_ID" ]; then
  echo -e "${BLUE}Uninstalling app from simulators...${NC}"
  for udid in "${DEVICE_IDS[@]::$MAX_PARALLEL}"; do
    xcrun simctl uninstall "$udid" "$LOCAL_IOS_APP_ID" 2>/dev/null \
      && echo "  Uninstalled from $udid" || true
  done
  echo ""
elif [ "$PLATFORM" = "android" ] && [ -n "$LOCAL_ANDROID_APP_ID" ]; then
  echo -e "${BLUE}Uninstalling app from emulators...${NC}"
  for dev in "${DEVICE_IDS[@]::$MAX_PARALLEL}"; do
    adb -s "$dev" uninstall "$LOCAL_ANDROID_APP_ID" 2>/dev/null \
      && echo "  Uninstalled from $dev" || true
  done
  echo ""
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "  ${GREEN}Passed: $PASSED${NC}   ${RED}Failed: $FAILED${NC}   Total: ${#FLOWS[@]}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── Generate suite report ─────────────────────────────────────────────────────
PLATFORM_UPPER="${PLATFORM^^}"
SUITE_XML="$PARALLEL_REPORT_DIR/suite-results.xml"
SUITE_REPORT="$PARALLEL_REPORT_DIR/suite-report.html"

if command -v node &>/dev/null; then
  echo -e "${BLUE}Generating suite report...${NC}"

  # Build JS arrays from the flow names and exit-code results collected above
  if [ ${#SLOT_FLOWS[@]} -gt 0 ]; then
    JS_FLOW_NAMES="[$(printf '"%s",' "${SLOT_FLOWS[@]}" | sed 's/,$//')]"
  else
    JS_FLOW_NAMES="[]"
  fi
  if [ ${#SLOT_RESULTS[@]} -gt 0 ]; then
    JS_FLOW_RESULTS="[$(printf '"%s",' "${SLOT_RESULTS[@]}" | sed 's/,$//')]"
  else
    JS_FLOW_RESULTS="[]"
  fi

  # Build combined JUnit XML from flow names + pass/fail status
  node -e "
    const fs = require('fs');
    const path = require('path');

    const flowNames   = $JS_FLOW_NAMES;
    const flowResults = $JS_FLOW_RESULTS;

    let passed = 0, failed = 0, total = 0;
    let testcases = '';

    flowNames.forEach((flowPath, idx) => {
      const name   = path.basename(flowPath, '.yaml');
      const status = flowResults[idx] || 'failed';

      total++;
      if (status === 'failed') failed++;
      else passed++;

      testcases += '  <testcase name=\"' + name + '\" time=\"0\">\n';
      if (status === 'failed') {
        testcases += '    <failure message=\"Test failed\">Test failed</failure>\n';
      }
      testcases += '  </testcase>\n';
    });

    const xml =
      '<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n' +
      '<testsuite name=\"Parallel Suite\" tests=\"' + total + '\" failures=\"' + failed + '\" time=\"0\">\n' +
      testcases +
      '</testsuite>\n';

    fs.writeFileSync('$SUITE_XML', xml);
    console.log('  XML written: ' + total + ' tests, ' + failed + ' failed');
  " 2>/dev/null || echo -e "${YELLOW}  Warning: could not build suite XML${NC}"

  if [ -f "$SUITE_XML" ]; then
    REPORT_DIR="$PARALLEL_REPORT_DIR" BRAND="${LOCAL_BRAND:-}" node "$SCRIPT_DIR/reporting/generate-unified-report.js" \
      "$SUITE_XML" "$SUITE_REPORT" "$PLATFORM" 2>/dev/null \
      && echo -e "  ${GREEN}Suite report:${NC} $SUITE_REPORT" \
      || echo -e "${YELLOW}  Warning: report generator failed${NC}"
    rm -f "$SUITE_XML"
  fi

  if [ -f "$SUITE_REPORT" ] && [ "$NO_BROWSER" != "true" ]; then
    open "$SUITE_REPORT" 2>/dev/null || true
  fi
fi

echo ""
echo "  Logs:   $PARALLEL_REPORT_DIR/"
echo ""

[ "$FAILED" -gt 0 ] && exit 1 || exit 0
