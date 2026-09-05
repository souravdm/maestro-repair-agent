/**
 * PlanDocumentsScreen.js - Consolidated Plan Documents Screen Elements
 *
 * Merged files:
 * - Benefits/PlanDocumentsScreen.js (original)
 * - Benefits/PlanDocuments/BenefitsPlanDocumentsScreen.js
 * - Benefits/PlanDocuments/PlanDocumentsLandingScreen.js
 *
 * Used by: flows/Benefits/plan-documents*.yaml, subflows/Benefits/plan-documents*.yaml
 * Platform: iOS & Android
 */

const __platform = maestro.platform.toLowerCase() === "ios" ? "ios" : "android";
const __isIOS = __platform === 'ios';

// ============================================================================
// Original: Benefits/PlanDocumentsScreen.js
// ============================================================================
output.benefits_plan_documents = {
  // Page header
  pageTitle: "Plan Documents",
  documentsTitle: "Documents",

  // Search functionality
  searchField: "Search documents",
  searchFieldId: "search_field",
  searchPlaceholder: "Search",
  clearSearchBtn: "Clear",

  // Document list elements
  documentListTitle: "Available Documents",
  documentItem: ".*\\.pdf|.*Document",
  documentName: "Summary of Benefits|EOB|Coverage|Plan",
  documentDate: "[0-9]{2}/[0-9]{2}/[0-9]{4}",
  documentType: "PDF|Document",
  documentSize: "[0-9]+ (KB|MB)",

  // Document categories
  summaryOfBenefits: "Summary of Benefits",
  explanationOfBenefits: "Explanation of Benefits|EOB",
  coverageDocument: "Coverage Details",
  planDocument: "Plan Document",

  // Document actions
  viewDocumentBtn: "View|Open",
  downloadDocumentBtn: "Download",
  shareDocumentBtn: "Share",

  // Sheet/Modal elements (iOS)
  sheetGrabber: "resize-indicator",
  sheetTitle: "Plan Documents",
  closeSheetBtn: "Close|Dismiss",

  // Full-screen dialog (Android)
  appBarTitle: "Plan Documents",
  appBarCloseBtn: "Close",

  // Bottom actions
  bottomActionsContainer: "Bottom actions",
  selectAllBtn: "Select All",
  deselectAllBtn: "Deselect All",

  // Empty states
  noDocumentsMessage: "No documents found|No documents available",
  noSearchResultsMessage: "No results found|No matching documents",

  // Loading states
  loadingIndicator: "Loading.*|Please wait",

  // Error states
  errorMessage: "Unable to load documents|Error loading|Try again",
  downloadErrorMessage: "Download failed|Unable to download",

  // ===== ANDROID-SPECIFIC ELEMENTS =====
  planDocumentSearchField: "Plan document search",  // Android
  searchInPlanDocsField: "Search in plan documents",  // Android
  overviewLabel: "Overview",  // Android
  couldntLoadAllMsg: "We couldn't load all of your plan documents, so we're only showing available for your plan.",  // Android
  contactEmployerMsg: "Contact your employer for help getting your plan documents",  // Android
  serviceUsageLabel: "Service usage",  // Android
  openPdfMsg: "Open PDF with\u2026",  // Android,
  // orphan-cleanup: auto-added stub — VERIFY against real UI text
  backBtn: "Back",

  // ===== UPDATED MESSAGES (Figma: plan_docs) =====
  limitReachedMsg: "Limit reached",
  couldntLoadAllDocsMsg: "We couldn't load all of your documents, so we're only showing the ones available for your plan.",
  couldntLoadInfoMsg: "We couldn't load this information. Try again later.",
  contactEmployerAnotherWayMsg: "Contact your employer for help getting plan documents another way.",

  // ===== PLAN DATE RANGE =====
  planDateRange: "January \\d+, \\d{4} - December \\d+, \\d{4}",
  preferredDrugList: "Preferred drug list",
};

