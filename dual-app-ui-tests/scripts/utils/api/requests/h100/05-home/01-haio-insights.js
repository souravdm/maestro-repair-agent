/**
 * H100-home-haio-insights
 * POST https://api.qa2.health100.com/apix/client/experience/v2/load/1f7ed9db-f604-4b42-a138-da8ff65dbd48?frn=HomeUserHaioInsights
 */

'use strict';

const RequestHelper = require('../../../lib/request-helper');

const EXPERIENCE_ID = '1f7ed9db-f604-4b42-a138-da8ff65dbd48';

module.exports = {
  name: 'H100-home-haio-insights',
  description: 'Get HAIO insights for H100 home screen (HomeUserHaioInsights)',
  method: 'POST',
  allowFailure: true,

  async execute(config = {}) {
    const client = new RequestHelper({
      baseURL: config.h100BaseURL || 'https://api.qa2.health100.com',
      timeout: config.timeout || 30000
    });

    client.setHeaders({
      'x-experienceid':  EXPERIENCE_ID,
      'x-visitor-id':    config.visitorId || 'dd6007674c3a4e61aa2c7d23f97e6cea',
      'x-route':         'superapp-pzn-ha',
      'x-app-name':      'H100_APP',
      'authorization':   config.authToken || '',
      'x-channel':       'mobile',
      'x-device-type':   'Android',
      'x-api-key':       config.h100ApiKey || 'PRX4fYhAfVTr3UH3tSOTlb9oYNrAPUjA',
      'content-type':    'application/json; charset=utf-8'
    });

    const url = `/apix/client/experience/v2/load/${EXPERIENCE_ID}?frn=HomeUserHaioInsights`;

    const response = await client.post(url, { data: {} });

    return {
      name:          this.name,
      method:        this.method,
      url,
      statusCode:    response.statusCode,
      statusMessage: response.statusMessage,
      timing:        response.timing,
      success:       response.success,
      data:          response.data,
      error:         response.error,
      request:       response.request
    };
  },

  extractData(data) {
    const dataObj = data?.data || null;
    if (!dataObj) return { haioData: null };

    // Return all non-null fields from data.data
    const haioData = {};
    for (const [key, value] of Object.entries(dataObj)) {
      if (value !== null && value !== undefined) {
        haioData[key] = value;
      }
    }

    return { haioData: Object.keys(haioData).length ? haioData : null };
  }
};
