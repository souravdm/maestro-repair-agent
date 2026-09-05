#!/bin/bash

# Maestro Flow Recorder - Stop Script

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🛑 Stopping Maestro Flow Recorder...${NC}"

# Kill processes by port
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:3001 | xargs kill -9 2>/dev/null || true

echo -e "${GREEN}✅ All servers stopped${NC}"
