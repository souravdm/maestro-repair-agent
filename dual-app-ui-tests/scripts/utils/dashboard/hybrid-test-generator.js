#!/usr/bin/env node

const { enhanceHumanSteps, detectTestData } = require('./enhance-steps');
const { transformToMaestro, cleanGeneratedYAML } = require('./transform-to-maestro');
const { enhancedValidation } = require('./validate-generated-test');
const { ElementMatcher } = require('./match-elements');
const { generateOnFlowStart, generateTags } = require('./docs-testdata-registry');
const { getSubflowsForAction, formatSubflowsForPrompt } = require('./docs-subflow-registry');
const { formatScreenObjectsForPrompt } = require('./docs-screen-registry');
const { OllamaClient } = require('./ollama-client');
const fsSync = require('fs');
const fs = fsSync.promises;
const path = require('path');

/**
 * Generation modes supported by HybridTestGenerator.
 *   'template'  – deterministic template pipeline only (no LLM)
 *   'llm'       – Llama 3.2 via Ollama only
 *   'hybrid'    – template first, then Llama 3.2 refinement & low-confidence fill
 */
const MODES = { TEMPLATE: 'template', LLM: 'llm', HYBRID: 'hybrid' };

/**
 * Hybrid Test Generator
 *
 * Pipeline (mode = hybrid):
 *   1. Read & enhance human steps using templates/registries
 *   2. Attempt subflow matching for every enhanced step
 *   3. For low-confidence steps → call Llama 3.2 via Ollama to convert
 *   4. Assemble YAML: launchApp first, appId: ${APP_ID}, conditional flows
 *   5. Resolve screen objects via ${output.x} from .maestro/screens
 *   6. Validate YAML for Maestro compatibility
 */
class HybridTestGenerator {
  constructor(mode = MODES.HYBRID) {
    this.mode = mode;
    this.elementMatcher = new ElementMatcher();
    this.ollama = new OllamaClient({ timeout: 60000 });
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

    console.log(`🚀 Starting ${this.mode} test generation for ${testId}`);
    
    const results = {
      testId,
      functionalArea,
      steps: [],
      yaml: null,
      validation: null,
      resolutions: null,
      success: false,
      errors: [],
      source: this.mode
    };

    try {
      // ── Step 1: Enhance human steps (template / registry) ───────────
      console.log('📝 Step 1: Enhancing human steps...');
      const enhancedSteps = await enhanceHumanSteps(testSteps, functionalArea);
      results.steps = enhancedSteps;
      console.log(`✅ Enhanced ${enhancedSteps.length} steps`);
      console.log('🔍 Enhanced steps output:');
      enhancedSteps.forEach((step, index) => {
        console.log(`  ${index + 1}. ${step.type}: ${step.action} -> ${step.target} (${step.description || 'no description'})`);
      });

      let generatedYaml;

      if (this.mode === MODES.LLM) {
        // ── LLM-only path ─────────────────────────────────────────────
        console.log('🤖 Step 2: Generating YAML via Llama 3.2 (Ollama)...');
        generatedYaml = await this.generateWithLlama(testRequest, enhancedSteps);
      } else if (this.mode === MODES.TEMPLATE) {
        // ── Template-only path ────────────────────────────────────────
        console.log('🔧 Step 2: Generating YAML using template...');
        generatedYaml = await this.generateFromTemplate(testRequest, enhancedSteps);
      } else {
        // ── Hybrid path: template first, LLM refinement ───────────────
        console.log('🔧 Step 2a: Generating YAML using template...');
        const templateYaml = await this.generateFromTemplate(testRequest, enhancedSteps);

        console.log('🤖 Step 2b: Refining with Llama 3.2 for low-confidence steps...');
        generatedYaml = await this.refineWithLlama(templateYaml, testRequest, enhancedSteps);
      }

      const cleanedYaml = cleanGeneratedYAML(generatedYaml);
      console.log('✅ Generated and cleaned YAML');
      console.log('🔍 Generated YAML output:');
      console.log('---');
      console.log(cleanedYaml);
      console.log('---');

      // ── Step 3: Validate generated YAML ─────────────────────────────
      console.log('✅ Step 3: Validating generated YAML...');
      const validation = await enhancedValidation(cleanedYaml, testId);
      results.validation = validation;
      
      if (!validation.isValid) {
        console.log('⚠️  Validation found issues, continuing with element matching...');
        console.log('🔍 Validation errors:', validation.errors);
      } else {
        console.log('✅ YAML validation passed');
      }

      // ── Step 4: Match elements and resolve placeholders ─────────────
      console.log('🔍 Step 4: Matching elements and resolving placeholders...');
      const matchResult = await this.elementMatcher.resolvePlaceholders(cleanedYaml);
      results.resolutions = matchResult;
      
      console.log(`✅ Resolved ${matchResult.resolvedCount}/${matchResult.totalPlaceholders} placeholders`);
      console.log('🔍 Element resolutions:');
      if (matchResult.resolutions && matchResult.resolutions.length > 0) {
        matchResult.resolutions.forEach((resolution, index) => {
          console.log(`  ${index + 1}. ${resolution.original} -> ${resolution.replacement} (${resolution.confidence}% - ${resolution.reason})`);
        });
      } else {
        console.log('  No resolutions made');
      }
      
      // Final YAML with resolved elements
      const finalYaml = matchResult.resolvedYaml;
      results.yaml = finalYaml;
      results.success = true;

      console.log('🔍 Final YAML output:');
      console.log('---');
      console.log(finalYaml);
      console.log('---');

      // Save to file if path provided
      if (outputPath) {
        await fs.writeFile(outputPath, finalYaml);
        console.log(`💾 Saved test to ${outputPath}`);
      }

      console.log(`🎉 Successfully generated ${this.mode} test: ${testId}`);
      return results;

    } catch (error) {
      console.error(`❌ Error generating test ${testId}:`, error.message);
      results.errors.push(error.message);
      return results;
    }
  }

