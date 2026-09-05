#!/bin/bash
###############################################################################
# Parallel Cross-Platform Test Runner
#
# Runs the same Maestro target (suite, flow, or custom path) on both iOS and
# Android simultaneously.
#
# For suite paths (.maestro/apps/*/suites/*.yaml or .maestro/flows/suites/*.yaml)
# each platform is invoked via scripts/testing/run-test-suite.sh.
# For any other path (a single flow YAML or custom path) each platform is
# invoked via scripts/testing/test.sh.
#
# Both child scripts are called with PARALLEL_MODE=true so their global
# Maestro-process cleanup is skipped (it would kill the other run). The wrapper
# handles a single final cleanup once both platforms finish.
#
# Usage:
#   bash scripts/testing/run-both-platforms.sh <target.yaml> [--ios-device <id>] [--android-device <id>] [--slack] [--skip-setup]
#
# Notes:
#  - iOS Maestro binds tcp:7001; Android Maestro uses ADB and does not need it.
#    Running one iOS + N Android in parallel is safe. Two iOS in parallel is not.
#  - Reports for each platform land in their normal per-platform test-reports dirs.
#  - If --slack is passed, each child sends its own Slack notification and the
#    wrapper adds one combined summary at the end.
#  - --skip-setup is IMPLIED in parallel mode. Boot your iOS simulator and
#    Android emulator BEFORE invoking this wrapper (device setup scripts are
#    destructive to ADB state and would break the parallel run).
###############################################################################

set -u

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_ROOT" || exit 1

# ─── Graceful shutdown handler ──────────────────────────────────────────────
#
# The dashboard (dashboard/server.js /api/kill) sends SIGTERM to this
# wrapper's process group. Without a trap, bash would exit immediately,
# leaving each child test.sh / run-test-suite.sh dangling and — worse —
# leaving Maestro's XCTest driver with a live accessibility observer inside
# SpringBoard (that combination is what causes the SpringBoard segfaults
# observed in ~/Library/Logs/DiagnosticReports/SpringBoard-*.ips).
#
# With a trap, we forward the signal to the two backgrounded child PIDs
# and let their own SIGTERM traps in test.sh / run-test-suite.sh run their
# graceful cleanup (release a11y observer, finalize Maestro debug log store,
# reap inspectors). Then we wait for them to exit before doing the final
# unified sweep at the bottom of this script.
_WRAPPER_SHUTTING_DOWN=false
_shutdown() {
  # Guard against double-invocation from a burst of SIGTERM+SIGINT.
  if [ "$_WRAPPER_SHUTTING_DOWN" = "true" ]; then return; fi
  _WRAPPER_SHUTTING_DOWN=true

  echo ""
  echo -e "${YELLOW}⚠  Wrapper received signal — forwarding SIGTERM to children and waiting for graceful shutdown...${NC}"

  # Forward SIGTERM to each backgrounded child if we've reached the point
  # where their PIDs are set. `kill -0` checks existence; `|| true` covers
  # the (rare) case of a race with normal exit.
  if [ -n "${IOS_PID:-}" ] && kill -0 "$IOS_PID" 2>/dev/null; then
    kill -TERM "$IOS_PID" 2>/dev/null || true
    echo -e "${YELLOW}  → SIGTERM sent to iOS child (PID $IOS_PID)${NC}"
  fi
  if [ -n "${ANDROID_PID:-}" ] && kill -0 "$ANDROID_PID" 2>/dev/null; then
    kill -TERM "$ANDROID_PID" 2>/dev/null || true
    echo -e "${YELLOW}  → SIGTERM sent to Android child (PID $ANDROID_PID)${NC}"
  fi

  # The main body's `wait` calls will now return with the children's exit
  # codes once their traps finish. Do NOT `exit` from inside the handler —
  # let the main body proceed to the final cleanup block so it runs even on
  # signal-triggered shutdowns.
}
trap _shutdown TERM INT

TARGET_FILE=""
IOS_DEVICE=""
ANDROID_DEVICE=""
SLACK_FLAG=""
SKIP_SETUP_FLAG=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --ios-device)
      IOS_DEVICE="$2"; shift 2 ;;
    --android-device)
      ANDROID_DEVICE="$2"; shift 2 ;;
    --slack)
      SLACK_FLAG="--slack"; shift ;;
    --skip-setup)
      SKIP_SETUP_FLAG="--skip-setup"; shift ;;
    -h|--help)
      grep -E '^# (Usage|  |Notes)' "$0" | sed 's/^# //'
      exit 0 ;;
    *)
      TARGET_FILE="$1"; shift ;;
  esac
