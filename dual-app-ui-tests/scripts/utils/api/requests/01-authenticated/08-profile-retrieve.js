/**
 * profile_retrieve
 * POST https://www-qa2.cvs.com/mcapi/client/experience/v2/load/d88a1cb2-cf79-4036-81e2-71621ec444bd?frn=caoad-profile-retrieve
 */

const RequestHelper = require('../../lib/request-helper');

module.exports = {
  name: 'profile_retrieve',
  description: 'Retrieve authenticated user profile',
  method: 'POST',

  async execute(config = {}) {
    const client = new RequestHelper({
      baseURL: config.baseURL || 'https://www-qa2.cvs.com',
      timeout: config.timeout || 30000
    });

    client.setHeaders({
      'x-friendlyname': 'caoad-profile-retrieve',
      'x-clientrefid': '1c9b67ec-8f6e-4388-8587-7f865f31468d',
      'x-clientid': 'cvs_account',
      'x-sourcetype': 'login',
      'x-acf-sensor-data': '6,a,FKM6I/Uhs+cmjWFxRQXUB6dYgZW7bXjXXtdQdhZim3nq5uqPvvk7CrVIJ4iXy3v7qQ4pEsJdRhybf1jGdihnzjlxKGOyCD1zk/ULrhH5oMhOofVpImusWL9Z+kX7oeH3uGmb0g1ex4UqUMTfK0umCd65+VQLOGPqtzVLmLkn8vg=,H5uAKd4KwFJZm2nDWbiu3I2lrjT9GvxDDivNn4Cxs0rHKTACDklz6wTlb9JHHF3kFjDSLkI9ZAibxdHOcIeXSq7xZfypK9q8vPRUeLyrcYgVvGaskXGxRxZxzKyveJhYP3MaN8ruA+tWGepbHo/KOBb4Q/6l2qSOvmdVTL2dIn4=',
      'env': 'QA2',
      'x-experienceid': 'd88a1cb2-cf79-4036-81e2-71621ec444bd',
      'user-agent': 'CVSOnlineAndroid/25.11.30(2511300); (Google; sdk_gphone64_arm64; SDK 35; Android 15)',
      'quantummetricsessionid': 'b617004492f155180fafb5dcb3fb6d03',
      'x-client-fingerprint-id': 'c2ae05e885904ed5b6d2b62472fd1f1f',
      'authorization': config.authToken || '',
      'x-api-key': 'PRX4fYhAfVTr3UH3tSOTlb9oYNrAPUjA',
      'x-d-token': '3:wo6l5z5YOI3XTCntrgWBqw==:vo9fxgorx/86sFvkNxlAWSHnI1QlLdFz5ofPZFqD3FwNkUHafuuYYerCPHD3FnWGv9rKTxHNdEL576aBXObmfnoL0qjUNXjH7eRoJxde5sr8k+is6PaCra3mDQjnFLa5SehL7icotWEFPgU/fcnvOWw4PcqKeUDJGM4HsKC1o1I3ZZzBbenvi9wT5c9x25mTzkbqdsUWsZ9VaTOp77xho2e82GxDNx0pG92nSYx5BEtdCjwgviThmvBZeQZoIrygHg8CEIc0sFY3qfV93Lof3Pfpyjv2av3jRl9eBqDA/X2ZwufgEgY7qj6twcH0QW1mDRkcjD7LoNly4wxn2E1YR3BYttiDmyKx4oTL5dsZNfLUF6MPW5uMIbTm7207C4G+Cu4b4qW6HHSIa9iNfFP1xGi1yjJO35fwe2lgEmwhFxc=:gef0ognobYcz9B+SX5q/5KHDMkjaoO1zWhWzbgXQVmQ=',
      'x-visitor-id': 'c2ae05e885904ed5b6d2b62472fd1f1f',
      'x-route': 'account-gke-rke',
      'x-device-type': 'ANDROID',
      'content-type': 'application/json; charset=utf-8'
    });

    const response = await client.post(
      '/mcapi/client/experience/v2/load/d88a1cb2-cf79-4036-81e2-71621ec444bd?frn=caoad-profile-retrieve',
      {
        data: {
          idType: 'RETAIL_PROFILE_ID_TYPE',
          getAddressByProfileIdIdType2: 'RETAIL_PROFILE_ID_TYPE'
        }
      }
    );

    return {
      name: this.name,
      method: this.method,
      url: '/mcapi/client/experience/v2/load/d88a1cb2-cf79-4036-81e2-71621ec444bd?frn=caoad-profile-retrieve',
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
    const linkedIds = data?.data?.getProfileInfo?.linkedIDs || [];
    const types = [...new Set(linkedIds.map(l => l.idType).filter(Boolean))];
    return types.length ? { linkedIdTypes: types } : {};
  },

  extractData(data) {
    const profile = data?.data?.getProfileInfo || {};
    const phones = profile.phoneNumber || [];
    const ecCard = profile.extraCareDetails || {};
    const linkedIds = profile.linkedIDs || [];
    const idTypes = new Set(linkedIds.map(l => l.idType).filter(Boolean));
    const externalDetails = profile.externalAccountDetails || [];

    const hasMrn = linkedIds.some(l => l.idType === 'RETAIL_MRN_PROFILE_ID_TYPE');
    const hasOakStreet = linkedIds.some(l => l.sourceSystemName === 'OS');

    return {
      profileId: profile.id || null,
      levelOfAssurance: profile.levelOfAssurance || null,
      email: profile.emailAddress || null,
      firstName: profile.firstName || null,
      lastName: profile.lastName || null,
      dateOfBirth: profile.dateOfBirth || null,
      phones: phones.length ? phones : null,
      extraCareCard: Object.keys(ecCard).length ? ecCard : null,
      linkedIds: linkedIds.length ? linkedIds : null,
      featureBadges: {
        loa1:      profile.levelOfAssurance === '1',
        caremark:  idTypes.has('PBM_QL_PARTICIPANT_ID_TYPE') ||
                   idTypes.has('PBM_QL_PART_SSK_ID_TYPE') ||
                   idTypes.has('PBM_SSK_PARTICIPANT_ID_TYPE'),
        aetna:     idTypes.has('AETNA_MEMBER_ID_TYPE') ||
                   idTypes.has('AETNA_IM_PROFILE_ID_TYPE') ||
                   idTypes.has('AETNA_SSK_MEMBER_ID_TYPE'),
        specialty: idTypes.has('SPL_HB_PATIENT_ID_TYPE'),
        rxc:       idTypes.has('RXC_RX_PATIENT_ID_TYPE'),
        counsel:   externalDetails.some(e => e.type === 'counsel'),
        mrn:       hasMrn,
        oakStreet: hasOakStreet
      }
    };
  }
};
