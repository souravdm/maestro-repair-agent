# Prompt: Evaluate, Fix and Validate Failed Maestro Test Suite

Use this prompt at the start of a new Claude Code session when you have a failing suite and
want to investigate, fix, and validate on both platforms before committing anything.

**Fill in the bracketed values before pasting.**

---

## The Prompt

```
# TASK: Evaluate, Fix and Validate Failed Maestro Test Suite

### WHAT FAILED
Working directory:    /Users/c113157/Documents/Test-Automation/framework/dual-app-ui-tests
Suite file:           [e.g., .maestro/apps/health100/suites/H100-Smoke.yaml]
IOS Test report:      [e.g., test-reports/IOS_20260901_070318/]
Android Test report:  [e.g., test-reports/ANDROID_20260901_112443/]

Before doing anything else, read both test reports to extract the failing flows:
  cat [IOS Test report]/suite-report.json | grep -i '"status":"FAILED"'
  cat [Android Test report]/suite-report.json | grep -i '"status":"FAILED"'
List every flow that failed on Android but passed on iOS, and every flow that failed on
iOS but passed on Android. These are the flows you will investigate and fix.
If either report file does not exist or is empty, tell me — do not guess which flows failed.

---

### MANDATORY BEFORE TOUCHING ANY FILE

For each failing flow extracted from the report, do this in order:

1. Read the flow YAML completely for every flow whose result doesn't match between iOS
   and Android. Note every `runScript:` and `runFlow:` call — these are the files you
   must read next.

2. For each screen JS loaded by the flow (via `runScript:`):
   Read the full `.js` file.
   Note the output namespace it sets and every key in that namespace.

3. For each subflow on the failing path:
   Confirm it exists on disk with: `ls .maestro/subflows/<Feature>/`
   Read the subflow YAML completely.
   Find the exact failing step and its line number.

4. Navigate the simulator/emulator to the screen where the flow fails.
   Call `inspect_screen` via the Maestro MCP tool to get the live element hierarchy.
   Compare the live element text or id against the value defined in the screen JS key.

5. State the root cause in this exact format before making any change:
   - Failing step: `<command>` at `<file>:<line>`
   - Screen JS: `<path>`, key `<key>`, current value `"<value>"`
   - Live hierarchy shows: `"<actual text/id>"`
   - Root cause: `<one sentence>`

6. Pre-edit gate: list every file and line number you will change, and why.
   Wait for my approval before making any edit.

---

### STEP 2 — FIX

- Inspect the live hierarchy to see the exact text values Maestro reads.
- Selector changed in the app → fix ONLY in the screen JS file.
  The `${output.X.Y}` reference in the YAML must not be touched.
- Flow logic wrong → fix only in the YAML.
- GraalJS error → fix only in the `.js` script file.
- Never write a raw string in `assertVisible`, `tapOn`, `assertNotVisible`,
  `extendedWaitUntil`, or `scrollUntilVisible`. Every value must be `${output.*.*}`.
- Never create or reference a subflow that does not already exist on disk.
- Use the Maestro MCP tool to run the flow step by step in debug mode so the actual
  screen can be captured where it fails; update the step using the actual object from
  the screen's live hierarchy.
- Don't assume fixes — run the actual flow, identify the issue at runtime, then fix it.
- Don't do bulk validation or bulk fixes.
- Don't assume a bulk update will fix multiple issues at once.
- If a flow works on Android and fails on iOS, make sure the iOS fix does not break the
  Android result.
- If a flow works on iOS and fails on Android, make sure the Android fix does not break
  the iOS result.

---

### STEP 3 — VALIDATE each failing flow on both iOS simulator and Android emulator

Run from dual-app-ui-tests/.
For each failing flow extracted from the report:
  1. Update H100-Single-Test.yaml to point at that flow.
  2. Run:
       bash scripts/testing/run-test-suite.sh \
         .maestro/apps/health100/suites/H100-Single-Test.yaml \
         --device [iOS simulator UDID, e.g. 8DEBB443-8602-4443-9E72-E73D74A88333] \
         --platform ios \
         --no-browser
  3. Run:
       bash scripts/testing/run-test-suite.sh \
         .maestro/apps/health100/suites/H100-Single-Test.yaml \
         --device [Android device/emulator id, e.g. emulator-5554] \
         --platform android \
         --no-browser

Once every individual flow passes on both iOS and Android, move on to Step 4.

---

### STEP 4 — VALIDATE ON FULL SUITE

If the number of Android failures was higher than iOS, run the Android full suite first:

  bash scripts/testing/run-android-test.sh [suite file]

  Wait for full completion. Then run the iOS full suite:

  bash scripts/testing/run-ios-test.sh [suite file]

Else, if the number of iOS failures was higher than Android, run the iOS full suite first:

  bash scripts/testing/run-ios-test.sh [suite file]

  Wait for full completion. Then run the Android full suite:

  bash scripts/testing/run-android-test.sh [suite file]

---

### STEP 5 — PUSH TO GITHUB

Only execute this step if BOTH Step 3 and Step 4 passed with zero failures.

- Run: git branch --show-current
- Tell me the branch name and wait for my confirmation before proceeding.
- Stage only the specific files that were changed — no `git add -A` or `git add .`.
- Verify no lowercase `account/` or `common/` entries appear with: `git status`
- Commit message format: `fix: [what was fixed] [skip ci]`
- No Co-Authored-By line in the commit message.
- Do not push unless I explicitly say "push".

If either iOS or Android failed: stop here. Report which flows still fail and what
the new error is. Do not commit or push anything.

---

### HARD CONSTRAINTS (always active, no exceptions)

1. Never run any git operation without my explicit confirmation of the branch name first.
2. Never commit or push if either validation failed.
3. Always call inspect_screen before writing or changing any selector.
4. All selectors in YAML must be ${output.<namespace>.<key>} — no raw strings, ever.
5. Fix selectors in screen JS files only — never directly in YAML.
6. Run run-ios-test.sh before run-android-test.sh, in that order.
7. Do not add extra flags or environment overrides to run-ios-test.sh or run-android-test.sh.
8. Never invent a subflow path — confirm it exists on disk first.
9. Never use git add -u or git add . — stage files by explicit path only.
10. The pre-edit gate is mandatory: list every file and line number, then wait for approval.
11. If a flow works on one platform and fails on the other, make sure the fix for the
    failing platform does NOT break the platform where it already works.
```

