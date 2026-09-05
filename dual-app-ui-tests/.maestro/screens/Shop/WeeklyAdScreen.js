const __platform = maestro.platform.toLowerCase() === "ios" ? "ios" : "android";
const __isIOS = __platform === 'ios';

output.shop_weekly_ad = {
    weeklyAdTitle: "Weekly Ad",
    thisWeekDeals: "This Week's Deals",
    featuredDealsLabel: "Featured Deals",
    extracareOffersLabel: "ExtraCare Offers",
    clipCouponBtn: ".*Clip.*|.*Send to Card.*",
    clippedLabel: ".*Clipped.*|.*Added.*",
    sendToCardBtn: "Send to Card",
    sentToCardMsg: "Sent to Card",
    extracareCouponLabel: ".*ExtraCare.*",
    mfrCouponLabel: ".*MFR.*|.*Manufacturer.*",
    manufacturerCouponTitle: "Manufacturer Coupon",
    couponDetailsTitle: "Coupon Details",
    termsConditionsLabel: "Terms & Conditions",
    expirationDateLabel: "Expires",
    couponValueLabel: "Save",
    changeStoreBtn: "Change Store",
    selectStoreTitle: "Select Store",
    currentStoreLabel: "Current Store",
    viewAllDealsBtn: "View All Deals",
    shopNowBtn: "Shop Now",
    beautyDealsTab: "Beauty",
    healthDealsTab: "Health",
    personalCareTab: "Personal Care",
    householdTab: "Household",
}
