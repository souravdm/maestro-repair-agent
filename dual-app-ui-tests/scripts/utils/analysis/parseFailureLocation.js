#!/usr/bin/env node

/**
 * Enhanced Maestro Failure Location Parser
 * Provides comprehensive failure analysis including:
 * - Exact file and line number where failure occurred
 * - Full flow chain (test -> subflow -> screen)
 * - Executed steps tracking
 * - App installation/launch failure detection
 * 
 * No external dependencies required - uses plain text parsing
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '../..');

/**
 * Parse Maestro debug commands JSON to extract only executed screens/subflows
 * @param {string} debugDir - Path to debug output directory
 * @param {string} testName - Test name (used to find commands file)
 * @returns {Array} - Array of executed screen/subflow names with status
 */
function parseExecutedScreensFromDebug(debugDir, testName) {
  if (!debugDir || !fs.existsSync(debugDir)) return [];
  
  // Find commands JSON file
  const files = fs.readdirSync(debugDir);
  const cmdFile = files.find(f => f.startsWith('commands-') && f.endsWith('.json'));
  if (!cmdFile) return [];
  
  const cmdPath = path.join(debugDir, cmdFile);
  try {
    const data = JSON.parse(fs.readFileSync(cmdPath, 'utf8'));
    if (!Array.isArray(data)) return [];
    
    const executed = [];
    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      const cmd = item.command || {};
      const meta = item.metadata || {};
      const status = meta.status;
      
      // Only include COMPLETED or FAILED (not SKIPPED)
      if (status !== 'COMPLETED' && status !== 'FAILED') continue;
      
      // Only include runFlowCommand with screen/subflow paths
      if (!cmd.runFlowCommand) continue;
      
      const src = cmd.runFlowCommand.sourceDescription || '';
      if (!src || (!src.includes('screens/') && !src.includes('subflows/'))) continue;
      
      // Extract just the screen/subflow name (no path, no .yaml)
      const name = path.basename(src, '.yaml');
      
      // Skip CommonScreen and GeneralScreen as they are not needed in report
      if (name === 'CommonScreen' || name === 'GeneralScreen') continue;
      
      executed.push({
        timestamp: meta.timestamp || i,  // Use timestamp for ordering, fallback to index
        name: name,
        status: status === 'COMPLETED' ? 'passed' : 'failed',
        path: src.replace(/^\.\.\/\.\.\//g, '')  // Clean up relative path
      });
    }
    
    // Sort by timestamp to ensure sequential execution order
    executed.sort((a, b) => a.timestamp - b.timestamp);
    
    // Remove timestamp from final output (not needed in report)
    return executed.map(({ timestamp, ...rest }) => rest);
  } catch (e) {
    return [];
  }
}

/**
 * Known app-level failure patterns
 */
const APP_FAILURE_PATTERNS = {
  APP_NOT_INSTALLED: [
    /app.*not.*installed/i,
    /unable.*find.*app/i,
    /no.*app.*found/i,
    /app.*bundle.*not.*found/i,
    /could.*not.*launch.*app/i,
    /application.*not.*installed/i
  ],
  APP_NOT_LAUNCHED: [
    /app.*not.*running/i,
    /app.*crashed/i,
    /app.*terminated/i,
    /failed.*launch/i,
    /launch.*failed/i,
    /unable.*start.*app/i,
    /app.*did.*not.*start/i
  ],
  APP_CRASH: [
    /app.*crash/i,
    /unexpected.*termination/i,
    /signal.*SIGKILL/i,
    /signal.*SIGABRT/i,
    /EXC_BAD_ACCESS/i
  ],
  SIMULATOR_ERROR: [
    /simulator.*not.*booted/i,
    /no.*booted.*simulator/i,
    /simulator.*unavailable/i,
    /device.*not.*found/i
  ],
  TIMEOUT: [
    /timeout.*waiting/i,
    /timed.*out/i,
    /exceeded.*timeout/i
  ]
};

/**
 * Detect app-level failures from error message
 */
function detectAppFailure(errorMessage) {
  for (const [failureType, patterns] of Object.entries(APP_FAILURE_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(errorMessage)) {
        return {
          type: failureType,
          isAppLevelFailure: true,
          description: getAppFailureDescription(failureType)
        };
      }
    }
  }
  return null;
}

