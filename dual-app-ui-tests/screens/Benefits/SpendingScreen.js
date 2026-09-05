// SpendingScreen.js
// Pharmacy, Medical, and Dental spending screens
// UPDATED 2026-04-20: Based on real simulator captures
const __platform = maestro.platform.toLowerCase() === "ios" ? "ios" : "android";
const __isIOS = __platform === 'ios';

// ============================================
// PHARMACY SPENDING SCREEN
// ============================================
output.benefits_pharmacy_spending = {
    // ===== HEADER =====
    pageTitle: "Pharmacy Spending",
    pageTitleId: __isIOS ? "UnifiedHeaderView" : "pharmacy_spending_title",

    // ===== LOGO =====
    cvsCaremarkLogo: "CVS Caremark logo",

    // ===== PAGE TITLE =====
    yourPharmacySpending: "Your pharmacy spending",
    viewPrescriptionClaims: "View prescription claims",
    // ===== NETWORK SECTIONS =====

    outOfNetworkDetails: "View details for Out of Network spending",

    // ===== DEDUCTIBLE CARD =====

    // Spent section
    spentSection: "\\$[0-9,]+\\.\\d{2}, Spent",

    // Remaining section
    remainingSection: "\\$[0-9,]+\\.\\d{2}, Remaining",

    // Status bar

    // ===== OUT-OF-POCKET MAX CARD =====
    outOfPocketCard: "Out-of-Pocket max - \\$[0-9,]+\\.\\d{2}, \\$.*Spent, \\$.*Remaining, Status bar with \\d+% remaining",

    // ===== SPENDING BREAKDOWN =====

    // Categories
    prescriptionsLabel: "Prescriptions",
    prescriptionsAmount: "\\$[0-9,]+",
    medicalSuppliesLabel: "Medical supplies",
    medicalSuppliesAmount: "\\$[0-9,]+",

    // ===== RECENT TRANSACTIONS =====
    viewAllTransactionsBtn: "View all",

    // Transaction card
    transactionDate: ".*\\d{1,2}, \\d{4}",
    transactionName: ".*",
    transactionAmount: "\\$[0-9,]+\\.\\d{2}",

    // ===== YTD / ACTIONS (Figma: plan_spending_rx + spending_details) =====
    seeYTDSpending: "See year-to-date spending",
    lookingForAnnualSpending: "Looking for your annual .*spending\\?",
    requestReimbursementCTA: "Request reimbursement for your claims",
    submitClaimCTA: "Submit a claim",

    // ===== RECENT PHARMACY CLAIMS =====
    spendingDetails: "Spending Details",
    inNetworkSpendingLabel: "In Network Spending",
    outOfNetworkSpendingLabel: "Out Of Network Spending",
    recentPharmacyClaimsTitle: "Recent pharmacy claims",
    theseClaimsMightCount: "These claims might also count in other spending categories.*",
    wentTowardDeductiblePattern: "\\$[0-9,]+\\.\\d{2} went toward your deductible",
    wentTowardOOPPattern: "\\$[0-9,]+\\.\\d{2} went toward your out-of-pocket",
    claimIdPattern: "Claim ID: .*",
    loadMoreClaimsBtn: "Load more claims",
    viewEOBBtn: "View EOB",
    viewEOBPattern: "View your Explanation of Benefits \\(EOB\\) from .*",

    // ===== COMMON =====
};

// ============================================
// MEDICAL SPENDING SCREEN
// ============================================
output.benefits_medical_spending = {
    // ===== HEADER =====
    pageTitle: "Medical Spending",
    pageTitleId: __isIOS ? "UnifiedHeaderView" : "medical_spending_title",

    // ===== LOGO =====

    // ===== PAGE TITLE =====
    yourMedicalSpending: "Medical plan spending",

    // ===== NETWORK SECTIONS =====


    // ===== DEDUCTIBLE CARD =====


    // ===== OUT-OF-POCKET MAX CARD =====

    // ===== SPENDING BREAKDOWN =====

    // Categories
    officeVisitsLabel: "Office visits",
    officeVisitsAmount: "\\$[0-9,]+",
    emergencyRoomLabel: "Emergency room",
    emergencyRoomAmount: "\\$[0-9,]+",
    surgeryLabel: "Surgery",
    surgeryAmount: "\\$[0-9,]+",
    labWorkLabel: "Lab work",
    labWorkAmount: "\\$[0-9,]+",

    // ===== MEDICAL SPENDING NETWORK (Figma: spending_med_dnt) =====
    yourTotalCostLabel: "Your total cost",
    yourTotalCostUnavailable: "Your total cost is unavailable.",
    informationUnavailableLabel: "Information is unavailable",
    theseTransactionsDisclaimer: "These transactions might also count in other spending categories.",
    rxCostsProvidedByPBM: "Rx costs are provided by your plan's Pharmacy Benefits Manager \\(PBM\\).",
    rxFromPBMLabel: "Rx from your Pharmacy Benefit Manager \\(PBM\\)",
    seeAllBtn: "See all",
    viewDetailsBtn: "View details",
    visitedOnPattern: "Visited on .*",
    allMembersPattern: "All (?:M|m)embers.*",

    // ===== COMMON =====
};

