/**
 * get_otp
 * GET https://qaservices-east.corp.cvscaremark.com/microservices/digitalmfa/getOtp?mfaOTPSessionKey={{mfaOTPSessionKey}}
 */

const RequestHelper = require('../../lib/request-helper');

module.exports = {
  name: 'get_otp',
  description: 'Retrieve OTP code from internal QA service',
  method: 'GET',

  async execute(config = {}) {
    const client = new RequestHelper({
      baseURL: 'https://qaservices-east.corp.cvscaremark.com',
      timeout: config.timeout || 30000
    });

    client.setHeaders({
      'x-friendlyname': 'caoad-otp-retrieve',
      'user-agent': 'CVSOnlineAndroid/25.11.30(2511300); (Google; sdk_gphone64_arm64; SDK 35; Android 15)',
      'quantummetricsessionid': '400a0f6ccebba13cf94d5396433c8259',
      'x-client-fingerprint-id': 'c2ae05e885904ed5b6d2b62472fd1f1f',
      'authorization': config.internalServiceToken || 'Bearer eyJraWQiOiJRTFlzdmxrbjM0d0gtSGtteE13Yk5TcnpvZkgtbFBXREVRSy03Q2tFYlNnIiwidHlwIjoiSldUIiwiYWxnIjoiUlMyNTYifQ.eyJ4LWFwcC1uYW1lIjoicmV0YWlsLWd1ZXN0Zmxvdy1hcHAtdjEiLCJzdWIiOiJyZXRhaWwtZ3Vlc3RmbG93LWFwcC12MSIsImlzcyI6Imh0dHBzOlwvXC9hcGkuY3ZzaGVhbHRoLmNvbVwvb2F1dGhcL3YxIiwieC1ncmlkIjoicnJ0LTQ1MzgyMDk0MjYxMTA0NTk4MjgtYy1nd28xLTIwOTUxMjktNDc4ODIwMC0xOSIsIngtY2FjaGUtcHJlc2VudCI6ZmFsc2UsIngtZmxvdy10eXBlIjoiZ3Vlc3QiLCJhdWQiOiJndWVzdC1mbG93IiwieC1jbGllbnQtaWQiOiJGSGJMVFJrNDlLelhyS0RyV1djSFZHT1ZVdm5JeVZGeiIsInNjb3BlIjoib3BlbmlkIiwieC1jbGllbnQtZmluZ2VycHJpbnQtaWQiOiJjMmFlMDVlODg1OTA0ZWQ1YjZkMmI2MjQ3MmZkMWYxZiIsIngtbG9iIjoiZ3Vlc3QtZmxvdyIsImV4cCI6MTc2MjMxNzUxMCwiaWF0IjoxNzYyMzE2NjEwLCJ4LXVzZXItY29udGV4dC10eXBlIjoiZ3Vlc3QiLCJqdGkiOiI0ZmRlZDE0Yi01ZWY2LTQ4ODYtYjQ4Ni1hYWQ2YzU0NjI3N2IifQ.Tqup0LHuxi0ZyX03ozB4-Bn_z9xdhULIxHOLitIQS18ud7KsR8hltan6YBWyykaftDJjtBuw6v7HJuhY2zaT5ryB1772cIYAHBBr8nFEs3JZKzMMWgnEm0Jfwo_sGLLY4qly4fx6SpNzdaSlxn5Os0hPF9Ug8VHu452dCF-U3AO7AmDtt0ZOJyZgclWnPuPA2ItFXCxrYJb5tX7PkFiVzq73fPpLtecDo9U96GokV-jcDs2Qu23OyNlOMEkEqjsk2J4TL_UCtNn2ACe8QdVL41yJ_bukctI3SU3QMyuhD3VOYg1CF7gSFlQ4bGBqhWDQOt-Olo4LdWFfiCq3W5kclw',
      'x-api-key': 'PRX4fYhAfVTr3UH3tSOTlb9oYNrAPUjA',
      'x-route': 'account-gke-rke',
      'x-device-type': 'ANDROID'
    });

    const response = await client.get(
      `/microservices/digitalmfa/getOtp?mfaOTPSessionKey=${encodeURIComponent(config.mfaOTPSessionKey || '')}`
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
