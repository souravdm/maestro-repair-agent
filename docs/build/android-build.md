# Health100 Android Build Guide

> Terminal-executable, end-to-end. Every command listed here was run and verified against `android-app` (`cvs-health-source-code/digital-flagship-android`).
> Covers local emulator builds (Debug / healthDebug variant).

---

## Repo and CI Context

| Item | Value |
|---|---|
| **Local folder** | `framework/android-app/` |
| **GitHub repo** | `cvs-health-source-code/digital-flagship-android` |
| **CI system** | GitHub Actions |
| **Default branch** | `main` |
| **Build variant** | `healthDebug` (Gradle: `:CVS:assembleHealthDebug`) |
| **Android app ID** | `com.health100.launchers` |
| **Gradle module** | `CVS` |
| **APK output** | `CVS/build/outputs/apk/health/debug/CVS-health-debug.apk` |

---

## Known Constraints (read before starting)

| Constraint | Detail |
|---|---|
| Corporate proxy required | Direct connections to `cvsh.jfrog.io` time out. Always verify `HTTPS_PROXY=http://127.0.0.1:9000` is up before building (Step 1). |
| JFrog credentials via env vars | Passed as `ORG_GRADLE_PROJECT_cvsJfrogPassword` and `ORG_GRADLE_PROJECT_cvsJfrogUsername` — never hardcoded in `build.gradle.kts`. |
| `-x :ci-env:values-remote:kspKotlin` required locally | KSP task in `ci-env:values-remote` makes a network call to an internal CVS endpoint unreachable outside CVS network. Incremental builds will hit `SocketTimeoutException` without this flag. First full build uses Gradle cache; subsequent runs need the exclusion. |
| `ABI_INIT` uses PID-based path | Gradle init script at `/tmp/ci-abi-filter-$$.gradle` — unique per run, never conflicts on re-run. macOS `mktemp` with a suffix does NOT substitute Xs; do not use `mktemp` for this path. |
| `BUILD_ONLY=1` stops after B4 | Set `BUILD_ONLY=1` before running the script to build and sign the APK without installing or launching (stops after Step B4). |
| Vault token expires ~24 hours | Refresh from https://vault-prod.cvshealth.com every ~24 hours. |
| `local.properties` written each run | `android-build.sh` writes `sdk.dir=$ANDROID_HOME` to `android-app/local.properties` on every run. |
| ParallelGC patch (idempotent) | Script patches `gradle.properties` to swap `UseG1GC` → `UseParallelGC` for higher Gradle throughput on local builds. |

---

## Prerequisites

- Android SDK installed (auto-detected from `~/Library/Android/sdk`, `~/Android/Sdk`, or `ANDROID_HOME`)
- `adb` and `emulator` binaries available in `$ANDROID_HOME/platform-tools` and `$ANDROID_HOME/emulator`
- `python3` available in PATH
- Corporate proxy running at `http://127.0.0.1:9000`
- At least one AVD created (`emulator -list-avds` — create with `scripts/setup/android-setup.sh create`)

---

## Step 0 — Source the Keys File

Run once per terminal session. All credentials are defined in `scripts/build/keys`.

```bash
source /path/to/dual-app-ui-tests/scripts/build/keys
```

This sets `GITHUB_PAT`, `JFROG_TOKEN`, `JFROG_USER`, `VAULT_TOKEN`, and the Develocity token. `android-build.sh` sources the same file automatically — this step is only needed when running manual commands from this guide.

---

## Step 1 — Verify Proxy Is Running

```bash
HTTP_CODE=$(curl -s --proxy http://127.0.0.1:9000 \
  -o /dev/null -w "%{http_code}" \
  https://cvsh.jfrog.io 2>/dev/null || echo "000")
echo "HTTP $HTTP_CODE"
```

**Expected:** any HTTP code that is not `000` — means the proxy is up.  
**If you see** `000` → the proxy is not running. Start it before continuing.

---

## Step 2 — Clone or Update Android App Repo

The script clones fresh if `android-app/` is missing, or pulls latest if it exists. If the remote URL has changed (e.g., switched repos), the directory is re-cloned automatically.

