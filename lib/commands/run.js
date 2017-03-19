const cli = require('heroku-cli-util');
const co = require('co');

const leChallengeHeroku = require('../challenges/le-challenge-heroku-redis');
const leChallengeNull = require('../challenges/le-challenge-null');
const letsEncrypt = require('greenlock');
const x509 = require('x509.js');

const HerokuApi = require('../utils/heroku-api')

const LETSENCRYPT_SERVER = process.env.LETSENCRYPT_SERVER || "production";
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

  if (sslEndpoints.length > 0 && !context.flags.force) { // because --force CLI flag means we ignore the existing certificate
    if (existingCertificateIsOk(sslEndpoints[0].certificate_chain, domainsForChallenge, EXPIRATION_THRESHOLD)) {
      cli.log(`----> The expiration threshold is ${EXPIRATION_THRESHOLD} days. Nothing to do, exiting.`);
      process.exit(0); // successful path
    }
  }

  cli.log(`--> Obtaining a new SSL certificate for ${domainsForChallenge}`);
  const myAccount = yield herokuApi.getAccount();
  const le = setupLetsEncrypt(LETSENCRYPT_SERVER, leChallengeHeroku(redisUrl));
  certificate = yield generateNewCertificate(le, domainsForChallenge, myAccount.email);

  if (certificateIsStaging(certificate)) {
    cli.log("*******************************************************************");
    cli.log("WARNING: THIS IS A STAGING CERTIFICATE (NOT GENERALLY TRUSTED)")
    cli.log("If that's not expected, reset certbot cache:  rm -rf ~/letsencrypt/")
    cli.log("*******************************************************************");
  }

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

  process.exit(0); // b/o redis or something else locking the event loop
}


//**************** HELPER FUNCTIONS ************************

function generateNewCertificate(le, domainsForChallenge, email) {
  cli.log('----> Starting a HTTP challenge to get a new SSL certificate (using', email, "as recovery email)...");
  cli.log('----> This may take a minute, please be patient...')
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
    debug: !!process.env.LETSENCRYPT_DEBUG
  });
}

// TODO: check if domains are covered
function existingCertificateIsOk(rawCertData, domains, threshold) {
  const DAY_IN_MS = 3600 * 24 * 1000;
  const existingCert = x509.parseCert(rawCertData);
  const expirationDate = Date.parse(existingCert.notAfter);
  const remainingDays = Math.floor((expirationDate - Date.now()) / DAY_IN_MS);
  cli.log(`----> Existing certificate found, expires in ${remainingDays} day(s)`);
  return remainingDays >= threshold;
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

function certificateIsStaging(certificate) {
  const parsed = x509.parseCert(certificate.cert);
  return parsed.issuer.commonName.match(/^Fake/) || (parsed.ocspList[0] || '').match(/stg/);
}

module.exports = {
  topic: 'letsencrypt',
  command: 'run',
  description: 'Gets a certificate from Lets encrypt and push it to the heroku application',
  needsApp: true,
  needsAuth: true,
  flags: [
    {name: 'force', char: 'f', description: 'Runs even if the current certificate is fresh already', hasValue: false}
  ],
  run: cli.command(co.wrap(runCommand))
};
