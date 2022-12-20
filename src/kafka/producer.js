/*
 *
 *
 * (c) Copyright Merative US L.P. and others 2020-2022 
 *
 * SPDX-Licence-Identifier: Apache 2.0
 *
 */

const log4js = require('log4js');
const config = require('../config');
const { REQUEST_HEADERS: { TENANT_ID, TRANSACTION_ID } } = require('../helpers/constants');

const log = log4js.getLogger('Producer');
log.level = config.logLevel;

exports.buildProducer = (kafka) => {
  // producer creation
  const producer = kafka.producer();
  const run = async () => {
    log.info('Producer connecting');
    try {
      await producer.connect();
      log.info('Producer has been connected');
    } catch (err) {
      log.error(`Failed to connection producer: ${err.message}`);
    }
  };

  run();

  return producer;
};

exports.sendToQueue = async (producer, { topicName, handleMessage, headers }) => {
  const txID = headers[TRANSACTION_ID];
  const tenantID = headers[TENANT_ID];

  log.info(`Sending ${txID} to "${topicName}" topic. Message: ${handleMessage.toString()} Metadata: ${JSON.stringify(headers)}.`, { txID, tenantID });
  try {
    // The method send is used to publish messages to the Kafka cluster.
    await producer.send({
      topic: topicName,
      messages: [{
        value: handleMessage,
        headers,
      }],
    });
  } catch (err) {
    log.error(`Failed to sending message: ${err.message}`, { txID, tenantID });
  }
};
