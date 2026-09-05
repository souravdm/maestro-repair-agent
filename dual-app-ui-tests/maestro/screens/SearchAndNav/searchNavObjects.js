const __platform = maestro.platform.toLowerCase() === "ios" ? "ios" : "android";
const __isIOS = __platform === 'ios';

output.tab_btns_h100 = {
    forYouBtn: "For you.*",
    discoverBtn: "Discover"
}

output.searchnav_bottom = {
    homeBtn: "Home",
    pharmacyBtn: "Pharmacy",
    healthBtn: "Health",
    shopSaveBtn: "Shop & Save",
    menuBtn: "Menu",
    benefitsTab: "Benefits",
}

output.searchnav_bottom_pharmacy = {
    prescriptions: "Prescriptions",
    orders: "Orders",
    spending: "Spending",
    more: "More",
}

output.searchnav_bottom_benefits = {
    benefits: "Benefits",
    claims: "Claims",
    drugPricing: "Drug Pricing",
}

output.searchnav_secondary = {
    minuteClinicBtn: "MinuteClinic®",
    cvsPharmacyBtn: "CVS Pharmacy®",
    providedByLabel: "Provided by",
}

output.searchnav_secondary_tabs = {
    // Extracted from iOS UnifiedNavigation package
    benefitsTab: "Benefits",
    claimsTab: "Claims",
    coverageTab: "Coverage",
    drugPricingTab: "Drug Pricing",
    findCareTab: "Find Care",
    yourHealthTab: "Your Health",
    ordersTab: "Orders",
    prescriptionsTab: "Prescriptions",
    providersTab: "Providers",
    recordsTab: "Records",
    savingsTab: "Savings",
    shopSaveTab: "Shop & Save",
    spendingTab: "Spending",
    vaccineRecordsTab: "Vaccine Records",
    weeklyAdTab: "Weekly Ad",
}

output.searchnav_header = {
    accountBtn: "Account",
    notificationsBtn: "Notifications",
    signInBtn: "Sign In",
    inboxBtn: "Inbox.*|Messages",
    aiHealth: "AI Health Assistant",
    cartBtn: "Cart.*",
    searchText: "Search.*",
    searchOrAskQuestionText: "Search or ask a question",
    searchCvsOrAskQuestionText: "Search CVS or ask a question",
    findProductsAndServicesText: "Find products and services",
    searchForYourNeedsText: "Search for your needs",
    voiceSearchBtn: "Voice search",
    scanBarcodeBtn: "Scan barcode",
    unifiedHeaderViewId: "UnifiedHeaderView",
    cvsLogo: "CVS Logo",
    health100Logo: "Health 100 Logo",
    shoppingCart: "Shopping cart",
}

output.menu_screen = {
    menuTitle: "Menu",
    exploreMoreTitle: "Explore More.*",
    signInBtn: "Sign in",
    createAccountBtn: "Create an Account",
    pharmacyDashboardLnk: "Pharmacy Dashboard",
    pharmacySpendingTitle: "Pharmacy spending at your fingertips",
    pharmacySpendingDesc: "Quickly view your Rx costs and savings opportunities.",
    savingsAndMemberships: "Savings & Memberships",
    extracareSavingsLnk: "ExtraCare Savings",
    manageExtracareLnk: "Manage ExtraCare membership",
    weeklyAdLnk: "Weekly ad",
    weeklyAdMovedMsg: "Weekly Ad moved to new location",
    browseLnk: "Browse",
    scheduleCare: "Schedule care",
    photoLnk: "Photo",
    photoServicesLnk: "Photo services",
    myListsLnk: "My Lists",
    myShoppingListsLabel: "My Shopping Lists",
    minuteclinicLnk: "MinuteClinic",
    healthServicesLnk: "Health services",
    vaccinationsLnk: "Vaccinations",
    covid19Lnk: "COVID-19",
    healthRecordsLnk: "Health records",
    helpCenterLnk: "Help Center",
    supportAndFaqLnk: "Support & FAQ",
    feedbackLnk: "Feedback",
    sendFeedbackBtn: "Send Feedback",
    rateTheAppBtn: "Rate the App",
    termsAndPrivacyLnk: "Terms and privacy",
    appSettings: "App Settings",
    copyDeviceInfoBtn: "Copy Device Info",
    deviceInfoCopiedMsg: "Device Info Copied",
    findACvsStoreLnk: "Find a CVS Store",
    storeLocatorTitle: "Store Locator",
    filterBtn: "Filter",
    detailsLnk: "Details",
    directionsLnk: "Directions",
    callLnk: "Call",
    closeMenuBtn: __isIOS ? "Close" : "Close menu",
    closeMenuAltBtn: "Close menu",
    menuSheetHandle: "Menu sheet handle",
    expandBtn: "Expand",
    collapseBtn: "Collapse",
    menuHasMovedTip: "Menu has Moved",
    menuSwipeTip: "Access menu quickly with a swipe from left to right.",
    leavingCvsAppAlert: "Leaving CVS App",
    continueToCvsBtn: "Continue to CVS.com",
    thirdPartyDisclaimer: "For content hosted by a third party; once you select a card, you will be outside of our terms use and privacy policy.",
    importantInformation: "Important information",
    signInToStayUpdated: "Make sure you're signed in to your CVS account to stay updated on prescriptions, health info and more.",
}

