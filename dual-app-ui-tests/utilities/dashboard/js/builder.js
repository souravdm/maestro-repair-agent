// ── Script Builder ────────────────────────────────────────────────────────────

let builderCurrentFile = null;
let builderDirty = false;
let builderScreenLabels = {};
let builderPlatform = 'ios';
let builderApp = 'cvs';

const BUILDER_APP_IDS = {
  ios:     { cvs: 'com.cvsenterpriseiphone.cvspharmacy', health100: 'com.health100.h100.app' },
  android: { cvs: 'com.cvs.launchers.cvs',               health100: 'com.health100.launchers' }
};

async function loadScreenLabels() {
  try {
    builderScreenLabels = await fetch('/api/screen-labels').then(r => r.json());
  } catch (_) { builderScreenLabels = {}; }
}

function onPreviewConfigChange() {
  builderPlatform = document.querySelector('input[name="builder-platform"]:checked')?.value || 'ios';
  builderApp      = document.querySelector('input[name="builder-app"]:checked')?.value      || 'cvs';
  const appId = BUILDER_APP_IDS[builderPlatform][builderApp];
  const el = document.getElementById('preview-appid');
  if (el) el.textContent = appId;
  renderFlowPreview();
}

// Builder sub-tab switching (YAML Editor / Preview / Map View)
document.querySelectorAll('#builder-panel .builder-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('#builder-panel .builder-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('#builder-panel .builder-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    const panel = document.getElementById('btab-' + tab.dataset.btab);
    if (panel) {
      panel.classList.add('active');
      if (tab.dataset.btab === 'preview') renderFlowPreview();
    }
  });
});

// Main tab switching — show/hide report vs builder panel, show/hide sidebar
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const reportPanel = document.getElementById('report-panel');
    const builderPanel = document.getElementById('builder-panel');
    const testGeneratorPanel = document.getElementById('test-generator-panel');
    const testDataPanel = document.getElementById('testdata-panel');

    console.log('Tab switching to:', tab.dataset.tab, {
      reportPanel: !!reportPanel,
      builderPanel: !!builderPanel,
      testGeneratorPanel: !!testGeneratorPanel,
      testDataPanel: !!testDataPanel
    });

    // Hide all right panels first
    if (reportPanel) reportPanel.style.display = 'none';
    if (builderPanel) builderPanel.style.display = 'none';
    if (testGeneratorPanel) testGeneratorPanel.style.display = 'none';
    if (testDataPanel) testDataPanel.style.display = 'none';

    if (tab.dataset.tab === 'builder') {
      if (builderPanel) builderPanel.style.display = 'flex';
      
      // Initialize builder tabs - ensure proper tab setup
      const flowsTab = document.querySelector('[data-builder-type="flows"]');
      const subflowsTab = document.querySelector('[data-builder-type="subflows"]');
      
      if (!flowsTab || !subflowsTab) {
        console.error('Builder tabs not found in DOM');
        return;
      }
      
      // Check if there's an active tab, default to flows if not
      const activeBuilderTab = document.querySelector('.builder-tab.active');
      if (!activeBuilderTab) {
        // Default to flows if no active tab
        switchBuilderType('flows');
      } else {
        const builderType = activeBuilderTab.dataset.builderType;
        if (builderType === 'flows') {
          loadBuilderTree();
        } else if (builderType === 'subflows') {
          loadSubflowTree();
        }
      }
    } else if (tab.dataset.tab === 'generator') {
      const hasSingleOutput = document.getElementById('test-generator-output-section').style.display === 'block';
      const hasBatchOutput = document.getElementById('batch-tests-section').style.display !== 'none'
        && window._batchGeneratedTests && window._batchGeneratedTests.length > 0;
      if (testGeneratorPanel && (hasSingleOutput || hasBatchOutput)) {
        testGeneratorPanel.style.display = 'flex';
      }
    } else if (tab.dataset.tab === 'run') {
      if (reportPanel) reportPanel.style.display = 'flex';
    } else if (tab.dataset.tab === 'testdata') {
      if (testDataPanel) testDataPanel.style.display = 'flex';
    }
  });
});

async function loadBuilderTree() {
  loadScreenLabels();
  try {
    const tree = await fetch('/api/flow-tree').then(r => r.json());
    const container = document.getElementById('builder-tree');
    container.innerHTML = '';
    await renderTree(tree, container);
  } catch (e) {
    document.getElementById('builder-tree').innerHTML =
      '<div style="padding:12px;color:#c62828;font-size:11px;">Failed to load file tree</div>';
  }
}

async function loadSubflowTree() {
  console.log('=== loadSubflowTree START ===');
  loadScreenLabels();
  try {
    console.log('Loading subflow tree...');
    const response = await fetch('/api/subflow-tree');
    
    console.log('Subflow API response status:', response.status);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const tree = await response.json();
    console.log('Subflow tree data received:', tree.length, 'items');
    
    const container = document.getElementById('subflow-tree');
    console.log('Subflow container found:', !!container);
    if (!container) {
      throw new Error('Subflow tree container not found');
    }
    
    console.log('Clearing container and rendering tree...');
    console.log('Container before clear:', container.innerHTML.substring(0, 100));
    container.innerHTML = '';
    console.log('Container after clear:', container.innerHTML);
    console.log('About to call renderTree with', tree.length, 'items');
    await renderTree(tree, container);
    console.log('Container after renderTree:', container.innerHTML.substring(0, 200));
    console.log('Subflow tree loaded successfully');
  } catch (e) {
    console.error('Failed to load subflow tree:', e);
    const container = document.getElementById('subflow-tree');
    if (container) {
      container.innerHTML =
        '<div style="padding:12px;color:#c62828;font-size:11px;">Failed to load subflow tree: ' + e.message + '</div>';
    }
  }
  console.log('=== loadSubflowTree END ===');
}

