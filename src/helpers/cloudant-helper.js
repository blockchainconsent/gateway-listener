/*
 *
 *
 * (c) Copyright Merative US L.P. and others 2020-2022 
 *
 * SPDX-Licence-Identifier: Apache 2.0
 *
 */

const { CloudantV1 } = require('@ibm-cloud/cloudant');
const { IamAuthenticator, BasicAuthenticator } = require('ibm-cloud-sdk-core');
const log4js = require('log4js');
const config = require('../config/config.json');
const { CONSENT_STATUSES } = require('./constants');

const { dbPartitionKey } = config.databaseConfig;

const log = log4js.getLogger('cloudant-helper');
log.level = config.logLevel;

const devMode = process.env.DEV_MODE !== 'false';

function initCloudant() {
  const { connection } = config.databaseConfig;

  if (!connection) {
    throw new Error('Missing DB connection configuration');
  }
  const cloudantUrl = process.env.CLOUDANT_URL || connection.url;

  // As long as user provides 'iamApiKey' and 'account' values in config file
  // IAM method will be the authentication method.
  const useIamAuth = connection.account && connection.iamApiKey;

  // If user provides 'url', 'username', 'password' values in config file
  // and does not provide 'iamApiKey' or 'account' values,
  // then legacy authentication method will be used.
  const useLegacyAuth = cloudantUrl && connection.username && connection.password;

  let authenticator;
  if (useIamAuth) {
    log.info('Use IAM auth for DB connection');

    authenticator = new IamAuthenticator({
      apikey: connection.iamApiKey,
    });
  } else if (useLegacyAuth) {
    log.info('Use legacy auth for DB connection');

    authenticator = new BasicAuthenticator({
      username: process.env.CLOUDANT_USERNAME || connection.username,
      password: process.env.CLOUDANT_PASSWORD || connection.password,
    });
  } else {
    throw new Error('Missing DB credentials');
  }
  const service = new CloudantV1({ authenticator });

  service.setServiceUrl(cloudantUrl);

  return service;
}

let instance;

class CloudantHelper {
  static getInstance(txID) {
    if (!instance) {
      instance = new CloudantHelper();
    } else if (!instance.cloudant) {
      const errMsg = 'Cloudant was not initialized during startup, please check configuration';
      log.error(errMsg, { txID });
      throw { status: 500, message: errMsg };
    }
    return instance;
  }

  async setupCloudant() {
    if (!this.cloudant) {
      try {
        this.cloudant = await initCloudant();
      } catch (err) {
        log.error(`Failed to initCloudant: ${err}`);
        throw err;
      }
    }
  }

  async pingCloudant() {
    try {
      const reply = await this.cloudant.getSessionInformation();
      log.info('Cloudant pinged successfully:', reply.result);
      return true;
    } catch (error) {
      log.error(`Failed to ping Cloudant: ${error.message}`);
      return false;
    }
  }

  async checkConnection() {
    const timeout = (promise, time, exception) => {
      let timer;
      return Promise.race([promise, new Promise((res, rej) => timer = setTimeout(rej, time, exception))])
        .finally(() => clearTimeout(timer));
    };
    const timeoutError = new Error(`Request timed out after ${config.databaseConfig.connection.timeout} ms`);

    try {
      return await timeout(this.pingCloudant(), config.databaseConfig.connection.timeout, timeoutError);
    } catch (error) {
      log.error(`Cloudant service error: ${error}`);
      return false;
    }
  }

  async getDatabaseInformation(params) {
    return this.cloudant.getDatabaseInformation(params);
  }

  async getOrCreateDB(db, indexes, { txID, tenantID }) {
    try {
      await this.getDatabaseInformation({ db });
      log.info(`Successfully got Cloudant database ${db}`, { txID, tenantID });
    } catch (err) {
      log.error(`Failed to get Cloudant database ${db}: ${err.message}`, { txID, tenantID });

      try {
        await this.cloudant.putDatabase({ db, partitioned: true });
        log.info(`Created Cloudant database ${db}`, { txID, tenantID });

        if (Array.isArray(indexes) && indexes.length) {
          for (const payloadForIndex of indexes) {
            await this.createIndex(db, payloadForIndex, { txID, tenantID });
          }
        }
      // eslint-disable-next-line no-shadow
      } catch (err) {
        log.error(`Failed to create Cloudant database ${db}: ${err.message}`, { txID, tenantID });
        throw err;
      }
    }
  }

