const __platform = maestro.platform.toLowerCase() === "ios" ? "ios" : "android";
const __isIOS = __platform === 'ios';

/**
 * SettingsScreen.js
 *
 * Screen object for account settings and notification preferences.
 * Used for managing user preferences, notifications, and account configuration.
 *
 * Usage:
 *   - runScript: ../../../screens/Account/SettingsScreen.js
 *   - tapOn: ${output.account_settings.notificationsOption}
 */

output.account_settings = {
    // ========================================================================
    // NAVIGATION TO SETTINGS
    // ========================================================================

    accountTab: "Account",
    accountNavBar: "Account",
    settingsOption: "Settings",
    settingsTitle: "Settings",
    settingsNavBar: "Settings",
    backBtn: "Back",
    closeBtn: "Close",

    // ========================================================================
    // SETTINGS SECTIONS
    // ========================================================================

    // Notifications Section
    notificationsSectionHeader: "Notifications",
    notificationsOption: "Notifications",
    notificationsTitle: "Notifications",
    pushNotificationsLabel: "Push Notifications",
    pushNotificationsToggle: "Push Notifications",
    emailNotificationsLabel: "Email Notifications",
    smsNotificationsLabel: "SMS Notifications",
    prescriptionNotificationsLabel: "Prescription updates",
    appointmentNotificationsLabel: "Appointment reminders",
    promotionalNotificationsLabel: "Promotions and offers",
    securityNotificationsLabel: "Security alerts",

    // Privacy & Security Section
    privacySectionHeader: "Privacy & Security",
    privacyOption: "Privacy",
    securityOption: "Security",
    changePasswordOption: "Change Password",
    biometricAuthLabel: "Face ID|Touch ID|Biometric Authentication",
    twoFactorAuthLabel: "Two-Factor Authentication",

    // Account Information Section
    accountInfoSectionHeader: "Account Information",
    personalInfoOption: "Personal Information",
    addressesOption: "Addresses",
    paymentMethodsOption: "Payment Methods",
    insuranceOption: "Insurance",

    // Preferences Section
    preferencesSectionHeader: "Preferences",
    languageOption: "Language",
    locationOption: "Location Services",
    accessibilityOption: "Accessibility",

    // Communication Preferences
    communicationSectionHeader: "Communication Preferences",
    emailPreferencesOption: "Email Preferences",
    smsPreferencesOption: "SMS Preferences",
    pushPreferencesOption: "Push Notifications",

    // App Settings Section
    appSettingsSectionHeader: "App Settings",
    aboutOption: "About",
    helpOption: "Help & Support",
    termsOption: "Terms of Use",
    privacyPolicyOption: "Privacy Policy",
    versionLabel: "Version",
    logOutOption: "Sign Out",

    // ========================================================================
    // NOTIFICATION SETTINGS SCREEN
    // ========================================================================

    notificationSettingsTitle: "Notification Settings",
    enableAllNotifications: "Enable all notifications",
    disableAllNotifications: "Disable all notifications",

    // Notification Types
    prescriptionUpdatesToggle: "Prescription updates",
    prescriptionUpdatesDesc: "Notifications when prescriptions are ready",
    refillRemindersToggle: "Refill reminders",
    refillRemindersDesc: "Reminders to refill your prescriptions",
    appointmentRemindersToggle: "Appointment reminders",
    appointmentRemindersDesc: "Reminders for upcoming appointments",
    claimUpdatesToggle: "Claim updates",
    claimUpdatesDesc: "Updates on claim status",
    promotionsToggle: "Promotions and offers",
    promotionsDesc: "Special deals and savings",
    securityAlertsToggle: "Security alerts",
    securityAlertsDesc: "Important security notifications",

    // ========================================================================
    // SYSTEM PERMISSION PROMPTS (when enabling notifications)
    // ========================================================================

    systemPromptTitle: "Turn on notifications",
    systemPromptDesc: "Get updates about prescriptions, refills, and more",
    allowBtn: "Allow",
    dontAllowBtn: "Don't Allow",
    notNowBtn: __isIOS ? "Not Now" : "Not now",
    openSettingsPrompt: "To enable, go to Settings",
    openSettingsBtn: "Open Settings",

    // ========================================================================
    // COMMON ACTIONS
    // ========================================================================

    saveBtn: "Save",
    saveChangesBtn: "Save Changes",
    cancelBtn: "Cancel",
    doneBtn: "Done",
    applyBtn: "Apply",
    resetBtn: "Reset",
    confirmBtn: "Confirm",

    // ========================================================================
    // SUCCESS/ERROR MESSAGES
    // ========================================================================

    settingsSavedMsg: "Settings saved",
    settingsUpdatedMsg: "Settings updated successfully",
    notificationsEnabledMsg: "Notifications enabled",
    notificationsDisabledMsg: "Notifications disabled",
    changesSavedMsg: "Changes saved",
    errorSavingMsg: "Error saving settings. Please try again.",

    // ========================================================================
    // TOGGLE STATES
    // ========================================================================

    toggleOn: "On",
    toggleOff: "Off",
    enabledLabel: "Enabled",
    disabledLabel: "Disabled",
};
