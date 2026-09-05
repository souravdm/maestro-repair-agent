#!/bin/bash

# ============================================================================
# Quick Fix for OpenSSL Digital Envelope Error
# ============================================================================
# This script fixes the "digital envelope routines::unsupported" error
# that occurs with Node.js 17+ and webpack
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

echo -e "${BLUE}🔧 Quick Fix: OpenSSL Digital Envelope Error${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

NODE_VERSION=$(node --version)
echo -e "${YELLOW}⚠️  Detected Node.js $NODE_VERSION${NC}"
echo ""

if [ ! -d "$FRONTEND_DIR" ]; then
    echo -e "${RED}❌ Frontend directory not found${NC}"
    exit 1
fi

cd "$FRONTEND_DIR"

# Update package.json scripts to include NODE_OPTIONS
echo -e "${BLUE}📝 Updating package.json scripts...${NC}"
node <<'NODESCRIPT'
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

// Update scripts to include NODE_OPTIONS
pkg.scripts = pkg.scripts || {};
pkg.scripts.start = 'NODE_OPTIONS=--openssl-legacy-provider react-scripts start';
pkg.scripts.build = 'NODE_OPTIONS=--openssl-legacy-provider react-scripts build';
pkg.scripts.test = 'react-scripts test';

fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
console.log('✅ Updated package.json scripts');
NODESCRIPT

# Create .env file with NODE_OPTIONS
echo -e "${BLUE}📝 Creating .env file...${NC}"
cat > .env << 'EOF'
# React App Configuration
REACT_APP_API_URL=http://localhost:3001
REACT_APP_WS_URL=ws://localhost:3001
REACT_APP_POLL_INTERVAL=500
REACT_APP_SCREENSHOT_QUALITY=80
PORT=3000

# Node.js OpenSSL Fix for Node 17+
NODE_OPTIONS=--openssl-legacy-provider
EOF

echo -e "${GREEN}✅ Configuration updated${NC}"
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
echo "2. Or test frontend directly:"
echo -e "   ${GREEN}cd utilities/utilities/maestro-recorder/frontend && npm start${NC}"
echo ""
echo -e "${YELLOW}📝 Note: For production, consider using Node.js LTS (18.x or 20.x)${NC}"
echo ""
echo "To switch Node.js version:"
echo -e "  ${BLUE}# Using nvm (recommended)${NC}"
echo -e "  ${GREEN}nvm install 20${NC}"
echo -e "  ${GREEN}nvm use 20${NC}"
echo ""
echo -e "  ${BLUE}# Or using Homebrew${NC}"
echo -e "  ${GREEN}brew install node@20${NC}"
echo -e "  ${GREEN}brew link node@20 --force --overwrite${NC}"
echo ""
