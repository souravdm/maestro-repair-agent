#!/usr/bin/env node

const { enhanceHumanSteps } = require('./enhance-steps');
const { transformToMaestro, cleanGeneratedYAML } = require('./transform-to-maestro');
const { enhancedValidation } = require('./validate-generated-test');
const { ElementMatcher } = require('./match-elements');
const fs = require('fs').promises;
const path = require('path');

/**
 * Enhanced Multi-Step Test Generation Flow
 * 
 * 1. Interpret and enhance human steps to match CVS flow formats
 * 2. Transform human readable steps to Maestro using Ollama
 * 3. Run the error validation script
 * 4. Find best matches for unknown screen objects/flows with confidence scoring
 */
class EnhancedTestGenerator {
  constructor() {
    this.elementMatcher = new ElementMatcher();
  }

  async generateTest(testRequest) {
    const {
      testId,
      functionalArea,
      testScenario,
      notes,
      testSteps,
      outputPath
    } = testRequest;

    console.log(`🚀 Starting enhanced test generation for ${testId}`);
    
    const results = {
      testId,
      functionalArea,
      steps: [],
      yaml: null,
      validation: null,
      resolutions: null,
      success: false,
      errors: []
    };

    try {
      // Step 1: Enhance human steps
      console.log('📝 Step 1: Enhancing human steps...');
      const enhancedSteps = await enhanceHumanSteps(testSteps, functionalArea);
      results.steps = enhancedSteps;
      console.log(`✅ Enhanced ${enhancedSteps.length} steps`);

      // Step 2: Transform to Maestro using Ollama
      console.log('🔄 Step 2: Transforming to Maestro YAML...');
      const rawYaml = await transformToMaestro(enhancedSteps, functionalArea, testId, testScenario);
      
      if (!rawYaml) {
        throw new Error('Failed to generate YAML with Ollama');
      }
      
      const cleanedYaml = cleanGeneratedYAML(rawYaml);
      console.log('✅ Generated and cleaned YAML');

      // Step 3: Validate generated YAML
      console.log('✅ Step 3: Validating generated YAML...');
      const validation = await enhancedValidation(cleanedYaml, testId);
      results.validation = validation;
      
      if (!validation.isValid) {
        console.log('❌ Validation found critical errors, stopping generation');
        results.errors.push(...validation.errors);
        results.success = false;
        return results;
      } else {
        console.log('✅ YAML validation passed');
      }

      // Step 4: Match elements and resolve placeholders
      console.log('🔍 Step 4: Matching elements and resolving placeholders...');
      const matchResult = await this.elementMatcher.resolvePlaceholders(cleanedYaml);
      results.resolutions = matchResult;
      
      console.log(`✅ Resolved ${matchResult.resolvedCount}/${matchResult.totalPlaceholders} placeholders`);
      
      // Final YAML with resolved elements
      const finalYaml = matchResult.resolvedYaml;
      results.yaml = finalYaml;
      results.success = true;

      // Save to file if path provided
      if (outputPath) {
        await fs.writeFile(outputPath, finalYaml);
        console.log(`💾 Saved test to ${outputPath}`);
      }

      console.log(`🎉 Successfully generated enhanced test: ${testId}`);
      return results;

    } catch (error) {
      console.error(`❌ Error generating test ${testId}:`, error.message);
      results.errors.push(error.message);
      return results;
    }
  }

  async generateTestWithRetry(testRequest, maxRetries = 3) {
    let lastResult = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`🔄 Attempt ${attempt}/${maxRetries} for ${testRequest.testId}`);
      
      const result = await Promise.race([
        this.generateTest(testRequest),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Generation timeout')), 90000) // 90 second timeout
        )
      ]);
      
      if (result.success && result.validation?.isValid) {
        console.log(`✅ Success on attempt ${attempt}`);
        return result;
      }
      
      lastResult = result;
      
      if (attempt < maxRetries) {
        console.log(`⚠️  Attempt ${attempt} failed, retrying...`);
        
        // Add corrective feedback for retry
        if (result.validation && result.validation.errors.length > 0) {
          console.log('🔧 Applying validation feedback...');
          testRequest.testSteps += `\n\nFIX THESE ISSUES:\n${result.validation.errors.join('\n')}`;
          await new Promise(resolve => setTimeout(resolve, 1000)); // Brief delay
        }
      }
    }
    
    console.log(`❌ All ${maxRetries} attempts failed for ${testRequest.testId}`);
    return lastResult;
  }

  generateReport(results) {
    const report = {
      summary: {
        testId: results.testId,
        functionalArea: results.functionalArea,
        success: results.success,
        stepCount: results.steps.length,
        validationPassed: results.validation?.isValid || false,
        elementsResolved: results.resolutions?.resolvedCount || 0,
        totalElements: results.resolutions?.totalPlaceholders || 0
      },
      details: {
        steps: results.steps,
        validation: results.validation,
        resolutions: results.resolutions?.resolutions || [],
        errors: results.errors
      },
      yaml: results.yaml
    };
    
    return report;
  }
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 5) {
    console.log('Usage: node enhanced-test-generator.js <test-id> <functional-area> <test-scenario> <notes> <test-steps> [output-path]');
    console.log('Example: node enhanced-test-generator.js AUTH-001 Account "User Login" "Test login flow" "1. Launch app\\n2. Sign in\\n3. Verify home" output.yaml');
    process.exit(1);
  }
  
  const [testId, functionalArea, testScenario, notes, ...rest] = args;
  const testSteps = rest.slice(0, -1).join(' ');
  const outputPath = rest[rest.length - 1];
  
  const generator = new EnhancedTestGenerator();
  
  generator.generateTestWithRetry({
    testId,
    functionalArea,
    testScenario,
    notes,
    testSteps,
    outputPath: outputPath.endsWith('.yaml') ? outputPath : null
  })
  .then(result => {
    const report = generator.generateReport(result);
    
    console.log('\n=== ENHANCED TEST GENERATION REPORT ===');
    console.log(JSON.stringify(report, null, 2));
    
    if (result.success) {
      console.log('\n=== GENERATED YAML ===');
      console.log(result.yaml);
    }
    
    process.exit(result.success ? 0 : 1);
  })
  .catch(console.error);
}

// Export for use in server
module.exports = { EnhancedTestGenerator };
