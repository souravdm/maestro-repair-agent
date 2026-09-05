#!/bin/bash

# Maestro Flow Recorder - Restart Script
# Stops running instances and starts fresh with latest code changes

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔄 Maestro Flow Recorder - Restart Script"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

RECORDER_DIR="utilities/maestro-recorder"

# Check if recorder directory exists
if [ ! -d "$RECORDER_DIR" ]; then
  echo "❌ Recorder not found. Run install-recorder.sh first."
  exit 1
fi

cd "$RECORDER_DIR"

echo "⏹️  Stopping existing instances..."

# Kill backend processes on port 3001
lsof -ti:3001 | xargs kill -9 2>/dev/null || true

# Kill frontend processes on port 3000
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

echo "✅ All instances stopped."
echo ""

# Rebuild backend (quick TypeScript compilation)
echo "🔨 Rebuilding backend..."
cd backend
npm run build 2>/dev/null
if [ $? -ne 0 ]; then
  echo "⚠️  Backend build had warnings, but continuing..."
fi
cd ..

echo "✅ Backend rebuilt."
echo ""

# Start recorder
echo "🚀 Starting Maestro Flow Recorder..."
echo ""

# Start backend
echo "📡 Starting backend..."
cd backend
NODE_ENV=development node dist/server.js &
BACKEND_PID=$!
cd ..

# Wait for backend to initialize
sleep 2

# Check if backend is running
if ! ps -p $BACKEND_PID > /dev/null; then
  echo "❌ Backend failed to start. Check logs above."
  exit 1
fi

echo "✅ Backend started (PID: $BACKEND_PID)"

# Start frontend
echo "🎨 Starting frontend..."
cd frontend

# Export OpenSSL fix for Node.js 17+
export NODE_OPTIONS="--openssl-legacy-provider"

npm start &
FRONTEND_PID=$!
cd ..

echo "✅ Frontend started (PID: $FRONTEND_PID)"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✨ Maestro Flow Recorder is running!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🌐 Frontend:  http://localhost:3000"
echo "📡 Backend:   http://localhost:3001"
echo "🔌 WebSocket: ws://localhost:3001"
echo ""
echo "📝 Note: Browser should open automatically in a few seconds."
echo "   If not, manually open: http://localhost:3000"
echo ""
echo "⏹️  To stop: ./scripts/recorder/stop-recorder.sh"
echo ""

# Wait a moment for servers to start
sleep 3

# Open browser (macOS)
open http://localhost:3000 2>/dev/null || echo "   Please open http://localhost:3000 manually"

echo ""
echo "Press Ctrl+C to stop both servers..."
echo ""

# Wait for both processes
wait $BACKEND_PID $FRONTEND_PID