  // ─── Template-based generation ──────────────────────────────────────────────

  async generateFromTemplate(testRequest, enhancedSteps) {
    const { testId, functionalArea, testScenario, notes, testSteps } = testRequest;
    const feature = this.extractFeatureFromArea(functionalArea);
    
    // Detect test data (email + DOB) from test steps or notes
    const detectedTestData = detectTestData(testSteps, notes);
    if (detectedTestData.detected) {
      console.log(`✅ Detected test user: ${detectedTestData.userKey} (${detectedTestData.email})`);
    }
    
    // Use docs registries for accurate onFlowStart and tags
    const tags = generateTags(functionalArea, testScenario);
    const onFlowStart = generateOnFlowStart(functionalArea, testScenario, testSteps, detectedTestData);
    
    // Extract key actions from enhanced steps
    const keyActions = await this.extractKeyActions(enhancedSteps);
    
    // Detect if authentication is required (LOA1, LOA2, signed in, etc.)
    const allText = `${testScenario} ${notes || ''} ${testSteps}`.toLowerCase();
    const requiresLogin = /\bloa[12]\b|signed.?in|logged.?in|authenticated|log\s*in|sign\s*in.*flow/i.test(allText)
      && !/guest/i.test(allText);
    
    // Ensure launchApp is always the first action
    const hasLaunchApp = keyActions.some(a => a.includes('launchApp'));
    if (!hasLaunchApp) {
      keyActions.unshift('- runFlow: ../../subflows/common/launchApp.yaml');
    }
    
    // If login is required and no sign-in subflow is present, inject it after launchApp
    const hasSignIn = keyActions.some(a =>
      a.includes('complete_signin_and_otp') || a.includes('login.yaml')
    );
    const hasLetsGetStarted = keyActions.some(a =>
      a.includes('letsGetStartedBtn')
    );
    if (requiresLogin && !hasSignIn) {
      const launchIdx = keyActions.findIndex(a => a.includes('launchApp'));
      const insertIdx = launchIdx >= 0 ? launchIdx + 1 : 1;
      const toInsert = [];
      // Only add letsGetStartedBtn if it's not already present from enhanced steps
      if (!hasLetsGetStarted) {
        toInsert.push('- tapOn: ${output.account_onboarding.letsGetStartedBtn}');
      }
      toInsert.push('- runFlow: ../../subflows/account/complete_signin_and_otp_dob.yaml');
      keyActions.splice(insertIdx, 0, ...toInsert);
    }
    
    // Build YAML with correct appId and dynamic onFlowStart
    let yaml = 'appId: ${APP_ID}\n';
    yaml += 'tags:\n';
    for (const tag of tags) {
      yaml += '  - ' + tag + '\n';
    }
    yaml += onFlowStart + '\n';
    yaml += '---\n';
    
    yaml += keyActions.join('\n') + '\n';
    
    return yaml;
  }

