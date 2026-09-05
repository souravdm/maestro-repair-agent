#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');

/**
 * Screen Object Matcher
 * Scans .js files in screens/ directory to find matching screen objects
 * Returns confidence levels for matches
 */
class ScreenObjectMatcher {
  constructor() {
    this.screenObjects = new Map();
    this.cache = new Map();
  }

  async loadScreenObjects() {
    try {
      const screensDir = path.join(__dirname, '..', '..', '..', '.maestro', 'screens');
      const areas = await fs.readdir(screensDir);
      
      for (const area of areas) {
        const areaPath = path.join(screensDir, area);
        const stat = await fs.stat(areaPath);
        
        if (stat.isDirectory()) {
          const files = await fs.readdir(areaPath);
          for (const file of files) {
            if (file.endsWith('.js')) {
              const filePath = path.join(areaPath, file);
              const content = await fs.readFile(filePath, 'utf8');
              
              // Extract element definitions using multiple patterns
              this.extractElementsFromContent(content, area, file);
            }
          }
        }
      }
      
      console.log(`✅ Loaded ${this.screenObjects.size} screen objects from ${areas.length} areas`);
    } catch (error) {
      console.error('❌ Error loading screen objects:', error.message);
    }
  }

  extractElementsFromContent(content, area, file) {
    // Pattern 1: CVS output object pattern
    // output.account_signIn = { signInBtn: "Sign in", passwordField: "Password" }
    const pattern1 = /output\.(\w+)\s*=\s*\{([^}]+)\}/g;
    
