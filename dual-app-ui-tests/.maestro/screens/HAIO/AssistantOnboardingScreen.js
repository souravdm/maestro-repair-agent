const __platform = maestro.platform.toLowerCase() === "ios" ? "ios" : "android";
const __isIOS = __platform === 'ios';

// ========================================================================
// ASSISTANT ONBOARDING SCREEN - EDUCATION, RECORDS CONNECT, PUSH ENROLLMENT
// Figma ref: H100 Beta node 74:8848, section "MVP 2-26 - Assistant Onboarding & Records Connect Variations"
// ========================================================================
output.haio_onboarding = {
    // Education screen (signed-in)
    educationTitle: "Health Assistant|Meet your.*assistant",
    educationSubcopy: ".*personalized.*|.*health.*|.*AI.*",
    educationGetStartedBtn: "Get started|Continue",
    educationLearnMoreLink: "Learn more",
    educationLogo: ".*CVS.*|.*Health.*",

    // Education screen (guest/unauthenticated — V2 GUEST variant)
    guestEducationTitle: "Health Assistant",
    guestEducationBody: ".*sign in.*|.*create an account.*|.*logged in.*",
    guestLoginBtn: "Login or sign up|Sign in",
    guestMaybeLaterBtn: "Maybe later|Not now|Skip",

    // Push notification enrollment
    pushEnrollmentTitle: "Stay on top of your health|Notifications",
    pushEnrollmentBody: ".*notifications.*|.*updates.*|.*reminders.*",
    pushAllowBtn: "Allow Notifications|Allow",
    pushSkipBtn: "Not now|Skip|Maybe later",

    // Records connect flow
    recordsConnectTitle: "Connect your records|Health records",
    recordsConnectBody: ".*connect.*|.*medical records.*|.*providers.*",
    recordsConnectListItem: ".*UMass.*|.*Memorial.*|.*provider.*",
    recordsConnectAuthorizeBtn: "Authorize|Connect|Allow access",
    recordsConnectSkipBtn: "Skip|Not now",
    recordsConnectSuccessMsg: ".*connected.*|.*records linked.*",

    // Spending detail / plan year reference shown during onboarding
    spendingDetailTitle: "Medical Spending|.*spending.*",
    spendingDetailAmount: ".*\\$.*|.*billed.*",

    // Onboarding pagination / stepper
    onboardingNextBtn: "Next|Continue",
    onboardingBackBtn: __isIOS ? "Back" : "Navigate up",
    onboardingDoneBtn: "Done|Finish",
    onboardingStepIndicator: ".*of.*|Step.*",

    // App onboarding reference (Haio prompt from home screen)
    haioHomePrompt: "Haio, Show me my recent appointments",
};
