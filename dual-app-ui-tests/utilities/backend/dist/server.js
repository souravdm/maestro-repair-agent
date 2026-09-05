"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = require("http");
const ws_1 = require("ws");
const dotenv_1 = __importDefault(require("dotenv"));
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const util_1 = require("util");
const path_1 = __importDefault(require("path"));
const accessibility_1 = require("./accessibility");
const native_a11y_scanner_1 = require("./native-a11y-scanner");
const flowClassifier_1 = require("./flowClassifier");
const chatbot_1 = require("./chatbot");
const studioClient_1 = require("./studioClient");
const frameworkIndex_1 = require("./frameworkIndex");
// Pulse component validator disabled in the recorder utility
const pulseValidator = null;
dotenv_1.default.config();
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
const wss = new ws_1.WebSocketServer({ server });
const PORT = process.env.PORT || 3001;
const execFileAsync = (0, util_1.promisify)(child_process_1.execFile);
const PROJECT_ROOT = path_1.default.resolve(__dirname, '../../../');
const FLOW_OUTPUT_DIR = path_1.default.join(PROJECT_ROOT, '.maestro', 'flows');
const MAESTRO_ROOT = path_1.default.join(PROJECT_ROOT, '.maestro');
// Framework index — built at startup, refreshable via POST /api/framework/refresh
let cachedFrameworkIndex = null;
let frameworkIndexBuilding = false;
async function getFrameworkIndex() {
    if (cachedFrameworkIndex)
        return cachedFrameworkIndex;
    if (!frameworkIndexBuilding) {
        frameworkIndexBuilding = true;
        (0, frameworkIndex_1.buildFrameworkIndex)(MAESTRO_ROOT)
            .then(idx => { cachedFrameworkIndex = idx; })
            .catch(err => console.warn('[framework] index build failed:', err))
            .finally(() => { frameworkIndexBuilding = false; });
    }
    // Return an empty index while the build is in flight — callers will retry
    return { subflows: [], flows: [], screens: [], totalFiles: 0, buildTimeMs: 0 };
}
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
// Recorder documentation — served from disk so the "View Documentation"
// button in the UI doesn't need a hardcoded absolute path baked into the
// frontend bundle. Tries a couple of known locations and falls back to a
// helpful message if none exist, so the button never dead-ends.
app.get('/api/docs/recorder', async (_req, res) => {
    const candidates = [
        // Preferred: the recorder's own README (co-located, always in sync).
        path_1.default.join(PROJECT_ROOT, 'maestro-recorder', 'README.md'),
        // Repo-level guide, if present.
        path_1.default.join(PROJECT_ROOT, 'docs', 'guides', 'MAESTRO_RECORDER.md'),
        // Legacy path some builds referenced.
        path_1.default.join(PROJECT_ROOT, 'docs', 'framework-features', 'MAESTRO_FLOW_RECORDER.md'),
    ];
    for (const p of candidates) {
        try {
            const content = await fs_1.promises.readFile(p, 'utf8');
            const rel = path_1.default.relative(PROJECT_ROOT, p);
            res.type('text/markdown').send(`<!-- source: ${rel} -->\n${content}`);
            return;
        }
        catch {
            // Try next candidate.
        }
    }
    res.status(404).type('text/markdown').send('# Documentation not found\n\nExpected one of:\n' +
        candidates.map((c) => `- \`${path_1.default.relative(PROJECT_ROOT, c)}\``).join('\n'));
});
// API Routes
app.get('/api/devices', async (req, res) => {
    // TODO: Implement device listing
    res.json({
        devices: [
            { id: 'ios-simulator', name: 'iPhone 17 Pro', platform: 'ios', status: 'available' },
            { id: 'android-emulator', name: 'Pixel 8 Pro', platform: 'android', status: 'available' }
        ]
    });
});
app.get('/api/recordings', async (req, res) => {
    // TODO: Implement recordings listing
    res.json({ recordings: [] });
});
app.post('/api/recordings', async (req, res) => {
    // TODO: Implement recording creation
    res.json({ id: 'rec-1', name: req.body.name, status: 'created' });
});
app.post('/api/generate-screen-preview', async (req, res) => {
    try {
        const { elements, appId, flowName } = req.body;
        if (!elements || elements.length === 0) {
            return res.json({ success: false, error: 'No elements provided' });
        }
        const screenName = inferScreenName(flowName, elements);
        const category = inferCategory(appId, elements);
        const screenObject = generateScreenObject(elements, screenName, category);
        res.json({
            success: true,
            content: screenObject,
            screenName,
            category
        });
    }
    catch (error) {
        console.error('Generate screen preview error:', error);
        res.json({ success: false, error: String(error) });
    }
});
app.post('/api/generate-screen', async (req, res) => {
    try {
        const { elements, appId, flowName } = req.body;
        if (!elements || elements.length === 0) {
            return res.json({ success: false, error: 'No elements provided' });
        }
        const screenName = inferScreenName(flowName, elements);
        const category = inferCategory(appId, elements);
        const screenObject = generateScreenObject(elements, screenName, category);
        const screenDir = path_1.default.join(PROJECT_ROOT, '.maestro', 'screens', category);
        await fs_1.promises.mkdir(screenDir, { recursive: true });
        const filename = `${screenName}Screen.js`;
        const filepath = path_1.default.join(screenDir, filename);
        await fs_1.promises.writeFile(filepath, screenObject, 'utf8');
        res.json({
            success: true,
            filename: `${category}/${filename}`,
            path: filepath
        });
    }
    catch (error) {
        console.error('Generate screen error:', error);
        res.json({ success: false, error: String(error) });
    }
});
// ── Framework Index endpoints ─────────────────────────────────────────────────
// GET /api/framework
// Returns the full index (subflows, flows, screens) with metadata suitable for
// driving the "Framework Guidance" panel in the recorder UI.
// textTokens is a string[] rather than a Set so it JSON-serialises cleanly.
app.get('/api/framework', async (_req, res) => {
    try {
        const idx = await getFrameworkIndex();
        res.json({
            ready: idx.totalFiles > 0,
            totalFiles: idx.totalFiles,
            buildTimeMs: idx.buildTimeMs,
            subflowCount: idx.subflows.length,
            flowCount: idx.flows.length,
            screenCount: idx.screens.length,
            subflows: idx.subflows.map(e => ({
                relativePath: e.relativePath,
                type: e.type,
                name: e.name,
                domain: e.domain,
                tags: e.tags,
                hasLaunchApp: e.hasLaunchApp,
                stepCount: e.stepCount,
                summary: e.summary,
                runFlowRefs: e.runFlowRefs,
            })),
            screens: idx.screens,
        });
    }
    catch (err) {
        res.status(500).json({ error: String(err) });
    }
});
// POST /api/framework/match
// Body: { steps: Array<{ type, target?, value? }> }
// Returns the top N subflows that best match the provided step list.
app.post('/api/framework/match', async (req, res) => {
    try {
        const { steps } = req.body;
        if (!Array.isArray(steps) || steps.length === 0) {
            return res.json({ matches: [], ready: false });
        }
        const idx = await getFrameworkIndex();
        if (idx.totalFiles === 0) {
            return res.json({ matches: [], ready: false, message: 'Framework index still building — try again shortly' });
        }
        const matches = (0, frameworkIndex_1.matchSteps)(steps, idx);
        res.json({
            ready: true,
            matches: matches.map(m => ({
                relativePath: m.entry.relativePath,
                name: m.entry.name,
                domain: m.entry.domain,
                type: m.entry.type,
                score: Math.round(m.score * 100),
                textScore: Math.round(m.textScore * 100),
                actionScore: Math.round(m.actionScore * 100),
                reason: m.reason,
                summary: m.entry.summary,
                stepCount: m.entry.stepCount,
                runFlowYaml: `- runFlow: ../../subflows/${m.entry.relativePath.replace(/^subflows\//, '')}`,
            })),
        });
    }
    catch (err) {
        res.status(500).json({ error: String(err) });
    }
});
// POST /api/framework/refresh
// Forces a rebuild of the index (useful after creating new subflows).
app.post('/api/framework/refresh', async (_req, res) => {
    try {
        cachedFrameworkIndex = null;
        const idx = await (0, frameworkIndex_1.buildFrameworkIndex)(MAESTRO_ROOT);
        cachedFrameworkIndex = idx;
        res.json({ success: true, totalFiles: idx.totalFiles, buildTimeMs: idx.buildTimeMs });
    }
    catch (err) {
        res.status(500).json({ success: false, error: String(err) });
    }
});
let activeRecording = null;
let hierarchyFetchInFlight = null;
let lastHierarchy = [];
let lastHierarchyAt = 0;
let lastHierarchyHash = ''; // sha1 of last broadcast tree — skip identical resends
let lastStudioScreenshot = null; // data URL captured with the hierarchy (Studio only)
let lastScreenshotPath = null; // For color validation
const DEFAULT_APP_ID = 'com.cvsenterpriseiphone.cvspharmacy';
const INTERACTIVE_STEP_TIMEOUT_MS = 30000;
const FAST_TAP_SETTLE_TIMEOUT_MS = 700;
let currentDevicePlatform = 'ios';
async function detectScreenTextViaOCR(screenshotPath, regionTop, regionBottom) {
    const scriptPath = path_1.default.join(__dirname, 'ocr-screen-text.swift');
    try {
        const args = [scriptPath, screenshotPath];
        if (regionTop !== undefined && regionBottom !== undefined) {
            args.push('--region', `${regionTop},${regionBottom}`);
        }
        const { stdout } = await execFileAsync('swift', args, { timeout: 15000 });
        const parsed = JSON.parse(stdout);
        if (Array.isArray(parsed)) {
            return parsed;
        }
        return [];
    }
    catch (error) {
        console.warn('⚠️ OCR text detection failed:', error instanceof Error ? error.message : error);
        return [];
    }
}
async function getScreenScaleFactor() {
    // Detect Retina scale factor from booted simulator
    try {
        const tmpPath = `/tmp/maestro-ocr-scale-${Date.now()}.png`;
        await execFileAsync('xcrun', ['simctl', 'io', 'booted', 'screenshot', tmpPath], { timeout: 8000 });
        const { stdout } = await execFileAsync('sips', ['-g', 'pixelWidth', tmpPath]);
        await fs_1.promises.unlink(tmpPath).catch(() => undefined);
        const match = stdout.match(/pixelWidth:\s*(\d+)/);
        if (match) {
            const pixelWidth = parseInt(match[1], 10);
            // Common iOS point widths: 390 (iPhone 14/15/16), 393, 402, 430
            // Scale 3x: 390*3=1170, 393*3=1179, 430*3=1290
            // Scale 2x: 375*2=750, 414*2=828
            if (pixelWidth > 1000)
                return 3;
            if (pixelWidth > 700)
                return 2;
        }
    }
    catch { /* fallback */ }
    return 3; // Default to 3x for modern iPhones
}
let cachedScaleFactor = null;
async function mergeOCRElements(hierarchy, screenshotPath) {
    if (!screenshotPath || currentDevicePlatform !== 'ios') {
        return hierarchy;
    }
    try {
        // Determine scale factor (cache it)
        if (!cachedScaleFactor) {
            cachedScaleFactor = await getScreenScaleFactor();
        }
        const scale = cachedScaleFactor;
        // Find the bottom region: scan the last ~20% of screen height for tab-like elements
        // Use the screenshot dimensions to calculate the OCR scan region
        const { stdout: sipsOut } = await execFileAsync('sips', ['-g', 'pixelHeight', screenshotPath]);
        const heightMatch = sipsOut.match(/pixelHeight:\s*(\d+)/);
        const pixelHeight = heightMatch ? parseInt(heightMatch[1], 10) : 2532;
        // Scan bottom 20% of screen (covers tab bar, bottom nav, etc.)
        const regionTop = Math.floor(pixelHeight * 0.80);
        const regionBottom = pixelHeight;
        const ocrRegions = await detectScreenTextViaOCR(screenshotPath, regionTop, regionBottom);
        if (ocrRegions.length === 0)
            return hierarchy;
        // Collect all existing text from hierarchy for deduplication
        // Store both exact texts and longer texts for substring matching
        const existingTexts = new Set(hierarchy.map(el => el.text.toLowerCase().trim()));
        const existingLongTexts = hierarchy
            .map(el => el.text.toLowerCase().trim())
            .filter(t => t.length > 30);
        // Convert OCR regions to HierarchyElements (pixel → point conversion)
        const ocrElements = [];
        for (const region of ocrRegions) {
            const textLower = region.text.toLowerCase().trim();
            // Skip if already in hierarchy (exact match)
            if (existingTexts.has(textLower))
                continue;
            // Skip if OCR text is a substring of an existing hierarchy element
            // (e.g. OCR splits a paragraph into lines that are already in hierarchy as one element)
            if (existingLongTexts.some(longText => longText.includes(textLower)))
                continue;
            if (region.text.length < 2)
                continue;
            if (/^\d+$/.test(region.text))
                continue; // Pure numbers (e.g. "00" badge)
            // Skip long text fragments (likely body text, not interactive elements)
            if (region.text.length > 40)
                continue;
            // Convert pixel coordinates to Maestro point-based bounds format
            const x1 = Math.round(region.x / scale);
            const y1 = Math.round(region.y / scale);
            const x2 = Math.round((region.x + region.width) / scale);
            const y2 = Math.round((region.y + region.height) / scale);
            const bounds = `[${x1},${y1}][${x2},${y2}]`;
            ocrElements.push({
                id: `ocr-${textLower.replace(/\s+/g, '-')}`,
                type: 'button',
                text: region.text,
                bounds,
                clickable: true,
                focused: false,
                ocrDetected: true
            });
        }
        if (ocrElements.length > 0) {
            console.log(`🔍 OCR fallback: detected ${ocrElements.length} additional elements: ${ocrElements.map(e => e.text).join(', ')}`);
        }
        return [...hierarchy, ...ocrElements];
    }
    catch (error) {
        console.warn('⚠️ OCR merge failed:', error instanceof Error ? error.message : error);
        return hierarchy;
    }
}
// Mock device hierarchy data for demo
const mockHierarchy = [
    { id: 'home-tab', type: 'button', text: 'Home', bounds: '0,800,100,900', clickable: true, focused: false },
    { id: 'account-tab', type: 'button', text: 'Account', bounds: '100,800,200,900', clickable: true, focused: false },
    { id: 'shop-tab', type: 'button', text: 'Shop', bounds: '200,800,300,900', clickable: true, focused: false },
    { id: 'search-field', type: 'textfield', text: 'Search CVS', bounds: '20,100,380,160', clickable: true, focused: false },
    { id: 'login-button', type: 'button', text: 'Sign in', bounds: '120,500,280,560', clickable: true, focused: false },
    { id: 'email-field', type: 'textfield', text: 'Email or phone', bounds: '40,300,360,360', clickable: true, focused: false },
    { id: 'password-field', type: 'securefield', text: 'Password', bounds: '40,380,360,440', clickable: true, focused: false },
    { id: 'continue-btn', type: 'button', text: 'Continue', bounds: '40,480,360,540', clickable: true, focused: false },
];
if (lastHierarchy.length === 0) {
    lastHierarchy = [...mockHierarchy];
}
// Mock screenshot (placeholder)
const mockScreenshot = 'data:image/svg+xml;base64,' + Buffer.from(`
  <svg width="390" height="844" xmlns="http://www.w3.org/2000/svg">
    <rect width="390" height="844" fill="#1E1E1E"/>
    <text x="195" y="100" font-family="Arial" font-size="24" fill="#FFFFFF" text-anchor="middle">CVS Pharmacy</text>
    <rect x="40" y="150" width="310" height="50" fill="#333" rx="8"/>
    <text x="195" y="182" font-family="Arial" font-size="16" fill="#999" text-anchor="middle">Search CVS</text>
    <rect x="40" y="300" width="310" height="50" fill="#333" rx="8"/>
    <text x="60" y="332" font-family="Arial" font-size="14" fill="#999" text-anchor="start">Email or phone</text>
    <rect x="40" y="370" width="310" height="50" fill="#333" rx="8"/>
    <text x="60" y="402" font-family="Arial" font-size="14" fill="#999" text-anchor="start">Password</text>
    <rect x="40" y="480" width="310" height="50" fill="#CC0000" rx="8"/>
    <text x="195" y="512" font-family="Arial" font-size="16" fill="#FFFFFF" text-anchor="middle" font-weight="bold">Continue</text>
    <rect x="20" y="780" width="80" height="60" fill="#333" rx="8"/>
    <text x="60" y="815" font-family="Arial" font-size="12" fill="#FFFFFF" text-anchor="middle">Home</text>
    <rect x="120" y="780" width="80" height="60" fill="#333" rx="8"/>
    <text x="160" y="815" font-family="Arial" font-size="12" fill="#FFFFFF" text-anchor="middle">Account</text>
    <rect x="220" y="780" width="80" height="60" fill="#333" rx="8"/>
    <text x="260" y="815" font-family="Arial" font-size="12" fill="#FFFFFF" text-anchor="middle">Shop</text>
  </svg>
`).toString('base64');
// WebSocket connection
wss.on('connection', (ws) => {
    console.log('🔌 WebSocket client connected');
    ws.send(JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() }));
    // Auto-detect frontmost app on the booted simulator
    detectFrontmostApp().then(detected => {
        if (detected) {
            ws.send(JSON.stringify({ type: 'app-detected', bundleId: detected.bundleId, displayName: detected.displayName }));
        }
    }).catch(() => { });
    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message.toString());
            console.log('📨 Received:', data.type);
            // Handle different message types
            switch (data.type) {
                case 'start-recording':
                    await handleStartRecording(ws, data);
                    break;
                case 'stop-recording':
                    handleStopRecording(ws, data);
                    break;
                case 'get-devices':
                    handleGetDevices(ws);
                    break;
                case 'refresh-screenshot':
                    await handleRefreshScreenshot(ws);
                    break;
                case 'get-hierarchy':
                    await handleGetHierarchy(ws);
                    break;
                case 'take-screenshot':
                    await handleTakeScreenshot(ws);
                    break;
                case 'switch-device':
                    await handleSwitchDevice(ws, data);
                    break;
                case 'validate-accessibility':
                    await handleValidateAccessibility(ws);
                    break;
                case 'validate-pulse':
                    await handleValidatePulse(ws);
                    break;
                case 'classify-steps':
                    await handleClassifySteps(ws, data);
                    break;
                case 'chat-message':
                    await handleChatMessage(ws, data);
                    break;
                case 'get-help-topics':
                    handleGetHelpTopics(ws);
                    break;
                case 'export-flow':
                    await handleExportFlow(ws, data);
                    break;
                case 'playback':
                    handlePlayback(ws, data);
                    break;
                case 'execute-step':
                    await handleExecuteStep(ws, data);
                    break;
                case 'execute-all-steps':
                    await handleExecuteAllSteps(ws, data);
                    break;
                case 'tap-element':
                    await handleTapElement(ws, data);
                    break;
                case 'detect-app':
                    await handleDetectApp(ws);
                    break;
                case 'ping':
                    ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
                    break;
                default:
                    console.log(`⚠️ Unknown message type: ${data.type}`);
                    ws.send(JSON.stringify({
                        type: 'error',
                        message: `Unknown message type: ${data.type}`
                    }));
            }
        }
        catch (error) {
            console.error('❌ WebSocket error:', error);
            ws.send(JSON.stringify({
                type: 'error',
                message: 'Failed to process message'
            }));
        }
    });
    ws.on('close', () => {
        console.log('🔌 WebSocket client disconnected');
        // Clean up any active recording
        if (activeRecording) {
            console.log('⚠️ Client disconnected during recording - cleaning up');
            activeRecording = null;
        }
    });
});
// Handler functions
function normalizeText(value) {
    if (typeof value !== 'string')
        return '';
    return value.trim();
}
function inferElementType(rawType, identifier, text) {
    const t = rawType.toLowerCase();
    const id = identifier.toLowerCase();
    const tx = text.toLowerCase();
    if (/secure|password|otp|code/.test(t) || /password|passcode|otp|verification_code|code_field/.test(id)) {
        return 'textField';
    }
    if (/textfield|text field|edittext|input|searchfield|secure/.test(t) ||
        /email|phone|mobile|username|search|input|field/.test(id) ||
        /search|enter|email|phone|mobile number|username|password/.test(tx)) {
        return 'textField';
    }
    if (/switch|toggle/.test(t) || /switch|toggle/.test(id)) {
        return 'switch';
    }
    if (/checkbox|radio/.test(t) || /checkbox|radio/.test(id)) {
        return 'check';
    }
    if (/^(continue with|continue as|sign in|log in|create account|create an account|join now|get started|shop now|add to cart|checkout|allow|close|done|next|back)/i.test(text)) {
        return 'button';
    }
    if (/button|btn|tabbar|tab/.test(t) || /button|btn|cta|tab|navbar|nav_item|close|dismiss|continue|submit|save|cancel|done|allow/.test(id)) {
        return 'button';
    }
    if (/^(close|done|continue|cancel|allow|sign in|log in|next|back|save)$/i.test(text)) {
        return 'button';
    }
    if (/link/.test(t) || /link|url|href/.test(id) || /terms|privacy|learn more|read more|see details|view all/.test(tx)) {
        return 'link';
    }
    if (/^[a-z]+[A-Z][a-zA-Z]+$/.test(text) || /heart|logo|icon|illustration|avatar/.test(tx)) {
        return 'image';
    }
    if (/image|icon|photo|avatar|illustration|logo/.test(t) || /image|icon|photo|avatar|illustration|logo/.test(id)) {
        return 'image';
    }
    if (/statictext|text|label|header|title/.test(t)) {
        return 'label';
    }
    if (tx) {
        return 'label';
    }
    return 'unknown';
}
function isSystemElement(text, identifier) {
    const t = normalizeText(text).toLowerCase();
    const id = normalizeText(identifier).toLowerCase();
    if (!t && !id)
        return false;
    // NOTE: We check system patterns FIRST before checking app-specific identifiers
    // because system UI elements (time, battery, etc.) may not have system package IDs
    // but should still be filtered based on their text content
    // System-level UI patterns (not app-specific)
    const systemPatterns = [
        // Time and clock - comprehensive patterns
        /^\d{1,2}:\d{2}(\s?(am|pm))?$/i, // Matches "2:38 PM", "14:30", etc.
        /^\d{1,2}:\d{2}$/, // Simple time format
        /^(mon|tue|wed|thu|fri|sat|sun),?\s+\w+\s+\d+$/i,
        /^time$/i,
        /^clock$/i,
        // Battery and charging - comprehensive patterns
        /^\d{1,3}%$/, // Battery percentage
        /^battery$|^charging$|^not charging$/i, // Matches "Not charging"
        /^battery level$/i,
        /^battery icon$/i,
        /^charge$/i,
        /^power$/i,
        /^\d+%\s+(battery|charge|power)$/i,
        // Network and connectivity - comprehensive patterns
        /^\d+\s+of\s+\d+\s+(wi-fi|wifi|cellular)\s+bars$/i, // Matches "3 of 3 Wi-Fi bars"
        /^ssid,?\s+\d+\s+of\s+\d+\s+(wi-fi|wifi)\s+bars$/i, // Matches "SSID, 3 of 3 Wi-Fi bars"
        /^wifi$|^wi-fi$|^cellular$|^signal$|^4g$|^5g$|^lte$|^no sim$/i,
        /^no signal$/i, // Matches "No signal"
        /^mobile data$|^airplane mode$/i,
        /^network$/i,
        /^carrier$/i,
        /^signal strength$/i,
        /^wifi signal$/i,
        /^cellular signal$/i,
        /^data connection$/i,
        // SSID patterns - WiFi network names
        /^ssid$/i, // Matches "SSID" text
        /^connected to\s+.+$/i,
        /^wifi:\s*.+$/i,
        // Status bar container and icons
        /^status bar$/i,
        /^status$/i,
        /^alarm$|^bluetooth$|^location$|^gps$|^nfc$|^hotspot$/i,
        /^do not disturb$|^dnd$|^silent mode$|^vibrate$/i,
        /^rotation lock$/i,
        /^screen mirroring$/i,
        /^vpn$/i,
        // Navigation bar
        /^navigation bar$|^back button$|^home button$|^recent apps$|^overview$/i,
        /^system navigation$|^gesture bar$/i,
        // Launcher and home screen (not app)
        /^launcher$|^home screen$|^app drawer$/i,
        // iOS-specific status bar elements
        /^carrier name$/i,
        /^breadcrumb$/i,
        /^status bar foreground$/i,
        /^status bar background$/i,
        // Android-specific status bar elements
        /^system icons$/i,
        /^notification icons$/i
    ];
    // System resource ID patterns (Android/Google/iOS system only)
    const systemIdPatterns = [
        // Android system IDs
        /^android:id\//,
        /^com\.android\.systemui/,
        /^com\.google\.android\.apps\.nexuslauncher/,
        /status_bar_container|status_bar_contents|statusbar/,
        /navigation_bar_container|nav_bar_container|navbar/,
        /battery_icon|battery_level|battery_percent/,
        /signal_cluster|wifi_icon|wifi_signal|cellular_icon/,
        /clock|time_view|date_view/,
        /system_icon_area|notification_icon_area_inner/,
        /quick_settings_panel|qs_panel/,
        /carrier_text|network_name/,
        // iOS system IDs
        /^_UIStatusBar/,
        /^UIStatusBar/,
        /StatusBar/,
        /^_UIBatteryView/,
        /^_UIStatusBarTimeItem/,
        /^_UIStatusBarWifiItem/,
        /^_UIStatusBarCellularItem/,
        /^_UIStatusBarBatteryItem/,
        /^UIStatusBarForegroundView/,
        /^UIStatusBarBackgroundView/
    ];
    // Check text patterns
    for (const pattern of systemPatterns) {
        if (pattern.test(t))
            return true;
    }
    // Check identifier patterns (system packages only)
    for (const pattern of systemIdPatterns) {
        if (pattern.test(id))
            return true;
    }
    return false;
}
function parseBoundsRect(bounds) {
    const normalized = normalizeText(bounds);
    if (!normalized)
        return null;
    const csv = normalized.match(/^(\-?\d+),(\-?\d+),(\-?\d+),(\-?\d+)$/);
    if (csv) {
        const x1 = Number(csv[1]);
        const y1 = Number(csv[2]);
        const x2 = Number(csv[3]);
        const y2 = Number(csv[4]);
        return { x1, y1, x2, y2, width: x2 - x1, height: y2 - y1 };
    }
    const bracket = normalized.match(/^\[(\-?\d+),(\-?\d+)\]\[(\-?\d+),(\-?\d+)\]$/);
    if (!bracket)
        return null;
    const x1 = Number(bracket[1]);
    const y1 = Number(bracket[2]);
    const x2 = Number(bracket[3]);
    const y2 = Number(bracket[4]);
    return { x1, y1, x2, y2, width: x2 - x1, height: y2 - y1 };
}
function isGenericContainer(text, identifier, rawType) {
    const tx = text.toLowerCase();
    const id = identifier.toLowerCase();
    const type = rawType.toLowerCase();
    return (/^(view|container|cell|other|group|wrapper|content view|scroll view|table view|collection view|tipview|shopbackground)$/i.test(text) ||
        /background|container|wrapper|popoverdismissregion|dismissregion|overlay|scrim|separator|divider|mask/.test(id) ||
        /background|container|wrapper|overlay|separator|divider/.test(tx) ||
        /window|view|container|scrollview|collectionview|tableview/.test(type));
}
function shouldIncludeElement(params) {
    const { text, identifier, rawType, type, clickable, bounds } = params;
    const tx = normalizeText(text);
    const id = normalizeText(identifier);
    if (!tx && !id)
        return false;
    const isSystem = isSystemElement(tx, id);
    if (isSystem)
        return false;
    if (/scroll bar|vertical scroll bar|horizontal scroll bar/i.test(tx))
        return false;
    if (/^\d+%$/.test(tx))
        return false;
    const rect = parseBoundsRect(bounds);
    if (rect && (rect.width <= 1 || rect.height <= 1))
        return false;
    // Always include clickable elements (cards, buttons, etc.)
    if (clickable)
        return true;
    // Always include interactive element types
    if (['textField', 'button', 'link', 'switch', 'check'].includes(type))
        return true;
    // Include elements with meaningful text (card titles, section headers, etc.)
    if (tx && tx.length >= 3 && tx.length <= 120) {
        // Check if it's a meaningful content element (not just a generic container)
        const hasMeaningfulText = !/^(view|container|cell|other|group|wrapper)$/i.test(tx);
        if (hasMeaningfulText)
            return true;
    }
    // Filter out generic containers only if they have generic names
    if (isGenericContainer(tx, id, rawType))
        return false;
    // Filter out very large elements that are likely backgrounds
    if (rect && rect.width >= 320 && rect.height >= 500 && ['label', 'image', 'unknown'].includes(type))
        return false;
    // Filter out elements with only generic IDs and no text
    if (!tx && id && isGenericContainer(id, id, rawType))
        return false;
    // Include labels and images with text
    return (type === 'label' || type === 'image') && tx.length > 0;
}
function parseBounds(attrs) {
    const bounds = normalizeText(attrs.bounds);
    if (bounds) {
        if (/^\[\d+,\d+\]\[\d+,\d+\]$/.test(bounds)) {
            const match = bounds.match(/^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$/);
            if (match) {
                return `${match[1]},${match[2]},${match[3]},${match[4]}`;
            }
        }
        return bounds;
    }
    const x = Number(attrs.x ?? 0);
    const y = Number(attrs.y ?? 0);
    const width = Number(attrs.width ?? 0);
    const height = Number(attrs.height ?? 0);
    if (width > 0 && height > 0) {
        return `${x},${y},${x + width},${y + height}`;
    }
    return '';
}
function getBoundsArea(bounds) {
    const rect = parseBoundsRect(bounds);
    if (!rect)
        return 0;
    return Math.max(0, rect.width) * Math.max(0, rect.height);
}
function boundsOverlap(a, b) {
    const rectA = parseBoundsRect(a);
    const rectB = parseBoundsRect(b);
    if (!rectA || !rectB)
        return false;
    return !(rectA.x2 <= rectB.x1 ||
        rectB.x2 <= rectA.x1 ||
        rectA.y2 <= rectB.y1 ||
        rectB.y2 <= rectA.y1);
}
function getElementPriority(element) {
    const typeWeight = {
        button: 6,
        textField: 5,
        link: 4,
        switch: 4,
        check: 4,
        image: 2,
        label: 1,
        unknown: 0
    };
    return (element.clickable ? 10 : 0) + (typeWeight[element.type] ?? 0) + getBoundsArea(element.bounds) / 10000;
}
function collapseDuplicateElements(elements) {
    const result = [];
    for (const element of elements) {
        const normalizedText = normalizeText(element.text).toLowerCase();
        if (!normalizedText) {
            result.push(element);
            continue;
        }
        const existingIndex = result.findIndex((candidate) => {
            const sameText = normalizeText(candidate.text).toLowerCase() === normalizedText;
            return sameText && boundsOverlap(candidate.bounds, element.bounds);
        });
        if (existingIndex === -1) {
            result.push(element);
            continue;
        }
        const existing = result[existingIndex];
        if (getElementPriority(element) > getElementPriority(existing)) {
            result[existingIndex] = element;
        }
    }
    return result;
}
function extractHierarchyFromJson(node, out, depth = 0) {
    if (!node || typeof node !== 'object')
        return;
    if (Array.isArray(node)) {
        node.forEach((child) => extractHierarchyFromJson(child, out, depth));
        return;
    }
    const current = node;
    const attrs = (current.attributes || {});
    // Enhanced text extraction with better fallback priority
    const text = normalizeText(attrs.text) ||
        normalizeText(attrs.accessibilityText) ||
        normalizeText(attrs.label) ||
        normalizeText(attrs.title) ||
        normalizeText(attrs.placeholder) ||
        normalizeText(attrs.hint) ||
        normalizeText(attrs.contentDescription) ||
        normalizeText(attrs.value);
    const identifier = normalizeText(attrs.identifier) || normalizeText(attrs.accessibilityIdentifier) || normalizeText(attrs['resource-id']);
    const rawType = normalizeText(attrs.type) || normalizeText(attrs.role) || normalizeText(current.type) || normalizeText(current.role);
    const bounds = parseBounds(attrs);
    const type = inferElementType(rawType, identifier, text || identifier);
    const clickableAttr = normalizeText(attrs.hittable) === 'true' || normalizeText(attrs.clickable) === 'true' || normalizeText(attrs.focusable) === 'true';
    const clickableType = ['button', 'textField', 'switch', 'link', 'check'].includes(type);
    if (shouldIncludeElement({
        text,
        identifier,
        rawType,
        type,
        clickable: clickableAttr || clickableType,
        bounds
    })) {
        const focused = normalizeText(attrs.focused) === 'true';
        const id = identifier || `element-${out.length}-${depth}`;
        // Use text if available, otherwise use a cleaned-up identifier, or fall back to id
        const displayText = text || (identifier ? identifier.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2') : id);
        out.push({
            id,
            type,
            text: displayText,
            bounds,
            clickable: clickableAttr || clickableType,
            focused
        });
    }
    const children = current.children;
    if (Array.isArray(children)) {
        children.forEach((child) => extractHierarchyFromJson(child, out, depth + 1));
    }
}
function parseAccessibilityTreeOutput(rawOutput) {
    const lines = rawOutput.split('\n');
    const jsonStart = lines.findIndex((line) => line.trim().startsWith('{'));
    if (jsonStart >= 0) {
        try {
            const jsonData = JSON.parse(lines.slice(jsonStart).join('\n'));
            const elements = [];
            extractHierarchyFromJson(jsonData, elements);
            const deduped = new Map();
            for (const el of elements) {
                const key = `${el.type}|${el.text}|${el.bounds}`.toLowerCase();
                if (!deduped.has(key))
                    deduped.set(key, el);
            }
            return collapseDuplicateElements(Array.from(deduped.values()));
        }
        catch {
            // fall through to line parser
        }
    }
    const fallback = [];
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || /^Running on/i.test(trimmed) || trimmed === 'None:')
            continue;
        const text = trimmed.split('[')[0]?.trim() || '';
        if (!text)
            continue;
        const type = inferElementType('', '', text);
        if (!shouldIncludeElement({ text, identifier: '', rawType: '', type, clickable: ['button', 'textField', 'switch', 'link', 'check'].includes(type), bounds: '' })) {
            continue;
        }
        fallback.push({
            id: `line-${fallback.length}`,
            type,
            text,
            bounds: '',
            clickable: ['button', 'textField', 'switch', 'link', 'check'].includes(type),
            focused: false
        });
    }
    return collapseDuplicateElements(fallback);
}
async function detectAvailableDevices() {
    const result = { ios: false, android: false };
    // Check iOS simulator
    if (process.platform === 'darwin') {
        try {
            const { stdout } = await execFileAsync('xcrun', ['simctl', 'list', 'devices'], { timeout: 3000 });
            result.ios = stdout.includes('(Booted)');
        }
        catch {
            result.ios = false;
        }
    }
    // Check Android emulator
    try {
        const { stdout } = await execFileAsync('adb', ['devices'], { timeout: 3000 });
        const lines = stdout.split('\n').filter(line => line.includes('\t'));
        result.android = lines.some(line => line.includes('device') || line.includes('emulator'));
    }
    catch {
        result.android = false;
    }
    return result;
}
async function getIOSScreenshot() {
    const outputPath = `/tmp/maestro-recorder-sim-${Date.now()}.png`;
    try {
        await execFileAsync('xcrun', ['simctl', 'io', 'booted', 'screenshot', outputPath], {
            timeout: 8000
        });
        const screenshotBuffer = await fs_1.promises.readFile(outputPath);
        // Don't delete yet - keep for color validation
        // await fs.unlink(outputPath).catch(() => undefined);
        // Store path for color validation
        lastScreenshotPath = outputPath;
        return `data:image/png;base64,${screenshotBuffer.toString('base64')}`;
    }
    catch (error) {
        await fs_1.promises.unlink(outputPath).catch(() => undefined);
        console.warn('⚠️ Failed to capture iOS screenshot');
        return mockScreenshot;
    }
}
async function getAndroidScreenshot() {
    const outputPath = `/tmp/maestro-recorder-android-${Date.now()}.png`;
    try {
        await execFileAsync('adb', ['exec-out', 'screencap', '-p'], {
            timeout: 8000,
            encoding: 'buffer',
            maxBuffer: 10 * 1024 * 1024
        }).then(async ({ stdout }) => {
            await fs_1.promises.writeFile(outputPath, stdout);
        });
        const screenshotBuffer = await fs_1.promises.readFile(outputPath);
        // Don't delete yet - keep for color validation
        // await fs.unlink(outputPath).catch(() => undefined);
        // Store path for color validation
        lastScreenshotPath = outputPath;
        return `data:image/png;base64,${screenshotBuffer.toString('base64')}`;
    }
    catch (error) {
        await fs_1.promises.unlink(outputPath).catch(() => undefined);
        console.warn('⚠️ Failed to capture Android screenshot');
        return mockScreenshot;
    }
}
async function getRealSimulatorScreenshot() {
    if (currentDevicePlatform === 'android') {
        return getAndroidScreenshot();
    }
    if (process.platform !== 'darwin') {
        return mockScreenshot;
    }
    return getIOSScreenshot();
}
async function getBootedSimulatorUdid() {
    try {
        const { stdout } = await execFileAsync('xcrun', ['simctl', 'list', 'devices']);
        const bootedLine = stdout
            .split('\n')
            .find((line) => line.includes('(Booted)') && /[A-F0-9-]{36}/.test(line));
        if (!bootedLine)
            return null;
        const match = bootedLine.match(/([A-F0-9-]{36})/i);
        return match ? match[1] : null;
    }
    catch {
        return null;
    }
}
const KNOWN_APP_NAMES = {
    'com.cvsenterpriseiphone.cvspharmacy': 'CVS Health',
    'com.cvsenterpriseiphone.health100': 'Health 100',
};
async function detectFrontmostApp() {
    try {
        const { stdout: launchList } = await execFileAsync('xcrun', ['simctl', 'spawn', 'booted', 'launchctl', 'list'], { timeout: 6000 });
        const runningBundleIds = [];
        for (const line of launchList.split('\n')) {
            // Lines with a running PID: "1234   0   UIKitApplication:com.example.app[0x1234]"
            const match = line.match(/^\d+\s+\d+\s+UIKitApplication:([^\[]+)\[/);
            if (match)
                runningBundleIds.push(match[1].trim());
        }
        const userApps = runningBundleIds.filter(id => !id.startsWith('com.apple.'));
        if (userApps.length === 0)
            return null;
        const bundleId = userApps[0];
        const displayName = KNOWN_APP_NAMES[bundleId] || bundleId;
        return { bundleId, displayName };
    }
    catch (err) {
        console.error('Failed to detect frontmost app:', err);
        return null;
    }
}
async function handleDetectApp(ws) {
    try {
        const detected = await detectFrontmostApp();
        if (detected) {
            ws.send(JSON.stringify({ type: 'app-detected', bundleId: detected.bundleId, displayName: detected.displayName }));
        }
        else {
            ws.send(JSON.stringify({ type: 'app-detect-failed', message: 'No user app detected on booted simulator' }));
        }
    }
    catch (err) {
        ws.send(JSON.stringify({ type: 'app-detect-failed', message: String(err) }));
    }
}
async function getAndroidDeviceId() {
    try {
        const { stdout } = await execFileAsync('adb', ['devices'], { timeout: 3000 });
        const lines = stdout.split('\n').filter(line => line.includes('\t'));
        for (const line of lines) {
            const parts = line.trim().split('\t');
            if (parts.length >= 2 && (parts[1] === 'device' || parts[1].includes('emulator'))) {
                return parts[0]; // Return device ID (e.g., "emulator-5554")
            }
        }
        return null;
    }
    catch {
        return null;
    }
}
async function getIOSHierarchy() {
    if (process.platform !== 'darwin') {
        return [];
    }
    try {
        const bootedUdid = await getBootedSimulatorUdid();
        const args = bootedUdid ? ['--device', bootedUdid, 'hierarchy'] : ['hierarchy'];
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                const { stdout } = await execFileAsync('maestro', args, {
                    timeout: 30000,
                    maxBuffer: 50 * 1024 * 1024
                });
                const parsed = parseAccessibilityTreeOutput(stdout || '');
                if (parsed.length > 0) {
                    lastHierarchy = parsed;
                    lastHierarchyAt = Date.now();
                    return parsed;
                }
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                if (attempt === 3) {
                    console.warn(`⚠️ Failed to fetch Maestro hierarchy (${message}), using fallback hierarchy`);
                }
            }
        }
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`⚠️ Failed to prepare hierarchy fetch (${message}), using fallback hierarchy`);
    }
    return lastHierarchy;
}
async function getAndroidHierarchy() {
    try {
        // Get Android device ID
        const deviceId = await getAndroidDeviceId();
        if (!deviceId) {
            console.warn('⚠️ No Android device detected via adb devices');
            return getAndroidHierarchyFallback();
        }
        const args = ['--device', deviceId, 'hierarchy'];
        // Check for custom Maestro port
        const maestroPort = process.env.MAESTRO_PORT || process.env.MAESTRO_ANDROID_PORT;
        const env = { ...process.env };
        if (maestroPort) {
            env.MAESTRO_ANDROID_DRIVER_STARTUP_TIMEOUT = '60000';
            console.log(`📱 Using custom Maestro port: ${maestroPort}`);
        }
        console.log(`📱 Getting Android hierarchy for device ${deviceId}...`);
        console.log(`📱 Running: maestro ${args.join(' ')}`);
        // Use Maestro CLI for Android hierarchy (consistent with iOS)
        const { stdout, stderr } = await execFileAsync('maestro', args, {
            timeout: 30000,
            maxBuffer: 10 * 1024 * 1024,
            env
        });
        if (stderr) {
            console.warn('⚠️ Maestro stderr:', stderr);
        }
        console.log('📱 Android Maestro hierarchy output length:', stdout.length);
        // Try to parse as JSON first (Maestro format)
        try {
            const parsed = JSON.parse(stdout);
            const elements = [];
            extractHierarchyFromJson(parsed, elements);
            if (elements.length > 0) {
                console.log(`✅ Extracted ${elements.length} Android elements from Maestro`);
                return elements;
            }
        }
        catch (jsonError) {
            console.log('📝 Maestro output is not JSON, trying text parsing...');
        }
        // Fallback: parse text-based hierarchy
        return parseTextBasedHierarchy(stdout);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const stderr = error.stderr || '';
        // Check if it's a gRPC connection error
        if (message.includes('Connection refused') || message.includes('localhost:7001') || message.includes('UNAVAILABLE: io exception')) {
            console.error('❌ Maestro gRPC server not running for Android');
            console.error('   The Maestro daemon needs to be started for Android devices.');
            console.error('');
            console.error('   To fix this, run in a separate terminal:');
            console.error('   1. Start Maestro Studio: maestro studio');
            console.error('   OR');
            console.error('   2. Start any Maestro test to initialize the server');
            console.error('');
            console.error('   To use a custom port (e.g., 7002):');
            console.error('   1. Set environment variable: export MAESTRO_PORT=7002');
            console.error('   2. Restart the recorder backend with that variable');
            console.error('   3. Start Maestro on that port (if supported by your Maestro version)');
            console.error('');
            console.error('   Note: For now, using fallback hierarchy (limited elements)');
        }
        else {
            console.error('❌ Maestro hierarchy command failed:');
            console.error('   Error:', message);
            if (stderr) {
                console.error('   Stderr:', stderr);
            }
            console.error('   This usually means:');
            console.error('   1. Maestro is not installed or not in PATH');
            console.error('   2. Android device is not properly connected');
            console.error('   3. Maestro cannot communicate with the device');
        }
        // Final fallback: try basic adb approach
        return getAndroidHierarchyFallback();
    }
}
function parseTextBasedHierarchy(output) {
    const elements = [];
    const lines = output.split('\n');
    for (const line of lines) {
        // Parse Maestro text hierarchy format
        // Example: "  Button: Sign in (clickable, bounds: 0,100,200,150)"
        const textMatch = line.match(/^\s*([\w]+):\s*(.+?)(?:\s*\((.+)\))?$/);
        if (textMatch) {
            const [, type, text, attrs] = textMatch;
            const clickable = attrs?.includes('clickable') || false;
            const boundsMatch = attrs?.match(/bounds:\s*([0-9,]+)/);
            const bounds = boundsMatch ? boundsMatch[1] : '0,0,100,100';
            if (text && text.trim()) {
                elements.push({
                    id: `android-text-${elements.length}`,
                    type: type.toLowerCase().includes('edit') ? 'textField' :
                        type.toLowerCase().includes('button') ? 'button' : 'text',
                    text: text.trim(),
                    bounds,
                    clickable,
                    focused: false
                });
            }
        }
    }
    return elements;
}
async function getAndroidHierarchyFallback() {
    try {
        console.log('🔄 Trying fallback Android hierarchy method...');
        // Get list of visible elements using adb
        const { stdout } = await execFileAsync('adb', ['shell', 'dumpsys', 'window', 'windows'], {
            timeout: 5000
        });
        // Extract basic info from window dump
        const elements = [];
        const lines = stdout.split('\n');
        for (let i = 0; i < lines.length && elements.length < 20; i++) {
            const line = lines[i];
            if (line.includes('mCurrentFocus') || line.includes('mFocusedApp')) {
                const appMatch = line.match(/([a-zA-Z0-9.]+\/[a-zA-Z0-9.]+)/);
                if (appMatch) {
                    elements.push({
                        id: `android-app-${elements.length}`,
                        type: 'text',
                        text: appMatch[1].split('/').pop() || 'App',
                        bounds: '0,0,1080,1920',
                        clickable: false,
                        focused: true
                    });
                }
            }
        }
        if (elements.length === 0) {
            // Return mock elements so UI isn't empty
            elements.push({
                id: 'android-placeholder',
                type: 'text',
                text: 'Android screen loaded - hierarchy unavailable',
                bounds: '0,0,1080,200',
                clickable: false,
                focused: false
            });
        }
        console.log(`⚠️ Fallback extracted ${elements.length} basic elements`);
        return elements;
    }
    catch (fallbackError) {
        console.warn('⚠️ Fallback hierarchy also failed');
        return [];
    }
}
async function getRealHierarchy() {
    const now = Date.now();
    if (now - lastHierarchyAt < 1000 && lastHierarchy.length > 0) {
        return lastHierarchy;
    }
    if (hierarchyFetchInFlight) {
        return hierarchyFetchInFlight;
    }
    hierarchyFetchInFlight = (async () => {
        // ── Fast path: reuse a running `maestro studio` session ────────────────
        // Studio keeps the platform driver warm and serves hierarchy+screenshot
        // in one HTTP round-trip (~80-250ms) vs. 1.5-4s for `maestro hierarchy`.
        // We only fall back to the CLI path when Studio isn't reachable.
        const studio = await (0, studioClient_1.tryStudioSnapshot)();
        if (studio) {
            lastStudioScreenshot = studio.screenshot;
            // Studio's tree already covers accessibility — skip the iOS OCR merge
            // unless Studio returned nothing usable.
            if (studio.hierarchy.length > 0) {
                return studio.hierarchy;
            }
        }
        // ── Slow path: shell out to Maestro CLI ────────────────────────────────
        let hierarchy;
        if (currentDevicePlatform === 'android') {
            hierarchy = await getAndroidHierarchy();
        }
        else {
            hierarchy = await getIOSHierarchy();
        }
        // OCR fallback: detect native elements (e.g. tab bar) not in accessibility tree
        if (currentDevicePlatform === 'ios' && lastScreenshotPath) {
            hierarchy = await mergeOCRElements(hierarchy, lastScreenshotPath);
        }
        return hierarchy;
    })();
    try {
        const result = await hierarchyFetchInFlight;
        lastHierarchy = result;
        lastHierarchyAt = Date.now();
        return result;
    }
    finally {
        hierarchyFetchInFlight = null;
    }
}
// Broadcast helper: send `hierarchy-updated` only when the tree actually
// changed. Callers hit this every 250ms during recording — without the dedupe
// we ship the same 300-element payload over WS 4x/sec for no visual change.
function broadcastHierarchyIfChanged(ws, hierarchy) {
    const hash = (0, studioClient_1.hashHierarchy)(hierarchy);
    if (hash === lastHierarchyHash)
        return false;
    lastHierarchyHash = hash;
    ws.send(JSON.stringify({ type: 'hierarchy-updated', hierarchy, hash }));
    return true;
}
async function handleStartRecording(ws, data) {
    console.log('🎬 Starting recording session...');
    if (activeRecording) {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Recording already in progress'
        }));
        return;
    }
    // Create new recording session
    const recordingSession = {
        id: `rec-${Date.now()}`,
        deviceId: data.device || 'default-device',
        appId: data.appId || DEFAULT_APP_ID,
        startTime: new Date(),
        actions: []
    };
    activeRecording = recordingSession;
    console.log(`✅ Recording started: ${recordingSession.id}`);
    // Send initial device state
    const screenshot = await getRealSimulatorScreenshot();
    const hierarchy = await getRealHierarchy();
    if (!activeRecording || activeRecording.id !== recordingSession.id) {
        console.log(`⚠️ Recording ${recordingSession.id} was stopped before initialization finished`);
        return;
    }
    ws.send(JSON.stringify({
        type: 'screenshot-updated',
        screenshot
    }));
    broadcastHierarchyIfChanged(ws, hierarchy);
    // Send confirmation to frontend
    ws.send(JSON.stringify({
        type: 'recording-started',
        recordingId: recordingSession.id,
        timestamp: new Date().toISOString(),
        message: 'Recording session initialized. Interact with your device to capture actions.'
    }));
    console.log('🎯 Recording started in real mode (no simulated actions)');
    // TODO: Initialize Maestro CLI integration
    // TODO: Start device event monitoring
    // TODO: Setup hierarchy capture on each action
}
function handleStopRecording(ws, data) {
    console.log('⏹️ Stopping recording session...');
    if (!activeRecording) {
        ws.send(JSON.stringify({
            type: 'error',
            message: 'No active recording to stop'
        }));
        return;
    }
    const recordingId = activeRecording.id;
    const duration = (new Date().getTime() - activeRecording.startTime.getTime()) / 1000;
    const actionCount = activeRecording.actions.length;
    console.log(`✅ Recording stopped: ${recordingId}`);
    console.log(`   Duration: ${duration.toFixed(1)}s`);
    console.log(`   Actions captured: ${actionCount}`);
    // Send confirmation with recording details
    ws.send(JSON.stringify({
        type: 'recording-stopped',
        recordingId: recordingId,
        duration: duration,
        actionCount: actionCount,
        timestamp: new Date().toISOString(),
        message: `Recording saved: ${actionCount} actions captured in ${duration.toFixed(1)}s`
    }));
    // TODO: Save recording to file
    // TODO: Generate Maestro YAML
    // TODO: Cleanup device monitoring
    // Clear active recording
    activeRecording = null;
}
function handleGetDevices(ws) {
    console.log('📱 Fetching available devices...');
    ws.send(JSON.stringify({
        type: 'devices-list',
        devices: [
            { id: 'ios-sim-1', name: 'iPhone 17 Pro', platform: 'ios', status: 'available' },
            { id: 'android-emu-1', name: 'Pixel 8 Pro', platform: 'android', status: 'available' }
        ]
    }));
}
async function handleTapElement(ws, data) {
    const target = typeof data?.target === 'string' ? data.target.trim() : '';
    if (!target) {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid tap target' }));
        return;
    }
    if (!activeRecording) {
        ws.send(JSON.stringify({ type: 'error', message: 'Start recording before tapping elements' }));
        return;
    }
    const flowPath = `/tmp/maestro-recorder-tap-${Date.now()}.yaml`;
    const escapedTarget = target.replace(/"/g, '\\"');
    const appId = activeRecording?.appId || DEFAULT_APP_ID;
    const flowContent = `appId: ${appId}\n---\n- tapOn: "${escapedTarget}"\n`;
    try {
        await fs_1.promises.writeFile(flowPath, flowContent, 'utf8');
        const bootedUdid = await getBootedSimulatorUdid();
        const args = bootedUdid
            ? ['--device', bootedUdid, 'test', flowPath]
            : ['test', flowPath];
        await execFileAsync('maestro', args, {
            timeout: INTERACTIVE_STEP_TIMEOUT_MS,
            maxBuffer: 20 * 1024 * 1024
        });
        const action = {
            type: 'tap',
            target,
            timestamp: new Date().toISOString()
        };
        activeRecording.actions.push(action);
        ws.send(JSON.stringify({ type: 'action-captured', action }));
        const screenshot = await getRealSimulatorScreenshot();
        const hierarchy = await getRealHierarchy();
        ws.send(JSON.stringify({ type: 'screenshot-updated', screenshot }));
        broadcastHierarchyIfChanged(ws, hierarchy);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        ws.send(JSON.stringify({
            type: 'error',
            message: `Tap failed for "${target}": ${message}`
        }));
    }
    finally {
        await fs_1.promises.unlink(flowPath).catch(() => undefined);
    }
}
async function handleRefreshScreenshot(ws) {
    console.log('🔄 Refreshing device screenshot...');
    const screenshot = await getRealSimulatorScreenshot();
    ws.send(JSON.stringify({
        type: 'screenshot-updated',
        screenshot
    }));
    try {
        const hierarchy = await getRealHierarchy();
        broadcastHierarchyIfChanged(ws, hierarchy);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        ws.send(JSON.stringify({ type: 'error', message: `Hierarchy refresh failed: ${message}` }));
    }
}
async function handleGetHierarchy(ws) {
    console.log('🔍 Fetching UI hierarchy...');
    const hierarchy = await getRealHierarchy();
    // Explicit user request — always send even if unchanged so the frontend
    // gets a fresh copy after a manual refresh click.
    lastHierarchyHash = '';
    broadcastHierarchyIfChanged(ws, hierarchy);
}
async function handleTakeScreenshot(ws) {
    console.log('📸 Taking device screenshot...');
    const screenshot = await getRealSimulatorScreenshot();
    ws.send(JSON.stringify({
        type: 'screenshot-updated',
        screenshot,
        message: 'Screenshot captured'
    }));
}
async function handleSwitchDevice(ws, data) {
    const device = data?.device || 'iOS Simulator';
    console.log(`🔄 Switching to device: ${device}`);
    // Update platform
    currentDevicePlatform = device.toLowerCase().includes('android') ? 'android' : 'ios';
    // Clear cached hierarchy + force Studio to re-probe. Otherwise a device
    // switch could keep serving the previous device's cached tree, or skip
    // Studio entirely because the previous check was cached as "unreachable".
    lastHierarchy = [];
    lastHierarchyAt = 0;
    lastHierarchyHash = '';
    (0, studioClient_1.invalidateStudioAvailability)();
    // Detect available devices
    const availableDevices = await detectAvailableDevices();
    // Fetch new device state
    try {
        const screenshot = await getRealSimulatorScreenshot();
        const hierarchy = await getRealHierarchy();
        ws.send(JSON.stringify({
            type: 'device-switched',
            device,
            platform: currentDevicePlatform,
            availableDevices,
            screenshot,
            hierarchy,
            message: `Switched to ${device}`
        }));
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        ws.send(JSON.stringify({
            type: 'device-switch-failed',
            device,
            error: message,
            message: `Failed to switch to ${device}: ${message}`
        }));
    }
}
async function handleValidateAccessibility(ws) {
    console.log('♿ Running comprehensive accessibility validation...');
    console.log('   - Maestro-based WCAG 2.1 checks');
    try {
        // Capture screenshot for visual context in report
        console.log('📸 Capturing screenshot for report...');
        const screenshot = await getRealSimulatorScreenshot();
        // Get current hierarchy
        const hierarchy = await getRealHierarchy();
        if (hierarchy.length === 0) {
            ws.send(JSON.stringify({
                type: 'accessibility-validation-failed',
                message: 'No elements in hierarchy. Please refresh the hierarchy first.'
            }));
            return;
        }
        // Run Maestro-based accessibility validation (WCAG 2.1)
        console.log('📊 Running Maestro WCAG 2.1 validation...');
        console.log(`🎨 Color validation: ${lastScreenshotPath ? 'enabled (screenshot available)' : 'disabled (no screenshot)'}`);
        const rawMaestroReport = await (0, accessibility_1.validateAccessibility)(hierarchy, lastScreenshotPath || undefined);
        // Add screenshot to report
        rawMaestroReport.screenshot = screenshot;
        // Clean up screenshot file after validation
        if (lastScreenshotPath) {
            await fs_1.promises.unlink(lastScreenshotPath).catch(() => undefined);
            lastScreenshotPath = null;
        }
        // Run native platform-specific checks for the active platform only
        const nativeReports = [];
        // Resolve active platform (selected device first, hierarchy as fallback)
        const detectedPlatform = detectPlatform(hierarchy);
        const platform = detectedPlatform === 'both' ? currentDevicePlatform : detectedPlatform;
        const maestroReport = filterA11yFixesForPlatform(rawMaestroReport, platform);
        console.log(`   ✓ Maestro: ${maestroReport.violations.length} violations found`);
        if (platform === 'ios') {
            console.log('   - Native iOS XCTest Accessibility Audit');
            console.log('🍎 Running iOS XCTest Accessibility Audit...');
            try {
                const bundleId = activeRecording?.appId || DEFAULT_APP_ID;
                const iosReport = await (0, native_a11y_scanner_1.runIOSAccessibilityAudit)(bundleId);
                nativeReports.push(iosReport);
                console.log(`   ✓ iOS XCTest: ${iosReport.issues.length} issues found`);
            }
            catch (error) {
                console.log(`   ⚠️  iOS XCTest audit skipped: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        if (platform === 'android') {
            console.log('   - Native Android Accessibility Scanner');
            console.log('🤖 Running Android Accessibility Scanner...');
            try {
                const packageName = activeRecording?.appId || DEFAULT_APP_ID;
                const androidReport = await (0, native_a11y_scanner_1.runAndroidAccessibilityScanner)(packageName);
                nativeReports.push(androidReport);
                console.log(`   ✓ Android Scanner: ${androidReport.issues.length} issues found`);
            }
            catch (error) {
                console.log(`   ⚠️  Android Scanner skipped: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        // Merge all reports
        const mergedReport = (0, native_a11y_scanner_1.mergeAccessibilityReports)(maestroReport, nativeReports);
        // Generate HTML report for download
        const htmlReport = (0, accessibility_1.generateHTMLReport)(mergedReport);
        const totalViolations = mergedReport.violations.length;
        const nativeIssues = nativeReports.reduce((sum, r) => sum + r.issues.length, 0);
        console.log(`✅ Accessibility validation complete:`);
        console.log(`   - Total violations: ${totalViolations}`);
        console.log(`   - Maestro checks: ${maestroReport.violations.length}`);
        console.log(`   - Native checks: ${nativeIssues}`);
        console.log(`   - Critical: ${mergedReport.summary.critical}`);
        console.log(`   - Serious: ${mergedReport.summary.serious}`);
        console.log(`   - Moderate: ${mergedReport.summary.moderate}`);
        console.log(`   - Minor: ${mergedReport.summary.minor}`);
        // Send comprehensive report to frontend
        ws.send(JSON.stringify({
            type: 'accessibility-report',
            report: mergedReport,
            htmlReport,
            nativeReports,
            platform,
            message: `Found ${totalViolations} accessibility violations (${maestroReport.violations.length} Maestro + ${nativeIssues} Native)`
        }));
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('❌ Accessibility validation failed:', message);
        ws.send(JSON.stringify({
            type: 'accessibility-validation-failed',
            error: message,
            message: `Accessibility validation failed: ${message}`
        }));
    }
}
function extractPlatformFix(howToFix, platform) {
    const text = normalizeText(howToFix);
    if (!text)
        return text;
    const iosMatch = text.match(/iOS:\s*(.*?)(?=\s*Android:|$)/i);
    const androidMatch = text.match(/Android:\s*(.*?)(?=\s*iOS:|$)/i);
    if (platform === 'ios' && iosMatch?.[1]) {
        return iosMatch[1].trim();
    }
    if (platform === 'android' && androidMatch?.[1]) {
        return androidMatch[1].trim();
    }
    return text;
}
function filterA11yFixesForPlatform(report, platform) {
    if (!report || !Array.isArray(report.violations)) {
        return report;
    }
    return {
        ...report,
        violations: report.violations.map((violation) => ({
            ...violation,
            howToFix: extractPlatformFix(violation?.howToFix || '', platform)
        }))
    };
}
// Helper function to detect platform from hierarchy
function detectPlatform(hierarchy) {
    if (hierarchy.length === 0)
        return 'both';
    // Check element types to determine platform
    const hasIOSTypes = hierarchy.some(el => el.type?.includes('UI') ||
        el.type?.includes('NS') ||
        el.id?.includes('accessibility'));
    const hasAndroidTypes = hierarchy.some(el => el.type?.includes('android.') ||
        el.id?.includes('resource-id'));
    if (hasIOSTypes && hasAndroidTypes)
        return 'both';
    if (hasIOSTypes)
        return 'ios';
    if (hasAndroidTypes)
        return 'android';
    return 'both'; // Default to checking both
}
async function handleValidatePulse(ws) {
    ws.send(JSON.stringify({
        type: 'pulse-validation-failed',
        message: 'Pulse validation is disabled in the recorder utility.'
    }));
}
async function _handleValidatePulse_disabled(ws) {
    console.log('🎨 Running Pulse design system validation...');
    try {
        // Capture screenshot for color validation
        console.log('📸 Capturing screenshot for color validation...');
        const screenshot = await getRealSimulatorScreenshot();
        const hierarchy = await getRealHierarchy();
        if (hierarchy.length === 0) {
            ws.send(JSON.stringify({
                type: 'pulse-validation-failed',
                message: 'No elements in hierarchy. Please refresh the hierarchy first.'
            }));
            return;
        }
        // Detect platform from hierarchy element types
        // Check for Android-specific indicators
        const hasAndroidElements = hierarchy.some((el) => {
            const type = (el.type || el.className || '').toLowerCase();
            return type.includes('android.') ||
                type === 'edittext' ||
                type.includes('linearlayout') ||
                type.includes('framelayout') ||
                el['resource-id'] ||
                el.attributes?.['resource-id'] ||
                el.attributes?.resourceId;
        });
        // Check for iOS-specific indicators
        const hasIOSElements = hierarchy.some((el) => {
            const type = (el.type || el.className || '').toLowerCase();
            return type.includes('xcui') ||
                type.includes('uikit') ||
                type.includes('swiftui') ||
                el.accessibilityIdentifier ||
                el.attributes?.accessibilityIdentifier;
        });
        // Determine platform
        let platform;
        if (hasAndroidElements && !hasIOSElements) {
            platform = 'android';
            console.log('🤖 Auto-detected platform: Android');
        }
        else if (hasIOSElements && !hasAndroidElements) {
            platform = 'ios';
            console.log('🍎 Auto-detected platform: iOS');
        }
        else {
            // Fallback to currentDevicePlatform if both or neither detected
            platform = currentDevicePlatform;
            console.log(`⚙️  Using current device platform: ${platform}`);
        }
        // Flatten hierarchy into element array for the validator
        function flattenHierarchy(node, depth) {
            if (!node || typeof node !== 'object')
                return [];
            const children = node.children || [];
            const el = {
                text: node.text || node.accessibilityLabel || node.label || '',
                type: node.type || node.role || 'unknown',
                attributes: {
                    identifier: node.accessibilityIdentifier || node.id || node.attributes?.identifier || '',
                    label: node.accessibilityLabel || node.label || node.text || node.attributes?.label || '',
                    hint: node.accessibilityHint || node.attributes?.hint || '',
                    value: node.accessibilityValue || node.value || node.attributes?.value || '',
                    bounds: node.bounds || node.attributes?.bounds || '',
                    'resource-id': node['resource-id'] || node.attributes?.['resource-id'] || '',
                    'content-desc': node['content-desc'] || node.attributes?.['content-desc'] || '',
                },
                isVisible: node.isEnabled !== false,
                isInteractive: node.isClickable !== false &&
                    ['button', 'textfield', 'switch', 'checkbox', 'link'].includes((node.type || '').toLowerCase()),
                depth,
                width: node.width || 0,
                height: node.height || 0,
            };
            return [el, ...children.flatMap((c) => flattenHierarchy(c, depth + 1))];
        }
        // If hierarchy is already flat (array of elements), use directly; otherwise flatten
        const elements = Array.isArray(hierarchy) && hierarchy.length > 0 && !hierarchy[0].children
            ? hierarchy
            : hierarchy.flatMap((node) => flattenHierarchy(node, 0));
        const violations = pulseValidator?.validateElements(elements, { id: 'recorder-live', name: 'Live Screen' }, platform) ?? [];
        // Run CVS Pulse color validation
        console.log('🎨 Running CVS Pulse color validation...');
        console.log(`🎨 Color validation: ${lastScreenshotPath ? 'enabled (screenshot available)' : 'disabled (no screenshot)'}`);
        const colorReport = await (0, accessibility_1.validateAccessibility)(hierarchy, lastScreenshotPath || undefined);
        // Clean up screenshot file after validation
        if (lastScreenshotPath) {
            await fs_1.promises.unlink(lastScreenshotPath).catch(() => undefined);
            lastScreenshotPath = null;
        }
        // Convert color violations to Pulse format and add to violations list
        const colorViolations = colorReport.violations
            .filter(v => v.colorInfo) // Only include violations with color information
            .map(v => ({
            severity: v.severity === 'critical' || v.severity === 'serious' ? 'error' :
                v.severity === 'moderate' ? 'warning' : 'info',
            component: 'Color',
            componentType: v.element.type,
            element: v.element.text || v.element.id || 'Unknown',
            elementId: v.element.id,
            rule: v.message,
            colorInfo: v.colorInfo
        }));
        // Merge color violations with Pulse violations
        const allViolations = [...violations, ...colorViolations];
        // Build summary
        const severityCounts = { error: 0, warning: 0, info: 0 };
        const componentCounts = {};
        for (const v of allViolations) {
            severityCounts[v.severity] =
                (severityCounts[v.severity] || 0) + 1;
            componentCounts[v.component] = (componentCounts[v.component] || 0) + 1;
        }
        const report = {
            timestamp: new Date().toISOString(),
            platform,
            totalElements: elements.length,
            totalViolations: allViolations.length,
            violations: allViolations,
            summary: severityCounts,
            componentBreakdown: componentCounts,
            screenshot,
            colorValidation: colorReport.colorValidation
        };
        const htmlReport = generatePulseHTMLReport(report);
        console.log(`✅ Pulse validation complete: ${violations.length} violations found (${platform})`);
        ws.send(JSON.stringify({
            type: 'pulse-report',
            report,
            htmlReport,
            message: `Found ${violations.length} Pulse violations across ${elements.length} elements`
        }));
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('❌ Pulse validation failed:', message);
        ws.send(JSON.stringify({
            type: 'pulse-validation-failed',
            error: message,
            message: `Pulse validation failed: ${message}`
        }));
    }
}
function generatePulseHTMLReport(report) {
    const severityBadge = (severity) => {
        const colors = {
            error: '#E31837',
            warning: '#F5A623',
            info: '#2196F3',
        };
        return `<span style="background:${colors[severity] || '#999'};color:#fff;padding:2px 8px;border-radius:4px;font-size:12px;font-weight:bold;text-transform:uppercase">${severity}</span>`;
    };
    const violationRows = report.violations.map((v, i) => `
    <tr style="border-bottom:1px solid #eee">
      <td style="padding:12px 8px">${i + 1}</td>
      <td style="padding:12px 8px">${severityBadge(v.severity)}</td>
      <td style="padding:12px 8px"><strong>${v.component}</strong><br><span style="color:#666;font-size:12px">${v.componentType || ''}</span></td>
      <td style="padding:12px 8px;max-width:200px;word-break:break-word">
        ${v.element || 'Unknown'}<br>
        <span style="color:#999;font-size:11px">ID: ${v.elementId || 'none'}</span>
        ${v.colorInfo ? `
          <div style="margin-top:8px;padding:8px;background:#f9f9f9;border-radius:4px;font-size:12px;">
            <strong>🎨 Color:</strong>
            <div style="display:flex;align-items:center;gap:8px;margin-top:4px;">
              <div style="width:30px;height:30px;border-radius:4px;background:${v.colorInfo.extractedHex};border:1px solid #ddd;"></div>
              <div>
                <div><strong>Extracted:</strong> ${v.colorInfo.extractedHex}</div>
                ${v.colorInfo.matchedToken ? `<div><strong>Token:</strong> ${v.colorInfo.matchedToken}</div>` : ''}
                ${v.colorInfo.deltaE !== undefined ? `<div><strong>ΔE:</strong> ${v.colorInfo.deltaE.toFixed(1)}</div>` : ''}
                ${v.colorInfo.contrastRatio !== undefined ? `<div><strong>Contrast:</strong> ${v.colorInfo.contrastRatio.toFixed(2)}:1</div>` : ''}
              </div>
            </div>
          </div>
        ` : ''}
      </td>
      <td style="padding:12px 8px;font-size:13px">${v.rule}</td>
    </tr>
  `).join('');
    const componentBreakdownRows = Object.entries(report.componentBreakdown || {})
        .sort((a, b) => b[1] - a[1])
        .map(([comp, count]) => `<tr><td style="padding:8px">${comp}</td><td style="padding:8px;text-align:center"><strong>${count}</strong></td></tr>`).join('');
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pulse Design System Validation Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; color: #333; }
    .container { max-width: 1200px; margin: 0 auto; }
    .header { background: linear-gradient(135deg, #E31837, #CC0033); color: white; padding: 30px; border-radius: 12px; margin-bottom: 20px; }
    .header h1 { margin: 0 0 8px 0; font-size: 24px; }
    .header .subtitle { opacity: 0.9; font-size: 14px; }
    .badge { display: inline-block; background: rgba(255,255,255,0.2); padding: 4px 12px; border-radius: 20px; font-size: 12px; margin-right: 8px; }
    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 20px; }
    .summary-card { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); text-align: center; }
    .summary-card .value { font-size: 36px; font-weight: bold; }
    .summary-card .label { color: #666; font-size: 13px; margin-top: 4px; }
    .card { background: white; border-radius: 8px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 20px; }
    .card h2 { margin-top: 0; font-size: 18px; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; padding: 12px 8px; border-bottom: 2px solid #E31837; font-size: 13px; text-transform: uppercase; color: #666; }
    .success { background: #E8F5E9; border: 1px solid #4CAF50; border-radius: 8px; padding: 20px; text-align: center; color: #2E7D32; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎨 Pulse Design System Validation Report</h1>
      <div class="subtitle">CVS Health Digital Pulse Component Compliance</div>
      <div style="margin-top:12px">
        <span class="badge">${report.platform.toUpperCase()}</span>
        <span class="badge">${new Date(report.timestamp).toLocaleString()}</span>
        <span class="badge">${report.totalElements} Elements Scanned</span>
      </div>
    </div>

    <div class="summary-grid">
      <div class="summary-card">
        <div class="value" style="color:${report.totalViolations === 0 ? '#4CAF50' : '#E31837'}">${report.totalViolations}</div>
        <div class="label">Total Violations</div>
      </div>
      <div class="summary-card">
        <div class="value" style="color:#E31837">${report.summary.error}</div>
        <div class="label">Errors</div>
      </div>
      <div class="summary-card">
        <div class="value" style="color:#F5A623">${report.summary.warning}</div>
        <div class="label">Warnings</div>
      </div>
      <div class="summary-card">
        <div class="value" style="color:#2196F3">${report.summary.info}</div>
        <div class="label">Info</div>
      </div>
    </div>

    ${report.colorValidation && report.colorValidation.enabled ? `
    <div style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); border-radius: 12px; padding: 30px; margin-bottom: 20px; color: white;">
      <h2 style="margin-top: 0; font-size: 22px;">🎨 CVS Pulse Color Validation</h2>
      <p style="opacity: 0.9; margin-bottom: 20px;">Extracted colors from screenshot and validated against CVS Pulse design tokens.</p>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px;">
        <div style="background: rgba(255,255,255,0.2); padding: 15px; border-radius: 8px; backdrop-filter: blur(10px);">
          <h3 style="color: rgba(255,255,255,0.8); font-size: 12px; text-transform: uppercase; margin: 0 0 5px 0;">Colors Analyzed</h3>
          <div style="font-size: 28px; font-weight: bold;">${report.colorValidation.colorsAnalyzed}</div>
        </div>
        <div style="background: rgba(255,255,255,0.2); padding: 15px; border-radius: 8px; backdrop-filter: blur(10px);">
          <h3 style="color: rgba(255,255,255,0.8); font-size: 12px; text-transform: uppercase; margin: 0 0 5px 0;">Token Mismatches</h3>
          <div style="font-size: 28px; font-weight: bold;">${report.colorValidation.tokenMismatches}</div>
        </div>
        <div style="background: rgba(255,255,255,0.2); padding: 15px; border-radius: 8px; backdrop-filter: blur(10px);">
          <h3 style="color: rgba(255,255,255,0.8); font-size: 12px; text-transform: uppercase; margin: 0 0 5px 0;">Deprecated Colors</h3>
          <div style="font-size: 28px; font-weight: bold;">${report.colorValidation.deprecatedColors}</div>
        </div>
        <div style="background: rgba(255,255,255,0.2); padding: 15px; border-radius: 8px; backdrop-filter: blur(10px);">
          <h3 style="color: rgba(255,255,255,0.8); font-size: 12px; text-transform: uppercase; margin: 0 0 5px 0;">Contrast Issues</h3>
          <div style="font-size: 28px; font-weight: bold;">${report.colorValidation.contrastIssues}</div>
        </div>
      </div>
      
      ${report.screenshot ? `
      <div style="background: rgba(255,255,255,0.15); padding: 20px; border-radius: 8px; backdrop-filter: blur(10px);">
        <h3 style="color: rgba(255,255,255,0.9); font-size: 14px; margin: 0 0 10px 0;"><svg width="14" height="14" viewBox="0 0 384 512" fill="currentColor" style="vertical-align:-2px;margin-right:4px;"><path d="M16 64C16 28.7 44.7 0 80 0H304c35.3 0 64 28.7 64 64V448c0 35.3-28.7 64-64 64H80c-35.3 0-64-28.7-64-64V64zm128 384c0 8.8 7.2 16 16 16h64c8.8 0 16-7.2 16-16s-7.2-16-16-16H160c-8.8 0-16 7.2-16 16zM304 32H80c-17.7 0-32 14.3-32 32V416h288V64c0-17.7-14.3-32-32-32z"/></svg> Analyzed Screen</h3>
        <div style="text-align: center;">
          <img src="${report.screenshot}" alt="Analyzed screen" style="max-width: 300px; max-height: 600px; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); border: 2px solid rgba(255,255,255,0.3);">
        </div>
        <p style="color: rgba(255,255,255,0.7); margin: 10px 0 0 0; font-size: 12px; text-align: center;">
          Colors were extracted from this screenshot and validated against CVS Pulse design tokens
        </p>
      </div>
      ` : ''}
    </div>
    ` : ''}

    ${componentBreakdownRows ? `
    <div class="card">
      <h2>Component Breakdown</h2>
      <table>
        <thead><tr><th>Component</th><th style="text-align:center">Violations</th></tr></thead>
        <tbody>${componentBreakdownRows}</tbody>
      </table>
    </div>
    ` : ''}

    ${report.totalViolations > 0 ? `
    <div class="card">
      <h2>Violations (${report.totalViolations})</h2>
      <table>
        <thead>
          <tr><th>#</th><th>Severity</th><th>Component</th><th>Element</th><th>Rule</th></tr>
        </thead>
        <tbody>${violationRows}</tbody>
      </table>
    </div>
    ` : `
    <div class="success">
      <h2>✅ All Clear!</h2>
      <p>All ${report.totalElements} elements meet CVS Pulse design system standards.</p>
    </div>
    `}
  </div>
</body>
</html>`;
}
function sanitizeFlowName(flowName) {
    return normalizeText(flowName).replace(/[^a-zA-Z0-9-_]+/g, '_') || 'recorded_flow';
}
function inferScreenName(flowName, elements) {
    const name = normalizeText(flowName);
    // Extract screen name from flow name patterns
    if (name.match(/login|signin|sign_in/i))
        return 'Login';
    if (name.match(/signup|register|sign_up/i))
        return 'Signup';
    if (name.match(/dashboard|home|main/i))
        return 'Dashboard';
    if (name.match(/profile|account/i))
        return 'Profile';
    if (name.match(/cart|checkout/i))
        return 'Cart';
    if (name.match(/search/i))
        return 'Search';
    if (name.match(/pharmacy/i))
        return 'Pharmacy';
    if (name.match(/benefits|insurance/i))
        return 'Benefits';
    if (name.match(/health/i))
        return 'Health';
    // Analyze element text for context
    const elementTexts = elements.map(e => e.text.toLowerCase()).join(' ');
    if (elementTexts.includes('email') && elementTexts.includes('password'))
        return 'Login';
    if (elementTexts.includes('sign up') || elementTexts.includes('create account'))
        return 'Signup';
    if (elementTexts.includes('cart') || elementTexts.includes('checkout'))
        return 'Cart';
    // Default to capitalized flow name
    return name.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
}
function inferCategory(appId, elements) {
    const id = normalizeText(appId).toLowerCase();
    const elementTexts = elements.map(e => e.text.toLowerCase()).join(' ');
    // Check element context first
    if (elementTexts.includes('login') || elementTexts.includes('sign in') || elementTexts.includes('password'))
        return 'Account';
    if (elementTexts.includes('pharmacy') || elementTexts.includes('prescription') || elementTexts.includes('refill'))
        return 'Pharmacy';
    if (elementTexts.includes('shop') || elementTexts.includes('cart') || elementTexts.includes('checkout'))
        return 'Shop';
    if (elementTexts.includes('insurance') || elementTexts.includes('benefits') || elementTexts.includes('claim'))
        return 'Benefits';
    if (elementTexts.includes('health') || elementTexts.includes('records') || elementTexts.includes('medical'))
        return 'Health';
    if (elementTexts.includes('home') || elementTexts.includes('dashboard'))
        return 'Home';
    // Check app ID
    if (id.includes('health100'))
        return 'Health';
    return 'Common';
}
function generateElementName(text, type, index) {
    const normalized = text.replace(/[^a-zA-Z0-9\s]/g, '').trim();
    const words = normalized.split(/\s+/).filter(w => w.length > 0);
    // Generate camelCase name
    let baseName = words.map((w, i) => i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
    // Add type suffix based on element type
    if (type === 'input') {
        if (!baseName.endsWith('Field'))
            baseName += 'Field';
    }
    else if (type === 'tap') {
        if (text.toLowerCase().includes('button') || text.toLowerCase().includes('btn')) {
            if (!baseName.endsWith('Btn'))
                baseName += 'Btn';
        }
        else if (text.toLowerCase().includes('link')) {
            if (!baseName.endsWith('Link'))
                baseName += 'Link';
        }
        else if (text.toLowerCase().includes('icon')) {
            if (!baseName.endsWith('Icon'))
                baseName += 'Icon';
        }
        else {
            if (!baseName.endsWith('Btn'))
                baseName += 'Btn';
        }
    }
    else if (type === 'assertVisible') {
        // Labels for non-interactive text elements
        if (text.toLowerCase().includes('error') || text.toLowerCase().includes('message')) {
            if (!baseName.endsWith('Msg'))
                baseName += 'Msg';
        }
        else if (text.toLowerCase().includes('title') || text.toLowerCase().includes('heading')) {
            if (!baseName.endsWith('Title'))
                baseName += 'Title';
        }
        else {
            if (!baseName.endsWith('Label'))
                baseName += 'Label';
        }
    }
    return baseName || `element${index}`;
}
function generateScreenObject(elements, screenName, category) {
    const objectKey = `${category.toLowerCase()}_${screenName.toLowerCase()}`;
    let content = `// screens/${category}/${screenName}Screen.js\n`;
    content += `// Element definitions for ${screenName.toLowerCase()} screen\n`;
    content += `// Auto-generated by Maestro Flow Recorder\n\n`;
    content += `output.${objectKey} = {\n`;
    elements.forEach((element, index) => {
        const elementName = generateElementName(element.text, element.type, index);
        // Use text if available, otherwise fallback to ID
        if (element.text && element.text.trim()) {
            content += `  ${elementName}: "${element.text}",\n`;
        }
        else if (element.selectorId) {
            content += `  ${elementName}: "id:${element.selectorId}",\n`;
        }
    });
    content += `};\n`;
    return content;
}
function isSyntheticHierarchyId(value) {
    const normalized = normalizeText(value);
    return /^element-\d+-\d+$/i.test(normalized) || /^id:\s*element-\d+-\d+$/i.test(normalized);
}
function stepToYaml(step) {
    const selectorId = normalizeText(step?.selectorId);
    const hasSyntheticSelectorId = isSyntheticHierarchyId(selectorId);
    const canUseSelectorId = !!selectorId && !hasSyntheticSelectorId;
    const selectorYaml = canUseSelectorId ? `\n    id: "${selectorId}"` : '';
    const rawTarget = normalizeText(step?.target || '');
    const target = isSyntheticHierarchyId(rawTarget) ? '' : rawTarget;
    const escapedTarget = target.replace(/"/g, '\\"');
    switch (step?.type) {
        case 'tap':
            return canUseSelectorId ? `- tapOn:${selectorYaml}\n` : `- tapOn: "${escapedTarget}"\n`;
        case 'input':
            return canUseSelectorId ? `- tapOn:${selectorYaml}\n- inputText: "${step.value || ''}"\n` : `- tapOn: "${escapedTarget}"\n- inputText: "${step.value || ''}"\n`;
        case 'assert':
        case 'assertVisible':
            return canUseSelectorId ? `- assertVisible:${selectorYaml}\n` : `- assertVisible: "${escapedTarget}"\n`;
        case 'assertNotVisible':
            return canUseSelectorId ? `- assertNotVisible:${selectorYaml}\n` : `- assertNotVisible: "${escapedTarget}"\n`;
        case 'longPress':
            return canUseSelectorId ? `- longPressOn:${selectorYaml}\n` : `- longPressOn: "${escapedTarget}"\n`;
        case 'swipe':
            return `- swipe:\n    direction: ${step.value || 'UP'}\n`;
        case 'wait':
            return `- waitForAnimationToEnd\n`;
        case 'scroll':
            return step.value ? `- scroll\n    direction: ${step.value}\n` : '- scroll\n';
        case 'scrollUntilVisible':
            return canUseSelectorId ? `- scrollUntilVisible:${selectorYaml}\n` : `- scrollUntilVisible: "${escapedTarget}"\n`;
        case 'hideKeyboard':
            return '- hideKeyboard\n';
        case 'back':
            return '- back\n';
        case 'pressKey':
            return `- pressKey: "${step.value || step.target || 'enter'}"\n`;
        case 'launchApp':
            return step.target ? `- launchApp:\n    appId: "${step.target}"\n` : '- launchApp\n';
        case 'stopApp':
            return step.target ? `- stopApp:\n    appId: "${step.target}"\n` : '- stopApp\n';
        case 'custom':
            return `${(step.value || '').trim()}${(step.value || '').trim().endsWith('\n') ? '' : '\n'}`;
        default:
            return '';
    }
}
function getStepTarget(step) {
    return normalizeText(step?.selectorId || step?.target);
}
function hierarchyContainsTarget(hierarchy, target) {
    const normalizedTarget = normalizeText(target).toLowerCase();
    if (!normalizedTarget)
        return false;
    return hierarchy.some((element) => {
        const text = normalizeText(element.text).toLowerCase();
        const id = normalizeText(element.id).toLowerCase();
        return text.includes(normalizedTarget) || id.includes(normalizedTarget);
    });
}
function findBestMatchingHierarchyElement(hierarchy, step) {
    const normalizedTarget = normalizeText(step?.target).toLowerCase();
    const normalizedSelectorId = normalizeText(step?.selectorId).toLowerCase();
    const ranked = hierarchy
        .map((element) => {
        const text = normalizeText(element.text).toLowerCase();
        const id = normalizeText(element.id).toLowerCase();
        let score = -1;
        if (normalizedSelectorId && id === normalizedSelectorId) {
            score = 7;
        }
        else if (normalizedSelectorId && id.includes(normalizedSelectorId)) {
            score = 6;
        }
        else if (normalizedTarget && (id === normalizedTarget || text === normalizedTarget)) {
            score = 5;
        }
        else if (normalizedTarget && id.includes(normalizedTarget)) {
            score = 4;
        }
        else if (normalizedTarget && text.includes(normalizedTarget)) {
            score = 3;
        }
        else if (normalizedTarget && id && normalizedTarget.includes(id)) {
            score = 2;
        }
        return { element, score };
    })
        .filter((entry) => entry.score >= 0)
        .sort((a, b) => b.score - a.score);
    return ranked[0]?.element || null;
}
async function enrichStepWithResolvedSelector(step) {
    if (!step) {
        return step;
    }
    if (!['tap', 'input', 'assert', 'assertVisible', 'assertNotVisible', 'longPress', 'scrollUntilVisible'].includes(step.type)) {
        return step;
    }
    const hierarchy = await getRealHierarchy();
    const match = findBestMatchingHierarchyElement(hierarchy, step);
    if (!match) {
        return step;
    }
    const normalizedSelectorId = normalizeText(step?.selectorId);
    const normalizedTarget = normalizeText(step?.target);
    const selectorIdIsSynthetic = isSyntheticHierarchyId(normalizedSelectorId);
    const targetIsSynthetic = isSyntheticHierarchyId(normalizedTarget);
    return {
        ...step,
        selectorId: normalizedSelectorId ? (selectorIdIsSynthetic ? '' : normalizedSelectorId) : (isSyntheticHierarchyId(match.id) ? '' : match.id),
        bounds: step.bounds || match.bounds,
        target: targetIsSynthetic ? (match.text || match.id) : (step.target || match.text || match.id)
    };
}
function buildPointTapYaml(bounds) {
    const rect = parseBoundsRect(bounds);
    if (!rect)
        return null;
    const centerX = Math.round((rect.x1 + rect.x2) / 2);
    const centerY = Math.round((rect.y1 + rect.y2) / 2);
    return `- tapOn:\n    point: "${centerX},${centerY}"\n    retryTapIfNoChange: true\n    waitToSettleTimeoutMs: ${FAST_TAP_SETTLE_TIMEOUT_MS}\n`;
}
function buildExecutionStepYaml(step) {
    if (step?.type === 'tap' && step?.bounds) {
        const pointTapYaml = buildPointTapYaml(step.bounds);
        if (pointTapYaml) {
            return pointTapYaml;
        }
    }
    if (step?.type === 'input' && step?.bounds) {
        const pointTapYaml = buildPointTapYaml(step.bounds);
        if (pointTapYaml) {
            return `${pointTapYaml}- inputText: "${step.value || ''}"\n`;
        }
    }
    return stepToYaml(step);
}
async function executeNonInteractiveStep(step) {
    if (step?.type === 'wait') {
        const duration = Math.max(0, Math.min(Number(step?.value || step?.target || 1000) || 1000, 5000));
        await new Promise((resolve) => setTimeout(resolve, duration));
        return { handled: true, message: `Waited ${duration}ms` };
    }
    if (step?.type === 'assertVisible' || step?.type === 'assert') {
        const hierarchy = await getRealHierarchy();
        const target = getStepTarget(step);
        if (!target) {
            throw new Error('Missing assertion target');
        }
        if (!hierarchyContainsTarget(hierarchy, target)) {
            throw new Error(`Element not visible: ${target}`);
        }
        return { handled: true, message: `Verified visible: ${target}` };
    }
    if (step?.type === 'assertNotVisible') {
        const hierarchy = await getRealHierarchy();
        const target = getStepTarget(step);
        if (!target) {
            throw new Error('Missing assertion target');
        }
        if (hierarchyContainsTarget(hierarchy, target)) {
            throw new Error(`Element still visible: ${target}`);
        }
        return { handled: true, message: `Verified not visible: ${target}` };
    }
    return { handled: false };
}
async function runMaestroCommand(args, timeoutMs) {
    return new Promise((resolve, reject) => {
        const child = (0, child_process_1.execFile)('maestro', args, {
            maxBuffer: 20 * 1024 * 1024
        }, (error, stdout, stderr) => {
            if (timeoutHandle) {
                clearTimeout(timeoutHandle);
            }
            if (error) {
                const stderrOutput = typeof stderr === 'string' ? stderr : '';
                const stdoutOutput = typeof stdout === 'string' ? stdout : '';
                const details = [error.message, stderrOutput, stdoutOutput].filter(Boolean).join('\n');
                reject(new Error(details || 'Maestro command failed'));
                return;
            }
            resolve({
                stdout: typeof stdout === 'string' ? stdout : '',
                stderr: typeof stderr === 'string' ? stderr : ''
            });
        });
        const timeoutHandle = setTimeout(() => {
            child.kill('SIGKILL');
            reject(new Error(`Maestro command timed out after ${timeoutMs}ms`));
        }, timeoutMs);
    });
}
async function handleExportFlow(ws, data) {
    console.log(`💾 Exporting flow: ${data.flowName}.yaml`);
    // Generate YAML content
    let yaml = `appId: ${data.appId || DEFAULT_APP_ID}\n`;
    yaml += `name: ${data.flowName}\n`;
    yaml += `tags:\n  - recorded\n  - automated\n---\n`;
    data.steps.forEach((step) => {
        yaml += stepToYaml(step);
    });
    console.log('Generated YAML:\n', yaml);
    const safeFlowName = sanitizeFlowName(data.flowName);
    const outputPath = path_1.default.join(FLOW_OUTPUT_DIR, `${safeFlowName}.yaml`);
    await fs_1.promises.mkdir(FLOW_OUTPUT_DIR, { recursive: true });
    await fs_1.promises.writeFile(outputPath, yaml, 'utf8');
    ws.send(JSON.stringify({
        type: 'flow-exported',
        flowName: data.flowName,
        yaml: yaml,
        path: outputPath,
        message: `Flow exported successfully to ${outputPath}`
    }));
}
async function handleExecuteStep(ws, data) {
    const rawStep = data?.step;
    const step = await enrichStepWithResolvedSelector(rawStep);
    if (!step || !step.type) {
        ws.send(JSON.stringify({ type: 'step-execution-failed', step, message: 'Invalid step payload' }));
        return;
    }
    const stepYaml = buildExecutionStepYaml(step);
    if (!stepYaml) {
        ws.send(JSON.stringify({ type: 'step-execution-failed', step, message: `Unsupported step type: ${step.type}` }));
        return;
    }
    const flowPath = `/tmp/maestro-recorder-step-${Date.now()}.yaml`;
    const flowContent = `appId: ${data.appId || activeRecording?.appId || DEFAULT_APP_ID}\n---\n${stepYaml}`;
    try {
        ws.send(JSON.stringify({ type: 'step-execution-started', step, message: `Executing ${step.type} on ${step.target}` }));
        console.log(`▶️ Step execution YAML for ${step.type}:\n${flowContent}`);
        const nonInteractiveResult = await executeNonInteractiveStep(step);
        if (nonInteractiveResult.handled) {
            const screenshot = await getRealSimulatorScreenshot();
            const hierarchy = await getRealHierarchy();
            ws.send(JSON.stringify({ type: 'step-executed', step, message: nonInteractiveResult.message || `Executed ${step.type}` }));
            ws.send(JSON.stringify({ type: 'screenshot-updated', screenshot }));
            broadcastHierarchyIfChanged(ws, hierarchy);
            return;
        }
        await fs_1.promises.writeFile(flowPath, flowContent, 'utf8');
        const bootedUdid = await getBootedSimulatorUdid();
        const args = bootedUdid ? ['--device', bootedUdid, 'test', flowPath] : ['test', flowPath];
        await runMaestroCommand(args, INTERACTIVE_STEP_TIMEOUT_MS);
        const screenshot = await getRealSimulatorScreenshot();
        const hierarchy = await getRealHierarchy();
        ws.send(JSON.stringify({ type: 'step-executed', step, message: `Executed ${step.type} on ${step.target}` }));
        ws.send(JSON.stringify({ type: 'screenshot-updated', screenshot }));
        broadcastHierarchyIfChanged(ws, hierarchy);
        // Delay cleanup to ensure Maestro has finished reading the file
        setTimeout(() => {
            fs_1.promises.unlink(flowPath).catch(() => undefined);
        }, 2000);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        ws.send(JSON.stringify({ type: 'step-execution-failed', step, message: `Step execution failed: ${message}` }));
        // Cleanup on error too, but with delay
        setTimeout(() => {
            fs_1.promises.unlink(flowPath).catch(() => undefined);
        }, 2000);
    }
}
async function handleExecuteAllSteps(ws, data) {
    const rawSteps = Array.isArray(data?.steps) ? data.steps : [];
    if (rawSteps.length === 0) {
        ws.send(JSON.stringify({ type: 'play-all-failed', message: 'No steps to execute' }));
        return;
    }
    const resolvedSteps = [];
    for (const rawStep of rawSteps) {
        const step = await enrichStepWithResolvedSelector(rawStep);
        if (step && step.type) {
            resolvedSteps.push(step);
        }
    }
    if (resolvedSteps.length === 0) {
        ws.send(JSON.stringify({ type: 'play-all-failed', message: 'No valid steps to execute' }));
        return;
    }
    const yamlBody = resolvedSteps
        .map((step) => buildExecutionStepYaml(step))
        .filter(Boolean)
        .join('');
    if (!yamlBody) {
        ws.send(JSON.stringify({ type: 'play-all-failed', message: 'Unable to build executable flow YAML' }));
        return;
    }
    const flowPath = `/tmp/maestro-recorder-play-all-${Date.now()}.yaml`;
    const flowContent = `appId: ${data.appId || activeRecording?.appId || DEFAULT_APP_ID}\n---\n${yamlBody}`;
    try {
        ws.send(JSON.stringify({
            type: 'play-all-started',
            stepCount: resolvedSteps.length,
            message: `Executing ${resolvedSteps.length} steps...`
        }));
        for (const step of resolvedSteps) {
            ws.send(JSON.stringify({
                type: 'step-execution-started',
                step,
                message: `Queued ${step.type} on ${step.target}`
            }));
        }
        await fs_1.promises.writeFile(flowPath, flowContent, 'utf8');
        const bootedUdid = await getBootedSimulatorUdid();
        const args = bootedUdid ? ['--device', bootedUdid, 'test', flowPath] : ['test', flowPath];
        const timeoutMs = Math.max(INTERACTIVE_STEP_TIMEOUT_MS, resolvedSteps.length * 8000);
        await runMaestroCommand(args, timeoutMs);
        for (const step of resolvedSteps) {
            ws.send(JSON.stringify({
                type: 'step-executed',
                step,
                message: `Executed ${step.type} on ${step.target}`
            }));
        }
        const screenshot = await getRealSimulatorScreenshot();
        const hierarchy = await getRealHierarchy();
        ws.send(JSON.stringify({ type: 'screenshot-updated', screenshot }));
        broadcastHierarchyIfChanged(ws, hierarchy);
        ws.send(JSON.stringify({
            type: 'play-all-completed',
            stepCount: resolvedSteps.length,
            message: `Finished executing ${resolvedSteps.length} steps`
        }));
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        ws.send(JSON.stringify({
            type: 'play-all-failed',
            message: `Play All failed: ${message}`
        }));
        for (const step of resolvedSteps) {
            ws.send(JSON.stringify({
                type: 'step-execution-failed',
                step,
                message: `Step execution failed during Play All: ${message}`
            }));
        }
    }
    finally {
        fs_1.promises.unlink(flowPath).catch(() => undefined);
    }
}
function handlePlayback(ws, data) {
    console.log(`▶️ Starting playback with ${data.steps.length} steps...`);
    ws.send(JSON.stringify({
        type: 'playback-started',
        stepCount: data.steps.length
    }));
    // Simulate playback progress
    let currentStep = 0;
    const playbackInterval = setInterval(() => {
        if (currentStep < data.steps.length) {
            const step = data.steps[currentStep];
            console.log(`▶️ Executing step ${currentStep + 1}: ${step.type} on "${step.target}"`);
            ws.send(JSON.stringify({
                type: 'playback-progress',
                currentStep: currentStep + 1,
                totalSteps: data.steps.length,
                step: step
            }));
            currentStep++;
        }
        else {
            clearInterval(playbackInterval);
            console.log('✅ Playback completed');
            ws.send(JSON.stringify({
                type: 'playback-completed',
                message: 'Playback finished successfully'
            }));
        }
    }, 1500); // Execute each step with 1.5s delay
    // TODO: Integrate with Maestro CLI for actual playback
}
// Flow Classification Handler
async function handleClassifySteps(ws, data) {
    console.log('🔍 Classifying recorded steps...');
    try {
        const steps = data.steps || [];
        const context = {
            currentScreen: data.currentScreen,
            devicePlatform: data.devicePlatform
        };
        const classification = (0, flowClassifier_1.classifyRecordedSteps)(steps);
        console.log(`✅ Classification: ${classification.type} (${classification.confidence}% confidence)`);
        console.log(`📁 Category: ${classification.category}`);
        console.log(`📝 Suggested name: ${classification.suggestedName}`);
        ws.send(JSON.stringify({
            type: 'classification-result',
            classification: classification,
            timestamp: new Date().toISOString()
        }));
    }
    catch (error) {
        console.error('❌ Classification failed:', error);
        ws.send(JSON.stringify({
            type: 'classification-failed',
            message: error instanceof Error ? error.message : 'Classification failed'
        }));
    }
}
// Chatbot Handler
async function handleChatMessage(ws, data) {
    console.log('💬 Processing chat message:', data.message);
    try {
        const context = {
            currentScreen: data.context?.currentScreen,
            devicePlatform: data.context?.devicePlatform,
            recordedSteps: data.context?.recordedSteps,
            hierarchy: data.context?.hierarchy,
            recentActions: data.context?.recentActions
        };
        const response = (0, chatbot_1.generateChatResponse)(data.message, context);
        console.log('🤖 Generated response:', response.substring(0, 100) + '...');
        ws.send(JSON.stringify({
            type: 'chat-response',
            message: response,
            timestamp: new Date().toISOString()
        }));
        console.log('✅ Chat response sent');
    }
    catch (error) {
        console.error('❌ Chat error:', error);
        ws.send(JSON.stringify({
            type: 'chat-error',
            message: 'Failed to generate response'
        }));
    }
}
// Help Topics Handler
function handleGetHelpTopics(ws) {
    console.log('📚 Sending help topics...');
    try {
        const topics = (0, chatbot_1.getQuickHelpTopics)();
        ws.send(JSON.stringify({
            type: 'help-topics',
            topics: topics,
            timestamp: new Date().toISOString()
        }));
    }
    catch (error) {
        console.error('❌ Failed to get help topics:', error);
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Failed to get help topics'
        }));
    }
}
// Start server
server.listen(PORT, async () => {
    console.log('\n🎬 Maestro Flow Recorder - Backend');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ HTTP Server: http://localhost:${PORT}`);
    console.log(`✅ WebSocket Server: ws://localhost:${PORT}`);
    console.log(`✅ Environment: ${process.env.NODE_ENV}`);
    // Probe Studio once at boot so the operator immediately sees which
    // hierarchy source is active. This is best-effort — a failed probe just
    // means we'll fall back to the CLI path (still functional, just slower).
    const studio = await (0, studioClient_1.tryStudioSnapshot)();
    if (studio) {
        console.log(`⚡ Hierarchy source: Maestro Studio (${(0, studioClient_1.studioEndpoint)()}) — fast path`);
    }
    else {
        console.log(`🐢 Hierarchy source: maestro CLI (fallback). Start "maestro studio" for ~10x faster captures.`);
    }
    // Kick off framework index build in the background — no await so it doesn't
    // block the startup log.  The index is typically ready in 1–3s.
    (0, frameworkIndex_1.buildFrameworkIndex)(MAESTRO_ROOT)
        .then(idx => {
        cachedFrameworkIndex = idx;
        console.log(`📚 Framework index ready: ${idx.subflows.length} subflows, ${idx.flows.length} flows, ${idx.screens.length} screens (${idx.buildTimeMs}ms)`);
    })
        .catch(err => console.warn('⚠️  Framework index build failed:', err));
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('Ready for connections!');
});
//# sourceMappingURL=server.js.map