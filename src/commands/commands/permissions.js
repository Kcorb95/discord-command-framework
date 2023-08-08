const { oneLine, stripIndents } = require('common-tags');
const Command = require('../base');
const disambiguation = require('../../util').disambiguation;
const { MessageEmbed } = require('discord.js');
const ChannelType = require('../../../src/types/channel');
const RoleType = require('../../../src/types/role');

module.exports = class PermissionInfoCommand extends Command {
    constructor(client) {
        super(client, {
            name: 'permissions',
            aliases: ['perms', 'perm', 'permsinfo', 'permission', 'perminfo'],
            group: 'commands',
            memberName: 'permissions',
            description: 'Details the permissions for a role/channel or command/group',
            details: oneLine`
				The argument must be the name/ID (partial or whole) of a command/command group, role, channel or server.
				Only administrators may use this command.`,
            examples: ['perms kick', 'perms general', 'perms admin'],
            guarded: true,
            args: [
                {
                    key: 'permission',
                    label: 'argument',
                    prompt: 'Which permissions would you like to view? (Enter a command/group, channel/role or \'all\')',
                    validate: (value, msg) => {
                        if (!value) return false;
                        if (value === 'all') return true;
                        const channelType = new ChannelType(this.client);
                        const roleType = new RoleType(this.client);
                        if (channelType.validate(value, msg)) return true;
                        else if (roleType.validate(value, msg)) return true;
                        const groups = this.client.registry.findGroups(value);
                        if (groups.length === 1) return true;
                        const commands = this.client.registry.findCommands(value);
                        if (commands.length === 1) return true;
                        if (commands.length === 0 && groups.length === 0) return false;
                        return stripIndents`
										${commands.length > 1 ? disambiguation(commands, 'commands') : ''}
										${groups.length > 1 ? disambiguation(groups, 'groups') : ''}`;
                    },
                    parse: (value, msg) => {
                        const channelType = new ChannelType(this.client);
                        const roleType = new RoleType(this.client);
                        return channelType.parse(value, msg) || roleType.parse(value, msg) || this.client.registry.findGroups(value)[0] || this.client.registry.findCommands(value)[0] || 'all';
                    },
                    type: 'string'
                }]
        });
    }

    hasPermission(msg) {
        if (!msg.guild) return this.client.isOwner(msg.author);
        return msg.member.hasPermission('ADMINISTRATOR') || this.client.isOwner(msg.author);
    }

    async run(msg, { permission }) {
        let embed = new MessageEmbed();


        if (permission === 'all') {
            let commandsEnabled;
            let commandsEnabledChannel;
            let commandsEnabledRole;
            let groupsEnabled;
            let groupsEnabledChannel;
            let groupsEnabledRole;

            if (this.client.guilds.get(msg.guild.id)._commandsEnabled) commandsEnabled = await this.client.guilds.get(msg.guild.id)._commandsEnabled;
            if (this.client.guilds.get(msg.guild.id)._commandsEnabledChannel) commandsEnabledChannel = await this.client.guilds.get(msg.guild.id)._commandsEnabledChannel;
            if (this.client.guilds.get(msg.guild.id)._commandsEnabledRoles) commandsEnabledRole = await this.client.guilds.get(msg.guild.id)._commandsEnabledRoles;

            if (this.client.guilds.get(msg.guild.id)._groupsEnabled) groupsEnabled = await this.client.guilds.get(msg.guild.id)._groupsEnabled;
            if (this.client.guilds.get(msg.guild.id)._groupsEnabledChannels) groupsEnabledChannel = await this.client.guilds.get(msg.guild.id)._groupsEnabledChannels;
            if (this.client.guilds.get(msg.guild.id)._groupsEnabledRoles) groupsEnabledRole = await this.client.guilds.get(msg.guild.id)._groupsEnabledRoles;

            let commandsServer = ``;
            let commandsChannel = ``;
            let commandsRole = ``;
            let groupsServer = ``;
            let groupsChannel = ``;
            let groupsRole = ``;
            let groupsWhitelistRole = ``;
            let groupsWhitelistChannel = ``;
            let commandsWhitelistRole = ``;
            let commandsWhitelistChannel = ``;

            const groups = this.client.registry.groups;
            groups.map(grp => {
                handleGroup(grp);
                grp.commands.map(cmd => {
                    handleCommand(cmd);
                });
            });


            function handleGroup(group) {
                let groupID = group.id;
                if (!groupsEnabled) groupsServer = `None!`;
                else for (const key of Object.keys(groupsEnabled))
                    if (typeof groupsEnabled[key] !== 'undefined' && !groupsServer.includes(key)) groupsServer = `${groupsServer}\n• **${key}** -- ${groupsEnabled[key] ? 'enabled' : 'disabled'}`;

                if (!groupsEnabledChannel) groupsChannel = `None!`;
                else for (const key of Object.keys(groupsEnabledChannel))
                    if (typeof groupsEnabledChannel[key][groupID] !== 'undefined') groupsChannel = `${groupsChannel}\n• **${groupID}:** ${msg.guild.channels.get(key)} -- ${groupsEnabledChannel[key][groupID] ? 'enabled' : 'disabled'}`;

                if (!groupsEnabledRole) groupsRole = `None!`;
                else if (groupsEnabledRole[groupID])
                    for (const key of Object.keys(groupsEnabledRole[groupID]))
                        if (typeof groupsEnabledRole[groupID][key] !== 'undefined') groupsRole = `${groupsRole}\n• **${groupID}:** ${msg.guild.roles.get(key)} -- ${groupsEnabledRole[groupID][key] ? 'enabled' : 'disabled'}`;

                if (group.whitelist.channels) groupsWhitelistChannel = `${groupsWhitelistChannel}\n • **${groupID} - channel:** ${group.whitelist.channels}`;
                if (group.whitelist.roles) groupsWhitelistRole = `${groupsWhitelistRole}\n • **${groupID} - role:** ${group.whitelist.roles}`;
            }

            function handleCommand(command) {
                let commandName = command.name;
                if (!commandsEnabled) commandsServer = `None!`;
                else for (const key of Object.keys(commandsEnabled))
                    if (typeof commandsEnabled[key] !== 'undefined' && !commandsServer.includes(key)) commandsServer = `${commandsServer}\n• **${key}** -- ${commandsEnabled[key] ? 'enabled' : 'disabled'}`;

                if (!commandsEnabledChannel) commandsChannel = `None!`;
                else for (const key of Object.keys(commandsEnabledChannel))
                    if (typeof commandsEnabledChannel[key][commandName] !== 'undefined') commandsChannel = `${commandsChannel}\n• **${commandName}:** ${msg.guild.channels.get(key)} -- ${commandsEnabledChannel[key][commandName] ? 'enabled' : 'disabled'}`;

                if (!commandsEnabledRole) commandsRole = `None!`;
                else if (commandsEnabledRole[commandName])
                    for (const key of Object.keys(commandsEnabledRole[commandName]))
                        if (typeof commandsEnabledRole[commandName][key] !== 'undefined') commandsRole = `${commandsRole}\n• **${commandName}:** ${msg.guild.roles.get(key)} -- ${commandsEnabledRole[commandName][key] ? 'enabled' : 'disabled'}`;

                if (command.whitelist.channels) commandsWhitelistChannel = `${commandsWhitelistChannel}\n • **${commandName} - channel:** ${command.whitelist.channels}`;
                if (command.whitelist.roles) commandsWhitelistRole = `${commandsWhitelistRole}\n • **${commandName} - role:** ${command.whitelist.roles}`;
            }

            if (groupsWhitelistRole === `` && commandsWhitelistRole === ``) {
                groupsWhitelistRole = `--`;
                commandsWhitelistRole = `--`;
            }
            if (groupsWhitelistChannel === `` && commandsWhitelistChannel === ``) {
                groupsWhitelistChannel = `--`;
                commandsWhitelistChannel = `--`;
            }

            embed.setColor('#6000FF')
                .setDescription(`Permissions for server **${msg.guild}** (${msg.guild.id})`)
                .addField('Server Commands:', `${commandsServer}`, true)
                .addField('Server Groups:', `${groupsServer}`, true)
                .addBlankField(false)
                .addField('Channel Commands:', `${commandsChannel}`, true)
                .addField('Channel Groups:', `${groupsChannel}`, true)
                .addBlankField(false)
                .addField('Role Commands:', `${commandsRole}`, true)
                .addField('Role Groups:', `${groupsRole}`, true)
                .addBlankField(false)
                .addField('Whitelisted Commands:', `${commandsWhitelistRole} \n ${commandsWhitelistChannel}`, true)
                .addField('Whitelisted Groups:', `${groupsWhitelistRole} \n ${groupsWhitelistChannel}`, true);

            /**
             * *****************
             * This is a command
             * *****************
             */
        } else if (permission.group) {
            let commandsEnabled;
            let commandsEnabledChannel;
            let commandsEnabledRole;
            if (this.client.guilds.get(msg.guild.id)._commandsEnabled) commandsEnabled = await this.client.guilds.get(msg.guild.id)._commandsEnabled;
            if (this.client.guilds.get(msg.guild.id)._commandsEnabledChannel) commandsEnabledChannel = await this.client.guilds.get(msg.guild.id)._commandsEnabledChannel;
            if (this.client.guilds.get(msg.guild.id)._commandsEnabledRoles) commandsEnabledRole = await this.client.guilds.get(msg.guild.id)._commandsEnabledRoles;
            let server = ``;
            let channel = ``;
            let role = ``;

            if (!commandsEnabled || typeof commandsEnabled[permission.name] === 'undefined') server = `None!`;
            else server = `• **${permission.name}** -- ${commandsEnabled[permission.name] ? 'enabled' : 'disabled'}`;
            if (!commandsEnabledChannel) channel = `None!`;
            else for (const key of Object.keys(commandsEnabledChannel))
                if (typeof commandsEnabledChannel[key][permission.name] !== 'undefined') channel = `${channel}\n• **${msg.guild.channels.get(key)}** -- ${commandsEnabledChannel[key][permission.name] ? 'enabled' : 'disabled'}`;
            if (!commandsEnabledRole || !commandsEnabledRole[permission.name]) role = `None!`;
            else for (const key of Object.keys(commandsEnabledRole[permission.name]))
                if (typeof commandsEnabledRole[permission.name][key] !== 'undefined') role = `${role}\n• ${msg.guild.roles.get(key)} -- ${commandsEnabledRole[permission.name][key] ? 'enabled' : 'disabled'}`;

            embed.setColor('#6000FF')
                .setDescription(`Permissions for command **${permission.name}**`)
                .addField('Server:', `${server}`, true);
            if (permission.guarded) embed.addField(`**Guarded!**`, `Enabled Globally!`, true);
            else embed.addField('Whitelisted:', `**Roles:** ${permission.whitelist.roles} \n**Channels:** ${permission.whitelist.channels}`, true)
                .addField('Channels:', `${channel}`, false)
                .addField('Roles:', `${role}`, false);

            /**
             * ***************
             * This is a group
             * ***************
             */
        } else if (permission.commands) {
            let groupsEnabled;
            let groupsEnabledChannel;
            let groupsEnabledRole;
            if (this.client.guilds.get(msg.guild.id)._groupsEnabled) groupsEnabled = await this.client.guilds.get(msg.guild.id)._groupsEnabled;
            if (this.client.guilds.get(msg.guild.id)._groupsEnabledChannels) groupsEnabledChannel = await this.client.guilds.get(msg.guild.id)._groupsEnabledChannels;
            if (this.client.guilds.get(msg.guild.id)._groupsEnabledRoles) groupsEnabledRole = await this.client.guilds.get(msg.guild.id)._groupsEnabledRoles;
            let server = ``;
            let channel = ``;
            let role = ``;

            if (!groupsEnabled || typeof groupsEnabled[permission.id] === 'undefined') server = `None!`;
            else server = `• **${permission.id}** -- ${groupsEnabled[permission.id] ? 'enabled' : 'disabled'}`;
            if (!groupsEnabledChannel) channel = `None!`;
            else for (const key of Object.keys(groupsEnabledChannel))
                if (typeof groupsEnabledChannel[key][permission.id] !== 'undefined') channel = `${channel}\n• **${msg.guild.channels.get(key)}** -- ${groupsEnabledChannel[key][permission.id] ? 'enabled' : 'disabled'}`;
            if (!groupsEnabledRole) role = `None!`;
            else for (const key of Object.keys(groupsEnabledRole[permission.id]))
                if (typeof groupsEnabledRole[permission.id][key] !== 'undefined') role = `${role}\n• ${msg.guild.roles.get(key)} -- ${groupsEnabledRole[permission.id][key] ? 'enabled' : 'disabled'}`;

            embed.setColor('#6000FF')
                .setDescription(`Permissions for group **${permission.id}**`)
                .addField('Server:', `${server}`, true);
            if (permission.guarded) embed.addField(`**Guarded!**`, `Enabled Globally!`, true);
            else embed.addField('Whitelisted:', `**Roles:** ${permission.whitelist.roles} \n**Channels:** ${permission.whitelist.channels}`, true).addField('Channels:', `${channel}`, false)
                .addField('Roles:', `${role}`, false);

            /**
             * *****************
             * This is a channel
             * *****************
             */
        } else if (permission.messages) {
            let commandsEnabledChannel;
            let groupsEnabledChannel;
            if (this.client.guilds.get(msg.guild.id)._commandsEnabledChannel) commandsEnabledChannel = await this.client.guilds.get(msg.guild.id)._commandsEnabledChannel[permission.id];
            if (this.client.guilds.get(msg.guild.id)._groupsEnabledChannels) groupsEnabledChannel = await this.client.guilds.get(msg.guild.id)._groupsEnabledChannels[permission.id];
            let commands = ``;
            let groups = ``;

            if (!commandsEnabledChannel) commands = `None!`;
            else for (const key of Object.keys(commandsEnabledChannel))
                if (typeof commandsEnabledChannel[key] !== 'undefined') commands = `${commands}\n• **${key}** -- ${commandsEnabledChannel[key] ? 'enabled' : 'disabled'}`;
            if (!groupsEnabledChannel) groups = `None!`;
            else for (const key of Object.keys(groupsEnabledChannel))
                if (typeof groupsEnabledChannel[key] !== 'undefined') groups = `${groups}\n• **${key}** -- ${groupsEnabledChannel[key] ? 'enabled' : 'disabled'}`;

            embed.setColor('#6000FF')
                .setDescription(`Permissions for ${permission} (${permission.id})`)
                .addField('Commands:', `${commands}`, true)
                .addField('Groups:', `${groups}`, true);

            /**
             * ***************
             * This is a role
             * ***************
             */
        } else if (permission.hexColor) {
            let commandsEnabledRoles;
            let groupsEnabledRoles;
            if (this.client.guilds.get(msg.guild.id)._commandsEnabledRoles) commandsEnabledRoles = await this.client.guilds.get(msg.guild.id)._commandsEnabledRoles;
            if (this.client.guilds.get(msg.guild.id)._groupsEnabledRoles) groupsEnabledRoles = await this.client.guilds.get(msg.guild.id)._groupsEnabledRoles;
            let commands = ``;
            let groups = ``;

            if (!commandsEnabledRoles) commands = `None!`;
            else for (const key of Object.keys(commandsEnabledRoles))
                if (typeof commandsEnabledRoles[key][permission.id] !== 'undefined') commands = `${commands}\n• **${key}** -- ${commandsEnabledRoles[key][permission.id] ? 'enabled' : 'disabled'}`;
            if (!groupsEnabledRoles) groups = `None!`;
            else for (const key of Object.keys(groupsEnabledRoles))
                if (typeof groupsEnabledRoles[key][permission.id] !== 'undefined') groups = `${groups}\n• **${key}** -- ${groupsEnabledRoles[key][permission.id] ? 'enabled' : 'disabled'}`;
            if (!commands) commands = `None!`;
            if (!groups) groups = `None!`;
            embed.setColor('#6000FF')
                .setDescription(`Permissions for ${permission} (${permission.id})`)
                .addField('Commands:', `${commands}`, true)
                .addField('Groups:', `${groups}`, true);
        }
        return msg.channel.send({ embed });
    }
};