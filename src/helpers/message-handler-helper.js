/*
 *
 *
 * (c) Copyright Merative US L.P. and others 2020-2022 
 *
 * SPDX-Licence-Identifier: Apache 2.0
 *
 */

const log4js = require('log4js');
const { eventStreams: { failureConsumers } } = require('../config');
const config = require('../config');

const log = log4js.getLogger('MessageHandler');
log.level = config.logLevel;

const configFailureConsumers = Object.values(failureConsumers);

/**
 * Get status DB name
 *
 * @param tenantID
 * @returns {`${string}-${string}`}
 */
const getStatusDBName = (tenantID) => `${config.databaseConfig.dbNameConsentStatus}-${tenantID}`;

/**
 * Compare recorded document with new document topics to prevent duplicates.
 *
 * @param existingDocumentTopic
 * @param newDocumentTopic
 * @returns {boolean}
 */
const isDuplicateStatusDoc = (existingDocumentTopic, newDocumentTopic) => {
  // check if existed document topic is in one of failures topics
  const existingFailureTopicDoc = configFailureConsumers
    .find((failureConsumer) => failureConsumer.failureTopicName === existingDocumentTopic);
    // check if topic from data for update is in one of failures topics
  const newFailureTopicDoc = configFailureConsumers
    .find((failureConsumer) => failureConsumer.failureTopicName === newDocumentTopic);

  if (existingFailureTopicDoc) { // record is already in failures queue
    // if data for update is not in failures queue or failures queue id is less than the recorded one then
    // return that this is a duplicate.
    if (!newFailureTopicDoc || (newFailureTopicDoc && newFailureTopicDoc.id < existingFailureTopicDoc.id)) {
      return true;
    }
  }
  return false; // return that this is not duplicate.
};

module.exports = {
  isDuplicateStatusDoc,
  getStatusDBName,
};
