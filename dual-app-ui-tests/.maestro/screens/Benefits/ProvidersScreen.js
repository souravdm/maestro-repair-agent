// ProvidersScreen.js
// Provider search and search pharmacy screens
// UPDATED 2026-05-20: Full audit against Flutter find_care presentation layer
//   Source: IOS/Submodule/packages/pharmacy/benefits/lib/src/features/find_care/presentation/
//   All string values verified against BenefitsLocalizations (benefits_en.arb)
const __platform = maestro.platform.toLowerCase() === "ios" ? "ios" : "android";
const __isIOS = __platform === 'ios';

// ============================================
// PROVIDERS LANDING SCREEN (Find Care Landing)
// Source: find_care_landing_page.dart
// ============================================
output.benefits_providers = {
    // ===== HEADER / APPBAR =====
    providersTitle: "Providers",                          // bottom-tab label
    termsOfUse: "Terms of use",
    providersHeader: "Provider Search",                  // AppBar title (provider_search)
    chatBtn: "Chat",
    chatBtnId: __isIOS ? "UnifiedHeaderView" : "chat_button",
    messagesBtn: "Messages",
    messagesBtnId: __isIOS ? "UnifiedHeaderView" : "messages_button",
    aiHealthAssistantBtn: "AI Health Assistant",         // Semantics label on HAIO button
    inboxBtn: "Inbox",                                   // Semantics label on bell icon
    viewProviderDetails: ".*View provider details.*",                                   // Semantics label on bell icon
    inboxUnreadPattern: "Inbox, .* unread",             // Semantics label when unread count > 0

    // ===== SEARCH SECTION =====
    searchField: "Name, specialty, procedure...",        // find_care_search_placeholder
    searchFieldSemantics: "Search by name, specialty, procedure, ... .", // Semantics label
    searchForProviderTitle: "Search for a provider",     // search_for_a_provider (common search page heading)
    searchBtn: "Search",                                 // search key

    // ===== LOCATION =====
    locationFieldSemantics: "location. Enter an address",  // Semantics on location PulseTextButton (no address set)
    locationCurrentSemantics: "location. Use current location", // Semantics when current location selected
    enterAddressPlaceholder: "Enter an address",         // enter_an_address
    useCurrentLocationBtn: "Use current location",       // user_current_location
    locationValidationMsg: "Enter a street address to continue", // location_validation
    getLocationBtn: "Get location",                      // get_location (popup menu)

    // ===== MEMBER DROPDOWN =====
    memberFilterSemantics: "filter, .* .*",             // Semantics label on member filter (pattern: "filter, <initial> <Name>")
    memberSelectedValue: "selected",                     // Semantics value when selected

    // ===== POPULAR / RECENT SEARCHES =====
    popularSearchesTitle: "Popular searches",            // popular_searches_title
    recentSearchesTitle: "Recent Searches",
    clearHistoryBtn: "Clear history",

    // ==== Popular search services ====
    dentists: "(?i).*(Dentists).*",
    orthodontics: "(?i).*(Orthodontists).*",
    endodontics: "(?i).*(Endodontists).*",

    deanFantMember: "(?i).*(Dean Fant).*",
    giselleFantMember: "(?i).*(Giselle Fant).*",

    addressButton: "(?i).*(address|location|directions).*",
    primaryCarePhysician: "(?i).*(Primary Care Physician).*",

    // ===== OTHER ELEMENTS =====
    connectionsLabel: "Connections",
    yourConnectionsLabel: "Your.*",
    viewRecordsBtn: "View records",
    addConnectionBtn: "Add connection",
    manageConnectionPermissions: "Manage connection permissions",
    addConnectionBtn: "Add connection",

    // ===== PROVIDER TYPE QUICK FILTERS =====
    doctorsBtn: "Doctors",
    hospitalsBtn: "Hospitals",
    urgentCareBtn: "Urgent care",
    specialistsBtn: "Specialists",

    // ===== FIND CARE LANDING =====
    findCareTitle: "Find care",                          // tab / nav title

    // ===== SEARCH RESULTS PAGE (PLV — Provider List View) =====
    // Source: find_care_provider_list_page.dart
    searchResultsTitle: "Search results",                // search_results (AppBar)
    inNetworkResultsPattern: "\\d+ in-network results", // "<N> in-network results"
    zeroInNetworkResults: "0 in-network results",
    searchResults: "PROVIDERS",                          // category type string for routing
    sortBtn: "Sort",                                     // sort
    learnMoreBtn: "Learn more",                          // learnMore
    learnMoreSemantics: "Learn more information",        // Semantics: "Learn more information"
    viewImpNoticeLink: "View important notice about participating providers", // view_imp_notice
    loadMoreBtn: "Show .* more providers",               // "Show <N> more providers" (show + more_providers)
    noResultsMsg: "No search results found",             // no_search_result
    noResultsDescription: "Try again using different keywords or filters.", // try_again

    // ===== COMMON SEARCH PAGE (specialty/procedure picker) =====
    noResultsShort: "No providers found",               // no_records_found
    checkSpellingMsg: "Check your spelling or search for another provider.", // check_your_spelling

    // ===== FILTERS =====
    filterBtn: "Filters",
    filterSemantics: "filter, .* .*",                  // same Semantics label as member filter (PLV)
    locationFilter: "Location",
    specialtyFilter: "Specialty",
    distanceFilter: "Distance",
    distanceLabel: "Distance",                          // sort/filter label shown in results (fixes TC008)
    acceptingNewPatientsFilter: "Accepting new patients",
    applyFilterBtn: "Apply filter",                     // apply_filter (member dropdown bottom sheet)

    // ===== MAP / LIST VIEW TOGGLE =====
    listViewBtn: "List view",
    mapViewBtn: "Map view",

    // ===== ERROR STATE =====
    errorHeading: "Something went wrong",               // somethingWentWrong
    errorBody: "It looks like we're having technical issues. Please try again in a few minutes.", // technicalIssue
    retryBtn: "Try again",

    // ===== PROVIDER TILE ELEMENTS (in PLV) =====
    // Source: widgets/provider_list_tile_widget.dart
    providerInNetworkLabel: "In-network",               // in_network (shown under avatar in tile)
    acceptingNewPatientsLabel: "Accepting new patients", // accepting_new_patients
    patientSeenPattern: "\\d+ patients seen in the last 6 months", // patients_seen
    distanceFromYouPattern: "\\d+ miles from you",      // miles_from_you
    wheelchairAccessibleLocationLabel: "Wheelchair accessible location", // wheelchair_accessible_location
    qualityEffectiveCareLabel: "Quality & effective care", // quality_effective_care
    viewProviderDetailsSemantics: "View provider details for .*", // view_provider_details + name
    viewGroupDetailsBtn: "View group details",           // view_group_details
    viewDetailsBtn: "View details",                      // view_details
    viewProviderBtn: "View Provider",                    // view_provider (arrow icon semanticLabel)
    moreOptionsSemantics: "More options for .*",         // more_options_for + name
    starRatingSemantics: ".* out of 5 stars.*",           // out_of_stars
    callProviderBtn: "Call .*",                          // "Call <phone>"
    viewProvidersMenuBtn: "View providers",              // view_providers (popup menu)
    networkChangeDatePattern: "As of .*",               // pdvAsOf + date (network status)
    warningLabel: "Warning",                            // warning (icon semantic label)

    // ===== BADGES / INDICATORS =====
    bestForYourPlanBadge: "Best for your plan",
    maximumSavingsBadge: "Maximum savings",
    newProviderBadge: "New",
    inNetworkBadge: "In-network",                       // in_network (badge chip in tile)

    // ===== VISIT TYPES =====
    virtualCareLabel: "Virtual care",
    virtualCareOnlyLabel: "Virtual care only",
    inPersonLabel: "In person",
    visitTypeLabel: "Visit type",
    virtualCareServiceLabel: "Virtual care service",

    // ===== ACCESSIBILITY =====
    wheelchairAccessibleLabel: "Wheelchair accessible",
    wheelchairAccessibleLocation: "Wheelchair accessible location",

    // ===== LEGAL / DIRECTORY =====
    importantNoticeLink: "Important notice about participating providers",
    directoryLastUpdatedPattern: "Directory last updated: .*",

    // ===== LANGUAGE =====
    languageAssistanceLabel: "Language assistance",
    languageSpokenLabel: "Language spoken",

    // ===== REPORT =====
    reportIncorrectInfoBtn: "Report incorrect provider info",
    reportIncorrectInfoShort: "Report incorrect info",

    // ===== QUALITY =====
    qualityAndEffectiveCareLabel: "Quality & effective care",
    boardCertifiedBadge: "Board certified",
    qualityDesignationsLabel: "Quality designations (IOE + IOQ)",
};

