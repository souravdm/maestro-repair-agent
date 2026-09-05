#!/usr/bin/env node

/**
 * AEM NBA Validation Script
 * 
 * This script calls the AEM GraphQL API to retrieve configured NBAs
 * for a given user segment and validates them against expected values.
 * 
 * Usage:
 *   node scripts/validate_aem_nbas.js --segment "user + rxtie + EC plus"
 *   node scripts/validate_aem_nbas.js --segment guest --output json
 */

const https = require('https');

// AEM GraphQL endpoint
const AEM_GRAPHQL_URL = 'https://str-cmsservices.cvshealth.com/graphql/execute.json/superapp/get-home-24-08-06';

// User segment mapping to AEM segment IDs
const USER_SEGMENTS = {
  'guest': 'segment_guest',
  'guest + EC': 'segment_guest_extracare',
  'guest + EC plus': 'segment_guest_extracareplus',
  'user (LOA1)': 'segment_user',
  'user + EC': 'segment_user_extracare',
  'user + ECplus': 'segment_user_extracareplus',
  'user + rxtie': 'segment_user_rx',
  'user + rxtie + ec': 'segment_user_extracare_rx',
  'user + rxtie + EC plus': 'segment_user_extracareplus_rx'
};

/**
 * Fetch AEM data for a given user segment
 * @param {string} segment - User segment (e.g., "user + rxtie + EC plus")
 * @returns {Promise<Object>} AEM configuration data
 */
