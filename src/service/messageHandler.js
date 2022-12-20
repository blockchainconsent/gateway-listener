/*
 *
 *
 * (c) Copyright Merative US L.P. and others 2020-2022 
 *
 * SPDX-Licence-Identifier: Apache 2.0
 *
 */
const log4js = require('log4js');
const { gatewayListenerIndexes } = require('hcls-common');
const config = require('../config');
const { buildConsumer, buildConcurrentConsumer } = require('../kafka/consumer');
const { buildProducer, sendToQueue } = require('../kafka/producer');
const { buildAdmin, getOrCreateTopics } = require('../kafka/admin');
const { buildKafka } = require('../kafka/kafkaClient');
const httpClient = require('../httpClient');
const {
  REQUEST_HEADERS: { TENANT_ID, TRANSACTION_ID },
  CONSENT_STATUSES: {
    SUBMITTED, RETRYING, SUCCEEDED, FAILED, RESUBMIT,
  },
  HTTP_STATUS,
} = require('../helpers/constants');
const CloudantHelper = require('../helpers/cloudant-helper');
const { getStatusDBName } = require('../helpers/message-handler-helper');
const { getTenantIDs } = require('../helpers/keyprotect-helper');

const log = log4js.getLogger('MessageHandler');
log.level = config.logLevel;

const { inputTopicName } = config.eventStreams;
const configFailureConsumers = Object.values(config.eventStreams.failureConsumers);
const firstConfigFailureConsumer = configFailureConsumers[0];
const devMode = process.env.DEV_MODE !== 'false';
const inputConsumers = []; const failureConsumers = []; let
  outputProducer;

/**
 * Set delay
 *
 * @param {number} ms
 * @returns {Promise<unknown>}
 */
