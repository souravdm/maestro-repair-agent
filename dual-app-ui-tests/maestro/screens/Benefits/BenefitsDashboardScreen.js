// BenefitsDashboardScreen.js
// Consolidated dashboard, landing, consent, error, and plan summary screens
// UPDATED 2026-04-20: Based on real simulator captures
const __platform = maestro.platform.toLowerCase() === "ios" ? "ios" : "android";
const __isIOS = __platform === 'ios';

// ============================================
// BENEFITS LANDING SCREEN
// Real elements captured from iOS simulator
// ============================================
output.benefits_landing = {
    // ===== HEADER SECTION =====
    benefitsTitleId: __isIOS ? "UnifiedHeaderView" : "unified_header_view",
    chatBtn: "Chat",
    prescriptionSummary: "Prescription summary",
    chatBtnId: __isIOS ? "UnifiedHeaderView" : "chat_button",
    messagesBtn: "Messages",
    messagesBtnId: __isIOS ? "UnifiedHeaderView" : "messages_button",
    noMessagesValue: "No messages.",
    continueAsGuest: "Continue as a guest",

    // ===== PLAN SUMMARIES SECTION =====
    planSummariesTitle: "Plan summaries|Plan summary",

    // Segmented Control (Plan Type Tabs)
    pharmacyTab: "Pharmacy",
    pharmacyTabValue: "1 of 3",
    medicalTab: "Medical",
    medicalTabValue: "2 of 3",
    dentalTab: "Dental",
    dentalTabValue: "3 of 3",

    // ===== PHARMACY PLAN CARD =====
    // Logo
    cvsCaremark: "CVS Caremark",
    ExpandedSheet: "Expanded",
    cmkCard: "caremarkLogo",
    cvsCard: "CVS",
    aetnaCard: "Aetna card",

    // Network type
    inNetworkIndividual: "In-Network claims - Individual",

    // Deductible details
    totalDeductibleLabel: "Total Deductible.*",
    remainingPercentValue: "\\d+% remaining",

    // Action button
    pharmacySpendingBtnContentDes: "(?i).*(Pharmacy spending).*",
    pharmacySpendingBtn: "Pharmacy spending",
    pharmacySpendingBtnId: "plan_summary_action_button-0",
    forwardChevron: "Forward",
    forwardChevronId: "chevron.right",

    // Mail Service Pharmacy section (additional)
    mailServicePharmacy: "Mail Service pharmacy",
    totalBalanceDue: "Total balance due",
    totalBalanceDueAmount: "\\$[0-9,]+\\.\\d{2}",
    payBtn: "Pay",
    externalLinkIcon: "externalLinkIcon",

    // ===== MEDICAL PLAN CARD =====
    aetna: "Aetna",
    deductibleValue: "Deductible - \\$[0-9,]+\\.\\d{2}",
    medicalSpendingBtn: "(?i).*(Medical spending).*",
    medicalSpendingBtnContentDes: "1 of 2, Medical spending",
    medicalSpendingBtnId: "plan_summary_action_button-0",

    // ===== DENTAL PLAN CARD =====
    dentalSpendingBtn: "(?i).*(Dental spending).*",
    dentalBenefitsPlanDocBtnContentDes: "1 of 1, Benefits & plan documents",
    dentalSpendingBtnId: "plan_summary_action_button-0",
    benefitsAndPlanDocsBtn: "Benefits & plan documents",
    benefitsAndPlanDocsBtnContentDes: ".*?Benefits & plan documents",
    benefitsAndPlanDocsBtnId: "plan_summary_action_button-1",

    // ===== ACTION CARDS =====
    // Prior Authorizations card
    priorAuthCard: __isIOS ? "Prior Authorizations" : "Prior authorizations",
    priorAuthCardId: "action_card.title-action_card.description",
    priorAuthTitle: "Prior authorizations",
    priorAuthTitleId: "action_card.title",
    priorAuthDescription: "See the status and details of your prior authorizations.",
    priorAuthDescriptionId: "action_card.description",
    priorAuthLogo: "priorAuthLogo_health100",

    // Search Pharmacy card
    searchPharmacyCard: "Search for an in-network pharmacy",
    searchPharmacyCardId: "action_card.title",
    inNetworkPharmacyLogo: "inNetworkPharmacy_health100",

    // YTD Spending card
    ytdSpendingCard: "Review your pharmacy year-to-date spending",
    ytdSpendingCardId: "action_card.title",
    ytdLogo: "ytdLogo_health100",

    // ===== FLOATING ACTION BUTTON =====
    cardsFAB: "Cards",
    storeCardIcon: "storecard_icon",

    // ===== BOTTOM TAB BAR =====
    homeTab: "Home",
    homeTabValue: "",
    benefitsTab: "Benefits",
    benefitsTabValue: "Selected, Tab 1 of 4",
    claimsTab: "Claims",
    claimsTabValue: "Tab 2 of 4",
    drugPricingTab: "Drug Pricing",
    drugPricingTabValue: "Tab 3 of 4",
    providersTab: "Providers",
    providersTabValue: "Tab 4 of 4",

    // ===== CONSENT PROMPTS =====
    viewCaremarkBenefitsPrompt: "View CVS Caremark.*benefits",
    acceptConsentBtn: "Accept|I agree",
    declineConsentBtn: "Decline|No thanks",

    // ===== ERROR/EMPTY STATES =====
    errorMessage: "Something went wrong",

    // ===== COMMON ELEMENTS =====
    planSummaryLabel: __isIOS ? "Plan Summary" : "Plan summary",

    // ===== ANDROID-SPECIFIC ELEMENTS =====
    viewInsuranceMsg: "View your insurance, access benefits and more",  // Android
    wellBringItMsg: "We'll bring it all together for you, right here.",  // Android
    cvsCaremarkPlanLabel: "CVS Caremark plan",  // Android
    deductibleIncludeMsg: "Your deductible may include both medical and pharmacy claims.",  // Android
    connectHealthDataBtn: "Connect health data",  // Android
    memberIdBtn: "Member ID|Cards",  // Android
    memberIdsTitle: "Member IDs",  // Android
    searchOrAskField: "Search or ask a question",  // Android
    aetnaBrandLogo: "Aetna brand Logo",  // Android,
    // orphan-cleanup: auto-added stub — VERIFY against real UI text
    consentSecondaryText: "Consent secondary",
    // orphan-cleanup: auto-added stub — VERIFY against real UI text
    copayCoinsuranceBtn: "Copay coinsurance",
    // orphan-cleanup: auto-added stub — VERIFY against real UI text
    drugPricingBtn: "Drug Pricing",
    claimsCard: "Claims",
    // orphan-cleanup: auto-added stub — VERIFY against real UI text
    filterMemberBtn: "Filter member",
    // orphan-cleanup: auto-added stub — VERIFY against real UI text
    memberIdLabel: "Member id",
    // orphan-cleanup: auto-added stub — VERIFY against real UI text
    memberLabel: "Member",
    // orphan-cleanup: auto-added stub — VERIFY against real UI text
    priorAuthBtn: "Prior auth",
    // orphan-cleanup: auto-added stub — VERIFY against real UI text
    shareBtn: "Share",

    // ===== ACTION CARDS (Figma: benefit_landing + benefit_sept pages) =====
    submitClaimCard: "Submit a claim",
    viewClaimHistoryCard: "View prescription claim history",
    submitRxReimbursementCard: "Submit prescription reimbursement requests",
    addRxIdCardsCard: "Add prescription ID cards to your CVS® wallet",
    spendingDetailsCard: "Spending details",
    serviceUsageCard: "Service Usage",
    copayAndCoinsuranceCard: "Copay & coinsurance",
    copayAndCoinsuranceCardContentDes: ".*?Copay & coinsurance",
    payABillCard: "Pay a bill",
    findAPharmacyCard: "Find a pharmacy",

    // ===== CONSENT / CONNECT FLOW =====
    notNowBtn: "Not now",
    basedOnYourPlansText: "Based on your plan(s), you may be able to:",
    updateAetnaAccessMsg: "Update access to your health data to see your Aetna information.",
    updateCaremarkAccessMsg: "Update access to your health data to see your prescription plan costs and coverage.",
    viewPlanDetailsBtn: "View plan details",

    // ===== YOUR BENEFITS HEADER =====
    yourBenefitsTitle: "Your benefits",

    // ===== COMING SOON STATE =====
    comingSoonTitle: "We've got more coming",
    checkBackSoonText: "Check back soon to see our updates.",

    // ===== PLAN DATE =====
    planDateRange: "January \\d+, \\d{4} - December \\d+, \\d{4}",
    planStartedPattern: "Started .*",
    learnAboutAI: "Learn about AI in Health100",
    learnAboutAIH100: "Health100.*",
};

