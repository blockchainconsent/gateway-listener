/*
 *
 *
 * (c) Copyright Merative US L.P. and others 2020-2022 
 *
 * SPDX-Licence-Identifier: Apache 2.0
 *
 */

const CloudantHelper = require('./cloudant-helper');
const { sendHealthCheck } = require('../kafka/kafkaClient');
const { checkConsentEndpoint } = require('../httpClient');
const helper = require('./app-id-helper');

async function checkReadiness() {
  const cloudantClient = CloudantHelper.getInstance();
  const isConnection = await cloudantClient.checkConnection();
  const responseHttpClient = await checkConsentEndpoint();
  const responseAppID = await helper.pingAppID();
  const arrServices = [
    { service: 'Cloudant', isConnection },
    { service: 'HttpClient', isConnection: responseHttpClient },
    { service: 'AppID', isConnection: responseAppID },
  ];
  return new Promise((resolve, reject) => {
    const existProblem = arrServices.find((el) => el.isConnection !== true);
    if (existProblem) {
      reject(new Error(`${existProblem.service} service is not ready to start`));
    }
    resolve('Gateway Listener service is ready to start');
  });
}

const checkLiveness = async () => {
  const isKafkaConnection = await sendHealthCheck();
  return new Promise((resolve, reject) => {
    if (isKafkaConnection) {
      resolve('Gateway Listener service liveness is OK');
    }
    reject(new Error('Gateway Listener service liveness is not OK, Kafka service is unhealthy'));
  });
};

const registerChecks = (health, healthcheck) => {
  const readinessCheck = new health.ReadinessCheck('readinessCheck', () => checkReadiness());
  healthcheck.registerReadinessCheck(readinessCheck);
  const livenessCheck = new health.LivenessCheck('livenessCheck', () => checkLiveness());
  healthcheck.registerLivenessCheck(livenessCheck);
};

module.exports = {
  registerChecks,
};