function switchBuilderType(type) {
  console.log('=== switchBuilderType START ===');
  console.log('Switching to:', type);
  
  // Debug all builder panels before switching
  console.log('BEFORE switch - all builder panels:');
  document.querySelectorAll('.builder-panel').forEach((panel, i) => {
    console.log(`  Panel ${i}:`, panel.id, panel.className, panel.style.display);
  });
  
  // Update tab states
  document.querySelectorAll('.builder-tab').forEach(tab => {
    tab.classList.remove('active');
  });
  const targetTab = document.querySelector(`[data-builder-type="${type}"]`);
  if (targetTab) {
    targetTab.classList.add('active');
  } else {
    console.error('Target builder tab not found:', type);
    return;
  }
  
  // Update panel visibility - only hide file tree panels, not YAML editor panels
  console.log('About to hide file tree panels only...');
  const fileTreePanels = ['builder-flows-panel', 'builder-subflows-panel'];
  fileTreePanels.forEach(panelId => {
    const panel = document.getElementById(panelId);
    if (panel) {
      console.log('Hiding file tree panel:', panelId);
      panel.style.display = 'none';
    }
  });
  
  if (type === 'flows') {
    const flowsPanel = document.getElementById('builder-flows-panel');
    if (flowsPanel) {
      flowsPanel.style.display = 'flex';
      // Load flows if not already loaded
      const flowsContainer = document.getElementById('builder-tree');
      if (flowsContainer && flowsContainer.innerHTML.includes('Loading...')) {
        loadBuilderTree();
      }
    } else {
      console.error('Flows panel not found');
    }
  } else if (type === 'subflows') {
    console.log('=== Switching to subflows ===');
    const subflowsPanel = document.getElementById('builder-subflows-panel');
    console.log('Subflows panel found:', !!subflowsPanel);
    
    if (subflowsPanel) {
      subflowsPanel.style.display = 'flex';
      console.log('Subflows panel displayed, calling loadSubflowTree...');
      // Always load subflows when switching to ensure fresh data
      loadSubflowTree();
      
      // Ensure YAML editor tab is selected by default
      const yamlTab = document.querySelector('[data-btab="yaml"]');
      if (yamlTab && !yamlTab.classList.contains('active')) {
        // Switch to YAML editor tab
        document.querySelectorAll('#builder-panel .builder-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('#builder-panel .builder-panel').forEach(p => p.classList.remove('active'));
        yamlTab.classList.add('active');
        const yamlPanel = document.getElementById('btab-yaml');
        if (yamlPanel) yamlPanel.classList.add('active');
        console.log('Switched to YAML editor tab by default');
      }
    } else {
      console.error('Subflows panel not found');
    }
  }
}

function countErrorsInYAML(content) {
  const errors = [];
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    const match = line.match(/\$\{output\.([^.]+)\.([^}]+)\}/g);
    if (match) {
      match.forEach(m => {
        const parts = m.match(/\$\{output\.([^.]+)\.([^}]+)\}/);
        if (parts) {
          const screen = parts[1];
          const elem = parts[2];
          
          // Check if it's a user data reference
          if (screen === 'user') {
            errors.push({ line: idx + 1, msg: `user data not loaded (missing credentials)` });
          } else {
            // It's a screen reference
            const screenObj = builderScreenLabels[screen];
            if (!screenObj) {
              errors.push({ line: idx + 1, msg: `screen "${screen}" not loaded` });
            } else if (!screenObj[elem]) {
              errors.push({ line: idx + 1, msg: `"${elem}" not found in ${screen}` });
            }
          }
        }
      });
    }
  });
  return errors;
}

async function renderTree(nodes, container) {
  console.log('Rendering tree with', nodes.length, 'nodes');
  
  for (const node of nodes) {
    if (node.type === 'dir') {
      const dir = document.createElement('div');
      dir.className = 'tree-dir';
      const dirLabel = document.createElement('div');
      dirLabel.className = 'tree-dir-label';
      dirLabel.style.cursor = 'pointer';
      dirLabel.innerHTML = `
        <span class="tree-chev">▶</span>
        <span>📁 ${node.name}</span>
        <span class="tree-error-count" style="margin-left:auto;font-size:10px;color:#c62828;font-weight:600;"></span>`;
      dirLabel.addEventListener('click', () => dir.classList.toggle('open'));
      dir.appendChild(dirLabel);
      
      const childrenContainer = document.createElement('div');
      childrenContainer.className = 'tree-dir-children';
      dir.appendChild(childrenContainer);
      
      if (node.children && node.children.length) {
        await renderTree(node.children, childrenContainer);
      }
      
      // Count errors in directory
      const errorCount = await countDirErrors(node);
      const errorSpan = dirLabel.querySelector('.tree-error-count');
      if (errorCount > 0) {
        errorSpan.textContent = `(${errorCount})`;
      }
      
      container.appendChild(dir);
    } else {
      const file = document.createElement('div');
      file.className = 'tree-file';
      file.dataset.path = node.path;
      
      // Load file and count errors
      let errorCount = 0;
      try {
        console.log('Loading file for error counting:', node.path);
        const response = await fetch(`/api/file?filePath=${encodeURIComponent(node.path)}`);
        
        if (!response.ok) {
          console.warn('Failed to load file for error counting:', node.path, response.status);
          throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.content) {
          console.warn('Empty file content:', node.path);
          throw new Error('Empty content');
        }
        
        const errors = countErrorsInYAML(data.content);
        errorCount = errors.length;
        console.log('Error count for', node.name, ':', errorCount);
      } catch (e) {
        console.warn('Error loading file for error counting:', node.path, e.message);
        // Silently ignore load errors but mark as potentially problematic
        errorCount = 0;
      }
      
      const errorBadge = errorCount > 0 ? `<span style="margin-left:auto;font-size:10px;color:#c62828;font-weight:600;">(${errorCount})</span>` : '';
      file.innerHTML = `<span>📄</span><span>${node.name}</span>${errorBadge}`;
      file.style.display = 'flex';
      file.style.alignItems = 'center';
      file.style.gap = '6px';
      
      file.addEventListener('click', () => openBuilderFile(node.path, node.name, file));
      container.appendChild(file);
    }
  }
  console.log('Tree rendering completed');
  console.log('Container final content:', container.innerHTML.substring(0, 200));
  
  // Force visibility for subflows container
  if (container.id === 'subflow-tree') {
    container.style.setProperty('display', 'block', 'important');
    container.style.setProperty('visibility', 'visible', 'important');
    container.style.setProperty('opacity', '1', 'important');
  }
  
  console.log('=== renderTree END ===');
}

async function countDirErrors(dirNode) {
  let total = 0;
  if (dirNode.children) {
    for (const child of dirNode.children) {
      if (child.type === 'dir') {
        total += await countDirErrors(child);
      } else {
        try {
          const data = await fetch(`/api/file?filePath=${encodeURIComponent(child.path)}`).then(r => r.json());
          const errors = countErrorsInYAML(data.content);
          total += errors.length;
        } catch (e) {
          // Silently ignore
        }
      }
    }
  }
  return total;
}

function refreshFileErrorBadge(fileEl, content) {
  const errors = countErrorsInYAML(content);
  const count = errors.length;
  // Update the file-level badge (last span child is the error badge)
  const existing = fileEl.querySelector('span:last-child');
  if (count > 0) {
    if (existing && existing !== fileEl.querySelector('span:first-child') && existing !== fileEl.querySelectorAll('span')[1]) {
      existing.textContent = `(${count})`;
    } else {
      const badge = document.createElement('span');
      badge.style.cssText = 'margin-left:auto;font-size:10px;color:#c62828;font-weight:600;';
      badge.textContent = `(${count})`;
      fileEl.appendChild(badge);
    }
  } else {
    // Remove badge if errors gone — find the red badge span
    fileEl.querySelectorAll('span').forEach(s => {
      if (s.style.color === 'rgb(198, 40, 40)' || s.style.color === '#c62828') s.remove();
    });
  }
  // Bubble up: recount parent dir badge
  const parentChildren = fileEl.closest('.tree-dir-children');
  if (parentChildren) {
    const dirEl = parentChildren.closest('.tree-dir');
    if (dirEl) refreshDirErrorBadge(dirEl);
  }
}

