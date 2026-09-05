#!/bin/bash

# ============================================================================
# Maestro Flow Recorder - Fix Dependencies Script
# ============================================================================
# This script fixes common npm dependency issues like "Cannot find module 'ajv'"
# Usage: ./scripts/recorder/fix-dependencies.sh
# ============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
RECORDER_ROOT="$PROJECT_ROOT/utilities/maestro-recorder"

echo -e "${BLUE}🔧 Maestro Flow Recorder - Fix Dependencies${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ============================================================================
# Fix Frontend Dependencies
# ============================================================================

if [ -d "$RECORDER_ROOT/frontend" ]; then
    echo -e "${BLUE}📦 Fixing frontend dependencies...${NC}"
    cd "$RECORDER_ROOT/frontend"
    
    # Stop any running processes
    lsof -ti:3000 | xargs kill -9 2>/dev/null || true
    
    # Clear npm cache
    echo -e "${YELLOW}🗑️  Clearing npm cache...${NC}"
    npm cache clean --force
    
    # Remove node_modules and lock files
    echo -e "${YELLOW}🗑️  Removing node_modules and package-lock.json...${NC}"
    rm -rf node_modules
    rm -f package-lock.json
    rm -f .npmrc
    
    # Create .npmrc for better dependency resolution
    echo -e "${BLUE}📝 Creating .npmrc...${NC}"
    cat > .npmrc << 'EOF'
legacy-peer-deps=true
strict-ssl=true
EOF
    
    # Fix ajv version compatibility in package.json
    echo -e "${BLUE}🔧 Fixing ajv version compatibility...${NC}"
    if [ -f "package.json" ]; then
        # Use Node.js to add overrides to package.json
        node <<'NODESCRIPT'
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

// Add overrides for ajv compatibility
pkg.overrides = pkg.overrides || {};
pkg.overrides.ajv = '^8.12.0';
pkg.overrides['ajv-keywords'] = '^5.1.0';

// Also add resolutions for yarn compatibility
pkg.resolutions = pkg.resolutions || {};
pkg.resolutions.ajv = '^8.12.0';
pkg.resolutions['ajv-keywords'] = '^5.1.0';

// Force TypeScript to compatible version
pkg.dependencies = pkg.dependencies || {};
pkg.dependencies.typescript = '^4.9.5';

fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
console.log('✅ Updated package.json with ajv overrides');
NODESCRIPT
    fi
    
    # Reinstall dependencies
    echo -e "${BLUE}📦 Reinstalling dependencies (this may take a few minutes)...${NC}"
    echo ""
    
    if npm install --legacy-peer-deps; then
        echo ""
        echo -e "${GREEN}✅ Frontend dependencies fixed!${NC}"
    else
        echo ""
        echo -e "${RED}❌ Failed to fix frontend dependencies${NC}"
        echo ""
        echo "Try these manual steps:"
        echo "  cd utilities/maestro-recorder/frontend"
        echo "  rm -rf node_modules package-lock.json"
        echo "  npm cache clean --force"
        echo "  npm install --legacy-peer-deps --force"
        echo ""
        exit 1
    fi
    
    echo ""
else
    echo -e "${YELLOW}⚠️  Frontend directory not found. Run install-recorder.sh first.${NC}"
fi

# ============================================================================
# Fix Backend Dependencies
# ============================================================================

if [ -d "$RECORDER_ROOT/backend" ]; then
    echo -e "${BLUE}📦 Fixing backend dependencies...${NC}"
    cd "$RECORDER_ROOT/backend"
    
    # Stop any running processes
    lsof -ti:3001 | xargs kill -9 2>/dev/null || true
    
    # Clear npm cache
    echo -e "${YELLOW}🗑️  Clearing npm cache...${NC}"
    npm cache clean --force
    
    # Remove node_modules and lock files
    echo -e "${YELLOW}🗑️  Removing node_modules and package-lock.json...${NC}"
    rm -rf node_modules
    rm -f package-lock.json
    
    # Reinstall dependencies
    echo -e "${BLUE}📦 Reinstalling dependencies...${NC}"
    echo ""
    
    if npm install; then
        echo ""
        echo -e "${GREEN}✅ Backend dependencies fixed!${NC}"
    else
        echo ""
        echo -e "${RED}❌ Failed to fix backend dependencies${NC}"
        echo ""
        echo "Try these manual steps:"
        echo "  cd utilities/maestro-recorder/backend"
        echo "  rm -rf node_modules package-lock.json"
        echo "  npm cache clean --force"
        echo "  npm install --force"
        echo ""
        exit 1
    fi
    
    echo ""
else
    echo -e "${YELLOW}⚠️  Backend directory not found. Run install-recorder.sh first.${NC}"
fi

# ============================================================================
# Verify Installation
# ============================================================================

echo -e "${BLUE}🔍 Verifying installation...${NC}"
echo ""

cd "$RECORDER_ROOT/frontend"
if [ -d "node_modules" ] && [ -d "node_modules/react" ]; then
    echo -e "${GREEN}✅ Frontend: React installed${NC}"
else
    echo -e "${RED}❌ Frontend: React missing${NC}"
fi

if [ -d "node_modules/@mui/material" ]; then
    echo -e "${GREEN}✅ Frontend: Material-UI installed${NC}"
else
    echo -e "${RED}❌ Frontend: Material-UI missing${NC}"
fi

cd "$RECORDER_ROOT/backend"
if [ -d "node_modules" ] && [ -d "node_modules/express" ]; then
    echo -e "${GREEN}✅ Backend: Express installed${NC}"
else
    echo -e "${RED}❌ Backend: Express missing${NC}"
fi

if [ -d "node_modules/ws" ]; then
    echo -e "${GREEN}✅ Backend: WebSocket installed${NC}"
else
    echo -e "${RED}❌ Backend: WebSocket missing${NC}"
fi

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Dependencies Fixed!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}🚀 Next steps:${NC}"
echo ""
echo "1. Start the recorder:"
echo -e "   ${GREEN}./scripts/recorder/start-recorder.sh${NC}"
echo ""
echo "2. If you still see errors, check Node.js version:"
echo -e "   ${GREEN}node --version${NC}"
echo "   (Must be 16.0.0 or higher)"
echo ""
echo "3. If issues persist, try reinstalling completely:"
echo -e "   ${GREEN}./scripts/recorder/install-recorder.sh${NC}"
echo ""
