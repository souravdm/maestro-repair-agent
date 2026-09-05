'use strict';

const express = require('express');
const path = require('path');
const { promises: fs } = require('fs');
const yaml = require('js-yaml');

// Docs-based registries for accurate test generation
const { getScreenObjectsForArea, formatScreenObjectsForPrompt, resolveElement } = require('../scripts/utils/dashboard/docs-screen-registry');
const { getSubflowsForArea, getSubflowsForAction, formatSubflowsForPrompt } = require('../scripts/utils/dashboard/docs-subflow-registry');
const { generateOnFlowStart, generateTags, getTestUserForScenario, requiresAuth } = require('../scripts/utils/dashboard/docs-testdata-registry');
const { enhanceHumanSteps } = require('../scripts/utils/dashboard/enhance-steps');
const { OllamaClient } = require('../scripts/utils/dashboard/ollama-client');

const app = express();
const PORT = process.env.PORT || 3004;
const PROJECT_ROOT = path.resolve(__dirname, '..');
const MAESTRO_ROOT = path.join(PROJECT_ROOT, '.maestro');
const TESTDATA_DIR = path.join(MAESTRO_ROOT, 'testdata');
const ollama = new OllamaClient();

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ─── File Scanner ─────────────────────────────────────────────────────────────

async function walkDir(dir, ext) {
  const results = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('.')) {
        results.push(...await walkDir(full, ext));
      } else if (entry.isFile() && (!ext || entry.name.endsWith(ext)) && !entry.name.startsWith('.')) {
        results.push(full);
      }
    }
  } catch (_) {}
  return results;
}

function safeParseYamlHeader(content) {
  const lines = content.split('\n');
  const sepIdx = lines.findIndex(l => l.trimEnd() === '---');
  const headerLines = (sepIdx >= 0 ? lines.slice(0, sepIdx) : lines)
    .filter(l => !l.trimStart().startsWith('#'));
  try { return yaml.load(headerLines.join('\n')) || {}; } catch { return {}; }
}

async function scanFlows() {
  const flowsDir = path.join(MAESTRO_ROOT, 'flows');
  const files = await walkDir(flowsDir, '.yaml');
  const flows = [];
  const SKIP_DIRS = new Set(['suites']);
  for (const file of files) {
    const rel = path.relative(flowsDir, file);
    const parts = rel.split(path.sep);
    if (parts.some(p => SKIP_DIRS.has(p))) continue;
    
    try {
      const content = await fs.readFile(file, 'utf8');
      const header = safeParseYamlHeader(content);
      const feature = parts[0] || 'General';
      flows.push({
        file: rel,
        feature,
        name: header.name || path.basename(file, '.yaml'),
        description: header.description || '',
        screens: header.screens || [],
        tags: header.tags || [],
        path: file,
        type: 'flow'
      });
    } catch (_) {}
  }
  return flows;
}

async function scanSubflows() {
  const subflowsDir = path.join(MAESTRO_ROOT, 'subflows');
  const subflows = [];
  
  try {
    const files = await walkDir(subflowsDir, '.yaml');
    for (const file of files) {
      const rel = path.relative(subflowsDir, file);
      const parts = rel.split(path.sep);
      const feature = parts[0] || 'Common';
      
      try {
        const content = await fs.readFile(file, 'utf8');
        const header = safeParseYamlHeader(content);
        subflows.push({
          file: rel,
          feature,
          name: header.name || path.basename(file, '.yaml'),
          description: header.description || '',
          screens: header.screens || [],
          tags: header.tags || [],
          path: file,
          type: 'subflow'
        });
      } catch (_) {}
    }
  } catch (_) {}
  
  return subflows;
}

async function scanScreens() {
  const screensDir = path.join(MAESTRO_ROOT, 'screens');
  const screens = [];
  
  try {
    const files = await walkDir(screensDir, '.js');
    for (const file of files) {
      const rel = path.relative(screensDir, file);
      const parts = rel.split(path.sep);
      const feature = parts[0] || 'Common';
      
      try {
        const content = await fs.readFile(file, 'utf8');
        screens.push({
          file: rel,
          feature,
          name: path.basename(file, '.js'),
          path: file,
          type: 'screen'
        });
      } catch (_) {}
    }
  } catch (_) {}
  
  return screens;
}

async function scanTestdata() {
  const testdataDir = path.join(MAESTRO_ROOT, 'testdata');
  const testdata = [];
  
  try {
    const files = await walkDir(testdataDir);
    for (const file of files) {
      const rel = path.relative(testdataDir, file);
      const stats = await fs.stat(file);
      
      testdata.push({
        file: rel,
        path: file,
        size: stats.size,
        modified: stats.mtime,
        type: 'testdata'
      });
    }
  } catch (_) {}
  
  return testdata.sort((a, b) => b.modified - a.modified);
}

async function scanConfig() {
  const configDir = path.join(MAESTRO_ROOT, 'config');
  const configs = [];
  
  try {
    const files = await walkDir(configDir);
    for (const file of files) {
      const rel = path.relative(configDir, file);
      const stats = await fs.stat(file);
      
      configs.push({
        file: rel,
        path: file,
        size: stats.size,
        modified: stats.mtime,
        type: 'config'
      });
    }
  } catch (_) {}
  
  return configs;
}

