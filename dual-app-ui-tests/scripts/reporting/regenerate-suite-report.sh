#!/bin/bash

# Regenerate Suite Report
# Recreates the suite HTML report from suite-results.json

if [ -z "$1" ]; then
  echo "Usage: bash scripts/reporting/regenerate-suite-report.sh <test-report-directory>"
  echo "Example: bash scripts/reporting/regenerate-suite-report.sh test-reports/IOS_20260501_105949"
  exit 1
fi

REPORT_DIR="$1"
SUITE_JSON="$REPORT_DIR/suite-results.json"
TEMP_XML="$REPORT_DIR/suite-results-temp.xml"
REPORT_FILE="$REPORT_DIR/suite-report.html"

if [ ! -f "$SUITE_JSON" ]; then
  echo "❌ Error: suite-results.json not found in $REPORT_DIR"
  exit 1
fi

echo "🔄 Regenerating suite report..."
echo "📂 Report directory: $REPORT_DIR"

# Convert JSON to XML
echo "📝 Converting JSON to XML..."
node -e "
  const fs = require('fs');
  const path = require('path');
  const results = JSON.parse(fs.readFileSync('$SUITE_JSON', 'utf8'));
  
  let xml = '<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n';
  xml += '<testsuite name=\"' + results.suite + '\" tests=\"' + results.summary.total + '\" failures=\"' + results.summary.failed + '\" time=\"0\">\n';
  
  results.tests.forEach(test => {
    xml += '  <testcase name=\"' + test.name + '\" time=\"' + test.duration + '\">\n';
    if (test.status === 'failed') {
      let failureMsg = 'Test execution failed';
      const testResultsXml = path.join('$REPORT_DIR', test.name, 'results.xml');
      if (fs.existsSync(testResultsXml)) {
        try {
          const testXml = fs.readFileSync(testResultsXml, 'utf8');
          const match = testXml.match(/<failure[^>]*>(.*?)<\/failure>/s);
          if (match) failureMsg = match[1].trim();
        } catch (e) {}
      }
      xml += '    <failure>' + failureMsg + '</failure>\n';
    }
    xml += '  </testcase>\n';
  });
  
  xml += '</testsuite>\n';
  fs.writeFileSync('$TEMP_XML', xml);
  console.log('✓ XML created');
" || {
  echo "❌ Failed to convert JSON to XML"
  exit 1
}

# Generate HTML report
echo "📊 Generating HTML report..."
REPORT_DIR="$REPORT_DIR" node scripts/reporting/generate-unified-report.js "$TEMP_XML" "$REPORT_FILE" "ios" || {
  echo "❌ Failed to generate HTML report"
  rm -f "$TEMP_XML"
  exit 1
}

# Cleanup
rm -f "$TEMP_XML"

echo "✅ Report regenerated: $REPORT_FILE"
echo ""
echo "To open: open $REPORT_FILE"