/**
 * Build adjacency map of runFlow references across YAML files (tests/subflows/screens/flows)
 */
function buildRunFlowGraph(rootDir) {
  const files = getAllYamlFiles(rootDir);
  const graph = new Map();
  for (const abs of files) {
    const content = safeRead(abs);
    const dir = path.dirname(abs);
    const edges = new Set();

    // Match single-line:  - runFlow: ../../path/to/file.yaml
    const singleLine = /-\s*runFlow:\s*([^\s#][^\s]*\.ya?ml)/g;
    let m;
    while ((m = singleLine.exec(content)) !== null) {
      edges.add(path.resolve(dir, m[1].trim()));
    }

    // Match multi-line:  - runFlow:\n    file: ../../path/to/file.yaml
    // Also catches file: within runScript blocks — harmless, .yaml filter is enough.
    const fileProp = /^\s+file:\s+([^\s#][^\s]*\.ya?ml)/gm;
    while ((m = fileProp.exec(content)) !== null) {
      edges.add(path.resolve(dir, m[1].trim()));
    }

    graph.set(abs, edges);
  }
  return graph;
}

/**
 * Enumerate YAML files under tests/subflows/screens/flows
 */
function getAllYamlFiles(rootDir) {
  const include = ['.maestro/flows', '.maestro/subflows', '.maestro/screens'];
  const out = [];
  function walk(dir) {
    let ents;
    try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile() && p.endsWith('.yaml')) out.push(p);
    }
  }
  for (const d of include) walk(path.join(rootDir, d));
  return out;
}

function safeRead(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch { return ''; }
}

/**
 * Find files that contain the exact target string
 */
function findFilesWithExactTarget(rootDir, target) {
  const files = getAllYamlFiles(rootDir);
  return files.filter(f => safeRead(f).includes(target));
}

/**
 * From test file, BFS to a candidate file via runFlow edges
 */
function findReachablePath(testAbs, candidates, graph) {
  const candSet = new Set(candidates);
  const visited = new Set();
  const q = [[testAbs]];
  while (q.length) {
    const pathSoFar = q.shift();
    const node = pathSoFar[pathSoFar.length - 1];
    if (visited.has(node)) continue;
    visited.add(node);
    if (candSet.has(node)) return { reachable: true, path: pathSoFar, targetFile: node };
    const nbrs = graph.get(node) || new Set();
    for (const nb of nbrs) {
      if (!visited.has(nb)) q.push([...pathSoFar, nb]);
    }
  }
  return null;
}

function inferFlowType(rel) {
  const parts = rel.split(path.sep);
  if (parts.includes('subflows')) return 'subflow';
  if (parts.includes('screens')) return 'screen';
  if (parts.includes('flows')) return 'flow';
  if (parts.includes('tests')) return 'test';
  return 'test';
}

/**
 * Locate first exact-matching line and infer step type/content around it
 */
function findFirstMatchingLineAndStep(absFile, target) {
  const txt = safeRead(absFile);
  const lines = txt.split('\n');
  let matchLineNumber = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(target)) { matchLineNumber = i + 1; break; }
  }
  let stepType = '';
  let stepContent = '';
  let stepLineNumber = 0;
  if (matchLineNumber > 0) {
    // Walk upward to the nearest step start ('- ')
    for (let j = matchLineNumber - 1; j >= 0; j--) {
      const t = lines[j].trim();
      if (t.startsWith('- ')) {
        stepLineNumber = j + 1;
        stepContent = t;
        const m = t.match(/^-\s*([a-zA-Z]+)/);
        stepType = m ? m[1] : '';
        break;
      }
    }
    if (!stepContent) stepContent = lines[matchLineNumber - 1].trim();
  }
  return { matchLineNumber, stepLineNumber, stepType, stepContent };
}


/**
 * Get human-readable description for app failure type
 */
function getAppFailureDescription(failureType) {
  const descriptions = {
    APP_NOT_INSTALLED: 'The app is not installed on the simulator. Run with --build flag to install.',
    APP_NOT_LAUNCHED: 'The app failed to launch or is not running. Check app logs for details.',
    APP_CRASH: 'The app crashed during test execution. Check crash logs.',
    SIMULATOR_ERROR: 'Simulator is not available or not booted. Run setup_simulator.sh first.',
    TIMEOUT: 'Operation timed out waiting for element or condition.'
  };
  return descriptions[failureType] || 'Unknown app-level failure';
}

