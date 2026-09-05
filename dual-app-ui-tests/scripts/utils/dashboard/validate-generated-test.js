#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs').promises;
const path = require('path');

/**
 * Step 3: Run error validation on generated Maestro YAML
 * Uses the existing validate-yaml.js script with enhanced error reporting
 */
async function validateGeneratedYAML(yamlContent, testId) {
  const tempFile = `/tmp/validate_${testId}_${Date.now()}.yaml`;
  
  try {
    // Write temporary YAML file
    await fs.writeFile(tempFile, yamlContent);
    
    // Run validation script
    const validateScript = path.join(__dirname, 'utils', 'validate-yaml.js');
    const result = execSync(`node ${validateScript} ${tempFile}`, {
      encoding: 'utf8',
      cwd: path.join(__dirname, '..')
    });
    
    // Parse validation results
    const validation = parseValidationResults(result);
    
    return {
      isValid: validation.errors.length === 0,
      errors: validation.errors,
      warnings: validation.warnings,
      suggestions: validation.suggestions
    };
    
  } catch (error) {
    // Validation script returned non-zero (errors found)
    const validation = parseValidationResults(error.stdout || error.message);
    
    return {
      isValid: false,
      errors: validation.errors,
      warnings: validation.warnings,
      suggestions: validation.suggestions,
      exitCode: error.status
    };
    
  } finally {
    // Clean up temp file
    try {
      await fs.unlink(tempFile);
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}

function parseValidationResults(output) {
  const errors = [];
  const warnings = [];
  const suggestions = [];
  
  const lines = output.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    
    if (trimmed.startsWith('ERROR:')) {
      errors.push(trimmed.replace('ERROR:', '').trim());
    } else if (trimmed.startsWith('WARNING:')) {
      warnings.push(trimmed.replace('WARNING:', '').trim());
    } else if (trimmed.startsWith('SUGGESTION:')) {
      suggestions.push(trimmed.replace('SUGGESTION:', '').trim());
    }
  }
  
  return { errors, warnings, suggestions };
}

// Enhanced validation with additional checks
async function enhancedValidation(yamlContent, testId) {
  const basicValidation = await validateGeneratedYAML(yamlContent, testId);
  
  // Add custom validation rules
  const customErrors = [];
  const customWarnings = [];
  
  // Check for invalid properties
  const invalidProps = ['elementSelector', 'elementText', 'swipeGesture', 'textValue', 'elementId'];
  for (const prop of invalidProps) {
    if (yamlContent.includes(prop)) {
      customErrors.push(`Invalid property found: ${prop}`);
    }
  }
  
  // Check for proper structure — appId: ${APP_ID} is required
  if (!yamlContent.includes('appId: ${APP_ID}')) {
    if (yamlContent.includes('appId: ${APP_NAME}')) {
      customWarnings.push('Uses appId: ${APP_NAME} — should be appId: ${APP_ID} for cross-platform compatibility');
    } else {
      customErrors.push('Missing appId: ${APP_ID} header');
    }
  }

  // Check for launchApp — every test must launch the app
  if (!yamlContent.includes('launchApp') && !yamlContent.includes('runFlow') ) {
    customWarnings.push('No launchApp or runFlow found — test may not initialize app state');
  }
  
  // Check for invalid element placeholders ({{ELEMENT:...}})
  const invalidElementMatches = yamlContent.match(/\{\{ELEMENT:[^}]+\}\}/g) || [];
  for (const invalidElement of invalidElementMatches) {
    customErrors.push(`Invalid element placeholder found: ${invalidElement} - should use proper selector format like "Sign In" or \${output.element.name}`);
  }
  
  // Check for proper element references
  const elementMatches = yamlContent.match(/\$\{output\.[^}]+\}/g) || [];
  for (const element of elementMatches) {
    if (element.includes('{{ELEMENT:')) {
      customWarnings.push(`Placeholder element found: ${element} - needs to be resolved`);
    }
  }

  // Validate scrollUntilVisible structure
  const scrollUntilLines = yamlContent.match(/- scrollUntilVisible:.*/g) || [];
  for (const line of scrollUntilLines) {
    // scrollUntilVisible should be a block with element + direction, not inline string
    if (!line.includes(':') || line.trim() === '- scrollUntilVisible:') {
      // This is fine — it's a block-style entry. Check the next lines have element/direction.
      const scrollBlock = yamlContent.substring(yamlContent.indexOf(line));
      if (!scrollBlock.includes('element:')) {
        customWarnings.push('scrollUntilVisible block missing "element:" property');
      }
      if (!scrollBlock.includes('direction:')) {
        customWarnings.push('scrollUntilVisible block missing "direction:" property — defaulting to DOWN');
      }
    }
  }

  // Validate conditional runFlow (when: visible:) structure
  const whenBlocks = yamlContent.match(/when:\s*\n\s+visible:/g) || [];
  // This is just informational — no error needed for well-formed blocks

  // Check for multiple --- separators
  const separatorCount = (yamlContent.match(/^---$/gm) || []).length;
  if (separatorCount > 1) {
    customErrors.push(`Multiple --- separators found (${separatorCount}). Use only one after appId section.`);
  }
  
  // Check for proper subflow paths and validate nested commands
  const subflowMatches = yamlContent.match(/runFlow:\s*(.+\.yaml)/g) || [];
  for (const subflow of subflowMatches) {
    const sfPath = subflow.replace('runFlow:', '').trim();
    if (!sfPath.startsWith('../../subflows/')) {
      customWarnings.push(`Subflow path may be incorrect: ${sfPath}`);
    }
    
    // Validate nested commands in runFlow files
    try {
      const fullPath = require('path').join(__dirname, '..', '..', '..', '.maestro', sfPath.replace('../../', ''));
      const fsSync = require('fs');
      if (fsSync.existsSync(fullPath)) {
        const subflowContent = fsSync.readFileSync(fullPath, 'utf8');
        
        // Check for invalid element placeholders in nested files
        const nestedInvalidElements = subflowContent.match(/\{\{ELEMENT:[^}]+\}\}/g) || [];
        for (const invalidElement of nestedInvalidElements) {
          customErrors.push(`Invalid element placeholder in nested runFlow ${sfPath}: ${invalidElement}`);
        }
        
        // Check for other invalid properties in nested files
        const nestedInvalidProps = ['elementSelector', 'elementText', 'swipeGesture', 'textValue', 'elementId'];
        for (const prop of nestedInvalidProps) {
          if (subflowContent.includes(prop)) {
            customErrors.push(`Invalid property found in nested runFlow ${sfPath}: ${prop}`);
          }
        }
      } else {
        customWarnings.push(`runFlow file not found: ${sfPath}`);
      }
    } catch (error) {
      customWarnings.push(`Could not validate runFlow file: ${sfPath} - ${error.message}`);
    }
  }
  
  return {
    isValid: basicValidation.isValid && customErrors.length === 0,
    errors: [...basicValidation.errors, ...customErrors],
    warnings: [...basicValidation.warnings, ...customWarnings],
    suggestions: basicValidation.suggestions
  };
}

// Export for use in main flow
module.exports = { validateGeneratedYAML, enhancedValidation };

// CLI usage
if (require.main === module) {
  const yamlFile = process.argv[2];
  const testId = process.argv[3] || 'TEST-001';
  
  if (!yamlFile) {
    console.error('Usage: node validate-generated-test.js <yaml-file> [test-id]');
    process.exit(1);
  }
  
  fs.readFile(yamlFile, 'utf8')
    .then(yamlContent => enhancedValidation(yamlContent, testId))
    .then(validation => {
      console.log(JSON.stringify(validation, null, 2));
      process.exit(validation.isValid ? 0 : 1);
    })
    .catch(console.error);
}
