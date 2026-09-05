const __platform = maestro.platform.toLowerCase() === "ios" ? "ios" : "android";
const __isIOS = __platform === 'ios';

output.account_createAccount = {
    createAccountTitle: 'Create your account',
    firstNameField: 'First name',
    lastNameField: 'Last name',
    dateOfBirthField: 'Date of birth',
    mobileNumberField: 'Mobile number',
    Password: 'Password',
    createMyAccountBtn: 'Create my account',
}

output.account_register = {
    createAccountBtn: "Create an account",
    createAccountNavBar: "Create an account",
    emailLookupHeader: "To start, enter your email",
    emailLookupSubheader: "We'll use it to find or create your account",
    emailField: "Mobile number or email.*",
    emailAddressLabel: "Email Address",
    createAccountTitle: "Create your account",
    allFieldsRequired: "All fields are required",
    firstNameLabel: "First name",
    firstNameField: "First name.*",
    lastNameLabel: "Last name",
    lastNameField: "Last name.*",
    mobileLabel: "Mobile number",
    mobileField: "Mobile number.*",
    passwordLabel: "Password",
    passwordField: "Password.*",
    showPasswordBtn: "Show Text",
    hidePasswordBtn: "Hide Text",
    passwordReqHeader: "Password Requirements",
    passwordReqLength: "Use 10 to 64 characters",
    passwordReqUppercase: "1 uppercase letter",
    passwordReqLowercase: "1 lowercase letter",
    passwordReqNumber: "1 number",
    passwordReqSpecial: "1 special character",
    passwordReqNoCvs: "Do not include",
    submitRegistrationBtn: "Create my account",
    joinExtracareSwitch: "Join ExtraCare",
    joinExtracareLabel: "Members can save",
    termsOfUse: "Terms of Use",
    privacyPolicy: "Privacy Policy",
    agreementLabel: "By creating an account, you agree",
    alreadyHaveAccount: "Already have an account",
    signInLink: "Sign In",
    emailError: "Enter an email address",
    emailInvalidError: "Enter a valid email address",
    firstNameError: "Enter a first name",
    lastNameError: "Enter a last name",
    passwordError: "Enter a password",
    missingInfoError: "Missing or invalid info",
    otpField: "Enter Code.*",
    otpConfirm: "Confirm.*",

    // Additional Registration Flow Elements (from violations analysis)
    enterCodeTitle: "Enter Code",
    enterCodeHeader: "Enter your code",
    enterCodePrompt: "Enter Code|Enter your code",
    continueBtn: "Continue",
    confirmBtn: "Confirm",
    confirmAndSignInBtn: "Confirm and Sign In",
    notNowBtn: __isIOS ? "Not Now" : "Not now",
    notNowBtnVariant: "Not now",  // Lowercase variant for edge cases
    skipBtn: "Skip",
    maybeLaterBtn: "Maybe later",

    // Registration Success Messages
    accountCreatedMsg: "Account created successfully",
    welcomeMsg: "Welcome to CVS",
    allSetMsg: "All set",

    // Registration Validation Errors
    emailRequiredError: "Please enter your email address",
    emailInvalidError: "Please enter a valid email address",
    firstNameRequiredError: "First name is required",
    lastNameRequiredError: "Last name is required",
    passwordRequiredError: "Password is required",
    passwordLowercaseError: "Must contain at least one lowercase letter",
    passwordUppercaseError: "Must contain at least one uppercase letter",
    passwordSpecialCharError: "Must contain at least one special character",
    passwordNumberError: "Must contain at least one number",
    mobileRequiredError: "Mobile number is required",
    mobileInvalidError: "Enter a valid mobile number",
    dateOfBirthError: "Enter a valid date of birth",
    passwordMismatchError: "Passwords do not match",
    termsNotAcceptedError: "You must accept the Terms of Use",
    createAccountHeader: "Create your account",
    createAccountBtn: "Create Account",

    // Android - Registration Elements
    receiveTextAlertsToggle: "Receive text alerts (optional)", // Android
    includeNumberReq: "Include at least 1 number", // Android
    passwordMustMeetReq: "Password must meet all requirements", // Android
    passwordNotSafeMsg: "This password isn't safe to use", // Android
    passwordStolenMsg: "It's on a list of stolen passwords published online. Use a different one to help protect your info.", // Android
    profileAlreadyExistsMsg: "Profile already exists", // Android
    emailAlreadyExistsMsg: "Email already exists", // Android
    byContinuingAgreeMsg: "By continuing, you agree to our", // Android
}
