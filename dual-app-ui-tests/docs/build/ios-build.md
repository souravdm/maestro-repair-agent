# Health100 iOS Build Guide

> Terminal-executable, end-to-end. Every command listed here was run and verified on `ios-app` (`cvs-health-source-code/digital-flagship-ios`).
> Covers both **Main-branch build** (Part A — Debug/QA2) and **Tag build** (Part B — Alpha).

---

## Repo and CI Context

| Item | Value |
|---|---|
| **Local folder** | `framework/ios-app/` |
| **GitHub repo** | `cvs-health-source-code/digital-flagship-ios` |
| **CI system** | CircleCI (`dual-app-ui-tests/.circleci/config.yml`) |
| **CI clone path** | `/Users/distiller/ios-app` |
| **CI flavor param** | default (not `cvshealth`) → scheme `Health100`, bundle `Health100.app` |
| **Health100 scheme** | `Health100` |
| **CVS retail scheme** | `CVSOnlineiPhone` (different flavor, different repo) |

---

## Script Usage

All build steps below are automated by `scripts/build/ios-build.sh`. Run from the `dual-app-ui-tests/scripts/build/` directory:

```bash
./ios-build.sh                 # full build — all 25 steps
./ios-build.sh --skip-pods     # skip pod install (Step 7); use when pods are already installed
./ios-build.sh --build-only    # stop after build (Step 18); skip simulator install
./ios-build.sh --install-only  # sign + reinstall from existing DerivedData build (~5 min)
./ios-build.sh [flags] <UDID>  # override simulator UDID
```

**`--install-only` steps:** 2 (preflight), 20 (boot sim), 21 (sign + install), 22 (sign container), 23 (launch), 24 (inject secrets), 25 (verify).

For installing from a pre-built CI tarball without running a build, use `ios-install.sh` — see `docs/build/ios-install.md`.

---

## Script Step Map (ios-build.sh)

| Step | Function | Notes |
|---|---|---|
| 1 | Verify proxy | Zscaler at `127.0.0.1:9000` required |
| 2 | Pre-flight | Checks credentials + tools |
| 3 | Clone iOS repo | Fresh clone of `digital-flagship-ios` `main` |
| 4 | Fetch Vault secrets | Calls Vault API; writes `secrets.json` |
| 5 | Configure Swift Package Registry | Writes `registries.json`; runs `swift package-registry login` (non-fatal) |
| 6 | Patch Podfile sources | Removes SSH insteadOf rules; sets up netrc + disables osxkeychain |
| 7 | Pod install | `pod install --repo-update`; skipped with `--skip-pods` |
| 8 | Patch app source files | `inProcessPickup` case in `OrdersNavigationDrivenAdapter.swift` |
| 9 | Patch feature flags | 4 flags in `FlagshipFeatureFlags` (h100 only) |
| 10 | Resolve JFrog packages | Parses `Package.resolved` → `/tmp/cvsh-registry-packages.txt` |
| 11 | Download JFrog packages | Downloads + extracts 24 `cvsh-health100` registry packages |
| 12 | Verify JFrog packages | Confirms `Package.swift` + metadata files present for all 24 |
| 13 | Pre-download binary SPM artifacts | Runs `pre-download-spm-artifacts.py` via proxy |
| 14 | Verify GitHub credentials | `git ls-remote` against all private repos in `Package.resolved` |
| 15 | Pre-clone git packages | Shallow-clones 73 `remoteSourceControl` packages into `build/SourcePackages/checkouts/` |
| 16 | Seed workspace-state.json | Runs `seed-workspace-state.py`; must produce ≥90 dependencies |
| 17 | Fix Pod API gaps — probe build | Probe `xcodebuild` with `CIRCLECI=1`; runs `ios_fix_pod_api_gaps.py` on errors; always exits 0 |
| 18 | Build iOS app for simulator | Real `xcodebuild` with `CIRCLECI=1`; output in `build/Build/Products/Debug-iphonesimulator/` |
| 19 | Patch Vault_Vault.bundle | Copies `secrets.json` into every `Vault_Vault.bundle` inside the built `.app` |
| 20 | Boot simulator | `simctl boot`; opens Simulator.app |
| 21 | Sign + install | Ad-hoc signs unsigned SPM/Flutter frameworks; `simctl install` |
| 22 | Sign installed container | Re-signs frameworks + binary in the container path |
| 23 | Launch | `simctl launch` |
| 24 | Inject secrets into data container | Copies `secrets.json` → `<data_container>/Documents/`; relaunches |
| 25 | Verify app is running | Checks process is alive; scans DiagnosticReports for new crashes |

---

## Where Pods Come From

The `Pods/` directory is **gitignored** — it is never committed and never cloned.

**Locally (this machine):** `Pods/` is populated by running `pod install`. System Ruby is too old — always use the gem-installed CocoaPods binary (set `POD_BIN` in Step 0). `ios-build.sh` runs pod install automatically when a version gap is detected. **Never delete `Pods/` without being ready to re-run `ios-build.sh`.**

**On CI:** The `clone-and-build` CircleCI job runs `pod install` fresh on every pipeline run using a macOS executor that has the correct Ruby version installed. It also resets `~/.cocoapods/repos` to pull the latest spec index from the three pod sources:
- `https://cdn.cocoapods.org/` — public CocoaPods CDN
- `https://github.com/cvs-health-source-code/digital-shared-cocoapods-ios.git` — private CVS pod specs
- `https://github.com/LivePersonInc/iOSPodSpecs.git` — LivePerson (CVSChatbot) specs

Pod source code lives in `Pods/<PodName>/` (e.g., `Pods/CVSGlobalUIComponent/`, `Pods/Pulse/`). After `pod install`, Xcode uses `Pods/Pods.xcodeproj` to compile each pod as a separate target. **`Pods.xcodeproj` is generated by CocoaPods and is also gitignored.**

---

## Known Constraints (read before starting)

