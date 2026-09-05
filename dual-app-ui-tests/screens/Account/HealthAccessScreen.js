const __platform = maestro.platform.toLowerCase() === "ios" ? "ios" : "android";
const __isIOS = __platform === 'ios';

output.account_healthAccess = {
    healthDataAccessTitle: "Health data access",
    connectedAppsLabel: "Connected Apps",
    connectedAppsHeader: "Connected Apps",
    manageAppsMsg: ".*manage which apps.*",
    connectedLabel: "Connected",
    disconnectBtn: "Disconnect",
    connectBtn: "Connect",
    allowBtn: "Allow",
    healthRecordsAccessMsg: "health records access message",
};
