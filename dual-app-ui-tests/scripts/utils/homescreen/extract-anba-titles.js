#!/usr/bin/env node

const https = require('https');

/**
 * Fetch AEM data and extract individual ANBA titles
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
 * Extract individual ANBA titles from AEM response
 */
function extractANBATitles(aemData) {
  const anbaTitles = {};
  
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
                const title = nba.title || '';
                
                // Use ANBA ID as key to deduplicate
                if (!anbaTitles[anbaId]) {
                  anbaTitles[anbaId] = title;
                }
              });
            }
          }
        });
      }
    }
  } catch (error) {
    console.error('Error extracting ANBA titles:', error.message);
  }
  
  return anbaTitles;
}

// Main execution
async function main() {
  try {
    console.log('🔄 Fetching AEM data...');
    const aemData = await fetchAEMData();
    
    console.log('📊 Extracting individual ANBA titles...');
    const anbaTitles = extractANBATitles(aemData);
    
    console.log('\n📋 Individual ANBA Titles:\n');
    
    // Sort by ANBA ID
    const sortedIds = Object.keys(anbaTitles).sort();
    
    sortedIds.forEach(anbaId => {
      const title = anbaTitles[anbaId];
      console.log(`    ${anbaId}: "${title}",`);
    });
    
    console.log(`\n✅ Total ANBAs: ${sortedIds.length}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { fetchAEMData, extractANBATitles };
