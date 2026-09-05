# Scripts Skills Reference

Catalog of every file under `scripts/` — what each script does and when to use it.

---

## Root Scripts

| File | Purpose |
|------|---------|
| `run-maestro.sh` | Thin wrapper around the `maestro` CLI — sets up env vars and delegates to Maestro. Use for ad-hoc single-flow runs. |
| `parallel-test.sh` | Distributes flows across multiple booted simulators/emulators in parallel. Reduces suite wall-clock time by up to N× (N = simulator count). |

---

## `analysis/`

Static analysis and audit tools. Run locally or in CI to inspect test health.

| File | Purpose |
|------|---------|
| `android-parity-audit.js` | Scans all flows and subflows for iOS-only constructs (e.g. `tapOn` with iOS accessibilityIds) to flag Android parity gaps. |
| `selector-health-check.js` | Extracts all selectors from every YAML flow (6 700+). Run with `--find <text>` to locate where a specific element is referenced. |
| `test-coverage-map.js` | Generates `test-reports/coverage-map.html` — a visual map of which domains/features have smoke and regression coverage. |

---

## `build/`

App build scripts for simulator/emulator. Called by GitHub Actions CI workflows.

| File | Purpose |
|------|---------|
| `build.sh` | **iOS build orchestrator.** Clones the iOS repo, runs `pod install`, invokes `xcodebuild` for simulator, and injects a LaunchDarkly invite-only override via `xcrun simctl spawn`. |
| `detect-build-config.sh` | Reads `build_config.yaml` and resolves the correct bundle ID for the current `BUILD_CONFIG` (debug/adhoc/release) and app flavor. |

---

## `ci/`

Multi-app CI orchestration. Wraps the test runner for CI-specific routing.

| File | Purpose |
|------|---------|
| `run-multi-app-tests.sh` | Runs tests for multiple app flavors in sequence. Routes each flavor's suite through `scripts/testing/test.sh` with the correct `config.env` applied. |

---

## `integrations/slack/`

Slack notification scripts. Send test results to Slack channels.

| File | Purpose |
|------|---------|
| `send-report.sh` | Shell wrapper to post a report summary message to a Slack webhook URL. |
| `slack-notify.js` | Node.js Slack notifier. Posts rich Block Kit messages with pass/fail counts, run duration, and a link to the HTML report. |

---

## `integrations/zephyr/`

Zephyr Scale (Jira test management) integration. Syncs results from Maestro runs into Zephyr test cycles.

| File | Purpose |
|------|---------|
| `create-test-cycle.js` | Creates a new Zephyr Scale test cycle for the current run. Returns the cycle ID used by other scripts. |
| `format-cycle-summary.js` | Formats a human-readable summary of the test cycle (pass rate, failed tests, environment) for Slack or Confluence. |
| `generate-report-url.js` | Builds the Zephyr Scale deep-link URL for a given test cycle ID. |
| `sync-test-cases.js` | Ensures test cases in Zephyr match what's in the YAML flows — creates missing cases, updates names. |
| `upload-test-results.js` | Parses Maestro JSON output and POSTs results (pass/fail/skip per test) to Zephyr Scale via the REST API. |
| `verify-installation.sh` | Checks that the required Node packages and Zephyr API credentials are in place before running any Zephyr script. |
| `zephyr-config.js` | Central config — Zephyr base URL, project key, auth token env var name. Import this in other Zephyr scripts. |
| `zephyr-scale-client.js` | Axios-based HTTP client for the Zephyr Scale REST API. Handles auth headers, retries, and error formatting. |
| `test-case-mapper.json` | Static mapping from Maestro flow filenames to Zephyr test case keys. Edit when adding new flows. |

---

## `network/`

Network log capture and parsing. Captures HTTP/S traffic from running app tests.

| File | Purpose |
|------|---------|
| `capture-network-logs.js` | Hooks into the device's network traffic during a test run and writes raw log entries to a JSON file. |
| `extract-app-internal-logs.js` | Extracts internal app log lines (non-network) from the device log stream — useful for debugging auth and feature flag states. |
| `parse-network-logs.js` | Reads raw network log JSON, applies exclusion rules from `network-exclude.yaml`, and outputs a cleaned call list ready for the HTML report. |
| `network-exclude.yaml` | Config file listing domains and URL patterns to exclude from the parsed network log. No code changes needed — edit this file to filter noisy calls. |

