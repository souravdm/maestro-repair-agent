# 🎬 Maestro Flow Recorder

**Complete Documentation for CVS Maestro UI Test Recorder**

**Last Updated:** July 2, 2026
**Version:** 1.1.0 — Glass UI, full command surface, Studio fast path

---

## Table of Contents

1. [Overview](#overview)
2. [Technology Stack](#technology-stack)
3. [Architecture](#architecture)
4. [Hierarchy Fetch — Fast Path vs. Fallback](#hierarchy-fetch--fast-path-vs-fallback)
5. [Command Surface](#command-surface)
6. [How It Works](#how-it-works)
7. [Features](#features)
8. [Installation & Setup](#installation--setup)
9. [Usage Guide](#usage-guide)
10. [Device Support](#device-support)
11. [Export Capabilities](#export-capabilities)
12. [Troubleshooting](#troubleshooting)
13. [Best Practices](#best-practices)

---

## Overview

The **Maestro Flow Recorder** is a professional web-based tool for recording, debugging, and generating Maestro test flows. It provides a modern UI for creating automated tests without writing code, with real-time device preview, element inspection, and framework-aware export capabilities.

### Key Benefits

✅ **Zero-Code Test Creation** — Record interactions visually
✅ **Full Maestro command surface** — all 40+ commands from the [official reference](https://docs.maestro.dev/reference/commands-available), grouped by category (Interaction / Assertion / Wait / App / Device / Flow / AI / Advanced)
✅ **Rich per-element actions** — every hierarchy element exposes the full sensible command set (double-tap, long-press, copyTextFrom, extendedWaitUntil, extractTextWithAI, takeScreenshot, …) with data-driven value inputs
✅ **Fast hierarchy fetch** — reuses a running `maestro studio` session over HTTP (~150 ms vs. ~2 s for `maestro hierarchy`)
✅ **Hash-diff broadcast** — identical hierarchy trees never re-broadcast, cutting WS traffic by ~90 % during idle
✅ **rAF-batched frontend renders** — WebSocket bursts coalesce into paint-aligned setState
✅ **Lossless YAML round-trip** — unrecognized commands preserved as `custom` steps on import
✅ **One-command start** — Studio + backend + frontend spin up in a single terminal
✅ **In-app documentation viewer** — no more broken `vscode://` links
✅ **Glass UI theme** — aurora background, cyan accent, translucent panels
✅ **Multi-Platform** — iOS and Android
✅ **Network Monitoring** — API calls captured during recording, merged into the report
✅ **Element Inspector** — visual hierarchy with filtering and search
✅ **Comprehensive Accessibility Validation** — 35+ WCAG 2.1 checks with downloadable reports
✅ **VoiceOver/TalkBack Validation** — automated screen-reader property testing
✅ **Pulse component validation** — CVS design-system compliance against iOS Swift + Android Kotlin source

---

## Technology Stack

### Frontend

**Core Framework:**
- **React 18** - Modern UI library with hooks
- **TypeScript** - Type-safe JavaScript
- **Material-UI (MUI) v5** - Component library
- **WebSocket Client** - Real-time communication

**Key Libraries:**
- `@mui/material` - UI components
- `@mui/icons-material` - Icon set
- `@emotion/react` & `@emotion/styled` - CSS-in-JS styling
- Native WebSocket API - Real-time updates

**Build Tools:**
- react-scripts (Create React App v5) — dev server on port 3000, production bundling
- TypeScript compiler — type checking
- ESLint — via react-scripts preset

### Backend

**Core Framework:**
- **Node.js** - JavaScript runtime
- **Express** - Web server framework
- **WebSocket Server (ws)** - Real-time communication
- **TypeScript** - Type-safe development

**Key Libraries:**
- `express` - HTTP server
- `ws` - WebSocket server
- `cors` - Cross-origin resource sharing
- `child_process` - Execute Maestro CLI commands
- `fs/promises` - File system operations

**Integration:**
- **Maestro CLI** - Test execution and hierarchy fetching
- **iOS Simulator (xcrun simctl)** - iOS device control
- **Android ADB** - Android device control

### Communication Protocol

**WebSocket Messages:**
```typescript
// Client → Server
{
  type: 'start-recording' | 'stop-recording' | 'get-hierarchy' | 
        'refresh-screenshot' | 'execute-step' | 'switch-device' | 
        'export-flow' | 'generate-screen'
  data: { /* message-specific payload */ }
}

// Server → Client
{
  type: 'recording-started' | 'step-captured' | 'hierarchy-updated' | 
        'screenshot-updated' | 'step-executed' | 'device-switched' | 
        'flow-exported'
  data: { /* response payload */ }
}
```

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────┐
│                  Browser (React App)                     │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Device     │  │  Test Steps  │  │   Element    │  │
│  │   Preview    │  │    Panel     │  │  Hierarchy   │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                  │                  │          │
│         └──────────────────┴──────────────────┘          │
│                            │                             │
│                     WebSocket Client                     │
└─────────────────────────────┬───────────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │  WebSocket Server │
                    │   (Port 3001)     │
                    └─────────┬─────────┘
                              │
                    ┌─────────▼─────────┐
                    │   Express Server  │
                    │   + REST APIs     │
                    └─────────┬─────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
    ┌─────────▼─────────┐         ┌─────────▼─────────┐
    │   Maestro CLI     │         │  Device Manager   │
    │   Integration     │         │  (iOS/Android)    │
    └─────────┬─────────┘         └─────────┬─────────┘
              │                               │
              └───────────────┬───────────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
    ┌─────────▼─────────┐         ┌─────────▼─────────┐
    │  iOS Simulator    │         │ Android Emulator  │
    │  (xcrun simctl)   │         │     (adb)         │
    └───────────────────┘         └───────────────────┘
```

### Component Responsibilities

**Frontend (React):**
- User interface and interactions
- WebSocket client for real-time updates
- State management (React hooks)
- Device preview rendering
- Test step visualization
- Element hierarchy display

**Backend (Node.js):**
- WebSocket server for real-time communication
- REST API endpoints for file operations
- Maestro CLI command execution
- Device detection and management
- Screenshot capture
- Hierarchy fetching
- YAML generation and export

**Maestro CLI:**
- Test execution
- Element hierarchy extraction
- Device interaction
- Screenshot capture

**Device Layer:**
- iOS: xcrun simctl (simulator control)
- Android: adb (device bridge)

---

## Hierarchy Fetch — Fast Path vs. Fallback

The backend chooses the fastest available source at boot:

| Source | Latency | When it runs | How it works |
|---|---|---|---|
| ⚡ **Maestro Studio** (default) | 80–250 ms | `maestro studio` reachable on `MAESTRO_STUDIO_PORT` | Persistent `http.Agent` with keep-alive, single HTTP round-trip returns tree + screenshot |
| 🐢 **`maestro hierarchy` CLI** (fallback) | 1.5–4 s | Studio unreachable | Spawns fresh JVM per call |

`start-recorder.sh` boots Studio automatically. Once running:

- **Every** `hierarchy-updated` broadcast is hashed (sha1 of `type|text|bounds|clickable`); identical trees never re-broadcast.
- **Frontend** collapses WS bursts into a single `requestAnimationFrame`-batched `setState`, aligning renders with the browser's paint clock.
- **Device switch** invalidates Studio's reachability cache and the last-broadcast hash so post-switch state is guaranteed to render.

Implementation: [utilities/maestro-recorder/backend/src/studioClient.ts](../../utilities/maestro-recorder/backend/src/studioClient.ts).

---

## Command Surface

The recorder supports **every command** from [docs.maestro.dev/reference/commands-available](https://docs.maestro.dev/reference/commands-available), grouped by category in the composer dropdown:

| Category | Commands |
|---|---|
| **Interaction** | tapOn, doubleTapOn, longPressOn, inputText, eraseText, copyTextFrom, pasteText, setClipboard, swipe, scroll, scrollUntilVisible, pressKey, hideKeyboard, back, openLink |
| **Assertion** | assertVisible, assertNotVisible, assertTrue, assertScreenshot |
| **Wait** | waitForAnimationToEnd, extendedWaitUntil |
| **App** | launchApp, stopApp, killApp, clearState, clearKeychain |
| **Device** | takeScreenshot, startRecording, stopRecording, setLocation, setAirplaneMode, toggleAirplaneMode, setOrientation, setPermissions, addMedia, travel |
| **Flow** | runFlow, runScript, evalScript, defineVariables, repeat, retry |
| **AI** | assertWithAI, assertNoDefectsWithAI, extractTextWithAI |
| **Advanced** | Custom YAML (paste any snippet as-is) |

Each command carries a one-line description sourced from the official reference — it appears as helper text under the picker, and again under the value field when applicable.

### Per-Element Actions

The Element Hierarchy list (middle column) and Element Inspector panel (right column) both expose the full sensible command set for the selected element's type, grouped by category:

| Element type | Actions surfaced |
|---|---|
| **textField** | tap, doubleTap, longPress, **input, eraseText, pasteText, setClipboard**, assertVisible, assertNotVisible, copyTextFrom, extendedWaitUntil, scrollUntilVisible, takeScreenshot, assertWithAI, extractTextWithAI, custom |
| **label** | assertVisible, assertNotVisible, tap, copyTextFrom, extendedWaitUntil, scrollUntilVisible, takeScreenshot, assertWithAI, extractTextWithAI, custom |
| **button / cell / other** | tap, doubleTap, longPress, assertVisible, assertNotVisible, copyTextFrom, extendedWaitUntil, scrollUntilVisible, takeScreenshot, assertWithAI, extractTextWithAI, custom |

The value input beneath the picker is **data-driven**: any command with a `valueLabel` in the catalog (e.g. `extendedWaitUntil` → *Timeout (ms)*, `assertWithAI` → *Assertion*) automatically renders its field with the right label, placeholder, and helper text.

### Lossless YAML Import

When importing a flow, any `- someCommand:` line the granular parser doesn't recognize is captured as a `custom` step with the raw block preserved — nothing is silently dropped. Round-trip is lossless for Maestro's full 40+ command surface.

---

## How It Works

### 1. Recording Flow

```
User Action → Frontend Captures → WebSocket Message → Backend Processes
                                                              ↓
                                                    Maestro CLI Executes
                                                              ↓
                                                    Device Responds
                                                              ↓
                                                    Screenshot Captured
                                                              ↓
                                                    Hierarchy Updated
                                                              ↓
                                          WebSocket Response → Frontend Updates UI
```

**Step-by-Step:**
1. User clicks "Record" button
2. Frontend sends `start-recording` WebSocket message
3. Backend initializes recording session
4. User interacts with device (via frontend or directly)
5. Frontend captures interaction and sends `capture-step` message
6. Backend executes step via Maestro CLI
7. Backend captures screenshot and hierarchy
8. Backend sends updates back to frontend
9. Frontend displays step in Test Steps panel
10. Repeat steps 4-9 for each interaction
11. User clicks "Stop" to end recording

### 2. Playback Flow

```
User Clicks Play → Frontend Sends Steps → Backend Executes Each Step
                                                      ↓
                                          Maestro CLI Runs Command
                                                      ↓
                                          Captures Screenshot/Hierarchy
                                                      ↓
                                          Sends Status Update
                                                      ↓
                                          Frontend Shows Progress
```

### 3. Element Hierarchy

**iOS Hierarchy:**
```bash
# Backend executes:
maestro --device <UDID> hierarchy

# Returns JSON with element tree:
{
  "attributes": {
    "text": "Sign in",
    "identifier": "login_button",
    "type": "Button",
    "bounds": "165,450,280,44"
  },
  "children": [...]
}
```

**Android Hierarchy:**
```bash
# Backend executes:
maestro --device <device-id> hierarchy

# Requires Maestro gRPC server running
# Returns similar JSON structure
```

**Filtering:**
- System elements excluded (status bar, navigation bar)
- App-specific elements included
- Meaningful text elements (3-120 chars)
- Clickable elements always included

### 4. Screenshot Capture

**iOS:**
```bash
xcrun simctl io <UDID> screenshot --type=png <output-path>
# Returns base64-encoded PNG
```

**Android:**
```bash
adb -s <device-id> exec-out screencap -p | base64
# Returns base64-encoded PNG
```

### 5. Device Switching

```
User Selects Device → Frontend Sends switch-device → Backend Updates Platform
                                                              ↓
                                                    Clears Cached Hierarchy
                                                              ↓
                                                    Fetches New Screenshot
                                                              ↓
                                                    Fetches New Hierarchy
                                                              ↓
                                          Sends device-switched → Frontend Updates UI
```

---

## Features

### 1. Recording & Playback

**Recording:**
- ✅ Start/Stop/Pause recording
- ✅ Capture tap, swipe, input actions
- ✅ Auto-detect element selectors
- ✅ Real-time step preview
- ✅ Manual step editing
- ✅ Step reordering (drag & drop)
- ✅ Delete individual steps
- ✅ Clear all steps

**Playback:**
- ✅ Execute all steps sequentially
- ✅ Execute single step
- ✅ Real-time execution feedback
- ✅ Success/failure indicators
- ✅ Execution time per step
- ✅ Screenshot after each step

### 2. Device Preview

**Features:**
- ✅ Live device screenshot
- ✅ Auto-refresh on changes
- ✅ Manual refresh button
- ✅ Device selector (iOS/Android)
- ✅ Platform-specific handling
- ✅ Screenshot zoom/pan
- ✅ Click-to-inspect elements

**Supported Devices:**
- iOS Simulator (via xcrun simctl)
- Android Emulator (via adb)
- Real iOS devices (with setup)
- Real Android devices (with setup)

### 3. Element Hierarchy

**Display:**
- ✅ Tree view of UI elements
- ✅ Element type badges (button, text, field)
- ✅ Clickable/interactive indicators
- ✅ Element count display
- ✅ Refresh button
- ✅ Search/filter functionality

**Filtering:**
- ✅ Filter by text content
- ✅ Filter by element ID
- ✅ Filter by element type
- ✅ Real-time filter updates
- ✅ Case-insensitive search

**Element Details:**
- Element ID (resource-id)
- Element type (button, textField, label, etc.)
- Text content
- Bounds (x, y, width, height)
- Clickable state
- Focused state

### 4. Test Steps Panel

**Features:**
- ✅ Numbered step list
- ✅ Step type icons
- ✅ Target element display
- ✅ Execution status (pending, success, error)
- ✅ Tooltips for all actions
- ✅ Delete selected steps
- ✅ Clear all steps
- ✅ Copy steps to clipboard
- ✅ Export to YAML
- ✅ Generate screen files

**Step Types:**
- `tapOn` - Tap element
- `inputText` - Enter text
- `assertVisible` - Verify element visible
- `swipe` - Swipe gesture
- `scroll` - Scroll action
- `launchApp` - Launch application

### 5. Accessibility Validation

**Comprehensive WCAG 2.1 Coverage (35+ Checks):**

**Category 1: Perceivable**
- ✅ Non-text content validation (images missing alt text)
- ✅ Info and relationships (form fields missing labels)
- ✅ Input purpose identification
- ✅ Color contrast validation (4.5:1 ratio)
- ✅ Reflow validation (text wrapping)
- ✅ Dynamic text/font scaling detection
- ✅ Color-only information indicators

**Category 2: Operable**
- ✅ Touch target size (44×44pt minimum, 48×48pt recommended)
- ✅ Link purpose validation
- ✅ Button labels validation
- ✅ Label in name (voice control)
- ✅ Custom gesture alternatives
- ✅ External keyboard/D-pad support

**Category 3: Understandable**
- ✅ On input validation
- ✅ Error identification
- ✅ Labels and instructions
- ✅ Status messages

**Category 4: Robust**
- ✅ Name, role, value validation
- ✅ Assistive technology support
- ✅ Programmatic element identification

**VoiceOver/TalkBack Validation (Automated):**
- ✅ Accessibility labels (iOS/Android)
- ✅ Accessibility hints for complex controls
- ✅ Accessibility traits/roles validation
- ✅ Text field placeholders
- ✅ Custom actions for gestures
- ✅ Container labeling
- ✅ Image descriptions

**Labeled Elements (Comprehensive):**
- ✅ Buttons with meaningful labels
- ✅ Images with alt text
- ✅ Links with descriptive text
- ✅ Text fields with labels/placeholders
- ✅ Interactive controls (switches, checkboxes, sliders)

**Report Features:**
- ✅ Severity levels (Critical, Serious, Moderate, Minor)
- ✅ WCAG criteria references with levels (A, AA, AAA)
- ✅ Platform-specific fix instructions (iOS & Android)
- ✅ Impact descriptions for users
- ✅ Category breakdown for prioritization
- ✅ **Downloadable HTML reports** with professional styling
- ✅ Automated scanning tool recommendations

**Accessibility Button:**
- ♿ Icon in Element Hierarchy header
- One-click validation
- Real-time report generation
- Download button for sharing reports

### 6. Export & Generation

**YAML Export:**
- ✅ Export to `.maestro/flows/`
- ✅ Framework-compliant format
- ✅ Includes appId and metadata
- ✅ Preview before export
- ✅ Custom flow naming
- ✅ Auto-generated comments

**Screen Generation:**
- ✅ Generate screen object files
- ✅ AI-enhanced element naming
- ✅ Type-based suffixes (Btn, Field, Label)
- ✅ Avoids duplicate locators
- ✅ Preview before saving
- ✅ Auto-categorization
- ✅ Includes all element types

**Export Formats:**
```yaml
# Flow Export
appId: com.cvsenterpriseiphone.cvspharmacy
name: Recorded Test Flow
---
- tapOn: "Sign in"
- inputText: "user@example.com"
- tapOn: "Continue"

# Screen Export
env:
  signInBtn: "Sign in"
  emailField: "Mobile number or email.*"
  continueBtn: "Continue"
```

### 7. Network Monitoring

**Capabilities:**
- ✅ Capture API calls during recording
- ✅ Display request/response details
- ✅ Filter by status code
- ✅ Export network logs
- ✅ Timing information
- ✅ Request/response bodies

### 8. Real-Time Updates

**WebSocket Features:**
- ✅ Instant hierarchy updates
- ✅ Live screenshot refresh
- ✅ Real-time step execution feedback
- ✅ Device switch notifications
- ✅ Error/success messages
- ✅ Auto-reconnect on disconnect

---

## Installation & Setup

### Prerequisites

```bash
# Required
- Node.js 18+ and npm
- Maestro CLI installed
- iOS Simulator (for iOS testing)
- Android SDK with adb (for Android testing)

# Verify installations
node --version        # Should be 18+
npm --version         # Should be 9+
maestro --version     # Should be installed
xcrun simctl list     # Should list iOS simulators
adb devices           # Should list Android devices
```

### Installation Steps

The repo uses **npm workspaces** — one install at the project root sets up every JS utility (utilities/{dashboard,ui-state-mapper,chat-bot}, both recorder workspaces, api tests). No per-directory installs needed.

```bash
# From the project root:
npm run setup

# Or the equivalent lower-level command:
npm install
```

That's it. The `postinstall` lifecycle compiles the recorder backend TypeScript automatically, so the recorder is ready to start immediately after `setup` finishes.

Optional utilities:

```bash
npm run verify        # sanity-check that every workspace path resolves
npm run setup:python  # install haio-goose Python deps (only if you use HAIO)
npm run clean         # remove every node_modules (then re-run setup)
```

### Starting the Recorder

```bash
# Recommended — one terminal, three processes:
./scripts/recorder/start-recorder.sh
```

This single command boots:

| # | Process | Port | Purpose |
|---|---|---|---|
| 1 | Maestro Studio | `9999` | Keeps platform driver warm → **~10× faster** hierarchy fetches |
| 2 | Recorder backend | `3001` | REST + WebSocket API |
| 3 | Recorder frontend | `3000` | React UI (auto-opens in browser) |

Behavior:
- If Studio is already running on port 9999, it is **reused** (not double-launched).
- If `maestro` CLI isn't installed, Studio is skipped and the backend falls back to the (slower) CLI path. The recorder still works.
- Studio can take 10–15 s to complete device discovery on a cold emulator; the start script polls for up to 40 s before deciding to fall back.
- Boot log announces which hierarchy source is active:
  ```
  ⚡ Hierarchy source: Maestro Studio (http://127.0.0.1:9999) — fast path
  ```

```bash
# Manual start (three separate terminals — only needed if you want to
# override ports or hack on Studio itself):
maestro studio --port 9999 --no-window          # terminal 1
cd utilities/maestro-recorder/backend && npm start        # terminal 2
cd utilities/maestro-recorder/frontend && npm start       # terminal 3

# Frontend is served at: http://localhost:3000
```

### Stopping the Recorder

```bash
# Ctrl+C in the terminal running start-recorder.sh — the cleanup trap kills
# Studio (including child JVMs), the backend, and the frontend in order.

# Or manually:
./scripts/recorder/stop-recorder.sh
```

### Environment overrides

| Var | Default | Purpose |
|---|---|---|
| `PORT` | `3001` | Backend HTTP + WebSocket port |
| `MAESTRO_STUDIO_PORT` | `9999` | Studio REST endpoint the backend talks to |
| `MAESTRO_STUDIO_HOST` | `127.0.0.1` | Studio host |
| `MAESTRO_STUDIO_TIMEOUT_MS` | `4000` | Studio call timeout |

---

## Usage Guide

### Basic Recording Workflow

1. **Start Recorder**
   ```bash
   ./scripts/recorder/start-recorder.sh
   ```

2. **Open Browser**
   - The browser auto-opens at `http://localhost:3000` (or navigate there manually)
   - Wait for connection indicator

3. **Select Device**
   - Choose "iOS Simulator" or "Android Emulator" from dropdown
   - Wait for device screen to load

4. **Start Recording**
   - Click "Record" button (red circle)
   - Interact with device
   - Each action is captured as a step

5. **Review Steps**
   - View steps in "Test Steps" panel
   - Edit/delete steps as needed
   - Reorder by dragging

6. **Stop Recording**
   - Click "Stop" button
   - Review captured steps

7. **Export Test**
   - Click "Export" button
   - Choose export location
   - Preview YAML before saving

### Element Inspection

1. **View Hierarchy**
   - Element Hierarchy panel shows all UI elements
   - Click refresh button to update

2. **Filter Elements**
   - Use search box to filter by text/id/type
   - Real-time filtering as you type

3. **Select Element**
   - Click element in hierarchy
   - View details in properties panel

4. **Add to Test**
   - Click element to add tap action
   - Or drag element to test steps

### Screen Generation

1. **Select Steps**
   - Select steps containing elements to extract
   - Or use current device screen

2. **Click "Screen" Button**
   - AI generates element names
   - Preview screen file content

3. **Confirm Generation**
   - Review element names
   - Click "Confirm" to save
   - File saved to `.maestro/screens/`

### Device Switching

1. **Select Device Dropdown**
   - Choose "iOS Simulator" or "Android Emulator"

2. **Wait for Switch**
   - Backend detects device
   - Fetches new screenshot and hierarchy
   - UI updates automatically

3. **Continue Testing**
   - Record/playback on new device
   - All features work cross-platform

### Accessibility Validation

1. **Load Device Screen**
   - Ensure Element Hierarchy is populated
   - Click refresh if needed

2. **Run Validation**
   - Click ♿ (accessibility) button in Element Hierarchy header
   - Wait for validation to complete

3. **Review Report**
   - View comprehensive report with:
     - Summary by severity (Critical, Serious, Moderate, Minor)
     - Summary by WCAG category (Perceivable, Operable, Understandable, Robust)
     - **Screenshot of validated screen** (automatically captured)
     - Detailed violations with fix instructions
     - VoiceOver/TalkBack specific issues

4. **Download Report**
   - Click "Download Report" button
   - Save HTML file for sharing with team
   - Open in browser for professional formatted report
   - **Screenshot is embedded** in the HTML report for visual context
   - Helps developers identify which screen/state was tested

5. **Fix Issues**
   - Follow platform-specific fix instructions
   - iOS: Set accessibilityLabel, accessibilityHint, accessibilityTraits
   - Android: Set contentDescription, hint, appropriate roles
   - Re-run validation to verify fixes

---

## Device Support

### iOS Simulator

**Requirements:**
- macOS with Xcode installed
- iOS Simulator running
- Booted simulator detected automatically

**Features:**
- ✅ Full hierarchy support
- ✅ Screenshot capture
- ✅ Real-time updates
- ✅ All Maestro commands

**Troubleshooting:**
```bash
# List available simulators
xcrun simctl list devices

# Boot a simulator
xcrun simctl boot <UDID>

# Check booted simulator
xcrun simctl list devices | grep Booted
```

### Android Emulator

**Requirements:**
- Android SDK installed
- adb in PATH
- Emulator running
- Maestro gRPC server running

**Setup:**
```bash
# 1. Start emulator
emulator -avd <AVD_NAME>

# 2. Verify connection
adb devices

# 3. Start Maestro server (required for Android)
maestro studio
# Keep this running in background
```

**Features:**
- ✅ Full hierarchy support (with Maestro server)
- ✅ Screenshot capture
- ✅ Device detection
- ✅ All Maestro commands

**Troubleshooting:**
```bash
# Check device connection
adb devices

# Restart adb server
adb kill-server
adb start-server

# Check Maestro server
# Should see: "Maestro Studio started"
maestro studio
```

### Custom Port Configuration

**For Android with custom Maestro port:**
```bash
# Set custom port
export MAESTRO_PORT=7002

# Start recorder backend
cd utilities/maestro-recorder/backend
npm start

# Maestro will use custom port
```

---

## Export Capabilities

### YAML Flow Export

**Generated Structure:**
```yaml
appId: com.cvsenterpriseiphone.cvspharmacy
name: <Flow Name>
tags:
  - recorded
  - <auto-generated-tags>
---
# Step 1: <Description>
- tapOn: "Element Text"

# Step 2: <Description>
- inputText: "Input Value"

# Step 3: <Description>
- assertVisible: "Expected Text"
```

**Export Options:**
- Flow name customization
- Auto-generated comments
- Framework-compliant format
- Saved to `.maestro/flows/`

### Screen Object Generation

**Generated Structure:**
```javascript
// .maestro/screens/<Category>/<ScreenName>Screen.js
env:
  signInBtn: "Sign in"
  emailField: "Mobile number or email.*"
  passwordField: "Password.*"
  continueBtn: "Continue"
  errorMessage: "Your password is incorrect"
```

**Features:**
- AI-enhanced element naming
- Type-based suffixes (Btn, Field, Label, Icon, Message)
- Avoids duplicate locators
- Uses text if available, ID as fallback
- Auto-categorizes by screen context

### Preview Before Export

**Both exports show preview dialog:**
- Full content preview
- Syntax highlighting
- Confirm/Cancel options
- File path display
- Edit before saving

---

## Troubleshooting

### Common Issues

**1. WebSocket Connection Failed**
```
Error: WebSocket connection to 'ws://localhost:3001' failed
```
**Solution:**
- Ensure backend is running: `cd utilities/maestro-recorder/backend && npm start`
- Check port 3001 is not in use
- Restart backend server

**2. No Device Screen**
```
Device screen shows "No screenshot available"
```
**Solution:**
- Verify device is running (iOS Simulator or Android Emulator)
- Click refresh button in Device Preview
- Check device is booted: `xcrun simctl list devices | grep Booted` (iOS)
- Check device is connected: `adb devices` (Android)

**3. Empty Element Hierarchy**
```
Element Hierarchy shows "No elements"
```
**Solution:**
- Click refresh button in Element Hierarchy
- For Android: Ensure Maestro server is running (`maestro studio`)
- Check device screen is loaded
- Verify app is in foreground

**4. Android Hierarchy Not Loading**
```
⚠️ Failed to get Android hierarchy via Maestro
```
**Solution:**
- Start Maestro Studio: `maestro studio`
- Keep it running in background
- Restart recorder backend
- Switch to Android device again

**5. Export Failed**
```
Failed to export flow: Permission denied
```
**Solution:**
- Check write permissions on `.maestro/flows/` directory
- Ensure directory exists: `mkdir -p .maestro/flows`
- Try different export location

### Debug Mode

**Enable verbose logging:**
```bash
# Backend
cd utilities/maestro-recorder/backend
DEBUG=* npm start

# Check backend console for detailed logs
```

**Check WebSocket messages:**
```javascript
// In browser console
// WebSocket messages are logged automatically
```

---

## Best Practices

### Recording

1. **Start with Clean State**
   - Launch app fresh before recording
   - Clear previous test data
   - Ensure consistent starting point

2. **Record Meaningful Steps**
   - Focus on user workflows
   - Avoid unnecessary actions
   - Group related steps

3. **Use Descriptive Names**
   - Name flows clearly
   - Add comments for complex steps
   - Use consistent naming conventions

4. **Verify After Actions**
   - Add assertions after important actions
   - Verify expected outcomes
   - Check for error states

### Element Selection

1. **Prefer Text Selectors**
   - More stable than IDs
   - User-facing and readable
   - Less likely to change

2. **Use IDs as Fallback**
   - When text is dynamic
   - When text is not unique
   - For programmatic elements

3. **Avoid Absolute Positions**
   - Don't rely on coordinates
   - Use element selectors instead
   - More maintainable

### Export Strategy

1. **Organize by Feature**
   - Export to appropriate category folders
   - Use consistent naming
   - Group related flows

2. **Extract Reusable Components**
   - Create subflows for common actions
   - Generate screen objects for pages
   - Avoid duplication

3. **Review Before Saving**
   - Use preview dialog
   - Check generated names
   - Verify YAML syntax

### Maintenance

1. **Update Screen Objects**
   - Regenerate when UI changes
   - Keep element names consistent
   - Remove obsolete elements

2. **Refactor Tests**
   - Extract common patterns
   - Use subflows for reuse
   - Keep flows focused

3. **Version Control**
   - Commit generated files
   - Review changes in PRs
   - Document major changes

### Accessibility Validation

1. **Run Early and Often**
   - Validate during development, not just before release
   - Run on every major UI change
   - Include in CI/CD pipeline

2. **Prioritize by Severity**
   - Fix Critical issues first (blocks users)
   - Address Serious issues next (major barriers)
   - Plan Moderate/Minor fixes for future sprints

3. **Use Automated Tools**
   - Google Accessibility Scanner (Android)
   - Xcode Accessibility Inspector (iOS)
   - Verify color contrast with automated tools

4. **Test with Real Users**
   - Automated validation catches 80-90% of issues
   - Manual VoiceOver/TalkBack testing still valuable
   - User testing with people with disabilities is ideal

5. **Document Fixes**
   - Save HTML reports for tracking
   - Share reports with team
   - Track accessibility improvements over time

6. **Mobile-Specific Considerations**
   - Focus on touch targets (44×44pt minimum)
   - Test with Dynamic Type/large fonts
   - Ensure VoiceOver/TalkBack properties are set
   - Provide alternatives for complex gestures

---

## Summary

The Maestro Flow Recorder is a comprehensive tool for creating, debugging, and managing Maestro UI tests. It combines modern web technologies with Maestro CLI integration to provide a seamless testing experience.

**Key Features:**
- Zero-code test recording with visual interface
- Comprehensive accessibility validation (35+ WCAG 2.1 checks)
- VoiceOver/TalkBack property validation
- Real-time device preview and element inspection
- Smart export to framework-compliant flows/subflows/screens
- Downloadable HTML accessibility reports
- Multi-platform support (iOS and Android)

**Perfect For:**
- QA engineers creating automated tests
- Developers debugging UI issues
- Accessibility specialists validating WCAG compliance
- Teams requiring comprehensive test documentation

**Key Takeaways:**
- Web-based UI with real-time updates
- Supports iOS and Android devices
- Records interactions without code
- Generates framework-compliant exports
- Visual element inspection and debugging
- Network monitoring and logging
- AI-enhanced element naming

**For Support:**
- Check this documentation first
- Review troubleshooting section
- Check backend console logs
- Verify device connections
- Ensure Maestro CLI is working

**Next Steps:**
1. Install and start the recorder
2. Record your first test
3. Export to framework format
4. Run the generated test
5. Iterate and improve

---

**Document Version:** 1.0.0  
**Last Updated:** April 2, 2026  
**Maintained By:** CVS Pharmacy QA Team
