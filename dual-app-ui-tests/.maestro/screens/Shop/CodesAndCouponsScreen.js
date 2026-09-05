const __platform = maestro.platform.toLowerCase() === "ios" ? "ios" : "android";
const __isIOS = __platform === 'ios';

output.shop_codesAndCoupons = {
    codesAndCouponsSection: "Codes and coupons",
    promoCodeTextField: "Promo code",
    applyBtn: "Apply",
    errorMessage: ".*error.*",
    successMessage: ".*applied.*",
    removeCouponBtn: "Remove",
}
