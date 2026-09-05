'use strict';

const express = require('express');
const path = require('path');
const { promises: fs } = require('fs');
const yaml = require('js-yaml');

const app = express();
const PORT = process.env.PORT || 3030;
const PROJECT_ROOT = path.resolve(__dirname, '..');
const MAESTRO_ROOT = path.join(PROJECT_ROOT, '.maestro');
const TESTDATA_DIR = path.join(MAESTRO_ROOT, 'testdata');
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2';

app.use(express.json({ limit: '2mb' }));

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
    const segments = rel.split(path.sep);
    const feature = segments.length > 1 ? segments[0] : 'General';
    if (SKIP_DIRS.has(feature)) continue;
    const filename = path.basename(file, '.yaml');
    try {
      const content = await fs.readFile(file, 'utf8');
      const header = safeParseYamlHeader(content);
      flows.push({
        file: rel, feature, filename,
        tags: Array.isArray(header.tags) ? header.tags.map(String) : [],
        name: header.name || filename,
      });
    } catch (_) {}
  }
  return flows;
}

async function scanScreens() {
  const screensDir = path.join(MAESTRO_ROOT, 'screens');
  const files = await walkDir(screensDir, '.js');
  return files.map(f => {
    const rel = path.relative(screensDir, f);
    const segments = rel.split(path.sep);
    return { feature: segments.length > 1 ? segments[0] : 'General', name: path.basename(f, '.js'), file: rel };
  });
}

async function scanSubflows() {
  const subflowsDir = path.join(MAESTRO_ROOT, 'subflows');
  const files = await walkDir(subflowsDir, '.yaml');
  return files.map(f => {
    const rel = path.relative(subflowsDir, f);
    const segments = rel.split(path.sep);
    return { category: segments.length > 1 ? segments[0] : 'common', name: path.basename(f, '.yaml'), file: rel };
  });
}

// ─── Feature Docs Loader ──────────────────────────────────────────────────────

const FEATURE_DOC_MAP = {
  Home:     'homescreen.md',
  Benefits: 'benefits.md',
  Account:  'homescreen.md',
  Shop:     'search_navigation.md',
  Pharmacy: 'homescreen.md',
  Health:   'homescreen.md',
  MCCore:   'homescreen.md',
  NGS:      'homescreen.md',
  Chatbot:  'homescreen.md',
  VM:       'homescreen.md',
};

let cachedFeatureDocs = null;

async function loadFeatureDocs() {
  if (cachedFeatureDocs) return cachedFeatureDocs;
  const docsDir = path.join(PROJECT_ROOT, 'docs', 'maestro', 'features');
  const cache = {};
  try {
    const files = await fs.readdir(docsDir);
    for (const f of files.filter(f => f.endsWith('.md'))) {
      cache[f] = await fs.readFile(path.join(docsDir, f), 'utf8');
    }
  } catch (e) { console.warn('Feature docs unavailable:', e.message); }
  cachedFeatureDocs = cache;
  return cache;
}

function getFeatureDocContent(feature, docs) {
  const file = FEATURE_DOC_MAP[feature];
  return (file && docs[file]) ? docs[file] : null;
}

// ─── ANBA Gap Analysis ────────────────────────────────────────────────────────

async function analyzeANBAGaps(flows) {
  try {
    const { fetchAEMData, extractANBATitles } = require('../scripts/utils/homescreen/extract-anba-titles');
    const aemData = await Promise.race([
      fetchAEMData(),
      new Promise((_, rej) => setTimeout(() => rej(new Error('AEM timeout')), 8000)),
    ]);
    const anbaTitles = extractANBATitles(aemData);
    const aemIds = Object.keys(anbaTitles);
    const homeFlows = flows.filter(f => f.feature === 'Home');

    const covered = [], missing = [];
    for (const id of aemIds) {
      const hasFlow = homeFlows.some(f => f.filename.toLowerCase().includes(id.toLowerCase()));
      (hasFlow ? covered : missing).push({ id, title: anbaTitles[id] });
    }

    return {
      source: 'aem',
      totalAEM: aemIds.length,
      coveredCount: covered.length,
      missingCount: missing.length,
      coveragePct: aemIds.length ? Math.round((covered.length / aemIds.length) * 100) : 0,
      missing,
      covered,
    };
  } catch (e) {
    return { source: 'error', error: e.message, totalAEM: 0, coveredCount: 0, missingCount: 0, missing: [], covered: [] };
  }
}

// ─── Graph Definitions ────────────────────────────────────────────────────────

const FEATURE_COLORS = {
  Account:  { cluster: '#0D1B2E', border: '#4A90D9', node: '#1A3A5C' },
  Home:     { cluster: '#1E1500', border: '#E8A838', node: '#3D2B00' },
  Pharmacy: { cluster: '#160D20', border: '#9B59B6', node: '#2D1B40' },
  Benefits: { cluster: '#051A10', border: '#27AE60', node: '#0D3320' },
  Shop:     { cluster: '#1E0606', border: '#E74C3C', node: '#3D0C0C' },
  Health:   { cluster: '#051510', border: '#16A085', node: '#0A2A25' },
  MCCore:   { cluster: '#120820', border: '#8E44AD', node: '#251040' },
  NGS:      { cluster: '#1E0A00', border: '#D35400', node: '#3D1500' },
  Chatbot:  { cluster: '#061218', border: '#2980B9', node: '#0C2535' },
  VM:       { cluster: '#041410', border: '#1ABC9C', node: '#082820' },
  General:  { cluster: '#161616', border: '#7F8C8D', node: '#2C2C2C' },
};

