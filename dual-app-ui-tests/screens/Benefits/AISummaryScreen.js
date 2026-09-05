/**
 * AI Summary Screen Element Definitions
 * Feature: TLOP-4002 - Benefits on-page AI summarization (Phase 1)
 * 
 * Provides element selectors for:
 * - Plan Summary AI insights (deductible progress, cost sharing, spending patterns)
 * - Claims Detail AI explanations (plain language, cost breakdown)
 * - Loading states (skeleton loaders)
 * - Error states (retry functionality)
 */

const ELEMENT_TYPE = maestro.env.ELEMENT_TYPE;

// ============================================================================
// AI Summary Button Elements
// ============================================================================

const PLAN_SUMMARY_AI_BUTTON = {
  text: "(?i).*Explain my spending.*",
  id: "ai_summary_plan_button",
  below: "(?i).*(Medical|Pharmacy|Dental).*"
};

const CLAIMS_AI_BUTTON = {
  text: "(?i).*Explain my claim.*",
  id: "ai_summary_claim_button"
};

// ============================================================================
// AI Summary Content Elements
// ============================================================================

const AI_SUMMARY_CONTAINER = {
  id: "ai_summary_container",
  below: "(?i).*(Explain my spending|Explain my claim).*"
};

const AI_SUMMARY_HEADER = {
  text: "(?i).*(Explain my spending|Explain my claim).*",
  id: "ai_summary_header"
};

const AI_SUMMARY_CONTENT = {
  id: "ai_summary_content_text",
  below: "(?i).*(Explain my spending|Explain my claim).*"
};

const AI_SUMMARY_CLOSE_BUTTON = {
  id: "ai_summary_close_icon",
  accessibilityLabel: "(?i).*(Close|Collapse|Dismiss).*"
};

// ============================================================================
// Loading State Elements
// ============================================================================

const AI_SUMMARY_LOADER = {
  id: "ai_summary_skeleton_loader",
  accessibilityLabel: "(?i).*Loading.*"
};

// ============================================================================
// Error State Elements
// ============================================================================

const AI_SUMMARY_ERROR = {
  text: "(?i).*(something went wrong|unable to generate|try again).*",
  id: "ai_summary_error_message"
};

const AI_SUMMARY_RETRY_BUTTON = {
  text: "(?i).*(Try again|Retry).*",
  id: "ai_summary_retry_button"
};

// ============================================================================
// Insight-Specific Elements (Plan Summary)
// ============================================================================

const DEDUCTIBLE_INSIGHT = {
  text: "(?i).*(deductible|out-of-pocket|OOP max).*",
  id: "deductible_progress_insight"
};

const COST_SHARING_INSIGHT = {
  text: "(?i).*(deductible has been met|cost less|copay).*",
  id: "cost_sharing_insight"
};

const SPENDING_PATTERN_INSIGHT = {
  text: "(?i).*(spending|services|account for).*",
  id: "spending_pattern_insight"
};

// ============================================================================
// Claims-Specific Elements
// ============================================================================

const CLAIMS_EXPLANATION = {
  text: "(?i).*(You saw|visit|appointment|procedure).*",
  id: "claims_plain_language_explanation"
};

const COST_BREAKDOWN = {
  text: "(?i).*(cost you|out-of-pocket|deductible|insurance will cover).*",
  id: "claims_cost_breakdown"
};

// ============================================================================
// Element Selector Logic
// ============================================================================

let selectedElement;

switch (ELEMENT_TYPE) {
  // AI Summary Buttons
  case "plan_summary_ai_button":
    selectedElement = PLAN_SUMMARY_AI_BUTTON;
    break;
  case "claims_ai_button":
    selectedElement = CLAIMS_AI_BUTTON;
    break;

  // AI Summary Content
  case "ai_summary_container":
    selectedElement = AI_SUMMARY_CONTAINER;
    break;
  case "ai_summary_header":
    selectedElement = AI_SUMMARY_HEADER;
    break;
  case "ai_summary_content":
    selectedElement = AI_SUMMARY_CONTENT;
    break;
  case "ai_summary_close_button":
    selectedElement = AI_SUMMARY_CLOSE_BUTTON;
    break;

  // Loading States
  case "ai_summary_loader":
    selectedElement = AI_SUMMARY_LOADER;
    break;

  // Error States
  case "ai_summary_error":
    selectedElement = AI_SUMMARY_ERROR;
    break;
  case "ai_summary_retry_button":
    selectedElement = AI_SUMMARY_RETRY_BUTTON;
    break;

  // Insights
  case "deductible_insight":
    selectedElement = DEDUCTIBLE_INSIGHT;
    break;
  case "cost_sharing_insight":
    selectedElement = COST_SHARING_INSIGHT;
    break;
  case "spending_pattern_insight":
    selectedElement = SPENDING_PATTERN_INSIGHT;
    break;
  case "claims_explanation":
    selectedElement = CLAIMS_EXPLANATION;
    break;
  case "cost_breakdown":
    selectedElement = COST_BREAKDOWN;
    break;

  default:
    throw new Error(`Unknown ELEMENT_TYPE: ${ELEMENT_TYPE}`);
}

output.ai_summary = selectedElement;

// ============================================================================
// AI-POWERED PLAN DOCUMENT SEARCH
// Figma: December Release → AI Doc Search
// ============================================================================
output.benefits_ai_doc_search = {
    // ===== FTU BANNER =====
    aiPlanSearchBanner: "AI-Powered Plan Search is Here!",

    // ===== HEADER =====
    planDocSearchTitle: "Plan document search",
    benefitsAndPlanDocsTitle: "Benefits & plan documents",

    // ===== SEARCH SECTION =====
    searchInPlanDocsField: "Search in plan documents",
    searchPlaceholderText: "We'll search your plan to find what you need.",
    tryQuestionsPrompt: "Try questions like:",
    quickFindText: "Quickly find answers in your plan documents.",
    goBtn: "Go",
    searchBtn: "Search",

    // ===== RESULTS =====
    resultsHeadingPattern: "Results for \".*\"",
    pagesInPlanDocsPattern: "\\d+ pages in your plan documents",
    pageReferencePattern: "Page \\d+",
    viewPlanDocsPDFBtn: "View plan documents PDF",

    // ===== OVERVIEW (plan benefits listed) =====
    overviewLabel: "Overview",
    serviceUsageLabel: "Service usage",
    knowYourCostsLabel: "Know your costs",
    trackServicesLink: "Track how you've used covered services this plan year.",
    understandCostsLink: "Understand how your plan structures service prices.",
    viewAllCoveredServices: "View all of your covered services.",

    // ===== EMPTY / ERROR STATE =====
    errorMessage: "Something went wrong",
    tryAgainBtn: "Please try again later.",

    // ===== COMMON =====
    backBtn: "Back",
    cancelBtn: "Cancel",
    continueBtn: "Continue",
    dismissBtn: "Dismiss",
};
