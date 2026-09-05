#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
// Node.js 18+ has built-in fetch

/**
 * Step 4: Find best matches for unknown screen objects/flows with confidence scoring
 * Uses Ollama to match placeholders with actual screen objects and flows
 */
class ElementMatcher {
  constructor() {
    this.screenObjects = new Map();
    this.subflows = new Map();
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
              
              // Extract element names from screen object files
              const elementMatches = content.match(/(\w+):\s*\{[^}]*id:\s*['"`]([^'"`]+)['"`]/g);
              if (elementMatches) {
                for (const match of elementMatches) {
                  const [, elementName, elementId] = match.match(/(\w+):\s*\{[^}]*id:\s*['"`]([^'"`]+)['"`]/);
                  this.screenObjects.set(elementName, {
                    name: elementName,
                    id: elementId,
                    area: area,
                    file: file,
                    fullPath: `output.${area}.${elementName}`
                  });
                }
              }
            }
          }
        }
      }
      
      console.log(`Loaded ${this.screenObjects.size} screen objects`);
    } catch (error) {
      console.error('Error loading screen objects:', error.message);
    }
  }

  async loadSubflows() {
    try {
      const subflowsDir = path.join(__dirname, '..', '..', '..', '.maestro', 'subflows');
      const areas = await fs.readdir(subflowsDir);
      
      for (const area of areas) {
        const areaPath = path.join(subflowsDir, area);
        const stat = await fs.stat(areaPath);
        
        if (stat.isDirectory()) {
          const files = await fs.readdir(areaPath);
          for (const file of files) {
            if (file.endsWith('.yaml')) {
              const filePath = path.join(areaPath, file);
              const content = await fs.readFile(filePath, 'utf8');
              
              this.subflows.set(file, {
                name: file.replace('.yaml', ''),
                area: area,
                file: file,
                fullPath: `../../subflows/${area}/${file}`,
                content: content.substring(0, 500) // First 500 chars for matching
              });
            }
          }
        }
      }
      
      console.log(`Loaded ${this.subflows.size} subflows`);
    } catch (error) {
      console.error('Error loading subflows:', error.message);
    }
  }

  async findBestMatchWithOllama(placeholder, type = 'element') {
    const cacheKey = `${type}:${placeholder}`;
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
    const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';

    let candidates = [];
    let context = '';

    if (type === 'element') {
      candidates = Array.from(this.screenObjects.values());
      context = candidates.map(obj => 
        `${obj.fullPath} - ${obj.id} (${obj.area})`
      ).join('\n');
    } else if (type === 'subflow') {
      candidates = Array.from(this.subflows.values());
      context = candidates.map(flow => 
        `${flow.fullPath} - ${flow.name} (${flow.area})\n${flow.content}`
      ).join('\n');
    }

    const systemPrompt = `You are a Maestro expert. Find the best match for a placeholder from available options.

RULES:
- Analyze the placeholder meaning and context
- Match against the provided candidates
- Consider semantic similarity, not just text matching
- Return confidence score (0-100)
- If no good match (confidence < 60), return "NO_MATCH"

CRITICAL: You must respond with ONLY valid JSON. No markdown, no explanations, no extra text.

Example valid response:
{"match": "output.account_onboarding.letsGetStartedBtn", "confidence": 85, "reason": "Semantic match for Get Started button"}

FORMAT: JSON response with "match", "confidence", and "reason" fields.`;

    const userPrompt = `Find best match for placeholder: "${placeholder}" (${type})

Available candidates:
${context}

IMPORTANT: Respond with ONLY JSON. No markdown, no explanations, no extra text.

Return JSON with the best match and confidence score.`;

    try {
      // Add timeout to prevent freezing
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
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
            temperature: 0.2,
            top_p: 0.9
          }
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`Ollama HTTP ${response.status}`);
      }

      const data = await response.json();
      const result = data.message?.content || '';
      
      // Parse JSON response (handle various markdown formats)
      let cleanedResult = result.trim();
      
      // Remove various markdown wrappers
      if (cleanedResult.includes('```json')) {
        cleanedResult = cleanedResult.replace(/```json\s*/, '').replace(/```\s*$/, '');
      } else if (cleanedResult.includes('```')) {
        cleanedResult = cleanedResult.replace(/```\s*/, '').replace(/```\s*$/, '');
      }
      
      // Remove any leading/trailing quotes or extra characters
      cleanedResult = cleanedResult.replace(/^["']|["']$/g, '').trim();
      
      // Try to extract JSON if it's embedded in text
      const jsonMatch = cleanedResult.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedResult = jsonMatch[0];
      }
      
      let matchResult;
      try {
        matchResult = JSON.parse(cleanedResult);
      } catch (parseError) {
        console.error(`JSON parse error for ${placeholder}:`, parseError.message);
        console.error(`Original result:`, result);
        console.error(`Cleaned result:`, cleanedResult);
        
        // Try to create a minimal valid response as fallback
        return {
          placeholder,
          type,
          match: null,
          confidence: 0,
          reason: `JSON parsing failed: ${parseError.message}`
        };
      }
      
      const finalResult = {
        placeholder,
        type,
        match: matchResult.match === 'NO_MATCH' ? null : matchResult.match,
        confidence: matchResult.confidence || 0,
        reason: matchResult.reason || 'No reason provided'
      };

      this.cache.set(cacheKey, finalResult);
      return finalResult;

    } catch (error) {
      console.error(`Error matching ${placeholder}:`, error.message);
      if (error.name === 'AbortError') {
        return {
          placeholder,
          type,
          match: null,
          confidence: 0,
          reason: 'Request timeout'
        };
      }
      return {
        placeholder,
        type,
        match: null,
        confidence: 0,
        reason: 'Matching failed'
      };
    }
  }

  async resolvePlaceholders(yamlContent) {
    await this.loadScreenObjects();
    await this.loadSubflows();

    // Find element placeholders
    const elementPlaceholders = yamlContent.match(/\{\{ELEMENT:([^}]+)\}\}/g) || [];
    const subflowPlaceholders = yamlContent.match(/\{\{SUBFLOW:([^}]+)\}\}/g) || [];

    // If there are invalid element placeholders, return early without processing
    if (elementPlaceholders.length > 0) {
      console.log('⚠️  Found invalid element placeholders, skipping element resolution');
      return {
        resolvedYaml: yamlContent,
        resolutions: [],
        totalPlaceholders: elementPlaceholders.length + subflowPlaceholders.length,
        resolvedCount: 0,
        error: 'Invalid element placeholders found'
      };
    }

    const resolutions = [];

    // Resolve element placeholders
    for (const placeholder of elementPlaceholders) {
      const elementName = placeholder.replace(/\{\{ELEMENT:([^}]+)\}\}/, '$1');
      const match = await this.findBestMatchWithOllama(elementName, 'element');
      
      if (match.match && match.confidence >= 60) {
        resolutions.push({
          type: 'element',
          original: placeholder,
          replacement: match.match,
          confidence: match.confidence,
          reason: match.reason
        });
      } else {
        resolutions.push({
          type: 'element',
          original: placeholder,
          replacement: placeholder, // Keep original if no good match
          confidence: match.confidence,
          reason: match.reason
        });
      }
    }

    // Resolve subflow placeholders
    for (const placeholder of subflowPlaceholders) {
      const subflowName = placeholder.replace(/\{\{SUBFLOW:([^}]+)\}\}/, '$1');
      const match = await this.findBestMatchWithOllama(subflowName, 'subflow');
      
      if (match.match && match.confidence >= 60) {
        resolutions.push({
          type: 'subflow',
          original: placeholder,
          replacement: match.match,
          confidence: match.confidence,
          reason: match.reason
        });
      } else {
        resolutions.push({
          type: 'subflow',
          original: placeholder,
          replacement: placeholder, // Keep original if no good match
          confidence: match.confidence,
          reason: match.reason
        });
      }
    }

    // Apply replacements to YAML
    let resolvedYaml = yamlContent;
    for (const resolution of resolutions) {
      if (resolution.confidence >= 60) {
        resolvedYaml = resolvedYaml.replace(resolution.original, resolution.replacement);
      }
    }

    return {
      resolvedYaml,
      resolutions,
      totalPlaceholders: elementPlaceholders.length + subflowPlaceholders.length,
      resolvedCount: resolutions.filter(r => r.confidence >= 60).length
    };
  }
}

// Export for use in main flow
module.exports = { ElementMatcher };

// CLI usage
if (require.main === module) {
  const yamlFile = process.argv[2];
  
  if (!yamlFile) {
    console.error('Usage: node match-elements.js <yaml-file>');
    process.exit(1);
  }
  
  fs.readFile(yamlFile, 'utf8')
    .then(async (yamlContent) => {
      const matcher = new ElementMatcher();
      const result = await matcher.resolvePlaceholders(yamlContent);
      
      console.log('=== Resolution Results ===');
      console.log(`Total placeholders: ${result.totalPlaceholders}`);
      console.log(`Resolved: ${result.resolvedCount}`);
      console.log('\n=== Resolutions ===');
      result.resolutions.forEach(r => {
        console.log(`${r.type}: ${r.original} -> ${r.replacement} (${r.confidence}% - ${r.reason})`);
      });
      
      console.log('\n=== Resolved YAML ===');
      console.log(result.resolvedYaml);
    })
    .catch(console.error);
}
