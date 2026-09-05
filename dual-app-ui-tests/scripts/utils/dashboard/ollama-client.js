#!/usr/bin/env node

'use strict';

/**
 * Shared Ollama Client
 * Centralizes all Ollama API interactions with consistent model resolution,
 * timeout handling, and the :latest suffix fix.
 */
class OllamaClient {
  constructor(options = {}) {
    this.url = process.env.OLLAMA_URL || 'http://localhost:11434';
    this.defaultModel = process.env.OLLAMA_MODEL || 'llama3.2';
    this.defaultTimeout = options.timeout || 60000;
  }

  /**
   * Check if Ollama is reachable and list available models.
   * @returns {{ available: boolean, models: string[] }}
   */
  async isAvailable() {
    try {
      const r = await fetch(`${this.url}/api/tags`, {
        signal: AbortSignal.timeout(3000)
      });
      if (!r.ok) return { available: false, models: [] };
      const data = await r.json();
      const models = (data.models || []).map(m => m.name);
      return { available: true, models };
    } catch {
      return { available: false, models: [] };
    }
  }

  /**
   * Find a model from the available list that matches the preferred name,
   * accounting for the :latest (or other tag) suffix Ollama appends.
   *
   * "llama3.2" matches "llama3.2:latest", "llama3.2:3b", etc.
   *
   * @param {string[]} models - List of model names from /api/tags
   * @param {string}   [preferred] - Model name to match (defaults to this.defaultModel)
   * @returns {string|null} The matched model name or null
   */
  resolveModel(models, preferred) {
    const want = preferred || this.defaultModel;
    return models.find(m => m === want || m.startsWith(want + ':')) || null;
  }

  /**
   * Send a chat request to Ollama.
   *
   * @param {Array<{role: string, content: string}>} messages
   * @param {object} [options]
   * @param {string} [options.model]       - Override model (resolved via resolveModel)
   * @param {number} [options.timeout]     - Override timeout in ms
   * @param {number} [options.temperature] - Sampling temperature (default 0.1)
   * @param {number} [options.top_p]       - Top-p sampling (default 0.9)
   * @param {number} [options.repeat_penalty] - Repeat penalty (default 1.1)
   * @returns {Promise<string>} The assistant's response content
   * @throws {Error} On timeout, HTTP error, or connection failure
   */
  async chat(messages, options = {}) {
    const timeout = options.timeout || this.defaultTimeout;
    const model = options.model || this.defaultModel;

    const r = await fetch(`${this.url}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        options: {
          temperature: options.temperature ?? 0.1,
          top_p: options.top_p ?? 0.9,
          repeat_penalty: options.repeat_penalty ?? 1.1
        }
      }),
      signal: AbortSignal.timeout(timeout)
    });

    if (!r.ok) throw new Error(`Ollama HTTP ${r.status}`);
    const data = await r.json();
    return data.message?.content || '';
  }

  /**
   * Parse a JSON response from Ollama, handling markdown wrappers and edge cases.
   * Reusable across all callers that expect structured JSON from the model.
   *
   * @param {string} raw - Raw text from Ollama
   * @returns {any} Parsed JSON value
   * @throws {Error} If JSON cannot be extracted
   */
  static parseJSON(raw) {
    let cleaned = (raw || '').trim();

    // Strip markdown code fences
    if (cleaned.includes('```json')) {
      cleaned = cleaned.replace(/```json\s*/, '').replace(/```\s*$/, '');
    } else if (cleaned.includes('```')) {
      cleaned = cleaned.replace(/```\s*/, '').replace(/```\s*$/, '');
    }

    // Strip wrapping quotes
    cleaned = cleaned.replace(/^["']|["']$/g, '').trim();

    // Try to extract an embedded JSON object or array
    const jsonMatch = cleaned.match(/[\[{][\s\S]*[\]}]/);
    if (jsonMatch) {
      cleaned = jsonMatch[0];
    }

    return JSON.parse(cleaned);
  }
}

module.exports = { OllamaClient };
