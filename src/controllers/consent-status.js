/*
 *
 *
 * (c) Copyright Merative US L.P. and others 2020-2022 
 *
 * SPDX-Licence-Identifier: Apache 2.0
 *
 */

const { getConsentStatus } = require('../helpers/consent-status-helper');
const { getStatusDBName } = require('../helpers/message-handler-helper');
const CloudantHelper = require('../helpers/cloudant-helper');
const log = require('../helpers/logger').getLogger('consent-status');

// controller for get consent status from DB <TenantID>_consent_status
exports.getConsentStatus = async (req, res) => {
  log.info('Entering GET /gateway-listener/api/v1/consent-status controller');
  const {
    tenantID, topic, latestTimestamp, txID, status,
  } = req.query;
  if (!tenantID) {
    const errMsg = 'Missing tenantID';
    log.error(errMsg);
    return res.status(400).json({
      msg: errMsg,
      status: 400,
    });
  }

  const db = getStatusDBName(tenantID);
  const cloudantClient = CloudantHelper.getInstance(txID);
  try {
    await cloudantClient.getDatabaseInformation({ db });
    log.info(`Successfully got Cloudant database ${db}`, { tenantID });
  } catch (err) {
    const msg = `Failed to get Cloudant database ${db}: ${err.message}`;
    log.error(msg, { tenantID });
    return res.status(404).json({
      msg,
      status: 404,
    });
  }

  // get consent status
  try {
    const result = await getConsentStatus(tenantID, {
      txID, topic, status, latestTimestamp,
    });
    res.status(result.status).json(result);
  } catch (err) {
    log.error(`Failed to getting consents status from DB ${db}: ${err.message}`, { tenantID });
    const errStatus = err.status || 500;
    return res.status(errStatus).json({
      msg: err.message,
      status: errStatus,
    });
  }

  return res.status(500);
};
