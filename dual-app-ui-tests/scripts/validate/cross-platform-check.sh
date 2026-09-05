#!/bin/bash
# cross-platform-check.sh — Pre-run gate: detect iOS-only patterns in .maestro YAML files
#
# Scans all YAML flow/subflow/screen files and fails if any iOS-only constructs
# are found. Prevents silent Android breakage caused by patterns that compile
# but behave incorrectly on Android.
#
# Usage:
#   scripts/validate/cross-platform-check.sh
#
# Exits 0 if clean, 1 if iOS-only patterns found.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
MAESTRO_DIR="$REPO_ROOT/.maestro"

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Format: "grep_pattern|human_reason"
IOS_ONLY_PATTERNS=(
  "clearKeychain|iOS Keychain; no Android equivalent"
  "xctest|iOS test driver"
  "simctl|macOS simulator control tool"
  "maestro-driver-ios|iOS-only Maestro driver binary"
)

echo ""
echo -e "${BLUE}=== Cross-Platform Check (Android gate) ===${NC}"
echo -e "${BLUE}Scanning: $MAESTRO_DIR${NC}"
echo ""

VIOLATIONS=0
FILES_CHECKED=0

while IFS= read -r -d '' FILE; do
  FILES_CHECKED=$((FILES_CHECKED + 1))
  REL="${FILE#$REPO_ROOT/}"

  for ENTRY in "${IOS_ONLY_PATTERNS[@]}"; do
    PATTERN="${ENTRY%%|*}"
    REASON="${ENTRY##*|}"
    MATCHES=$(grep -n "$PATTERN" "$FILE" 2>/dev/null | grep -v '^[0-9][0-9]*:[[:space:]]*#' || true)
    if [ -n "$MATCHES" ]; then
      echo -e "${RED}FAIL${NC}  $REL"
      while IFS= read -r MATCH; do
        echo -e "       ${YELLOW}line $MATCH${NC}"
      done <<< "$MATCHES"
      echo -e "       Reason: $REASON"
      echo ""
      VIOLATIONS=$((VIOLATIONS + 1))
    fi
  done
done < <(find "$MAESTRO_DIR" -name "*.yaml" -print0 2>/dev/null)

echo -e "${BLUE}Files checked: $FILES_CHECKED${NC}"

if [ "$VIOLATIONS" -gt 0 ]; then
  echo -e "${RED}✗ $VIOLATIONS iOS-only pattern(s) found — fix before running on Android.${NC}"
  echo ""
  exit 1
else
  echo -e "${GREEN}✓ No iOS-only patterns found. Safe to run on Android.${NC}"
  echo ""
  exit 0
fi
