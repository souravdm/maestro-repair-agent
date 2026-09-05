/**
 * otp_generate
 * POST https://www-qa2.cvs.com/mcapi/client/experience/v2/load/6497c2a8-b1a3-4f9b-bd7a-7d3d2c21c900?frn=caoad-otp-generate
 */

const RequestHelper = require('../../lib/request-helper');

module.exports = {
  name: 'otp_generate',
  description: 'Generate OTP for MFA',
  method: 'POST',

  async execute(config = {}) {
    const client = new RequestHelper({
      baseURL: config.baseURL || 'https://www-qa2.cvs.com',
      timeout: config.timeout || 30000
    });

    client.setHeaders({
      'x-friendlyname': 'caoad-otp-generate',
      'x-clientrefid': 'ef9dc174-9fa5-4fd6-a864-3d753900c8cf',
      'x-visitor-id': config.visitorId || '',
      'env': 'QA2',
      'x-experienceid': '6497c2a8-b1a3-4f9b-bd7a-7d3d2c21c900',
      'user-agent': 'CVSOnlineAndroid/25.11.30(2511300); (Google; sdk_gphone64_arm64; SDK 35; Android 15)',
      'quantummetricsessionid': '400a0f6ccebba13cf94d5396433c8259',
      'x-client-fingerprint-id': 'c2ae05e885904ed5b6d2b62472fd1f1f',
      'authorization': config.guestToken || '',
      'x-d-token': '3:R/B+M1VWthDg+WuGDYFCKg==:vcwvUCj0tzeJa5Yx+2xQ5ogbfQQCbvAo1WkRBdqUap0AdQ9iWAryffoF1ZRdEjh86w0MGQgxqX89aXRnZ4F93Nvdk3xNQ/pgHaCx4ftZwOQqnMGeCFKtDLeh8SfM0AHSRuE0HPITN9+5mT9A6jE3nSGKnIgRUjWxL8yuJpjZfIdaCMqbwli92Hs+NdVAox5EiRx780fGCXGdXwmecJXfMAYToP/OZTZdbKuV9MNu8EmrNsa8Q36/UJwkxLNCSL/b19HSVC7Krova8XhAOaUAoB5LtB8/SxMFVkY8v0RdPrgHsg+PAv3Z5Bi1KIf9FUnqunuc3kMVjkzFojdrzsw9DqbWyU/htYEaNqIU/gvUnvXNgLJS9hxQW/ch0tEX+52b7idUIYy6yYfpDkSpjoQhrtdFu3cUkktwOmrErRXiyFk=:hHowl8c8AYisEMgGjZL5xzK9JM2lSpOaZUXQIka4UvM=',
      'x-api-key': 'PRX4fYhAfVTr3UH3tSOTlb9oYNrAPUjA',
      'x-route': 'account-gke-rke',
      'x-device-type': 'ANDROID',
      'content-type': 'application/json; charset=utf-8'
    });

    const response = await client.post(
      '/mcapi/client/experience/v2/load/6497c2a8-b1a3-4f9b-bd7a-7d3d2c21c900?frn=caoad-otp-generate',
      {
        data: {
          generateOtpInput: {
            mfaOTPSessionKey: config.mfaOTPSessionKey || '',
            communicationChannelType: 'sms0'
          }
        }
      }
    );

    return {
      name: this.name,
      method: this.method,
      url: '/mcapi/client/experience/v2/load/6497c2a8-b1a3-4f9b-bd7a-7d3d2c21c900?frn=caoad-otp-generate',
      statusCode: response.statusCode,
      statusMessage: response.statusMessage,
      timing: response.timing,
      success: response.success,
      responseHeaders: response.headers,
      data: response.data,
      error: response.error,
      request: response.request
    };
  }
};
