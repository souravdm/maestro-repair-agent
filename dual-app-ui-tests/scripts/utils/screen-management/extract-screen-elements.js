#!/usr/bin/env node

/**
 * Screen Element Extractor
 *
 * Crawls iOS (Swift/SwiftUI/Storyboard/Flutter) and Android (Compose/XML/strings.xml)
 * app codebases, extracts user-visible text elements, and generates Maestro-compatible
 * screen JS files. Compares against existing screen files to surface differences.
 *
 * Usage:
 *   node scripts/utils/screen-management/extract-screen-elements.js <feature> [options]
 *
 * Examples:
 *   node scripts/utils/screen-management/extract-screen-elements.js account
 *   node scripts/utils/screen-management/extract-screen-elements.js pharmacy --platform ios
 *   node scripts/utils/screen-management/extract-screen-elements.js benefits --dry-run
 *   node scripts/utils/screen-management/extract-screen-elements.js shop --output ./my-output
 */

const fs = require("fs");
const path = require("path");

// ============================================================
// CONFIGURATION
// ============================================================

const IOS_ROOT =
  process.env.IOS_APP_PATH ||
  path.join(
    process.env.HOME,
    ".maestro-builds/ios/digital-flagship-ios"
  );
const ANDROID_ROOT =
  process.env.ANDROID_APP_PATH ||
  path.join(
    process.env.HOME,
    ".maestro-builds/android/digital-flagship-android"
  );
const SCREENS_DIR = path.resolve(
  __dirname,
  "../../.maestro/screens"
);

// Feature → codebase directory mapping
// Uses auto-discovery: android_base is scanned recursively for all src/main/java,
// src/main/res, src/main/kotlin, and strings.xml files automatically.
// related_ios_packages pulls in cross-feature iOS packages (e.g., Caremark for benefits).
// flutter_packages lists Flutter sub-package names under IOS/Submodule/packages/pharmacy/.
// Sub-feature support: use "benefits/claims" to filter to a specific sub-module.
const FEATURE_MAP = {
  account: {
    ios_native: ["IOS/CVSOnlineiPhone/CVSOnlineiPhone/ViewControllers/Account"],
    ios_packages: ["IOS/Packages/Account/Sources"],
    ios_storyboards: ["IOS/CVSOnlineiPhone/CVSOnlineiPhone/ViewControllers/Account"],
    flutter_packages: [],
    related_ios_packages: [],
    android_base: "account",
    screens_dir: "Account",
  },
  benefits: {
    ios_native: [],
    ios_packages: ["IOS/Packages/Benefits/Sources"],
    ios_storyboards: [],
    flutter_packages: ["benefits"],
    related_ios_packages: ["IOS/Packages/Caremark/Sources"],
    android_base: "benefits",
    screens_dir: "Benefits",
    // Sub-features map to android sub-module directories and screen sub-directories
    sub_features: {
      claims:         { android_filter: "claims",           screens_sub: "Claims",         ios_filter: "Claims" },
      "drug-pricing": { android_filter: "cdc",              screens_sub: "DrugPricing",    ios_filter: "DrugPricing|CDC|Caremark" },
      providers:      { android_filter: "pharmacylocator",  screens_sub: "Providers",      ios_filter: "Provider|Locator" },
      "member-id":    { android_filter: "member-id-details",screens_sub: "MemberID",       ios_filter: "MemberID|MemberId" },
      "plan-summary": { android_filter: "plansummary",      screens_sub: "PlanSummary",    ios_filter: "PlanSummary|Plan" },
      "prior-auth":   { android_filter: "priorauth",        screens_sub: "PriorAuth",      ios_filter: "PriorAuth" },
      spending:       { android_filter: "plansummary",      screens_sub: "Spending",       ios_filter: "Spending" },
      landing:        { android_filter: "landing",          screens_sub: "",               ios_filter: "Landing|Dashboard" },
    },
  },
  pharmacy: {
    ios_native: ["IOS/CVSOnlineiPhone/CVSOnlineiPhone/ViewControllers/Pharmacy"],
    ios_packages: [],
    ios_storyboards: ["IOS/CVSOnlineiPhone/CVSOnlineiPhone/ViewControllers/Pharmacy"],
    flutter_packages: ["rx_transfer"],
    related_ios_packages: [],
    android_base: "pharmacy",
    screens_dir: "Pharmacy",
  },
  shop: {
    ios_native: ["IOS/CVSOnlineiPhone/CVSOnlineiPhone/ViewControllers/Shop"],
    ios_packages: ["IOS/Packages/Shop/Sources"],
    ios_storyboards: ["IOS/CVSOnlineiPhone/CVSOnlineiPhone/ViewControllers/Shop"],
    flutter_packages: [],
    related_ios_packages: [],
    android_base: "shop",
    screens_dir: "Shop",
  },
  health: {
    ios_native: [],
    ios_packages: ["IOS/Packages/Health/Sources"],
    ios_storyboards: [],
    flutter_packages: [],
    related_ios_packages: [],
    android_base: "health",
    screens_dir: "Health",
  },
  home: {
    ios_native: [
      "IOS/CVSOnlineiPhone/CVSOnlineiPhone/ViewControllers/Homepage",
      "IOS/CVSOnlineiPhone/CVSOnlineiPhone/ViewControllers/NewHomeScreen",
    ],
    ios_packages: ["IOS/Packages/Home/Sources"],
    ios_storyboards: [],
    flutter_packages: [],
    related_ios_packages: [],
    android_base: "home",
    screens_dir: "Home",
  },
  superapp: {
    ios_native: [],
    ios_packages: ["IOS/Packages/SuperAppOnboarding"],
    ios_storyboards: [],
    flutter_packages: [],
    related_ios_packages: [],
    android_base: null,
    screens_dir: "SearchAndNav",
  },
  mccore: {
    ios_native: [],
    ios_packages: ["IOS/Packages/Caremark/Sources"],
    ios_storyboards: ["IOS/Packages/Caremark/Sources/Caremark"],
    flutter_packages: [],
    related_ios_packages: [],
    android_base: null,
    screens_dir: "MCCore",
  },
  haio: {
    ios_native: [],
    ios_packages: [],
    ios_storyboards: [],
    ios_pods: [
      "IOS/CVSOnlineiPhone/Pods/CVSChatbot/Sources/CVSChatbot",
      "IOS/CVSOnlineiPhone/Pods/NemoChatBot/Sources/NemoChatBot",
    ],
    flutter_packages: [],
    related_ios_packages: [],
    android_base: "enterprise-chat",
    screens_dir: "HAIO",
  },
  ngs: {
    ios_native: [],
    ios_packages: ["IOS/Packages/HealthRecords"],
    ios_storyboards: [],
    flutter_packages: [],
    related_ios_packages: [],
    android_base: "health/records",
    screens_dir: "NGS",
  },
  vm: {
    ios_native: [],
    ios_packages: ["IOS/Packages/Health/Sources/VisitManager"],
    ios_storyboards: [],
    flutter_packages: [],
    related_ios_packages: [],
    android_base: "health/care-options",
    screens_dir: "VM",
  },
  "side-menu": {
    ios_native: [
      "IOS/CVSOnlineiPhone/HomeScreen/View/MoreMenu",
      "IOS/CVSOnlineiPhone/CVSOnlineiPhone/ViewControllers/TabBarController",
    ],
    ios_packages: ["IOS/Packages/UnifiedNavigation/Sources"],
    ios_storyboards: [],
    flutter_packages: [],
    related_ios_packages: [],
    android_base: "unified-nav/menu",
    screens_dir: "Menu",
  },
  "explore-more": {
    ios_native: [
      "IOS/CVSOnlineiPhone/HomeScreen/View/MoreMenu",
    ],
    ios_packages: ["IOS/Packages/UnifiedNavigation/Sources"],
    ios_storyboards: [],
    flutter_packages: [],
    related_ios_packages: [],
    android_base: "unified-nav",
    screens_dir: "SearchAndNav",
    sub_features: {
      menu:       { android_filter: "menu",        screens_sub: "",        ios_filter: "Menu|MoreMenu|Sheet" },
      "bottom-nav": { android_filter: "bottom-nav", screens_sub: "",      ios_filter: "TabBar|Tab|Bubble" },
      header:     { android_filter: "header",       screens_sub: "",      ios_filter: "Header|Unified" },
      search:     { android_filter: "search",       screens_sub: "",      ios_filter: "Search|TypeAhead" },
    },
  },
  chatbot: {
    ios_native: [],
    ios_packages: [],
    ios_storyboards: [],
    ios_pods: [
      "IOS/CVSOnlineiPhone/Pods/CVSChatbot/Sources/CVSChatbot",
      "IOS/CVSOnlineiPhone/Pods/NemoChatBot/Sources/NemoChatBot",
    ],
    flutter_packages: [],
    related_ios_packages: [],
    android_base: "smartscheduling",
    screens_dir: "SearchAndNav",
  },
};

