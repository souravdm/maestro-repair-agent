const __platform = maestro.platform.toLowerCase() === "ios" ? "ios" : "android";
const __isIOS = __platform === 'ios';

output.superapp_helpCenter = {
    // Header
    helpCenterTitle: "Help center|Help Center",
    howCanWeHelpTitle: "How can we help?",
    popularQuestionsTitle: "Popular questions",

    // FAQ
    faqSection: "FAQ.*|Frequently asked questions",

    // Contact Options
    contactUsBtn: "Contact us|Contact Us",
    callPharmacyBtn: "Call pharmacy|Call Pharmacy",
    liveChatBtn: "Live chat|Live Chat",

    // Search
    searchHelpField: "Search help center|Search help.*",

    // Filtering
    filteringByLabel: "Filtering by:",
    statusFilterBtn: "statusFilterButton",
    timeFilterBtn: "timeFilterButton",
}
