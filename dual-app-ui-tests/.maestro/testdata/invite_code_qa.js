const INVITE_CREDENTIALS = {
    QA_TEST: {
        email: 'cvstestuser03@gmail.com',
        referralCode: 'W7Z9X4Q5'
    }
}

const resolvedKey = inviteKey;
if (!INVITE_CREDENTIALS[resolvedKey]) {
    throw new Error('Unknown invitation key: "' + inviteKey + '". No matching entry in INVITE_CREDENTIALS.');
}
output.access_credentials = INVITE_CREDENTIALS[resolvedKey];
