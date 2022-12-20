/*
 *
 *
 * (c) Copyright Merative US L.P. and others 2020-2022 
 *
 * SPDX-Licence-Identifier: Apache 2.0
 *
 */

const config = require('./config');
const log4js = require('log4js');
const objectPath = require('object-path');

const log = log4js.getLogger('Config');
log.level = config.logLevel || 'debug';

const validateAndSetup = (propKey, propEnv) => {
  const propValue = propEnv || objectPath.get(config, propKey);
  if (propValue || propValue === false) {
    objectPath.set(config, propKey, propValue);
    return true;
  }
  log.error(`Required config property is missing: ${propKey}`);
  return false;
};

/**
 * Setups and validates the configuration properties.
 */
exports.setup = () => {
  let validateResult = true;

  validateResult &= validateAndSetup('port');
  validateResult &= validateAndSetup('httpsEnabled');
  validateResult &= validateAndSetup('logLevel');

  validateResult &= validateAndSetup('appID.retries');
  validateResult &= validateAndSetup('appID.retryDelay');
  validateResult &= validateAndSetup('appID.timeout');

  validateResult &= validateAndSetup('keyProtect.retries');
  validateResult &= validateAndSetup('keyProtect.retryDelay');
  validateResult &= validateAndSetup('keyProtect.timeout');

  validateResult &= validateAndSetup('databaseConfig.connection.url', process.env.CLOUDANT_URL);
  validateResult &= validateAndSetup('databaseConfig.connection.username', process.env.CLOUDANT_USERNAME);
  validateResult &= validateAndSetup('databaseConfig.connection.password', process.env.CLOUDANT_PASSWORD);
  validateResult &= validateAndSetup('databaseConfig.dbNameFailures');
  validateResult &= validateAndSetup('databaseConfig.dbPartitionKey');

  validateResult &= validateAndSetup('httpClient.isOmrEndpoint');
  validateResult &= validateAndSetup("httpClient.authUser");
  validateResult &= validateAndSetup("httpClient.authPassword", process.env.AUTH_PASSWORD);
  validateResult &= validateAndSetup("httpClient.authLoginOrg");
  validateResult &= validateAndSetup("httpClient.authLoginChannel");
  validateResult &= validateAndSetup('httpClient.omrApiProtocol');
  validateResult &= validateAndSetup('httpClient.simpleApiProtocol');
  validateResult &= validateAndSetup('httpClient.apiHost');
  validateResult &= validateAndSetup('httpClient.omrApiPort');
  validateResult &= validateAndSetup('httpClient.simpleApiPort');
  validateResult &= validateAndSetup('httpClient.omrRegisterConsentEndpoint');
  validateResult &= validateAndSetup('httpClient.simpleRegisterConsentEndpoint');
  validateResult &= validateAndSetup('httpClient.omrLoginEndpoint');

  validateResult &= validateAndSetup('eventStreams.inputGroupId');
  validateResult &= validateAndSetup('eventStreams.inputTopicName', process.env.EVENT_INPUT_TOPIC);
  validateResult &= validateAndSetup('eventStreams.failureConsumers.retry1m.failureTopicName', process.env.EVENT_FAILURE_TOPIC_1);
  validateResult &= validateAndSetup('eventStreams.failureConsumers.retry30m.failureTopicName', process.env.EVENT_FAILURE_TOPIC_2);
  validateResult &= validateAndSetup('eventStreams.failureConsumers.retry2h.failureTopicName', process.env.EVENT_FAILURE_TOPIC_3);
  validateResult &= validateAndSetup('eventStreams.clientId');
  validateResult &= validateAndSetup('eventStreams.brokers', process.env.EVENT_BROKERS);
  validateResult &= validateAndSetup('eventStreams.maxBytesPerPartitionForConsumer', process.env.MAX_BYTES_PER_PARTITION_FOR_CONSUMER);
  validateResult &= validateAndSetup('eventStreams.keepAliveDelay');

  validateResult &= validateAndSetup('eventStreams.securityProtocol');
  validateResult &= validateAndSetup('eventStreams.sasl.mechanisms');
  validateResult &= validateAndSetup('eventStreams.sasl.username');
  validateResult &= validateAndSetup('eventStreams.sasl.password', process.env.EVENT_SASL_PASSWORD);

  validateResult &= validateAndSetup('defaults.registerConsent.name');
  validateResult &= validateAndSetup('defaults.registerConsent.secret', process.env.DEFAULTS_USER_PASSWORD);
  validateResult &= validateAndSetup('defaults.registerConsent.email');

  if (!validateResult) {
    log.error('Required configuration values are missing. Stopping the application.');
    process.kill(process.pid, 'SIGTERM');
  }
};
