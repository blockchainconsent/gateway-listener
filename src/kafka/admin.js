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

const log = log4js.getLogger('admin');
log.level = config.logLevel;

// generate the retry topics for new TenantID
const getRetryTopicsConfig = (tenantID) => Object.values(config.eventStreams.failureConsumers)
  .map((itemRetryTopic) => ({
    topic: `${itemRetryTopic.failureTopicName}-${tenantID}`,
    numPartitions: 1,
    replicationFactor: 3,
  }));

// create the input-topic and the retry topics for new TenantID
const createTopicsByTenantID = async (admin, topics) => {
  try {
    await admin.createTopics({ topics });
    const topicsName = topics.map((itemTopic) => itemTopic.topic);
    log.info(`Topics ${JSON.stringify(topicsName)} were created successfully`);
  } catch (e) {
    log.error(`Failed to create topics: ${e}`);
    throw e;
  }
};

// The administrative client for Kafka, which supports managing and inspecting topics
exports.buildAdmin = async (kafka) => {
  // admin creation
  const admin = kafka.admin();
  const run = async () => {
    log.info('Admin connecting');
    try {
      await admin.connect();
      log.info('Admin has been connected');
    } catch (err) {
      log.error(`Failed to connection admin: ${err.message}`);
    }
  };

  await run();

  return admin;
};

exports.getOrCreateTopics = async (admin, tenantID) => {
  // The topics will be created if they're not exist
  try {
    const existTopics = await admin.listTopics();
    const retryTopics = getRetryTopicsConfig(tenantID);
    const inputTopic = {
      topic: `${config.eventStreams.inputTopicName}-${tenantID}`,
      numPartitions: config.eventStreams.numPartitionsForInputTopic,
      replicationFactor: 3,
    };
    const healthTopic = {
      topic: config.eventStreams.healthTopicName,
      numPartitions: 1,
      replicationFactor: 3,
    };
    const topics = [healthTopic, inputTopic, ...retryTopics];
    const topicsName = topics.map((itemTopic) => itemTopic.topic);
    const notExistTopics = topics.filter(({ topic }) => !existTopics.some((existTopic) => existTopic.includes(topic)));
    if (notExistTopics.length) {
      await createTopicsByTenantID(admin, notExistTopics);
      return true;
    }
    log.info(`Successfully got topics "${JSON.stringify(topicsName)}"`);
    return true;
  } catch (e) {
    log.error(e);
    throw e;
  }
};
