const __platform = maestro.platform.toLowerCase() === "ios" ? "ios" : "android";
const __isIOS = __platform === 'ios';

output.account_onboarding = {
    // ========================================================================
    // SPLASH & WELCOME SCREENS
    // ========================================================================

    // Splash Screen
    splashTitle: "CVS Pharmacy",
    welcomeToCvsMsg: "Welcome to CVS",
    welcomeTitle: "CVS Health",
    welcomeVariant: "CVS Pharmacy|Welcome to CVS",

    // Welcome Message
    niceToSeeYouMsg: "Nice to see you!",
    letsGetStartedMsg: "Let’s get you started",
    letsGetStartedBtn: __isIOS ? "Let’s get started" : "Let's get started",
    healthInPocketMsg: "We put better health in your pocket.",
    getStartedBtn: "Get started",

    // Sign in or create an account Page
    signInOrCreateTitle: "(?i).*(Sign in or create an account).*",
    firstCheckExtraCareLabel: "First, we’ll check to see if you already have an account or ExtraCare® membership.",
    mobileOrEmailLabel: "Mobile number or email",
    faceIdToggle: "Face ID",
    keepMeSignedInToggle: "Keep me signed in",
    continueBtn: "Continue",
};

output.account_health100_onboarding = {
    // ========================================================================
    // ho1.00 SHAPE THE FUTURE SCREEN (shown once, right after invite code is validated)
    // ========================================================================
    shapeFutureTitle: "Shape the future of health and care",
    shapeFutureContinueBtn: "Continue",

    // ========================================================================
    // ho1.01 TERMS & CONDITIONS SCREEN
    // ========================================================================
    termsTitle: "Terms & conditions",
    termsBody: "By continuing you accept the Health100™ Terms of Use and Health100 Privacy Policy.",
    termsOfUseLink: "Health100 Terms of Use",
    privacyPolicyLink: "Health100 Privacy Policy",
    iAgreeBtn: "I agree",

    // ========================================================================
    // ho1.02 EDUCATION SCREEN 1
    // ========================================================================
    edu1Title: "Managing your health just got simpler",
    edu1Body: "Health100™ brings your health information into one clear view, so you can focus on what matters most.",
    onboardingContinueBtn: "Continue",
    // Image text elements visible on Edu-1 screen
    edu1Image: __isIOS ? "h100-manageHealthEducation-headerImage|Health100 logo with a woman looking up at the sky with notifications for prescriptions and a record low weigh in." : "Education illustration",
    edu1ImageWeightTrends: "Weight Trends",
    edu1ImageSmartScale: "Connected smart scale",
    edu1ImageNewRecord: "New record low weigh in!",
    edu1ImageReady: "Ready",
    edu1ImageMedication: "Esomeprazole.*40mg tablet",

    // ========================================================================
    // ho1.03 EDUCATION SCREEN 2
    // ========================================================================
    edu2Title: "A trusted partner that has your back",
    edu2Body: "Get timely insights, reminders and guidance so you can stay on track with your health goals and move forward with confidence.",
    edu2AiNotification: __isIOS ? "h100-trustedPartnerEducation-headerImage|Health100 logo with a biker in the mountains getting an AI insight, 'Your active biking heart rate has improved!'" : "Education illustration",
    getStartedBtn: "Get started",

    // ========================================================================
    // ho1.04 GET STARTED (First-Time User)
    // ========================================================================
    letsGetStartedTitle: "Let's get you started",
    welcomeTitle: "Let's get you started in Health100™",
    getStartedBody: "Choose how you'd like to sign in or create an account.*",
    getStartedDisclaimer: "When you create a Health100 account, you can view your health information.*",
    continueWithMobileOrEmail: "Continue with mobile number or email",
    continueWithCvsHealth: "Continue with CVS Health®",
    continueWithOurPartners: "(?i)Continue with our partners",
    continueWithApple: "Continue with Apple",
    continueAsAGuest: "Continue as a guest",

    // ========================================================================
    // ho1.05 GET STARTED - RETURNING USER
    // ========================================================================
    welcomeToHealth100Title: "Welcome to Health100™",
    returningBody: "Choose how you'd like to sign in or create an account.*",

    // ========================================================================
    // ho1.06 SIGN IN WITH HEALTH100 - TOGGLES
    // ========================================================================
    signInOrCreateTitle: "Sign in or create an account",
    mobileOrEmailLabel: "Mobile number or email",
    faceIdToggle: "Face ID",
    keepMeSignedInToggle: "Keep me signed in",
    h100ContinueBtn: "Continue",
    h100BackBtn: "Back",

    // ========================================================================
    // ho1.18 PUSH NOTIFICATION ENROLLMENT
    // ========================================================================
    pushNotifTitle: "Stay a step ahead with notifications",
    pushNotifBody: "Get helpful reminders such as:",
    pushNotifBullet1: "Prescription updates for yourself and those you care for",
    pushNotifBullet2: "Changes in your connected health records",
    pushNotifBullet3: "Upcoming appointments and next steps",
    turnOnNotificationsBtn: "Turn on notifications",
    pushNotifNotNowBtn: "Not now",

    // ========================================================================
    // ho1.01 SIMPLIFY YOUR SIGN IN
    // ========================================================================
    simplifySignInTitle: "Simplify your sign in",
    simplifySignInBody: "Skip the code and get in faster.",
    simplifyKeepMeSignedIn: "Keep me signed in",
    simplifyFaceId: "Face ID",
    simplifyContinueBtn: "Continue",
};
