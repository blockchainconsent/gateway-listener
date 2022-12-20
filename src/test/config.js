/*
 *
 *
 * (c) Copyright Merative US L.P. and others 2020-2022 
 *
 * SPDX-Licence-Identifier: Apache 2.0
 *
 */
exports.token = '';
exports.tenantID = 'tenantID';

exports.email = process.env.MOCHA_TEST_EMAIL;
exports.password = process.env.MOCHA_TEST_PASSWORD;

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

require('../server'); // start the app server

let protocol = 'https';
protocol = process.env.MOCHA_CM_PROTOCOL || protocol;

const host = process.env.MOCHA_CM_HOST || 'localhost';
const port = process.env.MOCHA_CM_PORT || '3003';
exports.server = `${protocol}://${host}:${port}/`;
exports.cloudServer = process.env.MOCHA_CM_TEST_URL;