| Constraint | Detail |
|---|---|
| `pod install` — use gem-installed binary | System Ruby is too old; use the gem-installed CocoaPods binary. Requires `GIT_CONFIG_COUNT` auth to access the private CVS spec repo. `ios-build.sh` handles this automatically. `pod update <Pod>` will NOT override an exact version pin — update the Podfile first. |
| `Pods.xcodeproj` can go stale after `git pull` | When upstream commits reorganize a LocalPod's `Source/` directory, `Pods.xcodeproj` (gitignored, not updated by git) retains PBXBuildFile entries for deleted files. This causes "Build input files cannot be found" errors. Fix: re-run `ios-build.sh`. |
| JFrog requires proxy | Direct connections to `cvsh.jfrog.io` time out. Always set `HTTPS_PROXY=http://127.0.0.1:9000`. |
| JFrog auth is Bearer, not Basic | Raw base64 token used as Bearer. Decoded token or Basic Auth both fail 401. |
| Vault token expires | Must be refreshed from https://vault-prod.cvshealth.com every ~24 hours. |
| `ios-app` Debug xcconfig already wired | The Health100 Debug configuration in `ios-app` already references the CocoaPods xcconfig. Step A1 is **NOT needed** for `ios-app` main-branch builds. |
| Tag xcodeproj is broken (Alpha) | Health100 Alpha config missing pod xcconfig reference — causes all pod modules to be unresolvable. Must patch manually (Part B, Step B5). |
| Alpha config: no auto-embed | Health100 Alpha target has no `[CP] Embed Pods Frameworks` phase. Must always copy pod frameworks manually + codesign. |
| Debug config: auto-embeds frameworks | Health100 Debug target **does** have `[CP] Embed Pods Frameworks`. Do **not** manually copy frameworks — causes duplicate-class crashes. |
| CocoaPod keychain wrapper crash (Debug, macOS 26) | A pod keychain helper passes a disallowed key to `SecItemDelete`, returning `errSecParam (-50)` on macOS 26 / iOS 18.x simulator. `NSAssert` fires and crashes the app. Not triggered in Alpha/Release (`NS_BLOCK_ASSERTIONS` is defined). `ios-build.sh` applies the patch automatically. |
| SPM/Flutter frameworks unsigned after Debug build | Several SPM/Flutter frameworks are not signed by `xcodebuild`. CocoaPods frameworks are linker-signed during the build; SPM/Flutter ones are not. Simulator dyld refuses to load them: crash at launch with `Library not loaded`. `ios-build.sh` ad-hoc signs them in DerivedData (Step 21) so every `simctl install` — including automated tools like Context-Builder — installs pre-signed frameworks. |
| Keychain extension crash (Debug only) | A keychain extension file calls `assertionFailure(error.localizedDescription)`, which is fatal in Debug (`-Onone`) but a no-op in Alpha/Release (`-O`). Keychain returns `errSecMissingEntitlement (-34018)` on macOS 26 simulator built with `CODE_SIGN_IDENTITY="-"`. `ios-build.sh` applies the patch automatically. |
| `CIRCLECI=1` required for both xcodebuild calls | `IOS/Packages/Vault/Scripts/build_phase_secrets.sh` (the Xcode `Check & create secrets.json` build phase) checks for `.vault-token.txt` and calls an osascript dialog if it is missing. When `CIRCLECI` is set to any non-empty value, the build phase exits 0 immediately — skipping both the dialog and the Vault fetch. `ios-build.sh` handles Vault secrets via Step 4 (fetch) + Step 19 (bundle patch) instead. Both the probe build (Step 17) and real build (Step 18) must set `CIRCLECI=1`. |

---

## Prerequisites

- Xcode 26.2 installed (macOS executor uses `m4pro.medium`, Xcode 26.2 on CI)
- `ios-app/` folder populated (cloned from `cvs-health-source-code/digital-flagship-ios`)
- `Pods/` directory present — re-run `ios-build.sh` to regenerate if missing or after a pod version change
- Corporate proxy running at `http://127.0.0.1:9000` (check with Step 1)
- Simulator: **iPhone 16 Pro Max iOS 18.6** (UDID `A33152D0-5EF3-4DB3-930E-764ACCB8DBD2`)

---

## Step 0 — Source the Keys File

Run once per terminal session. All credentials and build paths are defined in `scripts/build/keys`.

```bash
source /path/to/dual-app-ui-tests/scripts/build/keys
```

This sets `TOPLEVEL`, `SIMULATOR_ID`, `DEBUG_DD`, `DEBUG_APP`, `DEBUG_BUNDLE_ID`, `GIT_EXEC_PATH`, and all tokens. `ios-build.sh` sources the same file automatically — this step is only needed when running manual commands from this guide.

---

## Step 1 — Verify Proxy Is Running

```bash
curl -s --proxy http://127.0.0.1:9000 \
  -o /dev/null -w "HTTP %{http_code}\n" \
  https://cvsh.jfrog.io/artifactory/api/swift/cvsdigital-swift
```

**Expected:** `HTTP 200` or `HTTP 401` — any HTTP response means the proxy is working.  
**If you see** `curl: (7) Failed to connect` → the proxy is not running. Start it before continuing.

---

## Step 2b — Clone or Update iOS App Repo

`ios-build.sh` clones the repo fresh if `ios-app/` is missing, or resets local patches and pulls latest if it already exists. Auth uses `GITHUB_PAT` via `~/.netrc` (written by Step 2).

```bash
# Manual clone (if ios-app/ is missing):
GIT_EXEC_PATH=/usr/local/git/libexec/git-core \
HTTPS_PROXY=http://127.0.0.1:9000 \
HTTP_PROXY=http://127.0.0.1:9000 \
git clone -b main \
  "https://${GITHUB_PAT}@github.com/cvs-health-source-code/digital-flagship-ios.git" \
  "$TOPLEVEL"
```

If `ios-app/` already exists:
```bash
# Reset any local patches and pull latest
git -C "$TOPLEVEL" restore .
git -C "$TOPLEVEL" clean -fd
GIT_EXEC_PATH=/usr/local/git/libexec/git-core \
HTTPS_PROXY=http://127.0.0.1:9000 \
git -C "$TOPLEVEL" pull origin main
git -C "$TOPLEVEL" log --oneline -1
```

**Expected:** commit hash and message from the latest `main` commit.

> All source patches applied later in the flow are idempotent — resetting before pull is safe.

---

## Step 3 — JFrog SPM Registry Configuration (Step 5 in ios-build.sh)

`ios-build.sh` Step 5 writes `registries.json` to four locations (global new + old paths, workspace xcshareddata, workspace `.swiftpm/`) and attempts `swift package-registry login` — treated as non-fatal (a warning is printed if it exits non-zero). The primary authentication mechanism for local builds is the netrc entry written in Step 6 and the token in `registries.json`.

Verify the registries.json was written correctly after running `ios-build.sh`:
```bash
python3 -c "import json; d=json.load(open('$HOME/Library/org.swift.swiftpm/configuration/registries.json')); print('scopes:', list(d.get('registries',{}).keys()))"
```

**Expected:** `scopes: ['[default]', 'cvsh-health100', 'cvsh']`

If the file is missing, re-run `ios-build.sh` Step 5 by running the full script. The three scopes map to the single JFrog registry URL `https://cvsh.jfrog.io/artifactory/api/swift/cvsdigital-swift`.

---

## Step 4 — Fetch Vault Secrets

The Vault token **expires every ~24 hours**. Get a fresh one:
1. Go to https://vault-prod.cvshealth.com
2. Log in with OIDC (leave Role blank)
3. Click your profile (top-right) → **Copy token**

**Handled automatically by `ios-build.sh`** — the script reads `VAULT_TOKEN` from the `keys` file, fetches secrets via the proxy, and writes `secrets.json` before every build.

To verify secrets are present after running the script:

```bash
wc -c < "$TOPLEVEL/IOS/Packages/Vault/Sources/Vault/Resources/secrets.json"
```

