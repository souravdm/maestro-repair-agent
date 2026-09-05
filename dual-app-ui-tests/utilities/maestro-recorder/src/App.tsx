import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ThemeProvider, 
  createTheme, 
  CssBaseline, 
  Box, 
  Typography, 
  Button,
  Alert,
  Chip,
  CircularProgress,
  Snackbar,
  AppBar,
  Toolbar,
  IconButton,
  Paper,
  List,
  ListItem,
  ListItemText,
  Divider,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Grid,
  Card,
  CardContent,
  Tooltip,
  ButtonGroup,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
  Menu,
  ListSubheader,
} from '@mui/material';
import DescriptionIcon from '@mui/icons-material/Description';
import PlaylistPlayIcon from '@mui/icons-material/PlaylistPlay';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import GroupWorkIcon from '@mui/icons-material/GroupWork';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import ViewAgendaIcon from '@mui/icons-material/ViewAgenda';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import ClearAllIcon from '@mui/icons-material/ClearAll';
import SaveIcon from '@mui/icons-material/Save';
import DownloadIcon from '@mui/icons-material/Download';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import RefreshIcon from '@mui/icons-material/Refresh';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import SmartphoneIcon from '@mui/icons-material/Smartphone';
import AppleIcon from '@mui/icons-material/Apple';
import AndroidIcon from '@mui/icons-material/Android';
import TouchAppIcon from '@mui/icons-material/TouchApp';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import CodeIcon from '@mui/icons-material/Code';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import GpsFixedIcon from '@mui/icons-material/GpsFixed';
import { Chatbot } from './components/Chatbot';

// ────────────────────────────────────────────────────────────────────────────
// Glass UI theme — replaces the old flat-dark CVS-red palette.
//   • Deep aurora background (indigo → teal → violet), NOT black
//   • Glass surfaces: translucent panels + backdrop-filter blur
//   • Accent: teal/cyan primary, amber secondary (no aggressive red)
//   • Error stays red (semantic), but nothing else does
// The `components.MuiCssBaseline.styleOverrides` block below rewrites every
// hardcoded #1a1a1a / #111 / #000 background site to a glass surface without
// touching the 85 `sx={{ bgcolor: ... }}` call-sites individually.
// ────────────────────────────────────────────────────────────────────────────
const GLASS_ACCENT = '#22d3ee';      // cyan-400 — primary
const GLASS_ACCENT_HOVER = '#67e8f9'; // cyan-300
const GLASS_SECONDARY = '#f59e0b';    // amber-500 — for CTAs previously red
const GLASS_SURFACE = 'rgba(255, 255, 255, 0.06)';
const GLASS_SURFACE_STRONG = 'rgba(255, 255, 255, 0.09)';
const GLASS_BORDER = 'rgba(255, 255, 255, 0.10)';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary:   { main: GLASS_ACCENT, contrastText: '#0b1220' },
    secondary: { main: GLASS_SECONDARY },
    success:   { main: '#34d399' },
    info:      { main: '#60a5fa' },
    warning:   { main: '#fbbf24' },
    error:     { main: '#f87171' }, // softer red, reserved for real errors
    background: {
      // Rendered under the glass panels — actual gradient is set on <body> in index.html.
      default: '#0f172a',   // slate-900 fallback
      paper:   GLASS_SURFACE_STRONG,
    },
    divider: GLASS_BORDER,
    text: { primary: '#e2e8f0', secondary: '#94a3b8' },
  },
  shape: { borderRadius: 14 },
  typography: {
    fontFamily: '"Inter", "SF Pro Display", -apple-system, "Segoe UI", Roboto, sans-serif',
    button: { textTransform: 'none', fontWeight: 600 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        // Aurora background painted on <body> — no more flat black.
        'html, body, #root': {
          height: '100%',
          margin: 0,
          background:
            'radial-gradient(1200px 800px at 15% 10%, rgba(34,211,238,0.18), transparent 60%),' +
            'radial-gradient(1000px 700px at 85% 20%, rgba(139,92,246,0.16), transparent 65%),' +
            'radial-gradient(1400px 900px at 50% 100%, rgba(16,185,129,0.12), transparent 60%),' +
            'linear-gradient(160deg, #0b1220 0%, #0f172a 50%, #111827 100%)',
          backgroundAttachment: 'fixed',
          color: '#e2e8f0',
          fontFeatureSettings: '"cv02","cv03","cv04","cv11"',
        },
        // Blanket-override every hardcoded dark bgcolor at the call-site — the
        // `!important` beats MUI's `sx` generated class specificity.
        '.MuiPaper-root, .MuiCard-root': {
          backgroundColor: `${GLASS_SURFACE} !important`,
          backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))',
          backdropFilter: 'blur(14px) saturate(140%)',
          WebkitBackdropFilter: 'blur(14px) saturate(140%)',
          border: `1px solid ${GLASS_BORDER}`,
          boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
        },
        '.MuiAppBar-root': {
          backgroundColor: 'rgba(15,23,42,0.55) !important',
          backgroundImage: 'none !important',
          backdropFilter: 'blur(18px) saturate(160%)',
          WebkitBackdropFilter: 'blur(18px) saturate(160%)',
          borderBottom: `1px solid ${GLASS_BORDER}`,
          color: '#e2e8f0 !important',
          boxShadow: 'none !important',
        },
        // The device-frame previously used bgcolor:'#000' — soften it.
        '.device-frame': {
          backgroundColor: 'rgba(0,0,0,0.55) !important',
          borderRadius: 24,
          border: `1px solid ${GLASS_BORDER}`,
        },
        // Slim, custom scrollbars that match the glass palette.
        '*::-webkit-scrollbar': { width: 10, height: 10 },
        '*::-webkit-scrollbar-thumb': {
          background: 'rgba(255,255,255,0.14)',
          borderRadius: 999,
        },
        '*::-webkit-scrollbar-thumb:hover': { background: 'rgba(255,255,255,0.22)' },
        '*::-webkit-scrollbar-track': { background: 'transparent' },
        // Any element the code still tints with the old CVS red — swap it live.
        '[style*="rgb(204, 0, 0)"], [style*="#CC0000"], [style*="#cc0000"]': {
          color: `${GLASS_ACCENT} !important`,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 12, backdropFilter: 'blur(6px)' },
        containedPrimary: {
          background: `linear-gradient(135deg, ${GLASS_ACCENT}, #0ea5e9)`,
          color: '#0b1220',
          '&:hover': { background: `linear-gradient(135deg, ${GLASS_ACCENT_HOVER}, #38bdf8)` },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          background: 'rgba(255,255,255,0.08)',
          border: `1px solid ${GLASS_BORDER}`,
          backdropFilter: 'blur(6px)',
        },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          background: 'rgba(15,23,42,0.85)',
          border: `1px solid ${GLASS_BORDER}`,
          backdropFilter: 'blur(10px)',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: { backdropFilter: 'blur(20px) saturate(160%)' },
      },
    },
  },
});

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';
type RecordingStatus = 'idle' | 'recording' | 'stopping';
// Complete list of Maestro commands from https://docs.maestro.dev/reference/commands-available
// Any command that produces a valid Maestro YAML step is included here so the
// recorder can compose it without users dropping down to "custom" every time.
type RecorderStepType =
  // — Interaction —
  | 'tap' | 'doubleTap' | 'longPress' | 'input' | 'eraseText'
  | 'copyTextFrom' | 'pasteText' | 'setClipboard'
  | 'swipe' | 'scroll' | 'scrollUntilVisible'
  | 'pressKey' | 'hideKeyboard' | 'back' | 'openLink'
  // — Assertions —
  | 'assertVisible' | 'assertNotVisible' | 'assertTrue' | 'assertScreenshot'
  | 'assertWithAI' | 'assertNoDefectsWithAI'
  // — Waits —
  | 'wait' | 'extendedWaitUntil'
  // — App lifecycle —
  | 'launchApp' | 'stopApp' | 'killApp' | 'clearState' | 'clearKeychain'
  // — Device state —
  | 'takeScreenshot' | 'startRecording' | 'stopRecording'
  | 'setLocation' | 'setAirplaneMode' | 'toggleAirplaneMode'
  | 'setOrientation' | 'setPermissions' | 'addMedia' | 'travel'
  // — Flow control —
  | 'repeat' | 'retry' | 'runFlow' | 'runScript' | 'evalScript' | 'defineVariables'
  // — AI —
  | 'extractTextWithAI'
  // — Escape hatch —
  | 'custom';

interface TestStep {
  id: number;
  type: RecorderStepType;
  target: string;
  value?: string;
  selectorId?: string;
  bounds?: string;
  group?: string;
  timestamp: Date;
}

interface ElementInfo {
  id: string;
  type: string;
  text: string;
  bounds: string;
  clickable: boolean;
  focused: boolean;
}