const FEATURE_SCREENS = {
  Account:  ['Login', 'OTP Verify', 'Account Dashboard', 'Profile Edit', 'Addresses', 'Payment Methods', 'Insurance', 'Manage People', 'Delete Account'],
  Home:     ['Guest Home', 'Auth Home', 'ANBA Cards', 'Discovery', 'Health Services', 'Business Units', 'Articles', 'Explore Care', 'Splitview'],
  Pharmacy: ['Rx List', 'Rx Detail', 'Pharmacy Locator', 'Chat', 'Message Hub'],
  Benefits: ['Benefits Dashboard', 'Claims', 'Prior Auth', 'Plan Documents', 'Drug Pricing', 'Find Care', 'Spending'],
  Shop:     ['Product Search', 'Product Detail', 'Cart', 'Checkout', 'Order Confirm'],
  Health:   ['Health Dashboard', 'Health Records', 'Wellness Tracker'],
  MCCore:   ['Find Care', 'Clinic Detail', 'Book Appointment'],
  NGS:      ['Vaccine Schedule', 'Vaccine Confirm'],
  Chatbot:  ['Chat Interface', 'History'],
  VM:       ['Visit Setup', 'Visit Room'],
};

// Tag/filename patterns → screen within a feature
const SCREEN_PATTERNS = {
  Account: {
    'Login':           s => /login|sign.?in|auth|sign_in/.test(s),
    'OTP Verify':      s => /otp|dob|verif/.test(s),
    'Account Dashboard': s => /dashboard/.test(s),
    'Profile Edit':    s => /profile/.test(s),
    'Addresses':       s => /address/.test(s),
    'Payment Methods': s => /payment/.test(s),
    'Insurance':       s => /insurance/.test(s),
    'Manage People':   s => /manage_people|people/.test(s),
    'Delete Account':  s => /delete/.test(s),
  },
  Home: {
    'Guest Home':      s => /guest/.test(s),
    'Auth Home':       s => /homescreen|smoke_home/.test(s) && !/guest|splitview|anba|articles|health_service|bu_|discover|explore/.test(s),
    'ANBA Cards':      s => /anba/.test(s),
    'Discovery':       s => /discover|dnba/.test(s),
    'Health Services': s => /health_service/.test(s),
    'Business Units':  s => /bu_|business_unit/.test(s),
    'Articles':        s => /article/.test(s),
    'Explore Care':    s => /explore_care/.test(s),
    'Splitview':       s => /splitview/.test(s),
  },
  Pharmacy: {
    'Rx List':         s => /prescription|rx_list|rxp_module/.test(s),
    'Rx Detail':       s => /rx_detail/.test(s),
    'Pharmacy Locator':s => /locator|pharmacy_loc/.test(s),
    'Chat':            s => /pharmacy_chat/.test(s),
    'Message Hub':     s => /message_hub/.test(s),
  },
  Benefits: {
    'Benefits Dashboard': s => /dashboard/.test(s),
    'Claims':          s => /claim/.test(s),
    'Prior Auth':      s => /prior_auth|prior-auth/.test(s),
    'Plan Documents':  s => /plan_doc|document/.test(s),
    'Drug Pricing':    s => /drug_pric/.test(s),
    'Find Care':       s => /findcare|find_care|find-care|specialty|telehealth|provider/.test(s),
    'Spending':        s => /spending|copay|coinsurance|medicare/.test(s),
  },
  Shop: {
    'Product Search':  s => /search|shop/.test(s),
    'Product Detail':  s => /product_detail/.test(s),
    'Cart':            s => /cart/.test(s),
    'Checkout':        s => /checkout/.test(s),
    'Order Confirm':   s => /order|confirm/.test(s),
  },
};

function nodeId(feature, screen) {
  return `${feature}_${screen}`.replace(/[^a-zA-Z0-9]/g, '_');
}

function matchFlowToScreen(flow) {
  const key = [flow.filename, ...flow.tags].join(' ').toLowerCase();
  const patterns = SCREEN_PATTERNS[flow.feature];
  if (patterns) {
    for (const [screen, test] of Object.entries(patterns)) {
      if (test(key)) return screen;
    }
  }
  return (FEATURE_SCREENS[flow.feature] || ['Home'])[0];
}

// ─── Graph Builder ────────────────────────────────────────────────────────────

