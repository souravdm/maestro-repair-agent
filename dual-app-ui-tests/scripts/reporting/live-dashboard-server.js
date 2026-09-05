#!/usr/bin/env node

/**
 * Live Dashboard Server
 * Real-time test execution monitoring with WebSocket updates
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.LIVE_DASHBOARD_PORT || 8080;
const REPORT_DIR = process.argv[2] || process.cwd();

class LiveDashboardServer {
  constructor(reportDir, port = PORT) {
    this.reportDir = reportDir;
    this.port = port;
    this.server = null;
    this.wss = null;
    this.clients = new Set();
    this.testState = {
      status: 'idle',
      currentTest: null,
      tests: [],
      summary: { total: 0, passed: 0, failed: 0, running: 0 },
      startTime: null,
      performance: null,
    };
    this.fileWatchers = [];
  }

  /**
   * Start the live dashboard server
   */
  start() {
    // Create HTTP server
    this.server = http.createServer((req, res) => {
      this.handleHTTPRequest(req, res);
    });

    // Create WebSocket server
    this.wss = new WebSocketServer({ server: this.server });
    
    this.wss.on('connection', (ws) => {
      console.log('📱 Client connected to live dashboard');
      this.clients.add(ws);

      // Send current state to new client
      ws.send(JSON.stringify({
        type: 'init',
        data: this.testState,
      }));

      ws.on('close', () => {
        console.log('📱 Client disconnected');
        this.clients.delete(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.clients.delete(ws);
      });
    });

    // Start server
    this.server.listen(this.port, () => {
      console.log(`\n🚀 Live Dashboard Server started`);
      console.log(`📊 Dashboard URL: http://localhost:${this.port}`);
      console.log(`📂 Monitoring: ${this.reportDir}\n`);
    });

    // Watch for file changes
    this.watchReportDirectory();

    return this;
  }

  /**
   * Stop the server
   */
  stop() {
    // Close all WebSocket connections
    this.clients.forEach(ws => ws.close());
    this.clients.clear();

    // Stop file watchers
    this.fileWatchers.forEach(watcher => watcher.close());
    this.fileWatchers = [];

    // Close servers
    if (this.wss) {
      this.wss.close();
    }
    if (this.server) {
      this.server.close();
    }

    console.log('🛑 Live Dashboard Server stopped');
  }

  /**
   * Handle HTTP requests
   */
  handleHTTPRequest(req, res) {
    if (req.url === '/' || req.url === '/index.html') {
      this.serveDashboardHTML(res);
    } else if (req.url === '/api/state') {
      this.serveState(res);
    } else if (req.url.startsWith('/screenshots/')) {
      this.serveScreenshot(req.url, res);
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  }

  /**
   * Serve the live dashboard HTML
   */
  serveDashboardHTML(res) {
    const html = this.generateDashboardHTML();
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  }

  /**
   * Serve current test state as JSON
   */
  serveState(res) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(this.testState));
  }

  /**
   * Serve screenshot files
   */
  serveScreenshot(url, res) {
    const filename = path.basename(url);
    const screenshotPath = path.join(this.reportDir, 'screenshots', filename);

    if (fs.existsSync(screenshotPath)) {
      const ext = path.extname(filename).toLowerCase();
      const contentType = ext === '.png' ? 'image/png' : 'image/jpeg';
      
      res.writeHead(200, { 'Content-Type': contentType });
      fs.createReadStream(screenshotPath).pipe(res);
    } else {
      res.writeHead(404);
      res.end('Screenshot not found');
    }
  }

  /**
   * Watch report directory for changes
   */
  watchReportDirectory() {
    try {
      // Auto-discover latest test run directory
      const latestDir = this.findLatestTestRunDirectory();
      if (latestDir) {
        console.log(`📂 Auto-discovered latest test run: ${latestDir}`);
        this.reportDir = latestDir;
      }

      // Watch parent directory for new test runs
      const parentDir = path.dirname(this.reportDir);
      if (fs.existsSync(parentDir)) {
        const watcher = fs.watch(parentDir, (eventType, filename) => {
          if (eventType === 'rename' && filename && filename.startsWith('IOS_')) {
            const newDir = path.join(parentDir, filename);
            if (fs.existsSync(newDir) && fs.statSync(newDir).isDirectory()) {
              console.log(`🆕 New test run detected: ${filename}`);
              this.reportDir = newDir;
              this.setupFileWatchers();
            }
          }
        });
        this.fileWatchers.push(watcher);
      }

      this.setupFileWatchers();
    } catch (e) {
      console.error('Error setting up file watchers:', e.message);
    }
  }

  /**
   * Find the latest test run directory
   */
  findLatestTestRunDirectory() {
    try {
      const parentDir = this.reportDir.includes('IOS_') || this.reportDir.includes('ANDROID_')
        ? path.dirname(this.reportDir)
        : this.reportDir;

      if (!fs.existsSync(parentDir)) return null;

      const dirs = fs.readdirSync(parentDir)
        .filter(name => name.startsWith('IOS_') || name.startsWith('ANDROID_'))
        .map(name => ({
          name,
          path: path.join(parentDir, name),
          mtime: fs.statSync(path.join(parentDir, name)).mtime
        }))
        .sort((a, b) => b.mtime - a.mtime);

      return dirs.length > 0 ? dirs[0].path : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Setup file watchers for current report directory
   */
  setupFileWatchers() {
    // Clear existing watchers (except parent directory watcher)
    this.fileWatchers.slice(1).forEach(w => w.close());
    this.fileWatchers = this.fileWatchers.slice(0, 1);

    try {
      // Watch for new test results
      const resultsFile = path.join(this.reportDir, 'results.xml');
      if (fs.existsSync(resultsFile)) {
        const watcher = fs.watch(resultsFile, () => {
          this.updateTestResults();
        });
        this.fileWatchers.push(watcher);
      }

      // Watch for performance data
      const perfFile = path.join(this.reportDir, 'performance.json');
      if (fs.existsSync(perfFile)) {
        const watcher = fs.watch(perfFile, () => {
          this.updatePerformanceData();
        });
        this.fileWatchers.push(watcher);
      }

      // Watch for new screenshots
      const screenshotsDir = path.join(this.reportDir, 'screenshots');
      if (fs.existsSync(screenshotsDir)) {
        const watcher = fs.watch(screenshotsDir, () => {
          this.broadcastUpdate('screenshot_added', {});
        });
        this.fileWatchers.push(watcher);
      }

      // Watch for test-report HTML files
      const reportPattern = /test-report.*\.html$/;
      const dirWatcher = fs.watch(this.reportDir, (eventType, filename) => {
        if (filename && reportPattern.test(filename)) {
          console.log(`📊 Test report updated: ${filename}`);
          this.broadcastUpdate('report_updated', { filename });
        }
      });
      this.fileWatchers.push(dirWatcher);
    } catch (e) {
      console.error('Error setting up file watchers:', e.message);
    }
  }

  /**
   * Update test results from file
   */
  updateTestResults() {
    try {
      const resultsFile = path.join(this.reportDir, 'results.xml');
      if (!fs.existsSync(resultsFile)) return;

      // Parse results (simplified - real implementation would parse XML)
      const content = fs.readFileSync(resultsFile, 'utf8');
      
      // Extract test count from XML
      const totalMatch = content.match(/tests="(\d+)"/);
      const failuresMatch = content.match(/failures="(\d+)"/);
      
      if (totalMatch) {
        this.testState.summary.total = parseInt(totalMatch[1]);
        this.testState.summary.failed = failuresMatch ? parseInt(failuresMatch[1]) : 0;
        this.testState.summary.passed = this.testState.summary.total - this.testState.summary.failed;
      }

      this.broadcastUpdate('test_results', this.testState.summary);
    } catch (e) {
      console.error('Error updating test results:', e.message);
    }
  }

  /**
   * Update performance data
   */
  updatePerformanceData() {
    try {
      const perfFile = path.join(this.reportDir, 'performance.json');
      if (!fs.existsSync(perfFile)) return;

      this.testState.performance = JSON.parse(fs.readFileSync(perfFile, 'utf8'));
      this.broadcastUpdate('performance', this.testState.performance);
    } catch (e) {
      console.error('Error updating performance data:', e.message);
    }
  }

  /**
   * Broadcast update to all connected clients
   */
  broadcastUpdate(type, data) {
    const message = JSON.stringify({ type, data, timestamp: Date.now() });
    
    this.clients.forEach(ws => {
      if (ws.readyState === 1) { // OPEN
        try {
          ws.send(message);
        } catch (e) {
          console.error('Error sending to client:', e.message);
        }
      }
    });
  }

  /**
   * Generate live dashboard HTML
   */
  generateDashboardHTML() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Live Test Dashboard - Maestro</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #333;
      min-height: 100vh;
      padding: 20px;
    }
    .container {
      max-width: 1400px;
      margin: 0 auto;
    }
    .header {
      background: white;
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 20px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .header h1 {
      font-size: 28px;
      color: #1e293b;
      margin-bottom: 8px;
    }
    .status-badge {
      display: inline-block;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .status-running { background: #3b82f6; color: white; }
    .status-idle { background: #94a3b8; color: white; }
    .status-complete { background: #22c55e; color: white; }
    .status-failed { background: #ef4444; color: white; }
    
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 20px;
    }
    .stat-card {
      background: white;
      border-radius: 12px;
      padding: 20px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .stat-value {
      font-size: 36px;
      font-weight: 700;
      margin-bottom: 4px;
    }
    .stat-label {
      font-size: 14px;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .stat-passed .stat-value { color: #22c55e; }
    .stat-failed .stat-value { color: #ef4444; }
    .stat-running .stat-value { color: #3b82f6; }
    
    .live-feed {
      background: white;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      max-height: 500px;
      overflow-y: auto;
    }
    .live-feed h2 {
      font-size: 18px;
      margin-bottom: 16px;
      color: #1e293b;
    }
    .feed-item {
      padding: 12px;
      border-left: 3px solid #e2e8f0;
      margin-bottom: 12px;
      background: #f8fafc;
      border-radius: 4px;
    }
    .feed-item.success { border-left-color: #22c55e; }
    .feed-item.failure { border-left-color: #ef4444; }
    .feed-time {
      font-size: 11px;
      color: #94a3b8;
      margin-bottom: 4px;
    }
    .feed-message {
      font-size: 14px;
      color: #334155;
    }
    
    .connection-status {
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .connected { background: #22c55e; color: white; }
    .disconnected { background: #ef4444; color: white; }
    
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    .pulse { animation: pulse 2s infinite; }
  </style>
</head>
<body>
  <div class="connection-status disconnected" id="connectionStatus">
    ⚫ Connecting...
  </div>
  
  <div class="container">
    <div class="header">
      <h1>🚀 Live Test Dashboard</h1>
      <span class="status-badge status-idle" id="testStatus">IDLE</span>
    </div>
    
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-value" id="totalTests">0</div>
        <div class="stat-label">Total Tests</div>
      </div>
      <div class="stat-card stat-passed">
        <div class="stat-value" id="passedTests">0</div>
        <div class="stat-label">Passed</div>
      </div>
      <div class="stat-card stat-failed">
        <div class="stat-value" id="failedTests">0</div>
        <div class="stat-label">Failed</div>
      </div>
      <div class="stat-card stat-running">
        <div class="stat-value pulse" id="runningTests">0</div>
        <div class="stat-label">Running</div>
      </div>
    </div>
    
    <div class="live-feed">
      <h2>📡 Live Feed</h2>
      <div id="feedContainer">
        <div class="feed-item">
          <div class="feed-time">Waiting for test execution...</div>
          <div class="feed-message">Connect and start your tests to see live updates</div>
        </div>
      </div>
    </div>
  </div>
  
  <script>
    let ws;
    const feedContainer = document.getElementById('feedContainer');
    const connectionStatus = document.getElementById('connectionStatus');
    
    function connect() {
      ws = new WebSocket('ws://' + window.location.host);
      
      ws.onopen = () => {
        console.log('Connected to live dashboard');
        connectionStatus.textContent = '🟢 Connected';
        connectionStatus.className = 'connection-status connected';
      };
      
      ws.onclose = () => {
        console.log('Disconnected from live dashboard');
        connectionStatus.textContent = '🔴 Disconnected';
        connectionStatus.className = 'connection-status disconnected';
        setTimeout(connect, 3000); // Reconnect after 3s
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
      
      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        handleUpdate(message);
      };
    }
    
    function handleUpdate(message) {
      const { type, data } = message;
      
      if (type === 'init') {
        updateStats(data.summary);
        updateStatus(data.status);
      } else if (type === 'test_results') {
        updateStats(data);
        addFeedItem('Test results updated', 'success');
      } else if (type === 'performance') {
        addFeedItem('Performance data updated', 'success');
      } else if (type === 'screenshot_added') {
        addFeedItem('New screenshot captured', 'info');
      }
    }
    
    function updateStats(summary) {
      document.getElementById('totalTests').textContent = summary.total || 0;
      document.getElementById('passedTests').textContent = summary.passed || 0;
      document.getElementById('failedTests').textContent = summary.failed || 0;
      document.getElementById('runningTests').textContent = summary.running || 0;
    }
    
    function updateStatus(status) {
      const badge = document.getElementById('testStatus');
      badge.textContent = status.toUpperCase();
      badge.className = 'status-badge status-' + status;
    }
    
    function addFeedItem(message, type = 'info') {
      const item = document.createElement('div');
      item.className = 'feed-item ' + type;
      
      const time = new Date().toLocaleTimeString();
      item.innerHTML = \`
        <div class="feed-time">\${time}</div>
        <div class="feed-message">\${message}</div>
      \`;
      
      feedContainer.insertBefore(item, feedContainer.firstChild);
      
      // Keep only last 50 items
      while (feedContainer.children.length > 50) {
        feedContainer.removeChild(feedContainer.lastChild);
      }
    }
    
    // Connect on load
    connect();
  </script>
</body>
</html>`;
  }
}

// CLI usage
if (require.main === module) {
  const reportDir = process.argv[2] || process.cwd();
  const port = parseInt(process.argv[3]) || PORT;

  const server = new LiveDashboardServer(reportDir, port);
  server.start();

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    server.stop();
    process.exit(0);
  });
}

module.exports = LiveDashboardServer;
