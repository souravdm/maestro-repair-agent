const __platform = maestro.platform.toLowerCase() === "ios" ? "ios" : "android";
const __isIOS = __platform === 'ios';

output.health_records = {
    // Header
    healthRecordsTitle: "Health Records|Health records|Records",

    // Record Categories
    recordCategories: "Categories.*",
    labResults: "Lab results|Lab Results",
    medicationsList: "Medications",
    allergies: "Allergies",
    conditions: "Conditions",
    immunizations: "Immunizations",
    vitals: "Vitals",

    // Provider Info
    providerInformation: "Provider.*|Provider information",

    // Lab Results Detail (Android)
    labTests: "Lab tests",
    labDetails: "Lab details",
    latestResult: "Latest result",
    pastResults: "Past results",
    testResult: "Test result",
    yourResults: "Your results",
    understandingYourResults: "Understanding your results",
    testType: "Test type",
    orderedBy: "Ordered by",
    completedOn: "Completed on",
    collectionLocation: "Collection location",
    resultingLab: "Resulting lab",
    labNotes: "Lab notes",
    pendingResults: "Pending results:",

    // Allergies Detail (Android)
    allergyHistory: "Allergy history",
    reactionSeverity: "Reaction severity",
    severe: "Severe",
    moderate: "Moderate",
    biologicAllergy: "Biologic allergy",
    foodAllergy: "Food allergy",
    medicationAllergy: "Medication allergy",
    environmentalAllergy: "Environmental allergy",
    current: "Current",

    // Conditions Detail (Android)
    conditionDetails: "Condition Details",
    recordedOn: "Recorded on",
    documentedBy: "Documented by",
    onsetDate: "Onset date",
    status: "Status",
    verificationStatus: "Verification status",
    severity: "Severity",
    bodySite: "Body site",
    recordSource: "Record source",

    // Medications Detail (Android)
    medicationDetails: "Medication details",
    datePrescribed: "Date prescribed",
    dateGiven: "Date given",
    givenBy: "Given by",
    prescriber: "Prescriber",
    medicationName: "Medication name",
    directions: "Directions",
    manufacturer: "Manufacturer",
    lotNumber: "Lot number",
    route: "Route",
    volume: "Volume",
    quantity: "Quantity",
    daySupply: "Day supply",
    prescribed: "Prescribed",
    givenInVisit: "Given in visit",
    medicationsPrescribed: "Medications prescribed",

    // Vitals (Android)
    vitalsHistory: "Vitals history",
    vitalsDetails: "Vitals details",
    vitalSigns: "Vital signs",
    height: "Height",
    weight: "Weight",
    bloodPressure: "Blood pressure",
    temperature: "Temperature",
    pulse: "Pulse",
    respirations: "Respirations",
    oxygen: "Oxygen",
    anthropometrics: "Anthropometrics",
    measurements: "Measurements",
    bodyMeasurements: "Body measurements",

    // Visit History (Android)
    visitHistory: "Visit history",
    visitDetails: "Visit Details",
    visitLocation: "Visit location",
    diagnosis: "Diagnosis",
    careInstructions: "Care instructions",
    referrals: "Referrals",
    scheduleFollowup: "Schedule follow-up",
    afterVisitSummary: "After visit summary",
    fullProviderNotes: "Full provider notes",
    moreDocuments: "More documents",
    contactProvider: "Contact provider",
    messageProvider: "Message provider",

    // Navigation Tabs (Android)
    visits: "Visits",
    vaccinations: "Vaccinations",
    connectRecords: "Connect records",
    moreDetails: "More details",
    vaccineRecords: "Vaccine records",

    // General (Android)
    latestRecords: "Latest records",
    multipleRecordSources: "Multiple record sources",
    yourPersonalHealthRecords: "Your personal health records",
    viewMore: "View more",
    details: "Details",
    notAvailable: "Not available",
    viewAll: "View all",
    exportRecordsToPdf: "Export records to PDF",
    connectedFrom: "Connected from",
    pharmacyRecords: "Pharmacy records",
}