function buildGraph(flows, screens, subflows) {
  const nodes = {};

  for (const [feature, screenList] of Object.entries(FEATURE_SCREENS)) {
    for (const screen of screenList) {
      const id = nodeId(feature, screen);
      nodes[id] = { id, label: screen, feature, testCount: 0, flows: [] };
    }
  }

  for (const flow of flows) {
    const screen = matchFlowToScreen(flow);
    const id = nodeId(flow.feature, screen);
    if (nodes[id]) { nodes[id].testCount++; nodes[id].flows.push(flow.filename); }
  }

  const screenObjFeatures = new Set(screens.map(s => s.feature));
  for (const id of Object.keys(nodes)) {
    nodes[id].hasScreenObj = screenObjFeatures.has(nodes[id].feature);
  }

  const edges = [
    { from: 'LAUNCH', to: nodeId('Account', 'Login'),            label: 'Sign In' },
    { from: 'LAUNCH', to: nodeId('Home', 'Guest Home'),           label: 'Guest' },
    { from: nodeId('Account', 'Login'),        to: nodeId('Account', 'OTP Verify'),       label: 'submit creds' },
    { from: nodeId('Account', 'OTP Verify'),   to: nodeId('Home', 'Auth Home'),            label: 'verified' },
    { from: nodeId('Home', 'Auth Home'),        to: nodeId('Home', 'ANBA Cards'),           label: 'activity' },
    { from: nodeId('Home', 'Auth Home'),        to: nodeId('Home', 'Health Services'),      label: 'health widget' },
    { from: nodeId('Home', 'Auth Home'),        to: nodeId('Home', 'Business Units'),       label: 'BU section' },
    { from: nodeId('Home', 'Auth Home'),        to: nodeId('Home', 'Discovery'),            label: 'discovery' },
    { from: nodeId('Home', 'Auth Home'),        to: nodeId('Pharmacy', 'Rx List'),          label: 'Pharmacy tab' },
    { from: nodeId('Home', 'Auth Home'),        to: nodeId('Benefits', 'Benefits Dashboard'), label: 'Benefits tab' },
    { from: nodeId('Home', 'Auth Home'),        to: nodeId('Shop', 'Product Search'),       label: 'Shop tab' },
    { from: nodeId('Home', 'Auth Home'),        to: nodeId('Health', 'Health Dashboard'),   label: 'Health' },
    { from: nodeId('Home', 'Auth Home'),        to: nodeId('MCCore', 'Find Care'),          label: 'Find Care' },
    { from: nodeId('Home', 'Auth Home'),        to: nodeId('Chatbot', 'Chat Interface'),    label: 'Chat' },
    { from: nodeId('Home', 'Auth Home'),        to: nodeId('VM', 'Visit Setup'),            label: 'Virtual Visit' },
    { from: nodeId('Pharmacy', 'Rx List'),      to: nodeId('Pharmacy', 'Rx Detail'),        label: 'select Rx' },
    { from: nodeId('Pharmacy', 'Rx List'),      to: nodeId('Pharmacy', 'Chat'),             label: 'chat icon' },
    { from: nodeId('Pharmacy', 'Rx List'),      to: nodeId('Pharmacy', 'Message Hub'),      label: 'messages' },
    { from: nodeId('Benefits', 'Benefits Dashboard'), to: nodeId('Benefits', 'Claims'),     label: 'claims' },
    { from: nodeId('Benefits', 'Benefits Dashboard'), to: nodeId('Benefits', 'Find Care'),  label: 'find care' },
    { from: nodeId('Benefits', 'Benefits Dashboard'), to: nodeId('Benefits', 'Spending'),   label: 'spending' },
    { from: nodeId('Benefits', 'Benefits Dashboard'), to: nodeId('Benefits', 'Drug Pricing'), label: 'drug pricing' },
    { from: nodeId('Shop', 'Product Search'),   to: nodeId('Shop', 'Product Detail'),       label: 'select item' },
    { from: nodeId('Shop', 'Product Detail'),   to: nodeId('Shop', 'Cart'),                 label: 'add to cart' },
    { from: nodeId('Shop', 'Cart'),             to: nodeId('Shop', 'Checkout'),             label: 'checkout' },
    { from: nodeId('Shop', 'Checkout'),         to: nodeId('Shop', 'Order Confirm'),        label: 'place order' },
    { from: nodeId('MCCore', 'Find Care'),      to: nodeId('MCCore', 'Clinic Detail'),      label: 'select clinic' },
    { from: nodeId('MCCore', 'Clinic Detail'),  to: nodeId('MCCore', 'Book Appointment'),   label: 'book' },
    { from: nodeId('Health', 'Health Dashboard'), to: nodeId('Health', 'Health Records'),   label: 'records' },
    { from: nodeId('NGS', 'Vaccine Schedule'),  to: nodeId('NGS', 'Vaccine Confirm'),       label: 'confirm' },
    { from: nodeId('VM', 'Visit Setup'),        to: nodeId('VM', 'Visit Room'),             label: 'join visit' },
    { from: nodeId('Home', 'Auth Home'),        to: nodeId('NGS', 'Vaccine Schedule'),      label: 'immunizations' },
  ];

  const featureStats = {};
  for (const [feature, screenList] of Object.entries(FEATURE_SCREENS)) {
    const covered = screenList.filter(s => (nodes[nodeId(feature, s)]?.testCount || 0) > 0).length;
    featureStats[feature] = { total: screenList.length, covered, pct: Math.round((covered / screenList.length) * 100) };
  }

  const totalCovered = Object.values(nodes).filter(n => n.testCount > 0).length;
  const totalNodes = Object.values(nodes).length;

  return {
    nodes: Object.values(nodes),
    edges,
    featureStats,
    totalFlows: flows.length,
    totalNodes,
    totalCovered,
    overallPct: Math.round((totalCovered / totalNodes) * 100),
    subflowCount: subflows.length,
    screenObjCount: screens.length,
  };
}

// ─── DOT Generator ────────────────────────────────────────────────────────────

function coverageColor(count) {
  if (count === 0) return '#6B1A1A';
  if (count < 3)  return '#6B5500';
  if (count < 8)  return '#1A5C2A';
  return '#0A3D1A';
}

function coverageBorder(count) {
  if (count === 0) return '#CC3333';
  if (count < 3)  return '#E8A838';
  if (count < 8)  return '#27AE60';
  return '#00CC44';
}

