// Chat Bot Panel Functions
function toggleChatPanel() {
  const panel = document.getElementById('chat-side-panel');
  const overlay = document.getElementById('chat-panel-overlay');
  
  if (panel.classList.contains('open')) {
    closeChatPanel();
  } else {
    openChatPanel();
  }
}

function openChatPanel() {
  const panel = document.getElementById('chat-side-panel');
  const overlay = document.getElementById('chat-panel-overlay');
  const fab = document.getElementById('chat-bot-fab');
  
  panel.classList.add('open');
  overlay.classList.add('open');
  fab.style.visibility = 'hidden';
  
  // Focus the iframe when panel opens
  setTimeout(() => {
    const iframe = document.getElementById('chat-iframe');
    if (iframe) {
      iframe.focus();
    }
  }, 300);
}

function closeChatPanel() {
  const panel = document.getElementById('chat-side-panel');
  const overlay = document.getElementById('chat-panel-overlay');
  const fab = document.getElementById('chat-bot-fab');
  
  panel.classList.remove('open');
  overlay.classList.remove('open');
  fab.style.visibility = 'visible';
}

// Close panel on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeChatPanel();
  }
});

// Check if chat bot server is running and update badge
async function checkChatBotStatus() {
  try {
    const response = await fetch('http://localhost:3004/api/ollama/status');
    const data = await response.json();
    const badge = document.querySelector('#chat-bot-fab .badge');
    
    if (data.available && data.models.length > 0) {
      badge.style.background = 'var(--green)';
      badge.textContent = 'AI';
    } else {
      badge.style.background = 'var(--yellow)';
      badge.textContent = '⚠';
    }
  } catch (e) {
    const badge = document.querySelector('#chat-bot-fab .badge');
    badge.style.background = 'var(--text-dim)';
    badge.textContent = '○';
  }
}

// Check status periodically
checkChatBotStatus();
setInterval(checkChatBotStatus, 30000); // Check every 30 seconds

// ── Test Generator Functions ──
let currentGeneratedTest = '';
let currentTestData = {};

// ── Output Tab Switching ──
function switchOutputTab(tab, context) {
  const isTestGenerator = context === 'test-generator';
  const isMain = context === 'main';
  
  // Get the parent container
  const parentSelector = isTestGenerator ? '#test-generator-output-section' : '#output-section-main';
  const parent = document.querySelector(parentSelector);
  if (!parent) return;
  
  // Update tab active states
  parent.querySelectorAll('.output-tab').forEach(t => t.classList.remove('output-tab-active'));
  tab.classList.add('output-tab-active');
  
  // Show/hide content
  const tabName = tab.dataset.tab;
  if (isTestGenerator) {
    document.getElementById('test-generator-input-tab').style.display = tabName === 'input' ? 'block' : 'none';
    document.getElementById('test-generator-yaml-tab').style.display = tabName === 'yaml' ? 'block' : 'none';
  } else if (isMain) {
    document.getElementById('main-input-tab').style.display = tabName === 'input' ? 'block' : 'none';
    document.getElementById('main-yaml-tab').style.display = tabName === 'yaml' ? 'block' : 'none';
  }
}

// ── Re-generate Test Functions ──
function regenerateTest() {
  if (!currentTestData || !currentTestData.testId) {
    alert('No test data available. Please generate a test first.');
    return;
  }
  console.log('🔄 Regenerating test with current form data...');
  generateMaestroTest();
}

function regenerateTestMain() {
  console.log('🔄 Regenerating test with current form data...');
  generateMaestroTestMain();
}

// ── Populate Input Display ──
function populateInputDisplay(testData, targetId) {
  const display = document.getElementById(targetId);
  if (!display || !testData) return;
  
  const inputText = `Test Case #: ${testData.testId || 'N/A'}
Functional Area: ${testData.functionalArea || 'N/A'}
Test Scenario: ${testData.testScenario || 'N/A'}
Notes: ${testData.notes || 'N/A'}

Test Steps:
${testData.testSteps || 'N/A'}

Mode: ${testData.mode || 'template'}`;
  
  display.textContent = inputText;
}

function switchChatTab(tab) {
  // Update tab buttons
  document.querySelectorAll('.chat-tab').forEach(t => t.classList.remove('active'));
  document.getElementById(`${tab}-tab`).classList.add('active');
  
  // Update tab content
  document.querySelectorAll('.chat-tab-content').forEach(c => c.style.display = 'none');
  document.getElementById(`${tab}-content`).style.display = 'block';
  
  // If switching to generator tab, focus on file input
  if (tab === 'generator') {
    document.getElementById('excel-file').addEventListener('change', handleFileSelect);
  }
}

