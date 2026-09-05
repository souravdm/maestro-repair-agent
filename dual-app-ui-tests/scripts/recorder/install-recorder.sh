#!/bin/bash

# ============================================================================
# Maestro Flow Recorder - Installation Script
# ============================================================================
# This script installs and sets up the Maestro Flow Recorder
# Usage: ./scripts/recorder/install-recorder.sh
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

echo -e "${BLUE}🎬 Maestro Flow Recorder - Installation${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ============================================================================
# Step 1: Check Prerequisites
# ============================================================================

echo -e "${BLUE}📋 Checking prerequisites...${NC}"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed${NC}"
    echo ""
    echo "Install Node.js:"
    echo "  brew install node"
    echo ""
    exit 1
else
    NODE_VERSION=$(node --version | cut -d 'v' -f 2)
    REQUIRED_NODE_VERSION="16.0.0"
    
    if [ "$(printf '%s\n' "$REQUIRED_NODE_VERSION" "$NODE_VERSION" | sort -V | head -n1)" != "$REQUIRED_NODE_VERSION" ]; then
        echo -e "${RED}❌ Node.js version $NODE_VERSION is too old (required: >= $REQUIRED_NODE_VERSION)${NC}"
        echo ""
        echo "Update Node.js:"
        echo "  brew upgrade node"
        echo ""
        exit 1
    fi
    
    echo -e "${GREEN}✅ Node.js $NODE_VERSION${NC}"
fi

# Check npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed${NC}"
    exit 1
else
    NPM_VERSION=$(npm --version)
    echo -e "${GREEN}✅ npm $NPM_VERSION${NC}"
fi

# Check Maestro
if ! command -v maestro &> /dev/null; then
    echo -e "${YELLOW}⚠️  Maestro CLI is not installed${NC}"
    echo ""
    echo "Install Maestro:"
    echo "  brew install maestro"
    echo ""
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    MAESTRO_VERSION=$(maestro --version 2>&1 | head -n 1)
    echo -e "${GREEN}✅ $MAESTRO_VERSION${NC}"
fi

echo ""

# ============================================================================
# Step 2: Create Project Structure
# ============================================================================

echo -e "${BLUE}📁 Creating project structure...${NC}"

# Create directories
mkdir -p "$RECORDER_ROOT"/{frontend,backend,shared}
mkdir -p "$RECORDER_ROOT/frontend"/{src,public}
mkdir -p "$RECORDER_ROOT/frontend/src"/{components,services,store,types,hooks,utils}
mkdir -p "$RECORDER_ROOT/backend"/{src,logs,recordings}
mkdir -p "$RECORDER_ROOT/backend/src"/{controllers,services,utils}

echo -e "${GREEN}✅ Project structure created${NC}"
echo ""

# ============================================================================
# Step 3: Initialize Frontend
# ============================================================================

echo -e "${BLUE}⚛️  Setting up frontend (React + TypeScript)...${NC}"

cd "$RECORDER_ROOT/frontend"

# Create package.json
if [ ! -f "package.json" ]; then
    cat > package.json << 'EOF'
{
  "name": "maestro-flow-recorder-frontend",
  "version": "1.0.0",
  "private": true,
  "description": "Maestro Flow Recorder - Frontend",
  "dependencies": {
    "@emotion/react": "^11.11.4",
    "@emotion/styled": "^11.11.5",
    "@monaco-editor/react": "^4.6.0",
    "@mui/icons-material": "^5.15.15",
    "@mui/material": "^5.15.15",
    "axios": "^1.6.8",
    "d3": "^7.9.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.22.3",
    "react-scripts": "5.0.1",
    "typescript": "^4.9.5",
    "ws": "^8.17.0",
    "yaml": "^2.4.1"
  },
  "devDependencies": {
    "@types/node": "^20.12.7",
    "@types/react": "^18.2.79",
    "@types/react-dom": "^18.2.25",
    "@types/ws": "^8.5.10"
  },
  "overrides": {
    "ajv": "^8.12.0",
    "ajv-keywords": "^5.1.0"
  },
  "resolutions": {
    "ajv": "^8.12.0",
    "ajv-keywords": "^5.1.0"
  },
  "scripts": {
    "start": "NODE_OPTIONS=--openssl-legacy-provider react-scripts start",
    "build": "NODE_OPTIONS=--openssl-legacy-provider react-scripts build",
    "test": "react-scripts test",
    "eject": "react-scripts eject"
  },
  "eslintConfig": {
    "extends": [
      "react-app"
    ]
  },
  "browserslist": {
    "production": [
      ">0.2%",
      "not dead",
      "not op_mini all"
    ],
    "development": [
      "last 1 chrome version",
      "last 1 firefox version",
      "last 1 safari version"
    ]
  }
}
EOF
    
    echo -e "${GREEN}✅ Frontend package.json created${NC}"
