const __platform = maestro.platform.toLowerCase() === "ios" ? "ios" : "android";
const __isIOS = __platform === 'ios';

output.account_manageConnections = {
    // CVS Health Family of Companies
    cvsHealthFamilyNavBar: "CVS Health family of companies",
    cvsHealthFamilyHeader: "Connected companies",
    aetnaBtn: "Aetna",
    aetnaDescription: "Health insurance",
    aetnaConnected: "Connected",
    aetnaNotConnected: "Not connected",
    connectAetnaBtn: "Connect Aetna",
    disconnectAetnaBtn: "Disconnect Aetna",
    
    caremarkBtn: "Caremark",
    caremarkDescription: "Pharmacy benefits",
    caremarkConnected: "Connected",
    caremarkNotConnected: "Not connected",
    connectCaremarkBtn: "Connect Caremark",
    disconnectCaremarkBtn: "Disconnect Caremark",
    
    // Health Providers & Facilities
    healthProvidersNavBar: "Health providers & facilities",
    healthProvidersHeader: "Connected providers",
    noProvidersMsg: "No providers connected",
    addProviderBtn: "Add provider",
    providerName: ".*",
    providerType: ".*",
    disconnectProviderBtn: "Disconnect",
    
    // Shared Medical Records
    sharedMedicalRecordsNavBar: "Shared medical records",
    sharedRecordsHeader: "Shared records",
    noSharedRecordsMsg: "No shared records",
    shareRecordsBtn: "Share records",
    sharedWithLabel: "Shared with",
    sharedWithValue: ".*",
    revokeAccessBtn: "Revoke access",
    
    // Common Elements
    backBtn: "Back",
    disclosureIndicator: ">",
    connectedIcon: "id:connectedIcon",
    notConnectedIcon: "id:notConnectedIcon",
    
    // Actions
    connectBtn: "Connect",
    disconnectBtn: "Disconnect",
    saveBtn: "Save",
    cancelBtn: "Cancel",
    confirmBtn: "Confirm",
    
    // Success Messages
    connectionSuccessMsg: "Connected successfully",
    disconnectionSuccessMsg: "Disconnected successfully",
    recordsSharedMsg: "Records shared successfully",
    accessRevokedMsg: "Access revoked",
};
