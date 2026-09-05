#!/usr/bin/env node

/**
 * iOS Network Monitor - Alternative Network Capture
 * Uses tcpdump and iOS system logs to capture network traffic
 * Works independently of Maestro daemon
 */

const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Get booted simulator device ID
 */
function getBootedSimulator() {
  try {
    const output = execSync('xcrun simctl list devices | grep "Booted"', { 
      encoding: 'utf8',
      timeout: 2000 
    });
    const match = output.match(/([A-F0-9]{8}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{12})/);
    return match ? match[1] : null;
  } catch (error) {
    return null;
  }
}

/**
 * Start tcpdump network capture
 */
function startTcpdump(outputFile) {
  try {
    // Use tcpdump to capture network traffic
    const tcpdump = spawn('sudo', [
      'tcpdump',
      '-i', 'any',
      '-n',
      '-s', '0',
      '-w', outputFile,
      'host', '127.0.0.1', 'or', 'not', 'host', '127.0.0.1'
    ], {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    return tcpdump;
  } catch (error) {
    console.error('Error starting tcpdump:', error.message);
    return null;
  }
}

/**
 * Parse network logs from iOS system
 */
function captureNetworkLogs(appBundleId, duration = 5) {
  try {
    // Use log show to capture network activity
    const output = execSync(
      `log show --predicate 'process == "CFNetwork" OR subsystem == "com.apple.network"' --last ${duration}s --style compact`,
      { 
        encoding: 'utf8',
        maxBuffer: 50 * 1024 * 1024,
        timeout: (duration + 2) * 1000
      }
    );
    
    return parseNetworkLogs(output);
  } catch (error) {
    console.error('Error capturing network logs:', error.message);
    return [];
  }
}

/**
 * Parse network logs into structured API calls
 */
function parseNetworkLogs(logOutput) {
  const apiCalls = [];
  const lines = logOutput.split('\n');
  
  for (const line of lines) {
    // Look for HTTP/HTTPS requests
    const urlMatch = line.match(/(https?:\/\/[^\s]+)/i);
    if (urlMatch) {
      const url = urlMatch[1];
      
      // Extract method if present
      const methodMatch = line.match(/\b(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\b/i);
      const method = methodMatch ? methodMatch[1].toUpperCase() : 'GET';
      
      // Extract status code if present
      const statusMatch = line.match(/\b(2\d{2}|3\d{2}|4\d{2}|5\d{2})\b/);
      const status = statusMatch ? parseInt(statusMatch[1]) : null;
      
      // Extract timestamp
      const timestampMatch = line.match(/^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/);
      const timestamp = timestampMatch ? timestampMatch[1] : new Date().toISOString();
      
      apiCalls.push({
        timestamp: timestamp,
        method: method,
        url: url,
        status: status,
        type: url.includes('api') ? 'API' : 'Resource'
      });
    }
  }
  
  return apiCalls;
}

/**
 * Monitor network activity using nettop
 */
function captureNetworkActivity(duration = 5) {
  try {
    const output = execSync(
      `nettop -P -L 1 -t wifi -t wired -k time,interface,state,rx_dupe,rx_ooo,re-tx,rtt_avg,rcvsize,tx_win,tc_class,tc_mgt,cc_algo,P,C,R,W -n`,
      {
        encoding: 'utf8',
        timeout: (duration + 1) * 1000,
        maxBuffer: 10 * 1024 * 1024
      }
    );
    
    return parseNetworkActivity(output);
  } catch (error) {
    console.error('Error capturing network activity:', error.message);
    return [];
  }
}

/**
 * Parse nettop output
 */
function parseNetworkActivity(output) {
  const connections = [];
  const lines = output.split('\n');
  
  for (const line of lines) {
    if (line.trim() && !line.includes('interface') && !line.includes('---')) {
      connections.push({
        raw: line.trim(),
        timestamp: new Date().toISOString()
      });
    }
  }
  
  return connections;
}

/**
 * Save network capture data
 */
function saveNetworkCapture(apiCalls, testName, reportDir) {
  try {
    const networkDir = path.join(reportDir, 'network');
    if (!fs.existsSync(networkDir)) {
      fs.mkdirSync(networkDir, { recursive: true });
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = path.join(networkDir, `${testName}_network_${timestamp}.json`);
    
    const networkData = {
      timestamp: new Date().toISOString(),
      testName: testName,
      captureMethod: 'ios_system_logs',
      apiCallCount: apiCalls.length,
      apiCalls: apiCalls,
      summary: {
        totalCalls: apiCalls.length,
        methods: [...new Set(apiCalls.map(c => c.method))],
        domains: [...new Set(apiCalls.map(c => {
          try {
            return new URL(c.url).hostname;
          } catch {
            return 'unknown';
          }
        }))]
      }
    };
    
    fs.writeFileSync(filename, JSON.stringify(networkData, null, 2));
    return filename;
  } catch (error) {
    console.error('Error saving network capture:', error.message);
    return null;
  }
}

/**
 * Start continuous network monitoring
 */
function startContinuousMonitoring(testName, reportDir, intervalSeconds = 5) {
  console.log(`Starting network monitoring for ${testName} (every ${intervalSeconds}s)`);
  
  const captureInterval = setInterval(() => {
    const apiCalls = captureNetworkLogs('com.cvsenterpriseiphone.cvspharmacy', intervalSeconds);
    if (apiCalls.length > 0) {
      saveNetworkCapture(apiCalls, testName, reportDir);
      console.log(`✅ Captured ${apiCalls.length} network calls`);
    }
  }, intervalSeconds * 1000);
  
  // Handle graceful shutdown
  process.on('SIGTERM', () => {
    clearInterval(captureInterval);
    console.log('Network monitoring stopped');
    process.exit(0);
  });
  
  process.on('SIGINT', () => {
    clearInterval(captureInterval);
    console.log('Network monitoring stopped');
    process.exit(0);
  });
}

// CLI usage
if (require.main === module) {
  const command = process.argv[2];
  
  if (command === 'monitor') {
    // Continuous monitoring mode
    const testName = process.argv[3] || 'unknown_test';
    const reportDir = process.argv[4] || path.join(__dirname, '../../test-reports');
    const interval = parseInt(process.argv[5]) || 5;
    
    startContinuousMonitoring(testName, reportDir, interval);
  } else {
    // Single capture mode
    const testName = process.argv[2] || 'unknown_test';
    const reportDir = process.argv[3] || path.join(__dirname, '../../test-reports');
    
    const apiCalls = captureNetworkLogs('com.cvsenterpriseiphone.cvspharmacy', 2);
    if (apiCalls.length > 0) {
      saveNetworkCapture(apiCalls, testName, reportDir);
      console.log(`✅ Captured ${apiCalls.length} network calls`);
    }
    
    process.exit(0);
  }
}

module.exports = {
  captureNetworkLogs,
  captureNetworkActivity,
  saveNetworkCapture,
  startContinuousMonitoring
};
