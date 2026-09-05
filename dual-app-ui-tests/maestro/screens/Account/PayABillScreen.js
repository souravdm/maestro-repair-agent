const __platform = maestro.platform.toLowerCase() === "ios" ? "ios" : "android";
const __isIOS = __platform === 'ios';

output.account_payABill = {
    // Navigation
    payABillNavBar: "Pay a bill",
    payABillTitle: "Pay a bill",
    backBtn: "Back",

    // Bill Payment Options
    billPaymentHeader: "Bill payment",
    minuteClinicBillBtn: "MinuteClinic bill",
    pharmacyBillBtn: "Pharmacy bill",
    otherBillBtn: "Other bill",

    // MinuteClinic Bill
    minuteClinicNavBar: "MinuteClinic bill",
    minuteClinicTitle: "MinuteClinic bill",
    accountNumberLabel: "Account number",
    accountNumberField: "Account number.*",
    amountDueLabel: "Amount due",
    amountDueValue: "$.*",
    payNowBtn: "Pay now",

    // Payment Method
    paymentMethodHeader: "Payment method",
    selectPaymentMethodBtn: "Select payment method",
    addPaymentMethodBtn: "Add payment method",
    creditCardOption: "Credit card",
    debitCardOption: "Debit card",
    bankAccountOption: "Bank account",

    // Payment Details
    cardNumberLabel: "Card number",
    cardNumberField: "Card number.*",
    expirationDateLabel: "Expiration date",
    expirationDateField: "Expiration date.*|MM/YY",
    cvvLabel: "CVV",
    cvvField: "CVV.*",
    billingZipLabel: "Billing ZIP code",
    billingZipField: "Billing ZIP code.*|ZIP code.*",

    // Actions
    submitPaymentBtn: "Submit payment",
    cancelBtn: "Cancel",
    continueBtn: "Continue",
    confirmBtn: "Confirm",

    // Success Messages
    paymentSuccessMsg: "Payment successful",
    paymentConfirmationMsg: "Your payment has been processed",
    paymentCompletedMsg: "Payment completed",

    // Error Messages
    paymentFailedMsg: "Payment failed",
    invalidCardMsg: "Please enter a valid card number",
    invalidExpirationMsg: "Please enter a valid expiration date",
    invalidCVVMsg: "Please enter a valid CVV",

    // Android - Bill Selection & Access
    chooseTheBillsMsg: "Choose the bills you want to access", // Android
    mailServicePharmacyBtn: "Mail service pharmacy", // Android
    minuteClinicLogoA11y: "Minute clinic logo", // Android
    cvsSpecialtyLogoA11y: "CVS Specialty logo", // Android
    cvsCaremarkLogoA11y: "CVS Caremark logo", // Android
    missingBillsMsg: "Missing bills?", // Android
    letsConnectHealthDataMsg: "Let's connect your health data so that you can access all of your bills.", // Android
    allCaughtUpMsg: "You're all caught up!", // Android

    // Android - Billing Details
    showBillingDetailsBtn: "Show billing details", // Android
    hideBillingDetailsBtn: "Hide billing details", // Android
    paymentAmountLabel: "Payment amount", // Android
    howMuchPayMsg: "How much would you like to pay?", // Android
    fullAmountOption: "Full amount", // Android
    customAmountOption: "Custom amount", // Android
    billingSummaryLabel: "Billing summary", // Android
    pricingSummaryLabel: "Pricing summary", // Android

    // Android - Payment Confirmation
    confirmationLabel: "Confirmation", // Android
    confirmationNumberLabel: "Confirmation number", // Android
    balancePaidLabel: "Balance paid", // Android
    payBillBtn: "Pay bill", // Android
    opensInBrowserMsg: "Opens in browser", // Android
};