function generateDOT(graph) {
  const { nodes, edges } = graph;
  const byFeature = {};
  for (const n of nodes) {
    (byFeature[n.feature] = byFeature[n.feature] || []).push(n);
  }

  const lines = [
    'digraph CVSApp {',
    '  rankdir=LR;',
    '  graph [bgcolor="#0D0D1A" pad=1.2 nodesep=0.55 ranksep=2.0 fontname="Arial" splines=polyline];',
    '  node [shape=box style="filled,rounded" fontname="Arial" fontcolor=white fontsize=10 margin=0.15];',
    '  edge [color="#3A5A7A" fontcolor="#7A9ABF" fontsize=8 arrowsize=0.6];',
    '',
    '  LAUNCH [label="App Launch" shape=diamond fillcolor="#444466" color="#8888CC" fontsize=11 width=1.8 fontcolor=white];',
    '',
  ];

  for (const [feature, fnodes] of Object.entries(byFeature)) {
    const c = FEATURE_COLORS[feature] || FEATURE_COLORS.General;
    lines.push(`  subgraph cluster_${feature} {`);
    lines.push(`    label="${feature}";`);
    lines.push(`    style=filled; fillcolor="${c.cluster}"; color="${c.border}"; fontcolor=white; fontsize=12; fontname="Arial Bold";`);
    lines.push('');
    for (const n of fnodes) {
      const lbl = `${n.label}\\n(${n.testCount} test${n.testCount !== 1 ? 's' : ''})`;
      const tip = n.testCount > 0
        ? `${n.testCount} test(s): ${n.flows.slice(0, 3).join(', ')}${n.flows.length > 3 ? '...' : ''}`
        : 'No tests — coverage gap!';
      lines.push(`    ${n.id} [label="${lbl}" fillcolor="${coverageColor(n.testCount)}" color="${coverageBorder(n.testCount)}" tooltip="${tip}"];`);
    }
    lines.push('  }');
    lines.push('');
  }

  lines.push('  // Navigation transitions');
  for (const e of edges) {
    lines.push(`  ${e.from} -> ${e.to} [label="${e.label}"];`);
  }
  lines.push('}');
  return lines.join('\n');
}

// ─── Ollama Integration ───────────────────────────────────────────────────────

async function listOllamaModels() {
  try {
    const r = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (!r.ok) return null;
    const data = await r.json();
    return (data.models || []).map(m => m.name);
  } catch { return null; }
}

async function ollamaChat(messages, model) {
  const r = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: model || OLLAMA_MODEL, messages, stream: false }),
    signal: AbortSignal.timeout(60000),
  });
  if (!r.ok) throw new Error(`Ollama HTTP ${r.status}`);
  const data = await r.json();
  return data.message?.content || '';
}

