/*
 *
 *
 * (c) Copyright Merative US L.P. and others 2020-2022 
 *
 * SPDX-Licence-Identifier: Apache 2.0
 *
 */

const { expect } = require('chai');
const { eventStreams: { inputTopicName, failureConsumers: { retry1m, retry30m, retry2h } } } = require('../../config');
const { isDuplicateStatusDoc } = require('../../helpers/message-handler-helper');

describe('message-handler-helper', () => {
    describe('isDuplicateStatusDoc()', () => {
        it('should return true', () => {
            const result = isDuplicateStatusDoc(retry1m.failureTopicName, inputTopicName);
            expect(result).deep.equal(true);
        });
        it('should return true', () => {
            const result = isDuplicateStatusDoc(retry30m.failureTopicName, retry1m.failureTopicName);
            expect(result).deep.equal(true);
        });
        it('should return false', () => {
            const result = isDuplicateStatusDoc(inputTopicName, inputTopicName);
            expect(result).deep.equal(false);
        });
        it('should return false', () => {
            const result = isDuplicateStatusDoc(inputTopicName, retry1m.failureTopicName);
            expect(result).deep.equal(false);
        });
    });
});
