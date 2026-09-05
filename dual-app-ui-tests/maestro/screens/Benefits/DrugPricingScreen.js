// DrugPricingScreen.js
// Drug pricing search and results screens
// UPDATED 2026-04-20: Based on real simulator captures
const __platform = maestro.platform.toLowerCase() === "ios" ? "ios" : "android";
const __isIOS = __platform === 'ios';

// ============================================
// DRUG PRICING LANDING SCREEN
// ============================================
output.benefits_drug_pricing = {
    // ===== HEADER =====
    drugPricingTitle: "Drug Pricing",
    specialtyPharmacy: "Care Plus CVS/Pharmacy 02733",
    locationNotFound: "Location wasn.*",
    allMembers: "All Members (2)",
    drugPricingTitleId: __isIOS ? "UnifiedHeaderView" : "drug_pricing_title",
    chatBtn: "Chat",
    kitts: "Kitts",
    nevis: "Nevis",
    update: "Update",
    updatePricing: "Update pricing",
    tablet: "TABLET",
    chatBtnId: __isIOS ? "UnifiedHeaderView" : "chat_button",
    messagesBtn: "Messages",
    form: "Form",
    member: "Member",
    messagesBtnId: __isIOS ? "UnifiedHeaderView" : "messages_button",

    // ===== ERROR STATE (API issue captured) =====
    importantInformation: "Important information, Something went wrong",
    neutralStatus: "neutral",
    errorTitle: "Something went wrong",
    errorMessage: "We couldn't load your info. Please try again later.",
    tryAgainBtn: "Try again",
    refreshBtn: "Refresh",
    disclaimerLink: "Review the full disclaimer",

    // ===== SEARCH SECTION =====
    searchFieldHeader: "Enter drug name or NDC number",
    searchDrugBtn: "Get price",
    searchField: "Search",
    clear: __isIOS ? "Clear text" : "clear",
    aspirinLow: "Aspirin Low Dose 81mg Ec Tab",
    enterAnAddressContentDes: "Enter a street address.*",
    searchIcon: "search_icon",
    findPharmacyLabel: "Find a pharmacy",
    findPharmacyBtn: "Find Pharmacy",
    searchInNetworkPharmaciesLabel: "Find an in-network pharmacy",
    addressLabel: "Enter an address",
    showingPharmaciesMsg: "Showing.*",
    currentLocationOption: "Use current location",

    // Common drug names (for testing)
    aspirinDrug: "Aspirin",
    mg30: "30MG",
    lipitorDrug: "Lipitor",
    metforminDrug: "Metformin",

    // ===== RESULTS =====
    resultsCount: "\\d+ results",
    pricingResultsTitle: "Pricing Results",
    pharmacyListLabel: "Pharmacy List",
    noResultsMessage: "No results found",
    noResultsDescription: "Try searching for a different drug name",

    // Drug card elements
    unavailableText: ": Unavailable",  // Android
    drugQuantity: "Quantity: \\d+",
    pharmacyPrice: "\\$[0-9,]+\\.\\d{2}",
    mailOrderPrice: "Mail order.*\\$[0-9,]+",
    retailPrice: "Retail.*\\$[0-9,]+",

    // Pharmacy options
    pharmacySelector: "Select pharmacy",
    mailOrderOption: "Mail order",
    retailOption: "Retail",

    // ===== FILTERS =====
    filterBtn: "Filters",
    quantityFilter: "Quantity",
    sortBy: "Sort by",

    // ===== BOTTOM TAB BAR =====
    homeTab: "Home",
    benefitsTab: "Benefits",
    benefitsTabValue: "Tab 1 of 4",
    claimsTab: "Claims",
    claimsTabValue: "Tab 2 of 4",
    drugPricingTab: "Drug Pricing",
    drugPricingTabValue: "Selected, Tab 3 of 4",
    providersTab: "Providers",
    providersTabValue: "Tab 4 of 4",

    // ===== COMMON =====
    loadingIndicator: "Loading.*",
    // orphan-cleanup: auto-added stub — VERIFY against real UI text
    comparePricesBtn: "Compare prices",
    // orphan-cleanup: auto-added stub — VERIFY against real UI text
    searchBtn: "Search pharmacies",

    // ===== ADDITIONAL SEARCH ACTIONS (Figma: drug_pricing) =====
    getDrugPriceBtn: "Get drug price",
    editDrugBtn: "Edit drug",
    editDrugDetails: "Edit drug details",
    requestDrugBtn: "Request drug",
    strength: "Strength",
    viewDrugOptionsBtn: "View drug options",
    aboutCVSCaremarkLink: "About CVS Caremark",
    callCustomerCareBtn: "Call customer care",

    // ===== EMPTY / LOADING STATES =====
    noCurrMedicationsMsg: "No current medications",
    noCurrMedicationsDescription: "No current medications to show",
    noNearbyPharmaciesWithNewPlan: "No nearby pharmacies with new plan",
    newPlanChangeLabel: "New plan change",

    // ===== MAINTENANCE CHOICE =====
    maintenanceChoiceLabel: "Maintenance Choice",
    maintenanceChoiceEligible: "Maintenance Choice eligible",
    maintenanceChoiceLimitMsg: "Your medication has exceeded the Maintenance Choice plan's 30-day refill limit.*",

    // ===== 100-DAY SUPPLY =====
    hundredDaySupplyMsg: "This medication is available for a 100 day supply based on your plan benefits.*",
};

