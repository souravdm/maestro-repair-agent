const { app, BrowserWindow, Menu, ipcMain, clipboard } = require('electron');
const path = require('path');
const { spawn, execSync } = require('child_process');

let mainWindow;
let serverProcess;
let uiStateMapperProcess;

function createWindow() {
  const iconPath = path.join(__dirname, 'icon.png');
  const fs = require('fs');
  
  const windowConfig = {
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      allowRunningInsecureContent: true
    }
  };
  
  // Only set icon if it exists
  if (fs.existsSync(iconPath)) {
    windowConfig.icon = iconPath;
  }
  
  mainWindow = new BrowserWindow(windowConfig);

  mainWindow.loadURL('http://localhost:3003');

  // Enable right-click context menu for copy/paste and debugging
  mainWindow.webContents.on('context-menu', (e) => {
    e.preventDefault();
    const template = [
      { label: 'Cut', role: 'cut' },
      { label: 'Copy', role: 'copy' },
      { label: 'Paste', role: 'paste' },
      { type: 'separator' },
      { label: 'Inspect Element', role: 'inspectElement' }
    ];
    Menu.buildFromTemplate(template).popup(mainWindow);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startServer() {
  return new Promise((resolve, reject) => {
    // In dev mode, the server is already running via npm run dev
    if (process.env.ELECTRON_DEV === 'true') {
      console.log('[Server] Dev mode detected - server already running via npm run dev');
      resolve();
      return;
    }

    const serverPath = path.join(__dirname, 'server.js');
    const appDir = __dirname;
    
    console.log(`[Server] Starting server from: ${serverPath}`);
    console.log(`[Server] Working directory: ${appDir}`);
    
    serverProcess = spawn('node', [serverPath], {
      cwd: appDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: false,
      env: { ...process.env, NODE_ENV: 'production' }
    });

    let resolved = false;
    let serverReady = false;
    let errorOutput = '';

    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log(`[Server] ${output}`);
      if (output.includes('running at') || output.includes('3003')) {
        serverReady = true;
        if (!resolved) {
          resolved = true;
          setTimeout(resolve, 500);
        }
      }
    });

    serverProcess.stderr.on('data', (data) => {
      const output = data.toString();
      console.error(`[Server Error] ${output}`);
      errorOutput += output;
    });

    serverProcess.on('error', (err) => {
      console.error(`[Server Process Error] ${err.message}`);
      if (!resolved) {
        resolved = true;
        reject(new Error(`Failed to start server: ${err.message}`));
      }
    });

    serverProcess.on('exit', (code, signal) => {
      if (!resolved) {
        resolved = true;
        const msg = `Server exited with code ${code}${signal ? ` (signal: ${signal})` : ''}. Error: ${errorOutput}`;
        console.error(`[Server] ${msg}`);
        reject(new Error(msg));
      }
    });

    // Fallback: assume server is ready after 3 seconds
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        console.log('[Server] Assuming server is ready (timeout fallback)');
        resolve();
      }
    }, 3000);

    // Hard timeout after 15 seconds
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        reject(new Error(`Server startup timeout. Last error: ${errorOutput}`));
      }
    }, 15000);
  });
}

function startUIStateMapper() {
  const mapperPath = path.join(__dirname, '..', 'ui-state-mapper', 'server.js');
  const mapperDir = path.join(__dirname, '..', 'ui-state-mapper');

  console.log('[UIStateMapper] Starting server from:', mapperPath);

  uiStateMapperProcess = spawn('node', [mapperPath], {
    cwd: mapperDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
    env: { ...process.env, NODE_ENV: 'production', PORT: '3030' }
  });

  uiStateMapperProcess.stdout.on('data', (data) => {
    console.log(`[UIStateMapper] ${data.toString().trim()}`);
  });

  uiStateMapperProcess.stderr.on('data', (data) => {
    console.error(`[UIStateMapper Error] ${data.toString().trim()}`);
  });

  uiStateMapperProcess.on('error', (err) => {
    console.error(`[UIStateMapper] Failed to start: ${err.message}`);
    uiStateMapperProcess = null;
  });

  uiStateMapperProcess.on('exit', (code) => {
    console.log(`[UIStateMapper] Exited with code ${code}`);
    uiStateMapperProcess = null;
  });
}

ipcMain.handle('copy-to-clipboard', async (event, text) => {
  try {
    console.log('[Clipboard] Copying text:', text.substring(0, 50) + (text.length > 50 ? '...' : ''));
    clipboard.writeText(text);
    console.log('[Clipboard] Copy successful');
    return { success: true };
  } catch (err) {
    console.error('[Clipboard] Copy error:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('paste-from-clipboard', async (event) => {
  try {
    console.log('[Clipboard] Reading from clipboard');
    const text = clipboard.readText();
    console.log('[Clipboard] Read successful, length:', text.length);
    return { success: true, text };
  } catch (err) {
    console.error('[Clipboard] Read error:', err);
    return { success: false, error: err.message };
  }
});

app.on('ready', async () => {
  try {
    await startServer();
    startUIStateMapper();
    createWindow();
  } catch (err) {
    console.error('Failed to start server:', err);
    cleanupOnExit();
    setTimeout(() => process.exit(1), 500);
  }
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

let _cleaned = false;
function cleanupOnExit() {
  if (_cleaned) return;
  _cleaned = true;

  if (serverProcess) {
    try { process.kill(-serverProcess.pid, 'SIGTERM'); } catch (_) {}
    try { serverProcess.kill('SIGTERM'); } catch (_) {}
    serverProcess = null;
  }
  if (uiStateMapperProcess) {
    try { process.kill(-uiStateMapperProcess.pid, 'SIGTERM'); } catch (_) {}
    try { uiStateMapperProcess.kill('SIGTERM'); } catch (_) {}
    uiStateMapperProcess = null;
  }
  // Kill ports 3003 and 3030 to cover dev mode and any orphaned processes
  try {
    const killCmd = process.platform === 'darwin'
      ? 'lsof -ti tcp:3003,3030 | xargs kill -9 2>/dev/null; true'
      : 'fuser -k 3003/tcp 3030/tcp 2>/dev/null; true';
    execSync(killCmd, { stdio: 'ignore', shell: true });
  } catch (_) {}
}

app.on('before-quit', cleanupOnExit);

// Handle uncaught exceptions and crashes
process.on('uncaughtException', (err) => {
  console.error('[Uncaught Exception]', err);
  cleanupOnExit();
  process.exit(1);
});

// Handle renderer process crashes
app.on('renderer-process-crashed', () => {
  console.error('[Renderer Crash]');
  cleanupOnExit();
  process.exit(1);
});

// Menu
const template = [
  {
    label: 'File',
    submenu: [
      {
        label: 'Exit',
        accelerator: 'CmdOrCtrl+Q',
        click: () => {
          app.quit();
        }
      }
    ]
  },
  {
    label: 'View',
    submenu: [
      {
        label: 'Reload',
        accelerator: 'CmdOrCtrl+R',
        click: () => {
          if (mainWindow) mainWindow.reload();
        }
      },
      {
        label: 'Toggle DevTools',
        accelerator: 'CmdOrCtrl+Shift+I',
        click: () => {
          if (mainWindow) mainWindow.webContents.toggleDevTools();
        }
      }
    ]
  }
];

Menu.setApplicationMenu(Menu.buildFromTemplate(template));
