const __platform = maestro.platform.toLowerCase() === "ios" ? "ios" : "android";
const __isIOS = __platform === 'ios';

output.superapp_search = {
    // Search Input
    searchField: "Search.*",
    searchOrAskQuestionField: "Search or ask a question",
    searchCvsOrAskField: "Search CVS or ask a question",
    findProductsField: "Find products and services",
    searchForYourNeedsField: "Search for your needs",
    searchBtn: "Search",
    cancelBtn: "Cancel",
    scanBarcodeBtn: "Scan barcode",

    // Search History & Suggestions
    recentSearches: "Recent searches|Recent Searches",
    trendingSearches: "Trending searches|Trending Searches",
    searchSuggestions: "Suggestions.*",
    trendingSection: "Trending",
    questionsSection: "Questions",

    // Results
    searchResultsTitle: "Search Results",
    bestMatchResult: "Best match result",
    otherRelevantResults: "Other relevant results",
    productResults: "Products.*|Results.*",
    noResultsMsg: "No results.*|No results found",
    sponsoredLabel: "Sponsored",
    providedByLabel: "Provided by",
    articlesCategory: "Articles",
    healthCareCategory: "Health care",
    viewResultsByCategory: "View results by category",
    restartYourSearchBtn: "Restart your search",

    // Loading & Errors
    loadingMsg: "Loading...",
    troubleConnecting: __isIOS ? "We're having trouble connecting you" : "We\\'re having trouble connecting you",
};

// ========================================================================
// VOICE SEARCH
// ========================================================================
output.superapp_voiceSearch = {
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
};
