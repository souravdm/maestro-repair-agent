/**
 * H100-PE-haio
 * POST https://api.qa2.health100.com/apix/client/experience/v2/load/{{experienceId}}
 * H100 PE-haio experience load. No `frn` query parameter.
 */

const RequestHelper = require('../../../lib/request-helper');

const EXPERIENCE_ID = '9bd2121c-2584-49fe-b808-acc929398326';

module.exports = {
  name: 'H100-PE-haio',
  description: 'Get personalized H100 HAIO actions',
  method: 'POST',
  allowFailure: true,

  async execute(config = {}) {
    const client = new RequestHelper({
      baseURL: config.baseURL || 'https://api.qa2.health100.com',
      timeout: config.timeout || 30000
    });

    client.setHeaders({
      'x-experienceid':              config.peHaioExperienceId || EXPERIENCE_ID,
      'x-visitor-id':                config.visitorId || '',
      'x-app-name':                  'H100_APP',
      'x-hs-pzn-flu-covid-discount': 'false',
      'x-route':                     'SUPERAPP-PZN-HA',
      'user-agent':                  'Health100Android/26.3.30(2603300); (Google; sdk_gphone64_arm64; SDK 36; Android 16) HEALTH100_APP',
      'authorization':               config.authToken || '',
      'x-api-key':                   'PRX4fYhAfVTr3UH3tSOTlb9oYNrAPUjA',
      'content-type':                'application/json; charset=utf-8'
    });

    const experienceId = config.peHaioExperienceId || EXPERIENCE_ID;
    const path = `/apix/client/experience/v2/load/${experienceId}`;

    const response = await client.post(path, { data: {} });

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
    const payload = data?.data || {};
    const entries = Object.entries(payload).map(([key, value]) => ({
      insightKey:            key,
      isNull:                value == null,
      title:                 value?.title                 ?? null,
      description:           value?.description           ?? null,
      cta:                   value?.cta                   ?? null,
      deeplink:              value?.deeplink              ?? null,
      prescriptionLookupKey: value?.prescriptionLookupKey ?? null,
      raw:                   value
    }));

    const nonNull = entries.filter(e => !e.isNull);

    return {
      insights:       entries,
      insightKeys:    entries.map(i => i.insightKey),
      insightCount:   nonNull.length,
      hasHaioInsight: nonNull.length > 0
    };
  }
};