function buildSystemPrompt(graphData, anbaGaps) {
  const { featureStats, totalFlows, totalNodes, totalCovered, overallPct, subflowCount } = graphData;
  const gapFeatures = Object.entries(featureStats)
    .filter(([, s]) => s.pct < 50)
    .map(([f, s]) => `${f} (${s.pct}%)`)
    .join(', ');
  const wellCovered = Object.entries(featureStats)
    .filter(([, s]) => s.pct >= 80)
    .map(([f, s]) => `${f} (${s.pct}%)`)
    .join(', ');

  let anbaSection = '';
  if (anbaGaps && anbaGaps.source === 'aem' && anbaGaps.missingCount > 0) {
    const top5 = anbaGaps.missing.slice(0, 5).map(g => `  - ${g.id}: "${g.title}"`).join('\n');
    anbaSection = `
Homescreen ANBA Gap Analysis (from live AEM CMS):
- AEM has ${anbaGaps.totalAEM} activity NBA cards configured
- ${anbaGaps.coveredCount} have Maestro test flows (${anbaGaps.coveragePct}%)
- ${anbaGaps.missingCount} ANBAs have NO test coverage — top gaps:
${top5}
`;
  }

  return `You are an expert mobile test automation engineer for the CVS Pharmacy iOS/Android app.
You specialize in homescreen architecture, AEM NBA configurations, and personalization engine integrations.
You help teams understand UI test coverage, identify gaps, and generate Maestro YAML test flows.

═══════════════════════════════════════════════════════════════════════════════
HOMESCREEN ARCHITECTURE (from docs/maestro/features/homescreen/)
═══════════════════════════════════════════════════════════════════════════════

The homescreen has 3 main zones controlled by LaunchDarkly flags, AEM config, and backend APIs:

1. ACTIVITY ZONE (ANBAs - Action NBAs)
   ├─ Visibility: Authenticated users only (LOA2+)
   ├─ Data Sources:
   │  ├─ LaunchDarkly: homescreen_activity_* flags
   │  ├─ User Profile: Orders, linked SSKs (RxConnect, Specialty, Caremark, Counsel, Oakstreet)
   │  ├─ AEM Config: Module rank/order per segment
   │  └─ Backend APIs:
   │     ├─ Pharmacy (RxP): /api/pharmacy/prescriptions → prescription status
   │     ├─ Immunization (IMZ): /api/immunization/schedule → vaccine eligibility
   │     ├─ Minute Clinic (MC): /api/minuteclinic/availability → clinic availability
   │     └─ Pharmacy Locator (PLSS): /api/pharmacy/locator → CVS locations
   ├─ Card Types:
   │  ├─ Priority NBAs: Not filled, Delayed (urgent actions)
   │  └─ Activity NBAs: Ready for pickup, Available for refill, Available for renewal, We're working on it
   ├─ API Timeout: >10s → skip card, show next
   └─ Test Files: HS-2.*.yaml (75+ flows covering prescription states)

2. DISCOVERY ZONE (DNBAs - Discovery NBAs)
   ├─ Visibility: All users (guest & authenticated)
   ├─ Data Sources:
   │  ├─ LaunchDarkly: homescreen_discovery_* flags
   │  ├─ User Behavior: Purchase history, browse history, engagement signals
   │  ├─ AEM Config: Module rank/order per segment
   │  └─ Backend APIs:
   │     ├─ Recommendations: /api/recommendations/products → personalized products
   │     ├─ Deals: /api/deals/active → photo deals, seasonal promos
   │     ├─ ExtraCare: /api/loyalty/extracare/offers → member-only deals
   │     ├─ Health: /api/health/recommendations → health & wellness products
   │     └─ Shop: /api/shop/categories → featured products
   ├─ Card Types:
   │  ├─ Photo Deals
   │  ├─ ExtraCare Plus Savings
   │  ├─ Health & Wellness
   │  ├─ Seasonal Promotions
   │  ├─ Brand Partnerships
   │  └─ Personalized Recommendations
   ├─ API Timeout: >10s → skip card, show next
   └─ Test Files: HS-3.*.yaml (discovery card flows)

3. BUSINESS UNITS (BUs - Service Hubs)
   ├─ Visibility: All users (guest & authenticated, eligibility-gated)
   ├─ Data Sources:
   │  ├─ LaunchDarkly: homescreen_bu_* flags
   │  ├─ User Eligibility: Age, location, insurance, SSK links
   │  ├─ AEM Config: Module rank/order per segment
   │  └─ Backend APIs (per BU):
   │     ├─ Counsel Health: /api/counsel/availability → provider availability
   │     ├─ At the Pharmacy: /api/pharmacy/prescriptions + /api/pharmacy/locator
   │     ├─ Health Services: /api/immunization/availability → vaccine slots
   │     ├─ ExtraCare Savings: /api/loyalty/extracare/status → member tier, points
   │     ├─ Shop Essentials: /api/shop/categories → product categories
   │     └─ Oakstreet Health: /api/oakstreet/clinics → clinic availability
   ├─ BU Types: Counsel, Pharmacy, Health Services, ExtraCare, Shop, Oakstreet
   ├─ API Timeout: >10s → skip BU, show next
   └─ Test Files: HS-9.*.yaml, HS-11.*.yaml, HS-16.*.yaml, HS-17.*.yaml, HS-18.*.yaml

═══════════════════════════════════════════════════════════════════════════════
COVERAGE ANALYSIS
═══════════════════════════════════════════════════════════════════════════════

Current Coverage Summary:
- Total screen states mapped: ${totalNodes}
- Covered by tests: ${totalCovered} (${overallPct}%)
- Total Maestro flow files: ${totalFlows}
- Total subflows: ${subflowCount}

Feature Coverage:
${Object.entries(featureStats).map(([f, s]) => `- ${f}: ${s.covered}/${s.total} screens (${s.pct}%)`).join('\n')}

Well-covered features: ${wellCovered || 'none'}
Coverage gaps (< 50%): ${gapFeatures || 'none'}
${anbaSection}

═══════════════════════════════════════════════════════════════════════════════
HOMESCREEN GAP ANALYSIS (from AEM CMS)
═══════════════════════════════════════════════════════════════════════════════

When analyzing homescreen gaps:
1. Compare AEM-configured NBAs against existing HS-*.yaml flows
2. Identify missing prescription states (not filled, delayed, ready, etc.)
3. Check for missing BU coverage (Counsel, Pharmacy, Health Services, ExtraCare, Shop, Oakstreet)
4. Verify API integration tests (Pharmacy, IMZ, MC, PLSS, Counsel, ExtraCare, Shop, Health)
5. Test graceful degradation when APIs timeout or fail
6. Validate LaunchDarkly flag respect (cards hidden when flag OFF)
7. Test user segment variations (Guest, LOA2, RxTie, ExtraCare Plus)

Common Missing Test Scenarios:
- API timeout handling (>10s) → card should skip gracefully
- API error (4xx/5xx) → card should skip gracefully
- No data returned → card not displayed (not an error)
- All APIs fail → show "Something went wrong" banner
- SSK link mismatch → profile says RxTie but Pharmacy API returns no data
- LaunchDarkly flag OFF → entire zone/BU hidden
- Guest user → no personalized recommendations, limited BUs
- Authenticated user → full personalization, all eligible BUs

═══════════════════════════════════════════════════════════════════════════════
MAESTRO YAML FORMAT & CONVENTIONS
═══════════════════════════════════════════════════════════════════════════════

appId: \${APP_ID}
tags:
  - feature_name
  - smoke
onFlowStart:
  - runScript: ../../screens/Account/accountObjects.js
  - runScript: ../../screens/Home/homescreenObjects.js
  - runScript:
      file: ../../testdata/users_qa.js
      env:
          loginData: LOA2
---
- runFlow: ../../subflows/common/launchApp.yaml
- tapOn: \${output.account_onboarding.letsGetStartedBtn}
- runFlow: ../../subflows/account/complete_signin_and_otp_dob.yaml
- assertVisible: \${output.homescreen_discover.discoverHeader}

Screen object files by feature:
- Account: screens/Account/accountObjects.js, OnboardingScreen.js, LoginScreen.js
- Home: screens/Home/homescreenObjects.js
- Benefits: screens/Benefits/BenefitsDashboardScreen.js, ClaimsScreen.js, FindCareScreen.js
- Pharmacy: screens/Pharmacy/pharmacyObjects.js
- Shop: screens/Shop/CartScreen.js, CheckoutScreen.js
- Common: screens/Common/commonObjects.js

When generating tests, ALWAYS follow these conventions:
- appId: \${APP_ID} (never hardcode)
- Use \${output.screenName.elementKey} for all UI element references
- onFlowStart: load screen objects with runScript THEN test data
- testdata path: ../../testdata/users_qa.js with env.loginData matching user type
- subflow paths use ../../subflows/category/name.yaml format
- Keep flows focused on one screen/scenario (8–15 steps)`;
}

