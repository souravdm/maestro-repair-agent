// Smart Scheduler (Care Routing Sub-Agent) - Screen: ClinicSelectionScreen
const __isIOS = maestro.platform.toLowerCase() === "ios";

output.clinic_selection = {
    clinicListHeader: "I found these providers near.*|Here are.*providers.*",
    clinicCard: __isIOS ? "clinic.*card.*|provider.*card.*" : "clinic.*card.*|provider.*card.*",
    clinicName: ".*Clinic.*|.*Health.*|.*Medical.*|.*Care.*",
    clinicDistance: ".*mi away|.*miles away|.*km away",
    showMoreBtn: "Show 6 more results|Show more results",
    showMoreConfirmMsg: "Here are 6 more options for you.*",
    dateSelectorHeader: "That clinic has availability on these days.*|Select a date.*",
    dateOption: __isIOS ? ".*\\d{1,2}/\\d{1,2}.*|.*Jan.*|.*Feb.*|.*Mar.*|.*Apr.*|.*May.*|.*Jun.*|.*Jul.*|.*Aug.*|.*Sep.*|.*Oct.*|.*Nov.*|.*Dec.*" : ".*\\d{4}-\\d{2}-\\d{2}.*|.*Monday.*|.*Tuesday.*|.*Wednesday.*|.*Thursday.*|.*Friday.*",
    timeSlotHeader: "Here are the available times.*|Select a time.*",
    timeSlot: ".*:\\d{2}\\s*(AM|PM).*|\\d{1,2}:\\d{2}.*",
    noAvailabilityMsg: "No available dates at that clinic.*|No time slots available.*",
    noClinicsMsg: "No clinics.*offer.*|no clinics found.*",
    loadingIndicator: __isIOS ? "Loading.*|shimmer.*" : "Loading.*|Progress.*"
};
