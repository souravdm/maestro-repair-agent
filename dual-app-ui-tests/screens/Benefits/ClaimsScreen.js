// ClaimsScreen.js
// Claims landing, submission, history, and details screens
// UPDATED 2026-04-27: Complete text-based selectors from Figma design
// Figma: Open Platform — Benefits Integration > Reimbursement Request/Submit Claim (Prescriptions)
const __platform = maestro.platform.toLowerCase() === "ios" ? "ios" : "android";
const __isIOS = __platform === 'ios';

// ============================================
// CLAIMS LANDING SCREEN
// ============================================
output.benefits_claims_landing = {
    // ===== HEADER =====
    claimsTitle: "Claims",
    chatBtn: "Chat",
    messagesBtn: "Messages",

    // ===== SUBMIT CLAIM CARD =====
    submitClaimCard: "Submit a new prescription claim",
    submitClaimDescription: "Request reimbursement for a medication you paid for.",
    startClaimBtn: "Start a claim",
    noClaims: "We couldn.*",

    // Alternative claim types
    submitMedicalClaimTitle: "Submit a medical claim",
    submitDentalClaimTitle: "Submit a dental claim",
    submitVisionClaimTitle: "Submit a vision claim",

    // ===== CLAIM STATUS TABS =====
    processedTab: "Processed",
    submittedTab: "Submitted",
    allPlanTypesBtn: "All plan types|All claim types",
    allClaimsBtn: "All claim statuses|All claim status",
    allTimeFramesBtn: "All time frames|All time frame",
    loadMoreClaimsBtn: "Load more claims",


    // ===== FILTERS =====
    allFiltersBtn: "All filters",
    applyBtn: "Apply",
    resetAllBtn: "Reset all|Reset",
    viewResultsBtn: "View results",
    filtersTitle: "Filters",

    // Time frame filter
    timeFrameLabel: "Time frame",
    last3Months: "Last 3 months",
    last6Months: "Last 6 months",
    last9Months: "Last 9 months",
    last12Months: "Last 12 months",

    // Claim type filter
    claimTypeLabel: "Claim type",
    prescriptionType: "Prescription",
    medicalType: "Medical",

    // Claim status filter
    claimStatusLabel: "Claim status",
    processedStatus: "Processed",
    deniedStatus: "Denied",
    pendingStatus: "Pending",

    // Sort options
    newestFirstSort: "Newest First",
    oldestFirstSort: "Oldest First",

    // ===== CLAIM CARDS =====
    // Provider names
    cvsHealthProvider: "CVS Health",

    // Status badges (visual text)
    successApproved: "Approved",

    // Account owner

    // Claim details
    visitedLabel: "Visited on",
    visitedPattern: "Visited on .*",
    requestedLabel: "Requested on",
    requestedPattern: "Requested on .*",
    prescribedBy: "Prescribed by.*",

    // Financial details (visual text)
    totalAmountLabel: "Total amount",
    reimbursementLabel: "Reimbursement",

    // ===== BOTTOM TAB BAR =====
    drugPricingTab: "Drug Pricing",
    providersTab: "Providers",

    // ===== EMPTY STATE =====
    noClaimsMessage: "No claims found",
    noClaimsDescription: "You don't have any claims yet",
    noClaimsYet: "No claims yet",
    startFirstClaim: "Start your first claim",

    // ===== STATUS BADGES (complete set from Figma) =====
    receivedStatus: "Received",
    reviewingStatus: "Reviewing",
    partiallyApprovedStatus: "Partially approved",

    // ===== PAGINATION =====
    showMoreClaimsBtn: "Show more claims",
    viewResultsPattern: "View \\d+ results",

    // ===== COMMON =====
    loadingMessage: "Loading",
    loadingYourClaims: "Loading your claims",
    // orphan-cleanup: auto-added stub — VERIFY against real UI text
    dateRangeLabel: "Date range",
    // orphan-cleanup: auto-added stub — VERIFY against real UI text
    statusLabel: "Status",
};