function refreshDirErrorBadge(dirEl) {
  let total = 0;
  dirEl.querySelectorAll('.tree-file').forEach(f => {
    const badge = f.querySelector('span[style*="c62828"]') || Array.from(f.querySelectorAll('span')).find(s => s.style.color === 'rgb(198, 40, 40)');
    if (badge) {
      const n = parseInt(badge.textContent.replace(/[()]/g, ''), 10);
      if (!isNaN(n)) total += n;
    }
  });
  const errorSpan = dirEl.querySelector('.tree-dir-label .tree-error-count');
  if (errorSpan) errorSpan.textContent = total > 0 ? `(${total})` : '';
  // Bubble up further if nested
  const parentChildren = dirEl.closest('.tree-dir-children');
  if (parentChildren) {
    const parentDir = parentChildren.closest('.tree-dir');
    if (parentDir) refreshDirErrorBadge(parentDir);
  }
}

async function openBuilderFile(filePath, name, el) {
  if (builderDirty) {
    if (!confirm('You have unsaved changes. Discard and open new file?')) return;
  }
  document.querySelectorAll('.tree-file').forEach(f => f.classList.remove('active'));
  el.classList.add('active');

  try {
    console.log('Loading file:', filePath);
    const response = await fetch(`/api/file?filePath=${encodeURIComponent(filePath)}`);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    if (!data.content) {
      throw new Error('File content is empty');
    }
    
    console.log('File loaded successfully, content length:', data.content.length);
    builderCurrentFile = filePath;
    builderDirty = false;
    refreshFileErrorBadge(el, data.content);

    const empty = document.getElementById('builder-empty-state');
    const editor = document.getElementById('yaml-editor');
    const wrapper = document.getElementById('yaml-editor-wrapper');
    const highlight = document.getElementById('yaml-highlight');
    
    console.log('Editor elements found:', {
      empty: !!empty,
      editor: !!editor,
      wrapper: !!wrapper,
      highlight: !!highlight
    });
    
    if (empty) {
      console.log('Hiding empty state');
      empty.style.display = 'none';
    }
    if (wrapper) {
      console.log('Showing editor wrapper');
      wrapper.style.setProperty('display', 'flex', 'important');
      wrapper.style.setProperty('visibility', 'visible', 'important');
      wrapper.style.setProperty('opacity', '1', 'important');
    }
    if (editor) {
      console.log('Setting editor value, content length:', data.content.length);
      editor.value = data.content;
      console.log('Editor value set, current value length:', editor.value.length);
    } else {
      console.error('YAML editor element not found!');
    }
    
    if (highlight) {
      console.log('Setting highlight content');
      highlight.innerHTML = highlightYAML(data.content);
    } else {
      console.warn('YAML highlight element not found');
    }

    const filenameEl = document.getElementById('builder-filename');
    if (filenameEl) filenameEl.textContent = filePath;
    
    const checkIssuesBtn = document.getElementById('btn-check-issues');
    if (checkIssuesBtn) checkIssuesBtn.disabled = false;
    
    const saveBtn = document.getElementById('btn-save-flow');
    if (saveBtn) saveBtn.disabled = false;
    
    const issuesPanel = document.getElementById('issues-panel');
    if (issuesPanel) issuesPanel.style.display = 'none';

    // Always render preview when file changes, regardless of current tab
    renderFlowPreview();
    
    console.log('File loaded and UI updated successfully');
  } catch (e) {
    console.error('Failed to open file:', e);
    alert('Failed to open file: ' + e.message);
    
    // Reset UI state on error
    const empty = document.getElementById('builder-empty-state');
    const wrapper = document.getElementById('yaml-editor-wrapper');
    if (empty) empty.style.display = 'flex';
    if (wrapper) wrapper.style.display = 'none';
  }
}