const retryTimeout = async (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const sendToRetryTopic = async ({
  message, nextFailureTopicName, failureReasons, delay,
}) => {
  const txID = message.headers[TRANSACTION_ID].toString();
  const tenantID = message.headers[TENANT_ID].toString();
  const retriesTopic = message.headers.numRetriesTopic
    ? parseInt(message.headers.numRetriesTopic.toString(), 10)
    : 0;
  const timestamp = message.headers.retryTimestamp
    ? parseInt(message.headers.retryTimestamp.toString(), 10)
    : parseInt(message.timestamp, 10);

  const numRetriesTopic = (retriesTopic + 1).toString();
  const headers = {
    [TRANSACTION_ID]: txID,
    [TENANT_ID]: tenantID,
    retryTimestamp: (timestamp + delay).toString(),
    numRetriesTopic,
    failureReasons: JSON.stringify(failureReasons),
  };
  log.info(`Sending failed request to the ${nextFailureTopicName} topic, txID=${txID}, tenantID=${tenantID}`, { txID, tenantID });
  await sendToQueue(outputProducer, {
    topicName: nextFailureTopicName,
    handleMessage: message.value,
    headers,
  });

  let db;
  let cloudantClient;
  if (devMode) {
    db = getStatusDBName(tenantID);
    cloudantClient = CloudantHelper.getInstance(txID);
    try {
      /**
             * Document example
             *
             * @param {string} txID - unique identifier of the request
             * @param {string} topic - message's current topic
             * @param {string} status - message's current status
             * @param {array} failureReasons - array of all retry reasons
             * @param {number} delay - duration of delay corresponding to the message's failure topic
             * @param {number} numRetriesTotal - message's total number of retries
             * @param {number} latestTimestamp - timestamp of the most recent status update
             */
      await cloudantClient.updateDocument(db, {
        txID,
        topic: nextFailureTopicName,
        status: RETRYING,
        delay,
        failureReasons,
        latestTimestamp: Date.now(),
        numRetriesTotal: numRetriesTopic,
      }, { txID, tenantID });
    } catch (e) {
      log.error(`Cloudant update request failed: ${e.message}`, { txID, tenantID });
    }
  }
};

/**
 * Process message from main topic
 *
 * @param {string} topic
 * @param {number} partition
 * @param {array} messages
 * @param {function} heartbeat
 * @param {function} resolveOffset
 * @returns {Promise<void>}
 */
const handleInputMessages = async ({
  topic, partition, messages, heartbeat, resolveOffset, isRunning, isStale,
}) => {
  const batchConsents = [];
  let db;
  let cloudantClient;

  // eslint-disable-next-line no-restricted-syntax
  for (const message of messages) {
    if (!isRunning() || isStale()) break;
    const txID = message.headers[TRANSACTION_ID].toString();
    const tenantID = message.headers[TENANT_ID].toString();
    const consentData = message.value.toString();

    log.info(`Received message from input topic: ${topic} [${partition} | ${message.offset}]; timestamp=${message.timestamp}, txID=${txID}, tenantID=${tenantID}`, { txID, tenantID });

    if (devMode) {
      db = getStatusDBName(tenantID);
      cloudantClient = CloudantHelper.getInstance(txID);
      try {
        // eslint-disable-next-line no-await-in-loop
        await cloudantClient.getOrCreateDB(db, gatewayListenerIndexes, { txID, tenantID });
      } catch (e) {
        log.error(`Failed to get or create cloudant database ${db}: ${e.message}`, { txID, tenantID });
      }

      const data = {
        txID, topic, status: SUBMITTED, latestTimestamp: Date.now(),
      };
      try {
        // eslint-disable-next-line no-await-in-loop
        await cloudantClient.createDocument(db, data, { txID, tenantID });
      } catch (e) {
        log.error(`Failed to get or create Cloudant document: ${e.message}`, { txID, tenantID });

        if (e.status === HTTP_STATUS.ERROR_CONFLICT) {
          // eslint-disable-next-line no-await-in-loop
          await cloudantClient.updateDocument(db, {
            txID,
            topic,
            status: RESUBMIT,
            latestTimestamp: Date.now(),
          }, { txID, tenantID });
        }
      }
    }

    // prepare consents batch for simple consent
    batchConsents.push([message, JSON.parse(consentData), { txID, tenantID }]);
  }

  // warn if we lose consents
  if (messages.length !== batchConsents.length) {
    log.warn(`Only ${batchConsents.length} of ${messages.length} messages in the batch will be processed.`);
  }

  const promises = batchConsents.map(async (consent) => {
    const [message, ...args] = consent;
    const [, { txID, tenantID }] = args;

    try {
      // register consent via simple consent
      await httpClient.sendRegisterConsent(...args);
      log.info(`Register Consent request succeeded, txID=${txID}, tenantID=${tenantID}, topic=${topic}`, { txID, tenantID });

      if (devMode) {
        try {
          await cloudantClient.updateDocument(db, {
            txID, topic, status: SUCCEEDED, latestTimestamp: Date.now(),
          }, { txID, tenantID });
        } catch (e) {
          log.error(`Cloudant update request failed: ${e.message}`, { txID, tenantID });
        }
      }
    } catch (err) {
      const errMsg = (err.response && err.response.data && err.response.data.msg) || err.message;
      const { failureTopicName, delay } = firstConfigFailureConsumer;
      const failureReasons = [errMsg];

      log.error(`Register Consent request failed: ${errMsg}, txID=${txID}, tenantID=${tenantID}, topic=${topic}`, { txID, tenantID });
      await sendToRetryTopic({
        message,
        nextFailureTopicName: `${failureTopicName}-${tenantID}`,
        failureReasons,
        delay,
      });
    }
  });

  // send heartbeat to the broker every 5 sec
  const timerHeartbeat = setInterval(async () => {
    await heartbeat();
  }, 5000);

  try {
    // register consents in parallel
    await Promise.allSettled(promises);
  } catch (err) {
    // warn if promises fail, TODO: error handling
    log.warn(`Failed to send batch to Simple Consent: ${topic} [${partition}]`);
  }

  // mark the last message as ready for commit
  const lastMessage = messages[messages.length - 1];
  await resolveOffset(lastMessage.offset);

  clearTimeout(timerHeartbeat);

  log.info(`Finished processing consent batch: ${topic} [${partition}]`);
};

/**
 * Process message from failed topic
 *
 * @param {string} topic
 * @param {number} partition
 * @param {object} message
 * @param {function} heartbeat
 * @returns {Promise<{_rev: *, _id: *}>|undefined}
 */
const handleFailureMessage = async ({
  topic, partition, message, heartbeat,
}) => {
  const txID = message.headers[TRANSACTION_ID].toString();
  const tenantID = message.headers[TENANT_ID].toString();

  const consentData = message.value.toString();
  const retryTimestamp = parseInt(message.headers.retryTimestamp.toString(), 10);
  const retriesTopic = parseInt(message.headers.numRetriesTopic.toString(), 10);
  const currentFailureConsumer = configFailureConsumers
    .find((failureConsumer) => `${failureConsumer.failureTopicName}-${tenantID}` === topic);

  const db = getStatusDBName(tenantID);
  const cloudantClient = CloudantHelper.getInstance(txID);

  log.info(`Received message from failure topic: ${topic} [${partition} | ${message.offset}]; timestamp=${message.timestamp}, txID=${txID}, tenantID=${tenantID}`, { txID, tenantID });

  try {
    const difference = retryTimestamp - Date.now();
    if (difference && difference > 0) {
      const heartbeatInterval = 3000; // must be lower, usually by a third, than the session timeout interval
      const numTimeouts = difference / heartbeatInterval;

      // delay before retrying, while sending periodic heartbeats to avoid Kafka rebalancing
      for (let i = 0; i < numTimeouts; i += 1) {
        // eslint-disable-next-line no-await-in-loop
        await heartbeat();
        // eslint-disable-next-line no-await-in-loop
        await retryTimeout(heartbeatInterval);
      }
    }

    // register consent
    await httpClient.sendRegisterConsent(JSON.parse(consentData), { txID, tenantID });
    log.info(`Register Consent request succeeded, txID=${txID}, tenantID=${tenantID}, topic=${topic}`, { txID, tenantID });

    if (devMode) {
      try {
        await cloudantClient.updateDocument(db, {
          txID, topic, status: SUCCEEDED, latestTimestamp: Date.now(),
        }, { txID, tenantID });
      } catch (e) {
        log.error(`Cloudant update request failed: ${e.message}`, { txID, tenantID });
      }
    }
  } catch (e) {
    const errMsg = (e.response && e.response.data && e.response.data.msg) || e.message;
    log.error(`Register Consent request failed: ${errMsg}, txID=${txID}, tenantID=${tenantID}, topic=${topic}`, { txID, tenantID });

    const nextFailureTopicName = configFailureConsumers[currentFailureConsumer.id]
      ? `${configFailureConsumers[currentFailureConsumer.id].failureTopicName}-${tenantID}`
      : false;

    const arrayOfFailureReasons = JSON.parse(message.headers.failureReasons.toString());
    const failureReasons = Array.isArray(arrayOfFailureReasons)
      ? [errMsg, ...arrayOfFailureReasons]
      : [errMsg];

    if (!nextFailureTopicName) {
      log.fatal(`Consent retried ${retriesTopic} times for following reasons: ${failureReasons}, TxID=${txID}, TenantID=${tenantID}`, { txID, tenantID });

      if (devMode) {
        try {
          await cloudantClient.updateDocument(db, {
            txID,
            topic,
            status: FAILED,
            delay: currentFailureConsumer.delay,
            failureReasons,
            numRetriesTotal: `${retriesTopic}`,
            latestTimestamp: Date.now(),
          }, { txID, tenantID });
        // eslint-disable-next-line no-shadow
        } catch (e) {
          log.error(`Cloudant update request failed: ${e.message}`, { txID, tenantID });
        }
      }

      // Save a failure consent by txID to DB failure-<TenantID>
      const dbNameFailures = `${config.databaseConfig.dbNameFailures}-${tenantID}`;
      await cloudantClient.getOrCreateDB(dbNameFailures, gatewayListenerIndexes, { txID, tenantID });
      return cloudantClient.createDocument(dbNameFailures, {
        payload: consentData,
        topic,
        failureReasons,
        numRetriesTotal: `${retriesTopic}`,
        latestTimestamp: retryTimestamp,
      }, { txID, tenantID });
    }

    const { delay } = configFailureConsumers[currentFailureConsumer.id];
    await sendToRetryTopic({
      message,
      nextFailureTopicName,
      failureReasons,
      delay,
    });
  }

  return null;
};

/**
 * Setups client, consumers and producer.
 */
exports.start = async () => {
  const kafka = buildKafka();
  const admin = await buildAdmin(kafka);

  // takes TenantIDs from KeyProtect
  const tenantIDs = await getTenantIDs();

  for (let index = 0; index < tenantIDs.length; index += 1) {
    const tenantID = tenantIDs[index];
    // eslint-disable-next-line no-await-in-loop
    await getOrCreateTopics(admin, tenantID);
    // All topic should fetch after adding the current topics
    // eslint-disable-next-line no-await-in-loop
    const allTopics = await admin.listTopics();
    const inputTopicNameWithTenantID = allTopics.find((topic) => topic.includes(`${inputTopicName}-${tenantID}`));
    const inputGroupIdWithTenantID = `${config.eventStreams.inputGroupId}-${tenantID}`;
    inputConsumers[index] = buildConcurrentConsumer(
      kafka,
      inputTopicNameWithTenantID,
      inputGroupIdWithTenantID,
      handleInputMessages,
    );
    failureConsumers[index] = configFailureConsumers.map((failureConsumer) => {
      const { failureGroupId, failureTopicName } = failureConsumer;
      const failureTopicNameWithTenantID = allTopics.find((topic) => topic.includes(`${failureTopicName}-${tenantID}`));
      return buildConsumer(kafka, failureTopicNameWithTenantID, `${failureGroupId}-${tenantID}`, handleFailureMessage);
    });
  }

  outputProducer = buildProducer(kafka);
};

/**
 * Disconnecting from consumers and producer.
 */
exports.shutdown = async () => {
  // takes TenantIDs from KeyProtect
  const tenantIDs = await getTenantIDs();

  for (let index = 0; index < tenantIDs.length; index += 1) {
    if (inputConsumers[index]) {
      log.info('Disconnecting Input Consumer...');
      // eslint-disable-next-line no-await-in-loop
      await inputConsumers[index].disconnect();
    }

    // eslint-disable-next-line no-restricted-syntax
    for (const itemFailureConsumer of failureConsumers[index]) {
      if (itemFailureConsumer) {
        log.debug('Disconnecting Failure Consumer...');
        // eslint-disable-next-line no-await-in-loop
        await itemFailureConsumer.disconnect();
      }
    }
  }

  if (outputProducer) {
    log.info('Disconnecting Output Producer...');
    await outputProducer.disconnect();
  }
};

exports.getOutProducer = () => outputProducer;
