#!/usr/bin/env node

const https = require('https');
const fs = require('fs');

/**
 * Fetch AEM data and inspect structure
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

// Main execution
async function main() {
  try {
    console.log('🔄 Fetching AEM data...');
    const aemData = await fetchAEMData();
    
    if (aemData.data && aemData.data.homeScreenMlpOrderList && 
        aemData.data.homeScreenMlpOrderList.items && 
        aemData.data.homeScreenMlpOrderList.items.length > 0) {
      
      const item = aemData.data.homeScreenMlpOrderList.items[0];
      
      if (item.HomeScreenNbaModuleModel && Array.isArray(item.HomeScreenNbaModuleModel)) {
        // Find first activity module
        const activityModule = item.HomeScreenNbaModuleModel.find(m => m.id && m.id.startsWith('activity_'));
        
        if (activityModule && activityModule.listOfNbas) {
          console.log('\n📋 Sample ANBA Structure (first 3 ANBAs):\n');
          
          activityModule.listOfNbas.slice(0, 3).forEach((nba, idx) => {
            console.log(`ANBA ${idx + 1}:`);
            console.log(JSON.stringify(nba, null, 2));
            console.log('---\n');
          });
          
          // List all ANBA IDs with available fields
          console.log('📊 All ANBAs with available fields:\n');
          activityModule.listOfNbas.forEach(nba => {
            const fields = Object.keys(nba).join(', ');
            console.log(`${nba.id}: [${fields}]`);
          });
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