// ============================================================
// AUTO-DISCOVERY: Find all source dirs under a feature's Android base
// ============================================================

/**
 * Recursively discover all `src/main/java` and `src/main/kotlin` dirs
 * under a base Android module directory, skipping build/test dirs.
 */
function discoverAndroidSourceDirs(baseDir) {
  const results = [];
  if (!fs.existsSync(baseDir)) return results;

  function scan(dir, depth) {
    if (depth > 8) return; // safety limit
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (/^(build|\.gradle|\.kotlin|\.git|\.transforms|kspCaches|intermediates|generated|tmp|outputs)$/.test(entry.name)) continue;
        const full = path.join(dir, entry.name);
        // Check if this is a src/main/java or src/main/kotlin directory
        for (const srcType of ["src/main/java", "src/main/kotlin"]) {
          const srcDir = path.join(full, srcType);
          if (fs.existsSync(srcDir)) results.push(srcDir);
        }
        // Also check deeper: domain/domainPrivate/src/main/java etc.
        scan(full, depth + 1);
      }
    } catch (e) { /* permission errors */ }
  }

  // Check the base dir itself
  for (const srcType of ["src/main/java", "src/main/kotlin"]) {
    const srcDir = path.join(baseDir, srcType);
    if (fs.existsSync(srcDir)) results.push(srcDir);
  }
  scan(baseDir, 0);
  return results;
}

/**
 * Recursively discover all strings.xml files under a base Android module directory.
 */
function discoverAndroidStringsFiles(baseDir) {
  const results = [];
  if (!fs.existsSync(baseDir)) return results;

  function scan(dir, depth) {
    if (depth > 8) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (/^(build|\.gradle|\.kotlin|\.git|\.transforms|kspCaches|intermediates|generated|tmp|outputs)$/.test(entry.name)) continue;
        const full = path.join(dir, entry.name);
        // Check for values/strings.xml
        const stringsFile = path.join(full, "src/main/res/values/strings.xml");
        if (fs.existsSync(stringsFile)) results.push(stringsFile);
        scan(full, depth + 1);
      }
    } catch (e) { /* permission errors */ }
  }

  // Check base dir itself
  const baseStrings = path.join(baseDir, "src/main/res/values/strings.xml");
  if (fs.existsSync(baseStrings)) results.push(baseStrings);
  scan(baseDir, 0);
  return results;
}

/**
 * Recursively discover all res/layout directories under a base Android module directory.
 */
function discoverAndroidLayoutDirs(baseDir) {
  const results = [];
  if (!fs.existsSync(baseDir)) return results;

  function scan(dir, depth) {
    if (depth > 8) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (/^(build|\.gradle|\.kotlin|\.git|\.transforms|kspCaches|intermediates|generated|tmp|outputs)$/.test(entry.name)) continue;
        const full = path.join(dir, entry.name);
        const layoutDir = path.join(full, "src/main/res/layout");
        if (fs.existsSync(layoutDir)) results.push(layoutDir);
        scan(full, depth + 1);
      }
    } catch (e) { /* permission errors */ }
  }

  const baseLayout = path.join(baseDir, "src/main/res/layout");
  if (fs.existsSync(baseLayout)) results.push(baseLayout);
  scan(baseDir, 0);
  return results;
}

/**
 * Filter discovered paths to only include those matching a sub-feature name.
 * E.g., subFeature="claims" keeps only paths containing "/claims/" or "/claims-".
 */
function filterPathsBySubFeature(paths, subFeatureFilter) {
  if (!subFeatureFilter) return paths;
  const pattern = new RegExp(`[/\\\\](${subFeatureFilter})([/\\\\-]|$)`, "i");
  return paths.filter(p => pattern.test(p));
}

// ============================================================
// FILE WALKERS
// ============================================================

function walkDir(dir, extensions) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // Skip build, test, and generated directories
        if (
          /\b(build|test|tests|__tests__|\.build|DerivedData|Pods|node_modules|\.git)\b/i.test(
            entry.name
          )
        )
          continue;
        results.push(...walkDir(fullPath, extensions));
      } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
        results.push(fullPath);
      }
    }
  } catch (e) {
    // permission errors etc
  }
  return results;
}

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

// ============================================================
// ELEMENT EXTRACTORS
// ============================================================