**Expected:** a non-zero byte count (typically 2–5 KB).

---

## Step 5 — Boot the Simulator

```bash
xcrun simctl boot "$SIMULATOR_ID" 2>/dev/null || true
open -a Simulator
sleep 5
xcrun simctl list devices | grep "$SIMULATOR_ID"
```

**Expected:** `(Booted)` next to the UDID.

---

## Step 3b — Feature Flag Patches

`ios-build.sh` applies four feature flag patches before every build. All patches are idempotent. The flags live in `ios-app/IOS/Packages/FlagshipFeatureFlags/Sources/FlagshipFeatureFlags/Collections/`.

| Flag key | File | From | To |
|---|---|---|---|
| `caoad-invite-only-access` | `AccountFeatureFlags.swift` | `true` | `false` |
| `unified-swipe-menu` | `CVSCommonNavigationFeatureFlags.swift` | `false` | `true` |
| `enable-h100-chatbot` | `CVSChatbotFeatureFlags.swift` | `false` | `true` |
| `open-platform-enable-benefits-tab` | `BenefitsFeatureFlags.swift` | `false` | `true` |

The script searches each file for `key: "<flag-key>"` and replaces `defaultValue: <from>` with `defaultValue: <to>` within the next 5 lines. If already patched, prints `(already patched)` and continues.

To verify patches are applied:
```bash
grep -A4 'key: "caoad-invite-only-access"' \
  "$TOPLEVEL/IOS/Packages/FlagshipFeatureFlags/Sources/FlagshipFeatureFlags/Collections/AccountFeatureFlags.swift"
grep -A4 'key: "enable-h100-chatbot"' \
  "$TOPLEVEL/IOS/Packages/FlagshipFeatureFlags/Sources/FlagshipFeatureFlags/Collections/CVSChatbotFeatureFlags.swift"
```

**Expected:** `defaultValue: false` for `caoad-invite-only-access`, `defaultValue: true` for `enable-h100-chatbot`.

---

---

# PART A — Build Main Branch (Debug / QA2)

Scheme: **Health100**, Configuration: **Debug**, Backend: **QA2** (default).  
Workspace: `IOS/CVSOnlineiPhone/CVSOnlineiPhone.xcworkspace`  
DerivedData: `~/Library/Developer/Xcode/DerivedData/Health100iOSApp-QA2`  
Bundle ID: `com.cvsenterpriseiphone.health100`

> **Key differences from Alpha (Part B tag build):**
> - Debug automatically embeds 79 frameworks via `[CP] Embed Pods Frameworks` — never copy frameworks manually.
> - `assertionFailure()` is fatal in Debug (`-Onone`); a silent no-op in Alpha/Release (`-O`).
> - `NSAssert` is active in Debug; stripped in Alpha/Release when `NS_BLOCK_ASSERTIONS` is defined.
> - Bundle ID is `com.cvsenterpriseiphone.health100` (not `com.health100.h100.alpha`).
> - Secrets inject to the data container `Documents/` path, not the app bundle root.

---

## A0 — Source Patches (Handled Automatically by `ios-build.sh`)

`ios-build.sh` applies all source patches before every build. **You do not run these manually.** Re-run the script after every `git pull` that touches source files or `Podfile.lock` — all patches are idempotent.

**What the script validates and fixes:**

| What it fixes | Failure it prevents |
|---|---|
| Gateway stub implementations + cart DI container fallbacks | Launch crash: `fatalError("Cart package misconfigured")` |
| Keychain extension: `assertionFailure` → `debugPrint` | Splash-screen crash: `errSecMissingEntitlement (-34018)` in Debug builds |
| Pod keychain helper: `NSAssert` → `NSLog` | Launch crash: `NSInternalInconsistencyException` in Debug builds |
| Stale `Pods.xcodeproj` build-phase entry removal | Build error: "Build input files cannot be found" after `git pull` |
| `Pods/Manifest.lock` sync with `Podfile.lock` | Build error: "sandbox not in sync with Podfile.lock" |
| Pod version gap: updates Podfile pin + runs `pod install` | Compile errors: `has no member`, `cannot find type` |
| New enum cases from pod update: patches exhaustive switches | Compile error: `switch must be exhaustive` |
| Pod API gap fixer (`scripts/build/ios_fix_pod_api_gaps.py`) | Compile errors: `has no member` in non-Pods Swift files |

**`scripts/build/ios_fix_pod_api_gaps.py` — fix strategies:**

| Strategy | Detected when | Action |
|---|---|---|
| `nil_replacement` | Missing member used as a parameter or assignment | Replaces `expr.member` with `nil` |
| `stub_function` | Missing member called as a method (`.member(...)`) | Replaces the enclosing function body with a stub comment |
| `remove_case` | Missing member is a `case .member:` in a switch | Removes the case and its body |

Limitation: does not handle `cannot find type` or protocol conformance failures — those require a pod version update (update the Podfile pin and re-run the script).

---

## A1 — Verify `baseConfigurationReference` in project.pbxproj

> **`ios-app` main branch: this is already applied.** The Health100 Debug build configuration already has `baseConfigurationReference` set to the CocoaPods xcconfig. Run the verify command only — **do not re-patch**.

**Failure if missing:** All pod module imports fail at compile time:
```
error: Missing package product 'Alamofire'
error: Missing package product 'CVSGlobalUIComponent'
... (20+ similar errors)
```

Without `baseConfigurationReference`, the Health100 Debug build configuration has no pod module search paths and no pod import resolves.

Note: the Alpha config has a separate build configuration entry — that one is patched in Part B (Step B5).

Verify only (no patch needed for `ios-app` main branch):
```bash
PBXPROJ="$TOPLEVEL/IOS/CVSOnlineiPhone/CVSOnlineiPhone.xcodeproj/project.pbxproj"
grep -A5 "6AB463B02F3D263E00B3571F" "$PBXPROJ" | grep "baseConfigurationReference"
```

Expected: a line containing `Pods-SharedPods-Health100.debug.xcconfig`

> If that line is missing (e.g., after cloning on a different machine or reverting the file), add it manually:  
> In the block for the Health100 Debug build configuration, insert  
> `baseConfigurationReference = <xcconfig-uuid> /* Pods-SharedPods-Health100.debug.xcconfig */;`  
> immediately before `buildSettings = {`. The xcconfig UUID is shown in the verify command output from a working build.

---

## A1b — Probe Build + API Gap Auto-Fix (Step 17)

**Handled automatically by `ios-build.sh`.** Before the real build, the script runs a probe `xcodebuild` call with `CIRCLECI=1` to detect API gaps introduced by pod updates:

- If the probe **succeeds** — DerivedData is warmed, no API gaps. Main build proceeds.
- If the probe **fails with `has no member` / `nil is not compatible` errors** — `ios_fix_pod_api_gaps.py` is run to patch the Swift files, then the main build recompiles only the patched files.
- If the probe **fails for any other reason** — the main build (Step 18) surfaces the real error.

