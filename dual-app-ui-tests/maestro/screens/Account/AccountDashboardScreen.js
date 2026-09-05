const __platform = maestro.platform.toLowerCase() === "ios" ? "ios" : "android";
const __isIOS = __platform === 'ios';

// Calculate profile initials dynamically from loaded credentials
// This works with ANY logged-in user (LOA2, ELIZABETH_MILLER, DEAN_FANT, etc.)
// Returns a regex pattern that matches BOTH initials AND firstName (since app may display either)
function getProfileInitials() {
    try {
        // Check if credentials are loaded (from credentials-loader.js)
        if (output.user && output.user.firstName && output.user.lastName) {
            const firstInitial = output.user.firstName.charAt(0).toUpperCase();
            const lastInitial = output.user.lastName.charAt(0).toUpperCase();
            const initials = firstInitial + lastInitial;
            const firstName = output.user.firstName;

            // Return pattern that matches EITHER initials OR firstName
            // Example: "(ZU|ZSenior)" matches both "ZU" and "ZSenior"
            const pattern = `(${initials}|${firstName})`;
            console.log(`[AccountDashboard] Profile pattern: ${pattern} (initials: ${initials}, firstName: ${firstName})`);
            return pattern;
        }

        // Fallback: Try to parse from email (e.g., "john.doe@email.com" -> "JD")
        if (output.user && output.user.email) {
            const emailParts = output.user.email.split('@')[0].split('.');
            if (emailParts.length >= 2) {
                const firstInitial = emailParts[0].charAt(0).toUpperCase();
                const lastInitial = emailParts[1].charAt(0).toUpperCase();
                const initials = firstInitial + lastInitial;
                const firstName = emailParts[0];

                // Return pattern matching both possibilities
                const pattern = `(${initials}|${firstName})`;
                console.log(`[AccountDashboard] Profile pattern from email: ${pattern}`);
                return pattern;
            }
        }

        // Third fallback: Use firstName if available
        if (output.user && output.user.firstName) {
            console.log(`[AccountDashboard] Using firstName: ${output.user.firstName}`);
            return output.user.firstName;
        }
    } catch (e) {
        console.log(`[AccountDashboard] Could not calculate initials, using pattern match: ${e}`);
    }

    // Final fallback: Return a regex pattern that matches initials or firstName
    // This works for CVS Health and Health100 profile initial displays
    return "[A-Za-z]{1,15}";
}

output.account_dashboard = {
    // Navigation
    accountTab: "Account",
    backBtn: "Back",
    closeBtn: "Close",

    // User Profile Header
    userGreeting: "Hi,.*",

    // Section Headers
    accountDetailsHeader: "Account details",
    paymentsInsuranceHeader: "Payments & insurance",
    manageConnectionsHeader: "Health info management",
    communicationPreferencesHeader: "Communication preferences",
    helpHeader: "Help",

    // Account Details Section
    profileBtn: "Profile",
    signInSecurityBtn: "Sign in and security",
    addressesBtn: "Addresses",
    cvsHealthCaregivingBtn: "CVS Health caregiving",

    // Payments & Insurance Section
    insuranceBtn: "Insurance",
    payABillBtn: "Pay a bill",

    // Manage Connections Section
    cvsHealthFamilyBtn: "CVS Health family of companies",
    healthProvidersBtn: "Health providers & facilities",
    sharedMedicalRecordsBtn: "Shared medical records",
    connectionsAndPermitBtn: "Connections & permissions",
    disconnectRecordsBtn: "Disconnect CVS Health records",

    // Communication Preferences Section
    textsBtn: "Texts",
    automatedCallsBtn: "Automated calls",
    emailsBtn: "Emails",
    notificationsBtn: "Notifications",
    liveActivitiesBtn: "Live activities",

    // Help Section
    feedbackBtn: "Feedback",
    termsPrivacyBtn: "Terms & privacy",
    helpCenterBtn: "Help center",
    deleteAccountBtn: "Delete account",
    supportBtn: "Support",
    copyDeviceInfoBtn: "Copy device information",

    // Sign Out
    signOutBtn: "Sign out",

    // Profile Elements - Dynamic based on logged-in user
    profileInitials: getProfileInitials(),  // Calculated dynamically: "SU", "EM", "Benjamin", etc.
    profileInitialsPattern: "[A-Za-z]{1,15}",  // Fallback pattern: matches initials (1-3 chars) or firstName (up to 15 chars)
    
    // Navigation Elements
    backButton: "id:backButton",
    accountTitle: "Account",
    
    // Loading States
    loadingMsg: "Loading...",
    savingMsg: "Saving...",
    
    // Success Messages
    profileUpdatedMsg: "Profile updated successfully",
    settingsSavedMsg: "Settings saved successfully",
    
    // Error Messages
    errorMsg: "An error occurred",
    tryAgainMsg: "Please try again",

    // Android - Profile & Account Menu
    editProfileBtn: "Edit profile", // Android
    prescriptionManagementBtn: "Prescription Management", // Android
    healthRecordsBtn: "Health Records", // Android
    paymentMethodsBtn: "Payment methods", // Android
    accountAccessBtn: "Account access", // Android
    purchaseHistoryBtn: "Purchase history", // Android
    dealsAndRewardsBtn: "Deals and rewards", // Android
    pharmacyNotificationsBtn: "Pharmacy notifications", // Android
    supportFaqBtn: "Support & FAQ", // Android
}