---

## `recorder/`

Maestro Recorder backend. Provides a local HTTP server that integrates with Maestro Studio for test recording.

| File | Purpose |
|------|---------|
| `start-recorder.sh` | **Main entry point.** Starts Maestro Studio, the hierarchy server, and the frontend in one command. |
| `stop-recorder.sh` | Kills all recorder processes started by `start-recorder.sh`. |
| `restart-recorder.sh` | Stops then starts the recorder — useful after a crash. |
| `hierarchy-server.js` | Express server that proxies UI hierarchy requests to Maestro Studio (fast path) or falls back to the Maestro CLI. Serves the recorder frontend. |
| `install-recorder.sh` | Installs Node dependencies required by the recorder backend. Run once after cloning. |
| `fix-dependencies.sh` | Patches known dependency conflicts in the recorder's `node_modules` (e.g. AJV version mismatches). |
| `fix-openssl.sh` | Sets the `NODE_OPTIONS=--openssl-legacy-provider` workaround for older OpenSSL on macOS. Run if the recorder fails with an OpenSSL error. |
| `quick-fix-ajv.sh` | One-liner fix for the AJV v6/v8 conflict that surfaces with some Node versions. |

---

## `reporting/`

HTML report generation. Produces self-contained single-file test reports.

| File | Purpose |
|------|---------|
| `generate-unified-report.js` | **Master report generator.** Reads Maestro JSON output, network logs, env-info, and run history; produces a self-contained HTML report with pass/fail counts, API call table, sparkline, resizable sidebar, and deep links. |
| `generate-api-calls.js` | Standalone script to regenerate only the API calls section of a report from existing network log files. |
| `live-dashboard-server.js` | WebSocket server that streams test progress events in real time. Used by the live dashboard frontend. |
| `suite-live-dashboard.js` | Frontend logic for the live test suite dashboard (connects to `live-dashboard-server.js`). |
| `start-live-dashboard.sh` | Shell script that starts the live dashboard server and opens the browser. |
| `regenerate-suite-report.sh` | Re-runs `generate-unified-report.js` for an existing dated report directory — useful if the report was generated before all network logs were written. |
| `figma-visual-diff.js` | Fetches a Figma design frame and compares it to a screenshot baseline. Outputs a diff image and a match score. |
| `assets/cvs-logo.png` | CVS Health logo embedded in generated HTML reports. |
| `assets/health100-logo.png` | Health100 logo (PNG) embedded in generated HTML reports. |
| `assets/health100-logo.svg` | Health100 logo (SVG) — used where vector quality is needed. |

---

## `self-heal/`

Autonomous test self-healing. Attempts to fix failing selectors using ML-assisted element matching.

| File | Purpose |
|------|---------|
| `heal-agent.js` | Orchestrator. Detects a failed selector from a Maestro error, invokes `element-matcher.js`, and calls `screen-patcher.js` to update the YAML. |
| `element-matcher.js` | Given a target element description and the current screen hierarchy, ranks candidate elements by similarity (text, type, position). |
| `screen-patcher.js` | Reads a YAML flow file and replaces a broken selector with a healed one. Writes the patched file in place. |

---

## `setup/`

One-time environment setup and diagnostics.

| File | Purpose |
|------|---------|
| `ios-setup.sh` | Installs iOS prerequisites: Maestro CLI, Xcode Command Line Tools check, CocoaPods. Run once on a new Mac CI runner. |
| `android-setup.sh` | Installs Android prerequisites: Java, Android SDK components, Maestro CLI, emulator image. Run once on a new Linux CI runner. |
| `clean-android-emulator.sh` | Wipes and recreates the Android emulator AVD — use when the emulator is in a broken state. |
| `diagnose.sh` | Prints environment diagnostics: Maestro version, Node version, connected devices, available simulators. Run first when debugging CI failures. |
| `load-credentials.js` | Reads `.maestro/config/credentials.json` (or Vault) and exports the requested user's credentials as env vars for the test session. |
| `setup-maestro-wrapper.sh` | Configures the `MAESTRO_DRIVER` env var and any Maestro-specific environment needed before running tests. |