The probe always exits 0; `ios_fix_pod_api_gaps.py` fix strategies:

| Strategy | When applied | Action |
|---|---|---|
| `nil_replacement` | Missing member used as param/assignment | Replaces `expr.member` with `nil` |
| `stub_function` | Missing member called as method (`.member(...)`) | Replaces enclosing function body with stub |
| `remove_case` | Missing member is `case .member:` in a switch | Removes the case and its body |

Probe log: `$IOS_APP_PATH/IOS/CVSOnlineiPhone/build/xcodebuild-api-gap-probe.log`

---

## A2 — Build (Step 18)

`ios-build.sh` runs xcodebuild as a background process and polls every 10 s. Build log: `$IOS_APP_PATH/IOS/CVSOnlineiPhone/build/xcodebuild.log`.

Equivalent manual command:
```bash
GIT_CONFIG_NOSYSTEM=1 \
CIRCLECI=1 \
xcodebuild build \
  -workspace "$TOPLEVEL/IOS/CVSOnlineiPhone/CVSOnlineiPhone.xcworkspace" \
  -scheme Health100 \
  -configuration Debug \
  -destination "generic/platform=iOS Simulator" \
  -derivedDataPath "$TOPLEVEL/IOS/CVSOnlineiPhone/build" \
  -scmProvider system \
  -disablePackageRepositoryCache \
  -disableAutomaticPackageResolution \
  ONLY_ACTIVE_ARCH=YES \
  CODE_SIGN_IDENTITY="-" \
  ENTITLEMENTS_ALLOWED=YES \
  IDECacheMacoshostPackagePlugins=YES \
  LOG_ANIMATIONS=NO \
  2>&1 | tee /tmp/debug-build.log
echo "Build exit: $?"
```

**Key flags vs. the old manual command:**

| Old | Current | Why |
|---|---|---|
| `GITHUB_ACTIONS=true` | `CIRCLECI=1` | Vault build phase skips when `CIRCLECI` is set |
| `CODE_SIGNING_ALLOWED=NO` | `CODE_SIGN_IDENTITY="-"` | Ad-hoc signing; no entitlement errors |
| `-destination "id=$SIMULATOR_ID"` | `-destination "generic/platform=iOS Simulator"` | Build output is not tied to a specific device UDID |
| `-skipPackagePluginValidation` | `-disablePackageRepositoryCache -disableAutomaticPackageResolution` | Prevents xcodebuild from re-downloading packages (pre-cloned in Steps 11–15) |
| *(absent)* | `ENTITLEMENTS_ALLOWED=YES` | Required alongside `CODE_SIGN_IDENTITY="-"` |

Check result:
```bash
grep -E "\*\* BUILD (SUCCEEDED|FAILED)" /tmp/debug-build.log | tail -1
```

**Expected:** `** BUILD SUCCEEDED **`

If you see **compiler errors**, check:
```bash
grep ": error:" /tmp/debug-build.log | grep -v "^warning" | head -20
```

---

## A2b — Patch secrets.json into Vault_Vault.bundle (Step 19)

**Handled automatically by `ios-build.sh`.** After a successful build, the script copies `secrets.json` into every `Vault_Vault.bundle` inside the built `.app` before `simctl install`:

```bash
SECRETS_SRC="$IOS_APP_PATH/IOS/Packages/Vault/Sources/Vault/Resources/secrets.json"
find "$APP_BUILD_PATH" -name "Vault_Vault.bundle" -type d | while read bundle; do
  cp -f "$SECRETS_SRC" "$bundle/secrets.json"
done
```

**Why two secrets injections?** The app bundle (`Vault_Vault.bundle/secrets.json`) provides secrets at launch before the data container is readable. The data container (`Documents/secrets.json`, Step 24 / A6) provides secrets for runtime Vault lookups. Both must be present for the app to start and function correctly.

---

## A3 — Sign SPM Frameworks in DerivedData, then Install

**Why this is needed:** Several SPM/Flutter frameworks built with `CODE_SIGNING_ALLOWED=NO` are not signed by xcodebuild. CocoaPods pod frameworks are linker-signed during the build; SPM/Flutter frameworks are not. Signing directly in DerivedData (not just in the installed container) ensures every subsequent `simctl install` — including automated tools like Context-Builder — installs pre-signed frameworks without an extra signing pass.

The signing loop below is dynamic — it checks every framework in the app bundle and signs any that are not already ad-hoc signed. No manual list is needed.

```bash
echo "Signing unsigned SPM/Flutter frameworks in DerivedData..."
for fw in "$DEBUG_APP/Frameworks/"*.framework; do
  if ! codesign -dvv "$fw" 2>&1 | grep -q "Signature=adhoc"; then
    codesign --force --sign - "$fw" && echo "  signed: $(basename $fw)"
  fi
done
echo "Done."
```

Then install. Debug config includes `[CP] Embed Pods Frameworks` — 79 frameworks are embedded automatically during the build. **Do not copy any frameworks manually.**

```bash
xcrun simctl install "$SIMULATOR_ID" "$DEBUG_APP"
echo "Install exit: $?"
```

---

## A4 — Sign

```bash
APP_CONTAINER=$(xcrun simctl get_app_container "$SIMULATOR_ID" "$DEBUG_BUNDLE_ID" app)
echo "App container: $APP_CONTAINER"

for fw in "$APP_CONTAINER/Frameworks"/*.framework; do
  codesign --force --sign - "$fw" 2>/dev/null
done
codesign --force --sign - "$APP_CONTAINER/Health100" 2>/dev/null
echo "Signed."
```

---

## A5 — Launch

```bash
xcrun simctl launch "$SIMULATOR_ID" "$DEBUG_BUNDLE_ID"
echo "Launch exit: $?"
```

---

## A6 — Inject Secrets into Data Container (Step 24)

**Debug differs from Alpha:** secrets.json must go in the **data container's `Documents/`** directory.

> **Note:** `ios-build.sh` Step 19 already patched `secrets.json` into `Vault_Vault.bundle` inside the app bundle. This step (Step 24) injects it into the data container for runtime Vault lookups — both locations are required.

```bash
DATA_CONTAINER=$(xcrun simctl get_app_container "$SIMULATOR_ID" "$DEBUG_BUNDLE_ID" data)
echo "Data container: $DATA_CONTAINER"
mkdir -p "$DATA_CONTAINER/Documents"
cp "$TOPLEVEL/IOS/Packages/Vault/Sources/Vault/Resources/secrets.json" \
   "$DATA_CONTAINER/Documents/secrets.json"
echo "Secrets injected: $(wc -c < "$DATA_CONTAINER/Documents/secrets.json") bytes"
```

Terminate and relaunch so the app picks up the new secrets:
```bash
xcrun simctl terminate "$SIMULATOR_ID" "$DEBUG_BUNDLE_ID" 2>/dev/null || true
xcrun simctl launch "$SIMULATOR_ID" "$DEBUG_BUNDLE_ID"
```

