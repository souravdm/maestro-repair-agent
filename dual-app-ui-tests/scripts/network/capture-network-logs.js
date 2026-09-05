#!/usr/bin/env node

/**
 * Capture Network Calls from Proxy or Generate Based on Test Execution
 * First tries to read from proxy capture file, then generates realistic API calls
 */

const fs = require('fs');
const path = require('path');

const outputDir = process.argv[2] || process.cwd();
const testName = process.argv[3] || 'test';

// Use network subdirectory within the report directory
const networkDir = path.join(outputDir, 'network');
if (!fs.existsSync(networkDir)) {
  fs.mkdirSync(networkDir, { recursive: true });
}
const apiCallsFile = path.join(networkDir, 'api-calls.json');
const proxyCallsFile = path.join(networkDir, 'proxy-calls.json');

// Allowed hostnames for API capture
const DEFAULT_HOSTNAMES = [
  'www.cvs.com',
  'www-qa2.cvs.com'
];

const ALLOWED_HOSTNAMES = DEFAULT_HOSTNAMES;

// Patterns to exclude
const EXCLUDE_PATTERNS = [
  /\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|css|js)(\?|$)/i,
  /google-analytics/i,
  /googletagmanager/i,
  /firebase/i,
  /crashlytics/i,
  /cdn\./i,
  /static\./i,
  /assets\./i
];

/**
 * Get booted simulator device ID
 */
function getBootedSimulatorId() {
  try {
    const output = execSync('xcrun simctl list devices | grep "Booted"', { encoding: 'utf8' });
    const match = output.match(/([A-F0-9]{8}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{12})/);
    return match ? match[1] : null;
  } catch (error) {
    return null;
  }
}

/**
 * Parse MAESTRO_NETWORK logs from the app's network debugger
 */
function parseMaestroNetworkLogs() {
  const logFile = path.join(networkDir, 'simulator-network.log');
  if (!fs.existsSync(logFile)) {
    return [];
  }

  try {
    const logContent = fs.readFileSync(logFile, 'utf8');
    const calls = [];
    
    // Look for [MAESTRO_NETWORK] entries from the app's debugger
    const networkLogPattern = /\[MAESTRO_NETWORK\]\s*({[^}]+})/g;
    let match;
    
    while ((match = networkLogPattern.exec(logContent)) !== null) {
      try {
        const logEntry = JSON.parse(match[1]);
        
        // Only include failed calls (status >= 400)
        const status = parseInt(logEntry.status) || 0;
        if (status < 400) continue;
        if (status === -1 || status === 0) continue;
        
        // Determine error message based on status code
        let errorMessage = 'Unknown Error';
        if (status === 400) errorMessage = 'Bad Request';
        else if (status === 401) errorMessage = 'Unauthorized';
        else if (status === 403) errorMessage = 'Forbidden';
        else if (status === 404) errorMessage = 'Not Found';
        else if (status === 500) errorMessage = 'Internal Server Error';
        else if (status === 502) errorMessage = 'Bad Gateway';
        else if (status === 503) errorMessage = 'Service Unavailable';
        else if (status >= 400 && status < 500) errorMessage = 'Client Error';
        else if (status >= 500) errorMessage = 'Server Error';
        
        // Extract endpoint path (remove query params for cleaner display)
        let endpoint = logEntry.endpoint || 'Unknown';
        try {
          const url = new URL(endpoint);
          endpoint = url.pathname;
        } catch (e) {
          // Keep as is if not a valid URL
        }
        
        calls.push({
          method: logEntry.method || 'GET',
          endpoint: endpoint,
          status: status,
          responseTime: logEntry.responseTime || 0,
          response: logEntry.response || errorMessage
        });
      } catch (e) {
        // Skip malformed JSON entries
      }
    }
    
    if (calls.length > 0) {
      console.log(`✅ Parsed ${calls.length} failed network calls from app debugger`);
      return calls;
    }
  } catch (e) {
    console.log(`⚠️  Error parsing MAESTRO_NETWORK logs: ${e.message}`);
  }
  
  return [];
}

/**
 * Parse CFNetwork logs and extract actual URLs from request logs
 */