// ============================================
// SEARCH PHARMACY SCREEN
// (Accessed from Benefits landing page)
// ============================================
output.benefits_search_pharmacy = {
    // ===== HEADER =====
    pageTitle: "Find A Pharmacy",
    pageTitleId: __isIOS ? "UnifiedHeaderView" : "find_pharmacy_title",

    // ===== SEARCH SECTION =====
    searchTitle: __isIOS ? "Find an in-network pharmacy" : "Find in-network pharmacy",
    addressField: "Enter a street address",
    addressPlaceholder: "Street address, city, state, or ZIP",

    // Location button
    useCurrentLocationBtn: "Use current location",
    locationServicesIcon: "Location Services",
    locationIconId: "location.fill",

    // Search action
    searchPharmaciesBtn: "Search pharmacies",

    // ===== FILTERS SECTION =====
    filtersTitle: "Filters",

    // Services filter
    servicesFilter: "Filters by Services",
    servicesFilterValue: "0",
    servicesLabel: "Services",
    servicesDropdown: "dropdown-filled",

    // Pharmacy type filter
    pharmacyTypeFilter: "Filters by Pharmacy type",
    pharmacyTypeFilterValue: "0",
    pharmacyTypeLabel: "Pharmacy type",

    // Languages filter
    languagesFilter: "Filters by Languages spoken",
    languagesFilterValue: "0",
    languagesLabel: "Languages spoken",

    // ===== PHARMACY TYPE TABS =====
    retailTab: "Retail",
    retailTabValue: "1 of 2",
    mailTab: "Mail",
    mailTabValue: "2 of 2",

    // ===== RESULTS =====
    resultsCount: "Showing \\d+ retail pharmacies near",
    noResultsMessage: "Showing 0 retail pharmacies near",

    // Pharmacy card elements
    pharmacyName: "CVS Pharmacy|Walgreens|.*",
    pharmacyAddress: ".*",
    pharmacyDistance: "\\d+\\.\\d+ mi",
    pharmacyPhone: "\\(\\d{3}\\) \\d{3}-\\d{4}",
    openNowStatus: "Open now|Closes at.*",

    // Pharmacy services
    driveThru: "Drive-thru",
    delivery: "Delivery",
    hours24: "24 hours",
    immunizations: "Immunizations",

    // ===== DISCLAIMERS =====
    importantInfo: "Important information and disclaimers",
    disclaimerText: "CVS Caremark does not administer certain plan designs in all states.*",

    // ===== ACTIONS =====
    selectPharmacyBtn: "Select pharmacy",

    // ===== COMMON =====
    clearBtn: "Clear",
    applyFiltersBtn: "Apply filters",

    // ===== ANDROID-SPECIFIC =====
    unableToLoadPageDataMsg: "Information, Unable to load page data",
};