// ============================================
// CLAIMS "WHAT YOU'LL NEED" MODAL
// (First screen after tapping "Start a claim")
// Figma: Modal - What you'll need
// ============================================
output.claims_what_you_need = {
    // ===== MODAL HEADER =====
    whatYouNeedTitle: "What you'll need",

    // ===== INSTRUCTION TEXT =====
    instructionText: "Have these items handy to finish your claim:",

    // ===== REQUIRED ITEMS LIST (from Figma) =====
    prescriptionReceipt: "Prescription receipt",
    addPrescriptionImage: "Add prescription image",
    prescriberNameAndAddress: "Prescriber's name and address",
    pharmacyPhoneNumber: "Pharmacy phone number",

    // ===== PRESCRIPTION RECEIPT INFO =====
    receiptInfoTitle: "Prescription receipt",
    receiptInfoText: "A prescription receipt shows important details about your medication, including your name, the pharmacy's info, what the prescription is for and how much it cost.",

    // Medical/Dental/Vision claims
    medicalReceiptItem: "Medical receipt or bill",
    dentalReceiptItem: "Dental receipt or bill",
    visionReceiptItem: "Vision receipt or bill",
    serviceProviderItem: "Service provider information",
    dateOfServiceItem: "Date of service",

    // ===== ACTION BUTTONS =====
    addClaimDetailsBtn: "Add claim details",

    // ===== CLAIM SUBMISSION =====
    selectClaimTypeTitle: "Select claim type",
    submitClaimBtn: "Submit a Claim",
    submitClaimLink: "Submit a claim",
    viewClaimHistoryLink: "View claim history",
    claimsHistoryTitle: "Claims History",

    // ===== NAVIGATION =====
};

// ============================================
// STEP 1: CLAIM DETAILS
// Figma: Modal - Claim details
// ============================================
output.claims_step1_details = {
    // ===== HEADER =====
    stepIndicator: "Step 1",
    // iOS accessibility label carries a leading space (icon glyph consumes a
    // leading character slot); Android's is exactly "Claim Details" with none.
    screenTitle: " ?Claim Details",
    insuranceTypeSelectAnOption: ".*Select an option.*",

    // ===== INSTRUCTION TEXT =====
    allFieldsRequiredText: "All fields required unless marked optional.",

    // ===== IMPORT CLAIM DETAILS (optional) =====
    importClaimDetails: "Import claim details",
    importSaveTime: "Save time by copying details from an existing claim",
    useDetailsFromRecent: "Use details from a recent request",

    // ===== PRESCRIPTION RX NUMBER =====

    // ===== WHO IS THIS CLAIM FOR? (Dropdown) =====
    whoIsClaimForLabel: ".*Who is this claim for?.*",
    whoIsClaimForDefault: "Myself.*",
    selectAnOption: "Select an option.*",

    // ===== REASON FOR SUBMITTING (Dropdown) =====
    reasonForSubmittingLabel: "Reason for submitting this claim",

    // Reason dropdown options (from Figma)
    reasonTravelingWithinUS: "Traveling (within US)",
    reasonTravelingOutsideUS: "Traveling (outside US)",
    reasonNaturalDisasterEmergency: "Natural disaster/emergency",
    reasonInsuranceCardUnavailable: "Insurance card unavailable",
    reasonPharmacyDidntAcceptInsurance: "Pharmacy didn't accept insurance",
    reasonAppealingClaim: "Appealing claim",
    reasonRequestingTieringException: "Requesting tiering exception",
    reasonNeededApprovalFirst: "Needed approval first",
    reasonOther: "Other",

    // ===== REASON HELP TEXT =====
    reasonHelpLabel: "Describe the reason",
    reasonHelpSubtext: "Up to 70 characters",

    // ===== COMPOUND DRUG & INSURANCE CHECKBOXES =====
    optionalSectionTitle: "Are any of the following true for this claim? Select all that apply. (optional)",
    optionalSectionSubtext: "Additional fields may appear based on selection.",
    compoundDrugCheckbox: "This medication is a compound drug.",
    additionalInsuranceCheckbox: "I have additional primary/secondary insurance.",

    // ===== WHAT IS A COMPOUND DRUG? (Info link) =====
    whatIsCompoundDrugLink: "What is a compound drug?",
    compoundDrugInfoTitle: "What is a Compound Drug?",
    compoundDrugInfoText: "A compound drug is a custom medication prepared by a pharmacist by combining, mixing, or altering ingredients to meet a patient's specific needs.",
    howToTellTitle: "How to Tell if Your Prescription is a Compound",
    multipleNDCCodes: "Multiple NDC Codes",
    ingredientList: "Ingredient List",
    customLabeling: "Custom Labeling",

    // ===== INSURANCE TYPE DROPDOWN (shown when insurance checkbox selected) =====
    insuranceTypeLabel: "What type of insurance is it?",
    insuranceTypeSecondary: "Secondary",
    insuranceTypePrimaryMedicareD: "Primary - Medicare Part D",
    insuranceTypePrimaryMedicareB: "Primary - Medicare Part B",

    // ===== INSURANCE DETAILS FIELDS =====

    // ===== EXPLANATION OF BENEFITS =====
    explanationOfBenefitsTitle: "Explanation of benefits",
    explanationOfBenefitsText: "Upload a photo of your explanation of benefits (EOB). The EOB shows the care you received, what your insurance paid for, and what you needed to pay. We accept JPEG, JPG, PNG, and PDF files up to 3 MB.",
    eobUploadBtn: "Upload",

    // ===== OPTIONAL FIELDS (updated Figma wording) =====
    selectAllOptional: "Select all that apply (optional)",
    areAnyFollowingOptional: "Are any of the following true for this claim? (optional)",

    // ===== EOB UPLOAD =====
    uploadEOBBtn: "Upload explanation of benefits",

    // ===== ACTION BUTTON =====
    addMedicationBtn: "Add medication",
};

