// Smart Scheduler (Care Routing Sub-Agent) - Screen: PatientSelectionScreen
const __isIOS = maestro.platform.toLowerCase() === "ios";

output.patient_selection = {
    patientSelectionHeader: "Hi.*select a patient|Who is this.*for|select a patient",
    forMyselfOption: "For myself|Myself|myself",
    patientCard: __isIOS ? "patient.*card.*|dependent.*card.*" : "patient.*card.*|dependent.*card.*",
    addNewPatientBtn: "Add.*patient|someone else|Someone else",
    firstNameField: "First name.*|first name",
    lastNameField: "Last name.*|last name",
    fullNameField: "patient's name.*|name.*first.*last",
    dobField: __isIOS ? "Date of Birth MMDDYYYY|Date of birth.*" : "Date of birth|date of birth",
    genderMaleOption: "Male|male",
    genderFemaleOption: "Female|female",
    invalidDobMsg: "I couldn't process that date.*|Try the format.*",
    genderErrorMsg: "Choose male or female.*",
    patientNotFoundMsg: "couldn't find.*patient.*|Patient.*not found",
    saveBtn: "Save|Continue|Done"
};
