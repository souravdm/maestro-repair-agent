// ProviderMessagingScreen.js
// Screen elements for provider messaging and care team conversations

const __platform = maestro.platform.toLowerCase() === "ios" ? "ios" : "android";
const __isIOS = __platform === 'ios';

output.health_providerMessaging = {

    // --- Header ---
    providerMessaging: "Provider messaging",

    // --- Conversations ---
    conversations: "Conversations",
    startAConversation: "Start a conversation",
    startANewMessage: "Start a new message",
    newMessage: "New Message",
    newConversation: "New conversation",
    noConversationsYet: "No conversations yet",
    backToConversations: "Back to Conversations",

    // --- Message Composition ---
    sendAMessage: "Send a message",
    messageCareTeam: "Message care team",
    topic: "Topic",
    subjectLine: "Subject line",
    keepEditing: "Keep editing",
    delete: "Delete",

    // --- Attachments ---
    attachAFile: "Attach a file",
    downloadFile: "Download file",
    fileAttached: "File attached",

    // --- Prescription Renewals ---
    renewPrescriptions: "Renew prescriptions",
    startARenewal: "Start a renewal",
    renewalRequest: "Renewal request",

    // --- Provider Selection ---
    selectAProvider: "Select a provider",
    yourCareTeam: "Your care team",

    // --- Message Status ---
    yesterday: "Yesterday",
    unread: "Unread",
    conservationExpired: "Conservation expired",
    weveReceivedYourMessage: "We've received your message",

    // --- Navigation ---
    messaging: "Messaging",
    startConversation: "Start conversation",
    startARenewal: "Start a renewal",

    // --- Support ---
    callCustomerService: "Call customer service"
};
