/**
 * h100_otp_generate
 * POST https://api.qa2.health100.com/mcapi/client/experience/v2/load/6497c2a8-b1a3-4f9b-bd7a-7d3d2c21c900?frn=caoad-otp-generate
 * Same experience ID as CVS but hits the H100 host. Uses email channel (not sms).
 */

const RequestHelper = require('../../../lib/request-helper');

module.exports = {
  name: 'h100_otp_generate',
  description: 'Generate OTP for H100 MFA via email channel',
  method: 'POST',

  async execute(config = {}) {
    const client = new RequestHelper({
      baseURL: config.h100BaseURL || 'https://api.qa2.health100.com',
      timeout: config.timeout || 30000
    });

    client.setHeaders({
      'x-friendlyname':           'caoad-otp-generate',
      'x-clientrefid':            'ef9dc174-9fa5-4fd6-a864-3d753900c8cf',
      'x-visitor-id':             config.visitorId || '',
      'x-app-name':               'H100_APP',
      'x-route':                  'account-gke-rke',
      'x-device-type':            'ANDROID',
      'x-api-key':                config.h100ApiKey || 'PRX4fYhAfVTr3UH3tSOTlb9oYNrAPUjA',
      'x-experienceid':           '6497c2a8-b1a3-4f9b-bd7a-7d3d2c21c900',
      'env':                      'QA2',
      'user-agent':               'Health100Android/26.3.30(2603300); (Google; sdk_gphone64_arm64; SDK 36; Android 16) HEALTH100_APP',
      'quantummetricsessionid':   'b57726e62667e0cf313510229056fb2c',
      'x-client-fingerprint-id':  'dd6007674c3a4e61aa2c7d23f97e6cea',
      'authorization':            config.guestToken || '',
      'x-d-token':                '3:R/B+M1VWthDg+WuGDYFCKg==:vcwvUCj0tzeJa5Yx+2xQ5ogbfQQCbvAo1WkRBdqUap0AdQ9iWAryffoF1ZRdEjh86w0MGQgxqX89aXRnZ4F93Nvdk3xNQ/pgHaCx4ftZwOQqnMGeCFKtDLeh8SfM0AHSRuE0HPITN9+5mT9A6jE3nSGKnIgRUjWxL8yuJpjZfIdaCMqbwli92Hs+NdVAox5EiRx780fGCXGdXwmecJXfMAYToP/OZTZdbKuV9MNu8EmrNsa8Q36/UJwkxLNCSL/b19HSVC7Krova8XhAOaUAoB5LtB8/SxMFVkY8v0RdPrgHsg+PAv3Z5Bi1KIf9FUnqunuc3kMVjkzFojdrzsw9DqbWyU/htYEaNqIU/gvUnvXNgLJS9hxQW/ch0tEX+52b7idUIYy6yYfpDkSpjoQhrtdFu3cUkktwOmrErRXiyFk=:hHowl8c8AYisEMgGjZL5xzK9JM2lSpOaZUXQIka4UvM=',
      'content-type':             'application/json; charset=utf-8'
    });

    const response = await client.post(
      '/mcapi/client/experience/v2/load/6497c2a8-b1a3-4f9b-bd7a-7d3d2c21c900?frn=caoad-otp-generate',
      {
        data: {
          generateOtpInput: {
            mfaOTPSessionKey: config.mfaOTPSessionKey || '',
            communicationChannelType: 'email'
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
