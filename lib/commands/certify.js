const cli = require('heroku-cli-util');
const co = require('co');

const debug = require('debug')('le-certify-command');

const leChallengeHeroku = require('../challenges/le-challenge-heroku-redis');
const leChallengeNull = require('../challenges/le-challenge-null');
const letsEncrypt = require('letsencrypt');
var x509 = require('x509.js');


const LETSENCRYPT_SERVER = process.env.LETSENCRYPT_SERVER || "staging"; // TODO - use production server
const EXPIRATION_THRESHOLD = process.env.EXPIRATION_THRESHOLD || 7; // DAYS


function* runCommand(context, heroku) {
  cli.log(`--> Analyzing heroku app: ${context.app}`);
  const herokuApi = new HerokuApi(heroku, context.app);
  const herokuConfigVars = yield herokuApi.getConfigVars();
  const sslEndpoints = yield herokuApi.getSslEndpoints();
  const customDomainsList = yield herokuApi.getCustomDomainsList(context.app);
  const domainsForChallenge = customDomainsList.map(domain => domain.hostname);

  // these assertions will print an error and exit if conditions are not met
  assertDomainsPresent(domainsForChallenge);
  const redisUrl = assertRedisUrl(herokuConfigVars);

  if (sslEndpoints.length > 0) {
    if (existingCertificateIsOk(sslEndpoints[0].certificate_chain, domainsForChallenge, EXPIRATION_THRESHOLD)) {
      cli.log(`----> The expiration threshold is ${EXPIRATION_THRESHOLD} days. Nothing to do, exiting.`);
      process.exit(0); // successful path
    }
  }

  cli.log(`--> Obtaining a new SSL certificate for ${domainsForChallenge}`);
  const myAccount = yield herokuApi.getAccount();
  const le = setupLetsEncrypt(LETSENCRYPT_SERVER, leChallengeHeroku(redisUrl));
  certificate = yield generateNewCertificate(le, domainsForChallenge, myAccount.email);

  if (sslEndpoints.length > 0) {
    cli.log('--> Updating SNI SSL endpoint on a Heroku app...');
    yield herokuApi.updateSslEndpoint(sslEndpoints[0], certificate);
    cli.log('--> Done. SNI SSL certificate was updated successfully');
  } else {
    cli.log('--> Creating SNI SSL endpoint on a Heroku app...');
    yield herokuApi.createSslEndpoint(certificate);
    cli.log('--> Done. Your DNS needs to be updated to point to SNI endpoints (your.domain.herokudns.com)');
    cli.log('--> Please run "heroku domains" for the mapping table');
  }
}


//**************** HELPER CLASSES & FUNCTIONS ************************

class HerokuApi {
  constructor(heroku, app) {
    this.app = app;
    this.heroku = heroku;
  }

  getCustomDomainsList() {
    const takeCustomDomains = arr => arr.filter(domain => domain.kind == 'custom');
    return this.heroku.get('/apps/' + this.app + '/domains').then(takeCustomDomains);
  }

  createSslEndpoint(certificate) {
    return this.heroku.post(`/apps/${this.app}/sni-endpoints`, {
      body: {
        certificate_chain: certificate.cert,
        private_key: certificate.privkey
      }
    });
  }

  updateSslEndpoint(endpoint, certificate) {
    return this.heroku.patch(`/apps/${this.app}/sni-endpoints/${endpoint.id}`, {
      body: {
        certificate_chain: certificate.cert,
        private_key: certificate.privkey
      }
    });
  }

  getConfigVars() {
    return this.heroku.get('/apps/' + this.app + '/config-vars')
  }

  getAccount() {
    return this.heroku.get('/account');
  }

  getSslEndpoints() {
    return this.heroku.get(`/apps/${this.app}/sni-endpoints`);
  }
}

function generateNewCertificate(le, domainsForChallenge, email) {
  cli.log('----> Starting a HTTP challenge to get a new SSL certificate (using', email, "as recovery email)...");
  return le.register({
    domains: domainsForChallenge,
    email: email,
    agreeTos: true
  });
}

function setupLetsEncrypt(server, httpChallenge) {
  return letsEncrypt.create({
    server: server,
    challenges: {
      'http-01': httpChallenge,
      'tls-sni-01': leChallengeNull
    },
    challengeType: 'http-01',
    debug: false
  });
}

function existingCertificateIsOk(rawCertData, domains, threshold) {
  const DAY_IN_MS = 3600 * 24 * 1000;
  const existingCert = x509.parseCert(rawCertData);
  const expirationDate = Date.parse(existingCert.notAfter);
  const remainingDays = Math.round((expirationDate - Date.now()) / DAY_IN_MS);
  cli.log(`----> Existing certificate found, expires in ${remainingDays} day(s)`);
  return remainingDays > threshold;
}

function die(message) {
  cli.error(message);
  process.exit(1);
}

function assertDomainsPresent(domains) {
  domains.length > 0 || die("FATAL: There are no custom domains in this Heroku app - nothing to sign");
}

function assertRedisUrl(env) {
  return env.REDIS_URL || die("FATAL: REDIS_URL is not set. Please see setup instructions at https://github.com/cloudcastle/heroku-letsencrypt");
}

module.exports = {
  topic: 'le',
  command: 'certify',
  description: 'Gets a certificate from Lets encrypt and push it to the heroku application',
  needsApp: true,
  needsAuth: true,
  run: cli.command(co.wrap(runCommand))
};