---

## How to Fill In the Values

| Placeholder            | Where to find it                                                                 |
| ----------------------- | --------------------------------------------------------------------------------- |
| `Suite file`           | The `.yaml` file you ran, relative to `dual-app-ui-tests/`                        |
| `IOS Test report`      | `ls -t test-reports/IOS_* \| head -1` in `dual-app-ui-tests/` gives the latest iOS folder |
| `Android Test report`  | `ls -t test-reports/ANDROID_* \| head -1` in `dual-app-ui-tests/` gives the latest Android folder |

Claude reads the failing flows from both reports and diffs them — you do not need to list
which flows failed yourself.

---

## Framework Structure — Quick Reference

```
.maestro/
├── flows/<Feature>/          # Top-level test YAMLs (TC-numbered)
│   └── {AppCode}_{FeatureCode}_TC{###}_{camelCaseName}.yaml
├── subflows/<Feature>/       # Reusable YAML components (always uppercase dirs)
│   ├── Account/
│   ├── Common/               # launchAndSetup.yaml, dismissOverlays.yaml, etc.
│   └── ...
├── screens/<Feature>/        # Page Object Model — pure JS files
│   ├── Account/
│   │   └── LoginScreen.js    # exports output.account_login.*, output.account_h100_login.*, etc.
│   ├── Common/
│   │   └── CommonScreen.js   # exports output.common_buttons.*, output.common_messages.*
│   └── ...
├── config/
│   ├── credentials-loader.js # loads output.user.* from the named credential set
│   └── *.yaml                # app config, test users, environments
└── apps/<app>/suites/        # Suite YAML files that group flows for CI
```

### Additional framework rules (background reference)

These are still true and still enforced by convention, even though the active prompt
above keeps the FIX step lean. Read them once; you rarely need to restate them per fix.

- **Screen JS files load via `runScript` in the flow body, not `onFlowStart`.**
  `onFlowStart:` is ignored when a flow is called as a subflow, so screen scripts must be
  loaded via `- runScript:` in the flow body — that way they work both as top-level flows
  and as subflows.
- **`appId` is always a variable.** All flows and subflows must use `appId: ${APP_ID}` —
  never a hardcoded bundle ID.
