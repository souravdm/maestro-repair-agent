# Maestro Tools Comparison Guide

This guide helps you understand the different Maestro tools available and when to use each one.

## Tools Overview

| Tool | Purpose | Best For | UI Type |
|------|---------|----------|---------|
| **Maestro CLI** | Command-line test execution | CI/CD, automation, scripts | Terminal |
| **Maestro Studio** | Element inspection | Quick debugging, locator finding | Terminal/Web |
| **Maestro Flow Recorder** | Complete QA tool | Test creation, debugging, export | Web App |

---

## Maestro CLI

**What it is:** The core Maestro command-line tool for running tests.

**Features:**
- ✅ Run individual flows or suites
- ✅ Execute tests in CI/CD pipelines
- ✅ Fast, lightweight, scriptable
- ✅ Built-in commands (tap, input, assert, etc.)

**When to use:**
- Running tests in CI/CD
- Executing test suites
- Scripting and automation
- Production test runs

**Example:**
```bash
maestro test .maestro/flows/Account/login.yaml
maestro test --continuous .maestro/suites/smoke.yaml
```

**Limitations:**
- ❌ No GUI
- ❌ No recording capability
- ❌ Limited debugging tools
- ❌ Manual YAML writing required

---

## Maestro Studio

**What it is:** Built-in inspection tool for exploring app UI hierarchy.

**Features:**
- ✅ View element hierarchy
- ✅ Find element IDs and properties
- ✅ Test locators interactively
- ✅ Quick element inspection

**When to use:**
- Finding element locators
- Debugging "element not found" errors
- Understanding app structure
- Quick one-off inspections

**Example:**
```bash
maestro studio
```

**What you see:**
```
┌──────────────────────────────────────┐
│  Maestro Studio                       │
├──────────────────────────────────────┤
│  Element Hierarchy:                  │
│  └─ View                             │
│     ├─ Button "Sign in"              │
│     │  id: login_button              │
│     │  bounds: (100, 200, 280, 44)   │
│     ├─ TextField "Email"             │
│     │  id: email_field               │
│     └─ TextField "Password"          │
│        id: password_field            │
└──────────────────────────────────────┘
```

**Limitations:**
- ❌ No recording
- ❌ No playback
- ❌ No test generation
- ❌ Terminal-based UI (not as intuitive)
- ❌ No export functionality

---

## Maestro Flow Recorder

**What it is:** Professional QA automation tool with recording, playback, debugging, and script generation.