// ============================================
// STEP 2: PRESCRIPTION RECEIPT
// Figma: Upload Receipt
// ============================================
output.claims_step2_receipt = {
    // ===== HEADER =====
    stepIndicator: "Step 2",
    screenTitle: "Add your Rx receipt",

    // ===== INSTRUCTION TEXT =====
    uploadInstructionText: "Upload a photo of your prescription receipt. We accept JPEG, JPG, PNG, and PDF files up to 3 MB.",

    // ===== UPLOAD BUTTON =====

    // ===== UPLOAD SOURCE OPTIONS (iOS action sheet) =====
    filesOption: "Files",
    cameraOption: "Camera",
    photosOption: "Photos",
    photosPickerCollectionsTab: "Collections",

    // ===== UPLOADED FILE DISPLAY =====
    fileNamePattern: ".*\\.jpg|.*\\.png|.*\\.pdf",
    fileSizePattern: "\\d+\\.\\d+ MB",
    removeFileBtn: "Remove file",

    // ===== UPLOAD ERROR STATE =====
    documentFailedToUpload: "Document failed to upload",
    pleaseResubmit: "Please try to resubmit.",
    cardBreakBtn: "CardBreak",
    reUploadBtn: "Re-upload",

    // ===== EDIT RECEIPT (post-upload) =====
    editPrescriptionReceipt: "Edit prescription receipt",

    // ===== PERMISSIONS =====
    permissionsNeededTitle: "Permissions needed to continue",
    permissionsNeededText: "It looks like you've turned off permissions required for file feature.",
    enableMediaPermissions: "Enable files and media permissions in your device settings",
    permissionsNeededCamera: "Permission is needed to use your camera",
    enableCameraPermissions: "Enable camera permission in your device settings",

    // ===== ADDITIONAL UPLOAD ACTIONS (Figma: claims_submit) =====
    uploadAnotherFileBtn: "Upload another file",
    changeFileBtn: "Change file",

    // ===== ACTION BUTTON =====
};

