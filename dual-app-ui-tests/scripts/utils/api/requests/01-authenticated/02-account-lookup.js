/**
 * account_lookup_one_account
 * POST https://www-qa2.cvs.com/mcapi/client/experience/v2/load/8ceed976-8173-416e-a1d5-2b15a0899f9a?frn=caoad-retail-lookup-one-account
 */

const RequestHelper = require('../../lib/request-helper');

module.exports = {
  name: 'account_lookup_one_account',
  description: 'Lookup one account by email',
  method: 'POST',

  async execute(config = {}) {
    const client = new RequestHelper({
      baseURL: config.baseURL || 'https://www-qa2.cvs.com',
      timeout: config.timeout || 30000
    });

    client.setHeaders({
      'x-friendlyname': 'caoad-retail-lookup-one-account',
      'x-experienceid': '8ceed976-8173-416e-a1d5-2b15a0899f9a',
      'x-app-name': 'CVS_APP',
      'x-client-fingerprint-id': 'c2ae05e885904ed5b6d2b62472fd1f1f',
      'user-agent': 'CVSOnlineAndroid/25.11.30(2511300); (Google; sdk_gphone64_arm64; SDK 35; Android 15)',
      'quantummetricsessionid': '400a0f6ccebba13cf94d5396433c8259',
      'authorization': config.guestToken || '',
      'x-api-key': 'PRX4fYhAfVTr3UH3tSOTlb9oYNrAPUjA',
      'x-d-token': '3:tCF5H0pvIaYcy9Za/fdYgA==:39MuDxMLdSXo+nJZY2/lMxDigAoOgXnXFQIAW1hNZrlgYOCFcILbq7jlKMKP7nKbqWFwwp+cLJoV7BmAMBaGdyoA+HAunKijbZ4Da3KTCZ8VwVNXbBTXgQkVlxpVyTPVeGz+0ka/FepczK29sPJVvFIQFrkSv6DUq28TBP6BU3MVS3l5/M+1sjAJ/oLAylwimNyCiyUy2JYY++S5eG6hFXSKCh4hwjajCYue48XZT01FpcAg31q6HsoOzNj1VsjZd1O5XmdjTJVT30KP5c+n//eLZkCb3Mwh1g1XOAvJhaydTdIiQruWdMLBdQ4bzkcHUsFtf/quh7H40ZR2yboYx18OlZ3zTf4KHTcRzQd88qgEmOA7V8+GQMqM92gpTAtVdVzGyLD7QtJRQm5eYechoueyXAr5uZPTIEWi0jY5tEo=:drt5O3zhtNTiZiclLoDI2oXE8fwACUyCsxsXeusl0M0=',
      'x-visitor-id': config.visitorId || '',
      'x-route': 'account-gke-rke',
      'x-device-type': 'ANDROID',
      'content-type': 'application/json; charset=utf-8'
    });

    const response = await client.post(
      '/mcapi/client/experience/v2/load/8ceed976-8173-416e-a1d5-2b15a0899f9a?frn=caoad-retail-lookup-one-account',
      {
        data: {
          securityAccountLookupInput: {
            flowName: 'XLOB',
            bfp: config.fingerprintId || '',
            email: config.userEmail || ''
          }
        }
      }
    );

    const isExisting = response.data?.data?.accountLookUp?.isExisting;
    const notFound    = response.success && isExisting !== true;

    return {
      name: this.name,
      method: this.method,
      url: '/mcapi/client/experience/v2/load/8ceed976-8173-416e-a1d5-2b15a0899f9a?frn=caoad-retail-lookup-one-account',
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