**Features:**
- ✅ **Record** user interactions visually
- ✅ **Full Maestro command surface** — all 40+ commands from the [official reference](https://docs.maestro.dev/reference/commands-available), grouped by category
- ✅ **Rich per-element actions** — every hierarchy element exposes tap, doubleTap, longPress, copyTextFrom, extendedWaitUntil, extractTextWithAI, takeScreenshot, and more with data-driven value inputs
- ✅ **Play back** tests with full controls
- ✅ **Debug** with element inspector, network monitor
- ✅ **Export** to framework format (flows/subflows/screens)
- ✅ **Studio fast path** — reuses `maestro studio` over HTTP for ~10× faster hierarchy fetches (150 ms vs. 2 s)
- ✅ **Glass UI** — aurora background, cyan accent, translucent panels
- ✅ **Real-time updates** via WebSocket with hash-diff broadcast + rAF-batched renders
- ✅ **Lossless YAML round-trip** — unrecognized commands preserved as `custom` steps on import
- ✅ **Network monitoring** (API calls)
- ✅ **Screenshot capture** at each step
- ✅ **In-app documentation viewer** — no external tools needed
- ✅ **Smart suggestions** (extract subflows, use variables)

**When to use:**
- Creating new tests without writing YAML
- Recording complex user flows
- Debugging test failures visually
- Exploring and learning the app
- Training new QA team members
- Generating test documentation

**Example Workflow:**
```
1. Start recorder: ./scripts/recorder/start-recorder.sh
2. Open browser: http://localhost:3000
3. Connect device and click Record
4. Perform actions on device
5. Review recorded steps
6. Play back to verify
7. Export to framework format
8. Run exported test: ./scripts/testing/test.sh .maestro/flows/Account/recordedLogin.yaml
```

**What you see:**
```
┌─────────────────────────────────────────────────────┐
│  🎭 Maestro Recorder    [◉ Recording]  ⚙️  ❓       │
├─────────────────────────────────────────────────────┤
│ [Device Preview] | [Test Steps]    | [Inspector]   │
│                  |                  |               │
│  Live mirroring  | 1. ✅ launchApp  | Element:      │
│  of iOS/Android  | 2. ✅ tapOn ...  | Type: Button  │
│                  | 3. ▶️ inputText | Text: Sign in │
│  Click to        | 4. ⏸ assertVis.| ID: login_btn │
│  inspect         |                  | Bounds: ...   │
│                  | [+ Add Step]     |               │
│  [Screenshot]    | [▶️ Run]         | [Network Log] │
│                  | [💾 Export]      | [Console]     │
└─────────────────────────────────────────────────────┘
```

**Advantages over Maestro Studio:**
- ✅ Visual, intuitive web UI
- ✅ Record flows automatically
- ✅ Play back with debugging
- ✅ Export to framework structure
- ✅ Network monitoring
- ✅ Screenshot management
- ✅ Smart recommendations
- ✅ Team collaboration features

---

## Comparison Matrix

### Core Capabilities

| Feature | CLI | Studio | Recorder |
|---------|-----|--------|----------|
| Run tests | ✅ | ❌ | ✅ |
| View hierarchy | ❌ | ✅ | ✅ |
| Record interactions | ❌ | ❌ | ✅ |
| Visual debugging | ❌ | ⚠️ Basic | ✅ Full |
| Export tests | ❌ | ❌ | ✅ |
| Network monitoring | ❌ | ❌ | ✅ |
| Screenshots | ⚠️ Manual | ⚠️ Manual | ✅ Auto |
| GUI | ❌ | ⚠️ Terminal | ✅ Web |

### Test Creation

| Feature | CLI | Studio | Recorder |
|---------|-----|--------|----------|
| Write YAML | Manual | Manual | Auto |
| Find locators | Manual | ✅ | ✅ Auto |
| Test flows | Manual | ❌ | ✅ Click |
| Extract subflows | Manual | ❌ | ✅ AI |
| Update screens | Manual | ❌ | ✅ AI |
| Code generation | ❌ | ❌ | ✅ |

### Debugging

| Feature | CLI | Studio | Recorder |
|---------|-----|--------|----------|
| Element inspection | ❌ | ✅ Basic | ✅ Full |
| Step-through | ❌ | ❌ | ✅ |
| Breakpoints | ❌ | ❌ | ✅ |
| Network calls | ❌ | ❌ | ✅ |
| Console logs | ⚠️ Terminal | ⚠️ Terminal | ✅ UI |
| Visual feedback | ❌ | ❌ | ✅ |

### Integration

| Feature | CLI | Studio | Recorder |
|---------|-----|--------|----------|
| CI/CD | ✅ | ❌ | ⚠️ Export only |
| Framework export | ❌ | ❌ | ✅ |
| Multi-format | ❌ | ❌ | ✅ |
| Version control | ✅ | ❌ | ✅ Output |
| Team sharing | ⚠️ Files | ❌ | ✅ |

---

## When to Use What

### Scenario 1: "I need to find an element locator"

**Use Maestro Studio** OR **Maestro Recorder**

- **Studio:** Quick terminal command, simple output
  ```bash
  maestro studio
  ```

- **Recorder:** More context, visual inspection, can test immediately
  ```bash
  ./scripts/recorder/start-recorder.sh
  # Click inspect mode, click element
  ```

**Verdict:** Studio for quick lookups, Recorder for complex inspection

---

### Scenario 2: "I need to create a new test"

**Use Maestro Recorder** (strongly recommended)

**Why:**
- Record interactions visually
- No YAML writing required
- Auto-generates tests
- Exports to framework format
- Validates as you go

**Alternative (manual):**
- Write YAML manually
- Use Studio to find locators
- Test with CLI
- Debug failures (harder without visual tools)

**Verdict:** Recorder saves 80% of test creation time

---

### Scenario 3: "A test is failing, I need to debug"

**Use Maestro Recorder** (best option)

**Why:**
- Load existing test
- Play back with visual feedback
- See exactly where it fails
- Inspect element at failure point
- View network calls
- Take screenshots
- Fix and re-export

**Alternative:**
- Run with CLI (see terminal error)
- Use Studio to inspect hierarchy
- Manually update YAML
- Re-run and hope it works

**Verdict:** Recorder provides 10x better debugging experience

---

### Scenario 4: "I need to run tests in CI/CD"

**Use Maestro CLI** (required)

**Why:**
- Lightweight
- Scriptable
- Fast
- No UI dependencies
- Standard for CI/CD

**Pipeline:**
1. Write tests using Recorder (local)
2. Export to framework format
3. Commit YAML files to repo
4. CI/CD runs tests with CLI

**Verdict:** CLI is the only option for CI/CD

---

### Scenario 5: "I'm new to the framework and want to learn"

**Use Maestro Recorder** (best for learning)

**Why:**
- Visual and intuitive
- See how tests work in real-time
- Learn by doing (record, play, inspect)
- Understand framework structure through exports
- No YAML knowledge required initially

**Learning path:**
1. Record simple tests (navigation, taps)
2. Play back and debug
3. Export and see generated YAML
4. Learn YAML syntax from examples
5. Graduate to manual YAML editing

**Verdict:** Recorder is the best learning tool

---

### Scenario 6: "I need to train my QA team"

**Use Maestro Recorder** (ideal for training)

**Why:**
- No coding required
- Visual and intuitive
- Immediate feedback
- Team can learn by exploring
- Share recordings for documentation

**Training approach:**
1. Show recorder UI walkthrough
2. Have team record sample flows
3. Explain playback and debugging
4. Teach export process
5. Show how to run exported tests with CLI

**Verdict:** Recorder makes training efficient

---

## Migration Guide: Studio → Recorder

If you're currently using Maestro Studio, here's how to transition:

### Before (Studio)

```bash
# 1. Start Studio
maestro studio

# 2. Find element manually
# Look through terminal output for:
# Button "Sign in" id:login_button

# 3. Write YAML manually
cat > test.yaml << EOF
- tapOn:
    id: "login_button"
EOF

# 4. Test
maestro test test.yaml

# 5. Debug failures
# Re-run Studio, find element again, update YAML
```

### After (Recorder)

```bash
# 1. Start Recorder
./scripts/recorder/start-recorder.sh

# 2. Click Record
# Tap "Sign in" on device

# 3. Element automatically captured
# Step appears: "tapOn: Sign in"

# 4. Play back to verify
# Click Play button

# 5. Export when ready
# Click Export → Framework format
```

**Time saved:** 70-80% faster workflow

---

## Feature Comparison Chart

```
                   Maestro CLI    Maestro Studio    Maestro Recorder
                   ───────────────────────────────────────────────────
Test Execution           ●●●●●             ○○○○○             ●●●●●
Element Finding          ○○○○○             ●●●●○             ●●●●●
Recording                ○○○○○             ○○○○○             ●●●●●
Debugging                ●○○○○             ●●○○○             ●●●●●
Visual Tools             ○○○○○             ●○○○○             ●●●●●
Network Monitor          ○○○○○             ○○○○○             ●●●●●
Script Generation        ○○○○○             ○○○○○             ●●●●●
CI/CD Integration        ●●●●●             ○○○○○             ●○○○○
Learning Curve           ●●●○○             ●●●○○             ●●●●●
Team Collaboration       ●●○○○             ○○○○○             ●●●●○

Legend: ● = Strong support  ○ = No/Weak support
```

---

## Recommendations

### For QA Engineers
✅ **Use Recorder for:**
- Creating new tests
- Debugging failures
- Learning the app
- Generating test documentation

✅ **Use CLI for:**
- Running tests in CI/CD
- Executing test suites
- Bulk test execution

✅ **Use Studio when:**
- Recorder is not available
- Quick locator lookup needed

---

### For Developers
✅ **Use CLI for:**
- Running tests locally
- Pre-commit test execution
- Quick smoke tests

✅ **Use Recorder for:**
- Understanding QA tests
- Reproducing bugs
- Creating regression tests

---

### For Test Automation Architects
✅ **Use Recorder for:**
- Designing test patterns
- Training team members
- Creating framework guidelines
- Generating example tests

✅ **Use CLI for:**
- Pipeline integration
- Performance testing
- Headless execution

---

## Summary

| Use Case | Tool | Why |
|----------|------|-----|
| Create new test | **Recorder** | Visual, automatic YAML generation |
| Debug test failure | **Recorder** | Visual debugging, step-through |
| Find element locator | **Studio** or **Recorder** | Both work, Recorder has more context |
| Run tests in CI/CD | **CLI** | Lightweight, scriptable |
| Train QA team | **Recorder** | Intuitive, visual learning |
| Quick smoke test | **CLI** | Fast, no setup |
| Explore app structure | **Recorder** | Live preview, hierarchy tree |
| Generate documentation | **Recorder** | Screenshots, step descriptions |

---

## Getting Started

### Install All Tools

```bash
# 1. Install Maestro CLI
brew install maestro

# 2. Install Maestro Recorder
./scripts/recorder/install-recorder.sh

# All set! Now you can use:
maestro --help                           # CLI commands
maestro studio                            # Studio inspection
./scripts/recorder/start-recorder.sh      # Recorder UI
```

---

## Documentation Links

- **Maestro CLI:** [Maestro Official Docs](https://docs.maestro.dev/)
- **Maestro Reference:** [Commands](https://docs.maestro.dev/reference/commands-available) · [Selectors](https://docs.maestro.dev/reference/selectors)
- **Maestro Studio:** Included with CLI (`maestro studio --help`). Auto-started by the recorder's `start-recorder.sh` for the fast hierarchy path.
- **Maestro Recorder:**
  - [Complete Guide](./MAESTRO_RECORDER.md)
  - [Recorder README](../../utilities/maestro-recorder/README.md)
  - In-app: click **View Documentation** in the recorder UI

---

## Questions?

**Which tool should I use?**
- Start with Recorder for most tasks
- Use CLI for CI/CD and bulk execution
- Use Studio only for quick element lookups

**Can I use multiple tools together?**
- Yes! Create tests with Recorder, run with CLI
- Find locators with Studio, use in Recorder
- Record flows, export YAML, customize manually

**Do I need all three tools?**
- CLI: Required (for running tests)
- Recorder: Highly recommended (saves time)
- Studio: Optional (Recorder can do everything Studio does)

---

**Happy testing! 🎬**
