/*
 *
 *
 * (c) Copyright Merative US L.P. and others 2020-2022 
 *
 * SPDX-Licence-Identifier: Apache 2.0
 *
 */

const log4js = require('log4js');
const axios = require('axios');
const https = require('https');
const constants = require('../helpers/constants');
const config = require('../config');

const log = log4js.getLogger('HTTPClient');
log.level = config.logLevel;

const isOmrEndpoint = config.httpClient.isOmrEndpoint === true || false;

let baseUrl; let registerConsentUrl; let loginUrl; let
  healthConsentUrl;
if (isOmrEndpoint) {
  baseUrl = `${config.httpClient.omrApiProtocol}://${config.httpClient.apiHost}:${config.httpClient.omrApiPort}`;
  registerConsentUrl = `${baseUrl}${config.httpClient.omrRegisterConsentEndpoint}`;
  loginUrl = `${baseUrl}${config.httpClient.omrLoginEndpoint}`;
} else {
  baseUrl = `${config.httpClient.simpleApiProtocol}://${config.httpClient.apiHost}:${config.httpClient.simpleApiPort}`;
  registerConsentUrl = `${baseUrl}${config.httpClient.simpleRegisterConsentEndpoint}`;
  healthConsentUrl = `${baseUrl}${config.httpClient.healthConsentEndpoint}`;
}

const { authUser } = config.httpClient;
const { authPassword } = config.httpClient;
const { authLoginOrg } = config.httpClient;
const { authLoginChannel } = config.httpClient;

const setAxiosOptions = (options) => {
  const httpsAgent = new https.Agent({
    rejectUnauthorized: false,
  });
  return { httpsAgent, ...options };
};

const transformToRegisterConsent = (data) => {
  const consents = data.DatatypeIDs.map((datatypeID) => ({
    datatype_id: datatypeID,
    target_id: data.ServiceID,
    option: data.ConsentOption,
    expirationTimestamp: data.Expiration,
  }));
  return {
    id: data.PatientID,
    secret: config.defaults.registerConsent.secret,
    name: config.defaults.registerConsent.name,
    email: config.defaults.registerConsent.email,
    ca_org: config.httpClient.authLoginOrg,
    data: {},
    service_id: data.ServiceID,
    consents,
  };
};

const getLoginToken = async (url, { txID, tenantID }) => {
  log.debug(`Send GET request to RegisterConsent service. URL: ${url}`, { txID, tenantID });

  try {
    const response = await axios.get(url, {
      headers: {
        accept: 'application/json',
        'Content-Type': 'application/json',
        'user-id': authUser,
        password: authPassword,
        'login-org': authLoginOrg,
        'login-channel': authLoginChannel,
      },
    });
    if (!response.data || !response.data.token) {
      throw new Error('Http authentication is failed. The response does not contain the login token.', {
        txID,
        tenantID,
      });
    }
    return response.data.token;
  } catch (err) {
    log.error(`Failed to getting token from ${url}`, { txID, tenantID });
    throw err;
  }
};

const handleOmrRegisterConsent = (token, data, { txID, tenantID }) => {
  try {
    log.debug(`Send post request to OmrRegisterConsent service. URL: ${registerConsentUrl}`, { txID, tenantID });
    return axios.post(registerConsentUrl, data, {
      headers: {
        accept: 'application/json',
        'Content-Type': 'application/json',
        token,
      },
    });
  } catch (err) {
    log.error(`Failed to request to OmrRegisterConsent service. URL: ${registerConsentUrl}`, { txID, tenantID });
    throw err;
  }
};

const handleSimpleRegisterConsent = (data, { txID, tenantID }) => {
  log.debug(`Send post request to SimpleConsent service. URL: ${registerConsentUrl}`, { txID, tenantID });
  try {
    const axiosOptions = setAxiosOptions({
      headers: {
        [constants.REQUEST_HEADERS.TRANSACTION_ID]: txID,
      },
    });
    return axios.post(registerConsentUrl, data, axiosOptions);
  } catch (err) {
    log.error(`Failed to call Simple Consent service. URL: ${registerConsentUrl}`, { txID, tenantID });
    throw err;
  }
};

module.exports = {
  async checkConsentEndpoint() {
    try {
      log.debug(`Sending HTTP(S) request to ${healthConsentUrl}`);
      const axiosOptions = setAxiosOptions();
      await axios.get(healthConsentUrl, axiosOptions);
      log.info('Http service health is OK');
      return true;
    } catch (err) {
      const errResponseMsg = err.response ? err.response.data.msg : err.message;
      log.error(`Http service health is not OK: ${errResponseMsg}`);
      return false;
    }
  },

  async sendRegisterConsent(consentData, { txID, tenantID }) {
    try {
      if (isOmrEndpoint) {
        const data = transformToRegisterConsent(consentData);
        const token = await getLoginToken(loginUrl, { txID, tenantID });
        return await handleOmrRegisterConsent(token, data, { txID, tenantID });
      }
      return await handleSimpleRegisterConsent(consentData, { txID, tenantID });
    } catch (err) {
      if (err.response && err.response.status === constants.HTTP_STATUS.ERROR_CONFLICT) {
        log.warn(`Consent ${txID} already exists`, { txID, tenantID });
        return err.response;
      }
      log.error('Failed to register consent', { txID, tenantID });
      throw err;
    }
  },
};
