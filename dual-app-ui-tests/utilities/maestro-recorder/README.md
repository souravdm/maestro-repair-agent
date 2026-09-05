# Maestro Flow Recorder

Professional QA automation tool with recording, playback, debugging, and script generation for CVS Health mobile apps.

## Quick Start

### Start the recorder (one command)
```bash
./scripts/recorder/start-recorder.sh
```

This single command now spins up **three processes** in the same terminal:

| Process | URL | Purpose |
|---|---|---|
| Maestro Studio | `http://localhost:9999` | Keeps the platform driver warm → **~10× faster** hierarchy fetches (150 ms vs. 2 s) |
| Backend | `http://localhost:3001` | REST + WebSocket API. Probes Studio on boot and picks the fast path automatically |
| Frontend | `http://localhost:3000` | React UI (auto-opens in browser) |

Ctrl+C stops all three. Studio is automatically reused if it's already running, and the script gracefully falls back to CLI mode if `maestro` isn't installed.

### Stop the recorder
```bash
./scripts/recorder/stop-recorder.sh   # or Ctrl+C in the terminal
```

## Features

- **Zero-code recording** — tap the device preview or the hierarchy tree to add steps
- **Full Maestro command surface** — all 40+ commands from the [official reference](https://docs.maestro.dev/reference/commands-available) are pickable from the composer, grouped by category (Interaction / Assertion / Wait / App / Device / Flow / AI / Advanced)
- **Rich per-element actions** — every element in the hierarchy exposes the full set of sensible commands (double-tap, long-press, copyTextFrom, extendedWaitUntil, extractTextWithAI, takeScreenshot, …) with data-driven value inputs
- **Fast hierarchy fetch** — reuses a running `maestro studio` session over HTTP with hash-based diff broadcast (identical trees never re-render)
- **Lossless YAML round-trip** — import a flow that uses commands the granular parser doesn't recognize and they're preserved as `custom` steps instead of being silently dropped
- **In-app documentation viewer** — no more broken `vscode://` links; docs load from disk into a modal
- **Glass UI theme** — aurora background, cyan accent, translucent panels with `backdrop-filter` blur
- **Accessibility validation** — WCAG 2.1 + VoiceOver/TalkBack property checks with downloadable reports
- **Pulse component validation** — CVS design-system compliance checks against iOS Swift + Android Kotlin source
- **Network capture** — API calls during a session, merged into the report
- **Real-time WebSocket sync** — screenshot + hierarchy pushed on every action

## Documentation

- **Full guide:** [docs/guides/MAESTRO_RECORDER.md](../docs/guides/MAESTRO_RECORDER.md)
- **Flow classification + chatbot:** [docs/FLOW_CLASSIFICATION_AND_CHATBOT.md](docs/FLOW_CLASSIFICATION_AND_CHATBOT.md)
- **In-app:** click **View Documentation** in the app — the backend serves the markdown into a modal (no external tools needed)

## Development

### One-time install (from the repo root)

The repo uses npm workspaces — a single `npm install` at the root installs every JS utility, including both recorder workspaces. No per-directory installs needed.

```bash
# From the project root:
npm run setup       # install everything + compile recorder backend TS
# or the lower-level equivalent:
npm install
```

### Frontend
```bash
cd maestro-recorder/frontend
npm start          # dev server on :3000
npm run build      # production build
```

### Backend
```bash
cd maestro-recorder/backend
npm run dev        # ts-node with hot reload
npm run build      # tsc → dist/
npm start          # dist/server.js
```

### Environment overrides

| Var | Default | Purpose |
|---|---|---|
| `PORT` | `3001` | Backend HTTP + WebSocket port |
| `MAESTRO_STUDIO_PORT` | `9999` | Studio REST endpoint the backend talks to |
| `MAESTRO_STUDIO_HOST` | `127.0.0.1` | Studio host |
| `MAESTRO_STUDIO_TIMEOUT_MS` | `4000` | Studio call timeout |

## Architecture

```
maestro-recorder/
├── frontend/          React 18 + TypeScript + MUI 5
│   ├── src/
│   │   ├── App.tsx          Main UI (glass theme, grouped command picker,
│   │   │                    rich per-element actions, rAF-batched WS)
│   │   └── components/
│   │       └── Chatbot.tsx  Inline help chatbot
│   └── public/
├── backend/           Node.js + Express + ws
│   ├── src/
│   │   ├── server.ts             REST + WebSocket, hierarchy/screenshot
│   │   │                          orchestration, docs endpoint
│   │   ├── studioClient.ts       Persistent HTTP client for Maestro Studio
│   │   │                          (fast path with hash-diff broadcast)
│   │   ├── accessibility.ts      WCAG + a11y validation
│   │   ├── native-a11y-scanner.ts  iOS/Android scanner integration
│   │   ├── flowClassifier.ts     Auto-classify recorded flows
│   │   └── chatbot.ts            In-app help responder
│   └── logs/           Runtime logs (Studio stdout, etc.)
└── docs/              Recorder-specific docs
```

## Hierarchy sources

The backend picks the fastest available source at boot:

| Source | Latency | Notes |
|---|---|---|
| ⚡ **Maestro Studio** (default) | 80–250 ms | Reuses a warm driver via HTTP. Auto-started by `start-recorder.sh`. |
| 🐢 **`maestro hierarchy` CLI** (fallback) | 1.5–4 s | Spawns a fresh JVM per call. Used only if Studio isn't reachable. |

Startup log shows which one is active:
```
⚡ Hierarchy source: Maestro Studio (http://127.0.0.1:9999) — fast path
```
…or…
```
🐢 Hierarchy source: maestro CLI (fallback). Start "maestro studio" for ~10x faster captures.
```

## Version

**1.1.0** — Glass UI + full command surface + Studio fast path

## Support

For issues or questions, see the [full guide](../docs/guides/MAESTRO_RECORDER.md), the in-app **View Documentation** button, or the main framework's `docs/guides/DEBUGGING.md`.
