/**
 * h100_get_otp
 * GET https://qaservices-east.corp.cvscaremark.com/microservices/digitalmfa/getOtp?mfaOTPSessionKey={{mfaOTPSessionKey}}
 * Same internal QA service as CVS. frn differs: caoad-health-otp-retrieve.
 */

const RequestHelper = require('../../../lib/request-helper');

module.exports = {
  name: 'h100_get_otp',
  description: 'Retrieve OTP code from internal QA service (H100 frn)',
  method: 'GET',

  async execute(config = {}) {
    const client = new RequestHelper({
      baseURL: 'https://qaservices-east.corp.cvscaremark.com',
      timeout: config.timeout || 30000
    });

    client.setHeaders({
      'x-friendlyname':           'caoad-health-otp-retrieve',
      'user-agent':               'Health100Android/26.3.30(2603300); (Google; sdk_gphone64_arm64; SDK 36; Android 16) HEALTH100_APP',
      'quantummetricsessionid':   'b57726e62667e0cf313510229056fb2c',
      'x-client-fingerprint-id':  'dd6007674c3a4e61aa2c7d23f97e6cea',
      'authorization':            config.guestToken || '',
      'x-api-key':                config.h100ApiKey || 'PRX4fYhAfVTr3UH3tSOTlb9oYNrAPUjA',
      'x-route':                  'account-gke-rke',
      'x-device-type':            'ANDROID',
      'x-app-name':               'H100_APP'
    });

    const response = await client.get(
      `/microservices/digitalmfa/getOtp?mfaOTPSessionKey=${encodeURIComponent(config.mfaOTPSessionKey || '')}&frn=caoad-health-otp-retrieve`
    );

    return {
      name: this.name,
      method: this.method,
      url: '/microservices/digitalmfa/getOtp',
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
    const otp = data != null ? String(data) : null;
    return otp ? { otpCode: otp } : {};
  }
};