```bash
# Manual clone (if android-app/ is missing):
git clone -b main \
  "https://${GITHUB_PAT}@github.com/cvs-health-source-code/digital-flagship-android.git" \
  "$FRAMEWORK_ROOT/android-app"

echo "sdk.dir=$ANDROID_HOME" > "$FRAMEWORK_ROOT/android-app/local.properties"
```

---

## Step 3 — Feature Flag Patches

`android-build.sh` applies four feature flag patches before every build. All patches are idempotent.

| Flag key | From | To |
|---|---|---|
| `caoad-invite-only-access` | `true` | `false` |
| `unified-swipe-menu` | `false` | `true` |
| `enable-h100-chatbot` | `false` | `true` |
| `open-platform-enable-benefits-tab` | `false` | `true` |

The script finds each flag's `.kt` file under `android-app/feature-flag/`, locates the `default = <value>` line within 5 lines of the key declaration, and replaces it. If already patched, prints `(already patched)` and continues.

---

## Step 4 — Boot Emulator

If an emulator is already running (`adb devices` shows `device` state), this step is skipped. Otherwise the script auto-detects the first AVD from `emulator -list-avds` and boots it headless.

```bash
# Check if already running:
adb devices | grep emulator

# Manual boot (if needed):
emulator -avd <AVD_NAME> -no-window -no-audio -no-boot-anim -no-snapshot \
  -memory 4096 -cores 4 > /tmp/android-emulator.log 2>&1 &

adb wait-for-device
until [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r\n')" = "1" ]; do
  sleep 5
done
echo "Booted"
```

---

## B1 — Source Patches

`android-build.sh` applies two source patches before every build. Both are idempotent.

| What it patches | File | Failure it prevents |
|---|---|---|
| `readSecretFileValues` null-safety | `CVS/build.gradle.kts` | NPE at Gradle config time when Vault returns `{"errors":[...]}` — `root["data"]` is null and force-cast throws |
| GC tuning | `gradle.properties` | `UseG1GC` → `UseParallelGC` for higher Gradle throughput |

**The null-safety patch:**

```kotlin
// Before (force-cast fails when Vault errors):
return (root["data"] as Map<*, *>)["data"] as Map<*, *>

// After (safe-cast returns emptyMap so build continues):
return (root["data"] as? Map<*, *>)?.get("data") as? Map<*, *> ?: emptyMap<Nothing, Nothing>()
```

---

## B2 — Gradle Build

```bash
cd "$ANDROID_APP_DIR"
chmod +x gradlew

export ORG_GRADLE_PROJECT_cvsJfrogPassword="$JFROG_TOKEN"
export ORG_GRADLE_PROJECT_cvsJfrogUsername="$JFROG_USER"
export DEVELOCITY_ACCESS_KEY="develocity.aetnadigital.com=${DEVELOCITY_TOKEN}"
export HASHICORP_VAULT_TOKEN="$VAULT_TOKEN"

# ABI init script — forces arm64-v8a on Apple Silicon (or x86_64 on Intel/CI)
ABI_INIT="/tmp/ci-abi-filter-$$.gradle"
cat > "$ABI_INIT" << 'INIT_EOF'
allprojects {
    pluginManager.withPlugin("com.android.application") {
        def targetAbi = (project.findProperty("ci.target.abi") ?: "arm64-v8a").toString()
        def forceAbi = { ndkOpts ->
            try { ndkOpts.abiFilters.clear(); ndkOpts.abiFilters.add(targetAbi) }
            catch (Exception ignored) {}
        }
        def androidComponents = project.extensions.findByName("androidComponents")
        if (androidComponents != null) {
            androidComponents.finalizeDsl { ext ->
                forceAbi(ext.defaultConfig.ndk)
                ext.buildTypes.configureEach    { bt -> forceAbi(bt.ndk) }
                ext.productFlavors.configureEach { pf -> forceAbi(pf.ndk) }
            }
        } else {
            project.afterEvaluate {
                def android = project.extensions.getByName("android")
                forceAbi(android.defaultConfig.ndk)
                android.buildTypes.each    { bt -> forceAbi(bt.ndk) }
                android.productFlavors.each { pf -> forceAbi(pf.ndk) }
            }
        }
    }
}
INIT_EOF

./gradlew :CVS:assembleHealthDebug \
  --init-script "$ABI_INIT" \
  -Pci.target.abi=arm64-v8a \
  -Pandroid.injected.abis=arm64-v8a \
  -Pandroid.injected.invoked.from.ide=true \
  --no-configuration-cache \
  -x :ci-env:values-remote:kspKotlin \
  2>&1 | tee /tmp/android-build.log

rm -f "$ABI_INIT"
```

