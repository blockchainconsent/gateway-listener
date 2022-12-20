/*
 *
 *
 * (c) Copyright Merative US L.P. and others 2020-2022 
 *
 * SPDX-Licence-Identifier: Apache 2.0
 *
 */

require('dotenv').config();

const chai = require('chai');
const chaiHttp = require('chai-http');

chai.use(chaiHttp);

const { expect } = chai;

const config = require('../config');

describe('Login', function test() {
  this.timeout(10000);

  describe('Invalid Login', function invalidLoginTest() {
    this.timeout(5000);

    it('Should return a 400, invalid field names', (done) => {
      const path = 'gateway-listener/api/v1/login';
      const body = {
        email: 'test@email.com',
        password: 'testpassword',
        is_admin: true,
        is_sso: true,
        role: 'admin',
      };
      chai
        .request(config.cloudServer)
        .post(path)
        .send(body)
        .end((err, res) => {
          expect(res).to.have.status(400);
          expect(res.body).to.have.property('error');
          expect(res.body.error).to.have.property('message');
          expect(res.body.error.message).to.include('Unexpected fields in request body: is_admin,is_sso,role');
          done();
        });
    });
    it('Should return a 200, valid user (5102)', (done) => {
      const path = 'gateway/api/v1/login';
      const body = {
        email: config.email,
        password: config.password,
      };
      chai
        .request(config.cloudServer)
        .post(path)
        .send(body)
        .end((err, res) => {
          if (err) throw err;
          expect(res.status).to.equal(200);
          expect(res.body).to.have.property('access_token');
          expect(res.body.access_token).to.not.be.empty;
          config.token = res.body.access_token;
          done();
        });
    });
  });
});
