/**
 * otp_validate
 * POST https://www-qa2.cvs.com/mcapi/client/experience/v2/load/fc35e9fa-78c4-4b34-81f6-4aa299df96a8?frn=caoad-otp-validate
 */

const RequestHelper = require('../../lib/request-helper');

module.exports = {
  name: 'otp_validate',
  description: 'Validate OTP code',
  method: 'POST',
  allowFailure: true,

  async execute(config = {}) {
    const client = new RequestHelper({
      baseURL: config.baseURL || 'https://www-qa2.cvs.com',
      timeout: config.timeout || 30000
    });

    client.setHeaders({
      'x-friendlyname': 'caoad-otp-validate',
      'x-clientrefid': '6198514e-dffd-4571-ac26-6bb6d5c1b1f8',
      'x-visitor-id': config.visitorId || '',
      'x-acf-sensor-data': '6,a,qe92jvD9zH995PQPiF6FDBTRlRYJCScY4EWPp+dAEND2krylj5xpAFmfM/rmKZ9hxQkjA6kyT94Zbir+kE6ccXEcyAhfakE6bq2DueHQuSGVW6lC6m5VMjT9hBN4cgX+XDMVXIM05ysiZqw7D8r/MK1QYdm8fpM2CsmBC11rtyU=,juv4cyyMq9OcFWBpgCMxGx+ZEi4AeglAKKOw/qHDgGFfLe00OHUwtIahrL+bf/Oiz8IpzL6ZvHHMnUioWnhHcH+2ul4SqdRw4ZEn9/dSCz8u/pjWMpYDKyUl85N5KrrsVmTQXpdDILiE2PeHeyZff6Di7HbQyBrUZmB+O/xZsAU=',
      'env': 'QA2',
      'x-experienceid': 'fc35e9fa-78c4-4b34-81f6-4aa299df96a8',
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
      '/mcapi/client/experience/v2/load/fc35e9fa-78c4-4b34-81f6-4aa299df96a8?frn=caoad-otp-validate',
      {
        data: {
          validateOtpInput: {
            mfaOTPSessionKey: config.mfaOTPSessionKey || '',
            otp: config.otpCode || '',
            rbaConsentApproved: true
          }
        }
      }
    );

    return {
      name: this.name,
      method: this.method,
      url: '/mcapi/client/experience/v2/load/fc35e9fa-78c4-4b34-81f6-4aa299df96a8?frn=caoad-otp-validate',
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
    const validateOtp = data?.data?.validateOtp || data?.validateOtp;
    const token = validateOtp?.mfaToken
      || data?.validateOtpOutput?.mfaToken
      || data?.validateOtpOutput?.authCode
      || data?.data?.validateOtpOutput?.mfaToken
      || data?.mfaToken;
    const fault = data?.fault || data?.data?.fault;
    const sessionKey = validateOtp?.mfaOTPSessionKey
      || fault?.mfaOTPSessionKey;
    const needsDobValidation = Array.isArray(fault?.errors)
      && fault.errors.some(e => e?.type === 'validateotp.errortypes.DOB_2FA_NEEDED');
    const result = {};
    if (token)      result.mfaToken         = token;
    if (sessionKey) result.mfaOTPSessionKey = sessionKey;
    result.needsDobValidation = needsDobValidation;
    return result;
  }
};
