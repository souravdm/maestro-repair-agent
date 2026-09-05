/**
 * Universal Credentials Loader for Maestro
 * Auto-detects environment (QA/PROD) and loads appropriate credentials
 * Uses loginData env var to select user via switch statement
 * 
 * Usage in YAML:
 *   - runScript:
 *       file: ../../config/credentials-loader.js
 *       env:
 *         loginData: LOA2
 *         BUILD_CONFIG: ${BUILD_CONFIG}
 *         ENVIRONMENT: ${ENVIRONMENT}
 * 
 * Environment Detection (Priority Order):
 *   1. BUILD_CONFIG env var → debug=qa, adhoc/alpha/release=prod
 *   2. ENVIRONMENT env var → qa/prod
 *   3. Defaults to 'qa' if neither is set
 * 
 * Required Environment Variables (passed via env block):
 *   - BUILD_CONFIG: Set from build_config.yaml
 *   - ENVIRONMENT: Set based on BUILD_CONFIG
 *   - loginData: User identifier (LOA2, ELIZABETH_MILLER, etc.)
 * 
 * Output:
 *   - output.user = { email, password, dob, firstName, lastName, ... }
 */

// Detect environment
function detectEnvironment() {
    // Check BUILD_CONFIG first (passed via env block)
    // In Maestro's JS runtime, env vars are available as global variables
    // Use try-catch to safely check for globals without temporal dead zone issues
    let buildConfig = '';
    let envVar = '';
    
    try {
        buildConfig = (typeof BUILD_CONFIG !== 'undefined' && BUILD_CONFIG) ? String(BUILD_CONFIG).toLowerCase() : '';
    } catch (e) {
        buildConfig = '';
    }
   
    if (buildConfig === 'debug') {
        return 'qa';
    } else if (['adhoc', 'alpha', 'release'].includes(buildConfig)) {
        return 'prod';
    }
    
    // Check ENVIRONMENT env var (check global scope)
    try {
        envVar = (this && this.ENVIRONMENT) ? String(this.ENVIRONMENT).toLowerCase() : '';
        if (!envVar && typeof globalThis !== 'undefined' && globalThis.ENVIRONMENT) {
            envVar = String(globalThis.ENVIRONMENT).toLowerCase();
        }
    } catch (e) {
        envVar = '';
    }
    
    if (envVar === 'prod' || envVar === 'production') {
        return 'prod';
    } else if (envVar === 'qa' || envVar === 'quality' || envVar === 'staging') {
        return 'qa';
    }
    
    // Default to QA (safest option)
    return 'qa';
}

const DETECTED_ENV = detectEnvironment();
console.log(`✓ Environment detected: ${DETECTED_ENV.toUpperCase()}`);