fi

# Create .env
if [ ! -f ".env" ]; then
    cat > .env << 'EOF'
REACT_APP_API_URL=http://localhost:3001
REACT_APP_WS_URL=ws://localhost:3001
REACT_APP_POLL_INTERVAL=500
REACT_APP_SCREENSHOT_QUALITY=80
PORT=3000

# Fix for Node.js 17+ OpenSSL compatibility
NODE_OPTIONS=--openssl-legacy-provider
EOF
    
    echo -e "${GREEN}✅ Frontend .env created${NC}"
fi

# Create index.html
mkdir -p public
if [ ! -f "public/index.html" ]; then
    cat > public/index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#CC0000" />
    <meta name="description" content="Maestro Flow Recorder - Professional QA Automation Tool" />
    <title>Maestro Flow Recorder</title>
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
  </body>
</html>
EOF
    
    echo -e "${GREEN}✅ Frontend index.html created${NC}"
fi

# Create basic App.tsx
mkdir -p src
if [ ! -f "src/App.tsx" ]; then
    cat > src/App.tsx << 'EOF'
import React from 'react';
import { ThemeProvider, createTheme, CssBaseline, Box, Typography, Button } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';

// CVS Red theme
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#CC0000',
    },
    background: {
      default: '#1E1E1E',
      paper: '#252525',
    },
  },
});

function App() {
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          textAlign: 'center',
        }}
      >
        <Typography variant="h2" gutterBottom>
          🎬 Maestro Flow Recorder
        </Typography>
        <Typography variant="h5" color="text.secondary" gutterBottom>
          Professional QA Automation Tool
        </Typography>
        <Box sx={{ mt: 4 }}>
          <Button
            variant="contained"
            size="large"
            startIcon={<PlayArrowIcon />}
            sx={{ mr: 2 }}
          >
            Start Recording
          </Button>
          <Button variant="outlined" size="large">
            View Docs
          </Button>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 4 }}>
          Version 1.0.0 • Ready for Development
        </Typography>
      </Box>
    </ThemeProvider>
  );
}

export default App;
EOF
    
    echo -e "${GREEN}✅ Frontend App.tsx created${NC}"
fi

# Create index.tsx
if [ ! -f "src/index.tsx" ]; then
    cat > src/index.tsx << 'EOF'
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
EOF
    
    echo -e "${GREEN}✅ Frontend index.tsx created${NC}"
fi

# Create tsconfig.json
if [ ! -f "tsconfig.json" ]; then
    cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noFallthroughCasesInSwitch": true,
    "module": "esnext",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src"]
}
EOF
    
    echo -e "${GREEN}✅ Frontend tsconfig.json created${NC}"
fi

# Install frontend dependencies
echo ""
echo -e "${BLUE}📦 Installing frontend dependencies (this may take a few minutes)...${NC}"

# Clear npm cache to avoid module resolution issues
npm cache clean --force 2>/dev/null || true