/**
 * Extract elements from Swift/SwiftUI files.
 * Looks for: Text("..."), Button("..."), .accessibilityLabel("..."),
 * TextField("...", ...), .navigationTitle("..."), Label("..."),
 * placeholder text, alert titles/messages
 */
function extractSwiftElements(filePath) {
  const content = readFileSafe(filePath);
  if (!content) return [];
  const elements = [];
  const fileName = path.basename(filePath, path.extname(filePath));
  const screenName = inferScreenName(fileName);

  const patterns = [
    // SwiftUI Text
    { re: /\bText\(\s*"([^"]{2,80})"\s*\)/g, type: "text" },
    // Button with string title
    { re: /\bButton\(\s*"([^"]{2,80})"\s*[,)]/g, type: "button" },
    // NavigationTitle
    { re: /\.navigationTitle\(\s*"([^"]{2,80})"\s*\)/g, type: "title" },
    // Accessibility label
    { re: /\.accessibilityLabel\(\s*"([^"]{2,80})"\s*\)/g, type: "a11y" },
    // TextField placeholder
    { re: /\bTextField\(\s*"([^"]{2,80})"\s*,/g, type: "field" },
    // SecureField placeholder
    { re: /\bSecureField\(\s*"([^"]{2,80})"\s*,/g, type: "field" },
    // Label
    { re: /\bLabel\(\s*"([^"]{2,80})"\s*,/g, type: "label" },
    // Alert title/message
    { re: /\.alert\(\s*"([^"]{2,80})"/g, type: "alert" },
    // Tab item label
    { re: /\.tabItem\s*\{[^}]*Text\(\s*"([^"]{2,80})"\s*\)/gs, type: "tab" },
    // String constants assigned
    { re: /(?:let|var)\s+\w*(?:Title|Label|Text|Message|Placeholder|Header|Button)\w*\s*[:=]\s*"([^"]{2,80})"/g, type: "constant" },
  ];

  for (const { re, type } of patterns) {
    let m;
    while ((m = re.exec(content)) !== null) {
      const text = m[1].trim();
      if (text && !isCodeNoise(text)) {
        elements.push({ text, type, source: "swift", screen: screenName, file: filePath });
      }
    }
  }

  return elements;
}

/**
 * Extract elements from iOS Localization.generated.swift files (SwiftGen output).
 * These contain ALL user-visible strings with fallback values.
 * Format: internal static let key = Localization.tr("Localizable", "localization.key", fallback: "Actual text")
 */
function extractiOSLocalizationGenerated(filePath) {
  const content = readFileSafe(filePath);
  if (!content) return [];
  const elements = [];

  // Track current enum nesting for screen name inference
  const enumStack = [];
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    // Track enum nesting: internal enum PharmacyLocator {
    const enumMatch = trimmed.match(/^\s*internal\s+enum\s+(\w+)\s*\{/);
    if (enumMatch) {
      enumStack.push(enumMatch[1]);
      continue;
    }
    if (trimmed === "}") {
      enumStack.pop();
      continue;
    }

    // Match: internal static let key = Localization.tr("Localizable", "key.path", fallback: "text")
    const m = trimmed.match(
      /internal\s+static\s+let\s+(\w+)\s*=\s*Localization\.tr\(\s*"[^"]*"\s*,\s*"([^"]+)"\s*(?:,\s*[^,]+)*,\s*fallback:\s*"([^"]+)"\s*\)/
    );
    if (!m) continue;

    const propName = m[1];
    const locKey = m[2];
    const fallbackText = m[3];

    if (!fallbackText || fallbackText.length < 2 || isCodeNoise(fallbackText)) continue;

    // Infer screen name from enum nesting
    const screenName = inferScreenName(enumStack.length > 0 ? enumStack[enumStack.length - 1] : "Localization");

    // Infer type from localization key path
    let type = "text";
    if (/accessibility/i.test(locKey)) type = "a11y";
    else if (/button|cta|action/i.test(locKey)) type = "button";
    else if (/title|header|heading/i.test(locKey)) type = "title";
    else if (/placeholder|hint|field/i.test(locKey)) type = "field";
    else if (/label/i.test(locKey)) type = "label";
    else if (/alert|error|warning/i.test(locKey)) type = "alert";
    else if (/tab/i.test(locKey)) type = "tab";

    elements.push({
      text: fallbackText,
      type,
      source: "ios_l10n",
      screen: screenName,
      key: locKey,
      file: filePath,
    });
  }

  return elements;
}

/**
 * Extract elements from Flutter ARB (Application Resource Bundle) localization files.
 * Format: JSON with "key": "Visible text" pairs. Keys starting with "@" are metadata.
 */
function extractFlutterARB(filePath) {
  const content = readFileSafe(filePath);
  if (!content) return [];
  const elements = [];
  const fileName = path.basename(filePath, ".arb").replace(/_en$/, "");
  const screenName = inferScreenName(fileName);

  let json;
  try {
    json = JSON.parse(content);
  } catch {
    return elements;
  }

  for (const [key, value] of Object.entries(json)) {
    // Skip metadata keys (start with @) and non-string values
    if (key.startsWith("@") || typeof value !== "string") continue;
    if (!value || value.length < 2 || isCodeNoise(value)) continue;

    // Infer type from key name
    let type = "text";
    if (/button|btn|cta|action/i.test(key)) type = "button";
    else if (/title|header|heading/i.test(key)) type = "title";
    else if (/hint|placeholder|field|input/i.test(key)) type = "field";
    else if (/label/i.test(key)) type = "label";
    else if (/error|alert|warning/i.test(key)) type = "alert";
    else if (/description|desc/i.test(key)) type = "a11y";

    elements.push({
      text: value,
      type,
      source: "flutter_arb",
      screen: screenName,
      key,
      file: filePath,
    });
  }

  return elements;
}

/**
 * Extract elements from Storyboard/XIB files.
 * Looks for: text="...", placeholder="...", title="...",
 * accessibilityLabel="...", accessibilityHint="..."
 */
function extractStoryboardElements(filePath) {
  const content = readFileSafe(filePath);
  if (!content) return [];
  const elements = [];
  const fileName = path.basename(filePath, path.extname(filePath));
  const screenName = inferScreenName(fileName);

  const patterns = [
    { re: /\btext="([^"]{2,80})"/g, type: "text" },
    { re: /\bplaceholder="([^"]{2,80})"/g, type: "field" },
    { re: /\btitle="([^"]{2,80})"/g, type: "button" },
    { re: /\baccessibilityLabel="([^"]{2,80})"/g, type: "a11y" },
    { re: /\baccessibilityHint="([^"]{2,80})"/g, type: "a11y" },
    { re: /\bheaderTitle="([^"]{2,80})"/g, type: "title" },
  ];

  for (const { re, type } of patterns) {
    let m;
    while ((m = re.exec(content)) !== null) {
      const text = m[1].trim();
      if (text && !isCodeNoise(text)) {
        elements.push({ text, type, source: "storyboard", screen: screenName, file: filePath });
      }
    }
  }

  return elements;
}

