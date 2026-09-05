// Smart Scheduler (Care Routing Sub-Agent) - Screen: SmartSchedulerScreen
const __isIOS = maestro.platform.toLowerCase() === "ios";

output.smart_scheduler = {
    chatInputField: __isIOS ? "Ask anything.*" : "Ask anything.*",
    chatInputFieldIndex: __isIOS ? 0 : 0,
    sendBtn: "Send Message",
    typingIndicator: __isIOS ? ".*\\.+" : "Loading.*|Thinking.*|typing indicator",
    greetingMsg: "Hi.*scheduling assistant.*|How can I help today.*|Hi.*How can I help.*",
    scheduleCareQuickReply: "Schedule care|Schedule a visit",
    quickReplyUpdatePrefs: "Update visit preferences",
    quickReplyExternalProviders: "Search for external providers",
    nbaFindCareBtn: "Find care with scheduling tool",
    chatBubbleText: __isIOS ? ".*" : ".*",
    errorMsg: "Something went wrong.*|I'm having issues.*|I wasn't able to.*",
    retryBtn: "Try again|try again",
    visitPreferencesCard: "Visit reason.*|Visit preferences.*",
    patientLabel: "Patient:.*",
    locationLabel: "Location:.*",
    timeLabel: "Time requested:.*"
};
