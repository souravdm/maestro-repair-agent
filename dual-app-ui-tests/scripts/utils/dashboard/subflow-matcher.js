#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

/**
 * Subflow Matcher
 * Scans .yaml files in subflows/ directory to find matching subflows
 * Returns confidence levels for subflow matches
 */
class SubflowMatcher {
  constructor() {
    this.subflows = new Map();
    this.cache = new Map();
  }

  async loadSubflows() {
    try {
      const subflowsDir = path.join(__dirname, '..', '..', '..', '.maestro', 'subflows');
      await this.scanDirectory(subflowsDir, '');
      console.log(`✅ Loaded ${this.subflows.size} subflows`);
    } catch (error) {
      console.error('❌ Error loading subflows:', error.message);
    }
  }

  async scanDirectory(baseDir, relativePath) {
    const dirPath = relativePath ? path.join(baseDir, relativePath) : baseDir;
    const entries = await fs.readdir(dirPath);

    for (const entry of entries) {
      const entryPath = path.join(dirPath, entry);
      const stat = await fs.stat(entryPath);

      if (stat.isDirectory()) {
        const subRelative = relativePath ? `${relativePath}/${entry}` : entry;
        await this.scanDirectory(baseDir, subRelative);
      } else if (entry.endsWith('.yaml')) {
        const content = await fs.readFile(entryPath, 'utf8');
        const area = relativePath || 'common';
        this.extractSubflowInfo(content, area, entry, entryPath);
      }
    }
  }

  extractSubflowInfo(content, area, file, filePath) {
    const relativePath = `../../subflows/${area}/${file}`.replace(/\\/g, '/');
    const fileName = file.replace('.yaml', '');
    
    // Extract actions from the subflow
    const actions = this.extractActions(content);
    
    // Determine subflow type based on file name and actions
    const type = this.determineSubflowType(fileName, actions, area);
    
    this.subflows.set(relativePath, {
      name: fileName,
      area: area,
      file: file,
      path: relativePath,
      type: type,
      actions: actions,
      keywords: this.generateKeywords(fileName, actions, area)
    });
  }

