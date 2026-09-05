const __platform = maestro.platform.toLowerCase() === "ios" ? "ios" : "android";
const __isIOS = __platform === 'ios';

// ========================================================================
// HAIO HOME SCREEN - HEALTH AI ASSISTANT
// ========================================================================
output.haio_home = {
    // Main home screen
    backBtn: "Back",
    healthAssistantTitle: "Haio",
    greetingMsg: "Hi.*|.*How can I help you today?.*",
    learnMoreLink: "Learn more",
    welcomeBackMsg: "Welcome back! I've got some updates for you based on your recent visit with.*",

    // Prompt suggestions (example prompts visible on home)
    promptSuggestion1: "Review my recent visit with Emily Smith, FNP-BC",
    promptSuggestion2: "What should I expect from my new Semaglutide dose?",

    // Quick reply buttons
    trackSymptomsBtn: "Track symptoms",
    proactiveCareBtn: "Proactive care",
    healthVisitBtn: "Health visit",

    // Entry field
    chatInputField: "Ask anything\\..*|Search or ask anything.*|Your message,",
    sendBtn: "Send Message",

    // Navigation
    preferencesBtn: __isIOS ? "Preferences" : "Settings",
    closeBtn: "Close",
    loginOrSignUpBtn: "Login or sign up",
};
