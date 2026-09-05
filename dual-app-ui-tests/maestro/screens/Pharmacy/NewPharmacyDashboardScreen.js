const __platform = maestro.platform.toLowerCase() === "ios" ? "ios" : "android";
const __isIOS = __platform === 'ios';

output.pharmacy_newDashboard = {
    // Header
    pharmacyDashboardTitle: "Pharmacy",

    // Sections
    prescriptionsSection: "Prescriptions",
    ordersSection: "Orders",
    settingsToolsSection: "Settings & Tools|Settings and Tools",
    spendingSection: "Spending",

    // Rx Card
    rxCard: "Rx.*|Prescription.*",
    orderStatus: "Order status.*|Status.*",

    // Actions
    refillBtn: "Refill",
    transferRxBtn: "Transfer Rx|Transfer prescription",
    autoRefillToggle: __isIOS ? "Auto refill" : "Auto refill toggle",

    // Preferences & Settings
    pharmacyPreferences: "Pharmacy preferences",
    prescriptionSchedule: "Prescription Schedule",

    // Mail Service
    cvsCaremarkMailService: "CVS Caremark Mail Service Pharmacy®",
    cvsCaremarkMailServiceTitle: "CVS Caremark Mail Service Pharmacy",
    cvsPharmacy: "CVS Pharmacy®",

    // Error States
    checkingForUpdates: "Checking for updates",
    troubleWithUpdates: "We're having trouble with your updates. Check back soon.",

    // Prior Authorization
    learnAboutPriorAuthorization: "Learn about prior authorization",
    moreInfo: "More info",
}
