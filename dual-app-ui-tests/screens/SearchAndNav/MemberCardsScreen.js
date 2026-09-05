const __platform = maestro.platform.toLowerCase() === "ios" ? "ios" : "android";
const __isIOS = __platform === 'ios';

output.superapp_memberCards = {
    // Header
    memberCardsTitle: "Member cards|Member Cards",

    // Cards
    extraCareCard: "ExtraCare.*",
    insuranceCard: "Insurance card|Insurance Card",
    minuteClinicCard: "MinuteClinic.*card|MinuteClinic.*Card",

    // Card Details
    cardBarcode: __isIOS ? "Barcode" : "barcode",
    cardNumber: "Card number.*|Card Number.*",
}
