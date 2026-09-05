"use strict";
// ─────────────────────────────────────────────────────────────────────────────
// Framework Index — scans the .maestro/ directory tree to build an in-memory
// catalogue of every subflow, flow, and screen object.  The catalogue is used
// by two REST endpoints:
//   GET  /api/framework         → returns the full index metadata
//   POST /api/framework/match   → returns the top N subflows that best match
//                                 a set of recorded steps
//
// Matching algorithm
// ──────────────────
// Each file is fingerprinted with two signals:
//   1. textTokens   – normalised set of element-text targets found in the file
//   2. actionTypes  – ordered list of action keywords (tap, input, assert, …)
//
// For a query (the recorder's current step list) the score is:
//   score = 0.6 × Jaccard(queryTexts, fileTexts)
//         + 0.4 × LCS-ratio(queryActions, fileActions)
//
// This intentionally penalises files that share action shapes but target
// completely different elements (high action score, zero text overlap).
// ─────────────────────────────────────────────────────────────────────────────
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildFrameworkIndex = buildFrameworkIndex;
exports.matchSteps = matchSteps;
const fs_1 = require("fs");
const path_1 = __importDefault(require("path"));
const yaml_1 = require("yaml");
// ── Text normalisation ────────────────────────────────────────────────────────
function normalizeText(raw) {
    return raw
        .toLowerCase()
        .replace(/\$\{[^}]+\}/g, '') // strip ${template.vars}
        .replace(/[^a-z0-9\s]/g, ' ') // keep only alphanum + space
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 40);
}
// ── Step extraction from parsed YAML ─────────────────────────────────────────
function tokenFromStep(step) {
    if (!step || typeof step !== 'object')
        return null;
    const s = step;
    const key = Object.keys(s)[0];
    if (!key)
        return null;
    const val = s[key];
    const textOf = (v) => {
        if (typeof v === 'string')
            return normalizeText(v);
        if (v && typeof v === 'object') {
            const o = v;
            return normalizeText(String(o['text'] ?? o['id'] ?? o['label'] ?? ''));
        }
        return '';
    };
    switch (key) {
        case 'tapOn': return { actionType: 'tap', text: textOf(val) };
        case 'longPressOn': return { actionType: 'longpress', text: textOf(val) };
        case 'swipeOn': return { actionType: 'swipe', text: textOf(val) };
        case 'inputText': return { actionType: 'input', text: '' };
        case 'clearText': return { actionType: 'clear', text: '' };
        case 'assertVisible': return { actionType: 'assert', text: textOf(val) };
        case 'assertNotVisible': return { actionType: 'assertnot', text: textOf(val) };
        case 'launchApp': return { actionType: 'launch', text: '' };
        case 'stopApp': return { actionType: 'stop', text: '' };
        case 'runFlow': {
            const ref = typeof val === 'string' ? val
                : (val && typeof val === 'object' ? String(val['file'] ?? '') : '');
            return { actionType: 'runflow', text: path_1.default.basename(ref, '.yaml') };
        }
        case 'runScript': return { actionType: 'runscript', text: '' };
        case 'scroll':
        case 'scrollUntilVisible': return { actionType: 'scroll', text: '' };
        case 'waitForAnimationToEnd':
        case 'extendedWaitUntil': return { actionType: 'wait', text: '' };
        case 'pressKey': return { actionType: 'key', text: normalizeText(String(val)) };
        case 'hideKeyboard': return { actionType: 'keyboard', text: '' };
        default: return { actionType: key.toLowerCase(), text: '' };
    }
}
// Walk the step list recursively — runFlow.commands / when.commands can contain
// nested steps that should also contribute to the fingerprint.
function walkSteps(steps, out) {
    if (!Array.isArray(steps))
        return;
    for (const step of steps) {
        const t = tokenFromStep(step);
        if (t)
            out.push(t);
        if (step && typeof step === 'object') {
            const s = step;
            // Nested command lists inside runFlow / conditional blocks
            const nested = (s['commands']
                ?? s['runFlow']?.['commands']
                ?? s['when']?.['commands']);
            if (Array.isArray(nested))
                walkSteps(nested, out);
        }
    }
}
// ── YAML file parser ──────────────────────────────────────────────────────────
async function parseFile(filePath, maestroRoot, fileType) {
    try {
        const raw = await fs_1.promises.readFile(filePath, 'utf8');
        // Maestro uses `---` as a separator between frontmatter and step list.
        // `${}` template variables are stripped before YAML parsing.
        const clean = raw.replace(/\$\{[^}]+\}/g, 'TEMPLATE_VAR');
        const parts = clean.split(/^---\s*$/m);
        let frontmatter = {};
        let bodyText = clean;
        if (parts.length >= 2) {
            try {
                frontmatter = (0, yaml_1.parse)(parts[0]) ?? {};
            }
            catch { /* ignore */ }
            bodyText = parts.slice(1).join('\n---\n');
        }
        let steps = null;
        try {
            steps = (0, yaml_1.parse)(bodyText);
        }
        catch {
            return null;
        }
        if (!Array.isArray(steps))
            return null;
        const tokens = [];
        walkSteps(steps, tokens);
        const rel = path_1.default.relative(maestroRoot, filePath);
        // domain = first directory segment beneath subflows/ or flows/
        const segments = rel.split(path_1.default.sep);
        const domain = segments.length > 2 ? segments[1] : 'Common';
        const name = path_1.default.basename(filePath, '.yaml');
        const hasLaunchApp = tokens.some(t => t.actionType === 'launch');
        const textSet = new Set(tokens.map(t => t.text).filter(Boolean));
        const textTokens = [...textSet].sort();
        const actionTypes = tokens.map(t => t.actionType);
        const runFlowRefs = tokens.filter(t => t.actionType === 'runflow').map(t => t.text);
        const tags = Array.isArray(frontmatter['tags']) ? frontmatter['tags'] : [];
        const previewTexts = [...textSet].filter(t => t.length > 2).slice(0, 4).join(', ');
        const summary = `${domain} · ${steps.length} steps${previewTexts ? ` · "${previewTexts}"` : ''}`;
        return {
            relativePath: rel,
            type: fileType,
            name,
            domain,
            tags,
            hasLaunchApp,
            textTokens,
            actionTypes,
            runFlowRefs,
            stepCount: steps.length,
            summary,
        };
    }
    catch {
        return null;
    }
}
// ── Directory walker ──────────────────────────────────────────────────────────
async function walkDir(dir, ext) {
    const out = [];
    try {
        const entries = await fs_1.promises.readdir(dir, { withFileTypes: true });
        await Promise.all(entries.map(async (e) => {
            const full = path_1.default.join(dir, e.name);
            if (e.isDirectory())
                out.push(...await walkDir(full, ext));
            else if (e.isFile() && e.name.endsWith(ext))
                out.push(full);
        }));
    }
    catch { /* dir may not exist */ }
    return out;
}
// ── Public API ────────────────────────────────────────────────────────────────
async function buildFrameworkIndex(maestroRoot) {
    const t0 = Date.now();
    const [subflowFiles, flowFiles, screenFiles] = await Promise.all([
        walkDir(path_1.default.join(maestroRoot, 'subflows'), '.yaml'),
        walkDir(path_1.default.join(maestroRoot, 'flows'), '.yaml'),
        walkDir(path_1.default.join(maestroRoot, 'screens'), '.js'),
    ]);
    const [rawSubflows, rawFlows] = await Promise.all([
        Promise.all(subflowFiles.map(f => parseFile(f, maestroRoot, 'subflow'))),
        Promise.all(flowFiles.map(f => parseFile(f, maestroRoot, 'flow'))),
    ]);
    const subflows = rawSubflows.filter((e) => e !== null);
    const flows = rawFlows.filter((e) => e !== null);
    const screens = screenFiles.map(f => path_1.default.relative(maestroRoot, f));
    return {
        subflows,
        flows,
        screens,
        totalFiles: subflows.length + flows.length + screens.length,
        buildTimeMs: Date.now() - t0,
    };
}
// ── Similarity scoring ────────────────────────────────────────────────────────
function jaccardSimilarity(a, b) {
    if (a.length === 0 && b.length === 0)
        return 0;
    const setA = new Set(a);
    const setB = new Set(b);
    let intersection = 0;
    for (const t of setA)
        if (setB.has(t))
            intersection++;
    const union = setA.size + setB.size - intersection;
    return union === 0 ? 0 : intersection / union;
}
function lcsSimilarity(a, b) {
    const m = a.length;
    const n = b.length;
    if (m === 0 || n === 0)
        return 0;
    // Standard O(m×n) DP — acceptable for step lists up to ~200 entries
    const prev = new Array(n + 1).fill(0);
    const curr = new Array(n + 1).fill(0);
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            curr[j] = a[i - 1] === b[j - 1] ? prev[j - 1] + 1 : Math.max(prev[j], curr[j - 1]);
        }
        prev.fill(0);
        for (let j = 0; j <= n; j++) {
            prev[j] = curr[j];
            curr[j] = 0;
        }
    }
    return prev[n] / Math.max(m, n);
}
function matchSteps(recordedSteps, index, topN = 5) {
    if (recordedSteps.length === 0)
        return [];
    // Convert recorder TestStep format → internal StepToken format
    const tokens = recordedSteps.map(step => {
        const actionType = (step.type ?? '').toLowerCase()
            .replace('inputtext', 'input')
            .replace('assertvisible', 'assert')
            .replace('presskey', 'key');
        const text = normalizeText(String(step.target ?? step.value ?? ''));
        return { actionType, text };
    });
    const queryTexts = tokens.map(t => t.text).filter(Boolean);
    const queryActions = tokens.map(t => t.actionType);
    const results = [];
    for (const entry of index.subflows) {
        const textScore = jaccardSimilarity(queryTexts, entry.textTokens);
        const actionScore = lcsSimilarity(queryActions, entry.actionTypes);
        const score = 0.6 * textScore + 0.4 * actionScore;
        if (score > 0.08) {
            const pct = (n) => `${Math.round(n * 100)}%`;
            const parts = [];
            if (textScore > 0.15)
                parts.push(`${pct(textScore)} element text overlap`);
            if (actionScore > 0.35)
                parts.push(`${pct(actionScore)} action sequence match`);
            const reason = parts.length ? parts.join(', ') : `${pct(score)} overall similarity`;
            results.push({ entry, score, textScore, actionScore, reason });
        }
    }
    return results.sort((a, b) => b.score - a.score).slice(0, topN);
}
//# sourceMappingURL=frameworkIndex.js.map