// ============================================
// PROVIDER DETAIL VIEW (PDV)
// Source: find_care_pdv_page.dart + all pdv/widgets/*.dart + pdv/widgets/pdv_common_widget.dart
// ============================================
output.benefits_provider_details = {
    // ===== APPBAR =====
    // AppBar title on PDV page is "Details" (details key)
    providerDetailsTitle: "Details",                     // details (AppBar title — replaces old stub value)
    backBtn: "Back",                                     // back (find_care_app_bar.dart)
    inboxBtn: "Inbox",                                   // inbox (PDV page header)
    inboxUnreadPattern: "Inbox, .* unread",

    // ===== PROVIDER AVATAR / IDENTITY =====
    // Source: pdv_user_details_widget.dart
    photoAvailableLabel: "Photo available",              // photo_available (Semantics label)
    photoUnavailableLabel: "Photo unavailable",          // photo_unavailable (Semantics label)
    inNetworkBadge: "(?s).*In-network.*",                 // pdvInNetwork (avatar badge caption; iOS a11y is "Photo of provider\nIn-network")
    inNetworkSemantics: "In-network",                    // in_network (checkmark Semantics label)
    starRatingSemantics: ".* out of 5 stars",           // out_of_stars

    // ===== CONTACT INFO SECTION =====
    // Source: pdv_contact_info_widget.dart
    contactInfoSection: "Contact info",                  // pdvContactInfo
    distanceFromYouPattern: ".*miles from you|.*from you.*", // pdvFromYou
    wheelchairAccessibleLocation: "Wheelchair accessible location", // pdvWheelchairAccessibleLoc
    providerPhone: "\\(\\d{3}\\) \\d{3}-\\d{4}",
    providerEmailLabel: "Provider email",                // pdvProviderEmail
    providerWebsite: "Provider website",                 // pdvProviderWebsite
    additionalLocations: "Additional locations",         // pdvAdditionalLoc
    viewProvidersBtn: "View providers",                  // pdvViewProviders (group/IPA multi-location)
    additionalLocDesc: "Select a location to view provider details for that location", // pdvLocDesc
    groupIpaBottomSheetTitle: "Group and IPA affiliations", // pdvGroupIpa
    groupIpaDescription: "This provider works with the following medical group.*", // group_ipa_affiliation_description

    // ===== ACCEPTING PATIENTS / NOTICE =====
    // Source: pdv_accept_new_patient_widget.dart
    acceptingNewPatients: "(?s).*Accepting new patients.*",  // accepting_new_patients (iOS card a11y is multi-line)
    patientSeenPattern: "\\d+ patients seen in the last 6 months", // patients_seen
    viewImpNoticeLink: "View important notice about participating providers", // view_imp_notice

    // ===== HOURS OF OPERATION =====
    // Source: pdv_common_widget.dart
    hoursSection: "Hours of operation",                  // pdvHoursOfOperation
    callToConfirmHours: "Call to confirm hours of operation", // pdvCallToConfirm
    closedLabel: "Closed",                               // hardcoded in dart

    // ===== EDUCATION / CERTIFICATIONS =====
    educationLabel: "Education",                         // pdvEducation
    boardCertificationsLabel: "Board Certifications",    // pdvCertification
    yearsExperienceLabel: "Years Experience",

    // ===== DEMOGRAPHICS =====
    genderLabel: "Gender",                               // pdvGender
    providerRaceLabel: "Provider's Race",                // pdvProviderRace
    providerEthnicityLabel: "Provider's Ethnicity",      // pdvProviderEthnicity

    // ===== LICENSES & IDs =====
    licensesAndIDsLabel: "Licenses & IDs",               // pdvLicenses
    providerIDPattern: "Provider ID: .*",                // pdvProviderId + value
    primaryCareIDPattern: "Primary care ID: .*",         // pdvPrimaryCareId + value
    npiIDPattern: "NPI ID: .*",                          // pdvNpiId + value
    caLicensePattern: "CA license #: .*",                // pdvCaLicense + value

    // ===== AFFILIATIONS =====
    affiliationsSection: "Affiliations",                 // pdvAffiliations (was incorrectly "Provider affiliations")
    hospitalAffiliationsLabel: "Hospital affiliations",  // pdvHospitalAff
    groupAndIPAAffiliationsLabel: "Group and IPA affiliations", // pdvGroupIpa (was incorrectly "Group & IPA affiliations")
    hospitalAffBottomSheetTitle: "Hospital Affiliation", // hospital_affiliation

    // ===== LANGUAGES =====
    languagesSpokenSection: "Languages Spoken",          // pdvLanguage
    providerLanguageRow: "Provider",                     // pdvProvider (language section row)
    officeStaffLanguageRow: "Office Staff",              // pdvStaffLang
    officeInterpreterRow: "Office Interpreter",          // pdvInterpreterLang

    // ===== CARE INFO =====
    careInfoSection: "Care Info",                        // pdvCareInfo
    wheelchairAccessibleRow: "Wheelchair accessible",    // pdvWheelchairCareInfo (row title)
    wheelchairAccessibilityDetails: "This location offers convenient access for wheelchairs and other wheeled vehicles.", // wheelchair_accessibility_details
    qualityEffectiveCare: "Quality & Effective Care",
    // ===== NETWORK STATUS =====
    networkChangeWarning: "Warning. As of .*",           // warning + pdvAsOf + date
    providerNoLongerText: "this provider is no longer in your network.*",
    willBeInNetworkText: "this provider will be in your network.*",

    // ===== OUT-OF-NETWORK MODAL =====
    // Source: pdv/widgets/out_of_network_widget.dart
    outOfNetworkHeading: "OUT OF NETWORK",               // out_of_network (modal heading, all caps)
    outOfNetworkDescription: "This doctor, facility or particular location is out of your health plan.*", // out_of_network_description
    continueViewProviderBtn: "Continue to view provider", // continue_view_provider
    backToResultsBtn: "Back to results",                 // back_to_results
    closeModalBtn: "(?i).*(Close).*",                   // close (modal close button Semantics)

    // ===== LEAVING APP DIALOG =====
    // Source: widgets/leaving_cvs_dialog.dart
    leavingCVSAppTitle: "Leaving CVS app",               // leaving_cvs
    leavingH100AppTitle: "Leaving Health100 app",        // leavingcvsh100
    leavingAppDescription: "By clicking this link, you are leaving our app.*",
    cancelBtn: "Cancel",                                 // cancel
    continueBtn: "Continue",                             // continueButtonLabel

    // ===== PROVIDER TABS (My Providers screen) =====
    myProvidersTab: "My Providers",
    savedTab: "Saved",
    recentTab: "Recent",

    // ===== MY PROVIDERS SCREEN =====
    myProvidersTitle: "My Providers",
    editBtn: "Edit",
    removeBtn: "Remove",
    recentProvidersTitle: "Recent Providers",
    clearRecentBtn: "Clear Recent",
    noRecentProvidersMsg: "No Recent Providers",
    noRecentProvidersText: "No recent providers message",
    noSavedProvidersMsg: "No Saved Providers",
    noSavedProvidersText: "No saved providers message",
    findProvidersBtn: "Find Providers",

    // ===== ACTIONS =====
    bookAppointmentBtn: "Book appointment|Book Appointment",
    shareBtn: "Share",
    saveProviderBtn: "Save provider",
    removeProviderBtn: "Remove provider",
    favoriteBtn: "Favorite",
    callOfficeBtn: "Call Office",
    getDirectionsBtn: "Get Directions",

    // ===== RATINGS & REVIEWS (deprecated in source — verify before use) =====
    reviewsSection: "Reviews",                           // reviews (marked @Deprecated in source)
    readAllReviewsBtn: "Read all reviews",               // read_all_reviews
    ratingsAndReviewsSection: "Ratings & Reviews",
    overviewTab: "Overview",
    locationsTab: "Locations",
    reviewsTab: "Reviews",
    insuranceTab: "Insurance",
    mostHelpfulOption: "Most Helpful",
    mostRecentOption: "Most Recent",
    reviewTextLabel: "Review Text",
    helpfulLabel: "Helpful",

    // ===== INSURANCE / COVERAGE =====
    otherPlansLabel: "Other Plans",
    coverageDetailsLabel: "Coverage Details",
    outOfNetworkLabel: "Out of network",                 // tile badge (lowercase, different from modal)
    outOfNetworkBadge: "Out of network",
    estimatedCostsLabel: "Estimated Costs",
    deductibleAppliesLabel: "Deductible Applies",
    coinsuranceLabel: "Coinsurance",
    verifyBenefitsBtn: "Verify Benefits",
    contactInsuranceBtn: "Contact Insurance",
    disclaimerLabel: "Disclaimer",
    disclaimerTextLabel: "Disclaimer text",

    // ===== APPOINTMENT BOOKING =====
    appointmentTypeLabel: "Appointment Type",
    telehealthLabel: "Telehealth",
    videoVisitOption: "Video Visit",
    phoneVisitOption: "Phone Visit",
    visitTypeLabel: "Visit Type",
    videoVisitsOption: "Video Visits",
    phoneVisitsOption: "Phone Visits",
    visitReasonLabel: "Visit Reason",
    commonReasonsTitle: "Common Reasons",
    followUpReason: "Follow Up",
    medicationRefillReason: "Medication Refill",
    selectDateLabel: "Select Date",
    todayOption: "Today",
    tomorrowOption: "Tomorrow",
    nextAvailableOption: "Next Available",
    afternoonOption: "Afternoon",
    eveningOption: "Evening",
    timeSlotLabel: "Time Slot",
    useBenefitsInfoLabel: "Use Benefits Info",
    insurancePlanLabel: "Insurance Plan",
    memberIdLabel: "Member ID",
    confirmAppointmentTitle: "Confirm Appointment",
    requestAppointmentBtn: "Request Appointment",

    // ===== FILTERS (filter bottom sheet) =====
    languagesLabel: "Languages",
    englishOption: "English",
    spanishOption: "Spanish",
    chineseOption: "Chinese",
    ratingsLabel: "Ratings",
    fourPlusStarsOption: "4+ Stars",
    femaleOption: "Female",
    maleOption: "Male",
    within5MilesOption: "Within 5 miles",

    // ===== SPECIALTIES =====
    urgentCareSpecialty: "Urgent Care",
    hospitalSpecialty: "Hospital",
    dentistSpecialty: "Dentist",
    primaryCarePhysicianSpecialty: "Primary Care Physician",
    dermatologySpecialty: "Dermatology",
    phonecianPrimaryCare: "(?i).*Phoenician Primary Care.*",
    optumPrimaryCare: "(?i).*Optum Primary Care.*",
    psychiatrySpecialty: "Psychiatry",
    mentalHealthSpecialty: "Mental Health",
    psychologySpecialty: "Psychology",


    // ===== MAP VIEW =====
    zoomInBtn: "Zoom In",
    zoomOutBtn: "Zoom Out",
    myLocationBtn: "My Location",
    providerMarkerBtn: "Provider Marker",
    redoSearchBtn: "Redo Search",

    // ===== PROVIDER DETAIL SECTIONS (additional) =====
    primaryLocationLabel: "Primary Location",
    additionalLocationsLabel: "Additional Locations",
    availabilityLabel: "Availability in the next 4 weeks",
    careChampionLabel: "Care champion",
    minuteClinicLabel: "MinuteClinic",
    noticeAboutEstimatedCosts: "Notice about estimated costs",

    // ===== FACILITY TYPES =====
    ambulatoryCareCenterType: "Ambulatory care center",
    ambulatorySurgicalCenterType: "Ambulatory surgical center",
    telehealthAvailable: "Telehealth Available",
    providerNameLabel: "Provider Name",
};

