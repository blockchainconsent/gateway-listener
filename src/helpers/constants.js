/*
 *
 *
 * (c) Copyright Merative US L.P. and others 2020-2022 
 *
 * SPDX-Licence-Identifier: Apache 2.0
 *
 */

exports.REQUEST_HEADERS = {
  TRANSACTION_ID: 'x-cm-txn-id',
  TENANT_ID: 'x-cm-tenantid',
  TIMESTAMP: 'timestamp',
};

exports.HTTP_STATUS = {
  ERROR_CONFLICT: 409,
};

exports.CONSENT_STATUSES = {
  SUBMITTED: 'submitted', // newly added to the input queue
  SUCCEEDED: 'succeeded', // successfully processed
  RETRYING: 'retrying', // failed and added to the failure queue
  FAILED: 'failed', // failed after all retries
  RESUBMIT: 'resubmit', // resubmitted to the input queue
};

exports.TENANT_ID_KEY_PREFIX = 'fhir-connection-'; // begin of fhir tenant key in keyprotect
