#!/bin/bash
###############################################################################
# Visual Regression — Screenshot Comparison
#
# Stores baseline screenshots per test and diffs new screenshots against them.
# Uses ImageMagick (convert + compare) if installed, falls back to md5 diff.
#
# Usage:
#   # Approve current screenshots as baseline for a test:
#   bash scripts/visual-regression/compare.sh approve TC001_SS_loa1_user_blocked
#
#   # Compare current run against baseline (run after test completes):
#   bash scripts/visual-regression/compare.sh check TC001_SS_loa1_user_blocked
#
#   # Compare all tests in latest report dir:
#   bash scripts/visual-regression/compare.sh check-all
#
#   # List tests that have baselines:
#   bash scripts/visual-regression/compare.sh list
###############################################################################

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BASELINE_DIR="$PROJECT_ROOT/.maestro/visual-baselines"
REPORTS_DIR="$PROJECT_ROOT/test-reports"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'

COMMAND="${1:-help}"
TEST_NAME="${2:-}"
DIFF_THRESHOLD="${DIFF_THRESHOLD:-5}"  # % pixel difference threshold

# ── Helpers ───────────────────────────────────────────────────────────────────

has_imagemagick() { command -v compare &>/dev/null && command -v convert &>/dev/null; }

latest_report_dir() {
  find "$REPORTS_DIR" -maxdepth 1 -type d \( -name "IOS_*" -o -name "ANDROID_*" \) 2>/dev/null \
    | sort | tail -1
}

get_screenshots() {
  local dir="$1"
  find "$dir" -name "*.png" -not -name "*diff*" 2>/dev/null | sort
}

compare_screenshot() {
  local baseline="$1"
  local current="$2"
  local diff_out="$3"

  if has_imagemagick; then
    # ImageMagick: returns non-zero if images differ above threshold
    local diff_pct
    diff_pct=$(compare -metric PSNR "$baseline" "$current" "$diff_out" 2>&1 | grep -oE '[0-9]+(\.[0-9]+)?' | head -1 || echo "0")
    # PSNR > 40 = nearly identical; < 30 = significant difference
    if (( $(echo "$diff_pct < 30" | bc -l 2>/dev/null || echo 1) )); then
      return 1  # Different
    fi
    return 0  # Similar
  else
    # Fallback: MD5 hash comparison (catches any change, even 1 pixel)
    local b_hash c_hash
    b_hash=$(md5 -q "$baseline" 2>/dev/null || md5sum "$baseline" | awk '{print $1}')
    c_hash=$(md5 -q "$current" 2>/dev/null || md5sum "$current" | awk '{print $1}')
    [ "$b_hash" = "$c_hash" ] && return 0 || return 1
  fi
}

# ── Commands ──────────────────────────────────────────────────────────────────

cmd_approve() {
  local test="$1"
  if [ -z "$test" ]; then
    echo -e "${RED}Usage: compare.sh approve <test-name>${NC}"; exit 1
  fi

  local report_dir
  report_dir=$(latest_report_dir)
  if [ -z "$report_dir" ]; then
    echo -e "${RED}No report directories found in $REPORTS_DIR${NC}"; exit 1
  fi

  # Find screenshots for this test — look in a named subdir first, then root
  local test_dir="$report_dir/$test"
  [ ! -d "$test_dir" ] && test_dir="$report_dir"

  local screenshots
  screenshots=$(get_screenshots "$test_dir/screenshots" 2>/dev/null || true)
  [ -z "$screenshots" ] && screenshots=$(get_screenshots "$test_dir" 2>/dev/null || true)

  if [ -z "$screenshots" ]; then
    echo -e "${YELLOW}No screenshots found for test: $test${NC}"
    echo "  Looked in: $test_dir"
    exit 1
  fi

  local baseline_test_dir="$BASELINE_DIR/$test"
  mkdir -p "$baseline_test_dir"

  local count=0
  while IFS= read -r screenshot; do
    local name
    name=$(basename "$screenshot")
    cp "$screenshot" "$baseline_test_dir/$name"
    ((count++)) || true
  done <<< "$screenshots"

  echo -e "${GREEN}Approved $count screenshots as baseline for: $test${NC}"
  echo "  Saved to: $baseline_test_dir"
}