/**
 * Extract the failing element/assertion from Maestro error message
 */
function extractFailureTarget(errorMessage) {
  // Pattern: "Element not found: Text matching regex: Account"
  let match = errorMessage.match(/Element not found:\s*(?:Text matching regex:\s*)?(.+)/i);
  if (match) {
    return { type: 'element_not_found', target: match[1].trim() };
  }
  
  // Pattern: "Assertion is false: "Account" is visible"
  match = errorMessage.match(/Assertion is false:\s*"([^"]+)"\s*is visible/i);
  if (match) {
    return { type: 'assertion_visible', target: match[1].trim() };
  }
  
  // Pattern: "Assertion is false: "Account" is not visible"
  match = errorMessage.match(/Assertion is false:\s*"([^"]+)"\s*is not visible/i);
  if (match) {
    return { type: 'assertion_not_visible', target: match[1].trim() };
  }

  // Pattern: Maestro "Assert that \"X|Y|Z\" is visible... FAILED"
  match = errorMessage.match(/Assert\s+(?:that\s+)?"([^"]+)"\s+is visible/i);
  if (match) {
    return { type: 'assertion_visible', target: match[1].trim() };
  }
  
  // Pattern: "Could not find element with id: xyz"
  match = errorMessage.match(/Could not find element with id:\s*(.+)/i);
  if (match) {
    return { type: 'element_by_id', target: match[1].trim() };
  }
  
  // Pattern: "Tap failed on element"
  match = errorMessage.match(/Tap failed.*?(?:on|element).*?["']([^"']+)["']/i);
  if (match) {
    return { type: 'tap_failed', target: match[1].trim() };
  }
  
  // Pattern: Generic assertion failure
  match = errorMessage.match(/Assertion.*?:\s*(.+)/i);
  if (match) {
    return { type: 'assertion', target: match[1].trim() };
  }
  
  return null;
}

/**
 * Parse a YAML file and extract all steps with their line numbers
 */
function parseYamlSteps(filePath) {
  if (!fs.existsSync(filePath)) return [];
  
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const steps = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;
      const trimmedLine = line.trim();
      
      // Skip empty lines and comments
      if (!trimmedLine || trimmedLine.startsWith('#')) continue;
      
      // Detect different step types
      const stepPatterns = [
        { pattern: /^-\s*launchApp/, type: 'launchApp' },
        { pattern: /^-\s*tapOn/, type: 'tapOn' },
        { pattern: /^-\s*assertVisible/, type: 'assertVisible' },
        { pattern: /^-\s*assertNotVisible/, type: 'assertNotVisible' },
        { pattern: /^-\s*inputText/, type: 'inputText' },
        { pattern: /^-\s*swipe/, type: 'swipe' },
        { pattern: /^-\s*scroll/, type: 'scroll' },
        { pattern: /^-\s*waitForAnimationToEnd/, type: 'waitForAnimation' },
        { pattern: /^-\s*extendedWaitUntil/, type: 'extendedWaitUntil' },
        { pattern: /^-\s*runFlow/, type: 'runFlow' },
        { pattern: /^-\s*runScript/, type: 'runScript' },
        { pattern: /^-\s*takeScreenshot/, type: 'takeScreenshot' },
        { pattern: /^-\s*pressKey/, type: 'pressKey' },
        { pattern: /^-\s*hideKeyboard/, type: 'hideKeyboard' },
        { pattern: /^-\s*back/, type: 'back' },
        { pattern: /^-\s*clearState/, type: 'clearState' },
        { pattern: /^-\s*stopApp/, type: 'stopApp' },
        { pattern: /^-\s*openLink/, type: 'openLink' },
        { pattern: /^-\s*evalScript/, type: 'evalScript' },
        { pattern: /^-\s*assertTrue/, type: 'assertTrue' },
        { pattern: /^-\s*assertFalse/, type: 'assertFalse' }
      ];
      
      for (const { pattern, type } of stepPatterns) {
        if (pattern.test(trimmedLine)) {
          // Capture multi-line content for this step
          let fullContent = trimmedLine;
          let j = i + 1;
          const baseIndent = line.search(/\S/);
          
          // For simple single-line steps (like runFlow with just a file path), don't capture extra lines
          const isSingleLineStep = /^-\s*runFlow:\s*[^\s]+\.yaml\s*$/.test(trimmedLine);
          
          if (!isSingleLineStep) {
            // Continue reading lines that are indented more than the step line
            while (j < lines.length) {
              const nextLine = lines[j];
              const nextTrimmed = nextLine.trim();
              
              // Stop if we hit an empty line or comment
              if (!nextTrimmed || nextTrimmed.startsWith('#')) {
                j++;
                continue;
              }
              
              const nextIndent = nextLine.search(/\S/);
              
              // Stop if we hit a new step at same or lower indent level
              if (nextIndent <= baseIndent) {
                break;
              }
              
              // Only capture if indented more than the base step
              if (nextIndent > baseIndent) {
                fullContent += ' ' + nextTrimmed;
                j++;
              } else {
                break;
              }
            }
          }
          
          steps.push({
            line: lineNum,
            type: type,
            content: fullContent,
            rawLine: line
          });
          break;
        }
      }
    }
    
    return steps;
  } catch (error) {
    return [];
  }
}

