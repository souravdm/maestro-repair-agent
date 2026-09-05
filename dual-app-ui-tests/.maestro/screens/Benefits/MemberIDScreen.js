/**
 * MemberIDScreen.js - Consolidated Member ID Screen Elements
 *
 * Merged files:
 * - Benefits/IDCardsScreen.js
 * - Benefits/MemberID/MemberIDCardScreen.js
 * - Benefits/MemberID/MemberSelectionScreen.js
 *
 * Used by: flows/Benefits/member-id*.yaml, subflows/Benefits/member-id*.yaml
 * Platform: iOS & Android
 */

const __platform = maestro.platform.toLowerCase() === "ios" ? "ios" : "android";
const __isIOS = __platform === 'ios';

// ============================================================================
// Original: Benefits/IDCardsScreen.js
// ============================================================================
output.benefits_id_cards = {
  // Page header
  pageTitle: "Your cards",
  insuranceCardTitle: "Insurance Card",
  digitalIdCardTitle: "Digital ID Card",
  customerCare: "Customer care representative",

  // Card selector (for dependents)
  memberSelector: "Select Member",
  memberDropdown: "member_selector",
  welcomeLabel: "Welcome,.*",
  primaryMember: "Primary Member",
  dependent: "Dependent.*",

  // ID Card elements
  memberName: "Member Name|Name:",
  memberNameValue: "[A-Z][a-z]+ [A-Z][a-z]+",
  viewMemberIds: __isIOS ? "more" : "View Aetna Member ID",
  shareOptions: "(?i).*(share|send|export|Share).*",
  shareCarefully: "(?i).*(Share Carefully).*",
  prescriptionCardLabel: __isIOS ? "CVS Pharmacy card" : "Prescription Pickup",
  prescriptionPickup: __isIOS ? "(?i).*(Prescription pick up).*" : "Prescription Pickup",
  memberId: "Member ID|ID:",
  memberIdValue: "[A-Z0-9]{8,12}",

  groupNumber: "Group Number|Group:",
  groupNumberValue: "[0-9]{6,10}",

  planName: "Plan Name|Plan:",
  planNameValue: ".*Health.*|.*PPO.*|.*HMO.*",

  effectiveDate: "Effective Date|Effective:",
  effectiveDateValue: "[0-9]{2}/[0-9]{2}/[0-9]{4}",

  rxBin: "RX BIN|BIN:",
  rxBinValue: "[0-9]{6}",

  rxPcn: "RX PCN|PCN:",
  rxPcnValue: "[A-Z0-9]+",

  rxGroup: "RX Group|Group:",
  rxGroupValue: "[A-Z0-9]+",

  // Card actions
  downloadCardBtn: "Download|Save Card",
  shareCardBtn: "Share|Send Card",
  printCardBtn: "Print",
  addToWalletBtn: "Add to Wallet|Add to Apple Wallet",

  // Multiple cards
  frontCardLabel: "Front",
  backCardLabel: "Back",
  flipCardBtn: "Flip|Show Back|Show Front",

  // Dependent cards
  viewDependentBtn: "View Dependent Card",
  switchMemberBtn: "Switch Member",
  allMembersBtn: "All Members",

  // Navigation
  backBtn: "Back",
  closeBtn: "Close",

  // Verification elements
  cardDisplayed: "Member ID|Group Number|Insurance Card",

  // Empty states
  noCardMessage: "No ID card available|Card not found",

  // Loading states
  loadingCard: "Loading card.*|Please wait",

  // Error states
  errorMessage: "Unable to load card|Error|Try again",
  downloadError: "Download failed|Unable to save",

  // ===== MEMBER ID CARD DETAILS (iOS) =====
  useYourMemberIdMsg: "Use your Member ID card to fill prescriptions at participating pharmacies, access prescription benefits, and more.",  // iOS

  viewPlanDetailsBtn: "View Plan Details",  // iOS
  memberIdCardTitle: "Member ID card",  // iOS

  // ===== LOADING (Figma: member_id) =====
  loadingMemberIDsMsg: "Loading your Member IDs...",

  // ===== IN-STORE SCAN =====
  scanForRxPickupMsg: "Scan for prescription pickup and ExtraCare savings",
  scanForOrderPickupMsg: "Scan for prescription and order pickup",
  fasterPickupEnabledLabel: "Faster pickup enabled",

  // ===== SHARE / VIEW ACTIONS =====
  shareMemberIDBtn: "Share member ID",
  viewIDCardBtn: "View ID card",
  viewDetailsAndShareBtn: "View details & share",
  zoomIDCardBtn: __isIOS ? "Zoom" : "Zoom ID card",
  cardBtn: "(?i).*(Card).*",
  memberBtn: "(?i).*(Member).*",
  cardFront: "(?i).*(Card Front).*",
  cardBack: "(?i).*(Card Back).*",
  tapToViewMemberIDsLabel: "Tap to view Member IDs cards",

  // ===== DEDUCTIBLE / SPENDING SECTION ON CARD =====
  planYearSpendingLabel: "Plan year spending",
  inNetworkDeductiblesLabel: "In-network deductibles",
  outOfNetworkDeductiblesLabel: "Out-of-network deductibles",
  inNetworkMaxOOPLabel: "In-network max out-of-pocket",
  outOfNetworkMaxOOPLabel: "Out-of-network max out-of-pocket",
  metDeductibleMsg: "You have met your deductible",
  costSharingLabel: "Cost sharing",
  aetnaDeductibleSummary: "Aetna deductible summary",

  // ===== CARD FACE LABELS =====
  cardFrontLabel: "Card front",
  cardBackLabel: "Card back",

  // ===== SUBMIT / CLAIMS LINKS ON CARD =====
  submitPaperClaimsLabel: "Submit paper claims to:",
  submitClaimsOnlineBtn: "Submit claims online",

  // ===== CARD INFORMATION PAGE =====
  cardInformationTitle: "Card information",
  additionalMemberIDData: "Additional Member ID data",
  memberServicesNumber: "Member Services Number",
  payorId: "Payor Id",
};

