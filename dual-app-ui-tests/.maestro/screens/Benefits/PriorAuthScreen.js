// PriorAuthScreen.js
// Prior Authorizations list and details screens
// UPDATED 2026-04-20: Based on real simulator captures
const __platform = maestro.platform.toLowerCase() === "ios" ? "ios" : "android";
const __isIOS = __platform === 'ios';

// ============================================
// PRIOR AUTHORIZATIONS LIST SCREEN
// ============================================
output.benefits_prior_auth = {
    // ===== HEADER =====
    pageTitle: __isIOS ?"Prior Authorizations" : "Prior authorizations",
    pageTitleId: __isIOS ? "UnifiedHeaderView" : "prior_auth_title",
    medicalPriorAuthTab: "Medical",

    // ===== PAGE CONTENT =====
    priorAuthListTitle: "Your prior authorizations",

    // ===== PRIOR AUTH CARD =====
    priorAuthCard: "Provider: .*, Primary compound: .*, Account owner: .*, Requested on .*",

    // Provider section
    providerLabel: "Provider:",
    providerName: "Aetna|CVS Caremark|.*",
    aetnaProvider: "Aetna",
    caremarkProvider: "CVS Caremark",

    // Primary compound/medication
    primaryCompoundLabel: "Primary compound:",
    primaryCompoundName: ".*",
    medicationName: "John Brennan|.*",

    // Account owner
    accountOwnerLabel: "Account owner:",
    accountOwnerName: "Dean|.*",
    accountOwnerAvatar: "D, Dean",
    accountOwnerInitial: "D",

    // Request date
    requestedLabel: "Requested on",

    // Status
    statusApproved: "Approved",
    statusPending: "Pending",
    statusDenied: "Denied",
    pendingSelection: __isIOS ? "New|Processing - Paused" : "(?i).*New.*Pend.*|(?i).*Processing.*Paused.*",
    deniedSelection: "(?i).*(Denied).*",
    approvedSelection: "(?i).*(Approved).*",
    deniedOptions: "(?i).*(Denied|denied|not approved|declined).*",
    pendingOrInReview: "(?i).*(Aetna).*",
    detailsOrAuthorization: "(?i).*(Details|details|authorization).*",
    deniedReasons: "(?i).*(Denied|reason|why|explanation|why denied).*",



    // ===== FILTERS =====
    filterBtn: "Filter",
    sortBtn: "Sort",
    searchField: "Search prior authorizations",

    // Filter options
    statusFilter: "Status",
    providerFilter: "Provider",
    dateFilter: "Date",

    // ===== EMPTY STATE =====
    noPriorAuthMessage: "No prior authorizations found",
    noPriorAuthDescription: "You don't have any prior authorization requests",

    // ===== ACTIONS & LINKS =====
    seeStatusDetailsLink: "See status details",
    seeStatusDetailsBtn: "See Status Details",
    viewDetailsLink : __isIOS ? "View details" : "CVS Caremark.*",
    authorizationDetailsTitle: "Authorization details",
    medicationLabel: "Medication",
    priorAuthLogo: "Prior Auth Logo",
    learnHowPriorAuthWorksBtn: "(?i).*(Learn how prior authorization works).*",
    howDoesPriorAuthWorkTitle: "How does prior authorization work?",
    priorAuthMessageLabel: "Prior authorization checks to see.*",
    prescriptionAuthForLabel: "Prescription Auth For",

    // ===== STATUS BADGES (complete set from Figma: prior_auth + prior_auth_aetna) =====
    appealPendingStatus: "Appeal pending",
    authExpiringSoonStatus: "Auth Expiring Soon",
    expiringSoonStatus: "Expiring soon",
    responseNeededStatus: "Response needed",
    statusUnavailableStatus: "Status unavailable",
    underReviewStatus: "Under review",
    expiredStatus: "Expired",
    initiatedStatus: "Initiated",
    cancelledStatus: "Cancelled",
    processingStatus: "Processing",
    processingPausedStatus: "Processing – paused",
    partiallyApprovedStatus: "Partially approved",
    noActionNeededStatus: "No action needed",
    submittedStatus: "Submitted",

    // ===== EMPTY STATES =====
    noPriorAuthsText: "There are no prior authorizations.",
    noPriorAuthsMsg: "No prior authorizations",

    // ===== FIELD LABELS =====
    authorizationIdLabel: "Authorization ID:",
    daysPattern: "Days: .*",
    inPersonLabel: "In-person",
    virtualLabel: "Virtual",

    // ===== PAGINATION =====
    loadMorePriorAuthsBtn: "Load more prior authorizations",
    showPastPriorAuthsBtn: "Show past prior authorizations",

    // ===== ACTIONS =====
    contactMemberServicesBtn: "Contact member services",
    contactYourPrescriberBtn: "Contact your prescriber",

    // ===== HELP / INFO =====
    helpCenterLink: "Help Center",
    helpCenterDescription: "Get answers to common questions about prior authorizations and benefits.",
    howDoesPriorAuthWorkLink: "How does prior authorization work?",
    priorAuthDefinitionPattern: "Prior authorization checks to see whether your plan covers a service or medication before you receive it.*",
    authExpiringNoticePattern: "The prior authorization for .* is about to expire.*",

    // ===== COMMON =====
    loadingIndicator: "Loading.*",

    // ===== ADDITIONAL DETAIL ELEMENTS (iOS) =====
    priorAuthorizationTitle: "Prior Authorization",  // iOS
    allMonthsFilter: "All months",  // iOS
    last6MonthsFilter: "Last 6 months",  // iOS
    approvedDateLabel: "Approved date:",  // iOS
    contactedDateLabel: "Contacted date:",  // iOS
    deniedDateLabel: "Denied date:",  // iOS
    caseNumberLabel: "Authorization ID:",  // iOS
    emailLabel: "Email:",  // iOS
    phoneNumberLabel: "Phone number:",  // iOS
    prescriberLabel: "Prescriber:",  // iOS
    callNumberAlert: "Do you want to call this number?",  // iOS
    emailAddressAlert: "Do you want to email this address?",  // iOS
};

