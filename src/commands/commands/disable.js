const { oneLine, stripIndents } = require('common-tags');
const Command = require('../base');
const disambiguation = require('../../util').disambiguation;

module.exports = class DisableCommandCommand extends Command {
    constructor(client) {
        super(client, {
            name: 'disable',
            aliases: ['disable-command', 'cmd-off', 'command-off'],
            group: 'commands',
            memberName: 'disable',
            description: 'Disables a command or command group.',
            details: oneLine`
				The argument must be the name/ID (partial or whole) of a command or command group.
				Only administrators may use this command.
			`,
            examples: ['disable util', 'disable Utility', 'disable prefix'],
            guarded: true,

            args: [
                {
                    key: 'cmdOrGrp',
                    label: 'command/group',
                    prompt: 'Which command or group would you like to disable?',
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
                    prompt: 'How/Where should this command or group be disabled?',
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

    run(msg, { cmdOrGrp, type }) {
        if (cmdOrGrp.guarded) return msg.reply(`You cannot disable the \`${cmdOrGrp.name}\` ${cmdOrGrp.group ? 'command' : 'group'}.`);
        cmdOrGrp.setEnabledIn(msg.guild, false, type);
        return msg.reply(`Disabled the \`${cmdOrGrp.name}\` ${cmdOrGrp.group ? 'command' : 'group'} for type: ${type}.`);
    }
};
