const __platform = maestro.platform.toLowerCase() === "ios" ? "ios" : "android";
const __isIOS = __platform === 'ios';

output.snapp_search = {
    // Home Search Elements
    homeSearchField: "id:homeSearchField",
    homeSearchBackButton: "id:homeSearchBackButton",
    searchCancelButton: "id:searchCancelButton",
    searchTextField: "id:searchTextField",
    clearAllButton: "id:clearAllButton",

    // Product Display Elements
    productName: "id:productName",
    productSKU: "id:productSKU",
    addToShippingButton: "id:addToShippingButton",
    addToPickupButton: "id:addToPickupButton",

    // Inventory Status Messages
    instoreOnlyMessage: "In Store Only",
    outOfStockMessage: "Out of Stock",
    pickupOnlyMessage: "Pickup Only",
    shippingAvailableMessage: "Available for Shipping",
    noResultsFoundMessage: "No results found",

    // Search Results & History
    searchResultsList: "id:searchResultsList",
    trendingSearchSection: "id:trendingSearchSection",
    recentSearchesSection: "id:recentSearchesSection",
    clearSearchHistoryButton: "id:clearSearchHistoryButton",

    // Service Elements
    pharmacyOrderStatusButton: "Pharmacy and order status",
    phrButton: "PHR",
    minuteClinicButton: "Minute Clinic",

    // KickStarter Campaign Elements
    scheduleAVaccineButton: "Schedule a vaccine",
    seeMyPharmacyHoursButton: "See my pharmacy hours",
    checkRxOrderStatusButton: "Check Rx order status",
    editMyProfileButton: "Edit my profile",
    viewMyCouponsButton: "View my coupons",
    refillAPrescription: "Refill a prescription",

    // Filter Elements
    filterByButton: "id:filterByButton",
};

