const commando = require('../../../src');

module.exports = class EchoCommand extends commando.Command {
    constructor(client) {
        super(client, {
            name: 'zz',
            group: 'testing',
            memberName: 'zz',
            description: 'Echos text back',
            details: `Echos text back`
        });
    }

    async run(msg) {
        msg.reply('ZZ Ran successfully!');
    }
};