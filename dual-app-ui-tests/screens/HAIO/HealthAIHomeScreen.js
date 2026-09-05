const __platform = maestro.platform.toLowerCase() === "ios" ? "ios" : "android";
const __isIOS = __platform === 'ios';

// ========================================================================
// HEALTH AI HOME SCREEN - LANDING VIEW & ENTRY POINTS
// Figma ref: H100 Beta node 74:8848, section "Access Points & Assistant Nav Framework"
// ========================================================================
output.haio_ai_home = {
    // Main landing view
    healthAssistantTitle: "Haio",
    greetingMsg: "(?i).*(Hi|health assistant|support).*",
    learnMoreLink: "(?i).*Learn more.*",
    greetingLockup: "Welcome back!.*|Hi.*",
    greetingSubcopy: ".*some updates for you based on your recent visit.*|.*How can I help you today.*",

    // FAB entry point (global, on Health home page)
    assistantFab: __isIOS ? "Utility Icons.*|sparkles.*" : "Open Health Assistant",
    fabBtn: ".*assistant.*|.*AI.*",

    // Bottom nav morphed state (input bar replaces tab bar when chat is active)
    bottomNavInputBar: "Your message,|Search or ask anything.*",
    morphedInputField: "Your message,",

    // Quick reply chips (home-level suggestions)
    quickReplyTrackSymptoms: "Track symptoms",
    quickReplyProactiveCare: "Proactive care",
    quickReplyHealthVisit: "Health visit",
    quickReplyRecentVisit: "Review my recent visit.*",
    quickReplySemaglutide: ".*Semaglutide.*",

    // Prompt suggestions shown on landing
    promptSuggestion1: "Review my recent visit with.*",
    promptSuggestion2: "What should I expect from my new.*",

    // Chat entry input
    chatInputField: "Ask anything\\..*|Search or ask anything.*|Your message,",
    sendBtn: "Send Message",

    // Navigation controls
    preferencesBtn: __isIOS ? "Preferences" : "Settings",
    closeBtn: "Close",
    backBtn: "Back",

    // Guest / unauthenticated state
    loginOrSignUpBtn: "Login or sign up",
    guestEducationTitle: "Health Assistant",
    guestLearnMoreLink: "Learn more",
};
