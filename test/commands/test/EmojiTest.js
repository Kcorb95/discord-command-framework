const commando = require('../../../src');

module.exports = class EchoCommand extends commando.Command {
    constructor(client) {
        super(client, {
            name: 'emojitest',
            group: 'testing',
            memberName: 'emojitest',
            description: 'Echos text back',
            details: `Echos text back`,
            args: [
                {
                    key: 'emoji',
                    prompt: 'Enter an Emoji.',
                    type: 'emoji'
                }
            ]
        });
    }

    async run(msg, { emoji }) {
        emoji = emoji.id ? `<:${emoji.identifier}>` : emoji;
        msg.reply(emoji);
    }
};