/**
 * Extract elements from Flutter/Dart files.
 * Looks for: Text("..."), labelText: "...", hintText: "...",
 * title: "...", semanticsLabel: "...", Key("...")
 */
function extractFlutterElements(filePath) {
  const content = readFileSafe(filePath);
  if (!content) return [];
  const elements = [];
  const fileName = path.basename(filePath, ".dart");
  const screenName = inferScreenName(fileName);

  const patterns = [
    // Direct Text widget
    { re: /\bText\(\s*['"]([^'"]{2,80})['"]\s*[,)]/g, type: "text" },
    // Named params with string values
    { re: /\blabelText:\s*['"]([^'"]{2,80})['"]/g, type: "label" },
    { re: /\bhintText:\s*['"]([^'"]{2,80})['"]/g, type: "field" },
    { re: /\btitle:\s*['"]([^'"]{2,80})['"]/g, type: "title" },
    { re: /\bsemanticsLabel:\s*['"]([^'"]{2,80})['"]/g, type: "a11y" },
    { re: /\btooltip:\s*['"]([^'"]{2,80})['"]/g, type: "a11y" },
    // ValueKey
    { re: /\bValueKey(?:<\w+>)?\(\s*['"]([^'"]{2,80})['"]\s*\)/g, type: "key" },
    // Constants dictionary access for translated strings
    { re: /translatedConstants\["[^"]+"\]\["([^"]+)"\]/g, type: "constant_key" },
  ];

  for (const { re, type } of patterns) {
    let m;
    while ((m = re.exec(content)) !== null) {
      const text = m[1].trim();
      if (text && !isCodeNoise(text)) {
        elements.push({ text, type, source: "flutter", screen: screenName, file: filePath });
      }
    }
  }

  return elements;
}

/**
 * Extract elements from Kotlin/Compose files.
 * Looks for: Text("..."), stringResource(R.string.xxx),
 * contentDescription = "...", Modifier.semantics { contentDescription = "..." }
 */
function extractComposeElements(filePath) {
  const content = readFileSafe(filePath);
  if (!content) return [];
  const elements = [];
  const fileName = path.basename(filePath, path.extname(filePath));
  const screenName = inferScreenName(fileName);

  const patterns = [
    // Direct Text composable
    { re: /\bText\(\s*(?:text\s*=\s*)?["']([^"']{2,80})["']\s*[,)]/g, type: "text" },
    // stringResource references — capture the resource name
    { re: /\bstringResource\(\s*R\.string\.(\w+)\s*\)/g, type: "string_res" },
    // contentDescription
    { re: /\bcontentDescription\s*=\s*["']([^"']{2,80})["']/g, type: "a11y" },
    // Button text
    { re: /\bPulseContainedButton\([^)]*text\s*=\s*(?:stringResource\(\s*R\.string\.(\w+)\s*\)|["']([^"']{2,80})["'])/g, type: "button" },
    // labelText param
    { re: /\blabelText\s*=\s*(?:stringResource\(\s*R\.string\.(\w+)\s*\)|["']([^"']{2,80})["'])/g, type: "label" },
    // placeholder
    { re: /\bplaceholder\s*=\s*\{[^}]*Text\(\s*(?:stringResource\(\s*R\.string\.(\w+)\s*\)|["']([^"']{2,80})["'])/g, type: "field" },
    // String constants
    { re: /(?:val|var)\s+\w*(?:Title|Label|Text|Message|Header|Button)\w*\s*=\s*["']([^"']{2,80})["']/g, type: "constant" },
  ];

  for (const { re, type } of patterns) {
    let m;
    while ((m = re.exec(content)) !== null) {
      // Pick first captured group that has a value
      const text = (m[1] || m[2] || "").trim();
      if (text && !isCodeNoise(text)) {
        elements.push({ text, type, source: "compose", screen: screenName, file: filePath });
      }
    }
  }

  return elements;
}

/**
 * Extract elements from Android strings.xml files.
 * Returns name→value pairs.
 */
function extractAndroidStrings(filePath) {
  const content = readFileSafe(filePath);
  if (!content) return [];
  const elements = [];
  const re = /<string\s+name="([^"]+)"[^>]*>([^<]+)<\/string>/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const name = m[1];
    let value = m[2].trim();
    // Unescape XML entities
    value = value
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/\\n/g, "\n");
    if (value.length >= 2 && !isCodeNoise(value)) {
      elements.push({
        text: value,
        type: "string_resource",
        key: name,
        source: "strings_xml",
        file: filePath,
      });
    }
  }
  return elements;
}

/**
 * Extract elements from Android XML layout files.
 */
function extractAndroidLayoutElements(filePath) {
  const content = readFileSafe(filePath);
  if (!content) return [];
  const elements = [];
  const fileName = path.basename(filePath, ".xml");
  const screenName = inferScreenName(fileName);

  const patterns = [
    { re: /android:text="([^@][^"]{1,80})"/g, type: "text" },
    { re: /android:hint="([^@][^"]{1,80})"/g, type: "field" },
    { re: /android:contentDescription="([^@][^"]{1,80})"/g, type: "a11y" },
    // String resource references
    { re: /android:text="@string\/([^"]+)"/g, type: "string_ref" },
    { re: /android:hint="@string\/([^"]+)"/g, type: "string_ref" },
    { re: /android:contentDescription="@string\/([^"]+)"/g, type: "string_ref" },
  ];

  for (const { re, type } of patterns) {
    let m;
    while ((m = re.exec(content)) !== null) {
      const text = m[1].trim();
      if (text && !isCodeNoise(text)) {
        elements.push({ text, type, source: "xml_layout", screen: screenName, file: filePath });
      }
    }
  }

  return elements;
}

// ============================================================
// HELPERS
// ============================================================

