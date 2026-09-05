const __platform = maestro.platform.toLowerCase() === "ios" ? "ios" : "android";
const __isIOS = __platform === 'ios';

output.account_terms = {
    termsAndPrivacyNavBar: "Terms & Privacy",
    termsAndPrivacyLink: "Terms & Privacy|Terms and Privacy",

    // Main Links
    termsOfUseLink: "Terms of Use",
    privacyPolicyLink: "Privacy Policy",
    noticeOfPrivacyPracticesLink: "Notice of Privacy Practices",

    // CVS-specific notices
    cvsPharmacyNoticesLink: "CVS Pharmacy Notices",
    minuteClinicNoticesLink: "MinuteClinic Notices",
    waConsumerHealthPrivacyLink: "WA Consumer Health Privacy Policy",
    doNotSellLink: "Do Not Sell My Personal Information",

    // Delete Account
    deleteMyCvsAccountLink: "Delete My CVS Account",
    deleteAccountTitle: "Delete Account",
    deleteAccountModal: "What happens when you delete your account",
    areYouSureTitle: "Are you sure?",
    yesDeleteBtn: "Yes, Delete",

    // Android - Terms & Privacy Links
    termsAndConditionsLink: "Terms and Conditions", // Android
    personalHealthRecordPrivacyLink: "Personal Health Record Privacy Policy", // Android
    waConsumerHealthPrivacyAndroidLink: "WA Consumer Health Privacy Policy", // Android
    doNotSellShareLink: "Do Not Sell or Share My Personal Information", // Android
    minuteClinicNoticeOfPrivacyLink: "MinuteClinic Notice of Privacy Practices", // Android
    cvsPharmacyNoticeOfPrivacyLink: "CVS Pharmacy Notice of Privacy Practices", // Android
    dcUncompensatedCareLink: "D.C Uncompensated Care Notice", // Android
    deleteMyCvsAccountLink: "Delete my CVS.com account", // Android
};