async function parseTestReport(reportPath) {
  try {
    if (reportPath.endsWith('.json')) {
      const content = await fs.readFile(reportPath, 'utf8');
      const data = JSON.parse(content);
      
      if (data.summary) {
        // Enhanced test data with detailed failure information
        const enhancedTests = (data.tests || []).map(test => ({
          name: test.name || 'Unknown Test',
          file: test.file || '',
          status: test.status || 'unknown',
          duration: test.duration || 0,
          error: test.error || null,
          screen: extractScreenFromTest(test),
          feature: extractFeatureFromTest(test)
        }));
        
        return {
          total: data.summary.total || 0,
          passed: data.summary.passed || 0,
          failed: data.summary.failed || 0,
          suite: data.suite || 'unknown',
          platform: data.platform || 'unknown',
          timestamp: data.timestamp || 'unknown',
          tests: enhancedTests
        };
      }
    }
  } catch (_) {}
  
  return null;
}

function extractScreenFromTest(test) {
  // Extract screen information from test name or file path
  if (test.file) {
    const parts = test.file.split('/');
    if (parts.length >= 3) {
      return `${parts[parts.length - 2]} > ${parts[parts.length - 1].replace('.yaml', '')}`;
    }
  }
  return 'Unknown Screen';
}

function extractFeatureFromTest(test) {
  // Extract feature from file path
  if (test.file) {
    const parts = test.file.split('/');
    for (const part of parts) {
      if (['Account', 'Home', 'Pharmacy', 'Benefits', 'Shop', 'Health', 'MCCore', 'NGS', 'Chatbot', 'VM'].includes(part)) {
        return part;
      }
    }
  }
  return 'General';
}

function formatTestReportTable(testData) {
  if (!testData || testData.tests.length === 0) {
    return 'No test data available';
  }
  
  const failedTests = testData.tests.filter(test => test.status === 'failed');
  const passedTests = testData.tests.filter(test => test.status === 'passed');
  
  let table = `\n**📊 Test Execution Summary**\n\n`;
  table += `**Run:** ${testData.suite} (${testData.platform}) - ${testData.timestamp}\n`;
  table += `**Results:** ${testData.total} tests | ✅ ${testData.passed} passed | ❌ ${testData.failed} failed\n\n`;
  
  if (failedTests.length > 0) {
    table += `**❌ Failed Tests (${failedTests.length})**\n\n`;
    table += `| Test Name | Screen | Duration | Feature |\n`;
    table += `|-----------|--------|----------|---------|\n`;
    
    failedTests.forEach((test, index) => {
      const duration = test.duration ? `${test.duration.toFixed(2)}s` : 'N/A';
      const screen = test.screen || 'Unknown';
      const feature = test.feature || 'General';
      table += `| ${test.name} | ${screen} | ${duration} | ${feature} |\n`;
    });
    
    table += `\n**📋 Failure Details**\n\n`;
    failedTests.forEach((test, index) => {
      table += `**${index + 1}. ${test.name}**\n`;
      table += `• **Screen:** ${test.screen}\n`;
      table += `• **Feature:** ${test.feature}\n`;
      table += `• **Duration:** ${test.duration ? test.duration.toFixed(2) + 's' : 'N/A'}\n`;
      if (test.error) {
        table += `• **Error:** ${test.error}\n`;
      }
      table += `\n`;
    });
  }
  
  if (passedTests.length > 0) {
    table += `**✅ Passed Tests (${passedTests.length})**\n\n`;
    table += `| Test Name | Screen | Duration | Feature |\n`;
    table += `|-----------|--------|----------|---------|\n`;
    
    passedTests.slice(0, 10).forEach(test => {
      const duration = test.duration ? `${test.duration.toFixed(2)}s` : 'N/A';
      const screen = test.screen || 'Unknown';
      const feature = test.feature || 'General';
      table += `| ${test.name} | ${screen} | ${duration} | ${feature} |\n`;
    });
    
    if (passedTests.length > 10) {
      table += `| ... | ... | ... | ... |\n`;
      table += `| *${passedTests.length - 10} more passed tests* | | | |\n`;
    }
  }
  
  return table;
}

async function scanTestReports() {
  const reportsDir = path.join(PROJECT_ROOT, 'test-reports');
  const reports = [];
  
  try {
    // First find all suite-results.json files
    const jsonFiles = await walkDir(reportsDir, '.json');
    
    for (const jsonFile of jsonFiles) {
      if (jsonFile.includes('suite-results.json')) {
        const rel = path.relative(reportsDir, jsonFile);
        const stats = await fs.stat(jsonFile);
        const reportData = await parseTestReport(jsonFile);
        
        if (reportData) {
          reports.push({
            file: rel,
            path: jsonFile,
            modified: stats.mtime,
            size: stats.size,
            data: reportData
          });
        }
      }
    }
  } catch (_) {}
  
  return reports.sort((a, b) => b.modified - a.modified);
}

async function scanArtifacts() {
  const artifactsDir = path.join(PROJECT_ROOT, 'artifacts');
  const artifacts = [];
  
  try {
    const files = await walkDir(artifactsDir);
    for (const file of files) {
      const rel = path.relative(artifactsDir, file);
      const stats = await fs.stat(file);
      artifacts.push({
        file: rel,
        path: file,
        modified: stats.mtime,
        size: stats.size
      });
    }
  } catch (_) {}
  
  return artifacts.sort((a, b) => b.modified - a.modified);
}