---

## `testing/`

Specialized test runners for accessibility, performance, and cross-platform execution.

| File | Purpose |
|------|---------|
| `test.sh` | **Primary test runner.** Accepts a flow file, directory, or suite YAML. Supports `--retry N`, `--fail-fast`, env-info capture, and run-history tracking. Called by all CI scripts. |
| `run-test-suite.sh` | Unified Maestro runner invoked by all CI scripts. Accepts suite YAML path, environment, and flavor. |
| `run-both-platforms.sh` | Runs the same test suite on iOS and Android sequentially, then merges reports. |
| `accessibilityTester.js` | Drives accessibility assertions — checks WCAG contrast, missing labels, and touch target sizes via the UI hierarchy. |
| `integratedAccessibilityTester.js` | Combines `accessibilityTester.js` with live Maestro flow execution for end-to-end a11y validation. |
| `run-accessibility-tests.js` | CLI entry point for the accessibility tester. Accepts a flow file or directory. |
| `voiceOverTester.js` | Simulates VoiceOver navigation order on iOS and validates focus sequence against a spec. |
| `performanceTester.js` | Measures frame rate, CPU, and memory during a Maestro flow by polling `simctl` or `adb shell dumpsys`. |
| `run-performance-tests.js` | CLI entry point for the performance tester. Outputs a JSON metrics file per flow. |
| `testExecutionWithDynamicHandler.js` | Advanced runner that dynamically handles intermittent UI changes (banners, permission dialogs) mid-flow without failing. |

---

## `utils/accessibility/`

Pulse design-system and a11y hierarchy validation.

| File | Purpose |
|------|---------|
| `a11y-hierarchy-validator.js` | Validates the UI hierarchy from a captured XML against a11y rules (missing labels, role mismatches, tab order). |
| `pulse-component-validator.js` | Checks that Pulse design-system components rendered on screen match expected accessibility properties (label, role, state). |

---

## `utils/analysis/`

Failure analysis and performance monitoring utilities.

| File | Purpose |
|------|---------|
| `failure-analyzer.js` | Parses Maestro failure output to extract the failing step, selector, and screenshot path. Feeds into `heal-agent.js`. |
| `ml-analysis-engine.js` | Uses a local ML model (or OpenAI API) to classify failure types (selector-miss, timing, network, crash) and suggest fixes. |
| `parseFailureLocation.js` | Extracts the YAML file path and line number from a Maestro error stack trace. |
| `performance-monitor.js` | Continuously polls device metrics (CPU, memory, FPS) during a test run and writes a time-series JSON log. |

---

## `utils/api/`

API test data runners and helpers. Exercises backend APIs directly to validate test data state.

| File | Purpose |
|------|---------|
| `runner.js` | **Main API runner.** Executes a sequence of request scripts in order, handles auth token chaining, and writes a report. |
| `test-data-runner.js` | Variant of `runner.js` focused on test data validation — asserts API responses match expected values for known test users. |
| `update-test-data-report.js` | Re-runs test data assertions and updates the report HTML in place. |
| `parse-test-data-report.js` | Reads a generated test data report HTML and extracts pass/fail counts for CI summary output. |
| `lib/report-generator.js` | Generates the HTML test data validation report from structured result objects. |
| `lib/request-helper.js` | Axios wrapper with retry, proxy support, and CVS auth header injection. |
| `lib/test-data-loader.js` | Loads test user credentials and expected values from the credentials JSON for a given user key. |
| `lib/test-data-report-generator.js` | Formats per-user, per-endpoint assertion results into a structured report object. |
| `requests/01-authenticated/*.js` | CVS Health authentication flow: guest token → account lookup → OTP generate/get/validate → DOB validate → MFA → profile. |
| `requests/02-pe/*.js` | CVS Health Personalization Engine endpoints: health, shop, discovery, med-reminder. |
| `requests/03-benefits/*.js` | CVS Health benefits: plan summaries endpoint. |
| `requests/h100/01-authenticated/*.js` | Health100 authentication flow — mirrors CVS Health flow with H100-specific endpoints. |
| `requests/h100/02-pe/*.js` | Health100 PE endpoints: health, discovery, med-reminder, HAIO. |
| `requests/h100/03-benefits/*.js` | Health100 benefits: plan summaries. |
| `requests/h100/05-home/*.js` | Health100 home screen: HAIO insights endpoint. |