// ============================================
// Pharmacy plans spending details screen
// ============================================
output.benefits_pharmacy_plan_spending = {
mainTitle: "Spending",
pharmacyPlanSpendingTitle: "Pharmacy plan spending",
inNetwork: "In Network",
outOfNetwork: "Out Of Network",
viewDetailsBtn: "(?i).*(View details).*",
memberBtn: "Dean Fant",
deanFantSelection: "(?i).*(DEAN FANT).*",
giselleFantSelection: "(?i).*(GISELLE FANT).*",
deductible: "Deductible",

};

// ============================================
// BENEFITS CONSENT SCREEN
// ============================================
output.benefits_benefits_consent = {
    consentModalTitle: "Consent Required|Data Sharing Agreement",
    consentDescription: "To view your CVS Caremark benefits.*",
    consentTerms: "By accepting.*you agree to",
    acceptBtn: "Accept|I agree",
    declineBtn: "Decline|No thanks|Skip",
    learnMoreLink: "Learn more",
    privacyPolicyLink: "Privacy Policy",
    termsOfUseLink: "Terms of Use",

    // Consent types
    caremarkConsent: "CVS Caremark",
    aetnaConsent: "Aetna",

    // orphan-cleanup: auto-added stub — VERIFY against real UI text

    caremarkConnectBtn: "Caremark connect",

    // orphan-cleanup: auto-added stub — VERIFY against real UI text

    connectHealthBtn: "Connect health",

    // orphan-cleanup: auto-added stub — VERIFY against real UI text

    connectNowBtn: "Connect now",

    // orphan-cleanup: auto-added stub — VERIFY against real UI text

    connectingMessage: "Connecting",

    // orphan-cleanup: auto-added stub — VERIFY against real UI text

    consentTitle: "Consent",

    // orphan-cleanup: auto-added stub — VERIFY against real UI text

    permissionsTitle: "Permissions",

    // orphan-cleanup: auto-added stub — VERIFY against real UI text

    privacyTitle: "Privacy",

    // orphan-cleanup: auto-added stub — VERIFY against real UI text

    successMessage: "Success",

    // orphan-cleanup: auto-added stub — VERIFY against real UI text

    viewPrivacyPolicyBtn: "View privacy policy",

    // orphan-cleanup: auto-added stub — VERIFY against real UI text

    viewTermsBtn: "View terms",

};

