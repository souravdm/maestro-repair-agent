/**
 * Production Environment Test Credentials
 * Follows the same pattern as users_qa.js
 */

// Get environment from process.env (set by test.sh based on BUILD_CONFIG)
const ENVIRONMENT = process.env.ENVIRONMENT || 'prod';

const TEST_DATA = {
    LOA2: {
        email: 'demosevencardholder@gmail.com',
         firstName: 'CARDHOLDER',
         lastName: 'SEVEN',
         phoneNumber: '8175847174',
         dob: '08051975'
    },
    DEMOSEVENCARDHOLDER: {
        email: 'colleagueslaonepuppysocks@gmail.com',
        password: 'cvspass1',
        firstName: 'DRAGON',
        lastName: 'FLY',
        phoneNumber: '8175847174',
        dob: '01011971',
        hasCvsAccount: true
    }
    // Add more production users here as needed
};

if (typeof loginData != 'undefined') {
    switch(loginData) {
        case "LOA2":
            output.user = TEST_DATA.LOA2;
            break;
        default:
            output.user = TEST_DATA.LOA2;
            break;
    };
}
