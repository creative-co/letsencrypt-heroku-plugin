'use strict';

// const cli = require('heroku-cli-util');
const got = require('got');
const redis = require('redis');
const bluebird = require('bluebird');
const depromisify = require('../utils/depromisify');
bluebird.promisifyAll(redis.RedisClient.prototype);

// this is where challenges map will be stored in Heroku Redis
const redisKey = challengeId => `/.well-known/acme-challenge/${challengeId}`;

module.exports = function(redisUrl) {
  const redisClient = redis.createClient(redisUrl);

  return {
    set: depromisify((args, domain, challengeId, keyAuthorization) => {
      return redisClient.setAsync(redisKey(challengeId), keyAuthorization);
    }),

    get: depromisify((defaults, domain, challengeId) => {
      return redisClient.getAsync(redisKey(challengeId));
    }),

    remove: depromisify((defaults, domain, challengeId) => {
      return redisClient.delAsync(redisKey(challengeId))
    }),

    loopback: depromisify((opts, domain, challengeId) => {
      return got(`http://${domain}/.well-known/acme-challenge/${challengeId}`).then(response => response.body)
    }),

    test: depromisify((opts, domain, challengeId, keyAuthorization) => {
      return got(`http://${domain}/.well-known/acme-challenge/${challengeId}`).then(response => response.body == keyAuthorization)
    }),

    getOptions: function() {
      return { redisUrl };
    }
  }
};
