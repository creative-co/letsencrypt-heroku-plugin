const cli = require('heroku-cli-util');
const debug = require('debug')('le-certify-command');
const leChallengeProvider = require('./../le-challenge-heroku');
const letsEncrypt = require('letsencrypt');
const co = require('co');

function* runCommand(context, heroku) {
    debug("Run le:certify for app %s", context.app);

    var appDomains = yield heroku.get('/apps/' + context.app + '/domains');
    debug("Got next domains of app: %o", appDomains);

    var domainForChallenge = appDomains[1].hostname;
    debug("Start a challenge for the domain: %s", domainForChallenge);

    var leChallenge = leChallengeProvider(heroku, context.app);
    var le = letsEncrypt.create({
        server: 'staging',
        challenges: {'http-01': leChallenge},
        challengeType: 'http-01'
    });

    var certificate = yield le.register({domains: [domainForChallenge], email: 'user@email.com', agreeTos: true});
    yield heroku.post('/apps/' + context.app + '/sni-endpoints',
        {
            body: {
                certificate_chain: certificate.cert,
                private_key: certificate.privkey
            }
        });

    console.log('DONE!');
}

module.exports = {
    topic: 'le',
    command: 'certify',
    description: 'Gets a certificate from Lets encrypt and push it to the heroku application',
    needsApp: true,
    needsAuth: true,
    run: cli.command(co.wrap(runCommand))
};