#!/bin/bash
###############################################################################
# Parallel Suite Runner
#
# Parses a Maestro suite YAML, groups its flows by feature area, and runs each
# group on a separate simulator concurrently. Cuts H100-Smoke.yaml run time by
# ~60-70% versus sequential run-test-suite.sh on a single simulator.
#
# Requirements:
#   - Multiple booted iOS simulators OR --simulators N to auto-boot them
#   - App installed on each simulator (auto-installs if missing)
#   - macOS with xcrun simctl available
#
# Usage:
#   bash scripts/testing/run-suite-parallel.sh \
#     .maestro/apps/health100/suites/H100-Smoke.yaml \
#     --platform ios \
#     --simulators 3 \
#     --no-browser
#
# Flags:
#   --platform ios|android   (default: ios)
#   --simulators N           Number of parallel devices (default: 2)
#   --device UDID            Specific device/emulator ID (repeatable)
#   --no-browser             Do not auto-open the final report
#   --warn-only-gates        Pass PRE_RUN_WARN_ONLY=true to each slot runner
#   --timeout N              Per-flow timeout in seconds (default: 650)
#
# Feature grouping:
#   Flows are bucketed by directory name (Account, Benefits/Claims, Pharmacy…).
#   Each bucket runs as a mini-suite on its own simulator. Buckets are
#   distributed round-robin across available simulators so the slowest bucket
#   determines total wall-clock time.
#
# Output:
#   test-reports/PARALLEL_<PLATFORM>_<TIMESTAMP>/
#     <group>_report/suite-results.json   per-group results
#     parallel-summary.json               merged summary
#     parallel-report.html                unified HTML report
###############################################################################

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

# ── Argument parsing ──────────────────────────────────────────────────────────
SUITE_FILE=""
PLATFORM="ios"
MAX_SIMULATORS=2
EXPLICIT_DEVICES=()
NO_BROWSER="false"
WARN_ONLY_GATES="false"
FLOW_TIMEOUT=650

while [[ $# -gt 0 ]]; do
  case $1 in
    --platform)        PLATFORM="$2"; shift 2 ;;
    --simulators)      MAX_SIMULATORS="$2"; shift 2 ;;
    --device)          EXPLICIT_DEVICES+=("$2"); shift 2 ;;
    --no-browser)      NO_BROWSER="true"; shift ;;
    --warn-only-gates) WARN_ONLY_GATES="true"; shift ;;
    --timeout)         FLOW_TIMEOUT="$2"; shift 2 ;;
    --help|-h)
      echo "Usage: bash scripts/testing/run-suite-parallel.sh <suite.yaml> [options]"
      echo "  --platform ios|android    (default: ios)"
      echo "  --simulators N            Concurrent devices (default: 2)"
      echo "  --device UDID             Explicit device (repeatable)"
      echo "  --no-browser              Don't open the report"
      echo "  --warn-only-gates         Don't fail on lint gate violations"
      echo "  --timeout N               Per-flow timeout seconds (default: 650)"
      exit 0 ;;
    *) SUITE_FILE="$1"; shift ;;
  esac
done

if [ -z "$SUITE_FILE" ]; then
  echo -e "${RED}❌ Suite file required${NC}"
  echo "Usage: $0 <suite.yaml> [--simulators N] [--platform ios|android]"
  exit 1
fi

if [ ! -f "$SUITE_FILE" ] && [ ! -f "$PROJECT_ROOT/$SUITE_FILE" ]; then
  echo -e "${RED}❌ Suite file not found: $SUITE_FILE${NC}"
  exit 1
fi
[ ! -f "$SUITE_FILE" ] && SUITE_FILE="$PROJECT_ROOT/$SUITE_FILE"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         Parallel Suite Runner                              ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "  Suite:       $(basename "$SUITE_FILE")"
echo "  Platform:    $PLATFORM"
echo "  Simulators:  $MAX_SIMULATORS"
echo ""

# ── Detect app config ─────────────────────────────────────────────────────────
if [[ "$SUITE_FILE" == *"health100"* ]]; then
  APP_CONFIG="$PROJECT_ROOT/.maestro/apps/health100/config.env"
elif [[ "$SUITE_FILE" == *"cvshealth"* ]]; then
  APP_CONFIG="$PROJECT_ROOT/.maestro/apps/cvshealth/config.env"
else
  APP_CONFIG=""
fi

APP_ID=""
if [ -n "$APP_CONFIG" ] && [ -f "$APP_CONFIG" ]; then
  source "$APP_CONFIG"
  [ "$PLATFORM" = "android" ] && APP_ID="${ANDROID_APP_ID:-}" || APP_ID="${IOS_APP_ID:-}"
fi

