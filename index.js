'use strict';

module.exports.topic = {
  name: 'letsencrypt',
  description: 'Heroku plugin which implements ACME protocol to generate SSL certificates via LetsEncrypt and update Heroku SNI endpoints'
};

module.exports.commands = [
  require('./lib/commands/run')
];
