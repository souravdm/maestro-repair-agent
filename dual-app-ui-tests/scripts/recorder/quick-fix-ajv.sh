#!/bin/bash

# ============================================================================
# Quick Fix for ajv/dist/compile/codegen Error
# ============================================================================
# This script fixes the specific ajv module error
# Usage: ./scripts/recorder/quick-fix-ajv.sh
# ============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FRONTEND_DIR="$PROJECT_ROOT/utilities/maestro-recorder/frontend"

echo -e "${BLUE}🔧 Quick Fix: ajv/dist/compile/codegen Error${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ ! -d "$FRONTEND_DIR" ]; then
    echo -e "${RED}❌ Frontend directory not found${NC}"
    echo "Please run ./scripts/recorder/install-recorder.sh first"
    exit 1
fi

cd "$FRONTEND_DIR"

# Stop any running processes
echo -e "${YELLOW}🛑 Stopping any running processes...${NC}"
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
sleep 1

# Step 1: Update package.json with overrides
echo -e "${BLUE}📝 Step 1/4: Updating package.json with ajv overrides...${NC}"
node <<'NODESCRIPT'
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

// Add overrides for ajv compatibility
pkg.overrides = pkg.overrides || {};
pkg.overrides.ajv = '^8.12.0';
pkg.overrides['ajv-keywords'] = '^5.1.0';

// Also add resolutions (for yarn compatibility)
pkg.resolutions = pkg.resolutions || {};
pkg.resolutions.ajv = '^8.12.0';
pkg.resolutions['ajv-keywords'] = '^5.1.0';

// Fix TypeScript version
if (pkg.dependencies && pkg.dependencies.typescript) {
    pkg.dependencies.typescript = '^4.9.5';
}

fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
console.log('✅ Updated package.json');
NODESCRIPT

# Step 2: Clean everything
echo -e "${BLUE}🗑️  Step 2/4: Cleaning old files...${NC}"
rm -rf node_modules package-lock.json yarn.lock .npmrc 2>/dev/null || true

# Step 3: Create .npmrc
echo -e "${BLUE}📝 Step 3/4: Creating .npmrc...${NC}"
cat > .npmrc << 'EOF'
legacy-peer-deps=true
strict-ssl=true
EOF

# Step 4: Reinstall with --force
echo -e "${BLUE}📦 Step 4/4: Reinstalling dependencies (this may take 2-3 minutes)...${NC}"
echo ""

if npm install --legacy-peer-deps --force --loglevel=warn 2>&1 | grep -v "deprecated"; then
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}✅ Fix Complete!${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "${BLUE}🚀 Next steps:${NC}"
    echo ""
    echo "1. Start the recorder:"
    echo -e "   ${GREEN}./scripts/recorder/start-recorder.sh${NC}"
    echo ""
    echo "2. Or test frontend only:"
    echo -e "   ${GREEN}cd utilities/utilities/maestro-recorder/frontend && npm start${NC}"
    echo ""
else
    echo ""
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}❌ Installation Failed${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "Try these alternative solutions:"
    echo ""
    echo "Option 1: Use older react-scripts"
    echo -e "  ${YELLOW}npm install react-scripts@4.0.3 --save --legacy-peer-deps${NC}"
    echo ""
    echo "Option 2: Complete reinstall"
    echo -e "  ${YELLOW}rm -rf ../utilities/maestro-recorder${NC}"
    echo -e "  ${YELLOW}./scripts/recorder/install-recorder.sh${NC}"
    echo ""
    echo "Option 3: Check Node.js version"
    echo -e "  ${YELLOW}node --version${NC}"
    echo "  Should be v16.x, v18.x, or v20.x (LTS versions)"
    echo ""
    exit 1
fi
