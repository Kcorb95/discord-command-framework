const { oneLine, stripIndents } = require('common-tags');
const Command = require('../base');
const disambiguation = require('../../util').disambiguation;

module.exports = class EnableCommandCommand extends Command {
    constructor(client) {
        super(client, {
            name: 'enable',
            aliases: ['enable-command', 'cmd-on', 'command-on'],
            group: 'commands',
            memberName: 'enable',
            description: 'Enables a command or command group.',
            details: oneLine`
				The argument must be the name/ID (partial or whole) of a command or command group.
				Only administrators may use this command.
			`,
            examples: ['enable util', 'enable Utility', 'enable prefix'],
            guarded: true,

            args: [
                {
                    key: 'cmdOrGrp',
                    label: 'command/group',
                    prompt: 'Which command or group would you like to enable?',
                    validate: val => {
                        if (!val) return false;
                        const groups = this.client.registry.findGroups(val);
                        if (groups.length === 1) return true;
                        const commands = this.client.registry.findCommands(val);
                        if (commands.length === 1) return true;
                        if (commands.length === 0 && groups.length === 0) return false;
                        return stripIndents`
							${commands.length > 1 ? disambiguation(commands, 'commands') : ''}
							${groups.length > 1 ? disambiguation(groups, 'groups') : ''}
						`;
                    },
                    parse: val => this.client.registry.findGroups(val)[0] || this.client.registry.findCommands(val)[0]
                },
                {
                    key: 'type',
                    label: 'permission type',
                    prompt: 'How/Where should this command or group be enabled?',
                    type: 'permission',
                    default: 'server'
                }
            ]
        });
    }

    hasPermission(msg) {
        if (!msg.guild) return this.client.isOwner(msg.author);
        return msg.member.hasPermission('ADMINISTRATOR') || this.client.isOwner(msg.author);
    }

    async run(msg, { cmdOrGrp, type }) {
        cmdOrGrp.setEnabledIn(msg.guild, true, type);
        return msg.reply(`Enabled the \`${cmdOrGrp.name}\` ${cmdOrGrp.group ? 'command' : 'group'} for type: ${type}.`);
    }
};
