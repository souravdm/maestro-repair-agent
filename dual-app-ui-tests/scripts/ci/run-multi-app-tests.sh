#!/usr/bin/env bash
# =============================================================================
# Multi-App Test Runner for CI/CD
# Runs Maestro test suites for CVS Health, Health100, or both apps
# without requiring manual build_config.yaml changes.
#
# Usage:
#   ./scripts/ci/run-multi-app-tests.sh --app both --suite smoke --platform ios
#   ./scripts/ci/run-multi-app-tests.sh --app cvshealth --suite regression --platform android
#   ./scripts/ci/run-multi-app-tests.sh --app health100 --suite smoke --platform ios --dry-run
#
# Options:
#   --app        cvshealth | health100 | both   (required)
#   --suite      smoke | regression | account | benefits | findcare | shop | superapp | custom
#   --suite-path Custom suite file path (used when --suite custom)
#   --platform   ios | android                  (default: ios)
#   --dry-run    Show what would run without executing
#   --skip-setup Skip device/simulator setup
#   --extra-args Additional args passed through to test.sh (e.g. "--pulse --a11y")
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONFIG_FILE="$PROJECT_ROOT/build_config.yaml"
CONFIG_BACKUP="$CONFIG_FILE.bak"

# ── App Configuration Maps ──────────────────────────────────────────────────
declare -A CVSHEALTH_IOS=(
    [scheme]="CVSOnlineiPhone"
    [bundle_id]="com.cvsenterpriseiphone.cvspharmacy"
)
declare -A CVSHEALTH_ANDROID=(
    [build_variant]="shopDebug"
    [app_id]="com.cvs.launchers.cvs"
)

declare -A HEALTH100_IOS=(
    [scheme]="Health100"
    [bundle_id]="com.cvsenterpriseiphone.health100"
)
declare -A HEALTH100_ANDROID=(
    [build_variant]="healthDebug"
    [app_id]="com.health100.launchers"
)

# ── Defaults ────────────────────────────────────────────────────────────────
APP=""
SUITE="smoke"
SUITE_PATH=""
PLATFORM="ios"
DRY_RUN=false
SKIP_SETUP=false
EXTRA_ARGS=""

# ── Parse Arguments ─────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
    case "$1" in
        --app)        APP="$2"; shift 2 ;;
        --suite)      SUITE="$2"; shift 2 ;;
        --suite-path) SUITE_PATH="$2"; shift 2 ;;
        --platform)   PLATFORM="$2"; shift 2 ;;
        --dry-run)    DRY_RUN=true; shift ;;
        --skip-setup) SKIP_SETUP=true; shift ;;
        --extra-args) EXTRA_ARGS="$2"; shift 2 ;;
        -h|--help)
            head -20 "$0" | tail -15
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# ── Validation ──────────────────────────────────────────────────────────────
if [[ -z "$APP" ]]; then
    echo "Error: --app is required (cvshealth | health100 | both)"
    exit 1
fi

if [[ "$APP" != "cvshealth" && "$APP" != "health100" && "$APP" != "both" ]]; then
    echo "Error: --app must be cvshealth, health100, or both"
    exit 1
fi

if [[ "$PLATFORM" != "ios" && "$PLATFORM" != "android" ]]; then
    echo "Error: --platform must be ios or android"
    exit 1
fi

# ── Helper Functions ────────────────────────────────────────────────────────

backup_config() {
    cp "$CONFIG_FILE" "$CONFIG_BACKUP"
}

restore_config() {
    if [[ -f "$CONFIG_BACKUP" ]]; then
        mv "$CONFIG_BACKUP" "$CONFIG_FILE"
    fi
}

# Restore config on exit (success or failure)
trap restore_config EXIT

