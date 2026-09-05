// Smart Scheduler (Care Routing Sub-Agent) - Screen: CounselHealthScreen
const __isIOS = maestro.platform.toLowerCase() === "ios";

output.counsel_health = {
    legalModalHeader: "Before you continue.*|Privacy.*|Terms.*",
    hipaaText: "HIPAA.*SOC2.*|encrypted.*secure.*|Counsel is a medical group.*",
    acceptLegalBtn: "Accept|I agree|Agree|Continue",
    webviewHeader: "Counsel Health|counsel.*health",
    importInfoBtn: "Import my information",
    signUpManuallyBtn: "Sign-up manually|Sign up manually",
    createAccountBtn: "Create an account",
    importInfoDesc: "transfer name.*birthday.*email.*|import.*information.*",
    signUpManuallyDesc: "Enter your information.*",
    reentryBtn: "Chat with a physician|Continue to Counsel.*|Open Counsel.*",
    returningUserMsg: "already have a subscription.*chat with a physician.*|subscription.*physician.*",
    continueSubscriptionBtn: "Continue|Yes.*continue",
    closeBtn: __isIOS ? "Close|Done|Back" : "Navigate up|Close|Back",
    registeredConfirmMsg: "Sounds good.*subscription.*|subscription.*chat.*physician.*",
    unregisteredEligibleMsg: "eligible.*Counsel.*|can connect.*physician.*",
    caregiverBlockedMsg: "not available.*caregivee.*|caregivee.*not supported.*"
};
