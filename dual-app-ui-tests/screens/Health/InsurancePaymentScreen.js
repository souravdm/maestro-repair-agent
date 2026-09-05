// InsurancePaymentScreen.js
// Screen elements for insurance coverage and payment flows

const __platform = maestro.platform.toLowerCase() === "ios" ? "ios" : "android";
const __isIOS = __platform === 'ios';

// --- Insurance ---
output.health_insurance = {
    insuranceCoverage: "Insurance coverage",
    insurance: "Insurance",
    confirmCoverage: "Confirm coverage",
    confirmInsurance: "Confirm insurance",
    addANewInsurance: "Add a new insurance card",
    skipInsuranceForNow: "Skip insurance for now",
    cardsOnFile: "Cards on file",
    medicarePartBCoverage: "Medicare Part B coverage",
    coverageNotice: "Coverage Notice"
};

// --- Payment ---
output.health_payment = {
    payment: "Payment",
    addPayment: "Add payment",
    authorizePayment: "Authorize payment",
    savedCards: "Cards on file",
    costAndCoverage: "Cost and Coverage",
    costMayVary: "Cost may vary. Most insurance accepted."
};
