const __platform = maestro.platform.toLowerCase() === "ios" ? "ios" : "android";
const __isIOS = __platform === 'ios';

/**
 * SimplifySignInScreen.js
 * Screen elements for the "Simplify your sign in" post-login screen
 * 
 * This screen appears after successful login and offers users the option to:
 * - Enable "Keep me signed in" functionality
 * - Enable Face ID/Touch ID biometric authentication
 */

output.simplify_sign_in = {
    // ========================================================================
    // SCREEN IDENTIFIERS
    // ========================================================================
    screenTitle: "Simplify your sign in",
    screenSubtitle: "Skip the code and get in faster.",
    
    // ========================================================================
    // HEADER ELEMENTS
    // ========================================================================
    logo: "CVS Health",
    
    // ========================================================================
    // MAIN CONTENT
    // ========================================================================
    heading: "Simplify your sign in",
    subtitle: "Skip the code and get in faster.",
    
    // ========================================================================
    // TOGGLE SWITCHES
    // ========================================================================
    // Keep Me Signed In Toggle
    kmsiLabel: "Keep me signed in",
    kmsiToggle: "(?i).*Keep me signed in.*",
    kmsiSwitch: "Keep me signed in",
    
    // Face ID Toggle
    faceIdLabel: "Face ID",
    faceIdIcon: "face_id_icon",
    faceIdToggle: "(?i).*Face ID.*",
    faceIdSwitch: "Face ID",
    
    // ========================================================================
    // ACTION BUTTONS
    // ========================================================================
    continueBtn: "Continue",
    continueBtnPattern: "(?i).*Continue.*",
    
    // ========================================================================
    // iOS ELEMENTS
    // ========================================================================
    homeIndicator: "Home Indicator",
    itemsLogo: "Kaiser permanente logo, elevance Health logo, Cigna logo.",
    okGotIt: "Got it.", // Android
    // Android - Coming soon screen
   comingSoonScreenTitle: "Coming soon",
   moreInsurance: "More insurance plans in Health100.*",
   newPlans: "New plans are added regularly.*",
   comingSoonContinueButton: "Got it",
   // Android - Intro screen
   helpsYouTakeControlWith: "(?i).*Helps you take control with:.*",
   closeBtn: "(?i).*Close.*",
   // IOS Before you explore screen
   beforeYouExploreTitle: "Before you explore",
   continueButton: "Continue",
   maybeLaterButton: "Maybe later",
};
