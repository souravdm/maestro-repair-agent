#!/bin/bash
# =============================================================================
# run-maestro.sh — Wrapper for direct `maestro test` calls
#
# Use this instead of calling `maestro test` directly. It ensures critical
# environment variables (like MAESTRO_DRIVER_STARTUP_TIMEOUT) are set, and
# automatically injects the correct APP_ID for each platform so you never
# need to pass --env APP_ID= manually.
#
# Usage examples:
#   ./scripts/run-maestro.sh test .maestro/flows/Account/test_authentication.yaml
#   ./scripts/run-maestro.sh test .maestro/flows/Benefits/Claims/test_claim_submission.yaml --platform android
#   ./scripts/run-maestro.sh test .maestro/flows/Account/test_authentication.yaml --skip-setup
#   ./scripts/run-maestro.sh hierarchy  (for UI inspection)
#
# Tip: add an alias so `maestro` transparently uses this wrapper:
#   echo "alias maestro='$(pwd)/scripts/run-maestro.sh'" >> ~/.zshrc && source ~/.zshrc
#
# Why this exists:
#   1. MAESTRO_DRIVER_STARTUP_TIMEOUT must be in the shell environment BEFORE
#      `maestro` starts (too late to set via config.yaml env:).
#   2. APP_ID defaults in config.yaml are iOS-only. When running with
#      --platform android the correct Android package name must be injected.
#      This wrapper reads build_config.yaml and does that automatically.
#   scripts/testing/test.sh already handles both, but direct `maestro test` calls
#   bypass test.sh entirely — hence this wrapper.
# =============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUILD_CONFIG="$(cd "$SCRIPT_DIR/.." && pwd)/build_config.yaml"

# ---------------------------------------------------------------------------
# Driver startup timeout
# How long (ms) Maestro waits for the XCTest driver to become ready on
# port 7001. 240000 = 4 minutes. Increase if your simulator is very slow.
# ---------------------------------------------------------------------------
export MAESTRO_DRIVER_STARTUP_TIMEOUT="${MAESTRO_DRIVER_STARTUP_TIMEOUT:-240000}"

# ---------------------------------------------------------------------------
# Auto-inject APP_ID for Android
#
# When --platform android is present and no explicit --env APP_ID= was
# supplied, read the android.app_id from build_config.yaml and inject it.
#
# IMPORTANT: Maestro only accepts --env as a `maestro test` subcommand flag,
# and it must appear BEFORE the flow file path (placing it after the flow
# path causes Maestro to treat KEY=VALUE as a second flow path argument).
# Correct form: maestro test --env APP_ID=<pkg> --platform android <flow>
# ---------------------------------------------------------------------------
ARGS_STR="$*"

if echo "$ARGS_STR" | grep -q -- "--platform android" && \
   ! echo "$ARGS_STR" | grep -q "APP_ID="; then

  ANDROID_APP_ID=""
  if [[ -f "$BUILD_CONFIG" ]]; then
    # Extract the value after `app_id:` (strips optional quotes)
    ANDROID_APP_ID=$(grep 'app_id:' "$BUILD_CONFIG" | head -1 \
      | sed 's/.*app_id:[[:space:]]*["\x27]\{0,1\}\([^"[:space:]\x27]*\).*/\1/')
  fi

  if [[ -n "$ANDROID_APP_ID" ]]; then
    echo "ℹ️  run-maestro.sh: injecting APP_ID=$ANDROID_APP_ID (from build_config.yaml)"

    # If the first argument is "test", inject --env right after it (before the
    # flow path) so Maestro parses the flag correctly.
    if [[ "${1:-}" == "test" ]]; then
      shift  # remove "test" — we'll re-add it with --env inserted after it
      exec maestro test --env "APP_ID=$ANDROID_APP_ID" "$@"
    else
      # Non-test subcommand (e.g. hierarchy) — pass through with env prepended
      exec maestro "$@" --env "APP_ID=$ANDROID_APP_ID"
    fi
  else
    echo "⚠️  run-maestro.sh: --platform android detected but could not read android.app_id from build_config.yaml" >&2
    echo "    Pass APP_ID manually: maestro test --env APP_ID=<package> --platform android <flow>" >&2
  fi
fi

# ---------------------------------------------------------------------------
# Default: pass everything through unchanged (iOS or no platform flag)
# ---------------------------------------------------------------------------
exec maestro "$@"