- **Credentials load via `credentials-loader.js` in `onFlowStart`.** User email,
  password, and DOB are resolved from `output.user.*` via:
  ```yaml
  onFlowStart:
    - runScript:
        file: ../../config/credentials-loader.js
        env:
          loginData: LOA2   # or DEAN_FANT, BRAYDEN, etc.
  ```
  Never write raw credential values in YAML. Never use the old
  `env: USERNAME: ${COMMON_USER}` pattern.
- **File naming convention.** New flow files follow:
  `{AppCode}_{FeatureCode}_TC{###}_{camelCaseName}.yaml`
  Examples: `H100_ACCT_TC001_dashboardNavigation.yaml`,
  `H100_HS-0.1.0_smoke_homescreen_loads_successfully_guest.yaml`
- **Subflow/screen path casing.** Always use uppercase for feature directories under
  `.maestro/subflows/` and `.maestro/screens/`:
  `.maestro/subflows/Account/` ← correct
  `.maestro/subflows/account/` ← wrong (git index tracks uppercase only)

### How selectors flow from screen JS to YAML

```
LoginScreen.js
  output.account_login = {
    emailLabel: "Mobile number or email",   ← defined here
    ...
  }

login.yaml
  - assertVisible: ${output.account_login.emailLabel}  ← referenced here, never changed
```

If the app changes "Mobile number or email" to "Email address":

- **Change**: `LoginScreen.js` → `emailLabel: "Email address"`
- **Do not touch**: `login.yaml` (the `${output.account_login.emailLabel}` reference stays)

---

## Running a Single Flow Instead of a Full Suite

Update `.maestro/apps/health100/suites/H100-Single-Test.yaml` to reference the flow
you want to test, then run:

```bash
# iOS
bash scripts/testing/run-test-suite.sh \
  .maestro/apps/health100/suites/H100-Single-Test.yaml \
  --device 8DEBB443-8602-4443-9E72-E73D74A88333 \
  --platform ios \
  --no-browser

# Android
bash scripts/testing/run-test-suite.sh \
  .maestro/apps/health100/suites/H100-Single-Test.yaml \
  --device emulator-5554 \
  --platform android \
  --no-browser
```

Run from inside `dual-app-ui-tests/`. Use this in Step 3 to re-validate each failing flow
on both platforms before running the full suites in Step 4.

---

## Key Script Details

| Script                            | Simulator / Device                                                              | Maestro binary                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `scripts/testing/run-ios-test.sh`     | `SIMULATOR_ID=8DEBB443-8602-4443-9E72-E73D74A88333` (hardcoded)               | `/Users/c113157/Documents/Test-Automation/framework/maestro/bin/maestro` (hardcoded) |
| `scripts/testing/run-android-test.sh` | Auto-detected via`adb devices` where `com.health100.launchers` is installed | Same path (hardcoded)                                                                  |

Both scripts run `scripts/validate/cross-platform-check.sh` as a preflight.
If that check fails, fix it before running tests.

Both scripts call `scripts/testing/run-test-suite.sh` which produces:

- `test-reports/<PLATFORM>_<TIMESTAMP>/suite-results.json`
- `test-reports/<PLATFORM>_<TIMESTAMP>/suite-report.json`
- `test-reports/<PLATFORM>_<TIMESTAMP>/suite-report.html`

`suite-report.json` is what Step 1 greps for `"status":"FAILED"` — it carries a flat
`tests[]` array with `name`, `status`, and `failureReason` per test, which is easier to
grep/diff across platforms than the HTML report.

---

## Common Failure Categories and Where to Fix Them

| Failure message                                       | Root cause                                                      | Fix location                                                           |
| ----------------------------------------------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `assertVisible failed: "${output.X.Y}" not visible` | Text changed in app OR wrong screen state                       | `screens/<Feature>/<Screen>.js` — update the key value              |
| `Element not found: text="${output.X.Y}"`           | Selector changed, OR element is at wrong index                  | `screens/<Feature>/<Screen>.js` — update value or add `Index` key |
| `Assertion is false: visible("...")`                | Full-string match failed (Maestro uses Java`Pattern.matches`) | Add`.*` suffix in screen JS value, e.g. `"Just need to verify.*"`  |
| `runFlow file not found`                            | Wrong relative path OR file renamed                             | Check actual file path with`ls`; update reference in calling YAML    |
| GraalJS SyntaxError                                   | JS error in a`runScript` file                                 | Fix the`.js` file directly                                           |
| `pressKey: Back` cleared a field                    | iOS pressKey navigates the stack, not dismisses keyboard        | Remove`pressKey: Back`; use `tapOn` instead                        |
| `index: 0` taps label not field                     | Static label and input share the same text                      | Change index in screen JS to the platform-correct value                |
| Partial text match fails                              | Maestro uses full-string Java regex match                       | Append`.*` to the string in the screen JS value                      |
| One platform fails, the other passes                  | Platform-specific timing, index, or missing override             | Fix in the screen JS for that platform only — never regress the passing platform |