cmd_check() {
  local test="$1"
  if [ -z "$test" ]; then
    echo -e "${RED}Usage: compare.sh check <test-name>${NC}"; exit 1
  fi

  local baseline_test_dir="$BASELINE_DIR/$test"
  if [ ! -d "$baseline_test_dir" ]; then
    echo -e "${YELLOW}No baseline found for: $test${NC}"
    echo "  Run: bash scripts/visual-regression/compare.sh approve $test"
    exit 0
  fi

  local report_dir
  report_dir=$(latest_report_dir)
  if [ -z "$report_dir" ]; then
    echo -e "${RED}No report directories found in $REPORTS_DIR${NC}"; exit 1
  fi

  local test_dir="$report_dir/$test"
  [ ! -d "$test_dir" ] && test_dir="$report_dir"

  local current_screenshots
  current_screenshots=$(get_screenshots "$test_dir/screenshots" 2>/dev/null || true)
  [ -z "$current_screenshots" ] && current_screenshots=$(get_screenshots "$test_dir" 2>/dev/null || true)

  if [ -z "$current_screenshots" ]; then
    echo -e "${YELLOW}No current screenshots to compare for: $test${NC}"; exit 0
  fi

  local diffs=0 matches=0 missing=0
  local diff_dir="$report_dir/visual-diffs/$test"
  mkdir -p "$diff_dir"

  while IFS= read -r current; do
    local name
    name=$(basename "$current")
    local baseline="$baseline_test_dir/$name"

    if [ ! -f "$baseline" ]; then
      echo -e "  ${YELLOW}NEW${NC}   $name (no baseline)"
      ((missing++)) || true
      continue
    fi

    local diff_out="$diff_dir/diff-$name"
    if compare_screenshot "$baseline" "$current" "$diff_out"; then
      echo -e "  ${GREEN}PASS${NC}  $name"
      ((matches++)) || true
    else
      echo -e "  ${RED}FAIL${NC}  $name  <- VISUAL REGRESSION"
      ((diffs++)) || true
    fi
  done <<< "$current_screenshots"

  echo ""
  echo "  Matches: $matches  |  Regressions: $diffs  |  New: $missing"

  if [ "$diffs" -gt 0 ]; then
    echo -e "${RED}$diffs visual regression(s) detected${NC}"
    [ -d "$diff_dir" ] && echo "  Diffs saved to: $diff_dir"
    exit 1
  else
    echo -e "${GREEN}No visual regressions${NC}"
  fi
}

cmd_check_all() {
  local report_dir
  report_dir=$(latest_report_dir)
  if [ -z "$report_dir" ]; then
    echo -e "${RED}No report directories found in $REPORTS_DIR${NC}"; exit 1
  fi
  echo -e "${BLUE}Checking all tests in: $report_dir${NC}"
  echo ""

  if [ ! -d "$BASELINE_DIR" ]; then
    echo "  (no baselines approved yet)"
    exit 0
  fi

  local total_regressions=0
  for baseline_test in "$BASELINE_DIR"/*/; do
    [ -d "$baseline_test" ] || continue
    local test_name
    test_name=$(basename "$baseline_test")
    echo "── $test_name"
    cmd_check "$test_name" || ((total_regressions++)) || true
    echo ""
  done

  [ "$total_regressions" -gt 0 ] && exit 1 || exit 0
}

cmd_list() {
  echo -e "${BLUE}Tests with visual baselines:${NC}"
  if [ ! -d "$BASELINE_DIR" ]; then
    echo "  (none — no baselines approved yet)"
    echo "  Run: bash scripts/visual-regression/compare.sh approve <test-name>"
    return
  fi
  local count=0
  for d in "$BASELINE_DIR"/*/; do
    [ -d "$d" ] || continue
    local test_name
    test_name=$(basename "$d")
    local num_screenshots
    num_screenshots=$(find "$d" -name "*.png" 2>/dev/null | wc -l | tr -d ' ')
    echo "  $test_name  ($num_screenshots screenshots)"
    ((count++)) || true
  done
  [ "$count" -eq 0 ] && echo "  (none)"
}

cmd_help() {
  echo "Visual Regression Tool"
  echo ""
  echo "Commands:"
  echo "  approve <test>    Save current screenshots as baseline for test"
  echo "  check <test>      Compare current screenshots against baseline"
  echo "  check-all         Run check for all tests with baselines"
  echo "  list              List tests with approved baselines"
  echo ""
  echo "Environment:"
  echo "  DIFF_THRESHOLD    Pixel difference % threshold (default: 5)"
  echo "  Requires ImageMagick for PSNR comparison; falls back to MD5 hash"
}

# ── Dispatch ──────────────────────────────────────────────────────────────────
case "$COMMAND" in
  approve)    cmd_approve "$TEST_NAME" ;;
  check)      cmd_check "$TEST_NAME" ;;
  check-all)  cmd_check_all ;;
  list)       cmd_list ;;
  *)          cmd_help ;;
esac