  async createIndex(db, params, { txID, tenantID }) {
    try {
      await this.cloudant.postIndex({ db, ...params });
      log.info(`Created Cloudant index in database ${db}: ${JSON.stringify(params)}`, { txID, tenantID });
    } catch (err) {
      log.error(`Failed to create Cloudant index in database ${db}: ${JSON.stringify(params)}`, {
        txID,
        tenantID,
      });
    }
  }

  async deleteDocument(db, rev, { txID, tenantID }) {
    try {
      const { result } = await this.cloudant.deleteDocument({
        db,
        docId: `${dbPartitionKey}:${txID}`,
        rev,
      });
      log.info(`Document has been deleted successfully: ${JSON.stringify(result)}`, { txID, tenantID });
      return result;
    } catch (e) {
      log.error(`Failed to delete document in database ${db}: ${e.message}`, { txID, tenantID });
    }

    return null;
  }

  async createDocument(db, data, { txID, tenantID }) {
    try {
      const { result } = await this.cloudant.postDocument({
        db,
        document: {
          _id: `${dbPartitionKey}:${txID}`,
          ...data,
        },
      });
      log.info(`Consent message has been saved successfully: ${JSON.stringify(result)}`, { txID, tenantID });
      return { _id: result.id, _rev: result.rev };
    } catch (e) {
      log.error(`Failed to create consent in database ${db}: ${e.message}`, { txID, tenantID });
      throw e;
    }
  }

  async updateDocument(db, document, { txID, tenantID }) {
    try {
      const { result: existDocument } = await this.findById(db, { txID, tenantID });
      if (devMode && existDocument.status === CONSENT_STATUSES.SUCCEEDED) {
        return {
          _id: existDocument.id,
          _rev: existDocument.rev,
        };
      }
      const { result } = await this.cloudant.putDocument({
        db,
        // eslint-disable-next-line no-underscore-dangle
        docId: existDocument._id,
        document: {
          ...existDocument,
          ...document,
        },
      });
      log.info(`Consent message has been updated successfully: ${JSON.stringify(result)}`, { txID, tenantID });
      return { _id: result.id, _rev: result.rev };
    } catch (e) {
      log.error(`Failed to update consent in database ${db}: ${e.message}`, { txID, tenantID });
    }

    return { _id: null, _rev: null };
  }

  async findByQuery(db, selector, sort, { txID, tenantID }) {
    log.info('Searching for existing document', { txID, tenantID });
    try {
      const { result } = await this.cloudant.postPartitionFind({
        db,
        partitionKey: dbPartitionKey,
        selector,
        sort
      });
      if (!result.docs.length) {
        return {
          status: 404,
          message: 'No document found',
        };
      }
      log.info('Document exist', { txID, tenantID });

      return {
        status: 200,
        result: result.docs,
      };
    } catch (e) {
      const message = `Failed to search for existing document: ${JSON.stringify(e)}`;
      log.error(message, { txID, tenantID });
      const errRes = JSON.parse(JSON.stringify(e));
      if(errRes && errRes.status === 404) {
        return {
          status: 404,
          message: `No failed consents found for TenantID ${tenantID}`,
        };
      }
      return {
        status: 500,
        message,
      };
    }
  }

  async findById(db, { txID, tenantID }) {
    log.info('Searching for existing document', { txID, tenantID });
    try {
      const { result } = await this.cloudant.getDocument({
        db,
        docId: `${dbPartitionKey}:${txID}`,
      });
      log.info(`Document ${dbPartitionKey}:${txID} exist`, { txID, tenantID });

      return {
        status: 200,
        result,
      };
    } catch (e) {
      log.error(`Failed to search for existing document: ${e.message}`, { txID, tenantID });
      throw e;
    }
  }

  async deleteDB(db, { txID, tenantID }) {
    try {
      await this.cloudant.getDatabaseInformation({ db });
      log.info(`Deleting Cloudant database ${db}`, { txID, tenantID });
      return await this.cloudant.deleteDatabase({ db });
    } catch (e) {
      log.error(`Failed to delete Cloudant database ${db}: ${e.message}`, { txID, tenantID });
      throw e;
    }
  }
}

module.exports = CloudantHelper;
