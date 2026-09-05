#!/usr/bin/env node

// Node.js 18+ has built-in fetch
const { getSubflowsForArea, formatSubflowsForPrompt } = require('./docs-subflow-registry');
const { formatScreenObjectsForPrompt } = require('./docs-screen-registry');
const { generateOnFlowStart, generateTags } = require('./docs-testdata-registry');

/**
 * Step 2: Transform enhanced steps to Maestro YAML using Ollama (Llama 3.2)
 * Uses the enhanced step structure to generate proper Maestro commands
 */
async function transformToMaestro(enhancedSteps, functionalArea, testId, testScenario) {
  const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
  const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';
  
  // Build context from enhanced steps
  const stepContext = enhancedSteps.map((step, index) => {
    return `Step ${index + 1}: [${step.action}] ${step.target || ''} — ${step.description || ''}`;
  }).join('\n');

  // Gather dynamic context from registries
  const subflowContext = formatSubflowsForPrompt(functionalArea);
  const screenContext = await formatScreenObjectsForPrompt(functionalArea);
  const tags = generateTags(functionalArea, testScenario);
  const onFlowStart = generateOnFlowStart(functionalArea, testScenario, stepContext);
  
  const systemPrompt = `You are a Maestro YAML expert for CVS Pharmacy mobile tests.

CRITICAL APP STATE RULES:
1. Every test MUST start with: appId: \${APP_ID}
2. Every test MUST include launchApp as the first command after ---
3. Use appId: \${APP_ID} (NOT \${APP_NAME})

PRIORITY COMMAND MAPPING (use these in order of preference):
1. runFlow — use for ANY step that matches an existing subflow
2. assertVisible — for: "check X is displayed", "verify X is visible", "validate X is displayed"
3. tapOn — for: "click X", "tap on X", "check navigation of X"
4. scrollUntilVisible — for: "scroll to X", "find X by scrolling", "scroll until X visible"

SPLITTING RULE:
If a step says "Verify X, Y, Z are visible", split into individual commands:
- assertVisible: X
- assertVisible: Y
- assertVisible: Z

CONDITIONAL FLOWS:
If a step says "if X is visible, tap X", generate:
- runFlow:
    when:
      visible: "X"
    commands:
      - tapOn: "X"

ELEMENT RESOLUTION:
- Use \${output.screenName.elementName} format for UI elements when available
- If no screen object match exists, use the plain string in quotes: "Element Text"
- NEVER use {{ELEMENT:...}} placeholders — they are invalid
- NEVER use invalid properties like elementSelector, elementText

STRUCTURE RULES:
- Single --- separator between header and commands
- Include onFlowStart scripts from the block provided
- Subflow paths MUST start with ../../subflows/
- NO comments, NO explanations, NO markdown — output ONLY YAML

AVAILABLE SUBFLOWS:
${subflowContext}

AVAILABLE SCREEN OBJECTS:
${screenContext}

TAGS:
${tags.map(t => '  - ' + t).join('\n')}

ONFLOWSTART BLOCK:
${onFlowStart}`;

  const userPrompt = `Generate Maestro YAML for:

Test ID: ${testId}
Functional Area: ${functionalArea}
Test Scenario: ${testScenario}

Enhanced Steps:
${stepContext}

IMPORTANT: The enhanced steps already suggest actions. Convert them to proper Maestro YAML.
- If an enhanced step has action=runFlow, use that subflow path directly
- If an enhanced step has action=assertVisible, use assertVisible
- If an enhanced step has action=tapOn, use tapOn
- If an enhanced step has action=scrollUntilVisible, use scrollUntilVisible
- If an enhanced step has action=conditionalFlow, use runFlow with when/visible

OUTPUT ONLY THE YAML.`;

  try {
    // Add timeout for Ollama request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
    
    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        stream: false,
        options: {
          temperature: 0.1,
          top_p: 0.9,
          repeat_penalty: 1.1
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Ollama HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.message?.content || '';
  } catch (error) {
    console.error('Ollama transformation failed:', error.message);
    return null;
  }
}

// Post-process to clean up YAML
function cleanGeneratedYAML(yamlContent) {
  if (!yamlContent) return yamlContent;
  
  let cleaned = yamlContent;
  
  // Remove inline comments
  cleaned = cleaned.replace(/\s*#.*$/gm, '');
  
  // Remove standalone comment lines
  cleaned = cleaned.replace(/^\s*#.*$/gm, '');
  
  // Fix --- separators for Maestro format
  const lines = cleaned.split('\n');
  const cleanedLines = [];
  let separatorFound = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines at the beginning
    if (i === 0 && line === '') continue;
    
    // Handle --- separators - only keep one in the correct position
    if (line === '---') {
      // Skip --- if it's the very first line (Maestro doesn't start with ---)
      if (i === 0) continue;
      
      // Skip --- if it's the very last line (Maestro doesn't end with ---)
      if (i === lines.length - 1) continue;
      
      // Only keep the first --- separator we encounter
      if (!separatorFound) {
        cleanedLines.push('---');
        separatorFound = true;
      }
      continue;
    }
    
    // Add non-separator lines
    if (line !== '') {
      cleanedLines.push(lines[i]);
    }
  }
  
  // ─── Split combined assertVisible / tapOn and strip trailing noise ──────
  const expandedLines = [];
  for (const line of cleanedLines) {
    const trimmed = line.trim();

    // FIX: LLM sometimes outputs "- ${output.x} and ${output.y}" without a command
    // Split into individual assertVisible commands
    const malformedOutputAndMatch = trimmed.match(/^-\s*(\$\{output\.[^}]+\})\s+and\s+(\$\{output\.[^}]+\})$/);
    if (malformedOutputAndMatch) {
      expandedLines.push(`- assertVisible: ${malformedOutputAndMatch[1]}`);
      expandedLines.push(`- assertVisible: ${malformedOutputAndMatch[2]}`);
      continue;
    }

    // FIX: LLM sometimes outputs "- ${output.x}" without a command — wrap in assertVisible
    const malformedSingleOutputMatch = trimmed.match(/^-\s*(\$\{output\.[^}]+\})$/);
    if (malformedSingleOutputMatch) {
      expandedLines.push(`- assertVisible: ${malformedSingleOutputMatch[1]}`);
      continue;
    }

    // Split: - assertVisible: "X" and "Y" buttons display
    const combinedAssertMatch = trimmed.match(/^-\s*assertVisible:\s*["']([^"']+)["']\s+and\s+["']([^"']+)["']/i);
    if (combinedAssertMatch) {
      expandedLines.push(`- assertVisible: "${combinedAssertMatch[1]}"`);
      expandedLines.push(`- assertVisible: "${combinedAssertMatch[2]}"`);
      continue;
    }

    // Split: - assertVisible: ${output.x} and ${output.y} (with command but combined)
    const combinedOutputAssertMatch = trimmed.match(/^-\s*assertVisible:\s*(\$\{output\.[^}]+\})\s+and\s+(\$\{output\.[^}]+\})/);
    if (combinedOutputAssertMatch) {
      expandedLines.push(`- assertVisible: ${combinedOutputAssertMatch[1]}`);
      expandedLines.push(`- assertVisible: ${combinedOutputAssertMatch[2]}`);
      continue;
    }

    // Clean: - tapOn: "X" button to show... → - tapOn: "X"
    const noisyTapMatch = trimmed.match(/^(-\s*tapOn:\s*["'][^"']+["'])\s+(?:button|to\s+|link\s+|tab\s+|icon\s+)/i);
    if (noisyTapMatch) {
      expandedLines.push(noisyTapMatch[1]);
      continue;
    }

    // Clean: - assertVisible: "X" trailing text → - assertVisible: "X"
    const noisyAssertMatch = trimmed.match(/^(-\s*assertVisible:\s*["'][^"']+["'])\s+(?:is\s+|section|module|button|display|card|text|element|open\s+state)/i);
    if (noisyAssertMatch) {
      expandedLines.push(noisyAssertMatch[1]);
      continue;
    }

    expandedLines.push(line);
  }
  
  // Remove excessive empty lines
  const finalLines = [];
  let previousLineEmpty = false;
  for (const line of expandedLines) {
    const isEmpty = line.trim() === '';
    if (!isEmpty || !previousLineEmpty) {
      finalLines.push(line);
    }
    previousLineEmpty = isEmpty;
  }
  
  return finalLines.join('\n').trim();
}

// Export for use in main flow
module.exports = { transformToMaestro, cleanGeneratedYAML };

// CLI usage
if (require.main === module) {
  const enhancedSteps = JSON.parse(process.argv[2] || '[]');
  const functionalArea = process.argv[3] || 'General';
  const testId = process.argv[4] || 'TEST-001';
  const testScenario = process.argv[5] || 'Test scenario';
  
  transformToMaestro(enhancedSteps, functionalArea, testId, testScenario)
    .then(yaml => {
      const cleaned = cleanGeneratedYAML(yaml);
      console.log(cleaned);
    })
    .catch(console.error);
}
