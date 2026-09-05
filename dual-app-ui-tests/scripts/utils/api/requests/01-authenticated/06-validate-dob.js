/**
 * validate_dob
 * POST https://www-qa2.cvs.com/mcapi/client/experience/v2/load/a29c0680-8781-48f2-9cf6-532a733342e6?frn=caoad-retail-otp-validate-dob
 */

const RequestHelper = require('../../lib/request-helper');

module.exports = {
  name: 'validate_dob',
  description: 'Validate date of birth during MFA flow',
  method: 'POST',

  // Only needed when otp_validate signaled step-up (DOB_2FA_NEEDED). When OTP
  // alone succeeds, the mfaOTPSessionKey is already consumed and this call
  // will fail with INVALID_MFA_SESSION.
  condition(config = {}) {
    return !!config.needsDobValidation;
  },

  async execute(config = {}) {
    const client = new RequestHelper({
      baseURL: config.baseURL || 'https://www-qa2.cvs.com',
      timeout: config.timeout || 30000
    });

    client.setHeaders({
      'x-friendlyname': 'caoad-retail-otp-validate-dob',
      'x-app-name': 'CVS_APP',
      'x-channel': 'mobile',
      'x-experienceid': 'a29c0680-8781-48f2-9cf6-532a733342e6',
      'user-agent': 'CVSOnlineAndroid/25.11.30(2511300); (Google; sdk_gphone64_arm64; SDK 35; Android 15)',
      'quantummetricsessionid': '400a0f6ccebba13cf94d5396433c8259',
      'x-client-fingerprint-id': 'c2ae05e885904ed5b6d2b62472fd1f1f',
      'authorization': config.guestToken || '',
      'x-api-key': 'PRX4fYhAfVTr3UH3tSOTlb9oYNrAPUjA',
      'x-d-token': '3:Ny3ypEq7RN8a5CWOb7JaxA==:KmpHQufv5/S3Y3KroEV92Hpwj8SFlxel0wZEsZuwe3e5EAGXTsSndRfjWZ9cr0AvOhN6WlS78lUezqH6bhNa0UnzQj3ykjPGWhA7Kp18hTKGnf4WUfEFc39PHfJSBPeQHGzdgeOTs1VRBDZe5biqnkfEcRZSH0vlg11s52yFsKfgNWdcOnyLUA8gs32Vr8+kZY8e4k6UXMcScOKMTK2P9uOtZg4pHxlo3B7OoFrBhpUgrGO8CUQZQgMAuD4M4EXUnUU7zRfEzuSV//defUPSI7wWd62OV/A4BxvjKJ/c8qXc8gvd//LNtUSjvdUkB4A4x471VL4928SB1db+XVwZRsPfYos62zOrtGyjIrF6pKMjsjGZpdAhICgeNny2BH3Qudzi/9pJayjUl/RlhKwEt34RDy5ZFw0DtxZbIZR7O54=:WFkbiOqmZeLne3PYK1sQyTTmFw3MzzK35zpg4CqZCYs=',
      'x-visitor-id': config.visitorId || '',
      'x-route': 'account-gke-rke',
      'x-device-type': 'ANDROID',
      'content-type': 'application/json; charset=utf-8'
    });

    const rawDob = config.dob || '';
    const dob = rawDob.match(/^\d{8}$/)
      ? `${rawDob.slice(0, 2)}/${rawDob.slice(2, 4)}/${rawDob.slice(4)}`
      : rawDob;

    const response = await client.post(
      '/mcapi/client/experience/v2/load/a29c0680-8781-48f2-9cf6-532a733342e6?frn=caoad-retail-otp-validate-dob',
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
      url: '/mcapi/client/experience/v2/load/a29c0680-8781-48f2-9cf6-532a733342e6?frn=caoad-retail-otp-validate-dob',
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