// ============================================
// DENTAL SPENDING SCREEN
// ============================================
output.benefits_dental_spending = {
    // ===== HEADER =====
    pageTitle: "Dental plan spending",
    pageTitleId: __isIOS ? "UnifiedHeaderView" : "dental_spending_title",

    // ===== LOGO =====

    // ===== PAGE TITLE =====
    yourDentalSpending: "Your dental spending",

    // ===== NETWORK SECTIONS =====

    // ===== DEDUCTIBLE CARD =====


    // ===== ANNUAL MAXIMUM =====
    annualMaximumLabel: "Annual maximum - \\$[0-9,]+\\.\\d{2}",
    annualMaximumCard: "Annual maximum - \\$[0-9,]+\\.\\d{2}, \\$.*Spent, \\$.*Remaining",

    // ===== SPENDING BREAKDOWN =====

    // Categories
    preventiveCareLabel: "Preventive care",
    preventiveCareAmount: "\\$[0-9,]+",
    basicServicesLabel: "Basic services",
    basicServicesAmount: "\\$[0-9,]+",
    majorServicesLabel: "Major services",
    majorServicesAmount: "\\$[0-9,]+",

    // ===== COMMON =====
};

// ============================================
// SPENDING DASHBOARD & COPAY/COINSURANCE
// ============================================
// NOTE: despite the name, this block is a catch-all of misc Spending-area
// elements (navigation, copay, pharmacy search, account labels). It is
// historically referenced as `benefits_spending_common` from many YAML
// flows, so the name is preserved for backward compatibility. The
// auto-extracted "shared across pharmacy/medical/dental sub-screens"
// block lives below as `benefits_spending_subscreen_common`.
output.benefits_spending_common = {
    // ===== NAVIGATION =====
    spendingDashboardTitle: "Spending",
    totalSpendingLabel: "Total spending",

    // ===== COPAY & COINSURANCE =====
    copayAndCoinsuranceLabel: "Copay & Coinsurance",
    knowYourCostsLabel: "Know your costs",
    knowYourCostsTitle: "Know Your Costs",
    pricingUnderPlanLabel: "Pricing under your plan",
    pricingUnderPlanTitle: "Pricing Under Plan",
    learnMoreLink: "Learn More",
    priceDrugBtn: "Price a Drug",
    compareMedicationPricesTitle: "Compare medication prices",
    enterDrugNameLabel: "Enter drug name or NDC number",
    getPriceBtn: "Get price",
    mailLabel: "Mail",
    retailLabel: "Retail",
    inNetworkLabel: "In-network",
    inNetworkClaimsIndividualLabel: "In-Network claims - Individual",
    outOfPocketMaxLabel: "Out-of-pocket max",
    deductibleLabel: "Deductible",
    annualBenefitMaxLabel: "(?i).*(Annual benefit max).*",
    pharmacySpendingBtn: "Pharmacy spending",
    seeAllBtn: "See All",
    stageLabel: "Stage",
    pharmacySpendingTitle: "Pharmacy Spending",
    yourPharmacySpendingTitle: "Your Pharmacy Spending",
    moneyAmountLabel: "Money Amount",

    // ===== MEDICARE =====
    claimsTitle: "Claims",
    noClaimsMsg: "No Claims",

    // ===== PHARMACY SEARCH =====
    pharmacySearchLabel: "Pharmacy Search",
    findInNetworkPharmaciesBtn: "Find In Network Pharmacies",
    searchInNetworkPharmacyBtn: "Search In Network Pharmacy",
    addressSearchBtn: "Address Search",
    searchPharmaciesBtn: "Search Pharmacies",
    servicesBtn: "Services",
    ninetyDaySupplyOption: "90 Day Supply",
    specialtyPharmacyOption: "Specialty Pharmacy",
    twentyFourHourOption: "24 Hour",
    driveThruOption: "Drive Thru",
    fluShotsOption: "Flu Shots",
    prescriptionDeliveryOption: "Prescription Delivery",
    showingPharmaciesMsg: "Showing Pharmacies",
    resultsLabel: "Results",
    pharmacyTypeFilter: "Pharmacy Type",
    chainOption: "Chain",
    independentOption: "Independent",
    hospitalOption: "Hospital",
    languagesSpokenFilter: "Languages Spoken",
    englishOption: "English",
    spanishOption: "Spanish",
    chineseOption: "Chinese",
    viewPharmacyDetailsBtn: "View Pharmacy Details",
    viewPharmacyDetails: "View pharmacy details.*",
    pharmacyHoursLabel: "Pharmacy Hours",
    callPhoneBtn: "Call Phone",

    // ===== COMMON =====
    homeBtn: "Home",
    accountLabel: "Account",
    signOutBtn: "Sign out",
    signInLabel: "Sign in",

    // ===== ANDROID-SPECIFIC ELEMENTS =====
    explainMySpendingBtn: "Explain my spending",  // Android
    troubleGeneratingAiMsg: "We're having trouble generating your AI insight, try again later.",  // Android

    // ===== YTD SPENDING SUMMARY (Figma: ytd_spending) =====
    spendingSummaryTitle: "Spending summary",
    yearToDateTotalLabel: "Year-to-date total",
    yourYearToDateTotal: "Your year-to-date total",
    totalEligibleCosts: "Total eligible costs (after savings)",
    totalIncludesCoverage: "Total includes plan coverage plus out-of-pocket payments.",
    totalEqualsExplanation: "Total = what your plan covered + your out-of-pocket costs",
    downloadPrescriptionExpensesPattern: "Download prescription expenses for \\d{4}",
    noSpendingRecords: "No spending records found",
    waysToSaveSection: "Ways to save",
    savingsSuggestionPattern: "Save \\$[0-9,]+ by making changes to your medication.",
    topMedicationSpendPattern: "Top .* spend",
    seeHowBtn: "See how",
    viewAllClaimsBtn: "View all claims",

    // ===== MAXIMUM ALLOWABLE BENEFITS =====
    maximumAllowableBenefits: "Maximum allowable benefits \\(MAB\\)",
    lifetimeFertilityPattern: "Lifetime fertility — \\$[0-9,]+",
    lifetimeSmokingCessation: "Lifetime smoking cessation — \\$[0-9,]+",

    // ===== PLAN DATE / PERIOD =====
    planDateRange: "January \\d+, \\d{4} - December \\d+, \\d{4}",
    planYearLabel: "Resets yearly",

    // ===== NOTICES =====
    planYearRecentlyStartedMsg: "If your plan year has recently started, check back after you've made a payment to see updates.",
    couldntDownloadExpensesMsg: "We couldn't download your prescription expenses",
    tryAgainFewMinutes: "Try again in a few minutes.",
    importantInfoDisclaimer: "Important information and disclaimers",
};