function fallbackChat(message) {
  const m = message.toLowerCase();
  if (m.includes('gap') || m.includes('uncovered') || m.includes('missing')) {
    return 'Based on the graph, **Shop** (0%), **Health** (0%), **MCCore** (0%), **NGS** (0%), **VM** (0%), and **Chatbot** (0%) have no test coverage. **Home** has the best coverage due to its many ANBA card flows.';
  }
  if (m.includes('generate') || m.includes('create') || m.includes('write')) {
    return 'Click any **red node** in the graph (no tests) and hit **Generate Test** to auto-generate a Maestro YAML for that screen. You can also ask me: "generate a test for Shop/Cart"';
  }
  if (m.includes('home') || m.includes('anba')) {
    return 'The **Home** feature has the most coverage — primarily ANBA card states (75+ flows in HS-*.yaml). Guest Home, Splitview, and some BU states need more tests.';
  }
  if (m.includes('benefit')) {
    return 'Benefits has partial coverage. Claims, Find Care, and Spending have some flows but Prior Auth, Plan Documents, and Drug Pricing need more tests.';
  }
  if (m.includes('pharmacy')) {
    return 'Pharmacy has minimal coverage. Rx List and Rx Detail have some flows but Chat, Message Hub, and Pharmacy Locator need attention.';
  }
  return `I can help you with:
- **Coverage analysis**: "What screens have no tests?"
- **Gap identification**: "Show me the biggest coverage gaps"
- **Test generation**: "Generate a test for Shop/Cart"
- **Feature deep-dives**: "How is Benefits coverage looking?"
- **Recommendations**: "What should I test next?"

Click a node in the graph for details, or ask me anything about the test suite!`;
}

// ─── Test Generator ───────────────────────────────────────────────────────────

