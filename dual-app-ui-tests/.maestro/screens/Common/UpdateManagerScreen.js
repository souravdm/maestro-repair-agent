const __platform = maestro.platform.toLowerCase() === "ios" ? "ios" : "android";
const __isIOS = __platform === 'ios';

output.general_updateManager = {
    // Update Alert
    updateAvailableAlert: "Update available|Update Available",

    // Actions
    updateNowBtn: "Update Now|Update now",
    notNowBtn: __isIOS ? "Not Now" : "Not now",

    // Messages
    forceUpdateMsg: "You must update.*|A required update.*|Please update.*",
    recommendedUpdateMsg: "A new version.*|An update is available.*|We recommend.*",
}
