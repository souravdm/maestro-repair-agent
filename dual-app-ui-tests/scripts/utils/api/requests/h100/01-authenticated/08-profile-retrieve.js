/**
 * h100_profile_retrieve
 * POST https://api.qa2.health100.com/mcapi/client/experience/v2/load/6784cd60-80d9-4e6e-8567-289f8198f98b?frn=caoad-health-profile-retrieve
 *
 * H100-specific experience ID. Uses authToken (from authenticate-with-cvs, not guestToken).
 * The response linkedIDs will contain a CVS-linked SSK entry alongside the H100 profile,
 * confirming both Health100 and CVS retail accounts are linked for the signed-in user.
 */

const RequestHelper = require('../../../lib/request-helper');

module.exports = {
  name: 'h100_profile_retrieve',
  description: 'Retrieve H100 authenticated user profile (includes CVS-linked SSK in linkedIDs)',
  method: 'POST',

  async execute(config = {}) {
    const client = new RequestHelper({
      baseURL: config.h100BaseURL || 'https://api.qa2.health100.com',
      timeout: config.timeout || 30000
    });

    client.setHeaders({
      'x-friendlyname':           'caoad-health-profile-retrieve',
      'x-clientid':               'cvs_account',
      'x-sourcetype':             'login',
      'x-app-name':               'H100_APP',
      'x-channel':                'mobile',
      'x-experienceid':           '6784cd60-80d9-4e6e-8567-289f8198f98b',
      'x-visitor-id':             config.visitorId || 'dd6007674c3a4e61aa2c7d23f97e6cea',
      'x-route':                  'account-gke-rke',
      'x-device-type':            'ANDROID',
      'x-api-key':                config.h100ApiKey || 'PRX4fYhAfVTr3UH3tSOTlb9oYNrAPUjA',
      'x-d-token':                '3:vQhFwkMEaoHgLEvXcrwaLw==:mZLieniqlzV8IeCj+v7GnpWF53EmwWpZFkgZpZwgm6cQnKh52utdT0PFgg/8Ka88YPhjre9uCDots+yZMpJTNgAte612iq85c2u+iaUNm044QQVHYEHLDOTjiKJLc/KnjJUVU79J3V3iHchhXpaOj7tmxbneQInHtsgz1NwAe536dJiGWHHfjbKqwmKgLPP9fd6Dv8NTpgnHmB9MeV/7FhEut5NVCucZncUsmkjXsPBHCClHG0hdjF5lk0xn8n3YYqeawz3bIqV4O1vYZB9pgpV7yIrP1xFsFcGnmD/BfdE8kjFLqQx1m0q3M2JqfJOC1+NApdwHqSAEz78nbzsJg2O6Clz59AD3YkV0qYcb+NJYP9shh7V954Ef3dKBXblcLqwUXMfAQP81lCmjh9BnIEq79CVnoG0WhBnYcUuItFw=:+taHsqq9jGrfaAil+Gf2DzrX6Lby+5zNpIyZWMcQjdc=',
      'env':                      'QA2',
      'user-agent':               'Health100Android/26.3.30(2603300); (Google; sdk_gphone64_arm64; SDK 36; Android 16) HEALTH100_APP',
      'quantummetricsessionid':   'b57726e62667e0cf313510229056fb2c',
      'x-client-fingerprint-id':  'dd6007674c3a4e61aa2c7d23f97e6cea',
      'authorization':            config.authToken || '',
      'content-type':             'application/json; charset=utf-8'
    });

    const response = await client.post(
      '/mcapi/client/experience/v2/load/6784cd60-80d9-4e6e-8567-289f8198f98b?frn=caoad-health-profile-retrieve',
      {
        data: {
          idType: 'RETAIL_PROFILE_ID_TYPE',
          getAddressByProfileIdIdType2: 'RETAIL_PROFILE_ID_TYPE'
        }
      }
    );

    return {
      name: this.name,
      method: this.method,
      url: '/mcapi/client/experience/v2/load/6784cd60-80d9-4e6e-8567-289f8198f98b?frn=caoad-health-profile-retrieve',
      statusCode: response.statusCode,
      statusMessage: response.statusMessage,
      timing: response.timing,
      success: response.success,
      responseHeaders: response.headers,
      data: response.data,
      error: response.error,
      request: response.request
    };
  },

  extract(data) {
    const linkedIds = data?.data?.getProfileInfo?.linkedIDs || [];
    const types = [...new Set(linkedIds.map(l => l.idType).filter(Boolean))];
    return types.length ? { linkedIdTypes: types } : {};
  },

  extractData(data) {
    const profile = data?.data?.getProfileInfo || {};
    const phones = profile.phoneNumber || [];
    const ecCard = profile.extraCareDetails || {};
    const linkedIds = profile.linkedIDs || [];
    const idTypes = new Set(linkedIds.map(l => l.idType).filter(Boolean));
    const externalDetails = profile.externalAccountDetails || [];

    const hasMrn = linkedIds.some(l => l.idType === 'RETAIL_MRN_PROFILE_ID_TYPE');
    const hasOakStreet = linkedIds.some(l => l.sourceSystemName === 'OS');
    const hasCvsLink = linkedIds.some(
      l => l.sourceSystemName === 'CVS' || l.idType === 'CVS_SSK_ID_TYPE'
    );

    return {
      profileId: profile.id || null,
      levelOfAssurance: profile.levelOfAssurance || null,
      email: profile.emailAddress || null,
      firstName: profile.firstName || null,
      lastName: profile.lastName || null,
      dateOfBirth: profile.dateOfBirth || null,
      phones: phones.length ? phones : null,
      extraCareCard: Object.keys(ecCard).length ? ecCard : null,
      linkedIds: linkedIds.length ? linkedIds : null,
      featureBadges: {
        loa1:       profile.levelOfAssurance === '1',
        cvsLinked:  hasCvsLink,
        caremark:   idTypes.has('PBM_QL_PARTICIPANT_ID_TYPE'),
        aetna:      idTypes.has('AETNA_MEMBER_ID_TYPE') || idTypes.has('AETNA_IM_PROFILE_ID_TYPE'),
        specialty:  idTypes.has('SPL_HB_PATIENT_ID_TYPE'),
        rxc:        idTypes.has('RXC_RX_PATIENT_ID_TYPE'),
        counsel:    externalDetails.some(e => e.type === 'counsel'),
        mrn:        hasMrn,
        oakStreet:  hasOakStreet
      }
    };
  }
};
