const cli = require('heroku-cli-util');

module.exports.topic = {
    name: 'le',
    description: 'lets encrypt plugin'
};

module.exports.commands = [
    {
        topic: 'le',
        command: 'cert',
        description: 'create cert',
        help: 'help for create cert',
        needsApp: true,
        needsAuth: true,
        run: cli.command(function (context, heroku) {
            console.log(context.app);
            return heroku.get('/apps/' + context.app + '/domains').then(function (domains) {
                // console.log(domains);
                // return;
                var domain = domains[1].hostname;

                var leChallenge = require('./le-challenge-heroku').create({
                    webrootPath: '~/letsencrypt/var/',
                    appId: context.app,
                    debug: false,
                    heroku: heroku
                });
                var le = require('letsencrypt').create({
                    server: 'staging',
                    challenges: {'http-01': leChallenge},
                    challengeType: 'http-01'
                });
                var opts = {
                    domains: [domain], email: 'user@email.com', agreeTos: true
                };
                le.register(opts).then(function (certs) {
                    console.log(certs);
                    heroku.post('/apps/' + context.app + '/sni-endpoints', {
                        body: {
                            certificate_chain: certs.cert,
                            private_key: certs.privkey
                        }
                    }).then(function () {
                        console.log('DONE!');
                    }, function (error) {
                        console.log(error);
                    });
                    // POST /apps/{app_id_or_name}/sni-endpoints

                    // privkey, cert, chain, expiresAt, issuedAt, subject, altnames
                }, function (err) {
                    console.error(err);
                });
            });

        })
    }
];
