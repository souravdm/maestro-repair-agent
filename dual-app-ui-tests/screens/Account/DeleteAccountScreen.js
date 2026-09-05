const __platform = maestro.platform.toLowerCase() === "ios" ? "ios" : "android";
const __isIOS = __platform === 'ios';

output.account_deleteAccount = {
    deleteAccountNavBar: "Delete account",
    areYouSureMsg: "Are you sure?",
    passwordField: "Password",
    deleteMyAccountBtn: "Delete My Account",
    cancelBtn: "Cancel",
    keepMyAccountBtn: "Keep My Account",
    accountDeletedConfirmation: "Your account has been deleted",
    transactionalWarningMsg: "transactional warning message",

    // Android - Delete Account Flow
    deleteYourAccountTitle: "Delete your account and information?", // Android
    ifYouDeleteMsg: "If you delete your account, you will not be able to perform these actions:", // Android
    deleteMyCvsAccountBtn: __isIOS ? "Delete My Account" : "DELETE MY CVS.COM ACCOUNT",
    areYouSureDeleteMsg: "Are you sure you want to delete your account?", // Android
    accountDeletedMsg: __isIOS ? "Your account has been deleted" : "Your CVS.com account has been deleted.",
    cannotSignInMsg: "You cannot use it to sign in.", // Android
    problemDeletingMsg: "There was a problem deleting your account.", // Android
    loseExtracareBenefitsMsg: "You will also lose access to these ExtraCare benefits:", // Android
    enterPasswordPrompt: "Enter your password", // Android
    passwordIncorrectMsg: "Your password is incorrect", // Android
};