// ============================================
// BENEFITS ERROR SCREEN
// ============================================
output.benefits_benefits_error = {
    // Error messages
    errorTitle: "Something went wrong",
    errorMessage: "We couldn't load your info. Please try again later.",
    apiErrorMessage: "Unable to load benefits|Error loading data",
    networkError: "No internet connection|Check your connection",

    // Empty states
    noBenefitsTitle: "No benefits available",
    noBenefitsMessage: "You don't have any active benefits at this time",

    // Error actions
    goBackBtn: "Go back",
    contactSupportBtn: "Contact support",
    refreshBtn: "Refresh",

    // Error icons
    errorIcon: "error_icon|alert_icon",
    warningIcon: "warning_icon",
    infoIcon: "info_icon|neutral",


    // ===== ANDROID-SPECIFIC ELEMENTS =====
    pleaseTryAgainLaterMsg: "Please try again later.",  // Android
    dismissBtn: "Dismiss",  // Android
};

// ============================================
// PLAN SUMMARY DETAILS SCREENS
// (Pharmacy Spending, Medical Spending, Dental Spending)
// ============================================
output.benefits_plan_summary = {
    // ===== HEADER =====
    backBtnId: __isIOS ? "UnifiedHeaderView" : "back_button",
    pageTitle: "Pharmacy Spending|Medical Spending|Dental Spending",
    pageTitleId: __isIOS ? "UnifiedHeaderView" : "page_title",

    // ===== PHARMACY SPENDING SCREEN =====
    yourPharmacySpending: "Your pharmacy spending",

    // Network sections
    inNetworkSection: "In Network",
    viewDetailsBtn: "View details for In Network spending",

    // Deductible card
    deductibleLabel: "Deductible - \\$[0-9,]+\\.\\d{2}",
    remainingPercent: "\\d+% remaining",

    // Out-of-Pocket Max card
    outOfPocketLabel: "Out-of-Pocket max - \\$[0-9,]+\\.\\d{2}",

    // ===== MEDICAL SPENDING SCREEN =====
    yourMedicalSpending: "Your medical spending",
    familyTabButton: "Family",
    individualTabButton: "Individual",

    // ===== DENTAL SPENDING SCREEN =====
    yourDentalSpending: "Your dental spending",

    // Common elements
    helpBtn: "Help"
};

