#!/usr/bin/env node

const https = require('https');
const fs = require('fs');
const path = require('path');

const FLOWS_DIR = path.join(__dirname, '../../.maestro/flows/Home');
const ARTIFACTS_DIR = path.join(__dirname, '../../.maestro/artifacts');
const REPORT_FILE = path.join(ARTIFACTS_DIR, 'individual_anba_coverage_report.html');

// Ensure artifacts directory exists
if (!fs.existsSync(ARTIFACTS_DIR)) {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

/**
 * Fetch AEM data
 */
function fetchAEMData() {
  return new Promise((resolve, reject) => {
    const url = 'https://str-cmsservices.cvshealth.com/graphql/execute.json/superapp/get-home-24-08-06';
    
    https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve(jsonData);
        } catch (error) {
          reject(new Error(`Failed to parse AEM response: ${error.message}`));
        }
      });
    }).on('error', (error) => {
      reject(new Error(`Failed to fetch AEM data: ${error.message}`));
    });
  });
}

/**
 * Extract all individual ANBAs from AEM response with their segments
 */
function extractIndividualANBAs(aemData) {
  const anbaMap = {};
  
  try {
    if (aemData.data && aemData.data.homeScreenMlpOrderList && 
        aemData.data.homeScreenMlpOrderList.items && 
        aemData.data.homeScreenMlpOrderList.items.length > 0) {
      
      const item = aemData.data.homeScreenMlpOrderList.items[0];
      
      // Extract NBA module details
      if (item.HomeScreenNbaModuleModel && Array.isArray(item.HomeScreenNbaModuleModel)) {
        item.HomeScreenNbaModuleModel.forEach(nbaModule => {
          // Only include Activity NBAs
          if (nbaModule.id && nbaModule.id.startsWith('activity_')) {
            // Extract individual ANBAs from this module
            if (nbaModule.listOfNbas && Array.isArray(nbaModule.listOfNbas)) {
              nbaModule.listOfNbas.forEach(nba => {
                const anbaId = nba.id;
                
                // Use ANBA ID as key to deduplicate
                if (!anbaMap[anbaId]) {
                  anbaMap[anbaId] = {
                    id: anbaId,
                    segments: [nbaModule.id]
                  };
                } else {
                  // Add segment if not already present
                  if (!anbaMap[anbaId].segments.includes(nbaModule.id)) {
                    anbaMap[anbaId].segments.push(nbaModule.id);
                  }
                }
              });
            }
          }
        });
      }
    }
  } catch (error) {
    console.error('Error extracting individual ANBAs:', error.message);
  }
  
  return anbaMap;
}

/**
 * Check test coverage for individual ANBAs
 */
function checkANBACoverage(anbaMap) {
  const testFiles = fs.readdirSync(FLOWS_DIR).filter(f => f.endsWith('.yaml'));
  const coverage = {};
  
  // Map of ANBA IDs to their common names/patterns in test files
  const anbaPatterns = {
    'anba_notfilled': ['not filled', 'notfilled'],
    'anba_sms_optin': ['sms', 'opt in', 'optin', 'text alerts'],
    'anba_availableforrefill': ['available for refill', 'availableforrefill'],
    'anba_counsel_chat': ['counsel', 'message physician'],
    'anba_bonusrewardBtn': ['bonus reward', 'bonusreward'],
    'anba_wereWorkingOnIt': ['working on it', 'wereworkingonit'],
    'anba_readyForPickup': ['ready for pickup', 'readyforpickup'],
    'anba_availableForRenewal': ['available for renewal', 'availableforrenewal'],
    'anba_delayed': ['delayed'],
    'anba_ready': ['ready status', 'ready'],
    'anba_rx_delivered': ['rx delivered', 'rxdelivered', 'delivered']
  };
  
  // Initialize coverage for each ANBA
  Object.keys(anbaMap).forEach(anbaId => {
    coverage[anbaId] = {
      id: anbaId,
      segments: anbaMap[anbaId].segments,
      tested: false,
      testFiles: []
    };
  });
  
  // Analyze test files
  testFiles.forEach(file => {
    const filePath = path.join(FLOWS_DIR, file);
    const content = fs.readFileSync(filePath, 'utf-8').toLowerCase();
    const testId = file.match(/^(HS-[\d.]+)/)?.[1] || file;
    
    Object.keys(coverage).forEach(anbaId => {
      const anbaIdLower = anbaId.toLowerCase();
      
      // Check for ANBA references - exact match or with underscores removed
      let isFound = content.includes(anbaIdLower) || 
                    content.includes(anbaIdLower.replace(/_/g, ''));
      
      // Also check for pattern matches
      if (!isFound && anbaPatterns[anbaIdLower]) {
        isFound = anbaPatterns[anbaIdLower].some(pattern => 
          content.includes(pattern)
        );
      }
      
      if (isFound) {
        coverage[anbaId].tested = true;
        if (!coverage[anbaId].testFiles.includes(testId)) {
          coverage[anbaId].testFiles.push(testId);
        }
      }
    });
  });
  
  return coverage;
}

