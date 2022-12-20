/*
 *
 *
 * (c) Copyright Merative US L.P. and others 2020-2022 
 *
 * SPDX-Licence-Identifier: Apache 2.0
 *
 */

const config = require('../config');
const { getOutProducer } = require('../service/messageHandler');
const {
  getFailedConsents,
  prepareResubmitFailedConsents,
  deleteFailedConsents,
} = require('../helpers/failed-consent-helper');
const log = require('../helpers/logger').getLogger('failed-consents');

const queryConsents = async (req, res) => {
  const { tenantID, txID } = req.query;
  if (!tenantID) {
    const errMsg = 'Missing tenantID';
    log.error(errMsg);
    return res.status(400).json({
      message: errMsg,
      status: 400,
    });
  }

  const latestTimestamp = !txID && req.query.latestTimestamp
    ? parseInt(req.query.latestTimestamp, 10)
    : false; // optional

  // get failed consents
  return getFailedConsents(tenantID, { txID, latestTimestamp });
};

// controller for get failed consents from DB failure-<TenantID>
exports.getFailedConsents = async (req, res) => {
  log.info('Entering GET /gateway-listener/api/v1/failed-consents controller');
  // get failed consents
  const result = await queryConsents(req, res);

  res.status(result.status).json(result);
};

// controller for resubmit messages in the failure DB back to the Kafka input topic
exports.resubmitFailedConsents = async (req, res) => {
  log.info('Entering POST /gateway-listener/api/v1/failed-consents controller');
  // get failed consents from CloudantDB for resubmit
  const failedConsents = await queryConsents(req, res);

  if (failedConsents.status !== 200) {
    return res.status(failedConsents.status).json({
      status: failedConsents.status,
      message: `Error retrieving failed consent messages from Cloudant: ${failedConsents.message}`,
    });
  }

  // Preparing failed consents for send to topic
  const resubmitFailedConsents = prepareResubmitFailedConsents(req.query.tenantID, failedConsents.result);
  const inputTopicName = `${config.eventStreams.inputTopicName}-${req.query.tenantID}`;

  // connection to kafka-producer
  try {
    const producer = getOutProducer();
    await producer.send({
      topic: inputTopicName,
      messages: resubmitFailedConsents,
    });

    // Deleting failed consent documents from Cloudant before resubmitting them to Kafka topic
    await deleteFailedConsents(req.query.tenantID, failedConsents.result);

    log.info(`Sending failed consent messages back to Kafka topic "${inputTopicName}"`);
  } catch (e) {
    log.error(`Error sending failed consent messages back to Kafka topic "${inputTopicName}": ${e}`);
    return res.status(500).json({
      status: 500,
      message: `Internal server error: error sending failed consent messages back to Kafka topic "${inputTopicName}: ${e}"`,
    });
  }

  const result = {
    status: 200,
    resubmitFailedConsents: resubmitFailedConsents.map((consent) => consent.headers),
  };

  return res.status(result.status).json(result);
};