function buildTestGenPrompt(nodeInfo, graphData, featureDocs) {
  const { label, feature, testCount, flows } = nodeInfo;
  const existingFlows = flows.slice(0, 3).join(', ') || 'none';

  const doc = getFeatureDocContent(feature, featureDocs || {});
  // Extract relevant sections from the feature doc (screen objects + business rules)
  let docContext = '';
  if (doc) {
    const sections = [];
    // Pull Screen Objects section
    const screenObjMatch = doc.match(/## Screen Objects[\s\S]*?(?=\n## |\n---\n|$)/);
    if (screenObjMatch) sections.push(screenObjMatch[0].slice(0, 2000));
    // Pull Business Rules section
    const rulesMatch = doc.match(/## Business Rules[\s\S]*?(?=\n## |\n---\n|$)/);
    if (rulesMatch) sections.push(rulesMatch[0].slice(0, 1500));
    // Pull Common Subflows section
    const subflowMatch = doc.match(/## Common Subflows[\s\S]*?(?=\n## |\n---\n|$)/);
    if (subflowMatch) sections.push(subflowMatch[0].slice(0, 800));
    if (sections.length) docContext = `\n\nFeature documentation for ${feature}:\n${sections.join('\n\n')}`;
  }

  const screenObjMap = {
    Home:     ['../../screens/Account/accountObjects.js', '../../screens/Home/homescreenObjects.js'],
    Benefits: ['../../screens/Account/accountObjects.js', '../../screens/Benefits/BenefitsDashboardScreen.js'],
    Account:  ['../../screens/Account/accountObjects.js'],
    Pharmacy: ['../../screens/Account/accountObjects.js', '../../screens/Pharmacy/pharmacyObjects.js'],
    Shop:     ['../../screens/Account/accountObjects.js', '../../screens/Shop/CartScreen.js'],
    Health:   ['../../screens/Account/accountObjects.js', '../../screens/Health/HealthScreen.js', '../../screens/Health/MinuteClinicSchedulingScreen.js', '../../screens/Health/VirtualMedicineScreen.js'],
    MCCore:   ['../../screens/Account/accountObjects.js', '../../screens/Health/MinuteClinicSchedulingScreen.js'],
    NGS:      ['../../screens/Account/accountObjects.js', '../../screens/Health/MinuteClinicSchedulingScreen.js'],
    Chatbot:  ['../../screens/Account/accountObjects.js', '../../screens/SearchAndNav/ChatbotScreen.js'],
    VM:       ['../../screens/Account/accountObjects.js', '../../screens/Health/VirtualMedicineScreen.js'],
  };
  const screenScripts = (screenObjMap[feature] || ['../../screens/Account/accountObjects.js'])
    .map(s => `  - runScript: ${s}`).join('\n');

  return `Generate a complete Maestro YAML test flow for the CVS Pharmacy app.

Target:
- Feature: ${feature}
- Screen: ${label}
- Existing tests: ${testCount} (${existingFlows})
${docContext}

STRICT FORMAT RULES — your output must match these exactly:
1. appId: \${APP_ID}
2. tags: include ${feature.toLowerCase()}, the screen type, and smoke
3. onFlowStart block MUST load screen objects with runScript, then test data:
   - runScript files for this feature:
${screenScripts}
   - runScript:
       file: ../../testdata/users_qa.js
       env:
           loginData: <appropriate user type from docs above>
4. Separator line: ---
5. Steps use \${output.objectName.elementKey} for ALL UI element references
6. First step: - runFlow: ../../subflows/common/launchApp.yaml
7. Login via: - runFlow: ../../subflows/account/complete_signin_and_otp_dob.yaml
8. 8–15 steps total, focused on one happy path scenario
9. Add assertVisible / extendedWaitUntil for key elements
10. Reference real subflows from docs above where available

Return ONLY valid YAML, no explanation, no markdown fences.`;
}

function generateFallbackTest(nodeInfo, featureDocs) {
  const { label, feature, flows } = nodeInfo;
  const featureLower = feature.toLowerCase();
  const screenSnake = label.toLowerCase().replace(/[^a-z0-9]/g, '_');
  const existingRef = flows[0] ? `\n# Reference flow: ${flows[0]}` : '';

  // Screen object scripts per feature (matching actual repo structure)
  const screenScriptMap = {
    Home:     ['../../screens/Account/accountObjects.js', '../../screens/Home/homescreenObjects.js'],
    Benefits: ['../../screens/Account/accountObjects.js', '../../screens/Benefits/BenefitsDashboardScreen.js'],
    Account:  ['../../screens/Account/accountObjects.js'],
    Pharmacy: ['../../screens/Account/accountObjects.js', '../../screens/Pharmacy/pharmacyObjects.js'],
    Shop:     ['../../screens/Account/accountObjects.js', '../../screens/Shop/CartScreen.js'],
    Health:   ['../../screens/Account/accountObjects.js', '../../screens/Health/HealthScreen.js', '../../screens/Health/MinuteClinicSchedulingScreen.js', '../../screens/Health/VirtualMedicineScreen.js'],
    MCCore:   ['../../screens/Account/accountObjects.js', '../../screens/Health/MinuteClinicSchedulingScreen.js'],
    NGS:      ['../../screens/Account/accountObjects.js', '../../screens/Health/MinuteClinicSchedulingScreen.js'],
    Chatbot:  ['../../screens/Account/accountObjects.js', '../../screens/SearchAndNav/ChatbotScreen.js'],
    VM:       ['../../screens/Account/accountObjects.js', '../../screens/Health/VirtualMedicineScreen.js'],
  };
  const scripts = (screenScriptMap[feature] || ['../../screens/Account/accountObjects.js'])
    .map(s => `  - runScript: ${s}`).join('\n');

  // Pull screen object examples from feature doc
  const doc = getFeatureDocContent(feature, featureDocs || {});
  let screenObjHint = '';
  if (doc) {
    const m = doc.match(/output\.\w+\s*=\s*\{[^}]+\}/);
    if (m) screenObjHint = `\n# Available elements (from docs):\n# ${m[0].split('\n').slice(0, 4).join('\n# ')}`;
  }

  return `# BUSINESS LOGIC: ${label}
# Feature: ${feature}
# Auto-generated — review selectors against actual screen objects before running
# See: docs/maestro/features/${(FEATURE_DOC_MAP[feature] || 'homescreen.md')}
${existingRef}${screenObjHint}

appId: \${APP_ID}
tags:
  - ${featureLower}
  - ${screenSnake}
  - smoke
  - generated
onFlowStart:
${scripts}
  - runScript:
        file: ../../testdata/users_qa.js
        env:
            loginData: LOA2
---
- runFlow: ../../subflows/common/launchApp.yaml
- tapOn: \${output.account_onboarding.letsGetStartedBtn}
- runFlow: ../../subflows/account/complete_signin_and_otp_dob.yaml
- runFlow: ../../subflows/SearchAndNav/bottom_nav_loaded.yaml
# TODO: Navigate to ${feature} / ${label}
# - tapOn: \${output.${featureLower}_navigation.someTab}
- extendedWaitUntil:
    visible: \${output.${featureLower}_screen.header}
    timeout: 10000
# TODO: Assert key elements visible on ${label}
# - assertVisible: \${output.${featureLower}_screen.primaryElement}
# - tapOn: \${output.${featureLower}_screen.primaryAction}
# - assertVisible: \${output.${featureLower}_screen.resultElement}
`;
}

// ─── Cached graph state ───────────────────────────────────────────────────────

let cachedGraph = null;
let cacheTime = 0;
const CACHE_TTL_MS = 30000;

async function getGraph() {
  if (cachedGraph && Date.now() - cacheTime < CACHE_TTL_MS) return cachedGraph;
  const [flows, screens, subflows, featureDocs] = await Promise.all([
    scanFlows(), scanScreens(), scanSubflows(), loadFeatureDocs(),
  ]);
  cachedGraph = buildGraph(flows, screens, subflows);
  cachedGraph._dot = generateDOT(cachedGraph);
  cachedGraph._flows = flows;
  cachedGraph._featureDocs = featureDocs;
  // Run ANBA gap analysis in background — don't block graph load
  analyzeANBAGaps(flows).then(gaps => {
    cachedGraph._anbaGaps = gaps;
    console.log(`[ANBA gaps] AEM: ${gaps.totalAEM} NBAs, covered: ${gaps.coveredCount}, missing: ${gaps.missingCount}${gaps.error ? ` (${gaps.error})` : ''}`);
  }).catch(() => {});
  cacheTime = Date.now();
  return cachedGraph;
}

// ─── REST Endpoints ───────────────────────────────────────────────────────────

app.get('/api/graph', async (req, res) => {
  try {
    const graph = await getGraph();
    res.json({
      dot: graph._dot,
      nodes: graph.nodes,
      edges: graph.edges,
      featureStats: graph.featureStats,
      totalFlows: graph.totalFlows,
      totalNodes: graph.totalNodes,
      totalCovered: graph.totalCovered,
      overallPct: graph.overallPct,
      subflowCount: graph.subflowCount,
      screenObjCount: graph.screenObjCount,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err) });
  }
});

app.get('/api/flows', async (req, res) => {
  try {
    const graph = await getGraph();
    res.json({ flows: graph._flows });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get('/api/ollama/status', async (req, res) => {
  const models = await listOllamaModels();
  res.json({ available: models !== null, models: models || [], defaultModel: OLLAMA_MODEL });
});

app.post('/api/chat', async (req, res) => {
  const { message, history = [], model } = req.body;
  if (!message) return res.status(400).json({ error: 'message required' });

  try {
    const graph = await getGraph();
    const systemPrompt = buildSystemPrompt(graph, graph._anbaGaps);
    const models = await listOllamaModels();

    // Inject feature documentation context into user message for homescreen queries
    let enrichedMessage = message;
    const m = message.toLowerCase();
    if (m.includes('homescreen') || m.includes('anba') || m.includes('gap') || m.includes('discover') || m.includes('business unit')) {
      // Add feature doc excerpts to the message
      let docContext = '';
      if (graph._featureDocs && graph._featureDocs['homescreen-activity-zone']) {
        docContext += `\n\n[FEATURE CONTEXT: Activity Zone]\n${graph._featureDocs['homescreen-activity-zone'].slice(0, 1500)}`;
      }
      if (graph._featureDocs && graph._featureDocs['homescreen-discover-nbas']) {
        docContext += `\n\n[FEATURE CONTEXT: Discovery NBAs]\n${graph._featureDocs['homescreen-discover-nbas'].slice(0, 1500)}`;
      }
      if (graph._featureDocs && graph._featureDocs['homescreen-business-units']) {
        docContext += `\n\n[FEATURE CONTEXT: Business Units]\n${graph._featureDocs['homescreen-business-units'].slice(0, 1500)}`;
      }
      
      // Add gap analysis if available
      if (graph._anbaGaps && graph._anbaGaps.missing && graph._anbaGaps.missing.length > 0) {
        docContext += `\n\n[ANBA GAP ANALYSIS]\nTotal AEM NBAs: ${graph._anbaGaps.totalAEM}\nCovered: ${graph._anbaGaps.coveredCount}\nMissing: ${graph._anbaGaps.missingCount}\nTop missing NBAs:\n${graph._anbaGaps.missing.slice(0, 10).map(g => `- ${g.id}: "${g.title}"`).join('\n')}`;
      }
      
      enrichedMessage = message + docContext;
    }

    if (models) {
      const selectedModel = model || (models.includes(OLLAMA_MODEL) ? OLLAMA_MODEL : models[0]);
      const messages = [
        { role: 'system', content: systemPrompt },
        ...history.slice(-6),
        { role: 'user', content: enrichedMessage },
      ];
      try {
        const reply = await ollamaChat(messages, selectedModel);
        return res.json({ reply, source: 'ollama', model: selectedModel });
      } catch (e) {
        console.warn('Ollama chat failed:', e.message);
      }
    }

    res.json({ reply: fallbackChat(message), source: 'fallback' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err) });
  }
});

app.post('/api/generate-test', async (req, res) => {
  const { nodeId: nid, model } = req.body;
  if (!nid) return res.status(400).json({ error: 'nodeId required' });

  try {
    const graph = await getGraph();
    const nodeInfo = graph.nodes.find(n => n.id === nid);
    if (!nodeInfo) return res.status(404).json({ error: 'Node not found' });

    const models = await listOllamaModels();
    if (models) {
      const selectedModel = model || (models.includes(OLLAMA_MODEL) ? OLLAMA_MODEL : models[0]);
      const prompt = buildTestGenPrompt(nodeInfo, graph, graph._featureDocs);
      try {
        const yaml = await ollamaChat([{ role: 'user', content: prompt }], selectedModel);
        return res.json({ yaml, source: 'ollama', model: selectedModel, nodeInfo });
      } catch (e) {
        console.warn('Ollama test gen failed:', e.message);
      }
    }

    res.json({ yaml: generateFallbackTest(nodeInfo, graph._featureDocs), source: 'template', nodeInfo });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: String(err) });
  }
});

app.get('/api/gaps', async (req, res) => {
  try {
    const graph = await getGraph();
    if (!graph._anbaGaps) {
      graph._anbaGaps = await analyzeANBAGaps(graph._flows);
    }
    res.json(graph._anbaGaps);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

app.get('/api/refresh', async (req, res) => {
  cachedGraph = null;
  cachedFeatureDocs = null;
  cacheTime = 0;
  const graph = await getGraph();
  res.json({ ok: true, totalFlows: graph.totalFlows, totalNodes: graph.totalNodes });
});

// Static files served AFTER all API routes to prevent /api/* from returning index.html
app.use(express.static(__dirname));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// ─── Start ────────────────────────────────────────────────────────────────────

const server = app.listen(PORT, () => {
  console.log(`\n🗺️  UI State Mapper running at http://localhost:${PORT}`);
  console.log(`📁 Scanning: ${MAESTRO_ROOT}`);
  console.log(`🤖 Ollama: ${OLLAMA_URL} (model: ${OLLAMA_MODEL})`);
  console.log(`   → Set OLLAMA_MODEL env var to change model (e.g. llama3, codellama)\n`);
});

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Port ${PORT} is already in use.`);
    console.error(`   Run with a different port: PORT=3004 node server.js\n`);
  } else {
    console.error(err);
  }
  process.exit(1);
});
