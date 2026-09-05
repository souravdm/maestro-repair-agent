#!/bin/bash
# mcp-test-manifest.sh — JSON manifest for Maestro MCP execution
#
# Outputs a JSON object that Claude Code consumes to drive mcp__maestro__run:
#   platform   — ios | android
#   device_id  — connected simulator UDID or emulator serial
#   suite      — absolute path to the suite YAML
#   app_id     — bundle ID / package name for this platform
#   env        — key/value map passed as `env:` to mcp__maestro__run
#   flows      — absolute paths to every uncommented flow in the suite
#
# Usage (standalone):
#   bash scripts/testing/mcp-test-manifest.sh \
#     --suite .maestro/apps/health100/suites/H100-Smoke.yaml \
#     --platform ios
#
# Usage from run-ios-test.sh / run-android-test.sh (called automatically in --mcp-mode):
#   bash scripts/testing/mcp-test-manifest.sh \
#     --suite "$SUITE" --platform ios --device "$SIMULATOR_ID"
#
# Credentials:
#   Loaded from .maestro/config/credentials.*.js via scripts/setup/load-credentials.js.
#   Build config (debug=qa, adhoc/release=prod) is read from the app's config.env.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$PROJECT_ROOT"

# ── Parse args ────────────────────────────────────────────────────────────────

SUITE=""
PLATFORM="ios"
DEVICE=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --suite)    SUITE="$2";    shift 2 ;;
    --platform) PLATFORM="$2"; shift 2 ;;
    --device)   DEVICE="$2";   shift 2 ;;
    *) shift ;;
  esac
done

if [ -z "$SUITE" ]; then
  echo '{"error":"--suite is required"}' >&2
  exit 1
fi

# Resolve to absolute path
if [[ "$SUITE" != /* ]]; then
  SUITE="$PROJECT_ROOT/$SUITE"
fi

if [ ! -f "$SUITE" ]; then
  echo "{\"error\":\"suite not found: $SUITE\"}" >&2
  exit 1
fi

# ── Load app config ───────────────────────────────────────────────────────────

if [[ "$SUITE" == *".maestro/apps/health100/suites/"* ]]; then
  APP_CONFIG="$PROJECT_ROOT/.maestro/apps/health100/config.env"
elif [[ "$SUITE" == *".maestro/apps/cvshealth/suites/"* ]]; then
  APP_CONFIG="$PROJECT_ROOT/.maestro/apps/cvshealth/config.env"
else
  echo '{"error":"cannot detect app from suite path — must be under .maestro/apps/health100/suites/ or .maestro/apps/cvshealth/suites/"}' >&2
  exit 1
fi

# shellcheck source=/dev/null
source "$APP_CONFIG"

if [ "$PLATFORM" = "android" ]; then
  APP_ID="${ANDROID_APP_ID}"
else
  APP_ID="${IOS_APP_ID}"
fi

BUILD_CONFIG_LOWER=$(echo "${BUILD_CONFIG:-adhoc}" | tr '[:upper:]' '[:lower:]')
export BUILD_CONFIG="$BUILD_CONFIG_LOWER"

# ── Load credentials ──────────────────────────────────────────────────────────

CRED_LOADER="$PROJECT_ROOT/scripts/setup/load-credentials.js"
if command -v node &>/dev/null && [ -f "$CRED_LOADER" ]; then
  eval "$(node "$CRED_LOADER" 2>/dev/null)" || true
fi

# ── Detect device ─────────────────────────────────────────────────────────────

if [ -z "$DEVICE" ]; then
  if [ "$PLATFORM" = "ios" ]; then
    DEVICE=$(xcrun simctl list devices 2>/dev/null \
      | grep "(Booted)" | grep -E -o '[0-9A-F-]{36}' | head -1 || true)
  else
    DEVICE=$(adb devices 2>/dev/null \
      | grep -v "List of devices" | grep "device$" | awk '{print $1}' | head -1 || true)
  fi
fi

if [ -z "$DEVICE" ]; then
  echo '{"error":"no connected device found for platform '"$PLATFORM"'"}' >&2
  exit 1
fi

# ── Parse suite — extract uncommented flow file references ────────────────────

SUITE_DIR=$(dirname "$SUITE")
FLOWS_JSON=""

while IFS= read -r line || [[ -n "$line" ]]; do
  # Skip commented-out lines
  [[ $line =~ ^[[:space:]]*# ]] && continue
  if [[ $line =~ file:[[:space:]](.+\.yaml) ]]; then
    FILE="${BASH_REMATCH[1]}"
    if [[ "$FILE" == /* ]]; then
      FULL="$FILE"
    else
      FULL="$SUITE_DIR/$FILE"
    fi
    if [ -f "$FULL" ]; then
      FULL=$(realpath "$FULL")
      FLOWS_JSON="${FLOWS_JSON:+$FLOWS_JSON,}\"$FULL\""
    fi
  fi
done < "$SUITE"

if [ -z "$FLOWS_JSON" ]; then
  echo '{"error":"no flow files found in suite (all commented out or paths missing)"}' >&2
  exit 1
fi

# ── Build env JSON — credentials + app identity ───────────────────────────────

# JSON-escape a string value
je() { printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'; }

ENV_JSON="\"APP_ID\":\"$(je "$APP_ID")\""
ENV_JSON="${ENV_JSON},\"BRAND\":\"$(je "${BRAND:-cvshealth}")\""
ENV_JSON="${ENV_JSON},\"BUILD_CONFIG\":\"$(je "$BUILD_CONFIG_LOWER")\""
[ -n "${COMMON_USER:-}"     ] && ENV_JSON="${ENV_JSON},\"COMMON_USER\":\"$(je "$COMMON_USER")\""
[ -n "${COMMON_PASSWORD:-}" ] && ENV_JSON="${ENV_JSON},\"COMMON_PASSWORD\":\"$(je "$COMMON_PASSWORD")\""
[ -n "${COMMON_OTP:-}"      ] && ENV_JSON="${ENV_JSON},\"COMMON_OTP\":\"$(je "$COMMON_OTP")\""
[ -n "${COMMON_DOB:-}"      ] && ENV_JSON="${ENV_JSON},\"COMMON_DOB\":\"$(je "$COMMON_DOB")\""
[ -n "${STATIC_OTP:-}"      ] && ENV_JSON="${ENV_JSON},\"STATIC_OTP\":\"$(je "$STATIC_OTP")\""
[ -n "${DOB:-}"             ] && ENV_JSON="${ENV_JSON},\"DOB\":\"$(je "$DOB")\""

# ── Output manifest ───────────────────────────────────────────────────────────

cat <<JSON
{
  "platform": "$PLATFORM",
  "device_id": "$DEVICE",
  "suite": "$SUITE",
  "app_id": "$APP_ID",
  "env": { $ENV_JSON },
  "flows": [ $FLOWS_JSON ]
}
JSON
