#!/usr/bin/env node

/**
 * Element Matcher
 *
 * Given a failed Maestro selector and the current live UI hierarchy, finds the
 * best replacement element using a layered strategy:
 *
 *   Layer 1 — Exact / case-insensitive / substring  (no API call)
 *   Layer 2 — Word-overlap (Jaccard), synonym map, edit distance  (no API call)
 *   Layer 3 — Claude API  (only when heuristics score < HEURISTIC_THRESHOLD)
 *
 * Exports: matchElement(failedSelector, elements, platform, screenContent)
 *   → { match, confidence, strategy, reasoning }  or null if nothing found
 */

'use strict';

const https = require('https');

// ─── Confidence thresholds ────────────────────────────────────────────────────
const HEURISTIC_THRESHOLD = 0.82; // skip AI when heuristics are this confident
const APPLY_THRESHOLD     = 0.78; // minimum confidence to accept any match
const AI_TIMEOUT_MS       = 20000;

// ─── Common label synonym pairs (bidirectional) ───────────────────────────────
const SYNONYM_PAIRS = [
  ['send', 'submit'], ['send', 'post'], ['send message', 'submit message'],
  ['back', 'cancel'], ['back', 'close'], ['back', 'go back'], ['back', 'navigate up'],
  ['cancel', 'close'], ['cancel', 'dismiss'],
  ['done', 'finish'], ['done', 'complete'], ['done', 'ok'], ['done', 'close'],
  ['ok', 'confirm'], ['ok', 'accept'], ['ok', 'continue'],
  ['continue', 'next'], ['continue', 'proceed'],
  ['login', 'sign in'], ['login', 'log in'],
  ['logout', 'sign out'], ['logout', 'log out'],
  ['sign up', 'register'], ['sign up', 'create account'],
  ['search', 'find'], ['search', 'look up'],
  ['delete', 'remove'], ['edit', 'modify'], ['edit', 'change'],
  ['save', 'update'], ['save', 'confirm'],
  ['home', 'main'], ['menu', 'hamburger'],
  ['haio', 'assistant'], ['haio', 'health assistant'],
  ['send', 'submit message'],
];

const SYNONYM_MAP = (() => {
  const map = new Map();
  for (const [a, b] of SYNONYM_PAIRS) {
    if (!map.has(a)) map.set(a, new Set());
    if (!map.has(b)) map.set(b, new Set());
    map.get(a).add(b);
    map.get(b).add(a);
  }
  return map;
})();

// ─── Text utilities ───────────────────────────────────────────────────────────