patch_config_for_app() {
    local app_name="$1"

    if [[ "$app_name" == "cvshealth" ]]; then
        # Patch iOS values (only non-comment lines)
        sed -i '' '/^[[:space:]]*#/!s/scheme: ".*"/scheme: "CVSOnlineiPhone"/' "$CONFIG_FILE"
        sed -i '' '/^[[:space:]]*#/!s/bundle_id: ".*"/bundle_id: "com.cvsenterpriseiphone.cvspharmacy"/' "$CONFIG_FILE"
        # Patch Android values (only non-comment lines)
        sed -i '' '/^[[:space:]]*#/!s/build_variant: ".*"/build_variant: "shopDebug"/' "$CONFIG_FILE"
        sed -i '' '/^[[:space:]]*#/!s/app_id: ".*"/app_id: "com.cvs.launchers.cvs"/' "$CONFIG_FILE"
    elif [[ "$app_name" == "health100" ]]; then
        # Patch iOS values (only non-comment lines)
        sed -i '' '/^[[:space:]]*#/!s/scheme: ".*"/scheme: "Health100"/' "$CONFIG_FILE"
        # bundle_id is now resolved from the bundle_ids map in build_config.yaml — no patch needed
        # Patch Android values (only non-comment lines)
        sed -i '' '/^[[:space:]]*#/!s/build_variant: ".*"/build_variant: "healthDebug"/' "$CONFIG_FILE"
        sed -i '' '/^[[:space:]]*#/!s/app_id: ".*"/app_id: "com.health100.launchers"/' "$CONFIG_FILE"
    fi
}

resolve_suite_path() {
    local app_name="$1"
    local suite_name="$2"

    if [[ "$suite_name" == "custom" && -n "$SUITE_PATH" ]]; then
        echo "$SUITE_PATH"
        return
    fi

    local suite_file="$PROJECT_ROOT/.maestro/apps/$app_name/suites/${suite_name}.yaml"

    if [[ ! -f "$suite_file" ]]; then
        echo "Error: Suite not found: $suite_file" >&2
        echo "Available suites for $app_name:" >&2
        ls "$PROJECT_ROOT/.maestro/apps/$app_name/suites/"*.yaml 2>/dev/null | xargs -I{} basename {} .yaml >&2
        return 1
    fi

    echo "$suite_file"
}

run_tests_for_app() {
    local app_name="$1"
    local suite_file="$2"

    echo ""
    echo "============================================================"
    echo "  Running: $app_name | Suite: $SUITE | Platform: $PLATFORM"
    echo "  Suite file: $suite_file"
    echo "============================================================"
    echo ""

    # Patch build_config.yaml for this app
    patch_config_for_app "$app_name"

    # Build test.sh command
    local test_cmd="bash $PROJECT_ROOT/scripts/testing/test.sh $suite_file --platform $PLATFORM"

    if [[ "$SKIP_SETUP" == true ]]; then
        test_cmd="$test_cmd --skip-setup"
    fi

    if [[ -n "$EXTRA_ARGS" ]]; then
        test_cmd="$test_cmd $EXTRA_ARGS"
    fi

    if [[ "$DRY_RUN" == true ]]; then
        echo "[DRY RUN] Would execute:"
        echo "  $test_cmd"
        echo ""
        echo "[DRY RUN] build_config.yaml patched values:"
        grep -E "scheme:|bundle_id:|build_variant:|app_id:" "$CONFIG_FILE" | head -4
        echo ""
        return 0
    fi

    echo "Executing: $test_cmd"
    eval "$test_cmd"
    local exit_code=$?

    if [[ $exit_code -ne 0 ]]; then
        echo "Warning: Tests for $app_name exited with code $exit_code"
    fi

    return $exit_code
}

# ── Main Execution ──────────────────────────────────────────────────────────

echo "=========================================="
echo "  Multi-App Test Runner"
echo "  App:      $APP"
echo "  Suite:    $SUITE"
echo "  Platform: $PLATFORM"
echo "  Dry Run:  $DRY_RUN"
echo "=========================================="

# Backup original config
backup_config

OVERALL_EXIT=0

if [[ "$APP" == "both" ]]; then
    # Run CVS Health first
    SUITE_FILE=$(resolve_suite_path "cvshealth" "$SUITE") || exit 1
    run_tests_for_app "cvshealth" "$SUITE_FILE" || OVERALL_EXIT=1

    # Restore config before patching for next app
    restore_config
    backup_config

    # Run Health100 second
    SUITE_FILE=$(resolve_suite_path "health100" "$SUITE") || exit 1
    run_tests_for_app "health100" "$SUITE_FILE" || OVERALL_EXIT=1
else
    SUITE_FILE=$(resolve_suite_path "$APP" "$SUITE") || exit 1
    run_tests_for_app "$APP" "$SUITE_FILE" || OVERALL_EXIT=$?
fi

echo ""
echo "=========================================="
if [[ $OVERALL_EXIT -eq 0 ]]; then
    echo "  All tests completed successfully"
else
    echo "  Tests completed with failures (exit code: $OVERALL_EXIT)"
fi
echo "=========================================="

exit $OVERALL_EXIT
