const __platform = maestro.platform.toLowerCase() === "ios" ? "ios" : "android";
const __isIOS = __platform === 'ios';

output.common_app_launch = {
    // Welcome & Splash Messages
    niceToSeeYouMsg: "Nice to see you!",
    welcomeMsg: "Welcome",
    welcomeToCvsMsg: "Welcome to CVS",
    welcomeToCvsPharmacyMsg: "Welcome to CVS Pharmacy",
    healthInPocketMsg: "We put better health in your pocket.",
    betterHealthMsg: "Better health in your pocket",

    // Action Buttons
    continueBtn: "Continue",
    continueAsGuestBtn: "Continue as Guest",
    getStartedBtn: "Get started",
    signInBtn: "Sign in",
    createAccountBtn: "Create an account",

    // Permission Prompts
    dontAllowBtn: "Don't Allow",
    allowBtn: "Allow",
    allowWithAppBtn: "Allow While Using App",
    notificationsPrompt: "Would Like to Send You Notifications",
    enableNotificationsPrompt: "Yes, enable notifications",
    notNowBtn: __isIOS ? "Not Now" : "Not now",
    locationPrompt: "use your location",
    bluetoothPrompt: "Would Like to Use Bluetooth",
    okBtn: "OK",

    // Close & Dismiss Actions
    closeId: "close",
    xmarkId: __isIOS ? "xmark.circle.fill" : "close_circle",
    closeMessageBtn: "Close Message",
    closeBtn: "Close",
    dismissBtn: "Dismiss",
    skipBtn: "Skip",
    maybeLaterBtn: "Maybe later",

    // Navigation
    exploreMoreMsg: "Explore More",
    homeTab: "Home",
    accountTab: "Account",

    // Promotional & Tips Overlays
    promotionClose: "Close|Dismiss|Not Now|Skip",
    tipsClose: "Got it|Close|Dismiss|OK",

    // App Launch States
    loadingMsg: "Loading",
    pleaseWaitMsg: "Please wait",
}
