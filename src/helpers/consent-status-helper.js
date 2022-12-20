/*
 *
 *
 * (c) Copyright Merative US L.P. and others 2020-2022 
 *
 * SPDX-Licence-Identifier: Apache 2.0
 *
 */

const { CONSENT_STATUSES } = require('./constants');
const CloudantHelper = require('./cloudant-helper');
const { getStatusDBName } = require('./message-handler-helper');
const log = require('./logger').getLogger('consent-status-helper');

exports.getConsentStatus = async (tenantID, {
  txID, topic, status, latestTimestamp,
}) => {
  log.info('Preparing for query consents status', { txID, tenantID });

  const db = getStatusDBName(tenantID);
  // get consent-status from CloudantDB by query;
  const cloudantClient = CloudantHelper.getInstance(txID);
  if (txID) {
    return cloudantClient.findById(db, { txID, tenantID });
  }

  const selector = {};
  if (topic) {
    selector.topic = { $eq: topic };
  }
  selector.status = { $eq: status || CONSENT_STATUSES.RETRYING };
  if (latestTimestamp) {
    selector.latestTimestamp = { $gte: +latestTimestamp };
  } else {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    today.setDate(today.getDate() - 1);
    selector.latestTimestamp = { $gte: today.getTime() };
  }
  const sort = [{ latestTimestamp: 'desc' }];

  return cloudantClient.findByQuery(db, selector, sort, { txID, tenantID });
};
