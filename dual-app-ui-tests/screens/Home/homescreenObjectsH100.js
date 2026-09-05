const __platform = maestro.platform.toLowerCase() === "ios" ? "ios" : "android";
const __isIOS = __platform === 'ios';

output.homescreen_error = {
    somethingWentWrong: ".*Something went wrong.*",
    notConnectedText: ".*Not connected to the internet.*",
    technicalIssuesMsg: "It looks like we're having technical issues. Please try again.",
    signInAgainMsg: "Something went wrong. Sign in again to see your updates.",
    checkNetworkMsg: "Something went wrong. Check your network connection, then try again.",
    notConnectedDetailMsg: "Not connected to the internet. Check your device settings to make sure you are connected.",
    loading: "Loading.*",
    checkingForUpdates: "Checking for updates",
    tryAgainBtn: "Try again",
    somethingWentWrongOnOurEnd: "Something went wrong on our end",
    signInAgainMsg2: "Something went wrong on our end. Sign in again to see your updates.",
    refreshPageMsg: "Refresh the page or try again later",
    refreshToReload: "Refresh the screen to reload or try again later.",
}

output.homescreen_activity = {
    activityHeader: "For you.*",
    // Individual ANBAs - Fulfillment Status
    anba_fs_delivered: "Delivered",
    anba_fs_ready: "Ready for pickup",
    anba_fs_shipped: "Shipped",
    anba_fs_inprocess: "In process",
    anba_fs_abandoned_cart: "Abandoned cart",
    anba_fs_create_shopping_list: "Create shopping list",
    anba_fs_continue_shopping_list: "Continue shopping list",
    
    // Individual ANBAs - Loyalty
    anba_loy_rewardsexpiring: "ExtraBucks Rewards",
    anba_loy_persdeal: "A deal just for you",
    anba_loy_persdealexpiry: "Get it before it’s gone",
    anba_loy_hipaareconsent: "Keep earning rewards at the pharmacy",
    anba_loy_ecplusreward: "Your bonus reward",
    anba_loy_ecplusexpiring: "Don’t miss out!",
    
    // Individual ANBAs - Rx Status
    anba_rx_delivered: "Delivered",
    anba_rx_ready: "Ready",
    anba_rx_shipped: "Shipped",
    anba_rx_workingonit: "Working on it",
    anba_rx_prescribercontacted: "Prescriber contacted",
    anba_rx_refill_scheduled: "Refill scheduled",
    anba_rx_refill: "Available for refill",
    anba_rx_refill_renewal: "Available for renewal",
    anba_rx_caregiving_waiting: "Caregiving waiting",
    anba_rx_caregiving_approval: "Caregiving approval",
    anba_rx_notrefilled: "Not refilled",
    anba_rx_sms_optin: "SMS opt-in",
    anba_rx_delayed: "Delayed",
    
    // Individual ANBAs - Health & Immunization
    anba_hs_upcomingmc: "MinuteClinic® visit",
    anba_hs_upcomingimz: "Vaccine appointment",
    anba_flu_covid_imz_reminder: "You're due for flu and COVID-19 vaccines",
    anba_flu_imz_reminder: "You're due for your flu shot",
    anba_covid_imz_reminder: "You're due for your COVID-19 vaccine",
    anba_hs_upcoming_group_imz: "Vaccine appointments",
    
    // Individual ANBAs - Pharmacy & DUR
    anba_dur_ready: "Ready",
    anba_dur_workingonit: "We're working on it",
    anba_pharmacy_chat_ciq: "New pharmacy response",
    anba_pharmacy_message_hub_ciq: "New pharmacy responses",
    anba_counsel_chat: "Message a physician",
    
    // Individual ANBAs - Rx Rewards
    anba_rrx_rewards: "Rx rewards",

    // Personalized Activity Tiles
    readyRxTile: "Ready Rx|Ready prescription.*",
    dealTile: "Deal.*",
    refillTile: "Refill.*",
    shippedTile: "Shipped.*",
    notFilledTile: "Not Filled|Not filled",
    bonusTile: "\\$10 Bonus|\\$10 bonus",

    // Legacy ANBAs (kept for backward compatibility)
    anba_availableForRefill: "Available for refill",
    anba_availableForRenewal: "Available for renewal",
    anba_wereWorkingOnIt: "We're working on it",
    anba_ready: "Ready",
    anba_delayed: "Delayed",
    anba_readyForPickup: "Ready for pickup",
    anba_notFilled: ".*Not filled.*",
    anba_bonusRewardBtn: "Your bonus reward",
    anba_messagePhysician: "Message a physician.*",
    anba_enrollInTextAlerts: "Enroll in text alerts.*",

    // PNBAs
    pnba_delayed: ".*prescription, Delayed.*",
    pnba_notFilled: ".*prescription, Not filled.*",
    // ANBA subheader
    prescriptionCount: ".* prescription.*",

    // Rx Summary
    rxSummaryNow: "Now:",
    rxSummaryNext: "Next:",
    rxAtText: "Rx at",

    // ANBA details
    subtext_reviewAndRefill: "Review and refill your Rx",
    subtext_reviewAndRenewBtn: "Review and renew your Rx",
    subtext_reviewYourOrder: ".*Review your order",
    subtext_pickupAtText: "Pickup at.*",
    subtext_infoNeededText: "We need some info to fill your Rx",
    subtext_reviewOrderDetails: "Review your order details",
}

