/**
 * H100-PE-health
 * POST https://api.qa2.health100.com/apix/client/experience/v2/load/{{experienceId}}?frn=SegmentedHomeHealth
 * H100 variant of PE-health.
 * Response root key differs from CVS: data.h100personalizedActions (vs data.PersonalizedHealthActions).
 * Inner nbaData structure (lineOfBusiness, personalizationOrder.zone) is the same.
 */

const RequestHelper = require('../../../lib/request-helper');

const EXPERIENCE_ID = 'adcbe153-22f1-4c24-92ca-c92512ee19af';

module.exports = {
  name: 'H100-PE-health',
  description: 'Get personalized H100 health actions (NBA data)',
  method: 'POST',
  allowFailure: true,

  async execute(config = {}) {
    const client = new RequestHelper({
      baseURL: config.h100BaseURL || 'https://api.qa2.health100.com',
      timeout: config.timeout || 30000
    });

    client.setHeaders({
      'x-experienceid':              config.peHealthExperienceId || EXPERIENCE_ID,
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

    const experienceId = config.peHealthExperienceId || EXPERIENCE_ID;
    const path = `/apix/client/experience/v2/load/${experienceId}?frn=SegmentedHomeHealth`;

    const response = await client.post(path, {
      data: {
        idType: 'RETAIL_PROFILE_ID_TYPE',
        ecCard: {
          id: 'eccardno',
          value: ''
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
    const nbaData = data?.data?.h100personalizedActions?.nbaData || {};
    const lob = nbaData.lineOfBusiness || {};
    const zones = nbaData.personalizationOrder?.zone || [];

    const priorityZone = zones.find(z => z.zoneId === 'priorityNba');
    const activityZone = zones.find(z => z.zoneId === 'activityNba');

    const { additionalData, ...lobWithoutAdditional } = lob;

    return {
      nbaDataByLob: Object.keys(lobWithoutAdditional).length ? lobWithoutAdditional : null,
      priorityNbas: priorityZone?.nbaList ?? null,
      activityNbas: activityZone?.nbaList ?? null,
      additionalData: additionalData || null
    };
  }
};
