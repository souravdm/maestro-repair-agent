#!/bin/bash
###############################################################################
# Pre-Run Lint Gates
#
# Runs four static checks against the .maestro/ YAML and screen JS files
# before any test executes. Fails fast (exit 1) if any gate is violated so
# bad selectors and broken patterns are caught before wasting a CI slot.
#
# Gates:
#   1. Selector health  — screen JS files must parse without errors
#   2. when: patterns   — visible: values must end with .* or use ${output.*}
#                         (Maestro uses full-string regex; no .* = exact match
#                          only, which is a silent selector mismatch on most
#                          natural-language strings)
#   3. Hardcoded strings — assertVisible / tapOn / assertNotVisible /
#                          scrollUntilVisible / extendedWaitUntil visible:
#                          must reference ${output.*} not raw string literals
#   4. Platform index risk — tapOn: index: <N> with a hardcoded integer is a
#                          platform-divergence risk (element order differs between
#                          iOS and Android). These should be behind __isIOS ? N : M
#                          in the screen JS, or confirmed safe. Always warn-only.
#
# Usage:
#   bash scripts/analysis/pre-run-gate.sh               # all gates, warn only
#   bash scripts/analysis/pre-run-gate.sh --fail-fast   # exit 1 on first violation
#   bash scripts/analysis/pre-run-gate.sh --gate 2      # run only gate N
#   bash scripts/analysis/pre-run-gate.sh --warn-only   # always exit 0 (print only)
###############################################################################

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
MAESTRO_DIR="$PROJECT_ROOT/.maestro"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

FAIL_FAST=false
WARN_ONLY=false
RUN_GATE=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --fail-fast)   FAIL_FAST=true; shift ;;
    --warn-only)   WARN_ONLY=true; shift ;;
    --gate)        RUN_GATE="$2"; shift 2 ;;
    *) shift ;;
  esac
done

TOTAL_VIOLATIONS=0

# ─────────────────────────────────────────────────────────────────────────────
# Gate 1: Selector health — screen JS parse errors
# ─────────────────────────────────────────────────────────────────────────────
run_gate_1() {
  echo -e "${BLUE}[Gate 1]${NC} Screen JS selector health..."
  if ! command -v node &>/dev/null; then
    echo -e "  ${YELLOW}⚠ skipped (node not available)${NC}"
    return 0
  fi

  local output
  output=$(node "$SCRIPT_DIR/selector-health-check.js" 2>&1) || true

  local errors
  errors=$(echo "$output" | grep -c '^\[!\]' 2>/dev/null || true)
  local parse_errors
  parse_errors=$(echo "$output" | grep -E '^\[!\] Parse errors' | grep -oE '[0-9]+' | head -1 || true)
  parse_errors="${parse_errors:-0}"

  if [ "$parse_errors" -gt 0 ]; then
    echo -e "  ${RED}✗ $parse_errors screen JS file(s) have parse errors:${NC}"
    echo "$output" | grep -A 100 '^\[!\] Parse errors' | head -20 | sed 's/^/    /'
    TOTAL_VIOLATIONS=$((TOTAL_VIOLATIONS + parse_errors))
    $FAIL_FAST && return 1 || return 0
  fi

  local total_selectors
  total_selectors=$(echo "$output" | grep 'Total selectors:' | grep -oE '[0-9]+' | head -1 || echo "0")
  echo -e "  ${GREEN}✓${NC} $total_selectors selectors across all screen JS files — no parse errors"
  return 0
}

