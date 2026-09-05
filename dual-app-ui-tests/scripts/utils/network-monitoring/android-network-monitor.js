#!/usr/bin/env node

/**
 * Android Network Monitor - Native Network Capture
 * Uses native Android tools to capture network traffic during test execution
 * Works independently of Maestro daemon
 */

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Get connected Android device/emulator ID
 */
function getConnectedDevice() {
  try {
    const output = execSync('adb devices | grep -v "List" | grep "device$"', { 
      encoding: 'utf8',
      timeout: 2000 
    });
    const match = output.match(/^(\S+)\s+device/m);
    return match ? match[1] : null;
  } catch (error) {
    return null;
  }
}

/**
 * Capture network logs using adb logcat
 */
function captureNetworkLogs(packageName, duration = 2) {
  try {
    const deviceId = getConnectedDevice();
    if (!deviceId) {
      return [];
    }
    
    // Capture logcat for network-related tags
    const output = execSync(
      `adb -s ${deviceId} logcat -d -s OkHttp:* HttpURLConnection:* Volley:* Retrofit:* NetworkSecurityConfig:* | tail -500`,
      { 
        encoding: 'utf8',
        maxBuffer: 50 * 1024 * 1024,
        timeout: (duration + 2) * 1000
      }
    );
    
    return parseNetworkLogs(output, packageName);
  } catch (error) {
    console.error('Error capturing network logs:', error.message);
    return [];
  }
}

/**
 * Parse network logs into structured API calls
 */
function parseNetworkLogs(logOutput, packageName) {
  const apiCalls = [];
  const lines = logOutput.split('\n');
  
  for (const line of lines) {
    // Look for HTTP/HTTPS requests
    const urlMatch = line.match(/(https?:\/\/[^\s]+)/i);
    if (urlMatch) {
      const url = urlMatch[1].replace(/[,\]}>]$/, ''); // Clean trailing chars
      
      // Extract method if present
      const methodMatch = line.match(/\b(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\b/i);
      const method = methodMatch ? methodMatch[1].toUpperCase() : 'GET';
      
      // Extract status code if present
      const statusMatch = line.match(/\b(2\d{2}|3\d{2}|4\d{2}|5\d{2})\b/);
      const status = statusMatch ? parseInt(statusMatch[1]) : null;
      
      // Extract timestamp
      const timestampMatch = line.match(/^(\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\.\d{3})/);
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
  
  // Remove duplicates
  const uniqueCalls = [];
  const seen = new Set();
  
  for (const call of apiCalls) {
    const key = `${call.method}:${call.url}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueCalls.push(call);
    }
  }
  
  return uniqueCalls;
}

/**
 * Capture network traffic using tcpdump (requires root)
 */
function captureWithTcpdump(deviceId, duration = 5) {
  try {
    // Check if device is rooted
    const rootCheck = execSync(`adb -s ${deviceId} shell "su -c 'echo test'" 2>/dev/null || echo "not_rooted"`, {
      encoding: 'utf8',
      timeout: 2000
    });
    
    if (rootCheck.includes('not_rooted')) {
      console.log('Device not rooted, skipping tcpdump');
      return [];
    }
    
    // Start tcpdump
    execSync(
      `adb -s ${deviceId} shell "su -c 'tcpdump -i any -n -s 0 -w /sdcard/capture.pcap'" &`,
      { timeout: 1000 }
    );
    
    // Wait for capture duration
    setTimeout(() => {
      execSync(`adb -s ${deviceId} shell "su -c 'pkill tcpdump'"`);
    }, duration * 1000);
    
    return [];
  } catch (error) {
    return [];
  }
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
      captureMethod: 'android_logcat',
      platform: 'android',
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
  const deviceId = getConnectedDevice();
  if (!deviceId) {
    console.error('No connected Android device found');
    process.exit(1);
  }
  
  console.log(`Starting network monitoring for ${testName} on ${deviceId} (every ${intervalSeconds}s)`);
  
  // Clear logcat before starting
  try {
    execSync(`adb -s ${deviceId} logcat -c`, { timeout: 2000 });
  } catch (e) {
    // Ignore
  }
  
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
  saveNetworkCapture,
  startContinuousMonitoring
};
