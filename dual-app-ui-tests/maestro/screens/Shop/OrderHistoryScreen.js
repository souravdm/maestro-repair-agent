const __platform = maestro.platform.toLowerCase() === "ios" ? "ios" : "android";
const __isIOS = __platform === 'ios';

output.shop_orderHistory = {
    orderHistoryNavBar: "Order history",
    orderDate: ".*\\d{1,2}/\\d{1,2}/\\d{2,4}.*",
    orderStatus: ".*",
    orderTotal: "\\$.*",
    orderNumber: "Order #.*",
    viewOrderDetailsBtn: "View order details",
    reorderBtn: "Reorder",
    trackOrderLnk: "Track order",
}
