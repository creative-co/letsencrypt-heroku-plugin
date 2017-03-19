const cli = require('heroku-cli-util');
const co = require('co');

const debug = require('debug')('le-certify-command');

const leChallengeHeroku = require('../challenges/le-challenge-heroku-redis');
const leChallengeNull = require('../challenges/le-challenge-null');
const letsEncrypt = require('letsencrypt');


const LETSENCRYPT_SERVER = process.env.LETSENCRYPT_SERVER || "staging"; // TODO - use production server

function* runCommand(context, heroku) {
  const herokuApi = new HerokuApi(heroku, context.app);
  const herokuConfigVars = yield herokuApi.getConfigVars();
  const redisUrl = assertRedisUrl(herokuConfigVars);
  const customDomainsList = yield herokuApi.getCustomDomainsList(context.app);
  const domainsForChallenge = customDomainsList.map(domain => domain.hostname);
  assertDomainsPresent(domainsForChallenge);

  const le = setupLetsEncrypt(LETSENCRYPT_SERVER, leChallengeHeroku(redisUrl));

  var certificate = yield le.check({ domains: domainsForChallenge });

  if (!certificate) {
    const myAccount = yield herokuApi.getAccount();
    certificate = yield generateNewCertificate(le, domainsForChallenge, myAccount.email);
  } else {
    cli.log('--> A fresh certificate was found for ', domainsForChallenge);
  }

  cli.log('--> Creating SSL endpoint on a Heroku app...');
  yield herokuApi.createSslEndpoint(certificate);

  cli.log('Congratulations! Well done!');
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
    return this.heroku.post('/apps/' + this.app + '/sni-endpoints', {
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
}

function generateNewCertificate(le, domainsForChallenge, email) {
  cli.log('--> Starting a HTTP challenge to get a new SSL certificate (using', email, "as recovery email)...");
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