# ── Parse suite YAML to extract flow file paths ───────────────────────────────
SUITE_DIR="$(dirname "$SUITE_FILE")"
ALL_FLOWS=()
while IFS= read -r line || [[ -n "$line" ]]; do
  [[ "$line" =~ ^[[:space:]]*# ]] && continue
  if [[ "$line" =~ file:[[:space:]]*(.+\.yaml) ]]; then
    flow_path="${BASH_REMATCH[1]}"
    if [[ "$flow_path" == /* ]]; then
      FULL="$flow_path"
    else
      FULL="$SUITE_DIR/$flow_path"
    fi
    [ -f "$FULL" ] && ALL_FLOWS+=("$FULL")
  fi
done < "$SUITE_FILE"

if [ ${#ALL_FLOWS[@]} -eq 0 ]; then
  echo -e "${RED}❌ No flow files found in suite: $SUITE_FILE${NC}"
  exit 1
fi
echo "  Flows found: ${#ALL_FLOWS[@]}"

# ── Group flows by feature area ───────────────────────────────────────────────
# Bucket key = the first meaningful directory segment below .maestro/flows/
# e.g. .maestro/flows/Benefits/Claims/H100_... → "Benefits_Claims"
#      .maestro/flows/Account/H100_...         → "Account"
#      .maestro/flows/Smart_Sch/...            → "Smart_Sch"
declare -A GROUP_FLOWS
declare -a GROUP_ORDER

for flow in "${ALL_FLOWS[@]}"; do
  rel="${flow#*/.maestro/flows/}"
  # Take up to 2 directory levels as the bucket key
  part1=$(echo "$rel" | cut -d/ -f1)
  part2=$(echo "$rel" | cut -d/ -f2)
  if [[ "$part2" == *.yaml ]]; then
    bucket="$part1"
  else
    bucket="${part1}_${part2}"
  fi

  if [ -z "${GROUP_FLOWS[$bucket]+x}" ]; then
    GROUP_ORDER+=("$bucket")
    GROUP_FLOWS[$bucket]=""
  fi
  if [ -z "${GROUP_FLOWS[$bucket]}" ]; then
    GROUP_FLOWS[$bucket]="$flow"
  else
    GROUP_FLOWS[$bucket]="${GROUP_FLOWS[$bucket]}|$flow"
  fi
done

NUM_GROUPS=${#GROUP_ORDER[@]}
echo "  Feature groups: $NUM_GROUPS ($(IFS=', '; echo "${GROUP_ORDER[*]}"))"
echo ""

# ── Resolve available device IDs ──────────────────────────────────────────────
DEVICE_IDS=()
if [ ${#EXPLICIT_DEVICES[@]} -gt 0 ]; then
  DEVICE_IDS=("${EXPLICIT_DEVICES[@]}")
elif [ "$PLATFORM" = "ios" ]; then
  while IFS= read -r id; do
    [ -n "$id" ] && DEVICE_IDS+=("$id")
  done < <(xcrun simctl list devices booted --json 2>/dev/null \
    | python3 -c "
import sys,json
d=json.load(sys.stdin)
[print(dev['udid']) for devs in d.get('devices',{}).values() for dev in devs if dev.get('state')=='Booted']
" 2>/dev/null || true)
else
  while IFS= read -r id; do
    [ -n "$id" ] && DEVICE_IDS+=("$id")
  done < <(adb devices 2>/dev/null | grep 'device$' | awk '{print $1}' || true)
fi

# Auto-boot additional iOS simulators if needed
if [ "$PLATFORM" = "ios" ] && [ ${#DEVICE_IDS[@]} -lt "$MAX_SIMULATORS" ]; then
  needed=$(( MAX_SIMULATORS - ${#DEVICE_IDS[@]} ))
  echo -e "${YELLOW}Only ${#DEVICE_IDS[@]} simulator(s) booted, attempting to boot $needed more...${NC}"
  SHUTDOWN_IDS=()
  while IFS= read -r id; do
    [ -n "$id" ] && SHUTDOWN_IDS+=("$id")
  done < <(xcrun simctl list devices available --json 2>/dev/null \
    | python3 -c "
import sys,json
d=json.load(sys.stdin)
booted=set([$(printf '"%s",' "${DEVICE_IDS[@]:-}" | sed 's/,$//')])
[print(dev['udid']) for devs in d.get('devices',{}).values() for dev in devs
 if dev.get('state')=='Shutdown' and dev['udid'] not in booted]
" 2>/dev/null | head -n "$needed" || true)

  for udid in "${SHUTDOWN_IDS[@]:-}"; do
    xcrun simctl boot "$udid" 2>/dev/null || true
    DEVICE_IDS+=("$udid")
  done
  [ ${#SHUTDOWN_IDS[@]:-0} -gt 0 ] && sleep 8
fi

if [ ${#DEVICE_IDS[@]} -eq 0 ]; then
  echo -e "${RED}❌ No devices available. Boot a simulator or connect a device first.${NC}"
  exit 1
fi

ACTUAL_PARALLEL=$(( MAX_SIMULATORS < ${#DEVICE_IDS[@]} ? MAX_SIMULATORS : ${#DEVICE_IDS[@]} ))
echo "  Active devices: $ACTUAL_PARALLEL of ${#DEVICE_IDS[@]} available"
echo ""

# ── Create output directory ───────────────────────────────────────────────────
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
REPORT_BASE="$PROJECT_ROOT/test-reports/PARALLEL_${PLATFORM^^}_${TIMESTAMP}"
mkdir -p "$REPORT_BASE"

# ── Generate per-group mini-suite YAMLs ───────────────────────────────────────
MINI_SUITE_DIR="$REPORT_BASE/.mini-suites"
mkdir -p "$MINI_SUITE_DIR"

declare -A GROUP_SUITE_FILE
for group in "${GROUP_ORDER[@]}"; do
  suite_yaml="$MINI_SUITE_DIR/${group}.yaml"
  {
    echo "# Auto-generated mini-suite for parallel group: $group"
    IFS='|' read -ra flows <<< "${GROUP_FLOWS[$group]}"
    for f in "${flows[@]}"; do
      echo "- runFlow:"
      echo "    file: $f"
    done
  } > "$suite_yaml"
  GROUP_SUITE_FILE[$group]="$suite_yaml"
done

# ── Dispatch groups to simulators ────────────────────────────────────────────
echo -e "${BLUE}Dispatching $NUM_GROUPS feature groups across $ACTUAL_PARALLEL simulators...${NC}"
echo ""

GATE_ENV=""
[ "$WARN_ONLY_GATES" = "true" ] && GATE_ENV="PRE_RUN_WARN_ONLY=true"

GROUP_PIDS=()
GROUP_NAMES=()
GROUP_REPORTS=()

for i in "${!GROUP_ORDER[@]}"; do
  group="${GROUP_ORDER[$i]}"
  device="${DEVICE_IDS[$((i % ACTUAL_PARALLEL))]}"
  group_report="$REPORT_BASE/${group}"
  mkdir -p "$group_report"

  IFS='|' read -ra flows <<< "${GROUP_FLOWS[$group]}"
  flow_count=${#flows[@]}

  echo -e "  [slot $((i % ACTUAL_PARALLEL + 1))] ${BLUE}${group}${NC} — $flow_count flows → $device"

  (
    export PARALLEL_MODE=true
    export TEST_TIMEOUT=$FLOW_TIMEOUT
    [ -n "$GATE_ENV" ] && export PRE_RUN_WARN_ONLY=true
    bash "$SCRIPT_DIR/run-test-suite.sh" \
      "${GROUP_SUITE_FILE[$group]}" \
      --platform "$PLATFORM" \
      --device "$device" \
      --skip-setup \
      --no-browser \
      > "$group_report/runner.log" 2>&1
    # Capture the exit code for collection below
    echo $? > "$group_report/exit_code"
  ) &

  GROUP_PIDS+=($!)
  GROUP_NAMES+=("$group")
  GROUP_REPORTS+=("$group_report")
done

echo ""
echo -e "${BLUE}Waiting for all groups to finish...${NC}"
echo ""

# ── Collect results ───────────────────────────────────────────────────────────
SUITE_START_SECS=$SECONDS
TOTAL_PASSED=0
TOTAL_FAILED=0
TOTAL_FLOWS=0
FAILED_GROUPS=()

for i in "${!GROUP_PIDS[@]}"; do
  pid=${GROUP_PIDS[$i]}
  group=${GROUP_NAMES[$i]}
  report_dir=${GROUP_REPORTS[$i]}

  wait "$pid" 2>/dev/null || true
  exit_code_file="$report_dir/exit_code"
  rc=0
  [ -f "$exit_code_file" ] && rc=$(cat "$exit_code_file")

  # Read per-group results JSON if available
  results_json=$(find "$report_dir" -name "suite-results.json" | head -1 || true)
  group_passed=0
  group_failed=0
  if [ -n "$results_json" ] && command -v node &>/dev/null; then
    group_passed=$(node -e "const r=require('$results_json'); console.log(r.summary.passed)" 2>/dev/null || echo 0)
    group_failed=$(node -e "const r=require('$results_json'); console.log(r.summary.failed)" 2>/dev/null || echo 0)
  elif [ "$rc" -ne 0 ]; then
    IFS='|' read -ra flows <<< "${GROUP_FLOWS[$group]}"
    group_failed=${#flows[@]}
  else
    IFS='|' read -ra flows <<< "${GROUP_FLOWS[$group]}"
    group_passed=${#flows[@]}
  fi

  TOTAL_PASSED=$((TOTAL_PASSED + group_passed))
  TOTAL_FAILED=$((TOTAL_FAILED + group_failed))
  TOTAL_FLOWS=$((TOTAL_FLOWS + group_passed + group_failed))

  if [ "$rc" -eq 0 ]; then
    echo -e "  ${GREEN}✓${NC} ${group}: ${group_passed} passed"
  else
    echo -e "  ${RED}✗${NC} ${group}: ${group_failed} failed, ${group_passed} passed"
    FAILED_GROUPS+=("$group")
  fi
done

ELAPSED=$(( SECONDS - SUITE_START_SECS ))
ELAPSED_MIN=$(( ELAPSED / 60 ))
ELAPSED_SEC=$(( ELAPSED % 60 ))

echo ""
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Parallel Suite Summary${NC}"
echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
echo "  Total flows: $TOTAL_FLOWS"
echo -e "  Passed:      ${GREEN}$TOTAL_PASSED${NC}"
echo -e "  Failed:      ${RED}$TOTAL_FAILED${NC}"
echo "  Wall time:   ${ELAPSED_MIN}m ${ELAPSED_SEC}s"
echo ""

# ── Write merged summary JSON ─────────────────────────────────────────────────
SUMMARY_JSON="$REPORT_BASE/parallel-summary.json"
{
  echo "{"
  echo "  \"suite\": \"$(basename "$SUITE_FILE")\","
  echo "  \"platform\": \"$PLATFORM\","
  echo "  \"timestamp\": \"$TIMESTAMP\","
  echo "  \"wallTimeSeconds\": $ELAPSED,"
  echo "  \"groups\": ${#GROUP_ORDER[@]},"
  echo "  \"simulators\": $ACTUAL_PARALLEL,"
  echo "  \"summary\": {"
  echo "    \"total\": $TOTAL_FLOWS,"
  echo "    \"passed\": $TOTAL_PASSED,"
  echo "    \"failed\": $TOTAL_FAILED"
  echo "  }"
  echo "}"
} > "$SUMMARY_JSON"

# ── Generate unified HTML report ──────────────────────────────────────────────
if command -v node &>/dev/null; then
  COMBINED_XML="$REPORT_BASE/combined.xml"
  COMBINED_HTML="$REPORT_BASE/parallel-report.html"

  node -e "
    const fs = require('fs'), path = require('path');
    const groups = $(printf '"%s",' "${GROUP_NAMES[@]}" | sed 's/,$//');
    const reportBase = '$REPORT_BASE';
    let passed=0, failed=0, total=0, cases='';

    groups.forEach(g => {
      const jf = fs.readdirSync(path.join(reportBase, g)).find(f => f === 'suite-results.json');
      if (!jf) return;
      const r = JSON.parse(fs.readFileSync(path.join(reportBase, g, jf), 'utf8'));
      (r.tests || []).forEach(t => {
        total++;
        if (t.status === 'failed') { failed++; cases += '<testcase name=\"' + t.name + '\" time=\"' + (t.duration||0) + '\"><failure>failed</failure></testcase>\n'; }
        else { passed++; cases += '<testcase name=\"' + t.name + '\" time=\"' + (t.duration||0) + '\"/>\n'; }
      });
    });

    const xml = '<?xml version=\"1.0\"?>\n<testsuite name=\"Parallel Suite\" tests=\"' + total + '\" failures=\"' + failed + '\" time=\"0\">\n' + cases + '</testsuite>\n';
    fs.writeFileSync('$COMBINED_XML', xml);
  " 2>/dev/null || true

  if [ -f "$COMBINED_XML" ]; then
    REPORT_DIR="$REPORT_BASE" node "$SCRIPT_DIR/../reporting/generate-unified-report.js" \
      "$COMBINED_XML" "$COMBINED_HTML" "$PLATFORM" 2>/dev/null || true
    rm -f "$COMBINED_XML"
  fi

  if [ -f "$COMBINED_HTML" ]; then
    echo -e "${GREEN}✓ Report: $COMBINED_HTML${NC}"
    [ "$NO_BROWSER" = "false" ] && open "$COMBINED_HTML" 2>/dev/null || true
  fi
fi

echo ""
[ ${#FAILED_GROUPS[@]} -gt 0 ] && echo -e "${RED}Failed groups: ${FAILED_GROUPS[*]}${NC}"
echo "  Reports: $REPORT_BASE/"
echo ""

# Cleanup mini-suite files
rm -rf "$MINI_SUITE_DIR"

[ "$TOTAL_FAILED" -gt 0 ] && exit 1 || exit 0
