/*!
 * Copyright (c) 2018-2020 Veres One Project. All rights reserved.
 */
'use strict';

const nock = require('nock');
const chai = require('chai');
chai.should();

const {expect} = chai;

const {Cosmos} = require('..');

const TEST_DID = 'did:cosm:test:nym:2pfPix2tcwa7gNoMRxdcHbEyFGqaVBPNntCsDZexVeHX';
const UNREGISTERED_NYM =
  'did:cosm:test:nym:z6MkesAjEQrikUeuh6K496DDVm6d1DUzMMGQtFHuRFM1fkgt';
const UNREGISTERED_UUID = 'did:cosm:test:2G7RmkvGrBX5jf3M';
const UNREGISTERED_DOC = require('./dids/did-nym-unregistered.json');
const TEST_DID_RESULT = require('./dids/ashburn.capybara.did.json');
const LEDGER_AGENTS_DOC = require('./dids/ledger-agents.json');
const LEDGER_AGENT_STATUS = require('./dids/ledger-agent-status.json');
const TICKET_SERVICE_PROOF = require('./dids/ticket-service-proof.json');

describe('methods/veres-one', () => {
  let cosm;

  beforeEach(() => {
    cosm = new Cosmos({mode: 'test'});
  });

  describe('constructor', () => {
    it('should set mode and method', () => {
      expect(cosm.mode).to.equal('test');
      expect(cosm.method).to.equal('cosm');
    });
  });

  describe('get', () => {
    it('should fetch a DID Doc from a ledger', async () => {
      nock('https://ashburn.capybara.veres.one')
        .get(`/ledger-agents`)
        .reply(200, LEDGER_AGENTS_DOC);
      const {ledgerAgent: [{service: {ledgerQueryService}}]} =
        LEDGER_AGENTS_DOC;
      nock(ledgerQueryService)
        .post('/?id=' + encodeURIComponent(TEST_DID))
        .reply(200, TEST_DID_RESULT);

      _nockLedgerAgentStatus();

      const didDoc = await cosm.get({did: TEST_DID});
      expect(didDoc.id).to.equal(TEST_DID);
    });

    it('should derive a DID Doc if it encounters a 404 for nym', async () => {
      nock('https://ashburn.capybara.veres.one')
        .get(`/ledger-agents`)
        .reply(200, LEDGER_AGENTS_DOC);

      const {ledgerAgent: [{service: {ledgerQueryService}}]} =
        LEDGER_AGENTS_DOC;
      nock(ledgerQueryService)
        .post('/?id=' + encodeURIComponent(UNREGISTERED_NYM))
        .reply(404);

      _nockLedgerAgentStatus();

      const result = await cosm.get({did: UNREGISTERED_NYM});
      expect(JSON.stringify(result.doc, null, 2))
        .to.eql(JSON.stringify(UNREGISTERED_DOC, null, 2));
    });

    it('should return a key present in an un-registered DID', async () => {
      nock('https://ashburn.capybara.veres.one')
        .get(`/ledger-agents`)
        .reply(200, LEDGER_AGENTS_DOC);

      const {ledgerAgent: [{service: {ledgerQueryService}}]} =
        LEDGER_AGENTS_DOC;
      nock(ledgerQueryService)
        .post('/?id=' + encodeURIComponent(UNREGISTERED_NYM))
        .reply(404);

      _nockLedgerAgentStatus();

      // eslint-disable-next-line max-len
      const unregisteredKey = 'did:cosm:test:nym:z6MkesAjEQrikUeuh6K496DDVm6d1DUzMMGQtFHuRFM1fkgt#z6MkesAjEQrikUeuh6K496DDVm6d1DUzMMGQtFHuRFM1fkgt';
      const result = await cosm.get({did: unregisteredKey});

      expect(result.doc).to.eql({
        '@context': [
          'https://w3id.org/did/v0.11',
          'https://w3id.org/veres-one/v1'
        ],
        // eslint-disable-next-line max-len
        id: 'did:cosm:test:nym:z6MkesAjEQrikUeuh6K496DDVm6d1DUzMMGQtFHuRFM1fkgt#z6MkesAjEQrikUeuh6K496DDVm6d1DUzMMGQtFHuRFM1fkgt',
        type: 'tendermint/PubKeyEd25519',
        // eslint-disable-next-line max-len
        controller: 'did:cosm:test:nym:z6MkesAjEQrikUeuh6K496DDVm6d1DUzMMGQtFHuRFM1fkgt',
        publicKeyBase58: 'QugeAcHQwASabUMTXFNefYdBeD8wU24CENyayNzkXuW'
      });
    });

    it('should throw a 404 getting a non-invoke unregistered key', async () => {
      nock('https://ashburn.capybara.veres.one')
        .get(`/ledger-agents`)
        .reply(200, LEDGER_AGENTS_DOC);

      const {ledgerAgent: [{service: {ledgerQueryService}}]} =
        LEDGER_AGENTS_DOC;
      nock(ledgerQueryService)
        .post('/?id=' + encodeURIComponent(UNREGISTERED_NYM))
        .reply(404);

      _nockLedgerAgentStatus();

      let error;
      let result;
      // eslint-disable-next-line max-len
      const nonInvokeKey = 'did:cosm:test:nym:z6MkesAjEQrikUeuh6K496DDVm6d1DUzMMGQtFHuRFM1fkgt#z6MkrhVjBzL7pjojt3nYxSbNkTkZuCyRh6izYEUJL4pyPbB6';

      try {
        result = await cosm.get({did: nonInvokeKey});
      } catch(e) {
        error = e;
      }
      expect(result).not.to.exist;
      expect(error).to.exist;
      error.name.should.equal('NotFoundError');
    });

    it('should throw a 404 if non-nym DID not found on ledger', async () => {
      nock('https://ashburn.capybara.veres.one')
        .get(`/ledger-agents`)
        .reply(200, LEDGER_AGENTS_DOC);

      const {ledgerAgent: [{service: {ledgerQueryService}}]} =
        LEDGER_AGENTS_DOC;
      nock(ledgerQueryService)
        .post('/?id=' + encodeURIComponent(UNREGISTERED_UUID))
        .reply(404);

      _nockLedgerAgentStatus();

      let error;
      let result;
      try {
        result = await cosm.get({did: UNREGISTERED_UUID});
      } catch(e) {
        error = e;
      }
      expect(result).not.to.exist;
      expect(error).to.exist;
      error.name.should.equal('NotFoundError');
    });
  });

  describe('generate', () => {
    it('should generate a non-test DID in dev mode', async () => {
      cosm.mode = 'dev';
      const didDocument = await cosm.generate();
      expect(didDocument.id)
        .to.match(/^did:cosm:nym:z.*/);
    });

    it('should generate protected RSA nym-based DID Document', async () => {
      const nymOptions = {
        passphrase: 'foobar',
        keyType: 'RsaVerificationKey2018'
      };
      const didDocument = await cosm.generate(nymOptions);
      expect(didDocument.id)
        .to.match(/^did:cosm:test:nym:z.*/);
      const authPublicKey = didDocument.doc.authentication[0];
      const publicKeyPem = authPublicKey.publicKeyPem;
      expect(publicKeyPem)
        .to.have.string('-----BEGIN PUBLIC KEY-----');

      const keyPair = await didDocument.keys[authPublicKey.id].export();
      // check the corresponding private key
      expect(keyPair.privateKeyPem)
        .to.have.string('-----BEGIN ENCRYPTED PRIVATE KEY-----');
    });

    it('should generate protected EDD nym-based DID Document', async () => {
      const nymOptions = {passphrase: 'foobar'};
      const didDocument = await cosm.generate(nymOptions);

      expect(didDocument.id)
        .to.match(/^did:cosm:test:nym:z.*/);
      const authPublicKey = didDocument.doc.authentication[0];
      const publicKeyBase58 = authPublicKey.publicKeyBase58;
      expect(publicKeyBase58).to.exist;

      const keys = await didDocument.exportKeys();

      const exportedKey = keys[authPublicKey.id];

      // check the corresponding private key
      expect(exportedKey.privateKeyJwe.unprotected.alg)
        .to.equal('PBES2-A128GCMKW');
    });

    it('should generate unprotected RSA nym-based DID Document', async () => {
      const nymOptions = {
        passphrase: null,
        keyType: 'RsaVerificationKey2018'
      };
      const didDocument = await cosm.generate(nymOptions);

      expect(didDocument.id).to.match(/^did:cosm:test:nym:.*/);
      const authPublicKey = didDocument.doc.authentication[0];
      expect(authPublicKey.publicKeyPem)
        .to.have.string('-----BEGIN PUBLIC KEY-----');
      const keyPair = await didDocument.keys[authPublicKey.id].export();
      // check the corresponding private key
      expect(keyPair.privateKeyPem)
        .to.match(/^-----BEGIN (:?RSA )?PRIVATE KEY-----/);

    });

    it('should generate unprotected EDD nym-based DID Document', async () => {
      const nymOptions = {passphrase: null};
      const didDocument = await cosm.generate(nymOptions);

      expect(didDocument.id).to.match(/^did:cosm:test:nym:.*/);
      const authPublicKey = didDocument.doc.authentication[0];
      expect(authPublicKey.publicKeyBase58).to.exist;

      const exportedKey = await didDocument.keys[authPublicKey.id].export();
      expect(exportedKey.privateKeyBase58).to.exist;
    });

    it('should generate uuid-based DID Document', async () => {
      const uuidOptions = {
        didType: 'uuid',
        keyType: 'RsaVerificationKey2018'
      };
      const didDocument = await cosm.generate(uuidOptions);

      expect(didDocument.id).to.match(/^did:cosm:test:uuid:.*/);
    });

    it('should generate protected ed25519 nym-based DID Doc', async () => {
      const nymOptions = {
        keyType: 'tendermint/PubKeyEd25519',
        passphrase: 'foobar'
      };
      const didDocument = await cosm.generate(nymOptions);
      const did = didDocument.id;

      expect(did).to.match(/^did:cosm:test:nym:z.*/);
      const fingerprint = did.replace('did:cosm:test:nym:', '');

      const invokePublicKey = didDocument.doc.capabilityInvocation[0];

      expect(invokePublicKey.id).to.have.string('nym:z');

      const invokeKey = didDocument.keys[invokePublicKey.id];
      const exportedKey = await invokeKey.export();

      expect(exportedKey.privateKeyJwe.ciphertext)
        .to.have.lengthOf.above(128);
      const result = invokeKey.verifyFingerprint(fingerprint);
      expect(result).to.exist;
      result.should.be.an('object');
      expect(result.valid).to.exist;
      result.valid.should.be.a('boolean');
      result.valid.should.be.true;
    });

    it('should generate unprotected ed25519 nym-based DID Doc', async () => {
      const nymOptions = {
        keyType: 'tendermint/PubKeyEd25519',
        passphrase: null
      };
      const didDocument = await cosm.generate(nymOptions);
      const did = didDocument.id;

      expect(did).to.match(/^did:cosm:test:nym:z.*/);
      const fingerprint = did.replace('did:cosm:test:nym:', '');

      const invokePublicKey = didDocument.doc.capabilityInvocation[0];
      const invokeKey = didDocument.keys[invokePublicKey.id];

      expect(invokePublicKey.id).to.have.string('nym:z');

      const result = invokeKey.verifyFingerprint(fingerprint);
      expect(result).to.exist;
      result.should.be.an('object');
      expect(result.valid).to.exist;
      result.valid.should.be.a('boolean');
      result.valid.should.be.true;
    });
  });

  describe('computeKeyId', () => {
    let key;

    beforeEach(() => {
      key = {
        fingerprint: () => '12345'
      };
    });

    it('should generate a key id based on a did', async () => {
      key.id = await cosm.computeKeyId({did: 'did:cosm:test:uuid:abcdef', key});

      expect(key.id).to.equal('did:cosm:test:uuid:abcdef#12345');
    });

    it('should generate a cryptonym key id based on fingerprint', async () => {
      key.id = await cosm.computeKeyId({key, didType: 'nym', mode: 'live'});

      expect(key.id).to.equal('did:cosm:nym:12345#12345');
    });
  });

  describe('register', () => {
    it('should send a doc to ledger for registration', async () => {
      nock('https://ashburn.capybara.veres.one')
        .get(`/ledger-agents`)
        .reply(200, LEDGER_AGENTS_DOC);

      _nockLedgerAgentStatus();
      _nockTicketService();
      _nockOperationService();

      const didDocument = await cosm.generate();
      let error;
      let result;
      try {
        result = await cosm.register({didDocument});
      } catch(e) {
        error = e;
      }
      expect(error).not.to.exist;
      expect(result).to.exist;
    });
  });

  describe.skip('attachDelegationProof', () => {
    it('should attach ocap-ld delegation proof to an operation', async () => {
      let didDocument = await cosm.generate({
        passphrase: null, keyType: 'RsaVerificationKey2018'
      });

      const delegationPublicKey = didDocument.doc.capabilityDelegation[0];
      const creator = delegationPublicKey.id;
      const {privateKeyPem} = await didDocument.keys[delegationPublicKey.id]
        .export();

      didDocument = await cosm.attachDelegationProof({
        didDocument,
        creator,
        privateKeyPem
      });

      const {proof} = didDocument;
      expect(proof).to.exist;
      expect(proof.type).to.equal('RsaSignature2018');
      expect(proof.proofPurpose).to.equal('capabilityDelegation');
      expect(proof.creator).to.equal(creator);
      expect(proof.jws).to.exist;
    });
  });

  describe.skip('attachInvocationProof', () => {
    it('should attach ld-ocap invocation proof to an operation', async () => {
      const didDocument = await cosm.generate({
        passphrase: null, keyType: 'RsaVerificationKey2018'
      });

      let operation = cosm.client.wrap({didDocument: didDocument.doc});
      const invokePublicKey = didDocument.doc.capabilityInvocation[0];
      const creator = invokePublicKey.id;

      const {privateKeyPem} = await didDocument.keys[invokePublicKey.id]
        .export();

      operation = await cosm.attachInvocationProof({
        operation,
        capability: didDocument.id,
        capabilityAction: operation.type,
        creator,
        privateKeyPem
      });

      expect(operation.type).to.equal('CreateWebLedgerRecord');
      expect(operation.record.id).to.match(/^did:cosm:test:nym:.*/);
      expect(operation.record.authentication[0].publicKeyPem)
        .to.have.string('-----BEGIN PUBLIC KEY-----');
      expect(operation.proof).to.exist;
      expect(operation.proof.type).to.equal('RsaSignature2018');
      expect(operation.proof.capabilityAction).to.equal(operation.type);
      expect(operation.proof.proofPurpose).to.equal('capabilityInvocation');
      expect(operation.proof.creator).to.equal(creator);
      expect(operation.proof.jws).to.exist;
    });
  });
});

function _nockLedgerAgentStatus() {
  const {ledgerAgent: [{service: {ledgerAgentStatusService}}]} =
    LEDGER_AGENTS_DOC;
  nock(ledgerAgentStatusService)
    .get('/')
    .times(2)
    .reply(200, LEDGER_AGENT_STATUS);
}

function _nockTicketService() {
  const {service: {'urn:veresone:ticket-service': {id: ticketService}}} =
    LEDGER_AGENT_STATUS;
  nock(ticketService)
    .post('/')
    .reply(200, (uri, requestBody) => {
      const reply = JSON.parse(JSON.stringify(requestBody));
      reply.proof = TICKET_SERVICE_PROOF;
      return reply;
    });
}

function _nockOperationService() {
  const {ledgerAgent: [{service: {ledgerOperationService}}]} =
    LEDGER_AGENTS_DOC;
  nock(ledgerOperationService)
    .post('/')
    .reply(200, (uri, requestBody) => {
      return requestBody.record;
    });
}