**Expected:** `BUILD SUCCESSFUL` in `/tmp/android-build.log`.

Check result:
```bash
grep -E "BUILD (SUCCESSFUL|FAILED)" /tmp/android-build.log | tail -1
```

Build times:
- **First full build** (cold Gradle cache): 15–30 min
- **Incremental build** (warm cache): 3–8 min

If you see compiler errors:
```bash
grep ": error:" /tmp/android-build.log | head -20
```

---

## B3 — Locate APK

The script searches in order: variant-scoped path → module APK dir → full tree fallback.

```bash
cd "$ANDROID_APP_DIR"
find CVS/build/outputs/apk/health/debug -name "*.apk" -type f | head -1
```

**Expected:** `CVS/build/outputs/apk/health/debug/CVS-health-debug.apk`

---

## B4 — Sign APK

Debug builds (variant name does not contain `unsigned`) are already debug-signed by Gradle — no signing step needed.

If the APK filename contains `unsigned` (release or unsigned debug builds):

```bash
DEBUG_KS="$HOME/.android/debug.keystore"

# Create debug keystore if missing
[ -f "$DEBUG_KS" ] || keytool -genkey -v \
  -keystore "$DEBUG_KS" \
  -storepass android -alias androiddebugkey -keypass android \
  -keyalg RSA -keysize 2048 -validity 10000 \
  -dname "CN=Android Debug,O=Android,C=US" > /dev/null 2>&1

APKSIGNER=$(find "$ANDROID_HOME/build-tools" -name "apksigner" -type f | sort -t/ -k1,1V | tail -1)
ZIPALIGN=$(find "$ANDROID_HOME/build-tools" -name "zipalign" -type f | sort -t/ -k1,1V | tail -1)

ALIGNED="${APK_FULL_PATH%-unsigned.apk}-aligned.apk"
SIGNED="${APK_FULL_PATH%-unsigned.apk}-debug-signed.apk"

"$ZIPALIGN" -f -v 4 "$APK_FULL_PATH" "$ALIGNED"
"$APKSIGNER" sign \
  --ks "$DEBUG_KS" --ks-pass pass:android --key-pass pass:android \
  --out "$SIGNED" "$ALIGNED"
rm -f "$ALIGNED"
```

> **To stop after this step** without installing: `BUILD_ONLY=1 ./android-build.sh`

---

## B5 — Install APK on Emulator

```bash
# Uninstall first (avoids INSTALL_FAILED_VERSION_DOWNGRADE)
adb -s "$ANDROID_DEVICE_ID" uninstall com.health100.launchers 2>/dev/null || true

adb -s "$ANDROID_DEVICE_ID" install -r "$APK_FULL_PATH"
```

**Expected:** `Success`

If you see `INSTALL_FAILED_INSUFFICIENT_STORAGE`:
```bash
adb -s "$ANDROID_DEVICE_ID" shell pm trim-caches 9999999999 2>/dev/null || true
adb -s "$ANDROID_DEVICE_ID" shell rm -rf /data/local/tmp/* 2>/dev/null || true
adb -s "$ANDROID_DEVICE_ID" install -r "$APK_FULL_PATH"
```

---

## B6 — Launch Health100 Android

```bash
adb -s "$ANDROID_DEVICE_ID" shell monkey \
  -p com.health100.launchers -c android.intent.category.LAUNCHER 1
sleep 3
```

---

## B7 — Verify App Is Running

```bash
PID=$(adb -s "$ANDROID_DEVICE_ID" shell pidof com.health100.launchers 2>/dev/null | tr -d '\r\n')
echo "PID: $PID"

# Check logcat for crash signals
adb -s "$ANDROID_DEVICE_ID" logcat -d -t 100 2>/dev/null \
  | grep -E "FATAL EXCEPTION|AndroidRuntime" | tail -5
```

