const __platform = maestro.platform.toLowerCase() === "ios" ? "ios" : "android";
const __isIOS = __platform === 'ios';

output.invite_only = {
    iHaveAnInviteCode: "I have an invite code",
    joinTheWaitlist: "Join the waitlist",
    screenTitle: "Enter your invite details",
    inviteEmail: "Email",
    inviteCode: "Invite code.*",
    continueBtn: "Continue"
}