// Load appropriate credentials data based on environment
let TEST_DATA;
if (DETECTED_ENV === 'prod') {
    // For prod, define inline or load from users_prod.js structure
    // Using inline definitions to avoid require() issues in Maestro
    TEST_DATA = {
        LOA2: {
            email: 'demosevencardholder@gmail.com',
            password: 'ProdPass123',
            dob: '08051975',
            firstName: 'CardHolder',
            lastName: 'Seven',
        },
        COLLEAGUE: {
            email: 'colleagueslaonepuppysocks@gmail.com',
            password: 'ProdPass123',
            dob: '01011971',
            firstName: 'colleagueslaone',
            lastName: 'puppysocks'
        },
    };
} else {
    // QA environment - inline QA credentials
    TEST_DATA = {
        LOA2: {
            email: 'senior.usavior@gmail.com',
            password: 'Nextgen@8888',
            dob: '09/01/1956',
            loa: 2,
            hasCvsAccount: true,
            firstName: 'ZSenior',
            lastName: 'Usavior'
        },
        ELIZABETH_MILLER: {
            email: 'Elizabeth.miller@qa2.com',
            password: 'Retail@4321',
            profileId: '1000020816',
            qlId: '643296504',
            memberId: 'SR033441301',
            dob: '01031960',
            firstName: 'Elizabeth',
            lastName: 'Miller'
        },
        ELIZABETH_KERMIT: {
            email: 'Elizabeth.kermit@test.com',
            password: 'C@mmon2025',
            profileId: '1000019999',
            qlId: '260726487',
            firstName: 'Elizabeth',
            lastName: 'Kermit'
        },
        BENJAMIN: {
            email: 'Benjamin@qa2.com',
            password: 'Retail@4321',
            profileId: '1000012307',
            qlId: '875063060',
            firstName: 'Benjamin',
            lastName: 'Smith'
        },
        STELLA_GORDAN: {
            email: 'Stella.gordan@test.com',
            password: 'C@mmon2025',
            profileId: '1000020001',
            qlId: '224649426',
            firstName: 'Stella',
            lastName: 'Gordan'
        },
        PATSY: {
            email: 'patsy@test.com',
            password: 'C@mmon2025',
            profileId: '1000008521',
            qlId: '668088389',
            firstName: 'PATSY',
            lastName: 'LHAMON'
        },
        ANDREA_JACKSON: {
            email: 'andrea.jackson@test.com',
            password: 'Retail@4321',
            profileId: '1000020114',
            qlId: '691081197',
            memberId: 'SR033440101',
            dob: '05061984'
        },
        LAYA_PATEL: {
            email: 'laya.patel@test.com',
            password: 'Retail@4321',
            memberId: 'SR104010601',
            dob: '01011990'
        },
        TIM_KENNEDY: {
            email: 'tim.kennedy@test.com',
            password: 'C@mmon2025',
            profileId: '1000020079',
            qlId: '495076062',
            memberId: 'SR031170101',
            dob: '05061984'
        },
        MEDICARE_USER: {
            email: 'medicare.user@qa2.com',
            password: 'Retail@4321',
            dob: '01011950',
            profileId: '1000021234',
            qlId: '643296505'
        },
        STCOB_USER: {
            email: 'stcob.user@qa2.com',
            password: 'Retail@4321',
            profileId: '1000021235',
            qlId: '643296506'
        },
        FORGOT_PASSWORD_USER: {
            email: 'forgot.password@qa2.com',
            password: 'Retail@4321',
            profileId: '1000021236',
            qlId: '643296507'
        },
        LOA1_01: {
            email: 'loa1.user@qa2.com',
            password: 'Retail@4321',
            profileId: '1000021237',
            qlId: '643296508'
        },
        LOA2_CAREGIVER: {
            email: 'caregiver@qa2.com',
            password: 'Retail@4321',
            profileId: '1000021238',
            qlId: '643296509'
        },
        LOA2_DISCONNECTED: {
            email: 'disconnected@qa2.com',
            password: 'Retail@4321',
            profileId: '1000021239',
            qlId: '643296510'
        },
        LOA2_WRONG_PHONE: {
            email: 'wrong.phone@qa2.com',
            password: 'Retail@4321',
            profileId: '1000021240',
            qlId: '643296511'
        },
        SPL_AND_CAREMARK: {
            email: 'spl.caremark@qa2.com',
            password: 'Retail@4321',
            profileId: '1000021241',
            qlId: '643296512'
        },
        QL_AND_RXC: {
            email: 'ql.rxc@qa2.com',
            password: 'Retail@4321',
            profileId: '1000021242',
            qlId: '643296513'
        },
        SPL_ONLY: {
            email: 'spl.only@qa2.com',
            password: 'Retail@4321',
            profileId: '1000021243',
            qlId: '643296514'
        },
        SPL_ONLY_NO_ACCOUNT: {
            email: 'spl.noaccount@qa2.com',
            password: 'Retail@4321',
            profileId: '1000021244',
            qlId: '643296515'
        },
        NO_MATCH: {
            email: 'nomatch@qa2.com',
            password: 'Retail@4321',
            profileId: '1000021245',
            qlId: '643296516'
        },
        NO_MATCH_PHONE: {
            email: 'nomatch.phone@qa2.com',
            password: 'Retail@4321',
            profileId: '1000021246',
            qlId: '643296517'
        },
        QL_ONLY: {
            email: 'ql.only@qa2.com',
            password: 'Retail@4321',
            profileId: '1000021247',
            qlId: '643296518'
        },
        QL_ONLY_2: {
            email: 'ql.only2@qa2.com',
            password: 'Retail@4321',
            profileId: '1000021248',
            qlId: '643296519'
        },
        QL_ONLY_3: {
            email: 'ql.only3@qa2.com',
            password: 'Retail@4321',
            profileId: '1000021249',
            qlId: '643296520'
        },
        RxWithPriorityCards: {
            email: 'rx.priority@qa2.com',
            password: 'Retail@4321',
            profileId: '1000021250',
            qlId: '643296521'
        },
        RxNoConsent: {
            email: 'rx.noconsent@qa2.com',
            password: 'Retail@4321',
            profileId: '1000021251',
            qlId: '643296522'
        },
        ReadyRx: {
            email: 'ready.rx@qa2.com',
            password: 'Retail@4321',
            profileId: '1000021252',
            qlId: '643296523'
        },
        ReadyNotFilledRx: {
            email: 'ready.notfilled@qa2.com',
            password: 'Retail@4321',
            profileId: '1000021253',
            qlId: '643296524'
        },
        availableForRenewal: {
            email: 'renewal@qa2.com',
            password: 'Retail@4321',
            profileId: '1000021254',
            qlId: '643296525'
        },
        WERE_WORKING_ON_IT_NBA: {
            email: 'working.nba@qa2.com',
            password: 'Retail@4321',
            profileId: '1000021255',
            qlId: '643296526'
        },
        DELAYED_NBA: {
            email: 'delayed.nba@qa2.com',
            password: 'Retail@4321',
            profileId: '1000021256',
            qlId: '643296527'
        },
        SUMMER_PE: {
            email: 'summer.pe@qa2.com',
            password: 'Retail@4321',
            profileId: '1000021257',
            qlId: '643296528'
        },
        BRAYDEN_WILKIE: {
            email: 'brayden.wilkie@test.com',
            password: 'Retail@4321',
            dob: '09171982',
            profileId: '1000021258',
            qlId: '643296529'
        },
        REGRESSION_PE: {
            email: 'regression.pe@qa2.com',
            password: 'Retail@4321',
            profileId: '1000021259',
            qlId: '643296530'
        },
        FALL_PE: {
            email: 'fall.pe@qa2.com',
            password: 'Retail@4321',
            profileId: '1000021260',
            qlId: '643296531'
        },
        RIVER_PE: {
            email: 'river.pe@qa2.com',
            password: 'Retail@4321',
            profileId: '1000021261',
            qlId: '643296532'
        },
        DAFFODILS_DUR: {
            email: 'daffodils.dur@qa2.com',
            password: 'Retail@4321',
            profileId: '1000021262',
            qlId: '643296533'
        },
        SUNFLOWERS_DUR: {
            email: 'sunflowers.dur@qa2.com',
            password: 'Retail@4321',
            profileId: '1000021263',
            qlId: '643296534'
        },
        MERCEDES_CHANDU: {
            email: 'mercedes@qa2.com',
            password: 'Retail@4321',
            dob: '01011990',
            profileId: '1000021264',
            qlId: '643296535'
        },
        MITCHEL_DIVYAA: {
            email: 'mitchel.divyaa@qa2.com',
            password: 'Retail@4321',
            profileId: '1000021265',
            qlId: '643296536'
        },
        TUVALU_COUNTRY: {
            email: 'tuvalu@test.com',
            password: 'Retail@4321',
            dob: '09211954',
            profileId: '1000040843'
        },
        PRADHI_THIDHI: {
            email: 'pradhi.thidhi@qa2.com',
            password: 'Retail@4321',
            profileId: '1000021266',
            qlId: '643296537'
        },
        ANNABELLE_BOOK: {
            email: 'annabelle.book@qa2.com',
            password: 'Retail@4321',
            profileId: '1000021267',
            qlId: '643296538'
        },
        PEACH_BLOSSOM: {
            email: 'peach.blossom@qa2.com',
            password: 'Retail@4321',
            profileId: '1000021268',
            qlId: '643296539'
        },
        JUNE_MLP: {
            email: 'june.mlp@qa2.com',
            password: 'Retail@4321',
            profileId: '1000021269',
            qlId: '643296540'
        },
        APRIL_MLP: {
            email: 'april.mlp@qa2.com',
            password: 'Retail@4321',
            profileId: '1000021270',
            qlId: '643296541'
        },
        CARL_GREEN: {
            email: 'carl.green@qa2.com',
            password: 'Retail@4321',
            profileId: '1000021271',
            qlId: '643296542'
        },
        JUAN_BOOK: {
            email: 'juan.book@qa2.com',
            password: 'Retail@4321',
            profileId: '1000021272',
            qlId: '643296543'
        },
        ATHENA_PLU: {
            email: 'athena.plu@qa2.com',
            password: 'Retail@4321',
            profileId: '1000021273',
            qlId: '643296544'
        },
        DOBBY_BOOK: {
            email: 'dobby.book@qa2.com',
            password: 'Retail@4321',
            profileId: '1000021274',
            qlId: '643296545'
        },
        LEACH_ADAM: {
            email: 'leach.adam@qa2.com',
            password: 'Retail@4321',
            profileId: '1000021275',
            qlId: '643296546'
        },
        PONNABELLE_BOOK: {
            email: 'ponnabelle.book@qa2.com',
            password: 'Retail@4321',
            profileId: '1000021276',
            qlId: '643296547'
        },
        ESTEFANIA_MANNCHEN: {
            email: 'estefania.mannchen@cvs.com',
            password: 'Retail@4321',
            profileId: '1000021277',
            qlId: '643296548'
        },
        CAROLINA_SKRZYPINSKI: {
            email: 'carolina.skrzypinski@cvs.com',
            password: 'C@mmon2123!',
            profileId: '1000021278',
            qlId: '643296549'
        },
        DRAGONFRUIT_BOOK: {
            email: 'dragonfruit@cvs.com',
            password: 'Retail@4321',
            profileId: '1000030616',
            qlId: '643296550'
        },
        CHRISTINA_YANG: {
            email: 'christina.yang@qa2.com',
            password: 'Retail@4321',
            dob: '01011990',
            phoneNumber: '6156172983',
            hasCvsAccount: true
        },
        DEAN_FANT: {
            email: 'dean@qa2.com',
            password: 'Retail@4321',
            dob: '05301982',
            firstName: 'Dean',
            lastName: 'Fant',
            hasCvsAccount: true
        },
        WOOL: {
            firstName: 'Wool',
            lastName: 'User',
            email: 'wool@qa2.com',
            password: 'Retail@4321',
            dob: '01011990',
            hasCvsAccount: true
        },
        DWAYNE: {
            email: 'DWAYNE@qa2.com',
            password: 'Retail@4321',
            dob: '01281990',
            firstName: 'Dwayne',
            lastName: 'User',
            hasCvsAccount: true
        },
        SYLO: {
            email: 'Sylo@qa2.com',
            password: 'Retail@4321',
            dob: '03031981',
            firstName: 'Sylo',
            lastName: 'User',
            hasCvsAccount: true
        },
        ODALYS: {
            email: 'Odalys@qa2.com',
            password: 'Retail@4321',
            dob: '01011990',
            firstName: 'Odalys',
            lastName: 'User',
            hasCvsAccount: true
        },
        MONTANA_MONT: {
            email: 'montana.mont@qa2.com',
            password: 'Retail@4321',
            dob: '08281989',
            firstName: 'Montana',
            lastName: 'Mont',
            hasCvsAccount: true
        },
        GISELLE: {
            email: 'giselle@qa2.com',
            password: 'Retail@4321',
            dob: '05301983',
            firstName: 'Giselle',
            lastName: 'User',
            hasCvsAccount: true
        },
        CHAZR: {
            email: 'chazr@qa2.com',
            password: 'Retail@4321',
            dob: '08291995',
            firstName: 'Chazr',
            lastName: 'User',
            hasCvsAccount: true
        },
        TENNIS_ARMANI: {
            email: 'TENNIS.ARMANI@aetna.com',
            password: 'NWSso1!123',
            dob: '12311960',
            firstName: 'Tennis',
            lastName: 'Armani',
            hasCvsAccount: true
        },
        SIA_WILKIE: {
            email: 'sia.wilkie@test.com',
            password: 'Retail@4321',
            dob: '02031983',
            firstName: 'Sia',
            lastName: 'Wilkie',
            hasCvsAccount: true
        },
        ADDISON: {
            email: 'addison@qa2.com',
            password: 'Retail@4321',
            dob: '09031981',
            firstName: 'Addison',
            lastName: 'User',
            hasCvsAccount: true
        },
        JAVEN: {
            email: 'javen@qa2.com',
            password: 'Retail@4321',
            dob: '08151968',
            firstName: 'Javen',
            lastName: 'User',
            hasCvsAccount: true
        },
        SHAMAR: {
                    email: 'shamar@qa2.com',
                    password: 'Retail@4321',
                    dob: '05041994',
                    firstName: 'Shamar',
                    lastName: 'User',
                    hasCvsAccount: true
        },
        CARE_MARK_ONLY: {
                    email: 'kitts@qa2.com',
                    password: 'Retail@4321',
                    dob: '06061966',
                    firstName: 'Kitts',
                    lastName: 'User',
                    hasCvsAccount: true
                },
        HELENA: {
            email: 'helena@qa2.com',
            password: 'Retail@4321',
            dob: '08261996',
            firstName: 'Helena',
            lastName: 'User',
            hasCvsAccount: true
        },
        AHMAD: {
            email: 'ahmad@qa2.com',
            password: 'Retail@4321',
            dob: '03081996',
            firstName: 'Ahmad',
            lastName: 'User',
            hasCvsAccount: true
        },
        HAILEE: {
            email: 'hailee@qa2.com',
            password: 'Retail@4321',
            dob: '09031982',
            firstName: 'Hailee',
            lastName: 'User',
            hasCvsAccount: true
        },
        SPEEDY: {
            email: 'Speedy@qa2.com',
            password: 'Retail@4321',
            dob: '01191987',
            firstName: 'Speedy',
            lastName: 'User',
            hasCvsAccount: true
        },
        MARK_SLOAN: {
            email: 'mark.sloan@qa2.com',
            password: 'Retail@4321',
            dob: '01011990',
            firstName: 'Mark',
            lastName: 'Sloan',
            hasCvsAccount: true
        },
        LAURAB: {
            email: 'laurab@qa2.com',
            password: 'Retail@4321',
            dob: '01011998',
            firstName: 'Laura',
            lastName: 'B',
            hasCvsAccount: true
        },
        ROBERT_ARAGON: {
            email: 'Robert.aragon@qa2.com',
            password: 'Retail@4321',
            dob: '01011998',
            firstName: 'Robert',
            lastName: 'Aragon',
            hasCvsAccount: true
        },
        BEARGE: {
            email: 'Bearge@test.com',
            password: 'Retail@4321',
            dob: '07051955',
            firstName: 'Bearge',
            lastName: 'User',
            hasCvsAccount: true
        },
        NEVIS: {
            email: 'nevis@qa2.com',
            password: 'Retail@4321',
            dob: '06061976',
            firstName: 'Nevis',
            lastName: 'User',
            hasCvsAccount: true
        },
        JACK_DILL: {
            email: 'jack.dill@qa2.com',
            password: 'Retail@4321',
            dob: '01011990',
            firstName: 'Jack',
            lastName: 'Dill',
            hasCvsAccount: true
        },
        ANNA_REED: {
            email: 'anna.reed@test.com',
            password: 'Retail@4321',
            dob: '01011967',
            firstName: 'Anna',
            lastName: 'Reed',
            hasCvsAccount: true
        },
        ELLIS_DENNIS: {
            email: 'ellis.dennis@qa2.com',
            password: 'Retail@4321',
            dob: '01011990',
            firstName: 'Ellis',
            lastName: 'Dennis',
            hasCvsAccount: true
        },
        ALMOND:{
             email: 'almond@qa2.com',
             password: 'Password@1234',
             dob: '01011990',
             firstName: 'Almond',
             lastName: 'Book',
             hasCvsAccount: true
        },
        DAVON: {
            email: 'davon@qa2.com',
            password: 'Retail@4321',
            dob: '11211994',
            firstName: 'Davon',
            lastName: 'Dennis',
            hasCvsAccount: true
        }
    };
}