// ============================================
// BENEFITS HOME SCREEN (Legacy - kept for compatibility)
// ============================================
output.benefits_home = {
    coverageTitle: "Coverage",
    pageHeader: "Benefits|Coverage",

    planDocumentsCard: "Plan Documents",
    planDocumentsBtn: "View Documents",
    prescriptionSummary: "Prescription summary",
    idCardsCard: "ID Cards",
    idCardsBtn: "View ID Card",

    claimsCard: "Claims",
    claimsBtn: "View Claims",
    claimsHistoryBtn: "Claims History",

    coverageDetailsCard: "Coverage Details",
    coverageDetailsBtn: "View Coverage",

    deductibleAmount: "\\$[0-9,]+",

    outOfPocketLabel: "Out-of-Pocket Maximum",
    outOfPocketAmount: "\\$[0-9,]+",


    errorMessage: "Unable to load|Error|Try again",
    noCoverageMessage: "No coverage found|No active coverage",
};

// ============================================================================
// COMMON — auto-extracted (Phase B): properties shared verbatim across blocks
// ============================================================================
output.benefits_dashboard_common = {
    aetnaLogo: "Aetna logo",
    backBtn: "Back",
    benefitsTitle: "Benefits",
    closeBtn: "Close",
    cvsCaremarkLogo: "(?i)CVS Caremark Logo",
    deductibleLabel: "Deductible",
    loadingIndicator: "Loading.*",
    noPlansAvailable: "No plans available",
    remainingAmount: "\\$[0-9,]+\\.\\d{2}",
    remainingLabel: "Remaining",
    spentAmount: "\\$[0-9,]+\\.\\d{2}",
    spentLabel: "Spent",
    statusBarShowing: "Status bar showing",
    tryAgainBtn: "Try again",
    inNetworkClaimsFamily: "In-network claims - Family",
    totalDeductiblePattern: "Total [Dd]eductible — \\$[0-9,]+",
    resetsYearlyLabel: "Resets yearly",
};
