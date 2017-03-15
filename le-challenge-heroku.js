/**
 * Created by anetrebsky on 15/03/17.
 */
'use strict';
var db = {};
var fs = require('fs');
var path = require('path');
var heroku = null;
var appId = null;

var myDefaults = {
    //webrootPath: [ '~', 'letsencrypt', 'var', 'lib' ].join(path.sep)
    webrootPath: path.join(require('os').tmpdir(), 'acme-challenge')
    , loopbackTimeout: 5 * 1000
    , debug: false
};

var Challenge = module.exports;

Challenge.create = function (options) {
    var results = {};

    Object.keys(Challenge).forEach(function (key) {
        results[key] = Challenge[key];
    });
    results.create = undefined;

    Object.keys(myDefaults).forEach(function (key) {
        if ('undefined' === typeof options[key]) {
            options[key] = myDefaults[key];
        }
    });
    results._options = options;

    results.getOptions = function () {
        return results._options;
    };

    heroku = options.heroku;
    appId = options.appId;

    return results;
};

//
// NOTE: the "args" here in `set()` are NOT accessible to `get()` and `remove()`
// They are provided so that you can store them in an implementation-specific way
// if you need access to them.
//
Challenge.set = function (args, domain, challengePath, keyAuthorization, done) {
    console.log('Challenge.set: ' + keyAuthorization);
    // keyAuthorization = String(keyAuthorization);
    console.log('appId: ' + appId);
    heroku.patch('/apps/'+appId+'/config-vars', {
        body: { 'LETS_ENCRYPT_CHALLENGE' : keyAuthorization }
    }).then(function() {
        console.log('restarting dynos...');
        setTimeout(function() {
            heroku.delete('/apps/'+appId+'/dynos').then(function() {
                console.log('Dynos were restarted');
                setTimeout(function() {
                    done();
                }, 5000);

            }, done);
        }, 1000);
    }, function(error) {
        console.log(error);
        done(error);
    });


    // db[challengePath] = keyAuthorization;

    // done(null);
    // var mkdirp = require('mkdirp');
    // mkdirp(args.webrootPath, function (err) {
    //     if (err) {
    //         done(err);
    //         return;
    //     }
    //
    //     fs.writeFile(path.join(args.webrootPath, challengePath), keyAuthorization, 'utf8', function (err) {
    //         done(err);
    //     });
    // });
};


//
// NOTE: the "defaults" here are still merged and templated, just like "args" would be,
// but if you specifically need "args" you must retrieve them from some storage mechanism
// based on domain and key
//
Challenge.get = function (defaults, domain, key, done) {
    console.log('Challenge.get: ' + key);
    // done(null, db[key]);
    // fs.readFile(path.join(defaults.webrootPath, key), 'utf8', done);
};

Challenge.remove = function (defaults, domain, key, done) {
    console.log('Challenge.remove: ' + key);
    // db[key] = null;
    // done(null);
    // fs.unlink(path.join(defaults.webrootPath, key), done);
};

Challenge.loopback = function (opts, domain, token, key, done) {
    // console.log('loopback');
    // // cb(null, db[token]);
    // var hostname = domain + (defaults.loopbackPort ? ':' + defaults.loopbackPort : '');
    // var urlstr = 'http://' + hostname + '/.well-known/acme-challenge/' + key;
    //
    // require('http').get(urlstr, function (res) {
    //     if (200 !== res.statusCode) {
    //         done(new Error("local loopback failed with statusCode " + res.statusCode));
    //         return;
    //     }
    //     var chunks = [];
    //     res.on('data', function (chunk) {
    //         chunks.push(chunk);
    //     });
    //     res.on('end', function () {
    //         var str = Buffer.concat(chunks).toString('utf8').trim();
    //         done(null, str);
    //     });
    // }).setTimeout(defaults.loopbackTimeout, function () {
    //     done(new Error("loopback timeout, could not reach server"));
    // }).on('error', function (err) {
    //     done(err);
    // });
};
//
// Challenge.test = function (args, domain, challenge, keyAuthorization, done) {
//     console.log('TEST');
//     var me = this;
//     var key = keyAuthorization || challenge;
//
//     me.set(args, domain, challenge, key, function (err) {
//         if (err) { done(err); return; }
//
//         myDefaults.loopbackPort = args.loopbackPort;
//         myDefaults.webrootPath = args.webrootPath;
//         me.loopback(args, domain, challenge, function (err, _key) {
//             if (err) { done(err); return; }
//
//             if (key !== _key) {
//                 err = new Error("keyAuthorization [original] '" + key + "'"
//                     + " did not match [result] '" + _key + "'");
//                 return;
//             }
//
//             me.remove(myDefaults, domain, challenge, function (_err) {
//                 if (_err) { done(_err); return; }
//
//                 done(err);
//             });
//         });
//     });
// };
