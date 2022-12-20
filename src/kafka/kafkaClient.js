/*
 *
 *
 * (c) Copyright Merative US L.P. and others 2020-2022 
 *
 * SPDX-Licence-Identifier: Apache 2.0
 *
 */

const tls = require('tls');
const { Kafka, logLevel } = require('kafkajs');
const { levels } = require('log4js');
const config = require('../config');
const constants = require('../helpers/constants');
const logger = require('../helpers/logger').getLogger('KafkaJS');

const toLog4jsLogLevel = (level) => {
  switch (level) {
    case logLevel.ERROR:
    case logLevel.NOTHING:
      return levels.ERROR;
    case logLevel.WARN:
      return levels.WARN;
    case logLevel.INFO:
      return levels.INFO;
    case logLevel.DEBUG:
      return levels.DEBUG;
    default:
      return levels.ALL;
  }
};

/**
 * Setup logger configuration.
 */
const log4jsCreator = () => {
  logger.level = config.logLevel;

  return ({ level, log }) => {
    const { message, ...extra } = log;
    logger.log(toLog4jsLogLevel(level), message, extra);
  };
};

/**
 * Setup client configuration.
 */

const isKafkaProxyEnabled = config.eventStreams.proxyEnabled;
const brokersObj = {};

const customSocketFactory = ({
  host, port, ssl, onConnect,
}) => {
  let targetPort;
  const socket = isKafkaProxyEnabled
    ? (targetPort = brokersObj.brokersMap.get(`${host}:${port}`),
    tls.connect({
      host: config.eventStreams.proxyHost, port: targetPort, servername: host, ...ssl,
    }, onConnect))
    : tls.connect({
      host, port, servername: host, ...ssl,
    }, onConnect);

  socket.setKeepAlive(true, config.eventStreams.keepAliveDelay); // in ms
  return socket;
};

const buildKafka = () => {
  brokersObj.brokers = config.eventStreams.brokers.split(',');
  if (isKafkaProxyEnabled) {
    const BROKERS_PROXY_PORTS = config.eventStreams.proxyBrokersPorts.split(',');
    brokersObj.brokersMap = new Map();
    brokersObj.brokers.forEach((broker, index) => brokersObj.brokersMap.set(broker, BROKERS_PROXY_PORTS[index]));
  }
  const settings = {
    clientId: config.eventStreams.clientId,
    brokers: brokersObj.brokers,
    ssl: true,
    sasl: {
      mechanism: config.eventStreams.sasl.mechanisms,
      username: config.eventStreams.sasl.username,
      password: config.eventStreams.sasl.password,
    },
    retry: {
      initialRetryTime: config.eventStreams.retry.initialRetryTime,
      retries: config.eventStreams.retry.retries,
    },
    socketFactory: customSocketFactory,
    connectionTimeout: config.eventStreams.proxyConnectionTimeout,
  };

  return new Kafka({
    logCreator: log4jsCreator,
    ...settings,
  });
};

const sendHealthCheck = async () => {
  const { healthTopicName } = config.eventStreams;
  const currentTime = new Date().toISOString();
  const message = 'Health check!';
  const kafka = buildKafka();
  const producer = kafka.producer();
  await producer.connect();

  try {
    await producer.send({
      topic: healthTopicName,
      messages: [{
        value: message,
        headers: {
          [constants.REQUEST_HEADERS.TIMESTAMP]: currentTime,
        },
      }],
    });
    logger.info(`Kafka service is healthy in topic "${healthTopicName}"`);
    return true;
  } catch (error) {
    logger.error(`Kafka service is unhealthy in topic "${healthTopicName}": ${error}`);
    setTimeout(() => {
      producer.connect();
    }, 1000);
    return false;
  }
};
module.exports = {
  sendHealthCheck,
  buildKafka,
};