// ============================================
// STEP 3: MEDICATION DETAILS
// Figma: Modal - Medication details
// ============================================
output.claims_step3_medication = {
    // ===== HEADER =====
    stepIndicator: "Step 3",
    screenTitle: "Medication details",
    prescriptionInputLabel: "Prescription Rx number",
    dateFilledSelect: "Date filled",
    // Android's calendar dialog confirms with "OK"; iOS's confirms with "Done".
    dateFilledConfirmBtn: "(?i).*(Ok|Done).*",
    // ===== INSTRUCTION TEXT =====
    allFieldsRequired: "All fields required.",
    allFieldsRequiredUnlessOptional: "All fields required unless marked optional.",

    // ===== STANDARD MEDICATION FIELDS =====
    enterDrugNameOrNDC: "Enter Drug name or NDC number to search",
    drugNameSearchField: "Search",
    dateFilledLabel: "(?i)Date filled.*Date",
    dateFilledField: "Date filled\nDate",
    daysSupplyLabel: "(?i).*(Days supply).*",
    totalPaidLabel: "US dollars, Total paid",

    // ===== TRAVELING OUTSIDE US ADDITIONAL FIELD =====
    countryLabel: "Country",
    totalPaidCurrencyHelpText: "Use currency of country where purchased",

    // ===== COMPOUND DRUG FIELDS =====
    drugNameLabel: "Drug name",
    // iOS accessible text is exactly "Drug form". Android combines placeholder +
    // label into "Select an option, Drug form" — the trailing anchor covers both
    // without ambiguously matching the Drug name field above it.
    drugFormSelectAnOption: ".*Drug form",

    // Drug form dropdown options
    drugFormTablet: "Tablet",
    drugFormCapsule: "Capsule",
    drugFormSolution: "Solution",
    drugFormCream: "Cream",
    drugFormOintment: "Ointment",
    drugFormInjection: "Injection",
    drugFormSuspension: "Suspension",
    drugFormDrops: "Drops",

    // ===== COMPOUND INGREDIENTS =====
    compoundIngredientsTitle: "Compound.*",
    ingredient1Title: "Ingredient 1",
    ingredient2Title: "Ingredient 2",
    ingredientNDCLabel: ".*NDC.*",
    ingredientNDCLabel2: "Ingredient 2 NDC",
    quantityLabel1: ".*Quantity.*",
    quantityLabel2: "Ingredient 2 Quantity",
    addAnotherIngredientBtn: "Add another ingredient",
    removeIngredientBtn: "Remove",

    // ===== DRUG SEARCH RESULTS =====
    searchYourDrug: "Search your drug",
    searchResultsPattern: ".*\\d+ results.*",

    // ===== ACTION BUTTON =====
    addPrescriberDetailsBtn: "Add prescriber details",
};

// ============================================
// STEP 4: PRESCRIBER AND PHARMACY DETAILS
// Figma: Modal - Prescriber and pharmacy details
// ============================================
output.claims_step4_prescriber_pharmacy = {
    // ===== HEADER =====
    stepIndicator: "Step 4",
    screenTitle: "Prescriber and pharmacy details",

    // ===== INSTRUCTION TEXT =====
    allFieldsRequired: "All fields required.*",

    // ===== PRESCRIBER SECTION =====
    prescriberSectionTitle: "Prescriber",

    // Prescriber address search
    prescriberAddressSearchPlaceholder: "Search",
    prescriberAddressUseCurrentLocation: "Use ZIP code or location",
    prescriberAddressResultsPattern: "\\d+ results",
    locationNotFound: "Location wasn't found",
    searchByZipInstead: "Search by ZIP code instead.",

    // ===== PHARMACY SECTION =====
    pharmacySectionTitle: "Pharmacy",
    pharmacyPhoneNumberLabel: "Pharmacy phone number",

    // ===== ACTION BUTTON =====
    reviewClaimBtn: "Review claim",
};

