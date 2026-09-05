/**
 * h100_validate_dob
 * POST https://api.qa2.health100.com/mcapi/client/experience/v2/load/a29c0680-8781-48f2-9cf6-532a733342e6?frn=caoad-health-otp-validate-dob
 * Same experience ID as CVS. H100 host + frn prefix differs (caoad-health- vs caoad-retail-).
 */

const RequestHelper = require('../../../lib/request-helper');

module.exports = {
  name: 'h100_validate_dob',
  description: 'Validate date of birth during H100 MFA flow',
  method: 'POST',

  // Only needed when otp_validate signaled step-up (DOB_2FA_NEEDED). When OTP
  // alone succeeds, the mfaOTPSessionKey is already consumed and this call
  // will fail with INVALID_MFA_SESSION.
  condition(config = {}) {
    return !!config.needsDobValidation;
  },

  async execute(config = {}) {
    const client = new RequestHelper({
      baseURL: config.h100BaseURL || 'https://api.qa2.health100.com',
      timeout: config.timeout || 30000
    });

    client.setHeaders({
      'x-friendlyname':           'caoad-health-otp-validate-dob',
      'x-app-name':               'H100_APP',
      'x-channel':                'mobile',
      'x-experienceid':           'a29c0680-8781-48f2-9cf6-532a733342e6',
      'x-visitor-id':             config.visitorId || '',
      'x-route':                  'account-gke-rke',
      'x-device-type':            'ANDROID',
      'x-api-key':                config.h100ApiKey || 'PRX4fYhAfVTr3UH3tSOTlb9oYNrAPUjA',
      'user-agent':               'Health100Android/26.3.30(2603300); (Google; sdk_gphone64_arm64; SDK 36; Android 16) HEALTH100_APP',
      'authorization':            config.guestToken || '',
      'x-d-token':                '3:Ny3ypEq7RN8a5CWOb7JaxA==:KmpHQufv5/S3Y3KroEV92Hpwj8SFlxel0wZEsZuwe3e5EAGXTsSndRfjWZ9cr0AvOhN6WlS78lUezqH6bhNa0UnzQj3ykjPGWhA7Kp18hTKGnf4WUfEFc39PHfJSBPeQHGzdgeOTs1VRBDZe5biqnkfEcRZSH0vlg11s52yFsKfgNWdcOnyLUA8gs32Vr8+kZY8e4k6UXMcScOKMTK2P9uOtZg4pHxlo3B7OoFrBhpUgrGO8CUQZQgMAuD4M4EXUnUU7zRfEzuSV//defUPSI7wWd62OV/A4BxvjKJ/c8qXc8gvd//LNtUSjvdUkB4A4x471VL4928SB1db+XVwZRsPfYos62zOrtGyjIrF6pKMjsjGZpdAhICgeNny2BH3Qudzi/9pJayjUl/RlhKwEt34RDy5ZFw0DtxZbIZR7O54=:WFkbiOqmZeLne3PYK1sQyTTmFw3MzzK35zpg4CqZCYs=',
      'content-type':             'application/json; charset=utf-8'
    });

    const rawDob = config.dob || '';
    const dob = rawDob.match(/^\d{8}$/)
      ? `${rawDob.slice(0, 2)}/${rawDob.slice(2, 4)}/${rawDob.slice(4)}`
      : rawDob;

    const response = await client.post(
      '/mcapi/client/experience/v2/load/a29c0680-8781-48f2-9cf6-532a733342e6?frn=caoad-health-otp-validate-dob',
      {
        data: {
          validateDobInput: {
            mfaOTPSessionKey: config.mfaOTPSessionKey || '',
            dob
          }
        }
      }
    );

    return {
      name: this.name,
      method: this.method,
      url: '/mcapi/client/experience/v2/load/a29c0680-8781-48f2-9cf6-532a733342e6?frn=caoad-health-otp-validate-dob',
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
    const token = data?.data?.validateDob?.mfaToken;
    return token ? { mfaToken: token } : {};
  }
};
