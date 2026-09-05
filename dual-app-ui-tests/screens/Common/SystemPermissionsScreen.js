const __platform = maestro.platform.toLowerCase() === "ios" ? "ios" : "android";
const __isIOS = __platform === 'ios';

/**
 * SystemPermissionsScreen.js
 *
 * Screen object for system permissions, overlays, and notifications.
 * Combines OS-level permission prompts, common UI overlays, and notification elements.
 *
 * Usage:
 *   - runScript: ../../../screens/Common/SystemPermissionsScreen.js
 *   - tapOn: ${output.system_permissions.allowNotificationsBtn}
 */

// ============================================================================
// SYSTEM PERMISSIONS
// ============================================================================

output.system_permissions = {
    // ========================================================================
    // NOTIFICATIONS PERMISSIONS
    // ========================================================================

    // iOS Notification Permission Dialog
    notificationPromptTitleIOS: __isIOS ? '"CVS Pharmacy" Would Like to Send You Notifications' : null,
    notificationPromptDescIOS: __isIOS ? "Notifications may include alerts, sounds, and icon badges. These can be configured in Settings." : null,

    // Android Notification Permission Dialog
    notificationPromptTitleAndroid: !__isIOS ? "Allow CVS Pharmacy to send you notifications?" : null,

    // Cross-platform notification prompts (generic fallbacks)
    notificationPromptTitle: __isIOS
        ? '"CVS Pharmacy" Would Like to Send You Notifications'
        : "Allow CVS Pharmacy to send you notifications?",
    notificationPromptVariant: "Enable Notifications|Yes, enable notifications",
    stayUpdatedMsg: "Stay Updated",
    turnOnNotificationsMsg: "Turn on notifications",

    // Notification Permission Buttons
    allowNotificationsBtn: "Allow",
    dontAllowNotificationsBtn: "Don't Allow",
    enableNotificationsBtn: "Enable",
    notNowNotificationsBtn: __isIOS ? "Not Now" : "Not now",

    // ========================================================================
    // LOCATION PERMISSIONS
    // ========================================================================

    // iOS Location Permission Dialog
    locationPromptTitleIOS: __isIOS ? 'Allow "CVS Pharmacy" to use your location?' : null,
    locationPromptDescIOS: __isIOS ? "Your location is used to find nearby stores and pharmacies." : null,

    // Android Location Permission Dialog
    locationPromptTitleAndroid: !__isIOS ? "Allow CVS Pharmacy to access this device's location?" : null,

    // Cross-platform location prompts
    locationPromptTitle: __isIOS
        ? 'Allow "CVS Pharmacy" to use your location?'
        : "Allow CVS Pharmacy to access this device's location?",
    findNearbyStoresMsg: "Find Nearby Stores",

    // Location Permission Buttons
    allowWhileUsingAppBtn: "Allow While Using App",
    allowOnceBtn: "Allow Once",
    allowAlwaysBtn: "Always Allow",
    dontAllowLocationBtn: "Don't Allow",
    preciseLocationToggle: "Precise: On|Precise: Off",

    // ========================================================================
    // CAMERA & PHOTO LIBRARY PERMISSIONS
    // ========================================================================

    // iOS Camera Permission Dialog
    cameraPromptTitleIOS: __isIOS ? '"CVS Pharmacy" Would Like to Access the Camera' : null,
    cameraPromptDescIOS: __isIOS ? "To take photos of prescriptions, receipts, and documents." : null,

    // Android Camera Permission Dialog
    cameraPromptTitleAndroid: !__isIOS ? "Allow CVS Pharmacy to take pictures and record video?" : null,

    // Cross-platform camera prompts
    cameraPromptTitle: __isIOS
        ? '"CVS Pharmacy" Would Like to Access the Camera'
        : "Allow CVS Pharmacy to take pictures and record video?",

    // Camera Permission Buttons
    allowCameraBtn: "OK",
    allowCameraBtnVariant: "Allow",
    dontAllowCameraBtn: "Don't Allow",

    // iOS Photo Library Permission Dialog
    photoLibraryPromptTitleIOS: __isIOS ? '"CVS Pharmacy" Would Like to Access Your Photos' : null,
    photoLibraryPromptDescIOS: __isIOS ? "To upload photos for prescriptions and insurance cards." : null,

    // Android Photo Library Permission Dialog
    photoLibraryPromptTitleAndroid: !__isIOS ? "Allow CVS Pharmacy to access photos and media on your device?" : null,

    // Cross-platform photo library prompts
    photoLibraryPromptTitle: __isIOS
        ? '"CVS Pharmacy" Would Like to Access Your Photos'
        : "Allow CVS Pharmacy to access photos and media on your device?",

    // Photo Library Permission Buttons
    selectPhotosBtn: "Select Photos...",
    allowAllPhotosBtn: "Allow Access to All Photos",
    allowLimitedPhotosBtn: "Select Photos...",
    dontAllowPhotosBtn: "Don't Allow",

    // ========================================================================
    // PASTE PERMISSION (iOS 16+)
    // ========================================================================

    pastePromptTitle: __isIOS ? '"CVS Pharmacy" Would Like to Paste from' : null,
    pastePromptVariant: "Allow Paste|Don't Allow",
    allowPasteBtn: __isIOS ? "Allow Paste" : null,
    dontAllowPasteBtn: __isIOS ? "Don't Allow" : null,

    // ========================================================================
    // BIOMETRIC AUTHENTICATION (Face ID, Touch ID, Fingerprint)
    // ========================================================================

    // iOS Face ID
    faceIdPromptTitle: __isIOS ? "Sign in with Face ID" : null,
    faceIdPromptDesc: __isIOS ? "Use Face ID to sign in quickly and securely" : null,
    useFaceIdBtn: __isIOS ? "Use Face ID" : null,
    enterPasswordInsteadBtn: __isIOS ? "Enter Password" : null,

    // iOS Touch ID
    touchIdPromptTitle: __isIOS ? "Sign in with Touch ID" : null,
    touchIdPromptDesc: __isIOS ? "Use Touch ID to sign in quickly and securely" : null,
    useTouchIdBtn: __isIOS ? "Use Touch ID" : null,

    // Android Biometric (Fingerprint)
    biometricPromptTitleAndroid: !__isIOS ? "Sign in with fingerprint" : null,
    biometricPromptDesc: !__isIOS ? "Touch the fingerprint sensor" : null,
    useBiometricBtn: !__isIOS ? "Use fingerprint" : null,

    // Cross-platform biometric
    biometricCancelBtn: "Cancel",
    biometricFallbackBtn: "Use password",

    // ========================================================================
    // BLUETOOTH PERMISSIONS
    // ========================================================================

    bluetoothPromptTitleIOS: __isIOS ? '"CVS Pharmacy" Would Like to Use Bluetooth' : null,
    bluetoothPromptTitleAndroid: !__isIOS ? "Allow CVS Pharmacy to access Bluetooth?" : null,
    bluetoothPromptTitle: __isIOS
        ? '"CVS Pharmacy" Would Like to Use Bluetooth'
        : "Allow CVS Pharmacy to access Bluetooth?",

    allowBluetoothBtn: "OK",
    dontAllowBluetoothBtn: "Don't Allow",

    // ========================================================================
    // CONTACTS PERMISSIONS
    // ========================================================================

    contactsPromptTitleIOS: __isIOS ? '"CVS Pharmacy" Would Like to Access Your Contacts' : null,
    contactsPromptTitleAndroid: !__isIOS ? "Allow CVS Pharmacy to access your contacts?" : null,
    contactsPromptTitle: __isIOS
        ? '"CVS Pharmacy" Would Like to Access Your Contacts'
        : "Allow CVS Pharmacy to access your contacts?",

    allowContactsBtn: "OK",
    dontAllowContactsBtn: "Don't Allow",

    // ========================================================================
    // MICROPHONE PERMISSIONS
    // ========================================================================

    microphonePromptTitleIOS: __isIOS ? '"CVS Pharmacy" Would Like to Access the Microphone' : null,
    microphonePromptTitleAndroid: !__isIOS ? "Allow CVS Pharmacy to record audio?" : null,
    microphonePromptTitle: __isIOS
        ? '"CVS Pharmacy" Would Like to Access the Microphone'
        : "Allow CVS Pharmacy to record audio?",

    allowMicrophoneBtn: "OK",
    dontAllowMicrophoneBtn: "Don't Allow",

    // ========================================================================
    // CALENDAR PERMISSIONS
    // ========================================================================

    calendarPromptTitleIOS: __isIOS ? '"CVS Pharmacy" Would Like to Access Your Calendar' : null,
    calendarPromptTitleAndroid: !__isIOS ? "Allow CVS Pharmacy to access your calendar?" : null,
    calendarPromptTitle: __isIOS
        ? '"CVS Pharmacy" Would Like to Access Your Calendar'
        : "Allow CVS Pharmacy to access your calendar?",

    allowCalendarBtn: "OK",
    dontAllowCalendarBtn: "Don't Allow",

    // ========================================================================
    // TRACKING PERMISSION (iOS 14.5+, App Tracking Transparency)
    // ========================================================================

    trackingPromptTitle: __isIOS ? '"CVS Pharmacy" Would Like Permission to Track You Across Apps and Websites Owned by Other Companies' : null,
    trackingPromptDesc: __isIOS ? "Your data will be used to provide you a better and personalized ad experience." : null,
    allowTrackingBtn: __isIOS ? "Allow" : null,
    askAppNotToTrackBtn: __isIOS ? "Ask App Not to Track" : null,

    // ========================================================================
    // HEALTH DATA PERMISSIONS (iOS HealthKit)
    // ========================================================================

    healthDataPromptTitle: __isIOS ? '"CVS Pharmacy" Would Like to Access Your Health Data' : null,
    allowHealthDataBtn: __isIOS ? "Allow" : null,
    dontAllowHealthDataBtn: __isIOS ? "Don't Allow" : null,

    // ========================================================================
    // SYSTEM SETTINGS REDIRECT
    // ========================================================================

    openSettingsPrompt: "To enable, go to Settings",
    openSettingsBtn: "Open Settings",
    goToSettingsBtn: "Go to Settings",
    settingsBtn: "Settings",

    // ========================================================================
    // COMMON PERMISSION ACTIONS
    // ========================================================================

    allowBtn: "Allow",
    denyBtn: "Don't Allow",
    notNowBtn: __isIOS ? "Not Now" : "Not now",
    okBtn: "OK",
    cancelBtn: "Cancel",
    continueBtn: "Continue",
    enableBtn: "Enable",
    disableBtn: "Disable",
    maybeLaterBtn: "Maybe Later",
    askMeLaterBtn: "Ask Me Later",
};

