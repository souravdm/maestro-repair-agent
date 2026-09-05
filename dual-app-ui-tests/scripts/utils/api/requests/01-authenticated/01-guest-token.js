/**
 * guest_token
 * POST https://www-qa2.cvs.com/api/guest/v1/token/?frn=caoad-guest-token
 */

const { randomUUID } = require('crypto');
const RequestHelper = require('../../lib/request-helper');

module.exports = {
  name: 'guest_token',
  description: 'Generate a guest token',
  method: 'POST',

  async execute(config = {}) {
    const visitorId = config.visitorId || randomUUID();

    const client = new RequestHelper({
      baseURL: config.baseURL || 'https://www-qa2.cvs.com',
      timeout: config.timeout || 30000
    });

    client.setHeaders({
      'x-friendlyname': 'caoad-guest-token',
      'x-api-key': 'FHbLTRk49KzXrKDrWWcHVGOVUvnIyVFz',
      'x-visitor-id': visitorId,
      'x-channel': 'mobile',
      'x-experienceid': '64ddbeb1-9b2a-4c74-8037-e98701f10f2b',
      'x-device-type': 'ANDROID',
      'env': 'QA2',
      'x-appconsumerinfov2': 'eyJibHVlVG9vdGhTdGF0dXMiOiJPbiIsImNsaWVudEZpbmdlclByaW50IjoiIiwiaXBBZGRyZXNzIjoiMTAuMC4yLjE2IiwibGF0aXR1ZGUiOiJudWxsIiwibG9uZ2l0dWRlIjoibnVsbCIsIm5ldHdvcmtTcGVlZCI6Ikdvb2QiLCJuZXR3b3JrU3RyZW5ndGgiOiJHb29kIiwibmV0d29ya1R5cGUiOiJXaUZpIn0=',
      'user-agent': 'CVSOnlineAndroid/25.11.30(2511300); (Google; sdk_gphone64_arm64; SDK 35; Android 15)',
      'quantummetricsessionid': '',
      'x-req-env': 'qa2',
      'x-price-v2': 'off',
      'content-type': 'application/json'
    });

    const response = await client.post(
      '/api/guest/v1/token/?frn=caoad-guest-token',
      { data: { cp: 'start' } }
    );

    return {
      name: this.name,
      method: this.method,
      url: '/api/guest/v1/token/?frn=caoad-guest-token',
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
    const token = data?.access_token;
    return token ? { guestToken: `Bearer ${token}` } : {};
  }
};