// ============================================================================
// Original: Benefits/MemberID/MemberIDCardScreen.js
// ============================================================================
output.benefits_memberid_member_id_card = {
    // ============ HEADER & NAVIGATION ============
    memberIdTitle: __isIOS ? "Member ID" : "Member ID",
    backBtn: __isIOS ? "Back" : "Back",
    shareBtn: __isIOS ? "Share" : "Share",

    // ============ CARD DISPLAY ============
    cardFront: __isIOS ? "Front" : "Front",
    cardBack: __isIOS ? "Back" : "Back",
    cardImage: "Card image",
    flipCardBtn: "Flip card",

    // ============ MEMBER INFO ============
    memberName: "Member name",
    memberIdLabel: "Member ID",
    idCard: "(?i).*(ID Card).*",
    deanFantSelection: "(?i).*(DEAN FANT).*",
    groupNumberLabel: "Group number",
    planNameLabel: "Plan name",
    effectiveDateLabel: "Effective date",

    // ============ ADDITIONAL INFO ============
    customerServiceLabel: "Customer service",
    claimsAddressLabel: "Claims address",

    // ============ ACTION BUTTONS ============
    addToWalletBtn: "Add to Apple Wallet",
    downloadCardBtn: "Download card",
    emailCardBtn: "Email card",
    printCardBtn: "Print card",

    // ============ MEMBER SELECTOR ============
    memberSelector: "Select member",
    primaryMember: "Primary",
    dependentLabel: "Dependent",
    medicalCard: "Medical",
    dentalCard: "Dental",
    visionCard: "Vision",
    pharmacyCard: "Pharmacy",
}

// ============================================================================
// Original: Benefits/MemberID/MemberSelectionScreen.js
// ============================================================================
output.benefits_memberid_member_selection = {
    // ============ HEADER & NAVIGATION ============
    membersTitle: __isIOS ? "Members" : "Members",
    cancelBtn: __isIOS ? "Cancel" : "Cancel",
    closeBtn: __isIOS ? "Close" : "Close",

    // ============ FILTER & SEARCH ============
    filterMemberBtn: "Filter member",
    memberLabel: "Member",

    // ============ MEMBER LIST ============
    primaryUserName: "Benjamin Desomma",
    dependentUserName: "Sylo Desomma",
    primaryUserBtn: "B, Benjamin",
    dependentUserBtn: "S, Sylo",
    primaryUserLabel: "Primary User",
    dependentUserLabel: "Dependent User",
    selectedLabel: "Selected",
    memberSelectorTitle: "Member Selector",
    filterMemberTitle: "Filter Member",
    memberOption: "Member",
    memberBtn: "Member",

    // ============ BENEFITS DASHBOARD =====
    planSummaryLabel: "Plan Summary",
    planSummaryAltLabel: "Plan summary|Plan summaries",

    // ============ ACTION BUTTONS ============
    applyBtn: __isIOS ? "Apply" : "Apply",
    sheetGrabberBtn: __isIOS ? "Sheet Grabber" : "Sheet Grabber",
}