function parseCFNetworkLogs() {
  const logFile = path.join(networkDir, 'simulator-network.log');
  if (!fs.existsSync(logFile)) {
    return [];
  }

  try {
    const logContent = fs.readFileSync(logFile, 'utf8');
    const lines = logContent.split('\n');
    const calls = [];
    const taskUrls = new Map(); // Map task IDs to URLs
    
    // First pass: Extract URLs from request logs
    lines.forEach(line => {
      if (!line.includes('CVSOnlineiPhone')) return;
      
      // Look for request creation with URL
      // Pattern: Task <taskId>.0 HTTP load https://...
      const urlMatch = line.match(/Task <([^>]+)>.*?(https?:\/\/[^\s]+)/);
      if (urlMatch) {
        const taskId = urlMatch[1];
        const url = urlMatch[2].replace(/[,\]}>]+$/, ''); // Clean trailing chars
        taskUrls.set(taskId, url);
      }
    });
    
    // Second pass: Parse CFNetwork summary lines and match with URLs
    lines.forEach(line => {
      if (!line.includes('CVSOnlineiPhone') || !line.includes('summary for task')) {
        return;
      }
      
      // Extract task ID
      const taskMatch = line.match(/Task <([^>]+)>/);
      const taskId = taskMatch ? taskMatch[1] : 'unknown';
      
      // Extract summary JSON
      const summaryMatch = line.match(/summary for task \w+ ({[^}]+})/);
      if (!summaryMatch) return;
      
      try {
        // Parse the summary JSON
        const summaryStr = summaryMatch[1].replace(/(\w+)=/g, '"$1":').replace(/,\s*}/g, '}');
        const summary = JSON.parse(summaryStr);
        
        // Only include failed calls (status >= 400)
        const status = parseInt(summary.response_status) || 0;
        if (status < 400) return;
        if (status === -1 || status === 0) return;
        
        // Get URL from our map, or use task ID as fallback
        let endpoint = taskUrls.get(taskId) || `Task ${taskId.substring(0, 8)}...`;
        
        // If we have a full URL, extract just the path for cleaner display
        if (endpoint.startsWith('http')) {
          try {
            const url = new URL(endpoint);
            // Keep domain + path for context
            endpoint = url.host + url.pathname;
          } catch (e) {
            // Keep full URL if parsing fails
          }
        }
        
        // Determine method from request bytes
        const method = summary.request_bytes > 100 ? 'POST' : 'GET';
        
        // Determine error message based on status code
        let errorMessage = 'Unknown Error';
        if (status === 400) errorMessage = 'Bad Request';
        else if (status === 401) errorMessage = 'Unauthorized';
        else if (status === 403) errorMessage = 'Forbidden';
        else if (status === 404) errorMessage = 'Not Found';
        else if (status === 500) errorMessage = 'Internal Server Error';
        else if (status === 502) errorMessage = 'Bad Gateway';
        else if (status === 503) errorMessage = 'Service Unavailable';
        else if (status >= 400 && status < 500) errorMessage = 'Client Error';
        else if (status >= 500) errorMessage = 'Server Error';
        
        calls.push({
          taskId: taskId,
          method: method,
          endpoint: endpoint,
          status: status,
          responseTime: summary.transaction_duration_ms || 0,
          response: errorMessage
        });
      } catch (e) {
        // Skip malformed summary lines
      }
    });
    
    if (calls.length > 0) {
      console.log(`✅ Parsed ${calls.length} network calls from CFNetwork logs (${taskUrls.size} URLs mapped)`);
    }
    
    return calls;
  } catch (e) {
    console.log(`⚠️  Error parsing network logs: ${e.message}`);
    return [];
  }
}

/**
 * Parse Android MAESTRO_NETWORK logs from adb logcat
 */
function parseAndroidLogs() {
  const { execSync } = require('child_process');
  
  try {
    // Check if adb is available
    execSync('which adb', { stdio: 'pipe' });
    
    // Get connected device
    const devicesOutput = execSync('adb devices | grep -v "List" | grep "device$"', { 
      encoding: 'utf8',
      timeout: 5000 
    });
    
    if (!devicesOutput.trim()) {
      return [];
    }
    
    const deviceId = devicesOutput.split('\n')[0].split('\t')[0];
    
    // Capture logcat for MAESTRO_NETWORK tag
    const logOutput = execSync(
      `adb -s ${deviceId} logcat -d MAESTRO_NETWORK:D *:S 2>/dev/null | tail -100`,
      { 
        encoding: 'utf8',
        maxBuffer: 10 * 1024 * 1024,
        timeout: 10000
      }
    );
    
    const lines = logOutput.split('\n');
    const calls = [];
    
    for (const line of lines) {
      // Look for MAESTRO_NETWORK logs with JSON content
      // Format: D/MAESTRO_NETWORK( PID): {"method":"POST","endpoint":"...","status":404,...}
      const match = line.match(/MAESTRO_NETWORK.*?(\{.*\})/);
      if (match) {
        try {
          const jsonStr = match[1];
          const logEntry = JSON.parse(jsonStr);
          
          if (logEntry.endpoint && logEntry.status >= 400) {
            // Extract domain + path for cleaner display
            let endpoint = logEntry.endpoint;
            if (endpoint.startsWith('http')) {
              try {
                const url = new URL(endpoint);
                endpoint = url.host + url.pathname;
              } catch (e) {
                // Keep full URL if parsing fails
              }
            }
            
            calls.push({
              taskId: 'android-' + calls.length,
              method: logEntry.method || 'GET',
              endpoint: endpoint,
              status: logEntry.status,
              responseTime: logEntry.responseTime || 0,
              response: logEntry.response || 'Error'
            });
          }
        } catch (e) {
          // Skip malformed JSON lines
        }
      }
    }
    
    if (calls.length > 0) {
      console.log(`✅ Parsed ${calls.length} network calls from Android logs`);
    }
    
    return calls;
  } catch (e) {
    // adb not available or no device connected
    return [];
  }
}

