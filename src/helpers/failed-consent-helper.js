/*
 *
 *
 * (c) Copyright Merative US L.P. and others 2020-2022 
 *
 * SPDX-Licence-Identifier: Apache 2.0
 *
 */

const config = require('../config');
const CloudantHelper = require('./cloudant-helper');
const constants = require('./constants');
const log = require('./logger').getLogger('failed-consent-helper');

exports.getFailedConsents = (tenantID, { txID, latestTimestamp }) => {
  // prepare query for CloudantDB (with the ability to use optional params)
  const dbName = `${config.databaseConfig.dbNameFailures}-${tenantID}`;
  const txIDForSelector = txID
    ? { _id: { $eq: `${config.databaseConfig.dbPartitionKey}:${txID}` } }
    : { _id: { $gt: '0' } };
  const selector = latestTimestamp
    ? { latestTimestamp: { $lte: latestTimestamp } }
    : txIDForSelector;
  const sort = [{ latestTimestamp: 'desc' }];

  // get failed-consents from CloudantDB by query;
  try {
    const cloudantClient = CloudantHelper.getInstance(txID);
    return cloudantClient.findByQuery(dbName, selector, sort, { txID, tenantID });
  } catch (err) {
    log.error(`Failed to getting failed consents from DB ${dbName}: ${err.message}`, { tenantID });
    return {
      status: 500,
      message: err.message,
    };
  }
};

exports.prepareResubmitFailedConsents = (tenantID, consents) => {
  log.debug('Preparing failed consents for send to topic', { tenantID });

  const resubmitFailedConsents = [];

  // prepare failed consent messages back to Kafka topic
  try {
    consents.forEach((consent) => {
      // eslint-disable-next-line no-underscore-dangle
      const txID = consent._id.replace(`${config.databaseConfig.dbPartitionKey}:`, '');
      resubmitFailedConsents.push({
        value: consent.payload,
        headers: {
          [constants.REQUEST_HEADERS.TENANT_ID]: tenantID,
          [constants.REQUEST_HEADERS.TRANSACTION_ID]: txID,
          numRetriesTopic: `${parseInt(consent.numRetriesTotal, 10) + 1}`,
        },
      });
    });

    return resubmitFailedConsents;
  } catch (err) {
    log.error(`Failed to preparing failed consent messages: ${err.message}`, { tenantID });
  }

  return resubmitFailedConsents;
};

// Deleting failed consent messages from DB
exports.deleteFailedConsents = async (tenantID, consents) => {
  const dbName = `${config.databaseConfig.dbNameFailures}-${tenantID}`;
  log.debug(`Deleting failed consent messages from DB ${dbName}`, { tenantID });

  try {
    const cloudantClient = CloudantHelper.getInstance();
    for (const consent of consents) {
      // eslint-disable-next-line no-underscore-dangle
      const txID = consent._id.replace(`${config.databaseConfig.dbPartitionKey}:`, '');
      // eslint-disable-next-line no-underscore-dangle
      await cloudantClient.deleteDocument(dbName, consent._rev, { txID, tenantID });
    }
  } catch (err) {
    log.error(`Failed to deleting failed consent messages: ${err.message}`, { tenantID });
  }
};