/**
 * Build flow chain by recursively following runFlow references
 */
function buildFlowChain(filePath, visited = new Set(), chain = []) {
  if (visited.has(filePath)) return chain;
  visited.add(filePath);
  
  if (!fs.existsSync(filePath)) return [];
  
  const relativePath = path.relative(PROJECT_ROOT, filePath);
  const steps = parseYamlSteps(filePath);
  
  // Determine flow type based on path
  let flowType = 'test';
  if (relativePath.includes('/subflows/')) flowType = 'subflow';
  else if (relativePath.includes('/screens/')) flowType = 'screen';
  else if (relativePath.includes('/flows/')) flowType = 'flow';
  
  const flowEntry = {
    file: relativePath,
    type: flowType,
    steps: steps,
    subflows: []
  };
  
  // Find and process nested runFlow references
  for (const step of steps) {
    if (step.type === 'runFlow') {
      const match = step.content.match(/runFlow:\s*([^\s]+\.yaml)/);
      if (match) {
        const nestedPath = path.resolve(path.dirname(filePath), match[1].trim());
        const nestedChain = buildFlowChain(nestedPath, visited, []);
        if (nestedChain.length > 0) {
          flowEntry.subflows.push({
            calledFromLine: step.line,
            flows: nestedChain
          });
        }
      }
    }
  }
  
  chain.push(flowEntry);
  return chain;
}

/**
 * Search for failure target in flow chain and return full context
 * This recursively searches through all flows and their subflows
 */
function searchFlowChainForTarget(flowChain, target, parentContext = []) {
  for (const flow of flowChain) {
    const currentContext = [...parentContext, { file: flow.file, type: flow.type }];
    
    // Search in this flow's steps
    for (const step of flow.steps) {
      // Check if this step contains the target
      if (step.content.includes(target) || 
          (target.includes('|') && target.split('|').some(t => step.content.includes(t.trim())))) {
        return {
          found: true,
          file: flow.file,
          line: step.line,
          stepType: step.type,
          content: step.content,
          flowChain: currentContext,
          flowType: flow.type
        };
      }
      
      // If this is a runFlow step, search in the referenced flow
      if (step.type === 'runFlow') {
        const match = step.content.match(/runFlow:\s*([^\s]+\.yaml)/);
        if (match) {
          const referencedFile = match[1].trim();
          const referencedPath = path.resolve(path.dirname(path.join(PROJECT_ROOT, flow.file)), referencedFile);
          
          // Check if this runFlow is in our subflows
          for (const subflow of flow.subflows) {
            if (subflow.calledFromLine === step.line) {
              const result = searchFlowChainForTarget(subflow.flows, target, currentContext);
              if (result.found) {
                return result;
              }
            }
          }
        }
      }
    }
    
    // Also search in subflows that weren't matched by runFlow steps
    for (const subflow of flow.subflows) {
      const result = searchFlowChainForTarget(subflow.flows, target, currentContext);
      if (result.found) {
        return result;
      }
    }
  }
  
  return { found: false };
}

/**
 * Parse Maestro log output to extract executed steps
 */
