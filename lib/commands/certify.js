const cli = require('heroku-cli-util');
const debug = require('debug')('le-certify-command');
const leChallengeProvider = require('./../le-challenge-heroku');
const leChallengeNull = require('./../le-challenge-null');
const letsEncrypt = require('letsencrypt');
const co = require('co');

function* runCommand(context, heroku) {
  cli.log("Run le:certify for app", context.app);

  var appDomains = yield heroku.get('/apps/' + context.app + '/domains');
  cli.log('Got next domains of the app:', appDomains.map(function(d) {
    return d.hostname;
  }).join(', '));
  debug("Detailed information about domains: %o", appDomains);

  var domainForChallenge = appDomains.find(function(d) {
    return d.kind === 'custom';
  }).hostname;
  if (!domainForChallenge) {
    cli.error("Can't find custom domain for subscribe. Please check domains in the Heroku application.");
    return;
  }
  cli.log(domainForChallenge, 'domain was selected for the signing');

  var leChallenge = leChallengeProvider(heroku, context.app);
  var le = letsEncrypt.create({
    server: 'staging',
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
    cli.log('The certificate was found');
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

module.exports = {
  topic: 'le',
  command: 'certify',
  description: 'Gets a certificate from Lets encrypt and push it to the heroku application',
  needsApp: true,
  needsAuth: true,
  run: cli.command(co.wrap(runCommand))
};
