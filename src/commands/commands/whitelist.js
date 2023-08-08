const { oneLine, stripIndents } = require('common-tags');
const Command = require('../base');
const disambiguation = require('../../util').disambiguation;

module.exports = class WhitelistCommandCommand extends Command {
    constructor(client) {
        super(client, {
            name: 'whitelist',
            aliases: ['togglewhitelist', 'toggle-whitelist'],
            group: 'commands',
            memberName: 'whitelist',
            description: 'Toggles the whitelisting of roles for a command or command group so that only the users with the whitelisted role may use it.',
            details: oneLine`
				The argument must be the name/ID (partial or whole) of a command or command group.
				Only administrators may use this command.
			`,
            examples: ['whitelist util true', 'whitelist Utility false', 'whitelist kick true'],
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
                    key: 'toggle',
                    label: 'whitelist on/off',
                    prompt: 'Should whitelist be set to true or false?',
                    type: 'boolean',
                    default: 'true'
                },
                {
                    key: 'type',
                    label: 'whitelist channel or role?',
                    prompt: 'Should the command/group be whitelisted in channels or roles? (\'c\' or \'r\')',
                    validate: val => {
                        if (!val) return false;
                        if (val === 'c' || val === 'chan' || val === 'channel' || val === 'r' || val === 'role' || val === 'channels' || val === 'roles') return true;
                        return `Please enter a valid type: 'c' or 'r'`;
                    },
                    type: 'string'
                }
            ]
        });
    }

    hasPermission(msg) {
        if (!msg.guild) return this.client.isOwner(msg.author);
        return msg.member.hasPermission('ADMINISTRATOR') || this.client.isOwner(msg.author);
    }

    async run(msg, { cmdOrGrp, toggle, type }) {
        if (cmdOrGrp.guarded) return msg.reply(`You cannot modify the whitelist for guarded commands`);

        if (type === 'c' || type === 'chan' || type === 'channel' || type === 'channels') {
            type = 'channels';
            cmdOrGrp.whitelist.channels = toggle;
        } else if (type === 'r' || type === 'role' || type === 'roles') {
            type = 'roles';
            cmdOrGrp.whitelist.roles = toggle;
        }

        if (cmdOrGrp.group) this.client.emit('commandWhitelistChange', msg.guild, cmdOrGrp, toggle, type);
        else this.client.emit('groupWhitelistChange', msg.guild, cmdOrGrp, toggle, type);

        return msg.reply(`Whitelist for \`${cmdOrGrp.name}\` ${cmdOrGrp.group ? 'command' : 'group'} has been set to ${toggle} with type: ${type}.`);
    }
};
