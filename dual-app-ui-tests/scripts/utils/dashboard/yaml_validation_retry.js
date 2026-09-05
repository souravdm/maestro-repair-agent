// Add this to the test generation endpoint for better results

function validateMaestroYAML(yamlContent) {
  const lines = yamlContent.split('\n');
  const errors = [];
  
  // Check for multiple --- separators
  const separatorCount = lines.filter(line => line.trim() === '---').length;
  if (separatorCount > 1) {
    errors.push('Multiple --- separators found. Use only one after appId section.');
  }
  
  // Check for invalid properties
  const invalidProps = ['elementSelector', 'elementText', 'swipeGesture', 'textValue', 'elementId'];
  for (const prop of invalidProps) {
    if (yamlContent.includes(prop)) {
      errors.push(`Invalid property found: ${prop}`);
    }
  }
  
  // Check for Python code
  if (yamlContent.includes('class ') || yamlContent.includes('def ') || yamlContent.includes('import ')) {
    errors.push('Python code detected. Output only YAML.');
  }
  
  // Check for excessive comments
  const commentLines = lines.filter(line => line.includes('#')).length;
  if (commentLines > 3) {
    errors.push('Too many comments. Keep minimal comments.');
  }
  
  // Check for proper structure
  if (!yamlContent.includes('appId: ${APP_ID}')) {
    errors.push('Missing appId: ${APP_ID}');
  }
  
  return {
    isValid: errors.length === 0,
    errors: errors
  };
}

// Add retry logic to the test generation
async function generateTestWithRetry(graph, testId, functionalArea, testScenario, notes, testSteps, maxRetries = 3) {
  const systemPrompt = await buildMaestroTestGenerationPrompt(graph);
  const prompt = `Generate a complete Maestro YAML test file based on the following test case:

Test ID: ${testId}
Functional Area: ${functionalArea}
Test Scenario: ${testScenario}
Notes: ${notes}
Test Steps: ${testSteps}

Generate the YAML following the exact pattern shown in the examples.`;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const reply = await ollamaChat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ], OLLAMA_MODEL);
      
      // Validate the output
      const validation = validateMaestroYAML(reply);
      
      if (validation.isValid) {
        return reply; // Success!
      } else {
        console.log(`Attempt ${attempt} failed validation:`, validation.errors);
        
        if (attempt < maxRetries) {
          // Add corrective feedback for retry
          const correctedPrompt = prompt + `\n\nPREVIOUS ATTEMPT FAILED BECAUSE:\n${validation.errors.join('\n')}\n\nFIX THESE ISSUES and try again. OUTPUT ONLY YAML.`;
          
          const retryReply = await ollamaChat([
            { role: 'system', content: systemPrompt + '\nCRITICAL: Fix the validation errors and output ONLY clean YAML.' },
            { role: 'user', content: correctedPrompt }
          ], OLLAMA_MODEL);
          
          const retryValidation = validateMaestroYAML(retryReply);
          if (retryValidation.isValid) {
            return retryReply;
          }
        }
      }
    } catch (e) {
      console.log(`Attempt ${attempt} failed:`, e.message);
    }
  }
  
  // All retries failed, use fallback
  console.log('All retries failed, using template fallback');
  return generateMaestroTestFromTemplate({ testId, functionalArea, testScenario, notes, testSteps });
}