---

## Investigation Checklist (run through this before stating a root cause)

```
□ Read both platform test reports (suite-report.json) and diffed the failing flows —
  failed on Android but passed on iOS, and vice-versa
□ Read the failing flow YAML completely — noted every runScript and runFlow call
□ Read every screen JS file the flow loads — noted each output namespace and all keys
□ Read every subflow the flow calls that is on the failing path
□ Confirmed every subflow path exists on disk with ls
□ Called inspect_screen (Maestro MCP) to get the live element hierarchy
□ Compared the live element text/id against the screen JS key value
□ Identified which LAYER is wrong: screen JS value | flow logic | GraalJS error
□ Stated the root cause in the required format
□ Listed every file + line number I will change
□ Waited for approval before making any edit
□ Confirmed the fix for the failing platform will not break the platform where the
  flow already passes
```

---

## Sample Prompt — H100-Smoke.yaml Has Failures

This is the exact text you paste into a new Claude Code session.
Only the suite file and the two report folders need to be filled in — Claude reads the
failing flows from the reports themselves.

---

```
# TASK: Evaluate, Fix and Validate Failed Maestro Test Suite

### WHAT FAILED
Working directory: /Users/c113157/Documents/Test-Automation/framework/dual-app-ui-tests
Suite file:        .maestro/apps/health100/suites/H100-Benefits-DCArd+Innetwork+PriorAuth+Providers+Spending.yaml
IOS Test report:      test-reports/IOS_20260901_070318/
Android Test Report : test-reports/ANDROID_20260901_112443

Before doing anything else, read the test report to extract the failing flows:
  cat test-reports/IOS_20260901_070318/suite-report.json | grep -i '"status":"FAILED"'
  cat test-reports/ANDROID_20260901_112443/suite-report.json | grep -i '"status":"FAILED"'
List every failing flow path you found failed in android results but passed in iOS results and vice-versa the flows which passed in android test results and failed in iOS results. These are the flows you will investigate and fix.
If the report file does not exist or is empty, tell me — do not guess which flows failed.

---

### MANDATORY BEFORE TOUCHING ANY FILE

For each failing flow extracted from the report, do this in order:

1. Read the flow YAML completely whose results doesn’t match between iOS and Android results.
   Note every runScript: and runFlow: call — these are the files you must read next.

2. For each screen JS loaded by the flow (via runScript:):
   Read the full .js file.
   Note the output namespace it sets and every key in that namespace.

3. For each subflow on the failing path:
   Confirm it exists on disk with: ls .maestro/subflows/<Feature>/
   Read the subflow YAML completely.
   Find the exact failing step and its line number.

4. Navigate the simulator to the screen where the flow fails.
   Call inspect_screen via the Maestro MCP tool.
   Compare the live element text or id against the value defined in the screen JS key. Inspect the live hierarchy to see the exact text values Maestro reads

5. State the root cause in this exact format before making any change:
   - Failing step: <command> at <file>:<line>
   - Screen JS: <path>, key <key>, current value "<value>"
   - Live hierarchy shows: "<actual text/id>"
   - Root cause: <one sentence>

6. Pre-edit gate: list every file and line number you will change, and why.
   Wait for my approval before making any edit.

---

### STEP 2 — FIX

Rules:
- inspect the live hierarchy to see the exact text values Maestro reads
- Selector changed in the app → fix ONLY in the screen JS file.
  The ${output.X.Y} reference in the YAML must not be touched.
- Flow logic wrong → fix only in the YAML.
- GraalJS error → fix only in the .js script file.
- Never write a raw string in assertVisible, tapOn, assertNotVisible,
  extendedWaitUntil, or scrollUntilVisible. Every value must be ${output.*.*}.
- Never create or reference a subflow that does not already exist on disk.
- Use Maestro MCP to run each of the workflow step by step in debug mode so that the actual screen can be captured where it is failing, update the step accordingly using the actual object from the screen using the Maestro hierarchy.
- Don't assume fixes, carry out the actual flow, identify the issue at runtime, capture it, and then fix it.
- Don't try to do bulk validation or bulk fixes
- Don't assume bulk updates will fix the issues at one go.
- If flow works in android and it fails in iOS, make sure that the fix for iOS doesn’t break android test
- If flow works in iOS and it fails in android, make sure that the fix for android doesn’t break iOS test

---

### STEP 3 — VALIDATE each of the failing test flows on both iOS simulator and android emulator

Run from dual-app-ui-tests/.
For each failing flow extracted from the report:
  1. Update H100-Single-Test.yaml to point at that flow.
  2. Run:
       bash scripts/testing/run-test-suite.sh \
         .maestro/apps/health100/suites/H100-Single-Test.yaml \
         --device 8DEBB443-8602-4443-9E72-E73D74A88333 \
         --platform ios \
         --no-browser
 3.  Run:
       bash scripts/testing/run-test-suite.sh \
         .maestro/apps/health100/suites/H100-Single-Test.yaml \
         --device emulator-5554 \
         --platform android \
         --no-browser

Once every individual flow passes in both iOS and android, then only go to step 4.


### STEP 4 — VALIDATE ON  FULL Suite

If no. of failures of Android were higher than iOS then run the android full suite first :


  	bash scripts/testing/run-android-test.sh .maestro/apps/health100/suites/H100-Benefits-DCArd+Innetwork+PriorAuth+Providers+Spending.yaml

    	Wait for full completion. Followed by run the iOS full suite :


	bash scripts/testing/run-ios-test.sh .maestro/apps/health100/suites/H100-Benefits-DCArd+Innetwork+PriorAuth+Providers+Spending.yaml



Else If no. of failures of iOS were higher than android then run the iOS full suite first :

	bash scripts/testing/run-ios-test.sh .maestro/apps/health100/suites/H100-Benefits-DCArd+Innetwork+PriorAuth+Providers+Spending.yaml


	Wait for full completion. Followed by run the android full suite :


	bash scripts/testing/run-android-test.sh .maestro/apps/health100/suites/H100-Benefits-DCArd+Innetwork+PriorAuth+Providers+Spending.yaml
---

### STEP 5 — PUSH

Only if BOTH Step 3 and Step 4 passed with zero failures.

- Run: git branch --show-current
- Tell me the branch name and wait for my confirmation before proceeding.
- Stage only the specific files that were changed — no git add -A or git add .
- Commit message: fix: [what was fixed] [skip ci]
- No Co-Authored-By line.
- Do not push unless I explicitly say "push".

---

### HARD CONSTRAINTS

- Never run any git operation without my explicit confirmation of the branch name.
- Never commit or push if either validation failed.
- Always call inspect_screen before writing or changing any selector.
- All selectors in YAML must be ${output.<namespace>.<key>} — no raw strings, ever.
- Fix selectors in screen JS files only — never directly in YAML.
- Run run-ios-test.sh before run-android-test.sh, in that order.
- Do not add extra flags or overrides to run-ios-test.sh or run-android-test.sh.
- Never invent a subflow path — confirm it exists on disk first.
- Never use git add -u or git add . — stage files by explicit path only.
- The pre-edit gate is mandatory: list every file and line number, then wait for approval.
- if a flow is function in one platform and failed in another platform, make sure the changes you are making to fix the broken flow doesn’t impact the working flow working on the other platform. Means if you are making fix for iOS, it should NOT break android and if you are making fix for android it should NOT break iOS.
```

---

**How to adapt this prompt to your actual run:**

| What to fill in | Where to get the value |
|---|---|
| `Suite file` | The `.yaml` file you ran, relative to `dual-app-ui-tests/` |
| `IOS Test report` | `ls -t test-reports/IOS_* \| head -1` in `dual-app-ui-tests/` gives the latest iOS folder |
| `Android Test report` | `ls -t test-reports/ANDROID_* \| head -1` in `dual-app-ui-tests/` gives the latest Android folder |

Claude reads the failing flows from both reports — you do not need to list them.