// ============================================================================
// COMMON OVERLAY ELEMENTS
// ============================================================================
// Note: output.common_overlays (pattern regexes) is defined in CommonScreen.js
// This namespace provides individual overlay element selectors.

output.common_overlay_elements = {
    // Modal Dialogs
    modalTitle: "Dialog",
    modalMessage: "Are you sure?",
    modalOkBtn: "OK",
    modalCancelBtn: "Cancel",
    modalConfirmBtn: "Confirm",
    modalDismissBtn: "Dismiss",

    // Alert Dialogs
    alertTitle: "Alert",
    alertMessage: "Something went wrong",
    alertOkBtn: "OK",
    alertRetryBtn: "Retry",
    alertCloseBtn: "Close",

    // Confirmation Dialogs
    confirmTitle: "Confirm Action",
    confirmMessage: "Are you sure you want to proceed?",
    confirmYesBtn: "Yes",
    confirmNoBtn: "No",

    // Loading Overlays
    loadingIndicator: "Loading",
    loadingSpinner: __isIOS ? {id: "activity"} : "activity",
    loadingMessage: "Please wait...",

    // Error Overlays
    errorTitle: "Error",
    errorMessage: "An error occurred",
    errorDetails: "Please try again later",
    errorRetryBtn: "Retry",
    errorDismissBtn: "Dismiss",

    // Success Overlays
    successTitle: "Success",
    successMessage: "Operation completed successfully",
    successOkBtn: "OK",

    // Warning Overlays
    warningTitle: "Warning",
    warningMessage: "Please be careful",
    warningOkBtn: "OK",
    warningCancelBtn: "Cancel",

    // Bottom Sheets
    bottomSheetTitle: "Options",
    bottomSheetDragHandle: __isIOS ? {id: "line.horizontal.3"} : "line.horizontal.3",
    bottomSheetCloseBtn: "Close",

    // Popups & Popovers
    popupTitle: "Information",
    popupMessage: "This is a popup",
    popupCloseBtn: __isIOS ? {id: "xmark.circle.fill"} : "xmark.circle.fill",
    popupDismissBtn: "Dismiss",

    // Tooltips
    tooltipText: "Helpful tip",
    tooltipCloseBtn: "Got it",

    // Date Pickers
    datePickerTitle: "Select Date",
    datePickerDoneBtn: "Done",
    datePickerCancelBtn: "Cancel",

    // Time Pickers
    timePickerTitle: "Select Time",
    timePickerDoneBtn: "Done",
    timePickerCancelBtn: "Cancel",

    // Context Menus
    contextMenuTitle: "Actions",
    contextMenuEdit: "Edit",
    contextMenuDelete: "Delete",
    contextMenuShare: "Share",
    contextMenuCopy: "Copy",
    contextMenuRemove: "Remove",
    contextMenuCancel: "Cancel",

    // Action Sheets
    actionSheetTitle: "Choose an action",
    actionSheetCancel: "Cancel",

    // Banners & Snackbars
    bannerMessage: "Important message",
    bannerCloseBtn: "Close",
    bannerActionBtn: "Action",
    snackbarMessage: "Message",
    snackbarAction: "Undo",

    // Loading States
    loadingText: "Loading",
    loadingTextEllipsis: "Loading...",
    pleaseWaitText: "Please wait",
    pleaseWaitTextEllipsis: "Please wait...",
    processingText: "Processing",
    processingTextEllipsis: "Processing...",

    // Tip & Information Overlays
    tipTitle: "Tip",
    didYouKnowTitle: "Did you know",
    infoTitle: "Information",
    gotItBtn: "Got it",
    gotItBtnVariant: "Got It",

    // Generic Overlay Actions
    viewBtn: "View",
    closeXBtn: "Close",
    dismissOverlayBtn: "Dismiss",
    xmarkBtn: __isIOS ? "xmark" : "close",
    xmarkCircleBtn: __isIOS ? "xmark.circle.fill" : "close_circle",
};

