#!/bin/bash

# Zephyr Integration Installation Verification
# Checks that all required files and dependencies are in place

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

echo "🔍 Verifying Zephyr Scale Integration Installation..."
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

ERRORS=0
WARNINGS=0

# Check required files
echo "📁 Checking required files..."

FILES=(
  "scripts/integrations/zephyr/zephyr-scale-client.js"
  "scripts/integrations/zephyr/zephyr-config.js"
  "scripts/integrations/zephyr/create-test-cycle.js"
  "scripts/integrations/zephyr/upload-test-results.js"
  "scripts/integrations/zephyr/sync-test-cases.js"
  "scripts/integrations/zephyr/generate-report-url.js"
  "scripts/integrations/zephyr/format-cycle-summary.js"
  "scripts/integrations/zephyr/test-case-mapper.json"
  ".maestro/config/zephyr-credentials.js"
  "docs/integrations/ZEPHYR_SCALE_GUIDE.md"
)

for file in "${FILES[@]}"; do
  if [ -f "$PROJECT_ROOT/$file" ]; then
    echo -e "  ${GREEN}✓${NC} $file"
  else
    echo -e "  ${RED}✗${NC} $file (missing)"
    ((ERRORS++))
  fi
done

echo ""

# Check file permissions
echo "🔐 Checking file permissions..."

EXEC_FILES=(
  "scripts/integrations/zephyr/zephyr-scale-client.js"
  "scripts/integrations/zephyr/create-test-cycle.js"
  "scripts/integrations/zephyr/upload-test-results.js"
  "scripts/integrations/zephyr/sync-test-cases.js"
  "scripts/integrations/zephyr/generate-report-url.js"
  "scripts/integrations/zephyr/format-cycle-summary.js"
  ".maestro/config/zephyr-credentials.js"
)

for file in "${EXEC_FILES[@]}"; do
  if [ -x "$PROJECT_ROOT/$file" ]; then
    echo -e "  ${GREEN}✓${NC} $file (executable)"
  else
    echo -e "  ${YELLOW}⚠${NC} $file (not executable)"
    ((WARNINGS++))
  fi
done

echo ""

# Check Node.js
echo "🟢 Checking Node.js..."
if command -v node &> /dev/null; then
  NODE_VERSION=$(node --version)
  echo -e "  ${GREEN}✓${NC} Node.js installed: $NODE_VERSION"
else
  echo -e "  ${RED}✗${NC} Node.js not found"
  ((ERRORS++))
fi

echo ""

# Check environment variables
echo "🔑 Checking environment variables..."

if [ -n "$ZEPHYR_API_TOKEN" ]; then
  TOKEN_PREVIEW="${ZEPHYR_API_TOKEN:0:4}...${ZEPHYR_API_TOKEN: -4}"
  echo -e "  ${GREEN}✓${NC} ZEPHYR_API_TOKEN is set ($TOKEN_PREVIEW)"
else
  echo -e "  ${YELLOW}⚠${NC} ZEPHYR_API_TOKEN not set (required for API calls)"
  ((WARNINGS++))
fi

if [ -n "$ZEPHYR_PROJECT_KEY" ]; then
  echo -e "  ${GREEN}✓${NC} ZEPHYR_PROJECT_KEY is set ($ZEPHYR_PROJECT_KEY)"
else
  echo -e "  ${YELLOW}⚠${NC} ZEPHYR_PROJECT_KEY not set (will use default: TLPCWHSAM)"
fi

echo ""

# Test credentials loader
echo "🧪 Testing credentials loader..."
if node "$PROJECT_ROOT/.maestro/config/zephyr-credentials.js" &> /dev/null; then
  echo -e "  ${GREEN}✓${NC} Credentials loader works"
else
  echo -e "  ${YELLOW}⚠${NC} Credentials loader failed (ZEPHYR_API_TOKEN may not be set)"
  ((WARNINGS++))
fi

echo ""

# Test API client (if token is set)
if [ -n "$ZEPHYR_API_TOKEN" ]; then
  echo "🌐 Testing Zephyr Scale API connection..."
  if node "$PROJECT_ROOT/scripts/integrations/zephyr/zephyr-scale-client.js" &> /dev/null; then
    echo -e "  ${GREEN}✓${NC} API connection successful"
  else
    echo -e "  ${RED}✗${NC} API connection failed (check token and network)"
    ((ERRORS++))
  fi
else
  echo "🌐 Skipping API connection test (ZEPHYR_API_TOKEN not set)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Summary
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
  echo -e "${GREEN}✅ Installation verified successfully!${NC}"
  echo ""
  echo "Next steps:"
  echo "  1. Set ZEPHYR_API_TOKEN if not already set"
  echo "  2. Run: node scripts/integrations/zephyr/sync-test-cases.js --push"
  echo "  3. See docs/integrations/ZEPHYR_SCALE_GUIDE.md for usage"
  exit 0
elif [ $ERRORS -eq 0 ]; then
  echo -e "${YELLOW}⚠️  Installation verified with $WARNINGS warning(s)${NC}"
  echo ""
  echo "Warnings are non-critical but should be addressed:"
  echo "  - Set ZEPHYR_API_TOKEN environment variable"
  echo "  - Make scripts executable: chmod +x scripts/integrations/zephyr/*.js"
  exit 0
else
  echo -e "${RED}❌ Installation verification failed with $ERRORS error(s) and $WARNINGS warning(s)${NC}"
  echo ""
  echo "Please fix the errors above before using the integration."
  exit 1
fi
