// MinuteClinicSchedulingScreen.js
// Screen elements for NGS scheduling, waitlist, and cancellation flows

const __platform = maestro.platform.toLowerCase() === "ios" ? "ios" : "android";
const __isIOS = __platform === 'ios';

// --- Scheduling Flow ---
output.health_scheduling = {

    // --- Service Selection ---
    findTheCareYouNeed: "(?i).*Find the care.*",
    selectTheCareYouNeed: "Select the care you need",
    serviceSymptomOrCondition: "Service, symptom or condition",
    commonServices: "Common services",
    sickCare: "Sick care",
    selectAService: "Select a service",
    searchBtn: "Search",

    // --- Patient Selection ---
    patientSelection: "Patient selection",
    selectAPatient: "Select a patient",
    addSomeoneElse: "Add someone else",
    editGroup: "Edit group",

    // --- Visit Type ---
    scheduleAnInpersonVisit: "Schedule an in-person visit",
    rescheduleOrCancelVisit: "Reschedule or cancel an existing visit",
    signInForSchedulingLabel: "Sign in for the fastest scheduling experience",
    scheduleCare: "Schedule care",
    scheduleCareLabel: "Schedule Care",
    patientVaccineLabel: "Patient & Vaccine",
    confirmNewVisit: "Confirm new visit",
    letsGetStarted: "Let's get started",

    // --- Patient Info Form ---
    firstName: "First name",
    lastName: "Last name",
    dateOfBirth: "Date of birth",
    mobileNumber: "Mobile number",
    emailField: "Email",
    zipCode: "ZIP code",

    // --- Date & Time Selection ---
    selectADate: "Select a date",
    selectAVisitTime: "Select a visit time",
    earlyMorning: "Early Morning",
    morning: "Morning",
    afternoon: "Afternoon",
    evening: "Evening",
    overnight: "Overnight",
    changeDate: "Change date",
    timeOfDay: "Time of day",

    // --- Location ---
    location: "Location",
    enterZipCodeOrCity: "Enter ZIP code or city",
    changeLocation: "Change location",
    nearMe: "Near me",
    viewOnMap: "View on map",

    // --- Filters ---
    clearFilters: "Clear filters",
    filters: "Filters",
    filterOptions: "Filter options",

    // --- Availability ---
    viewMoreTimes: "View more times",
    earliestAvailability: "Earliest availability",
    noAvailableAppointments: "No available appointments",

    // --- Confirmation ---
    confirmVisit: "Confirm visit",
    reviewDetails: "Review details",
    confirmAndContinue: "Confirm and continue",
    goodNews: "Good news!",
    confirmationCode: "Confirmation code",

    // --- Authentication ---
    signIn: "Sign in",
    continueWithoutSignin: "Continue without sign-in",

    // --- Provider Preferences ---
    providerPreferences: "Provider preferences",
    providerDetails: "Provider details",
    anyProvider: "Any provider",
    gender: "Gender",
    languages: "Languages",
    specialties: "Specialties",
    acceptsMedicare: "Accepts Medicare",
    changeProvider: "Change provider",

    // --- Policies ---
    cancelationPolicy: "Cancelation Policy",
    termsAndConditions: "Terms and conditions",

    // --- Existing Visit Handling ---
    newVisit: "New visit",
    existingVisitFound: "Existing visit found",
    keepExistingVisit: "Keep existing visit",
    chooseNewVisit: "Choose new visit",
    changeAppointment: "Change appointment",

    // --- Appointment Types ---
    minuteclinicAppointment: "MinuteClinic appointment",
    cvsAppointment: "CVS appointment",

    // --- Find Care (from MCCore/NGS) ---
    findCareTitle: "Find care",
    findCareLabel: "Find Care",
    minuteClinicTitle: "MinuteClinic®",
    exploreCareOptions: "Explore care options",
    typeSymptomLabel: "Type a symptom or condition and select a service",
    searchForAService: "Search for a service",
    beforeYouScheduleSection: "Before you schedule",
    scheduleVisitBtn: "Schedule visit",
    patientInfoLabel: "Patient information.*|Patient info.*",
    rescheduleOrCancelLnk: "Reschedule or cancel an existing visit",

    // --- Common Services ---
    coldUpperRespiratoryLnk: "Cold & Upper Respiratory",
    congestionSinusLnk: "Congestion & Sinus",
    earInfectionLnk: "Ear Infection",
    fluVaccineLnk: "Flu Vaccine",
    pinkEyeLnk: "Pink Eye",
    tuberculosisTestLnk: "Tuberculosis Test",
    utiTreatmentLnk: "UTI Treatment",

    // --- Map/List View ---
    whenBtn: "When",
    whereBtn: "Where",
    searchThisAreaBtn: "Search this area|Search This Area",
    listBtn: "List",
    mapBtn: "Map",
    sortByNearest: "Sort by Nearest",
    sortByFirstAvailable: "Sort by First Available",
    viewResultsBtn: "View Results|View results",
    bookAppointmentBtn: "Book Appointment|Book",
    virtualBtn: "Virtual",
    inPersonBtn: "In-person|In Person",

    // --- Provider/Manufacturer Filters ---
    cvsPharmacySwitch: "CVS Pharmacy",
    minuteClinicSwitch: "MinuteClinic",
    modernaSwitch: "Moderna",
    pfizerSwitch: "Pfizer",

    // --- Vaccine Scheduling ---
    vaccinesLnk: "Vaccines",
    scheduleVaccineBtn: "Schedule a Vaccine",
    hiPatientVaccineLabel: "Hi.*",

    // --- Question Categories ---
    tuberculosisQuestions: "Tuberculosis questions",
    sportsPhysicalQuestions: "Sports physical questions",
    depressionScreening: "Depression screening",
    socialNeedsQuestions: "Social needs questions",
    symptomDetails: "Symptom details",
    employeeAssistanceProgram: "Employee Assistance Program (EAP)",
    eapInfo: "EAP info",

    // --- Location Labels ---
    cvsMinuteClinic: "CVS minute clinic",
    cvsMinuteclinicVisit: "CVS MinuteClinic visit",
    cvsHealthcarePractices: "CVS Healthcare Practices",
    oakStreetHealthLabel: "Oak Street Health",

    // --- Sports Physical Payment ---
    sportsPay: "Sports pay",
    sportsPhysicalCostDue: "Sports physical cost due",
    noticeOfSelfpayment: "Notice of self-payment",

    // --- Insurance ---
    insuranceCoverage: "Insurance coverage",
    confirmInsurance: "Confirm insurance",
    skipInsuranceForNow: "Skip insurance for now",
    addANewInsurance: "Add a new insurance card",
    coverageNotice: "Coverage Notice",

    // --- Form Fields ---
    datePicker: "Select date|Date.*",
    timeSlots: "Select a time|Time.*"
};

