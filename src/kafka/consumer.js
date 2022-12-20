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

const log = log4js.getLogger('Consumer');
log.level = config.logLevel;

const { maxBytesPerPartitionForConsumer, sessionTimeoutForConsumer } = config.eventStreams;

exports.buildConcurrentConsumer = (kafka, topicName, groupId, handleMessages) => {
  // Consumer creation
  const consumer = kafka.consumer({
    groupId,
    // the maximum amount of data per-partition the server will return
    maxBytesPerPartition: maxBytesPerPartitionForConsumer,
    // timeout in milliseconds used to detect failures.
    sessionTimeout: sessionTimeoutForConsumer,
  });
  const run = async () => {
    log.info(`Starting consumer for "${topicName}" topic`);
    await consumer.connect();

    // subscribe and start from the beginning of the topic
    await consumer.subscribe({ topic: topicName, fromBeginning: true });

    await consumer.run({
      eachBatchAutoResolve: true,
      // consumer configuration based on the number of topic partitions
      partitionsConsumedConcurrently: config.eventStreams.numPartitionsForInputTopic,
      // feed batches and provide some utility functions to give more flexibility
      eachBatch: async ({
        batch,
        resolveOffset,
        heartbeat,
        isRunning,
        isStale,
      }) => {
        await handleMessages({
          topic: batch.topic,
          partition: batch.partition,
          messages: batch.messages,
          heartbeat,
          resolveOffset,
          isRunning,
          isStale,
        });
      },
    });
  };

  run();

  return consumer;
};

exports.buildConsumer = (kafka, topicName, groupId, handleMessage) => {
  // Consumer creation
  const consumer = kafka.consumer({
    groupId,
    // the maximum amount of data per-partition the server will return
    maxBytesPerPartition: maxBytesPerPartitionForConsumer,
    // timeout in milliseconds used to detect failures.
    sessionTimeout: sessionTimeoutForConsumer,
  });
  const run = async () => {
    log.info(`Starting consumer for "${topicName}" topic`);
    await consumer.connect();

    // subscribe and start from the beginning of the topic
    await consumer.subscribe({ topic: topicName, fromBeginning: true });

    await consumer.run({
      eachBatchAutoResolve: true,
      // consumer configuration based on the number of topic partitions
      partitionsConsumedConcurrently: 1,
      // feed batches and provide some utility functions to give more flexibility
      eachBatch: async ({
        batch,
        resolveOffset,
        heartbeat,
        isRunning,
        isStale,
      }) => {
        // feeding one message at a time
        for (const message of batch.messages) {
          if (!isRunning() || isStale()) break;
          await handleMessage({
            topic: batch.topic,
            partition: batch.partition,
            message,
            heartbeat,
          });

          // mark message as ready for commit
          resolveOffset(message.offset);
          await heartbeat();
        }
      },
    });
  };

  run();

  return consumer;
};
