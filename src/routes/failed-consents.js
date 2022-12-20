/*
 *
 *
 * (c) Copyright Merative US L.P. and others 2020-2022 
 *
 * SPDX-Licence-Identifier: Apache 2.0
 *
 */

const express = require('express');
const appIdAuth = require('../middleware/app-id-auth');
const failedConsentsController = require('../controllers/failed-consents');

const checkAuthAdminForFailureRead = appIdAuth.getAuthStrategy(appIdAuth.APP_ID_SCOPES.FAILURE_READ);
const checkAuthAdminForFailureResubmit = appIdAuth.getAuthStrategy(appIdAuth.APP_ID_SCOPES.FAILURE_RESUBMIT);

const router = express.Router();

// endpint for get failed consents
router.get('/', checkAuthAdminForFailureRead, failedConsentsController.getFailedConsents);
// endpoint for resubmit failed consents
router.post('/', checkAuthAdminForFailureResubmit, failedConsentsController.resubmitFailedConsents);

module.exports = router;