// --- Waitlist ---
output.health_scheduling_waitlist = {
    joinTheWaitlist: "Join the waitlist",
    joinWaitlist: "Join waitlist",
    onWaitlist: "On waitlist",
    estimatedWaitTime: "estimated wait time",
    confirmWaitlist: "Confirm waitlist",
    cancelWaitlist: "Cancel waitlist",
    cancelWaitlistSpot: "Cancel waitlist spot",
    waitlistDetails: "Waitlist details",
    waitlistCanceled: "Waitlist canceled",
    newWaitlistSpot: "New waitlist spot",
    existingWaitlistSpot: "Existing waitlist spot",
    walkinsWelcome: "Walk-ins welcome!",
    walkinsAreAvailableToday: "Walk-ins are available today"
};

// --- Cancellation & Rescheduling ---
output.health_scheduling_cancellation = {
    cancelThisVisit: "Cancel this visit",
    keepVisitAndGoBack: "Keep visit and go back",
    whyDoYouWantToCancel: "Why do you want to cancel? (Optional)",
    tooLongToWait: "Too long to wait",
    noLongerNeedService: "No longer need service",
    foundAlternativeProviderLocation: "Found alternative provider/location",
    dontWantToSpecify: "Don't want to specify",
    others: "Others",
    visitCanceled: "Visit canceled",
    scheduleAnotherVisit: "Schedule another visit",
    browseMinuteclinicServices: "Browse MinuteClinic services",
    continueRescheduling: "Continue rescheduling",
    reschedule: "Reschedule"
};