async function getScriptBuilderErrors() {
  // This would typically come from the dashboard's script builder state
  // For now, we'll return a placeholder that could be enhanced
  const errors = [];
  
  try {
    // Check for common error patterns in script builder logs
    const logsDir = path.join(PROJECT_ROOT, 'logs');
    if (fs.existsSync(logsDir)) {
      const logFiles = await walkDir(logsDir, '.log');
      for (const logFile of logFiles) {
        try {
          const content = await fs.readFile(logFile, 'utf8');
          const lines = content.split('\n');
          
          for (const line of lines) {
            if (line.includes('ERROR') || line.includes('Syntax error') || line.includes('Validation failed')) {
              errors.push({
                file: path.basename(logFile),
                message: line.trim(),
                timestamp: new Date().toISOString()
              });
            }
          }
        } catch (_) {}
      }
    }
  } catch (_) {}
  
  return errors.slice(0, 20); // Limit to most recent 20 errors
}

async function getGraph() {
  const flows = await scanFlows();
  const subflows = await scanSubflows();
  const screens = await scanScreens();
  const testdata = await scanTestdata();
  const configs = await scanConfig();
  const testReports = await scanTestReports();
  const artifacts = await scanArtifacts();
  const scriptErrors = await getScriptBuilderErrors();
  
  const features = ['Account', 'Home', 'Pharmacy', 'Benefits', 'Shop', 'Health', 'MCCore', 'NGS', 'Chatbot', 'VM', 'General'];
  const featureColors = {
    Account: '#4A90D9', Home: '#E8A838', Pharmacy: '#9B59B6', Benefits: '#27AE60',
    Shop: '#E74C3C', Health: '#16A085', MCCore: '#8E44AD', NGS: '#D35400',
    Chatbot: '#2980B9', VM: '#1ABC9C', General: '#7F8C8D'
  };
  const featureClusters = {
    Account: '#051510', Home: '#1A0F00', Pharmacy: '#150615', Benefits: '#051510',
    Shop: '#150A05', Health: '#051510', MCCore: '#120820', NGS: '#1E0A00',
    Chatbot: '#061218', VM: '#041410', General: '#161616'
  };

  const nodes = [], edges = [], screenNodes = {};
  let nodeId = 0;
  const nodeIdMap = {};

  function nid(feature, screen) {
    const key = `${feature}/${screen}`;
    if (!nodeIdMap[key]) {
      nodeIdMap[key] = ++nodeId;
      nodes.push({
        id: nodeIdMap[key],
        label: screen,
        feature,
        color: featureColors[feature] || '#7F8C8D',
        cluster: featureClusters[feature] || '#161616'
      });
    }
    return nodeIdMap[key];
  }

  // Add nodes for each flow
  for (const flow of flows) {
    const flowId = nid(flow.feature, flow.name);
    screenNodes[flowId] = { flow, file: flow.file };
  }

  // Add edges based on common patterns (simplified for standalone chat)
  edges.push(
    { from: nid('Home', 'Auth Home'), to: nid('Shop', 'Product Search'), label: 'Shop tab' },
    { from: nid('Home', 'Auth Home'), to: nid('Health', 'Health Dashboard'), label: 'Health' },
    { from: nid('Home', 'Auth Home'), to: nid('MCCore', 'Find Care'), label: 'Find Care' },
    { from: nid('Home', 'Auth Home'), to: nid('Chatbot', 'Chat Interface'), label: 'Chat' },
    { from: nid('Home', 'Auth Home'), to: nid('VM', 'Visit Setup'), label: 'Virtual Visit' }
  );

  return { 
    nodes, 
    edges, 
    screens: screenNodes, 
    flows, 
    subflows,
    screenObjects: screens,
    testdata,
    configs,
    testReports,
    artifacts,
    scriptErrors,
    _anbaGaps: [] 
  };
}

// ─── Ollama Integration (via shared OllamaClient) ────────────────────────────

async function listOllamaModels() {
  const { available, models } = await ollama.isAvailable();
  return available ? models : null;
}

async function ollamaChat(messages, model) {
  return ollama.chat(messages, { model });
}