// ============================================================================
// NOTIFICATIONS
// ============================================================================

output.common_notifications = {
    // Notification Center
    notificationCenter: "Notifications",
    notificationBadge: "1",
    notificationIcon: __isIOS ? {id: "bell.fill"} : "bell.fill",

    // Notification Types
    prescriptionReadyTitle: "Your prescription is ready",
    prescriptionReadyDesc: "Pick up at your nearest CVS",
    refillReminderTitle: "Time to refill",
    refillReminderDesc: "Your prescription is running low",
    appointmentReminderTitle: "Appointment reminder",
    appointmentReminderDesc: "You have an appointment tomorrow",
    claimStatusTitle: "Claim status updated",
    claimStatusDesc: "Your claim has been processed",
    rewardTitle: "New reward available",
    rewardDesc: "You've earned a new reward",
    promotionTitle: "Special offer",
    promotionDesc: "Check out this week's deals",

    // Notification Actions
    viewNotificationBtn: "View",
    dismissNotificationBtn: "Dismiss",
    markAsReadBtn: "Mark as read",
    clearAllBtn: "Clear all",

    // Notification Settings
    notificationSettingsTitle: "Notification Settings",
    enableAllNotifications: "Enable all notifications",
    prescriptionNotifications: "Prescription updates",
    appointmentNotifications: "Appointment reminders",
    promotionalNotifications: "Promotions and offers",
    securityNotifications: "Security alerts",

    // Push Notification Prompts
    pushNotificationPrompt: '"CVS Pharmacy" Would Like to Send You Notifications',
    pushNotificationDesc: "Get updates about prescriptions, refills, and more",
    enablePushBtn: "Enable",
    disablePushBtn: "Not now",

    // In-App Notifications (Toasts/Banners)
    successMessage: "Success",
    errorMessage: "Error",
    warningMessage: "Warning",
    infoMessage: "Information",

    // Toast Messages
    itemAddedToCart: "Item added to cart",
    itemRemovedFromCart: "Item removed from cart",
    savedForLater: "Saved for later",
    removedFromSaved: "Removed from saved",
    prescriptionRefilled: "Prescription refilled",
    prescriptionCanceled: "Prescription canceled",
    claimSubmitted: "Claim submitted successfully",
    profileUpdated: "Profile updated",
    passwordChanged: "Password changed successfully",

    // Notification Badges
    unreadBadge: "Unread",
    newBadge: "New",
    urgentBadge: "Urgent",

    // Notification List
    notificationList: "Notification list",
    noNotifications: "No notifications",
    noNotificationsDesc: "You're all caught up",

    // Notification Timestamps
    justNow: "Just now",
    minutesAgo: "minutes ago",
    hoursAgo: "hours ago",
    daysAgo: "days ago",
}
