#!/bin/bash

# Live Dashboard Starter Script
# Automatically kills existing dashboard and starts a new one

PORT=${1:-8080}
REPORT_DIR=${2:-./test-reports}

echo "🎬 Starting Suite Live Dashboard..."

# Kill any existing process on the port
echo "🧹 Checking for existing dashboard on port $PORT..."
EXISTING_PID=$(lsof -ti:$PORT 2>/dev/null)
if [ -n "$EXISTING_PID" ]; then
  echo "   Found process $EXISTING_PID, killing it..."
  kill -9 $EXISTING_PID 2>/dev/null
  sleep 1
  echo "   ✓ Cleaned up"
fi

# Start the suite-specific dashboard
echo ""
echo "🚀 Starting suite dashboard on port $PORT..."
echo "📂 Monitoring: $REPORT_DIR"
echo ""
echo "Press Ctrl+C to stop"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

node scripts/reporting/suite-live-dashboard.js "$REPORT_DIR" "$PORT"
