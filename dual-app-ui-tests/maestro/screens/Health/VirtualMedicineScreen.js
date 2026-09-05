// VirtualMedicineScreen.js
// Screen elements for virtual care visits and care consults

const __platform = maestro.platform.toLowerCase() === "ios" ? "ios" : "android";
const __isIOS = __platform === 'ios';

// --- Virtual Medicine ---
output.health_virtualMedicine = {

    // --- Care Options ---
    connectOverVideo: "Connect over video",
    chatWithAPhysician: "Chat with a physician",
    messageAProvider: "Message a provider",
    yourCareOptions: "Your care options",
    cvsVirtualCare: "CVS Virtual Care",
    getVirtualCareNow: "Get virtual care now",
    getCareFromHome: "Get care from home with MinuteClinic Virtual Care.",
    inpersonOrVirtual: "In-person or virtual",
    exploreMinuteclinicVirtualCare: "Explore MinuteClinic Virtual Care\u2122",
    virtualSupportForCommon: "Virtual support for common and chronic conditions.",

    // --- Join Visit ---
    joinVisit: "Join visit",
    joinVirtualVisit: "Join virtual visit",
    joinWaitingRoom: "Join waiting room",
    joinNow: "Join now",
    joinMyCurrentVisit: "Join my current visit",
    letsGoToYourVisit: "Let's go to your visit",

    // --- Visit Details ---
    virtualVisit: "Virtual visit",
    todaysVisit: "Today's visit",
    timeToJoinYourVisit: "Time to join your visit",
    timeForVisit: "Time for visit",
    beforeYourVirtualVisit: "Before your virtual visit",
    searchVirtualVisits: "Search virtual visits",

    // --- Location ---
    yourLocation: "Your location",
    whereAreYouJoiningFrom: "Where are you joining from?",
    useCurrentLocation: "Use current location",
    streetAddress: "Street address",
    stateField: "State",
    zipcodeField: "ZipCode",
    editMyLocation: "Edit my location",

    // --- Service Descriptions ---
    careForOver190Services: "Care for over 190 services at your neighborhood MinuteClinic®.",
    quickCareAndHealth: "Quick care and health advice through chat.",
    careConsultPricing: "$10/month",
    personalizedCarePlans: "Personalized care plans for common conditions.",

    // --- Location State ---
    youreJoiningFromDiffState: __isIOS ? "You\u2019re joining from a different state" : "You're joining from a different state",
    yourVisitWillStartInDiffWindow: "Your visit will start in a different window. Your current progress is saved.",
    locationPermissionsDenied: "Location permissions denied",

    // --- Visit Checklist (from VM) ---
    visitChecklistTitle: "Visit checklist",
    getStartedBtn: "Get started",
    checkInBtn: "Check in",
    preferredPharmacyBtn: "Preferred pharmacy",
    mcVisitLnk: "MC Visit",
    enrollmentLandingText: "Affordable care from doctors in minutes",
};

// --- Care Consult ---
output.health_careConsult = {
    newCareConsult: "New care consult",
    startACareConsult: "Start a care consult",
    learnAboutCareConsult: "Learn about care consult",
    aboutCareConsults: "About care consults",
    careConsultDetails: "Care consult details",
    confirmCareConsult: "Confirm care consult",
    costPayment: "Cost & payment",
    completeAHealthCheck: "Complete a health check",
    startYourTreatmentPlan: "Start your treatment plan",
    messageYourProviderFor: "Message your provider for up to 14 days"
};