// ============================================
// PRIOR AUTH DETAILS SCREEN
// ============================================
output.benefits_prior_auth_details = {
    // ===== HEADER =====
    pageTitle: "Prior Authorization Details",

    // ===== STATUS SECTION =====
    statusSection: "Status",
    statusMessage: "Your prior authorization has been.*",
    statusDate: "Status as of.*",

    // ===== REQUEST DETAILS =====
    requestDetailsSection: "Request details",

    // Provider info
    providerLabel: "Provider",
    providerName: ".*",

    // Member info
    memberLabel: "Member",
    memberName: ".*",
    accountOwner: "Account owner",

    // Medication/procedure
    medicationLabel: "Medication|Procedure",
    medicationName: ".*",
    primaryCompound: "Primary compound",

    // Dates
    submittedLabel: "Submitted",
    caseNumberLabel: "Authorization ID:",
    requestedDateLabel: "Requested",
    approvedDateLabel: "Approved",
    approvedDate: ".*\\d{1,2}, \\d{4}",
    expirationDateLabel: "Expires",
    expirationDate: ".*\\d{1,2}, \\d{4}",

    // ===== PRESCRIBER INFORMATION =====
    prescriberName: ".*",
    prescriberPhone: "\\(\\d{3}\\) \\d{3}-\\d{4}",
    prescriberAddress: ".*",

    // ===== ADDITIONAL INFORMATION =====
    additionalInfoSection: "Additional information",
    diagnosisCode: "Diagnosis code",
    authorizationNumber: "Authorization number",
    referenceNumber: "Reference number",
    details: "Details",
    detailsStatement: "We're reviewing the information your.*",
    progress: "Progress",
    decision: "Decision",
    provider_statement: "Your provider is helping us.*",

    // ===== DENIAL INFORMATION (if denied) =====
    denialReasonSection: "Denial reason",
    denialReason: ".*",
    appealInstructions: "How to appeal",
    appealDeadline: "Appeal by.*",

    // ===== ACTIONS =====
    downloadBtn: "Download",
    shareBtn: "Share",
    appealBtn: "Appeal decision",
    contactProviderBtn: "Contact provider",

    // ===== COMMON =====
};

// ============================================
// PRIOR AUTH SUBMISSION SCREEN
// ============================================
output.benefits_prior_auth_submit = {
    // ===== HEADER =====
    cancelBtn: "Cancel",
    pageTitle: "Request Prior Authorization",

    // ===== FORM FIELDS =====
    // Member selection
    memberLabel: "Who needs prior authorization?",
    memberSelector: "Select member",
    accountOwnerOption: "Account owner",

    // Medication/procedure
    medicationLabel: "Medication or procedure",
    medicationField: "Enter medication or procedure name",

    // Prescriber information
    prescriberNameField: "Prescriber name",
    prescriberPhoneField: "Prescriber phone",
    prescriberFaxField: "Prescriber fax",
    prescriberAddressField: "Magnify glass icon Prescriber address",

    // Diagnosis
    diagnosisLabel: "Diagnosis",
    diagnosisField: "Enter diagnosis code or description",

    // Clinical information
    clinicalInfoLabel: "Clinical information",
    clinicalInfoField: "Provide any relevant clinical information",

    // Supporting documents
    documentsLabel: "Supporting documents",
    uploadDocumentsBtn: "Upload documents",
    addDocumentBtn: "Add document",

    // ===== VALIDATION =====
    requiredFieldError: "This field is required",
    invalidPhoneError: "Invalid phone number",
    invalidFaxError: "Invalid fax number",

    // ===== NAVIGATION =====
    continueBtn: "Continue",
    submitBtn: "Submit request",
    saveAsDraftBtn: "Save as draft",

    // ===== CONFIRMATION =====
    confirmationTitle: "Request submitted",
    confirmationMessage: "Your prior authorization request has been submitted",
    confirmationNumber: "Reference number: .*",
    whatNextSection: "What happens next",
    expectedResponseTime: "You should hear back within.*",

    doneBtn: "Done",
};

// ============================================================================
// COMMON — auto-extracted (Phase B): properties shared verbatim across blocks
// ============================================================================
output.benefits_prior_auth_common = {
    backBtn: "Back",
    backBtnId: __isIOS ? "UnifiedHeaderView" : "back_button",
    closeBtn: "Close",
    helpBtn: "Help",
    prescriberSection: "Prescriber information",
    requestedDate: ".*\\d{1,2}, \\d{4}",
    statusBadge: "Approved|Pending|Denied",
};