function normalize(text) {
  return (text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

function tokens(text) {
  return normalize(text).split(' ').filter(Boolean);
}

function jaccard(a, b) {
  const sa = new Set(tokens(a));
  const sb = new Set(tokens(b));
  const intersection = [...sa].filter(x => sb.has(x)).length;
  const union = new Set([...sa, ...sb]).size;
  return union === 0 ? 0 : intersection / union;
}

function editDistance(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

function editSimilarity(a, b) {
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 1 : 1 - editDistance(a, b) / maxLen;
}

/**
 * Strip Maestro regex syntax to get the plain-text core for comparison.
 * "(?i).*(Send|Submit).*" → "Send Submit"
 */
function stripRegex(pattern) {
  return (pattern || '')
    .replace(/\(\?i\)/g, '')
    .replace(/\\\./g, '.')
    .replace(/\.\*|\.\+/g, ' ')
    .replace(/[\\^$?+{}[\]()]/g, ' ')
    .replace(/\|/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Build candidate strings from a hierarchy element.
 * Preference order: accessibilityId/identifier → text → label → value
 */
function candidates(el) {
  const seen = new Set();
  const out = [];
  for (const v of [el.identifier, el.text, el.label, el.value]) {
    if (v && v.trim() && !seen.has(v.trim())) {
      seen.add(v.trim());
      out.push(v.trim());
    }
  }
  return out;
}

// ─── Heuristic matching ───────────────────────────────────────────────────────

function heuristicMatch(failedSelector, elements) {
  const clean = stripRegex(failedSelector);
  const normClean = normalize(clean);
  let best = null;

  for (const el of elements) {
    for (const cand of candidates(el)) {
      const normCand = normalize(cand);
      let score = 0;
      let strategy = '';

      // L1: exact (case-insensitive)
      if (normCand === normClean) {
        return { match: cand, element: el, confidence: 1.0, strategy: 'exact' };
      }

      // L1: one contains the other
      if (normCand.includes(normClean) || normClean.includes(normCand)) {
        const ratio = Math.min(normClean.length, normCand.length) /
                      Math.max(normClean.length, normCand.length);
        score = 0.80 + ratio * 0.08;
        strategy = 'substring';
      }

      // L2: word-overlap
      const jScore = jaccard(clean, cand);
      if (jScore > 0.5) {
        const s = jScore * 0.88;
        if (s > score) { score = s; strategy = 'word-overlap'; }
      }

      // L2: synonym check (any word in the selector has a known synonym in cand)
      for (const tok of tokens(clean)) {
        const syns = SYNONYM_MAP.get(tok) || new Set();
        for (const syn of syns) {
          if (normCand.includes(syn)) {
            const s = 0.78;
            if (s > score) { score = s; strategy = 'synonym'; }
          }
        }
      }

      // L2: edit distance (only for short labels; long strings hit false positives)
      if (clean.length <= 40 && cand.length <= 40) {
        const es = editSimilarity(normClean, normCand);
        if (es > 0.72) {
          const s = es * 0.84;
          if (s > score) { score = s; strategy = 'edit-distance'; }
        }
      }

      if (score > (best?.confidence ?? 0)) {
        best = { match: cand, element: el, confidence: score, strategy };
      }
    }
  }

  return best && best.confidence >= APPLY_THRESHOLD ? best : null;
}

// ─── Claude AI matching ───────────────────────────────────────────────────────

async function aiMatch(failedSelector, elements, platform, screenContent) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const elementList = elements
    .slice(0, 60)
    .map(e => `  text="${e.text || ''}" | id="${e.identifier || ''}" | type=${e.type || ''}`)
    .join('\n');

  const prompt = `You are a mobile UI test automation expert. A Maestro test failed because this selector was not found on screen.

Failed selector: "${failedSelector}"
Platform: ${platform}

Currently visible UI elements:
${elementList}

Relevant section of the screen object file (for context):
${(screenContent || '').slice(0, 1500)}

Find the best replacement selector for "${failedSelector}" from the visible elements.

Respond with ONLY a JSON object — no markdown, no explanation outside the JSON:
{
  "found": true,
  "confidence": 0.92,
  "newSelector": "exact text or id from the element list",
  "reasoning": "one sentence"
}

Rules:
- "newSelector" MUST be text or id that actually appears in the element list above
- Prefer accessibility id/identifier over raw display text (more stable)
- You may use simple regex like "Send.*" only if the text varies slightly
- Set "found": false if confidence would be below 0.70`;

  const body = JSON.stringify({
    model: 'claude-sonnet-4-6',
    max_tokens: 256,
    messages: [{ role: 'user', content: prompt }],
  });

  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            const text = response.content?.[0]?.text || '';
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) { resolve(null); return; }
            const parsed = JSON.parse(jsonMatch[0]);
            if (!parsed.found || !parsed.newSelector) { resolve(null); return; }
            resolve({
              match: parsed.newSelector,
              confidence: parsed.confidence || 0.75,
              strategy: 'ai',
              reasoning: parsed.reasoning || '',
            });
          } catch {
            resolve(null);
          }
        });
      }
    );
    req.on('error', () => resolve(null));
    req.setTimeout(AI_TIMEOUT_MS, () => { req.destroy(); resolve(null); });
    req.write(body);
    req.end();
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * @param {string} failedSelector - The selector string that Maestro could not find
 * @param {Array}  elements       - Hierarchy elements from ios-ui-inspector.js
 * @param {string} platform       - 'ios' | 'android'
 * @param {string} screenContent  - Raw content of the screen .js file (for AI context)
 * @returns {Promise<{match, confidence, strategy, reasoning}|null>}
 */
async function matchElement(failedSelector, elements, platform = 'ios', screenContent = '') {
  // Layer 1 + 2: heuristics (fast, no API)
  const heuristic = heuristicMatch(failedSelector, elements);
  if (heuristic && heuristic.confidence >= HEURISTIC_THRESHOLD) {
    return { ...heuristic, reasoning: `Heuristic match via ${heuristic.strategy}` };
  }

  // Layer 3: AI (only when heuristics are uncertain)
  const aiResult = await aiMatch(failedSelector, elements, platform, screenContent);
  if (!aiResult) return heuristic; // fall back to best heuristic even if below threshold

  // Validate AI result exists in hierarchy (sanity check)
  const norm = normalize(aiResult.match);
  const existsInHierarchy = elements.some((el) =>
    candidates(el).some((c) => normalize(c) === norm || normalize(c).includes(norm))
  );
  if (!existsInHierarchy) return heuristic;

  // Return whichever is more confident
  if (!heuristic || aiResult.confidence > heuristic.confidence) return aiResult;
  return heuristic;
}

module.exports = { matchElement, stripRegex, APPLY_THRESHOLD, HEURISTIC_THRESHOLD };