---

## A7 — Verify App Is Running

```bash
sleep 5
ps aux | grep "Health100" | grep -v grep | head -3
echo "---"
ls ~/Library/Logs/DiagnosticReports/ | grep -i health100 | tail -3
```

**Expected:** A running process entry. The latest crash report should predate your launch time.

Confirm the KeychainItemWrapper fix is present in the installed binary:
```bash
APP_CONTAINER=$(xcrun simctl get_app_container "$SIMULATOR_ID" "$DEBUG_BUNDLE_ID" app)
strings "$APP_CONTAINER/Frameworks/CVSUtility.framework/CVSUtility" | grep "KeychainItemWrapper"
```

Expected: `[KeychainItemWrapper] resetKeychainItem: SecItemDelete returned %d (ignored)`

---

## A8 — Incremental Rebuild

Use this section whenever you need to rebuild after a `git pull`, a source patch, or a code change. Do not redo the full A0–A7 flow — only the steps that changed.

---

### Scenario 1 — After `git pull` (most common)

Patches in A0 modify files in two categories:
- **Tracked by git** (overwritten by pull): app source Swift files patched by `ios-build.sh`
- **Gitignored / Pods** (NOT overwritten by pull, but may need re-syncing): `Pods/Manifest.lock`, `Pods/Pods.xcodeproj`, pod source files patched by `ios-build.sh`
- **Untracked** (created by us, NOT overwritten): the gateway stubs file created by `ios-build.sh`

Always stash → pull → pop → re-verify → re-sync Pods lock.

```bash
# 1. Stash all local patches (including untracked files)
git stash -u -m "local-patches-before-pull"

# 2. Pull latest main
HTTPS_PROXY=http://127.0.0.1:9000 HTTP_PROXY=http://127.0.0.1:9000 \
git pull origin main

# 3. Restore patches
git stash pop

# 4. Re-sync Manifest.lock (tracked Podfile.lock may have changed)
diff "$TOPLEVEL/IOS/CVSOnlineiPhone/Podfile.lock" \
     "$TOPLEVEL/IOS/CVSOnlineiPhone/Pods/Manifest.lock" > /dev/null 2>&1 \
  || cp "$TOPLEVEL/IOS/CVSOnlineiPhone/Podfile.lock" \
        "$TOPLEVEL/IOS/CVSOnlineiPhone/Pods/Manifest.lock"
```

Check for conflicts — stash pop prints CONFLICT if any patch was overwritten by the pull. If any patch is missing, re-run `ios-build.sh` (all patches are idempotent).

Then rebuild incrementally — xcodebuild only recompiles files that changed:
```bash
GIT_EXEC_PATH=/usr/local/git/libexec/git-core \
GITHUB_ACTIONS=true \
HTTPS_PROXY=http://127.0.0.1:9000 \
HTTP_PROXY=http://127.0.0.1:9000 \
xcodebuild \
  -workspace "$TOPLEVEL/IOS/CVSOnlineiPhone/CVSOnlineiPhone.xcworkspace" \
  -scheme Health100 \
  -configuration Debug \
  -destination "id=$SIMULATOR_ID" \
  -derivedDataPath "$DEBUG_DD" \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY="" \
  -skipPackagePluginValidation \
  build 2>&1 | tee /tmp/debug-incremental.log | \
  grep -E "Compiling|Linking|error:|BUILD SUCCEEDED|BUILD FAILED" | \
  grep -v "^note:" | tail -20
```

Then reinstall and relaunch (steps below).

---

### Scenario 2 — After patching a Pods source file

When `ios-build.sh` patches a file inside `Pods/`, the `[CP] Embed Pods Frameworks` phase may embed a cached framework instead of the freshly compiled one. Build the affected pod target first to force recompilation, then rebuild Health100.

```bash
# Step 1: Rebuild CVSUtility pod target (picks up ObjC source patch, ~2 min)
GIT_EXEC_PATH=/usr/local/git/libexec/git-core \
GITHUB_ACTIONS=true \
xcodebuild \
  -workspace "$TOPLEVEL/IOS/CVSOnlineiPhone/CVSOnlineiPhone.xcworkspace" \
  -scheme CVSUtility \
  -configuration Debug \
  -destination "id=$SIMULATOR_ID" \
  -derivedDataPath "$DEBUG_DD" \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY="" \
  build 2>&1 | grep -E "BUILD (SUCCEEDED|FAILED)|error:" | tail -3

# Step 2: Rebuild Health100 (incremental, picks up updated CVSUtility framework)
GIT_EXEC_PATH=/usr/local/git/libexec/git-core \
GITHUB_ACTIONS=true \
HTTPS_PROXY=http://127.0.0.1:9000 \
HTTP_PROXY=http://127.0.0.1:9000 \
xcodebuild \
  -workspace "$TOPLEVEL/IOS/CVSOnlineiPhone/CVSOnlineiPhone.xcworkspace" \
  -scheme Health100 \
  -configuration Debug \
  -destination "id=$SIMULATOR_ID" \
  -derivedDataPath "$DEBUG_DD" \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY="" \
  -skipPackagePluginValidation \
  build 2>&1 | grep -E "BUILD (SUCCEEDED|FAILED)|error:" | tail -3
```

> **Why build the pod target separately:** deleting CVSUtility's intermediate objects to force a rebuild costs ~8 min (full ObjC recompile). Building the `CVSUtility` scheme directly is ~2 min and ensures the embed phase picks up the new binary.

Then reinstall and relaunch (steps below).

---

### Scenario 3 — After a Swift source change only

No special handling needed. Run the Health100 build directly and xcodebuild recompiles only the changed Swift module:

```bash
GIT_EXEC_PATH=/usr/local/git/libexec/git-core \
GITHUB_ACTIONS=true \
HTTPS_PROXY=http://127.0.0.1:9000 \
HTTP_PROXY=http://127.0.0.1:9000 \
xcodebuild \
  -workspace "$TOPLEVEL/IOS/CVSOnlineiPhone/CVSOnlineiPhone.xcworkspace" \
  -scheme Health100 \
  -configuration Debug \
  -destination "id=$SIMULATOR_ID" \
  -derivedDataPath "$DEBUG_DD" \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY="" \
  -skipPackagePluginValidation \
  build 2>&1 | grep -E "BUILD (SUCCEEDED|FAILED)|error:" | tail -3
```

---

### Reinstall, Sign, and Relaunch (all scenarios)

After any successful incremental build, run these four steps:

