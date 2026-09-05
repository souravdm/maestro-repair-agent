const __platform = maestro.platform.toLowerCase() === "ios" ? "ios" : "android";
const __isIOS = __platform === 'ios';

// ========================================================================
// ASSISTANT ACCOUNT SCREEN - AI PREFERENCES & HEALTH INFO MANAGEMENT
// Figma ref: H100 Beta node 74:8848, section "MVP Fast Follow - Assistant Account Manifestations"
// ========================================================================
output.haio_account = {
    // Account landing — AI settings section heading
    aiSettingsSectionHeading: ".*Assistant.*|.*AI.*|.*Health Assistant.*",
    aiSettingsListRow: "Health Assistant settings|AI settings",

    // Preferences main screen
    preferencesTitle: "Preferences|Health Assistant Preferences",
    preferencesToggleLabel: "Health Assistant|Enable Assistant",
    preferencesToggle: __isIOS ? ".*switch.*|.*toggle.*" : ".*checkbox.*|.*switch.*",
    preferencesShareHealthInfo: "Share health info|Health information",
    preferencesNotifications: "Notifications|Push notifications",

    // Health info management (shared with health records)
    healthInfoTitle: "Health information|My health info",
    allergiesRow: "Allergies",
    conditionsRow: "Conditions",
    diagnosticResultsRow: "Diagnostic results",
    labsResultsRow: "Labs results",

    // Individual health info screens
    allergiesTitle: "Allergies",
    allergiesEmptyState: "No allergies.*|None on file",
    conditionsTitle: "Conditions",
    conditionsEmptyState: "No conditions.*|None on file",
    diagnosticResultsTitle: "Diagnostic results",
    labsResultsTitle: "Labs results",

    // Communication preferences
    commPrefsTitle: "Communication preferences|Comm. preferences",
    commPrefsEmailRow: "Email",
    commPrefsPushRow: "Push notifications",

    // Example share settings
    shareSettingsTitle: "Example share settings|Share settings",
    shareSettingsPush: ".*push.*|.*share.*",

    // Account navigation
    accountTitle: "Account|My account",
    signOutBtn: "Sign out",
    backBtn: __isIOS ? "Back" : "Navigate up",
    helpRow: "Help|Help & Support",

    // Health100-specific reference
    health100AssetRef: "Health 100 Asset File",
};
