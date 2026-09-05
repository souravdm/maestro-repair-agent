/**
 * H100-PE-discovery
 * POST https://api.qa2.health100.com/apix/client/experience/v2/load/{{experienceId}}?frn=HomeUserInfo
 * H100 variant of PE-discovery. Same structure and response shape as CVS PE-discovery.
 * Only differences: host, x-experienceid, user-agent, x-app-name.
 */

const RequestHelper = require('../../../lib/request-helper');

const EXPERIENCE_ID = 'fe95a440-039d-4f1c-b0ed-4302511f3ce7';

module.exports = {
  name: 'H100-PE-discovery',
  description: 'Get personalized H100 discovery actions (DNBA data)',
  method: 'POST',
  allowFailure: true,

  async execute(config = {}) {
    const client = new RequestHelper({
      baseURL: config.h100BaseURL || 'https://api.qa2.health100.com',
      timeout: config.timeout || 30000
    });

    client.setHeaders({
      'x-experienceid':              config.peDiscoveryExperienceId || EXPERIENCE_ID,
      'x-visitor-id':                config.visitorId || '',
      'x-app-name':                  'H100_APP',
      'x-hs-pzn-version':            'v3',
      'x-hs-pzn-check-fpu':          'true',
      'x-hs-pzn-rx-date-flag':       'true',
      'x-hs-pzn-flu-covid-discount': 'true',
      'x-hs-pzn-option-1':           'true',
      'x-route':                     'superapp-pzn-ha',
      'x-hs-pzn-sms-optin':          'true',
      'x-hs-pzn-drug-inventory':     'true',
      'x-hs-counsel-enabled':        'false',
      'x-hs-pzn-split-version':      'v1',
      'user-agent':                  'Health100Android/26.3.30(2603300); (Google; sdk_gphone64_arm64; SDK 36; Android 16) HEALTH100_APP',
      'quantummetricsessionid':      'b57726e62667e0cf313510229056fb2c',
      'authorization':               config.authToken || '',
      'x-api-key':                   config.h100ApiKey || 'PRX4fYhAfVTr3UH3tSOTlb9oYNrAPUjA',
      'content-type':                'application/json; charset=utf-8'
    });

    const experienceId = config.peDiscoveryExperienceId || EXPERIENCE_ID;
    const path = `/apix/client/experience/v2/load/${experienceId}`;

    const response = await client.post(path, {
      data: {
        idType: 'RETAIL_PROFILE_ID_TYPE',
        ecCard: {
          id: 'eccardno',
          value: config.extracareCard || ''
        }
      }
    });

    return {
      name: this.name,
      method: this.method,
      url: path,
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

  extractData(data) {
    const cardOrder = data?.data?.cardOrders?.[0] || {};

    return {
      dnba: cardOrder.dnba ?? null,
      ehg:  cardOrder.ehg  ?? null,
      xpo:  cardOrder.xpo  ?? null
    };
  }
};