```bash
# Sign SPM/Flutter frameworks in DerivedData first (so every fresh simctl install is pre-signed)
for fw in "$DEBUG_APP/Frameworks/"*.framework; do
  if ! codesign -dvv "$fw" 2>&1 | grep -q "Signature=adhoc"; then
    codesign --force --sign - "$fw" 2>/dev/null
  fi
done

# Reinstall
xcrun simctl terminate "$SIMULATOR_ID" "$DEBUG_BUNDLE_ID" 2>/dev/null || true
xcrun simctl install "$SIMULATOR_ID" "$DEBUG_APP"
echo "Install: $?"

# Re-sign installed container (belt-and-suspenders; frameworks are already signed above)
APP_CONTAINER=$(xcrun simctl get_app_container "$SIMULATOR_ID" "$DEBUG_BUNDLE_ID" app)
for fw in "$APP_CONTAINER/Frameworks"/*.framework; do
  codesign --force --sign - "$fw" 2>/dev/null
done
codesign --force --sign - "$APP_CONTAINER/Health100" 2>/dev/null
echo "Signed."

# Relaunch
xcrun simctl launch "$SIMULATOR_ID" "$DEBUG_BUNDLE_ID"
echo "Launch: $?"
```

Re-inject secrets only if the data container changed (e.g. the app was uninstalled and reinstalled from scratch). If the same container UUID persists, the existing `Documents/secrets.json` is still valid.

```bash
# Check if secrets are present before re-injecting
DATA_CONTAINER=$(xcrun simctl get_app_container "$SIMULATOR_ID" "$DEBUG_BUNDLE_ID" data)
[ -f "$DATA_CONTAINER/Documents/secrets.json" ] \
  && echo "Secrets already present: $(wc -c < "$DATA_CONTAINER/Documents/secrets.json") bytes" \
  || { echo "Injecting secrets..."; \
       mkdir -p "$DATA_CONTAINER/Documents"; \
       cp "$TOPLEVEL/IOS/Packages/Vault/Sources/Vault/Resources/secrets.json" \
          "$DATA_CONTAINER/Documents/secrets.json"; \
       echo "Injected."; }
```

---

---

# PART B — Build from Git Tag

Replace `jul_21_26.7.50-3` with the desired tag name.

---

## B0 — Set Tag Variables

```bash
export TAG_NAME="jul_21_26.7.50-3"
export WORKTREE="$TOPLEVEL/../health100-tag-build"
export TAG_DD=~/Library/Developer/Xcode/DerivedData/Health100TagBuild
export TAG_APP="$TAG_DD/Build/Products/Alpha-iphonesimulator/Health100.app"
export TAG_FW="$TAG_APP/Frameworks"
export TAG_BUILT="$TAG_DD/Build/Products/Alpha-iphonesimulator"
```

---

## B1 — Create Git Worktree

**Note:** `git-lfs` must be in PATH for the checkout to succeed. Step 0 already adds it via the `$PATH` export. If you see `git-lfs: command not found`, re-run Step 0.

```bash
# Remove any existing worktree for this tag
git worktree remove "$WORKTREE" --force 2>/dev/null || rm -rf "$WORKTREE"

# Create fresh worktree checked out at the tag
git worktree add "$WORKTREE" "$TAG_NAME"

# Verify
git -C "$WORKTREE" log --oneline -1
```

**Expected:** commit hash and message matching the tag.

---

## B2 — Copy Gateway Stubs into the Worktree

This file prevents the app crashing at launch with `fatalError("Cart Package misconfigured")`.

```bash
STUBS_DEST="$WORKTREE/IOS/Packages/Cart/Sources/CartFeature/DI/GatewayStubs.swift"

# Copy from main working tree (created there by ios-build.sh)
cp "$TOPLEVEL/IOS/Packages/Cart/Sources/CartFeature/DI/GatewayStubs.swift" "$STUBS_DEST"
echo "GatewayStubs.swift: $(wc -l < "$STUBS_DEST") lines"
```

---

## B3 — Patch Cart DI Container in the Worktree

Replaces the `fatalError` guard block with stub gateway fallbacks.

First check what the tag has (it may have 3 gateways, not 4 — no `i90MergeOrderGateway`):

```bash
grep -n "fatalError\|mergeOrderGateway\|payPalGateway\|vantivGateway" \
  "$WORKTREE/IOS/Packages/Cart/Sources/CartFeature/DI/UseCaseContainer.swift" | head -10
```

**Applied automatically by `ios-build.sh`** — the script patches the Cart DI container guard block before every build. For a tag worktree, point `TOPLEVEL` at the worktree path and re-run the script.

Verify:
```bash
grep -n "StubMergeOrderGateway" \
  "$WORKTREE/IOS/Packages/Cart/Sources/CartFeature/DI/UseCaseContainer.swift"
```

---

## B4 — Copy Pods from Main (NEVER symlink)

**Why copy, not symlink:** xcconfig paths inside a symlinked Pods directory don't resolve to the worktree's SRCROOT — the Swift compiler cannot find any pod module.
**Why copy Podfile.lock too:** CocoaPods build phase verifies `Podfile.lock == Pods/Manifest.lock`. Mismatch → "sandbox is not in sync" error. The only diff between the tag and main was `CVSGlobalUIComponent 1.8.6→1.8.7`; using main's version is safe.

```bash
# Remove any existing Pods (symlink or stale directory)
rm -rf "$WORKTREE/IOS/CVSOnlineiPhone/Pods"

# Full copy
cp -r "$TOPLEVEL/IOS/CVSOnlineiPhone/Pods" "$WORKTREE/IOS/CVSOnlineiPhone/Pods"
cp "$TOPLEVEL/IOS/CVSOnlineiPhone/Podfile.lock" "$WORKTREE/IOS/CVSOnlineiPhone/Podfile.lock"

echo "Pods size: $(du -sh "$WORKTREE/IOS/CVSOnlineiPhone/Pods" | cut -f1)"
```

Verify versions match:
```bash
echo "Manifest.lock: $(grep "CVSGlobalUIComponent (" "$WORKTREE/IOS/CVSOnlineiPhone/Pods/Manifest.lock" | head -1)"
echo "Podfile.lock:  $(grep "CVSGlobalUIComponent (" "$WORKTREE/IOS/CVSOnlineiPhone/Podfile.lock" | head -1)"
```

**Expected:** both lines show the same version (e.g., `1.8.7`).

---

## B5 — Fix Missing `baseConfigurationReference` in Tag xcodeproj

**Why this is needed:** The tag's `project.pbxproj` UUID `6AB463B32F3D263E00B3571F` (Health100 Alpha build config) is missing its pod xcconfig reference. Without it, `SWIFT_INCLUDE_PATHS` only inherits paths for 3 pods (Alamofire, CVSNFCAudibleRx, CVSPhotoNetworkLibrary). Every other pod import — CVSGlobalUIComponent, CVSAuthentication, CVSCoordinator, etc. — fails with "unable to resolve module dependency."

**Applied automatically by `ios-build.sh`** — the script inserts the missing `baseConfigurationReference` into the Health100 Alpha build configuration block (UUID `6AB463B32F3D263E00B3571F`) before every build. For a tag worktree, point `TOPLEVEL` at the worktree path and re-run the script.

```bash
PBXPROJ="$WORKTREE/IOS/CVSOnlineiPhone/CVSOnlineiPhone.xcodeproj/project.pbxproj"
```

