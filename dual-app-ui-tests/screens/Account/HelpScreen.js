const __platform = maestro.platform.toLowerCase() === "ios" ? "ios" : "android";
const __isIOS = __platform === 'ios';

output.account_help = {
    // Feedback Screen
    feedbackNavBar: "Feedback",
    feedbackHeader: "Send us feedback",
    feedbackDescription: "We'd love to hear from you",
    feedbackTextField: "id:feedbackTextField",
    feedbackPlaceholder: "Tell us what you think",
    ratingLabel: "How would you rate your experience?",
    rating1Star: "1 star",
    rating2Star: "2 stars",
    rating3Star: "3 stars",
    rating4Star: "4 stars",
    rating5Star: "5 stars",
    submitFeedbackBtn: "Submit feedback",

    // Feedback Notification
    loveOurAppLabel: "Love Our App?",
    letUsKnowRatingLabel: "Let us know by rating the app or tell us what we can do better.",
    yesRateTheAppButton: "Yes, Rate the App",
    noRateTheAppButton: "No, Send Feedback",
    
    // Terms & Privacy Screen
    termsPrivacyNavBar: "Terms & privacy",
    termsPrivacyHeader: "Legal information",
    termsOfServiceBtn: "Terms of service",
    privacyPolicyBtn: "Privacy policy",
    cookiePolicyBtn: "Cookie policy",
    hipaaNoticeBtn: "HIPAA notice",
    accessibilityBtn: "Accessibility",
    
    // Support Screen
    supportNavBar: "Support",
    supportHeader: "How can we help?",
    faqBtn: "Frequently asked questions",
    contactUsBtn: "Contact us",
    chatWithUsBtn: "Chat with us",
    callUsBtn: "Call us",
    emailUsBtn: "Email us",
    phoneNumber: "1-800-SHOP-CVS",
    emailAddress: "support@cvs.com",
    
    // Copy Device Information Screen
    copyDeviceInfoNavBar: "Copy device information",
    copyDeviceInfoHeader: "Device information",
    deviceModelLabel: "Device model",
    deviceModelValue: ".*",
    osVersionLabel: "OS version",
    osVersionValue: ".*",
    appVersionLabel: "App version",
    appVersionValue: ".*",
    deviceIdLabel: "Device ID",
    deviceIdValue: ".*",
    copyInfoBtn: "Copy information",
    copiedMsg: "Device information copied",
    
    // Common Elements
    backBtn: "Back",
    disclosureIndicator: ">",
    externalLinkIcon: "id:externalLinkIcon",
    
    // Actions
    submitBtn: "Submit",
    cancelBtn: "Cancel",
    doneBtn: "Done",
    copyBtn: "Copy",
    
    // Success Messages
    feedbackSubmittedMsg: "Thank you for your feedback",
    informationCopiedMsg: "Information copied to clipboard",
};