interface ParsedBounds {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

type StepExecutionStatus = 'idle' | 'running' | 'success' | 'error';
type ExecutionLogFilter = 'all' | 'info' | 'success' | 'error';

interface ExecutionLogEntry {
  id: number;
  level: 'info' | 'success' | 'error';
  message: string;
  timestamp: Date;
  stepId?: number;
}

interface StepTemplate {
  label: string;
  step: Omit<TestStep, 'id' | 'timestamp'>;
}

type CommandCategory =
  | 'Interaction'
  | 'Assertion'
  | 'Wait'
  | 'App'
  | 'Device'
  | 'Flow'
  | 'AI'
  | 'Advanced';

interface MaestroCommandOption {
  type: RecorderStepType;
  label: string;
  category: CommandCategory;
  // Optional short description shown as helper text under the picker.
  description?: string;
  targetLabel?: string;
  valueLabel?: string;
  defaultTarget?: string;
  defaultValue?: string;
  // When true, target field can be omitted (the command works without one).
  targetOptional?: boolean;
  // When true, value field can be omitted.
  valueOptional?: boolean;
}

const DRAFT_STORAGE_KEY = 'maestro-recorder-draft-v1';

const STEP_TEMPLATES: StepTemplate[] = [
  { label: 'Login Wait', step: { type: 'wait', target: 'animation', value: '1000', group: 'Setup' } },
  { label: 'Assert Home', step: { type: 'assertVisible', target: 'Home', group: 'Verification' } },
  { label: 'Swipe Up', step: { type: 'swipe', target: 'screen', value: 'UP', group: 'Navigation' } },
  { label: 'Tap Continue', step: { type: 'tap', target: 'Continue', group: 'Action' } }
];

const APP_ID_OPTIONS = [
  { label: 'CVS Health', value: 'com.cvsenterpriseiphone.cvspharmacy' },
  { label: 'Health 100', value: 'com.cvsenterpriseiphone.health100' }
];

// Full catalog of Maestro commands sourced from
// https://docs.maestro.dev/reference/commands-available
// Grouped by `category` so the picker can present them in labeled sections
// instead of one flat 40-entry dropdown.
const MAESTRO_COMMAND_OPTIONS: MaestroCommandOption[] = [
  // ─────────────── Interaction ───────────────
  { type: 'tap',                 label: 'tapOn',            category: 'Interaction', targetLabel: 'Target',       defaultTarget: 'Continue',                 description: 'Tap an element by text, id, or coordinates.' },
  { type: 'doubleTap',           label: 'doubleTapOn',      category: 'Interaction', targetLabel: 'Target',       defaultTarget: 'Continue',                 description: 'Double-tap gesture on element or coords.' },
  { type: 'longPress',           label: 'longPressOn',      category: 'Interaction', targetLabel: 'Target',       defaultTarget: 'Continue',                 description: 'Long-press for context menu or drag.' },
  { type: 'input',               label: 'inputText',        category: 'Interaction', targetLabel: 'Field',        valueLabel: 'Text',            defaultTarget: 'Email',    defaultValue: 'test@example.com', description: 'Type text into focused input.' },
  { type: 'eraseText',           label: 'eraseText',        category: 'Interaction', valueLabel: 'Char count',    defaultValue: '50',            targetOptional: true, description: 'Delete N characters from the focused field.' },
  // eslint-disable-next-line no-template-curly-in-string -- `${maestro.copiedText}` is Maestro's runtime placeholder, not a JS template literal.
  { type: 'copyTextFrom',        label: 'copyTextFrom',     category: 'Interaction', targetLabel: 'Element',      defaultTarget: 'Order #',                  description: 'Copy element text into `${maestro.copiedText}`.' },
  { type: 'pasteText',           label: 'pasteText',        category: 'Interaction', targetOptional: true,        valueOptional: true,                       description: 'Paste clipboard text into focused input.' },
  { type: 'setClipboard',        label: 'setClipboard',     category: 'Interaction', valueLabel: 'Text',          defaultValue: 'hello',         targetOptional: true, description: 'Set device clipboard content.' },
  { type: 'swipe',               label: 'swipe',            category: 'Interaction', valueLabel: 'Direction',     defaultValue: 'UP',            targetOptional: true, description: 'UP / DOWN / LEFT / RIGHT swipe.' },
  { type: 'scroll',              label: 'scroll',           category: 'Interaction', targetOptional: true,        valueLabel: 'Direction',       defaultValue: 'DOWN',      description: 'Scroll one screen distance.' },
  { type: 'scrollUntilVisible',  label: 'scrollUntilVisible', category: 'Interaction', targetLabel: 'Target',    defaultTarget: 'Continue',                 description: 'Scroll until element visible.' },
  { type: 'pressKey',            label: 'pressKey',         category: 'Interaction', valueLabel: 'Key',           defaultValue: 'enter',         targetOptional: true, description: 'Home, Back, Enter, Volume, etc.' },
  { type: 'hideKeyboard',        label: 'hideKeyboard',     category: 'Interaction', targetOptional: true, valueOptional: true,                              description: 'Dismiss soft keyboard.' },
  { type: 'back',                label: 'back',             category: 'Interaction', targetOptional: true, valueOptional: true,                              description: 'System back navigation.' },
  { type: 'openLink',            label: 'openLink',         category: 'Interaction', valueLabel: 'URL',           defaultValue: 'https://example.com',  targetOptional: true, description: 'Open URL / deep link.' },

  // ─────────────── Assertions ───────────────
  { type: 'assertVisible',       label: 'assertVisible',    category: 'Assertion',   targetLabel: 'Element',      defaultTarget: 'Home',                     description: 'Fail if not visible after retry.' },
  { type: 'assertNotVisible',    label: 'assertNotVisible', category: 'Assertion',   targetLabel: 'Element',      defaultTarget: 'Loading',                  description: 'Fail if the element becomes visible.' },
  // eslint-disable-next-line no-template-curly-in-string -- `${output.foo}` is Maestro's runtime placeholder, not a JS template literal.
  { type: 'assertTrue',          label: 'assertTrue',       category: 'Assertion',   valueLabel: 'JS expression', defaultValue: '${output.foo} == "bar"',  targetOptional: true, description: 'Fail unless JS expression is truthy.' },
  { type: 'assertScreenshot',    label: 'assertScreenshot', category: 'Assertion',   targetLabel: 'Baseline name', defaultTarget: 'home-screen',             description: 'Visual regression vs baseline.' },
  { type: 'assertWithAI',        label: 'assertWithAI',     category: 'AI',          valueLabel: 'Assertion',     defaultValue: 'The login form is visible', targetOptional: true, description: 'Natural-language assertion (AI).' },
  { type: 'assertNoDefectsWithAI', label: 'assertNoDefectsWithAI', category: 'AI',    targetOptional: true, valueOptional: true,                             description: 'AI visual defect scan.' },
  { type: 'extractTextWithAI',   label: 'extractTextWithAI', category: 'AI',         valueLabel: 'Instruction',   defaultValue: 'Extract the order number', targetOptional: true, description: 'Extract structured data via AI vision.' },

  // ─────────────── Waits ───────────────
  { type: 'wait',                label: 'waitForAnimationToEnd', category: 'Wait',   valueLabel: 'Timeout (ms)',  defaultValue: '5000',         targetOptional: true, description: 'Wait for any UI animation to finish.' },
  { type: 'extendedWaitUntil',   label: 'extendedWaitUntil', category: 'Wait',       targetLabel: 'Element',      valueLabel: 'Timeout (ms)',   defaultTarget: 'Continue', defaultValue: '15000', description: 'Wait up to N ms for element visible.' },

  // ─────────────── App lifecycle ───────────────
  { type: 'launchApp',           label: 'launchApp',        category: 'App',         targetLabel: 'App ID',       defaultTarget: APP_ID_OPTIONS[0].value,     description: 'Launch (optionally clear state).' },
  { type: 'stopApp',             label: 'stopApp',          category: 'App',         targetLabel: 'App ID',       defaultTarget: APP_ID_OPTIONS[0].value,     description: 'Stop app, keep data.' },
  { type: 'killApp',             label: 'killApp',          category: 'App',         targetLabel: 'App ID',       defaultTarget: APP_ID_OPTIONS[0].value,     description: 'Force-stop and clear cache.' },
  { type: 'clearState',          label: 'clearState',       category: 'App',         targetLabel: 'App ID',       defaultTarget: APP_ID_OPTIONS[0].value, targetOptional: true, description: 'Reset app to fresh-install state.' },
  { type: 'clearKeychain',       label: 'clearKeychain',    category: 'App',         targetOptional: true, valueOptional: true,                              description: 'iOS: wipe app keychain entries.' },

  // ─────────────── Device state ───────────────
  { type: 'takeScreenshot',      label: 'takeScreenshot',   category: 'Device',      valueLabel: 'Filename',      defaultValue: 'home',          targetOptional: true, description: 'Capture PNG to output dir.' },
  { type: 'startRecording',      label: 'startRecording',   category: 'Device',      valueLabel: 'Filename',      defaultValue: 'session',       targetOptional: true, description: 'Begin video recording.' },
  { type: 'stopRecording',       label: 'stopRecording',    category: 'Device',      targetOptional: true, valueOptional: true,                              description: 'End video recording.' },
  { type: 'setLocation',         label: 'setLocation',      category: 'Device',      valueLabel: 'lat, lng',      defaultValue: '37.7749, -122.4194', targetOptional: true, description: 'Set GPS coordinates.' },
  { type: 'setAirplaneMode',     label: 'setAirplaneMode',  category: 'Device',      valueLabel: 'true / false',  defaultValue: 'true',          targetOptional: true, description: 'Force airplane mode on/off.' },
  { type: 'toggleAirplaneMode',  label: 'toggleAirplaneMode', category: 'Device',    targetOptional: true, valueOptional: true,                              description: 'Flip current airplane state.' },
  { type: 'setOrientation',      label: 'setOrientation',   category: 'Device',      valueLabel: 'Orientation',   defaultValue: 'PORTRAIT',      targetOptional: true, description: 'PORTRAIT / LANDSCAPE_LEFT / LANDSCAPE_RIGHT.' },
  { type: 'setPermissions',      label: 'setPermissions',   category: 'Device',      valueLabel: 'YAML block',    defaultValue: 'all: allow',    targetOptional: true, description: 'Grant/deny app permissions.' },
  { type: 'addMedia',            label: 'addMedia',         category: 'Device',      targetLabel: 'File path',    defaultTarget: './assets/photo.png',        description: 'Push media into device gallery.' },
  { type: 'travel',              label: 'travel',           category: 'Device',      valueLabel: 'Offset',        defaultValue: '+PT1H',         targetOptional: true, description: 'Shift device clock (ISO duration).' },

  // ─────────────── Flow control ───────────────
  { type: 'runFlow',             label: 'runFlow',          category: 'Flow',        targetLabel: 'Flow path',    defaultTarget: '../shared/login.yaml',      description: 'Run a subflow file.' },
  { type: 'runScript',           label: 'runScript',        category: 'Flow',        targetLabel: 'Script path',  defaultTarget: '../scripts/setup.js',       description: 'Run external JavaScript.' },
  { type: 'evalScript',          label: 'evalScript',       category: 'Flow',        valueLabel: 'Inline JS',     defaultValue: 'output.userId = 42',  targetOptional: true, description: 'Inline JS expression.' },
  { type: 'defineVariables',     label: 'defineVariables',  category: 'Flow',        valueLabel: 'YAML block',    defaultValue: 'foo: bar',      targetOptional: true, description: 'Set flow-scoped variables.' },
  { type: 'repeat',              label: 'repeat',           category: 'Flow',        valueLabel: 'Times',         defaultValue: '3',             targetOptional: true, description: 'Repeat next block N times (uses `commands:`).' },
  { type: 'retry',               label: 'retry',            category: 'Flow',        valueLabel: 'Max attempts',  defaultValue: '3',             targetOptional: true, description: 'Retry next block on failure.' },

  // ─────────────── Escape hatch ───────────────
  { type: 'custom',              label: 'Custom YAML',      category: 'Advanced',    valueLabel: 'Raw YAML',      defaultValue: '- scrollUntilVisible: "Continue"', targetOptional: true, description: 'Paste any Maestro YAML snippet as-is.' },
];

function App() {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [recordingStatus, setRecordingStatus] = useState<RecordingStatus>('idle');
  const [notification, setNotification] = useState<string>('');
  const [showNotification, setShowNotification] = useState(false);
  const [testSteps, setTestSteps] = useState<TestStep[]>([]);
  const [selectedElement, setSelectedElement] = useState<ElementInfo | null>(null);
  const [deviceScreenshot, setDeviceScreenshot] = useState<string>('');
  const [hierarchy, setHierarchy] = useState<ElementInfo[]>([]);
  const [flowName, setFlowName] = useState('my_test_flow');
  const [selectedDevice, setSelectedDevice] = useState('iOS Simulator');
  const [selectedAppId, setSelectedAppId] = useState(APP_ID_OPTIONS[0].value);
  const [isDetectingApp, setIsDetectingApp] = useState(false);
  const [previewZoom, setPreviewZoom] = useState<'fit' | '100' | '75'>('fit');
  const [selectedElementAction, setSelectedElementAction] = useState<RecorderStepType>('tap');
  const [selectedActionValue, setSelectedActionValue] = useState('');
  const [hierarchyRowActions, setHierarchyRowActions] = useState<Record<string, RecorderStepType>>({});
  const [hierarchyRowValues, setHierarchyRowValues] = useState<Record<string, string>>({});
  const [hierarchyFilter, setHierarchyFilter] = useState('');
  const [yamlPreviewOpen, setYamlPreviewOpen] = useState(false);
  const [yamlPreviewContent, setYamlPreviewContent] = useState('');
  // Recorder documentation dialog — content is fetched from the backend
  // (which reads the markdown from disk) so we don't need a hardcoded path
  // baked into the frontend bundle.
  const [docsOpen, setDocsOpen] = useState(false);
  const [docsContent, setDocsContent] = useState('');
  const [docsLoading, setDocsLoading] = useState(false);
  const [screenPreviewOpen, setScreenPreviewOpen] = useState(false);
  const [screenPreviewContent, setScreenPreviewContent] = useState('');
  const [screenPreviewData, setScreenPreviewData] = useState<{ elements: any[]; appId: string; flowName: string } | null>(null);
  const [hoveredElementId, setHoveredElementId] = useState<string | null>(null);
  const [stepHistory, setStepHistory] = useState<TestStep[][]>([]);
  const [a11yReport, setA11yReport] = useState<any>(null);
  const [a11yDialogOpen, setA11yDialogOpen] = useState(false);
  const [a11yHTMLReport, setA11yHTMLReport] = useState<string>('');
  const [pulseReport, setPulseReport] = useState<any>(null);
  const [pulseDialogOpen, setPulseDialogOpen] = useState(false);
  const [pulseHTMLReport, setPulseHTMLReport] = useState<string>('');
  const [stepFuture, setStepFuture] = useState<TestStep[][]>([]);
  const [stepStatuses, setStepStatuses] = useState<Record<number, StepExecutionStatus>>({});
  const [executionLogs, setExecutionLogs] = useState<ExecutionLogEntry[]>([]);
  const [selectedStepIds, setSelectedStepIds] = useState<number[]>([]);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [previewError, setPreviewError] = useState('');
  const [screenshotSize, setScreenshotSize] = useState<{ w: number; h: number } | null>(null);
  const [frameworkMatches, setFrameworkMatches] = useState<any[]>([]);
  const [frameworkIndexReady, setFrameworkIndexReady] = useState(false);
  const [frameworkIndexStats, setFrameworkIndexStats] = useState<{ subflowCount: number; flowCount: number; screenCount: number } | null>(null);
  const [frameworkGuidanceOpen, setFrameworkGuidanceOpen] = useState(true);
  const [frameworkMatchLoading, setFrameworkMatchLoading] = useState(false);
  const [stepFilter, setStepFilter] = useState('');
  const [expandedStepIds, setExpandedStepIds] = useState<number[]>([]);
  const [executionLogFilter, setExecutionLogFilter] = useState<ExecutionLogFilter>('all');
  const [showTypeSections, setShowTypeSections] = useState(true);
  const [draggedStepId, setDraggedStepId] = useState<number | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  // Anchor elements for the three consolidated split-button menus in the
  // Test Steps toolbar. Keeping them as refs to HTMLElement avoids a re-render
  // storm when the user hovers other controls.
  const [importMenuAnchor, setImportMenuAnchor] = useState<null | HTMLElement>(null);
  const [yamlMenuAnchor, setYamlMenuAnchor] = useState<null | HTMLElement>(null);
  const [groupMenuAnchor, setGroupMenuAnchor] = useState<null | HTMLElement>(null);
  const [moreMenuAnchor, setMoreMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedTemplateLabel, setSelectedTemplateLabel] = useState(STEP_TEMPLATES[0]?.label || '');
  const [selectedCommandType, setSelectedCommandType] = useState<RecorderStepType>('scrollUntilVisible');
  const [manualCommandTarget, setManualCommandTarget] = useState('Continue');
  const [manualCommandValue, setManualCommandValue] = useState('');
  const [leftPanelSplit, setLeftPanelSplit] = useState(0.56);
  const [isResizingLeftPanel, setIsResizingLeftPanel] = useState(false);
  const [leftColumnWidth, setLeftColumnWidth] = useState(35);
  const [middleColumnWidth, setMiddleColumnWidth] = useState(35);
  const [activeColumnDivider, setActiveColumnDivider] = useState<'left' | 'middle' | null>(null);
  const [classification, setClassification] = useState<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  // Hierarchy updates arrive faster than React can render (up to 4/sec during
  // recording). Coalesce them via requestAnimationFrame + hash dedupe so a
  // burst of identical trees costs one setState instead of four.
  const hierarchyRafRef = useRef<number | null>(null);
  const pendingHierarchyRef = useRef<ElementInfo[] | null>(null);
  const lastHierarchyHashRef = useRef<string>('');
  const yamlImportInputRef = useRef<HTMLInputElement | null>(null);
  const draftImportInputRef = useRef<HTMLInputElement | null>(null);
  const leftPanelRef = useRef<HTMLDivElement | null>(null);
  const mainContentRef = useRef<HTMLDivElement | null>(null);

  const showMessage = useCallback((message: string) => {
    setNotification(message);
    setShowNotification(true);
  }, []);

  const appendExecutionLog = useCallback((level: ExecutionLogEntry['level'], message: string, stepId?: number) => {
    setExecutionLogs((prev) => ([
      {
        id: Date.now() + Math.floor(Math.random() * 1000),
        level,
        message,
        timestamp: new Date(),
        stepId
      },
      ...prev
    ].slice(0, 40)));
  }, []);

  const getNextStepId = useCallback((steps: TestStep[]) => {
    return steps.reduce((max, step) => Math.max(max, step.id), 0) + 1;
  }, []);

  const cloneSteps = useCallback((steps: TestStep[]): TestStep[] => {
    return steps.map((step) => ({
      ...step,
      timestamp: new Date(step.timestamp)
    }));
  }, []);

  const serializeSteps = useCallback((steps: TestStep[]) => {
    return JSON.stringify(steps.map((step) => ({
      ...step,
      timestamp: new Date(step.timestamp).toISOString()
    })));
  }, []);

  const updateSteps = useCallback((updater: (prev: TestStep[]) => TestStep[], options?: { trackHistory?: boolean }) => {
    setTestSteps((prev) => {
      const next = updater(prev);
      const trackHistory = options?.trackHistory !== false;

      if (trackHistory && serializeSteps(prev) !== serializeSteps(next)) {
        setStepHistory((history) => [...history, cloneSteps(prev)]);
        setStepFuture([]);
      }

      return next;
    });
  }, [cloneSteps, serializeSteps]);

  const addTestStep = useCallback((action: any) => {
    updateSteps((prev) => {
      const newStep: TestStep = {
        id: getNextStepId(prev),
        type: (action.type || 'tap') as RecorderStepType,
        target: action.target || 'Unknown',
        value: action.value,
        selectorId: action.selectorId,
        bounds: action.bounds,
        group: action.group,
        timestamp: new Date()
      };
      return [...prev, newStep];
    });
  }, [getNextStepId, updateSteps]);

  const applyTemplate = useCallback((label: string) => {
    const template = STEP_TEMPLATES.find((item) => item.label === label);
    if (!template) return;
    addTestStep(template.step);
    showMessage(`✨ Added template: ${label}`);
  }, [addTestStep, showMessage]);

  const getDefaultActionForElement = useCallback((element: ElementInfo | null): RecorderStepType => {
    if (!element) return 'tap';
    if (element.type === 'textField') return 'input';
    if (element.type === 'label') return 'assertVisible';
    return 'tap';
  }, []);

  // Per-element action menu. Returns the *broadest* sensible set of Maestro
  // commands for the element's type so users don't have to drop into the
  // manual composer for common operations (waits, captures, AI checks).
  //
  // Kept in an ordered list rather than a Set so the dropdown groups
  // naturally: interactions first, then assertions, then waits/captures,
  // then advanced. The Select renders category headers by looking up each
  // entry in MAESTRO_COMMAND_OPTIONS at render time.
  const getAvailableActionsForElement = useCallback((element: ElementInfo | null): RecorderStepType[] => {
    if (!element) return ['tap'];

    // Shared commands every element benefits from — waits, assertions,
    // captures, AI helpers. Anything that operates *on this element*.
    const universal: RecorderStepType[] = [
      'assertVisible', 'assertNotVisible',
      'copyTextFrom',
      'extendedWaitUntil', 'scrollUntilVisible',
      'takeScreenshot',
      'assertWithAI', 'extractTextWithAI',
      'custom',
    ];

    if (element.type === 'textField') {
      // Input controls get the full text-editing surface.
      return [
        'tap', 'doubleTap', 'longPress',
        'input', 'eraseText', 'pasteText', 'setClipboard',
        ...universal,
      ];
    }

    if (element.type === 'label') {
      // Non-interactive labels: focus on assertions + capture, but still
      // expose tap in case the element becomes interactive later.
      return [
        'assertVisible', 'assertNotVisible',
        'tap',
        'copyTextFrom',
        'extendedWaitUntil', 'scrollUntilVisible',
        'takeScreenshot',
        'assertWithAI', 'extractTextWithAI',
        'custom',
      ];
    }

    // Buttons, cells, generic interactive elements.
    return [
      'tap', 'doubleTap', 'longPress',
      ...universal,
    ];
  }, []);

  const handleAddElementAction = useCallback((element: ElementInfo | null, actionType?: RecorderStepType, inputValueOverride?: string) => {
    if (!element) {
      showMessage('⚠️ Select an element first');
      return;
    }

    const action = actionType || selectedElementAction;
    const target = element.text || element.id;
    const rawValue = (inputValueOverride ?? selectedActionValue).trim();

    // Data-driven: any command with a valueLabel that isn't marked optional
    // requires a value from the row's TextField.
    const option = MAESTRO_COMMAND_OPTIONS.find((o) => o.type === action);
    const valueRequired = Boolean(option?.valueLabel && !option?.valueOptional);
    if (valueRequired && !rawValue) {
      showMessage(`⚠️ Enter ${option?.valueLabel} for ${option?.label || action}`);
      return;
    }

    // Only use selectorId if it's a real accessibility ID (not a generated element-X-Y ID)
    const isRealAccessibilityId = element.id && !element.id.startsWith('element-');
    const selectorId = isRealAccessibilityId ? element.id : undefined;

    // For actions that carry a value (input, extendedWaitUntil timeout,
    // assertWithAI text, setClipboard content, etc.) pass it through
    // verbatim. For commands that take *no* value (tap, doubleTap) drop it.
    const passValue = option?.valueLabel ? (rawValue || option.defaultValue || undefined) : undefined;

    addTestStep({
      type: action,
      target,
      value: passValue,
      selectorId: selectorId,
      bounds: element.bounds
    });

    // Clear the row's value input once the step is added — the same
    // TextField is reused for the next action, and stale text would carry
    // over silently.
    if (option?.valueLabel && inputValueOverride === undefined) {
      setSelectedActionValue('');
    }

    showMessage(`✅ Added ${action} for "${target}"`);
  }, [addTestStep, selectedActionValue, selectedElementAction, showMessage]);

  const getHierarchyRowAction = useCallback((element: ElementInfo): RecorderStepType => {
    return hierarchyRowActions[element.id] || getDefaultActionForElement(element);
  }, [getDefaultActionForElement, hierarchyRowActions]);

  const handleHierarchyRowActionChange = useCallback((element: ElementInfo, value: RecorderStepType) => {
    setHierarchyRowActions((prev) => ({
      ...prev,
      [element.id]: value
    }));
  }, []);

  const handleHierarchyRowValueChange = useCallback((element: ElementInfo, value: string) => {
    setHierarchyRowValues((prev) => ({
      ...prev,
      [element.id]: value
    }));
  }, []);

  const handleAddHierarchyRowAction = useCallback((element: ElementInfo) => {
    const action = getHierarchyRowAction(element);
    handleAddElementAction(element, action, hierarchyRowValues[element.id] || '');
  }, [getHierarchyRowAction, handleAddElementAction, hierarchyRowValues]);

  const getCommandOption = useCallback((type: RecorderStepType) => {
    return MAESTRO_COMMAND_OPTIONS.find((option) => option.type === type) || MAESTRO_COMMAND_OPTIONS[0];
  }, []);

  const buildStepYaml = useCallback((step: TestStep) => {
    // ── Selector helpers ───────────────────────────────────────────────
    // When an element has a resolved `selectorId`, prefer `id:` — it's the
    // most stable Maestro selector. Otherwise fall back to the text target.
    const selectorYaml = step.selectorId ? `\n    id: "${step.selectorId}"` : '';
    const inlineTarget = (v?: string) => `"${(v || '').replace(/"/g, '\\"')}"`;
    const indented = (body: string) => body.split('\n').map((l) => l ? `    ${l}` : l).join('\n');

    switch (step.type) {
      // ── Interaction ─────────────────────────────────────────────────
      case 'tap':
        return step.selectorId ? `- tapOn:${selectorYaml}\n` : `- tapOn: ${inlineTarget(step.target)}\n`;
      case 'doubleTap':
        return step.selectorId ? `- doubleTapOn:${selectorYaml}\n` : `- doubleTapOn: ${inlineTarget(step.target)}\n`;
      case 'longPress':
        return step.selectorId ? `- longPressOn:${selectorYaml}\n` : `- longPressOn: ${inlineTarget(step.target)}\n`;
      case 'input':
        return step.selectorId
          ? `- tapOn:${selectorYaml}\n- inputText: ${inlineTarget(step.value)}\n`
          : `- tapOn: ${inlineTarget(step.target)}\n- inputText: ${inlineTarget(step.value)}\n`;
      case 'eraseText':
        return step.value ? `- eraseText: ${step.value}\n` : '- eraseText\n';
      case 'copyTextFrom':
        return step.selectorId ? `- copyTextFrom:${selectorYaml}\n` : `- copyTextFrom: ${inlineTarget(step.target)}\n`;
      case 'pasteText':
        return '- pasteText\n';
      case 'setClipboard':
        return `- setClipboard: ${inlineTarget(step.value)}\n`;
      case 'swipe':
        return `- swipe:\n    direction: ${step.value || 'UP'}\n`;
      case 'scroll':
        // Maestro `scroll` is directionless by default; add direction only if provided.
        return step.value ? `- scroll:\n    direction: ${step.value}\n` : '- scroll\n';
      case 'scrollUntilVisible':
        return step.selectorId
          ? `- scrollUntilVisible:\n    element:${selectorYaml.replace(/\n\s+/, '\n      ')}\n`
          : `- scrollUntilVisible: ${inlineTarget(step.target)}\n`;
      case 'pressKey':
        return `- pressKey: ${inlineTarget(step.value || step.target || 'enter')}\n`;
      case 'hideKeyboard':
        return '- hideKeyboard\n';
      case 'back':
        return '- back\n';
      case 'openLink':
        return `- openLink: ${inlineTarget(step.value || step.target)}\n`;

      // ── Assertions ──────────────────────────────────────────────────
      case 'assertVisible':
        return step.selectorId ? `- assertVisible:${selectorYaml}\n` : `- assertVisible: ${inlineTarget(step.target)}\n`;
      case 'assertNotVisible':
        return step.selectorId ? `- assertNotVisible:${selectorYaml}\n` : `- assertNotVisible: ${inlineTarget(step.target)}\n`;
      case 'assertTrue':
        return `- assertTrue: ${inlineTarget(step.value)}\n`;
      case 'assertScreenshot':
        return `- assertScreenshot: ${inlineTarget(step.target)}\n`;
      case 'assertWithAI':
        return `- assertWithAI:\n    assertion: ${inlineTarget(step.value)}\n`;
      case 'assertNoDefectsWithAI':
        return '- assertNoDefectsWithAI\n';
      case 'extractTextWithAI':
        return `- extractTextWithAI:\n    query: ${inlineTarget(step.value)}\n`;

      // ── Waits ───────────────────────────────────────────────────────
      case 'wait':
        // waitForAnimationToEnd accepts an optional timeout (ms).
        return step.value
          ? `- waitForAnimationToEnd:\n    timeout: ${step.value}\n`
          : '- waitForAnimationToEnd\n';
      case 'extendedWaitUntil':
        return step.selectorId
          ? `- extendedWaitUntil:\n    visible:${selectorYaml.replace(/\n\s+/, '\n      ')}\n    timeout: ${step.value || 15000}\n`
          : `- extendedWaitUntil:\n    visible: ${inlineTarget(step.target)}\n    timeout: ${step.value || 15000}\n`;

      // ── App lifecycle ───────────────────────────────────────────────
      case 'launchApp':
        return step.target ? `- launchApp:\n    appId: ${inlineTarget(step.target)}\n` : '- launchApp\n';
      case 'stopApp':
        return step.target ? `- stopApp:\n    appId: ${inlineTarget(step.target)}\n` : '- stopApp\n';
      case 'killApp':
        return step.target ? `- killApp:\n    appId: ${inlineTarget(step.target)}\n` : '- killApp\n';
      case 'clearState':
        return step.target ? `- clearState:\n    appId: ${inlineTarget(step.target)}\n` : '- clearState\n';
      case 'clearKeychain':
        return '- clearKeychain\n';

      // ── Device state ────────────────────────────────────────────────
      case 'takeScreenshot':
        return step.value ? `- takeScreenshot: ${inlineTarget(step.value)}\n` : '- takeScreenshot\n';
      case 'startRecording':
        return step.value ? `- startRecording: ${inlineTarget(step.value)}\n` : '- startRecording\n';
      case 'stopRecording':
        return '- stopRecording\n';
      case 'setLocation': {
        // Accept "lat, lng" or a bare "lat,lng".
        const [lat, lng] = (step.value || '').split(',').map((s) => s.trim());
        return `- setLocation:\n    latitude: ${lat || 0}\n    longitude: ${lng || 0}\n`;
      }
      case 'setAirplaneMode':
        return `- setAirplaneMode: ${(step.value || 'true').toLowerCase()}\n`;
      case 'toggleAirplaneMode':
        return '- toggleAirplaneMode\n';
      case 'setOrientation':
        return `- setOrientation: ${step.value || 'PORTRAIT'}\n`;
      case 'setPermissions':
        // The value is a YAML sub-block — indent it under `permissions:`.
        return `- setPermissions:\n${indented(step.value || 'all: allow')}\n`;
      case 'addMedia':
        // Array-of-strings form supports one path today; extend later if
        // multi-file selection is added to the recorder UI.
        return `- addMedia:\n    - ${inlineTarget(step.target)}\n`;
      case 'travel':
        return `- travel: ${inlineTarget(step.value)}\n`;

      // ── Flow control ────────────────────────────────────────────────
      case 'runFlow':
        return `- runFlow: ${inlineTarget(step.target)}\n`;
      case 'runScript':
        return `- runScript: ${inlineTarget(step.target)}\n`;
      case 'evalScript':
        return `- evalScript: ${JSON.stringify(step.value || '')}\n`;
      case 'defineVariables':
        return `- defineVariables:\n${indented(step.value || '')}\n`;
      case 'repeat':
        // Emit a stub `commands:` block — the user can nest steps in it via
        // the raw YAML editor. Maestro rejects a `repeat:` without commands.
        return `- repeat:\n    times: ${step.value || 1}\n    commands:\n      # TODO: nested steps\n`;
      case 'retry':
        return `- retry:\n    maxRetries: ${step.value || 1}\n    commands:\n      # TODO: nested steps\n`;

      // ── Escape hatch ────────────────────────────────────────────────
      case 'custom': {
        const raw = (step.value || '').trim();
        return raw ? `${raw}${raw.endsWith('\n') ? '' : '\n'}` : '';
      }

      default:
        return '';
    }
  }, []);

  const resetManualCommandInputs = useCallback((type: RecorderStepType) => {
    const option = getCommandOption(type);
    setManualCommandTarget(option.defaultTarget || '');
    setManualCommandValue(option.defaultValue || '');
  }, [getCommandOption]);

  const handleManualCommandTypeChange = useCallback((type: RecorderStepType) => {
    setSelectedCommandType(type);
    resetManualCommandInputs(type);
  }, [resetManualCommandInputs]);

  const handleAddManualCommand = useCallback(() => {
    const option = getCommandOption(selectedCommandType);
    // App-lifecycle commands default to the currently-selected app id when the
    // user leaves the target blank — the intent is almost always "the app I
    // just picked from the dropdown".
    const appIdCommands: RecorderStepType[] = ['launchApp', 'stopApp', 'killApp', 'clearState'];
    const normalizedTarget = appIdCommands.includes(selectedCommandType)
      ? (manualCommandTarget.trim() || selectedAppId)
      : manualCommandTarget.trim();
    const normalizedValue = manualCommandValue.trim();

    // Data-driven validation using the option flags — new commands added to
    // MAESTRO_COMMAND_OPTIONS get sensible required-field checks for free.
    const targetRequired = option.targetLabel && !option.targetOptional;
    const valueRequired = option.valueLabel && !option.valueOptional;

    if (targetRequired && !normalizedTarget) {
      showMessage(`⚠️ Enter ${option.targetLabel} first`);
      return;
    }
    if (valueRequired && !normalizedValue) {
      showMessage(`⚠️ Enter ${option.valueLabel} first`);
      return;
    }

    addTestStep({
      type: selectedCommandType,
      target: normalizedTarget || option.label,
      value: normalizedValue || undefined,
      group: 'Manual Commands'
    });

    showMessage(`➕ Added ${option.label}`);
  }, [addTestStep, getCommandOption, manualCommandTarget, manualCommandValue, selectedAppId, selectedCommandType, showMessage]);

  const generateYamlPreview = useCallback(() => {
    let yaml = `appId: ${selectedAppId}\nname: ${flowName}\ntags:\n  - recorded\n---\n`;
    testSteps.forEach(step => {
      yaml += buildStepYaml(step);
    });
    return yaml;
  }, [buildStepYaml, flowName, selectedAppId, testSteps]);

  const handleDeleteStep = useCallback((stepId: number) => {
    updateSteps((prev) => prev.filter((step) => step.id !== stepId));
    setSelectedStepIds((prev) => prev.filter((id) => id !== stepId));
    setStepStatuses((prev) => {
      const next = { ...prev };
      delete next[stepId];
      return next;
    });
    showMessage('🗑️ Step removed');
  }, [showMessage, updateSteps]);

  const moveStep = useCallback((stepId: number, direction: 'up' | 'down') => {
    updateSteps((prev) => {
      const currentIndex = prev.findIndex((step) => step.id === stepId);
      if (currentIndex === -1) return prev;

      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;

      const next = [...prev];
      const [item] = next.splice(currentIndex, 1);
      next.splice(targetIndex, 0, item);
      return next;
    });
  }, [updateSteps]);

  const updateStep = useCallback((stepId: number, patch: Partial<TestStep>) => {
    updateSteps((prev) => prev.map((step) => {
      if (step.id !== stepId) return step;
      return {
        ...step,
        ...patch
      };
    }));
  }, [updateSteps]);

  const handleUndo = useCallback(() => {
    if (stepHistory.length === 0) return;

    const previous = stepHistory[stepHistory.length - 1];
    setStepHistory((history) => history.slice(0, -1));
    setStepFuture((future) => [cloneSteps(testSteps), ...future]);
    setTestSteps(cloneSteps(previous));
    setSelectedStepIds([]);
    setStepStatuses({});
  }, [cloneSteps, stepHistory, testSteps]);

  const handleRedo = useCallback(() => {
    if (stepFuture.length === 0) return;

    const [next, ...rest] = stepFuture;
    setStepFuture(rest);
    setStepHistory((history) => [...history, cloneSteps(testSteps)]);
    setTestSteps(cloneSteps(next));
    setSelectedStepIds([]);
    setStepStatuses({});
  }, [cloneSteps, stepFuture, testSteps]);

  const handleDuplicateStep = useCallback((step: TestStep) => {
    updateSteps((prev) => {
      const duplicate: TestStep = {
        ...step,
        id: getNextStepId(prev),
        timestamp: new Date()
      };
      const index = prev.findIndex((item) => item.id === step.id);
      if (index === -1) return [...prev, duplicate];
      const next = [...prev];
      next.splice(index + 1, 0, duplicate);
      return next;
    });
    showMessage('🧬 Step duplicated');
  }, [getNextStepId, showMessage, updateSteps]);

  const handleToggleStepSelection = useCallback((stepId: number) => {
    setSelectedStepIds((prev) => prev.includes(stepId) ? prev.filter((id) => id !== stepId) : [...prev, stepId]);
  }, []);

  const handleSelectAllSteps = useCallback(() => {
    setSelectedStepIds((prev) => prev.length === testSteps.length ? [] : testSteps.map((step) => step.id));
  }, [testSteps]);

  const handleDeleteSelectedSteps = useCallback(() => {
    if (selectedStepIds.length === 0) return;
    const ids = new Set(selectedStepIds);
    updateSteps((prev) => prev.filter((step) => !ids.has(step.id)));
    setSelectedStepIds([]);
    setStepStatuses((prev) => {
      const next = { ...prev };
      selectedStepIds.forEach((id) => delete next[id]);
      return next;
    });
    showMessage(`🗑️ Deleted ${selectedStepIds.length} selected step${selectedStepIds.length === 1 ? '' : 's'}`);
  }, [selectedStepIds, showMessage, updateSteps]);

  const handleDuplicateSelectedSteps = useCallback(() => {
    if (selectedStepIds.length === 0) return;

    const ids = new Set(selectedStepIds);
    updateSteps((prev) => {
      const duplicates = prev
        .filter((step) => ids.has(step.id))
        .map((step, index) => ({
          ...step,
          id: getNextStepId(prev) + index,
          timestamp: new Date()
        }));
      return [...prev, ...duplicates];
    });
    showMessage(`🧬 Duplicated ${selectedStepIds.length} selected step${selectedStepIds.length === 1 ? '' : 's'}`);
  }, [getNextStepId, selectedStepIds, showMessage, updateSteps]);

  const handleAssignGroupToSelected = useCallback(() => {
    const group = newGroupName.trim();
    if (!group || selectedStepIds.length === 0) return;
    const ids = new Set(selectedStepIds);
    updateSteps((prev) => prev.map((step) => ids.has(step.id) ? { ...step, group } : step));
    setNewGroupName('');
    showMessage(`🗂️ Assigned group "${group}" to ${selectedStepIds.length} step${selectedStepIds.length === 1 ? '' : 's'}`);
  }, [newGroupName, selectedStepIds, showMessage, updateSteps]);

  const handleClearGroupForSelected = useCallback(() => {
    if (selectedStepIds.length === 0) return;
    const ids = new Set(selectedStepIds);
    updateSteps((prev) => prev.map((step) => ids.has(step.id) ? { ...step, group: undefined } : step));
    showMessage(`🧹 Cleared group for ${selectedStepIds.length} selected step${selectedStepIds.length === 1 ? '' : 's'}`);
  }, [selectedStepIds, showMessage, updateSteps]);

  const handleSaveDraft = useCallback(() => {
    const draft = {
      flowName,
      selectedDevice,
      selectedAppId,
      testSteps: testSteps.map((step) => ({
        ...step,
        timestamp: step.timestamp.toISOString()
      }))
    };
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${flowName || 'recorded_flow'}-draft.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showMessage('💾 Draft saved to file');
  }, [flowName, selectedAppId, selectedDevice, showMessage, testSteps]);

  const restoreDraft = useCallback((raw: string) => {
    try {
      const parsed = JSON.parse(raw);
      setFlowName(parsed.flowName || 'my_test_flow');
      setSelectedDevice(parsed.selectedDevice || 'iOS Simulator');
      setSelectedAppId(parsed.selectedAppId || APP_ID_OPTIONS[0].value);
      setTestSteps((parsed.testSteps || []).map((step: any) => ({
        ...step,
        timestamp: new Date(step.timestamp)
      })));
      setStepHistory([]);
      setStepFuture([]);
      setSelectedStepIds([]);
      setStepStatuses({});
      setExpandedStepIds([]);
      showMessage('📂 Draft loaded');
    } catch {
      showMessage('❌ Failed to load draft');
    }
  }, [showMessage]);

  useEffect(() => {
    const draft = {
      flowName,
      selectedDevice,
      selectedAppId,
      testSteps: testSteps.map((step) => ({
        ...step,
        timestamp: step.timestamp.toISOString()
      }))
    };
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
  }, [flowName, selectedAppId, selectedDevice, testSteps]);

  useEffect(() => {
    if (selectedCommandType === 'launchApp' || selectedCommandType === 'stopApp') {
      setManualCommandTarget(selectedAppId);
    }
  }, [selectedAppId, selectedCommandType]);

  useEffect(() => {
    const storedSplit = window.localStorage.getItem('maestro-recorder-left-panel-split');
    if (!storedSplit) return;
    const parsed = Number(storedSplit);
    if (!Number.isNaN(parsed) && parsed >= 0.25 && parsed <= 0.8) {
      setLeftPanelSplit(parsed);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem('maestro-recorder-left-panel-split', String(leftPanelSplit));
  }, [leftPanelSplit]);

  useEffect(() => {
    const storedLeftWidth = window.localStorage.getItem('maestro-recorder-left-column-width');
    const storedMiddleWidth = window.localStorage.getItem('maestro-recorder-middle-column-width');

    const parsedLeft = Number(storedLeftWidth);
    const parsedMiddle = Number(storedMiddleWidth);

    if (!Number.isNaN(parsedLeft) && parsedLeft >= 22 && parsedLeft <= 55) {
      setLeftColumnWidth(parsedLeft);
    }

    if (!Number.isNaN(parsedMiddle) && parsedMiddle >= 22 && parsedMiddle <= 50) {
      setMiddleColumnWidth(parsedMiddle);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem('maestro-recorder-left-column-width', String(leftColumnWidth));
  }, [leftColumnWidth]);

  useEffect(() => {
    window.localStorage.setItem('maestro-recorder-middle-column-width', String(middleColumnWidth));
  }, [middleColumnWidth]);

  useEffect(() => {
    if (!isResizingLeftPanel) return;

    const handlePointerMove = (event: MouseEvent) => {
      if (!leftPanelRef.current) return;
      const rect = leftPanelRef.current.getBoundingClientRect();
      if (!rect.height) return;
      const nextSplit = (event.clientY - rect.top) / rect.height;
      setLeftPanelSplit(Math.min(0.8, Math.max(0.25, nextSplit)));
    };

    const stopResizing = () => setIsResizingLeftPanel(false);

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', stopResizing);

    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [isResizingLeftPanel]);

  useEffect(() => {
    if (!activeColumnDivider) return;

    const handlePointerMove = (event: MouseEvent) => {
      if (!mainContentRef.current) return;
      const rect = mainContentRef.current.getBoundingClientRect();
      if (!rect.width) return;

      const pointerRatio = ((event.clientX - rect.left) / rect.width) * 100;

      if (activeColumnDivider === 'left') {
        const nextLeft = Math.min(55, Math.max(22, pointerRatio));
        const maxMiddle = 78 - nextLeft;
        setLeftColumnWidth(nextLeft);
        setMiddleColumnWidth((prev) => Math.min(Math.max(prev, 22), maxMiddle));
        return;
      }

      const nextMiddle = Math.min(50, Math.max(22, pointerRatio - leftColumnWidth));
      const maxMiddle = 78 - leftColumnWidth;
      setMiddleColumnWidth(Math.min(nextMiddle, maxMiddle));
    };

    const stopResizing = () => setActiveColumnDivider(null);

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', stopResizing);

    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [activeColumnDivider, leftColumnWidth]);

  const resetColumnWidths = useCallback(() => {
    setLeftColumnWidth(35);
    setMiddleColumnWidth(35);
    showMessage('↔️ Layout reset');
  }, [showMessage]);

  const handleLoadDraft = useCallback(() => {
    draftImportInputRef.current?.click();
  }, []);

  const handleLoadLocalDraft = useCallback(() => {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) {
      showMessage('⚠️ No saved draft found');
      return;
    }

    restoreDraft(raw);
  }, [restoreDraft, showMessage]);

  const parseYamlScalar = useCallback((line: string): string => {
    const raw = line.split(':').slice(1).join(':').trim();
    return raw.replace(/^"|"$/g, '');
  }, []);

  const parseYamlToSteps = useCallback((yaml: string): TestStep[] => {
    const lines = yaml.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const steps: TestStep[] = [];
    let inferredGroup = '';

    const parseSelectorId = (line: string) => line.split('id:').slice(1).join('id:').trim().replace(/^"|"$/g, '');

    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      if (line.startsWith('name:')) {
        continue;
      }

      if (line.startsWith('#')) {
        inferredGroup = line.replace(/^#+/, '').trim();
        continue;
      }

      if (!line.startsWith('-')) continue;

      if (line.startsWith('- tapOn:')) {
        const selectorLine = lines[index + 1] || '';
        const selectorId = line === '- tapOn:' && selectorLine.startsWith('id:') ? parseSelectorId(selectorLine) : undefined;
        const target = selectorId || parseYamlScalar(line);
        const inputLine = selectorId ? (lines[index + 2] || '') : selectorLine;
        if (inputLine.startsWith('- inputText:')) {
          steps.push({
            id: steps.length + 1,
            type: 'input',
            target,
            value: parseYamlScalar(inputLine),
            selectorId,
            bounds: undefined,
            group: inferredGroup || undefined,
            timestamp: new Date()
          });
          index += selectorId ? 2 : 1;
        } else {
          steps.push({ id: steps.length + 1, type: 'tap', target, selectorId, bounds: undefined, group: inferredGroup || undefined, timestamp: new Date() });
          if (selectorId) {
            index += 1;
          }
        }
        continue;
      }

      if (line.startsWith('- assertVisible:')) {
        const nextLine = lines[index + 1] || '';
        const selectorId = line === '- assertVisible:' && nextLine.startsWith('id:') ? parseSelectorId(nextLine) : undefined;
        steps.push({ id: steps.length + 1, type: 'assertVisible', target: selectorId || parseYamlScalar(line), selectorId, bounds: undefined, group: inferredGroup || undefined, timestamp: new Date() });
        if (selectorId) {
          index += 1;
        }
        continue;
      }

      if (line.startsWith('- assertNotVisible:')) {
        const nextLine = lines[index + 1] || '';
        const selectorId = line === '- assertNotVisible:' && nextLine.startsWith('id:') ? parseSelectorId(nextLine) : undefined;
        steps.push({ id: steps.length + 1, type: 'assertNotVisible', target: selectorId || parseYamlScalar(line), selectorId, bounds: undefined, group: inferredGroup || undefined, timestamp: new Date() });
        if (selectorId) {
          index += 1;
        }
        continue;
      }

      if (line.startsWith('- longPressOn:')) {
        const nextLine = lines[index + 1] || '';
        const selectorId = line === '- longPressOn:' && nextLine.startsWith('id:') ? parseSelectorId(nextLine) : undefined;
        steps.push({ id: steps.length + 1, type: 'longPress', target: selectorId || parseYamlScalar(line), selectorId, bounds: undefined, group: inferredGroup || undefined, timestamp: new Date() });
        if (selectorId) {
          index += 1;
        }
        continue;
      }

      if (line.startsWith('- swipe:')) {
        const directionLine = lines[index + 1] || '';
        const direction = directionLine.includes('direction:') ? directionLine.split('direction:')[1].trim() : 'UP';
        steps.push({ id: steps.length + 1, type: 'swipe', target: 'screen', value: direction, group: inferredGroup || undefined, timestamp: new Date() });
        if (directionLine.includes('direction:')) {
          index += 1;
        }
        continue;
      }

      if (line.startsWith('- waitForAnimationToEnd')) {
        steps.push({ id: steps.length + 1, type: 'wait', target: 'animation', value: '1000', group: inferredGroup || undefined, timestamp: new Date() });
        continue;
      }

      if (line.startsWith('- scrollUntilVisible:')) {
        const nextLine = lines[index + 1] || '';
        const selectorId = line === '- scrollUntilVisible:' && nextLine.startsWith('id:') ? parseSelectorId(nextLine) : undefined;
        steps.push({ id: steps.length + 1, type: 'scrollUntilVisible', target: selectorId || parseYamlScalar(line), selectorId, bounds: undefined, group: inferredGroup || undefined, timestamp: new Date() });
        if (selectorId) {
          index += 1;
        }
        continue;
      }

      if (line.startsWith('- scroll')) {
        const directionLine = lines[index + 1] || '';
        const direction = directionLine.includes('direction:') ? directionLine.split('direction:')[1].trim() : 'DOWN';
        steps.push({ id: steps.length + 1, type: 'scroll', target: 'screen', value: direction, group: inferredGroup || undefined, timestamp: new Date() });
        if (directionLine.includes('direction:')) {
          index += 1;
        }
        continue;
      }

      if (line.startsWith('- hideKeyboard')) {
        steps.push({ id: steps.length + 1, type: 'hideKeyboard', target: 'keyboard', group: inferredGroup || undefined, timestamp: new Date() });
        continue;
      }

      if (line.startsWith('- back')) {
        steps.push({ id: steps.length + 1, type: 'back', target: 'navigation', group: inferredGroup || undefined, timestamp: new Date() });
        continue;
      }

      if (line.startsWith('- pressKey:')) {
        steps.push({ id: steps.length + 1, type: 'pressKey', target: 'keyboard', value: parseYamlScalar(line), group: inferredGroup || undefined, timestamp: new Date() });
        continue;
      }

      if (line.startsWith('- launchApp')) {
        const appIdLine = lines[index + 1] || '';
        const appId = appIdLine.includes('appId:') ? appIdLine.split('appId:')[1].trim().replace(/^"|"$/g, '') : selectedAppId;
        steps.push({ id: steps.length + 1, type: 'launchApp', target: appId, group: inferredGroup || undefined, timestamp: new Date() });
        if (appIdLine.includes('appId:')) {
          index += 1;
        }
        continue;
      }

      if (line.startsWith('- stopApp')) {
        const appIdLine = lines[index + 1] || '';
        const appId = appIdLine.includes('appId:') ? appIdLine.split('appId:')[1].trim().replace(/^"|"$/g, '') : selectedAppId;
        steps.push({ id: steps.length + 1, type: 'stopApp', target: appId, group: inferredGroup || undefined, timestamp: new Date() });
        if (appIdLine.includes('appId:')) {
          index += 1;
        }
        continue;
      }

      // ── Fallback for commands the granular parser doesn't yet handle ───
      // Instead of silently dropping unrecognized `- someCommand: ...` lines,
      // preserve them as `custom` steps so the round-trip export/import
      // remains lossless for Maestro's full 40+ command surface (doubleTapOn,
      // copyTextFrom, setLocation, addMedia, etc.). Any trailing indented
      // block lines belong to this command — pull them in until we hit the
      // next top-level `- ` or the end of file.
      if (line.startsWith('- ')) {
        const block: string[] = [line];
        let peek = index + 1;
        while (peek < lines.length && !lines[peek].startsWith('- ')) {
          block.push('  ' + lines[peek]);
          peek++;
        }
        steps.push({
          id: steps.length + 1,
          type: 'custom',
          target: 'custom',
          value: block.join('\n'),
          group: inferredGroup || undefined,
          timestamp: new Date(),
        });
        index = peek - 1;
        continue;
      }
    }

    return steps;
  }, [parseYamlScalar, selectedAppId]);

  const handleImportYaml = useCallback(() => {
    yamlImportInputRef.current?.click();
  }, []);

  const handleYamlImportFile = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const content = await file.text();
      const importedSteps = parseYamlToSteps(content);
      if (importedSteps.length === 0) {
        showMessage('⚠️ No supported Maestro steps found in YAML');
      } else {
        setTestSteps(importedSteps);
        setStepHistory([]);
        setStepFuture([]);
        setSelectedStepIds([]);
        setStepStatuses({});
        setExpandedStepIds([]);
        showMessage(`📥 Imported ${importedSteps.length} step${importedSteps.length === 1 ? '' : 's'} from YAML`);
      }
    } catch {
      showMessage('❌ Failed to import YAML');
    } finally {
      event.target.value = '';
    }
  }, [parseYamlToSteps, showMessage]);

  const handleDraftImportFile = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      restoreDraft(await file.text());
    } catch {
      showMessage('❌ Failed to load draft file');
    } finally {
      event.target.value = '';
    }
  }, [restoreDraft, showMessage]);

  const handleDownloadYAML = useCallback(() => {
    if (testSteps.length === 0) {
      showMessage('⚠️ No test steps to download');
      return;
    }

    const yaml = generateYamlPreview();
    const blob = new Blob([yaml], { type: 'text/yaml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${flowName || 'recorded_flow'}.yaml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showMessage('⬇️ YAML downloaded');
  }, [flowName, generateYamlPreview, showMessage, testSteps.length]);

  const toggleStepExpanded = useCallback((stepId: number) => {
    setExpandedStepIds((prev) => prev.includes(stepId) ? prev.filter((id) => id !== stepId) : [...prev, stepId]);
  }, []);

  const handleExecuteStep = useCallback((step: TestStep) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'execute-step',
        appId: selectedAppId,
        step
      }));
      showMessage(`▶️ Executing ${step.type} on "${step.target}"...`);
    }
  }, [selectedAppId, showMessage]);

  const handlePlayAllSteps = useCallback(() => {
    if (testSteps.length === 0) {
      showMessage('⚠️ No steps to execute');
      return;
    }

    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      showMessage('❌ WebSocket not connected');
      return;
    }

    setStepStatuses((prev) => {
      const next = { ...prev };
      testSteps.forEach((step) => {
        next[step.id] = 'running';
      });
      return next;
    });

    wsRef.current.send(JSON.stringify({
      type: 'execute-all-steps',
      appId: selectedAppId,
      steps: testSteps
    }));

    showMessage(`▶️ Executing ${testSteps.length} steps (fast mode)...`);
  }, [testSteps, selectedAppId, showMessage]);

  const getStepValueLabel = useCallback((type: RecorderStepType) => {
    switch (type) {
      case 'input': return 'Input value';
      case 'swipe': return 'Direction';
      case 'wait': return 'Duration (ms)';
      case 'scroll': return 'Direction';
      case 'pressKey': return 'Key';
      default: return 'Value';
    }
  }, []);

  const copyYamlToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(yamlPreviewContent);
      showMessage('📋 YAML copied to clipboard');
    } catch {
      showMessage('❌ Failed to copy YAML');
    }
  }, [yamlPreviewContent, showMessage]);

  const filteredHierarchy = hierarchy.filter((element) => {
    const query = hierarchyFilter.trim().toLowerCase();
    if (!query) return true;
    return [element.text, element.id, element.type].some((value) => value.toLowerCase().includes(query));
  });

  const filteredTestSteps = testSteps.filter((step) => {
    const query = stepFilter.trim().toLowerCase();
    if (!query) return true;
    return [step.type, step.target, step.value || '', step.selectorId || '', step.group || ''].some((value) => value.toLowerCase().includes(query));
  });

  const filteredExecutionLogs = executionLogs.filter((entry) => executionLogFilter === 'all' ? true : entry.level === executionLogFilter);

  const getSectionLabel = useCallback((step: TestStep) => {
    return step.group?.trim() || step.type.toUpperCase();
  }, []);

  const handleDragStart = useCallback((stepId: number) => {
    setDraggedStepId(stepId);
  }, []);

  const commandComposerOption = getCommandOption(selectedCommandType);

  // Show target / value fields based on the selected command's declared
  // shape. Hides fields the command doesn't use, so the composer never asks
  // for e.g. a "target" on `hideKeyboard`.
  const shouldShowManualTarget = Boolean(commandComposerOption.targetLabel);
  const shouldShowManualValue = Boolean(commandComposerOption.valueLabel);

  const handleDropOnStep = useCallback((targetStepId: number) => {
    if (draggedStepId == null || draggedStepId === targetStepId) {
      setDraggedStepId(null);
      return;
    }

    updateSteps((prev) => {
      const fromIndex = prev.findIndex((step) => step.id === draggedStepId);
      const toIndex = prev.findIndex((step) => step.id === targetStepId);
      if (fromIndex === -1 || toIndex === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });

    setDraggedStepId(null);
    showMessage('↕️ Step reordered');
  }, [draggedStepId, showMessage, updateSteps]);

  useEffect(() => {
    setSelectedElementAction(getDefaultActionForElement(selectedElement));
    setSelectedActionValue('');
  }, [selectedElement, getDefaultActionForElement]);

  // Fast content hash matching the backend's hashHierarchy() — used to skip
  // setState when a broadcast carries the same tree we already rendered.
  // Cheap enough to compute inline on every message (500 elements ≈ 0.2 ms).
  const cheapHash = useCallback((els: ElementInfo[] | undefined): string => {
    if (!els || els.length === 0) return '0';
    let h = 5381 | 0;
    for (const el of els) {
      const s = `${el.type}|${el.text}|${el.bounds}|${el.clickable ? 1 : 0}`;
      for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) | 0;
    }
    return String(h);
  }, []);

  // rAF-batched hierarchy setter: absorbs bursts of identical broadcasts into
  // a single render, aligned with the browser's paint clock.
  const scheduleHierarchyUpdate = useCallback((next: ElementInfo[], serverHash?: string) => {
    const hash = serverHash || cheapHash(next);
    if (hash === lastHierarchyHashRef.current) return;
    lastHierarchyHashRef.current = hash;
    pendingHierarchyRef.current = next;
    if (hierarchyRafRef.current !== null) return;
    hierarchyRafRef.current = requestAnimationFrame(() => {
      hierarchyRafRef.current = null;
      const pending = pendingHierarchyRef.current;
      pendingHierarchyRef.current = null;
      if (pending) setHierarchy(pending);
    });
  }, [cheapHash]);

  const handleBackendMessage = useCallback((data: any) => {
    switch (data.type) {
      case 'recording-started':
        setRecordingStatus('recording');
        showMessage('🎬 Recording started! Interact with your device.');
        break;
      
      case 'recording-stopped':
        setRecordingStatus('idle');
        showMessage(`⏹️ Recording stopped. ${data.actionCount || 0} actions captured.`);
        break;
      
      case 'action-captured':
        addTestStep(data.action);
        showMessage(`✅ Captured: ${data.action.type} on "${data.action.target}"`);
        break;
      
      case 'screenshot-updated':
        setDeviceScreenshot(data.screenshot);
        setPreviewLoading(false);
        setPreviewError(data.screenshot ? '' : 'Screenshot was empty');
        break;
      
      case 'hierarchy-updated':
        scheduleHierarchyUpdate(data.hierarchy || [], data.hash);
        break;

      case 'device-switched':
        setDeviceScreenshot(data.screenshot);
        // Force a re-render on device switch even if hash matches (the tree
        // belongs to a different device now).
        lastHierarchyHashRef.current = '';
        scheduleHierarchyUpdate(data.hierarchy || []);
        setPreviewLoading(false);
        showMessage(`✅ ${data.message}`);
        break;
      
      case 'device-switch-failed':
        showMessage(`❌ ${data.message}`);
        break;
      
      case 'accessibility-report':
        setA11yReport(data.report);
        setA11yHTMLReport(data.htmlReport || '');
        setA11yDialogOpen(true);
        showMessage(`♿ ${data.message}`);
        break;
      
      case 'accessibility-validation-failed':
        showMessage(`❌ ${data.message}`);
        break;

      case 'pulse-report':
        setPulseReport(data.report);
        setPulseHTMLReport(data.htmlReport || '');
        setPulseDialogOpen(true);
        showMessage(`🎨 ${data.message}`);
        break;

      case 'pulse-validation-failed':
        showMessage(`❌ ${data.message}`);
        break;

      case 'app-detected':
        setSelectedAppId(data.bundleId);
        setIsDetectingApp(false);
        showMessage(`📱 Auto-detected: ${data.displayName} [${data.bundleId}]`);
        break;

      case 'app-detect-failed':
        setIsDetectingApp(false);
        break;
      
      case 'classification-result':
        setClassification(data.classification);
        showMessage(`🔍 Classified as ${data.classification.type} (${data.classification.confidence}% confidence)`);
        break;
      
      case 'classification-failed':
        showMessage(`❌ Classification failed: ${data.message}`);
        break;

      case 'flow-exported':
        appendExecutionLog('success', data.message);
        showMessage(`💾 ${data.message}`);
        break;

      case 'step-executed':
        if (data?.step?.id != null) {
          setStepStatuses((prev) => ({ ...prev, [data.step.id]: 'success' }));
        }
        appendExecutionLog('success', data.message, data?.step?.id);
        showMessage(`✅ ${data.message}`);
        break;

      case 'step-execution-started':
        if (data?.step?.id != null) {
          setStepStatuses((prev) => ({ ...prev, [data.step.id]: 'running' }));
        }
        appendExecutionLog('info', data.message, data?.step?.id);
        showMessage(`▶️ ${data.message}`);
        break;

      case 'step-execution-failed':
        if (data?.step?.id != null) {
          setStepStatuses((prev) => ({ ...prev, [data.step.id]: 'error' }));
        }
        appendExecutionLog('error', data.message, data?.step?.id);
        showMessage(`❌ ${data.message}`);
        break;

      case 'play-all-started':
        appendExecutionLog('info', data.message);
        showMessage(`▶️ ${data.message}`);
        break;

      case 'play-all-completed':
        appendExecutionLog('success', data.message);
        showMessage(`✅ ${data.message}`);
        break;

      case 'play-all-failed':
        appendExecutionLog('error', data.message);
        showMessage(`❌ ${data.message}`);
        break;
      
      case 'error':
        if (typeof data.message === 'string' && /screenshot/i.test(data.message)) {
          setPreviewLoading(false);
          setPreviewError(data.message);
        }
        appendExecutionLog('error', data.message);
        showMessage(`❌ Error: ${data.message}`);
        break;
      
      default:
        console.log('Unknown message:', data.type);
    }
  }, [addTestStep, appendExecutionLog, showMessage, scheduleHierarchyUpdate]);

  const parseBounds = useCallback((bounds: string): ParsedBounds | null => {
    if (!bounds) return null;

    const csv = bounds.match(/^(\d+),(\d+),(\d+),(\d+)$/);
    if (csv) {
      return {
        x1: Number(csv[1]),
        y1: Number(csv[2]),
        x2: Number(csv[3]),
        y2: Number(csv[4])
      };
    }

    const bracket = bounds.match(/^\[(\d+),(\d+)\]\[(\d+),(\d+)\]$/);
    if (bracket) {
      return {
        x1: Number(bracket[1]),
        y1: Number(bracket[2]),
        x2: Number(bracket[3]),
        y2: Number(bracket[4])
      };
    }

    return null;
  }, []);

  // Derive logical screen dimensions from screenshot natural pixel size.
  // xcrun simctl screenshots are at device scale (2× or 3×); Maestro hierarchy
  // bounds are always in logical points (1×). Uses the same pixelWidth heuristic
  // as server.ts getScreenScaleFactor() so the two stay in sync.
  const CONTAINER_ASPECT = 9 / 19.5;
  const _displayScale = screenshotSize
    ? screenshotSize.w > 1000 ? 3 : screenshotSize.w > 700 ? 2 : 1
    : 3;
  const screenW = screenshotSize ? screenshotSize.w / _displayScale : 390;
  const screenH = screenshotSize ? screenshotSize.h / _displayScale : 844;
  const _imageAspect = screenshotSize ? screenshotSize.w / screenshotSize.h : CONTAINER_ASPECT;

  // Letterbox/pillarbox fractions for objectFit:'contain' overlay mapping.
  const _imgWiderThanContainer = _imageAspect > CONTAINER_ASPECT;
  const imgWidthFrac  = _imgWiderThanContainer ? 1 : _imageAspect / CONTAINER_ASPECT;
  const imgHeightFrac = _imgWiderThanContainer ? CONTAINER_ASPECT / _imageAspect : 1;
  const imgOffsetX    = _imgWiderThanContainer ? 0 : (1 - imgWidthFrac) / 2;
  const imgOffsetY    = _imgWiderThanContainer ? (1 - imgHeightFrac) / 2 : 0;

  const selectedElementBounds = selectedElement ? parseBounds(selectedElement.bounds) : null;
  const hoveredElement = hoveredElementId ? hierarchy.find((element) => element.id === hoveredElementId) || null : null;
  const hoveredElementBounds = hoveredElement ? parseBounds(hoveredElement.bounds) : null;

  const handleDevicePreviewTap = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (hierarchy.length === 0) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) {
      return;
    }

    const parsedElements = hierarchy
      .map((el) => ({ el, bounds: parseBounds(el.bounds) }))
      .filter((item): item is { el: ElementInfo; bounds: ParsedBounds } => Boolean(item.bounds));

    if (parsedElements.length === 0) {
      showMessage('⚠️ No valid element bounds available for tap capture');
      return;
    }

    // Inverse of the overlay mapping: container-fraction → image-fraction → hierarchy point.
    // imgWidthFrac/imgHeightFrac and imgOffsetX/Y account for letterbox/pillarbox from objectFit:contain.
    const containerFracX = (event.clientX - rect.left) / rect.width;
    const containerFracY = (event.clientY - rect.top) / rect.height;
    const imageFracX = imgWidthFrac > 0 ? (containerFracX - imgOffsetX) / imgWidthFrac : containerFracX;
    const imageFracY = imgHeightFrac > 0 ? (containerFracY - imgOffsetY) / imgHeightFrac : containerFracY;
    const tapX = Math.max(0, Math.min(screenW, imageFracX * screenW));
    const tapY = Math.max(0, Math.min(screenH, imageFracY * screenH));

    const candidates = parsedElements
      .filter(({ bounds }) => tapX >= bounds.x1 && tapX <= bounds.x2 && tapY >= bounds.y1 && tapY <= bounds.y2)
      .sort((a, b) => {
        const areaA = (a.bounds.x2 - a.bounds.x1) * (a.bounds.y2 - a.bounds.y1);
        const areaB = (b.bounds.x2 - b.bounds.x1) * (b.bounds.y2 - b.bounds.y1);
        return areaA - areaB;
      });

    if (candidates.length === 0) {
      showMessage('⚠️ No tappable element found at that location');
      return;
    }

    const picked = candidates[0].el;
    setSelectedElement(picked);

    const target = picked.text || picked.id;
    handleAddElementAction(picked, 'tap');
    showMessage(`✅ Captured tap on "${target}"`);
  }, [hierarchy, parseBounds, handleAddElementAction, showMessage, screenW, screenH, imgWidthFrac, imgHeightFrac, imgOffsetX, imgOffsetY]);

  // Poll framework index status once on mount, then mark ready
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch('http://localhost:3001/api/framework');
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (data.ready) {
          setFrameworkIndexReady(true);
          setFrameworkIndexStats({ subflowCount: data.subflowCount, flowCount: data.flowCount, screenCount: data.screenCount });
        } else {
          // Index still building — retry after 2s
          setTimeout(poll, 2000);
        }
      } catch { /* backend not up yet */ }
    };
    poll();
    return () => { cancelled = true; };
  }, []);

  // Debounced framework match — fires 600ms after testSteps last changed
  useEffect(() => {
    if (!frameworkIndexReady || testSteps.length === 0) {
      setFrameworkMatches([]);
      return;
    }
    setFrameworkMatchLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('http://localhost:3001/api/framework/match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ steps: testSteps }),
        });
        if (!res.ok) return;
        const data = await res.json();
        setFrameworkMatches(data.matches ?? []);
      } catch { /* ignore */ } finally {
        setFrameworkMatchLoading(false);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [testSteps, frameworkIndexReady]);

  // WebSocket connection
  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimer: NodeJS.Timeout;

    const connect = () => {
      setConnectionStatus('connecting');
      
      try {
        ws = new WebSocket('ws://localhost:3001');
        wsRef.current = ws;

        ws.onopen = () => {
          console.log('🟢 WebSocket connected');
          setConnectionStatus('connected');
          setPreviewLoading(true);
          setPreviewError('');
          showMessage('✅ Connected to backend - Ready to record!');
          
          // Request initial device state
          ws.send(JSON.stringify({ type: 'get-devices' }));
          ws.send(JSON.stringify({ type: 'refresh-screenshot' }));
          ws.send(JSON.stringify({ type: 'detect-app' }));
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            handleBackendMessage(data);
          } catch (err) {
            console.error('Failed to parse message:', err);
          }
        };

        ws.onerror = (error) => {
          console.error('❌ WebSocket error:', error);
          setConnectionStatus('error');
        };

        ws.onclose = () => {
          console.log('🔴 WebSocket disconnected');
          setConnectionStatus('disconnected');
          
          reconnectTimer = setTimeout(() => {
            console.log('🔄 Attempting to reconnect...');
            connect();
          }, 3000);
        };
      } catch (err) {
        console.error('Failed to create WebSocket:', err);
        setConnectionStatus('error');
      }
    };

    connect();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) ws.close();
      if (hierarchyRafRef.current !== null) {
        cancelAnimationFrame(hierarchyRafRef.current);
        hierarchyRafRef.current = null;
      }
    };
  }, [handleBackendMessage, showMessage]);

  /* const handleStartRecording = () => {
    if (connectionStatus !== 'connected') {
      showMessage('⚠️ Not connected to backend. Please wait...');
      return;
    }

    if (recordingStatus === 'recording') {
      // Stop recording
      setRecordingStatus('stopping');
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ 
          type: 'stop-recording',
          timestamp: new Date().toISOString()
        }));
      }
    } else {
      // Start recording
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ 
          type: 'start-recording',
          device: selectedDevice,
          appId: selectedAppId,
          timestamp: new Date().toISOString()
        }));
      }
    }
  }; */

  const getStepStatusColor = (status: StepExecutionStatus): 'default' | 'warning' | 'success' | 'error' => {
    switch (status) {
      case 'running': return 'warning';
      case 'success': return 'success';
      case 'error': return 'error';
      default: return 'default';
    }
  };

  const handleRefreshDevice = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      setPreviewLoading(true);
      setPreviewError('');
      wsRef.current.send(JSON.stringify({ type: 'refresh-screenshot' }));
      showMessage('🔄 Refreshing device view...');
    }
  };

  const handleTakeScreenshot = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      setPreviewLoading(true);
      setPreviewError('');
      wsRef.current.send(JSON.stringify({ type: 'take-screenshot' }));
      showMessage('📸 Taking screenshot...');
    }
  };

  const handleSaveFlow = () => {
    if (testSteps.length === 0) {
      showMessage('⚠️ No test steps to save');
      return;
    }
    
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ 
        type: 'export-flow',
        flowName: flowName,
        appId: selectedAppId,
        steps: testSteps
      }));
      showMessage(`💾 Exporting flow: ${flowName}.yaml`);
    }
  };

  const handleViewYAML = () => {
    if (testSteps.length === 0) {
      showMessage('⚠️ No test steps to preview');
      return;
    }

    // Trigger auto-classification
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'classify-steps',
        steps: testSteps,
        currentScreen: flowName,
        devicePlatform: selectedDevice
      }));
    }

    setYamlPreviewContent(generateYamlPreview());
    setYamlPreviewOpen(true);
  };

  const handleClearSteps = useCallback(() => {
    updateSteps(() => []);
    setSelectedStepIds([]);
    setStepStatuses({});
    showMessage('🗑️ All steps cleared');
  }, [showMessage, updateSteps]);

  const handleGenerateScreen = useCallback(async () => {
    let elementsToGenerate: Array<{ text: string; type: string; selectorId?: string }> = [];

    // Mode 1: Generate from selected steps
    if (selectedStepIds.length > 0) {
      const selectedSteps = testSteps.filter((step) => selectedStepIds.includes(step.id));
      const uniqueElements = new Map<string, { text: string; type: string; selectorId?: string }>();

      selectedSteps.forEach((step) => {
        if (step.target) {
          const key = step.selectorId || step.target;
          if (!uniqueElements.has(key)) {
            uniqueElements.set(key, {
              text: step.target,
              type: step.type,
              selectorId: step.selectorId
            });
          }
        }
      });

      elementsToGenerate = Array.from(uniqueElements.values());
    } 
    // Mode 2: Generate from current device hierarchy
    else if (hierarchy.length > 0) {
      elementsToGenerate = hierarchy
        .filter((el) => el.text && el.text.trim())
        .map((el) => {
          // Only use selectorId if it's a real accessibility ID (not a generated element-X-Y ID)
          const isRealAccessibilityId = el.id && !el.id.startsWith('element-');
          return {
            text: el.text,
            type: el.type === 'textField' ? 'input' : el.clickable ? 'tap' : 'assertVisible',
            selectorId: isRealAccessibilityId ? el.id : undefined
          };
        });
    } else {
      showMessage('⚠️ Select steps or load device screen to generate screen file');
      return;
    }

    if (elementsToGenerate.length === 0) {
      showMessage('⚠️ No valid elements found');
      return;
    }

    try {
      const response = await fetch('http://localhost:3001/api/generate-screen-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          elements: elementsToGenerate,
          appId: selectedAppId,
          flowName: flowName || 'recorded_flow'
        })
      });

      const result = await response.json();
      if (result.success) {
        setScreenPreviewContent(result.content);
        setScreenPreviewData({
          elements: elementsToGenerate,
          appId: selectedAppId,
          flowName: flowName || 'recorded_flow'
        });
        setScreenPreviewOpen(true);
      } else {
        showMessage(`❌ Failed to generate preview: ${result.error}`);
      }
    } catch (error) {
      showMessage('❌ Error generating screen preview');
      console.error('Generate screen error:', error);
    }
  }, [selectedStepIds, testSteps, hierarchy, selectedAppId, flowName, showMessage]);

  const handleConfirmScreenGeneration = useCallback(async () => {
    if (!screenPreviewData) return;

    try {
      const response = await fetch('http://localhost:3001/api/generate-screen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(screenPreviewData)
      });

      const result = await response.json();
      if (result.success) {
        showMessage(`✅ Screen file saved: ${result.filename}`);
        setScreenPreviewOpen(false);
      } else {
        showMessage(`❌ Failed to save screen: ${result.error}`);
      }
    } catch (error) {
      showMessage('❌ Error saving screen file');
      console.error('Save screen error:', error);
    }
  }, [screenPreviewData, showMessage]);

  /* const handlePlayback = () => {
    if (testSteps.length === 0) {
      showMessage('⚠️ No test steps to playback');
      return;
    }
    
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ 
        type: 'playback',
        appId: selectedAppId,
        steps: testSteps
      }));
      showMessage('▶️ Starting playback...');
    }
  }; */

  const getStepIcon = (type: string) => {
    switch (type) {
      case 'tap': return '👆';
      case 'input': return '⌨️';
      case 'assertVisible': return '✅';
      case 'assertNotVisible': return '🙈';
      case 'longPress': return '🫱';
      case 'swipe': return '👈';
      case 'wait': return '⏱️';
      case 'scroll': return '🧭';
      case 'scrollUntilVisible': return '🔎';
      case 'hideKeyboard': return '⌨️';
      case 'back': return '↩️';
      case 'pressKey': return '🔤';
      case 'launchApp': return '🚀';
      case 'stopApp': return '🛑';
      case 'custom': return '🧩';
      default: return '📍';
    }
  };

  const getConnectionColor = () => {
    switch (connectionStatus) {
      case 'connected': return 'success';
      case 'connecting': return 'warning';
      case 'error': return 'error';
      default: return 'default';
    }
  };

  const getConnectionLabel = () => {
    switch (connectionStatus) {
      case 'connected': return 'Connected';
      case 'connecting': return 'Connecting...';
      case 'error': return 'Connection Error';
      default: return 'Disconnected';
    }
  };

  const getElementTypeChipColor = (type: string): 'default' | 'primary' | 'secondary' | 'success' | 'warning' => {
    switch (type) {
      case 'button': return 'primary';
      case 'textField': return 'success';
      case 'link': return 'secondary';
      case 'label': return 'default';
      default: return 'warning';
    }
  };

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      
      {/* Top AppBar */}
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar>
          <Typography variant="h6" sx={{ flexGrow: 0, mr: 3, fontWeight: 'bold', color: '#22d3ee' }}>
            🎬 Maestro Flow Recorder
          </Typography>
          
          <FormControl size="small" sx={{ minWidth: 180, mr: 2 }}>
            <InputLabel>Device</InputLabel>
            <Select
              value={selectedDevice}
              label="Device"
              onChange={(e) => {
                const newDevice = e.target.value;
                setSelectedDevice(newDevice);
                
                // Notify backend to switch device
                if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                  wsRef.current.send(JSON.stringify({
                    type: 'switch-device',
                    device: newDevice
                  }));
                  showMessage(`🔄 Switching to ${newDevice}...`);
                }
              }}
              disabled={recordingStatus === 'recording'}
            >
              <MenuItem value="iOS Simulator"><AppleIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'text-bottom' }} /> iOS Simulator</MenuItem>
              <MenuItem value="Android Emulator"><AndroidIcon sx={{ fontSize: 16, mr: 0.5, verticalAlign: 'text-bottom' }} /> Android Emulator</MenuItem>
            </Select>
          </FormControl>

          <Box sx={{ display: 'flex', alignItems: 'center', mr: 2 }}>
            <FormControl size="small" sx={{ minWidth: 280 }}>
              <InputLabel>App ID</InputLabel>
              <Select
                value={selectedAppId}
                label="App ID"
                onChange={(e) => setSelectedAppId(e.target.value)}
                disabled={recordingStatus === 'recording'}
              >
                {APP_ID_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>{`${option.label} [${option.value}]`}</MenuItem>
                ))}
                {!APP_ID_OPTIONS.find(o => o.value === selectedAppId) && (
                  <MenuItem value={selectedAppId}>{`Auto-detected [${selectedAppId}]`}</MenuItem>
                )}
              </Select>
            </FormControl>
            <Tooltip title="Auto-detect running app from simulator">
              <span>
                <IconButton
                  size="small"
                  disabled={recordingStatus === 'recording' || isDetectingApp}
                  onClick={() => {
                    if (wsRef.current?.readyState === WebSocket.OPEN) {
                      setIsDetectingApp(true);
                      wsRef.current.send(JSON.stringify({ type: 'detect-app' }));
                    }
                  }}
                  sx={{ ml: 0.5, color: '#a78bfa' }}
                >
                  {isDetectingApp
                    ? <CircularProgress size={16} sx={{ color: '#a78bfa' }} />
                    : <GpsFixedIcon sx={{ fontSize: 18 }} />}
                </IconButton>
              </span>
            </Tooltip>
          </Box>

          <TextField
            size="small"
            label="Flow Name"
            value={flowName}
            onChange={(e) => setFlowName(e.target.value)}
            disabled={recordingStatus === 'recording'}
            sx={{ minWidth: 200, mr: 2 }}
          />

          <Box sx={{ flexGrow: 1 }} />

          {/* {recordingStatus === 'recording' && (
            <Chip 
              label="RECORDING" 
              color="error"
              icon={<FiberManualRecordIcon />}
              sx={{ 
                mr: 2,
                animation: 'pulse 1.5s ease-in-out infinite',
                '@keyframes pulse': {
                  '0%, 100%': { opacity: 1 },
                  '50%': { opacity: 0.6 },
                }
              }}
            />
          )} */}

          <Chip 
            label={getConnectionLabel()} 
            color={getConnectionColor()}
            size="small"
            icon={connectionStatus === 'connecting' ? <CircularProgress size={16} /> : undefined}
          />
        </Toolbar>
      </AppBar>

      {/* Main Content - 3 Column Layout */}
      <Box ref={mainContentRef} sx={{ display: 'flex', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>
        
        {/* Left Panel - Device Preview */}
        <Paper
          ref={leftPanelRef}
          sx={{
            width: `${leftColumnWidth}%`,
            p: 2,
            borderRadius: 0,
            overflow: 'hidden',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5
          }}
        >
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6"><SmartphoneIcon sx={{ fontSize: 20, mr: 0.5, verticalAlign: 'text-bottom' }} /> Device Preview</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <ButtonGroup size="small" variant="outlined" aria-label="device preview zoom">
                {(['fit', '100', '75'] as const).map((zoom) => (
                  <Button
                    key={zoom}
                    onClick={() => setPreviewZoom(zoom)}
                    sx={{
                      minWidth: 44,
                      px: 1,
                      fontSize: '0.7rem',
                      bgcolor: previewZoom === zoom ? 'primary.main' : 'transparent',
                      color: previewZoom === zoom ? '#fff' : 'text.primary',
                      '&:hover': {
                        bgcolor: previewZoom === zoom ? 'primary.dark' : 'action.hover'
                      }
                    }}
                  >
                    {zoom === 'fit' ? 'Fit' : `${zoom}%`}
                  </Button>
                ))}
              </ButtonGroup>
              <Tooltip title="Take Screenshot">
                <IconButton size="small" onClick={handleTakeScreenshot}>
                  <CameraAltIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Refresh View">
                <IconButton size="small" onClick={handleRefreshDevice}>
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          {previewError && (
            <Alert severity="warning" sx={{ mb: 1 }}>
              {previewError}
            </Alert>
          )}

          {/* Device Screen */}
          <Box sx={{ flex: `0 0 ${Math.round(leftPanelSplit * 100)}%`, minHeight: 120, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            <Box
              sx={{
                aspectRatio: '9/19.5',
                height: previewZoom === '75' ? '75%' : '100%',
                width: previewZoom === '100' ? '100%' : 'auto',
                maxHeight: '100%',
                maxWidth: previewZoom === 'fit' ? '100%' : `${previewZoom}%`,
                minWidth: 0,
                minHeight: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Paper
                elevation={3}
                onClick={handleDevicePreviewTap}
                sx={{
                  bgcolor: '#000',
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  overflow: 'hidden',
                  cursor: recordingStatus === 'recording' ? 'crosshair' : 'default'
                }}
              >
              {deviceScreenshot ? (
                <>
                  <img
                    src={deviceScreenshot}
                    alt="Device"
                    style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                    onLoad={(e) => {
                      const img = e.target as HTMLImageElement;
                      setScreenshotSize({ w: img.naturalWidth, h: img.naturalHeight });
                    }}
                  />
                  {hoveredElementBounds && screenW > 0 && screenH > 0 && (
                    <Box
                      sx={{
                        position: 'absolute',
                        left: `${(imgOffsetX + (hoveredElementBounds.x1 / screenW) * imgWidthFrac) * 100}%`,
                        top: `${(imgOffsetY + (hoveredElementBounds.y1 / screenH) * imgHeightFrac) * 100}%`,
                        width: `${((hoveredElementBounds.x2 - hoveredElementBounds.x1) / screenW * imgWidthFrac) * 100}%`,
                        height: `${((hoveredElementBounds.y2 - hoveredElementBounds.y1) / screenH * imgHeightFrac) * 100}%`,
                        border: '2px solid #FFD54F',
                        backgroundColor: 'rgba(255, 213, 79, 0.16)',
                        pointerEvents: 'none',
                        borderRadius: '6px'
                      }}
                    />
                  )}
                  {selectedElementBounds && screenW > 0 && screenH > 0 && (
                    <Box
                      sx={{
                        position: 'absolute',
                        left: `${(imgOffsetX + (selectedElementBounds.x1 / screenW) * imgWidthFrac) * 100}%`,
                        top: `${(imgOffsetY + (selectedElementBounds.y1 / screenH) * imgHeightFrac) * 100}%`,
                        width: `${((selectedElementBounds.x2 - selectedElementBounds.x1) / screenW * imgWidthFrac) * 100}%`,
                        height: `${((selectedElementBounds.y2 - selectedElementBounds.y1) / screenH * imgHeightFrac) * 100}%`,
                        border: '2px solid #22d3ee',
                        boxShadow: '0 0 0 9999px rgba(34, 211, 238, 0.10)',
                        pointerEvents: 'none',
                        borderRadius: '6px'
                      }}
                    />
                  )}
                  {previewLoading && (
                    <Box
                      sx={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        bgcolor: 'rgba(0,0,0,0.45)',
                        zIndex: 2
                      }}
                    >
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                        <CircularProgress size={28} />
                        <Typography variant="caption">Loading device preview...</Typography>
                      </Box>
                    </Box>
                  )}
                </>
              ) : (
                previewLoading ? (
                  <Box sx={{ textAlign: 'center', color: '#666' }}>
                    <CircularProgress size={28} sx={{ mb: 1 }} />
                    <Typography variant="body2">Loading device preview...</Typography>
                  </Box>
                ) : (
                  <Box sx={{ textAlign: 'center', color: '#666' }}>
                    <SmartphoneIcon sx={{ fontSize: 64, mb: 1 }} />
                    <Typography variant="body2">
                      {recordingStatus === 'recording' 
                        ? 'Waiting for device...' 
                        : 'Start recording to view device'}
                    </Typography>
                  </Box>
                )
              )}
              </Paper>
            </Box>
          </Box>

          <Box
            onMouseDown={(event) => {
              event.preventDefault();
              setIsResizingLeftPanel(true);
            }}
            sx={{
              flex: '0 0 14px',
              mx: -1,
              my: 0.25,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'row-resize',
              userSelect: 'none',
              touchAction: 'none'
            }}
          >
            <Box
              sx={{
                width: '100%',
                height: 4,
                borderRadius: 999,
                bgcolor: isResizingLeftPanel ? 'primary.main' : '#444',
                transition: 'background-color 0.15s ease'
              }}
            />
          </Box>

          {/* Element Hierarchy */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
              🔍 Element Hierarchy ({filteredHierarchy.length})
            </Typography>
            <Box>
              <Tooltip title="Validate Pulse design system (disabled)">
                <span>
                  <IconButton
                    size="small"
                    disabled
                    sx={{ color: '#22d3ee', mr: 0.5, opacity: 0.4 }}
                  >
                    <span style={{ fontSize: '16px' }}>🎨</span>
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Validate accessibility">
                <IconButton
                  size="small"
                  onClick={() => {
                    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                      wsRef.current.send(JSON.stringify({ type: 'validate-accessibility' }));
                      showMessage('♿ Running accessibility validation...');
                    }
                  }}
                  sx={{ color: '#2196F3', mr: 0.5 }}
                >
                  <span style={{ fontSize: '16px' }}>♿</span>
                </IconButton>
              </Tooltip>
              <Tooltip title="Refresh hierarchy">
                <IconButton
                  size="small"
                  onClick={() => {
                    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                      wsRef.current.send(JSON.stringify({ type: 'get-hierarchy' }));
                      showMessage('🔄 Refreshing hierarchy...');
                    }
                  }}
                  sx={{ color: '#4CAF50' }}
                >
                  <RefreshIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
          <TextField
            size="small"
            placeholder="Filter by text, id, or type"
            value={hierarchyFilter}
            onChange={(event) => setHierarchyFilter(event.target.value)}
            sx={{ flex: '0 0 auto', mb: 1 }}
            fullWidth
          />
          <Paper elevation={2} sx={{ flex: '1 1 0', minHeight: 0, overflow: 'auto', bgcolor: '#1a1a1a' }}>
            <List dense>
              {filteredHierarchy.length === 0 ? (
                <ListItem>
                  <ListItemText 
                    primary={hierarchy.length === 0 ? 'No elements' : 'No matches'} 
                    secondary={hierarchy.length === 0 ? 'Refresh to scan UI hierarchy' : 'Try a different filter'}
                    primaryTypographyProps={{ color: 'text.secondary' }}
                  />
                </ListItem>
              ) : (
                filteredHierarchy.map((el, idx) => (
                  <ListItem 
                    key={idx} 
                    button 
                    onClick={() => setSelectedElement(el)}
                    onMouseEnter={() => setHoveredElementId(el.id)}
                    onMouseLeave={() => setHoveredElementId((current) => current === el.id ? null : current)}
                    selected={selectedElement?.id === el.id}
                    sx={{ alignItems: 'flex-start' }}
                  >
                    <Box sx={{ width: '100%' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
                        <Chip size="small" label={el.type} color={getElementTypeChipColor(el.type)} />
                        {el.clickable && <Chip size="small" label="clickable" variant="outlined" />}
                        {el.focused && <Chip size="small" label="focused" color="warning" variant="outlined" />}
                      </Box>
                      <ListItemText 
                        primary={el.text || el.id}
                        secondary={`${el.type} • ${el.bounds}`}
                        primaryTypographyProps={{ fontSize: '0.85rem' }}
                        secondaryTypographyProps={{ fontSize: '0.7rem' }}
                      />

                      {(() => {
                        // Per-row action editor. Derived once per render so the
                        // JSX below stays tight; picks the current action's
                        // catalog entry to decide (a) whether to show a value
                        // field and (b) what to label / placeholder it with.
                        const rowAction = getHierarchyRowAction(el);
                        const rowOption = MAESTRO_COMMAND_OPTIONS.find((o) => o.type === rowAction);
                        const rowNeedsValue = Boolean(rowOption?.valueLabel);
                        const availableActions = getAvailableActionsForElement(el);
                        // Group the row's actions by category using the same
                        // ordered set as the manual composer, so the dropdown
                        // reads as: Interaction → Assertion → Wait → Device
                        // → AI → Advanced.
                        const groupedActions = (['Interaction', 'Assertion', 'Wait', 'App', 'Device', 'Flow', 'AI', 'Advanced'] as CommandCategory[])
                          .map((cat) => ({
                            cat,
                            items: availableActions
                              .map((a) => MAESTRO_COMMAND_OPTIONS.find((o) => o.type === a))
                              .filter((o): o is MaestroCommandOption => Boolean(o) && o!.category === cat),
                          }))
                          .filter((g) => g.items.length > 0);
                        return (
                          <Box
                            sx={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 1, mt: 1 }}
                            onClick={(event) => event.stopPropagation()}
                          >
                            <Box sx={{ display: 'grid', gap: 1 }}>
                              <FormControl size="small" fullWidth>
                                <Select
                                  value={rowAction}
                                  onChange={(event) => handleHierarchyRowActionChange(el, event.target.value as RecorderStepType)}
                                  displayEmpty
                                  MenuProps={{ PaperProps: { sx: { maxHeight: 420 } } }}
                                >
                                  {groupedActions.flatMap(({ cat, items }) => [
                                    <ListSubheader
                                      key={`hdr-${el.id}-${cat}`}
                                      sx={{ bgcolor: 'transparent', color: 'primary.main', fontWeight: 700, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', lineHeight: '24px' }}
                                    >
                                      {cat}
                                    </ListSubheader>,
                                    ...items.map((option) => (
                                      <MenuItem key={`${el.id}-${option.type}`} value={option.type} sx={{ pl: 3 }}>
                                        {option.label}
                                      </MenuItem>
                                    )),
                                  ])}
                                </Select>
                              </FormControl>

                              {rowNeedsValue && (
                                <TextField
                                  size="small"
                                  label={rowOption?.valueLabel}
                                  placeholder={rowOption?.defaultValue || ''}
                                  value={hierarchyRowValues[el.id] || ''}
                                  onChange={(event) => handleHierarchyRowValueChange(el, event.target.value)}
                                  fullWidth
                                  // The `custom` step's value is raw YAML;
                                  // give it multiline room like the composer.
                                  multiline={rowAction === 'custom'}
                                  minRows={rowAction === 'custom' ? 2 : undefined}
                                  helperText={rowOption?.description}
                                  FormHelperTextProps={{ sx: { mx: 0, fontSize: 10, opacity: 0.6 } }}
                                />
                              )}
                            </Box>

                            <Button
                              variant="outlined"
                              size="small"
                              onClick={() => handleAddHierarchyRowAction(el)}
                              sx={{ alignSelf: 'start', minWidth: 56 }}
                            >
                              Add
                            </Button>
                          </Box>
                        );
                      })()}
                    </Box>
                  </ListItem>
                ))
              )}
            </List>
          </Paper>

          {/* ── Framework Guidance Panel ─────────────────────────────────── */}
          <Paper
            elevation={2}
            sx={{
              flex: '0 0 auto',
              maxHeight: frameworkGuidanceOpen ? 280 : 36,
              overflow: 'hidden',
              transition: 'max-height 0.25s ease',
              bgcolor: '#161b22',
              border: '1px solid #30363d',
              borderRadius: 1,
            }}
          >
            {/* Header row */}
            <Box
              onClick={() => setFrameworkGuidanceOpen(o => !o)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                px: 1.5,
                py: 0.75,
                cursor: 'pointer',
                userSelect: 'none',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.04)' },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#e6edf3', letterSpacing: 0.4 }}>
                  FRAMEWORK GUIDANCE
                </Typography>
                {frameworkIndexReady && frameworkIndexStats && (
                  <Chip
                    label={`${frameworkIndexStats.subflowCount} subflows`}
                    size="small"
                    sx={{ height: 16, fontSize: 10, bgcolor: '#21262d', color: '#8b949e' }}
                  />
                )}
                {frameworkMatchLoading && <CircularProgress size={10} sx={{ color: '#58a6ff' }} />}
                {!frameworkIndexReady && (
                  <Chip label="indexing…" size="small" sx={{ height: 16, fontSize: 10, bgcolor: '#21262d', color: '#8b949e' }} />
                )}
              </Box>
              <Typography sx={{ color: '#8b949e', fontSize: 14, lineHeight: 1 }}>
                {frameworkGuidanceOpen ? '▲' : '▼'}
              </Typography>
            </Box>

            {/* Body */}
            <Box sx={{ px: 1.5, pb: 1, maxHeight: 244, overflowY: 'auto' }}>
              {/* Classification badge */}
              {classification && (
                <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 1 }}>
                  <Chip
                    label={classification.type === 'flow' ? 'Flow' : 'Subflow'}
                    size="small"
                    color={classification.type === 'flow' ? 'primary' : 'secondary'}
                    sx={{ height: 18, fontSize: 11, fontWeight: 'bold' }}
                  />
                  <Chip
                    label={`${classification.confidence}% confidence`}
                    size="small"
                    variant="outlined"
                    sx={{ height: 18, fontSize: 10 }}
                  />
                  <Chip
                    label={`Save to: .maestro/${classification.type}s/${classification.category}/`}
                    size="small"
                    variant="outlined"
                    sx={{ height: 18, fontSize: 10, maxWidth: '100%' }}
                  />
                </Box>
              )}

              {/* Matching subflows */}
              {frameworkMatches.length === 0 && frameworkIndexReady && testSteps.length > 0 && !frameworkMatchLoading && (
                <Typography variant="caption" sx={{ color: '#6e7681', display: 'block', py: 0.5 }}>
                  No close matches found — this looks like new functionality.
                </Typography>
              )}
              {frameworkMatches.length === 0 && testSteps.length === 0 && (
                <Typography variant="caption" sx={{ color: '#6e7681', display: 'block', py: 0.5 }}>
                  Add steps to see matching subflows from the framework.
                </Typography>
              )}
              {frameworkMatches.map((m: any, i: number) => (
                <Box
                  key={i}
                  sx={{
                    mb: 0.75,
                    p: 1,
                    borderRadius: 1,
                    bgcolor: '#21262d',
                    border: `1px solid ${i === 0 ? '#388bfd40' : '#30363d'}`,
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 0.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
                      <Chip
                        label={`${m.score}%`}
                        size="small"
                        sx={{
                          height: 18,
                          fontSize: 10,
                          fontWeight: 'bold',
                          bgcolor: m.score >= 60 ? '#1a4a1f' : m.score >= 35 ? '#3d2700' : '#21262d',
                          color: m.score >= 60 ? '#3fb950' : m.score >= 35 ? '#d29922' : '#8b949e',
                          border: '1px solid',
                          borderColor: m.score >= 60 ? '#3fb95040' : 'transparent',
                          flexShrink: 0,
                        }}
                      />
                      <Typography
                        variant="caption"
                        sx={{ fontWeight: 'bold', color: '#e6edf3', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      >
                        {m.name}
                      </Typography>
                    </Box>
                    <Tooltip title={`Copy: ${m.runFlowYaml}`}>
                      <IconButton
                        size="small"
                        sx={{ p: 0.25, color: '#58a6ff', flexShrink: 0 }}
                        onClick={() => {
                          navigator.clipboard.writeText(m.runFlowYaml);
                          showMessage(`✅ Copied runFlow snippet for ${m.name}`);
                        }}
                      >
                        <ContentCopyIcon sx={{ fontSize: 12 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                  <Typography variant="caption" sx={{ color: '#8b949e', display: 'block', mt: 0.25 }}>
                    {m.domain} · {m.stepCount} steps · {m.reason}
                  </Typography>
                </Box>
              ))}
            </Box>
          </Paper>
          {/* ── end Framework Guidance Panel ─────────────────────────────── */}

        </Paper>

        <Box
          onMouseDown={(event) => {
            event.preventDefault();
            setActiveColumnDivider('left');
          }}
          onDoubleClick={resetColumnWidths}
          sx={{
            width: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'col-resize',
            bgcolor: activeColumnDivider === 'left' ? 'rgba(204,0,0,0.12)' : 'transparent',
            '&:hover .divider-line': {
              bgcolor: 'primary.main'
            }
          }}
        >
          <Box className="divider-line" sx={{ width: 4, height: '92%', borderRadius: 999, bgcolor: '#444', transition: 'background-color 0.15s ease' }} />
        </Box>

        {/* Middle Panel - Test Steps */}
        <Paper
          sx={{
            width: `${middleColumnWidth}%`,
            p: 2,
            borderRadius: 0,
            borderLeft: '1px solid #333',
            borderRight: '1px solid #333',
            overflow: 'hidden',
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* ── Header row: title + selection actions + overflow menu ─────── */}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 1 }}>
            <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PlaylistPlayIcon fontSize="small" />
              Test Steps
              <Typography component="span" variant="body2" sx={{ opacity: 0.6, ml: 0.5 }}>
                ({filteredTestSteps.length})
              </Typography>
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Tooltip title={selectedStepIds.length === testSteps.length && testSteps.length > 0 ? 'Clear selection' : 'Select all'}>
                <span>
                  <IconButton size="small" onClick={handleSelectAllSteps} disabled={filteredTestSteps.length === 0}>
                    <Checkbox
                      size="small"
                      checked={selectedStepIds.length === testSteps.length && testSteps.length > 0}
                      indeterminate={selectedStepIds.length > 0 && selectedStepIds.length < testSteps.length}
                      sx={{ p: 0 }}
                    />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Duplicate selected">
                <span>
                  <IconButton size="small" onClick={handleDuplicateSelectedSteps} disabled={selectedStepIds.length === 0}>
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Delete selected">
                <span>
                  <IconButton size="small" onClick={handleDeleteSelectedSteps} disabled={selectedStepIds.length === 0}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Undo">
                <span>
                  <IconButton size="small" onClick={handleUndo} disabled={stepHistory.length === 0}>
                    <UndoIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Redo">
                <span>
                  <IconButton size="small" onClick={handleRedo} disabled={stepFuture.length === 0}>
                    <RedoIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="More">
                <IconButton size="small" onClick={(e) => setMoreMenuAnchor(e.currentTarget)}>
                  <MoreVertIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Menu
                anchorEl={moreMenuAnchor}
                open={Boolean(moreMenuAnchor)}
                onClose={() => setMoreMenuAnchor(null)}
              >
                <MenuItem
                  onClick={() => { setShowTypeSections((prev) => !prev); setMoreMenuAnchor(null); }}
                  disabled={filteredTestSteps.length === 0}
                >
                  <ViewAgendaIcon fontSize="small" sx={{ mr: 1 }} />
                  {showTypeSections ? 'Hide sections' : 'Show sections'}
                </MenuItem>
                <MenuItem
                  onClick={() => { handleClearSteps(); setMoreMenuAnchor(null); }}
                  disabled={testSteps.length === 0}
                >
                  <ClearAllIcon fontSize="small" sx={{ mr: 1 }} />
                  Clear all steps
                </MenuItem>
                <MenuItem
                  onClick={() => { handleGenerateScreen(); setMoreMenuAnchor(null); }}
                >
                  <DescriptionIcon fontSize="small" sx={{ mr: 1 }} />
                  Generate screen file
                </MenuItem>
              </Menu>
            </Box>
          </Box>

          {/* ── Row 1: filter ─────────────────────────────────────────────── */}
          <TextField
            size="small"
            placeholder="Filter steps by type, target, or value"
            value={stepFilter}
            onChange={(event) => setStepFilter(event.target.value)}
            fullWidth
            sx={{ mb: 1.5 }}
          />

          {/* ── Row 2: compose a new step ─────────────────────────────────── */}
          {/*
              Grid rows use `alignItems: 'stretch'` by default — with a labeled
              FormControl (~40px) next to a small Button (~31px) the button
              gets stretched to 40px and looks like a chunky block. Pin every
              cell to h=40 (`sx={{ height: 40 }}`) so Buttons and FormControls
              share the same visual height without relying on stretch.
          */}
          <Box sx={{ mb: 1.5, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1 }}>
            <FormControl size="small" sx={{ minWidth: 0 }}>
              <InputLabel>Command</InputLabel>
              <Select
                value={selectedCommandType}
                label="Command"
                onChange={(event) => handleManualCommandTypeChange(event.target.value as RecorderStepType)}
                MenuProps={{ PaperProps: { sx: { maxHeight: 480 } } }}
              >
                {/*
                  Grouped by category so 40+ commands don't drown the picker.
                  We build the sections at render — the cost is trivial and
                  avoids maintaining a parallel data structure.
                */}
                {(['Interaction', 'Assertion', 'Wait', 'App', 'Device', 'Flow', 'AI', 'Advanced'] as CommandCategory[])
                  .flatMap((cat) => {
                    const items = MAESTRO_COMMAND_OPTIONS.filter((o) => o.category === cat);
                    if (items.length === 0) return [];
                    return [
                      <ListSubheader key={`hdr-${cat}`} sx={{ bgcolor: 'transparent', color: 'primary.main', fontWeight: 700, fontSize: 12, letterSpacing: 0.6, textTransform: 'uppercase' }}>
                        {cat}
                      </ListSubheader>,
                      ...items.map((option) => (
                        <MenuItem key={option.type} value={option.type} sx={{ pl: 3 }}>
                          {option.label}
                        </MenuItem>
                      )),
                    ];
                  })}
              </Select>
            </FormControl>

            <Button variant="outlined" size="small" onClick={handleAddManualCommand} sx={{ minWidth: 0, height: 40 }}>
              Add command
            </Button>

            {/* Command description helper — surfaces one-line docs from the
                catalog so users can pick without leaving the app. */}
            {commandComposerOption.description && (
              <Typography variant="caption" sx={{ gridColumn: '1 / -1', opacity: 0.65, mt: -0.5 }}>
                {commandComposerOption.description}
              </Typography>
            )}

            {shouldShowManualTarget && (
              <TextField
                size="small"
                label={commandComposerOption.targetLabel || 'Target'}
                value={manualCommandTarget}
                onChange={(event) => setManualCommandTarget(event.target.value)}
                sx={{ minWidth: 0 }}
                fullWidth
              />
            )}

            {shouldShowManualValue && (
              <TextField
                size="small"
                label={commandComposerOption.valueLabel || 'Value'}
                value={manualCommandValue}
                onChange={(event) => setManualCommandValue(event.target.value)}
                multiline={selectedCommandType === 'custom'}
                minRows={selectedCommandType === 'custom' ? 3 : undefined}
                sx={{ minWidth: 0, gridColumn: selectedCommandType === 'custom' ? '1 / -1' : 'auto' }}
                fullWidth
              />
            )}

            <FormControl size="small" sx={{ minWidth: 0 }}>
              <InputLabel>Template</InputLabel>
              <Select
                value={selectedTemplateLabel}
                label="Template"
                onChange={(event) => setSelectedTemplateLabel(event.target.value)}
              >
                {STEP_TEMPLATES.map((template) => (
                  <MenuItem key={template.label} value={template.label}>{template.label}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <Button variant="outlined" size="small" onClick={() => applyTemplate(selectedTemplateLabel)} sx={{ minWidth: 0, height: 40 }}>
              Add template
            </Button>
          </Box>

          {/*
              Row 3 — persistence + run.
              Import/YAML/Group are single buttons with an end-icon chevron
              instead of MUI ButtonGroup split-buttons; the chevron alone
              signals "opens a menu" and avoids the icon-clipping / height
              inflation ButtonGroup was causing.
              Height pinned to 40 to match the FormControls in row 2.
          */}
          <Box sx={{ mb: 2, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 1 }}>
            <Button
              variant="outlined"
              size="small"
              endIcon={<ArrowDropDownIcon />}
              onClick={(e) => setImportMenuAnchor(e.currentTarget)}
              sx={{ justifyContent: 'space-between', px: 1.5, height: 40 }}
            >
              Import
            </Button>
            <Menu
              anchorEl={importMenuAnchor}
              open={Boolean(importMenuAnchor)}
              onClose={() => setImportMenuAnchor(null)}
            >
              <MenuItem onClick={() => { handleImportYaml(); setImportMenuAnchor(null); }}>
                <CodeIcon fontSize="small" sx={{ mr: 1 }} />
                Import YAML flow
              </MenuItem>
              <MenuItem onClick={() => { handleLoadDraft(); setImportMenuAnchor(null); }}>
                <DescriptionIcon fontSize="small" sx={{ mr: 1 }} />
                Open draft file…
              </MenuItem>
              <MenuItem onClick={() => { handleLoadLocalDraft(); setImportMenuAnchor(null); }}>
                <DescriptionIcon fontSize="small" sx={{ mr: 1 }} />
                Restore last auto-saved draft
              </MenuItem>
            </Menu>

            <Button
              variant="outlined"
              size="small"
              endIcon={<ArrowDropDownIcon />}
              onClick={(e) => setYamlMenuAnchor(e.currentTarget)}
              disabled={testSteps.length === 0}
              sx={{ justifyContent: 'space-between', px: 1.5, height: 40 }}
            >
              YAML
            </Button>
            <Menu
              anchorEl={yamlMenuAnchor}
              open={Boolean(yamlMenuAnchor)}
              onClose={() => setYamlMenuAnchor(null)}
            >
              <MenuItem onClick={() => { handleViewYAML(); setYamlMenuAnchor(null); }}>
                <CodeIcon fontSize="small" sx={{ mr: 1 }} />
                Preview YAML
              </MenuItem>
              <MenuItem onClick={() => { handleDownloadYAML(); setYamlMenuAnchor(null); }}>
                <DownloadIcon fontSize="small" sx={{ mr: 1 }} />
                Download YAML
              </MenuItem>
              <MenuItem onClick={() => { handleSaveFlow(); setYamlMenuAnchor(null); }}>
                <SaveIcon fontSize="small" sx={{ mr: 1 }} />
                Save to .maestro/flows
              </MenuItem>
              <MenuItem onClick={() => { handleSaveDraft(); setYamlMenuAnchor(null); }}>
                <SaveIcon fontSize="small" sx={{ mr: 1 }} />
                Save draft file
              </MenuItem>
            </Menu>

            {/* Group controls surface only when the user has a selection —
                otherwise the control is dead weight taking valuable space. */}
            {selectedStepIds.length > 0 && (
              <>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<GroupWorkIcon />}
                  endIcon={<ArrowDropDownIcon />}
                  onClick={(e) => setGroupMenuAnchor(e.currentTarget)}
                  sx={{ justifyContent: 'space-between', px: 1.5, height: 40 }}
                >
                  Group ({selectedStepIds.length})
                </Button>
                <Menu
                  anchorEl={groupMenuAnchor}
                  open={Boolean(groupMenuAnchor)}
                  onClose={() => setGroupMenuAnchor(null)}
                >
                  <Box sx={{ px: 2, py: 1, minWidth: 240 }}>
                    <TextField
                      size="small"
                      autoFocus
                      placeholder="Group name"
                      value={newGroupName}
                      onChange={(event) => setNewGroupName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && newGroupName.trim()) {
                          handleAssignGroupToSelected();
                          setGroupMenuAnchor(null);
                        }
                      }}
                      fullWidth
                    />
                  </Box>
                  <MenuItem
                    disabled={!newGroupName.trim()}
                    onClick={() => { handleAssignGroupToSelected(); setGroupMenuAnchor(null); }}
                  >
                    Assign group to selected
                  </MenuItem>
                  <MenuItem onClick={() => { handleClearGroupForSelected(); setGroupMenuAnchor(null); }}>
                    Clear group from selected
                  </MenuItem>
                </Menu>
              </>
            )}

            <Button
              variant="contained"
              size="small"
              color="success"
              startIcon={<PlayCircleOutlineIcon />}
              onClick={handlePlayAllSteps}
              disabled={testSteps.length === 0}
              sx={{
                gridColumn: selectedStepIds.length > 0 ? 'auto' : '1 / -1',
                minWidth: 0,
                height: 40,
              }}
            >
              Play All
            </Button>
          </Box>

          {/* Test Steps List */}
          <List sx={{ bgcolor: '#1a1a1a', borderRadius: 1, flex: 1, minHeight: 0, overflow: 'auto' }}>
            {filteredTestSteps.length === 0 ? (
              <ListItem>
                <ListItemText 
                  primary={testSteps.length === 0 ? 'No test steps yet' : 'No matching steps'} 
                  secondary={testSteps.length === 0 ? 'Start recording and interact with your device' : 'Try a different filter'}
                  primaryTypographyProps={{ color: 'text.secondary' }}
                />
              </ListItem>
            ) : (
              filteredTestSteps.map((step, idx) => (
                <React.Fragment key={step.id}>
                  {showTypeSections && (idx === 0 || getSectionLabel(filteredTestSteps[idx - 1]) !== getSectionLabel(step)) && (
                    <Box sx={{ px: 2, py: 0.75, bgcolor: '#111', borderTop: idx === 0 ? 'none' : '1px solid #333' }}>
                      <Typography variant="caption" sx={{ color: '#22d3ee', fontWeight: 'bold' }}>
                        {getSectionLabel(step)}
                      </Typography>
                    </Box>
                  )}
                  <ListItem
                    draggable
                    onDragStart={() => handleDragStart(step.id)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => handleDropOnStep(step.id)}
                    sx={{ opacity: draggedStepId === step.id ? 0.55 : 1 }}
                  >
                    <Box sx={{ width: '100%', display: 'grid', gap: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <DragIndicatorIcon fontSize="small" sx={{ color: '#777', cursor: 'grab' }} />
                        <Checkbox
                          size="small"
                          checked={selectedStepIds.includes(step.id)}
                          onChange={() => handleToggleStepSelection(step.id)}
                        />
                        <Typography component="span" sx={{ fontSize: '1.2rem' }}>
                          {getStepIcon(step.type)}
                        </Typography>
                        <Chip
                          size="small"
                          label={stepStatuses[step.id] || 'idle'}
                          color={getStepStatusColor(stepStatuses[step.id] || 'idle')}
                          variant="outlined"
                        />
                        <FormControl size="small" sx={{ minWidth: 150 }}>
                          <Select
                            value={step.type}
                            onChange={(event) => updateStep(step.id, { type: event.target.value as RecorderStepType })}
                          >
                            <MenuItem value="tap">tap</MenuItem>
                            <MenuItem value="input">input</MenuItem>
                            <MenuItem value="assertVisible">assertVisible</MenuItem>
                            <MenuItem value="assertNotVisible">assertNotVisible</MenuItem>
                            <MenuItem value="longPress">longPress</MenuItem>
                            <MenuItem value="swipe">swipe</MenuItem>
                            <MenuItem value="wait">wait</MenuItem>
                            <MenuItem value="scroll">scroll</MenuItem>
                            <MenuItem value="scrollUntilVisible">scrollUntilVisible</MenuItem>
                            <MenuItem value="hideKeyboard">hideKeyboard</MenuItem>
                            <MenuItem value="back">back</MenuItem>
                            <MenuItem value="pressKey">pressKey</MenuItem>
                            <MenuItem value="launchApp">launchApp</MenuItem>
                            <MenuItem value="stopApp">stopApp</MenuItem>
                            <MenuItem value="custom">custom</MenuItem>
                          </Select>
                        </FormControl>
                        <Box sx={{ display: 'flex', gap: 0.5, ml: 'auto' }}>
                          <Tooltip title={expandedStepIds.includes(step.id) ? "Collapse" : "Expand"}>
                            <IconButton size="small" onClick={() => toggleStepExpanded(step.id)}>
                              {expandedStepIds.includes(step.id) ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Execute Step">
                            <IconButton size="small" onClick={() => handleExecuteStep(step)}>
                              <PlayCircleOutlineIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Duplicate Step">
                            <IconButton size="small" onClick={() => handleDuplicateStep(step)}>
                              <ContentCopyIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Move Up">
                            <span>
                              <IconButton size="small" onClick={() => moveStep(step.id, 'up')} disabled={idx === 0}>
                                <ArrowUpwardIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title="Move Down">
                            <span>
                              <IconButton size="small" onClick={() => moveStep(step.id, 'down')} disabled={idx === filteredTestSteps.length - 1}>
                                <ArrowDownwardIcon fontSize="small" />
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title="Delete Step">
                            <IconButton size="small" onClick={() => handleDeleteStep(step.id)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      </Box>

                      {expandedStepIds.includes(step.id) && (
                        <>
                          <TextField
                            size="small"
                            label="Group"
                            value={step.group || ''}
                            onChange={(event) => updateStep(step.id, { group: event.target.value || undefined })}
                            fullWidth
                          />

                          <TextField
                            size="small"
                            label="Selector ID"
                            value={step.selectorId || ''}
                            onChange={(event) => updateStep(step.id, { selectorId: event.target.value || undefined })}
                            fullWidth
                          />

                          {!['wait', 'hideKeyboard', 'back', 'custom'].includes(step.type) && (
                            <TextField
                              size="small"
                              label={getCommandOption(step.type).targetLabel || 'Target'}
                              value={step.target}
                              onChange={(event) => updateStep(step.id, { target: event.target.value })}
                              fullWidth
                            />
                          )}

                          {['input', 'swipe', 'wait', 'scroll', 'pressKey', 'custom'].includes(step.type) && (
                            <TextField
                              size="small"
                              label={step.type === 'custom' ? 'YAML' : getStepValueLabel(step.type)}
                              value={step.value || ''}
                              onChange={(event) => updateStep(step.id, { value: event.target.value })}
                              multiline={step.type === 'custom'}
                              minRows={step.type === 'custom' ? 3 : undefined}
                              fullWidth
                            />
                          )}

                          <Typography variant="caption" sx={{ color: '#666' }}>
                            {step.timestamp.toLocaleTimeString()}
                          </Typography>
                        </>
                      )}

                      {!expandedStepIds.includes(step.id) && !['wait', 'hideKeyboard', 'back', 'custom'].includes(step.type) && (
                        <TextField
                          size="small"
                          label={getCommandOption(step.type).targetLabel || 'Target'}
                          value={step.target}
                          onChange={(event) => updateStep(step.id, { target: event.target.value })}
                          fullWidth
                        />
                      )}
                    </Box>
                  </ListItem>
                  {idx < filteredTestSteps.length - 1 && <Divider />}
                </React.Fragment>
              ))
            )}
          </List>
        </Paper>

        <Box
          onMouseDown={(event) => {
            event.preventDefault();
            setActiveColumnDivider('middle');
          }}
          onDoubleClick={resetColumnWidths}
          sx={{
            width: 14,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'col-resize',
            bgcolor: activeColumnDivider === 'middle' ? 'rgba(204,0,0,0.12)' : 'transparent',
            '&:hover .divider-line': {
              bgcolor: 'primary.main'
            }
          }}
        >
          <Box className="divider-line" sx={{ width: 4, height: '92%', borderRadius: 999, bgcolor: '#444', transition: 'background-color 0.15s ease' }} />
        </Box>

        {/* Right Panel - Element Inspector & Properties */}
        <Paper sx={{ flex: 1, minWidth: 0, p: 2, overflow: 'auto', borderRadius: 0, minHeight: 0 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>🎯 Element Inspector</Typography>

          {selectedElement ? (
            <Card elevation={2} sx={{ mb: 2, bgcolor: '#1a1a1a' }}>
              <CardContent>
                <Typography variant="subtitle2" gutterBottom sx={{ color: '#22d3ee' }}>
                  Selected Element
                </Typography>
                <Grid container spacing={1}>
                  <Grid item xs={4}><Typography variant="caption" color="text.secondary">Type:</Typography></Grid>
                  <Grid item xs={8}><Typography variant="body2">{selectedElement.type}</Typography></Grid>
                  
                  <Grid item xs={4}><Typography variant="caption" color="text.secondary">Text:</Typography></Grid>
                  <Grid item xs={8}><Typography variant="body2">{selectedElement.text || '-'}</Typography></Grid>
                  
                  <Grid item xs={4}><Typography variant="caption" color="text.secondary">ID:</Typography></Grid>
                  <Grid item xs={8}><Typography variant="body2" sx={{ fontSize: '0.75rem', wordBreak: 'break-all' }}>{selectedElement.id}</Typography></Grid>
                  
                  <Grid item xs={4}><Typography variant="caption" color="text.secondary">Bounds:</Typography></Grid>
                  <Grid item xs={8}><Typography variant="body2" sx={{ fontSize: '0.75rem' }}>{selectedElement.bounds}</Typography></Grid>
                  
                  <Grid item xs={4}><Typography variant="caption" color="text.secondary">Clickable:</Typography></Grid>
                  <Grid item xs={8}><Typography variant="body2">{selectedElement.clickable ? '✅ Yes' : '❌ No'}</Typography></Grid>
                  
                  <Grid item xs={4}><Typography variant="caption" color="text.secondary">Focused:</Typography></Grid>
                  <Grid item xs={8}><Typography variant="body2">{selectedElement.focused ? '✅ Yes' : '❌ No'}</Typography></Grid>
                </Grid>

                <Box sx={{ mt: 2, display: 'grid', gap: 1.25 }}>
                  {(() => {
                    // Element Inspector action picker — same grouped-by-category
                    // treatment as the per-row picker in the hierarchy list,
                    // plus a data-driven value field so any command that
                    // carries a value (input text, wait timeout, AI prompt,
                    // clipboard payload, custom YAML) surfaces its input.
                    const inspectorOption = MAESTRO_COMMAND_OPTIONS.find((o) => o.type === selectedElementAction);
                    const inspectorNeedsValue = Boolean(inspectorOption?.valueLabel);
                    const inspectorActions = getAvailableActionsForElement(selectedElement);
                    const inspectorGrouped = (['Interaction', 'Assertion', 'Wait', 'App', 'Device', 'Flow', 'AI', 'Advanced'] as CommandCategory[])
                      .map((cat) => ({
                        cat,
                        items: inspectorActions
                          .map((a) => MAESTRO_COMMAND_OPTIONS.find((o) => o.type === a))
                          .filter((o): o is MaestroCommandOption => Boolean(o) && o!.category === cat),
                      }))
                      .filter((g) => g.items.length > 0);
                    return (
                      <>
                        <FormControl size="small" fullWidth>
                          <InputLabel>Recorder Action</InputLabel>
                          <Select
                            value={selectedElementAction}
                            label="Recorder Action"
                            onChange={(e) => setSelectedElementAction(e.target.value as RecorderStepType)}
                            MenuProps={{ PaperProps: { sx: { maxHeight: 420 } } }}
                          >
                            {inspectorGrouped.flatMap(({ cat, items }) => [
                              <ListSubheader
                                key={`insp-hdr-${cat}`}
                                sx={{ bgcolor: 'transparent', color: 'primary.main', fontWeight: 700, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase', lineHeight: '24px' }}
                              >
                                {cat}
                              </ListSubheader>,
                              ...items.map((option) => (
                                <MenuItem key={`insp-${option.type}`} value={option.type} sx={{ pl: 3 }}>
                                  {option.label}
                                </MenuItem>
                              )),
                            ])}
                          </Select>
                        </FormControl>

                        {inspectorOption?.description && (
                          <Typography variant="caption" sx={{ opacity: 0.65, mt: -0.5 }}>
                            {inspectorOption.description}
                          </Typography>
                        )}

                        {inspectorNeedsValue && (
                          <TextField
                            size="small"
                            label={inspectorOption?.valueLabel || 'Value'}
                            placeholder={inspectorOption?.defaultValue || ''}
                            value={selectedActionValue}
                            onChange={(e) => setSelectedActionValue(e.target.value)}
                            fullWidth
                            multiline={selectedElementAction === 'custom'}
                            minRows={selectedElementAction === 'custom' ? 3 : undefined}
                          />
                        )}
                      </>
                    );
                  })()}

                  <Button 
                    variant="outlined" 
                    size="small" 
                    fullWidth
                    startIcon={<TouchAppIcon />}
                    onClick={() => handleAddElementAction(selectedElement)}
                  >
                    Add Action To Flow
                  </Button>
                </Box>
              </CardContent>
            </Card>
          ) : (
            <Alert severity="info" sx={{ mb: 2 }}>
              Select an element from the hierarchy to inspect its properties
            </Alert>
          )}

          {/* Quick Actions */}
          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
            ⚡ Quick Actions
          </Typography>
          <Card elevation={2} sx={{ bgcolor: '#1a1a1a' }}>
            <CardContent>
              <Button 
                variant="text" 
                size="small" 
                fullWidth 
                sx={{ justifyContent: 'flex-start', mb: 1 }}
                onClick={() => addTestStep({ type: 'wait', target: '2000', value: '2000' })}
              >
                ⏱️ Add Wait (2s)
              </Button>
              <Button 
                variant="text" 
                size="small" 
                fullWidth 
                sx={{ justifyContent: 'flex-start', mb: 1 }}
                onClick={() => addTestStep({ type: 'swipe', target: 'screen', value: 'UP' })}
              >
                👈 Add Swipe Up
              </Button>
              <Button 
                variant="text" 
                size="small" 
                fullWidth 
                sx={{ justifyContent: 'flex-start' }}
                onClick={() => addTestStep({ type: 'assertVisible', target: 'Home' })}
              >
                ✓ Add Assertion
              </Button>
            </CardContent>
          </Card>

          {/* Documentation — fetched from backend, rendered in-app. Avoids
              the vscode:// URL scheme (which needs VS Code installed AND
              triggered the "Path does not exist" dialog when the hardcoded
              path was wrong / on another machine). */}
          <Box sx={{ mt: 3 }}>
            <Button
              variant="outlined"
              fullWidth
              startIcon={<DescriptionIcon />}
              onClick={async () => {
                setDocsOpen(true);
                if (docsContent) return;   // already loaded — reuse
                setDocsLoading(true);
                try {
                  const res = await fetch('http://localhost:3001/api/docs/recorder');
                  const text = await res.text();
                  setDocsContent(text);
                } catch (err) {
                  setDocsContent(
                    `# Failed to load documentation\n\n` +
                      `Could not reach the backend at http://localhost:3001.\n` +
                      `Make sure the recorder backend is running.`,
                  );
                } finally {
                  setDocsLoading(false);
                }
              }}
            >
              View Documentation
            </Button>
          </Box>

          {/* Stats */}
          <Card elevation={2} sx={{ mt: 2, bgcolor: '#1a1a1a' }}>
            <CardContent>
              <Typography variant="caption" color="text.secondary" display="block">STATISTICS</Typography>
              <Typography variant="h4" sx={{ color: '#22d3ee', fontWeight: 'bold' }}>
                {testSteps.length}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Total Actions Captured
              </Typography>
            </CardContent>
          </Card>

          <Card elevation={2} sx={{ mt: 2, bgcolor: '#1a1a1a' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                  📜 Execution Log
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <FormControl size="small" sx={{ minWidth: 120 }}>
                    <Select value={executionLogFilter} onChange={(event) => setExecutionLogFilter(event.target.value as ExecutionLogFilter)}>
                      <MenuItem value="all">all</MenuItem>
                      <MenuItem value="info">info</MenuItem>
                      <MenuItem value="success">success</MenuItem>
                      <MenuItem value="error">error</MenuItem>
                    </Select>
                  </FormControl>
                  <Button size="small" variant="text" onClick={() => setExecutionLogs([])} disabled={executionLogs.length === 0}>
                    Clear
                  </Button>
                </Box>
              </Box>
              <Box sx={{ display: 'grid', gap: 0.75, maxHeight: 220, overflow: 'auto' }}>
                {filteredExecutionLogs.length === 0 ? (
                  <Typography variant="caption" color="text.secondary">
                    {executionLogs.length === 0 ? 'No execution events yet' : 'No log entries for this filter'}
                  </Typography>
                ) : filteredExecutionLogs.map((entry) => (
                  <Box key={entry.id} sx={{ p: 1, borderRadius: 1, bgcolor: '#111' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                      <Typography variant="caption" sx={{ color: entry.level === 'error' ? 'error.main' : entry.level === 'success' ? 'success.main' : 'warning.main' }}>
                        {entry.message}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {entry.timestamp.toLocaleTimeString()}
                      </Typography>
                    </Box>
                    {entry.stepId != null && (
                      <Typography variant="caption" color="text.secondary">
                        Step #{entry.stepId}
                      </Typography>
                    )}
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Paper>
      </Box>

      {/* Notification Snackbar */}
      <Snackbar
        open={showNotification}
        autoHideDuration={4000}
        onClose={() => setShowNotification(false)}
        message={notification}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />

      <input ref={yamlImportInputRef} type="file" accept=".yaml,.yml,text/yaml,text/x-yaml" style={{ display: 'none' }} onChange={handleYamlImportFile} />
      <input ref={draftImportInputRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={handleDraftImportFile} />

      {/*
        Recorder documentation dialog. Renders the fetched markdown in a
        scrollable monospace pane — a full markdown renderer would need a
        new dependency; monospace + preserved whitespace is legible enough
        for an internal tool and keeps the bundle lean.
      */}
      <Dialog open={docsOpen} onClose={() => setDocsOpen(false)} fullWidth maxWidth="md">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DescriptionIcon fontSize="small" /> Recorder Documentation
        </DialogTitle>
        <DialogContent dividers>
          {docsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress size={28} />
            </Box>
          ) : (
            <Box
              component="pre"
              sx={{
                m: 0,
                p: 2,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: '0.85rem',
                lineHeight: 1.55,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: '70vh',
                overflow: 'auto',
                color: 'text.primary',
              }}
            >
              {docsContent}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(docsContent);
                showMessage('📋 Documentation copied to clipboard');
              } catch {
                showMessage('⚠️ Copy failed');
              }
            }}
            disabled={!docsContent || docsLoading}
          >
            Copy
          </Button>
          <Button onClick={() => setDocsOpen(false)} variant="contained">Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={yamlPreviewOpen} onClose={() => setYamlPreviewOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>YAML Preview</DialogTitle>
        <DialogContent>
          {classification && (
            <Alert 
              severity={classification.confidence > 70 ? 'info' : 'warning'}
              sx={{ mb: 2 }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                🔍 Auto-Classification: {classification.type.toUpperCase()} ({classification.confidence}% confidence)
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                📁 Category: {classification.category}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                📝 Suggested name: {classification.suggestedName}
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                💾 Suggested path: {classification.suggestedPath}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Reasoning: {classification.reasoning.join(' • ')}
              </Typography>
            </Alert>
          )}
          <Box
            component="pre"
            sx={{
              backgroundColor: '#1E1E1E',
              color: '#D4D4D4',
              padding: 2,
              borderRadius: 1,
              overflow: 'auto',
              fontFamily: 'monospace',
              fontSize: '0.875rem',
              maxHeight: '60vh',
              mb: 2,
            }}
          >
            {yamlPreviewContent}
          </Box>

          {/* Framework match suggestions — shown when the recorder found similar subflows */}
          {frameworkMatches.length > 0 && (
            <Alert severity="success" sx={{ mb: 2 }} icon={false}>
              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                Framework Matches — similar subflows already exist
              </Typography>
              {frameworkMatches.slice(0, 3).map((m: any, i: number) => (
                <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                  <Chip label={`${m.score}%`} size="small" color={m.score >= 60 ? 'success' : 'warning'} />
                  <Typography variant="body2" sx={{ flex: 1 }}>
                    <strong>{m.name}</strong> · {m.domain} · {m.reason}
                  </Typography>
                  <Tooltip title="Copy runFlow snippet">
                    <Button
                      size="small"
                      startIcon={<ContentCopyIcon />}
                      onClick={() => {
                        navigator.clipboard.writeText(m.runFlowYaml);
                        showMessage(`✅ Copied runFlow snippet for ${m.name}`);
                      }}
                    >
                      Use
                    </Button>
                  </Tooltip>
                </Box>
              ))}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button startIcon={<DownloadIcon />} onClick={handleDownloadYAML}>Download</Button>
          <Button startIcon={<ContentCopyIcon />} onClick={copyYamlToClipboard}>Copy</Button>
          <Button onClick={() => setYamlPreviewOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={screenPreviewOpen} onClose={() => setScreenPreviewOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Screen File Preview</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Review the generated screen file before saving to .maestro/screens/
          </Alert>
          <Box
            component="pre"
            sx={{
              backgroundColor: '#1E1E1E',
              color: '#D4D4D4',
              padding: 2,
              borderRadius: 1,
              overflow: 'auto',
              fontFamily: 'monospace',
              fontSize: '0.875rem',
              maxHeight: '60vh'
            }}
          >
            {screenPreviewContent}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setScreenPreviewOpen(false)}>Cancel</Button>
          <Button variant="contained" startIcon={<SaveIcon />} onClick={handleConfirmScreenGeneration}>
            Save to Framework
          </Button>
        </DialogActions>
      </Dialog>

      {/* Accessibility Report Dialog */}
      <Dialog open={a11yDialogOpen} onClose={() => setA11yDialogOpen(false)} fullWidth maxWidth="lg">
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>♿ Accessibility Validation Report</span>
            {a11yReport && (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Chip label={`${a11yReport.violations.length} Violations`} color="error" size="small" />
                <Chip label={`${a11yReport.passes} Passes`} color="success" size="small" />
              </Box>
            )}
          </Box>
        </DialogTitle>
        <DialogContent>
          {a11yReport && (
            <>
              {/* Summary Section */}
              <Alert severity="info" sx={{ mb: 2 }}>
                Scanned {a11yReport.totalElements} elements • Generated {new Date(a11yReport.timestamp).toLocaleString()}
              </Alert>

              {/* Summary by Severity */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                  Summary by Severity
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <Chip icon={<span>🔴</span>} label={`Critical: ${a11yReport.summary.critical}`} color="error" />
                  <Chip icon={<span>🟠</span>} label={`Serious: ${a11yReport.summary.serious}`} color="warning" />
                  <Chip icon={<span>🟡</span>} label={`Moderate: ${a11yReport.summary.moderate}`} color="info" />
                  <Chip icon={<span>🔵</span>} label={`Minor: ${a11yReport.summary.minor}`} color="default" />
                </Box>
              </Box>

              {/* Summary by Category */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                  Summary by WCAG Category
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <Chip label={`Perceivable: ${a11yReport.categoryBreakdown.Perceivable}`} variant="outlined" />
                  <Chip label={`Operable: ${a11yReport.categoryBreakdown.Operable}`} variant="outlined" />
                  <Chip label={`Understandable: ${a11yReport.categoryBreakdown.Understandable}`} variant="outlined" />
                  <Chip label={`Robust: ${a11yReport.categoryBreakdown.Robust}`} variant="outlined" />
                </Box>
              </Box>

              {/* Violations List */}
              {a11yReport.violations.length > 0 ? (
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                    Violations ({a11yReport.violations.length})
                  </Typography>
                  <Box sx={{ maxHeight: '50vh', overflow: 'auto' }}>
                    {a11yReport.violations.map((violation: any) => {
                      const severityColorMap: Record<string, 'error' | 'warning' | 'info' | 'default'> = {
                        critical: 'error',
                        serious: 'warning',
                        moderate: 'info',
                        minor: 'default'
                      };
                      const severityColor = severityColorMap[violation.severity] || 'default';

                      const severityIconMap: Record<string, string> = {
                        critical: '🔴',
                        serious: '🟠',
                        moderate: '🟡',
                        minor: '🔵'
                      };
                      const severityIcon = severityIconMap[violation.severity] || '⚪';

                      return (
                        <Paper key={violation.id} elevation={1} sx={{ p: 2, mb: 2, bgcolor: '#1a1a1a' }}>
                          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                            <span>{severityIcon}</span>
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                                {violation.message}
                              </Typography>
                              <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                                <Chip label={violation.wcagCriteria} size="small" color="primary" />
                                <Chip label={`Level ${violation.wcagLevel}`} size="small" variant="outlined" />
                                <Chip label={violation.category} size="small" variant="outlined" />
                                <Chip label={violation.severity} size="small" color={severityColor} />
                              </Box>
                              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                <strong>Element:</strong> {violation.element.type} - "{violation.element.text || violation.element.id}"
                              </Typography>
                              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                <strong>Impact:</strong> {violation.impact}
                              </Typography>
                              <Alert severity="info" sx={{ mt: 1 }}>
                                <strong>How to Fix:</strong> {violation.howToFix}
                              </Alert>
                            </Box>
                          </Box>
                        </Paper>
                      );
                    })}
                  </Box>
                </Box>
              ) : (
                <Alert severity="success">
                  ✅ No accessibility violations found! All elements meet WCAG standards.
                </Alert>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setA11yDialogOpen(false)}>Close</Button>
          <Button 
            variant="contained" 
            startIcon={<DownloadIcon />}
            onClick={() => {
              if (a11yHTMLReport) {
                const blob = new Blob([a11yHTMLReport], { type: 'text/html' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `accessibility-report-${new Date().toISOString().split('T')[0]}.html`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                showMessage('📥 Accessibility report downloaded');
              }
            }}
            disabled={!a11yHTMLReport}
          >
            Download Report
          </Button>
        </DialogActions>
      </Dialog>

      {/* Pulse Design System Report Dialog */}
      <Dialog open={pulseDialogOpen} onClose={() => setPulseDialogOpen(false)} fullWidth maxWidth="lg">
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>🎨 Pulse Design System Validation Report</span>
            {pulseReport && (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Chip label={`${pulseReport.totalViolations} Violations`} color="error" size="small" />
                <Chip label={`${pulseReport.totalElements - pulseReport.totalViolations} Passed`} color="success" size="small" />
                <Chip label={pulseReport.platform?.toUpperCase()} size="small" variant="outlined" />
              </Box>
            )}
          </Box>
        </DialogTitle>
        <DialogContent>
          {pulseReport && (
            <>
              <Alert severity="info" sx={{ mb: 2 }}>
                Scanned {pulseReport.totalElements} elements • Platform: {pulseReport.platform?.toUpperCase()} • Generated {new Date(pulseReport.timestamp).toLocaleString()}
              </Alert>

              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                  Summary by Severity
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <Chip icon={<span>🔴</span>} label={`Errors: ${pulseReport.summary?.error || 0}`} color="error" />
                  <Chip icon={<span>🟡</span>} label={`Warnings: ${pulseReport.summary?.warning || 0}`} color="warning" />
                  <Chip icon={<span>🔵</span>} label={`Info: ${pulseReport.summary?.info || 0}`} color="info" />
                </Box>
              </Box>

              {pulseReport.componentBreakdown && Object.keys(pulseReport.componentBreakdown).length > 0 && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                    Component Breakdown
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                    {Object.entries(pulseReport.componentBreakdown).map(([comp, count]: [string, any]) => (
                      <Chip key={comp} label={`${comp}: ${count}`} variant="outlined" size="small" />
                    ))}
                  </Box>
                </Box>
              )}

              {pulseReport.violations.length > 0 ? (
                <Box>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
                    Violations ({pulseReport.violations.length})
                  </Typography>
                  <Box sx={{ maxHeight: '50vh', overflow: 'auto' }}>
                    {pulseReport.violations.map((violation: any, index: number) => {
                      const severityColorMap: Record<string, 'error' | 'warning' | 'info' | 'default'> = {
                        error: 'error',
                        warning: 'warning',
                        info: 'info'
                      };
                      const severityColor = severityColorMap[violation.severity] || 'default';
                      const severityIconMap: Record<string, string> = {
                        error: '🔴',
                        warning: '🟡',
                        info: '🔵'
                      };
                      const severityIcon = severityIconMap[violation.severity] || '⚪';

                      return (
                        <Paper key={`${violation.ruleId}-${index}`} elevation={1} sx={{ p: 2, mb: 2, bgcolor: '#1a1a1a' }}>
                          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                            <span>{severityIcon}</span>
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                                {violation.component} — {violation.componentType}
                              </Typography>
                              <Box sx={{ display: 'flex', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                                <Chip label={violation.severity} size="small" color={severityColor} />
                                <Chip label={violation.ruleId} size="small" variant="outlined" />
                                {violation.dimensions && <Chip label={violation.dimensions} size="small" variant="outlined" />}
                              </Box>
                              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                <strong>Element:</strong> {violation.element || 'Unknown'} {violation.elementId !== 'none' ? `(ID: ${violation.elementId})` : ''}
                              </Typography>
                              <Alert severity="warning" sx={{ mt: 1 }}>
                                {violation.rule}
                              </Alert>
                            </Box>
                          </Box>
                        </Paper>
                      );
                    })}
                  </Box>
                </Box>
              ) : (
                <Alert severity="success">
                  All {pulseReport.totalElements} elements meet CVS Pulse design system standards.
                </Alert>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPulseDialogOpen(false)}>Close</Button>
          <Button
            variant="contained"
            startIcon={<DownloadIcon />}
            onClick={() => {
              if (pulseHTMLReport) {
                const blob = new Blob([pulseHTMLReport], { type: 'text/html' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `pulse-report-${new Date().toISOString().split('T')[0]}.html`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                showMessage('📥 Pulse report downloaded');
              }
            }}
            disabled={!pulseHTMLReport}
            sx={{ bgcolor: '#22d3ee', '&:hover': { bgcolor: '#0891b2' } }}
          >
            Download Report
          </Button>
        </DialogActions>
      </Dialog>

      {/* AI Chatbot */}
      <Chatbot
        ws={wsRef.current}
        context={{
          currentScreen: flowName,
          devicePlatform: selectedDevice,
          recordedSteps: testSteps.length,
          recentActions: testSteps.slice(-3).map(s => `${s.type} on ${s.target}`)
        }}
      />
    </ThemeProvider>
  );
}

export default App;
