const __platform = maestro.platform.toLowerCase() === "ios" ? "ios" : "android";
const __isIOS = __platform === 'ios';

// ========================================================================
// BOTTOM NAVIGATION
// ========================================================================
output.searchnav_bottom = {
    homeBtn: "Home",
    pharmacyBtn: "Pharmacy",
    healthBtn: "Health",
    shopSaveBtn: "Shop & Save",
    menuBtn: "Menu",
    benefitsTab: "Benefits",
    bottomMenu: "(?i).*(Menu|menu).*",
};

output.searchnav_bottom_pharmacy = {
    prescriptions: "Prescriptions",
    orders: "Orders",
    spending: "Spending",
    more: "More",
};

output.searchnav_bottom_benefits = {
    benefits: "Benefits",
    benefitsSummary: "Benefits summary",
    claims: "Claims",
    drugPricing: "Drug Pricing",
};

output.searchnav_secondary = {
    minuteClinicBtn: "MinuteClinic®",
};

// ========================================================================
// HEADER / UNIFIED NAVIGATION
// ========================================================================
output.searchnav_header = {
    accountBtn: "Account",
    notificationsBtn: "Notifications",
    signInBtn: "Sign In",
    inboxBtn: "Inbox.*",
    cartBtn: "Cart.*",
    searchText: "Search.*",
    searchOrAskQuestionText: "Search or ask a question",
    voiceSearchBtn: "Voice search",
    unifiedHeaderViewId: "UnifiedHeaderView",
};

// ========================================================================
// EXPLORE MORE / SIDE MENU
// ========================================================================
output.menu_screen = {
    // ===== MENU HEADER =====
    exploreMoreTitle: "Explore More",
    menuTitle: "Menu",
    closeMenuBtn: __isIOS ? "Back" : "Close menu",
    closeMenuAltBtn: __isIOS ? "Close" : "Close menu",
    menuOpenBtn: __isIOS ? "Menu, heading" : "Close menu",
    menuSheetHandle: "(?i).*(Menu sheet handle|collapsed|Collapsed).*",
    expandBtn: "Expand",
    collapseBtn: "Collapse",

    // ===== MENU TIP / ONBOARDING =====
    menuHasMovedTip: "Menu has Moved",
    menuSwipeTip: "Access menu quickly with a swipe from left to right.",

    // ===== AUTH =====
    signInBtn: "Sign in",
    createAccountBtn: "Create an Account",

    // ===== PHARMACY =====
    pharmacyDashboardLnk: "Pharmacy Dashboard",
    pharmacySpendingTitle: "Pharmacy spending at your fingertips",
    pharmacySpendingDesc: "Quickly view your Rx costs and savings opportunities.",

    // ===== SAVINGS & MEMBERSHIPS =====
    savingsAndMemberships: "Savings & Memberships",
    extracareSavingsLnk: "ExtraCare Savings",
    manageExtracareLnk: "Manage ExtraCare",
    weeklyAdLnk: "Weekly Ad",

    // ===== SHOP =====
    browseLnk: "Browse",
    photoLnk: "Photo",
    photoServicesLnk: "Photo services",
    myListsLnk: "My Lists",

    // ===== HEALTH =====
    minuteclinicLnk: "MinuteClinic",
    healthServicesLnk: "Health services",
    vaccinationsLnk: "Vaccinations",
    covid19Lnk: "COVID-19",
    healthRecordsLnk: "Health records",

    // ===== HELP & SUPPORT =====
    helpCenterLnk: "Help Center",
    supportAndFaqLnk: "Support & FAQ",
    feedbackLnk: "Feedback",
    sendFeedbackBtn: "Send Feedback",
    rateTheAppBtn: "Rate the App",
    termsAndPrivacyLnk: "Terms and Privacy",

    // ===== STORE =====
    findACvsStoreLnk: "Find a CVS Store",
    storeLocatorTitle: "Store Locator",
    storeLocatorLabel: "Store locator",
    filterBtn: "Filter",
    detailsLnk: "Details",
    directionsLnk: "Directions",
    callLnk: "Call",

    // ===== APP SETTINGS =====
    appSettings: "App Settings",
    copyDeviceInfoBtn: "Copy Device Info",
    deviceInfoCopiedMsg: "Device Info Copied",

    // ===== ALERTS =====
    leavingCvsAppAlert: "Leaving CVS App",
    continueToCvsBtn: "Continue to CVS.com",
    thirdPartyDisclaimer: "For content hosted by a third party; once you select a card, you will be outside of our terms use and privacy policy.",
    importantInformation: "Important information",
    signInToStayUpdated: "Make sure you're signed in to your CVS account to stay updated on prescriptions, health info and more.",
    weeklyAdMovedMsg: "Weekly Ad moved to new location",
};

// ========================================================================
// NOTIFICATIONS
// ========================================================================
output.menu_notifications = {
    notificationsTitle: "Notifications",
    inboxLabel: "Inbox",
    youreAllCaughtUpMsg: __isIOS ? "You\u2019re all caught up!" : "You're all caught up!",
    signInToViewMsg: "Sign in to view notifications",
    deleteBtn: "Delete",
    markAsReadBtn: "Mark as read",
    selectAllBtn: "Select all",
    deselectAllBtn: "Deselect all",
    last3DaysFilter: "Last 3 days",
    todayFilter: "Today",
    justNowLabel: "Just now",
    yesterdayLabel: "Yesterday",
    clearAllBtn: "Clear All",
    clearAllConfirmMsg: "Are you sure you want to clear all history?",
    filteringByLabel: "Filtering by:",
};
