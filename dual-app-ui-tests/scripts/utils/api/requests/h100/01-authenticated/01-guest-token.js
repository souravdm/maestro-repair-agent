/**
 * guest_token (H100)
 * POST https://api.qa2.health100.com/api/guest/v1/token/
 */

const { randomUUID } = require('crypto');
const RequestHelper = require('../../../lib/request-helper');

module.exports = {
  name: 'guest_token',
  description: 'Generate a guest token (H100 endpoint)',
  method: 'POST',

  async execute(config = {}) {
    const visitorId = config.visitorId || randomUUID();

    const client = new RequestHelper({
      baseURL: config.h100BaseURL || 'https://api.qa2.health100.com',
      timeout: config.timeout || 30000
    });

    client.setHeaders({
      'x-api-key':                config.h100ApiKey || 'FHbLTRk49KzXrKDrWWcHVGOVUvnIyVFz',
      'x-visitor-id':             visitorId,
      'x-channel':                'mobile',
      'x-device-type':            'Android',
      'user-agent':               'Health100Android/1.4.0(10400); (Google; sdk_gphone64_arm64; SDK 36; Android 16) HEALTH100_APP',
      'x-user-agent':             'Health100Android/1.4.0(10400); (Google; sdk_gphone64_arm64; SDK 36; Android 16) HEALTH100_APP',
      'quantummetricsessionid':   '',
      'x-app-name':               'H100_APP',
      'x-client-fingerprint-id':  visitorId,
      'content-type':             'application/json'
    });

    const response = await client.post(
      '/api/guest/v1/token/',
      { data: {} }
    );

    return {
      name: this.name,
      method: this.method,
      url: '/api/guest/v1/token/',
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
    const tokenType = data?.token_type || 'Bearer';
    const bfp = data?.bfp;
    return token
      ? { guestToken: `${tokenType} ${token}`, fingerprintId: bfp || null }
      : {};
  }
};
