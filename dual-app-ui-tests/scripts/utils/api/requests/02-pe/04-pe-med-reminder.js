/**
 * PE-med-reminder
 * POST https://www-qa2.cvs.com/apix/client/experience/v2/load/3ff2c478-f3aa-4e8e-91ee-19d9610b154f?frn=SegmentedHomeMedReminder
 */

const RequestHelper = require('../../lib/request-helper');

module.exports = {
  name: 'PE-med-reminder',
  description: 'Get personalized medication reminder actions (SegmentedHomeMedReminder)',
  method: 'POST',
  allowFailure: true,

  condition(config) {
    const MED_TYPES = ['RXC_RX_PATIENT_ID_TYPE', 'SPL_HB_PATIENT_ID_TYPE', 'PBM_QL_PARTICIPANT_ID_TYPE'];
    const types = config.linkedIdTypes || [];
    return MED_TYPES.some(t => types.includes(t));
  },

  async execute(config = {}) {
    const client = new RequestHelper({
      baseURL: config.baseURL || 'https://www-qa2.cvs.com',
      timeout: config.timeout || 30000
    });

    client.setHeaders({
      'x-experienceid':              '3ff2c478-f3aa-4e8e-91ee-19d9610b154f',
      'x-visitor-id':                config.visitorId || '',
      'x-hs-pzn-version':            'v3',
      'x-hs-pzn-rx-date-flag':       'true',
      'x-hs-pzn-check-fpu':          'true',
      'x-hs-pzn-flu-covid-discount': 'true',
      'x-hs-pzn-option-1':           'true',
      'x-route':                     'superapp-pzn-ha',
      'x-hs-pzn-sms-optin':          'true',
      'x-hs-pzn-drug-inventory':     'true',
      'x-hs-counsel-enabled':        'false',
      'x-hs-pzn-split-version':      'v1',
      'x-channel':                   'mobile',
      'x-device-type':               'Android',
      'user-agent':                  'CVSOnlineAndroid/26.4.30(2604300); (Google; sdk_gphone64_arm64; SDK 36; Android 16)',
      'quantummetricsessionid':      '67074e1fae1f7a3a00481b420680038b',
      'authorization':               config.authToken || '',
      'x-acf-sensor-data':           '6,a,U/8mydYgVFBRncv0/q/hgiyKivu2Jrr3mZxlYVTFsomEM4W3SWP8rtriGIDIOUFxwGPTvI2SAnLiAH34cYW6ZQn1BdlE1p7dDEX5dVy1grA535Js4LILi54N5YMh5kw78faCpIKQxAKUlOgjQnY6E6BMz7FKxuZixZCFQuXeU+Y=,Ry6dF9XPtffUqu3NjkauydB8yXVpQw3bdQ0imA3UcPC56jCotw79DdkJSvEsDjri3Mtklg09Rox2DOMMrmpItSox6XP1J5sD2mfil8tcOQ1ieqtiNSKbQhvOsvwsYuyR/Rzak3RR3ggpWflNRd7gWnsOdsZc7LFtD4kwkzqo3wA=',
      'x-api-key':                   'PRX4fYhAfVTr3UH3tSOTlb9oYNrAPUjA',
      'content-type':                'application/json; charset=utf-8'
    });

    const response = await client.post(
      '/apix/client/experience/v2/load/3ff2c478-f3aa-4e8e-91ee-19d9610b154f?frn=SegmentedHomeMedReminder',
      { data: {} }
    );

    return {
      name: this.name,
      method: this.method,
      url: '/apix/client/experience/v2/load/3ff2c478-f3aa-4e8e-91ee-19d9610b154f?frn=SegmentedHomeMedReminder',
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

  extractData(data) {
    const medReminders = data?.data?.personalizationWidget?.medReminder || [];

    const members = medReminders.map(entry => {
      const patient = entry.patient || {};
      const reminders = (patient.medicationReminders || []).map(mr => ({
        reminderTime: mr.reminderTime || null,
        adherenceInsight: mr.adherenceInsight || null,
        drugs: (mr.reminders || []).map(r => ({
          drugName:      r.drugName      || null,
          drugId:        r.drugId        || null,
          reminderName:  r.reminderName  || null,
          adherenceStatus: r.adherenceStatus || null
        }))
      }));

      return {
        memberType:          entry.memberType          || null,
        patientId:           patient.id                || null,
        firstName:           patient.firstName         || null,
        lastName:            patient.lastName          || null,
        isAnyRx:             patient.isAnyRx           ?? null,
        isAnyReminderMed:    patient.isAnyReminderMed  ?? null,
        isAnyReminderEnabled: patient.isAnyReminderEnabled ?? null,
        medicationReminders: reminders.length ? reminders : null
      };
    });

    return {
      members: members.length ? members : null
    };
  }
};