  // ─── Llama 3.2 (Ollama) generation ─────────────────────────────────────────

  async generateWithLlama(testRequest, enhancedSteps) {
    const { testId, functionalArea, testScenario, notes, testSteps } = testRequest;

    // Check Ollama availability
    const { available, models } = await this.ollama.isAvailable();
    if (!available) {
      console.log('⚠️  Ollama not available, falling back to template generation');
      return this.generateFromTemplate(testRequest, enhancedSteps);
    }
    const model = this.ollama.resolveModel(models) || this.ollama.defaultModel;
    console.log(`🤖 Using Ollama model: ${model}`);

    // Detect test data (email + DOB) from test steps or notes
    const detectedTestData = detectTestData(testSteps, notes);
    if (detectedTestData.detected) {
      console.log(`✅ Detected test user: ${detectedTestData.userKey} (${detectedTestData.email})`);
    }

    // Build rich context for the LLM
    const screenContext = await formatScreenObjectsForPrompt(functionalArea);
    const subflowContext = formatSubflowsForPrompt(functionalArea);
    const tags = generateTags(functionalArea, testScenario);
    const onFlowStart = generateOnFlowStart(functionalArea, testScenario, testSteps, detectedTestData);

    const stepContext = enhancedSteps.map((step, i) =>
      `Step ${i + 1}: [${step.action}] ${step.target} — ${step.description || ''}`
    ).join('\n');

    const systemPrompt = `You are a Maestro YAML test generator for CVS Pharmacy mobile app.

CRITICAL RULES — follow exactly:
1. Every test MUST start with: appId: \${APP_ID}
2. Every test MUST include launchApp as the first command after ---
3. Use appId: \${APP_ID} (NOT \${APP_NAME})
4. Use \${output.screenName.elementName} format for all UI element references
5. Prefer runFlow for anything that matches a subflow (authentication, launch, navigation)
6. Single --- separator between header and commands
7. Output ONLY valid Maestro YAML — no markdown, no comments, no explanations

PRIORITY COMMAND MAPPING (in order):
1. runFlow — use for ANY step that matches a subflow listed below
2. assertVisible — for: "check X is displayed", "verify X is visible", "validate X"
3. tapOn — for: "click X", "tap on X", "check navigation of X"
4. scrollUntilVisible — for: "scroll to X", "find X by scrolling"

SPLITTING RULE: If a step says "Verify X, Y, Z are visible", split into:
- assertVisible: X
- assertVisible: Y
- assertVisible: Z

CONDITIONAL FLOWS: If a step says "if X is visible, tap X", generate:
- runFlow:
    when:
      visible: "X"
    commands:
      - tapOn: "X"

AVAILABLE SUBFLOWS:
${subflowContext}

AVAILABLE SCREEN OBJECTS:
${screenContext}

TAGS TO USE:
${tags.map(t => '  - ' + t).join('\n')}

ONFLOWSTART BLOCK:
${onFlowStart}`;

    const userPrompt = `Generate a complete Maestro YAML test for:

Test ID: ${testId}
Functional Area: ${functionalArea}
Test Scenario: ${testScenario}
Notes: ${notes || 'None'}

Enhanced Steps:
${stepContext}

OUTPUT ONLY THE YAML.`;

    try {
      const yaml = await this.ollama.chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ], { model, temperature: 0.1 });