// ============================================
// DRUG DETAILS SCREEN
// ============================================
output.benefits_drug_details = {
    // ===== HEADER =====
    backBtnId: __isIOS ? "UnifiedHeaderView" : "back_button",

    // ===== PRICING SECTION =====
    pricingTitle: "Pricing",
    mailOrderSection: "Mail order",
    mailOrderPrice: "\\$[0-9,]+\\.\\d{2}",
    retailSection: "Retail",
    retailPrice: "\\$[0-9,]+\\.\\d{2}",

    // Quantity selector
    quantityDropdown: "Select quantity",

    // ===== DRUG INFORMATION =====
    drugInfoTitle: "Drug information",
    genericName: "Generic name",
    brandName: "Brand name",
    drugClass: "Drug class",
    usedFor: "Used for",

    // ===== COVERAGE INFORMATION =====
    coverageTitle: "Coverage",
    coveredStatus: "Covered|Not covered",
    tierLabel: "Tier",
    tierValue: "Tier \\d+",
    quantityLimits: "Quantity limits apply",

    // ===== ALTERNATIVES =====
    alternativesTitle: "Lower-cost alternatives",

    // ===== ACTIONS =====
    findPharmacyBtn: "Find pharmacy",
    orderMailBtn: "Order by mail",
    saveBtn: "Save",
    shareBtn: "Share",


    // ===== DRUG PRICING DETAIL VARIANTS (iOS) =====
    planPaysLabel: "Plan pays",  // iOS
    yourPlanPaysAboutLabel: "Your plan pays about",  // iOS
    retail100DaySupplyLabel: "Retail + 100 Day Supply",  // iOS
    mailOrderWithoutCoverageLabel: "Mail Order + Without Coverage",  // iOS
    mailOrderFullCoverageLabel: "Mail Order + Full Coverage",  // iOS
};