// ============================================
// BOTTOM SHEETS
// Source: bottom_sheet_customizations/*.dart + member_drop_down_bottom_sheet.dart
// ============================================
output.benefits_providers_sheets = {
    // ===== SHARED =====
    closeBtn: "Close",                                   // close

    // ===== MEMBER DROPDOWN =====
    membersSheetTitle: "Members",                        // members
    applyFilterBtn: "Apply filter",                      // apply_filter

    // ===== HOSPITAL AFFILIATION =====
    hospitalAffSheetTitle: "Hospital Affiliation",       // hospital_affiliation

    // ===== GROUP & IPA =====
    groupIpaSheetTitle: "Group and IPA affiliations",    // pdvGroupIpa
    viewDetailsBtn: "View details",                      // view_address

    // ===== OFFICE STAFF / INTERPRETER LANGUAGES =====
    officeStaffSheetTitle: "Office Staff",               // office_staff
    officeInterpreterSheetTitle: "Office Interpreter",   // office_interpreter
    languageSpokenSubheading: "Language Spoken",         // language_spoken

    // ===== FACILITY SERVICES =====
    facilityServiceSheetTitle: "Facility  Service",      // facility_service (note: double space matches ARB)

    // ===== PROCEDURE DETAIL =====
    procedureDetailSheetTitle: "Procedure Detail",       // procedure_detail

    // ===== WHEELCHAIR =====
    wheelchairSheetTitle: "Wheelchair accessible",       // pdvWheelchairCareInfo
    wheelchairDetail: "This location offers convenient access for wheelchairs and other wheeled vehicles.", // wheelchair_accessibility_details

    // ===== QUALITY & EFFECTIVE CARE =====
    qualityEffectiveDetail: "Physicians and other providers who exceed quality and effectiveness measures under our Aetna Smart Compare.*",

    // ===== ADDITIONAL LOCATIONS =====
    additionalLocSheetTitle: "Additional locations",     // pdvAdditionalLoc
    additionalLocDesc: "Select a location to view provider details for that location", // pdvLocDesc
    fromYouHardcoded: "from you",                        // hardcoded in address_location_bottom_sheet.dart

    // ===== PROVIDER WEBSITE =====
    providerWebsiteSheetTitle: "Provider website",       // pdvProviderWebsite
};

// ============================================================================
// COMMON — shared across landing, PLV, PDV
// ============================================================================
output.benefits_providers_common = {
    acceptingNewPatients: "Accepting new patients",      // accepting_new_patients
    backBtn: "Back",                                     // back
    backBtnId: __isIOS ? "UnifiedHeaderView" : "back_button",
    callBtn: "Call",                                     // call
    closeBtn: "Close",                                   // close
    directionsBtn: "Get directions",
    inNetworkBadge: "In-network",                        // in_network
    loadingIndicator: "Loading.*",
    providerAddress: ".*",
    providerName: ".*",
    providerPhone: "\\(\\d{3}\\) \\d{3}-\\d{4}",
    providerSpecialty: ".*",

    // ===== BOTTOM TAB BAR =====
    homeTab: "Home",
    benefitsTab: "Benefits",
    benefitsTabValue: "Tab 1 of 4",
    claimsTab: "Claims",
    claimsTabValue: "Tab 2 of 4",
    drugPricingTab: "Drug Pricing",
    drugPricingTabValue: "Tab 3 of 4",
    providersTab: "Providers",
    providersTabValue: "Selected, Tab 4 of 4",
};
