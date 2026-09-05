const __platform = maestro.platform.toLowerCase() === "ios" ? "ios" : "android";
const __isIOS = __platform === 'ios';

output.account_insurance = {
    insuranceTitle: "Insurance",
    insuranceOption: "Insurance",
    addInsuranceCardTitle: "Add Insurance Card|Insurance",
    insuranceSubtitle: "Insurance card",
    tipsForQualityImages: "Tips for quality images",
    addFrontImageBtn: "Add front|Add Front Image",
    addBackImageBtn: "Add back|Add Back Image",
    chooseMethodTitle: "Choose a method",
    choosePhotoOptions: "Take Photo|Upload Image|Choose",
    takePhotoBtn: "Take Photo",
    uploadImageBtn: "Upload Image",
    chooseFromLibraryBtn: "Upload Image|Choose from Library",
    underReviewLabel: "Under Review",
    reviewMessage: "We're reviewing your insurance card images",
    backToAccountBtn: "Back to Account",
    replaceImageBtn: "Replace Image",
    saveBtn: "Save",
    submitBtn: "Submit",
    saveOrSubmitBtn: "Save|Submit",
}

output.account_otp = {
    continueBtn: "Continue.*",
    okBtn: "Ok",
    enterDobText: __isIOS ? "Enter your date of birth" : "Enter your date of\ \nbirth",
    dobField: __isIOS ? "Date of Birth" : "Date of birth",
    dobFormat: "MMDDYYYY",
    enterCodeText: "Enter your code",
    confirmCodeBtn: "Confirm.*",
    confirmText: "Just need to confirm it's you.",
    sendCodeBtn: "Send code",
}

output.account_signIn = {
    biometricSignInBtn: "Sign in with fingerprint",
    continueAsGuestBtn: "Continue as a guest",
    keepMeSignedInBtn: "Keep me signed in",
    mobileOrEmailField: ".*Mobile number or email.*",
    continueBtn: "Continue",
    emailAddressField: "Email address",
    passwordField: "Password",
    hidePasswordBtn: "Hide Password",
    showPasswordBtn: "Show Password",
    saveNewPasswordBtn: "Save new password",
    passwordResetConfirmationText: "Your password's been reset",
    forgotPasswordLink: "Forgot your password?",
    signInBtn: "Sign in",
}
