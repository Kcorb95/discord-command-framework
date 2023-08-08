const commando = require('../../../src');

module.exports = class EchoCommand extends commando.Command {
    constructor(client) {
        super(client, {
            name: 'xx',
            group: 'testing',
            memberName: 'xx',
            description: 'Echos text back',
            details: `Echos text back`,
            whitelist: { roles: true, channels: false }
        });
    }

    async run(msg) {
        msg.reply('XX ran successfully!');
    }
};