output.explore_more_menu = {
    findCareBtn: "Find Care",
    scheduleCareLnk: "Schedule care",
    termsOfUse: "(?i).*(Terms of Use).*",
    takeControl: "Link your Google.*",
    privacyPolicy: "(?i).*(Privacy Policy).*",
    personalHealth: "(?i).*(Personal Health Records? Privacy Policy).*",
    scheduleVaccinesBtn: "Schedule vaccines",
    yourHealthBtn: "Your health",
    vaccineRecordsBtn: "Vaccine records",
    prescriptionsBtn: "Prescriptions",
    prescriptionsLabel: "(?i).*(Prescriptions|prescriptions).*",
    rxOrdersBtn: "Rx orders",
    scheduleCareBtn: "(?i).*(Schedule care).*",
    transferRxBtn: "Transfer Rx",
    uuid: "(?i).*(UUID:).*",
    chatWithPharmacyBtn: "Chat with pharmacy",
    extraCareSavingsBtn: "ExtraCare savings",
    shopOnlineBtn: "Shop online",
    photoBtn: "Photo",
    weeklyAdBtn: "Weekly Ad",
    findYourCVSStoreBtn: "Find your CVS store",
    feedbackBtn: "Feedback",
    supportAndFAQBtn: "Support & FAQ",
    copyDeviceInf: "Copy device info",
    termsAndPrivacyBtn: "Terms & Privacy",
    drugPricingSmall: "Drug pricing",
    findPharmacy: "Find a pharmacy",
    findAProvider: "Find a provider",
    benefitsSummaryBtn: "Benefits summary",
    claimsBtn: "Claims",
    drugPricingBtn: "Drug pricing",
    findAPharmacyBtn: "Find a pharmacy",
    findAProviderBtn: "Find a provider",
}

output.disclaimers_h100 = {
    poweredByAILabel: "Powered by AI and for informational purposes only.",
    learnAboutAIH100Lnk: "Learn about AI in Health100",
    health100AIInfoLabel: "Health100™ AI info",
    learnAboutAIDescription: "The AI-enabled assistant and related features can help you explore health topics,.*",
    restrictionsMayApplyLabel: "*Restrictions may apply to offers on this page.",
    viewOfferInfoDisclaimerLnk: "View offer info and disclaimers",
    importantInfoDiscLabel: "Important information and disclaimers",
    forFluVaxLabel: "FOR FLU VACCINE OFFER:",
    restrictionsApplyLabel: "Restrictions apply.*",
    cvsFluLnk: "CVS.com/flu",
    fluShotLabel: "Flu shots.*",
    scheduleFluShotLnk: "Schedule your flu shot",
    cashPayGLPLabel: "*FOR $49 CASH PAY TO SEE IF A GLP-1 IS RIGHT FOR YOU:",
    forVirtualWeightLossLabel: "*FOR $29 VIRTUAL WEIGHT LOSS CARE:",
    weightLossDisclaimer: "For weight loss related consultation only.*",
}

// ============================================
// SEARCH & NAVIGATE - FIGMA DESIGN
// Based on: figma.com/design/3Gy7zhKOxaluWRYYNsWndC
// ============================================