output.homescreen_disclaimer = {
    text: "Restrictions apply. Offer not available in select states. See coupon or visit CVS.com/flu for more details.  **MinuteClinic® providers can prescribe GLP-1 agonists to patients who meet clinical eligibility criteria. GLP-1 supplies are not guaranteed to be available at a patient's pharmacy of choice and the medication may not be covered by insurance. GLP-1 prescribing may not be available in all states. Compounded GLP-1 and controlled substance medications for weight loss, are not prescribed at MinuteClinic (includes Phentermine, among others)."
}

output.homescreen_counsel = {
    title: "Connect with real providers in minutes",
    careConsultText: "Care consult",
    messageAndReceiveTreatmentText: "Message a physician and receive treatment for common conditions quickly.",
    thirdPartyDisclaimerText: "By clicking this link, you're leaving our app and going to a site managed by an unrelated third party. Any care you may receive is provided by Counsel Health physicians. Your use of that site is subject to that third party's terms of use and privacy policy.",
    messagePhysicianBtn: "Message a Counsel physician",
    counselHealthLogo: "Counsel Health logo",
    counselTitle: "Counsel",
    chatWithAPhysician: "Chat with a physician",
    messagePhysicianDesc: "Message a Counsel physician to get treatment for common conditions quickly.",

    businessUnitCta: "Request a care consult",
    businessUnitLabel: "Provided by Counsel",
    businessUnitOne: "Get treatment for common issues",
    businessUnitTwo: "Talk to experts — no appointment needed",
    businessUnitThree: "Responses in less than 15 minutes",
    requestCareConsult: "Request a Care consult",
}

output.homescreen_discover = {
    discoverHeader: "Discover.*",
    discoverLabel: "Discover what you can do",
    trendingNowSection: "Trending now|Trending Now",
    buyItAgainSection: "Buy it again|Buy It Again",
    shopCvsSection: "Shop CVS|Shop",
    allProductsLnk: "All products",
    dealsOfTheWeekLnk: "Deals of the week",
    photosTitle: "Photos",
    extraBigDealsTitle: "Extra Big Deals",
    tenExtraBucksReward: ".*10 ExtraBucks Rewards.*",
    photoDeals: ".*photo products*.*",
    valentinesShop: ".*Valentine's Day gifting starts here!.*",
    backToSchool: ".*Back-to-school essentials.*",
    bigHairEvent: ".*The Big Hair Event is back.*",
    checkPharmacyStock: ".*Check our pharmacy's stock for your meds.*",
    epicBeautySale: ".*EpicBeautySale.*",
    extraBigDeals: ".*Don't miss these Extra Big deals!.*",
    nflBlankets: ".*Get 50% off NFL blankets.*",
    freeSameDayDelivery: ".*Get FREE same-day delivery and more.*",
    allergyRelief: ".*Get relief for allergies as soon as today.*",
    hsaFsaFunds: ".*Use HSA or FSA funds before they expire.*",
    weightLossSolutions: ".*New solutions for weight loss.*",
    oakStreetHealth: ".*Oak St. Health part of CVS Healthspire.*",
    halloweenMustHaves: ".*Save on Halloween must-haves.*",
    saveTimeAtPickup: ".*Save time at pickup.*",
    scheduleFluShot: ".*Schedule your vaccines.*",
    shopSchoolSupplies: ".*Shop school supplies.*",
    startEarningRewards: ".*Start earning rewards.*",
    stayOnTrack: ".*Stay on track with your medications.*",
    unlockMoreRewards: ".*Unlock even more rewards.*",
    cvsShop: "CVS Shop",
    showDetails: "Show details",
    runningLow: "Running low?",
    stockUpOnFavorites: "Stock up on your favorite products",
}

output.homescreen_appRating = {
    header: "Healthier happens together®",
    subheader: "Enjoying the CVS Health app?",
    bodyText: "Take a moment to rate us or leave a review.",
    thumbsUp: "Love it!",
    thumbsDown: "Not quite",
}

output.homescreen_pharmacy = {
    header: "At the Pharmacy",
    viewAllPrescriptions: "View all prescriptions",
    reviewRxOrders: "Review Rx orders",
    updateDataAccess: "Update data access",
    cvsPharmacy: "CVS Pharmacy",
    cvsCaremark: "CVS Caremark",
    caremarkLabel: "Caremark",
    cvsSpecialty: "CVS Specialty",
    minuteclinic: "MinuteClinic®",
    deliveryBy: "Delivery by",
    open24Hours: "Open 24 Hours",
}