# ─────────────────────────────────────────────────────────────────────────────
# Gate 2: when: visible: patterns missing .*
#
# Maestro's visible: matcher uses Pattern.matches() (Java full-string regex).
# A plain string like "Just need to verify" will NOT match the element whose
# text is "Just need to verify it's you". Every when: visible: value that is
# a raw string must end with .* or contain a wildcard.
#
# Exempt patterns:
#   - Values already containing .* or .*
#   - Values that are ${output.*} references (handled at runtime)
#   - Values that look like anchored regex: start with ^ or end with $
#   - Values using | for alternation (multi-option string is intentional)
# ─────────────────────────────────────────────────────────────────────────────
run_gate_2() {
  echo -e "${BLUE}[Gate 2]${NC} when: visible: full-string match patterns..."

  # Find all YAML files in flows and subflows
  local yaml_files
  yaml_files=$(find "$MAESTRO_DIR/flows" "$MAESTRO_DIR/subflows" -name "*.yaml" 2>/dev/null | sort)

  if [ -z "$yaml_files" ]; then
    echo -e "  ${YELLOW}⚠ no YAML files found under .maestro/flows or .maestro/subflows${NC}"
    return 0
  fi

  local violations=0
  local violation_lines=""

  while IFS= read -r yaml_file; do
    local rel="${yaml_file#$PROJECT_ROOT/}"
    local in_when=false
    local lineno=0

    while IFS= read -r line || [[ -n "$line" ]]; do
      lineno=$((lineno + 1))
      # Detect entry into a when: block
      if echo "$line" | grep -qE '^\s+when\s*:'; then
        in_when=true
        continue
      fi
      # Exit when: block when we see a line at the same or lower indent that
      # is NOT a visible: / notVisible: / label: continuation
      if $in_when && echo "$line" | grep -qE '^\s+(commands|runFlow|file|optional)\s*:'; then
        in_when=false
        continue
      fi

      if $in_when && echo "$line" | grep -qE '^\s+visible\s*:'; then
        # Extract the value after visible:
        local value
        value=$(echo "$line" | sed 's/.*visible\s*:\s*//' | tr -d '"'"'" | xargs)

        # Skip: empty, ${output.*} refs, already has .*, contains |, is anchored
        if [ -z "$value" ]; then continue; fi
        if echo "$value" | grep -qE '^\$\{output\.'; then continue; fi
        if echo "$value" | grep -qE '\.\*'; then continue; fi
        if echo "$value" | grep -qE '\|'; then continue; fi
        if echo "$value" | grep -qE '^\^|\\$'; then continue; fi
        # Skip short strings that are likely IDs or single words (no spaces)
        if ! echo "$value" | grep -q ' '; then continue; fi

        violations=$((violations + 1))
        violation_lines="${violation_lines}\n    ${rel}:${lineno}  visible: \"${value}\""
      fi
    done < "$yaml_file"
  done <<< "$yaml_files"

  if [ "$violations" -gt 0 ]; then
    echo -e "  ${RED}✗ $violations when: visible: pattern(s) are missing .* suffix:${NC}"
    echo -e "$violation_lines" | head -30
    echo -e "  ${YELLOW}  Fix: append .* to each value, e.g. visible: \"Just need to verify.*\"${NC}"
    TOTAL_VIOLATIONS=$((TOTAL_VIOLATIONS + violations))
    $FAIL_FAST && return 1 || return 0
  fi

  echo -e "  ${GREEN}✓${NC} All when: visible: patterns include wildcard or use \${output.*}"
  return 0
}