output.snapp_navigation = {
    // Tab Navigation
    homeTab: "id:homeTab",
    shopTab: "id:shopTab",
    accountTab: "id:accountTab",
    menuTab: "id:menuTab",

    // Secondary Navigation Elements
    secondaryNavBar: "id:secondaryNavBar",
    secondaryNavBarItem: "id:secondaryNavBarItem",
    secondaryNavBarButton: "SecondaryNavView",

    // Help Center Elements
    helpCenterLabel: "Help Center",
    settingsButton: "Settings",
    aboutButton: "About",
    helpCenterPopularQuestionsSection: "id:helpCenterPopularQuestionsSection",
    helpCenterHowCanWeHelpSection: "id:helpCenterHowCanWeHelpSection",
    helpCenterPopularQuestionsNavigation: "id:helpCenterPopularQuestionsNavigation",
    helpCenterHowCanWeHelpNavigation: "id:helpCenterHowCanWeHelpNavigation",

    // Help Center - Generic Elements
    addButton: "Add",
    removeButton: "Remove",
    viewOrdersButton: "View orders",
    viewRewardsButton: "View rewards",
    goToCouponsRewardsButton: "Go to Coupons & Rewards",
    viewPrescriptionsButton: "View prescriptions",
    addAndManagePeopleButton: "Add and manage people",
    scheduleAVaccineButton: "Schedule a vaccine",
    faqsButton: "FAQs",
    contactUsButton: "Contact us",
    emergencyMessage: "If you are experiencing a medical crisis, please call 911 or contact your local emergency assistance immediately.",
    customerServicesLabel: "CVS/pharmacy Customer Services",
    customerSpecialtyServicesLabel: "CVS Specialty Customer Services",
    phoneLabel: "Phone",
    emailLabel: "Email",
    emailUsButton: "Email us",
    termsOfUseButton: "terms of use and privacy policy",
    termsOfUseLabel: "CVS.com | Terms of Use",
    returnToCVSAppButton: "Return to CVS Health",

    // Help Center - Popular Questions Section
    helpCenterPopularQuestionsTitle: "Popular Questions",
    howDoIViewPrescriptionHistoryLabel: "How do I view my prescription history?",
    howDoIScheduleNewVaxApptLabel: "How do I schedule a new vaccine appointment?",
    howDoIViewPharmacyOrderStatusLabel: "How do I view my pharmacy order status?",
    howDoIManageChildsPrescriptionLabel: "How do I manage my child’s prescriptions?",
    howDoIUseExtraBucksRewardsLabel: "How do I use my ExtraBucks Rewards?",

    // Help Center - How Can We Help? Section
    helpCenterHowCanWeHelpTitle: "How can we help?",
    helpCenterShoppingOrdersFaqTitle: "Shopping & Orders",
    helpCenterAccountFaqTitle: "Account",
    helpCenterCouponsRewardsFaqTitle: "Coupons & Rewards",
    helpCenterPrescriptionsFaqTitle: "Prescriptions",
    helpCenterAppointmentsHealthRecordsFaqTitle: "Appointments & Health Records",

    // Help Center - Shopping & Orders FAQs Section
    helpCenterShoppingOrdersFaqsLabel: "Shopping & Orders FAQs",
    readOurReturnPolicyButton: "Read our return policy",
    returnPolicyLabel: "Return Policy",
    howDoIViewPickupOrderStatusButton: "How do I view my pickup order status?",
    howDoIViewMySameDayDeliberyStatusButton: "How do I view my same-day delivery status?",
    howDoICancelInStoreRetailPickupOrderButton: "How do I cancel an in-store retail pickup order?",
    howDoIReportDamagedProductButton: "How do I report a damaged product?",
    whatIsReturnPolicyNonPrescripButton: "What is your return policy for non-prescription purchases?",
    howDoIRequestReturnButton: "How do I request a return?",
    howDoIApplyECouponToMyOrderButton: "How do I apply an e-coupon to my order?",

    // Help Center - Account FAQs Section
    helpCenterAccountFaqsLabel: "Account FAQs",
    whyShouldCreateAccountButton: "Why should I create an account?",
    whatDoIDoIfForgotPasswordButton: "What do I do if I forgot my password?",
    whatDoIDoForgotUsernameButton: "What do I do if I forgot my username?",
    howDoIUpdatePasswordButton: "How do I update my password?",
    howDoIUpdateAddressButton: "How do I update my address?",
    howDoIUpdatePhoneNumButton: "How do I update my phone number?",
    howDoIViewOrderHistoryButton: "How do I view my order history?",
    createAccountButton: "Create account",
    resetPasswordButton: "Reset password",
    signInButton: "Sign in",
    changePasswordButton: "Change password",
    updateAddressButton: "Update address",
    managePhoneNumbersButton: "Manage phone numbers",
    viewPurchaseHistButton: "View purchase history",

    // Help Center - Coupons & Rewards FAQs Section
    helpCenterCouponsRewardsFaqsLabel: "Coupons & Rewards FAQs",
    howDoIGetExtraBucksRewardsButton: "How do I get ExtraBucks Rewards?",
    howDoIUseExtraBucksRewardsButton: "How do I use my ExtraBucks Rewards?",
    extraBucksCouponNotWorkingButton: "My ExtraBucks Rewards coupon isn’t working. Can you help?",
    shopNowButton: "Shop now",

    // Help Center - Prescriptions FAQs Section
    helpCenterPrescriptionsFaqsLabel: "Prescriptions FAQs",
    howDoIViewPrescripHistoryButton: "How do I view my prescription history?",
    howDoIViewPharmacyOrderStatusButton: "How do I view my pharmacy order status?",
    canIRequestPrescriptionOrderStatusButton: "Can I request a prescription delivery from the app?",
    howDoIChangePickupLocationButton: "How do I change my pickup location?",
    whatShouldIDoIfICantFindOrderButton: "What should I do if I can't find my order?",
    howDoIaddPrescriptionManagementButton: "How do I add prescription management?",
    howDoIManageChildsPrescripButton: "How do I manage my child’s prescriptions?",
    canIManageAnotherAdultsPrescripButton: "Can I manage another adult’s prescriptions?",
    updateOrderButton: "Update order",
    connectPrescriptionsButton: "Connect prescriptions",

    // Help Center - Appointments & Health Records FAQs Section
    helpCenterApptsHealthRecordsFaqsLabel: "Appointments & Health Records FAQs",
    whereCanISeeUpcomingVisitsButton: "Where can I see my upcoming visits?",
    howDoIScheduleMCVisitButton: "How do I schedule a MinuteClinic visit?",
    howDoIScheduleNewVaxApptButton: "How do I schedule a new vaccine appointment?",
    howDoIFindAMinuteClinicButton: "How do I find a MinuteClinic?",
    howDoICancelMCApptButton: "How do I cancel a MinuteClinic appointment?",
    whereCanIFindHealthRecordsButton: "Where can I find my health records?",
    whatShouldIDoIfRecordIsIncorrectButton: "What should I do if a record is incorrect?",
    whyCantIMessageMyProviderButton: "Why can’t I message my provider?",
    whatShouldIDoIfIDontSeeMyRecordButton: "What should I do if I don’t see my record? ",
    whereCanIFindLettersButton: "Where can I find letters like sick and work notes?",
    howDoIAddFamMemberToViewButton: "How do I add a family member to my view?",
    whatShouldIDoIfPrefMCLocationNotAvailableButton: "What should I do if my preferred MinuteClinic location is not listed or is unavailable?",
    viewOrManageVisitButton: "View or manage your visit",
    scheduleAVisitButton: "Schedule a visit",
    findAStoreButton: "Find a store",
    reviewYourVisitDetailsButton: "Review your visit details",
    goToYourHealthButton: "Go to Your Health",

    // Counsel Health Secondary Nav Elements
    careConsultLabel: "Care Consult",

    // Account Elements
    accountTabMenu: "id:accountTabMenu",
    counselHealthButton: "Counsel Health",

    // Authentication Messages
    welcomeMessage: "Welcome",
    signInToViewOrdersMessage: "Sign In to view orders",
    yourOrdersMessage: "Your Orders",

    // Help Center Messages
    popularQuestionsText: "Popular Questions",
    howCanWeHelpText: "How Can We Help",
    questionDetailsText: "Question Details",
    helpTopicText: "Help Topic",
    shoppingOrdersFaqText: "Shopping & Orders",
    accountFaqText: "Account",
    couponsRewardsFaqText: "Coupons & Rewards",
    prescriptionsFaqText: "Prescriptions",
    appointmentsHealthRecordsFaqText: "Appointments & Health Records",

    // Service Messages
    counselHealthServicesText: "Counsel Health Services",
    findCareText: "Find Care",
    summerEssentialsText: "Summer Essentials",
    colgateProductsText: "Colgate Products",
    allergyProductsText: "Allergy Products",
    coughProductsText: "Cough Products",
    utiProductsText: "UTI Products",
};