function buildSystemPrompt(graph) {
  const totalScreens = Object.keys(graph.screens).length;
  const featureCounts = {};
  for (const feature of ['Account', 'Home', 'Pharmacy', 'Benefits', 'Shop', 'Health', 'MCCore', 'NGS', 'Chatbot', 'VM', 'General']) {
    featureCounts[feature] = graph.nodes.filter(n => n.feature === feature).length;
  }
  const coverage = Object.entries(featureCounts).map(([f, c]) => `${f}: ${c}`).join(', ');
  
  // Get real test data from recent reports
  const latestReport = graph.testReports[0];
  let testSummary = 'No recent test reports';
  if (latestReport && latestReport.data) {
    const data = latestReport.data;
    testSummary = `Latest: ${data.suite} (${data.platform}) - ${data.total} tests (${data.passed} passed, ${data.failed} failed)`;
  }
  
  // Maestro context summary
  const maestroContext = {
    flows: graph.flows.length,
    subflows: graph.subflows.length,
    screens: graph.screenObjects.length,
    testdata: graph.testdata.length,
    configs: graph.configs.length
  };
  
  const recentReports = graph.testReports.slice(0, 3).map(r => r.file).join(', ') || 'none';
  const recentArtifacts = graph.artifacts.slice(0, 5).map(a => a.file).join(', ') || 'none';
  const errorCount = graph.scriptErrors.length;

  return `You are an expert CVS Pharmacy mobile app test automation assistant helping with Maestro UI test coverage analysis and troubleshooting.

COMPLETE MAESTRO CONTEXT:
- Test flows: ${maestroContext.flows} end-to-end test scenarios
- Subflows: ${maestroContext.subflows} reusable test components  
- Screen objects: ${maestroContext.screens} page object model definitions
- Test data: ${maestroContext.testdata} test data files and fixtures
- Config files: ${maestroContext.configs} configuration and environment files

CURRENT STATE:
- Total screens with tests: ${totalScreens}
- Coverage by feature: ${coverage}
- Available features: Account, Home, Pharmacy, Benefits, Shop, Health, MCCore, NGS, Chatbot, VM, General
- Test execution summary: ${testSummary}
- Recent test reports: ${recentReports}
- Recent artifacts: ${recentArtifacts}
- Script builder errors: ${errorCount} active errors

ADDITIONAL CONTEXT:
- Test flows (.maestro/flows/) contain end-to-end test scenarios organized by feature
- Subflows (.maestro/subflows/) contain reusable test components like authentication and navigation
- Screen objects (.maestro/screens/) contain page object model definitions for UI elements
- Test data (.maestro/testdata/) contains test data files and fixtures for dynamic testing
- Config files (.maestro/config/) contain environment configurations and build settings
- Test reports folder contains HTML/JSON reports from test executions with real test data
- Artifacts folder contains screenshots, logs, and other test artifacts
- Script builder errors show validation issues in test scripts

RESPONSE GUIDELINES:
- Be concise and actionable
- Use REAL test data from reports - never make up numbers
- Reference specific flows, subflows, and screen objects when helpful
- Focus on test coverage gaps and recommendations
- Suggest prioritized test additions using existing subflows
- Help troubleshoot script errors and test failures
- Analyze test reports and artifacts for insights
- Keep responses under 150 words when possible

COMMON QUESTIONS:
- Coverage gaps: Identify features with 0-1 tests
- Recommendations: Suggest high-impact test flows
- Test generation: Recommend which screens need tests most
- Subflow usage: How to reuse existing test components
- Screen objects: Which UI elements are available
- Error analysis: Help fix script builder errors
- Report analysis: Interpret actual test results and artifacts

IMPORTANT: Always use real test data from reports. If no recent reports exist, say so clearly.

When suggesting tests, prioritize: Login flows, Core user journeys, Error handling, Edge cases`;
}

async function fallbackChat(message, graph) {
  const m = message.toLowerCase();
  
  // Get real test data for accurate responses
  const latestReport = graph.testReports[0];
  let testInfo = 'No recent test reports available';
  if (latestReport && latestReport.data) {
    const data = latestReport.data;
    testInfo = `Recent test execution: ${data.total} tests (${data.passed} passed, ${data.failed} failed) from ${data.suite} suite`;
  }
  
  // Maestro context summary
  const maestroContext = {
    flows: graph.flows.length,
    subflows: graph.subflows.length,
    screens: graph.screenObjects.length,
    testdata: graph.testdata.length,
    configs: graph.configs.length
  };
  
  if (m.includes('gap') || m.includes('uncovered') || m.includes('missing')) {
    return `Based on current analysis, you have ${maestroContext.flows} test flows. Focus on adding tests for core user journeys like login, prescription management, and checkout flows. Use existing subflows (${maestroContext.subflows} available) to accelerate development.`;
  }
  if (m.includes('generate') || m.includes('create') || m.includes('write')) {
    return `I can help you identify which screens need test coverage. You have ${maestroContext.screens} screen objects available and ${maestroContext.subflows} reusable components. Look for screens with minimal or no test coverage and prioritize high-impact user flows.`;
  }
  if (m.includes('recommend') || m.includes('priority')) {
    return `Priority recommendations: 1) Complete login/authentication flows 2) Prescription management 3) Checkout process 4) Profile management 5) Search functionality. You have ${maestroContext.subflows} subflows available for reuse.`;
  }
  if (m.includes('error') || m.includes('script') || m.includes('validation')) {
    return 'For script errors, check the Script Builder for validation badges (red/yellow). Common issues include missing required fields, incorrect syntax, or invalid element selectors. Use existing screen objects for reliable element references.';
  }
  if (m.includes('report') || m.includes('artifact') || m.includes('test result')) {
    const latestReport = graph.testReports[0];
    if (latestReport && latestReport.data) {
      return formatTestReportTable(latestReport.data);
    }
    return `${testInfo}. Check the test-reports folder for detailed HTML/JSON reports and artifacts folder for screenshots and logs. You have ${maestroContext.testdata} test data files available.`;
  }
  if (m.includes('how many') || m.includes('test count') || m.includes('number of tests')) {
    return testInfo;
  }
  if (m.includes('subflow') || m.includes('reusable') || m.includes('component')) {
    return `You have ${maestroContext.subflows} subflows available for reuse. These include authentication, navigation, and common test patterns. Use runFlow with subflows to avoid duplicating test logic.`;
  }
  if (m.includes('screen object') || m.includes('element') || m.includes('selector')) {
    return `You have ${maestroContext.screens} screen objects available. These contain reliable UI element selectors organized by feature. Reference screen objects in your flows for maintainable element references.`;
  }
  if (m.includes('test data') || m.includes('fixture') || m.includes('dynamic')) {
    return `You have ${maestroContext.testdata} test data files available. Use these for dynamic test data instead of hardcoded values. Test data supports multiple environments and user scenarios.`;
  }
  
  return `I can help you with:
- **Coverage analysis**: "What screens have no tests?"
- **Recommendations**: "What should I prioritize?"
- **Test guidance**: "How to test [specific feature]"
- **Subflow usage**: "How to reuse test components"
- **Screen objects**: "Which UI elements are available"
- **Test data**: "How to use dynamic test data"
- **Error analysis**: "Help with script builder errors"
- **Report analysis**: "Interpret test reports and artifacts"

Current status: ${testInfo}
Maestro context: ${maestroContext.flows} flows, ${maestroContext.subflows} subflows, ${maestroContext.screens} screen objects`;
}

