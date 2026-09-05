// Smart Scheduler (Care Routing Sub-Agent) - Screen: ProviderSearchScreen
const __isIOS = maestro.platform.toLowerCase() === "ios";

output.provider_search = {
    searchHeader: "What's the provider's name.*|What name or specialty.*|I'll help you find.*",
    providerCard: __isIOS ? "provider.*card.*|result.*card.*" : "provider.*card.*|result.*card.*",
    providerName: "Dr\\..*|.*MD.*|.*DO.*|.*NP.*|.*PA.*",
    providerAddress: "\\d+.*St.*|\\d+.*Ave.*|\\d+.*Blvd.*|\\d+.*Dr.*|\\d+.*Rd.*",
    multipleLocationsMsg: "multiple locations.*|Select an address.*",
    locationSelector: __isIOS ? "\\d+.*,.*[A-Z]{2}.*" : "\\d+.*,.*[A-Z]{2}.*",
    noAddressMsg: "No address on file.*",
    noProvidersMsg: "couldn't find any providers.*|no providers.*",
    searchResultsHeader: "Here are the best matches.*",
    billingTypePrompt: "Select your billing type.*",
    billingTypeOption: "Insurance|Self-pay|self pay|In-network|Out-of-network",
    phoneNumberPrompt: "call.*office|contact.*provider",
    noPhoneMsg: "doesn't have a phone number on file.*|not available.*no phone.*",
    oakStreetAgeMsg: "Oak Street Health serves patients 65.*",
    emergencyMsg: "For emergencies, call 911.*",
    submittingMsg: "request is submitted.*call.*office.*schedule.*",
    invalidStateMsg: "don't recognize.*US state.*|Enter the state again.*"
};
