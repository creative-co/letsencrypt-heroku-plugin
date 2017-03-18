const cli = require('heroku-cli-util');
const co = require('co');

const debug = require('debug')('le-certify-command');

const leChallengeHeroku = require('../le-challenge-heroku');
const leChallengeNull = require('../le-challenge-null');
const letsEncrypt = require('letsencrypt');


const LETSENCRYPT_SERVER = process.env.LETSENCRYPT_SERVER || "staging"; // TODO - use production server

function* runCommand(context, heroku) {
  const herokuApi = new HerokuApi(heroku, context.app);

  const customDomainsList = yield herokuApi.getCustomDomainsList(context.app);
  const domainsForChallenge = customDomainsList.map(domain => domain.hostname);
  assertDomainsPresent(domainsForChallenge);

  const le = setupLetsEncrypt(LETSENCRYPT_SERVER, leChallengeHeroku(heroku, context.app));

  var certificate = yield le.check({ domains: domainsForChallenge });

  if (!certificate) {
    const myAccount = yield herokuApi.getAccount();
    cli.log('--> Starting a HTTP challenge to get a new SSL certificate (using', myAccount.email, "as recovery email)...");
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

  getAccount() {
    return this.heroku.get('/account');
  }
}

function generateNewCertificate(le, domainsForChallenge, email) {
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

function assertDomainsPresent(domains) {
  if (domains.length == 0) {
    cli.error("There are no custom domains in this Heroku app - nothing to sign");
    process.exit(1);
  }
}


module.exports = {
  topic: 'le',
  command: 'certify',
  description: 'Gets a certificate from Lets encrypt and push it to the heroku application',
  needsApp: true,
  needsAuth: true,
  run: cli.command(co.wrap(runCommand))
};
