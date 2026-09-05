const __platform = maestro.platform.toLowerCase() === "ios" ? "ios" : "android";
const __isIOS = __platform === 'ios';

output.account_profile = {
    // Navigation
    profileNavTitle: "Profile",
    backBtn: "Back",

    // Profile Header
    editPhotoBtn: "Edit photo",
    editProfileBtn: "Edit",

    // Personal Information Section
    personalInfoHeader: "Personal information",
    nameLabel: "Name",
    nameOption: "Name|First name",
    firstNameLabel: "First name",
    firstNameField: "First name.*",
    firstNameFieldId: "id:firstNameField",
    lastNameLabel: "Last name",
    lastNameField: "id:lastNameField",
    preferredNameLabel: "Preferred name",
    preferredNameField: "id:preferredNameField",
    dateOfBirthLabel: "Date of birth",
    dateOfBirthOption: "Date of Birth|DOB",
    dateOfBirthValue: ".*/.*/.*",
    editNameTitle: "First name|Edit Name",

    // Contact Information Section
    contactInfoHeader: "Contact information",
    emailLabel: "Email",
    emailField: "id:emailField",
    emailOption: "Email",
    phoneLabel: "Phone",
    phoneField: "id:phoneField",
    passwordLabel: "Password",
    passwordOption: "Password",
    changeEmailTitle: "Change Email|Email",

    // Actions
    editBtn: "Edit",
    saveBtn: "Save",
    saveChangesBtn: "Save|Save Changes",
    cancelBtn: "Cancel",
    doneBtn: "Done",
    closeBtn: "Close",
    okBtn: "OK",
    closeOrOkBtn: "Close|OK|Done",

    // Field Restrictions (LOA2)
    lockedFieldIcon: "id:lockedIcon",
    lockedFieldMessage: "Contact customer care to update",

    // Validation Messages
    requiredFieldMsg: "This field is required",
    invalidEmailMsg: "Please enter a valid email",
    invalidPhoneMsg: "Please enter a valid phone number",

    // Success Messages
    profileUpdatedMsg: "Profile updated successfully",
    updatedOrSavedMsg: "updated|saved|Success",

    // Android - Profile Fields & Validation
    preferredNameOptionalField: "Preferred name (Optional)", // Android
    enterFirstNameMsg: "Enter your first name", // Android
    enterLastNameMsg: "Enter your last name", // Android
    maxLengthExceededMsg: "Max length exceeded", // Android
    profileNameUpdateFailedMsg: "Profile name update failed", // Android
    onlyLettersMsg: "Only enter letters, periods, dashes, apostrophes, asterisks and spaces.", // Android
    updatedNameLabel: "Updated name", // Android
    applyChangePrompt: "Apply this change to your connected profiles?", // Android
    updateConnectedProfilesBtn: "Update connected profiles", // Android
};
