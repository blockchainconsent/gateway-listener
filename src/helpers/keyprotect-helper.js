/*
 *
 *
 * (c) Copyright Merative US L.P. and others 2020-2022 
 *
 * SPDX-Licence-Identifier: Apache 2.0
 *
 */

const { helperKeyProtect } = require('hcls-common');
const log = require('./logger').getLogger('keyprotect-helper');

const config = require('../config/config.json');
const { TENANT_ID_KEY_PREFIX } = require('./constants');

const url = process.env.KEYPROTECT_URL;
const instanceID = process.env.KEYPROTECT_GUID;
const apikey = process.env.KEYPROTECT_SERVICE_API_KEY;

const setKeyProtect = () => {
  const keyProtectDataObj = {
    url,
    instanceID,
    apikey,
    retries: config.keyProtect.retries,
    retryDelay: config.keyProtect.retryDelay,
    timeout: config.keyProtect.timeout,
  };

  helperKeyProtect.setConfig(keyProtectDataObj);
};

const getTenantIDs = async () => {
  try {
    setKeyProtect(); // configures KeyProtect from common lib
    const TenantIDTemplate = TENANT_ID_KEY_PREFIX; // in order not to make hardcoded values

    const tenantData = await helperKeyProtect.getAllKeys();

    // gets only tenantIDs in array
    const tenantIDs = tenantData
      .filter(({ name }) => name.includes(TenantIDTemplate))
      .map(({ name }) => name.slice(TenantIDTemplate.length));

    if (!tenantIDs || !tenantIDs.length) {
      log.error('No TenantIDs are onboarded');
      throw new Error('No TenantIDs are onboarded');
    }

    log.info('TenantIDs were successfully retrieved from KeyProtect');
    return tenantIDs;
  } catch (error) {
    const errMsg = `Failed to get TenantIDs from KeyProtect: ${error}`;
    log.error(errMsg);
    throw new Error(errMsg);
  }
};

module.exports = {
  getTenantIDs,
};