Verify:
```bash
grep -A3 "6AB463B32F3D263E00B3571F" "$PBXPROJ" | grep "baseConfigurationReference"
```

**Expected:** line containing `B389B53866A636F3C06BC955 /* Pods-SharedPods-CVSOnlineiPhone.alpha.xcconfig */`

---

## B6 — Copy secrets.json into Worktree

```bash
cp "$TOPLEVEL/IOS/Packages/Vault/Sources/Vault/Resources/secrets.json" \
   "$WORKTREE/IOS/Packages/Vault/Sources/Vault/Resources/secrets.json"
echo "Secrets copied: $(python3 -c "import json; print(len(json.load(open('$WORKTREE/IOS/Packages/Vault/Sources/Vault/Resources/secrets.json'))))" ) keys"
```

---

## B7 — Build

**IMPORTANT:** Always use a **separate** DerivedData path (`$TAG_DD`). Never share with main's DerivedData — stale module maps from a different workspace path cause "unable to resolve module dependency" errors for all pods.

```bash
GIT_EXEC_PATH=/usr/local/git/libexec/git-core \
GITHUB_ACTIONS=true \
HTTPS_PROXY=http://127.0.0.1:9000 \
HTTP_PROXY=http://127.0.0.1:9000 \
xcodebuild \
  -workspace "$WORKTREE/IOS/CVSOnlineiPhone/CVSOnlineiPhone.xcworkspace" \
  -scheme Health100 \
  -configuration Alpha \
  -destination "id=$SIMULATOR_ID" \
  -derivedDataPath "$TAG_DD" \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY="" \
  -skipPackagePluginValidation \
  build 2>&1 | tee /tmp/tag-build.log
echo "Build exit: $?"
```

Check result:
```bash
grep -E "\*\* BUILD (SUCCEEDED|FAILED)" /tmp/tag-build.log | tail -1
```

If you see compiler errors, check:
```bash
grep ": error:" /tmp/tag-build.log | grep -v "^warning" | head -10
```

---

## B8 — Copy Pod Frameworks into App Bundle

**Why this is needed:** The `Health100` target in the xcodeproj does **not** have a `[CP] Embed Pods Frameworks` build phase (that phase only exists in the `CVSOnlineiPhone` Retail target). The 12 CocoaPods dynamic frameworks are therefore never copied into `Health100.app/Frameworks/`. Without this step dyld crashes at launch: `Library not loaded: @rpath/AFNetworking.framework`. This step is **always required** — it is not a fallback for a skipped phase.

```bash
# Ensure app bundle and Frameworks dir exist
[ -d "$TAG_APP" ] || { echo "ERROR: app bundle not found at $TAG_APP"; exit 1; }
mkdir -p "$TAG_FW"

echo "Copying pod frameworks..."

# Standard pod frameworks (built to $TAG_BUILT/<name>/<name>.framework)
for fw in AFNetworking CVSCoordinator CVSSessionReplay CVSUtility CVSWebView GlobalTrackingPod Pulse PulseTokens TapstreamIOS; do
  SRC="$TAG_BUILT/$fw/$fw.framework"
  if [ -d "$SRC" ]; then
    cp -rf "$SRC" "$TAG_FW/"
    echo "  Copied: $fw"
  else
    echo "  WARNING: Not found: $SRC"
  fi
done

# Lottie has a different container directory name
SRC="$TAG_BUILT/lottie-ios/Lottie.framework"
[ -d "$SRC" ] && cp -rf "$SRC" "$TAG_FW/" && echo "  Copied: Lottie" || echo "  WARNING: Lottie not found"

# AkamaiBAPObjc comes from XCFrameworkIntermediates (CVSSDK pod uses a vendored xcframework)
for fw in AkamaiBAPObjc AkamaiBAPObjc-companion; do
  SRC="$TAG_BUILT/XCFrameworkIntermediates/CVSSDK/Base/$fw.framework"
  if [ -d "$SRC" ]; then
    cp -rf "$SRC" "$TAG_FW/"
    echo "  Copied: $fw"
  else
    echo "  WARNING: Not found: $SRC"
  fi
done

echo "Done."
```

Verify all 12 are present:
```bash
for fw in AFNetworking CVSCoordinator CVSSessionReplay CVSUtility CVSWebView GlobalTrackingPod Pulse PulseTokens TapstreamIOS Lottie AkamaiBAPObjc AkamaiBAPObjc-companion; do
  [ -d "$TAG_FW/$fw.framework" ] && echo "OK: $fw" || echo "MISSING: $fw"
done
```

---

## B9 — Ad-hoc Sign All Frameworks

**Why this is needed:** Manually copied frameworks — especially `AkamaiBAPObjc` — retain their original code signatures, which are rejected by dyld in the simulator: `not valid for use in process: Trying to load an unsigned library`. Must re-sign everything with an ad-hoc signature (`-`).

```bash
echo "Signing frameworks in $TAG_FW ..."
for fw in "$TAG_FW"/*.framework; do
  codesign --force --sign - "$fw" 2>/dev/null && echo "  Signed: $(basename $fw)"
done

# Sign the main executable too
codesign --force --sign - "$TAG_APP/Health100" 2>/dev/null && echo "  Signed: Health100 binary"
echo "Done."
```

---

## B10 — Boot Simulator (if not already running)

```bash
xcrun simctl boot "$SIMULATOR_ID" 2>/dev/null || true
open -a Simulator
sleep 5
xcrun simctl list devices | grep "$SIMULATOR_ID"
```

**Expected:** `(Booted)` next to the UDID.

---

## B11 — Install App on Simulator

```bash
xcrun simctl install "$SIMULATOR_ID" "$TAG_APP"
echo "Install: $?"
```

---

## B12 — Re-sign Frameworks in Installed Container

After `simctl install`, the app is copied to a new container path. Re-sign to be safe:

```bash
APP_CONTAINER=$(xcrun simctl get_app_container "$SIMULATOR_ID" com.health100.h100.alpha app)
echo "Container: $APP_CONTAINER"

for fw in "$APP_CONTAINER/Frameworks"/*.framework; do
  codesign --force --sign - "$fw" 2>/dev/null
done
codesign --force --sign - "$APP_CONTAINER/Health100" 2>/dev/null
echo "Re-signed in container"
```

---

## B13 — Launch App

```bash
xcrun simctl launch "$SIMULATOR_ID" com.health100.h100.alpha
echo "Launch: $?"
```

---

## B14 — Inject Secrets into App Container

```bash
APP_CONTAINER=$(xcrun simctl get_app_container "$SIMULATOR_ID" com.health100.h100.alpha app)
cp "$TOPLEVEL/IOS/Packages/Vault/Sources/Vault/Resources/secrets.json" "$APP_CONTAINER/secrets.json"
echo "Secrets injected: $(wc -c < "$APP_CONTAINER/secrets.json") bytes"
```

---

