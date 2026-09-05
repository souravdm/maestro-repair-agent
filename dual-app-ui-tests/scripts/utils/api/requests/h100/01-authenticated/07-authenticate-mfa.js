/**
 * h100_authenticate_mfa
 * POST https://api.qa2.health100.com/api/auth/experience/v2/load/ea305c24-3c33-466b-86f8-18559d3eb644?frn=caoad-authenticate-mfa
 */

const RequestHelper = require('../../../lib/request-helper');

module.exports = {
  name: 'h100_authenticate_mfa',
  description: 'Exchange MFA token for authenticated access token (H100)',
  method: 'POST',

  // Only needed when the DOB step-up path ran (needsDobValidation from
  // otp_validate). When OTP alone succeeds, no further exchange is required.
  condition(config = {}) {
    return !!config.needsDobValidation;
  },

  async execute(config = {}) {
    const client = new RequestHelper({
      baseURL: config.h100BaseURL || 'https://api.qa2.health100.com',
      timeout: config.timeout || 30000
    });

    client.setHeaders({
      'x-friendlyname':           'caoad-authenticate-mfa',
      'x-app-name':               'H100_APP',
      'x-channel':                'mobile',
      'x-experienceid':           'ea305c24-3c33-466b-86f8-18559d3eb644',
      'user-agent':               'Health100Android/26.3.30(2603300); (Google; sdk_gphone64_arm64; SDK 36; Android 16) HEALTH100_APP',
      'quantummetricsessionid':   'b57726e62667e0cf313510229056fb2c',
      'x-client-fingerprint-id':  'dd6007674c3a4e61aa2c7d23f97e6cea',
      'authorization':            config.guestToken || '',
      'x-api-key':                config.h100ApiKey || 'PRX4fYhAfVTr3UH3tSOTlb9oYNrAPUjA',
      'x-d-token':                '3:R/B+M1VWthDg+WuGDYFCKg==:vcwvUCj0tzeJa5Yx+2xQ5ogbfQQCbvAo1WkRBdqUap0AdQ9iWAryffoF1ZRdEjh86w0MGQgxqX89aXRnZ4F93Nvdk3xNQ/pgHaCx4ftZwOQqnMGeCFKtDLeh8SfM0AHSRuE0HPITN9+5mT9A6jE3nSGKnIgRUjWxL8yuJpjZfIdaCMqbwli92Hs+NdVAox5EiRx780fGCXGdXwmecJXfMAYToP/OZTZdbKuV9MNu8EmrNsa8Q36/UJwkxLNCSL/b19HSVC7Krova8XhAOaUAoB5LtB8/SxMFVkY8v0RdPrgHsg+PAv3Z5Bi1KIf9FUnqunuc3kMVjkzFojdrzsw9DqbWyU/htYEaNqIU/gvUnvXNgLJS9hxQW/ch0tEX+52b7idUIYy6yYfpDkSpjoQhrtdFu3cUkktwOmrErRXiyFk=:hHowl8c8AYisEMgGjZL5xzK9JM2lSpOaZUXQIka4UvM=',
      'x-visitor-id':             config.visitorId || '',
      'x-route':                  'account-gke-rke',
      'x-device-type':            'ANDROID',
      'content-type':             'application/json; charset=utf-8'
    });

    const response = await client.post(
      '/api/auth/experience/v2/load/ea305c24-3c33-466b-86f8-18559d3eb644?frn=caoad-authenticate-mfa',
      {
        data: {
          inputReq: {
            lob: 'h100',
            grantType: 'mfa',
            flowName: 'login',
            authCode: config.mfaToken || ''
          }
        }
      }
    );

    return {
      name: this.name,
      method: this.method,
      url: '/api/auth/experience/v2/load/ea305c24-3c33-466b-86f8-18559d3eb644?frn=caoad-authenticate-mfa',
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
    const token = data?.data?.response?.token?.access_token;
    return token ? { authToken: `Bearer ${token}` } : {};
  }
};