/**
 * Generate HTML report
 */
function generateReport(coverage) {
  const tested = Object.values(coverage).filter(a => a.tested);
  const untested = Object.values(coverage).filter(a => !a.tested);
  const totalCoverage = Object.keys(coverage).length > 0 ? Math.round((tested.length / Object.keys(coverage).length) * 100) : 0;
  
  const testedRows = tested.map(anba => {
    const testFilesList = anba.testFiles.length > 0 
      ? `<ul style="margin: 5px 0; padding-left: 20px; font-size: 0.9em;">${anba.testFiles.map(tf => `<li>${tf}</li>`).join('')}</ul>`
      : '<em>No tests found</em>';
    
    const segmentsList = anba.segments && anba.segments.length > 0
      ? `<ul style="margin: 5px 0; padding-left: 20px; font-size: 0.85em;">${anba.segments.map(s => `<li>${s}</li>`).join('')}</ul>`
      : '<em>No segments</em>';
    
    return `
      <tr style="background: #e8f5e9;">
        <td style="font-family: monospace; font-size: 0.9em;"><strong>${anba.id}</strong></td>
        <td>${segmentsList}</td>
        <td><span style="padding: 4px 8px; border-radius: 4px; background: #4caf50; color: white; font-size: 0.85em; font-weight: 600;">✓ Tested</span></td>
        <td>${testFilesList}</td>
      </tr>
    `;
  }).join('');
  
  const untestedRows = untested.map(anba => {
    const segmentsList = anba.segments && anba.segments.length > 0
      ? `<ul style="margin: 5px 0; padding-left: 20px; font-size: 0.85em;">${anba.segments.map(s => `<li>${s}</li>`).join('')}</ul>`
      : '<em>No segments</em>';
    
    return `
      <tr style="background: #ffebee;">
        <td style="font-family: monospace; font-size: 0.9em;"><strong>${anba.id}</strong></td>
        <td>${segmentsList}</td>
        <td><span style="padding: 4px 8px; border-radius: 4px; background: #f5576c; color: white; font-size: 0.85em; font-weight: 600;">✗ Not Tested</span></td>
        <td><em>No tests</em></td>
      </tr>
    `;
  }).join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Individual ANBA Coverage Report</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      padding: 20px;
    }
    
    .container {
      max-width: 1400px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      overflow: hidden;
    }
    
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 40px;
      text-align: center;
    }
    
    .header h1 {
      font-size: 2.5em;
      margin-bottom: 10px;
    }
    
    .header p {
      font-size: 1.1em;
      opacity: 0.9;
    }
    
    .content {
      padding: 40px;
    }
    
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 40px;
    }
    
    .stat-box {
      background: #f8f9fa;
      border-left: 4px solid #667eea;
      padding: 20px;
      border-radius: 4px;
    }
    
    .stat-box h3 {
      color: #667eea;
      font-size: 0.9em;
      text-transform: uppercase;
      margin-bottom: 10px;
    }
    
    .stat-box .value {
      font-size: 2em;
      font-weight: 600;
      color: #333;
    }
    
    .section-title {
      font-size: 1.5em;
      color: #333;
      margin-bottom: 20px;
      padding-bottom: 10px;
      border-bottom: 2px solid #667eea;
    }
    
    .table-wrapper {
      overflow-x: auto;
      margin-bottom: 40px;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      background: white;
      border: 1px solid #e9ecef;
    }
    
    thead {
      background: #f8f9fa;
      border-bottom: 2px solid #e9ecef;
    }
    
    th {
      padding: 15px;
      text-align: left;
      font-weight: 600;
      color: #333;
      border-right: 1px solid #e9ecef;
    }
    
    th:last-child {
      border-right: none;
    }
    
    td {
      padding: 12px 15px;
      border-right: 1px solid #e9ecef;
    }
    
    td:last-child {
      border-right: none;
    }
    
    .footer {
      background: #f8f9fa;
      padding: 20px 40px;
      text-align: center;
      color: #6c757d;
      font-size: 0.9em;
      border-top: 1px solid #e9ecef;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📊 Individual ANBA Coverage Report</h1>
      <p>All Unique Activity NBA Items with User Segment Mapping</p>
    </div>
    
    <div class="content">
      <div class="stats">
        <div class="stat-box">
          <h3>Total Individual ANBAs</h3>
          <div class="value">${Object.keys(coverage).length}</div>
        </div>
        <div class="stat-box">
          <h3>Tested</h3>
          <div class="value" style="color: #4caf50;">${tested.length}</div>
        </div>
        <div class="stat-box">
          <h3>Missing Tests</h3>
          <div class="value" style="color: #f5576c;">${untested.length}</div>
        </div>
        <div class="stat-box">
          <h3>Coverage %</h3>
          <div class="value" style="color: ${totalCoverage >= 80 ? '#4caf50' : totalCoverage >= 50 ? '#ff9800' : '#f5576c'};">${totalCoverage}%</div>
        </div>
      </div>
      
      ${tested.length > 0 ? `
      <h2 class="section-title">✓ Tested Individual ANBAs (${tested.length})</h2>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>ANBA ID</th>
              <th>User Segments</th>
              <th>Status</th>
              <th>Test Files</th>
            </tr>
          </thead>
          <tbody>
            ${testedRows}
          </tbody>
        </table>
      </div>
      ` : ''}
      
      ${untested.length > 0 ? `
      <h2 class="section-title">✗ Missing Individual ANBA Tests (${untested.length})</h2>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>ANBA ID</th>
              <th>User Segments</th>
              <th>Status</th>
              <th>Test Files</th>
            </tr>
          </thead>
          <tbody>
            ${untestedRows}
          </tbody>
        </table>
      </div>
      ` : ''}
    </div>
    
    <div class="footer">
      <p>Generated on ${new Date().toLocaleString()} | Data from AEM GraphQL API</p>
    </div>
  </div>
</body>
</html>`;

  return html;
}

// Main execution
async function main() {
  try {
    console.log('🔄 Fetching AEM data...');
    const aemData = await fetchAEMData();
    
    console.log('📊 Extracting individual ANBAs...');
    const anbaMap = extractIndividualANBAs(aemData);
    
    console.log('📝 Checking test coverage...');
    const coverage = checkANBACoverage(anbaMap);
    
    console.log('📄 Generating report...');
    const html = generateReport(coverage);
    
    fs.writeFileSync(REPORT_FILE, html);
    console.log(`✅ Report generated: ${REPORT_FILE}`);
    
    // Print summary
    const tested = Object.values(coverage).filter(a => a.tested);
    const untested = Object.values(coverage).filter(a => !a.tested);
    const percent = Object.keys(coverage).length > 0 ? Math.round((tested.length / Object.keys(coverage).length) * 100) : 0;
    
    console.log(`\n📊 Individual ANBA Coverage Summary:\n`);
    console.log(`  Total Individual ANBAs: ${Object.keys(coverage).length}`);
    console.log(`  Tested: ${tested.length} (${percent}%)`);
    console.log(`  Missing Tests: ${untested.length}`);
    
    if (tested.length > 0) {
      console.log(`\n✅ Tested Individual ANBAs:\n`);
      tested.forEach(anba => {
        console.log(`  - ${anba.id}`);
        console.log(`    Segments: ${anba.segments.join(', ')}`);
        console.log(`    Tests: ${anba.testFiles.join(', ')}`);
      });
    }
    
    if (untested.length > 0) {
      console.log(`\n❌ Individual ANBAs Missing Test Coverage:\n`);
      untested.forEach(anba => {
        console.log(`  - ${anba.id}`);
        console.log(`    Segments: ${anba.segments.join(', ')}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { fetchAEMData, extractIndividualANBAs, checkANBACoverage };
