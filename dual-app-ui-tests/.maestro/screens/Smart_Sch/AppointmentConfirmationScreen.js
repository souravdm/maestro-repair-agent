// Smart Scheduler (Care Routing Sub-Agent) - Screen: AppointmentConfirmationScreen
const __isIOS = maestro.platform.toLowerCase() === "ios";

output.appt_confirm = {
    confirmationHeader: "Here are the details of your appointment.*|Review your details.*",
    confirmBtn: "Confirm|Confirm to proceed|Agree & submit",
    editBtn: "Edit",
    appointmentDetailsBlock: "appointment.*detail.*|here are.*details.*",
    submittingMsg: "Submitting your request.*",
    successMsg: "Your appointment is submitted.*|Your appointment is scheduled.*",
    errorMsg: "couldn't be submitted.*|request couldn't be submitted.*",
    retryBtn: "Try again|Want to try again",
    disclaimerText: "For emergencies, call 911.*|Request only.*",
    termsLink: "Terms and Conditions",
    canceledMsg: "Your appointment is canceled.*",
    summaryText: "details of your appointment.*|appointment.*details.*"
};
