/*
 *
 *
 * (c) Copyright Merative US L.P. and others 2020-2022 
 *
 * SPDX-Licence-Identifier: Apache 2.0
 *
 */

const passport = require('passport');
const { APIStrategy } = require('ibmcloud-appid');

const appIDUrl = process.env.APP_ID_URL;
const tenantID = process.env.APP_ID_TENANT_ID;

const APP_ID_SCOPES = {
  FAILURE_READ: 'failure.read',
  FAILURE_RESUBMIT: 'failure.resubmit',
  STATUS_READ: 'status.read',
};

passport.use(
  new APIStrategy({
    oauthServerUrl: `${appIDUrl}/oauth/v4/${tenantID}`,
  }),
);

const authenticateStandardUser = passport.authenticate(APIStrategy.STRATEGY_NAME, {
  session: false,
});

const authenticateConsentManagerAdminForFailureRead = passport.authenticate(APIStrategy.STRATEGY_NAME, {
  session: false,
  scope: APP_ID_SCOPES.FAILURE_READ,
});

const authenticateConsentManagerAdminForFailureResubmit = passport.authenticate(APIStrategy.STRATEGY_NAME, {
  session: false,
  scope: APP_ID_SCOPES.FAILURE_RESUBMIT,
});

const authenticateConsentManagerForStatusRead = passport.authenticate(APIStrategy.STRATEGY_NAME, {
  session: false,
  scope: APP_ID_SCOPES.STATUS_READ,
});

const getAuthStrategy = (scope) => {
  const statusReadResult = scope === APP_ID_SCOPES.STATUS_READ
    ? authenticateConsentManagerForStatusRead : authenticateStandardUser;
  const statusFailureResabmitResult = scope === APP_ID_SCOPES.FAILURE_RESUBMIT
    ? authenticateConsentManagerAdminForFailureResubmit : statusReadResult;
  return scope === APP_ID_SCOPES.FAILURE_READ
    ? authenticateConsentManagerAdminForFailureRead : statusFailureResabmitResult;
};

module.exports = {
  APP_ID_SCOPES,
  getAuthStrategy,
};