// ─── API Endpoints ─────────────────────────────────────────────────────────────

app.get('/api/ollama/status', async (req, res) => {
  const models = await listOllamaModels();
  res.json({ available: models !== null, models: models || [], defaultModel: ollama.defaultModel });
});

app.post('/api/chat', async (req, res) => {
  const { message, history = [], model } = req.body;
  if (!message) return res.status(400).json({ error: 'message required' });

  try {
    const graph = await getGraph();
    const systemPrompt = buildSystemPrompt(graph);
    const models = await listOllamaModels();

    if (models) {
      const selectedModel = model || ollama.resolveModel(models) || models[0];
      const messages = [
        { role: 'system', content: systemPrompt },
        ...history.slice(-6),
        { role: 'user', content: message },
      ];
      try {
        const reply = await ollamaChat(messages, selectedModel);
        return res.json({ reply, source: 'ollama', model: selectedModel });
      } catch (e) {
        console.warn('Ollama chat failed, falling back:', e.message);
      }
    }

    // Fallback response with real data
    const reply = await fallbackChat(message, graph);
    return res.json({ reply, source: 'fallback', model: null });

  } catch (e) {
    console.error('Chat error:', e);
    res.status(500).json({ error: 'Chat service unavailable' });
  }
});

app.get('/api/graph', async (req, res) => {
  try {
    const graph = await getGraph();
    res.json(graph);
  } catch (e) {
    res.status(500).json({ error: 'Failed to load graph data' });
  }
});

app.get('/api/context', async (req, res) => {
  try {
    const graph = await getGraph();
    const context = {
      testReports: {
        count: graph.testReports.length,
        recent: graph.testReports.slice(0, 10),
        totalSize: graph.testReports.reduce((sum, r) => sum + r.size, 0)
      },
      artifacts: {
        count: graph.artifacts.length,
        recent: graph.artifacts.slice(0, 10),
        totalSize: graph.artifacts.reduce((sum, a) => sum + a.size, 0)
      },
      scriptErrors: {
        count: graph.scriptErrors.length,
        recent: graph.scriptErrors.slice(0, 10)
      }
    };
    res.json(context);
  } catch (e) {
    res.status(500).json({ error: 'Failed to load context data' });
  }
});

// Serve the main chat interface
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Debug endpoint to test docs context
app.get('/api/debug-docs', async (req, res) => {
  try {
    const area = req.query.area || 'Home';
    const graph = await getGraph();
    const docsContext = await getDocsContext(area);
    
    res.json({
      success: true,
      area,
      docsLength: docsContext.length,
      docsPreview: docsContext.substring(0, 1000) + '...',
      graphStats: {
        flows: graph.flows.length,
        subflows: graph.subflows.length,
        screens: graph.screenObjects.length
      }
    });
  } catch (e) {
    res.status(500).json({
      success: false,
      error: e.message
    });
  }
});

// Debug endpoint to test full prompt
app.get('/api/debug-prompt', async (req, res) => {
  try {
    const area = req.query.area || 'Home';
    const graph = await getGraph();
    const systemPrompt = await buildMaestroTestGenerationPrompt(graph, area);
    
    res.json({
      success: true,
      area,
      systemPromptLength: systemPrompt.length,
      systemPromptPreview: systemPrompt.substring(0, 2000) + '...',
      fullSystemPrompt: systemPrompt
    });
  } catch (e) {
    res.status(500).json({
      success: false,
      error: e.message
    });
  }
});

