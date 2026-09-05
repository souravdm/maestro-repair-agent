const __platform = maestro.platform.toLowerCase() === "ios" ? "ios" : "android";
const __isIOS = __platform === 'ios';

output.health_landing = {
    // Header
    healthLandingTitle: "Health",

    // Navigation
    healthRecordsBtn: "Health Records|Health records",

    // Upcoming Visits
    upcomingVisitsSection: "Upcoming Visits|Upcoming visits",

    // Health Metrics
    healthMetricsCard: "Health metrics.*|Metrics.*",

    // Onboarding & Setup (Android)
    unlockYourHealthExperience: "Unlock your health experience",
    getStarted: "Get started",
    yourConnectedHealthIsJustAStepAway: "Your connected health is just a step away",
    letsConnectYourRecords: "Let's connect your records",
    connectYourHealthRecords: "Connect your health records",
    yourPersonalHealthRecords: "Your personal health records",
    yourHealthQuickLinks: "Your health quick links",
    signInOrCreate: "Sign in or create an account",

    // Appointments & Services (Android)
    upcomingAppointments: "Upcoming appointments",
    accessMinuteclinicPatientPortal: "Access MinuteClinic® patient portal",
    accessOakStreetHealthPatientPortal: "Access Oak Street Health patient portal",
    shareRecords: "Share records",
    smartScheduling: "Smart Scheduling",
    careOptions: "Care options",
}
