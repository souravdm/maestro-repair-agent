const __platform = maestro.platform.toLowerCase() === "ios" ? "ios" : "android";
const __isIOS = __platform === 'ios';

output.pharmacy_orders = {
   ordersHeader: 'Orders',
   notFilledStatus: 'Not filled',
   wereWorkingOnIt: "We're working on it",
   orderDetailsReady: 'Ready for pickup',
   viewOrderButton: 'View order',
   myOrders: "My Orders",
   pharmacyOrderStatus: "Pharmacy Order Status",
   checkout: "Checkout",
   viewOrderDetails: "View order details",
   viewPickupDetails: "View pickup details",
   getItDelivered: "Get it delivered",
}

output.pharmacy_ordersDetails = {
    header: 'Order Details',
    readyForPickup: 'Ready for pickup',
    availableUntil: 'Available until .*',
    orderStatus: 'Received is Completed,Preparing is Completed,Currently Ready,Awaiting Picked up',
    orderNumber: 'Order #.*',
    orderDetailsFailed: "Order Details Failed",
}


output.pharmacy_prescriptions = {
    header: 'Prescriptions',
    noPrescriptionsAddedLabel: "No prescriptions added",
    noPrescriptionAddedLabel: "No prescription added",
    toContinueAddPresLabel: "To continue, please add at least 1 prescription to your order.",
    availableForRefill: 'Available for refill',
    refill: 'Refill',
    signInButton: 'Sign in',
    viewOrderLink: 'View order',
    prescriptionDetails: "Prescription Details",
    prescriptionHistory: "Prescription History",
    patients: "Patients",
    dueForRefill: "Due for refill",
    readyForRefill: "Ready for refill",
    nextRefill: "Next Refill",
}

output.pharmacy_prescriptions_sign_in = {
    pharmacyHeader: 'Prescriptions',
    signIntoPrescriptionsAcctLabel: "Sign in to your pharmacy account",
    managePrescriptionsLabel: "Manage your prescriptions, pharmacy settings and more",
}

output.pharmacy_notifications = {
    header: 'Pharmacy notification settings',
    textAlerts: 'Text alerts',
    automatedCalls: 'Automated calls',
    pharmacyEmails: 'Pharmacy emails',
    errorMessage: 'Something went wrong.*'
}

output.pharmacy_transferRx = {
    welcomeHeader: 'Welcome to prescription transfers.*',
    welcomeDescription: 'Transfer your prescriptions in 3 steps from any pharmacy to your preferred CVS Pharmacy® location.',
    getStartedButton: 'Get started now',
    choosePatientText: "Choose a patient whose prescription you'd like to transfer to CVS.",
    continueButton: 'Continue',
    cancelButton: 'Cancel transfer',
    backButton: 'Back',
    fillAPrescription: "Fill a prescription",
    weCantTransferYour: "We can't transfer your prescription(s) here",
}

output.pharmacy_durQuestions = {
    pregnancyReview: 'Pregnancy review',
    pregnancyQuestion: 'Are you pregnant or trying to get pregnant?'
}

output.pharmacy_more = {
    transferRxOption: 'Transfer Rx to CVS',
}

output.pharmacy_common = {
    backButton: 'Back',
    continueButton: 'Continue',
    errorMessage: 'Something went wrong.*',
    sessionExpired: "Session expired",
    loginSessionExpired: "Your login session has expired",
    noInternetConnection: "No internet connection.*",
    pleaseMakeSureDeviceConnected: "Please make sure your device is connected to internet",
    pleaseTryAgainLater: "Please try again later.",
    aSystemErrorOccurred: "A system error occurred",
    weCantAccessThis: "We can't access this information right now. Please try again later.",
    uhohSomethingWentWrong: "Uh-oh, something went wrong on our end",
    weAreExperiencingProblems: "We are experiencing problems connecting to the server. Please try again.",
    loading: "Loading.*",
    pleaseWait: "Please wait",
    closeBtn: "Close",
    cancelBtn: "Cancel",
    goBackBtn: "Go Back",
    leaveBtn: "Leave",
    applyBtn: "Apply",
    noCameraAccess: "No Camera Access!!",
    openSettings: "Open settings",

    // Save Dialog
    closeWithoutSaving: "Close without saving?",
    areYouSureYouWantToLose: "Are you sure you want to lose your changes?",
    keepEditing: "Keep editing",
    loseChanges: "Lose changes",
}