---

## `utils/dashboard/`

AI-assisted test generation. Uses screen objects, prompts, and Ollama/LLM to generate Maestro YAML from UI hierarchies.

| File | Purpose |
|------|---------|
| `docs-screen-registry.js` | Registry mapping screen names to their captured hierarchy JSON files. Used by the test generator to load the right screen. |
| `docs-subflow-registry.js` | Registry of available subflow YAML files and their documented purposes. Used to resolve subflow references during generation. |
| `docs-testdata-registry.js` | Registry of test data keys and the users/values each key maps to. Used by the generator to inject correct credentials. |
| `enhanced-test-generator.js` | Full pipeline: loads screen registry + subflows + test data, builds a prompt, calls the LLM, and validates the output. |
| `enhance-steps.js` | Post-processes raw LLM-generated YAML steps — adds waits, fixes selector formats, and injects subflow references. |
| `hybrid-test-generator.js` | Combines template-based generation (for known patterns) with LLM generation (for novel flows). |
| `few_shot_prompt.js` | Few-shot prompt template with 3–5 example flow pairs used for high-quality test generation. |
| `minimal_prompt.js` | Minimal single-instruction prompt for fast/cheap test generation — lower quality, higher speed. |
| `simple_prompt.js` | Simple one-shot prompt template. |
| `match-elements.js` | Fuzzy-matches element names from the UI hierarchy to known Pulse component names. |
| `screen-object-matcher.js` | Matches a natural-language description against screen object registry entries to find the best-fit screen. |
| `subflow-matcher.js` | Given a step description, finds the most relevant existing subflow to reuse. |
| `testdata-matcher.js` | Maps a user description ("admin user", "guest") to the correct test data key. |
| `ollama-client.js` | HTTP client for the local Ollama server. Sends prompts and streams completions. |
| `transform-to-maestro.js` | Converts a raw LLM JSON response into valid Maestro YAML format. |
| `validate-generated-test.js` | Validates generated YAML against the Maestro schema — checks required fields, selector formats, and subflow paths. |
| `yaml_validation_retry.js` | Wraps the generator with automatic retry: if validation fails, re-prompts the LLM with the error message up to 3 times. |

---

## `utils/homescreen/`

Home screen content validation (AEM / ANBA).

| File | Purpose |
|------|---------|
| `extract-anba-titles.js` | Pulls ANBA (Aetna Next Best Actions) card titles from the app's API response for a given test user. |
| `generate-individual-anba-report.js` | Generates a per-user HTML report showing which ANBA cards were returned and whether they match the expected list. |
| `inspect-aem-structure.js` | Fetches the AEM (Adobe Experience Manager) content tree for the home screen and logs the structure for debugging. |
| `validate_aem_nbas.js` | Asserts that the AEM-delivered NBAs (Next Best Actions) on the home screen match the configured expected set. |

---

## `utils/network-monitoring/`

Platform-specific network monitors. Stream network events during live test runs.

| File | Purpose |
|------|---------|
| `ios-network-monitor.js` | Taps into the iOS device's network stream via `rvictl`/`tcpdump` or Charles proxy and emits structured call events. |
| `android-network-monitor.js` | Uses `adb logcat` and the app's network-logging build flag to capture HTTP calls on Android. |

---

## `utils/performance/`

Performance data extraction.

| File | Purpose |
|------|---------|
| `perf-extract-from-log.js` | Parses a device log file for performance metric markers (FPS drops, memory warnings, slow frame annotations) and outputs a JSON summary. |

---

## `utils/reporting/`

CI metadata and test categorisation helpers used by the report generator.

| File | Purpose |
|------|---------|
| `ci-metadata-collector.js` | Reads CI environment variables (run ID, branch, commit SHA, triggering actor) and writes `meta/ci-info.json` for inclusion in the HTML report. |
| `test-categorizer.js` | Classifies each test result as smoke/regression/accessibility/performance based on its YAML tags. Used for the coverage breakdown in reports. |

