const __platform = maestro.platform.toLowerCase() === "ios" ? "ios" : "android";
const __isIOS = __platform === 'ios';

output.shop_pdp = {
    productTitle: ".*",
    priceLabel: "\\$.*",
    addToCartBtn: "Add to Cart",
    quantitySelector: "Quantity",
    quantityIncrease: "+",
    quantityDecrease: "-",
    pickupOption: "Pick it up",
    shippingOption: "Ship it",
    sameDayDeliveryOption: "Same-Day Delivery",
    reviewsCount: ".*review.*",
    starRating: ".*star.*",
    writeAReviewBtn: "Write a review",
    productDescription: "Product description",
    seeMoreDetailsLnk: "See more details",
    availabilityMessage: "Availability",
    changeStoreBtn: "Change store",
    sizeSelector: "Size",
    colorSelector: "Color",
    deliveryEstimatedDate: "Estimated.*delivery.*",
    backBtn: __isIOS ? "Back" : "Navigate up",
    shareBtn: "Share",
    addToListBtn: "Add to list",
    zoomImage: "Zoom",
}
