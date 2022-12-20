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
const consentStatusController = require('../controllers/consent-status');

const checkAuthAdminForStatusRead = appIdAuth.getAuthStrategy(appIdAuth.APP_ID_SCOPES.STATUS_READ);

const router = express.Router();

// get consent status endpoint
router.get('/', checkAuthAdminForStatusRead, consentStatusController.getConsentStatus);

module.exports = router;
