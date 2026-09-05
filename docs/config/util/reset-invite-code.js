/**
 * reset-invite-code.js
 * Maestro-compatible utility script — runs inside Maestro's JS sandbox.
 *
 * Resets the referral code counter for a given email + referral code.
 * POST https://internal-non-prod.pharmacy-qa-gke.cvshealth.com/microservices/h100-referral-code-management/validateReferralCode
 *
 * Usage in YAML:
 *   - runScript:
 *       file: ../../testdata/invite_code_qa.js
 *       env:
 *         inviteKey: QA_TEST
 *
 *   - runScript: ../config/util/reset-invite-code.js
 *
 * Reads from:
 *   output.access_credentials.email        (set by invite_code_qa.js)
 *   output.access_credentials.referralCode (set by invite_code_qa.js)
 *
 * Writes to:
 *   output.reset_invite_code.success   (boolean)
 *   output.reset_invite_code.status    (HTTP status code)
 *   output.reset_invite_code.body      (raw response body string)
 */

var email        = output.access_credentials && output.access_credentials.email        ? output.access_credentials.email        : '';
var referralCode = output.access_credentials && output.access_credentials.referralCode ? output.access_credentials.referralCode : '';

if (!email || !referralCode) {
    throw new Error('reset-invite-code: missing email or referralCode — run invite_code_qa.js first via runScript');
}

var response = http.post(
    'https://internal-non-prod.pharmacy-qa-gke.cvshealth.com/microservices/h100-referral-code-management/validateReferralCode',
    {
        headers: {
            'content-type': 'application/json'
        },
        body: JSON.stringify({
            resetCounter:  true,
            email:         email,
            referralCode:  referralCode
        })
    }
);

// This worked when changinf from stausCode to Status
var success = response.status >= 200 && response.status < 300;

output.reset_invite_code = {
    success:    success,
    status:     response.status,
    body:       response.body
};

if (success) {
    console.log('✓ Invite code reset succeeded for ' + email + ' (' + referralCode + ') — HTTP ' + response.statusCode);
} else {
    throw new Error('reset-invite-code: request failed — HTTP ' + response.statusCode + ' | ' + response.body);
}
