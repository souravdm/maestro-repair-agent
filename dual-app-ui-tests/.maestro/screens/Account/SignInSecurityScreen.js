const __platform = maestro.platform.toLowerCase() === "ios" ? "ios" : "android";
const __isIOS = __platform === 'ios';

output.account_signInSecurity = {
    // Navigation
    signInSecurityNavBar: "Sign in and security|Sign in & security",
    signInSecurityTitle: "Sign in and security",
    backBtn: "Back",

    // Password
    passwordOption: "Password",
    changePasswordBtn: "Change password",

    // Biometric Sign-In
    faceIdSignInOption: "Face ID sign-in",
    touchIdSignInOption: "Touch ID sign-in",
    fingerprintSignInOption: "Fingerprint sign-in",

    // Keep Me Signed In
    keepMeSignedInOption: "Keep me signed in",
    keepMeSignedInSubtitle: "On with Face ID sign-in|On with Touch ID sign-in|On with Fingerprint sign-in",

    // Third-Party Sign-In - Health100 App
    h100SignInDescription: "Sign in to your Health100 app with your Google or Apple account. You can disconnect at anytime.|Sign in to your Health 100 app with your Google or Apple account. You can disconnect at anytime.",
    h100SignInAppleOnly: "Sign in to your Health100 app with your Apple account. You can disconnect at anytime.|Sign in to your Health 100 app with your Apple account. You can disconnect at anytime.",
    h100SignInGoogleOnly: "Sign in to your Health100 app with your Google account. You can disconnect at anytime.|Sign in to your Health 100 app with your Google account. You can disconnect at anytime.",

    // Third-Party Sign-In - CVS App
    cvsSignInDescription: "Sign in to your CVS app with your Google or Apple account. You can disconnect at anytime.",
    cvsSignInAppleOnly: "Sign in to your CVS app with your Apple account. You can disconnect at anytime.",
    cvsSignInGoogleOnly: "Sign in to your CVS app with your Google account. You can disconnect at anytime.",

    // Third-Party Sign-In Options
    signInWithGoogleOption: "Sign in with Google",
    signInWithAppleOption: "Sign in with Apple",
    disconnectGoogleBtn: "Disconnect Google",
    disconnectAppleBtn: "Disconnect Apple",

    // Account Management
    deleteAccountBtn: "Delete account",

    // Actions
    saveBtn: "Save",
    cancelBtn: "Cancel",
    confirmBtn: "Confirm",
    doneBtn: "Done",

    // Success Messages
    passwordChangedMsg: "Password changed successfully",
    settingsSavedMsg: "Settings saved successfully",
    googleConnectedMsg: "Google account connected",
    appleConnectedMsg: "Apple account connected",
    googleDisconnectedMsg: "Google account disconnected",
    appleDisconnectedMsg: "Apple account disconnected",

    // Android - Password Management
    editPasswordBtn: "Edit password", // Android
    currentPasswordField: "Current password", // Android
    newPasswordField: "New password", // Android
    verifyPasswordField: "Verify password", // Android
    mustInclude1Uppercase: "Must include 1 uppercase letter", // Android
    mustInclude1Lowercase: "Must include 1 lowercase letter", // Android
    mustInclude1Number: "Must include 1 number", // Android
    mustInclude1Special: "Must include 1 special character", // Android
    passwordChangedSuccessMsg: __isIOS ? "Password changed successfully" : "Your password has been changed",
    beforeEditPasswordMsg: "Before you edit your password, we need to make sure it's really you.", // Android

    // Android - Email & Username
    editEmailBtn: "Edit email and username", // Android
    emailAndUsernameLabel: "Email and username", // Android

    // Android - Google Sign-In
    connectGoogleBtn: "Connect your Google and CVS\u00AE account", // Android
    continueWithGoogleBtn: "Continue with Google", // Android
    signInWithGoogleBtn: "Sign in with Google", // Android
    disconnectAccountBtn: "Disconnect account", // Android

    // Android - Biometric Sign-In
    biometricSignInLabel: "Biometric sign in", // Android
    biometricSignInForCvsLabel: "Biometric sign in for CVS", // Android
};
