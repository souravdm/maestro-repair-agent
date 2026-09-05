const __platform = maestro.platform.toLowerCase() === "ios" ? "ios" : "android";
const __isIOS = __platform === 'ios';

// Detect Flutter app (Health100 on iOS typically uses Flutter)
const isFlutterApp = __isIOS && (output.APP_ID?.includes('health100') || false);

// Helper function: Use OCR text for Flutter, accessibility ID for native
const selector = (text, id = null) => {
  // For Flutter apps, always use text (OCR)
  // For native apps, prefer ID if available, otherwise use text
  if (isFlutterApp) {
    return text;  // OCR will find this text on screen
  }
  return id || text;  // Use accessibility ID or text
};

output.common_navigation = {
    // Bottom navigation tabs
    homeTab: "Home",
    pharmacyTab: "Pharmacy",
    deanUser: "Dean",
    pharmacyLabel: "Prescriptions",
    healthTab: "Health",
    healthLabel: "Your Health",
    shopTab: "Shop & Save",
    shopLabel: "Savings",
    accountBtn: "Account",
    findStoreTab: "Find Store",
    menuTab: "Menu",
    showCardTab: "Show Card",
    cardTab: "Card",
    savingsTab: "Savings",
    cartIcon: "Cart",

    // Pharmacy sub-tabs
    prescriptionsTab: "Prescriptions",
    ordersTab: "Orders",
    spendingBottomNavBtn: "Spending",
    moreTab: "More",

    // Health sub-tabs
    yourHealthTab: "Your Health",
    findCareTab: "Find Care",
    recordsTab: "Records",

    // Health100 Benefits bottom nav tabs
    benefitsTab: "Benefits",
    benefitsTabValue: "Selected, Tab 1 of 4",
    claimsTab: "Claims",
    claimsTabValue: "Tab 2 of 4",
    claimsTabSelected: "Selected, Tab 2 of 4",
    drugPricingTab: "Drug Pricing",
    drugPricingTabValue: "Tab 3 of 4",
    drugPricingTabSelected: "Selected, Tab 3 of 4",
    providersTab: "Providers",
    providersTabValue: "Tab 4 of 4",
    providersTabSelected: "Selected, Tab 4 of 4",
    year2026: "2026",
    year2025: "2025",
    // Metadata
    _isFlutterApp: isFlutterApp,
    _selectorMode: isFlutterApp ? 'OCR' : 'Accessibility'
}

output.common_navbars = {
    homeScreenNavBar: "Home",
    accountNavBar: "Account",
    findStoreNavBar: "Find Store",
    menuNavBar: "Menu",
    pharmacyNavBar: "Pharmacy",
    prescriptionsNavBar: "Prescriptions",
    ordersNavBar: "Orders",
    spendingNavBar: "Spending",
    moreNavBar: "More",
    healthNavBar: "Health",
    findCareNavBar: "Find Care",
    recordsNavBar: "Records",
    providersNavBar: "Connections",
}

output.common_buttons = {
    signInBtn: "Sign in",
    signOutBtn: "Sign out",
    homeTab: "Home",
    backBtn: "Back",
    backBtnAlt: "Back Button. Double tap to navigate, back to previous screen.",
    accountDashboardBackBtn: "Back. Double tap to navigate back to previous screen.",
    continueBtn: "Continue",
    confirmBtn: "Confirm",
    confirmAndSignIn: "Confirm and Sign In",
    cancelBtn: "Cancel",
    closeBtn: "Close",
    closeMessageBtn: "Close Message",
    okBtn: "OK",
    doneBtn: "Done",
    // iOS keyboard return key: accessory-bar "Done" fields use "Done", but a
    // plain text field's own return key exposes lowercase "done" instead.
    keyboardDoneKey: "(?i)done",
    saveBtn: "Save",
    nextBtn: "Next",
    notNowBtn: __isIOS ? "Not Now" : "Not now",
    notNowBtnVariant: "Not now",
    yesBtn: "Yes",
    noBtn: "No",
    settingsBtn: "Settings",

    // Permission & System Prompts
    allowBtn: "Allow",
    allowWhileUsingAppBtn: "Allow While Using App",
    allowOnceBtn: "Allow Once",
    allowAlwaysBtn: "Always Allow",
    dontAllowBtn: "Don't Allow",

    // Dismissal & Skip Actions
    skipBtn: "Skip",
    skipForNowBtn: "Skip for now",
    dismissBtn: "Dismiss",
    gotItBtn: "Got it",
    gotItBtnVariant: "Got It",
    maybeLaterBtn: "Maybe later",
    remindMeLaterBtn: "Remind me later",

    // Dialog & Confirmation Actions
    retryBtn: "Retry",
    tryAgainBtn: "Try again",
    okGotItBtn: "OK, got it",

    // Edit & Management Actions
    editBtn: "Edit",
    deleteBtn: "Delete",
    removeBtn: "Remove",
    shareBtn: "Share",
    copyBtn: "Copy",
    pasteBtn: "Paste",

    // Additional Common Actions
    submitBtn: "Submit",
    applyBtn: "Apply",
    clearBtn: "Clear",
    clearAllBtn: "Clear all",
    searchBtn: "Search",
    filterBtn: "Filter",
    filtersBtn: "Filters",
    sortBtn: "Sort",
    refreshBtn: "Refresh",
    reloadBtn: "Reload",
    learnMoreBtn: "Learn more",
    viewBtn: "View",
    viewAllBtn: "View all",
    seeAllBtn: "See all",
    getStartedBtn: "Get started",
    continueAsGuestBtn: "Continue as Guest",
    signUpBtn: "Sign up",
    createAccountBtn: "Create an account",

    // Health100 Header Buttons
    chatBtn: "Chat",
    messagesBtn: "Messages",
    notificationsBtn: "Notifications",

    // Additional Actions
    addBtn: "Add",
    addNewBtn: "Add new",
    updateBtn: "Update",
    changeBtn: "Change",
    selectBtn: "Select",
    chooseBtn: "Choose",
    uploadBtn: "Upload",
    downloadBtn: "Download",
    printBtn: "Print",
    sendBtn: "Send",
    sheetGrabberBtn: "Sheet Grabber|Drag Handle",
}