// Clean up YAML output by removing comments and formatting
function cleanYamlOutput(yamlContent) {
  if (!yamlContent) return yamlContent;
  
  let cleaned = yamlContent;
  
  // Remove all inline comments
  cleaned = cleaned.replace(/\s*#.*$/gm, '');
  
  // Remove standalone comment lines
  cleaned = cleaned.replace(/^\s*#.*$/gm, '');
  
  // Remove multiple --- separators (keep only first one)
  const lines = cleaned.split('\n').filter(line => line.trim() !== '');
  let firstSeparatorFound = false;
  const cleanedLines = lines.map(line => {
    if (line.trim() === '---') {
      if (!firstSeparatorFound) {
        firstSeparatorFound = true;
        return line;
      }
      return ''; // Remove additional separators
    }
    return line;
  }).filter(line => line.trim() !== '');
  
  // Remove excessive empty lines
  const finalLines = [];
  let previousLineEmpty = false;
  for (const line of cleanedLines) {
    const isEmpty = line.trim() === '';
    if (!isEmpty || !previousLineEmpty) {
      finalLines.push(line);
    }
    previousLineEmpty = isEmpty;
  }
  
  return finalLines.join('\n').trim();
}

// Test generation endpoint
app.post('/api/generate-test', async (req, res) => {
  const { testId, functionalArea, testScenario, notes, testSteps } = req.body;
  
  try {
    // Use enhanced template-based generation with docs registries
    const yaml = await generateMaestroTestFromTemplate({ testId, functionalArea, testScenario, notes, testSteps });
    const cleanedYaml = cleanYamlOutput(yaml);
    return res.json({ yaml: cleanedYaml, source: 'template', model: null });

    // AI-based generation (commented out due to verbose output issues)
    // const graph = await getGraph();
    // const systemPrompt = await buildMaestroTestGenerationPrompt(graph);
    // const prompt = `Generate a complete Maestro YAML test file based on the following test case:
    // 
    // Test Case #: ${testId}
    // Functional Area: ${functionalArea}
    // Test Scenario: ${testScenario}
    // Notes: ${notes}
    // Test Steps:
    // ${testSteps}
    // 
    // Please generate a complete, executable Maestro YAML test file that includes:
    // 1. Proper appId header
    // 2. Clear comments describing the test
    // 3. Launch app with clearState
    // 4. All necessary Maestro commands (tapOn, assertVisible, inputText, etc.)
    // 5. Proper error handling and assertions
    // 6. Realistic wait times where needed
    // 
    // Use the existing Maestro flows and screen objects as reference for proper syntax and element selectors.
    // 
    // Return ONLY the YAML content, no explanations or markdown formatting.`;

  } catch (e) {
    console.error('Test generation error:', e);
    res.status(500).json({ error: 'Failed to generate test' });
  }
});

// Hybrid test generation endpoint - enhanced steps + reliable template with streaming logs
app.post('/api/generate-enhanced-test', async (req, res) => {
  const { testId, functionalArea, testScenario, notes, testSteps } = req.body;
  
  try {
    // Use hybrid approach (enhanced steps + reliable template)
    const { HybridTestGenerator } = require('../scripts/utils/dashboard/hybrid-test-generator');
    const generator = new HybridTestGenerator();
    
    // Don't create output path - only display in UI
    
    const result = await generator.generateTestWithRetry({
      testId,
      functionalArea,
      testScenario,
      notes,
      testSteps
      // Remove outputPath to prevent automatic file saving
    });
    
    // Debug: Log the exact response being sent
    console.log('🔍 DEBUG: Server - Preparing API response');
    console.log('🔍 DEBUG: Server - result.yaml exists:', !!result.yaml);
    console.log('🔍 DEBUG: Server - result.yaml type:', typeof result.yaml);
    console.log('🔍 DEBUG: Server - result.yaml length:', result.yaml ? result.yaml.length : 'undefined');
    console.log('🔍 DEBUG: Server - result.yaml constructor:', result.yaml ? result.yaml.constructor.name : 'undefined');
    console.log('🔍 DEBUG: Server - result.yaml content:');
    console.log('--- SERVER YAML START ---');
    console.log(result.yaml);
    console.log('--- SERVER YAML END ---');
    
    const responseData = {
      yaml: result.yaml,
      source: 'hybrid',
      model: null,
      validation: result.validation,
      resolutions: result.resolutions,
      steps: result.steps,
      success: result.success,
      errors: result.errors,
      logs: result.logs || []
    };
    
    console.log('🔍 DEBUG: Server - Complete response object:');
    console.log('--- SERVER RESPONSE START ---');
    console.log(JSON.stringify(responseData, null, 2));
    console.log('--- SERVER RESPONSE END ---');
    console.log('🔍 DEBUG: Server - Sending response to frontend');
    
    return res.json(responseData);
    
  } catch (e) {
    console.error('Hybrid test generation error:', e);
    res.status(500).json({ error: 'Failed to generate hybrid test', details: e.message });
  }
});

async function buildMaestroTestGenerationPrompt(graph, functionalArea) {
  // Get area-specific context from docs registries
  const area = functionalArea || 'General';
  const screenContext = await formatScreenObjectsForPrompt(area);
  const subflowContext = formatSubflowsForPrompt(area);

  return `Generate a Maestro YAML test file for the CVS Pharmacy mobile app.

RULES:
- appId: \${APP_NAME} (always, never hardcoded)
- UI elements: \${output.screenName.elementName} from screen definitions below
- Subflows: use runFlow for reusable actions
- Single --- separator after the header block (appId, tags, onFlowStart)
- FORBIDDEN properties: elementSelector, elementText, swipeGesture, textValue, elementId, tapBack, waitTime
- Valid commands: tapOn, inputText, assertVisible, assertNotVisible, runFlow, runScript, extendedWaitUntil, wait, scroll, swipe, back, hideKeyboard, takeScreenshot
- Output ONLY YAML, no explanations

EXAMPLE 1 — Guest Homescreen Smoke Test:
appId: \${APP_NAME}
tags:
  - homescreen
  - smoke
  - guest
onFlowStart:
  - runScript: ../../screens/Home/homescreenObjects.js
  - runScript: ../../screens/SearchAndNav/searchNavObjects.js
---
- runFlow: ../../subflows/common/launchApp.yaml
- tapOn: \${output.account_onboarding.letsGetStartedBtn}
- tapOn: \${output.account_signIn.continueAsGuestBtn}
- runFlow: ../../subflows/Home/homescreen_loaded_successful.yaml

EXAMPLE 2 — Authenticated Login and Logout:
appId: \${APP_NAME}
tags:
  - account
  - login
  - logout
  - positive
  - smoke
onFlowStart:
  - runScript: ../../screens/Common/CommonScreen.js
  - runScript: ../../screens/Account/accountObjects.js
---
- runFlow: ../../subflows/common/launchApp.yaml
- tapOn: \${output.account_onboarding.letsGetStartedBtn}
- runFlow: ../../subflows/account/complete_signin_and_otp_dob.yaml
- extendedWaitUntil:
    visible: \${output.account_dashboard.accountNavTitle}
    timeout: 8000
- runFlow: ../../subflows/account/logout.yaml
- extendedWaitUntil:
    visible: \${output.searchnav_header.signInBtn}
    timeout: 5000

AVAILABLE SCREEN OBJECTS FOR "${area}":
${screenContext}

AVAILABLE SUBFLOWS FOR "${area}":
${subflowContext}

OUTPUT ONLY YAML.`;
}

async function getDocsContext(functionalArea) {
  let context = '';

  try {
    // Use docs registries for structured, area-specific context
    const area = functionalArea || 'General';
    const screenContext = await formatScreenObjectsForPrompt(area);
    const subflowContext = formatSubflowsForPrompt(area);

    context += `=== SCREEN OBJECTS FOR ${area.toUpperCase()} ===\n`;
    context += screenContext;
    context += `\n=== AVAILABLE SUBFLOWS FOR ${area.toUpperCase()} ===\n`;
    context += subflowContext;
    context += '\n';

    // Add key framework rules from agents.md (concise extract)
    context += `=== CVS FRAMEWORK RULES ===\n`;
    context += `- appId: \${APP_NAME} for platform-agnostic tests\n`;
    context += `- UI elements via \${output.screenName.elementName}\n`;
    context += `- Subflows for reusable actions: ../../subflows/area/name.yaml\n`;
    context += `- Test data via runScript in onFlowStart with loginData env var\n`;
    context += `- Single --- separator after header block\n`;
    context += `- FORBIDDEN: elementSelector, elementText, swipeGesture, textValue, elementId\n`;
    context += `- Valid commands: tapOn, inputText, assertVisible, assertNotVisible, runFlow, runScript, extendedWaitUntil, wait, scroll, swipe, back, hideKeyboard\n`;
    context += '\n';

    // Read feature-specific doc if available
    const featureDocMap = {
      Home: 'features/homescreen/overview-homescreen.md',
      Homescreen: 'features/homescreen/overview-homescreen.md',
      Benefits: 'features/benefits.md',
      Search: 'features/search_navigation.md',
      SearchNav: 'features/search_navigation.md',
      H100: '../h100.md'
    };

    const docFile = featureDocMap[area];
    if (docFile) {
      const docPath = path.join(PROJECT_ROOT, 'docs', 'maestro', docFile);
      try {
        const content = await fs.readFile(docPath, 'utf8');
        // Extract test coverage matrix and business rules (last ~60 lines of useful content)
        const lines = content.split('\n');
        const testMatrixIdx = lines.findIndex(l => l.includes('Test Coverage Matrix'));
        if (testMatrixIdx >= 0) {
          const matrixContent = lines.slice(testMatrixIdx, testMatrixIdx + 40).join('\n');
          context += `=== ${area.toUpperCase()} TEST COVERAGE MATRIX ===\n${matrixContent}\n\n`;
        }
      } catch (_) {}
    }

    console.log(`📄 Generated docs context for "${area}": ${context.length} characters`);
  } catch (e) {
    console.log('❌ Documentation context error:', e.message);
    context += 'Documentation context not available\n';
  }

  return context;
}

async function getComprehensiveFlowExamples() {
  const homeFlowsDir = path.join(MAESTRO_ROOT, 'flows', 'Home');
  let examples = '';
  
  try {
    const homeFlowFiles = await walkDir(homeFlowsDir, '.yaml');
    console.log(`Found ${homeFlowFiles.length} Home flow files`);
    
    // Get all Home flow examples (limit to first 5 to keep context focused)
    const homeExamples = [];
    for (const file of homeFlowFiles) {
      if (homeExamples.length >= 5) break; // Limit to 5 examples
      
      const relativePath = path.relative(MAESTRO_ROOT, file);
      
      try {
        const content = await fs.readFile(file, 'utf8');
        const lines = content.split('\n').slice(0, 25); // First 25 lines
        homeExamples.push({
          path: relativePath,
          content: lines.join('\n')
        });
        console.log(`✅ Added Home flow example: ${relativePath}`);
      } catch (e) {
        console.log(`❌ Error reading Home flow ${relativePath}:`, e.message);
      }
    }
    
    // Format examples
    examples += `\n=== HOME FLOW EXAMPLES (CVS Pharmacy Project) ===\n`;
    for (const example of homeExamples) {
      examples += `\n--- ${example.path} ---\n${example.content}\n`;
    }
    
    if (homeExamples.length === 0) {
      examples += '\nNo Home flow examples found\n';
    }
    
  } catch (e) {
    console.log('❌ Home flows directory error:', e.message);
    examples += 'Home flows directory not accessible\n';
  }
  
  console.log(`📄 Generated Home flow examples: ${examples.length} characters`);
  return examples;
}

async function getComprehensiveScreenExamples() {
  const screensDir = path.join(MAESTRO_ROOT, 'screens');
  let examples = '';
  
  try {
    const screenFiles = await walkDir(screensDir, '.yaml');
    
    // Get examples from different screen areas
    const screenExamples = {};
    for (const file of screenFiles) {
      const relativePath = path.relative(MAESTRO_ROOT, file);
      const parts = relativePath.split('/');
      const area = parts[1]; // screens/Area/file.yaml
      
      if (!screenExamples[area]) {
        screenExamples[area] = [];
      }
      
      if (screenExamples[area].length < 1) { // 1 example per area
        try {
          const content = await fs.readFile(file, 'utf8');
          const lines = content.split('\n').slice(0, 15); // First 15 lines
          screenExamples[area].push({
            path: relativePath,
            content: lines.join('\n')
          });
        } catch (e) {
          // Skip if can't read
        }
      }
    }
    
    // Format examples
    for (const [area, areaExamples] of Object.entries(screenExamples)) {
      examples += `\n=== ${area} Screen Objects ===\n`;
      for (const example of areaExamples) {
        examples += `\n--- ${example.path} ---\n${example.content}\n`;
      }
    }
  } catch (e) {
    examples += 'Screens directory not accessible\n';
  }
  
  return examples;
}

async function getSubflowExamples() {
  const subflowsDir = path.join(MAESTRO_ROOT, 'subflows');
  let examples = '';
  
  try {
    const subflowFiles = await walkDir(subflowsDir, '.yaml');
    
    // Get key subflow examples
    const keySubflows = [
      'common/launchApp.yaml',
      'account/complete_signin_and_otp_dob.yaml',
      'homescreen/homescreen_loaded_successful.yaml'
    ];
    
    for (const file of subflowFiles) {
      const relativePath = path.relative(MAESTRO_ROOT, file);
      
      if (keySubflows.some(key => relativePath.includes(key))) {
        try {
          const content = await fs.readFile(file, 'utf8');
          const lines = content.split('\n').slice(0, 15); // First 15 lines
          examples += `\n--- ${relativePath} ---\n${lines.join('\n')}\n`;
        } catch (e) {
          // Skip if can't read
        }
      }
    }
  } catch (e) {
    examples += 'Subflows directory not accessible\n';
  }
  
  return examples;
}

async function getConfigExamples() {
  const configDir = path.join(MAESTRO_ROOT, 'config');
  let examples = '';
  
  try {
    const configFiles = await walkDir(configDir, '.yaml');
    
    for (const file of configFiles) {
      const relativePath = path.relative(MAESTRO_ROOT, file);
      
      try {
        const content = await fs.readFile(file, 'utf8');
        const lines = content.split('\n').slice(0, 10); // First 10 lines
        examples += `\n--- ${relativePath} ---\n${lines.join('\n')}\n`;
      } catch (e) {
        // Skip if can't read
      }
    }
  } catch (e) {
    examples += 'Config directory not accessible\n';
  }
  
  return examples;
}

async function generateMaestroTestFromTemplate({ testId, functionalArea, testScenario, notes, testSteps }) {
  const feature = extractFeatureFromArea(functionalArea);
  const tags = generateTags(functionalArea, testScenario);
  const onFlowStart = generateOnFlowStart(functionalArea, testScenario, testSteps);

  // Use the enhanced step interpreter from the docs registries
  const enhancedSteps = await enhanceHumanSteps(testSteps, functionalArea);

  // Build YAML lines
  const lines = [];
  lines.push('appId: ${APP_NAME}');
  lines.push('tags:');
  for (const tag of tags) {
    lines.push(`  - ${tag}`);
  }
  lines.push(onFlowStart);
  lines.push('---');

  // Convert enhanced steps to YAML commands
  for (const step of enhancedSteps) {
    if (step.action === 'extendedWaitUntil') {
      lines.push('- extendedWaitUntil:');
      lines.push(`    visible: ${step.target}`);
      lines.push(`    timeout: ${step.timeout || 8000}`);
    } else if (step.action === 'wait') {
      lines.push(`- wait: ${step.target}`);
    } else if (step.action === 'scroll') {
      lines.push('- scroll');
    } else if (step.action === 'back') {
      lines.push('- back');
    } else if (step.action === 'hideKeyboard') {
      lines.push('- hideKeyboard');
    } else if (step.action === 'swipe') {
      lines.push(`- swipe: ${step.target}`);
    } else if (step.target === '') {
      lines.push(`- ${step.action}`);
    } else {
      lines.push(`- ${step.action}: ${step.target}`);
    }
  }

  return lines.join('\n');
}

function extractFeatureFromArea(area) {
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

// Subflow confidence checking endpoint
app.post('/api/check-subflow-confidence', async (req, res) => {
  const { steps } = req.body;
  
  if (!steps || !Array.isArray(steps)) {
    return res.status(400).json({ error: 'steps array required' });
  }
  
  try {
    const { SubflowMatcher } = require('../scripts/utils/dashboard/subflow-matcher');
    const matcher = new SubflowMatcher();
    
    const result = await matcher.findSubflowForSteps(steps);
    res.json(result);
  } catch (error) {
    console.error('Error checking subflow confidence:', error);
    res.status(500).json({ error: 'Failed to check subflow confidence', details: error.message });
  }
});

// Screen object confidence checking endpoint
app.post('/api/check-screen-object-confidence', async (req, res) => {
  const { yaml } = req.body;
  
  if (!yaml || typeof yaml !== 'string') {
    return res.status(400).json({ error: 'yaml content required' });
  }
  
  try {
    const { ScreenObjectMatcher } = require('../scripts/utils/dashboard/screen-object-matcher');
    const matcher = new ScreenObjectMatcher();
    
    const result = await matcher.resolvePlaceholders(yaml);
    res.json(result);
  } catch (error) {
    console.error('Error checking screen object confidence:', error);
    res.status(500).json({ error: 'Failed to check screen object confidence', details: error.message });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', port: PORT });
});

app.listen(PORT, () => {
  console.log(`🤖 CVS Chat Bot running on http://localhost:${PORT}`);
  console.log(`📡 Ollama URL: ${ollama.url}`);
  console.log(`🧠 Default Model: ${ollama.defaultModel}`);
  console.log(`📊 Health check available at http://localhost:${PORT}/health`);
});
