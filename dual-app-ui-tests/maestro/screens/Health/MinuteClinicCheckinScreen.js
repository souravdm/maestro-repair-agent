// MinuteClinicCheckinScreen.js
// Screen elements for MinuteClinic check-in flow

const __platform = maestro.platform.toLowerCase() === "ios" ? "ios" : "android";
const __isIOS = __platform === 'ios';

output.health_minuteClinicCheckin = {

    // --- Header ---
    mobileCheckin: "Mobile Checkin",

    // --- Identity Confirmation ---
    hiThereLetsConfirm: "Hi there! Let's confirm it's you",
    continueBtn: "Continue",
    patientsDateOfBirth: "Patient's date of birth",
    patientsLastName: "Patient's last name",
    patientsConfirmationCode: "Patient's confirmation code",
    patientsZipCode: "Patient's ZIP code (5-digit code)",
    phoneNumber: "Phone Number",
    allFieldsAreRequired: "All fields are required.",
    weSentYouConfirmationCode: "We sent you the visit Confirmation Code by email/text message.",

    // --- Validation Errors ---
    enterAValidLastName: "Enter a valid last name",
    enterAValidConfirmation: "Enter a valid confirmation code",
    enterAValidDate: "Enter a valid date of birth",
    enterDateWithoutSlashes: "Enter date without slashes: MMDDYYYY",
    enterAValidZip: "Enter a valid 5-digit ZIP code",

    // --- Alternate Verification ---
    tryThisInstead: "Try this instead",
    tryAnotherWay: "Try another way",
    havingTroubleLetsConfirm: "Having trouble? Let's confirm another way",
    yourInfoDoesntMatch: "Your info doesn't match our records",

    // --- Visit Details ---
    visitDetails: "Visit details",
    visitChecklist: "Visit checklist",
    reviewInfo: "Review info",
    reviewYourVisitDetails: "Review your visit details",
    provider: "Provider",
    dateAndLocation: "Date and location",

    // --- Checklist Steps ---
    consentsPrivacy: "Consents & privacy",
    paymentInsurance: "Payment & insurance",
    vaccineQuestions: "Vaccine questions",
    symptomQuestions: "Symptom questions",
    completeVisitChecklist: "Complete visit checklist",
    actionNeeded: "Action needed",
    completedLabel: "Completed",

    // --- Check-In Actions ---
    checkIn: "Check In",
    checkInForGroup: "Check in for the group",
    startPrecheckIn: "Start pre-check in",
    imHere: "I'm here",
    wereHere: "We're here",
    itsTimeToCheckIn: "It's time to check in",
    nowJustAFewMore: "Now just a few more steps",
    confirmYoureInWaitingArea: "Confirm you're in the MinuteClinic waiting area",
    checkingInEarlyWarning: "Checking in before you're in the waiting area could increase your wait time.",

    // --- Visit Management ---
    addToCalendar: "Add to calendar",
    getDirections: "Get directions",
    rescheduleVisit: "Reschedule visit",
    cancelVisit: "Cancel visit",

    // --- Success States ---
    youreAllSet: "You're all set",
    checkedIn: "Checked In",
    allDone: "All done",
    youreCheckedIn: "You're checked in",

    // --- Error States ---
    somethingWentWrong: "Something went wrong",
    somethingsNotRight: "Something's not right",
    somethingWentWrongPlease: "Something went wrong. Please try again later",
    pleaseTryAgainIn: "Please try again in a few minutes.",
    tryAgain: "Try again",
    exitToVisitChecklist: "Exit to visit checklist",
    makeASelection: "Make a selection",
    selectAResponseTo: "Select a response to continue.",

    // --- Session Timeout ---
    areYouStillThere: "Are you still there?",
    timesAlmostUp: __isIOS ? "Time\u2019s almost up!" : "Time's almost up!",
    yourSessionWillExpire: "Your session will expire soon",
    yourSessionHasExpired: "Your session has expired",
    extendSession: "Extend session",

    // --- Navigation & Dismissal ---
    closeBtn: "Close",
    dismiss: "Dismiss",
    exitToHome: "Exit to home",
    backToHome: "Back to home",

    // --- Cancellation Confirmation ---
    canceledVisit: "Canceled visit",
    sorryVisitCanceled: "Sorry this visit was canceled",
    didYouWantToCancel: "Did you want to cancel this visit?",
    ifYouCancelYoull: __isIOS ? "If you cancel, you\u2019ll get an email or text message confirming this change." : "If you cancel, you'll get an email or text message confirming this change.",
    youWontBeCharged: "You won't be charged for this visit.",
    cancelVisitConfirmation: "Consider it done - your visit has been canceled",
    youllGetAnEmail: __isIOS ? "You\u2019ll get an email or text message confirming this change. Don\u2019t worry, you won\u2019t be charged for this visit." : "You'll get an email or text message confirming this change. Don't worry, you won't be charged for this visit.",
    areYouSureYouWantToLeave: "Are you sure you want to leave?",
    leave: "Leave",
    continueEditing: "Continue editing",

    // --- Pharmacy Check-In ---
    areYouHereAtPharmacy: "Are you here at the pharmacy?",

    // --- Reminder & Missed ---
    reminderAboutCheckingIn: "Reminder about checking in",
    weMissedYou: "We missed you",

    // --- Check-In Details (from VM) ---
    insideMinuteClinicLabel: "Are you inside the MinuteClinic?",
    checkInWhenArrivedMsg: "Check in when you have arrived",
    stayCloseMsg: "Stay close to the MinuteClinic waiting area",
    percentageComplete: ".*%.*complete.*|.*% complete.*",
};

// ========================================================================
// CONSENTS & PATIENT SELECTION (from VM)
// ========================================================================
output.health_consents = {
    // Patient Selection
    selectPatientNavBar: "Select patient",
    whoIsThePatientLabel: "Who is the patient?",
    whatsYourConnection: "What's your connection to the patient?",
    moreQuestionsMayAppear: "More questions may appear based on your responses. All fields required.",
    itsMeBtn: __isIOS ? "It\u2019s me" : "It's me",
    itsSomeoneInMyCareBtn: __isIOS ? "It\u2019s someone in my care" : "It's someone in my care",

    // Consents Navigation
    consentsNavBar: "Consents",
    beforeWeCanSeeYouLabel: "Before we can see you",

    // Required Consents
    requiredConsentsSection: "Required consents|Required",
    treatmentConsent: "Treatment consent|Treatment Consent",
    privacyNotice: "Privacy notice|Privacy Notice",
    consentsToConsiderSection: "Consents to consider",

    // Relationship to Patient
    parentOption: "Parent",
    legalGuardianOption: "Legal guardian",
    authorizedRepOption: "Authorized representative",

    // Ethnicity
    ethnicitySection: "Ethnicity",
    hispanicOrLatinoOption: "Hispanic or Latino",
    notHispanicOption: "Not Hispanic",
    ethnicityDontKnowOption: __isIOS ? "I don\u2019t know" : "I don't know",
    ethnicityPreferNotOption: "I prefer not to answer",

    // Race
    raceSection: "Race",
};