output.pharmacy_screen = {
    pharmacyTitle: "Pharmacy",
    refillPrescriptionsBtn: "View all prescriptions",
    checkOrderStatusBtn: "Check order status",
    scheduleVaccinesBtn: "Schedule vaccines",
    transferPrescriptionsBtn: "Transfer a prescription",
    manageAutoRefillsBtn: "Manage auto refills",
    pharmacySettingsBtn: "Pharmacy messaging & alerts",
    addManagePeopleBtn: "Add and manage people",
    financialSummaryBtn: "Financial summary",
    savingsFinderBtn: "Savings finder",
    myPrescriptionsTitle: "Prescriptions",
    refillBtn: "Refill",
    continueToCartBtn: "Continue to cart",
    getStartedBtn: "Get started",
    exploreWaysToPurchase: "Explore Ways To Purchase",
    quickRefill: "Quick refill",
    addToCart: "Add to cart",
    refillNow: "Refill now",
    viewDeals: "View deals",
    sortFilter: "Sort & Filter",

    // 90-Day Supply
    wereOnIt: "We're on it!",
    getPeaceOfMind: "Get peace of mind knowing we've got your inventory covered.",
}

output.pharmacy_dashboard = {
    pharmacyTitle: "Pharmacy",
    signInMessage: "Sign in to view your prescriptions",
    signInBtn: "Sign in",
    createAccountBtn: "Create an Account",
    toolsAndSettings: "Tools and Settings",
    automaticRefillsLnk: "Automatic Refills",
    pharmacyMessagingLnk: "Pharmacy Messaging",
    addAndManagePeopleLnk: "Add and Manage People",
    financialSummaryLnk: "Financial Summary",
    savingsFinderLnk: "Savings Finder",
    ninetyDaySupplyLnk: "90-Day Supply",
    spokenRxLnk: "Spoken Rx",
    completeYourPreferences: "Complete Your Preferences",
    finishSetupBtn: "Finish Setup",
    refillPrescriptionsBtn: "Refill Prescriptions",
    checkOrderStatusBtn: "Check Order Status",
    scheduleVaccinesBtn: "Schedule Vaccines",
    transferPrescriptionsBtn: "Transfer Prescriptions",
    automaticRefillNavBar: "Automatic Refills",
    pharmacyMessagingNavBar: "Pharmacy Messaging",
    addAndManagePeopleNavBar: "Add and Manage People",
    financialSummaryNavBar: "Financial Summary",
    savingFinderNavBar: "Savings Finder",
    prescriptionScheduleNavBar: "Prescription Schedule",
    moreSettingNavBar: "More Settings",
    drugInfoNavBar: "Drug Info",
    spokenRxNavBar: "Spoken Rx",
    connectPrescriptionsTitle: "Connect Prescriptions",
    viewEligiblePrescriptionsBtn: "View Eligible Prescriptions",
    autoRefillsBtn: "Auto Refills",
    autoRefillsLabel: "Auto refills",
    selfManagedBtn: "Self Managed",
    requestRxTransfer: "Request Rx Transfer",
    emailField: "Email",
    phoneNumberField: "Phone Number",
    mobileOption: "Mobile",
    landlineOption: "Landline",
    iConsentSwitch: "I Consent",
    smartSpendingTitle: "Smart Spending",
    trackYourSpendingBtn: "Track Your Spending",
    smartSpendingLabel: "Smart spending for healthier living",
    savingsOpportunities: "Savings Opportunities",
    searchThirdPartyDiscountsBtn: "Search Third Party Discounts",
    cvsRxCompareLnk: "CVS Rx Compare",
    enterAddressOrZipField: "Enter Address or Zip Code",
}

output.pharmacy_caregiving = {
    becomeTheirCaregiver: "Become their caregiver",
    letsSetYouUp: "Let's set you up to be a caregiver",
    yourCaregivingRelationships: "Your caregiving relationships",
    connectedByCaremark: "Connected by Caremark®",
    resendRequestTitle: "Resend Request?",
    resendBtn: "Resend",
    removeBtn: "Remove",
    cancelThisRequest: "Cancel this request?",
    yesCancelBtn: "Yes, Cancel",
    callCustomerCare: "Call Customer Care",
    backToHome: "Back to Home",
    chooseOne: "Choose one",
    textACode: "Text a code",
    scanTheirRxBarcode: "Scan their Rx barcode",
    enterTheirRxInfo: "Enter their Rx info manually",
    enterManually: "Enter manually",
    leaveWithoutAddingChild: "Leave without adding this child?",
    noGoBack: "No, go back",
    yesLeave: "Yes, leave",
    statusLabel: "Status",
    continueBtn: "Continue",

    // Barcode Help
    needHelpFindingBarcode: "Need help finding the barcode?",
    whereCanIFindBarcode: "Where can I find the barcode?",

    // Caregiving Errors
    sorryWeCantCreateProfile: "Sorry, we can't create your pharmacy profile online",
    sorryWeCouldntComplete: "Sorry, we couldn't complete your pharmacy access. Please call Customer Care.",
    sorryWeCantSetUpCaregiver: "Sorry, we can't set you up to be a caregiver online",
    onceTheyTurn18: "Once they turn 18, you will lose access to their prescriptions. You can re-add them with their permission.",
}