// ============================================
// STEP 5: REVIEW AND SUBMIT
// Figma: Modal - Review
// ============================================
output.claims_step5_review = {
    // ===== HEADER =====
    stepIndicator: "Step 5",
    screenTitle: "Review and submit your claim",

    // ===== ADDRESS ON FILE =====
    addressOnFileSection: "Address on file",
    addressPattern: ".*\\d+.*",

    // ===== PAYMENT INSTRUCTIONS =====
    paymentInstructionsSection: "Payment instructions",

    // ===== ADDITIONAL INSURANCE SECTION =====
    additionalInsuranceSection: "Additional insurance",
    insuranceTypeLabel: "Insurance type",
    insuranceTypeValue: "Primary",
    explanationOfBenefitsLabel: "Explanation of benefits",

    // ===== PRESCRIPTION RECEIPT SECTION =====
    totalPaidLabel: "Total paid,.*",
    totalPaidPattern: "\\$\\d+\\.\\d{2}",
    receiptLabel: "Receipt,.*",
    receiptFilePattern: ".*\\.jpg|.*\\.png",

    // ===== PRESCRIPTION DETAILS SECTION =====
    prescriptionDetailsSection: "Prescription",
    drugNameOrNDCLabel: "Drug name or NDC,.*",
    prescriptionRxNumberLabel: "Prescription Rx number,.*",
    dateFilledLabel: "Date filled,.*",
    quantityLabel: "Quantity,.*",
    daySupplyLabel: "Day supply,.*",
    // Matches "Edit Prescription" (compound, title-case) AND "Edit prescription" (standard)
    editPrescriptionBtn: "Edit [Pp]rescription",

    // ===== COMPOUND DRUG REVIEW FIELDS =====
    // drugFormLabel matches "Drug form, Cream" (label, value combined in a11y tree)
    drugFormLabel: "Drug form,.*",
    // ingredient sections are grouped into single a11y elements:
    //   "Ingredient 1 NDC <val> Quantity <val> Ingredient cost <val>"
    //   "Ingredient 2 NDC <val> Quantity <val> Ingredient cost <val>"
    ingredient1Section: "Ingredient 1",
    ingredient2Section: "Ingredient 2",
    ingredient1WithData: "Ingredient  1.*",
    ingredient2WithData: "Ingredient  2.*",

    // ===== PRESCRIBER AND PHARMACY SECTION =====
    prescriberAndPharmacySection: "Prescriber and pharmacy",
    prescriberNameLabel: "Prescriber name,.*",
    prescriberAddressLabel: "Prescriber address,.*",
    pharmacyPhoneNumberLabel: "Pharmacy phone number,.*",
    editPrescriberAndPharmacyBtn: "Edit prescriber and pharmacy",

    // ===== IMPORTANT TIPS SECTION =====
    importantTipsSection: "Important tips",
    keepReceiptsTip: "• Keeps your receipts",
    notAllReimbursementsTip: "• Not all reimbursements are approved.",
    combinedPaymentsTip: "• If you’re owed money for multiple approved claims, we may combine payments into a single check.",

    // ===== REQUIRED CONSENT =====
    requiredConsentSection: "Required consent",
    consentText: "I certify that I, or my eligible dependent, received the medicine described here and that all the information on this form is true and correct.",
    consentCheckbox: "Yes, I consent and confirm the information is true and correct.",
    consentCheckboxChecked: "Yes, I consent and confirm the information is true and correct.",

    // ===== PAYMENT OPTIONS (Figma: claims_submit) =====
    flexPayEligibleLabel: "Eligible to pay in 3 installments.",
    payLaterBtn: "Pay later",
    bankAccountOption: "Bank account",
    receiveBillByMailOption: "Receive bill in the mail",

    // ===== SUBMIT BUTTON =====
};

