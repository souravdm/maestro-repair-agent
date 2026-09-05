const __platform = maestro.platform.toLowerCase() === "ios" ? "ios" : "android";
const __isIOS = __platform === 'ios';

// ========================================================================
// HAIO CHAT SCREEN - CONVERSATION VIEW
// ========================================================================
output.haio_chat = {
    // Chat response view
    recentVisitsHeading: "(?i).*(Recent visits|recent visits).*",
    visitSummaryCard: "Visit with.*",
    doctorName: "Dr..*",
    visitDate: ".*/.*/.*",

    // Follow-up prompts
    followUpQuestion: ".*Let me know if you'd like to review either of your.*visits",
    myPrescriptionBtn: "Go to my prescriptions",

    // Quick reply options
    showMoreVisitsBtn: "Show more visits",
    reviewHealthRecordsBtn: "Review my health records",
    selectAnOptionsBtn: "Select an options",
    allsetNow: "I am all set for now",

    // Chat input
    messageInputField: "Type a message.*",
    messageInputA11y: "Your message,",
    yourMessageA11y: "your message",
    sendBtn: "Send Message",
    voiceInputBtn: __isIOS ? "Voice input" : "Microphone",
    dictationBtn: "Dictation",

    // Media picker
    cameraBtn: "Camera",
    photoLibraryBtn: "Photo Library",
    uploadBtn: "upload",

    // Message states
    receivedFromBotA11y: "received from bot",
    readByRecipientA11y: "read by recipient",
    deliveredToRecipientA11y: "delivered to recipient",
    botThinkingIndicator: "CVS Virtual Assistant,.*",
    typingIndicatorA11y: "^\\.+$|Getting this squared away",

    // Transfer states
    transferMsg: "You are being transferred.",
    connectedMsg: "All set – you're now connected. Pharmacy Technician has joined the chat.",

    // Response actions
    copyResponseBtn: "Copy",
    shareResponseBtn: "Share",
    feedbackThumbsUpBtn: "Helpful",
    feedbackThumbsDownBtn: "Not helpful",

    // Navigation
    backToChatBtn: __isIOS ? "Back" : "Navigate up",
    newChatBtn: "New chat",
    closeBtn: "Close",
    endChatBtn: "End chat",
    endChatAlertHeader: "Are you sure you want to end the conversation?",
    noBtn: "No",
    yesBtn: "Yes",

    // Error states
    errorMsg: "Something went wrong.*",
    outsideScope: "That's outside what i can help.*",
    failedToLoadMsg: "Failed to load pass.",
    retryBtn: "Try again",
    offlineMsg: "No internet connection",
    requiredLabel: "Required",
    unableMsg: "I'm sorry, but I'm unable to answer that question.*"
};
