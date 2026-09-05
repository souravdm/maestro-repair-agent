const __platform = maestro.platform.toLowerCase() === "ios" ? "ios" : "android";
const __isIOS = __platform === 'ios';

// ========================================================================
// COUNSEL SCREEN - SUB-AGENT CLINICAL ESCALATIONS
// Figma ref: H100 Beta node 74:8848, section "MVP-2-26 - Counsel Sub Agent Escalations"
// ========================================================================
output.haio_counsel = {
    // Symptom entry (counsel sub-agent activation)
    counselSymptomInput: "Describe your symptoms.*|What symptoms.*|Tell me.*",
    counselSymptomSendBtn: "Send Message",
    counselSubAgentGreeting: ".*I can help with.*symptoms.*|.*Tell me more.*",

    // Emergency escalation card
    emergencyEscalationHeading: ".*Emergency.*|.*Call 911.*|.*Seek immediate.*",
    emergencyEscalationBody: ".*please call 911.*|.*emergency services.*|.*immediate attention.*",
    emergencyCallCta: "Call 911",
    emergencyEscalationDisclaimer: ".*disclaimer.*|.*not a substitute.*|.*professional.*",

    // SLA / response time disclaimer
    slaDisclaimer: ".*response time.*|.*available.*|.*connect you within.*",
    slaDisclaimerScrolledBottom: ".*privacy policy.*|.*terms.*|.*understand.*",

    // Scheduling experience bottom sheet (triggered after escalation CTA)
    schedulingSheetTitle: "Schedule.*|Book.*|Find care",
    schedulingSheetProviderOption: ".*MinuteClinic.*|.*provider.*|.*clinic.*",
    schedulingSheetCloseBtn: __isIOS ? "Close" : "Dismiss",

    // Non-emergency / de-escalation card
    deEscalationHeading: ".*Based on your symptoms.*|.*sounds like.*|.*recommend.*",
    deEscalationBody: ".*UTI.*|.*GI.*|.*behavioral health.*|.*self-care.*",
    deEscalationCta: ".*View options.*|.*See resources.*|.*Learn more.*",

    // Behavioral health escalation (TC022)
    behavioralHealthEscalationMsg: ".*mental health.*|.*behavioral health.*|.*crisis line.*",
    behavioralHealthCrisisLine: "988|Crisis line|.*crisis.*",

    // GI escalation (TC023)
    giEscalationMsg: ".*gastrointestinal.*|.*GI.*|.*stomach.*|.*severe pain.*",

    // UTI de-escalation (TC024)
    utiDeEscalationMsg: ".*UTI.*|.*urinary tract.*",
    utiSelfCareMsg: ".*self-care.*|.*hydrate.*|.*over-the-counter.*",

    // Adding disclaimer scrolled state
    addingDisclaimerScrolled: ".*Adding disclaimer.*|.*scroll to bottom.*",

    // Bot states
    botThinkingIndicator: "typing|.*thinking.*",

    // Navigation
    backBtn: __isIOS ? "Back" : "Navigate up",
    endChatBtn: "End chat",
    viewUiKitLink: "View UI Kit Here",
};
