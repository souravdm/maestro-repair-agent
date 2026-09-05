// Smart Scheduler (Care Routing Sub-Agent) - Screen: MCAsyncScreen
const __isIOS = maestro.platform.toLowerCase() === "ios";

output.mc_async = {
    costDisplayMsg: __isIOS ? "For \\$29.*share your symptoms.*|For \\$29.*treatment plan.*" : "For \\$29.*share your symptoms.*|For \\$29.*treatment plan.*",
    prescreenHeader: "Are you experiencing.*|Tell us about.*|Have you.*",
    q1SymptomsHeader: "Are you experiencing any of the following symptoms.*",
    q2LocationHeader: "Where do you have acne.*",
    q3DescriptionHeader: "Tell us more about your acne.*",
    q4TreatmentsHeader: "Have you tried any of the following acne treatments.*",
    q5MedicationsHeader: "Are you experiencing or taking any of the following.*",
    q6PregnancyHeader: "Are you pregnant.*trying to get pregnant.*breastfeeding.*",
    q7MedicalHistoryHeader: "Have you ever been diagnosed.*",
    q8BiopsyHeader: "Have you ever had a biopsy.*",
    continueBtn: "Continue|Next",
    selectOptionCheckbox: __isIOS ? "checkbox.*|option.*" : "checkbox.*|option.*",
    noneAboveOption: "None of the above|None",
    ineligibleMsg: "ineligible.*|not eligible.*|can't provide care.*",
    caregiverBlockedMsg: "not available.*caregivee.*|caregivee.*not supported.*",
    providerGreetingMsg: "Great, how would you like to connect.*",
    connectOptions: "Connect with a provider|Video visit|Async visit"
};