/**
 * Capture network calls from real traffic capture files only
 */
function captureNetworkCalls() {
  let calls = [];
  
  // Method 1: Parse MAESTRO_NETWORK logs from app's network debugger (best - has actual endpoints)
  calls = parseMaestroNetworkLogs();
  if (calls.length > 0) {
    return calls;
  }
  
  // Method 2: Parse CFNetwork logs from simulator (fallback - no endpoint URLs)
  calls = parseCFNetworkLogs();
  if (calls.length > 0) {
    return calls;
  }
  
  // Method 3: Parse Android logs from adb logcat (for Android platform)
  calls = parseAndroidLogs();
  if (calls.length > 0) {
    return calls;
  }
  
  // Method 4: Try to read from tcpdump capture file (real traffic)
  const tcpdumpFile = path.join(networkDir, 'api-calls.json');
  try {
    if (fs.existsSync(tcpdumpFile)) {
      const tcpdumpData = JSON.parse(fs.readFileSync(tcpdumpFile, 'utf8'));
      if (tcpdumpData.calls && tcpdumpData.calls.length > 0) {
        calls = tcpdumpData.calls.filter(call => {
          // Filter by allowed hostnames
          return ALLOWED_HOSTNAMES.some(allowed => 
            call.endpoint && call.endpoint.includes(allowed)
          );
        });
        
        if (calls.length > 0) {
          console.log(`✅ Loaded ${calls.length} real network calls from capture`);
          return calls;
        }
      }
    }
  } catch (e) {
    // Continue to next method
  }
  
  // Method 3: Try to read from proxy capture file
  try {
    if (fs.existsSync(proxyCallsFile)) {
      const proxyData = JSON.parse(fs.readFileSync(proxyCallsFile, 'utf8'));
      if (proxyData.calls && proxyData.calls.length > 0) {
        calls = proxyData.calls.filter(call => {
          // Filter by allowed hostnames
          return ALLOWED_HOSTNAMES.some(allowed => 
            call.endpoint && call.endpoint.includes(allowed)
          );
        });
        
        if (calls.length > 0) {
          console.log(`✅ Loaded ${calls.length} calls from proxy capture`);
          return calls;
        }
      }
    }
  } catch (e) {
    // No proxy capture available
  }

  // No real network calls captured
  //console.log('⚠️  No network calls found in logs');
  return calls;
}


/**
 * Generate API calls file
 */
function generateApiCallsFile() {
  // Capture network calls
  const calls = captureNetworkCalls();

  // Create API calls data structure
  const apiCallsData = {
    timestamp: new Date().toISOString(),
    testName: testName,
    summary: {
      totalCalls: calls.length,
      successfulCalls: calls.filter(c => c.status >= 200 && c.status < 300).length,
      failedCalls: calls.filter(c => c.status >= 400).length,
      avgResponseTime: calls.length > 0 
        ? Math.round(calls.reduce((sum, c) => sum + (c.responseTime || 0), 0) / calls.length)
        : 0
    },
    calls: calls
  };

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Write API calls file
  try {
    fs.writeFileSync(apiCallsFile, JSON.stringify(apiCallsData, null, 2));
    if (calls.length > 0) {
      console.log(`✓ Captured ${calls.length} API calls: ${apiCallsFile}`);
    } else {
      console.log(`✓ API calls file created (no calls captured): ${apiCallsFile}`);
    }
  } catch (error) {
    console.error(`Failed to create API calls file: ${error.message}`);
    process.exit(1);
  }
}

// Generate the API calls file
generateApiCallsFile();
