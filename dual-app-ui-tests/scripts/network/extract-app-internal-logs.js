#!/usr/bin/env node

/**
 * Extract Network Calls from App's Internal Debug Logs
 * 
 * This script reads network call data directly from the app's internal storage
 * without needing to open the network debugger UI. Works only for DEBUG builds.
 * 
 * Usage: node extract-app-internal-logs.js <report-dir> <app-id>
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Get arguments
const reportDir = process.argv[2] || '.';
const appId = process.argv[3] || 'com.health100.h100.app';
const networkDir = path.join(reportDir, 'network');

// Ensure network directory exists
if (!fs.existsSync(networkDir)) {
  fs.mkdirSync(networkDir, { recursive: true });
}

console.log('📡 Extracting network calls from app internal logs...');
console.log(`   App ID: ${appId}`);

/**
 * Extract endpoint path from URL
 */
function extractEndpoint(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.pathname + (urlObj.search ? ' (with params)' : '');
  } catch (e) {
    return url;
  }
}

try {
  // Get booted simulator UDID
  const simList = execSync('xcrun simctl list devices | grep "(Booted)"', { encoding: 'utf8' });
  const udidMatch = simList.match(/[A-F0-9]{8}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{4}-[A-F0-9]{12}/);
  
  if (!udidMatch) {
    console.log('⚠️  No booted simulator found');
    process.exit(0);
  }

  const udid = udidMatch[0];
  console.log(`   Simulator: ${udid}`);
  
  // Get app's data container path
  const containerPath = execSync(
    `xcrun simctl get_app_container ${udid} ${appId} data`,
    { encoding: 'utf8' }
  ).trim();
  
  console.log(`   Container: ${containerPath}`);
  
  // Netfox stores session logs in tmp/NFX/ directory (based on NFXHelper.swift)
  const netfoxTmpDir = path.join(containerPath, 'tmp/NFX');
  const netfoxSessionLog = path.join(netfoxTmpDir, 'session.log');
  
  // Debug: Check if Netfox is present
  console.log(`   Checking for Netfox session logs...`);
  
  // Check if Netfox tmp directory and session log exist
  let networkCalls = [];
  let foundSource = null;
  
  if (fs.existsSync(netfoxTmpDir)) {
    console.log(`   ✓ Found Netfox tmp directory: ${netfoxTmpDir}`);
    const nfxFiles = fs.readdirSync(netfoxTmpDir);
    //console.log(`     Files: ${nfxFiles.join(', ')}`);
    
    if (fs.existsSync(netfoxSessionLog)) {
      console.log(`   ✓ Found Netfox session log`);
      console.log(`   Parsing session log...`);
      
      try {
        const logContent = fs.readFileSync(netfoxSessionLog, 'utf8');
        const lines = logContent.split('\n');
        
        let currentRequest = null;
        
        for (const line of lines) {
          // Parse START REQUEST: -------START REQUEST - URL -------
          const requestStartMatch = line.match(/-------START REQUEST -\s+(.+?)\s+-------/);
          if (requestStartMatch) {
            if (currentRequest) {
              networkCalls.push(currentRequest);
            }
            currentRequest = {
              method: null,
              url: requestStartMatch[1].trim(),
              status: null,
              responseTime: null,
              responseType: null,
              timestamp: new Date().toISOString()
            };
          }
          
          // Parse Request Method: [Request Method] GET
          const methodMatch = line.match(/\[Request Method\]\s+(\w+)/);
          if (methodMatch && currentRequest) {
            currentRequest.method = methodMatch[1];
          }
          
          // Parse Response Status: [Response Status] 200
          const statusMatch = line.match(/\[Response Status\]\s+(\d+)/);
          if (statusMatch && currentRequest) {
            currentRequest.status = parseInt(statusMatch[1]);
          }
          
          // Parse Response Type: [Response Type] application/json
          const responseTypeMatch = line.match(/\[Response Type\]\s+(.+)/);
          if (responseTypeMatch && currentRequest) {
            currentRequest.responseType = responseTypeMatch[1].trim();
          }
          
          // Parse Request/Response Date for timing
          const requestDateMatch = line.match(/\[Request Date\]\s+(.+)/);
          const responseDateMatch = line.match(/\[Response Date\]\s+(.+)/);
          if (requestDateMatch && currentRequest) {
            currentRequest.requestDate = new Date(requestDateMatch[1]);
          }
          if (responseDateMatch && currentRequest && currentRequest.requestDate) {
            const responseDate = new Date(responseDateMatch[1]);
            currentRequest.responseTime = responseDate - currentRequest.requestDate;
            delete currentRequest.requestDate; // Clean up temp field
          }
        }
        
        // Add the last request
        if (currentRequest) {
          networkCalls.push(currentRequest);
        }
        
        if (networkCalls.length > 0) {
          foundSource = 'Netfox session.log';
          console.log(`   ✓ Extracted ${networkCalls.length} network calls from session log`);
        }
      } catch (error) {
        console.log(`   ⚠️  Failed to parse session log: ${error.message}`);
      }
    }
  } else {
    console.log(`   ⚠️  Netfox tmp directory not found: ${netfoxTmpDir}`);
    console.log(`   💡 Netfox might not be started or no network calls were made yet`);
  }
  
  // If no calls found in session log, try fallback locations
  if (networkCalls.length === 0) {
    console.log(`   Checking fallback locations...`);
    
    const possibleLogPaths = [
      // Custom log files
      path.join(containerPath, 'Documents/network-logs.json'),
      path.join(containerPath, 'Documents/api-calls.json'),
      path.join(containerPath, 'Library/Caches/NetworkLogs.json'),
      path.join(containerPath, 'tmp/network-debug.json')
    ];
    
    // Try to find and read JSON network logs
    for (const logPath of possibleLogPaths) {
      if (fs.existsSync(logPath) && logPath.endsWith('.json')) {
        console.log(`   Found: ${path.basename(logPath)}`);
        
        try {
          const data = JSON.parse(fs.readFileSync(logPath, 'utf8'));
          if (Array.isArray(data)) {
            networkCalls = data;
            foundSource = path.basename(logPath);
            break;
          } else if (data.calls && Array.isArray(data.calls)) {
            networkCalls = data.calls;
            foundSource = path.basename(logPath);
            break;
          }
        } catch (error) {
          console.log(`   ⚠️  Failed to read ${path.basename(logPath)}: ${error.message}`);
        }
      }
    }
  }
  
  // Filter URLs by environment (QA2 or Prod only)
  const allowedHosts = [
    'www-qa2.cvs.com',
    'api.qa2.health100.com',
    'www.cvs.com',
    'api.health100.com'
  ];
  
  const filteredCalls = networkCalls.filter(call => {
    const url = call.url || call.requestURL || call.endpoint || '';
    if (!url) return false;
    
    // Check if URL contains any of the allowed hosts
    return allowedHosts.some(host => url.includes(host));
  });
  
  console.log(`   Filtered to ${filteredCalls.length} calls (QA2/Prod environments only)`);
  
  // Helper function to generate meaningful error messages
  function getErrorMessage(status, responseType) {
    if (!status || status < 400) return null;
    
    const statusMessages = {
      400: 'Bad Request - Invalid request parameters',
      401: 'Unauthorized - Authentication required',
      403: 'Forbidden - Access denied',
      404: 'Not Found - Resource does not exist',
      405: 'Method Not Allowed',
      408: 'Request Timeout',
      409: 'Conflict - Resource state conflict',
      410: 'Gone - Resource permanently deleted',
      422: 'Unprocessable Entity - Validation failed',
      429: 'Too Many Requests - Rate limit exceeded',
      500: 'Internal Server Error',
      502: 'Bad Gateway - Upstream server error',
      503: 'Service Unavailable - Server temporarily down',
      504: 'Gateway Timeout - Upstream server timeout'
    };
    
    const message = statusMessages[status] || `HTTP ${status} Error`;
    const typeInfo = responseType ? ` (${responseType})` : '';
    return message + typeInfo;
  }
  
  // Normalize the network calls to standard format
  const normalizedCalls = filteredCalls.map(call => {
    const status = call.status || call.statusCode || call.responseStatus || null;
    const responseType = call.responseType || null;
    
    // Handle different formats from different logging frameworks
    return {
      method: call.method || call.httpMethod || 'HTTP',
      url: call.url || call.requestURL || call.endpoint || '',
      endpoint: extractEndpoint(call.url || call.requestURL || call.endpoint || ''),
      status: status,
      responseTime: call.responseTime || call.duration || call.elapsed || null,
      timestamp: call.timestamp || call.date || new Date().toISOString(),
      response: getErrorMessage(status, responseType),
      source: 'app-internal-logs'
    };
  });
  
  if (normalizedCalls.length > 0) {
    console.log(`✅ Extracted ${normalizedCalls.length} network calls from ${foundSource}`);
    console.log('\nSample calls:');
    normalizedCalls.slice(0, 3).forEach(call => {
      console.log(`  ${call.method} ${call.url} - ${call.status || 'N/A'}`);
    });
  } else {
    console.log('⚠️  No network calls found in app internal logs');
    console.log('');
    console.log('💡 To enable this feature, the app needs to save network logs to a file.');
    console.log('');
    console.log('   Option 1: Add a network logging framework (DEBUG builds only)');
    console.log('     • Netfox: https://github.com/kasketis/netfox');
    console.log('     • Proxyman: https://proxyman.io');
    console.log('     • Custom logging solution');
    console.log('');
    console.log('   Option 2: Add custom logging in your app code');
    console.log('     • Save network calls to: Documents/network-logs.json');
    console.log('     • Format: [{ method, url, status, responseTime }]');
    console.log('');
    console.log('   Option 3: Use --network-capture flag instead (works for PRODUCTION)');
    console.log('     • Captures from iOS logs (URLs will be redacted)');
    console.log('');
    console.log('   Searched locations:');
    possibleLogPaths.forEach(p => {
      const exists = fs.existsSync(p) ? '✓' : '✗';
      console.log(`     ${exists} ${p.replace(containerPath, '.')}`);
    });
  }
  
  // Save to JSON file
  const apiCallsFile = path.join(networkDir, 'app-internal-calls.json');
  fs.writeFileSync(apiCallsFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    source: foundSource || 'app-internal-logs',
    summary: {
      totalCalls: normalizedCalls.length,
      successfulCalls: normalizedCalls.filter(c => c.status >= 200 && c.status < 300).length,
      failedCalls: normalizedCalls.filter(c => c.status >= 400).length,
      avgResponseTime: normalizedCalls.length > 0
        ? Math.round(normalizedCalls.reduce((sum, c) => sum + (c.responseTime || 0), 0) / normalizedCalls.length)
        : 0
    },
    calls: normalizedCalls
  }, null, 2));
  
} catch (error) {
  console.error('⚠️  Failed to extract network calls:', error.message);
  
  // Create empty file so the test runner doesn't fail
  const apiCallsFile = path.join(networkDir, 'app-internal-calls.json');
  fs.writeFileSync(apiCallsFile, JSON.stringify({
    timestamp: new Date().toISOString(),
    source: 'error',
    error: error.message,
    summary: { totalCalls: 0, successfulCalls: 0, failedCalls: 0, avgResponseTime: 0 },
    calls: []
  }, null, 2));
}