function parseExecutedStepsFromLog(logContent) {
  const executedSteps = [];
  const lines = logContent.split('\n');
  
  for (const line of lines) {
    // Maestro outputs steps like: "[Passed] tapOn: Account"
    // or "[Running] assertVisible: Welcome"
    const stepMatch = line.match(/\[(Passed|Running|Failed)\]\s*(\w+)(?::\s*(.+))?/i);
    if (stepMatch) {
      executedSteps.push({
        status: stepMatch[1].toLowerCase(),
        action: stepMatch[2],
        target: stepMatch[3] || '',
        rawLine: line.trim()
      });
    }
    
    // Also capture flow execution markers
    const flowMatch = line.match(/Running flow:\s*(.+\.yaml)/i);
    if (flowMatch) {
      executedSteps.push({
        status: 'running',
        action: 'runFlow',
        target: flowMatch[1],
        rawLine: line.trim()
      });
    }
  }
  
  return executedSteps;
}

/**
 * Main function to find failure location with full context
 */
function findFailureLocation(testFile, errorMessage, logContent = '') {
  // First check for app-level failures
  const appFailure = detectAppFailure(errorMessage);
  if (appFailure) {
    return {
      file: testFile,
      line: '',
      isAppLevelFailure: true,
      failureType: appFailure.type,
      failureDescription: appFailure.description,
      flowChain: [{ file: testFile, type: 'test' }],
      scenarioSteps: buildScenarioSteps(testFile),
      executedSteps: logContent ? parseExecutedStepsFromLog(logContent) : [],
      reason: appFailure.description
    };
  }
  
  // Extract failure target from error message
  const failureTarget = extractFailureTarget(errorMessage);
  if (!failureTarget) {
    return {
      file: testFile,
      line: '',
      flowChain: [{ file: testFile, type: 'test' }],
      scenarioSteps: buildScenarioSteps(testFile),
      executedSteps: logContent ? parseExecutedStepsFromLog(logContent) : [],
      reason: 'Could not parse error message',
      rawError: errorMessage
    };
  }
  
  // Build the complete flow chain
  const testFilePath = path.join(PROJECT_ROOT, testFile);
  const flowChain = buildFlowChain(testFilePath);
  
  // Parse executed steps from log
  const executedSteps = logContent ? parseExecutedStepsFromLog(logContent) : [];
  
  // Primary approach: exact-match search + reachability via runFlow graph
  const graph = buildRunFlowGraph(PROJECT_ROOT);
  const candidateFiles = findFilesWithExactTarget(PROJECT_ROOT, failureTarget.target);
  const reach = findReachablePath(testFilePath, candidateFiles, graph);
  if (reach && reach.reachable) {
    const targetAbs = reach.targetFile;
    const { matchLineNumber, stepLineNumber, stepType, stepContent } = findFirstMatchingLineAndStep(targetAbs, failureTarget.target);
    const reportedLine = stepLineNumber || matchLineNumber;
    const chain = reach.path.map(p => ({ file: path.relative(PROJECT_ROOT, p), type: inferFlowType(path.relative(PROJECT_ROOT, p)) }));
    return {
      file: path.relative(PROJECT_ROOT, targetAbs),
      line: reportedLine ? String(reportedLine) : '',
      matchLine: matchLineNumber ? String(matchLineNumber) : '',
      stepType: stepType || '',
      content: stepContent || '',
      flowType: chain.length ? chain[chain.length - 1].type : 'test',
      flowChain: chain,
      failureTarget: failureTarget,
      scenarioSteps: buildScenarioSteps(testFile),
      executedSteps: executedSteps,
      isAppLevelFailure: false
    };
  }
  
  // Fallback: recursive step-based search
  const searchResult = searchAllYamlFiles(path.join(PROJECT_ROOT, testFile), failureTarget.target);
  if (searchResult.found) {
    return {
      file: searchResult.file,
      line: searchResult.line.toString(),
      stepType: searchResult.stepType,
      content: searchResult.content,
      flowType: searchResult.flowType,
      flowChain: searchResult.flowChain,
      failureTarget: failureTarget,
      scenarioSteps: buildScenarioSteps(testFile),
      executedSteps: executedSteps,
      isAppLevelFailure: false
    };
  }
  
  // Fallback if not found - still provide basic info
  return {
    file: testFile,
    line: '',
    stepType: '',
    content: '',
    flowType: 'test',
    flowChain: [{ file: testFile, type: 'test' }],
    failureTarget: failureTarget,
    scenarioSteps: buildScenarioSteps(testFile),
    executedSteps: executedSteps,
    isAppLevelFailure: false
  };
}

