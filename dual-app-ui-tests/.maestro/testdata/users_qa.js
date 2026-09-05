/**
 * QA Environment Test Credentials
 * Dynamically selects user data based on ENVIRONMENT variable
 * Supports both QA and PROD environments with same user keys
 */

function generateRandomAlphabeticString(min = 4, max = 12) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    const length = Math.floor(Math.random() * (max - min + 1)) + min;
    var result = "";
    for (var i = 0; i < length; i++) {
      var randomIndex = Math.floor(Math.random() * alphabet.length);
      result += alphabet.charAt(randomIndex);
    }
    return result;
};

function generateRandomPhoneNumber() {
    const numbers = '1234567890';
    const length = 7;
    var result = '';
    for (var i = 0; i < length; i++) {
      var randomIndex = Math.floor(Math.random() * numbers.length);
      result += numbers.charAt(randomIndex);
    }
    return result;
};

// Get environment from env parameter (Maestro provides this, not process.env)
const ENVIRONMENT = (typeof env !== 'undefined' && env.ENVIRONMENT) ? env.ENVIRONMENT : 'qa';

const TEST_DATA = {
    ELIZABETH_MILLER: {
        email: 'Elizabeth.miller@qa2.com',
        password: 'Retail@4321',
        profileId: '1000020816',
        qlId: '643296504',
        memberId: 'SR033441301',
        dob: '01031960'
    },
    SYLO: {
        email: 'Sylo@qa2.com',
        password: 'Retail@4321',
        profileId: '1000012308',
        dob: '03031981'
    },
    MONTANA_MONT: {
        email: 'montana.mont@qa2.com',
        password: 'Retail@4321',
        profileId: '1000020909',
        dob: '08281989'
    },
    ODALYS: {
        email: 'Odalys@qa2.com',
        password: 'Retail@4321',
        profileId: '1000011717',
        dob: '01011990'
    },
    GISELLE: {
        email: 'giselle@qa2.com',
        password: 'Retail@4321',
        profileId: '1000012309',
        dob: '05301983'
    },
    DWAYNE: {
        email: 'DWAYNE@qa2.com',
        password: 'Retail@4321',
        profileId: '1000012310',
        dob: '01281990'
    },
    CHAZR: {
        email: 'chazr@qa2.com',
        password: 'Retail@4321',
        profileId: '1000035603',
        dob: '08291995'
    },
    TENNIS_ARMANI: {
        email: 'TENNIS.ARMANI@aetna.com',
        password: 'NWSso1!123',
        profileId: '1000024104',
        dob: '12311960'
    },
    SIA_WILKIE: {
        email: 'sia.wilkie@test.com',
        password: 'Retail@4321',
        profileId: '1000022413',
        dob: '02031983',
        hasCvsAccount: true
    },
    ELIZABETH_KERMIT: {
        email: 'Elizabeth.kermit@test.com',
        password: 'C@mmon2025',
        profileId: '1000019999',
        qlId: '260726487',
        dob: '12311960'
    },
    BENJAMIN: {
        email: 'Benjamin@qa2.com',
        password: 'Retail@4321',
        profileId: '1000012307',
        qlId: '875063060',
        dob: '03251980'
    },
    STELLA_GORDAN: {
        email: 'Stella.gordan@test.com',
        password: 'C@mmon2025',
        profileId: '1000020001',
        qlId: '224649426',
        dob: '12311960'
    },
    PATSY: {
        email: 'patsy@test.com',
        password: 'C@mmon2025',
        profileId: '1000008521',
        qlId: '668088389',
        firstName: 'PATSY',
        lastName: 'LHAMON',
        dob: '12311960',
        caremark: {
            idCard: {
                id: 'X4377327701',
                rxBin: '004336',
                rxPcn: 'ADV',
                rxGrp: 'RX1600',
                issuer: '9151014609'
            }
        }
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
    LOA1_01: {
        firstName: 'loa1',
        lastName: 'usertest',
        dob: '09091999',
        phoneNumber: '9999999999',
        email: 'loa1.test1@gmail.com',
        password: 'Create_12345!',
        loa: 1,
        hasCvsAccount: true
    },
    LOA2_WRONG_PHONE: {
        email: 'senior.usavior@gmail.com',
        password: 'Nextgen@8888',
        phoneNumber: '999' + generateRandomPhoneNumber(),
        dob: "09011956",
        loa: 2,
        hasCvsAccount: true,
        hasVerifiedPhone: false
    },
    LOA2: {
        email: 'senior.usavior@gmail.com',
        dob: "09011956",
        password: 'Nextgen@8888',
        loa: 2,
        hasCvsAccount: true
    },
    LOA2_DISCONNECTED: {
        firstName: 'Mars',
        lastName: 'Rickie',
        dob: '03101987',
        phoneNumber: '4846498151',
        email: 'mars.rickie@gmail.com',
        password: 'Caremark@12345!',
        loa: 1,
        hasCvsAccount: true,
        accountTied: false,
        ephData: [
            {caremark: true}
        ]
    },
    LOA2_CAREGIVER: {
        email: 'dadone.savior@gmail.com',
        password: 'Nextgen*8888',
        firstName: 'Dadone',
        lastName: 'Savior',
        phoneNumber: '6178998040',
        dob: '09041989',
        hasCvsAccount: true,
        profileId: '533353213',
        rxcId: '11213023972',
        ecNumber: '4872000237009',
        isECPlus: true,
        rxNotifications: 
            {
                textAlerts: false,
                automatedCalls: false,
                pharmacyEmails: false
            }, 
        caregivees: [
            {
                firstName: 'Cgiveetwo',
                lastName: 'Savior',
                dob: '09122022',
                phoneNumber: '6178998040'
            },
            {
                firstName: 'Cgiveone',
                lastName: 'Savior',
                dob: '09062023',
                phoneNumber: '6178998040'
            }
        ],
        ephData: [
            {
                rxc: true,
                caremark: true
            }
        ],
        rx: [
            {
                name: "Covid",
                status: "Not filled",
            }
        ]   
    },
    SPL_AND_CAREMARK: {
        email: 'haniya.afreen@cvs.com',
        password: 'Create_12345!',
        dob: '12311960',
        ephData: [
            {
                specialty: true,
                caremark: true
            }
        ]
    },
    QL_AND_RXC: {
        email: 'qamar.hayat@cvs.com',
        password: 'Create_12345!',
        dob: '12311960'
    },
    SPL_ONLY_NO_ACCOUNT: {
        firstName: 'Sana',
        lastName: 'Mahira',
        email: generateRandomAlphabeticString() + '@gmail.com',
        password: 'Create_12345!',
        hasCvsAccount: false,
        loa: 2,
        phoneNumber: '6156172983',
        dob: '12311960',
        ephData: [
            {
                specialty: true
            }
        ]

    },
    SPL_ONLY: {
        email: 'sana.mahira2@cvs.com',
        password: 'Create_12345!',
        dob: '12311960',
        ephData: [
            {
                specialty: true
            }
        ]
    },
    AETNA_ONLY_1: {
        firstName: 'ryan',
        lastName: 'essig',
        dob: '02121954',
        phoneNumber: '9999999999',
        email: 'Ryan.essig@qa2.com',
        password: 'Create_12345!',
        hasCvsAccount: true
    },
    QL_ONLY: {
        email: 'Frank.douglas@qa2.com',
        password: 'Caremark@1234',
        firstName: "Frank",
        lastName: "Douglas",
        dob: "01101987",
        phoneNumber: "8175847174",
        hasCvsAccount: true
    },
    QL_ONLY_NEW_ACCOUNT: {
        email: 'Frank.douglas'+ generateRandomAlphabeticString(5,5) +'@qa2.com',
        password: 'Caremark@1234',
        firstName: "Frank",
        lastName: "Douglas",
        dob: "01101987",
        phoneNumber: "8175847174",
        hasCvsAccount: true
    },
    QL_ONLY_2: {
        email: 'Tim.hanks@qa2.com',
        password: 'Caremark@1234!',
        dob: '10101986',
        hasCvsAccount: true
    },
    NO_MATCH: {
        firstName: generateRandomAlphabeticString(),
        lastName: generateRandomAlphabeticString(),
        dob: '09091999',
        phoneNumber: '999' + generateRandomPhoneNumber(),
        email: generateRandomAlphabeticString() + '@qa2.com',
        password: 'Create_12345!',
        hasCvsAccount: false,
        hasVerifiedPhone: false
    },
    NO_MATCH_PHONE: {
        firstName: generateRandomAlphabeticString(),
        lastName: generateRandomAlphabeticString(),
        dob: '09091999',
        phoneNumber: '999' + generateRandomPhoneNumber(),
        email: generateRandomAlphabeticString() + '@qa2.com',
        password: 'Create_12345!',
        hasCvsAccount: false,
        hasVerifiedPhone: false
    },
    QL_ONLY_3: {
        firstName: 'Harry',
        lastName: 'Benefit',
        dob: '09091990',
        phoneNumber: '6156172983',
        email: 'harry.benefit@qa2.com',
        password: 'Retail@4321',
        hasCvsAccount: true,
        ephData: [
            {
                caremark: true
            }
        ],
        caremark: 
            {
                outNetworkDeductible: '4,500',
                inNetworkDeductible: '2,500',
                maxOutNetworkDeductible: '6,500',
                maxInNetworkDeductible: '4,500',
                spentAmount: '0', 
                idCard: {
                    id: '',
                    rxBin: '004336',
                    rxPcn: 'ADV',
                    rxGrp: 'X0813',
                    issuer: '9151014609',
                }
            }
    },
    RxWithPriorityCards: {
        firstName: 'Almond',
        lastName: 'Book',
        dob: '01011990',
        phoneNumber: '4846498151',
        email: 'almond@qa2.com',
        password: 'Password@1234',
        hasCvsAccount: true,
        profileId: '533692043',
        rxcId: '11213031926',
        cmkId: '293529662',
        ecNumber: '4765181113739',
        isECPlus: true,
        ephData: [
            {
                rxc: true
            }
        ],
        rx: [
            {
                name: "Trulicity 0.75 Mg/0.5 Ml Pen",
                status: "Not filled",
            },
            {
                name: "Vitamin B Complex Capsule",
                status: "Preparing",
            },
            {
                name: "Lipistart Powder",
                status: "Preparing",
            },
            {
                name: "Accupril 5 Mg Tablet",
                status: "Received",
            }
        ]
    },
    ReadyRx: {
        firstName: 'MAYFLOWERS',
        lastName: 'DUR',
        dob: '01011990',
        phoneNumber: '3022570612',
        email: 'mayflowers@qa2.com',
        password: 'Retail@4321',
        hasCvsAccount: true,
        profileId: '534599789',
        rxcId: '11213174696',
        ecNumber: '4765181103525',
        isECPlus: true,
        ephData: [
            {
                rxc: true
            }
        ],
        rx: [
            {
                name: "Glipizide 5 Mg Tablet",
                status: "On hold",
            },
            {
                name: "Lithium Carbonate 150 Mg Cap",
                status: "We're working on it",
            },
            {
                name: "Carbamazepine 200 Mg Tablet",
                status: "Ready for Pickup",
            },
            {
                name: "Lipistart Powder",
                status: "Ready",
            },
            {
                name: "Vitamin B Complex Capsule",
                status: "Ready",
            }
        ]
    },
    availableForRenewal: {
        firstName: 'Marigolds',
        lastName: 'DUR',
        dob: '01011990',
        phoneNumber: '3022570612',
        email: 'Marigolds@qa2.com',
        password: 'Retail@4321',
        hasCvsAccount: true,
        profileId: '534598768',
        rxcId: '11213174698',
        ephData: [
            {
                rxc: true
            }
        ],
        rx: [
            {
                name: "Glipizide 5 Mg Tablet",
                status: "On hold",
            },
            {
                name: "Lithium Carbonate 150 Mg Cap",
                status: "We're working on it",
            },
            {
                name: "Carbamazepine 200 Mg Tablet",
                status: "Ready for Pickup",
            },
            {
                name: "Lipistart Powder",
                status: "Ready",
            },
            {
                name: "Vitamin B Complex Capsule",
                status: "Ready",
            }
        ]
    },
    ReadyNotFilledRx: {
            firstName: 'Azaleas',
            lastName: 'DUR',
            dob: '01011990',
            phoneNumber: '3022570612',
            email: 'Azaleas@qa2.com',
            password: 'Retail@4321',
            hasCvsAccount: true,
            profileId: '534599791',
            rxcId: '11213094116',
            isECPlus: false
    },
    RxNoConsent: {
        firstName: 'ACCTWO',
        lastName: 'BDSELFRX',
        dob: '12021981',
        phoneNumber: '6025545136',
        email: 'testloa02122@cvs.com',
        password: 'Create_12345!',
        hasCvsAccount: true,
        ephData: [
            {
                rxc: true
            }
        ],
        rx: [
            {
                name: "Trulicity 0.75 Mg/0.5 Ml Pen",
                status: "Not filled",
            },
            {
                name: "Vitamin B Complex Capsule",
                status: "Preparing",
            },
            {
                name: "Lipistart Powder",
                status: "Preparing",
            },
            {
                name: "Accupril 5 Mg Tablet",
                status: "Received",
            }
        ]
    },
    FORGOT_PASSWORD_USER: {
        firstName: 'Forgot',
        lastName: 'Pass',
        dob: '09091999',
        phoneNumber: '888-213-1234',
        email: 'forgot.pass1@cvs.com',
        password: 'Create_12345!',
        hasCvsAccount: true
    },
    WERE_WORKING_ON_IT_NBA: {
        firstName: 'Spring',
        lastName: 'PE',
        dob: '09091990',
        phoneNumber: '484-649-8151',
        email: 'spring.pe@qa2.com',
        password: 'Common@123',
        hasCvsAccount: true,
        profileId: '533915303',
        rxcId: '2518029428',
        ecNumber: '4765181103525',
        isECPlus: true
    },
    DELAYED_NBA: {
        firstName: 'Winter',
        lastName: 'PE',
        dob: '09091990',
        phoneNumber: '484-649-8151',
        email: 'Winter.pe@qa2.com',
        password: 'Common@123',
        hasCvsAccount: true,
        profileId: '533915298',
        rxcId: '2518029422',
        ecNumber: '4765181103525',
        isECPlus: true
    },
    SUMMER_PE: {
        firstName: 'Summer',
        lastName: 'PE',
        dob: '09091990',
        phoneNumber: '484-649-8151',
        email: 'summer.pe@qa2.com',
        password: 'Common@123',
        hasCvsAccount: true,
        profileId: '533915299',
        rxcId: '2518029424',
        ecNumber: '4765181103525',
        isECPlus: true
     },
    BRAYDEN_WILKIE: {
        firstName: 'Brayden',
        lastName: 'Wilkie',
        dob: '09171982',
        phoneNumber: '484-649-8151',
        email: 'brayden.wilkie@test.com',
        password: 'Retail@4321',
        hasCvsAccount: true
     },
    REGRESSION_PE: {
        firstName: 'Regression',
        lastName: 'Pe',
        dob: '02221988',
        phoneNumber: '4846498151',
        email: 'regone.pe@qa2.com',
        password: 'Retail@4321',
        hasCvsAccount: true,
        profileId: '534382189',
        rxcId: '2517969801',
        ecNumber: '4765181103525',
        isECPlus: true
    },
    FALL_PE: {
        firstName: 'Fall',
        lastName: 'PE',
        dob: '09092001',
        phoneNumber: '4846498151',
        email: 'fall.pe@qa2.com',
        password: 'Common@123',
        hasCvsAccount: true,
        profileId: '533915302',
        rxcId: '2518029426',
        ecNumber: '4765181103525',
        isECPlus: true
    },
    RIVER_PE: {
        firstName: 'River',
        lastName: 'PE',
        dob: '09091990',
        phoneNumber: '4846498151',
        email: 'river.pe@qa2.com',
        password: 'Retail@4321',
        hasCvsAccount: true,
        profileId: '1000036016',
        rxcId: '11213042708',
        cmkId: '322056347'
    },
    DAFFODILS_DUR: {
        firstName: 'Daffodils',
        lastName: 'Dur',
        dob: '01011990',
        phoneNumber: '3022570612',
        email: 'daffodils@qa2.com',
        password: 'Retail@4321',
        hasCvsAccount: true,
        profileId: '534599790',
        rxcId: '11213094114',
        isECPlus: false
    },
    SUNFLOWERS_DUR: {
        firstName: 'Sunflowers',
        lastName: 'Dur',
        dob: '01011990',
        phoneNumber: '3022570612',
        email: 'sunflowers@qa2.com',
        password: 'Retail@4321',
        hasCvsAccount: true,
        profileId: '534599792',
        rxcId: '11213094118',
        ecNumber: '4871005406014',
        isECPlus: false
    },
    MERCEDES_CHANDU: {
        firstName: 'Mercedes',
        lastName: 'Chandu',
        dob: '01011990',
        phoneNumber: '7324562218',
        email: 'mercedes@qa2.com',
        password: 'Retail@4321',
        hasCvsAccount: true,
        profileId: '1000011616',
        cmkId: '769177609',
        ecNumber: '4765181135298',
        isECPlus: false
    },
    MITCHEL_DIVYAA: {
        firstName: 'Mitchel',
        lastName: 'Divyaa',
        dob: '02021992',
        phoneNumber: '6156172983',
        email: 'Mitchel@qa2.com',
        password: 'Retail@4321',
        hasCvsAccount: true,
        profileId: '1000011621',
        cmkId: '167760455'
    },
    TUVALU_COUNTRY: {
        firstName: 'Tuvalu',
        lastName: 'Country',
        dob: '09211954',
        phoneNumber: '6156172983',
        email: 'tuvalu@test.com',
        password: 'Retail@4321',
        hasCvsAccount: true,
        profileId: '1000040843',
        cmkId: ''
    },
    PRADHI_THIDHI: {
        firstName: 'Pradhi',
        lastName: 'Thidhi',
        dob: '05031976',
        phoneNumber: '4014741009',
        email: 'pradhi@qa2.com',
        password: 'Password@1234',
        hasCvsAccount: true,
        profileId: '527178562',
        rxcId: '2518002032',
        cmkId: '450799813',
        ecNumber: '4765181103990',
        isECPlus: true
    },
    ANNABELLE_BOOK: {
        firstName: 'annabelle',
        lastName: 'book',
        dob: '01011990',
        phoneNumber: '3022570612',
        email: 'annabelle@qa2.com',
        password: 'Retail@4321',
        hasCvsAccount: true,
        profileId: '534120098',
        rxcId: '11213071464',
        ecNumber: '4765181113739',
        isECPlus: true
    },
    PEACH_BLOSSOM: {
        firstName: 'Peach',
        lastName: 'Blossom',
        dob: '01201990',
        phoneNumber: '7148751786',
        email: 'rxdeliveryuatpeach@gmail.com',
        password: 'Retail@4321',
        hasCvsAccount: true,
        profileId: '522754862',
        rxcId: '11212970104',
        cmkId: '628453669',
        ecNumber: '4872000285079',
        isECPlus: false
    },
    JUNE_MLP: {
        firstName: 'June',
        lastName: 'MLP',
        dob: '09091990',
        phoneNumber: '4846498151',
        email: 'june.mlp@qa2.com',
        password: 'Common@123',
        hasCvsAccount: true,
        profileId: '533610489',
        rxcId: '2518022630',
        cmkId: '406455067',
        ecNumber: '4765181103525',
        isECPlus: true
    },
    APRIL_MLP: {
        firstName: 'april',
        lastName: 'mlp',
        dob: '09091990',
        phoneNumber: '4846498151',
        email: 'april.mlp@qa2.com',
        password: 'Common@123',
        hasCvsAccount: true,
        profileId: '533610532',
        rxcId: '2518022636',
        ecNumber: '4765181103525',
        isECPlus: true
    },
    CARL_GREEN: {
        firstName: 'Carl',
        lastName: 'Green',
        dob: '10071963',
        phoneNumber: '2038076639',
        email: 'testemailcgreen@cvs.com',
        password: 'ThisTest12341',
        hasCvsAccount: true,
        profileId: '534443267',
        rxcId: '2518041044'
    },
    JUAN_BOOK: {
        firstName: 'juan',
        lastName: 'book',
        dob: '01011990',
        phoneNumber: '4846498151',
        email: 'jaun.book@yahoo.com',
        password: 'Retail@4321',
        hasCvsAccount: true,
        profileId: '534402206',
        rxcId: '11213082002',
        ecNumber: '4765181103525',
        isECPlus: true
    },
    ATHENA_PLU: {
        firstName: 'athena',
        lastName: 'plu',
        dob: '01011990',
        phoneNumber: '6467176661',
        email: 'athena.plu@qa2.com',
        password: 'Password@1234',
        hasCvsAccount: true,
        profileId: '533801764',
        rxcId: '11213037382',
        cmkId: '734923956',
        ecNumber: '4871005406014',
        isECPlus: false
    },
    DOBBY_BOOK: {
        firstName: 'dobby',
        lastName: 'book',
        dob: '01011990',
        phoneNumber: '3022570612',
        email: 'dobby@qa2.com',
        password: 'Password@1234',
        hasCvsAccount: true,
        profileId: '534039195',
        rxcId: '11213055282',
        ecNumber: '4871005406014',
        isECPlus: false
    },
    LEACH_ADAM: {
        firstName: 'leach',
        lastName: 'adam',
        dob: '02191992',
        phoneNumber: '6467176661',
        email: 'leach@qa2.com',
        password: 'Password@1234',
        hasCvsAccount: true,
        profileId: '533297989',
        rxcId: '12318017218',
        ecNumber: '4765181106663',
        isECPlus: false
    },
    PONNABELLE_BOOK: {
        firstName: 'Ponnabelle',
        lastName: 'Book',
        dob: '01011990',
        phoneNumber: '3022570612',
        email: 'Ponnabelle@qa2.com',
        password: 'Retail@4321',
        hasCvsAccount: true,
        profileId: '534215089',
        rxcId: '11213073528',
        ecNumber: '4765181103525',
        isECPlus: true
    },
    ESTEFANIA_MANNCHEN: {
        firstName: 'estefania',
        lastName: 'mannchen',
        email: 'estefania.mannchen@cvs.com',
        password: 'Retail@4321',
        dob: '05131995',
        hasCvsAccount: true
    },
    CAROLINA_SKRZYPINSKI: {
        firstName: 'carolina',
        lastName: 'skrzypinski',
        email: 'carolina.skrzypinski@cvs.com',
        password: 'C@mmon2123!',
        dob: '03051995',
        hasCvsAccount: true
    },
    DRAGONFRUIT_BOOK: {
        firstName: 'Dragonfruit',
        lastName: 'Book',
        dob: '01011990',
        email: 'dragonfruit@cvs.com',
        password: 'Retail@4321',
        hasCvsAccount: true,
        profileId: '1000030616',
        rxcId: '11213165348'
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
            hasCvsAccount: true,
            ephData: [
            {
                caremark: true
            }
        ],
        caremark: {
            inNetworkDeductible: '4,500',
            outNetworkDeductible: '4,500',
            maxInNetworkDeductible: '6,500',
            maxOutNetworkDeductible: '6,500',
            spentAmount: '5.79',
            idCard: {
                rxBin: '004336',
                rxPcn: 'ADV',
                issuer: '9151014609'
            }
        }
    },
    RED_VELVET: {
        firstName: 'Red',
        lastName: 'Velvet',
        email: 'Red.velvet@qa2.com',
        password: 'Retail@4321',
        profileId: '4012194509',
        dob: '05051990',
        hasCvsAccount: true
    },
    PHIL_PACETE: {
        firstName: 'Phil',
        lastName: 'Pacete',
        email: 'phil.pacete@gmail.com',
        password: 'Retail@4321',
        profileId: '1000002238',
        rxcId: '11212903785',
        dob: '02021975',
        hasCvsAccount: true
    },
    ALDEN_TURSO: {
        firstName: 'Alden',
        lastName: 'Turso',
        email: 'alden.turso@cvs.com',
        password: 'Retail@4321',
        profileId: '1000035639',
        dob: '11111973',
        hasCvsAccount: true
    },
    MARK_MARTINEZ: {
        firstName: 'Mark',
        lastName: 'Martinez',
        email: 'mark.martinez@cvs.com',
        password: 'Retail@4321',
        profileId: '1000065669',
        dob: '07282006',
        hasCvsAccount: true
    },
    ELIZABETH_SMITH: {
        firstName: 'Elizabeth',
        lastName: 'Smith',
        email: 'elizabeth.smith@cvs.com',
        password: 'Oshob@12345',
        dob: '12171958',
        hasCvsAccount: true
    },
    TREE_MAPLE: {
        firstName: 'Tree',
        lastName: 'Maple',
        email: 'Tree.Maple@gmail.com',
        password: 'Retail@4321',
        profileId: '3022570612',
        dob: '01011998',
        hasCvsAccount: true
    },
    HANKS_TIM: {
        firstName: 'Tim',
        lastName: 'Hanks',
        email: 'Tim.hanks@qa2.com',
        password: 'Retail@4321',
        profileId: '484649815',
        dob: '10101986',
        hasCvsAccount: true
    },
    MAHIRA_SANA: {
        firstName: 'Mahira',
        lastName: 'Sana',
        email: 'Sana.mahira@qa2.com',
        password: 'Retail@4321',
        profileId: '615617298',
        dob: '12311960',
        hasCvsAccount: true
    },
    CDTREST_MIKE: {
        firstName: 'Cdtrest',
        lastName: 'Mike',
        email: 'matrixvisit@gmail.com',
        password: 'Retail@4321',
        profileId: '3011234',
        dob: '12141990',
        hasCvsAccount: true
    },
    HULLETT_MARTHA: {
        firstName: 'Hullett',
        lastName: 'Martha',
        email: 'testloa02123@cvs.com',
        password: 'Retail@4321',
        profileId: '602554513',
        dob: '04251962',
        hasCvsAccount: true
    },
    BDSELFR_ACCTWO: {
        firstName: 'BDSELFR',
        lastName: 'ACCTWO',
        email: 'testloa02122@cvs.com',
        password: 'Retail@4321',
        profileId: '602554513',
        dob: '12021981',
        hasCvsAccount: true
    },
    BOOK_PARIS: {
        firstName: 'Book',
        lastName: 'Paris',
        email: 'paris.book@cvs.com',
        password: 'Retail@4321',
        profileId: '484649815',
        dob: '01011990',
        hasCvsAccount: true
    },
    HANIYA_AFREEN: {
        firstName: 'Haniya',
        lastName: 'Afreen',
        email: 'haniya.afreen@cvs.com',
        password: 'Retail@4321',
        profileId: '817584717',
        dob: '12311960',
        hasCvsAccount: true
    },
    HAYAT_QAMAR: {
        firstName: 'Hayat',
        lastName: 'Qamar',
        email: 'qamar.hayat@cvs.com',
        password: 'Retail@4321',
        profileId: '817584717',
        dob: '12311960',
        hasCvsAccount: true
    },
    FATIMA_SARA: {
        firstName: 'Fatima',
        lastName: 'Sara',
        email: 'sara.fatima@cvs.com',
        password: 'Retail@4321',
        profileId: '817584717',
        dob: '12311960',
        hasCvsAccount: true
    },
    CLARKE_ETHAN: {
        firstName: 'Clarke',
        lastName: 'Ethan',
        email: 'ClarkeE@cvs.com',
        password: 'Health_4321',
        profileId: '817584174',
        dob: '09091990',
        hasCvsAccount: true
    },
    BENNETT_OLIVIA: {
        firstName: 'Bennett',
        lastName: 'Olivia',
        email: 'BennettO@cvs.com',
        password: 'Health_4321',
        profileId: '817584174',
        dob: '09091990',
        hasCvsAccount: true
    },
    TURNER_MASON: {
        firstName: 'Turner',
        lastName: 'Mason',
        email: 'TurnerM@cvs.com',
        password: 'Retail@4321',
        profileId: '817584174',
        dob: '09091990',
        hasCvsAccount: true
    },
    SULLIVAN_EMMA: {
        firstName: 'Sullivan',
        lastName: 'Emma',
        email: 'SullivanE@cvs.com',
        password: 'Retail@4321',
        profileId: '817584174',
        dob: '09091990',
        hasCvsAccount: true
    },
    HAYES_LUCAS: {
        firstName: 'Hayes',
        lastName: 'Lucas',
        email: 'HayesL@cvs.com',
        password: 'Retail@4321',
        profileId: '817584174',
        dob: '09091990',
        hasCvsAccount: true
    },
    REYNOLDS_GRACE: {
        firstName: 'Reynolds',
        lastName: 'Grace',
        email: 'ReynoldsG@cvs.com',
        password: 'Retail@4321',
        profileId: '817584174',
        dob: '01011990',
        hasCvsAccount: true
    },
    REYNOLDS_NOAH: {
        firstName: 'Reynolds',
        lastName: 'Noah',
        email: 'ReynoldsN@cvs.com',
        password: 'Retail@4321',
        profileId: '817584174',
        dob: '01011990',
        hasCvsAccount: true
    },
    REYNOLDS_SOPHIA: {
        firstName: 'Reynolds',
        lastName: 'Sophia',
        email: 'ReynoldsS@cvs.com',
        password: 'Retail@4321',
        profileId: '817584174',
        dob: '01012015',
        hasCvsAccount: true
    },
    HARPER_HENRY: {
        firstName: 'Henry',
        lastName: 'Harper',
        email: 'HarperH@cvs.com',
        password: 'Retail@4321',
        profileId: '817584174',
        dob: '01011990',
        hasCvsAccount: true
    },
    HARPER_CHLOE: {
        firstName: 'Chloe',
        lastName: 'Harper',
        email: 'HarperC@cvs.com',
        password: 'Retail@4321',
        profileId: '817584174',
        dob: '01011990',
        hasCvsAccount: true
    },
    FIFYUR_BASAVIOR: {
        firstName: 'Fiftyyr',
        lastName: 'Basavior',
        email: 'Fiftyyr.Bsavior@gmail.com',
        password: 'Nextgen*8888',
        profileId: '804874759',
        dob: '09071974',
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
    ATHENA: {
        firstName: 'Athena',
        lastName: 'User',
        email: 'athena.plp@qa2.com',
        password: 'Retail@4321',
        dob: '01011990',
        hasCvsAccount: true
    },
    ADDISON: {
        firstName: 'Addison',
        lastName: 'User',
        email: 'addison@qa2.com',
        password: 'Retail@4321',
        dob: '09031981',
        hasCvsAccount: true
    },
    JAVEN: {
        firstName: 'Javen',
        lastName: 'User',
        email: 'javen@qa2.com',
        password: 'Retail@4321',
        dob: '08151968',
        hasCvsAccount: true
    },
    HELENA: {
        firstName: 'Helena',
        lastName: 'User',
        email: 'helena@qa2.com',
        password: 'Retail@4321',
        dob: '08261996',
        hasCvsAccount: true
    },
    AHMAD: {
        firstName: 'Ahmad',
        lastName: 'User',
        email: 'ahmad@qa2.com',
        password: 'Retail@4321',
        dob: '03081996',
        hasCvsAccount: true
    },
    HAILEE: {
        firstName: 'Hailee',
        lastName: 'User',
        email: 'hailee@qa2.com',
        password: 'Retail@4321',
        dob: '09031982',
        hasCvsAccount: true
    },
    SPEEDY: {
        firstName: 'Speedy',
        lastName: 'User',
        email: 'Speedy@qa2.com',
        password: 'Retail@4321',
        dob: '01191987',
        hasCvsAccount: true
    },
    MARK_SLOAN: {
        firstName: 'Mark',
        lastName: 'Sloan',
        email: 'mark.sloan@qa2.com',
        password: 'Retail@4321',
        dob: '01011990',
        hasCvsAccount: true
    },
    LAURAB: {
        firstName: 'Laura',
        lastName: 'B',
        email: 'laurab@qa2.com',
        password: 'Retail@4321',
        dob: '01011998',
        hasCvsAccount: true
    },
    ROBERT_ARAGON: {
        firstName: 'Robert',
        lastName: 'Aragon',
        email: 'Robert.aragon@qa2.com',
        password: 'Retail@4321',
        dob: '01011998',
        hasCvsAccount: true
    },
    BEARGE: {
        firstName: 'Bearge',
        lastName: 'User',
        email: 'Bearge@test.com',
        password: 'Retail@4321',
        dob: '07051955',
        hasCvsAccount: true
    },
    NEVIS: {
        firstName: 'Nevis',
        lastName: 'User',
        email: 'nevis@qa2.com',
        password: 'Retail@4321',
        dob: '06061976',
        hasCvsAccount: true
    },
    JACK_DILL: {
        firstName: 'Jack',
        lastName: 'Dill',
        email: 'jack.dill@qa2.com',
        password: 'Retail@4321',
        dob: '01011990',
        hasCvsAccount: true
    },
    ANNA_REED: {
        firstName: 'Anna',
        lastName: 'Reed',
        email: 'anna.reed@test.com',
        password: 'Retail@4321',
        dob: '01011967',
        hasCvsAccount: true
    },
    ELLIS_DENNIS: {
        firstName: 'Ellis',
        lastName: 'Dennis',
        email: 'ellis.dennis@qa2.com',
        password: 'Retail@4321',
        dob: '01011990',
        hasCvsAccount: true
    },
    MESA: {
        firstName: 'Mesa',
        lastName: 'plp',
        email: 'mesa@qa2.com',
        dob: '01011990',
    },
    SPARROWS: {
       firstName: 'Sparrows',
       lastName: 'Plp',
       email: 'sparrows@qa2.com',
       dob: '01011990',
    },
    ONE:  {
        email: 'one.grey@cvs.com',
        dob: '02191988'
    }
};

// ============================================================================
// DRUG PRICING TEST DATA
// ============================================================================

const DRUG_PRICING = {
    // 42 Drugs Library (from DrugPricing.xlsx - DrugInfo sheet)
    DRUGS: {
        BRILINTA: { name: "Brilinta", ndc: "186077660", type: "brand_and_generic", search: "Brilinta" },
        NAPHCON_A: { name: "Naphcon-A", ndc: "68462013710", type: "brand_and_generic", search: "Naphcon-A" },
        SYMBICORT: { name: "Symbicort", ndc: "186082660", type: "brand_and_generic", search: "Symbicort" },
        LOVASTATIN: { name: "Lovastatin", ndc: "68180046707", type: "generic", search: "Lovastatin" },
        LATANOPROST: { name: "Latanoprost", ndc: "60505082208", type: "generic", search: "Latanoprost" },
        LISINOPRIL: { name: "Lisinopril", ndc: "68180051802", type: "generic", search: "Lisinopril" },
        METFORMIN: { name: "Metformin", ndc: "68180036009", type: "generic", search: "Metformin" },
        ATORVASTATIN: { name: "Atorvastatin", ndc: "68180051101", type: "generic", search: "Atorvastatin" },
        AMLODIPINE: { name: "Amlodipine", ndc: "68180051401", type: "generic", search: "Amlodipine" },
        OMEPRAZOLE: { name: "Omeprazole", ndc: "68180036301", type: "generic", search: "Omeprazole" },
        LEVOTHYROXINE: { name: "Levothyroxine", ndc: "68180098003", type: "generic", search: "Levothyroxine" },
        SIMVASTATIN: { name: "Simvastatin", ndc: "68180072409", type: "generic", search: "Simvastatin" },
        LOSARTAN: { name: "Losartan", ndc: "68180098103", type: "generic", search: "Losartan" },
        GABAPENTIN: { name: "Gabapentin", ndc: "68180072802", type: "generic", search: "Gabapentin" },
        HYDROCHLOROTHIAZIDE: { name: "Hydrochlorothiazide", ndc: "68180051601", type: "generic", search: "Hydrochlorothiazide" },
        ASPIRIN: { name: "Aspirin", ndc: "63739032510", type: "generic", search: "Aspirin" },
        LIPITOR: { name: "Lipitor", ndc: "00071015523", type: "brand_and_generic", search: "Lipitor" },
        CRESTOR: { name: "Crestor", ndc: "00310070590", type: "brand_and_generic", search: "Crestor" },
        XARELTO: { name: "Xarelto", ndc: "50458057901", type: "brand", search: "Xarelto" },
        ELIQUIS: { name: "Eliquis", ndc: "00003027721", type: "brand", search: "Eliquis" },
        JANUVIA: { name: "Januvia", ndc: "00006008254", type: "brand", search: "Januvia" },
        JARDIANCE: { name: "Jardiance", ndc: "00597001990", type: "brand", search: "Jardiance" },
        OZEMPIC: { name: "Ozempic", ndc: "00169427912", type: "brand", search: "Ozempic" },
        TRULICITY: { name: "Trulicity", ndc: "00002832559", type: "brand", search: "Trulicity" },
        ADVAIR: { name: "Advair Diskus", ndc: "00173069920", type: "brand_and_generic", search: "Advair" },
        SPIRIVA: { name: "Spiriva", ndc: "00597001218", type: "brand", search: "Spiriva" },
        PROAIR: { name: "ProAir HFA", ndc: "66993001568", type: "brand", search: "ProAir" },
        VENTOLIN: { name: "Ventolin HFA", ndc: "00173068320", type: "brand_and_generic", search: "Ventolin" },
        LYRICA: { name: "Lyrica", ndc: "00071101568", type: "brand_and_generic", search: "Lyrica" },
        CYMBALTA: { name: "Cymbalta", ndc: "00002444430", type: "brand_and_generic", search: "Cymbalta" },
        VYVANSE: { name: "Vyvanse", ndc: "59417010130", type: "brand", search: "Vyvanse" },
        ADDERALL_XR: { name: "Adderall XR", ndc: "54092038201", type: "brand_and_generic", search: "Adderall XR" },
        RITALIN: { name: "Ritalin", ndc: "00078003705", type: "brand_and_generic", search: "Ritalin" },
        ENBREL: { name: "Enbrel", ndc: "58406043505", type: "specialty", search: "Enbrel" },
        HUMIRA: { name: "Humira", ndc: "00074483502", type: "specialty", search: "Humira" },
        TRUVADA: { name: "Truvada", ndc: "61958070101", type: "specialty", search: "Truvada" },
        STELARA: { name: "Stelara", ndc: "57894003001", type: "specialty", search: "Stelara" },
        REPATHA: { name: "Repatha", ndc: "55513073301", type: "specialty", search: "Repatha" },
        COSENTYX: { name: "Cosentyx", ndc: "00078067261", type: "specialty", search: "Cosentyx" },
        OTEZLA: { name: "Otezla", ndc: "59310058022", type: "brand", search: "Otezla" },
        SKYRIZI: { name: "Skyrizi", ndc: "00074103475", type: "specialty", search: "Skyrizi" },
        RINVOQ: { name: "Rinvoq", ndc: "00074104345", type: "specialty", search: "Rinvoq" }
    },

    // 16 Regression Scenarios (from DrugPricing.xlsx - DrugPricingRegression sheet)
    SCENARIOS: {
        RETAIL_BRAND_GENERIC_NO_FA: {
            name: "Retail drug - brand and generic - noFA",
            user: "LAYA_PATEL",
            drug: "BRILINTA",
            zipCode: "60089",
            expected: {
                brand: { mail: 1, retail: 5 },
                generic: { mail: 1, retail: 1 },
                formularyAlternatives: 0
            }
        },
        RETAIL_BRAND_GENERIC_NO_FA_NO_MAIL: {
            name: "Retail drug - brand and generic - noFA - no mail",
            user: "LAYA_PATEL",
            drug: "NAPHCON_A",
            zipCode: "60089",
            expected: {
                brand: { mail: 0, retail: 5 },
                generic: { mail: 0, retail: 1 },
                formularyAlternatives: 0
            }
        },
        RETAIL_GENERIC_WITH_FA: {
            name: "Retail drug - generic - with FA",
            user: "LAYA_PATEL",
            drug: "LOVASTATIN",
            zipCode: "60089",
            expected: {
                generic: { mail: 1, retail: 5 },
                formularyAlternatives: 3
            }
        },
        RETAIL90_BRAND_GENERIC_WITH_FA: {
            name: "Retail90 - brand and generic - with FA",
            user: "TIM_KENNEDY",
            drug: "SYMBICORT",
            zipCode: "60089",
            expected: {
                brand: { retail90: 3, retail: 5 },
                generic: { retail: 1, mail: 1 },
                formularyAlternatives: 3
            }
        },
        RETAIL90_GENERIC_NO_FA: {
            name: "Retail90 - generic - noFA",
            user: "TIM_KENNEDY",
            drug: "LATANOPROST",
            zipCode: "60089",
            expected: {
                generic: { retail90: 3, retail: 5, mail: 1 },
                formularyAlternatives: 0
            }
        },
        MCHOICE_GENERIC_WITH_FA: {
            name: "Mchoice - generic - with FA",
            user: "TIM_KENNEDY",
            drug: "ATORVASTATIN",
            zipCode: "60089",
            expected: {
                generic: { mail: 1, retail: 5 },
                formularyAlternatives: 3,
                mchoice: true
            }
        },
        MCHOICE_BRAND_GENERIC_NO_FA: {
            name: "Mchoice - brand and generic - noFA",
            user: "TIM_KENNEDY",
            drug: "LIPITOR",
            zipCode: "60089",
            expected: {
                brand: { mail: 1, retail: 5 },
                generic: { mail: 1, retail: 1 },
                formularyAlternatives: 0,
                mchoice: true
            }
        },
        SPECIALTY_BRAND_WITH_FA: {
            name: "Specialty drug - brand - with FA",
            user: "ELIZABETH_MILLER",
            drug: "ENBREL",
            zipCode: "60089",
            expected: {
                specialtyMailOrder: 1,
                formularyAlternatives: 3
            }
        },
        SPECIALTY_GENERIC_NO_FA: {
            name: "Specialty drug - generic - noFA",
            user: "ELIZABETH_MILLER",
            drug: "TRUVADA",
            zipCode: "60089",
            expected: {
                specialtyMailOrder: 1,
                formularyAlternatives: 0
            }
        },
        NO_BENEFITS: {
            name: "Member without benefits",
            user: "AETNA_ONLY_1",
            drug: "ASPIRIN",
            expected: {
                errorMessage: "We couldn't find your drug pricing benefits"
            }
        },
        DRUG_NOT_COVERED: {
            name: "Drug not covered",
            user: "LAYA_PATEL",
            drug: "XARELTO",
            expected: {
                coverageStatus: "Not covered",
                message: "This drug may not be covered"
            }
        },
        PREFERRED_VS_NON_PREFERRED: {
            name: "Preferred vs Non-preferred",
            user: "LAYA_PATEL",
            drug: "CRESTOR",
            expected: {
                tierInfo: "Tier 2",
                preferredStatus: "Preferred brand"
            }
        },
        PRIOR_AUTH_REQUIRED: {
            name: "Prior authorization required",
            user: "ANDREA_JACKSON",
            drug: "XARELTO",
            zipCode: "60089",
            expected: {
                priorAuthRequired: true,
                mail: 1,
                retail: 5
            }
        },
        QUANTITY_LIMITS: {
            name: "Quantity limits",
            user: "LAYA_PATEL",
            drug: "OZEMPIC",
            expected: {
                quantityLimits: true,
                message: "Quantity limits may apply"
            }
        },
        STEP_THERAPY: {
            name: "Step therapy",
            user: "LAYA_PATEL",
            drug: "JARDIANCE",
            expected: {
                stepTherapy: true,
                message: "Step therapy may be required"
            }
        },
        AGE_RESTRICTIONS: {
            name: "Age restrictions",
            user: "LAYA_PATEL",
            drug: "VYVANSE",
            expected: {
                ageRestrictions: true,
                message: "Age restrictions may apply"
            }
        }
    }
};

// Access loginData from env parameter passed by runScript
const loginDataKey = loginData ? loginData : null;

if (!loginDataKey) {
    throw new Error('loginData not provided in env. Usage: env: { loginData: "LOA2" }');
}

// Aliases where the loginData key doesn't match the TEST_DATA property name
const LOGIN_ALIASES = {
    LOA1: 'LOA1_01',
    WereWorkingOnIt: 'WERE_WORKING_ON_IT_NBA',
    DelayedNba: 'DELAYED_NBA'
};

const resolvedKey = LOGIN_ALIASES[loginData] || loginData;
if (!TEST_DATA[resolvedKey]) {
    throw new Error('Unknown loginData key: "' + loginData + '". No matching entry in TEST_DATA.');
}
output.user = TEST_DATA[resolvedKey];

// Export drug pricing data to output
output.drugPricing = DRUG_PRICING;