# Remove existing node_modules and package-lock if they exist
if [ -d "node_modules" ]; then
    echo -e "${YELLOW}⚠️  Removing existing node_modules...${NC}"
    rm -rf node_modules
fi

if [ -f "package-lock.json" ]; then
    echo -e "${YELLOW}⚠️  Removing existing package-lock.json...${NC}"
    rm -f package-lock.json
fi

# Create .npmrc to handle peer dependencies
cat > .npmrc << 'EOF'
legacy-peer-deps=true
strict-ssl=true
EOF

# Install with legacy peer deps
echo -e "${BLUE}📦 Running npm install...${NC}"
if npm install --legacy-peer-deps --loglevel=error; then
    echo -e "${GREEN}✅ Frontend dependencies installed${NC}"
else
    echo -e "${RED}❌ Frontend npm install failed${NC}"
    echo ""
    echo "Common fixes:"
    echo "1. Delete node_modules: rm -rf node_modules package-lock.json"
    echo "2. Clear cache: npm cache clean --force"
    echo "3. Try: npm install --legacy-peer-deps --force"
    echo "4. Check Node.js version: node --version (need 16+)"
    echo ""
    exit 1
fi

echo -e "${GREEN}✅ Frontend setup complete${NC}"
echo ""

# ============================================================================
# Step 4: Initialize Backend
# ============================================================================

echo -e "${BLUE}🔧 Setting up backend (Node.js + Express + WebSocket)...${NC}"

cd "$RECORDER_ROOT/backend"

# Create package.json
if [ ! -f "package.json" ]; then
    cat > package.json << 'EOF'
{
  "name": "maestro-flow-recorder-backend",
  "version": "1.0.0",
  "description": "Maestro Flow Recorder - Backend",
  "main": "dist/server.js",
  "scripts": {
    "start": "node dist/server.js",
    "dev": "ts-node src/server.ts",
    "build": "tsc",
    "watch": "tsc --watch"
  },
  "dependencies": {
    "body-parser": "^1.20.2",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "uuid": "^9.0.1",
    "ws": "^8.17.0",
    "yaml": "^2.4.1"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/node": "^20.12.7",
    "@types/uuid": "^9.0.8",
    "@types/ws": "^8.5.10",
    "ts-node": "^10.9.2",
    "typescript": "^5.4.5"
  }
}
EOF
    
    echo -e "${GREEN}✅ Backend package.json created${NC}"
fi

# Create .env
if [ ! -f ".env" ]; then
    cat > .env << 'EOF'
NODE_ENV=development
PORT=3001
WS_PORT=3001
MAESTRO_PATH=/opt/homebrew/bin/maestro
RECORDINGS_DIR=./recordings
MAX_RECORDINGS=100
LOG_LEVEL=info
EOF
    
    echo -e "${GREEN}✅ Backend .env created${NC}"
fi

# Create tsconfig.json
if [ ! -f "tsconfig.json" ]; then
    cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
EOF
    
    echo -e "${GREEN}✅ Backend tsconfig.json created${NC}"
fi

# Create basic server.ts
mkdir -p src
if [ ! -f "src/server.ts" ]; then
    cat > src/server.ts << 'EOF'
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.get('/api/devices', async (req, res) => {
  // TODO: Implement device listing
  res.json({
    devices: [
      { id: 'ios-simulator', name: 'iPhone 17 Pro', platform: 'ios', status: 'available' },
      { id: 'android-emulator', name: 'Pixel 8 Pro', platform: 'android', status: 'available' }
    ]
  });
});

app.get('/api/recordings', async (req, res) => {
  // TODO: Implement recordings listing
  res.json({ recordings: [] });
});

app.post('/api/recordings', async (req, res) => {
  // TODO: Implement recording creation
  res.json({ id: 'rec-1', name: req.body.name, status: 'created' });
});

