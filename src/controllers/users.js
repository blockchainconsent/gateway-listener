/*
 *
 *
 * (c) Copyright Merative US L.P. and others 2020-2022 
 *
 * SPDX-Licence-Identifier: Apache 2.0
 *
 */

const helper = require('../helpers/app-id-helper');
const log = require('../helpers/logger').getLogger('users');

const emailRegex = /[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/;

exports.login = async (req, res) => {
  log.info('Entering POST /gateway-listener/api/v1/login controller');

  // return 400 in case of unexpected request body fields
  const requiredFields = ['email', 'password'];
  const fields = Object.keys(req.body);
  const unexpectedFields = fields.filter((field) => !requiredFields.includes(field));
  if (unexpectedFields.length) {
    const errMsg = `Unexpected fields in request body: ${unexpectedFields}`;
    log.error(`Failed to login user: ${errMsg}`);
    return res.status(400).json({
      error: {
        message: errMsg,
      },
    });
  }

  const { email, password } = req.body;

  if (!email || !password || !emailRegex.test(email)) {
    const errMsg = 'The email or password that you entered is incorrect.';
    log.info(`Failed to login user: ${errMsg}`);
    return res.status(400).json({
      error: {
        message: errMsg,
      },
    });
  }

  let authObject = {};
  try {
    authObject = await helper.loginAppID(email, password);
  } catch (error) {
    log.error(`Failed to login user with AppID: ${error.message}`);

    const errStatus = error.status || 500;
    const errMsg = error.message || 'Login failed';
    log.info(errMsg);
    return res.status(errStatus).json({
      error: {
        message: errMsg,
      },
    });
  }

  return res.status(200).json(authObject);
};