function buildScenarioSteps(testFile) {
  const startAbs = path.join(PROJECT_ROOT, testFile);
  const visited = new Set();
  const out = [];

  function walk(absFile, depth) {
    if (visited.has(absFile)) return;
    visited.add(absFile);
    if (!fs.existsSync(absFile)) return;

    const relFile = path.relative(PROJECT_ROOT, absFile);
    const steps = parseYamlSteps(absFile);

    for (const step of steps) {
      if (step.type === 'runFlow') {
        const m = step.content.match(/runFlow:\s*([^\s]+\.yaml)/);
        if (m) {
          const refAbs = path.resolve(path.dirname(absFile), m[1].trim());
          const refRel = path.relative(PROJECT_ROOT, refAbs);
          out.push({
            file: relFile,
            action: 'runFlow',
            target: refRel,
            depth
          });
          walk(refAbs, depth + 1);
          continue;
        }
      }

      const target = extractTargetFromStep(step);
      out.push({
        file: relFile,
        line: step.line,
        action: step.type,
        target,
        depth
      });
    }
  }

  walk(startAbs, 0);
  return out;
}

function scenarioTextForRunFlow(refRel) {
  const t = inferFlowType(refRel);
  const name = path.basename(refRel, '.yaml');
  if (t === 'screen') return `Given I am on ${name}`;
  if (t === 'subflow') return `When I run ${name}`;
  if (t === 'flow') return `When I run ${name}`;
  return `When I run ${name}`;
}

function scenarioTextForStep(action, target) {
  const safeTarget = target ? `${target}` : '';
  if (action === 'launchApp') return 'Given the app is launched';
  if (action === 'tapOn') return safeTarget ? `When I tap on ${safeTarget}` : 'When I tap';
  if (action === 'inputText') return safeTarget ? `When I enter ${safeTarget}` : 'When I enter text';
  if (action === 'assertVisible') return safeTarget ? `Then I should see ${safeTarget}` : 'Then I should see it';
  if (action === 'assertNotVisible') return safeTarget ? `Then I should not see ${safeTarget}` : 'Then I should not see it';
  if (action === 'extendedWaitUntil') return safeTarget ? `Then I wait until ${safeTarget}` : 'Then I wait until condition is met';
  if (action === 'takeScreenshot') return safeTarget ? `And I take screenshot ${safeTarget}` : 'And I take a screenshot';
  return safeTarget ? `And ${action} ${safeTarget}` : `And ${action}`;
}

function extractTargetFromStep(step) {
  const c = step.content;
  const quoted = c.match(/"([^"]+)"/);
  if (quoted) return `"${quoted[1]}"`;
  const id = c.match(/\bid:\s*"?([^\s\"]+)"?/);
  if (id) return `id:${id[1]}`;
  const text = c.match(/\btext:\s*"?([^\s\"]+)"?/);
  if (text) return `text:${text[1]}`;
  const vis = c.match(/\bvisible:\s*"([^"]+)"/);
  if (vis) return `"${vis[1]}"`;
  const tap = c.match(/^-\s*tapOn:\s*"([^"]+)"/);
  if (tap) return `"${tap[1]}"`;
  return '';
}

/**
 * Aggressively search all YAML files referenced from the test file
 * This is a fallback when the flow chain search doesn't find the target
 */