// ============================================
// STEP 6: CONFIRMATION
// Figma: Button Sheet - Submitted Confirmation
// ============================================
output.claims_confirmation = {
    // ===== HEADER =====
    claimsHeader: "Claims",

    // ===== SUCCESS MESSAGE =====
    confirmationNumberPattern: "#[A-Z0-9]+",
    confirmationNumberDisplay: "#D489573987",

    // ===== PROCESSING INFO =====
    processingTimeText: "It usually takes up to 2 weeks to process your claim. We'll mail you a letter about your claim's status after we process it.",

    // ===== ACTION BUTTONS =====
    startAnotherClaimBtn: "Start another claim",
    doneBtn: "Done|done",

    // ===== STATUS VARIANTS =====
    reviewingConfirmationPattern: "Reviewing - Confirmation #: .*",
    completedConfirmationPattern: "Completed - Confirmation #: .*",
    receivedConfirmationPattern: "Received - Confirmation #: .*",
    // Any valid lifecycle status — for a generic "a submitted claim is
    // visible" check that shouldn't be tied to one specific status a claim
    // will naturally age out of (see H100_BEN_Claims_TC018_submittedClaim.yaml).
    anyStatusConfirmationPattern: "(Reviewing|Received|Completed) - Confirmation #: .*",

    // ===== ERROR STATE =====
    troubleSubmittingMsg: "We're having trouble submitting your claim. Please try again later.",

    // ===== BOTTOM TAB BAR =====
    drugPricingTab: "Drug pricing",
};

// ============================================
// BACKWARD COMPATIBILITY - Keep old namespaces
// pointing to new step-based structure
// ============================================
output.benefits_claims_submit = {
    // Map old keys to new step-based screen objects
    addClaimDetailsTitle: "Claim details",

    // Member selection
    whoIsThisClaimFor: "Who is this claim for?",
    memberSelector: "Select member",
    evista: "Evista 60mg Tab",
    accountOwner: "Myself.*",
    selectMember: "Select an option",

    // Prescription details (old keys mapped to new)
    prescriptionDetailsSection: "Prescription details",
    prescriptionNameLabel: "Enter drug name or NDC number",
    prescriptionNameField: "Search",
    prescriptionNumberField: "Prescription Rx number",
    fillDateField: "Date",
    amountPaidField: "Total paid",

    // Prescriber details
    prescriberDetailsSection: "Prescriber",

    // Pharmacy details
    pharmacyDetailsSection: "Pharmacy",
    pharmacyNameField: "Pharmacy name",
    pharmacyPhoneField: "Pharmacy phone number",

    // Receipt upload
    addReceiptBtn: "Upload receipt",
    takePhotoBtn: "Camera",
    chooseFromLibraryBtn: "Photos",
    chooseFilesBtn: "Files",
    scanReceiptBtn: "Scan receipt",
    receiptUploaded: "Receipt uploaded",
    removeReceiptBtn: "Remove file",
    replaceReceiptBtn: "Replace",

    // Navigation
    nextBtn: "Next",
    previousBtn: "Previous",

    // Validation
    allFieldsRequired: "All fields required",
    requiredFieldError: "This field is required",
    invalidFormatError: "Invalid format",

    // Progress indicators
    step1Of4: "Step 1",
    step2Of4: "Step 2",
    step3Of4: "Step 3",
    step4Of4: "Step 4",

    // Confirmation
    claimSubmittedMessage: "You submitted your claim",
};

