const __platform = maestro.platform.toLowerCase() === "ios" ? "ios" : "android";
const __isIOS = __platform === 'ios';

output.account_cvsHealthCaregiving = {
    // Navigation
    cvsHealthCaregivingNavBar: "CVS Health caregiving",
    backBtn: "Back",
    
    // Caregiving Options
    caregivingHeader: "Caregiving options",
    addDependentBtn: "Add dependent",
    manageDependentsBtn: "Manage dependents",
    caregiverAccessBtn: "Caregiver access",
    
    // Dependent List
    dependentListHeader: "Dependents",
    noDependentsMsg: "No dependents added",
    addDependentCard: "Add a dependent",
    
    // Dependent Card
    dependentName: ".*",
    dependentRelationship: ".*",
    dependentAge: "Age.*",
    editDependentBtn: "Edit",
    removeDependentBtn: "Remove",
    
    // Add/Edit Dependent Form
    addDependentTitle: "Add dependent",
    editDependentTitle: "Edit dependent",
    firstNameLabel: "First name",
    firstNameField: "id:firstNameField",
    lastNameLabel: "Last name",
    dateOfBirthLabel: "Date of birth",
    relationshipLabel: "Relationship",
    relationshipField: "id:relationshipField",
    
    // Relationship Options
    childOption: "Child",
    spouseOption: "Spouse",
    parentOption: "Parent",
    otherOption: "Other",
    
    // Actions
    saveBtn: "Save",
    cancelBtn: "Cancel",
    confirmRemoveBtn: "Remove",
    
    // Success Messages
    dependentAddedMsg: "Dependent added successfully",
    dependentUpdatedMsg: "Dependent updated successfully",
    dependentRemovedMsg: "Dependent removed",
};
