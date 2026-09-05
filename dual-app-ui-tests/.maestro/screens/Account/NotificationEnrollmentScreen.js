const __platform = maestro.platform.toLowerCase() === "ios" ? "ios" : "android";
const __isIOS = __platform === 'ios';

/**
 * NotificationEnrollmentScreen.js
 * Screen elements for the "Stay a step ahead with notifications" enrollment screen
 * 
 * This screen appears after login (and potentially after SimplifySignIn) to encourage
 * users to enable push notifications for:
 * - Prescription updates for yourself and those you care for
 * - Changes in connected health records
 * - Upcoming appointments and next steps
 * 
 * Based on Figma design: https://www.figma.com/design/6c4lVuvzdsp6n20E5199f0/Account---Health100?node-id=11727-22232
 */

output.notification_enrollment = {
    // ========================================================================
    // SCREEN IDENTIFIERS
    // ========================================================================
    screenTitle: "Stay a step ahead with notifications",
    screenSubtitle: "Get helpful reminders such as:",
    
    // ========================================================================
    // HEADER ELEMENTS
    // ========================================================================
    logo: "health 100",
    statusBar: "9:41",
    
    // ========================================================================
    // MAIN CONTENT
    // ========================================================================
    heading: "Stay a step ahead with notifications",
    subtitle: "Get helpful reminders such as:",
    
    // ========================================================================
    // BENEFIT BULLET POINTS
    // ========================================================================
    benefit1: "Prescription updates for yourself and those you care for",
    benefit2: "Changes in your connected health records",
    benefit3: "Upcoming appointments and next steps",
    benefitsPattern: "(?i).*(Prescription updates|health records|appointments).*",
    
    // ========================================================================
    // ACTION BUTTONS
    // ========================================================================
    turnOnNotificationsBtn: "Turn on notifications",
    turnOnNotificationsBtnPattern: "(?i).*Turn on notifications.*",
    notNowBtn: "Not now",
    notNowBtnPattern: "(?i).*Not now.*",
    
    // ========================================================================
    // iOS ELEMENTS
    // ========================================================================
    homeIndicator: "Home Indicator",
};
