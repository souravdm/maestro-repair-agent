/**
 * PE-health
 * POST https://www-qa2.cvs.com/apix/client/experience/v2/load/27071ebc-ecb9-4983-9594-4f4a6bfa70f0?frn=SegmentedHomeHealth
 */

const RequestHelper = require('../../lib/request-helper');

module.exports = {
  name: 'PE-health',
  description: 'Get personalized health actions (NBA data)',
  method: 'POST',

  async execute(config = {}) {
    const client = new RequestHelper({
      baseURL: config.baseURL || 'https://www-qa2.cvs.com',
      timeout: config.timeout || 30000
    });

    client.setHeaders({
      'x-experienceid': '27071ebc-ecb9-4983-9594-4f4a6bfa70f0',
      'x-visitor-id': config.visitorId || '',
      'x-hs-pzn-version': 'v3',
      'x-hs-pzn-check-fpu': 'true',
      'x-hs-pzn-rx-date-flag': 'true',
      'x-hs-pzn-flu-covid-discount': 'true',
      'x-hs-pzn-option-1': 'true',
      'x-route': 'superapp-pzn-ha',
      'x-hs-pzn-sms-optin': 'true',
      'x-hs-pzn-drug-inventory': 'true',
      'x-hs-counsel-enabled': 'false',
      'user-agent': 'CVSOnlineAndroid/25.11.30(2511300); (Google; sdk_gphone64_arm64; SDK 35; Android 15)',
      'quantummetricsessionid': '400a0f6ccebba13cf94d5396433c8259',
      'authorization': config.authToken || '',
      'x-acf-sensor-data': '6,a,qe92jvD9zH995PQPiF6FDBTRlRYJCScY4EWPp+dAEND2krylj5xpAFmfM/rmKZ9hxQkjA6kyT94Zbir+kE6ccXEcyAhfakE6bq2DueHQuSGVW6lC6m5VMjT9hBN4cgX+XDMVXIM05ysiZqw7D8r/MK1QYdm8fpM2CsmBC11rtyU=,juv4cyyMq9OcFWBpgCMxGx+ZEi4AeglAKKOw/qHDgGFfLe00OHUwtIahrL+bf/Oiz8IpzL6ZvHHMnUioWnhHcH+2ul4SqdRw4ZEn9/dSCz8u/pjWMpYDKyUl85N5KrrsVmTQXpdDILiE2PeHeyZff6Di7HbQyBrUZmB+O/xZsAU=',
      'x-api-key': 'PRX4fYhAfVTr3UH3tSOTlb9oYNrAPUjA',
      'content-type': 'application/json; charset=utf-8'
    });

    const response = await client.post(
      '/apix/client/experience/v2/load/27071ebc-ecb9-4983-9594-4f4a6bfa70f0?frn=SegmentedHomeHealth',
      {
        data: {
          idType: 'RETAIL_PROFILE_ID_TYPE',
          ecCard: {
            id: 'eccardno',
            value: ''
          }
        }
      }
    );

    return {
      name: this.name,
      method: this.method,
      url: '/apix/client/experience/v2/load/27071ebc-ecb9-4983-9594-4f4a6bfa70f0?frn=SegmentedHomeHealth',
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
    const nbaData = data?.data?.PersonalizedHealthActions?.nbaData || {};
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
