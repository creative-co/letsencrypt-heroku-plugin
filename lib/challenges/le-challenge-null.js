'use strict';

module.exports = {
  set: function(args, domain, challengeId, keyAuthorization, callback) {},

  get: function(defaults, domain, challengeId, callback) {},

  remove: function(defaults, domain, challengeId, callback) {},

  getOptions: function() {
    return {};
  },

  test: function(opts, domain, token, keyAuthorization, cb) {},

  loopback: function(opts, domain, token, cb) {}
};
