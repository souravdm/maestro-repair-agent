/**
 * calculateDateFilled.js
 * Calculates the "Date Filled" date for prescription claims
 *
 * Logic:
 * - If today is in the first 10 days of the month: use today's date
 * - Otherwise: use today's date minus 3 days (e.g. 15th → 12th)
 *
 * Output:
 *   output.dynamicDateFilled     — MMDDYYYY format (kept for reference)
 *   output.calendarDayPoint      — "x%,y%" coordinate for tapOn: point (legacy —
 *                                  kept only for enterCompoundDrugMedicationDetails.yaml,
 *                                  which still uses it; do not rely on this for new code)
 *   output.calendarDayTextPattern — full-string regex matching the target day cell's
 *                                  accessibility label on either platform
 *
 * Why calendarDayTextPattern replaces calendarDayPoint: day cells DO have accessibility
 * labels on both platforms (confirmed live via inspect_screen) —
 *   iOS:     "Today, Thursday, September 3, 2026" / "Wednesday, September 2, 2026"
 *   Android: "3, Thursday, September 3, 2026, Today" / "2, Wednesday, September 2, 2026"
 * Both share the literal "<Month> <day>, <year>" (no leading zero on day) — wrapping
 * it in ".*...*" matches either platform's exact prefix/suffix without needing
 * device-specific pixel coordinates, which drift across screen sizes and app layout
 * changes (the old percentages were measured for a different device/layout and no
 * longer line up with the current one).
 */

const today = new Date();
const dayOfMonth = today.getDate();

let dateToUse;
if (dayOfMonth <= 10) {
  dateToUse = today;
} else {
  dateToUse = new Date(today);
  dateToUse.setDate(today.getDate() - 3);
}

const month = String(dateToUse.getMonth() + 1).padStart(2, '0');
const day = String(dateToUse.getDate()).padStart(2, '0');
const year = dateToUse.getFullYear();

output.dynamicDateFilled = month + day + year;

// Legacy point-based tap coordinates — retained only for
// enterCompoundDrugMedicationDetails.yaml (not yet migrated).
const firstDayOfWeek = new Date(dateToUse.getFullYear(), dateToUse.getMonth(), 1).getDay(); // 0=Sun
const dayGridIndex = firstDayOfWeek + dateToUse.getDate() - 1;
const gridRow = Math.floor(dayGridIndex / 7);
const gridCol = dayGridIndex % 7;

const xPct = Math.round(17 + gridCol * 10.7);
const yPct = Math.round(30 + gridRow * 3);
output.calendarDayPoint = xPct + "%," + yPct + "%";

// Robust text-based selector for the target day cell (see comment above).
const monthNames = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];
const monthName = monthNames[dateToUse.getMonth()];
output.calendarDayTextPattern = ".*" + monthName + " " + dateToUse.getDate() + ", " + year + ".*";
