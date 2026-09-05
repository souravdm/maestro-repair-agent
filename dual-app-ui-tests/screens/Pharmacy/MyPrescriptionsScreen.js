const __platform = maestro.platform.toLowerCase() === "ios" ? "ios" : "android";
const __isIOS = __platform === 'ios';

output.pharmacy_myPrescriptions = {
    // Header
    myPrescriptionsTitle: "My Prescriptions",

    // Prescription Card
    prescriptionCard: "Prescription.*",
    medicationName: __isIOS ? "Medication name" : "medication_name",
    rxNumber: "Rx #.*|Rx Number.*",

    // Status Labels
    statusLabel: "Ready|In Progress|Shipped|Delayed|On Hold|Not Filled",
    statusReady: "Ready",
    statusInProgress: "In Progress",
    statusShipped: "Shipped",
    statusDelayed: "Delayed",
    statusOnHold: "On Hold",
    statusNotFilled: "Not Filled",

    // Actions
    refillBtn: "Refill",
    transferBtn: "Transfer",
    autoRefillToggle: __isIOS ? "Auto refill" : "Auto refill toggle",

    // Prescription Details
    lastFilledDate: "Last filled.*",
    quantity: "Quantity.*|Qty.*",
    daysSupply: "Day supply.*|Days supply.*",
    prescriberName: "Prescriber.*|Prescribed by.*",
    pharmacyLocation: "Pharmacy.*|CVS Pharmacy.*",

    // Prescription Details (Android)
    prescribedOn: "Prescribed on",
    prescribedBy: "Prescribed by",
    lastFilledOn: "Last filled on",
    refillsRemaining: "Refills remaining",
    directions: "Directions",

    // Auto Refill Management
    turnAutoRefillOn: "Turn auto refill on",
    turnAutoRefillOff: "Turn auto refill off",
    changeFillDate: "Change fill date",
    cancelFill: "Cancel fill",
    selectPrescription: "Select prescription",
    viewRxDetails: "View Rx details",

    // Prescription Disambiguation
    select1OfThese: "Select 1 of these prescriptions",
    thesePrescriptionsHaveInCommon: "These prescriptions have the following in common:",
    weHaveMoreThan1: "We have more than 1 prescription for this medication:",

    // Drug Information
    drugInformation: "Drug information",
    drugUsage: "Drug usage",
    drugWarnings: "Drug warnings",
    howToUsePrecautions: "How to use, precautions, and storage",
    sideEffectsAndMissed: "Side effects and missed doses",
    inCaseOfOverdose: "In case of overdose",
    noMonographAvailable: "NO MONOGRAPH AVAILABLE AT THIS TIME",

    // Medication Safety
    alwaysConsultWithPrescriber: "Always consult with your prescriber before stopping any medication",

    // Refill Preferences
    refillPreferences: "Refill Preferences",
    autoRefill: "Auto refill",
    prescriptionSchedule: "Prescription Schedule",
    pharmacyPreferences: "Pharmacy preferences",
}
