const __platform = maestro.platform.toLowerCase() === "ios" ? "ios" : "android";
const __isIOS = __platform === 'ios';

output.pharmacy_cncRx = {
    // Header
    cncRxTitle: "CNC Rx",

    // Prescription Status
    prescriptionStatus: "Ready|In Progress|Shipped|Delayed",
    statusReady: "Ready",
    statusInProgress: "In Progress",

    // Pickup Details
    pickupLocation: "Pickup location.*|CVS Pharmacy.*",
    readyDate: "Ready date.*|Ready by.*",

    // Notifications
    notificationPreferences: "Notification preferences",

    // Actions
    changePharmacyBtn: "Change pharmacy|Change Pharmacy",
    changePickupLocation: "Change pickup location",

    // Store Search & Inventory
    storeSearch: "Store search",
    changeAddress: "Change Address",
    inStock: "In stock",
    outOfStock: "Out of Stock",
    checkInventory: "Check inventory",
    checkOurInventoryFor: "Check our inventory for your medication",
    controlledSubstancesCannotBeSearched: "Controlled substances cannot be searched",
    inStockFilter: "In stock filter",
    someRxsMayBeOutOfStock: "Some Rxs may be out of stock. Remove the filter to see all pharmacies.",

    // Shipping Carriers
    unitedParcelService: "United Parcel Service",
    unitedStatesPostalService: "United States Postal Service",
    tforceLogistics: "TForce Logistics",
    fedex: "FEDEX",
    roadie: "ROADIE",

    // Pickup & Delivery
    pickYourDate: "Pick your date",
    forFasterPickups: "For faster pickups",
    addPaymentMethodAndSignature: "Add payment method and signature",
}
