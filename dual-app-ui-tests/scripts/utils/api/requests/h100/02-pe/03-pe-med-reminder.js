/**
 * H100-PE-med-reminder
 * POST https://api.qa2.health100.com/apix/client/experience/v2/load/{{experienceId}}?frn=SegmentedHomeMedReminder
 * H100 variant of PE-med-reminder. Same structure and response shape as CVS PE-med-reminder.
 * Only differences: host, x-experienceid, user-agent, x-app-name.
 */

const RequestHelper = require('../../../lib/request-helper');

const EXPERIENCE_ID = 'd7fad3fb-c3cb-44e7-9a8c-f3242d2a317d';

module.exports = {
  name: 'H100-PE-med-reminder',
  description: 'Get personalized H100 medication reminder actions (SegmentedHomeMedReminder)',
  method: 'POST',
  allowFailure: true,

  async execute(config = {}) {
    const client = new RequestHelper({
      baseURL: config.h100BaseURL || 'https://api.qa2.health100.com',
      timeout: config.timeout || 30000
    });

    client.setHeaders({
      'x-experienceid':              config.peMedReminderExperienceId || EXPERIENCE_ID,
      'x-visitor-id':                config.visitorId || '',
      'x-app-name':                  'H100_APP',
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
      'user-agent':                  'Health100Android/26.3.30(2603300); (Google; sdk_gphone64_arm64; SDK 36; Android 16) HEALTH100_APP',
      'quantummetricsessionid':      'b57726e62667e0cf313510229056fb2c',
      'authorization':               config.authToken || '',
      'x-api-key':                   config.h100ApiKey || 'PRX4fYhAfVTr3UH3tSOTlb9oYNrAPUjA',
      'content-type':                'application/json; charset=utf-8'
    });

    const experienceId = config.peMedReminderExperienceId || EXPERIENCE_ID;
    const path = `/apix/client/experience/v2/load/${experienceId}?frn=SegmentedHomeMedReminder`;

    const response = await client.post(path, { data: {} });

    return {
      name: this.name,
      method: this.method,
      url: path,
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
          drugName:        r.drugName        || null,
          drugId:          r.drugId          || null,
          reminderName:    r.reminderName    || null,
          adherenceStatus: r.adherenceStatus || null
        }))
      }));

      return {
        memberType:           entry.memberType          || null,
        patientId:            patient.id                || null,
        firstName:            patient.firstName         || null,
        lastName:             patient.lastName          || null,
        isAnyRx:              patient.isAnyRx           ?? null,
        isAnyReminderMed:     patient.isAnyReminderMed  ?? null,
        isAnyReminderEnabled: patient.isAnyReminderEnabled ?? null,
        medicationReminders:  reminders.length ? reminders : null
      };
    });

    return {
      members: members.length ? members : null
    };
  }
};