// ============================================
// CLAIMS HISTORY/DETAILS
// ============================================
output.benefits_claims_history = {
    // ===== HEADER =====
    claimsHistoryTitle: "Claims history",
    claimHistoryTitle: "Claim history",

    // ===== FILTERS =====
    searchField: "Search claims",
    searchPlaceholder: "Search by provider, date, or amount",

    // ===== CLAIM CARD =====
    providerLabel: "Provider:",
    providerPattern: "Provider: .*",


    visitedOnLabel: "Visited on.*",
    requestedOnLabel: "Requested on",
    datePattern: ".*\\d{1,2}, \\d{4}",

    // Status badges
    processedBadge: "Processed",
    submittedBadge: "Submitted",
    approvedBadge: "Approved",
    deniedBadge: "Denied",
    pendingBadge: "Pending",

    // Financial amounts

    // ===== CLAIM DETAILS =====

    serviceTypeLabel: "Service type",
    serviceProviderLabel: "Service provider",
    serviceDateLabel: "Service date",
    diagnosisLabel: "Diagnosis",
    procedureLabel: "Procedure",

    totalBilledLabel: "Total billed",
    coveredAmountLabel: "Covered amount",
    notCoveredLabel: "Not covered",
    deductibleLabel: "Applied to deductible",
    coinsuranceLabel: "Coinsurance",
    copayLabel: "Copay",
    youOweLabel: "You owe",
    reimbursementLabel: "Reimbursement amount",

    downloadBtn: "Download",
    downloadPdfBtn: "Download PDF",
    shareBtn: "Share",
    disputeBtn: "Dispute claim",
    contactSupportBtn: "Contact support",

    // ===== CLAIM DETAIL AMOUNTS (Figma: claims_history_rx + spending_details) =====
    amountOverviewSection: "Amount overview",
    amountBilledLabel: "Amount billed",
    secondaryPlanShareLabel: "Secondary plan's share",
    planDiscountLabel: "Plan discount",
    wentTowardDeductiblePattern: "\\$[0-9,]+\\.\\d{2} went toward your deductible",
    wentTowardOOPPattern: "\\$[0-9,]+\\.\\d{2} went toward your out-of-pocket",
    paidOnPattern: "Paid on .*",
    networkStatusLabel: "Network status: In network",
    claimIdPattern: "Claim ID: .*",
    quantityShortLabel: "Qty: \\d+",

    // ===== COMPOUND CLAIM FIELDS =====
    compoundPrescriptionLabel: "Compound prescription",
    ingredientsInClaimTitle: "Ingredients in this claim",
    ndcCodePattern: "NDC Code: \\d+",

    // ===== VIEW EOB =====
    viewEOBBtn: "View EOB",
    viewEOBPattern: "View your Explanation of Benefits \\(EOB\\) from .*",

    // ===== DISCLAIMER =====
    amountCalculationDisclaimer: "The amount we calculate does not factor in payments you.*",
};

// ============================================
// CLAIMS REVIEW SCREEN (backward compat)
// ============================================
output.benefits_claims_review_claim = {
    reviewTitle: "Review and submit your claim",

    memberInfoSection: "Member information",
    prescriptionInfoSection: "Prescription details",
    prescriberInfoSection: "Prescriber and pharmacy",
    pharmacyInfoSection: "Pharmacy",
    claimDetailsSection: "Claim details",

    memberLabel: "Member",
    memberNameLabel: "Member name",
    memberIdLabel: "Member ID",

    prescriptionLabel: "Prescription",
    prescriptionNameLabel: "Drug name or NDC",

    prescriberLabel: "Prescriber",

    pharmacyLabel: "Pharmacy",

    receiptLabel: "Receipt",
    receiptAttached: "Receipt attached",
    viewReceiptBtn: "View receipt",

    editBtn: "Edit",
    editDetailsBtn: "Edit details",
    submitClaimBtn: "Submit",

    agreementText: "I certify that I, or my eligible dependent",
    agreementFullText: "I certify that I, or my eligible dependent, received the medicine described here and that all the information on this form is true and correct.",
    consentCheckbox: "Yes, I consent and confirm the information is true and correct.",
    termsAndConditions: "Terms and Conditions",
    privacyPolicy: "Privacy Policy",

    confirmationMessage: "You submitted your claim",
};

