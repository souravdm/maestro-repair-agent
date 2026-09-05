#!/usr/bin/env node

/**
 * Suite Live Dashboard
 * Real-time monitoring for Maestro test suite execution
 * Watches suite-results.json and test subdirectories for live updates
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const PORT = process.env.LIVE_DASHBOARD_PORT || 8080;
const REPORT_DIR = process.argv[2] || process.cwd();

class SuiteLiveDashboard {
  constructor(reportDir, port = PORT) {
    this.reportDir = reportDir;
    this.port = port;
    this.server = null;
    this.wss = null;
    this.clients = new Set();
    this.suiteState = {
      status: 'running',
      total: 0,
      passed: 0,
      failed: 0,
      running: 0,
      tests: [],
      startTime: Date.now(),
      lastUpdate: Date.now()
    };
    this.watchers = [];
    this.updateInterval = null;
  }

  start() {
    // Create HTTP server
    this.server = http.createServer((req, res) => {
      this.handleHTTPRequest(req, res);
    });

    // Create WebSocket server
    this.wss = new WebSocketServer({ server: this.server });
    
    this.wss.on('connection', (ws) => {
      console.log('📱 Client connected');
      this.clients.add(ws);
      
      // Send current state immediately
      ws.send(JSON.stringify({
        type: 'state',
        data: this.suiteState
      }));

      ws.on('close', () => {
        console.log('📱 Client disconnected');
        this.clients.delete(ws);
      });
    });

    // Start server
    this.server.listen(this.port, () => {
      console.log('');
      console.log('🚀 Suite Live Dashboard started');
      console.log(`📊 Dashboard URL: http://localhost:${this.port}`);
      console.log(`📂 Monitoring: ${this.reportDir}`);
      console.log('');
      
      // Start watching
      this.watchSuiteResults();
      
      // Poll for updates every 1 second for faster updates
      this.updateInterval = setInterval(() => {
        this.checkForUpdates();
      }, 1000);
      
      // Initial update
      this.updateSuiteState();
    });
  }

  stop() {
    if (this.updateInterval) clearInterval(this.updateInterval);
    this.watchers.forEach(w => w.close());
    this.clients.forEach(ws => ws.close());
    if (this.server) this.server.close();
    console.log('🛑 Suite Live Dashboard stopped');
  }

  watchSuiteResults() {
    const suiteResultsFile = path.join(this.reportDir, 'suite-results.json');
    
    // Watch the parent directory for file changes (handles file rewrites better)
    if (fs.existsSync(this.reportDir)) {
      const watcher = fs.watch(this.reportDir, (eventType, filename) => {
        if (filename === 'suite-results.json') {
          // File was created, modified, or deleted
          setTimeout(() => this.updateSuiteState(), 100);
        } else if (filename && filename.startsWith('TC')) {
          // New test directory created
          setTimeout(() => this.updateSuiteState(), 500);
        }
      });
      this.watchers.push(watcher);
      console.log('👁️  Watching for file changes in:', this.reportDir);
    }
  }

  checkForUpdates() {
    this.updateSuiteState();
  }

  updateSuiteState() {
    try {
      const suiteResultsFile = path.join(this.reportDir, 'suite-results.json');
      
      // Count test directories for progress estimation
      const testDirs = fs.existsSync(this.reportDir)
        ? fs.readdirSync(this.reportDir)
            .filter(name => name.startsWith('TC') && fs.statSync(path.join(this.reportDir, name)).isDirectory())
        : [];
      
      if (!fs.existsSync(suiteResultsFile)) {
        // No results file yet - estimate from directories
        this.suiteState.running = testDirs.length;
        this.suiteState.total = Math.max(this.suiteState.total, testDirs.length);
        this.suiteState.lastUpdate = Date.now();
        this.broadcast();
        return;
      }

      // Try to parse JSON - it might be incomplete during writes
      let data;
      try {
        const content = fs.readFileSync(suiteResultsFile, 'utf8');
        data = JSON.parse(content);
      } catch (parseError) {
        // JSON is incomplete/malformed - estimate from test directories
        const completed = testDirs.filter(dir => {
          const resultsXml = path.join(this.reportDir, dir, 'results.xml');
          return fs.existsSync(resultsXml);
        }).length;
        
        this.suiteState.total = Math.max(this.suiteState.total, testDirs.length);
        this.suiteState.running = testDirs.length - completed;
        this.suiteState.lastUpdate = Date.now();
        this.broadcast();
        return;
      }
      
      // Successfully parsed JSON
      this.suiteState.total = data.summary?.total || data.total || 0;
      this.suiteState.passed = data.summary?.passed || data.passed || 0;
      this.suiteState.failed = data.summary?.failed || data.failed || 0;
      this.suiteState.running = Math.max(0, this.suiteState.total - this.suiteState.passed - this.suiteState.failed);
      this.suiteState.tests = data.tests || [];
      this.suiteState.status = this.suiteState.failed > 0 ? 'failed' : (this.suiteState.running > 0 ? 'running' : 'passed');
      this.suiteState.lastUpdate = Date.now();

      this.broadcast();
    } catch (e) {
      // Silently ignore errors - will retry on next poll
      console.error('Error updating suite state:', e.message);
    }
  }

  broadcast() {
    const message = JSON.stringify({
      type: 'update',
      data: this.suiteState
    });

    this.clients.forEach(ws => {
      if (ws.readyState === 1) { // OPEN
        ws.send(message);
      }
    });
  }

  handleHTTPRequest(req, res) {
    if (req.url === '/' || req.url === '/index.html') {
      this.serveDashboardHTML(res);
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  }

  serveDashboardHTML(res) {
    const html = this.generateDashboardHTML();
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  }

  generateDashboardHTML() {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Suite Live Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    .header {
      text-align: center;
      color: white;
      margin-bottom: 30px;
    }
    .header h1 {
      font-size: 36px;
      margin-bottom: 10px;
      text-shadow: 0 2px 4px rgba(0,0,0,0.2);
    }
    .header .subtitle {
      font-size: 14px;
      opacity: 0.9;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .stat-card {
      background: white;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      transition: transform 0.2s;
    }
    .stat-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 12px rgba(0,0,0,0.15);
    }
    .stat-value {
      font-size: 48px;
      font-weight: 700;
      margin-bottom: 8px;
    }
    .stat-label {
      font-size: 12px;
      text-transform: uppercase;
      color: #64748b;
      font-weight: 600;
    }
    .stat-card.total .stat-value { color: #2563eb; }
    .stat-card.passed .stat-value { color: #059669; }
    .stat-card.failed .stat-value { color: #dc2626; }
    .stat-card.running .stat-value { color: #f59e0b; }
    
    .progress-section {
      background: white;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      margin-bottom: 30px;
    }
    .progress-bar {
      height: 40px;
      background: #e2e8f0;
      border-radius: 20px;
      overflow: hidden;
      position: relative;
    }
    .progress-fill {
      height: 100%;
      transition: width 0.5s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: 600;
      font-size: 14px;
    }
    .progress-fill.passed { background: linear-gradient(90deg, #059669, #10b981); }
    .progress-fill.failed { background: linear-gradient(90deg, #dc2626, #ef4444); }
    
    .tests-list {
      background: white;
      border-radius: 12px;
      padding: 24px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    .tests-list h2 {
      margin-bottom: 20px;
      color: #1e293b;
    }
    .test-item {
      padding: 16px;
      border-left: 4px solid #e2e8f0;
      margin-bottom: 12px;
      border-radius: 8px;
      background: #f8fafc;
      transition: all 0.3s;
    }
    .test-item.passed { border-left-color: #059669; background: #f0fdf4; }
    .test-item.failed { border-left-color: #dc2626; background: #fef2f2; }
    .test-item.running { border-left-color: #f59e0b; background: #fffbeb; animation: pulse 2s infinite; }
    
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }
    
    .test-name {
      font-weight: 600;
      color: #1e293b;
      margin-bottom: 4px;
    }
    .test-status {
      font-size: 12px;
      color: #64748b;
    }
    .test-duration {
      font-size: 12px;
      color: #94a3b8;
      float: right;
    }
    
    .status-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .status-badge.passed { background: #d1fae5; color: #059669; }
    .status-badge.failed { background: #fee2e2; color: #dc2626; }
    .status-badge.running { background: #fef3c7; color: #f59e0b; }
    
    .last-update {
      text-align: center;
      color: white;
      font-size: 12px;
      margin-top: 20px;
      opacity: 0.8;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎯 Test Suite Live Dashboard</h1>
      <div class="subtitle">Real-time test execution monitoring</div>
    </div>

    <div class="stats-grid">
      <div class="stat-card total">
        <div class="stat-value" id="total">0</div>
        <div class="stat-label">Total Tests</div>
      </div>
      <div class="stat-card passed">
        <div class="stat-value" id="passed">0</div>
        <div class="stat-label">Passed</div>
      </div>
      <div class="stat-card failed">
        <div class="stat-value" id="failed">0</div>
        <div class="stat-label">Failed</div>
      </div>
      <div class="stat-card running">
        <div class="stat-value" id="running">0</div>
        <div class="stat-label">Running</div>
      </div>
    </div>

    <div class="progress-section">
      <h2 style="margin-bottom: 16px; color: #1e293b;">Overall Progress</h2>
      <div class="progress-bar">
        <div class="progress-fill passed" id="progress-passed" style="width: 0%"></div>
        <div class="progress-fill failed" id="progress-failed" style="width: 0%"></div>
      </div>
      <div style="margin-top: 12px; text-align: center; color: #64748b; font-size: 14px;" id="progress-text">
        Waiting for tests...
      </div>
    </div>

    <div class="tests-list">
      <h2>Test Execution</h2>
      <div id="tests-container">
        <div style="text-align: center; color: #94a3b8; padding: 40px;">
          Waiting for test results...
        </div>
      </div>
    </div>

    <div class="last-update">
      Last updated: <span id="last-update">Never</span>
    </div>
  </div>

  <script>
    let ws;
    
    function connect() {
      ws = new WebSocket('ws://' + location.host);
      
      ws.onopen = () => {
        console.log('Connected to dashboard');
      };
      
      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        if (message.type === 'state' || message.type === 'update') {
          updateDashboard(message.data);
        }
      };
      
      ws.onclose = () => {
        console.log('Disconnected, reconnecting...');
        setTimeout(connect, 2000);
      };
    }
    
    function updateDashboard(state) {
      // Update stats
      document.getElementById('total').textContent = state.total;
      document.getElementById('passed').textContent = state.passed;
      document.getElementById('failed').textContent = state.failed;
      document.getElementById('running').textContent = state.running;
      
      // Update progress bar
      const total = state.total || 1;
      const passedPct = (state.passed / total) * 100;
      const failedPct = (state.failed / total) * 100;
      
      document.getElementById('progress-passed').style.width = passedPct + '%';
      document.getElementById('progress-passed').textContent = state.passed > 0 ? \`✓ \${state.passed}\` : '';
      document.getElementById('progress-failed').style.width = failedPct + '%';
      document.getElementById('progress-failed').textContent = state.failed > 0 ? \`✗ \${state.failed}\` : '';
      
      const completed = state.passed + state.failed;
      document.getElementById('progress-text').textContent = 
        \`\${completed} of \${state.total} tests completed (\${Math.round((completed/total)*100)}%)\`;
      
      // Update tests list
      if (state.tests && state.tests.length > 0) {
        const container = document.getElementById('tests-container');
        container.innerHTML = state.tests.map((test, idx) => {
          const statusClass = test.status || 'running';
          const duration = test.duration ? \`\${(test.duration/1000).toFixed(1)}s\` : '';
          return \`
            <div class="test-item \${statusClass}">
              <div class="test-name">
                <span class="status-badge \${statusClass}">\${statusClass}</span>
                \${test.name || 'Test ' + (idx + 1)}
              </div>
              <div class="test-status">
                \${test.file || ''}
                <span class="test-duration">\${duration}</span>
              </div>
            </div>
          \`;
        }).join('');
      }
      
      // Update timestamp
      const now = new Date();
      document.getElementById('last-update').textContent = now.toLocaleTimeString();
    }
    
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

  // Auto-discover latest test run directory
  let targetDir = reportDir;
  if (fs.existsSync(reportDir)) {
    const dirs = fs.readdirSync(reportDir)
      .filter(name => (name.startsWith('IOS_') || name.startsWith('ANDROID_')) && 
                      fs.statSync(path.join(reportDir, name)).isDirectory())
      .map(name => ({
        name,
        path: path.join(reportDir, name),
        mtime: fs.statSync(path.join(reportDir, name)).mtime
      }))
      .sort((a, b) => b.mtime - a.mtime);
    
    if (dirs.length > 0) {
      targetDir = dirs[0].path;
      console.log(`📂 Auto-discovered latest test run: ${dirs[0].name}`);
    }
  }

  const dashboard = new SuiteLiveDashboard(targetDir, port);
  dashboard.start();

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    dashboard.stop();
    process.exit(0);
  });
}

module.exports = SuiteLiveDashboard;
