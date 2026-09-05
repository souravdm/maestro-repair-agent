const __platform = maestro.platform.toLowerCase() === "ios" ? "ios" : "android";
const __isIOS = __platform === 'ios';

output.shop_plp = {
    sortBtn: "Sort",
    filterBtn: "Filter",
    productCountLabel: ".*result.*",
    productTileName: ".*",
    productTilePrice: "\\$.*",
    productTileRating: ".*star.*",
    addToCartBtn: "Add to Cart",
    shipsFreeLabel: "Ships Free",
    priceRange: "\\$.*-.*\\$.*",
    sddAvailableBadge: "Same-Day Delivery available",
    changeStoreBtn: "Change store",
    searchResultsForLabel: "Search results for.*",
    noResultsMessage: "No results",
    loadMoreBtn: "Load more",
    shelfTitle: ".*",
    categoryName: ".*",
}