// Enterprise Search Access Point
output.search_access_point = {
    // Entry points from different screens
    searchIcon: "Search",
    searchButton: "Search",
    searchField: "Search.*",
    searchOrAskQuestion: "Search or ask a question",
    voiceSearchBtn: "Voice search",
    
    // Context-specific access points
    homeSearchEntry: "Search from Home",
    benefitsSearchEntry: "Search from Benefits",
    pharmacySearchEntry: "Search from Pharmacy",
    healthSearchEntry: "Search from Health",
}

// Search View Landing
output.search_landing = {
    // Search bar
    searchBar: "Search.*",
    searchPlaceholder: "Search or ask a question",
    searchInput: "id:searchInput",
    voiceSearchIcon: "id:voiceSearchIcon",
    clearSearchBtn: "id:clearSearchBtn",
    
    // Recent Searches section
    recentSearchesHeader: "Recent Searches",
    recentSearchesTitle: "Recent Searches",
    clearAllBtn: "Clear all",
    recentSearchItem: "id:recentSearchItem",
    recentSearchClock: "id:clockIcon",
    recentSearchDelete: "id:deleteIcon",
    
    // Search suggestions/categories
    suggestedSearches: "Suggested Searches",
    popularSearches: "Popular Searches",
    trendingSearches: "Trending Searches",
    
    // Quick links
    quickLinksSection: "Quick Links",
    findStoreLink: "Find a store",
    refillPrescriptionLink: "Refill prescription",
    scheduleVaccineLink: "Schedule vaccine",
    viewBenefitsLink: "View benefits",

    // Trending & Questions (from iOS extractor)
    trendingSection: "Trending",
    questionsSection: "Questions",
}

// Search Typeahead
output.search_typeahead = {
    // Typeahead container
    typeaheadContainer: "id:typeaheadContainer",
    typeaheadResults: "id:typeaheadResults",
    
    // Suggestion types
    productSuggestion: "id:productSuggestion",
    locationSuggestion: "id:locationSuggestion",
    serviceSuggestion: "id:serviceSuggestion",
    benefitSuggestion: "id:benefitSuggestion",
    
    // Suggestion categories
    productsCategory: "Products",
    storesCategory: "Stores",
    servicesCategory: "Services",
    benefitsCategory: "Benefits",
    healthCategory: "Health",
    
    // Suggestion item elements
    suggestionIcon: "id:suggestionIcon",
    suggestionTitle: "id:suggestionTitle",
    suggestionSubtitle: "id:suggestionSubtitle",
    suggestionArrow: "id:suggestionArrow",
}

// Search Results
output.search_results = {
    // Results header
    resultsHeader: "Search Results",
    resultsCount: "id:resultsCount",
    searchQuery: "id:searchQuery",
    
    // Filter and sort
    filterBtn: "Filter",
    sortBtn: "Sort",
    filterApplied: "id:filterApplied",
    sortApplied: "id:sortApplied",
    
    // Result types
    productResult: "id:productResult",
    storeResult: "id:storeResult",
    serviceResult: "id:serviceResult",
    benefitResult: "id:benefitResult",
    healthResult: "id:healthResult",
    
    // Result item elements
    resultImage: "id:resultImage",
    resultTitle: "id:resultTitle",
    resultDescription: "id:resultDescription",
    resultPrice: "id:resultPrice",
    resultRating: "id:resultRating",
    resultDistance: "id:resultDistance",
    
    // Result categories (from iOS extractor)
    bestMatchResult: "Best match result",
    otherRelevantResults: "Other relevant results",
    sponsoredLabel: "Sponsored",
    articlesCategory: "Articles",
    healthCareCategory: "Health care",
    photoCategory: "Photo",
    viewResultsByCategory: "View results by category",

    // No results
    noResultsMessage: "No results found",
    noResultsIcon: "id:noResultsIcon",
    noResultsSuggestions: "Try searching for:",
    restartYourSearchBtn: "Restart your search",

    // Pagination
    loadMoreBtn: "Load more",
    showingResults: "Showing.*results",
}

