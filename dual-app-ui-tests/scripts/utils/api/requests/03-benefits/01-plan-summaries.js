/**
 * benefits-plan-summaries
 * POST https://www-qa2.cvs.com/apix/client/experience/v2/load/be18095c-7ec6-4fdc-96b8-ca56f8964800?frn=FRNPlanSummaries
 */

'use strict';

const RequestHelper = require('../../lib/request-helper');

module.exports = {
  name: 'benefits-plan-summaries',
  description: 'Get combined plans spending summary (FRNPlanSummaries)',
  method: 'POST',
  allowFailure: true,

  async execute(config = {}) {
    const client = new RequestHelper({
      baseURL: config.baseURL || 'https://www-qa2.cvs.com',
      timeout: config.timeout || 30000
    });

    client.setHeaders({
      'x-spending-family-toggle-enabled': 'false',
      'x-friendlyname':                   'FRNPlanSummaries',
      'x-plans-spending-version':          'v3',
      'x-experienceid':                    'be18095c-7ec6-4fdc-96b8-ca56f8964800',
      'user-agent':                        'CVSOnlineAndroid/26.4.30(2604300); (Google; sdk_gphone64_arm64; SDK 36; Android 16)',
      'quantummetricsessionid':            '8338a62c26de09e4301f592bab2609b4',
      'authorization':                     config.authToken || '',
      'x-channel':                         'mobile',
      'x-device-type':                     'Android',
      'x-api-key':                         'PRX4fYhAfVTr3UH3tSOTlb9oYNrAPUjA',
      'x-route':                           'CVS-OP-BENEFITS-HA',
      'content-type':                      'application/json; charset=utf-8'
    });

    const response = await client.post(
      '/apix/client/experience/v2/load/be18095c-7ec6-4fdc-96b8-ca56f8964800?frn=FRNPlanSummaries',
      {
        data: {
          idType: 'RETAIL_PROFILE_ID_TYPE',
          plansSpendingInput: {
            landingPage: true
          }
        }
      }
    );

    return {
      name:          this.name,
      method:        this.method,
      url:           '/apix/client/experience/v2/load/be18095c-7ec6-4fdc-96b8-ca56f8964800?frn=FRNPlanSummaries',
      statusCode:    response.statusCode,
      statusMessage: response.statusMessage,
      timing:        response.timing,
      success:       response.success,
      data:          response.data,
      error:         response.error,
      request:       response.request
    };
  },

  extractData(data) {
    const plans = data?.data?.combinedPlansSpendingSummaryV2?.data || [];

    const lobs = plans.map(lob => {
      const lobData = (lob.lobData || []).map(entry => {
        const plan = entry.plan || {};
        const accumulators = (entry.groupedAccumulators || []).flatMap(g =>
          (g.accumulators || []).map(acc => ({
            group:           g.groupTitle,
            id:              acc.id,
            label:           acc.displayLabel,
            type:            acc.type,
            planAmount:      acc.planAmount,
            spentAmount:     acc.spentAmount,
            remainingAmount: acc.remainingAmount,
            timePeriod:      acc.timePeriod,
            networkIndicator: acc.networkIndicator,
            member:          acc.member
          }))
        );

        return {
          planId:       plan.id,
          planName:     plan.name || plan.type,
          planType:     plan.type,
          startDate:    plan.startDate,
          endDate:      plan.endDate,
          accumulators
        };
      });

      return {
        lobType:  lob.lobType,
        flags:    lob.flags || null,
        plans:    lobData
      };
    });

    return { lobs };
  }
};
