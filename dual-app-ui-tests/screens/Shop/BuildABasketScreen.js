const __platform = maestro.platform.toLowerCase() === "ios" ? "ios" : "android";
const __isIOS = __platform === 'ios';

output.shop_buildABasket = {
    buildABasketNavBar: "Build a basket",
    categoryTiles: ".*",
    productSuggestions: ".*",
    addToCartBtn: "Add to Cart",
    basketTotal: "\\$.*",
    viewBasketBtn: "View basket",
    recommendedItems: "Recommended",
}
