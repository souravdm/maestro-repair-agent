const __platform = maestro.platform.toLowerCase() === "ios" ? "ios" : "android";
const __isIOS = __platform === 'ios';

// ========================================================================
// HAIO PREFERENCES - MAIN SCREEN
// ========================================================================
output.haio_preferences = {
    // Main preferences screen
    preferencesTitle: "Assistant preferences",
    chatSettingsOption: "Chat settings",
    chatHistoryOption: "Chat & search history",
    memoriesOption: "Memories",
    connectionsConsentsOption: "Connections & consents",

    // Chat & search history sub-screen
    chatHistoryTitle: "Chat & search history",
    searchChatsField: "Search chats",
    recentChatsLabel: "Recent chats",
    recentSearchesLabel: "Recent searches",
    newChatOrSearchBtn: "New chat or search",

    // Example chat history items (for assertions)
    chatItem1: "Checking in on overall health",
    chatItem2: "Review of visit with Dr. Smith on 12/7",
    searchItem1: "Dr. Emily Smith",
    searchItem2: "Semaglutide",

    // Navigation
    backBtn: __isIOS ? "Back" : "Navigate up",
};