// Get user key from env var (passed via env block as global)
// In Maestro's JS runtime, env vars are available as global variables
const userKey = (typeof loginData !== 'undefined' ? String(loginData) : 'LOA2');

const userAliases = {
    LOA1: 'LOA1_01',
    WereWorkingOnIt: 'WERE_WORKING_ON_IT_NBA',
    DelayedNba: 'DELAYED_NBA'
};

const resolvedUserKey = userAliases[userKey] || userKey;
let selectedUser = TEST_DATA[resolvedUserKey];

if (!selectedUser) {
    if (DETECTED_ENV === 'prod') {
        const buildLabel = (typeof BUILD_CONFIG !== 'undefined' && BUILD_CONFIG) ? BUILD_CONFIG.toUpperCase() : 'PROD';
        console.log('');
        console.log('⚠️  CREDENTIAL WARNING ⚠️');
        console.log(`   Build type    : ${buildLabel}`);
        console.log(`   Requested user: "${userKey}"`);
        console.log('   This is a QA-only credential and does not exist in the prod user store.');
        console.log('   ACTION REQUIRED: Update the loginData value in your flow to a prod-compatible user.');
        console.log('   Falling back to prod LOA2 user for now.');
        console.log('');
    } else {
        console.log(`User ${userKey} not found, falling back to LOA2`);
    }
    selectedUser = TEST_DATA.LOA2;
}

// Set output for Maestro
output.detectedEnv = DETECTED_ENV;
if (selectedUser) {
    output.user = selectedUser;
    console.log(`Environment: ${DETECTED_ENV.toUpperCase()}`);
    console.log(`Loaded user: ${userKey}`);
    console.log(`Email: ${selectedUser.email}`);
    if (selectedUser.dob) {
        console.log(`DOB: ${selectedUser.dob}`);
    }
} else {
    console.error(`Failed to load user: ${userKey}`);
    console.error(`Available users: ${Object.keys(TEST_DATA).join(', ')}`);
    throw new Error(`Failed to load user: ${userKey}`);
}
