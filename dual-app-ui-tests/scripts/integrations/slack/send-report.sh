#!/bin/bash

# =============================================================================
# Maestro UI Tests — Send Report to Slack
# =============================================================================
# Sends an existing test report to Slack manually, or can be called from CI.
# Works for both single-test runs and suite runs.
#
# Usage:
#   # Auto-detect latest report (simplest)
#   ./scripts/integrations/slack/send-report.sh
#
#   # Specify a report explicitly
#   ./scripts/integrations/slack/send-report.sh --report test-reports/IOS_20260707_133115
#
#   # Override status / suite name
#   ./scripts/integrations/slack/send-report.sh \
#     --report test-reports/IOS_20260707_133115 \
#     --name   "Smart Scheduler Smoke" \
#     --status passed
#
# Environment variables (set in .env or export before running):
#   SLACK_WEBHOOK_URL   — required
#   REPORT_BASE_URL     — optional; converts file:// to an HTTP link in the message
#   PLATFORM            — ios|android (default: ios)
#   ENVIRONMENT         — qa|prod    (default: qa)
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Load .env if present and not already sourced
if [ -f "$PROJECT_ROOT/.env" ] && [ -z "${_ENV_LOADED:-}" ]; then
  set -o allexport
  # shellcheck disable=SC1091
  source "$PROJECT_ROOT/.env"
  set +o allexport
  _ENV_LOADED=1
fi

# ─── Colors ──────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; BLUE='\033[0;34m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'

# ─── Defaults ────────────────────────────────────────────────────────────────
REPORT_DIR=""
SUITE_NAME=""
STATUS_OVERRIDE=""
PLATFORM="${PLATFORM:-ios}"
ENVIRONMENT="${ENVIRONMENT:-qa}"

# ─── Argument parsing ─────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --report)         REPORT_DIR="$2";       shift 2 ;;
    --name)           SUITE_NAME="$2";       shift 2 ;;
    --status)         STATUS_OVERRIDE="$2";  shift 2 ;;
    --platform)       PLATFORM="$2";         shift 2 ;;
    --environment)    ENVIRONMENT="$2";      shift 2 ;;
    --webhook)
      SLACK_WEBHOOK_URL="$2"
      export SLACK_WEBHOOK_URL
      shift 2
      ;;
    --help|-h)
      sed -n '/^# Usage:/,/^# ===/p' "$0" | sed 's/^# //; s/^#//'
      exit 0
      ;;
    *) echo -e "${RED}Unknown option: $1${NC}" >&2; exit 1 ;;
  esac
done

# ─── Validate credentials ─────────────────────────────────────────────────────
# Accept either Incoming Webhook (SLACK_WEBHOOK_URL) or Bot Token (SLACK_BOT_TOKEN + SLACK_CHANNEL)
HAS_WEBHOOK=$( [ -n "${SLACK_WEBHOOK_URL:-}" ] && echo "yes" || echo "" )
HAS_BOT=$( [ -n "${SLACK_BOT_TOKEN:-}" ] && [ -n "${SLACK_CHANNEL:-}" ] && echo "yes" || echo "" )

if [ -z "$HAS_WEBHOOK" ] && [ -z "$HAS_BOT" ]; then
  echo -e "${RED}❌ No Slack credentials configured.${NC}"
  echo "   In .env, set ONE of:"
  echo "     SLACK_WEBHOOK_URL=https://hooks.slack.com/services/..."
  echo "     SLACK_BOT_TOKEN=xoxb-...  +  SLACK_CHANNEL=#channel-name"
  exit 1
fi

# ─── Find report directory ────────────────────────────────────────────────────
if [ -z "$REPORT_DIR" ]; then
  # Auto-detect: use the most recent dated report folder
  REPORT_DIR=$(ls -dt "$PROJECT_ROOT/test-reports"/[AI][ON][SD]_* 2>/dev/null | head -1)
  if [ -z "$REPORT_DIR" ]; then
    echo -e "${RED}❌ No test reports found in test-reports/.${NC}"
    echo "   Run a test first, or specify --report <path>"
    exit 1
  fi
  echo -e "${BLUE}ℹ️  Auto-detected latest report: $(basename "$REPORT_DIR")${NC}"
fi