**Expected:** A non-empty PID. No `FATAL EXCEPTION` or `AndroidRuntime` lines after launch.

---

## Incremental Rebuild

Use when you need to rebuild after a `git pull` or source change without re-running the full clone flow.

```bash
cd "$ANDROID_APP_DIR"

# Reset any local patches (will be re-applied by the script)
git restore .
git clean -fd

# Pull latest
git pull origin main

# Re-run the full script (all patches are idempotent; Gradle reuses cache)
source scripts/build/keys && ./scripts/build/android-build.sh
```

Alternatively, run only the Gradle step manually (B2 above) with the same flags after pulling and re-applying patches.

---

# Troubleshooting

## `SocketTimeoutException` / KSP network timeout

Task `:ci-env:values-remote:kspKotlin` makes a network call to an internal CVS endpoint unreachable locally.

- **Fix:** Ensure `-x :ci-env:values-remote:kspKotlin` is present in the Gradle command (already in `android-build.sh`).
- **When it happens:** Only on incremental builds after the Gradle cache for the KSP outputs has been invalidated (e.g., after `git reset --hard` or a clean).

## `NullPointerException` in `readSecretFileValues` at Gradle config time

Vault returned `{"errors": [...]}` — `root["data"]` is null and the force-cast throws.

- **Fix:** Ensure the B1 null-safety patch is applied to `CVS/build.gradle.kts` (handled automatically by `android-build.sh`).
- **Verify:** `grep "as? Map" "$ANDROID_APP_DIR/CVS/build.gradle.kts"`

## `INSTALL_FAILED_VERSION_DOWNGRADE`

Old APK on emulator has a higher version code.

- **Fix:** Uninstall first: `adb -s "$ANDROID_DEVICE_ID" uninstall com.health100.launchers`

## `INSTALL_FAILED_NO_MATCHING_ABIS`

APK does not contain native libs for the emulator's architecture.

- **Fix:** Ensure `ABI_INIT` Gradle init script is present and `TARGET_ABI` matches the emulator (arm64-v8a for Apple Silicon, x86_64 for Intel/CI).

## Gradle build fails immediately — `ABI_INIT` path error

`mktemp /tmp/ci-abi-filter-XXXXXX.gradle` on macOS creates the literal filename (does not substitute Xs when a suffix follows) — fails with "File exists" on the second run.

- **Fix:** Use PID-based path: `ABI_INIT="/tmp/ci-abi-filter-$$.gradle"` (already in `android-build.sh`).

## Emulator not detected — `ANDROID_DEVICE_ID` empty

`adb devices` shows `offline` or the emulator is not listed.

- **Check:** `cat /tmp/android-emulator.log`
- **Fix:** Kill and restart adb: `adb kill-server && adb start-server`, then re-run step 4.

## Proxy not running — `curl: (7) Failed to connect`

- **Fix:** Start the corporate proxy before running the script. Then re-run Step 1 to verify.

## Vault token expired — `permission denied` / HTTP 403

- **Fix:** Get a fresh token from https://vault-prod.cvshealth.com, update `scripts/build/keys`, and re-run.

---

## Reference

| Item | Value |
|---|---|
| **Android app ID** | `com.health100.launchers` |
| **GitHub repo** | `cvs-health-source-code/digital-flagship-android` |
| **Local clone path** | `<framework-root>/android-app/` |
| **APK output** | `CVS/build/outputs/apk/health/debug/CVS-health-debug.apk` |
| **Gradle task** | `:CVS:assembleHealthDebug` |
| **Emulator log** | `/tmp/android-emulator.log` |
| **Build log** | `/tmp/android-build.log` |
| **ABI (Apple Silicon)** | `arm64-v8a` |
| **ABI (Intel / CI)** | `x86_64` |
| **JFrog Gradle creds** | `ORG_GRADLE_PROJECT_cvsJfrogPassword`, `ORG_GRADLE_PROJECT_cvsJfrogUsername` |
| **Proxy** | `http://127.0.0.1:9000` |
| **Vault URL** | `https://vault-prod.cvshealth.com` |