function highlightYAML(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^(\s*)(#.*)$/gm, '$1<span style="color:#6a9955;">$2</span>')
    .replace(/^(\s*)(-\s)/gm, '$1<span style="color:#d4d4d4;">$2</span>')
    .replace(/^(\s*)(\w+):/gm, '$1<span style="color:#9cdcfe;">$2</span>:')
    .replace(/:\s*(\$\{[^}]+\})/g, ': <span style="color:#4ec9b0;">$1</span>')
    .replace(/:\s*(['"])([^'"]*)\1/g, ': <span style="color:#ce9178;">$1$2$1</span>')
    .replace(/:\s*(true|false|null)(?=\s|$)/gm, ': <span style="color:#569cd6;">$1</span>')
    .replace(/:\s*(\d+)(?=\s|$)/gm, ': <span style="color:#b5cea8;">$1</span>')
    .replace(/(\.\.\/[^\s]+)/g, '<span style="color:#ce9178;">$1</span>');
}

function syncScroll() {
  const editor = document.getElementById('yaml-editor');
  const highlight = document.getElementById('yaml-highlight');
  if (editor && highlight) {
    highlight.scrollTop = editor.scrollTop;
    highlight.scrollLeft = editor.scrollLeft;
  }
}

function onEditorChange() {
  builderDirty = true;
  document.getElementById('btn-save-flow').textContent = '💾 Save*';
  
  const editor = document.getElementById('yaml-editor');
  const highlight = document.getElementById('yaml-highlight');
  if (editor && highlight) {
    highlight.innerHTML = highlightYAML(editor.value);
  }
}

async function saveFlow() {
  if (!builderCurrentFile) return;
  const content = document.getElementById('yaml-editor').value;
  try {
    await fetch('/api/file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath: builderCurrentFile, content })
    });
    builderDirty = false;
    document.getElementById('btn-save-flow').textContent = '💾 Save';
    // Refresh badge on the active tree file
    const activeFile = document.querySelector('.tree-file.active');
    if (activeFile) refreshFileErrorBadge(activeFile, content);
  } catch (e) {
    alert('Save failed: ' + e.message);
  }
}

async function checkScriptIssues() {
  if (!builderCurrentFile) return;
  const content = document.getElementById('yaml-editor').value;
  const panel = document.getElementById('issues-panel');
  const list = document.getElementById('issues-list');
  const summary = document.getElementById('issues-summary');

  list.innerHTML = '<div style="padding:8px 12px;font-size:12px;color:var(--text-muted);">Checking...</div>';
  panel.style.display = '';

  try {
    const data = await fetch('/api/check-flow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath: builderCurrentFile, content })
    }).then(r => r.json());

    if (data.issues.length === 0) {
      summary.textContent = '✅ No issues found';
      list.innerHTML = '<div style="padding:8px 12px;font-size:12px;color:var(--green);">All checks passed — no issues detected.</div>';
    } else {
      const errCount = data.issues.filter(i => i.type === 'error').length;
      const warnCount = data.issues.filter(i => i.type === 'warning').length;
      summary.textContent = `Script Issues — ${errCount} error${errCount !== 1 ? 's' : ''}, ${warnCount} warning${warnCount !== 1 ? 's' : ''}`;
      list.innerHTML = data.issues.map(issue => `
        <div class="issue-row issue-${issue.type}">
          <span class="issue-line">L${issue.line}</span>
          <span class="issue-icon"></span>
          <span class="issue-msg">${issue.message}</span>
        </div>`).join('');
    }
  } catch (e) {
    list.innerHTML = '<div style="padding:8px 12px;font-size:12px;color:#c62828;">Check failed: ' + e.message + '</div>';
  }
}

function screenToTitle(s) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function formatStepValue(val, testDataContext) {
  if (!val || !val.trim()) return '';
  
  // First, try to resolve ${output.screen.elem} references
  let result = val.replace(/\$\{output\.([^.]+)\.([^}]+)\}/g, (match, screen, elem) => {
    const screenObj = builderScreenLabels[screen];
    if (!screenObj) {
      return `<span class="preview-screen-badge">${screenToTitle(screen)}</span><span class="preview-inline-error">⚠ screen not loaded</span>`;
    }
    if (!screenObj[elem]) {
      return `<span class="preview-screen-badge">${screenToTitle(screen)}</span><span class="preview-inline-warn">⚠ ${elem} not found</span>`;
    }
    const entry = screenObj[elem];
    const label = typeof entry === 'object' ? (entry[builderPlatform] || entry.ios || match) : entry;
    return `<span class="preview-screen-badge">${screenToTitle(screen)}</span><span class="preview-string-val">${label}</span>`;
  });
  
  // If no ${output.*} references were found, treat as plain string value
  if (result === val) {
    // Remove quotes if present
    const unquoted = val.replace(/^['"]|['"]$/g, '');
    result = `<span class="preview-string-val">${unquoted}</span>`;
  }
  
  return result;
}

function resolveSubflowPath(currentFile, relPath) {
  const parts = currentFile.split('/');
  parts.pop(); // remove filename
  relPath.split('/').forEach(p => {
    if (p === '..') parts.pop();
    else if (p !== '.') parts.push(p);
  });
  return parts.join('/');
}

// ── Shared subflow helpers ───────────────────────────────────────────────────

function parseYamlSteps(content) {
  const lines = content.split('\n');
  const steps = [];
  let buf = [], past = false;
  lines.forEach(l => {
    const t = l.trim();
    if (t === '---') { past = true; return; }
    if (!past || t.startsWith('#') || t === '') return;
    if (t.startsWith('- ')) { if (buf.length) steps.push(buf.join('\n')); buf = [l]; }
    else if (buf.length) buf.push(l);
  });
  if (buf.length) steps.push(buf.join('\n'));
  return steps;
}

function formatMultiLineBody(extraLines) {
  const indents = extraLines.filter(l => l.trim()).map(l => (l.match(/^(\s+)/)||['',''])[1].length);
  const base = indents.length ? Math.min(...indents) : 0;
  return extraLines.filter(l => l.trim()).map(l => {
    const ind = Math.max(0, ((l.match(/^(\s+)/)||['',''])[1].length) - base);
    const s = l.trim();
    const kv = s.match(/^([^:]+):\s*(.*)/);
    const px = 20 + ind * 24;
    if (kv) {
      const resolvedVal = kv[2] ? formatStepValue(kv[2]) : '';
      return `<div class="subflow-prop-row" style="padding-left:${px}px"><span class="subflow-prop-key">${kv[1]}</span><span class="subflow-prop-sep">: </span><span class="subflow-prop-val">${resolvedVal}</span></div>`;
    }
    return `<div class="subflow-prop-row" style="padding-left:${px}px"><span class="subflow-prop-val">${formatStepValue(s)}</span></div>`;
  }).join('');
}

function parseInlineRunFlowBlock(extraLines) {
  const meaningful = extraLines.filter(l => l.trim());
  const indents = meaningful.map(l => (l.match(/^(\s+)/) || ['', ''])[1].length);
  const base = indents.length ? Math.min(...indents) : 0;
  const result = { whenLines: [], commands: [] };
  let section = null;
  let buffer = [];

  meaningful.forEach(line => {
    const indent = (line.match(/^(\s+)/) || ['', ''])[1].length;
    const trimmed = line.trim();

    if (indent === base && /^when:\s*$/i.test(trimmed)) {
      if (buffer.length) {
        result.commands.push(buffer.join('\n'));
        buffer = [];
      }
      section = 'when';
      return;
    }

    if (indent === base && /^commands:\s*$/i.test(trimmed)) {
      if (buffer.length) {
        result.commands.push(buffer.join('\n'));
        buffer = [];
      }
      section = 'commands';
      return;
    }

    if (section === 'when') {
      result.whenLines.push(line);
      return;
    }

    if (section === 'commands') {
      if (trimmed.startsWith('- ')) {
        if (buffer.length) result.commands.push(buffer.join('\n'));
        buffer = [line];
      } else if (buffer.length) {
        buffer.push(line);
      }
    }
  });

  if (buffer.length) result.commands.push(buffer.join('\n'));
  return result;
}

function renderInlineRunFlowBody(extraLines, baseFilePath, testDataContext) {
  const parsed = parseInlineRunFlowBlock(extraLines);
  const whenHTML = parsed.whenLines.length
    ? `<div class="subflow-inline-section"><div class="subflow-inline-label">when</div>${formatMultiLineBody(parsed.whenLines)}</div>`
    : '';
  const commandsHTML = parsed.commands.length
    ? `<div class="subflow-inline-section"><div class="subflow-inline-label">commands</div><div class="subflow-steps-content subflow-inline-commands">${parsed.commands.map((cmd, i) => renderSubflowStep(cmd, i, baseFilePath, testDataContext)).join('')}</div></div>`
    : '';
  return whenHTML + commandsHTML;
}

function parseObjectStyleBlock(extraLines) {
  const meaningful = extraLines.filter(l => l.trim());
  const indents = meaningful.map(l => (l.match(/^(\s+)/) || ['', ''])[1].length);
  const base = indents.length ? Math.min(...indents) : 0;
  const result = { file: '', envLines: [] };
  let inEnv = false;

  meaningful.forEach(line => {
    const indent = (line.match(/^(\s+)/) || ['', ''])[1].length;
    const trimmed = line.trim();
    if (indent === base && /^file:\s*/i.test(trimmed)) {
      result.file = trimmed.replace(/^file:\s*/i, '').trim().replace(/^['"]|['"]$/g, '');
      inEnv = false;
      return;
    }
    if (indent === base && /^env:\s*$/i.test(trimmed)) {
      inEnv = true;
      return;
    }
    if (inEnv) result.envLines.push(line);
  });

  return result;
}

function parseEnvLines(extraLines) {
  const meaningful = extraLines.filter(l => l.trim());
  const indents = meaningful.map(l => (l.match(/^(\s+)/) || ['', ''])[1].length);
  const base = indents.length ? Math.min(...indents) : 0;
  const env = {};
  meaningful.forEach(line => {
    const indent = (line.match(/^(\s+)/) || ['', ''])[1].length;
    const trimmed = line.trim();
    if (indent < base) return;
    const match = trimmed.match(/^([^:]+):\s*(.*)$/);
    if (!match) return;
    env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '');
  });
  return env;
}

function renderResolvedDataObject(obj, depth = 0) {
  if (!obj || typeof obj !== 'object') {
    return `<div class="subflow-prop-row" style="padding-left:${8 + depth * 12}px"><span class="subflow-prop-val">${String(obj ?? '')}</span></div>`;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => {
      if (item && typeof item === 'object') {
        return `<div class="subflow-prop-row" style="padding-left:${8 + depth * 12}px"><span class="subflow-prop-sep">-</span></div>${renderResolvedDataObject(item, depth + 1)}`;
      }
      return `<div class="subflow-prop-row" style="padding-left:${8 + depth * 12}px"><span class="subflow-prop-sep">- </span><span class="subflow-prop-val">${String(item ?? '')}</span></div>`;
    }).join('');
  }
  return Object.entries(obj).map(([key, val]) => {
    if (val && typeof val === 'object') {
      return `<div class="subflow-prop-row" style="padding-left:${8 + depth * 12}px"><span class="subflow-prop-key">${key}</span><span class="subflow-prop-sep">:</span></div>${renderResolvedDataObject(val, depth + 1)}`;
    }
    return `<div class="subflow-prop-row" style="padding-left:${8 + depth * 12}px"><span class="subflow-prop-key">${key}</span><span class="subflow-prop-sep">: </span><span class="subflow-prop-val">${String(val ?? '')}</span></div>`;
  }).join('');
}

async function expandRunScriptData(el, scriptPath, currentFile, envJson) {
  const content = el.querySelector('.preview-step-content, .subflow-nested-content');
  if (!content) return;
  if (content.dataset.loaded) { el.classList.toggle('expanded'); return; }
  content.innerHTML = '<div class="subflow-step"><span style="color:var(--text-muted);font-size:11px;">Loading…</span></div>';
  el.classList.add('expanded');
  try {
    const env = envJson ? JSON.parse(decodeURIComponent(envJson)) : {};
    const data = await fetch('/api/resolve-script-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentFile, scriptPath, env })
    }).then(r => r.json());
    if (data.error) throw new Error(data.error);

    const envHTML = Object.keys(data.env || {}).length
      ? `<div class="subflow-inline-section"><div class="subflow-inline-label">env</div>${renderResolvedDataObject(data.env)}</div>`
      : '';
    const userHTML = data.user
      ? `<div class="subflow-inline-section"><div class="subflow-inline-label">user data</div><div class="subflow-props-body">${renderResolvedDataObject(data.user)}</div></div>`
      : `<div class="subflow-inline-section"><div class="subflow-inline-label">user data</div><div class="subflow-props-body"><div class="subflow-prop-row" style="padding-left:8px"><span class="preview-inline-warn">⚠ No output.user resolved</span></div></div></div>`;

    content.innerHTML = envHTML + userHTML;
    content.dataset.loaded = '1';
  } catch (e) {
    content.innerHTML = `<div class="subflow-step"><span class="preview-inline-error">⚠ ${e.message}</span></div>`;
    content.dataset.loaded = '1';
  }
}

function renderSubflowStep(step, si, baseFilePath, testDataContext) {
  const allLines = step.split('\n');
  const fl = allLines[0].trim().replace(/^- /, '');
  const extraLines = allLines.slice(1);
  const hasExtra = extraLines.some(l => l.trim());
  const hasColon = fl.includes(':');
  const cmd = fl.split(':')[0].trim() || 'step';
  const rawV = hasColon ? fl.replace(/^[^:]+:\s*/, '').trim() : '';

  const typeMap = { runflow:'runflow', runscript:'runscript', tapon:'tapon', assertvisible:'assert', assertnotvisible:'assert', inputtext:'input' };
  const t2 = typeMap[cmd.toLowerCase()] || 'other';
  const isRunFlow = /^runFlow$/i.test(cmd);
  const isRunScript = /^runScript$/i.test(cmd);
  const isInlineRunFlow = isRunFlow && !rawV && hasExtra;
  const runScriptObj = isRunScript && !rawV && hasExtra ? parseObjectStyleBlock(extraLines) : null;
  const runScriptEnv = runScriptObj ? parseEnvLines(runScriptObj.envLines) : null;
  const isInlineRunScript = !!(runScriptObj && runScriptObj.file);
  const isExpandable = isRunFlow || isInlineRunScript || hasExtra;

  const displayVal = isRunFlow
    ? (rawV ? `<span class="preview-subflow-path">${rawV}</span>` : '')
    : isInlineRunScript
      ? `<span class="preview-subflow-path">${runScriptObj.file}</span>`
    : (rawV ? formatStepValue(rawV, testDataContext) : '');

  const safeRef  = rawV.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
  const safeBase = baseFilePath.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
  const safeScriptFile = isInlineRunScript ? runScriptObj.file.replace(/\\/g,'\\\\').replace(/'/g,"\\'") : '';
  const safeEnvJson = encodeURIComponent(JSON.stringify(runScriptEnv || {})).replace(/'/g, '%27');

  const onclick = isRunFlow
    ? (isInlineRunFlow
        ? `toggleSubflowMultiLine(this.closest('.subflow-nested-step'))`
        : `expandNestedRunFlow(this.closest('.subflow-nested-step'),'${safeRef}','${safeBase}')`)
    : isInlineRunScript
      ? `expandRunScriptData(this.closest('.subflow-nested-step'),'${safeScriptFile}','${safeBase}','${safeEnvJson}')`
    : (hasExtra ? `toggleSubflowMultiLine(this.closest('.subflow-nested-step'))` : '');

  const bodyHTML = !isRunFlow && hasExtra
    ? (isInlineRunScript
        ? `<div class="subflow-nested-content subflow-inline-runflow"></div>`
        : `<div class="subflow-nested-content subflow-props-body">${formatMultiLineBody(extraLines)}</div>`)
    : (isRunFlow
        ? (isInlineRunFlow
            ? `<div class="subflow-nested-content subflow-inline-runflow">${renderInlineRunFlowBody(extraLines, baseFilePath, testDataContext)}</div>`
            : `<div class="subflow-nested-content subflow-steps-content"></div>`)
        : '');

  return `<div class="subflow-nested-step${isExpandable?' expandable':''}"><div class="subflow-step"${onclick?` onclick="${onclick}" style="cursor:pointer;"`:''}><span class="preview-step-type type-${t2}" style="font-size:9px;padding:1px 5px;">${cmd}</span><span class="subflow-step-val">${displayVal}</span>${isExpandable?'<span class="preview-expand-arrow">▼</span>':''}<span style="flex:1"></span></div>${bodyHTML}</div>`;
}

function toggleSubflowMultiLine(el) {
  if (!el) return;
  el.classList.toggle('expanded');
}

function togglePreviewStep(el) {
  if (!el) return;
  el.classList.toggle('expanded');
}

async function autoExpandNestedSteps(container, baseFilePath) {
  const nestedSteps = container.querySelectorAll('.subflow-nested-step.expandable');
  for (const el of nestedSteps) {
    el.classList.add('expanded');
    const nestedContent = el.querySelector('.subflow-nested-content.subflow-steps-content');
    if (nestedContent && !nestedContent.dataset.loaded) {
      const subflowPath = el.querySelector('.preview-subflow-path')?.textContent?.trim() || '';
      if (subflowPath) {
        await expandNestedRunFlow(el, subflowPath, baseFilePath);
      }
    }
  }
}

async function expandAllSteps() {
  const currentFile = document.querySelector('.preview-container')?.getAttribute('data-current-file') || '';
  const steps = document.querySelectorAll('.preview-step.expandable');
  for (const el of steps) {
    el.classList.add('expanded');
    const content = el.querySelector('.preview-step-content.subflow-steps-content');
    if (content && !content.dataset.loaded) {
      const subflowPath = el.querySelector('.preview-subflow-path')?.textContent?.trim() || '';
      if (subflowPath && currentFile) {
        await expandRunFlow(el, subflowPath, currentFile);
      }
    } else if (content && content.dataset.loaded) {
      await autoExpandNestedSteps(content, currentFile);
    }
  }
}

function collapseAllSteps() {
  document.querySelectorAll('.preview-step.expandable').forEach(el => {
    el.classList.remove('expanded');
  });
  // Also collapse nested steps
  document.querySelectorAll('.subflow-nested-step.expandable').forEach(el => {
    el.classList.remove('expanded');
  });
}

async function expandRunFlow(el, subflowPath, currentFile) {
  const content = el.querySelector('.preview-step-content');
  if (!content) return;
  if (content.dataset.loaded) { el.classList.toggle('expanded'); return; }
  content.innerHTML = '<span style="color:var(--text-muted);font-size:11px;padding:6px;">Loading…</span>';
  el.classList.add('expanded');
  const resolved = resolveSubflowPath(currentFile, subflowPath);
  try {
    const data = await fetch(`/api/file?filePath=${encodeURIComponent(resolved)}`).then(r => r.json());
    if (data.error) throw new Error(data.error);
    const subSteps = parseYamlSteps(data.content);
    content.innerHTML = subSteps.length
      ? subSteps.map((s,si) => renderSubflowStep(s, si, resolved, {})).join('')
      : '<span style="color:var(--text-muted);font-size:11px;padding:6px;">No steps found in subflow</span>';
    content.dataset.loaded = '1';
    autoExpandNestedSteps(content, resolved);
  } catch (_) {
    content.innerHTML = `<span class="preview-inline-error" style="padding:6px;">⚠ Could not load: ${subflowPath}</span>`;
    content.dataset.loaded = '1';
  }
}

async function expandNestedRunFlow(el, subflowPath, baseFilePath) {
  if (!el) return;
  const content = el.querySelector('.subflow-nested-content');
  if (!content) return;
  if (content.dataset.loaded) {
    el.classList.toggle('expanded');
    return;
  }
  content.innerHTML = '<div class="subflow-step"><span style="color:var(--text-muted);font-size:11px;">Loading…</span></div>';
  el.classList.add('expanded');
  const resolved = resolveSubflowPath(baseFilePath, subflowPath);
  try {
    const data = await fetch(`/api/file?filePath=${encodeURIComponent(resolved)}`).then(r => r.json());
    if (data.error) throw new Error(data.error);
    const subSteps = parseYamlSteps(data.content);
    content.innerHTML = subSteps.length
      ? subSteps.map((s,si) => renderSubflowStep(s, si, resolved, {})).join('')
      : '<div class="subflow-step"><span style="color:var(--text-muted);font-size:11px;">No steps found</span></div>';
    content.dataset.loaded = '1';
    autoExpandNestedSteps(content, resolved);
  } catch (_) {
    content.innerHTML = `<span class="preview-inline-error" style="padding:6px;">⚠ Could not load: ${subflowPath}</span>`;
    content.dataset.loaded = '1';
  }
}

function toggleTestDataCard(el) {
  el.closest('.preview-testdata-card').classList.toggle('expanded');
}

async function resolvePreviewTestData(cardId, scriptPath, currentFile, env) {
  const card = document.getElementById(cardId);
  if (!card) {
    console.warn('[resolvePreviewTestData] Card not found:', cardId);
    return;
  }
  const body = card.querySelector('.preview-testdata-body');
  if (!body) {
    console.warn('[resolvePreviewTestData] Body not found in card:', cardId);
    return;
  }
  
  // If currentFile is empty, try to use builderCurrentFile
  let resolvedCurrentFile = currentFile;
  if (!resolvedCurrentFile) {
    resolvedCurrentFile = builderCurrentFile;
    console.warn('[resolvePreviewTestData] currentFile was empty, using builderCurrentFile:', resolvedCurrentFile);
  }
  
  if (!resolvedCurrentFile) {
    body.innerHTML = `<div style="padding:6px 12px;font-size:11px;color:#c62828;">⚠ No current file context</div>`;
    return;
  }
  
  try {
    console.log('[resolvePreviewTestData] Calling API:', { cardId, scriptPath, currentFile: resolvedCurrentFile, env });
    const response = await fetch('/api/resolve-script-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentFile: resolvedCurrentFile, scriptPath, env })
    });
    if (!response.ok) {
      throw new Error(`Server error: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    console.log('[resolvePreviewTestData] Response received:', { scriptPath, hasUser: !!data.user, user: data.user, consoleOutput: data.consoleOutput });
    if (data.error) throw new Error(data.error);
    
    // Display console output in terminal if available
    if (data.consoleOutput && data.consoleOutput.length > 0) {
      data.consoleOutput.forEach(line => {
        appendLine('stdout', line);
      });
    }
    
    if (data.user) {
      const html = renderResolvedDataObject(data.user);
      body.innerHTML = `<div style="padding: 4px 12px; font-size: 11px;">${html}</div>`;
    } else {
      body.innerHTML = `<div style="padding:6px 12px;font-size:11px;color:var(--text-muted);">&#9888; No output.user resolved</div>`;
    }
  } catch (e) {
    console.error('[resolvePreviewTestData] Error:', e);
    body.innerHTML = `<div style="padding:6px 12px;font-size:11px;color:#c62828;">&#9888; ${e.message}</div>`;
  }
}

function renderFlowPreview() {
  const container = document.getElementById('flow-preview');
  const editor = document.getElementById('yaml-editor');
  
  console.log('renderFlowPreview called:', {
    builderCurrentFile,
    hasEditor: !!editor,
    editorValue: editor?.value ? editor.value.length + ' chars' : 'empty'
  });
  
  if (!builderCurrentFile || !editor || !editor.value) {
    console.log('No file loaded or editor empty, showing empty state');
    if (container) {
      container.innerHTML = '<div class="builder-empty"><div class="builder-empty-icon">👁</div><div style="font-weight:600;">No file loaded</div></div>';
    }
    return;
  }

  const lines = editor.value.split('\n');
  const headerLines = [];
  const steps = [];
  let pastSeparator = false;
  let buffer = [];

  try {
    // Split on ---: before = header/metadata, after = flow steps
    lines.forEach(line => {
      const trimmed = line.trim();
      if (trimmed === '---') { pastSeparator = true; return; }
      if (!pastSeparator) {
        if (trimmed && !trimmed.startsWith('#')) headerLines.push(line);
        return;
      }
      if (trimmed.startsWith('#') || trimmed === '') return;
      if (trimmed.startsWith('- ')) {
        if (buffer.length) steps.push(buffer.join('\n'));
        buffer = [line];
      } else if (buffer.length) {
        buffer.push(line);
      }
    });
    if (buffer.length) steps.push(buffer.join('\n'));
  } catch (e) {
    console.error('Error parsing YAML:', e);
    if (container) {
      container.innerHTML = `<div class="builder-empty"><div class="builder-empty-icon">⚠️</div><div style="font-weight:600;">YAML Parse Error</div><div style="font-size:12px;color:var(--text-dim);margin-top:4px;">${e.message}</div></div>`;
    }
    return;
  }

  // Parse header key-value pairs (handles list values inline)
  const header = {};
  let currentKey = null;
  headerLines.forEach(line => {
    const topKey = line.match(/^(\w+):\s*(.*)/);
    if (topKey) {
      currentKey = topKey[1];
      header[currentKey] = topKey[2].trim() || [];
    } else if (currentKey && line.trim().startsWith('- ')) {
      const val = line.trim().replace(/^- /, '');
      if (!Array.isArray(header[currentKey])) header[currentKey] = [];
      header[currentKey].push(val);
    }
  });

  // Build header bar — substitute real appId based on platform/app selection
  const resolvedAppId = BUILDER_APP_IDS[builderPlatform][builderApp];
  if (header['appId']) header['appId'] = resolvedAppId;
  // Also update the appId display in the controls bar
  const appIdEl = document.getElementById('preview-appid');
  if (appIdEl) appIdEl.textContent = resolvedAppId;

  const headerParts = ['appId', 'name', 'tags']
    .filter(k => header[k] !== undefined && header[k] !== '')
    .map(k => {
      const v = Array.isArray(header[k]) ? header[k].join(', ') : header[k];
      return `<span class="preview-meta-key">${k}</span><span class="preview-meta-val">${v}</span>`;
    });
  const headerHTML = headerParts.length
    ? `<div class="preview-meta">${headerParts.join('<span class="preview-meta-sep">·</span>')}</div>`
    : '';

  if (steps.length === 0) {
    container.innerHTML = headerHTML + '<div class="builder-empty"><div class="builder-empty-icon">📋</div><div style="font-weight:600;">No steps found after ---</div></div>';
    return;
  }

  const currentFile = builderCurrentFile || '';

  const testDataCards = [];
  const rawYaml = editor.value;
  const rsRegex = /-[ \t]+runScript:[ \t]*\n((?:[ \t]+[^\n]*\n?)*)/g;
  let rsm;
  let tdIdx = 0;
  while ((rsm = rsRegex.exec(rawYaml)) !== null) {
    const block = rsm[1];
    const fm = block.match(/file:[ \t]+([^\n]+)/i);
    if (!fm) continue;
    const scriptPath = fm[1].trim().replace(/^['"]|['"]$/g, '');
    const env = {};
    let inEnv = false;
    let envIndent = -1;
    block.split('\n').forEach(line => {
      if (!line.trim()) return;
      const indent = (line.match(/^([ \t]+)/) || ['',''])[1].length;
      if (/env:[ \t]*$/.test(line.trim())) { inEnv = true; envIndent = indent; return; }
      if (inEnv && indent > envIndent) {
        const kv = line.match(/^[ \t]+(\w+):[ \t]*(.*)$/);
        if (kv) env[kv[1]] = kv[2].trim().replace(/^['"]|['"]$/g, '');
      } else if (inEnv && indent <= envIndent) {
        inEnv = false;
      }
    });
    console.log('[Preview] runScript detected:', { scriptPath, env, currentFile });
    const cardId = 'testdata-card-' + tdIdx++;
    const envEntries = Object.entries(env);
    const crumbParts = envEntries.map(function(e) {
      return '<span class="td-key">' + e[0] + '</span><span class="td-sep"> › </span><span class="td-val">' + e[1] + '</span>';
    }).join('<span class="td-sep"> &middot; </span>');
    const crumbHTML = crumbParts || ('<span class="td-key">' + scriptPath + '</span>');
    const cardHTML =
      '<div class="preview-testdata-card expanded" id="' + cardId + '">' +
        '<div class="preview-testdata-hdr" onclick="toggleTestDataCard(this)">' +
          '<span class="preview-testdata-crumb">' +
            '<span class="td-cat">Test Data</span>' +
            '<span class="td-sep"> › </span>' +
            crumbHTML +
          '</span>' +
          '<span class="preview-expand-arrow">&#9660;</span>' +
        '</div>' +
        '<div class="preview-testdata-body">' +
          '<div style="padding:6px 12px;font-size:11px;color:var(--text-muted);">Loading...</div>' +
        '</div>' +
      '</div>';
    testDataCards.push({ cardId: cardId, scriptPath: scriptPath, env: env, html: cardHTML });
  }
  const testDataHTML = testDataCards.length
    ? '<div class="preview-testdata-wrap">' + testDataCards.map(function(c){return c.html;}).join('') + '</div>'
    : '';

  // Build a map of loaded test data for reference
  const testDataMap = {};
  testDataCards.forEach(card => {
    Object.assign(testDataMap, card.env);
  });

  const stepsHTML = steps.map((step, i) => {
    const allLines = step.split('\n');
    const firstLine = allLines[0].trim().replace(/^- /, '');
    const extraLines = allLines.slice(1);
    const hasExtra = extraLines.some(l => l.trim());
    const hasColon = firstLine.includes(':');
    let type = 'other', typeLabel = 'step', isRunFlow = false, subflowRef = '';

    if (/^runFlow:/i.test(firstLine)) {
      type = 'runflow'; typeLabel = 'runFlow'; isRunFlow = true;
      subflowRef = firstLine.replace(/^runFlow:\s*/i, '').trim();
    } else if (/^runScript:/i.test(firstLine)) {
      type = 'runscript'; typeLabel = 'runScript';
      subflowRef = firstLine.replace(/^runScript:\s*/i, '').trim();
    } else if (/^tapOn:/i.test(firstLine)) {
      type = 'tapon'; typeLabel = 'tapOn';
    } else if (/^assertVisible:|^assertNotVisible:/i.test(firstLine)) {
      type = 'assert'; typeLabel = firstLine.split(':')[0];
    } else if (/^inputText:/i.test(firstLine)) {
      type = 'input'; typeLabel = 'inputText';
    } else {
      typeLabel = firstLine.split(':')[0] || 'step';
    }

    const isRunScript = /^runScript$/i.test(typeLabel);
    const isInlineRunFlow = isRunFlow && !subflowRef && hasExtra;
    const runScriptObj = isRunScript && !subflowRef && hasExtra ? parseObjectStyleBlock(extraLines) : null;
    const runScriptEnv = runScriptObj ? parseEnvLines(runScriptObj.envLines) : null;
    const isInlineRunScript = !!(runScriptObj && runScriptObj.file);
    const expandable = isRunFlow || (hasExtra && !isInlineRunScript);
    const rawVal = hasColon ? firstLine.replace(/^[^:]+:\s*/, '').trim() : '';
    const formattedVal = isRunFlow
      ? (subflowRef ? `<span class="preview-subflow-path">${subflowRef}</span>` : '')
      : isInlineRunScript
        ? `<span class="preview-subflow-path">${runScriptObj.file}</span>`
      : (rawVal ? formatStepValue(rawVal, testDataMap) : '');

    const safeRef  = subflowRef.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    const safeFile = currentFile.replace(/\\/g,'\\\\').replace(/'/g,"\\'");
    const safeScriptFile = isInlineRunScript ? runScriptObj.file.replace(/\\/g,'\\\\').replace(/'/g,"\\'") : '';
    const safeEnvJson = encodeURIComponent(JSON.stringify(runScriptEnv || {})).replace(/'/g, '%27');
    const clickHandler = isInlineRunScript
      ? ''
      : isRunFlow
        ? (isInlineRunFlow
            ? `togglePreviewStep(this.closest('.preview-step'))`
            : `expandRunFlow(this.closest('.preview-step'),'${safeRef}','${safeFile}')`)
        : (hasExtra
            ? `togglePreviewStep(this.closest('.preview-step'))`
            : '');

    const multiBody = !isRunFlow && hasExtra && !isInlineRunScript
      ? `<div class="preview-step-content subflow-props-body">${formatMultiLineBody(extraLines)}</div>`
      : '';
    const runFlowBody = isRunFlow
      ? (isInlineRunFlow
          ? `<div class="preview-step-content subflow-inline-runflow">${renderInlineRunFlowBody(extraLines, currentFile, testDataMap)}</div>`
          : `<div class="preview-step-content subflow-steps-content"></div>`)
      : '';

    return `
      <div class="preview-step ${expandable ? 'expandable expanded' : ''}" id="pstep-${i}">
        <div class="preview-step-header"${clickHandler?` onclick="${clickHandler}"`:''}>
          <span style="color:var(--text-muted);font-size:10px;min-width:20px;">${i + 1}</span>
          <span class="preview-step-type type-${type}">${typeLabel}</span>
          <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${formattedVal}</span>
          ${expandable ? '<span class="preview-expand-arrow">▼</span>' : ''}
          <span style="flex:1;"></span>
        </div>
        ${multiBody}${runFlowBody}
      </div>`;
  }).join('');

  const expandCollapseHTML = `
    <div style="display:flex;gap:8px;margin-bottom:12px;">
      <button onclick="expandAllSteps()" style="padding:6px 12px;background:var(--cvs-red);color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600;">Expand All</button>
      <button onclick="collapseAllSteps()" style="padding:6px 12px;background:var(--text-muted);color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600;">Collapse All</button>
    </div>
  `;
  container.innerHTML = headerHTML + expandCollapseHTML + testDataHTML + stepsHTML;
  container.setAttribute('data-current-file', currentFile);
  // Delay slightly to ensure DOM is ready
  setTimeout(() => {
    console.log('[renderFlowPreview] About to resolve test data cards:', testDataCards.length);
    testDataCards.forEach(({ cardId, scriptPath, env }) => {
      console.log('[renderFlowPreview] Resolving test data:', { cardId, scriptPath, env, currentFile });
      const card = document.getElementById(cardId);
      console.log('[renderFlowPreview] Card found:', !!card, 'cardId:', cardId);
      resolvePreviewTestData(cardId, scriptPath, currentFile, env);
    });
  }, 100);
  
  // Load all runFlow content by default since steps are expanded
  setTimeout(() => {
    document.querySelectorAll('.preview-step.expandable').forEach(el => {
      const content = el.querySelector('.preview-step-content.subflow-steps-content');
      if (content && !content.dataset.loaded) {
        const subflowPath = el.querySelector('.preview-subflow-path')?.textContent || '';
        if (subflowPath) {
          expandRunFlow(el, subflowPath, currentFile);
        }
      }
    });
  }, 0);
}

async function showNewFlowDialog() {
  const overlay = document.getElementById('new-flow-overlay');
  const dirSel = document.getElementById('new-flow-dir');
  overlay.style.display = 'flex';
  try {
    const dirs = await fetch('/api/flow-folders').then(r => r.json());
    dirSel.innerHTML = '<option value="">— Select folder —</option>' +
      dirs.map(d => `<option value="${d}">${d}</option>`).join('');
  } catch (_) {}
  document.getElementById('new-flow-name').value = '';
}

async function showNewSubflowDialog() {
  const overlay = document.getElementById('new-flow-overlay');
  const dirSel = document.getElementById('new-flow-dir');
  overlay.style.display = 'flex';
  try {
    const dirs = await fetch('/api/subflow-folders').then(r => r.json());
    dirSel.innerHTML = '<option value="">— Select folder —</option>' +
      dirs.map(d => `<option value="${d}">${d}</option>`).join('');
  } catch (_) {}
  document.getElementById('new-flow-name').value = '';
}

function closeNewFlowDialog() {
  document.getElementById('new-flow-overlay').style.display = 'none';
}

async function createNewFlow() {
  const dir = document.getElementById('new-flow-dir').value;
  const name = document.getElementById('new-flow-name').value.trim();
  if (!dir || !name) return alert('Please select a folder and enter a file name.');
  try {
    const data = await fetch('/api/new-flow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dir, name })
    }).then(r => r.json());
    if (data.error) return alert('Error: ' + data.error);
    closeNewFlowDialog();
    await loadBuilderTree();
    const el = document.querySelector(`.tree-file[data-path="${data.path}"]`);
    if (el) el.click();
  } catch (e) {
    alert('Failed to create file: ' + e.message);
  }
}

// ── Lazy loading and performance optimizations ────────────────────────────────
let setupTabLoaded = false;

function lazyLoadSetupTab() {
  if (setupTabLoaded) return;
  
  // Only load setup checks when setup tab is first activated
  const setupTab = document.querySelector('[data-tab="setup"]');
  if (setupTab && setupTab.classList.contains('active')) {
    setupTabLoaded = true;
    // Use setTimeout to not block initial render
    setTimeout(() => {
      runSetupChecks();
    }, 100);
  }
}

// ── Init ──────────────────────────────────────────────────────────────────────
loadSelects();
updatePreview();
updateCheckboxVisibility();
loadLatestReport();

// Lazy load setup checks
document.addEventListener('DOMContentLoaded', () => {
  // Check if setup tab is already active
  lazyLoadSetupTab();
  
  // Add listener for tab changes
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      if (tab.dataset.tab === 'setup') {
        lazyLoadSetupTab();
      }
    });
  });
});
