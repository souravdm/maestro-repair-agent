#!/bin/bash

# Maestro Flow Recorder - Start Script
# Boots three processes together (hierarchy shim, backend, frontend) so the
# user only needs one terminal. Ctrl+C stops all of them.
set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Get directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
RECORDER_ROOT="$PROJECT_ROOT/utilities/maestro-recorder"

STUDIO_PORT="${MAESTRO_STUDIO_PORT:-9999}"
STUDIO_LOG="${RECORDER_ROOT}/logs/hierarchy-shim.log"
mkdir -p "$(dirname "$STUDIO_LOG")"

STUDIO_PID=""
BACKEND_PID=""
FRONTEND_PID=""

echo -e "${BLUE}🎬 Starting Maestro Flow Recorder...${NC}"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# Cleanup handler — installed before anything is spawned so an early failure
# still shuts down whatever did start.
# ─────────────────────────────────────────────────────────────────────────────
cleanup() {
    echo ""
    echo -e "${BLUE}🛑 Stopping servers...${NC}"
    [ -n "$FRONTEND_PID" ] && kill "$FRONTEND_PID" 2>/dev/null || true
    [ -n "$BACKEND_PID"  ] && kill "$BACKEND_PID"  2>/dev/null || true
    if [ -n "$STUDIO_PID" ]; then
        # Hierarchy shim is a plain Node process — kill it and any children.
        pkill -P "$STUDIO_PID" 2>/dev/null || true
        kill "$STUDIO_PID" 2>/dev/null || true
    fi
    # Belt-and-suspenders: anything still bound to the studio port.
    lsof -ti tcp:"$STUDIO_PORT" 2>/dev/null | xargs kill -9 2>/dev/null || true
    echo -e "${GREEN}✅ Stopped${NC}"
}
trap cleanup EXIT INT TERM

# ─────────────────────────────────────────────────────────────────────────────
# 1. Hierarchy shim — lightweight Node.js server that exposes the same
#    /api/device-screen contract Studio used (Maestro ≥2.6.0 removed Studio
#    from the CLI). The shim background-caches `maestro hierarchy` (refreshed
#    every 2s) and captures screenshots via xcrun simctl / adb directly
#    (~100ms, no JVM). studioClient.ts needs zero changes.
# ─────────────────────────────────────────────────────────────────────────────
PLATFORM="${MAESTRO_PLATFORM:-ios}"
SHIM_SCRIPT="$SCRIPT_DIR/hierarchy-server.js"

if curl -sf "http://127.0.0.1:${STUDIO_PORT}/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Hierarchy shim already running on port ${STUDIO_PORT} — reusing${NC}"
else
    if [ ! -f "$SHIM_SCRIPT" ]; then
        echo -e "${RED}❌ hierarchy-server.js not found at $SHIM_SCRIPT${NC}"
        exit 1
    fi
    if ! command -v node >/dev/null 2>&1; then
        echo -e "${RED}❌ node not found on PATH — cannot start hierarchy shim${NC}"
        exit 1
    fi

    echo -e "${BLUE}⚡ Starting hierarchy shim on port ${STUDIO_PORT} (platform: ${PLATFORM}, log: $STUDIO_LOG)...${NC}"
    MAESTRO_STUDIO_PORT="$STUDIO_PORT" \
    MAESTRO_PLATFORM="$PLATFORM" \
    node "$SHIM_SCRIPT" >> "$STUDIO_LOG" 2>&1 &
    STUDIO_PID=$!

    # Wait until the HTTP server is accepting connections. The shim answers
    # /health immediately on startup (before the first tree fetch completes),
    # so this typically resolves in under 2s.
    SHIM_READY=false
    for i in $(seq 1 15); do
        if curl -sf "http://127.0.0.1:${STUDIO_PORT}/health" > /dev/null 2>&1; then
            SHIM_READY=true
            break
        fi
        if ! kill -0 "$STUDIO_PID" 2>/dev/null; then
            echo -e "${RED}❌ Hierarchy shim exited unexpectedly. See $STUDIO_LOG${NC}"
            STUDIO_PID=""
            break
        fi
        sleep 1
    done

    if [ "$SHIM_READY" = "true" ]; then
        echo -e "${GREEN}✅ Hierarchy shim ready (PID: $STUDIO_PID) — tree warming in background...${NC}"
    else
        echo -e "${YELLOW}⚠️  Hierarchy shim didn't start in 15s — hierarchy uses CLI fallback.${NC}"
        echo -e "${YELLOW}    See $STUDIO_LOG for details.${NC}"
        [ -n "$STUDIO_PID" ] && kill "$STUDIO_PID" 2>/dev/null || true
        STUDIO_PID=""
    fi
fi
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# 2. Backend — TypeScript build + node server. The backend probes the shim on
#    boot and prints which hierarchy source it picked.
# ─────────────────────────────────────────────────────────────────────────────
echo -e "${BLUE}📦 Building backend...${NC}"
cd "$RECORDER_ROOT/backend"
npm run build

echo -e "${BLUE}🔧 Starting backend server...${NC}"
# Pass the studio port through so studioClient.ts targets the right endpoint
# even if the user overrode MAESTRO_STUDIO_PORT.
MAESTRO_STUDIO_PORT="$STUDIO_PORT" npm start &
BACKEND_PID=$!

echo -e "${BLUE}⏳ Waiting for backend...${NC}"
for i in $(seq 1 15); do
    if curl -sf http://localhost:3001/health > /dev/null 2>&1; then
        break
    fi
    if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
        echo -e "${RED}❌ Backend process exited before it was ready${NC}"
        exit 1
    fi
    sleep 1
done

if ! curl -sf http://localhost:3001/health > /dev/null 2>&1; then
    echo -e "${RED}❌ Backend failed to start (timed out after 15s)${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Backend running (PID: $BACKEND_PID)${NC}"

# ─────────────────────────────────────────────────────────────────────────────
# 3. Frontend — CRA dev server.
# ─────────────────────────────────────────────────────────────────────────────
export NODE_OPTIONS="--openssl-legacy-provider"

echo -e "${BLUE}⚛️  Starting frontend...${NC}"
cd "$RECORDER_ROOT/frontend"
PATH="$PROJECT_ROOT/node_modules/.bin:$PATH" npm start &
FRONTEND_PID=$!

echo ""
echo -e "${GREEN}✅ Maestro Flow Recorder started!${NC}"
echo ""
echo "🌐 Frontend:  http://localhost:3000"
echo "🔧 Backend:   http://localhost:3001"
echo "🔌 WebSocket: ws://localhost:3001"
if [ -n "$STUDIO_PID" ]; then
    echo "⚡ Shim:      http://localhost:${STUDIO_PORT}  (cached hierarchy, live screenshots)"
else
    echo "🐢 Shim:      disabled — hierarchy uses CLI fallback (~2s per fetch)"
fi
echo ""
echo "Press Ctrl+C to stop all servers"
echo ""

# Wait for user interrupt
wait