// ============================================================================
// COMMON — auto-extracted (Phase B): properties shared verbatim across the
// pharmacy/medical/dental spending sub-screen blocks.
// ============================================================================
output.benefits_spending_subscreen_common = {
    aetnaLogo: "Aetna logo",
    backBtn: "Back",
    backBtnId: __isIOS ? "UnifiedHeaderView" : "back_button",
    closeBtn: "Close",
    deductibleCard: "Deductible - \\$[0-9,]+\\.\\d{2}, \\$.*Spent, \\$.*Remaining, Status bar with \\d+% remaining",
    deductibleLabel: "Deductible - \\$[0-9,]+\\.\\d{2}",
    helpBtn: "Help",
    familyInNetworkLabel: "Family in-network spending",
    inNetworkLabel: "In Network",
    inNetworkSpendingLabel: "In-network spending",
    loadingIndicator: "Loading.*",
    recentTransactionsTitle: "Recent transactions",
    outOfNetworkLabel: "Out of Network",
    outOfPocketLabel: "Out-of-Pocket max - \\$[0-9,]+\\.\\d{2}",
    remainingAmount: "\\$[0-9,]+\\.\\d{2}",
    remainingLabel: "Remaining",
    shareBtn: "Share",
    spendingBreakdownTitle: "Spending breakdown",
    spentAmount: "\\$[0-9,]+\\.\\d{2}",
    spentLabel: "Spent",
    statusBarShowing: "Status bar showing",
    statusBarValue: "\\d+% remaining",
    viewDetailsBtn: "View details for In Network spending",
    ytdSpendingAmount: "\\$[0-9,]+\\.\\d{2}",
    ytdSpendingLabel: "Year-to-date spending",
};
