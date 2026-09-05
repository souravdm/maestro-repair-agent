// VaccineScreen.js
// Screen elements for vaccine scheduling, eligibility, and history

const __platform = maestro.platform.toLowerCase() === "ios" ? "ios" : "android";
const __isIOS = __platform === 'ios';

// --- Vaccine Selection & Scheduling ---
output.health_vaccines = {

    // --- Selection ---
    vaccineSelection: "Vaccine selection",
    selectVaccine: "Select vaccine",
    addToYourVisit: "Add to your visit",
    whyAreYouGettingVaccine: "Why are you getting a vaccine?",
    selectionsAreRequired: "Selections are required to continue.",

    // --- Eligibility ---
    vaccineEligibility: "Vaccine eligibility",
    eligibleVaccines: "Eligible vaccines",
    optionalVaccines: "Optional vaccines",
    vaccineRecommendations: "Vaccine recommendations",

    // --- Vaccine Categories ---
    routineVaccines: "Routine vaccines",
    travelVaccines: "Travel vaccines",

    // --- Specific Vaccines ---
    covid19Moderna: "COVID-19 (Moderna)",
    covid19Pfizer: "COVID-19 (Pfizer)",
    fluSeniorDose: "Flu (senior-dose 65+)",
    scheduleThisYearsVaccine: "Schedule this year's vaccine",

    // --- Appointment Management ---
    vaccineAppointmentsAvailable: "Vaccine appointments available",
    rescheduleVaccines: "Reschedule vaccines",
    cancelVaccines: "Cancel vaccines"
};

// --- Vaccine History ---
output.health_vaccineHistory = {

    // --- History Overview ---
    vaccineHistory: "Vaccine history",
    vaccinationHistory: "Vaccination history",
    vaccinationDetails: "Vaccination details",

    // --- Add / Edit / Delete ---
    addAVaccination: "Add a vaccination",
    addVaccination: "Add vaccination",
    editVaccination: "Edit vaccination",
    updateVaccination: "Update vaccination",
    deleteThisVaccination: "Delete this vaccination",
    deleteRecord: "Delete record",
    yesDelete: "Yes, delete",
    noDontDelete: "No, don't delete",

    // --- Vaccine Detail Fields ---
    vaccineDetails: "Vaccine details",
    vaccineName: "Vaccine name",
    receivedOn: "Received on",
    receivedAt: "Received at",
    providerOrPracticeName: "Provider or practice name",
    doseMl: "Dose (mL)",
    notes: "Notes",

    // --- Search & Export ---
    searchForVaccination: "Search for vaccination",
    exportToPdf: "Export to PDF",

    // --- Status ---
    selfreportedByPatient: "Self-reported by patient"
};
