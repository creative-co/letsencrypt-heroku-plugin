const cli = require('heroku-cli-util');
const debug = require('debug')('le-certify-command');
const leChallengeProvider = require('../le-challenge-heroku');
const leChallengeNull = require('../le-challenge-null');
const letsEncrypt = require('letsencrypt');
const co = require('co');


const LETSENCRYPT_SERVER = process.env.LETSENCRYPT_SERVER || "staging"; // TODO - use production server

function* runCommand(context, heroku) {
  const hc = new HerokuContext(context, heroku);

  cli.log("Run le:certify for app", context.app);
  const domainsForChallenge = yield hc.getCustomDomainsList(context.app);
  assertDomainsPresent(domainsForChallenge);

  // TODO: support multiple domains
  const domainForChallenge = domainsForChallenge[0].hostname;
  cli.log(domainForChallenge, 'domain was selected for signing (TODO: support multiple domains in the future)');

  var leChallenge = leChallengeProvider(heroku, context.app);
  var le = letsEncrypt.create({
    server: LETSENCRYPT_SERVER,
    challenges: {
      'http-01': leChallenge,
      'tls-sni-01': leChallengeNull
    },
    challengeType: 'http-01',
    debug: false
  });

  cli.log("Seeking a certificate in the local storage...");
  var certificate = yield le.check({
    domains: [domainForChallenge]
  });
  if (!certificate) {
    cli.log('There is no certificate.');
    cli.log('Start a challenge to get a new certificate');
    var certificate = yield le.register({
      domains: [domainForChallenge],
      email: 'user@email.com',
      agreeTos: true
    });
  } else {
    cli.log('A fresh certificate was found for ', domainForChallenge);
  }
  debug("Certificate: %o", certificate);

  cli.log('Publishing the certificate to the Heroku application...');
  yield heroku.post('/apps/' + context.app + '/sni-endpoints', {
    body: {
      certificate_chain: certificate.cert,
      private_key: certificate.privkey
    }
  });

  cli.log('done');
}



//**************** HELPER CLASSES & METHODS ************************
class Context {
  constructor(context, heroku) {
    this.context = context;
    this.heroku = heroku;
  }
}

class HerokuContext extends Context {
  getCustomDomainsList() {
    const takeCustomDomains = arr => arr.filter(domain => domain.kind == 'custom');
    return this.heroku.get('/apps/' + this.context.app + '/domains').then(takeCustomDomains);
  }
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