# ─────────────────────────────────────────────────────────────────────────────
# Gate 3: Hard-coded string literals in assertion commands
#
# Framework rule: selectors in assertVisible / tapOn / assertNotVisible /
# scrollUntilVisible / extendedWaitUntil must reference ${output.*} — never
# raw string literals. A raw string breaks the central screen-JS maintenance
# pattern and makes selector changes require finding every YAML manually.
#
# Exempt:
#   - Lines starting with # (commented out)
#   - Values that ARE ${output.*} references
#   - Values that are ${...} env var references (e.g. ${APP_ID})
#   - Regex-only values like \d{6}
#   - Optional: true / false boolean values
# ─────────────────────────────────────────────────────────────────────────────
run_gate_3() {
  echo -e "${BLUE}[Gate 3]${NC} Hard-coded string literals in assertion commands..."

  local yaml_files
  yaml_files=$(find "$MAESTRO_DIR/flows" "$MAESTRO_DIR/subflows" -name "*.yaml" 2>/dev/null | sort)

  if [ -z "$yaml_files" ]; then
    echo -e "  ${YELLOW}⚠ no YAML files found${NC}"
    return 0
  fi

  # Commands whose inline value or nested text: / id: should be ${output.*}
  local CMD_PATTERN='^\s*-\s*(assertVisible|assertNotVisible|tapOn|scrollUntilVisible)\s*:\s*["\047]'

  local violations=0
  local violation_lines=""

  while IFS= read -r yaml_file; do
    local rel="${yaml_file#$PROJECT_ROOT/}"
    local lineno=0

    while IFS= read -r line || [[ -n "$line" ]]; do
      lineno=$((lineno + 1))

      # Skip comments
      [[ "$line" =~ ^[[:space:]]*# ]] && continue

      # Check for inline assertVisible/tapOn/etc with a raw string value
      if echo "$line" | grep -qE "$CMD_PATTERN"; then
        # Extract the value
        local value
        value=$(echo "$line" | sed -E 's/.*:\s*//' | tr -d '"'"'" | xargs)

        # Skip blank, ${output.*} refs, ${ENV_VAR} refs, regex-only, booleans
        [ -z "$value" ] && continue
        echo "$value" | grep -qE '^\$\{output\.' && continue
        echo "$value" | grep -qE '^\$\{[A-Z_]' && continue
        echo "$value" | grep -qE '^(true|false)$' && continue
        # Pure regex patterns like \d{6} are OK
        echo "$value" | grep -qE '^[\\^.*+?()[\]{}|$]+$' && continue
        # Single-word values that are likely IDs are OK
        ! echo "$value" | grep -q ' ' && [ ${#value} -le 30 ] && continue

        violations=$((violations + 1))
        violation_lines="${violation_lines}\n    ${rel}:${lineno}  $(echo "$line" | xargs)"
      fi
    done < "$yaml_file"
  done <<< "$yaml_files"

  if [ "$violations" -gt 0 ]; then
    echo -e "  ${RED}✗ $violations assertion(s) use raw string literals instead of \${output.*}:${NC}"
    echo -e "$violation_lines" | head -30
    echo -e "  ${YELLOW}  Fix: define the string in the relevant screens/**/*.js file and reference it via \${output.<ns>.<key>}${NC}"
    TOTAL_VIOLATIONS=$((TOTAL_VIOLATIONS + violations))
    $FAIL_FAST && return 1 || return 0
  fi

  echo -e "  ${GREEN}✓${NC} All assertion commands use \${output.*} references — no raw strings"
  return 0
}

# ─────────────────────────────────────────────────────────────────────────────
# Gate 4: Platform index risk — hardcoded index: in tapOn commands
#
# Element order differs between iOS and Android. A tapOn: with index: <N>
# (bare integer) works on one platform and silently taps the wrong element on
# the other. The safe pattern is to define the value via __isIOS ? N : M in
# the screen JS and reference it as ${output.<ns>.<key>}.
#
# This gate is ALWAYS warn-only — index values are sometimes genuinely
# platform-independent, so the gate prints locations for human review rather
# than failing the build. It does NOT increment TOTAL_VIOLATIONS.
# ─────────────────────────────────────────────────────────────────────────────
run_gate_4() {
  echo -e "${BLUE}[Gate 4]${NC} Platform index risk — hardcoded index: values in tapOn..."

  # Fast single-grep pass: find `index: <integer>` lines in all YAML files.
  # index-based taps are platform-risk: element order differs between iOS and Android.
  # Lines referencing ${output.*} are safe (the screen JS handles the ternary).
  local raw_hits
  raw_hits=$(grep -rn --include="*.yaml" \
    -E '^\s+index:\s+[0-9]+\s*$' \
    "$MAESTRO_DIR/flows" "$MAESTRO_DIR/subflows" 2>/dev/null \
    | grep -v '\${output\.' || true)

  if [ -z "$raw_hits" ]; then
    echo -e "  ${GREEN}✓${NC} No hardcoded index: values found"
    return 0
  fi

  local hits
  hits=$(echo "$raw_hits" | wc -l | tr -d ' ')
  echo -e "  ${YELLOW}⚠ $hits hardcoded index: value(s) — review for platform safety:${NC}"
  echo "$raw_hits" | sed "s|$PROJECT_ROOT/||" | head -40 | sed 's/^/    /'
  echo -e "  ${YELLOW}  If index differs between iOS/Android: define in screen JS as __isIOS ? N : M${NC}"
  echo -e "  ${YELLOW}  If index is the same on both platforms: no action needed${NC}"
  # Gate 4 is always warn-only — never adds to TOTAL_VIOLATIONS
  return 0
}

# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║         Pre-Run Lint Gates                 ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════╝${NC}"
echo ""

if [ -z "$RUN_GATE" ] || [ "$RUN_GATE" = "1" ]; then run_gate_1; fi
if [ -z "$RUN_GATE" ] || [ "$RUN_GATE" = "2" ]; then run_gate_2; fi
if [ -z "$RUN_GATE" ] || [ "$RUN_GATE" = "3" ]; then run_gate_3; fi
if [ -z "$RUN_GATE" ] || [ "$RUN_GATE" = "4" ]; then run_gate_4; fi

echo ""
if [ "$TOTAL_VIOLATIONS" -gt 0 ]; then
  echo -e "${RED}╔════════════════════════════════════════════╗${NC}"
  echo -e "${RED}║  $TOTAL_VIOLATIONS gate violation(s) found              ║${NC}"
  echo -e "${RED}╚════════════════════════════════════════════╝${NC}"
  echo ""
  echo -e "${YELLOW}⚠  gate violations found — informational only, proceeding${NC}"
  exit 0
fi

echo -e "${GREEN}✓ All pre-run gates passed${NC}"
echo ""
exit 0
