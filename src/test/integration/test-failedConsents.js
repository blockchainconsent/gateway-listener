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

describe('failed-consents', function test() {
  this.timeout(10000);

  describe('Failed Consent GET', function failedConsent() {
    this.timeout(5000);
    before((done) => {
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
          config.token = res.body.access_token;
          done();
        });
    });

    it('Should return a 200,Valid TenantID', (done) => {
      const path = 'gateway-listener/api/v1/failed-consents?tenantID=5102';
      chai
        .request(config.cloudServer)
        .get(path)
        .set({ Authorization: `Bearer ${config.token}` })
        .end((err, res) => {
          expect(res).to.have.status(200);
          expect(res.body).to.have.property('result');
          done();
        });
    });
    it('Should return a 404,Invalid TenantID', (done) => {
      const path = 'gateway-listener/api/v1/failed-consents?tenantID=2102';
      chai
        .request(config.cloudServer)
        .get(path)
        .set({ Authorization: `Bearer ${config.token}` })
        .end((err, res) => {
          expect(res).to.have.status(404);
          done();
        });
    });
    it('Should return a 404,Invalid txID', (done) => {
      const path = 'gateway-listener/api/v1/failed-consents?tenantID=5102&txID=invalid';
      chai
        .request(config.cloudServer)
        .get(path)
        .set({ Authorization: `Bearer ${config.token}` })
        .end((err, res) => {
          expect(res).to.have.status(404);
          done();
        });
    });
    it('Should return a 404,Invalid latestTimestamp', (done) => {
      const path = 'gateway-listener/api/v1/failed-consents?tenantID=5102&txID=invalid&latestTimestamp=1652373373817';
      chai
        .request(config.cloudServer)
        .get(path)
        .set({ Authorization: `Bearer ${config.token}` })
        .end((err, res) => {
          expect(res).to.have.status(404);
          done();
        });
    });
  });
  describe('Failed Consent POST', function failedConsent() {
    this.timeout(5000);

    it('Should return a 200, valid TenantID (POST)', (done) => {
      const path = 'gateway-listener/api/v1/failed-consents?tenantID=5102';
      chai
        .request(config.cloudServer)
        .post(path)
        .set({ Authorization: `Bearer ${config.token}` })
        .end((err, res) => {
          if (err) throw err;
          console.log(res.body);
          expect(res.status).to.equal(200);
          expect(res.body).to.have.property('resubmitFailedConsents');
          done();
        });
    });
    it('Should return a 404, Invalid TenantID (POST)', (done) => {
      const path = 'gateway-listener/api/v1/failed-consents?tenantID=2102';
      chai
        .request(config.cloudServer)
        .post(path)
        .set({ Authorization: `Bearer ${config.token}` })
        .end((err, res) => {
          expect(res.status).to.equal(404);
          done();
        });
    });
    it('Should return a 404, Invalid txID (POST)', (done) => {
      const path = 'gateway-listener/api/v1/failed-consents?tenantID=5102&txID=invalid';
      chai
        .request(config.cloudServer)
        .post(path)
        .set({ Authorization: `Bearer ${config.token}` })
        .end((err, res) => {
          expect(res.status).to.equal(404);
          done();
        });
    });
    it('Should return a 404, Invalid latestTimestamp (POST)', (done) => {
      const path = 'gateway-listener/api/v1/failed-consents?tenantID=5102&txID=invalid&latestTimestamp=1652373373817';
      chai
        .request(config.cloudServer)
        .post(path)
        .set({ Authorization: `Bearer ${config.token}` })
        .end((err, res) => {
          expect(res.status).to.equal(404);
          done();
        });
    });
  });
});
