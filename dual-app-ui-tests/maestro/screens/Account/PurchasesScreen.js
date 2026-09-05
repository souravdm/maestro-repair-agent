const __platform = maestro.platform.toLowerCase() === "ios" ? "ios" : "android";
const __isIOS = __platform === 'ios';

output.account_purchases = {
    purchasesNavBar: "Purchases",
    inStoreTab: "In store",
    onlineTab: "Online",
    purchaseDateLabel: "Purchase date",
    storeLocationLabel: "Store location",
    totalAmountLabel: "Total amount",
    viewReceiptBtn: "View receipt",
    reorderBtn: "Reorder",
};