output.common_links = {
    profileLnk: "Profile",
    addressesLnk: "Addresses",
    paymentMethodsLnk: "Payment methods",
    insuranceLnk: "Insurance",
    privacyPolicyLink: "Privacy Policy",
    termsOfUseLink: "Terms of Use",
    termsAndConditionsLink: "Terms and Conditions",
    termsConditionsLink: "Terms & Conditions",
    helpCenterLink: "Help Center",
    supportLink: "Support",
    contactUsLink: "Contact Us",
}

output.common_inputs = {
    searchPlaceholder: "Search",
    enterTextPlaceholder: "Enter text here",
    typeHerePlaceholder: "Type here",
    commentsPlaceholder: "Add a comment",
    notesPlaceholder: "Add notes",

    // Name Fields
    firstNameField: "First name",
    firstNameFieldPattern: "First name.*",
    lastNameField: "Last name",
    lastNameFieldPattern: "Last name.*",

    // Address Fields
    streetAddressField: "Street address",
    streetAddressFieldPattern: "Street address.*",
    cityField: "City",
    cityFieldPattern: "City.*",
    stateField: "State",
    stateFieldPattern: "State.*",
    zipCodeField: "ZIP code",
    zipCodeFieldPattern: "ZIP code.*",

    // Personal Information Fields
    dateOfBirthField: "Date of birth",
    phoneNumberField: "Phone number",
    phoneNumberFieldPattern: "Phone number.*",
}

output.common_messages = {
    documentUploadedMsg: "Document uploaded",
    addedToCartMsg: "Added to cart",
    scheduleVaccineMsg: "Schedule a vaccine",

    // Welcome & Launch Messages
    welcomeMsg: "Welcome",
    welcomeToCvsMsg: "Welcome to CVS",
    welcomeBackMsg: "Welcome back",
    healthInPocketMsg: "We put better health in your pocket.",
    letsGetStartedMsg: "Let's get you started",
    allSetMsg: "All Set",
    youreReadyMsg: "You're ready to get started",

    // Loading & Progress Messages
    loadingMsg: "Loading",
    loadingEllipsisMsg: "Loading...",
    pleaseWaitMsg: "Please wait",
    pleaseWaitEllipsisMsg: "Please wait...",
    processingMsg: "Processing",
    savingMsg: "Saving",
    submittingMsg: "Submitting",

    // Success Messages
    successMsg: "Success",
    completedMsg: "Completed",
    doneMsg: "Done",
    savedMsg: "Saved",
    updatedMsg: "Updated",
    submittedMsg: "Submitted",
    confirmedMsg: "Confirmed",

    // Error Messages
    errorMsg: "Error",
    errorOccurredMsg: "An error occurred",
    somethingWentWrongMsg: "Something went wrong",
    tryAgainMsg: "Please try again",
    tryAgainLaterMsg: "Please try again later",
    networkErrorMsg: "Network error. Please check your connection.",
    havingTechIssuesMsg: "We're having technical issues",

    // Informational Messages
    infoMsg: "Information",
    tipMsg: "Tip",
    didYouKnowMsg: "Did you know",
    importantMsg: "Important",
    noteMsg: "Note",
    warningMsg: "Warning",

    // Confirmation Messages
    areYouSureMsg: "Are you sure?",
    confirmActionMsg: "Are you sure you want to proceed?",
    cannotBeUndoneMsg: "This action cannot be undone",

    // Empty State Messages
    noItemsMsg: "No items",
    noResultsMsg: "No results found",
    noDataMsg: "No data available",
    nothingHereMsg: "Nothing here yet",
    emptyListMsg: "List is empty",
}

// Overlay & Popup Dismissal Patterns
// Combined regex patterns for common overlays that appear throughout the app.
// Use with: when: visible / tapOn in flows to handle unexpected popups.
output.common_overlays = {
    // Matches promotional/informational popups
    visiblePattern: "Tip|Did you know|Information|Promotion|Banner|Quick tip",
    // Matches dismiss buttons for those popups
    dismissPattern: "Got it|Close|Dismiss|Not Now|Not now|OK|Skip",
    // Matches error/alert popups
    errorVisiblePattern: "Error|Alert|Something went wrong|Invalid",
    // Matches dismiss buttons for error popups
    errorDismissPattern: "OK|Close|Dismiss|Retry|Try again",
    // Matches post-login promotional banners
    bannerVisiblePattern: "Banner|Promotion|Offer|Special offer|Limited time",
    // Matches dismiss buttons for banners
    bannerDismissPattern: "Close|X|Dismiss|Not Now|Not now",
}

// Log selector mode for debugging
console.log(`[CommonScreen] Selector Mode: ${isFlutterApp ? '🔍 OCR (Flutter App)' : '🎯 Accessibility (Native App)'}`);
console.log(`[CommonScreen] App ID: ${output.APP_ID || 'Not set'}`);
console.log(`[CommonScreen] Platform: ${__isIOS ? 'iOS' : 'Android'}`);