// ============================================================================
// Original: Benefits/PlanDocuments/BenefitsPlanDocumentsScreen.js
// ============================================================================
output.benefits_plandocs = {
    // ============ HEADER & NAVIGATION ============
    benefitsPlanDocsTitle: "(?i).*(Benefits & plan documents).*",
    benefitsPlanDocShort: "Benefits & Plan Docu...",
    backBtn: __isIOS ? "Back" : "Back",

    // ============ BENEFITS SECTION ============
    medicalBenefits: "Medical benefits",
    dentalBenefits: "Dental benefits",
    fullDetailsBenefits: "For full details on benefits,",
    usageSummary: "Usage summary",
    trackHealthServices: "Track the health services",

    // ============ SERVICE USAGE ============
    serviceUsage: "Service usage",
    trackServices: "Track covered services",
    annualServices: "Annual service limits",
    therapyLabel: "Therapy",
    hospitalRehab: "Hospital & Rehabilitation",
    visitsLabel: "Visits",
    usedLabel: "used",
    diagnosticCare: "Diagnostic & Preventive Care",
    orthodonticCare: "Orthodontic Care",
    annualCleanings: "Annual Cleanings",
    dentalOrthodontia: "Dental Orthodontia",

    // ============ PLAN DOCUMENTS ============
    planDocuments: "Plan documents",
    planDocsLabel: "Plan Documents",
    servicesCovered: "Services covered by your plan",
    viewAllCoveredServices: "View all of your covered services.",
    medicalBenefitDescBtn: "Medical-Benefit Plan Description",
    dentalPlanUpdateBtn: "Dental-Plan Update",

    // ============ ACKNOWLEDGEMENT ============
    acknowledgementLabel: "Acknowledgement",
    planDocDisclosure: "By selecting the",

    // ============ SERVICE USAGE ITEMS (Figma: plan_docs + plan_summary) =====
    homeHealthCareVisits: "Home health care OP visits",
    physicalTherapyVisits: "Physical therapy visits",
    privateDutyNursingVisits: "Private duty nursing OP visits",
    speechTherapyVisits: "Speech therapy visits",
    skilledNursingFacilityDays: "Skilled nursing facility IP days",
    routineEyeExam: "Routine eye exam",
    routineMammogram: "Routine mammogram",
    routineServices: "Routine services",
    preventativeServices: "Preventative services",

    // ============ ACTION BUTTONS ============
    continueBtn: __isIOS ? "Continue" : "Continue",
    closeBtn: __isIOS ? "Close" : "Close",
}

// ============================================================================
// Original: Benefits/PlanDocuments/PlanDocumentsLandingScreen.js
// ============================================================================
output.benefits_plandocs_landing = {
    // ============ HEADER & NAVIGATION ============
    planDocsTitle: __isIOS ? "Plan documents" : "Plan documents",
    backBtn: __isIOS ? "Back" : "Back",

    // ============ PLAN TABS ============
    medicalTab: __isIOS ? "Medical" : "Medical",
    dentalTab: __isIOS ? "Dental" : "Dental",
    visionTab: __isIOS ? "Vision" : "Vision",
    pharmacyTab: __isIOS ? "Pharmacy" : "Pharmacy",

    // ============ DOCUMENT TYPES ============
    benefitsSummary: "Summary of Benefits",
    planDetails: "Plan Details",
    coverageInfo: "Coverage Information",
    formulary: "Formulary",
    providerDirectory: "Provider Directory",

    // ============ DOCUMENT CARD ============
    documentCard: "Document card",
    documentName: "Document name",
    lastUpdated: "Last updated",
    fileSize: "File size",

    // ============ ACTION BUTTONS ============
    viewDocumentBtn: __isIOS ? "View" : "View",
    downloadBtn: __isIOS ? "Download" : "Download",
    shareBtn: __isIOS ? "Share" : "Share",

    // ============ PLAN YEAR SELECTOR ============
    planYearSelector: "Plan year",
    currentYear: "2025",
    previousYear: "2024",

    // ============ ACKNOWLEDGMENT (Figma uses 'Acknowledgment' not 'Acknowledgement') ============
    acknowledgmentLabel: "Acknowledgment",

    deductible: "Deductible",
    coInsurance: "Coinsurance",
    frequenciesAndLimitations: "(?i).*(Frequencies (&|and) Limitations).*",
}