async function fetchAEMData(segment) {
  return new Promise((resolve, reject) => {
    const url = new URL(AEM_GRAPHQL_URL);
    
    // Add segment as query parameter if needed
    // url.searchParams.append('segment', USER_SEGMENTS[segment] || segment);
    
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
 * Parse AEM response to extract modules for a specific segment
 * @param {Object} aemData - Raw AEM response
 * @param {string} userSegment - User segment (e.g., "guest", "user + rxtie + EC plus")
 * @returns {Object} Parsed module configuration
 */
function parseNBAsForSegment(aemData, userSegment) {
  const segmentId = USER_SEGMENTS[userSegment] || userSegment;
  
  const result = {
    segment: userSegment,
    segmentId: segmentId,
    priorityNBAs: [],
    activityNBAs: [],
    discoveryNBAs: [],
    businessUnits: [],
    allModules: [],
    timestamp: new Date().toISOString()
  };
  
  try {
    // Parse actual AEM GraphQL response structure
    // The response is nested under data.homeScreenMlpOrderList.items[0].segments
    let segments = null;
    
    if (aemData.data && aemData.data.homeScreenMlpOrderList && 
        aemData.data.homeScreenMlpOrderList.items && 
        aemData.data.homeScreenMlpOrderList.items.length > 0) {
      segments = aemData.data.homeScreenMlpOrderList.items[0].segments;
    }
    
    if (segments && Array.isArray(segments)) {
      // Find the segment configuration
      const segmentConfig = segments.find(s => s.segmentId === segmentId);
      
      if (segmentConfig && segmentConfig.modules) {
        // Parse all modules
        result.allModules = segmentConfig.modules.map((module, index) => ({
          id: module.id,
          type: module.__typename,
          rank: index + 1
        }));
        
        // Get NBA module details from the response
        const nbaModules = aemData.data.homeScreenMlpOrderList.items[0].HomeScreenNbaModuleModel || [];
        
        // Categorize modules by type
        segmentConfig.modules.forEach((module, index) => {
          const moduleInfo = {
            id: module.id,
            type: module.__typename,
            rank: index + 1
          };
          
          // Categorize NBA modules and add listOfNbas if available
          if (module.__typename === 'HomeScreenNbaModuleModel') {
            // Find the full NBA module details
            const nbaDetails = nbaModules.find(nba => nba.id === module.id);
            if (nbaDetails && nbaDetails.listOfNbas) {
              moduleInfo.listOfNbas = nbaDetails.listOfNbas.map(nba => nba.id);
              moduleInfo.nbaCount = nbaDetails.listOfNbas.length;
              moduleInfo.headerTitle = nbaDetails.headerTitle;
              moduleInfo.templateId = nbaDetails.templateId;
            }
            
            if (module.id.startsWith('priority_')) {
              result.priorityNBAs.push(moduleInfo);
            } else if (module.id.startsWith('activity_')) {
              result.activityNBAs.push(moduleInfo);
            } else if (module.id.startsWith('discovery_')) {
              result.discoveryNBAs.push(moduleInfo);
            }
          } else {
            // All other modules are Business Units
            result.businessUnits.push(moduleInfo);
          }
        });
      } else {
        console.warn(`Segment '${segmentId}' not found in AEM configuration`);
      }
    }
  } catch (error) {
    console.error('Error parsing AEM data:', error.message);
  }
  
  return result;
}

/**
 * Validate expected modules against AEM configuration
 * @param {Object} aemConfig - Parsed AEM configuration
 * @param {Object} expectedModules - Expected modules for validation
 * @returns {Object} Validation results
 */
function validateNBAs(aemConfig, expectedModules = {}) {
  const results = {
    valid: true,
    errors: [],
    warnings: [],
    summary: {
      priorityNBAsCount: aemConfig.priorityNBAs.length,
      activityNBAsCount: aemConfig.activityNBAs.length,
      discoveryNBAsCount: aemConfig.discoveryNBAs.length,
      businessUnitsCount: aemConfig.businessUnits.length,
      totalModulesCount: aemConfig.allModules.length
    }
  };
  
  // Validate Priority NBAs
  if (expectedModules.priorityNBAs) {
    expectedModules.priorityNBAs.forEach(expectedNBA => {
      const found = aemConfig.priorityNBAs.find(nba => nba.id === expectedNBA.id);
      if (!found) {
        results.valid = false;
        results.errors.push(`Expected Priority NBA '${expectedNBA.id}' not found in AEM configuration`);
      }
    });
  }
  
  // Validate Activity NBAs
  if (expectedModules.activityNBAs) {
    expectedModules.activityNBAs.forEach(expectedNBA => {
      const found = aemConfig.activityNBAs.find(nba => nba.id === expectedNBA.id);
      if (!found) {
        results.valid = false;
        results.errors.push(`Expected Activity NBA '${expectedNBA.id}' not found in AEM configuration`);
      }
    });
  }
  
  // Validate Discovery NBAs
  if (expectedModules.discoveryNBAs) {
    expectedModules.discoveryNBAs.forEach(expectedNBA => {
      const found = aemConfig.discoveryNBAs.find(nba => nba.id === expectedNBA.id);
      if (!found) {
        results.valid = false;
        results.errors.push(`Expected Discovery NBA '${expectedNBA.id}' not found in AEM configuration`);
      }
    });
  }
  
  // Validate Business Units
  if (expectedModules.businessUnits) {
    expectedModules.businessUnits.forEach(expectedBU => {
      const found = aemConfig.businessUnits.find(bu => bu.id === expectedBU.id);
      if (!found) {
        results.valid = false;
        results.errors.push(`Expected Business Unit '${expectedBU.id}' not found in AEM configuration`);
      }
    });
  }
  
  // Validate module order if specified
  if (expectedModules.moduleOrder) {
    expectedModules.moduleOrder.forEach((expectedId, index) => {
      const actualModule = aemConfig.allModules[index];
      if (!actualModule || actualModule.id !== expectedId) {
        results.warnings.push(`Module order mismatch at position ${index + 1}: expected '${expectedId}', found '${actualModule ? actualModule.id : 'none'}'`);
      }
    });
  }
  
  return results;
}

/**
 * Format output based on specified format
 * @param {Object} data - Data to format
 * @param {string} format - Output format (json, table, summary)
 */
function formatOutput(data, format = 'summary') {
  switch (format) {
    case 'json':
      console.log(JSON.stringify(data, null, 2));
      break;
      
    case 'table':
      if (data.priorityNBAs.length > 0) {
        console.log('\n=== Priority NBAs ===');
        console.table(data.priorityNBAs);
      }
      console.log('\n=== Activity NBAs ===');
      console.table(data.activityNBAs);
      console.log('\n=== Discovery NBAs ===');
      console.table(data.discoveryNBAs);
      console.log('\n=== Business Units ===');
      console.table(data.businessUnits);
      console.log('\n=== All Modules (in order) ===');
      console.table(data.allModules);
      break;
      
    case 'summary':
    default:
      console.log(`\n📊 AEM Module Configuration`);
      console.log(`👤 Segment: ${data.segment}`);
      console.log(`🔖 Segment ID: ${data.segmentId}`);
      console.log(`⏰ Timestamp: ${data.timestamp}\n`);
      
      if (data.priorityNBAs.length > 0) {
        console.log(`\n📌 Priority NBAs (${data.priorityNBAs.length}):`);
        data.priorityNBAs.forEach(nba => {
          console.log(`  ${nba.rank}. ${nba.id}`);
          if (nba.nbaCount) {
            console.log(`    (${nba.nbaCount} individual NBAs)`);
          }
          if (nba.listOfNbas && nba.listOfNbas.length > 0) {
            nba.listOfNbas.forEach(individualNba => {
              console.log(`      - ${individualNba}`);
            });
          }
        });
      } else {
        console.log(`\n📌 Priority NBAs (0):`);
      }
      
      if (data.activityNBAs.length > 0) {
        console.log(`\n🎯 Activity NBAs (${data.activityNBAs.length}):`);
        data.activityNBAs.forEach(nba => {
          console.log(`  ${nba.rank}. ${nba.id}`);
          if (nba.nbaCount) {
            console.log(`    (${nba.nbaCount} individual NBAs)`);
          }
          if (nba.listOfNbas && nba.listOfNbas.length > 0) {
            nba.listOfNbas.forEach(individualNba => {
              console.log(`      - ${individualNba}`);
            });
          }
        });
      } else {
        console.log(`\n🎯 Activity NBAs (0):`);
      }
      
      if (data.discoveryNBAs.length > 0) {
        console.log(`\n🔍 Discovery NBAs (${data.discoveryNBAs.length}):`);
        data.discoveryNBAs.forEach(nba => {
          console.log(`  ${nba.rank}. ${nba.id}`);
          if (nba.nbaCount) {
            console.log(`    (${nba.nbaCount} individual NBAs)`);
          }
          if (nba.listOfNbas && nba.listOfNbas.length > 0) {
            nba.listOfNbas.forEach(individualNba => {
              console.log(`      - ${individualNba}`);
            });
          }
        });
      } else {
        console.log(`\n🔍 Discovery NBAs (0):`);
      }
      
      console.log(`\n🏢 Business Units (${data.businessUnits.length}):`);
      data.businessUnits.forEach(bu => {
        console.log(`  ${bu.rank}. ${bu.id} (${bu.type})`);
      });
      
      console.log(`\n📋 Total Modules: ${data.allModules.length}`);
      break;
  }
}

/**
 * Main execution function
 */
async function main() {
  const args = process.argv.slice(2);
  
  // Parse command line arguments
  let segment = 'guest';
  let outputFormat = 'summary';
  let validateMode = false;
  let expectedNBAs = null;
  let dumpRaw = false;
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--segment' && args[i + 1]) {
      segment = args[i + 1];
      i++;
    } else if (args[i] === '--output' && args[i + 1]) {
      outputFormat = args[i + 1];
      i++;
    } else if (args[i] === '--validate' && args[i + 1]) {
      validateMode = true;
      try {
        expectedNBAs = JSON.parse(args[i + 1]);
      } catch (error) {
        console.error('❌ Invalid JSON for --validate parameter');
        process.exit(1);
      }
      i++;
    } else if (args[i] === '--raw' || args[i] === '--dump') {
      dumpRaw = true;
    } else if (args[i] === '--help') {
      console.log(`
AEM NBA Validation Script

Usage:
  node scripts/validate_aem_nbas.js [options]

Options:
  --segment <segment>     User segment to query (default: "guest")
                          Valid segments (user-friendly names):
                            - guest
                            - guest + EC
                            - guest + EC plus
                            - user (LOA1)
                            - user + EC
                            - user + ECplus
                            - user + rxtie
                            - user + rxtie + ec
                            - user + rxtie + EC plus
                          Or use segment IDs directly:
                            - segment_guest
                            - segment_guest_extracare
                            - segment_guest_extracareplus
                            - segment_user
                            - segment_user_extracare
                            - segment_user_extracareplus
                            - segment_user_rx
                            - segment_user_extracare_rx
                            - segment_user_extracareplus_rx
  
  --output <format>       Output format: summary, json, table (default: summary)
  
  --validate <json>       Validate against expected NBAs (JSON format)
  
  --raw, --dump           Dump raw AEM API response for debugging
  
  --help                  Show this help message

Examples:
  # Get NBAs for guest user (user-friendly name)
  node scripts/validate_aem_nbas.js --segment guest
  
  # Get NBAs using segment ID directly
  node scripts/validate_aem_nbas.js --segment segment_guest
  
  # Get NBAs for authenticated user with Rx and EC Plus
  node scripts/validate_aem_nbas.js --segment "user + rxtie + EC plus" --output json
  
  # Or use segment ID
  node scripts/validate_aem_nbas.js --segment segment_user_extracareplus_rx --output json
  
  # Validate expected NBAs
  node scripts/validate_aem_nbas.js --segment guest --validate '{"activityNBAs":[{"id":"rx-refill"}]}'
      `);
      process.exit(0);
    }
  }
  
  // Validate segment
  let segmentId = USER_SEGMENTS[segment];
  
  // If not found in mapping, check if it's already a valid segment ID
  if (!segmentId) {
    // Check if the input is already a segment ID (starts with 'segment_')
    if (segment.startsWith('segment_')) {
      segmentId = segment;
      // Find the user-friendly name for display
      const friendlyName = Object.keys(USER_SEGMENTS).find(key => USER_SEGMENTS[key] === segment);
      if (friendlyName) {
        segment = friendlyName;
      }
    } else {
      console.error(`❌ Invalid segment: ${segment}`);
      console.error('Valid segments:', Object.keys(USER_SEGMENTS).join(', '));
      console.error('Or use segment IDs directly: segment_guest, segment_user, segment_user_extracare, etc.');
      process.exit(1);
    }
  }
  
  try {
    console.log(`🔄 Fetching AEM data for segment: ${segment}...`);
    
    // Fetch AEM data
    const aemData = await fetchAEMData(segment);
    
    // If raw dump requested, show the response and exit
    if (dumpRaw) {
      console.log('\n📄 Raw AEM API Response:');
      console.log(JSON.stringify(aemData, null, 2));
      console.log('\n✅ Raw response dumped successfully');
      process.exit(0);
    }
    
    // Parse NBAs for the segment
    const nbaConfig = parseNBAsForSegment(aemData, segment);
    
    // Validate if in validation mode
    if (validateMode && expectedNBAs) {
      console.log('\n🔍 Validating against expected NBAs...');
      const validationResults = validateNBAs(nbaConfig, expectedNBAs);
      
      console.log('\n📋 Validation Results:');
      console.log(`Status: ${validationResults.valid ? '✅ PASSED' : '❌ FAILED'}`);
      
      if (validationResults.errors.length > 0) {
        console.log('\n❌ Errors:');
        validationResults.errors.forEach(error => console.log(`  - ${error}`));
      }
      
      if (validationResults.warnings.length > 0) {
        console.log('\n⚠️  Warnings:');
        validationResults.warnings.forEach(warning => console.log(`  - ${warning}`));
      }
      
      console.log('\n📊 Summary:');
      console.log(`  Activity NBAs: ${validationResults.summary.activityNBAsCount}`);
      console.log(`  Discovery NBAs: ${validationResults.summary.discoveryNBAsCount}`);
      console.log(`  Business Units: ${validationResults.summary.businessUnitsCount}`);
      
      process.exit(validationResults.valid ? 0 : 1);
    }
    
    // Format and display output
    formatOutput(nbaConfig, outputFormat);
    
    console.log('\n✅ AEM data retrieved successfully');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = {
  fetchAEMData,
  parseNBAsForSegment,
  validateNBAs
};
