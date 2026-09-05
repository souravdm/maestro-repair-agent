const __platform = maestro.platform.toLowerCase() === "ios" ? "ios" : "android";
const __isIOS = __platform === 'ios';

/**
 * HealthBottomSheetScreen.js
 * Screen elements for the optional "See full picture of your health" bottom sheet
 * 
 * This bottom sheet may appear after the notification enrollment screen to encourage
 * users to connect their health records and get a comprehensive view of their health data.
 * 
 * Note: This is an OPTIONAL screen that may not always appear - flows should handle
 * its presence conditionally using `when: visible` patterns.
 */

output.health_bottom_sheet = {
    // ========================================================================
    // SCREEN IDENTIFIERS
    // ========================================================================
    screenTitle: "(?i).*full picture.*health.*",
    alternateTitle: "(?i).*See.*health.*",
    
    // ========================================================================
    // MAIN CONTENT
    // ========================================================================
    heading: "(?i).*full picture.*health.*",
    description: "(?i).*(Connect|health records|comprehensive view).*",
    
    // Common message variations
    messageVariant1: "See full picture of your health",
    messageVariant2: "Connect your health records",
    messageVariant3: "Get a comprehensive view",
    messageVariant4: "View all your health information",
    
    // ========================================================================
    // ACTION BUTTONS
    // ========================================================================
    connectBtn: "Connect|Get started|Continue",
    connectBtnPattern: "(?i).*(Connect|Get started|Continue).*",
    notNowBtn: "Not now|Skip|Maybe later",
    notNowBtnPattern: "(?i).*(Not now|Skip|Maybe later).*",
    closeBtn: "Close|Dismiss|X",
    closeBtnPattern: "(?i).*(Close|Dismiss|X).*",
    
    // Combined dismiss pattern (for convenience)
    dismissPattern: "Not now|Skip|Maybe later|Close|Dismiss|X",
    
    // ========================================================================
    // BOTTOM SHEET ELEMENTS
    // ========================================================================
    dragHandle: "(?i).*drag.*handle.*",
    overlay: "(?i).*overlay.*",
    container: "(?i).*bottom.*sheet.*",
};