/** Filter out code noise — strings that are clearly not user-visible */
function isCodeNoise(text) {
  if (text.length < 2 || text.length > 120) return true;
  // Filter out file paths, URLs, format strings, code identifiers
  if (/^[a-z_][a-z0-9_.]*$/i.test(text) && text.length < 5) return true;
  if (/^https?:\/\//.test(text)) return true;
  if (/^\d+$/.test(text)) return true;
  if (/^%[dsfg@]/.test(text)) return true;
  if (/^[.\/\\]/.test(text)) return true;
  if (/\{.*\}/.test(text) && !/\b(you|your|the|a|an|is|are)\b/i.test(text)) return true;
  // Color hex, font names
  if (/^#[0-9a-fA-F]{3,8}$/.test(text)) return true;
  if (/^(Helvetica|SFPro|Roboto|Arial|Inter)/i.test(text)) return true;
  // Common code keywords
  if (/^(null|nil|true|false|void|self|this|super|import|class|struct|func|fun|let|var|val|const)$/i.test(text)) return true;
  return false;
}

/** Convert file name to a screen name for grouping */
function inferScreenName(fileName) {
  return fileName
    .replace(/Screen$|Content$|UiContent$|ViewController$|Fragment$|Activity$|Objects$|View$|Page$|Widget$/i, "")
    .replace(/^(CVS|Cvs)/i, "")
    .replace(/([a-z])([A-Z])/g, "$1_$2")
    .replace(/[_\-]+/g, "_")
    .toLowerCase();
}

/** Convert screen name to camelCase element key */
function toCamelCase(str) {
  return str
    .replace(/[_\-\s]+(.)/g, (_, c) => c.toUpperCase())
    .replace(/^(.)/, (c) => c.toLowerCase());
}

/** Convert element type + text to a meaningful element key */
function toElementKey(type, text) {
  // Clean the text to make a variable name
  let key = text
    .replace(/[^\w\s]/g, "")
    .trim()
    .split(/\s+/)
    .slice(0, 4)
    .map((w, i) => (i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()))
    .join("");

  if (!key || /^\d/.test(key)) key = "element" + key;

  // Append suffix based on type
  const suffixMap = {
    button: "Btn",
    field: "Field",
    label: "Label",
    title: "Title",
    a11y: "A11y",
    tab: "Tab",
    alert: "Alert",
    text: "Text",
    key: "Key",
    constant: "",
    string_resource: "",
    string_res: "",
    string_ref: "",
    constant_key: "",
  };
  const suffix = suffixMap[type] || "";
  if (suffix && !key.endsWith(suffix)) key += suffix;

  return key;
}

// ============================================================
// SCREEN GROUPING & JS GENERATION
// ============================================================

/** Classify element source as ios, android, or shared */
function getElementPlatform(source) {
  if (["swift", "ios_l10n", "storyboard", "flutter", "flutter_arb"].includes(source)) return "ios";
  if (["compose", "strings_xml", "xml_layout"].includes(source)) return "android";
  return "shared";
}

/** Group elements by type for section comments */
function getSection(type) {
  const sectionMap = {
    title: "HEADER / TITLES",
    button: "BUTTONS / ACTIONS",
    field: "INPUT FIELDS",
    label: "LABELS",
    a11y: "ACCESSIBILITY",
    tab: "TABS / NAVIGATION",
    alert: "ALERTS / ERRORS",
    text: "TEXT ELEMENTS",
    key: "KEYS / IDENTIFIERS",
    constant: "CONSTANTS",
    string_resource: "TEXT ELEMENTS",
    string_res: "TEXT ELEMENTS",
    string_ref: "TEXT ELEMENTS",
    constant_key: "CONSTANTS",
  };
  return sectionMap[type] || "OTHER";
}

function groupByScreen(elements) {
  const screens = {};
  for (const el of elements) {
    const screen = el.screen || "unknown";
    if (!screens[screen]) screens[screen] = [];
    screens[screen].push(el);
  }
  return screens;
}

/** Resolve string resource references using the strings map */
function resolveStringRefs(elements, stringsMap) {
  for (const el of elements) {
    if (
      (el.type === "string_res" || el.type === "string_ref") &&
      stringsMap[el.text]
    ) {
      el.resolvedText = stringsMap[el.text];
    }
  }
}

/**
 * Generate a Maestro-compatible screen JS file that merges iOS and Android
 * elements into a single file with platform conditionals where needed.
 *
 * Format matches existing screen files:
 *   const __platform = maestro.platform.toLowerCase() === "ios" ? "ios" : "android";
 *   const __isIOS = __platform === 'ios';
 *   output.feature_screen = {
 *       elementKey: __isIOS ? "iOS text" : "Android text",
 *       sharedElement: "Same on both",
 *   };
 */
function generateScreenJS(feature, screenName, elements) {
  const featureLower = feature.toLowerCase();
  const outputVar = `output.${featureLower}_${screenName}`;

  // Step 1: Build a key → { ios: text, android: text } map to merge platforms
  const keyMap = new Map();   // key → { ios: string|null, android: string|null, type, section }
  const keyOrder = [];        // preserve insertion order
  const keyCount = {};        // for dedup of generated keys

  for (const el of elements) {
    const displayText = el.resolvedText || el.text;
    if (!displayText) continue;

    let key = toElementKey(el.type, displayText);
    const platform = getElementPlatform(el.source);

    // If this exact key+text+platform already exists, skip
    if (keyMap.has(key)) {
      const existing = keyMap.get(key);
      if (platform === "ios" && existing.ios === displayText) continue;
      if (platform === "android" && existing.android === displayText) continue;
    }

    // Check if key already taken with a different text — need a unique key
    if (keyMap.has(key)) {
      const existing = keyMap.get(key);
      // Same key, different platform — merge into one entry
      if (platform === "ios" && !existing.ios) {
        existing.ios = displayText;
        continue;
      }
      if (platform === "android" && !existing.android) {
        existing.android = displayText;
        continue;
      }
      // Same platform, different text — generate unique key
      if (!keyCount[key]) keyCount[key] = 1;
      keyCount[key]++;
      key = key + keyCount[key];
    }

    const entry = {
      ios: platform === "ios" || platform === "shared" ? displayText : null,
      android: platform === "android" || platform === "shared" ? displayText : null,
      type: el.type,
      section: getSection(el.type),
      source: el.source,
    };
    keyMap.set(key, entry);
    keyOrder.push(key);
  }

  // Step 2: Group by section and generate JS
  const sectionGroups = new Map();
  for (const key of keyOrder) {
    const entry = keyMap.get(key);
    const section = entry.section;
    if (!sectionGroups.has(section)) sectionGroups.set(section, []);
    sectionGroups.get(section).push({ key, ...entry });
  }

  // Step 3: Build JS output
  const date = new Date().toISOString().split("T")[0];
  let js = `// ${screenName}Screen.js\n`;
  js += `// Auto-generated by extract-screen-elements.js\n`;
  js += `// Feature: ${feature} | Screen: ${screenName}\n`;
  js += `// Generated: ${date}\n`;
  js += `// Review and adjust selectors before using in tests.\n`;
  js += `const __platform = maestro.platform.toLowerCase() === "ios" ? "ios" : "android";\n`;
  js += `const __isIOS = __platform === 'ios';\n\n`;

  js += `// ============================================\n`;
  js += `// ${screenName.toUpperCase().replace(/_/g, " ")} SCREEN\n`;
  js += `// ============================================\n`;
  js += `${outputVar} = {\n`;

  const allEntries = [];
  for (const [section, entries] of sectionGroups) {
    allEntries.push({ isSection: true, section });
    allEntries.push(...entries.map(e => ({ isSection: false, ...e })));
  }

  for (let i = 0; i < allEntries.length; i++) {
    const item = allEntries[i];

    if (item.isSection) {
      if (i > 0) js += `\n`;
      js += `    // ===== ${item.section} =====\n`;
      continue;
    }

    const { key, ios, android, type } = item;
    const escapeStr = (s) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

    // Find next non-section entry to determine if we need a trailing comma
    let hasMoreEntries = false;
    for (let j = i + 1; j < allEntries.length; j++) {
      if (!allEntries[j].isSection) { hasMoreEntries = true; break; }
    }
    const comma = hasMoreEntries ? "," : "";

    if (ios && android && ios === android) {
      // Same text on both platforms
      js += `    ${key}: "${escapeStr(ios)}"${comma}\n`;
    } else if (ios && android) {
      // Different text — platform conditional
      js += `    ${key}: __isIOS ? "${escapeStr(ios)}" : "${escapeStr(android)}"${comma}\n`;
    } else if (ios) {
      // iOS only
      js += `    ${key}: "${escapeStr(ios)}"${comma}  // iOS\n`;
    } else if (android) {
      // Android only
      js += `    ${key}: "${escapeStr(android)}"${comma}  // Android\n`;
    }
  }

  js += `};\n`;

  return js;
}

// ============================================================
// COMPARISON WITH EXISTING SCREEN FILES
// ============================================================

function loadExistingElements(screensDir) {
  const existing = {};
  if (!fs.existsSync(screensDir)) return existing;

  const files = walkDir(screensDir, [".js"]);
  for (const file of files) {
    const content = readFileSafe(file);
    const fileName = path.basename(file, ".js");

    // Extract all string values from output.xxx = { key: "value" } blocks
    const valueRe = /(\w+):\s*(?:__isIOS\s*\?\s*)?["']([^"']+)["']/g;
    let m;
    while ((m = valueRe.exec(content)) !== null) {
      const key = m[1];
      const value = m[2];
      existing[`${fileName}::${key}`] = value;
      // Also store just the values for text-based matching
      if (!existing.__values) existing.__values = new Set();
      existing.__values.add(value);
    }
  }
  return existing;
}

function compareElements(extracted, existing) {
  const newElements = [];
  const updatedElements = [];
  const unchangedCount = { count: 0 };
  const existingValues = existing.__values || new Set();

  for (const el of extracted) {
    const text = el.resolvedText || el.text;
    if (existingValues.has(text)) {
      unchangedCount.count++;
    } else {
      // Check if it's similar to an existing value (possible update)
      let foundSimilar = false;
      for (const existingVal of existingValues) {
        if (
          existingVal.toLowerCase().includes(text.toLowerCase().slice(0, 10)) ||
          text.toLowerCase().includes(existingVal.toLowerCase().slice(0, 10))
        ) {
          if (existingVal !== text) {
            updatedElements.push({ extracted: text, existing: existingVal, type: el.type, source: el.source });
            foundSimilar = true;
            break;
          }
        }
      }
      if (!foundSimilar) {
        newElements.push(el);
      }
    }
  }

  return { newElements, updatedElements, unchangedCount: unchangedCount.count };
}

// ============================================================
// MAIN
// ============================================================

function printUsage() {
  const features = Object.keys(FEATURE_MAP);
  // Build sub-feature list for features that have them
  const subFeatureHelp = [];
  for (const f of features) {
    const subs = FEATURE_MAP[f].sub_features;
    if (subs) {
      subFeatureHelp.push(`  ${f}/<sub>: ${Object.keys(subs).join(", ")}`);
    }
  }
  console.log(`
Screen Element Extractor - Crawls iOS/Android codebases for UI elements

Usage:
  node extract-screen-elements.js <feature>[/<sub-feature>] [options]

Features:
  ${features.join(", ")}

Sub-features (use feature/sub-feature syntax):
${subFeatureHelp.join("\n")}

Options:
  --platform <ios|android|both>   Platform to crawl (default: both)
  --output <dir>                  Output directory (default: .maestro/screens/<Feature>/extracted/)
  --dry-run                       Show summary only, don't write files
  --verbose                       Show all extracted elements
  --help                          Show this help

Examples:
  node extract-screen-elements.js account
  node extract-screen-elements.js benefits                      # All benefits sub-features
  node extract-screen-elements.js benefits/claims               # Just claims
  node extract-screen-elements.js benefits/drug-pricing         # Drug pricing (CDC/Caremark)
  node extract-screen-elements.js benefits/providers            # Provider search
  node extract-screen-elements.js pharmacy --platform ios
  node extract-screen-elements.js benefits --dry-run --verbose
`);
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes("--help")) {
    printUsage();
    process.exit(0);
  }

  // Parse feature and optional sub-feature (e.g., "benefits/claims")
  const featureArg = args[0].toLowerCase();
  const [featureName, subFeatureName] = featureArg.includes("/")
    ? featureArg.split("/", 2)
    : [featureArg, null];

  const platform = args.includes("--platform") ? args[args.indexOf("--platform") + 1] : "both";
  const outputDir = args.includes("--output") ? args[args.indexOf("--output") + 1] : null;
  const dryRun = args.includes("--dry-run");
  const verbose = args.includes("--verbose");

  if (!FEATURE_MAP[featureName]) {
    console.error(`Unknown feature: "${featureName}"`);
    console.error(`Available: ${Object.keys(FEATURE_MAP).join(", ")}`);
    process.exit(1);
  }

  const config = FEATURE_MAP[featureName];

  // Validate sub-feature if provided
  let subFeatureConfig = null;
  if (subFeatureName) {
    if (!config.sub_features || !config.sub_features[subFeatureName]) {
      const available = config.sub_features ? Object.keys(config.sub_features).join(", ") : "none";
      console.error(`Unknown sub-feature: "${subFeatureName}" for feature "${featureName}"`);
      console.error(`Available sub-features: ${available}`);
      process.exit(1);
    }
    subFeatureConfig = config.sub_features[subFeatureName];
  }

  console.log(`\n========================================`);
  console.log(` Screen Element Extractor`);
  console.log(`========================================`);
  console.log(` Feature:     ${featureName}${subFeatureName ? "/" + subFeatureName : ""}`);
  if (subFeatureName) {
    console.log(` Sub-feature: ${subFeatureName} (android filter: ${subFeatureConfig.android_filter}, ios filter: ${subFeatureConfig.ios_filter})`);
  }
  console.log(` Platform:    ${platform}`);
  console.log(` iOS Root:    ${IOS_ROOT}`);
  console.log(` Android Root: ${ANDROID_ROOT}`);
  console.log(`========================================\n`);

  // Verify codebases exist
  const iosExists = fs.existsSync(IOS_ROOT);
  const androidExists = fs.existsSync(ANDROID_ROOT);

  if (!iosExists && (platform === "ios" || platform === "both")) {
    console.warn(`Warning: iOS codebase not found at ${IOS_ROOT}`);
  }
  if (!androidExists && (platform === "android" || platform === "both")) {
    console.warn(`Warning: Android codebase not found at ${ANDROID_ROOT}`);
  }

  let allElements = [];
  let stringsMap = {};
  let stats = { swift: 0, ios_l10n: 0, storyboard: 0, flutter: 0, flutter_arb: 0, compose: 0, xml_layout: 0, strings_xml: 0 };

  // iOS sub-feature filter: regex to match file paths containing relevant module names
  const iosPathFilter = subFeatureConfig
    ? new RegExp(`(${subFeatureConfig.ios_filter})`, "i")
    : null;

  // ---- iOS Extraction ----
  if ((platform === "ios" || platform === "both") && iosExists) {
    console.log("Crawling iOS codebase...");

    // Swift/SwiftUI from native + packages + related packages
    const swiftDirs = [
      ...(config.ios_native || []),
      ...(config.ios_packages || []),
      ...(config.related_ios_packages || []),
    ];
    for (const rel of swiftDirs) {
      const dir = path.join(IOS_ROOT, rel);
      let files = walkDir(dir, [".swift"]);
      // Apply sub-feature filter if specified
      if (iosPathFilter) {
        files = files.filter(f => iosPathFilter.test(f));
      }
      if (files.length === 0) continue;
      console.log(`  Swift: ${dir} (${files.length} files${iosPathFilter ? " [filtered]" : ""})`);
      for (const f of files) {
        const els = extractSwiftElements(f);
        allElements.push(...els);
        stats.swift += els.length;
      }
    }

    // CocoaPods Swift sources (e.g., CVSChatbot, NemoChatBot for HAIO)
    // These Pods don't have Localization.generated.swift; elements are hardcoded in Swift views
    for (const rel of config.ios_pods || []) {
      const dir = path.join(IOS_ROOT, rel);
      let files = walkDir(dir, [".swift"]);
      if (iosPathFilter) {
        files = files.filter(f => iosPathFilter.test(f));
      }
      if (files.length === 0) continue;
      console.log(`  Pods Swift: ${dir} (${files.length} files${iosPathFilter ? " [filtered]" : ""})`);
      for (const f of files) {
        const els = extractSwiftElements(f);
        allElements.push(...els);
        stats.swift += els.length;
      }
    }

    // Storyboards/XIBs
    for (const rel of config.ios_storyboards || []) {
      const dir = path.join(IOS_ROOT, rel);
      let files = walkDir(dir, [".storyboard", ".xib"]);
      if (iosPathFilter) files = files.filter(f => iosPathFilter.test(f));
      if (files.length === 0) continue;
      console.log(`  Storyboard/XIB: ${dir} (${files.length} files${iosPathFilter ? " [filtered]" : ""})`);
      for (const f of files) {
        const els = extractStoryboardElements(f);
        allElements.push(...els);
        stats.storyboard += els.length;
      }
    }

    // Flutter/Dart from configured packages
    for (const pkg of config.flutter_packages || []) {
      const dir = path.join(IOS_ROOT, "IOS/Submodule/packages/pharmacy", pkg, "lib");
      if (!fs.existsSync(dir)) continue;
      let files = walkDir(dir, [".dart"]);
      if (iosPathFilter) files = files.filter(f => iosPathFilter.test(f));
      if (files.length === 0) continue;
      console.log(`  Flutter (${pkg}): ${dir} (${files.length} files${iosPathFilter ? " [filtered]" : ""})`);
      for (const f of files) {
        const els = extractFlutterElements(f);
        allElements.push(...els);
        stats.flutter += els.length;
      }
    }

    // Flutter ARB localization files (e.g., benefits_en.arb)
    for (const pkg of config.flutter_packages || []) {
      const l10nDir = path.join(IOS_ROOT, "IOS/Submodule/packages/pharmacy", pkg, "lib/l10n");
      if (!fs.existsSync(l10nDir)) continue;
      const arbFiles = walkDir(l10nDir, [".arb"]).filter(f => /_en\.arb$/.test(f));
      for (const f of arbFiles) {
        const els = extractFlutterARB(f);
        if (els.length === 0) continue;
        console.log(`  Flutter ARB: ${path.relative(IOS_ROOT, f)} (${els.length} strings)`);
        allElements.push(...els);
        stats.flutter_arb += els.length;
      }
    }

    // iOS Localization.generated.swift files (SwiftGen output — all user-visible strings)
    const l10nPackageDirs = [
      ...(config.ios_packages || []),
      ...(config.related_ios_packages || []),
    ];
    for (const rel of l10nPackageDirs) {
      const dir = path.join(IOS_ROOT, rel);
      const l10nFiles = walkDir(dir, [".swift"]).filter(f =>
        /Localization\.generated\.swift$|Localization\.swift$|L10n\.swift$/.test(f)
      );
      for (const f of l10nFiles) {
        const els = extractiOSLocalizationGenerated(f);
        // Apply sub-feature filter on the localization key or screen name
        let filtered = els;
        if (iosPathFilter) {
          filtered = els.filter(el => iosPathFilter.test(el.key || "") || iosPathFilter.test(el.screen || ""));
        }
        if (filtered.length === 0) continue;
        console.log(`  iOS L10n: ${path.relative(IOS_ROOT, f)} (${filtered.length} strings${iosPathFilter ? " [filtered]" : ""})`);
        allElements.push(...filtered);
        stats.ios_l10n += filtered.length;
      }
    }
  }

  // ---- Android Extraction (auto-discovery) ----
  if ((platform === "android" || platform === "both") && androidExists && config.android_base) {
    console.log("Crawling Android codebase (auto-discovery)...");
    const androidBaseDir = path.join(ANDROID_ROOT, config.android_base);
    const androidSubFilter = subFeatureConfig ? subFeatureConfig.android_filter : null;

    // Auto-discover strings.xml — build lookup map first
    let stringsFiles = discoverAndroidStringsFiles(androidBaseDir);
    stringsFiles = filterPathsBySubFeature(stringsFiles, androidSubFilter);
    for (const file of stringsFiles) {
      const els = extractAndroidStrings(file);
      if (els.length === 0) continue;
      // Show relative path for readability
      const relPath = path.relative(ANDROID_ROOT, file);
      console.log(`  strings.xml: ${relPath} (${els.length} strings)`);
      for (const el of els) {
        stringsMap[el.key] = el.text;
      }
      allElements.push(...els);
      stats.strings_xml += els.length;
    }

    // Auto-discover Kotlin/Java source dirs
    let sourceDirs = discoverAndroidSourceDirs(androidBaseDir);
    sourceDirs = filterPathsBySubFeature(sourceDirs, androidSubFilter);
    for (const dir of sourceDirs) {
      const files = walkDir(dir, [".kt", ".java"]);
      if (files.length === 0) continue;
      const relPath = path.relative(ANDROID_ROOT, dir);
      console.log(`  Compose/Kotlin: ${relPath} (${files.length} files)`);
      for (const f of files) {
        const els = extractComposeElements(f);
        allElements.push(...els);
        stats.compose += els.length;
      }
    }

    // Auto-discover XML layout dirs
    let layoutDirs = discoverAndroidLayoutDirs(androidBaseDir);
    layoutDirs = filterPathsBySubFeature(layoutDirs, androidSubFilter);
    for (const layoutDir of layoutDirs) {
      const files = walkDir(layoutDir, [".xml"]);
      if (files.length === 0) continue;
      const relPath = path.relative(ANDROID_ROOT, layoutDir);
      console.log(`  XML Layouts: ${relPath} (${files.length} files)`);
      for (const f of files) {
        const els = extractAndroidLayoutElements(f);
        allElements.push(...els);
        stats.xml_layout += els.length;
      }
    }
  }

  // Resolve string resource references
  resolveStringRefs(allElements, stringsMap);

  // Deduplicate by text
  const seenTexts = new Set();
  const dedupedElements = [];
  for (const el of allElements) {
    const text = el.resolvedText || el.text;
    if (!seenTexts.has(text)) {
      seenTexts.add(text);
      dedupedElements.push(el);
    }
  }

  console.log(`\n--- Extraction Summary ---`);
  console.log(` Total raw elements:  ${allElements.length}`);
  console.log(` After dedup:         ${dedupedElements.length}`);
  console.log(` By source:`);
  if (stats.swift) console.log(`   Swift/SwiftUI:     ${stats.swift}`);
  if (stats.ios_l10n) console.log(`   iOS Localization:  ${stats.ios_l10n}`);
  if (stats.storyboard) console.log(`   Storyboard/XIB:    ${stats.storyboard}`);
  if (stats.flutter) console.log(`   Flutter/Dart:      ${stats.flutter}`);
  if (stats.flutter_arb) console.log(`   Flutter ARB:       ${stats.flutter_arb}`);
  if (stats.compose) console.log(`   Compose/Kotlin:    ${stats.compose}`);
  if (stats.xml_layout) console.log(`   XML Layouts:       ${stats.xml_layout}`);
  if (stats.strings_xml) console.log(`   strings.xml:       ${stats.strings_xml}`);

  // ---- Compare with existing ----
  const existingScreensDir = path.join(SCREENS_DIR, config.screens_dir);
  const existing = loadExistingElements(existingScreensDir);
  const { newElements, updatedElements, unchangedCount } = compareElements(
    dedupedElements,
    existing
  );

  console.log(`\n--- Comparison with existing screens ---`);
  console.log(` Existing dir: ${existingScreensDir}`);
  console.log(` Unchanged:    ${unchangedCount}`);
  console.log(` New:          ${newElements.length}`);
  console.log(` Updated:      ${updatedElements.length}`);

  if (newElements.length > 0) {
    console.log(`\n  NEW ELEMENTS:`);
    const showCount = verbose ? newElements.length : Math.min(newElements.length, 25);
    for (let i = 0; i < showCount; i++) {
      const el = newElements[i];
      const text = el.resolvedText || el.text;
      console.log(`    + [${el.type}] "${text}" (${el.source})`);
    }
    if (!verbose && newElements.length > 25) {
      console.log(`    ... and ${newElements.length - 25} more (use --verbose to see all)`);
    }
  }

  if (updatedElements.length > 0) {
    console.log(`\n  UPDATED ELEMENTS (text changed):`);
    const showCount = verbose ? updatedElements.length : Math.min(updatedElements.length, 15);
    for (let i = 0; i < showCount; i++) {
      const el = updatedElements[i];
      console.log(`    ~ "${el.existing}" -> "${el.extracted}"`);
    }
    if (!verbose && updatedElements.length > 15) {
      console.log(`    ... and ${updatedElements.length - 15} more`);
    }
  }

  // ---- Generate screen JS files ----
  if (dryRun) {
    console.log(`\n[Dry run] Skipping file generation.`);
  } else {
    const screens = groupByScreen(dedupedElements);
    const screenNames = Object.keys(screens).sort();

    const outDir = outputDir || path.join(existingScreensDir, "extracted");
    fs.mkdirSync(outDir, { recursive: true });

    console.log(`\n--- Generating screen files ---`);
    console.log(` Output dir: ${outDir}`);

    let generatedCount = 0;
    for (const screenName of screenNames) {
      if (screens[screenName].length < 2) continue; // skip screens with only 1 element
      const js = generateScreenJS(featureName, screenName, screens[screenName]);
      const outFile = path.join(outDir, `${screenName}Screen.js`);
      fs.writeFileSync(outFile, js, "utf8");
      console.log(`  Generated: ${path.basename(outFile)} (${screens[screenName].length} elements)`);
      generatedCount++;
    }

    // Also generate a combined file with all elements
    if (dedupedElements.length > 0) {
      const combinedJs = generateScreenJS(featureName, "all_elements", dedupedElements);
      const combinedFile = path.join(outDir, `_all_${featureName}_elements.js`);
      fs.writeFileSync(combinedFile, combinedJs, "utf8");
      console.log(`  Generated: ${path.basename(combinedFile)} (${dedupedElements.length} elements, combined)`);
      generatedCount++;
    }

    console.log(`\n  Total files generated: ${generatedCount}`);
    console.log(`  Review the generated files and merge relevant elements into your existing screen files.`);
  }

  console.log(`\nDone.\n`);
}

main();