output.homescreen_healthServices = {
    healthServices: "Health services.*",
    healthShortcuts: "Health shortcuts.*",
    pharmacyShortcuts: "Pharmacy shortcuts|Pharmacy Shortcuts",
    exploreCareOptions: "Explore care options.*",
    viewAllVaccineOptions: "View all vaccine options.*",
    inPersonVirtualCare: "Find in-person or virtual care.*",
    scheduleFluShot: "Schedule your vaccines.*",
    getVaccinesLnk: "Get 14 no-cost vaccines with most insurance",
    vaccineSchedulerTitle: "Vaccine Scheduler",
}

output.homescreen_healthInsights = {
    header: "Health insights.*",
    articlesYouMightLikeSubheader: "Articles you might like",
    articlesDisclaimer: "This content redirects to a third-party website. CVS terms of use and privacy policy do not apply.",
    articleTile: "EveryDay Health.*",
    articlesEyeAndVisionHealthSubtext: "Eye & Vision Health",
    articlesSleepHealthSubtext: "Sleep",

    articleRedirectMsg: "To view the article, you'll be redirected to the CVS mobile web experience.",

    xponentialSubheader: "Under 20-minute fitness",
    xponentialVideo: "Xponential Video",
    xponentialDescription: "Looking for a new routine? Explore exercise videos from our partners at YogaSix, Pure Barre, Club Pilates and StretchLab.",
    xponentialProvidedBySubtext: "Provided by Xponential",

    playBtn: "Play",
    headspaceSubtext: "Provided by Headspace",
    headspaceAudio: "Headspace Audio",
    headspaceGuestPass: "Like what you hear? Try Headspace free for 14 days",
    headspaceTryForFree: "Try for free",
    headspaceTranscript: "Transcript",
    headspacePlayer: "Headspace",
    pause: "Pause",
    replay: "Replay",
    fastForward10Seconds: "Fast Forward 10 seconds",
    rewind10Seconds: "Rewind 10 Seconds",
    transcriptNotAvailable: "Transcript is not available at this time. Please try again later.",
    unableToLoadAudio: "Unable to load audio",
    unableToLoadVideo: "Unable to load video",
}

output.homescreen_extracare = {
    ecPlusHeader: "ExtraCare Plus™ Savings",
    savingsAndRewardsHeader: "Savings & rewards",
    startShoppingText: "Start shopping to earn Extrabucks® rewards!",
    shopNow: "Shop now",
    viewAllRewards: "View all rewards",
    viewAllDeals: "View all deals",
    extrabucksRewards: "ExtraBucks Rewards",
    extracare: "ExtraCare®",
    extracarePlus: "ExtraCare Plus™",
    aDealJustForYou: "A deal just for you",
    getItBeforeItsGone: "Get it before it's gone",
    daysLeft: "days left",
    dayLeft: "day left",
    expired: "Expired",
    sendToCard: "Send to card",
    savingAndRewards: "Saving & Rewards",
}

output.homescreen_branding = {
    cvsHealthLogo: "CVS Health Logo",
    cvsBranding: "CVS Branding",
    cvsCaremarkLogo: "CVS Caremark logo",
}

output.homescreen_deductible = {
    remaining: "Remaining",
    spent: "Spent",
    deductibleMetMsg: "You have met your individual deductible. Your plan will now share the cost for covered services and prescriptions.",
    deductibleLabel: "Deductible - ",
    prescriptionLabel: "Prescription",
}

output.homescreen_alerts = {
    leavingCvsApp: "Leaving CVS App",
    continueToCvsCom: "Continue to CVS.com",
    opensInBrowser: "opens in browser.",
    ageRestrictionMsg: "The CVS Health® app is not available to customers or patients under the age of 18.",
    weFoundYourExtracare: "We found your ExtraCare card, but in order to link it, we need to make sure it's really you",
}

output.homescreen_medreminders = {
    setup_title: "You can set up reminders for your medications",
    setup_subtext: "Medication reminders can help you build a habit and improve your health.",
    setupNow: "Set up now",

    all: "All",
    medicationReminders: "Medication reminders",

    rx_at_time: ".* Rx at.*",
    yourAllSet: "You’re all set for today",
    reviewedAllReminders: "You reviewed all your reminders.",
    viewEarlierReminders: "View earlier reminders",
}

output.homescreen_careRecommendations = {
    yourCareRecommendations: "Your care recommendations|Ways we can help",
    getInPersonCare: "Get in-person care",
    getInPersonCareSubtext: "More than 190 services offered, including vaccines for flu, COVID-19 and more, at your neighborhood MinuteClinic®",
    insuranceAccepted: "Insurance accepted",
    sameDay: "Same day",
    connectOverVideo: "Connect over video",
    connectOverVideoSubtext: "Virtual support for common and chronic conditions from MinuteClinic providers.",
    chatWithAPhysician: "Chat with a physician",
    chatWithAPhysicianSubtext: "Subscribe today and get access to quick care and health advice through chat.",
    tenDollarMonth: "$10/month",
    responseWithinMinutes: "Response in minutes"
}