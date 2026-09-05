#!/bin/bash
# run-benefits-suites.sh — run the 9 core Benefits suites sequentially, each via
# run-parallel-suite.sh (so within each suite, iOS + Android still run concurrently;
# the 9 suites themselves run one after another, not in parallel with each other).
#
# Each run's test-reports/ folder gets a suffix naming the area (e.g.
# IOS_20260902_071127_Providers), matching the convention already used for
# manually-renamed report folders, so results from different suites are easy to
# tell apart.
#
# On a suite failure, the sequence continues through the remaining suites — a
# summary table at the end shows pass/fail per suite. Exit code is non-zero if
# any suite failed.
#
# After each suite, the newly-created IOS_*_<suffix> and ANDROID_*_<suffix>
# test-reports/ folders are fed into update-results.sh, which writes that
# suite's Pass/Fail status into the shared "Benefits Automated Test Cases - 2026.xlsx"
# tracker (and corrects any stale Automated Test Name cells) for both platforms.
#
# Usage:
#   ./run-benefits-suites.sh

set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
# update-results.sh (and the xlsx it writes to) live in scripts/build/, not
# this script's own directory — never assume same-directory here.
UPDATE_RESULTS_SH="$PROJECT_ROOT/scripts/build/update-results.sh"

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
# Suites to run, in order: "label|suite-path|report-suffix"
###############################################################################

SUITES=(
  "IDCard|.maestro/apps/health100/suites/benefits_id_card_suite.yaml|IDCard"
  "InNetwork Pharmacy|.maestro/apps/health100/suites/benefits_in_network_pharmacy_suite.yaml|IN_Network_Pharmacy"
  "PriorAuth|.maestro/apps/health100/suites/benefits_prior_auth_suite.yaml|Prior_Auth"
  "Providers|.maestro/apps/health100/suites/benefits_providers.yaml|Providers"
  "Spending|.maestro/apps/health100/suites/benefits_spending_all_suite.yaml|Spending"
  "Claims|.maestro/apps/health100/suites/benefits_claims_suite.yaml|Claims"
  "Drug Pricing|.maestro/apps/health100/suites/drug_pricing_suite.yaml|Drug_Pricing"
  "YTD|.maestro/apps/health100/suites/benefits_ytd_suite.yaml|YTD"
  "Dashboard|.maestro/apps/health100/suites/benefits_dashboard_auth_suite.yaml|Dashboard"
)

###############################################################################
# Clear existing Pass/Fail status before the run starts
###############################################################################
# Fails fast here (before booting any device or running a single test) if the
# xlsx is open in Excel — update-results.sh refuses to touch a locked file,
# and running 9 suites just to discover the tracker was never actually
# written to would waste hours for nothing.

banner "Clearing existing Excel tracker status"
bash "$UPDATE_RESULTS_SH" --clear \
  || die "Could not clear the Excel tracker — see the error above (likely: the file is open in Excel/Numbers). Close it and re-run."

LABELS=()
RESULTS=()
EXCEL_SYNC_FAILURES=()
OVERALL_EXIT=0
RUN_START=$SECONDS

for entry in "${SUITES[@]}"; do
  IFS='|' read -r label suite suffix <<< "$entry"

  banner "Running: $label ($suffix)"
  info "Suite: $suite"

  # Marker file — anything with mtime after this was created by THIS suite's
  # run, so a stale IOS_*_<suffix>/ANDROID_*_<suffix> folder from an earlier,
  # unrelated run-benefits-suites.sh (or manual run-parallel-suite.sh) call can
  # never be mistaken for this suite's result, even though the suffix repeats
  # across runs.
  MARKER="$(mktemp /tmp/run-benefits-marker.XXXXXX)"

  bash "$SCRIPT_DIR/run-parallel-suite.sh" "$suite" "$suffix"
  exit_code=$?

  LABELS+=("$label")
  if [ "$exit_code" -eq 0 ]; then
    RESULTS+=("PASSED")
    ok "$label PASSED"
  else
    RESULTS+=("FAILED")
    warn "$label FAILED (exit $exit_code)"
    OVERALL_EXIT=1
  fi

  banner "Updating Excel tracker for $label"
  for platform_prefix in IOS ANDROID; do
    new_dir=$(find "$PROJECT_ROOT/test-reports" -maxdepth 1 -type d \
      -name "${platform_prefix}_*_${suffix}" -newer "$MARKER" 2>/dev/null | sort | tail -1)
    if [ -z "$new_dir" ]; then
      warn "No new $platform_prefix report folder found for $label — skipping Excel update"
      continue
    fi
    folder_name="$(basename "$new_dir")"
    info "Updating Excel from $folder_name"
    if ! bash "$UPDATE_RESULTS_SH" "$folder_name"; then
      warn "update-results.sh failed for $folder_name (non-fatal — continuing)"
      EXCEL_SYNC_FAILURES+=("$label ($platform_prefix, $folder_name)")
    fi
  done

  rm -f "$MARKER"
done

RUN_ELAPSED=$((SECONDS - RUN_START))
RUN_MIN=$((RUN_ELAPSED / 60))
RUN_SEC=$((RUN_ELAPSED % 60))

banner "Benefits Suite Sweep — Summary"
for i in "${!LABELS[@]}"; do
  if [ "${RESULTS[$i]}" = "PASSED" ]; then
    echo -e "  ${GREEN}✅ ${LABELS[$i]}${NC}"
  else
    echo -e "  ${RED}❌ ${LABELS[$i]}${NC}"
  fi
done
echo ""
if [ "${#EXCEL_SYNC_FAILURES[@]}" -gt 0 ]; then
  warn "Excel tracker sync failed for ${#EXCEL_SYNC_FAILURES[@]} report(s) — status for these was NOT written:"
  for f in "${EXCEL_SYNC_FAILURES[@]}"; do
    echo -e "  ${RED}✗ $f${NC}"
  done
  echo -e "  ${YELLOW}Common cause: the xlsx was opened in Excel/Numbers partway through this run.${NC}"
else
  ok "Excel tracker sync: no failures"
fi
echo ""
info "Wall time: ${RUN_MIN}m ${RUN_SEC}s"

if [ "$OVERALL_EXIT" -eq 0 ]; then
  ok "All 9 Benefits suites passed"
else
  warn "One or more Benefits suites failed — see summary above"
fi

exit $OVERALL_EXIT