function handleFileSelect(event) {
  const file = event.target.files[0];
  if (file) {
    const fileInfo = document.getElementById('file-info');
    fileInfo.textContent = `Selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
    
    // Show test input section
    document.getElementById('test-input-section').style.display = 'block';
    
    // Parse Excel file (simplified for now - just show manual input)
    parseExcelFile(file);
  }
}

async function parseExcelFile(file) {
  // For now, we'll just enable manual input
  // In a full implementation, you'd use a library like xlsx to parse the Excel file
  console.log('Excel file selected:', file.name);
  // TODO: Implement Excel parsing logic
}

function generateMaestroTest() {
  const testData = {
    testId: document.getElementById('test-id').value,
    functionalArea: document.getElementById('functional-area').value,
    testScenario: document.getElementById('test-scenario').value,
    notes: document.getElementById('test-notes').value,
    testSteps: document.getElementById('test-steps').value
  };
  
  if (!testData.testId || !testData.testScenario || !testData.testSteps) {
    alert('Please fill in Test Case #, Test Scenario, and Test Steps');
    return;
  }
  
  currentTestData = testData;
  
  // Populate the input display tab
  populateInputDisplay(testData, 'test-generator-input-display');
  
  // Call the chat bot API to generate the Maestro test using MAIN WINDOW function
  generateTestWithAIMain(testData);
}

async function generateTestWithAI(testData) {
  console.log('🔍 DEBUG: generateTestWithAI called - SIDE PANEL FUNCTION');
  // Pre-validate test data to prevent common issues
  const validationResult = validateTestDataBeforeGeneration(testData);
  if (!validationResult.valid) {
    alert('Test data validation failed:\n\n' + validationResult.errors.join('\n'));
    return;
  }
  
  try {
    const response = await fetch('http://localhost:3004/api/generate-enhanced-test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testData)
    });
    
    if (response.ok) {
      const result = await response.json();
      currentGeneratedTest = result.yaml;
      
      // Display in main window with enhanced logging only
      displayGeneratedTestWithLogging(result);
    } else {
      // Fallback to basic template generation
      const yaml = generateBasicMaestroTest(testData);
      currentGeneratedTest = yaml;
      displayGeneratedTestWithLogging({ yaml, source: 'template', validation: { isValid: true } });
    }
  } catch (error) {
    console.error('Error generating test:', error);
    // Fallback to basic template generation
    const yaml = generateBasicMaestroTest(testData);
    currentGeneratedTest = yaml;
    displayGeneratedTestWithLogging({ yaml, source: 'template', validation: { isValid: true }, errors: [error.message] });
  }
}

function generateBasicMaestroTest(testData) {
  const feature = extractFeatureFromTestData(testData);
  const steps = parseTestSteps(testData.testSteps);
  
  return `appId: \${APP_ID}
---
# ${testData.testId} - ${testData.testScenario}
# Functional Area: ${testData.functionalArea}
# Notes: ${testData.notes}

# Launch app and clear state
- launchApp:
    appId: \${APP_ID}
    clearState: true

# Test Steps
${steps.map((step, index) => `- # Step ${index + 1}: ${step.description}
${step.commands.map(cmd => `  - ${cmd}`).join('\n')}`).join('\n')}`;
}

function extractFeatureFromTestData(testData) {
  const area = testData.functionalArea.toLowerCase();
  if (area.includes('home')) return 'Home';
  if (area.includes('shop')) return 'Shop';
  if (area.includes('pharmacy')) return 'Pharmacy';
  if (area.includes('account')) return 'Account';
  if (area.includes('benefits')) return 'Benefits';
  if (area.includes('health')) return 'Health';
  return 'General';
}




// Test function for debugging display issues
function testDisplayFunction() {
  console.log('🔍 DEBUG: Testing display function with mock data - SIMPLE APPROACH');
  
  // Simple direct test - use the same approach as main display
  const outputSection = document.getElementById('test-generator-output-section');
  const generatedOutput = document.getElementById('test-generator-output');
  
  console.log('🔍 DEBUG: Simple test - Test Generator elements found:', {
    outputSection: !!outputSection,
    generatedOutput: !!generatedOutput
  });
  
  if (outputSection && generatedOutput) {
    console.log('🔍 DEBUG: Simple test - Setting up Test Generator display');
    
    // Show Test Generator output section
    outputSection.style.display = 'block';
    console.log('🔍 DEBUG: Simple test - Test Generator output section shown');
    
    // Set simple test content directly
    const testYaml = `# Generated Test Summary:
# • Source: test
# • Validation: ✅ Passed
# • Elements Resolved: 1/1
# • Steps Generated: 7
# --- Generated Maestro Test ---
appId: \${APP_ID}
tags:
  - account
  - hybrid
  - generated
onFlowStart:
  - runScript: ../../screens/Common/CommonScreen.js
  - runScript: ../../screens/Account/accountObjects.js
---
- runFlow: ../../subflows/common/launchApp.yaml
- tapOn: output.account_onboarding.letsGetStartedBtn
- inputText: "user@example.com"
- inputText: "password123"
- runFlow: ../../subflows/account/complete_signin_and_otp_dob.yaml
- assertVisible: \${output.common.successIndicator}`;
    
    // Set content directly using innerHTML with pre tag
    generatedOutput.innerHTML = `<pre style="background: #1e1e1e; color: #d4d4d4; padding: 20px; border-radius: 8px; font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace; font-size: 12px; line-height: 1.6; white-space: pre-wrap; word-wrap: break-word; margin: 0; overflow-x: auto;">${testYaml}</pre>`;
    
    console.log('🔍 DEBUG: Simple test - YAML set directly, length:', testYaml.length);
    console.log('🔍 DEBUG: Simple test - Complete!');
  } else {
    console.error('❌ Simple test - Required elements not found');
  }
}

function displayGeneratedTestWithLogging(result) {
  console.log('🔍 DEBUG: displayGeneratedTestWithLogging called - REVERTING TO WORKING LOGIC');
  
  try {
    // Use the Test Generator output section
    const outputSection = document.getElementById('test-generator-output-section');
    const generatedOutput = document.getElementById('test-generator-output');
    
    console.log('🔍 DEBUG: Test Generator elements found:', {
      outputSection: !!outputSection,
      generatedOutput: !!generatedOutput,
      outputSectionId: outputSection ? outputSection.id : 'not found',
      generatedOutputId: generatedOutput ? generatedOutput.id : 'not found',
      outputSectionDisplay: outputSection ? outputSection.style.display : 'not found',
      generatedOutputDisplay: generatedOutput ? generatedOutput.style.display : 'not found'
    });
    
    // Show Test Generator right panel and output section
    const testGeneratorPanel = document.getElementById('test-generator-panel');
    if (testGeneratorPanel) {
      testGeneratorPanel.style.display = 'flex';
      console.log('🔍 DEBUG: Test Generator right panel shown');
    }
    
    if (outputSection) {
      outputSection.style.display = 'block';
      console.log('🔍 DEBUG: Test Generator output section shown');
    }
    
    // Set the YAML content using the original working approach
    if (generatedOutput && result.yaml) {
      console.log('🔍 DEBUG: Setting YAML content using textContent (original working method)');
      console.log('🔍 DEBUG: YAML content length:', result.yaml.length);
      console.log('🔍 DEBUG: YAML content preview:', result.yaml.substring(0, 200));
      
      // Use textContent like the original working function
      generatedOutput.textContent = result.yaml;
      
    } else {
      console.error('❌ Missing elements or YAML content:', {
        generatedOutput: !!generatedOutput,
        yaml: !!result.yaml,
        yamlLength: result.yaml ? result.yaml.length : 0
      });
    }
    
    // Apply validation to generated test content (from original function)
    if (result.yaml) {
      const errors = countErrorsInYAML(result.yaml);
      if (errors.length > 0) {
        console.log('🔍 DEBUG: Found', errors.length, 'YAML errors, adding error indicator');
        // Add error indicator to the generated output
        if (outputSection) {
          const header = outputSection.querySelector('.section-header');
          if (header) {
            // Remove existing error indicator if any
            const existingError = header.querySelector('.error-indicator');
            if (existingError) existingError.remove();
            
            // Add error indicator
            const errorIndicator = document.createElement('span');
            errorIndicator.className = 'error-indicator';
            errorIndicator.style.cssText = 'background:#ff4444;color:white;padding:2px 6px;border-radius:3px;font-size:10px;margin-left:8px;';
            errorIndicator.textContent = `${errors.length} error${errors.length > 1 ? 's' : ''}`;
            errorIndicator.title = errors.map(e => `L${e.line}: ${e.msg}`).join('\n');
            header.appendChild(errorIndicator);
          }
        }
      } else {
        console.log('🔍 DEBUG: No YAML errors found');
        // Remove error indicator if no errors
        if (outputSection) {
          const header = outputSection.querySelector('.section-header');
          if (header) {
            const existingError = header.querySelector('.error-indicator');
            if (existingError) existingError.remove();
          }
        }
      }
      
      console.log('🔍 DEBUG: YAML display completed successfully using original method');
    } else {
      console.error('❌ Generated output element not found or no YAML content');
      console.error('❌ generatedOutput found:', !!generatedOutput);
      console.error('❌ result.yaml found:', !!result.yaml);
    }
    
    // Handle error state
  if (!result.success || (result.errors && result.errors.length > 0)) {
    console.log('🔍 DEBUG: Handling error state');
    
    // Show error in output section as comments
    const errorMessage = result.errors ? result.errors.join('\n') : 'Unknown error occurred';
    const errorContent = `# ❌ Test Generation Failed
# 
# ${errorMessage}
# 
# Please check the console for more details and try again.
#
# --- Generation Details ---
# • Source: ${result.source || 'unknown'}
# • Validation: ${result.validation?.isValid ? '✅ Passed' : '❌ Failed'}
# • Elements Resolved: ${result.resolutions?.resolvedCount || 0}/${result.resolutions?.totalPlaceholders || 0}
# • Steps Generated: ${result.steps?.length || 0}
#
${result.validation?.errors?.length > 0 ? '# ⚠️ Validation Errors:\n' + result.validation.errors.map(e => `# • ${e}`).join('\n') + '\n' : ''}
${result.resolutions?.resolutions?.length > 0 ? '# 🔍 Element Resolutions:\n' + result.resolutions.resolutions.map(r => `# • ${r.original} → ${r.replacement} (${r.confidence}%)`).join('\n') + '\n' : ''}
#
# --- Generated YAML (with errors) ---
${result.yaml || '# No YAML generated due to errors'}
`;
      
    if (generatedOutput) {
      generatedOutput.innerHTML = `<pre style="background: #1e1e1e; color: #d4d4d4; padding: 20px; border-radius: 8px; font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace; font-size: 12px; line-height: 1.6; white-space: pre-wrap; word-wrap: break-word; margin: 0; overflow-x: auto;">${errorContent}</pre>`;
    }
    return;
  }
  
  console.log('🔍 DEBUG: Test Generator display completed successfully');
  console.log('🔍 DEBUG: ========== DISPLAY FUNCTION COMPLETED SUCCESSFULLY ==========');
    
  } catch (error) {
    console.error('❌ Error in displayGeneratedTestWithLogging:', error);
    console.error('❌ Error details:', error.message, error.stack);
    console.log('🔍 DEBUG: ========== DISPLAY FUNCTION FAILED WITH ERROR ==========');
    
    // Show error message in output section
    const errorContent = `# ❌ Display Error
# 
# ${error.message}
# 
# Stack trace:
# ${error.stack}
# 
# Please refresh the page and try again.
`;
    
    if (generatedOutput) {
      generatedOutput.innerHTML = `<pre style="background: #1e1e1e; color: #d4d4d4; padding: 20px; border-radius: 8px; font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace; font-size: 12px; line-height: 1.6; white-space: pre-wrap; word-wrap: break-word; margin: 0; overflow-x: auto;">${errorContent}</pre>`;
    }
  }
}

function parseTestSteps(stepsText) {
  const lines = stepsText.split('\n').filter(line => line.trim());
  return lines.map(line => {
    const stepNum = line.match(/^\d+\./) ? line.replace(/^\d+\.\s*/, '') : line;
    return {
      description: stepNum,
      commands: generateCommandsFromStep(stepNum)
    };
  });
}

function generateCommandsFromStep(stepDescription) {
  const commands = [];
  const desc = stepDescription.toLowerCase();
  
  if (desc.includes('continue') && desc.includes('onboarding')) {
    commands.push('tapOn: "Continue"');
    commands.push('tapOn: "Continue"');
    commands.push('tapOn: "Maybe Later"');
  }
  
  if (desc.includes('sign in') || desc.includes('login')) {
    commands.push('assertVisible: "Sign In"');
  }
  
  if (desc.includes('notifications') || desc.includes('messages')) {
    commands.push('assertVisible: "Notifications"');
    commands.push('assertVisible: "Messages"');
  }
  
  if (desc.includes('cart')) {
    commands.push('assertVisible: "Cart"');
  }
  
  if (desc.includes('search')) {
    commands.push('assertVisible: "Search"');
    if (desc.includes('bar')) {
      commands.push('assertVisible: "Search bar"');
    }
    if (desc.includes('barcode')) {
      commands.push('assertVisible: "Barcode scanner"');
    }
    if (desc.includes('voice')) {
      commands.push('assertVisible: "Voice search"');
    }
  }
  
  if (commands.length === 0) {
    commands.push('# TODO: Add specific assertions for this step');
  }
  
  return commands;
}

function displayGeneratedTest(yaml) {
  console.log('🔍 DEBUG: displayGeneratedTest called - REDIRECTED TO MAIN WINDOW');
  // Always redirect to main window display since side panel section is removed
  displayGeneratedTestWithLogging({ yaml, source: 'redirected', validation: { isValid: true } });
  
  // Apply validation to generated test content
  const errors = countErrorsInYAML(yaml);
  if (errors.length > 0) {
    // Add error indicator to the generated output
    const outputSection = document.getElementById('output-section');
    const header = outputSection.querySelector('.section-header');
    if (header) {
      // Remove existing error indicator if any
      const existingError = header.querySelector('.error-indicator');
      if (existingError) existingError.remove();
      
      // Add error indicator
      const errorIndicator = document.createElement('span');
      errorIndicator.className = 'error-indicator';
      errorIndicator.style.cssText = 'background:#ff4444;color:white;padding:2px 6px;border-radius:3px;font-size:10px;margin-left:8px;';
      errorIndicator.textContent = `${errors.length} error${errors.length > 1 ? 's' : ''}`;
      errorIndicator.title = errors.map(e => `L${e.line}: ${e.msg}`).join('\n');
      header.appendChild(errorIndicator);
    }
  } else {
    // Remove error indicator if no errors
    const outputSection = document.getElementById('output-section');
    const header = outputSection.querySelector('.section-header');
    if (header) {
      const existingError = header.querySelector('.error-indicator');
      if (existingError) existingError.remove();
    }
  }
}

function previewGeneratedTest() {
  if (!currentGeneratedTest) {
    alert('Please generate a test first');
    return;
  }
  displayGeneratedTest(currentGeneratedTest);
}

function copyGeneratedTest() {
  if (!currentGeneratedTest) {
    alert('No test to copy');
    return;
  }
  
  navigator.clipboard.writeText(currentGeneratedTest).then(() => {
    alert('Test copied to clipboard!');
  }).catch(err => {
    console.error('Failed to copy:', err);
    alert('Failed to copy to clipboard');
  });
}

function saveGeneratedTest() {
  if (!currentGeneratedTest || !currentTestData.testId) {
    alert('No test to save');
    return;
  }
  
  const filename = `${currentTestData.testId.replace(/[^a-zA-Z0-9.-]/g, '_')}.yaml`;
  
  // Send to server to save
  fetch('/api/save-test', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      filename: filename,
      content: currentGeneratedTest,
      feature: extractFeatureFromTestData(currentTestData)
    })
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      alert(`Test saved to: ${data.path}`);
    } else {
      alert('Failed to save test: ' + data.error);
    }
  })
  .catch(error => {
    console.error('Error saving test:', error);
    alert('Failed to save test');
  });
}

function downloadGeneratedTest() {
  if (!currentGeneratedTest || !currentTestData.testId) {
    alert('No test to download');
    return;
  }
  
  const filename = `${currentTestData.testId.replace(/[^a-zA-Z0-9.-]/g, '_')}.yaml`;
  const blob = new Blob([currentGeneratedTest], { type: 'text/yaml' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Process Monitoring Functions ──
let currentProcesses = [];
let staleProcesses = [];

async function loadProcesses() {
  try {
    const response = await fetch('/api/processes');
    const data = await response.json();
    
    currentProcesses = data.processes || [];
    staleProcesses = data.staleProcesses || [];
    
    updateProcessUI(data);
    
  } catch (error) {
    console.error('Error loading processes:', error);
    document.getElementById('process-list').innerHTML = 
      '<div class="text-dim text-sm" style="text-align:center;padding:20px;">Error loading processes</div>';
  }
}

function updateProcessUI(data) {
  const processCount = document.getElementById('process-count');
  const processList = document.getElementById('process-list');
  
  // Update count
  processCount.textContent = data.staleCount;
  processCount.style.background = data.staleCount > 0 ? 'var(--cvs-red)' : 'var(--green)';
  
  if (data.total === 0) {
    processList.innerHTML = '<div class="text-dim text-sm" style="text-align:center;padding:20px;">No processes found</div>';
    return;
  }
  
  // Build process list HTML
  let html = '';
  
  // Show stale processes first
  if (data.staleProcesses.length > 0) {
    html += '<div style="margin-bottom:12px;">';
    html += '<div style="font-size:12px;font-weight:600;color:var(--cvs-red);margin-bottom:4px;">🚨 Stale Processes</div>';
    
    data.staleProcesses.forEach(process => {
      html += createProcessItem(process, true);
    });
    
    html += '</div>';
  }
  
  // Show active processes
  const activeProcesses = data.processes.filter(p => 
    !data.staleProcesses.some(sp => sp.pid === p.pid)
  );
  
  if (activeProcesses.length > 0) {
    html += '<div>';
    html += '<div style="font-size:12px;font-weight:600;color:var(--green);margin-bottom:4px;">✅ Active Processes</div>';
    
    activeProcesses.forEach(process => {
      html += createProcessItem(process, false);
    });
    
    html += '</div>';
  }
  
  processList.innerHTML = html;
}

function createProcessItem(process, isStale) {
  const statusColor = isStale ? 'var(--cvs-red)' : 'var(--green)';
  const statusIcon = isStale ? '🚨' : '✅';
  const memoryMB = process.memory ? process.memory.toFixed(1) : '0';
  
  return `
    <div class="process-item" style="border:1px solid ${isStale ? 'rgba(198,40,40,0.3)' : 'rgba(46,125,50,0.3)'};border-radius:6px;padding:8px;margin-bottom:6px;background:${isStale ? 'rgba(198,40,40,0.05)' : 'rgba(46,125,50,0.05)'};">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
        <div style="display:flex;align-items:center;gap:6px;">
          <span style="font-size:10px;color:${statusColor};">${statusIcon}</span>
          <span style="font-size:11px;font-weight:600;">PID: ${process.pid}</span>
          <span style="font-size:10px;color:var(--text-dim);">CPU: ${process.cpu}%</span>
          <span style="font-size:10px;color:var(--text-dim);">MEM: ${memoryMB}MB</span>
        </div>
        ${isStale ? `<button class="btn btn-ghost" style="padding:2px 6px;font-size:10px;" onclick="killProcess(${process.pid})">Kill</button>` : ''}
      </div>
      <div style="font-size:10px;color:var(--text-dim);font-family:monospace;word-break:break-all;">${process.command.substring(0, 80)}${process.command.length > 80 ? '...' : ''}</div>
      ${isStale ? `<div style="font-size:9px;color:${statusColor};margin-top:2px;">Reason: ${process.reason}</div>` : ''}
    </div>
  `;
}

async function killProcess(pid) {
  if (!confirm(`Are you sure you want to kill process ${pid}?`)) {
    return;
  }
  
  try {
    const response = await fetch('/api/processes/cleanup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ pids: [pid] })
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log(`Process ${pid} killed successfully`);
      // Refresh process list
      setTimeout(loadProcesses, 1000);
    } else {
      alert('Failed to kill process: ' + data.error);
    }
    
  } catch (error) {
    console.error('Error killing process:', error);
    alert('Error killing process: ' + error.message);
  }
}

async function cleanupAllProcesses() {
  if (!confirm('Are you sure you want to clean up all stale processes? This will terminate multiple processes.')) {
    return;
  }
  
  try {
    const response = await fetch('/api/processes/cleanup-all', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const data = await response.json();
    
    if (data.success) {
      console.log('Cleanup completed:', data.output);
      alert('Process cleanup completed successfully!');
      // Refresh process list
      setTimeout(loadProcesses, 2000);
    } else {
      alert('Failed to cleanup processes: ' + data.error);
    }
    
  } catch (error) {
    console.error('Error cleaning up processes:', error);
    alert('Error cleaning up processes: ' + error.message);
  }
}

// Auto-refresh process list every 30 seconds
setInterval(() => {
  // Only refresh if the setup tab is active
  const setupTab = document.querySelector('[data-tab="setup"]');
  if (setupTab && setupTab.classList.contains('active')) {
    loadProcesses();
  }
}, 30000);

// ── Main Test Generator Functions ──
let currentGeneratedTestMain = '';
let currentTestDataMain = {};

// Initialize main test generator
document.addEventListener('DOMContentLoaded', () => {
  const excelFileMain = document.getElementById('excel-file-main');
  if (excelFileMain) {
    excelFileMain.addEventListener('change', handleFileSelectMain);
  }
});

function handleFileSelectMain(event) {
  const file = event.target.files[0];
  if (file) {
    const fileInfo = document.getElementById('file-info-main');
    fileInfo.textContent = `Selected: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
    
    // Show test input section
    document.getElementById('test-input-section-main').style.display = 'block';
    
    // Parse Excel file (simplified for now - just show manual input)
    parseExcelFileMain(file);
  }
}