done

# In parallel mode, running the setup scripts is destructive: android-setup.sh
# calls `adb kill-server` which disconnects EVERY emulator/device (breaking the
# iOS run's ADB-adjacent tooling and rebooting the Android target mid-run),
# and both platforms reboot their devices at start. Force --skip-setup so the
# wrapper runs against already-booted devices. Boot them yourself beforehand
# (e.g. from the dashboard's Diagnose iOS / android-setup boot steps).
if [ -z "$SKIP_SETUP_FLAG" ]; then
  echo "ℹ️  Parallel mode: forcing --skip-setup (device reboots + adb-restart during setup would break parallel runs)"
  SKIP_SETUP_FLAG="--skip-setup"
fi

if [ -z "$TARGET_FILE" ]; then
  echo -e "${RED}Error: target file required${NC}"
  echo "Usage: bash scripts/testing/run-both-platforms.sh <target.yaml> [--ios-device <id>] [--android-device <id>] [--slack] [--skip-setup]"
  exit 1
fi

if [ ! -f "$TARGET_FILE" ]; then
  echo -e "${RED}Error: target file not found: $TARGET_FILE${NC}"
  exit 1
fi

# ─── Dispatch target type: suite → run-test-suite.sh, else → test.sh ────────
is_suite_path() {
  case "$1" in
    *.maestro/apps/*/suites/*.yaml|*.maestro/flows/suites/*.yaml) return 0 ;;
    *) return 1 ;;
  esac
}

if is_suite_path "$TARGET_FILE"; then
  TARGET_KIND="suite"
else
  TARGET_KIND="flow"
fi

# Runs one platform's test with PARALLEL_MODE=true, dispatching to the right
# child script based on target kind.
run_platform() {
  local platform="$1"
  local device="$2"
  local target="$3"
  if [ "$TARGET_KIND" = "suite" ]; then
    PARALLEL_MODE=true bash "$SCRIPT_DIR/run-test-suite.sh" "$target" \
      --platform "$platform" --device "$device" $SLACK_FLAG $SKIP_SETUP_FLAG
  else
    PARALLEL_MODE=true bash "$SCRIPT_DIR/test.sh" "$target" \
      --platform "$platform" --device "$device" $SLACK_FLAG $SKIP_SETUP_FLAG
  fi
}

# ─── Auto-detect devices if not provided ────────────────────────────────────
if [ -z "$IOS_DEVICE" ]; then
  IOS_DEVICE=$(xcrun simctl list devices 2>/dev/null | grep "Booted" | grep -E -o '[0-9A-F-]{36}' | head -1)
fi
if [ -z "$ANDROID_DEVICE" ]; then
  ANDROID_DEVICE=$(adb devices 2>/dev/null | awk '/\tdevice$/ {print $1; exit}')
fi

if [ -z "$IOS_DEVICE" ]; then
  echo -e "${RED}Error: no booted iOS simulator found (and --ios-device not given)${NC}"
  exit 1
fi
if [ -z "$ANDROID_DEVICE" ]; then
  echo -e "${RED}Error: no connected Android device found (and --android-device not given)${NC}"
  exit 1
fi

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Parallel Cross-Platform Test Runner                       ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo -e "${BLUE}Target:${NC}   $TARGET_FILE  ($TARGET_KIND)"
echo -e "${BLUE}iOS:${NC}      $IOS_DEVICE"
echo -e "${BLUE}Android:${NC}  $ANDROID_DEVICE"
[ -n "$SLACK_FLAG" ] && echo -e "${BLUE}Slack:${NC}    enabled"
echo ""

# ─── Ensure a clean slate before parallel run ───────────────────────────────
echo -e "${BLUE}Pre-run cleanup (one-shot)...${NC}"
pkill -9 -f 'maestro.*driver'  2>/dev/null || true
pkill -9 -f 'maestro.*server'  2>/dev/null || true
pkill -9 -f 'maestro-driver-ios' 2>/dev/null || true
lsof -ti tcp:7001 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 2
echo ""

# ─── Kick off both platforms in parallel ─────────────────────────────────────
WRAPPER_START=$SECONDS
IOS_LOG="/tmp/run-both-ios-$$.log"
ANDROID_LOG="/tmp/run-both-android-$$.log"

echo -e "${BLUE}▶ Starting iOS $TARGET_KIND...${NC}"
( run_platform ios     "$IOS_DEVICE"     "$TARGET_FILE" ) > "$IOS_LOG" 2>&1 &
IOS_PID=$!

# Small stagger — lets iOS's Maestro start its shard scheduler ahead of
# Android's. Both platforms' Maestro CLIs default to port 7001 for their
# first shard (Maestro's per-process `selectPort` starts at 7001 and doesn't
# check machine-wide availability). We DO NOT want to wait for iOS to fully
# bind 7001 before launching Android — if we do, Android's later `adb
# forward tcp:7001 tcp:<device>` gets refused (iOS owns the socket) and
# Android's flow dies with "UNAVAILABLE: Connection refused: localhost:7001".
#
# The correct race window: launch Android during iOS's ~15s XCTest-driver
# warmup, BEFORE iOS actually binds 7001. Android's dadb will `adb forward
# tcp:7001` (iOS hasn't bound it yet, so this succeeds), then when iOS finally
# binds it collides silently → both platforms end up on distinct ports.
# The visible cost is a one-time harmless `dadb.open(tcp:7001): closed` /
# `Command failed (tcp:7001): closed` stack trace in the Android log — that
# noise is preferable to a hard fail.
sleep 3

echo -e "${BLUE}▶ Starting Android $TARGET_KIND...${NC}"
( run_platform android "$ANDROID_DEVICE" "$TARGET_FILE" ) > "$ANDROID_LOG" 2>&1 &
ANDROID_PID=$!

echo ""
echo -e "${BLUE}Both platforms running. iOS PID=$IOS_PID Android PID=$ANDROID_PID${NC}"
echo -e "${BLUE}Live logs:${NC}"
echo -e "  iOS:     $IOS_LOG"
echo -e "  Android: $ANDROID_LOG"
echo ""

# ─── Live-stream both platforms' output, prefixed, while they run ──────────
# Each child already writes its full output to its own log file (redirected
# above) — that part of the interference-avoidance design is untouched. This
# just also follows both files here so the terminal shows real-time progress
# (matching what run-ios-test.sh/run-android-test.sh show directly) instead of a
# bare "running/done" ticker. `read` processes lines as they arrive; no
# GNU-vs-BSD sed/awk buffering-flag portability concerns.
( tail -n +1 -f "$IOS_LOG" 2>/dev/null | while IFS= read -r _line; do
    printf "${BLUE}[iOS]${NC}     %s\n" "$_line"
  done ) &
TAIL_IOS_PID=$!
( tail -n +1 -f "$ANDROID_LOG" 2>/dev/null | while IFS= read -r _line; do
    printf "${BLUE}[Android]${NC} %s\n" "$_line"
  done ) &
TAIL_ANDROID_PID=$!

while kill -0 $IOS_PID 2>/dev/null || kill -0 $ANDROID_PID 2>/dev/null; do
  sleep 1
done

# Both children have exited — give the tail followers a moment to flush any
# last-written lines, then stop them (tail -f never exits on its own, even
# once the writer is gone, since the log file itself is still there).
sleep 1
kill "$TAIL_IOS_PID" "$TAIL_ANDROID_PID" 2>/dev/null || true
wait "$TAIL_IOS_PID" "$TAIL_ANDROID_PID" 2>/dev/null || true
echo ""

# Wait for each child with a signal-safe loop.
#
# Bash's `wait <pid>` returns 128+signum if the shell handles a signal while
# waiting (even if the trap is set to a function that just returns), which
# would give a bogus exit code and prematurely skip the second wait. Loop
# until the pid actually no longer exists, then read its final exit status.
_wait_pid() {
  local pid="$1"
  local rc=0
  # Poll-wait: retries on 127+ (signal-interrupted) exits.
  while kill -0 "$pid" 2>/dev/null; do
    wait "$pid"
    rc=$?
    # `wait` returned normally (process exited) — break with its exit code.
    if [ $rc -lt 128 ]; then
      return $rc
    fi
    # Otherwise wait was signal-interrupted; loop and re-wait.
  done
  return $rc
}

_wait_pid "$IOS_PID"; IOS_EXIT=$?
_wait_pid "$ANDROID_PID"; ANDROID_EXIT=$?
WRAPPER_ELAPSED=$((SECONDS - WRAPPER_START))

# Once we've reaped both children, the trap doesn't need to do any more
# forwarding — clear it so a spurious signal during cleanup doesn't loop.
trap - TERM INT

# ─── Final unified cleanup (now safe — no other Maestro run to protect) ─────
#
# IMPORTANT: SIGTERM first, then SIGKILL only if the process survives 2s.
# On iOS 26.x + Xcode 26.x, sending SIGKILL directly to `maestro-driver-ios`
# or the `maestro test` JVM leaves XCTAutomationSession holding a stale
# accessibility observer inside the simulator's SpringBoard. When SpringBoard
# fires that observer callback next, the block dereferences a freed
# dataSource → EXC_BAD_ACCESS at 0x20 → SpringBoard segfault (crash reports
# under ~/Library/Logs/DiagnosticReports/SpringBoard-*.ips). Graceful SIGTERM
# lets the JVM run its shutdown hooks, disassociate the a11y observer, and
# finalize its debug log zip before we hard-kill anything still stuck.
echo -e "${BLUE}Final cleanup...${NC}"
pkill -TERM -f 'maestro-driver-ios'   2>/dev/null || true
pkill -TERM -f 'maestro.*driver'      2>/dev/null || true
pkill -TERM -f 'maestro.*server'      2>/dev/null || true
pkill -TERM -f 'maestro test'         2>/dev/null || true
pkill -TERM -f 'java.*maestro'        2>/dev/null || true
pkill -TERM -f 'dadb'                 2>/dev/null || true
sleep 2
# Fall back to SIGKILL only for anything that didn't respond to SIGTERM.
pkill -9 -f 'maestro-driver-ios'   2>/dev/null || true
pkill -9 -f 'maestro.*driver'      2>/dev/null || true
pkill -9 -f 'maestro.*server'      2>/dev/null || true
pkill -9 -f 'maestro test'         2>/dev/null || true
pkill -9 -f 'java.*maestro'        2>/dev/null || true
pkill -9 -f 'dadb'                 2>/dev/null || true
lsof -ti tcp:7001 2>/dev/null | xargs kill -9 2>/dev/null || true

echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Combined Results                                          ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"

# ─── Per-platform result echo (tail of each log) ────────────────────────────
echo -e "${BLUE}--- iOS (last 20 lines) ---${NC}"
tail -20 "$IOS_LOG"
echo ""
echo -e "${BLUE}--- Android (last 20 lines) ---${NC}"
tail -20 "$ANDROID_LOG"
echo ""

WRAPPER_MIN=$(( WRAPPER_ELAPSED / 60 ))
WRAPPER_SEC=$(( WRAPPER_ELAPSED % 60 ))
WRAPPER_DURATION="${WRAPPER_MIN}m ${WRAPPER_SEC}s"

if [ $IOS_EXIT -eq 0 ] && [ $ANDROID_EXIT -eq 0 ]; then
  OVERALL_STATUS="passed"
  echo -e "${GREEN}✅ Both platforms PASSED (wall time: $WRAPPER_DURATION)${NC}"
  EXIT_CODE=0
else
  OVERALL_STATUS="failed"
  echo -e "${RED}❌ At least one platform FAILED — iOS=$IOS_EXIT Android=$ANDROID_EXIT (wall time: $WRAPPER_DURATION)${NC}"
  EXIT_CODE=1
fi

# ─── Combined Slack summary (optional) ──────────────────────────────────────
# The child scripts already sent per-platform Slack messages if --slack was on.
# Post one extra summary message here so the channel sees the combined result.
if [ -n "$SLACK_FLAG" ] && [ -n "${SLACK_WEBHOOK_URL:-}" ] && command -v node &>/dev/null; then
  SUITE_DISPLAY="$(basename "$TARGET_FILE" .yaml | tr '_' ' ') (BOTH PLATFORMS)"
  node "$SCRIPT_DIR/../utils/slack-notify.js" \
    --status       "$OVERALL_STATUS" \
    --suite-name   "$SUITE_DISPLAY" \
    --platform     "ios+android" \
    --app          "" \
    --environment  "${ENVIRONMENT:-qa}" \
    --total        2 \
    --passed       $([ $IOS_EXIT -eq 0 ] && [ $ANDROID_EXIT -eq 0 ] && echo 2 || ([ $IOS_EXIT -eq 0 ] || [ $ANDROID_EXIT -eq 0 ] && echo 1 || echo 0)) \
    --failed       $([ $IOS_EXIT -ne 0 ] && [ $ANDROID_EXIT -ne 0 ] && echo 2 || ([ $IOS_EXIT -ne 0 ] || [ $ANDROID_EXIT -ne 0 ] && echo 1 || echo 0)) \
    --duration     "$WRAPPER_DURATION" \
    --duration-seconds "$WRAPPER_ELAPSED" 2>/dev/null || true
fi

# Clean up the temp log files (they were already streamed to stdout)
rm -f "$IOS_LOG" "$ANDROID_LOG" 2>/dev/null || true

exit $EXIT_CODE