// ============================================
// DRUG PRICE COMPARISON SCREEN (From Figma designs)
// ============================================
output.drug_price_comparison = {
    // ===== HEADER =====
    priceComparisonTitle: "Price comparison for .*",
    priceComparisonForDrug: "Price comparison for",
    comparePricesHeader: "Compare Prices",

    // ===== DRUG INFORMATION =====
    checkPlanCoverage: "Check the price of .*",
    dosageInfo: ".*mg.*|.*mcg.*",
    strengthInfo: ".*tablet.*|.*capsule.*",
    learnMyPayLink: "Learn my pay",
    editDetails: "Edit drug details",

    // ===== QUANTITY AND DOSAGE SELECTORS =====
    dosageLabel: ".*Dosage.*",
    dosageSelector: "Select dosage",
    quantitySelector: "Select quantity",
    daysSupply: ".*day supply.*|.*day.*",

    // ===== PHARMACY TYPE TABS =====
    mailOrderTab: "Mail order",
    mail: "Mail",
    retailTab: "Retail",
    pickupTab: "Pickup",
    specialtyMailOrder: "Specialty mail order",
    tabSelected: "Selected",

    // ===== PHARMACY CARDS =====
    pharmacyName: ".*Pharmacy.*|.*CVS.*|.*Walgreens.*|.*Walmart.*",
    pharmacyType: "mail|retail|pickup|specialty",
    pharmacyAddress: ".*Street.*|.*Blvd.*|.*Ave.*|.*Road.*|.*Dr.*",
    pharmacyCity: ".*,.*",
    pharmacyZip: "\\d{5}",
    pharmacyFullAddress: "\\d+.*,.*\\d{5}",
    pharmacyPhone: "\\d{3}-\\d{3}-\\d{4}",
    pharmacyDistance: "\\d+\\.\\d+ mi",

    // Pharmacy names (common)
    branchSpecialtyPharmacy: "Branch Specialty Pharmacy",
    cvsPharmacy: "CVS Pharmacy",
    walgreens: "Walgreens",
    walmart: "Walmart Pharmacy",
    riteAid: "Rite Aid",

    // ===== PRICING =====
    priceAmount: "\\$[0-9,]+\\.\\d{2}",
    priceLabel: "Price",
    yourPrice: "Your price",
    estimatedPrice: "Estimated price",
    pricingDetails: "Pricing details >",
    pricingDetailsLink: "Pricing details",
    viewPricingDetails: "View pricing details",

    // Price breakdown
    planPays: "Plan pays",
    youPay: "You pay",
    totalCost: "Total cost",
    retailCopay: "Retail copay",
    mailOrderCopay: "Mail order copay",

    // ===== INDICATORS AND BADGES =====
    providerMessagingRequired: "Provider messaging required",
    quantityLimitsApply: "Quantity limits may apply",
    stepTherapyRequired: "Step therapy may be required",
    preferredPharmacy: "Preferred",
    inNetwork: "In-network",
    outOfNetwork: "Out of network",

    // ===== FORMULARY ALTERNATIVES =====
    exploreCoveredAlternatives: "Explore covered alternatives",
    formularyAlternatives: ".*formulary alternative.*",
    formularyAlternativesCount: "\\d+ formulary alternative.*",
    lowerCostAlternatives: "Lower-cost alternatives",
    brandAlternative: "Brand alternative",

    // ===== ACTIONS =====
    whatNextButton: "What next if prescribed",
    showMorePharmacies: "Show next 5 pharmacies",
    showNext5: "Show next \\d+ pharmacies",
    loadMore: "Load more",
    seeAll: "See all",

    // ===== COVERAGE INFORMATION =====
    coverageStatus: "Covered|Not covered|Partially covered",
    tierInfo: "Tier \\d+.*",
    tier1: "Tier 1",
    tier2: "Tier 2",
    tier3: "Tier 3",
    tier4: "Tier 4",
    preferredBrand: "Preferred brand",
    nonPreferredBrand: "Non-preferred brand",
    preferredGeneric: "Preferred generic",
    nonPreferredGeneric: "Non-preferred generic",
    specialty: "Specialty",

    // ===== FILTERS AND SORTING =====
    filterButton: "Filter",
    sortButton: "Sort",
    distanceFilter: "Distance",
    priceFilter: "Price",
    sortByPrice: "Sort by price",
    sortByDistance: "Sort by distance",
    sortByName: "Sort by name",

    // ===== ERROR STATES =====
    noBenefits: "We couldn't find your drug pricing benefits",
    noCoverage: "This drug may not be covered",
    notCovered: "Not covered",
    noPricing: "Pricing unavailable",
    noPharmacies: "No pharmacies found",
    tryDifferentZip: "Try a different ZIP code",

    // ===== HELP AND INFORMATION =====
    helpIcon: "Help",
    infoIcon: "Information",
    tooltipIcon: "i",
    learnMore: "Learn more",
    viewDetails: "View details",
    viewDetailsContentDesIn: "View details for in.*",
    viewDetailsContentDesOut: "View details for ou.*",
    drugInformation: "Drug information",
    coverageInformation: "Coverage information",

    // ===== SPECIALTY DRUG SPECIFIC =====
    specialtyDrugIndicator: "Specialty drug",
    specialtyPharmacyRequired: "Specialty pharmacy required",
    callToOrder: "Call to order",
    contactSpecialtyPharmacy: "Contact specialty pharmacy",

    // ===== RETAIL90 SPECIFIC =====
    retail90: "Retail 90",
    retail90Eligible: "Retail 90 eligible",
    retail90DaySupply: "90-day supply",
    maintenanceChoice: "Maintenance choice",

    // ===== MCHOICE SPECIFIC =====
    mchoice: "Maintenance Choice",
    mchoiceEligible: "Maintenance Choice eligible",
    mchoicePharmacy: "Maintenance Choice pharmacy",

    // ===== COMMON UI ELEMENTS =====
    backButton: "Back",
    closeButton: "Close",
    cancelButton: "Cancel",
    doneButton: "Done",
    saveButton: "Save",
    shareButton: "Share",
    editButton: "Edit",

    // ===== LOADING STATES =====
    loading: "Loading",
    loadingPrices: "Loading prices",
    searchingPharmacies: "Searching pharmacies",
    calculatingPrices: "Calculating prices",

    // ===== BOTTOM SHEET / MODAL =====
    pricingDetailsModal: "Pricing details",
    pricingBreakdown: "Pricing breakdown",
    howPriceCalculated: "How this price is calculated",
    dismissModal: "Dismiss",

    // ===== FLEXPAY (Figma: drug_pricing) =====
    flexPayEligible: "FlexPay eligible",
    flexPayMember: "FlexPay member",
    flexPayDescriptionPattern: "FlexPay is a monthly payment plan.*",
    firstInstallmentLabel: "First installment",

    // ===== MEDICARE PRESCRIPTION PAYMENT PLAN =====
    medicarePrescriptionPlan: "Medicare Prescription Payment Plan",
    manageMedicarePlan: "Manage Medicare Prescription Payment Plan",
    aboutMedicarePlan: "About Medicare Prescription Payment Plan",
    medicarePlanLearnMore: "Learn more about your Medicare Prescription Payment Plan.",
    medicarePlanDescriptionPattern: "When you fill a prescription for a drug covered by Part D.*",
    medicareBillingNoticePattern: "Your estimated cost will be billed through the Medicare Prescription Payment Plan.*",
    medicareOptOutNoticePattern: "You're no longer opted in to the Medicare Prescription Payment Plan.*",
    medicareOptInNoticePattern: "It can take up to 24 hours for your opt-in.*",
    medicarePlanUpcomingPriceError: "Upcoming plan price isn't available at this time. Please try again later.",

    // ===== SPECIALTY PHARMACY PAGINATION (Figma: drug_pricing_sprx) =====
    specialtyPharmacyMail: "Specialty pharmacy mail",

    // ===== SAVINGS (Figma: ytd_spending cross-reference) =====
    payLessWithGenericPattern: "Pay less with the generic version of .*",
    payAsLittleAsPattern: "Pay as little as \\$[0-9,]+\\.\\d{2} with the generic version of .*",
    checkPriceGenericPattern: "Check the price of .*, the generic version of .*",
    checkPriceBrandPattern: "Check the price of .*, the brand-name version of .*",
};

