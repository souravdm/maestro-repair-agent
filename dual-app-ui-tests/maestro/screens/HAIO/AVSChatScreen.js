const __platform = maestro.platform.toLowerCase() === "ios" ? "ios" : "android";
const __isIOS = __platform === 'ios';

// ========================================================================
// AVS CHAT SCREEN - AFTER VISIT SUMMARY CHAT VIEW
// Figma ref: H100 Beta node 74:8848, section "MVP-2-26 - After Visit Summary"
// ========================================================================
output.haio_avs_chat = {
    // Agent initial chat (first bot message before AVS cards)
    agentInitialMsg: ".*I've got some updates.*|.*based on your recent visit.*",
    agentInitialCard: ".*Visit Summary.*|.*recent visit.*",

    // AV Summary card (state 4 — summary with medication/diagnosis)
    avSummaryCardHeading: ".*Visit Summary.*|.*Your visit.*",
    avSummaryCardProvider: ".*Emily Smith.*|Dr\..*|.*FNP-BC.*",
    avSummaryCardDate: ".*Jan.*|.*Feb.*|.*Mar.*|.*\\d{1,2}/\\d{1,2}.*",
    avSummaryCardText: ".*Diagnosis.*|.*Medications.*|.*Vaccines.*",
    avSummaryExpandBtn: "See more|View details|Expand",

    // AV Summary card (state 5 — expanded/full detail)
    avSummaryExpandedMedications: "Medications",
    avSummaryExpandedDiagnosis: "Diagnosis",
    avSummaryExpandedVaccines: "Vaccines",
    avSummaryExpandedProvider: "Provider",
    avSummaryCollapseBtn: "See less|Collapse",

    // NBA card (next best action after AVS)
    avNbaCardHeading: ".*Next steps.*|.*Recommended.*|.*Based on your visit.*",
    avNbaCardCta: ".*Schedule.*|.*View.*|.*Book.*",
    avNbaWalkInVax: "Walk-In Flu Vax",
    avNbaMedReminder: ".*medication reminder.*|.*Reminder.*",

    // AV Trend card
    avTrendCardHeading: ".*Health trends.*|.*Your health.*|.*Trends.*",
    avTrendCardText: ".*over the past.*|.*compared to.*",

    // Non-emergency escalation
    nonEmergencyEscalationMsg: ".*non-emergency.*|.*connect you with.*|.*transfer.*",
    nonEmergencyEscalationCta: "Find a location|Schedule.*|Store hours",
    storeHoursBottomSheet: "Store hours|Pharmacy hours",
    storeHoursCloseBtn: __isIOS ? "Close" : "Dismiss",

    // Single-select bottom sheet (e.g. store location selection)
    singleSelectSheet: "Select a location|Choose a store",
    singleSelectOption: ".*CVS Pharmacy.*|.*MinuteClinic.*",

    // Chat input (shared with ChatScreen)
    messageInputField: "Type a message.*|Your message,",
    sendBtn: "Send Message",

    // Bot states
    botThinkingIndicator: "typing|.*thinking.*",

    // Response utility actions
    copyResponseBtn: "Copy",
    feedbackThumbsUp: "Helpful",
    feedbackThumbsDown: "Not helpful",

    // Navigation
    backBtn: __isIOS ? "Back" : "Navigate up",
    endChatBtn: "End chat",
    endChatConfirmHeader: "Are you sure you want to end this chat?",
    noBtn: "No",
    yesBtn: "Yes",
};
