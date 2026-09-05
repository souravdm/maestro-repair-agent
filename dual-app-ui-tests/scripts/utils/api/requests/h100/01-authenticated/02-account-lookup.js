/**
 * h100_account_lookup
 * POST https://api.qa2.health100.com/mcapi/client/experience/v2/load/dfd39c53-662d-4a4b-b02d-fcae7ecadaa2?frn=caoad-health-account-lookup
 * H100-specific experience ID and host. Uses lob=h100 and flowName=h100.
 */

const RequestHelper = require('../../../lib/request-helper');

module.exports = {
  name: 'h100_account_lookup',
  description: 'Lookup H100 account by email (caoad-health-account-lookup)',
  method: 'POST',

  async execute(config = {}) {
    const client = new RequestHelper({
      baseURL: config.h100BaseURL || 'https://api.qa2.health100.com',
      timeout: config.timeout || 30000
    });

    client.setHeaders({
      'x-friendlyname':           'caoad-health-account-lookup',
      'x-experienceid':           'dfd39c53-662d-4a4b-b02d-fcae7ecadaa2',
      'x-app-name':               'H100_APP',
      'x-channel':                'mobile',
      'x-client-fingerprint-id':  'dd6007674c3a4e61aa2c7d23f97e6cea',
      'x-visitor-id':             config.visitorId || '',
      'x-route':                  'account-gke-rke',
      'x-device-type':            'ANDROID',
      'user-agent':               'Health100Android/26.3.30(2603300); (Google; sdk_gphone64_arm64; SDK 36; Android 16) HEALTH100_APP',
      'quantummetricsessionid':   'b57726e62667e0cf313510229056fb2c',
      'authorization':            config.guestToken || '',
      'x-api-key':                config.h100ApiKey || 'PRX4fYhAfVTr3UH3tSOTlb9oYNrAPUjA',
      'x-d-token':                '3:vQhFwkMEaoHgLEvXcrwaLw==:mZLieniqlzV8IeCj+v7GnpWF53EmwWpZFkgZpZwgm6cQnKh52utdT0PFgg/8Ka88YPhjre9uCDots+yZMpJTNgAte612iq85c2u+iaUNm044QQVHYEHLDOTjiKJLc/KnjJUVU79J3V3iHchhXpaOj7tmxbneQInHtsgz1NwAe536dJiGWHHfjbKqwmKgLPP9fd6Dv8NTpgnHmB9MeV/7FhEut5NVCucZncUsmkjXsPBHCClHG0hdjF5lk0xn8n3YYqeawz3bIqV4O1vYZB9pgpV7yIrP1xFsFcGnmD/BfdE8kjFLqQx1m0q3M2JqfJOC1+NApdwHqSAEz78nbzsJg2O6Clz59AD3YkV0qYcb+NJYP9shh7V954Ef3dKBXblcLqwUXMfAQP81lCmjh9BnIEq79CVnoG0WhBnYcUuItFw=:+taHsqq9jGrfaAil+Gf2DzrX6Lby+5zNpIyZWMcQjdc=',
      'content-type':             'application/json; charset=utf-8'
    });

    const response = await client.post(
      '/mcapi/client/experience/v2/load/dfd39c53-662d-4a4b-b02d-fcae7ecadaa2?frn=caoad-health-account-lookup',
      {
        data: {
          searchType: 'BY_EMAIL_AND_PHONE',
          lob: 'h100',
          securityAccountLookupInput: {
            email: config.userEmail || '',
            flowName: 'h100',
            bfp: config.fingerprintId,
          }
        }
      }
    );

    const isExisting = response.data?.data?.accountLookUp?.isExisting;
    const notFound    = response.success && isExisting !== true;

    return {
      name: this.name,
      method: this.method,
      url: '/mcapi/client/experience/v2/load/dfd39c53-662d-4a4b-b02d-fcae7ecadaa2?frn=caoad-health-account-lookup',
      statusCode: response.statusCode,
      statusMessage: response.statusMessage,
      timing: response.timing,
      success: notFound ? false : response.success,
      data: response.data,
      error: notFound ? `Account not found — isExisting: ${isExisting}` : response.error,
      request: response.request
    };
  },

  extract(data) {
    const key = data?.data?.accountLookUp?.mfa?.mfaOTPSessionKey;
    return key ? { mfaOTPSessionKey: key } : {};
  }
};