// Search Assistant (AI Search)
output.search_assistant = {
    // Assistant header
    assistantTitle: "Search Assistant",
    assistantIcon: "id:assistantIcon",
    
    // Chat interface
    chatContainer: "id:chatContainer",
    chatInput: "id:chatInput",
    chatPlaceholder: "Ask me anything",
    sendBtn: "id:sendBtn",
    voiceInputBtn: "id:voiceInputBtn",
    
    // Message types
    userMessage: "id:userMessage",
    assistantMessage: "id:assistantMessage",
    loadingMessage: "id:loadingMessage",
    
    // Suggested questions
    suggestedQuestions: "Suggested questions",
    questionChip: "id:questionChip",
    
    // Assistant responses
    responseCard: "id:responseCard",
    responseTitle: "id:responseTitle",
    responseContent: "id:responseContent",
    responseAction: "id:responseAction",
    
    // Context indicators
    healthContext: "Health context",
    benefitsContext: "Benefits context",
    pharmacyContext: "Pharmacy context",
}

// CMK Benefits Card in Search
output.search_benefits_card = {
    // Card container
    benefitsCard: "id:benefitsCard",
    benefitsCardTitle: "Your Benefits",
    
    // Card content
    caremarkLogo: "id:caremarkLogo",
    cvsCaremarkLogoText: "CVS Caremark logo",
    aetnaLogo: "id:aetnaLogo",
    benefitsLogo: "Benefits logo",
    yourBenefitsLogo: "Your benefits logo",
    memberIdLabel: "Member ID",
    memberIdValue: "id:memberIdValue",
    viewYourDeductiblesDesc: "View your deductibles, access your member ID and more.",
    viewingBenefitsEasier: "Viewing your benefits just got easier",
    quicklyViewPlanInfo: "Quickly view plan information like coverage, costs and more.",
    
    // Quick actions
    viewBenefitsBtn: "View Benefits",
    viewClaimsBtn: "View Claims",
    drugPricingBtn: "Drug Pricing",
    findProviderBtn: "Find Provider",
    providerSearchBtn: "Provider Search",

    // Card status
    cardExpanded: "id:cardExpanded",
    cardCollapsed: "id:cardCollapsed",
    expandBtn: "id:expandBtn",
    collapseBtn: "id:collapseBtn",
    dismissBenefitsDetails: "Dismiss benefits details",
    viewBenefitsDetails: "View benefits details",
}

// Search Navigation Context
output.search_context = {
    // Context indicators
    homeContext: "Home",
    pharmacyContext: "Pharmacy",
    benefitsContext: "Benefits",
    healthContext: "Health",
    shopContext: "Shop & Save",
    
    // Context-specific search
    searchInPharmacy: "Search in Pharmacy",
    searchInBenefits: "Search in Benefits",
    searchInHealth: "Search in Health",
    searchInShop: "Search in Shop",
    
    // Context breadcrumb
    breadcrumb: "id:breadcrumb",
    breadcrumbHome: "Home",
    breadcrumbCurrent: "id:breadcrumbCurrent",
}

// Search Filters
output.search_filters = {
    // Filter modal
    filterModal: "Filters",
    filterTitle: "Filter Results",
    applyFiltersBtn: "Apply Filters",
    clearFiltersBtn: "Clear All",
    closeFilterBtn: "Close",
    
    // Filter categories
    categoryFilter: "Category",
    priceFilter: "Price",
    locationFilter: "Location",
    availabilityFilter: "Availability",
    ratingFilter: "Rating",
    
    // Filter options
    filterOption: "id:filterOption",
    filterCheckbox: "id:filterCheckbox",
    filterRadio: "id:filterRadio",
    filterSlider: "id:filterSlider",
    
    // Active filters
    activeFilters: "id:activeFilters",
    filterChip: "id:filterChip",
    removeFilterBtn: "id:removeFilterBtn",
}

// Search Sort Options
output.search_sort = {
    // Sort modal
    sortModal: "Sort",
    sortTitle: "Sort Results",
    closeSortBtn: "Close",
    
    // Sort options
    relevanceSort: "Relevance",
    priceAscSort: "Price: Low to High",
    priceDescSort: "Price: High to Low",
    ratingSort: "Rating",
    distanceSort: "Distance",
    nameSort: "Name",
    
    // Sort indicator
    sortApplied: "id:sortApplied",
    sortLabel: "id:sortLabel",
}