# Resolve to absolute path
[[ "$REPORT_DIR" != /* ]] && REPORT_DIR="$PROJECT_ROOT/$REPORT_DIR"

if [ ! -d "$REPORT_DIR" ]; then
  echo -e "${RED}❌ Report directory not found: $REPORT_DIR${NC}"
  exit 1
fi

# ─── Locate report files ──────────────────────────────────────────────────────
# Prefer suite report, fall back to single-test report
REPORT_FILE=""
RESULTS_JSON=""

if [ -f "$REPORT_DIR/suite-report.html" ]; then
  REPORT_FILE="$REPORT_DIR/suite-report.html"
elif [ -f "$REPORT_DIR/test-report-latest.html" ]; then
  REPORT_FILE="$REPORT_DIR/test-report-latest.html"
else
  REPORT_FILE=$(ls "$REPORT_DIR"/*.html 2>/dev/null | head -1)
fi

if [ -f "$REPORT_DIR/suite-results.json" ]; then
  RESULTS_JSON="$REPORT_DIR/suite-results.json"
elif [ -f "$REPORT_DIR/results.json" ]; then
  RESULTS_JSON="$REPORT_DIR/results.json"
fi

# ─── Parse results from JSON ──────────────────────────────────────────────────
TOTAL=0; PASSED=0; FAILED=0; DURATION="N/A"

if [ -n "$RESULTS_JSON" ] && [ -f "$RESULTS_JSON" ] && command -v node &>/dev/null; then
  _PARSED=$(node -e "
    try {
      const d = JSON.parse(require('fs').readFileSync('$RESULTS_JSON','utf8'));
      const tests = d.tests || [];
      const total  = tests.length || d.total  || 0;
      const passed = tests.filter(t=>t.status==='passed').length || d.passed || 0;
      const failed = tests.filter(t=>t.status!=='passed').length || d.failed || 0;
      const dur    = d.duration || d.durationMs
        ? Math.round((d.durationMs||d.duration||0)/1000)
        : 0;
      const min = Math.floor(dur/60), sec = dur%60;
      console.log([total, passed, failed, dur>0 ? min+'m '+sec+'s' : 'N/A'].join('|'));
    } catch(e) { console.log('0|0|0|N/A'); }
  " 2>/dev/null || echo "0|0|0|N/A")
  IFS='|' read -r TOTAL PASSED FAILED DURATION <<< "$_PARSED"
fi

# Fallback: derive TOTAL/PASSED/FAILED from report filename or directory name
if [ "$TOTAL" -eq 0 ] && [ -n "$REPORT_FILE" ]; then
  # Try to count from HTML (basic)
  _COUNTS=$(grep -oE 'Passed: [0-9]+|Failed: [0-9]+|Total: [0-9]+' "$REPORT_FILE" 2>/dev/null | head -3 || true)
  _P=$(echo "$_COUNTS" | grep "Passed" | grep -oE '[0-9]+' || echo 0)
  _F=$(echo "$_COUNTS" | grep "Failed" | grep -oE '[0-9]+' || echo 0)
  PASSED="${_P:-0}"; FAILED="${_F:-0}"
  TOTAL=$(( PASSED + FAILED ))
fi

# ─── Determine status ─────────────────────────────────────────────────────────
if [ -n "$STATUS_OVERRIDE" ]; then
  STATUS="$STATUS_OVERRIDE"
elif [ "$FAILED" -gt 0 ]; then
  STATUS="failed"
else
  STATUS="passed"
fi

# ─── Suite name ───────────────────────────────────────────────────────────────
if [ -z "$SUITE_NAME" ]; then
  FOLDER_NAME=$(basename "$REPORT_DIR")           # e.g. IOS_20260707_133115
  SUITE_NAME="$(echo "$FOLDER_NAME" | sed 's/_/ /g') Report"
fi

# ─── Summary ─────────────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}📤 Sending Slack notification...${NC}"
echo -e "   Report : $(basename "$REPORT_DIR")"
echo -e "   Status : $STATUS  |  Total: $TOTAL  Passed: $PASSED  Failed: $FAILED"
echo -e "   Platform: $PLATFORM  |  Env: $ENVIRONMENT"
echo ""

# ─── Call notifier ────────────────────────────────────────────────────────────
NOTIFY_ARGS=(
  --status       "$STATUS"
  --suite-name   "$SUITE_NAME"
  --platform     "$PLATFORM"
  --environment  "$ENVIRONMENT"
  --total        "$TOTAL"
  --passed       "$PASSED"
  --failed       "$FAILED"
  --duration     "$DURATION"
)

[ -n "$REPORT_FILE" ] && NOTIFY_ARGS+=(--report-path "$REPORT_FILE")
[ -n "$RESULTS_JSON" ] && NOTIFY_ARGS+=(--results-json "$RESULTS_JSON")

node "$SCRIPT_DIR/slack-notify.js" "${NOTIFY_ARGS[@]}"

echo -e "${GREEN}✅ Done${NC}"
