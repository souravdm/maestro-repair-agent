const __platform = maestro.platform.toLowerCase() === "ios" ? "ios" : "android";
const __isIOS = __platform === 'ios';

output.account_communicationPrefs = {
    // Navigation
    communicationPrefsNavBar: "Communication preferences",
    communicationPrefsLink: "Communication Preferences|Communication preferences",
    backBtn: "Back",
    
    // Communication Preferences List
    textsBtn: "Texts",
    textsDescription: "Manage text message preferences",
    automatedCallsBtn: "Automated calls",
    automatedCallsDescription: "Manage automated call preferences",
    emailsBtn: "Emails",
    emailsDescription: "Manage email preferences",
    notificationsBtn: "Notifications",
    notificationsDescription: "Manage push notification preferences",
    liveActivitiesBtn: "Live activities",
    liveActivitiesDescription: "Manage live activity preferences",
    
    // Texts Detail Screen
    textsNavBar: "Texts",
    prescriptionReadyToggle: "Prescription ready",
    refillRemindersToggle: "Refill reminders",
    orderUpdatesToggle: "Order updates",
    appointmentRemindersToggle: "Appointment reminders",
    marketingMessagesToggle: "Marketing messages",
    
    // Automated Calls Detail Screen
    automatedCallsNavBar: "Automated calls",
    prescriptionCallsToggle: "Prescription calls",
    appointmentCallsToggle: "Appointment calls",
    surveyCallsToggle: "Survey calls",
    
    // Emails Detail Screen
    emailsNavBar: "Emails",
    prescriptionEmailsToggle: "Prescription emails",
    orderConfirmationToggle: "Order confirmation",
    promotionalEmailsToggle: "Promotional emails",
    newsletterToggle: "Newsletter",
    healthTipsToggle: "Health tips",
    
    // Notifications Detail Screen
    notificationsNavBar: "Notifications",
    notificationsTitle: "Notifications",
    pushNotificationsToggle: "Push notifications",
    prescriptionNotificationsToggle: "Prescription notifications",
    orderNotificationsToggle: "Order notifications",
    appointmentNotificationsToggle: "Appointment notifications",
    dealsNotificationsToggle: "Deals and offers",

    // Communication Channels
    emailLabel: "Email",
    textMessagesLabel: "Text Messages",
    pushNotificationsLabel: "Push Notifications",

    // Pharmacy Alerts
    pharmacyAlertsLink: "Pharmacy Alerts",
    pharmacyAlertsTitle: "Pharmacy Alerts",
    prescriptionReadyLabel: "Prescription Ready",
    prescriptionShippedLabel: "Prescription Shipped",
    
    // Live Activities Detail Screen
    liveActivitiesNavBar: "Live activities",
    deliveryTrackingToggle: "Delivery tracking",
    prescriptionStatusToggle: "Prescription status",
    appointmentStatusToggle: "Appointment status",
    
    // Common Elements
    disclosureIndicator: ">",
    toggleSwitch: "id:toggleSwitch",
    
    // Actions
    saveBtn: "Save",
    doneBtn: "Done",
    
    // Success Messages
    preferencesSavedMsg: "Preferences saved successfully",

    // Android - Communication Labels
    communicationsLabel: "Communications", // Android
    emailsAndReceiptsLabel: "Emails and receipts", // Android

    // Android - Contact Management
    addPhoneNumberBtn: "Add a phone number", // Android
    addEmailAddressBtn: "Add a email address", // Android
    updatePhoneNumberBtn: "Update a phone number", // Android
    updateEmailAddressBtn: "Update a email address", // Android

    // Android - Enrollment Messages
    chooseAMobileNumberMsg: "Choose a mobile number", // Android
    mobileRequiredToEnrollMsg: "A mobile number is required to enroll", // Android
    emailRequiredToEnrollMsg: "An email address is required to enroll", // Android
    enrollmentOptionalMsg: "Enrollment is optional and you can opt out at any time.", // Android
    informationUpdatedMsg: "Your information has been updated.", // Android
    selectAtLeastOneMsg: "Please select at least 1 option to continue.", // Android
};