// ============================================
// PHARMACY DETAILS MODAL (From Figma)
// ============================================
output.pharmacy_details = {
    // ===== PHARMACY INFO =====
    pharmacyName: ".*Pharmacy.*",
    additionalInfo: "Additional Information",
    pharmacyType: "Mail order|Retail|Pickup|Specialty",
    mailOrder: "Mail order",
    pharmacyDetails: "Pharmacy details",
    pickup: "Pickup.*",
    fullAddress: ".*",
    streetAddress: ".*Street.*|.*Blvd.*|.*Ave.*",
    cityStateZip: ".*,.*\\d{5}",
    phoneNumber: "\\d{3}-\\d{3}-\\d{4}",

    // ===== HOURS =====
    hoursLabel: "Hours",
    hoursInfo: ".*AM.*PM.*|.*24 hours.*",
    open24Hours: "Open 24 hours",
    closedNow: "Closed",
    openNow: "Open",

    // ===== PRICING BREAKDOWN =====
    pricingDetailsTitle: "Pricing details",
    drugCost: "Drug cost",
    planDiscount: "Plan discount",
    yourCopay: "Your copay",
    totalYouPay: "Total you pay",
    estimatedTotal: "Estimated total",

    // ===== ACTIONS =====
    getDirections: "Get directions",
    callPharmacy: "Call pharmacy",
    selectPharmacy: "Select pharmacy",
};

// ============================================
// FORMULARY ALTERNATIVES SCREEN (From Figma)
// ============================================
output.formulary_alternatives = {
    // ===== HEADER =====
    alternativesTitle: "Covered alternatives",
    alternativesFor: "Alternatives for .*",
    lowerCostOptions: "Lower-cost options",

    // ===== ALTERNATIVE CARDS =====
    drugType: "Generic|Brand",
    drugDosage: ".*mg.*|.*mcg.*",
    drugPrice: "\\$[0-9,]+\\.\\d{2}",
    savings: "Save \\$.*|.*% savings",
    tierInfo: "Tier \\d+",

    // ===== FILTERS =====
    showGenericOnly: "Generic only",
    showBrandOnly: "Brand only",
    showAll: "All alternatives",

    // ===== ACTIONS =====
    viewPrices: "View prices",
    comparePrices: "Compare Prices",
    backToDrug: "Back to .*",
};

// ============================================================================
// COMMON — auto-extracted (Phase B): properties shared verbatim across blocks
// ============================================================================
output.benefits_drug_pricing_common = {
    vaccineNetwork: "Vaccine network",
    independent: "Independent",
    vaccineNetwork: "Vaccine network",
    independent: "Independent",
    english: "English",
    resetBtn: __isIOS ? "Cancel" : "Reset to default",
    viewResultsBtn: __isIOS ? "Apply" : "View results",
    english: "English",
    resetBtn: __isIOS ? "Cancel" : "Reset to default",
    viewResultsBtn: __isIOS ? "Apply" : "View results",
    backBtn: "Back",
    closeBtn: "Close",
    drugDosage: "\\d+mg|\\d+mcg",
    drugName: ".*",
    genericAlternative: "Generic alternative",
    pharmacyTypeFilter: "Pharmacy type",
    languageFilter: "Languages.*",
    servicesFilter: "Services",
    priorAuthRequired: "Prior authorization required",
    quantityLabel: "Quantity",
    quantityValue: "\\d+",
    therapeuticAlternative: "Therapeutic alternative",
};