    // Pattern 2: Standard element definition
    // const element = { id: 'selector', ... }
    const pattern2 = /(?:const|let|var)\s+(\w+)\s*=\s*\{[^}]*id\s*:\s*['"`]([^'"`]+)['"`]/g;
    
    // Pattern 3: Exported element
    // exports.elementName = { id: 'selector', ... }
    const pattern3 = /exports\.(\w+)\s*=\s*\{[^}]*id\s*:\s*['"`]([^'"`]+)['"`]/g;
    
    // Pattern 4: Object property
    // elementName: { id: 'selector', ... }
    const pattern4 = /(\w+)\s*:\s*\{[^}]*id\s*:\s*['"`]([^'"`]+)['"`]/g;
    
    // Handle CVS output object pattern separately
    let match;
    while ((match = pattern1.exec(content)) !== null) {
      const [, screenName, objectContent] = match;
      
      // Extract individual elements from the object content
      const elementPattern = /(\w+)\s*:\s*['"`]([^'"`]+)['"`]/g;
      let elementMatch;
      while ((elementMatch = elementPattern.exec(objectContent)) !== null) {
        const [, elementName, elementSelector] = elementMatch;
        const key = `${area}.${screenName}.${elementName}`;
        
        this.screenObjects.set(key, {
          name: elementName,
          screenName: screenName,
          id: elementSelector,
          area: area,
          file: file,
          fullPath: `output.${screenName}.${elementName}`,
          selector: elementSelector
        });
      }
    }
    
    // Handle other patterns
    const otherPatterns = [pattern2, pattern3, pattern4];
    for (const pattern of otherPatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const [, elementName, elementId] = match;
        const key = `${area}.${elementName}`;
        
        this.screenObjects.set(key, {
          name: elementName,
          id: elementId,
          area: area,
          file: file,
          fullPath: `output.${area}.${elementName}`,
          selector: elementId
        });
      }
    }
  }

  findBestMatch(targetText) {
    if (this.cache.has(targetText)) {
      return this.cache.get(targetText);
    }

    const matches = [];
    const normalizedTarget = targetText.toLowerCase().trim();

    for (const [key, element] of this.screenObjects) {
      const confidence = this.calculateConfidence(normalizedTarget, element);
      
      if (confidence > 0) {
        matches.push({
          element,
          confidence,
          matchType: this.getMatchType(normalizedTarget, element)
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

    this.cache.set(targetText, result);
    return result;
  }

  calculateConfidence(targetText, element) {
    const elementName = element.name.toLowerCase();
    const elementId = element.id.toLowerCase();
    const elementArea = element.area.toLowerCase();

    let confidence = 0;

    // Exact matches
    if (targetText === elementName) confidence += 100;
    if (targetText === elementId) confidence += 100;
    if (targetText === `${elementArea} ${elementName}`) confidence += 95;
    if (targetText === `${elementName} ${elementArea}`) confidence += 95;

    // Contains matches
    if (targetText.includes(elementName) && elementName.length > 2) confidence += 80;
    if (elementName.includes(targetText) && targetText.length > 2) confidence += 80;
    if (targetText.includes(elementId) && elementId.length > 2) confidence += 75;
    if (elementId.includes(targetText) && targetText.length > 2) confidence += 75;

    // Word-based matching
    const targetWords = targetText.split(/\s+/);
    const elementWords = elementName.split(/(?=[A-Z])|\s+/);
    
    for (const targetWord of targetWords) {
      if (targetWord.length > 2) {
        for (const elementWord of elementWords) {
          if (elementWord.toLowerCase() === targetWord) {
            confidence += 30;
          } else if (elementWord.toLowerCase().includes(targetWord)) {
            confidence += 15;
          } else if (targetWord.includes(elementWord.toLowerCase())) {
            confidence += 15;
          }
        }
      }
    }

    // Fuzzy matching using Levenshtein distance
    const similarity = this.calculateSimilarity(targetText, elementName);
    if (similarity > 0.7) {
      confidence += similarity * 40;
    }

    return Math.min(confidence, 100);
  }

  calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  levenshteinDistance(str1, str2) {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  getMatchType(targetText, element) {
    const targetLower = targetText.toLowerCase();
    const elementName = element.name.toLowerCase();
    const elementId = element.id.toLowerCase();

    if (targetLower === elementName || targetLower === elementId) return 'exact';
    if (targetLower.includes(elementName) || elementName.includes(targetLower)) return 'contains';
    if (targetLower.includes(elementId) || elementId.includes(targetLower)) return 'id-contains';
    return 'fuzzy';
  }

  async resolvePlaceholders(yamlContent) {
    await this.loadScreenObjects();
    
    // Step 1: Fix output object format issues first
    const formatFixedYaml = this.fixOutputObjectFormat(yamlContent);
    
    // Step 2: Find all tapOn, inputText, assertVisible with string selectors
    const selectorPattern = /- (tapOn|inputText|assertVisible):\s*"([^"]+)"/g;
    const resolutions = [];
    let resolvedYaml = formatFixedYaml;

    let match;
    while ((match = selectorPattern.exec(resolvedYaml)) !== null) {
      const [fullMatch, action, selector] = match;
      const matchResult = this.findBestMatch(selector);
      
      if (matchResult.bestMatch && matchResult.confidence >= 70) {
        const replacement = `- ${action}: ${matchResult.bestMatch.element.fullPath}`;
        resolvedYaml = resolvedYaml.replace(fullMatch, replacement);
        
        resolutions.push({
          type: 'screen-object',
          original: fullMatch,
          replacement: replacement,
          selector: selector,
          matchedElement: matchResult.bestMatch.element,
          confidence: matchResult.confidence,
          matchType: matchResult.bestMatch.matchType
        });
      } else {
        resolutions.push({
          type: 'screen-object',
          original: fullMatch,
          replacement: fullMatch,
          selector: selector,
          matchedElement: null,
          confidence: matchResult.confidence,
          matchType: 'no-match'
        });
      }
    }

    return {
      resolvedYaml,
      resolutions,
      totalPlaceholders: resolutions.length,
      resolvedCount: resolutions.filter(r => r.confidence >= 70).length
    };
  }

  fixOutputObjectFormat(yamlContent) {
    console.log('🔧 Fixing output object format issues');
    
    let fixedYaml = yamlContent;
    const fixes = [];
    
    // Simple line-by-line approach to avoid regex conflicts
    const lines = fixedYaml.split('\n');
    const processedLines = lines.map(line => {
      const trimmed = line.trim();
      
      // Only process lines that start with action commands
      if (trimmed.startsWith('- tapOn:') || trimmed.startsWith('- inputText:') || trimmed.startsWith('- assertVisible:')) {
        const colonIndex = trimmed.indexOf(':');
        if (colonIndex > 0) {
          const action = trimmed.substring(2, colonIndex).trim(); // Remove "- " and get action
          const target = trimmed.substring(colonIndex + 1).trim();
          
          // Fix case 1: output.xxx.xxx without ${} wrapper
          if (target.startsWith('output.') && !target.startsWith('${output.') && !target.includes('}')) {
            const fixedTarget = `\${${target}}`;
            const fixedLine = `- ${action}: ${fixedTarget}`;
            fixes.push(`Fixed ${action}: ${target} → ${fixedTarget}`);
            return fixedLine;
          }
          
          // Fix case 2: ${output.xxx.xxx without closing }
          if (target.startsWith('${output.') && !target.endsWith('}')) {
            const fixedTarget = `${target}}`;
            const fixedLine = `- ${action}: ${fixedTarget}`;
            fixes.push(`Fixed ${action}: ${target} → ${fixedTarget}`);
            return fixedLine;
          }
        }
      }
      
      return line;
    });
    
    fixedYaml = processedLines.join('\n');
    
    if (fixes.length > 0) {
      console.log(`✅ Fixed ${fixes.length} output object format issues`);
      fixes.forEach(fix => console.log(`  - ${fix}`));
    }
    
    return fixedYaml;
  }
}

// Export for use in main flow
module.exports = { ScreenObjectMatcher };

// CLI usage
if (require.main === module) {
  const matcher = new ScreenObjectMatcher();
  const targetText = process.argv[2] || 'Sign In';
  
  matcher.loadScreenObjects()
    .then(() => {
      const result = matcher.findBestMatch(targetText);
      console.log(`=== Screen Object Match Results for "${targetText}" ===`);
      console.log(`Best match confidence: ${result.confidence}%`);
      if (result.bestMatch) {
        console.log(`Best match: ${result.bestMatch.element.fullPath}`);
        console.log(`Match type: ${result.bestMatch.matchType}`);
      }
      console.log('\nTop 5 matches:');
      result.matches.forEach((match, index) => {
        console.log(`${index + 1}. ${match.element.fullPath} (${match.confidence}% - ${match.matchType})`);
      });
    })
    .catch(console.error);
}