// ============================================
// CLAIMS SCAN RECEIPT (OCR)
// ============================================
output.benefits_claims_scan_receipt = {
    scanReceiptTitle: "Scan receipt",
    scanYourReceiptTitle: "Scan your receipt",
    cancelConfirmationTitle: "Are you sure you want to exit?",
    cancelConfirmationStatement: "Your progress will not be saved if you exit now.",

    scanningMessage: "Scanning",
    holdSteady: "Hold steady",
    alignReceipt: "Align receipt within frame",
    captureBtn: "Capture",
    retakeBtn: "Retake",

    processingMessage: "Processing",
    extractingInfo: "Extracting information",
    analyzingReceipt: "Analyzing receipt",

    extractedDataTitle: "Extracted data",
    reviewExtractedData: "Review extracted data",
    prescriptionNameExtracted: "Prescription name",
    amountPaidExtracted: "Amount paid",
    dateExtracted: "Date",
    pharmacyExtracted: "Pharmacy",

    useThisDataBtn: "Use this data",
    editDataBtn: "Edit data",
    scanAgainBtn: "Scan again",

    scanFailedMessage: "Scan failed",
    tryAgainMessage: "Please try again",
    manualEntryBtn: "Enter manually"
};

// ============================================================================
// COMMON — auto-extracted (Phase B): properties shared verbatim across blocks
// ============================================================================
output.benefits_claims_common = {
    accountOwnerLabel: "Account owner:",
    accountOwnerPattern: "Account owner: .*",
    aetnaProvider: "Aetna",
    amountPaidLabel: "Total paid",
    backBtn: "Back",
    benefitsTab: "Benefits",
    billedLabel: "Billed",
    billedPattern: "Billed.*\\$.*",
    cancelBtn: ".*Cancel.*",
    caremarkProvider: "CVS Caremark",
    claimDetailsTitle: "Claim details",
    claimsTab: "Claims",
    closeBtn: "Close",
    confirmationLabel: "Confirmation #:",
    confirmationNumberLabel: "Confirmation number:",
    confirmationPattern: "Confirmation #: .*",
    continueBtn: "Continue",
    doneBtn: "Done",
    drugFormLabel: "Drug form",
    fillDateLabel: "Date filled",
    filterBtn: "Filter",
    homeTab: "Home",
    ingredientCostLabel: "US dollars, Ingredient.*",
    // Exact text, not a shared regex — ingredientCostLabel matches both
    // Ingredient 1 and Ingredient 2's cost fields, and Ingredient 1's field
    // stays in the tree even after scrolling to Ingredient 2 (unlike its NDC
    // field). Without an index, the ambiguous regex landed on Ingredient 1's
    // field and appended text to it (confirmed live: "50.00" + "75.50" typed
    // became "50.007550" since the field silently drops a second ".").
    ingredientCostLabel2: "US dollars, Ingredient 2 Ingredient cost",
    insuranceIdLabel: "Insurance ID",
    insuranceNameLabel: "Insurance name",
    pharmacyNameLabel: "Pharmacy name",
    pharmacyPhoneLabel: "Pharmacy phone number",
    planShareLabel: "Plan's share",
    planSharePattern: "Plan's share.*\\$.*",
    prescriberAddressField: "Prescriber address",
    prescriberAddressLabel: "Prescriber address",
    prescriberNameField: "Prescriber name",
    prescriptionRxNumberField: "Prescription Rx number",
    prescriptionRxNumberLabel: "Prescription Rx number",
    quantityLabel: "Quantity",
    receiptSection: "Prescription receipt",
    reviewAndSubmitTitle: "Review and submit your claim",
    saveBtn: "Save",
    sortBtn: "Sort",
    submitBtn: "Submit",
    uploadReceiptBtn: "Upload receipt",
    viewClaimBtn: "View claim",
    yourShareLabel: "Your share",
    yourSharePattern: "Your share.*\\$.*",

    // ===== VALIDATION (Figma: claims_submit) =====
    pleaseAcknowledgeConsent: "Please acknowledge your consent",
    invalidCharacterError: "You've entered an invalid character. Check spelling and try again.",
    drugNameNotFoundError: "Drug name wasn't found",

    // ===== TITLES / MISC =====
    reimbursementClaimsTitle: "Reimbursement Claims",
    inNetworkStatus: "Network status: In network",
    contactYourProviderBtn: "Contact your provider",
    allClaimStatuses: "All claim statuses",
    anyStatusFilter: "Any status",
    allMonthsFilter: "All Months",
};
