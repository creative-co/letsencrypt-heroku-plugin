'use strict';
/**
 * @description This is heroku challenger for Let's encrypt bot.
 * To pass a challenge it sets config variable 'LETS_ENCRYPT_CHALLENGE' into heroku application
 * and further Let's encrypt service tries to get the value via GET request.
 *
 * @see Example was taken from here https://github.com/Daplie/le-challenge-webroot
 */

const WAITING_SERVER_TIMEOUT = 600000; // Timeout to wait until a server rise after restarting

const cli = require('heroku-cli-util');
const debug = require('debug')('le-challenge-heroku');
const httpClient = require('request');
const co = require('co');

module.exports = function (herokuClient, herokuAppId) {
    {
        var herokuClient = herokuClient;
        var herokuAppId = herokuAppId;

        return {
            set: function (args, domain, challengeId, keyAuthorization, callback) {
                debug('set(domain: %s, challenge: %s, key: %s)', domain, challengeId, keyAuthorization);
                co(
                    function*() {
                        cli.log("Updating LETS_ENCRYPT_CHALLENGE variable in the configuration to", keyAuthorization, "...");
                        yield herokuClient.patch('/apps/' + herokuAppId + '/config-vars',
                            {
                                body: {
                                    LETS_ENCRYPT_CHALLENGE: keyAuthorization
                                }
                            });
                        cli.log("Restarting Heroku's dynos...");
                        yield herokuClient.delete('/apps/' + herokuAppId + '/dynos');
                        cli.log("Waiting starting Heroku's dynos...");
                        yield waitUntilServerRespond(domain, challengeId);
                        callback();
                    })
                    .catch(callback);
            },

            get: function (defaults, domain, challengeId, callback) {
                debug('get(domain: %s, challenge: %s). !NOT IMPLEMENTED!', domain, challengeId);
                // TODO: this method is pointed in interface but I'm not sure why it need for
            },

            remove: function (defaults, domain, challengeId, callback) {
                debug('remove(domain: %s, challenge: %s)', domain, challengeId);
                cli.log('Removing LETS_ENCRYPT_CHALLENGE variable from configuration...');
                co(
                    function*() {
                        yield herokuClient.patch('/apps/' + herokuAppId + '/config-vars',
                            {
                                body: {
                                    LETS_ENCRYPT_CHALLENGE: null
                                }
                            });
                    })
                    .catch(callback);
            },

            getOptions: function () {
                return {
                    appId: herokuAppId,
                    heroku: herokuClient
                }
            },

            loopback: function (opts, domain, token, keyAuthorization, cb) {
                debug('looback !NOT IMPLEMENTED!');
                // TODO: this method is pointed in interface but I'm not sure why it need for
            }
        }
    }
};

function waitUntilServerRespond(domain, challengeId) {
    debug('Waiting until server respond...');
    return new Promise(function (resolve, reject) {
        var waitingStartTime = +new Date();
        var url = 'http://' + domain + '/.well-known/acme-challenge/' + challengeId;
        sendTestRequestToServer(url, resolve, reject, waitingStartTime);
    });
}

function sendTestRequestToServer(url, resolveCb, rejectCb, waitingStartTime) {
    debug('Sending test request to the server...');
    httpClient.get(
        url,
        function (error, result, responseBody) {
            if (error) {
                debug('Arrived response from the server with error %o', error);
                var now = +new Date();
                if (now - waitingStartTime > WAITING_SERVER_TIMEOUT) {
                    debug('Timeout for waiting correct response from the server was elapsed. Waiting is finished.');
                    rejectCb(new Error("Timeout for waiting correct response from the server was elapsed. The last code of the respond: " + result.statusCode));
                }
                else {
                    debug('New attempt was scheduled to get a respond from the server');
                    setTimeout(function () {
                        sendTestRequestToServer(hostname, resolveCb, rejectCb, waitingStartTime);
                    }, 5000);
                }
            }
            else {
                debug('Arrived correct response from the server. Waiting is finished.');
                resolveCb();
            }
        });
}