      if (!yaml || yaml.trim().length < 20) {
        console.log('⚠️  LLM returned empty/short response, falling back to template');
        return this.generateFromTemplate(testRequest, enhancedSteps);
      }

      return yaml;
    } catch (error) {
      console.error('❌ Llama generation failed:', error.message);
      return this.generateFromTemplate(testRequest, enhancedSteps);
    }
  }

  // ─── Hybrid refinement: template + LLM for low-confidence ───────────────────

  async refineWithLlama(templateYaml, testRequest, enhancedSteps) {
    const { available, models } = await this.ollama.isAvailable();
    if (!available) {
      console.log('⚠️  Ollama not available, using template output as-is');
      return templateYaml;
    }
    const model = this.ollama.resolveModel(models) || this.ollama.defaultModel;

    // Identify low-confidence lines: raw strings without ${output.*} or subflow refs
    const lines = templateYaml.split('\n');
    const lowConfidenceLines = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      // Lines that use raw string selectors (quoted strings without output refs)
      if ((line.startsWith('- tapOn:') || line.startsWith('- assertVisible:')) &&
          !line.includes('${output.') && !line.includes('runFlow')) {
        lowConfidenceLines.push({ index: i, line });
      }
    }

    if (lowConfidenceLines.length === 0) {
      console.log('✅ No low-confidence lines found, template is high quality');
      return templateYaml;
    }

    console.log(`🔍 Found ${lowConfidenceLines.length} low-confidence lines to refine`);

    // Build context for refinement
    const screenContext = await formatScreenObjectsForPrompt(testRequest.functionalArea);
    const subflowContext = formatSubflowsForPrompt(testRequest.functionalArea);

    const linesToRefine = lowConfidenceLines.map(l => l.line).join('\n');

    const systemPrompt = `You are a Maestro YAML expert for CVS Pharmacy.
Given low-confidence Maestro commands with raw string selectors, improve them by:
1. Replacing raw strings with \${output.screenName.elementName} if a matching screen object exists
2. Replacing individual steps with runFlow subflow references if they match an existing subflow
3. Splitting "Verify X, Y, Z" into individual assertVisible commands
4. If no match found, keep the original command unchanged

AVAILABLE SCREEN OBJECTS:
${screenContext}

AVAILABLE SUBFLOWS:
${subflowContext}

CRITICAL: Output ONLY the refined Maestro command lines (one per line, starting with "- "). No markdown, no explanations.`;

    const userPrompt = `Refine these low-confidence Maestro commands:\n\n${linesToRefine}`;

    try {
      const refined = await this.ollama.chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ], { model, temperature: 0.1, timeout: 30000 });

      if (!refined || refined.trim().length < 5) {
        return templateYaml;
      }

      // Parse refined lines and replace in the original YAML
      const refinedLines = refined.trim().split('\n')
        .map(l => l.trim())
        .filter(l => l.startsWith('- '));

      let result = templateYaml;
      let replacementIdx = 0;
      for (const lcLine of lowConfidenceLines) {
        if (replacementIdx < refinedLines.length) {
          const newLine = refinedLines[replacementIdx];
          // Only replace if the refined line has a valid Maestro command prefix
          // Must have both a command (assertVisible/tapOn/runFlow/etc.) AND proper format
          const hasValidCommand = /^-\s*(assertVisible|tapOn|runFlow|scrollUntilVisible|assertNotVisible|inputText|extendedWaitUntil|scroll|swipe|back|hideKeyboard|takeScreenshot|wait)\s*:/.test(newLine);
          if (hasValidCommand) {
            // Also reject lines with "and" between ${output.} refs (malformed LLM output)
            if (!(/\$\{output\.[^}]+\}\s+and\s+\$\{output\./.test(newLine))) {
              result = result.replace(lcLine.line, newLine);
            }
          }
          replacementIdx++;
        }
      }

      return result;
    } catch (error) {
      console.error('⚠️  LLM refinement failed, using template as-is:', error.message);
      return templateYaml;
    }
  }

  // ─── Extract key actions from enhanced steps ────────────────────────────────

  async extractKeyActions(enhancedSteps) {
    const actions = [];
    const seenTargets = new Set();
    const runFlowTargets = new Map(); // Track runFlow targets and their contained actions
    
    // Process steps in order, collecting unique actions
    for (const step of enhancedSteps) {
      if (step.type === 'action') {
        let action = null;
        let targetKey = null;
        
        switch (step.action) {
          case 'runFlow':
            targetKey = step.target.includes('launchApp.yaml') ? 'launchApp' : 
                       step.target.includes('complete_signin_and_otp_dob.yaml') ? 'signInFlow' : 
                       step.target;
            
            if (!seenTargets.has(targetKey)) {
              action = `- runFlow: ` + step.target;
              
              // Analyze nested flow to see what actions it contains
              const nestedActions = await this.analyzeNestedFlow(step.target);
              runFlowTargets.set(targetKey, nestedActions);
              
              seenTargets.add(targetKey);
            }
            break;
            
          case 'tapOn':
            targetKey = step.target;
            
            // Check if this tapOn action is already handled by any nested runFlow
            const isHandledByNestedFlow = this.isActionHandledByNestedFlows('tapOn', step.target, runFlowTargets);
            
            if (!isHandledByNestedFlow && !seenTargets.has(targetKey)) {
              // Check for invalid element placeholders and use proper format
              if (step.target && step.target.includes('{{ELEMENT:')) {
                const elementName = step.target.replace(/\{\{ELEMENT:([^}]+)\}\}/, '$1');
                action = `- tapOn: "${elementName}"`;
              } else {
                action = `- tapOn: ` + step.target;
              }
              seenTargets.add(targetKey);
            }
            break;
            
          case 'inputText': {
            // For inputText, use the field type as key to allow both email and password
            const fieldType = step.target && step.target.includes('emailField') ? 'email' :
                            step.target && step.target.includes('passwordField') ? 'password' : 'input';
            
            // Check if this inputText action is already handled by any nested runFlow
            const isInputHandledByNestedFlow = this.isActionHandledByNestedFlows('inputText', step.target, runFlowTargets);
            
            if (!isInputHandledByNestedFlow && !seenTargets.has(fieldType)) {
              if (step.target && step.target.includes('emailField')) {
                action = `- inputText: "user@example.com"`;
              } else if (step.target && step.target.includes('passwordField')) {
                action = `- inputText: "password123"`;
              } else {
                action = `- inputText: ` + (step.value || '"test_text"');
              }
              seenTargets.add(fieldType);
            }
            break;
          }
            
          case 'assertVisible': {
            // Use the specific target as the dedup key, allowing multiple different assertVisible
            targetKey = 'assertVisible:' + (step.target || '');
            
            // Skip the generic successIndicator — each test should have specific assertions
            if (step.target && step.target.includes('output.common.successIndicator')) {
              break;
            }

            // Check if this assertVisible action is already handled by any nested runFlow
            const isAssertHandledByNestedFlow = this.isActionHandledByNestedFlows('assertVisible', step.target, runFlowTargets);
            
            if (!isAssertHandledByNestedFlow && !seenTargets.has(targetKey)) {
              if (step.target && step.target.includes('{{ELEMENT:')) {
                const elementName = step.target.replace(/\{\{ELEMENT:([^}]+)\}\}/, '$1');
                action = `- assertVisible: "${elementName}"`;
              } else if (step.target) {
                action = `- assertVisible: ` + step.target;
              }
              seenTargets.add(targetKey);
            }
            break;
          }

          case 'assertNotVisible': {
            targetKey = 'assertNotVisible:' + (step.target || '');
            if (!seenTargets.has(targetKey) && step.target) {
              action = `- assertNotVisible: ` + step.target;
              seenTargets.add(targetKey);
            }
            break;
          }

          case 'scrollUntilVisible': {
            targetKey = 'scrollUntilVisible:' + (step.target || '');
            if (!seenTargets.has(targetKey) && step.target) {
              action = `- scrollUntilVisible:\n    element: ${step.target}\n    direction: DOWN`;
              seenTargets.add(targetKey);
            }
            break;
          }

          case 'conditionalFlow': {
            // If X is visible -> tap X
            if (step.condition && step.commands) {
              action = `- runFlow:\n    when:\n      visible: ${step.condition}\n    commands:`;
              for (const cmd of step.commands) {
                action += `\n      - ${cmd}`;
              }
            }
            break;
          }

          case 'extendedWaitUntil':
            targetKey = 'waitUntil:' + step.target;
            if (!seenTargets.has(targetKey)) {
              if (step.timeout) {
                action = `- extendedWaitUntil:\n    visible: ${step.target}\n    timeout: ${step.timeout}`;
              } else {
                action = `- extendedWaitUntil:\n    visible: ${step.target}\n    timeout: 8000`;
              }
              seenTargets.add(targetKey);
            }
            break;

          case 'scroll':
          case 'swipe':
          case 'back':
          case 'hideKeyboard':
          case 'takeScreenshot':
          case 'wait':
            action = `- ${step.action}: ${step.target || ''}`.trimEnd();
            break;
            
          default:
            // Skip unknown actions
            continue;
        }
        
        if (action) {
          actions.push(action);
        }
      }
    }
    
    return actions;
  }

  async analyzeNestedFlow(runFlowPath) {
    const actions = [];
    
    try {
      // Convert relative path to absolute path
      const absolutePath = runFlowPath.startsWith('../../') 
        ? path.join(__dirname, '..', '..', '..', '.maestro', runFlowPath.substring(6))
        : path.join(__dirname, '..', '..', '..', '.maestro', runFlowPath);
      
      if (fsSync.existsSync(absolutePath)) {
        const flowContent = await fs.readFile(absolutePath, 'utf8');
        
        // Parse the YAML content to extract actions
        const lines = flowContent.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          
          // Extract action types and targets
          if (trimmed.startsWith('- tapOn:')) {
            const target = trimmed.replace('- tapOn:', '').trim();
            actions.push({ type: 'tapOn', target });
          } else if (trimmed.startsWith('- inputText:')) {
            const target = trimmed.replace('- inputText:', '').trim();
            actions.push({ type: 'inputText', target });
          } else if (trimmed.startsWith('- assertVisible:')) {
            const target = trimmed.replace('- assertVisible:', '').trim();
            actions.push({ type: 'assertVisible', target });
          } else if (trimmed.startsWith('- runFlow:')) {
            const target = trimmed.replace('- runFlow:', '').trim();
            actions.push({ type: 'runFlow', target });
          }
        }
      }
    } catch (error) {
      console.error('Error analyzing nested flow:', error.message);
    }
    
    return actions;
  }

  isActionHandledByNestedFlows(actionType, target, runFlowTargets) {
    // Check if any nested flow handles this action
    for (const [flowKey, nestedActions] of runFlowTargets) {
      for (const nestedAction of nestedActions) {
        if (nestedAction.type === actionType) {
          // For tapOn actions, check if the target is similar
          if (actionType === 'tapOn') {
            // Check if the nested action target matches or is similar to our target
            if (this.targetsMatch(target, nestedAction.target)) {
              return true;
            }
          }
          
          // For inputText actions, check if it's email or password related
          if (actionType === 'inputText') {
            if (nestedAction.target.includes('email') || nestedAction.target.includes('password') || 
                target.includes('emailField') || target.includes('passwordField')) {
              return true;
            }
          }
          
          // For assertVisible actions, check if it's login success related
          if (actionType === 'assertVisible') {
            if (nestedAction.target.includes('success') || nestedAction.target.includes('welcome') ||
                target.includes('logged in') || target.includes('success')) {
              return true;
            }
          }
        }
      }
    }
    
    return false;
  }

  targetsMatch(target1, target2) {
    // Normalize targets for comparison
    const normalize = (target) => {
      return target.toLowerCase()
        .replace(/[${}]/g, '')
        .replace(/['"]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
    };
    
    const norm1 = normalize(target1);
    const norm2 = normalize(target2);
    
    // Check for exact match or contains relationship
    return norm1 === norm2 || norm1.includes(norm2) || norm2.includes(norm1);
  }

  extractFeatureFromArea(area) {
    const normalized = area.toLowerCase();
    if (normalized.includes('home')) return 'Home';
    if (normalized.includes('shop')) return 'Shop';
    if (normalized.includes('pharmacy')) return 'Pharmacy';
    if (normalized.includes('account')) return 'Account';
    if (normalized.includes('benefits')) return 'Benefits';
    if (normalized.includes('health')) return 'Health';
    if (normalized.includes('mc') || normalized.includes('minute')) return 'MCCore';
    if (normalized.includes('ngs') || normalized.includes('vaccine')) return 'NGS';
    if (normalized.includes('vm') || normalized.includes('virtual')) return 'VM';
    return 'General';
  }

  async generateTestWithRetry(testRequest, maxRetries = 3) {
    let lastResult = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      console.log(`🔄 Attempt ${attempt}/${maxRetries} for ${testRequest.testId}`);
      
      try {
        const result = await Promise.race([
          this.generateTest(testRequest),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Generation timeout')), 90000)
          )
        ]);
        
        if (result.success) {
          console.log(`✅ Success on attempt ${attempt}`);
          return result;
        }
        
        lastResult = result;
        
        if (attempt < maxRetries) {
          console.log(`⚠️  Attempt ${attempt} failed, retrying...`);
          
          // Add corrective feedback for retry
          if (result.validation && result.validation.errors.length > 0) {
            console.log('🔧 Applying validation feedback...');
            testRequest.testSteps += `\n\nFIX THESE ISSUES:\n${result.validation.errors.slice(0, 3).join('\n')}`;
          }

          // On retry 2+ in hybrid mode, escalate to full LLM
          if (attempt >= 2 && this.mode === MODES.HYBRID) {
            console.log('🔄 Escalating to full LLM generation for retry');
            this.mode = MODES.LLM;
          }
          
          // Brief delay before retry
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
      } catch (error) {
        console.error(`❌ Attempt ${attempt} failed with error:`, error.message);
        if (error.message === 'Generation timeout') {
          console.log('⏰ Generation timed out, stopping retries');
          break;
        }
        lastResult = { success: false, errors: [error.message] };
      }
    }
    
    console.log(`❌ All ${maxRetries} attempts failed for ${testRequest.testId}`);
    return lastResult || { success: false, errors: ['All attempts failed'] };
  }

  generateReport(results) {
    const report = {
      summary: {
        testId: results.testId,
        functionalArea: results.functionalArea,
        source: results.source,
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
    console.log('Usage: node hybrid-test-generator.js [--mode=template|llm|hybrid] <test-id> <functional-area> <test-scenario> <notes> <test-steps> [output-path]');
    console.log('Example: node hybrid-test-generator.js --mode=hybrid AUTH-001 Account "User Login" "Test login flow" "1. Launch app\\n2. Sign in\\n3. Verify home" output.yaml');
    process.exit(1);
  }
  
  let mode = MODES.HYBRID;
  let filteredArgs = args;
  if (args[0] && args[0].startsWith('--mode=')) {
    mode = args[0].replace('--mode=', '');
    filteredArgs = args.slice(1);
  }

  const [testId, functionalArea, testScenario, notes, ...rest] = filteredArgs;
  const testSteps = rest.slice(0, -1).join(' ');
  const outputPath = rest[rest.length - 1];
  
  const generator = new HybridTestGenerator(mode);
  
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
    
    console.log('\n=== HYBRID TEST GENERATION REPORT ===');
    console.log(JSON.stringify(report, null, 2));
    
    if (result.yaml) {
      console.log('\n=== GENERATED YAML ===');
      console.log(result.yaml);
    }
    
    process.exit(result.success ? 0 : 1);
  })
  .catch(console.error);
}

// Export for use in server
module.exports = { HybridTestGenerator, MODES };
