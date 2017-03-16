'use strict';


module.exports.topic = {
    name: 'le',
    description: 'Lets encrypt plugin'
};

module.exports.commands = [
    require('./lib/commands/certify')
];