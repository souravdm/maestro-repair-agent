const __platform = maestro.platform.toLowerCase() === "ios" ? "ios" : "android";
const __isIOS = __platform === 'ios';

output.health_externalRecords = {
    // Header
    externalRecordsTitle: "External Records|External records",

    // Connected Sources
    connectedSources: "Connected sources|Connected Sources",

    // Actions
    connectNewSourceBtn: "Connect new source|Connect New Source",
    disconnectBtn: "Disconnect",

    // Status
    syncStatus: "Synced.*|Last synced.*|Sync status.*",

    // Connection Management (Android)
    connectYourRecords: "Connect your records",
    connectHealthRecords: "Connect health records",
    connectedRecords: "Connected records",
    manageConnections: "Manage connections",
    connections: "Connections",
    addConnection: "Add connection",
    removeConnection: "Remove connection",
    reconnect: "Reconnect",
    remove: "Remove",
    connected: "Connected",
    notConnected: "Not connected",
    needsAttention: "Needs attention",
    expiredConnection: "Expired connection",
    connectionUnsuccessful: "Connection unsuccessful",
    retryConnecting: "Retry connecting",
    connectAnotherRecord: "Connect another record",

    // Search & Discovery (Android)
    hospitalOrProviderNetwork: "Hospital or provider network",
    searchForAProvider: "Search for a provider",
    addIndividualProviders: "Add individual providers",
    addAllAvailableRecords: "Add all available records at once",
    addFromCvsHealth: "Add from CVS Health® and partners",
    suggestedConnections: "Suggested connections:",
    helpMeChoose: "Help me choose",

    // Connection Methods (Android)
    howWouldYouLikeToConnect: "How would you like to connect records?",
    agreeAndContinue: "Agree and continue",
    acceptAndContinue: "Accept and continue",
    connectAccount: "Connect account",
    creatingConnection: "Creating connection",
    providerConnected: "Provider connected",

    // Privacy (Android)
    aboutYourPersonalHealthRecord: "About your personal health record",
    manageDataPreferences: "Manage data preferences",
    manageConnectionPermissions: "Manage connection permissions",
    manageConsents: "Manage consents",

    // CVS Sources (Android)
    cvsPharmacy: "CVS Pharmacy®",
    cvsSpecialty: "CVS Specialty®",
    minuteclinicCvsHealthcarePractices: "MinuteClinic® & CVS Healthcare Practices",
    caremarkMailServicePharmacy: "Caremark® Mail Service Pharmacy",
    oakStreetHealth: "Oak Street Health®",

    // Your Records Landing (Android)
    yourRecords: "Your records",
    accessConnectedRecords: "Access connected records",
    viewRecordsFromOther: "View records from other facilities and providers.",
    updateOrViewConnections: "Update or view connections with other facilities and providers.",
    health100Label: "Health100™",
    connect: "Connect",
    viewConnections: "View Connections",
    viewRecords: "View records",

    // Errors (Android)
    couldntLoadConnections: "Couldn't load connections",
    troubleConnecting: "We're having trouble connecting to our system. Please try again.",
    someRecordsConnected: "Some records connected",
}
