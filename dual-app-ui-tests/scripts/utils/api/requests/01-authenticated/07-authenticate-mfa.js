/**
 * authenticate_mfa
 * POST https://www-qa2.cvs.com/api/auth/experience/v2/load/80508dd7-330f-41dd-9924-9aeffdb7b1b5?frn=caoad-authenticate-mfa
 */

const RequestHelper = require('../../lib/request-helper');

module.exports = {
  name: 'authenticate_mfa',
  description: 'Exchange MFA token for authenticated access token',
  method: 'POST',

  // Only needed when the DOB step-up path ran (needsDobValidation from
  // otp_validate). When OTP alone succeeds, no further exchange is required.
  condition(config = {}) {
    return !!config.needsDobValidation;
  },

  async execute(config = {}) {
    const client = new RequestHelper({
      baseURL: config.baseURL || 'https://www-qa2.cvs.com',
      timeout: config.timeout || 30000
    });

    client.setHeaders({
      'x-friendlyname': 'caoad-authenticate-mfa',
      'x-app-name': 'CVS_APP',
      'x-channel': 'mobile',
      'x-experienceid': '80508dd7-330f-41dd-9924-9aeffdb7b1b5',
      'user-agent': 'CVSOnlineAndroid/25.11.30(2511300); (Google; sdk_gphone64_arm64; SDK 35; Android 15)',
      'quantummetricsessionid': '400a0f6ccebba13cf94d5396433c8259',
      'x-client-fingerprint-id': 'c2ae05e885904ed5b6d2b62472fd1f1f',
      'authorization': config.guestToken || '',
      'x-api-key': 'PRX4fYhAfVTr3UH3tSOTlb9oYNrAPUjA',
      'x-d-token': '3:R/B+M1VWthDg+WuGDYFCKg==:vcwvUCj0tzeJa5Yx+2xQ5ogbfQQCbvAo1WkRBdqUap0AdQ9iWAryffoF1ZRdEjh86w0MGQgxqX89aXRnZ4F93Nvdk3xNQ/pgHaCx4ftZwOQqnMGeCFKtDLeh8SfM0AHSRuE0HPITN9+5mT9A6jE3nSGKnIgRUjWxL8yuJpjZfIdaCMqbwli92Hs+NdVAox5EiRx780fGCXGdXwmecJXfMAYToP/OZTZdbKuV9MNu8EmrNsa8Q36/UJwkxLNCSL/b19HSVC7Krova8XhAOaUAoB5LtB8/SxMFVkY8v0RdPrgHsg+PAv3Z5Bi1KIf9FUnqunuc3kMVjkzFojdrzsw9DqbWyU/htYEaNqIU/gvUnvXNgLJS9hxQW/ch0tEX+52b7idUIYy6yYfpDkSpjoQhrtdFu3cUkktwOmrErRXiyFk=:hHowl8c8AYisEMgGjZL5xzK9JM2lSpOaZUXQIka4UvM=',
      'x-visitor-id': config.visitorId || '',
      'x-route': 'account-gke-rke',
      'x-device-type': 'ANDROID',
      'content-type': 'application/json; charset=utf-8'
    });

    const response = await client.post(
      '/api/auth/experience/v2/load/80508dd7-330f-41dd-9924-9aeffdb7b1b5?frn=caoad-authenticate-mfa',
      {
        data: {
          inputReq: {
            lob: 'RETAIL',
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
      url: '/api/auth/experience/v2/load/80508dd7-330f-41dd-9924-9aeffdb7b1b5?frn=caoad-authenticate-mfa',
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