function searchAllYamlFiles(testFilePath, target, visited = new Set(), parentChain = []) {
  if (visited.has(testFilePath)) return { found: false };
  visited.add(testFilePath);
  
  if (!fs.existsSync(testFilePath)) return { found: false };
  
  const relativePath = path.relative(PROJECT_ROOT, testFilePath);
  let flowType = 'test';
  if (relativePath.includes('/subflows/')) flowType = 'subflow';
  else if (relativePath.includes('/screens/')) flowType = 'screen';
  else if (relativePath.includes('/flows/')) flowType = 'flow';
  
  const currentChain = [...parentChain, { file: relativePath, type: flowType }];
  const steps = parseYamlSteps(testFilePath);
  
  // First: look for exact match in current file
  for (const step of steps) {
    if (step.content.includes(target)) {
      return {
        found: true,
        file: relativePath,
        line: step.line,
        stepType: step.type,
        content: step.content,
        flowType: flowType,
        flowChain: currentChain
      };
    }
  }
  
  // Second: recursively search in all referenced flows (depth-first)
  for (const step of steps) {
    if (step.type === 'runFlow') {
      const match = step.content.match(/runFlow:\s*([^\s]+\.yaml)/);
      if (match) {
        const referencedFile = match[1].trim();
        const referencedPath = path.resolve(path.dirname(testFilePath), referencedFile);
        const result = searchAllYamlFiles(referencedPath, target, visited, currentChain);
        if (result.found) {
          return result;
        }
      }
    }
  }
  
  // Last resort: if target has pipe (OR condition), look for any part matching
  // This is less precise so we only do it after exhausting exact matches in all files
  if (target.includes('|')) {
    for (const step of steps) {
      if (target.split('|').some(t => step.content.includes(t.trim()))) {
        return {
          found: true,
          file: relativePath,
          line: step.line,
          stepType: step.type,
          content: step.content,
          flowType: flowType,
          flowChain: currentChain
        };
      }
    }
  }
  
  return { found: false };
}

/**
 * Search for failure target in all YAML files
 */
function getAllStepsForTest(testFile) {
  const testFilePath = path.join(PROJECT_ROOT, testFile);
  const flowChain = buildFlowChain(testFilePath);
  
  const allSteps = [];
  
  function extractSteps(flows, depth = 0) {
    for (const flow of flows) {
      for (const step of flow.steps) {
        allSteps.push({
          ...step,
          file: flow.file,
          flowType: flow.type,
          depth: depth
        });
      }
      for (const subflow of flow.subflows) {
        extractSteps(subflow.flows, depth + 1);
      }
    }
  }
  
  extractSteps(flowChain);
  return allSteps;
}

/**
 * Format flow chain for display
 */
function formatFlowChain(flowChain) {
  if (!flowChain || flowChain.length === 0) return '';
  
  return flowChain.map((f, i) => {
    const prefix = i === 0 ? '' : ' → ';
    const typeLabel = f.type.charAt(0).toUpperCase() + f.type.slice(1);
    return `${prefix}[${typeLabel}] ${f.file}`;
  }).join('');
}

/**
 * Main CLI
 */
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];
  
  if (command === 'steps' && args[1]) {
    // Get all steps for a test file
    const testFile = args[1];
    const steps = getAllStepsForTest(testFile);
    console.log(JSON.stringify({ steps }, null, 2));
  } else if (command === 'analyze' && args[1]) {
    // Full analysis with log content and debug dir
    const testFile = args[1];
    const errorMessage = args[2] || '';
    const logFile = args[3];
    const debugDir = args[4];  // Optional: path to debug output directory
    let logContent = '';
    if (logFile && fs.existsSync(logFile)) {
      logContent = fs.readFileSync(logFile, 'utf8');
    }
    const location = findFailureLocation(testFile, errorMessage, logContent);
    
    // Parse executed screens from debug output (only executed, screen names only)
    const testName = path.basename(testFile, '.yaml');
    location.executedScreens = parseExecutedScreensFromDebug(debugDir, testName);
    
    console.log(JSON.stringify(location, null, 2));
  } else if (args.length >= 2) {
    // Legacy mode: just file and error message
    const testFile = args[0];
    const errorMessage = args.slice(1).join(' ');
    const location = findFailureLocation(testFile, errorMessage);
    console.log(JSON.stringify(location));
  } else {
    console.log('Usage:');
    console.log('  parseFailureLocation.js <test-file> <error-message>');
    console.log('  parseFailureLocation.js steps <test-file>');
    console.log('  parseFailureLocation.js analyze <test-file> <error-message> [log-file] [debug-dir]');
    console.log('');
    console.log('Examples:');
    console.log('  parseFailureLocation.js tests/Account/test_auth.yaml "Element not found: Account"');
    console.log('  parseFailureLocation.js steps tests/Account/test_auth.yaml');
    console.log('  parseFailureLocation.js analyze tests/Account/test_auth.yaml "Element not found" test.log debug-output/');
    process.exit(1);
  }
}

module.exports = {
  findFailureLocation,
  extractFailureTarget,
  detectAppFailure,
  getAllStepsForTest,
  parseExecutedStepsFromLog,
  parseExecutedScreensFromDebug,
  formatFlowChain,
  buildFlowChain
};