  extractActions(content) {
    const actions = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      if (trimmed.startsWith('- tapOn:')) {
        const target = trimmed.replace('- tapOn:', '').trim().replace(/['"]/g, '');
        actions.push({ type: 'tapOn', target });
      } else if (trimmed.startsWith('- inputText:')) {
        const target = trimmed.replace('- inputText:', '').trim().replace(/['"]/g, '');
        actions.push({ type: 'inputText', target });
      } else if (trimmed.startsWith('- assertVisible:')) {
        const target = trimmed.replace('- assertVisible:', '').trim().replace(/['"]/g, '');
        actions.push({ type: 'assertVisible', target });
      } else if (trimmed.startsWith('- runFlow:')) {
        const target = trimmed.replace('- runFlow:', '').trim();
        actions.push({ type: 'runFlow', target });
      } else if (trimmed.startsWith('- launchApp')) {
        actions.push({ type: 'launchApp' });
      } else if (trimmed.startsWith('- clearState')) {
        actions.push({ type: 'clearState' });
      }
    }
    
    return actions;
  }

  determineSubflowType(fileName, actions, area) {
    const name = fileName.toLowerCase();
    
    // Authentication related
    if (name.includes('signin') || name.includes('login') || name.includes('auth') || 
        name.includes('otp') || name.includes('email')) {
      return 'authentication';
    }
    
    // Launch related
    if (name.includes('launch') || name.includes('app') || name.includes('start')) {
      return 'launch';
    }
    
    // Search related
    if (name.includes('search') || name.includes('find')) {
      return 'search';
    }
    
    // Checkout related
    if (name.includes('checkout') || name.includes('payment') || name.includes('cart')) {
      return 'checkout';
    }
    
    // Pharmacy related
    if (area.includes('pharmacy') || name.includes('prescription') || name.includes('refill')) {
      return 'pharmacy';
    }
    
    // Shop related
    if (area.includes('shop') || name.includes('product') || name.includes('item')) {
      return 'shop';
    }
    
    // Account related
    if (area.includes('account') || name.includes('profile') || name.includes('user')) {
      return 'account';
    }
    
    return 'general';
  }

  generateKeywords(fileName, actions, area) {
    const keywords = new Set();
    
    // Add file name words
    fileName.toLowerCase().split(/[-_]/).forEach(word => {
      if (word.length > 2) keywords.add(word);
    });
    
    // Add area name
    keywords.add(area.toLowerCase());
    
    // Add action targets
    actions.forEach(action => {
      if (action.target) {
        action.target.toLowerCase().split(/\s+/).forEach(word => {
          if (word.length > 2) keywords.add(word);
        });
      }
    });
    
    // Add action types
    actions.forEach(action => {
      keywords.add(action.type.toLowerCase());
    });
    
    return Array.from(keywords);
  }

  findBestMatch(steps) {
    const cacheKey = JSON.stringify(steps);
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const matches = [];
    const stepKeywords = this.extractStepKeywords(steps);

    for (const [path, subflow] of this.subflows) {
      const confidence = this.calculateSubflowConfidence(stepKeywords, subflow, steps);
      
      if (confidence > 0) {
        matches.push({
          subflow,
          confidence,
          matchReason: this.getMatchReason(stepKeywords, subflow, steps)
        });
      }
    }

    // Sort by confidence descending
    matches.sort((a, b) => b.confidence - a.confidence);
    
    const result = {
      matches: matches.slice(0, 5), // Top 5 matches
      bestMatch: matches[0] || null,
      confidence: matches[0] ? matches[0].confidence : 0
    };

    this.cache.set(cacheKey, result);
    return result;
  }

  extractStepKeywords(steps) {
    const keywords = new Set();
    
    steps.forEach(step => {
      // Add action type
      keywords.add(step.action.toLowerCase());
      
      // Add target words
      if (step.target) {
        step.target.toLowerCase().split(/\s+/).forEach(word => {
          if (word.length > 2) keywords.add(word);
        });
      }
      
      // Add description words
      if (step.description) {
        step.description.toLowerCase().split(/\s+/).forEach(word => {
          if (word.length > 2) keywords.add(word);
        });
      }
    });
    
    return Array.from(keywords);
  }

  calculateSubflowConfidence(stepKeywords, subflow, steps) {
    let confidence = 0;
    
    // Type matching
    const stepTypes = steps.map(s => s.action).join(' ').toLowerCase();
    const subflowType = subflow.type.toLowerCase();
    
    if (stepTypes.includes('signin') || stepTypes.includes('login') || stepTypes.includes('email') || stepTypes.includes('password')) {
      if (subflowType === 'authentication') confidence += 80;
    }
    
    if (stepTypes.includes('launch') || stepTypes.includes('start')) {
      if (subflowType === 'launch') confidence += 80;
    }
    
    if (stepTypes.includes('search')) {
      if (subflowType === 'search') confidence += 80;
    }
    
    if (stepTypes.includes('checkout') || stepTypes.includes('payment')) {
      if (subflowType === 'checkout') confidence += 80;
    }
    
    // Keyword matching
    const keywordMatches = stepKeywords.filter(keyword => 
      subflow.keywords.includes(keyword)
    ).length;
    
    if (keywordMatches > 0) {
      confidence += (keywordMatches / Math.max(stepKeywords.length, subflow.keywords.length)) * 50;
    }
    
    // Action overlap
    const stepActionTypes = steps.map(s => s.action);
    const subflowActionTypes = subflow.actions.map(a => a.type);
    const actionOverlap = stepActionTypes.filter(type => 
      subflowActionTypes.includes(type)
    ).length;
    
    if (actionOverlap > 0) {
      confidence += (actionOverlap / Math.max(stepActionTypes.length, subflowActionTypes.length)) * 30;
    }
    
    // Step count bonus (prefer subflows that handle multiple steps)
    if (steps.length > 1 && subflow.actions.length >= steps.length) {
      confidence += 20;
    }
    
    return Math.min(confidence, 100);
  }

  getMatchReason(stepKeywords, subflow, steps) {
    const reasons = [];
    
    const stepTypes = steps.map(s => s.action).join(' ').toLowerCase();
    
    if (stepTypes.includes('signin') && subflow.type === 'authentication') {
      reasons.push('Authentication flow match');
    }
    
    if (stepTypes.includes('launch') && subflow.type === 'launch') {
      reasons.push('Launch flow match');
    }
    
    const keywordMatches = stepKeywords.filter(keyword => 
      subflow.keywords.includes(keyword)
    ).length;
    
    if (keywordMatches > 0) {
      reasons.push(`${keywordMatches} keyword matches`);
    }
    
    const stepActionTypes = steps.map(s => s.action);
    const subflowActionTypes = subflow.actions.map(a => a.type);
    const actionOverlap = stepActionTypes.filter(type => 
      subflowActionTypes.includes(type)
    ).length;
    
    if (actionOverlap > 0) {
      reasons.push(`${actionOverlap} action type matches`);
    }
    
    return reasons.join(', ') || 'General similarity';
  }

  async findSubflowForSteps(steps) {
    await this.loadSubflows();
    return this.findBestMatch(steps);
  }
}

// Export for use in main flow
module.exports = { SubflowMatcher };

// CLI usage
if (require.main === module) {
  const matcher = new SubflowMatcher();
  const steps = [
    { action: 'tapOn', target: 'Sign In button' },
    { action: 'inputText', target: 'email field' },
    { action: 'inputText', target: 'password field' },
    { action: 'tapOn', target: 'Login button' }
  ];
  
  matcher.findSubflowForSteps(steps)
    .then(result => {
      console.log('=== Subflow Match Results ===');
      console.log(`Best match confidence: ${result.confidence}%`);
      if (result.bestMatch) {
        console.log(`Best match: ${result.bestMatch.subflow.path}`);
        console.log(`Type: ${result.bestMatch.subflow.type}`);
        console.log(`Reason: ${result.bestMatch.matchReason}`);
      }
      console.log('\nTop 5 matches:');
      result.matches.forEach((match, index) => {
        console.log(`${index + 1}. ${match.subflow.path} (${match.confidence}% - ${match.matchReason})`);
      });
    })
    .catch(console.error);
}
