const __platform = maestro.platform.toLowerCase() === "ios" ? "ios" : "android";
const __isIOS = __platform === 'ios';

// Health100 onboarding/welcome screen (appears before email entry on Health100 app)
// Flow: Terms & conditions -> Edu-1 -> Edu-2 -> Get Started -> Sign in -> Push Notifications -> Simplify sign in
output.account_health100_onboarding = {
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
    continueWithPartner: "Continue with our Partners",
    continueWithApple: "Continue with Apple",
    continueAcontinueAsAGuestsAGuest: "Continue as a guest",

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

output.account_h100_login = {
    loginH100Label: "Let's get you started in Health100™",
    continueNumEmailH100Button: "Continue with mobile number or email",
    continueCVSHealthH100Button: "Continue with CVS Health®",
    continueWithOurPartnersButton: "Continue with our partners",
    continueGuestH100Button: "Continue as a guest",
    backButton: "Back",
};

output.account_login = {
    loginTitle: "Welcome back",
    emailLabel: "Mobile number or email",
    emailField: "Mobile number or email.*",
    emailFieldIndex: __isIOS ? 1 : 0,
    passwordLabel: "Password",
    passwordField: "Password.*",
    signInSubmit: "Sign in",
    showPasswordBtn: "Show password",
    continueBtn: "Continue",
    backBtn: "Back",
    forgotPassword: "Forgot password",
    otpTitle: "Enter Code|Enter your code",
    otpHeader: "Enter your code",
    otpField: "Enter Code.*|6-digit code.*",
    otpConfirm: "Confirm Code|Confirm code",
    sendCodeBtn: "Continue|Send code",
    sendCodeAgain: "Send code again",
    sendCodeButton: "Send code|Continue",
    faceIdPrompt: "Sign in with Face ID",
    faceIdSwitch: "Face ID",
    kmsiSwitch: __isIOS ? "1" : "Keep me signed in",
    emailError: "Error: Enter a valid mobile number or email",
    passwordError: "Error: Invalid password",
    invalidPassword: "Your password is incorrect",
    niceToSeeYou: "Nice to see you.*",
    enterMobileMsg: "Enter your mobile number or email to sign in or create an account.",
    
    // Email Validation Errors
    emailRequiredError: "Mobile number or email is required",
    emailInvalidError: "Error: Enter a valid mobile number or email",
    emailNotFoundError: "This account doesn't exist",
    tryAgainBtn: "Try again",

    // Sign In Button (visible on landing page)
    signInBtn: "Sign in",
    signInLink: "Sign In",
    
    // OTP Delivery Method Selection
    // Note: Health100 uses smart/curly apostrophe (U+2019) in "it\u2019s you" which won’t match straight apostrophe
    otpSelectionTitle: "Just need to confirm it's you.|Just need to confirm it’s you.|Just need to verify it’s you.|Choose how to get your code.|We'll send you a 6-digit confirmation code to:",
    otpSelectionSubtitle: "How would you like to verify?|Choose how to get your one-time code",
    otpConfirmSubtitle: "email a code to",
    chooseOtpMethodTitle: "Choose how to get your one-time code.",
    emailOptionBtn: "Email a code to.*",
    smsOptionBtn: "Text message",
    callOptionBtn: "Call me",

    // Error Messages
    networkError: "Network error. Please check your connection.",
    serverError: "Server error. Please try again later.",
    unknownError: "An error occurred. Please try again.",
    accountLockedError: "Your account has been locked. Please contact support.",
    tooManyAttemptsError: "Too many login attempts. Please try again later.",
    
    // Account Recovery
    forgotPasswordTitle: "Reset Your Password",
    forgotPasswordDesc: "Enter your email to reset your password",
    resetPasswordBtn: "Reset Password",
    resetPasswordSentMsg: "Password reset link sent to your email",

    // Session Management
    sessionExpiredMsg: "Your session has expired. Please sign in again.",
    sessionTimeoutMsg: "Session timeout. Please sign in again.",
    
    // Additional UI Elements
    allowPasteBtn: "Allow Paste",
    allowPastePrompt: "Allow Paste|Don't Allow",
    denyPasteBtn: "Don't Allow",
    denyPasteBtnVariant: "Don't Allow Paste",
    enterCodeTitle: "Enter Code|Enter your code",
    enterYourCodeTitle: "Enter your code",
    enterCodePrompt: "Enter Code|Enter your code",
    dobTitle: __isIOS ? "Enter your date of birth" : "Enter your date of\ \nbirth",
    dobField: __isIOS ? "Date of Birth MMDDYYYY" : "Date of birth",
    dobValidationError: "Enter a valid date of birth",
    // CVS Health needs index, Health 100 doesn't (set to undefined for Health 100)
    // Check APP_ID to determine which app is running
    dobFieldFIndex: __isIOS ? 0 : 1,
    dobFieldIndexOptional: true, // Flag to indicate index is optional
    passwordFieldFocused: "Password.*",
    clearTextBtn: "Clear Text",
    signInBtn: "Sign in",
    confirmBtn: "Confirm Code|Confirm code",
    confirmAndSignInBtn: "Confirm and Sign In",
    codeField: "Enter Code.*|6-digit code.*",
    extraCareFoundMsg: "We found your ExtraCare.*card!?",
    extraCareCardFoundMsg: "We found your ExtraCare card",
    okBtn: "OK",
    notNowBtn: __isIOS ? "Not Now" : "Not now",
    notNowBtnVariant: "Not now",  // Lowercase variant
    hiGreeting: "Hi,.*",
    signOutBtn: "Sign out",
    homeTab: "Home",
    closeBtn: __isIOS ? "xmark.circle.fill" : "x",
    closeMenuBtn: "xmark",
    closeBtnVariant: "Close",

    // OTP Verification Flow
    justNeedToConfirmMsg: "Just need to confirm.*",
    justNeedToConfirmItsYouMsg: "Just need to confirm it's you.|Just need to confirm it\u2019s you.",
    chooseHowToGetCodeMsg: "Choose how to get your one-time code",
    verificationMethodTitle: "How would you like to verify?",

    // Biometric Authentication
    signInWithFaceIdPrompt: "Sign in with Face ID",
    useFaceIdBtn: "Use Face ID",
    useTouchIdBtn: "Use Touch ID",
    enterPasswordInsteadBtn: "Enter Password",

    // Android - Biometric Authentication
    signInWithBiometricsPrompt: "Sign in with biometrics?", // Android
    biometricsDescription: "Biometrics will allow you to seamlessly sign in to your account.", // Android
    biometricLoginBtn: "Biometric login", // Android
    keepMeSignedInBenefits: "Open the benefits of Keep me signed in", // Android
    biometricsAuthFailedMsg: "Biometrics authentication failed", // Android

    // Android - Login Button Variants
    continueAsAGuestBtn: "Continue as a guest", // Android
    loginFailedMsg: "Login Failed", // Android
    signInFailedMsg: "Sign in failed", // Android
    weWereUnableMsg: "We were unable to sign you in.", // Android

    // Android - Password & Account Errors
    showPasswordCheckbox: __isIOS ? "Show password" : "Checkbox to show password",
    accountLockedMsg: __isIOS ? "Your account has been locked. Please contact support." : "Your account is locked. Please wait 30 minutes and try again.",
    pleaseEnterEmailMsg: "Please enter an email address", // Android
    pleaseEnterValidPasswordMsg: "Please enter a valid password.", // Android
    passwordIncorrect2Chances: "Your password is incorrect. You have 2 more chances to enter your information before your account is locked.", // Android
    passwordIncorrect1Chance: "Your password is incorrect. Your account will be locked for 5 minutes after the next invalid attempt.", // Android
    noInternetMsg: "No internet connection", // Android

    // Android - Verification Code
    verificationCodeField: "Enter verification code", // Android
    verificationCodeExpiredMsg: "Verification code expired", // Android
    verificationCodeIncompleteMsg: "Verification code is incomplete", // Android

    // Android - Informational
    enterMobileOrEmailMsg: __isIOS ? "Enter your mobile number or email to sign in or create an account." : "Enter your mobile number or email to sign in or create an account.",
}