async function parseExcelFileMain(file) {
  console.log('📊 Parsing Excel file:', file.name);

  // Show loading state immediately
  const section = document.getElementById('excel-parsed-section');
  const container = document.getElementById('parsed-rows-container');
  const countEl = document.getElementById('parsed-row-count');
  section.style.display = 'block';
  countEl.textContent = '';
  container.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;gap:10px;padding:28px 12px;">
      <div class="parse-spinner" style="width:28px;height:28px;border:3px solid var(--bg4);border-top-color:var(--cvs-red);border-radius:50%;animation:spin .7s linear infinite;"></div>
      <div style="font-size:12px;color:var(--text-dim);font-weight:500;">Parsing ${escapeHtml(file.name)}...</div>
      <div style="font-size:11px;color:var(--text-muted);">Reading spreadsheet &amp; mapping columns</div>
    </div>
    <style>@keyframes spin{to{transform:rotate(360deg)}}</style>`;

  const reader = new FileReader();
  reader.onload = async function(e) {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      if (!rawRows.length) {
        document.getElementById('file-info-main').textContent = 'No rows found in file.';
        container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-dim);font-size:12px;">No data rows found in spreadsheet.</div>';
        countEl.textContent = '(0 rows)';
        return;
      }

      // Update loading message while Ollama maps columns
      container.querySelector('div > div:last-of-type').textContent = 'Mapping columns with AI...';

      // Try Ollama to intelligently map columns
      const headers = Object.keys(rawRows[0]);
      let columnMap = null;
      try {
        columnMap = await mapColumnsWithOllama(headers);
      } catch (err) {
        console.warn('Ollama column mapping unavailable, using heuristic:', err.message);
      }
      if (!columnMap) {
        columnMap = mapColumnsHeuristic(headers);
      }
      console.log('📊 Column mapping:', columnMap);

      // Transform rows using the column map
      const parsedRows = rawRows.map((row, idx) => ({
        _index: idx,
        testId: String(row[columnMap.testId] || `TC-${idx + 1}`).trim(),
        module: String(row[columnMap.module] || '').trim(),
        functionalArea: String(row[columnMap.functionalArea] || '').trim(),
        testScenario: String(row[columnMap.testScenario] || '').trim(),
        testSteps: String(row[columnMap.testSteps] || '').trim(),
        testData: String(row[columnMap.testData] || '').trim(),
      })).filter(r => r.testScenario || r.testSteps);

      window._batchParsedRows = parsedRows;
      window._batchGeneratedTests = [];
      displayParsedRows(parsedRows);
    } catch (err) {
      console.error('Excel parse error:', err);
      document.getElementById('file-info-main').textContent = 'Error parsing file: ' + err.message;
      container.innerHTML = `<div style="padding:20px;text-align:center;color:var(--cvs-red);font-size:12px;">
        <div style="font-size:20px;margin-bottom:6px;">⚠️</div>
        Failed to parse file: ${escapeHtml(err.message)}
      </div>`;
      countEl.textContent = '';
    }
  };
  reader.readAsArrayBuffer(file);
}

function resetGenerateButton() {
  const generateBtn = document.getElementById('generate-test-btn');
  if (generateBtn) {
    generateBtn.disabled = false;
    generateBtn.innerHTML = '🚀 Generate Test';
    generateBtn.style.opacity = '1';
    generateBtn.style.cursor = 'pointer';
  }
}

// Enhanced client-side validation functions
async function performClientSideValidation(result) {
  console.log('🔍 Performing client-side validation');
  
  const validation = {
    subflowConfidence: {},
    screenObjectConfidence: {},
    invalidPlaceholders: [],
    suggestions: []
  };
  
  // Step 1: Check subflow confidence for groups of steps
  if (result.steps && result.steps.length > 0) {
    validation.subflowConfidence = await checkSubflowConfidence(result.steps);
  }
  
  // Step 2: Check screen object confidence for individual selectors
  if (result.yaml) {
    validation.screenObjectConfidence = await checkScreenObjectConfidence(result.yaml);
    validation.invalidPlaceholders = findInvalidPlaceholders(result.yaml);
  }
  
  console.log('✅ Client-side validation completed');
  return validation;
}

async function checkSubflowConfidence(steps) {
  console.log('🔍 Checking subflow confidence for', steps.length, 'steps');
  
  try {
    const response = await fetch('http://localhost:3004/api/check-subflow-confidence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ steps })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Subflow confidence check completed');
      return result;
    }
  } catch (error) {
    console.error('❌ Error checking subflow confidence:', error);
  }
  
  return {};
}

async function checkScreenObjectConfidence(yamlContent) {
  console.log('🔍 Checking screen object confidence');
  
  try {
    const response = await fetch('http://localhost:3004/api/check-screen-object-confidence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ yaml: yamlContent })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Screen object confidence check completed');
      return result;
    }
  } catch (error) {
    console.error('❌ Error checking screen object confidence:', error);
  }
  
  return {};
}

function findInvalidPlaceholders(yamlContent) {
  const invalidPlaceholders = [];
  
  // Find {{ELEMENT:...}} placeholders
  const elementMatches = yamlContent.match(/\{\{ELEMENT:[^}]+\}\}/g) || [];
  elementMatches.forEach(match => {
    invalidPlaceholders.push({
      type: 'element',
      placeholder: match,
      suggestion: match.replace(/\{\{ELEMENT:([^}]+)\}\}/, '"$1"')
    });
  });
  
  // Find other potential issues
  const invalidProps = ['elementSelector', 'elementText', 'swipeGesture', 'textValue', 'elementId'];
  invalidProps.forEach(prop => {
    if (yamlContent.includes(prop)) {
      invalidPlaceholders.push({
        type: 'property',
        placeholder: prop,
        suggestion: 'Remove this invalid property'
      });
    }
  });
  
  return invalidPlaceholders;
}

async function applyValidationFixes(result, validation) {
  console.log('🔍 Applying validation fixes');
  
  let enhancedYaml = result.yaml || '';
  const fixes = [];
  
  // Fix 1: Replace invalid element placeholders
  validation.invalidPlaceholders.forEach(issue => {
    if (issue.type === 'element') {
      enhancedYaml = enhancedYaml.replace(issue.placeholder, issue.suggestion);
      fixes.push(`Fixed invalid placeholder: ${issue.placeholder} → ${issue.suggestion}`);
    }
  });
  
  // Fix 2: Replace string selectors with screen objects if confidence is high
  if (validation.screenObjectConfidence && validation.screenObjectConfidence.resolutions) {
    validation.screenObjectConfidence.resolutions.forEach(resolution => {
      if (resolution.confidence >= 70 && resolution.matchedElement) {
        enhancedYaml = enhancedYaml.replace(resolution.original, resolution.replacement);
        fixes.push(`Upgraded selector: ${resolution.selector} → ${resolution.matchedElement.fullPath} (${resolution.confidence}% confidence)`);
      }
    });
  }
  
  // Fix 3: Suggest subflow usage if confidence is high
  if (validation.subflowConfidence && validation.subflowConfidence.bestMatch) {
    const bestMatch = validation.subflowConfidence.bestMatch;
    if (bestMatch.confidence >= 80) {
      fixes.push(`Consider using subflow: ${bestMatch.subflow.path} (${bestMatch.confidence}% confidence - ${bestMatch.matchReason})`);
    }
  }
  
  console.log(`✅ Applied ${fixes.length} fixes`);
  fixes.forEach(fix => console.log(`  - ${fix}`));
  
  return {
    ...result,
    yaml: enhancedYaml,
    clientValidation: validation,
    fixes: fixes
  };
}

function generateMaestroTestMain() {
  const generateBtn = document.getElementById('generate-test-btn');
  const modeSelect = document.getElementById('generation-mode');
  
  const testData = {
    testId: document.getElementById('test-id-main').value,
    functionalArea: document.getElementById('functional-area-main').value,
    testScenario: document.getElementById('test-scenario-main').value,
    notes: document.getElementById('test-notes-main').value,
    testSteps: document.getElementById('test-steps-main').value,
    mode: modeSelect ? modeSelect.value : 'hybrid'
  };
  
  if (!testData.testId || !testData.testScenario || !testData.testSteps) {
    alert('Please fill in Test Case #, Test Scenario, and Test Steps');
    return;
  }
  
  // Set loading state
  generateBtn.disabled = true;
  const modeLabel = { hybrid: '🔀 Hybrid', template: '📝 Template', llm: '🤖 Llama 3.2' }[testData.mode] || '🔀 Hybrid';
  generateBtn.innerHTML = `⏳ Generating (${modeLabel})...`;
  generateBtn.style.opacity = '0.7';
  generateBtn.style.cursor = 'not-allowed';
  
  currentTestDataMain = testData;
  
  // Populate the input display tab
  populateInputDisplay(testData, 'main-input-display');
  
  // Call the chat bot API to generate the Maestro test
  generateTestWithAIMain(testData);
}

async function generateTestWithAIMain(testData) {
  console.log(`🚀 Starting ${testData.mode || 'hybrid'} test generation`);
  
  try {
    // Step 1: Pre-validate test data to prevent common issues
    const validationResult = validateTestDataBeforeGeneration(testData);
    if (!validationResult.valid) {
      console.error('❌ Test data validation failed:', validationResult.errors);
      alert('Test data validation failed:\n\n' + validationResult.errors.join('\n'));
      resetGenerateButton();
      return;
    }
    
    console.log('🔍 Calling /api/generate-enhanced-test on dashboard server');
    
    // Try dashboard server first (port 3003), then fall back to chat-bot (port 3004)
    let response = null;
    let serverUsed = 'dashboard';
    
    try {
      response = await fetch('/api/generate-enhanced-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testData)
      });
    } catch (dashErr) {
      console.warn('⚠️ Dashboard server endpoint failed, trying chat-bot server...');
      try {
        response = await fetch('http://localhost:3004/api/generate-enhanced-test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(testData)
        });
        serverUsed = 'chat-bot';
      } catch (chatErr) {
        console.error('❌ Both servers unreachable');
        throw new Error('Neither dashboard nor chat-bot server is reachable');
      }
    }
    
    console.log(`🔍 API response from ${serverUsed}: status ${response.status}`);
    
    if (response.ok) {
      const result = await response.json();
      
      // Step 2: Client-side validation and confidence checking
      console.log('🔍 Starting client-side validation and confidence checking');
      const clientValidation = await performClientSideValidation(result);
      
      // Step 3: Apply fixes based on validation results
      const finalResult = await applyValidationFixes(result, clientValidation);
      
      // Step 4: Display the enhanced result
      displayGeneratedTestWithLogging(finalResult);
      resetGenerateButton();
    } else {
      console.error('❌ API response not OK:', response.status, response.statusText);
      // Fallback to basic template generation
      const yaml = generateBasicMaestroTestMain(testData);
      currentGeneratedTestMain = yaml;
      displayGeneratedTestWithLogging({ yaml, source: 'template-fallback', validation: { isValid: true } });
      
      // Reset button state
      resetGenerateButton();
    }
  } catch (error) {
    console.error('❌ Error generating test:', error);
    console.error('❌ Error details:', error.message, error.stack);
    
    // Fallback to basic template generation
    const yaml = generateBasicMaestroTestMain(testData);
    currentGeneratedTestMain = yaml;
    displayGeneratedTestWithLogging({ yaml, source: 'template-fallback', validation: { isValid: true }, errors: [error.message] });
    
    // Reset button state
    resetGenerateButton();
  }
}

function generateBasicMaestroTestMain(testData) {
  const feature = extractFeatureFromTestDataMain(testData);
  const steps = parseTestStepsMain(testData.testSteps);
  
  return `appId: \${APP_ID}
---
# ${testData.testId} - ${testData.testScenario}
# Functional Area: ${testData.functionalArea}
# Notes: ${testData.notes}

# Launch app and clear state
- launchApp:
    appId: \${APP_ID}
    clearState: true

# Test Steps
${steps.map((step, index) => `- # Step ${index + 1}: ${step.description}
${step.commands.map(cmd => `  - ${cmd}`).join('\n')}`).join('\n')}`;
}

function extractFeatureFromTestDataMain(testData) {
  const area = testData.functionalArea.toLowerCase();
  if (area.includes('home')) return 'Home';
  if (area.includes('shop')) return 'Shop';
  if (area.includes('pharmacy')) return 'Pharmacy';
  if (area.includes('account')) return 'Account';
  if (area.includes('benefits')) return 'Benefits';
  if (area.includes('health')) return 'Health';
  return 'General';
}

function parseTestStepsMain(stepsText) {
  const lines = stepsText.split('\n').filter(line => line.trim());
  return lines.map(line => {
    const stepNum = line.match(/^\d+\./) ? line.replace(/^\d+\.\s*/, '') : line;
    return {
      description: stepNum,
      commands: generateCommandsFromStepMain(stepNum)
    };
  });
}

function generateCommandsFromStepMain(stepDescription) {
  const commands = [];
  const desc = stepDescription.toLowerCase();
  
  if (desc.includes('continue') && desc.includes('onboarding')) {
    commands.push('tapOn: "Continue"');
    commands.push('tapOn: "Continue"');
    commands.push('tapOn: "Maybe Later"');
  }
  
  if (desc.includes('sign in') || desc.includes('login')) {
    commands.push('assertVisible: "Sign In"');
  }
  
  if (desc.includes('notifications') || desc.includes('messages')) {
    commands.push('assertVisible: "Notifications"');
    commands.push('assertVisible: "Messages"');
  }
  
  if (desc.includes('cart')) {
    commands.push('assertVisible: "Cart"');
  }
  
  if (desc.includes('search')) {
    commands.push('assertVisible: "Search"');
    if (desc.includes('bar')) {
      commands.push('assertVisible: "Search bar"');
    }
    if (desc.includes('barcode')) {
      commands.push('assertVisible: "Barcode scanner"');
    }
    if (desc.includes('voice')) {
      commands.push('assertVisible: "Voice search"');
    }
  }
  
  if (commands.length === 0) {
    commands.push('# TODO: Add specific assertions for this step');
  }
  
  return commands;
}

function displayGeneratedTestMain(yaml) {
  document.getElementById('output-section-main').style.display = 'block';
  document.getElementById('generated-output-main').textContent = yaml;
  
  // Apply validation to generated test content
  const errors = countErrorsInYAML(yaml);
  if (errors.length > 0) {
    // Add error indicator to the generated output
    const outputSection = document.getElementById('output-section-main');
    const header = outputSection.querySelector('.section-header');
    if (header) {
      // Remove existing error indicator if any
      const existingError = header.querySelector('.error-indicator');
      if (existingError) existingError.remove();
      
      // Add error indicator
      const errorIndicator = document.createElement('span');
      errorIndicator.className = 'error-indicator';
      errorIndicator.style.cssText = 'background:#ff4444;color:white;padding:2px 6px;border-radius:3px;font-size:10px;margin-left:8px;';
      errorIndicator.textContent = `${errors.length} error${errors.length > 1 ? 's' : ''}`;
      errorIndicator.title = errors.map(e => `L${e.line}: ${e.msg}`).join('\n');
      header.appendChild(errorIndicator);
    }
  } else {
    // Remove error indicator if no errors
    const outputSection = document.getElementById('output-section-main');
    const header = outputSection.querySelector('.section-header');
    if (header) {
      const existingError = header.querySelector('.error-indicator');
      if (existingError) existingError.remove();
    }
  }
}

function validateTestDataBeforeGeneration(testData) {
  const errors = [];
  
  // Validate test ID format
  if (testData.testId && !/^[A-Z]{2,}-\d+\.\d+\.\d+$/.test(testData.testId)) {
    errors.push('Test Case # should follow format: FEATURE-1.0.0 (e.g., HS-1.0.0, ACC-2.1.0)');
  }
  
  // Check for invalid Maestro property references in test steps
  const invalidProperties = ['elementText', 'elementId', 'textValue', 'waitForElementVisible', 'waitTime'];
  for (const prop of invalidProperties) {
    if (testData.testSteps.includes(prop)) {
      errors.push(`Invalid Maestro property '${prop}' found. Use proper Maestro syntax: - For text: tapOn: "Button Text" or \${output.screen.element} - For input: inputText: "text to input" - For waiting: wait: 3000 or extendedWaitUntil - For IDs: Use screen object references instead`);
    }
  }
  
  // Check for CSS selectors (more specific pattern matching)
  const cssSelectorPattern = /[.#][a-zA-Z][\w\-]*(?:\s*[>+~]\s*[.#][a-zA-Z][\w\-]*)*/;
  if (cssSelectorPattern.test(testData.testSteps)) {
    errors.push('CSS selectors detected. Maestro uses text-based selectors, not CSS selectors. Use: tapOn: "Button Text" or \\${output.screen.elementName}');
  }
  
  // Check for invalid command structure
  if (testData.testSteps.includes('launchApp:') && testData.testSteps.includes('- tapOn:')) {
    errors.push('Invalid YAML structure detected. Commands should start with "- " not be nested. Correct format: appId: \\${APP_ID} --- - launchApp - tapOn: "Button Text"');
  }
  
  // Check for multiple "---" separators (invalid)
  const separatorCount = (testData.testSteps.match(/---/g) || []).length;
  if (separatorCount > 1) {
    errors.push('Multiple "---" separators detected. Use only one separator after appId section.');
  }
  
  return {
    valid: errors.length === 0,
    errors: errors
  };
}

function clearTestFormMain() {
  document.getElementById('test-id-main').value = '';
  document.getElementById('functional-area-main').value = '';
  document.getElementById('test-scenario-main').value = '';
  document.getElementById('test-notes-main').value = '';
  document.getElementById('test-steps-main').value = '';
  document.getElementById('file-info-main').textContent = '';
  document.getElementById('test-generator-output-section').style.display = 'none';
  document.getElementById('test-generator-panel').style.display = 'none';
  document.getElementById('batch-tests-section').style.display = 'none';
  document.getElementById('excel-parsed-section').style.display = 'none';
  document.getElementById('excel-file-main').value = '';
  window._batchParsedRows = [];
  window._batchGeneratedTests = [];
}

function copyGeneratedTest() {
  const output = document.getElementById('test-generator-output');
  if (output && output.textContent) {
    navigator.clipboard.writeText(output.textContent).then(() => {
      alert('Test copied to clipboard!');
    }).catch(err => {
      console.error('Failed to copy:', err);
      alert('Failed to copy test');
    });
  } else {
    alert('No test to copy');
  }
}

function downloadGeneratedTest() {
  const output = document.getElementById('test-generator-output');
  if (output && output.textContent) {
    const blob = new Blob([output.textContent], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'generated-test.maestro';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } else {
    alert('No test to download');
  }
}

function loadExample(type) {
  const examples = {
    login: {
      id: 'HS-1.0.0',
      functionalArea: 'Login authentication',
      scenario: 'User login with valid credentials',
      notes: 'Verify login flow for registered users',
      steps: `1. Navigate to login screen
2. Enter valid username and password
3. Tap login button
4. Verify successful login
5. Check user profile is displayed`
    },
    search: {
      id: 'HS-2.0.0',
      functionalArea: 'Product search',
      scenario: 'Search for products using keywords',
      notes: 'Test search functionality with various filters',
      steps: `1. Tap search bar
2. Enter search keywords
3. Tap search button
4. Verify search results appear
5. Test filter options
6. Verify product details`
    },
    checkout: {
      id: 'HS-3.0.0',
      functionalArea: 'Checkout process',
      scenario: 'Complete purchase flow',
      notes: 'Test end-to-end checkout with payment',
      steps: `1. Add items to cart
2. Proceed to checkout
3. Enter shipping information
4. Select payment method
5. Complete purchase
6. Verify order confirmation`
    }
  };

  const example = examples[type];
  if (example) {
    document.getElementById('test-id-main').value = example.id;
    document.getElementById('functional-area-main').value = example.functionalArea;
    document.getElementById('test-scenario-main').value = example.scenario;
    document.getElementById('test-notes-main').value = example.notes;
    document.getElementById('test-steps-main').value = example.steps;
    
    // Show the test input section
    document.getElementById('test-input-section-main').style.display = 'block';
    
    console.log(`🔍 DEBUG: Loaded ${type} example`);
  }
}

function copyGeneratedTestMain() {
  if (!currentGeneratedTestMain) {
    alert('No test to copy');
    return;
  }
  
  navigator.clipboard.writeText(currentGeneratedTestMain).then(() => {
    alert('Test copied to clipboard!');
  }).catch(err => {
    console.error('Failed to copy:', err);
    alert('Failed to copy to clipboard');
  });
}

function saveGeneratedTestMain() {
  if (!currentGeneratedTestMain || !currentTestDataMain.testId) {
    alert('No test to save');
    return;
  }
  
  const filename = `${currentTestDataMain.testId.replace(/[^a-zA-Z0-9.-]/g, '_')}.yaml`;
  
  // Send to server to save
  fetch('/api/save-test', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      filename: filename,
      content: currentGeneratedTestMain,
      feature: extractFeatureFromTestDataMain(currentTestDataMain)
    })
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      alert(`Test saved to: ${data.path}`);
    } else {
      alert('Failed to save test: ' + data.error);
    }
  })
  .catch(error => {
    console.error('Error saving test:', error);
    alert('Failed to save test');
  });
}

function downloadGeneratedTestMain() {
  if (!currentGeneratedTestMain || !currentTestDataMain.testId) {
    alert('No test to download');
    return;
  }
  
  const filename = `${currentTestDataMain.testId.replace(/[^a-zA-Z0-9.-]/g, '_')}.yaml`;
  const blob = new Blob([currentGeneratedTestMain], { type: 'text/yaml' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function loadExample(type) {
  console.log('🔍 DEBUG: loadExample called with type:', type);
  
  const examples = {
    login: {
      testId: 'AUTH-1.0.0',
      functionalArea: 'Account Authentication',
      testScenario: 'User login with valid credentials',
      notes: 'Test successful login flow with email and password',
      testSteps: '1. Launch the app\n2. Tap on Sign In button\n3. Enter valid email address\n4. Enter valid password\n5. Tap Sign In\n6. Verify user is logged in successfully'
    },
    search: {
      testId: 'SHOP-2.1.0',
      functionalArea: 'Product Search',
      testScenario: 'Search for products using search bar',
      notes: 'Test search functionality with keyword search',
      testSteps: '1. Navigate to Shop tab\n2. Tap on search bar\n3. Enter search term "vitamin"\n4. Tap search button\n5. Verify search results are displayed\n6. Verify products match search criteria'
    },
    checkout: {
      testId: 'SHOP-3.5.0',
      functionalArea: 'Shopping Cart Checkout',
      testScenario: 'Complete checkout process for items in cart',
      notes: 'Test end-to-end checkout flow with payment',
      testSteps: '1. Add items to shopping cart\n2. Navigate to cart\n3. Review cart contents\n4. Proceed to checkout\n5. Enter shipping information\n6. Select payment method\n7. Complete purchase\n8. Verify order confirmation'
    }
  };
  
  const example = examples[type];
  console.log('🔍 DEBUG: loadExample - example found:', !!example);
  
  if (example) {
    console.log('🔍 DEBUG: loadExample - Populating form fields');
    
    try {
      const testIdField = document.getElementById('test-id-main');
      const functionalAreaField = document.getElementById('functional-area-main');
      const testScenarioField = document.getElementById('test-scenario-main');
      const testNotesField = document.getElementById('test-notes-main');
      const testStepsField = document.getElementById('test-steps-main');
      const testInputSection = document.getElementById('test-input-section-main');
      
      console.log('🔍 DEBUG: loadExample - Form elements found:', {
        testIdField: !!testIdField,
        functionalAreaField: !!functionalAreaField,
        testScenarioField: !!testScenarioField,
        testNotesField: !!testNotesField,
        testStepsField: !!testStepsField,
        testInputSection: !!testInputSection
      });
      
      if (testIdField) {
        testIdField.value = example.testId;
        console.log('🔍 DEBUG: loadExample - Set testId:', example.testId);
      }
      if (functionalAreaField) {
        functionalAreaField.value = example.functionalArea;
        console.log('🔍 DEBUG: loadExample - Set functionalArea:', example.functionalArea);
      }
      if (testScenarioField) {
        testScenarioField.value = example.testScenario;
        console.log('🔍 DEBUG: loadExample - Set testScenario:', example.testScenario);
      }
      if (testNotesField) {
        testNotesField.value = example.notes;
        console.log('🔍 DEBUG: loadExample - Set notes:', example.notes);
      }
      if (testStepsField) {
        testStepsField.value = example.testSteps;
        console.log('🔍 DEBUG: loadExample - Set testSteps length:', example.testSteps.length);
      }
      if (testInputSection) {
        testInputSection.style.display = 'block';
        console.log('🔍 DEBUG: loadExample - Showed test input section');
      }
      
      console.log('🔍 DEBUG: loadExample - Completed successfully');
    } catch (error) {
      console.error('❌ loadExample - Error:', error);
    }
  } else {
    console.error('❌ loadExample - No example found for type:', type);
  }
}

// Debug function to test subflows tab
async function testSubflowsTab() {
  console.log('Testing subflows tab functionality...');
  
  try {
    // Test API endpoint
    const response = await fetch('/api/subflow-tree');
    console.log('Subflow API response status:', response.status);
    
    if (!response.ok) {
      console.error('Subflow API failed:', response.statusText);
      return;
    }
    
    const data = await response.json();
    console.log('Subflow API data length:', data.length);
    
    // Test DOM elements
    const subflowTree = document.getElementById('subflow-tree');
    const subflowPanel = document.getElementById('builder-subflows-panel');
    
    console.log('Subflow tree element:', !!subflowTree);
    console.log('Subflow panel element:', !!subflowPanel);
    
    if (!subflowTree || !subflowPanel) {
      console.error('Required DOM elements missing');
      return;
    }
    
    // Test switching to subflows tab
    switchBuilderType('subflows');
    
    console.log('Subflows tab test completed');
  } catch (e) {
    console.error('Subflows tab test failed:', e);
  }
}

// Force load subflows function
async function forceLoadSubflows() {
  console.log('Force loading subflows...');
  
  try {
    // Switch to subflows tab first
    switchBuilderType('subflows');
    
    // Force load regardless of current content
    const container = document.getElementById('subflow-tree');
    if (container) {
      container.innerHTML = 'Force loading...';
      await loadSubflowTree();
    }
    
    console.log('Force load completed');
  } catch (e) {
    console.error('Force load failed:', e);
  }
}

// Force show builder panel function
function forceShowBuilderPanel() {
  console.log('Force showing builder panel...');
  
  // Remove active class from all tabs
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  
  // Add active class to builder tab
  document.querySelector('[data-tab="builder"]').classList.add('active');
  
  // Hide all tab panels
  document.querySelectorAll('.tab-panel').forEach(p => {
    p.classList.remove('active');
    p.style.display = 'none';
  });
  
  // Show builder tab panel
  const builderTabPanel = document.getElementById('tab-builder');
  console.log('Builder tab panel element:', !!builderTabPanel);
  if (builderTabPanel) {
    console.log('Builder tab panel found, setting display...');
    builderTabPanel.classList.add('active');
    builderTabPanel.style.setProperty('display', 'flex', 'important');
    builderTabPanel.style.setProperty('flex-direction', 'column', 'important');
    builderTabPanel.style.setProperty('visibility', 'visible', 'important');
    console.log('Builder tab panel shown with styles');
  } else {
    console.error('Builder tab panel not found!');
  }
  
  // Handle panel visibility
  const reportPanel = document.getElementById('report-panel');
  const builderPanel = document.getElementById('builder-panel');
  
  console.log('Panel elements:', {
    reportPanel: !!reportPanel,
    builderPanel: !!builderPanel
  });
  
  if (reportPanel) {
    reportPanel.style.display = 'none';
    console.log('Report panel hidden');
  }
  
  if (builderPanel) {
    // Only override the display property to show the panel
    builderPanel.style.setProperty('display', 'flex', 'important');
    console.log('Builder panel forced visible');
  } else {
    console.error('Builder panel not found!');
  }
  
  // Initialize builder tabs
  const flowsTab = document.querySelector('[data-builder-type="flows"]');
  const subflowsTab = document.querySelector('[data-builder-type="subflows"]');
  
  if (flowsTab && subflowsTab) {
    // Default to flows tab
    console.log('About to call switchBuilderType(flows)');
    switchBuilderType('flows');
  } else {
    console.error('Builder tabs not found:', {flowsTab: !!flowsTab, subflowsTab: !!subflowsTab});
  }
  
  console.log('Force show builder panel completed');
  
  // Auto-run debug to see what's happening
  setTimeout(() => debugFileTrees(), 1000);
}

// Test function to make builder panel visible
function testBuilderPanel() {
  const panel = document.getElementById('builder-panel');
  if (panel) {
    panel.style.display = 'flex';
    panel.style.visibility = 'visible';
    panel.style.opacity = '1';
    panel.style.background = 'red';
    panel.style.border = '2px solid blue';
    panel.style.zIndex = '9999';
    console.log('Builder panel test applied');
  } else {
    console.error('Builder panel not found for test');
  }
}

// Force load flows tree
function forceLoadFlows() {
  console.log('Force loading flows tree...');
  const container = document.getElementById('builder-tree');
  if (container) {
    container.innerHTML = 'Force loading flows...';
    loadBuilderTree();
  } else {
    console.error('Builder tree container not found');
  }
}

// Force load subflows tree
function forceLoadSubflowsTree() {
  console.log('Force loading subflows tree...');
  const container = document.getElementById('subflow-tree');
  if (container) {
    container.innerHTML = 'Force loading subflows...';
    loadSubflowTree();
  } else {
    console.error('Subflow tree container not found');
  }
}

// Comprehensive debug function
function debugFileTrees() {
  console.log('=== DEBUGGING FILE TREES ===');
  
  // Check flows elements
  const flowsContainer = document.getElementById('builder-tree');
  const flowsPanel = document.getElementById('builder-flows-panel');
  const flowsTab = document.querySelector('[data-builder-type="flows"]');
  
  console.log('FLOWS DEBUG:', {
    container: !!flowsContainer,
    panel: !!flowsPanel,
    tab: !!flowsTab,
    containerContent: flowsContainer ? flowsContainer.innerHTML.substring(0, 100) : 'N/A',
    panelDisplay: flowsPanel ? flowsPanel.style.display : 'N/A',
    tabActive: flowsTab ? flowsTab.classList.contains('active') : 'N/A'
  });
  
  // Check subflows elements
  const subflowsContainer = document.getElementById('subflow-tree');
  const subflowsPanel = document.getElementById('builder-subflows-panel');
  const subflowsTab = document.querySelector('[data-builder-type="subflows"]');
  
  console.log('SUBFLOWS DEBUG:', {
    container: !!subflowsContainer,
    panel: !!subflowsPanel,
    tab: !!subflowsTab,
    containerContent: subflowsContainer ? subflowsContainer.innerHTML.substring(0, 100) : 'N/A',
    panelDisplay: subflowsPanel ? subflowsPanel.style.display : 'N/A',
    tabActive: subflowsTab ? subflowsTab.classList.contains('active') : 'N/A'
  });
  
  // Test API endpoints
  console.log('Testing API endpoints...');
  fetch('/api/flow-tree')
    .then(r => r.json())
    .then(data => console.log('Flow API works, data length:', data.length))
    .catch(e => console.error('Flow API failed:', e));
    
  fetch('/api/subflow-tree')
    .then(r => r.json())
    .then(data => console.log('Subflow API works, data length:', data.length))
    .catch(e => console.error('Subflow API failed:', e));
    
  console.log('=== END DEBUG ===');
}

// ══════════════════════════════════════════════════════════════════════════════
// ── Batch Excel Test Generation ──────────────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Use Ollama chat-bot to map Excel column headers to expected fields.
 */
async function mapColumnsWithOllama(headers) {
  const prompt = `Given these Excel column headers: ${JSON.stringify(headers)}

Map each to ONE of these fields (respond ONLY with valid JSON, no explanation):
- testId: Test case number or name identifier
- module: Module name or flow directory
- functionalArea: Functional area or feature
- testScenario: One-line test scenario description
- testSteps: Detailed test steps
- testData: Test data requirements

Respond with a JSON object where keys are the field names above and values are the exact matching column header string. If no match, use empty string.
Example: {"testId":"TC #","module":"Module","functionalArea":"Area","testScenario":"Description","testSteps":"Steps","testData":"Data"}`;

  const response = await fetch('http://localhost:3004/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: prompt, history: [] })
  });
  if (!response.ok) throw new Error('Chat API error');
  const data = await response.json();

  // Extract JSON from the reply
  const reply = data.reply || '';
  const jsonMatch = reply.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in Ollama reply');
  const map = JSON.parse(jsonMatch[0]);

  // Validate that mapped values exist in headers
  const validated = {};
  for (const field of ['testId', 'module', 'functionalArea', 'testScenario', 'testSteps', 'testData']) {
    validated[field] = (map[field] && headers.includes(map[field])) ? map[field] : '';
  }
  // Fill gaps with heuristic
  const heuristic = mapColumnsHeuristic(headers);
  for (const field of Object.keys(validated)) {
    if (!validated[field]) validated[field] = heuristic[field];
  }
  return validated;
}

/**
 * Heuristic fallback for column mapping when Ollama is unavailable.
 */
function mapColumnsHeuristic(headers) {
  const lower = headers.map(h => h.toLowerCase());
  function find(...keywords) {
    for (const kw of keywords) {
      const idx = lower.findIndex(h => h.includes(kw));
      if (idx !== -1) return headers[idx];
    }
    return '';
  }
  return {
    testId: find('test case #', 'test case', 'tc #', 'tc id', 'test id', 'id', 'name', '#'),
    module: find('module', 'flow', 'directory', 'dir', 'folder'),
    functionalArea: find('functional area', 'functional', 'area', 'feature', 'category'),
    testScenario: find('scenario', 'description', 'summary', 'title', 'objective'),
    testSteps: find('steps', 'test steps', 'procedure', 'actions', 'detail'),
    testData: find('test data', 'data', 'requirements', 'input', 'precondition'),
  };
}

/**
 * Render the parsed Excel rows as a table in the left panel.
 */
function displayParsedRows(rows) {
  const section = document.getElementById('excel-parsed-section');
  const container = document.getElementById('parsed-rows-container');
  const count = document.getElementById('parsed-row-count');

  count.textContent = `(${rows.length} rows)`;
  section.style.display = 'block';

  let html = `<table class="excel-rows-table">
    <thead><tr>
      <th class="row-status"></th>
      <th>Test Case</th>
      <th>Module</th>
      <th>Scenario</th>
    </tr></thead><tbody>`;

  rows.forEach((row, i) => {
    html += `<tr data-row-index="${i}" onclick="selectParsedRow(${i})" style="cursor:pointer;">
      <td class="row-status" id="row-status-${i}">⬜</td>
      <td title="${escapeHtml(row.testId)}">${escapeHtml(row.testId)}</td>
      <td title="${escapeHtml(row.module || row.functionalArea)}">${escapeHtml(row.module || row.functionalArea)}</td>
      <td title="${escapeHtml(row.testScenario)}">${escapeHtml(row.testScenario.substring(0, 60))}${row.testScenario.length > 60 ? '...' : ''}</td>
    </tr>`;
  });

  html += '</tbody></table>';
  container.innerHTML = html;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Click a parsed row → populate the single-test form fields for manual review.
 */
function selectParsedRow(index) {
  const row = window._batchParsedRows[index];
  if (!row) return;
  document.getElementById('test-id-main').value = row.testId;
  document.getElementById('functional-area-main').value = row.functionalArea;
  document.getElementById('test-scenario-main').value = row.testScenario;
  document.getElementById('test-notes-main').value = row.testData;
  document.getElementById('test-steps-main').value = row.testSteps;
  document.getElementById('test-input-section-main').style.display = 'block';
}

/**
 * Batch-generate Maestro tests for every parsed row.
 */
async function batchGenerateAllTests() {
  const rows = window._batchParsedRows;
  if (!rows || !rows.length) return;

  const btn = document.getElementById('batch-generate-btn');
  const progress = document.getElementById('batch-progress');
  const progressText = document.getElementById('batch-progress-text');
  const progressFill = document.getElementById('batch-progress-fill');

  btn.disabled = true;
  btn.textContent = '⏳ Generating...';
  progress.style.display = 'block';

  window._batchGeneratedTests = [];
  const results = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    progressText.textContent = `Generating ${i + 1} / ${rows.length}...`;
    progressFill.style.width = `${((i + 1) / rows.length) * 100}%`;
    document.getElementById('row-status-' + i).textContent = '⏳';

    const testData = {
      testId: row.testId,
      functionalArea: row.functionalArea || row.module,
      testScenario: row.testScenario,
      notes: row.testData,
      testSteps: row.testSteps
    };

    try {
      let yaml = '';
      const batchMode = document.getElementById('generation-mode')?.value || 'hybrid';
      // Try dashboard server, then chat-bot
      try {
        let response = null;
        try {
          response = await fetch('/api/generate-enhanced-test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...testData, mode: batchMode })
          });
        } catch (_) {
          response = await fetch('http://localhost:3004/api/generate-enhanced-test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...testData, mode: batchMode })
          });
        }
        if (response && response.ok) {
          const result = await response.json();
          yaml = result.yaml || '';
        }
      } catch (_) {}

      // Fallback to basic template if AI generation failed
      if (!yaml) {
        yaml = generateBasicMaestroTestMain(testData);
      }

      results.push({ row, yaml, added: false });
      document.getElementById('row-status-' + i).textContent = '✅';
    } catch (err) {
      console.error('Batch generation error for row', i, err);
      const yaml = generateBasicMaestroTestMain(testData);
      results.push({ row, yaml, added: false });
      document.getElementById('row-status-' + i).textContent = '⚠️';
    }
  }

  window._batchGeneratedTests = results;
  btn.disabled = false;
  btn.textContent = '🚀 Generate Excel Tests';
  progressText.textContent = `Done — ${results.length} tests generated`;

  displayBatchTests(results);
}

/**
 * Render all generated tests vertically in the right panel.
 */
function displayBatchTests(results) {
  const panel = document.getElementById('test-generator-panel');
  const singleOutput = document.getElementById('test-generator-output-section');
  const batchSection = document.getElementById('batch-tests-section');
  const listContainer = document.getElementById('batch-tests-list');
  const statusEl = document.getElementById('add-all-status');

  // Hide single-test output, show batch section
  singleOutput.style.display = 'none';
  batchSection.style.display = 'flex';
  panel.style.display = 'flex';

  statusEl.textContent = `${results.length} tests generated`;
  listContainer.innerHTML = '';

  results.forEach((item, idx) => {
    const module = item.row.module || item.row.functionalArea || 'General';
    const inputDisplay = `Test Case #: ${escapeHtml(item.row.testId)}
Functional Area: ${escapeHtml(item.row.functionalArea || 'N/A')}
Test Scenario: ${escapeHtml(item.row.testScenario || 'N/A')}
Test Data: ${escapeHtml(item.row.testData || 'N/A')}

Test Steps:
${escapeHtml(item.row.testSteps || 'N/A')}`;
    
    const container = document.createElement('div');
    container.className = 'batch-test-container';
    container.id = 'batch-test-' + idx;
    container.innerHTML = `
      <div class="batch-test-header" onclick="toggleBatchTest(${idx})">
        <span class="collapse-arrow">▼</span>
        <span class="test-name">${escapeHtml(item.row.testId)} — ${escapeHtml(item.row.testScenario.substring(0, 50))}</span>
        <span class="test-module">${escapeHtml(module)}</span>
      </div>
      <div class="batch-test-body">
        <!-- Tabs for Input/YAML -->
        <div style="display:flex;gap:2px;padding:0 0 8px 0;border-bottom:1px solid var(--border);">
          <div class="output-tab" data-tab="input" onclick="switchBatchTab(this, ${idx})">Input</div>
          <div class="output-tab output-tab-active" data-tab="yaml" onclick="switchBatchTab(this, ${idx})">YAML</div>
        </div>
        <!-- Input Tab Content -->
        <div id="batch-input-${idx}" class="batch-tab-content" style="display:none;margin-top:8px;">
          <textarea id="batch-input-text-${idx}" spellcheck="false" style="width:100%; min-height:200px; border:1px solid var(--border); border-radius:var(--radius-sm); padding:10px; font-family:'SF Mono','Fira Code','Cascadia Code',monospace; font-size:11px; line-height:1.6; resize:vertical; background:var(--bg2); color:var(--text); tab-size:2;">${inputDisplay}</textarea>
        </div>
        <!-- YAML Tab Content -->
        <div id="batch-yaml-tab-${idx}" class="batch-tab-content" style="margin-top:8px;">
          <textarea id="batch-yaml-${idx}" spellcheck="false">${escapeHtml(item.yaml)}</textarea>
        </div>
        <div class="batch-test-actions">
          <button class="btn btn-ghost" style="font-size:11px;padding:4px 10px;" onclick="regenerateBatchTest(${idx})">🔄 Re-generate Test</button>
          <button class="btn btn-ghost" style="font-size:11px;padding:4px 10px;" onclick="copyBatchTest(${idx})">📋 Copy</button>
          <button class="btn btn-ghost" style="font-size:11px;padding:4px 10px;" onclick="downloadBatchTest(${idx})">⬇️ Download</button>
          <button class="btn-add-test" id="btn-add-test-${idx}" onclick="addSingleBatchTest(${idx})">📥 Add Test</button>
        </div>
      </div>
    `;
    listContainer.appendChild(container);
  });
}

/**
 * Switch between Input/YAML tabs for batch tests
 */
function switchBatchTab(tab, idx) {
  const parent = tab.parentElement.parentElement;
  
  // Update tab active states
  parent.querySelectorAll('.output-tab').forEach(t => t.classList.remove('output-tab-active'));
  tab.classList.add('output-tab-active');
  
  // Show/hide content
  const tabName = tab.dataset.tab;
  const inputTab = document.getElementById('batch-input-' + idx);
  const yamlTab = document.getElementById('batch-yaml-tab-' + idx);
  
  if (inputTab) inputTab.style.display = tabName === 'input' ? 'block' : 'none';
  if (yamlTab) yamlTab.style.display = tabName === 'yaml' ? 'block' : 'none';
}

/**
 * Regenerate a single batch test with current input data (editable)
 */
async function regenerateBatchTest(idx) {
  const item = window._batchGeneratedTests[idx];
  const inputTextarea = document.getElementById('batch-input-text-' + idx);
  const container = document.getElementById('batch-test-' + idx);
  
  if (!item || !inputTextarea) {
    alert('Test data not available for regeneration');
    return;
  }
  
  // Get the Re-generate button
  const regenBtn = container ? container.querySelector('.batch-test-actions button[onclick*="regenerateBatchTest"]') : null;
  
  // Set loading state
  if (regenBtn) {
    regenBtn.disabled = true;
    regenBtn.innerHTML = '⏳ Regenerating...';
    regenBtn.style.opacity = '0.7';
    regenBtn.style.cursor = 'not-allowed';
  }
  
  // Parse the editable input content
  const inputText = inputTextarea.value;
  const lines = inputText.split('\n');
  
  // Extract fields from the input text
  let testId = '', functionalArea = '', testScenario = '', testData = '', testSteps = '';
  let inSteps = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith('Test Case #:')) testId = line.replace('Test Case #:', '').trim();
    else if (line.startsWith('Functional Area:')) functionalArea = line.replace('Functional Area:', '').trim();
    else if (line.startsWith('Test Scenario:')) testScenario = line.replace('Test Scenario:', '').trim();
    else if (line.startsWith('Test Data:')) testData = line.replace('Test Data:', '').trim();
    else if (line.startsWith('Test Steps:')) { inSteps = true; continue; }
    else if (inSteps && line.trim()) testSteps += (testSteps ? '\n' : '') + line;
  }
  
  console.log(`🔄 Regenerating batch test ${idx}: ${testId}`);
  
  try {
    // Call the API to regenerate with parsed/edited data
    const response = await fetch('http://localhost:3003/api/generate-enhanced-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        testId: testId || item.row.testId,
        functionalArea: functionalArea || item.row.functionalArea,
        testScenario: testScenario || item.row.testScenario,
        notes: testData || item.row.testData,
        testSteps: testSteps || item.row.testSteps,
        mode: 'hybrid'
      })
    }).catch(() => {
      // Fallback to chat-bot server
      return fetch('http://localhost:3004/api/generate-enhanced-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testId: testId || item.row.testId,
          functionalArea: functionalArea || item.row.functionalArea,
          testScenario: testScenario || item.row.testScenario,
          notes: testData || item.row.testData,
          testSteps: testSteps || item.row.testSteps,
          mode: 'hybrid'
        })
      });
    });
    
    if (response && response.ok) {
      const result = await response.json();
      item.yaml = result.yaml;
      
      // Update the YAML textarea
      const textarea = document.getElementById('batch-yaml-' + idx);
      if (textarea) {
        textarea.value = result.yaml;
      }
      
      // Switch to YAML tab automatically
      const yamlTab = container ? container.querySelector('.output-tab[data-tab="yaml"]') : null;
      if (yamlTab) {
        switchBatchTab(yamlTab, idx);
      }
      
      // Reset button state with success message
      if (regenBtn) {
        regenBtn.innerHTML = '✅ Regenerated';
        setTimeout(() => {
          regenBtn.disabled = false;
          regenBtn.innerHTML = '🔄 Re-generate Test';
          regenBtn.style.opacity = '1';
          regenBtn.style.cursor = 'pointer';
        }, 2000);
      }
    } else {
      // Reset button state with error
      if (regenBtn) {
        regenBtn.innerHTML = '❌ Failed';
        setTimeout(() => {
          regenBtn.disabled = false;
          regenBtn.innerHTML = '🔄 Re-generate Test';
          regenBtn.style.opacity = '1';
          regenBtn.style.cursor = 'pointer';
        }, 2000);
      }
      alert('❌ Failed to regenerate test. Please check server connection.');
    }
  } catch (error) {
    console.error('Regeneration error:', error);
    
    // Reset button state with error
    if (regenBtn) {
      regenBtn.innerHTML = '❌ Error';
      setTimeout(() => {
        regenBtn.disabled = false;
        regenBtn.innerHTML = '🔄 Re-generate Test';
        regenBtn.style.opacity = '1';
        regenBtn.style.cursor = 'pointer';
      }, 2000);
    }
    alert('❌ Error regenerating test: ' + error.message);
  }
}

/**
 * Toggle expand/collapse for a single batch test container.
 */
function toggleBatchTest(idx) {
  const el = document.getElementById('batch-test-' + idx);
  if (el) el.classList.toggle('collapsed');
}

/**
 * Copy a single batch test YAML to clipboard.
 */
function copyBatchTest(idx) {
  const textarea = document.getElementById('batch-yaml-' + idx);
  if (textarea) {
    navigator.clipboard.writeText(textarea.value).then(() => {
      const btn = textarea.closest('.batch-test-body').querySelector('.btn.btn-ghost');
      if (btn) { const orig = btn.textContent; btn.textContent = '✅ Copied'; setTimeout(() => btn.textContent = orig, 1500); }
    });
  }
}

/**
 * Download a single batch test YAML as a file.
 */
function downloadBatchTest(idx) {
  const item = window._batchGeneratedTests[idx];
  const textarea = document.getElementById('batch-yaml-' + idx);
  if (!item || !textarea) return;
  const filename = `${item.row.testId.replace(/[^a-zA-Z0-9.-]/g, '_')}.yaml`;
  const blob = new Blob([textarea.value], { type: 'text/yaml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Save a single batch test to .maestro/flows, show checkmark, collapse.
 */
async function addSingleBatchTest(idx) {
  const item = window._batchGeneratedTests[idx];
  const textarea = document.getElementById('batch-yaml-' + idx);
  const btn = document.getElementById('btn-add-test-' + idx);
  if (!item || !textarea || item.added) return;

  btn.disabled = true;
  btn.textContent = '⏳ Saving...';

  const content = textarea.value;
  const feature = item.row.module || extractFeatureFromTestDataMain({
    functionalArea: item.row.functionalArea || item.row.module || 'General'
  });
  const filename = `${item.row.testId.replace(/[^a-zA-Z0-9.-]/g, '_')}.yaml`;

  try {
    const response = await fetch('/api/save-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, content, feature })
    });
    const data = await response.json();
    if (data.success) {
      item.added = true;
      btn.textContent = '✅ Added';
      btn.classList.add('added');
      const container = document.getElementById('batch-test-' + idx);
      container.classList.add('added');
      // Collapse after short delay
      setTimeout(() => container.classList.add('collapsed'), 600);
      updateAddAllStatus();
    } else {
      btn.textContent = '❌ Failed';
      btn.disabled = false;
      setTimeout(() => { btn.textContent = '📥 Add Test'; }, 2000);
    }
  } catch (err) {
    console.error('Save error:', err);
    btn.textContent = '❌ Error';
    btn.disabled = false;
    setTimeout(() => { btn.textContent = '📥 Add Test'; }, 2000);
  }
}

/**
 * Save ALL batch tests to .maestro/flows at once.
 */
async function addAllBatchTests() {
  const tests = window._batchGeneratedTests;
  if (!tests || !tests.length) return;

  const btn = document.getElementById('btn-add-all-tests');
  btn.disabled = true;
  btn.textContent = '⏳ Saving all...';

  let saved = 0;
  for (let i = 0; i < tests.length; i++) {
    if (tests[i].added) { saved++; continue; }
    await addSingleBatchTest(i);
    if (tests[i].added) saved++;
  }

  btn.textContent = `✅ ${saved}/${tests.length} Added`;
  setTimeout(() => {
    btn.disabled = false;
    btn.textContent = '📥 Add All Tests';
  }, 3000);
}

/**
 * Update the "X of Y added" status text.
 */
function updateAddAllStatus() {
  const tests = window._batchGeneratedTests;
  if (!tests) return;
  const addedCount = tests.filter(t => t.added).length;
  const statusEl = document.getElementById('add-all-status');
  statusEl.textContent = `${addedCount} / ${tests.length} tests added to flows`;
}