---

## `utils/screen-management/`

Screen hierarchy loading and date helpers.

| File | Purpose |
|------|---------|
| `screen-preloader.js` | Pre-loads all screen hierarchy JSON files into memory at test startup to avoid filesystem reads during flow execution. |
| `extract-screen-elements.js` | Extracts all interactable elements from a captured UI hierarchy and writes a structured JSON for use by the test generator. |
| `calculateDateFilled.js` | Utility that calculates a filled/prescription date offset (e.g. "30 days ago") and returns a formatted date string for use in YAML flows. |

---

## `utils/slack-notify.js`

Standalone Slack notifier (root of utils). Posts a plain-text or Block Kit summary to a Slack webhook. Called by `integrations/slack/slack-notify.js` or directly.

---

## `utils/state-management/`

App state reset helpers.

| File | Purpose |
|------|---------|
| `reset-app-state.sh` | Clears app data/preferences on the connected device (iOS: `simctl`, Android: `adb shell pm clear`). Run between tests that require a clean state. |

---

## `utils/ui-capture/`

UI hierarchy capture and a11y correlation.

| File | Purpose |
|------|---------|
| `captureScreenHierarchy.js` | Captures the current device UI hierarchy via Maestro or `xcrun simctl` and writes it to a dated JSON file. |
| `capture-hierarchy-on-failure.js` | Hook that automatically captures the UI hierarchy when a Maestro step fails, for post-mortem analysis. |
| `setCapturedScreenName.js` | Labels the most recently captured hierarchy file with a human-readable screen name for use by the screen registry. |
| `ios-ui-inspector.js` | Connects to the iOS Accessibility Inspector API to retrieve element trees beyond what Maestro exposes. |
| `android-ui-inspector.js` | Uses `uiautomator dump` to capture the Android view hierarchy and parses it into the standard element JSON format. |
| `a11y-extract-from-log.js` | Extracts accessibility-related log lines from a device log file and maps them to element identifiers. |
| `a11y-correlate-screens.js` | Cross-references captured screen hierarchies with a11y audit results to pinpoint which screen introduced a regression. |
| `a11y-live-poller.js` | Continuously polls the device for a11y tree changes during a test run and logs any newly appearing unlabelled elements. |

---

## `utils/utils.sh`

Shared shell utilities: logging helpers (`log_info`, `log_error`, `log_success`), timestamp formatting, and common env-var checks sourced by other shell scripts.

---

## `utils/validation/`

YAML and selector validation.

| File | Purpose |
|------|---------|
| `validate-yaml.js` | Validates all YAML flow files against the Maestro schema. Reports missing required fields, unknown commands, and broken `runFlow` paths. |
| `check-maestro-paths.js` | Checks that every `file:` path referenced in suite and flow YAMLs actually exists on disk. Use before committing new flows. |
| `validate-current-screen.sh` | Asserts that the currently visible screen matches an expected screen name by comparing the UI hierarchy snapshot. |

---

## `utils/visual/`

Figma baseline management and visual regression helpers.

| File | Purpose |
|------|---------|
| `figma-baseline-sync.js` | Fetches the latest design frames from Figma and saves them as PNG baselines in `test-reports/visual-baselines/`. |
| `screenshot-deduplicator.js` | Removes duplicate screenshots from a test run directory (by MD5 hash) to reduce artifact upload size. |
| `visual-regression-setup.js` | Initialises the visual regression baseline directory and config for a new app flavor or screen. |

---

## `utils/cleanup-stale-processes.sh`

Kills leftover Maestro, simulator, and emulator processes from a previous (possibly crashed) test run. Run at the start of a CI job to ensure a clean environment.

---

## `visual-regression/`

Screenshot baseline comparison.

| File | Purpose |
|------|---------|
| `compare.sh` | Compares current test screenshots against approved baselines using ImageMagick `compare` (pixel diff) or MD5 (exact match). Exits non-zero if any diff exceeds the threshold. |
| `README.md` | Setup and usage guide for the visual regression workflow. |

---

*Last updated: August 2026*