// WebSocket connection
wss.on('connection', (ws) => {
  console.log('🔌 WebSocket client connected');
  
  ws.send(JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() }));
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      console.log('📨 Received:', data.type);
      
      // TODO: Handle WebSocket messages
      ws.send(JSON.stringify({ type: 'ack', receivedType: data.type }));
    } catch (error) {
      console.error('❌ WebSocket error:', error);
    }
  });
  
  ws.on('close', () => {
    console.log('🔌 WebSocket client disconnected');
  });
});

// Start server
server.listen(PORT, () => {
  console.log('\n🎬 Maestro Flow Recorder - Backend');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ HTTP Server: http://localhost:${PORT}`);
  console.log(`✅ WebSocket Server: ws://localhost:${PORT}`);
  console.log(`✅ Environment: ${process.env.NODE_ENV}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('Ready for connections!');
});
EOF
    
    echo -e "${GREEN}✅ Backend server.ts created${NC}"
fi

# Install backend dependencies
echo ""
echo -e "${BLUE}📦 Installing backend dependencies...${NC}"

# Clear npm cache
npm cache clean --force 2>/dev/null || true

# Remove existing node_modules if they exist
if [ -d "node_modules" ]; then
    echo -e "${YELLOW}⚠️  Removing existing node_modules...${NC}"
    rm -rf node_modules
fi

if [ -f "package-lock.json" ]; then
    echo -e "${YELLOW}⚠️  Removing existing package-lock.json...${NC}"
    rm -f package-lock.json
fi

# Install backend dependencies
echo -e "${BLUE}📦 Running npm install...${NC}"
if npm install --loglevel=error; then
    echo -e "${GREEN}✅ Backend dependencies installed${NC}"
else
    echo -e "${RED}❌ Backend npm install failed${NC}"
    echo ""
    echo "Common fixes:"
    echo "1. Delete node_modules: rm -rf node_modules package-lock.json"
    echo "2. Clear cache: npm cache clean --force"
    echo "3. Try: npm install --force"
    echo ""
    exit 1
fi

echo -e "${GREEN}✅ Backend setup complete${NC}"
echo ""

# ============================================================================
# Step 5: Create Launcher Scripts
# ============================================================================

echo -e "${BLUE}🚀 Creating launcher scripts...${NC}"

# Start script
cat > "$SCRIPT_DIR/start-recorder.sh" << 'EOF'
#!/bin/bash

# Maestro Flow Recorder - Start Script
set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

# Get directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
RECORDER_ROOT="$PROJECT_ROOT/utilities/maestro-recorder"

echo -e "${BLUE}🎬 Starting Maestro Flow Recorder...${NC}"
echo ""

# Build backend
echo -e "${BLUE}📦 Building backend...${NC}"
cd "$RECORDER_ROOT/backend"
npm run build

# Start backend in background
echo -e "${BLUE}🔧 Starting backend server...${NC}"
npm start &
BACKEND_PID=$!

# Wait for backend to be ready
echo -e "${BLUE}⏳ Waiting for backend...${NC}"
sleep 3

# Check if backend is running
if ! curl -s http://localhost:3001/health > /dev/null; then
    echo -e "${RED}❌ Backend failed to start${NC}"
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
fi

echo -e "${GREEN}✅ Backend running (PID: $BACKEND_PID)${NC}"

# Export NODE_OPTIONS for OpenSSL compatibility (Node.js 17+)
export NODE_OPTIONS="--openssl-legacy-provider"

# Start frontend
echo -e "${BLUE}⚛️  Starting frontend...${NC}"
cd "$RECORDER_ROOT/frontend"
npm start &
FRONTEND_PID=$!

echo ""
echo -e "${GREEN}✅ Maestro Flow Recorder started!${NC}"
echo ""
echo "🌐 Frontend: http://localhost:3000"
echo "🔧 Backend: http://localhost:3001"
echo "🔌 WebSocket: ws://localhost:3001"
echo ""
echo "Press Ctrl+C to stop all servers"
echo ""

# Cleanup on exit
cleanup() {
    echo ""
    echo -e "${BLUE}🛑 Stopping servers...${NC}"
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    echo -e "${GREEN}✅ Stopped${NC}"
}

trap cleanup EXIT INT TERM

# Wait for user interrupt
wait
EOF

chmod +x "$SCRIPT_DIR/start-recorder.sh"
echo -e "${GREEN}✅ Start script created: scripts/recorder/start-recorder.sh${NC}"

# Stop script
cat > "$SCRIPT_DIR/stop-recorder.sh" << 'EOF'
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
EOF

chmod +x "$SCRIPT_DIR/stop-recorder.sh"
echo -e "${GREEN}✅ Stop script created: scripts/recorder/stop-recorder.sh${NC}"

echo ""

# ============================================================================
# Step 6: Create README
# ============================================================================

cat > "$RECORDER_ROOT/README.md" << 'EOF'
# Maestro Flow Recorder

Professional QA automation tool with recording, playback, debugging, and script generation capabilities.

## Quick Start

### Start the recorder
```bash
./scripts/recorder/start-recorder.sh
```

This will:
- Build and start the backend server (http://localhost:3001)
- Start the frontend app (http://localhost:3000)
- Open the recorder in your browser

### Stop the recorder
```bash
./scripts/recorder/stop-recorder.sh
```

## Features

- 🎥 **Recording** - Record user interactions without writing code
- ▶️ **Playback** - Play back tests with full debugging controls
- 🐛 **Debugging** - Visual element inspection and network monitoring
- 📝 **Script Generation** - Export to framework-compliant YAML
- 🎨 **Modern UI** - React + Material-UI with dark theme
- 🚀 **Real-Time** - WebSocket-based live updates

## Documentation

See [MAESTRO_FLOW_RECORDER.md](../../docs/framework-features/MAESTRO_FLOW_RECORDER.md) for complete documentation.

## Development

### Frontend
```bash
cd utilities/utilities/maestro-recorder/frontend
npm start          # Start dev server
npm run build      # Production build
```

### Backend
```bash
cd utilities/utilities/maestro-recorder/backend
npm run dev        # Start with hot reload
npm run build      # Build TypeScript
npm start          # Start production server
```

## Architecture

```
utilities/maestro-recorder/
├── frontend/       # React + TypeScript app
│   ├── src/
│   │   ├── components/  # UI components
│   │   ├── services/    # API services
│   │   └── store/       # State management
│   └── public/
├── backend/        # Node.js + Express + WebSocket
│   ├── src/
│   │   ├── server.ts    # Main server
│   │   └── controllers/ # API controllers
│   └── recordings/      # Saved recordings
└── shared/         # Shared types
```

## Version

1.0.0 - MVP Phase

## Support

For issues or questions, see the main framework documentation or contact the team.
EOF

echo -e "${GREEN}✅ README created${NC}"
echo ""

# ============================================================================
# Complete!
# ============================================================================

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ Installation Complete!${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${BLUE}📁 Project structure:${NC}"
echo "   $RECORDER_ROOT/"
echo "   ├── frontend/    # React app"
echo "   ├── backend/     # Node.js server"
echo "   └── shared/      # Shared types"
echo ""
echo -e "${BLUE}🚀 Next steps:${NC}"
echo ""
echo "1. Start the recorder:"
echo -e "   ${GREEN}./scripts/recorder/start-recorder.sh${NC}"
echo ""
echo "2. Open in browser:"
echo -e "   ${GREEN}http://localhost:3000${NC}"
echo ""
echo "3. Read the documentation:"
echo -e "   ${GREEN}docs/framework-features/MAESTRO_FLOW_RECORDER.md${NC}"
echo ""
echo -e "${BLUE}📚 Documentation:${NC}"
echo "   - Complete guide: docs/framework-features/MAESTRO_FLOW_RECORDER.md"
echo "   - Architecture, features, usage examples"
echo "   - API reference and troubleshooting"
echo ""
echo -e "${GREEN}Happy recording! 🎬${NC}"
echo ""