// Health AI Integration
output.search_health_ai = {
    // Health AI entry
    healthAiBtn: "Health AI",
    healthAiIcon: "id:healthAiIcon",
    
    // Health topics
    diabetesCare: "Diabetes care",
    healthyWeight: "Healthy weight",
    gutHealth: "Gut health",
    quitSmoking: "Quit smoking",
    stressSleep: "Stress sleep",
    jointMusclePain: "Joint muscle pain",
    
    // Health AI card
    healthAiCard: "id:healthAiCard",
    healthTopicImage: "id:healthTopicImage",
    healthTopicTitle: "id:healthTopicTitle",
    checkCoverageBtn: "Check coverage CTA",
    providedByWellBridge: "Provided by WellBridge™",
    
    // Video content
    playIcon: "id:playIcon",
    pauseIcon: "id:pauseIcon",
    videoPlayer: "id:videoPlayer",
}

// Master Agent Landing
output.search_master_agent = {
    // Master agent
    masterAgentTitle: "Master agent landing",
    masterAgentHome: "home context",
    masterAgentBenefits: "benefits context",
    masterAgentHealth: "health context",
    
    // Sub agents
    healthSubAgent: "Health sub agent",
    benefitsSubAgent: "Benefits sub agent",
    pharmacySubAgent: "Pharmacy sub agent",
    schedulingSubAgent: "Scheduling sub agent",
    searchSubAgent: "Search sub agent",
    
    // Agent routing
    agentRouting: "id:agentRouting",
    switchAgentBtn: "id:switchAgentBtn",
}

// Search Error States
output.search_errors = {
    // Error messages
    searchError: "Something went wrong",
    noConnectionError: "No internet connection",
    timeoutError: "Search timed out",
    troubleConnecting: __isIOS ? "We're having trouble connecting you" : "We\\'re having trouble connecting you",
    troubleWithUpdates: "We're having trouble with your updates. Check back soon",
    loadingMsg: "Loading...",

    // Error actions
    retryBtn: "Retry",
    tryAgainBtn: "Try Again",
    goBackBtn: "Go Back",
    contactSupportBtn: "Contact Support",

    // Error icons
    errorIcon: "id:errorIcon",
    warningIcon: "id:warningIcon",
}

// ============================================
// VOICE SEARCH (from iOS extractor)
// ============================================
output.search_voice = {
    voiceSearchBtn: "Voice search",
    voiceSearchDesc: "Use your voice to search the CVS app.",
    listeningMsg: "Listening...",
    tellUsMsg: "Tell us what you're searching for",
    notRightMsg: "Not right? Tap here to try again",
    returnToManualSearchBtn: "Return to manual search",
    updateSettingsBtn: "Update Settings",
    maybeLaterBtn: "Maybe Later",
    micPermissionMsg: "To search with your voice, we need to access your microphone first.*",
    somethingWentWrongMsg: "Something went.*wrong",
    unsuccessfulMsg: "Your voice search was unsuccessful.",
    tryAgainBtn: "Try Again",
}

// ============================================
// HELP CENTER (from iOS extractor)
// ============================================
output.search_help_center = {
    helpCenterTitle: "Help Center",
    howCanWeHelpTitle: "How can we help?",
    contactUsTitle: "Contact us",
    searchHelpCenterField: "Search help center",
    popularQuestions: __isIOS ? "Popular questions" : "Popular Questions",
    faqSearchResultsTitle: "FAQ Search Results",
    noResultsFoundTitle: "No results found",
    showLessBtn: "Show less",
    showMoreBtn: "Show more",
    readLessBtn: "Read less",
    readMoreBtn: "Read more",
    enableAppleIntelligenceMsg: "Enable Apple Intelligence & Siri from your app settings so FAQ search can help you find the right answers.",
    gettingAnswersEasierMsg: "Getting answers just got easier",
    turnOnAppleIntelligenceMsg: "Turn on Apple Intelligence & Siri so FAQ search can better understand your questions.",
}

// ============================================
// NOTIFICATIONS (from iOS extractor)
// ============================================
output.menu_notifications = {
    notificationsTitle: "Notifications",
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
}