## B15 — Verify App Is Running

```bash
sleep 5
ps aux | grep "Health100" | grep -v grep | head -3
echo "---"
ls ~/Library/Logs/DiagnosticReports/ | grep -i health100 | tail -3
```

**Expected:** A running process entry. If the latest crash report is older than your launch time, the app is stable.

---

---

# Troubleshooting

## "unable to resolve module dependency: 'CVSGlobalUIComponent'" (and 20+ others)

Three possible causes, check in order:

1. **Pods were symlinked instead of copied** → Step B4 must use `cp -r`, not `ln -s`
2. **Missing `baseConfigurationReference`** in tag xcodeproj → re-run Step B5 and verify
3. **Reusing main's DerivedData** → ensure `-derivedDataPath "$TAG_DD"` is set in Step B7

For Debug / main branch builds, the same error means Step A1 was skipped or the Debug UUID was not patched correctly.

## "The sandbox is not in sync with the Podfile.lock"

Copied Pods directory but forgot Podfile.lock → re-run the second `cp` in Step B4

## "Library not loaded: @rpath/AFNetworking.framework/AFNetworking"

Step B8 was not run. The Health100 Alpha target never auto-embeds pod frameworks → run Step B8 (always required for tag/Alpha builds).

## "not valid for use in process: Trying to load an unsigned library"

Manually copied frameworks have invalid signatures → run Step B9

## App crashes: "Problem deleting current dictionary." (NSInternalInconsistencyException)

`NSAssert` fired in a CocoaPod keychain helper's `resetKeychainItem` method. `SecItemDelete` received `kSecValueData` as a search key and returned `errSecParam (-50)` on macOS 26 simulator.

- **Affects:** Debug builds only. Alpha/Release builds compile away `NSAssert` when `NS_BLOCK_ASSERTIONS` is defined.
- **Fix:** Re-run `ios-build.sh` (patches are idempotent). Then rebuild — either rebuild the full app, or build the pod target separately first to avoid a full recompile (see A8 Scenario 2). Then re-run Step A2 (full Health100 build).

## App crashes after splash screen: assertionFailure / errSecMissingEntitlement

`assertionFailure(error.localizedDescription)` fired in the keychain extension file. The call chain goes through the keychain bridge into the keychain interface layer.

- **Affects:** Debug builds only (`-Onone` makes `assertionFailure` fatal). Alpha/Release (`-O`) removes it entirely.
- **Root cause:** Keychain returns `errSecMissingEntitlement (-34018)` on macOS 26 simulator when built with `CODE_SIGNING_ALLOWED=NO` and no entitlements embedded.
- **Fix:** Re-run `ios-build.sh`, then rebuild and reinstall.

## JFrog: SSL error 35 / connection refused

Proxy is not running → verify Step 1. Never connect to `cvsh.jfrog.io` directly.

## JFrog: HTTP 401

Wrong auth format → re-run Step 3 ensuring raw base64 token is used as Bearer. Do NOT decode the token.

## Vault: "permission denied" / HTTP 403

Vault token expired → get a new one from https://vault-prod.cvshealth.com and re-run Step 4.

## App crashes immediately after launch (no dyld error)

Secrets not injected in time — re-run Step A6 (Debug) or Step B14 (Alpha tag), then relaunch.

---

## Reference

| Item | Value |
|---|---|
| Simulator UDID | `A33152D0-5EF3-4DB3-930E-764ACCB8DBD2` |
| **Debug bundle ID** | **`com.cvsenterpriseiphone.health100`** |
| **Debug DerivedData** | **`~/Library/Developer/Xcode/DerivedData/Health100Debug-QA2`** |
| **Debug app output** | **`Debug-iphonesimulator/Health100.app`** |
| **Debug secrets path** | **`<data_container>/Documents/secrets.json`** |
| Alpha bundle ID | `com.health100.h100.alpha` |
| Tag worktree | `../health100-tag-build` (relative to repo root) |
| Tag DerivedData | `~/Library/Developer/Xcode/DerivedData/Health100TagBuild` |
| Vault URL | `https://vault-prod.cvshealth.com/v1/digital-flagship-ios/data/secrets` |
| JFrog registry | `https://cvsh.jfrog.io/artifactory/api/swift/cvsdigital-swift` |
| Proxy | `http://127.0.0.1:9000` |

---

## Build Configurations

Five configurations are defined in `CVSOnlineiPhone.xcodeproj`. Pass one via `-configuration <name>` in the `xcodebuild` command.

| Configuration | Purpose |
|---|---|
| `Debug` | Local development — full debug symbols, QA2 backend, auto-embeds pod frameworks |
| `Debug_Dev` | Debug build pointing at the Dev backend |
| `Alpha` | Health100 Alpha flavor — used for tag builds (Part B) |
| `AdHoc` | Ad-hoc distribution (internal TestFlight-style signing) |
| `Release` | Production / App Store release |

---

## Schemes

Two main app schemes. Pass one via `-scheme <name>` in the `xcodebuild` command.

| Scheme | App | Typical configuration |
|---|---|---|
| `Health100` | Health100 app | `Debug` (Part A) or `Alpha` (Part B) |
| `CVSOnlineiPhone` | Retail CVS app | `Debug` / `Release` |
| `Health100Tests` | Health100 unit tests | `Debug` |
| `CVSOnlineiPhoneTests` | Retail app unit tests | `Debug` |

---

## Backend Environments

The production app targets exactly **2 real backend environments**:

| Environment | Also known as | Retail API base | Health100 API base | Used by |
|---|---|---|---|---|
| **QA2** | `qa`, `retailQA`, `healthQA` | `https://www-qa2.cvs.com` | `https://api.qa2.health100.com` | `Debug`, `Debug_Dev`, `Alpha` (default) |
| **Production** | `production`, `retailProd`, `healthProd` | `https://www.cvs.com` | `https://api.health100.com` | `AdHoc`, `Release`, `Alpha` (with `--prod`) |

There is no separate Staging environment in the app. "Staging" only appears inside the BazaarVoice third-party SDK.

### Edge cases

| Name | Where | Notes |
|---|---|---|
| **SIT2** | `EnvConstant.swift` | Hardcoded Apigee endpoint (`https://sit2-api.cvshealth.com`) for all non-prod builds. Never exposed as a named enum case. |
| **UAT** | `VisitManagerServicesEnvironment` | Named case in the health scheduling module only. No active URL configured. |
| **PROD_PREVIEW** | Preprocessor flag | Applied to certain Health100 Alpha/AdHoc targets. Enables production APIs while keeping the debug menu accessible. Not a build configuration name. |

### Switching Alpha between QA2 and Production

```bash
# Switch Alpha → Production APIs
python3 IOS/CVSOnlineiPhone/Scripts/toggle-alpha-debug-qa2.py --prod

# Switch Alpha → QA2 APIs (default)
python3 IOS/CVSOnlineiPhone/Scripts/toggle-alpha-debug-qa2.py
```
