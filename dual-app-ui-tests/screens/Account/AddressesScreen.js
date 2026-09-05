const __platform = maestro.platform.toLowerCase() === "ios" ? "ios" : "android";
const __isIOS = __platform === 'ios';

output.account_addresses = {
    // Navigation
    addressesNavBar: "Addresses",
    backBtn: "Back",
    
    // Address List
    addressListHeader: "Saved addresses",
    addNewAddressBtn: "Add new address",
    noAddressesMsg: "No saved addresses",
    
    // Address Card
    primaryAddressLabel: "Primary",
    shippingAddressLabel: "Shipping",
    billingAddressLabel: "Billing",
    addressLine1: ".*",
    addressLine2: ".*",
    cityStateZip: ".*,.*.*",
    editAddressBtn: "Edit",
    deleteAddressBtn: "Delete",
    setAsPrimaryBtn: "Set as primary",
    
    // Add/Edit Address Form
    addAddressTitle: "Add address",
    addAddressBtn: "Add Address|Add address|Add new address",
    editAddressTitle: "Edit address",
    firstNameField: "First name.*",
    lastNameField: "Last name.*",
    streetAddressLabel: "Street address",
    streetAddressField: "Street address.*",
    streetAddressFieldId: "id:streetAddressField",
    streetAddressValue: "123 Main St",
    aptSuiteLabel: "Apt, suite, etc. (optional)",
    aptSuiteField: "id:aptSuiteField",
    cityLabel: "City",
    cityField: "City.*",
    cityFieldId: "id:cityField",
    stateLabel: "State",
    stateField: "State.*",
    stateFieldId: "id:stateField",
    stateOption: "Massachusetts",
    zipCodeLabel: "ZIP code",
    zipCodeField: "ZIP.*",
    zipCodeFieldId: "id:zipCodeField",
    addressTypeLabel: "Address type",
    shippingRadio: "Shipping",
    billingRadio: "Billing",
    bothRadio: "Both",
    setAsDefaultToggle: "Set as primary address",
    editBtn: "Edit",
    
    // Actions
    saveBtn: "Save",
    saveAddressBtn: "Save address",
    saveChangesBtn: "Save|Save Changes|Add Address",
    cancelBtn: "Cancel",
    cancelOrBackBtn: "Cancel|Back",
    confirmDeleteBtn: "Delete",
    
    // Validation Messages
    requiredFieldMsg: "This field is required",
    invalidZipMsg: "Please enter a valid ZIP code",
    
    // Success Messages
    addressAddedMsg: "Address added successfully",
    addressUpdatedMsg: "Address updated successfully",
    addressDeletedMsg: "Address deleted",
};
