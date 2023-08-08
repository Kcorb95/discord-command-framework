const { Structures } = require('discord.js');
const Command = require('../commands/base');
const GuildSettingsHelper = require('../providers/helper');

module.exports = Structures.extend('Guild', Guild => {
    /**
     * A fancier Guild for fancier people.
     * @extends Guild
     */
    class CommandoGuild extends Guild {
        constructor(...args) {
            super(...args);

            /**
             * Shortcut to use setting provider methods for this guild
             * @type {GuildSettingsHelper}
             */
            this.settings = new GuildSettingsHelper(this.client, this);

            /**
             * Internal command prefix for the guild, controlled by the {@link CommandoGuild#commandPrefix}
             * getter/setter
             * @name CommandoGuild#_commandPrefix
             * @type {?string}
             * @private
             */
            this._commandPrefix = null;
        }

        /**
         * Command prefix in the guild. An empty string indicates that there is no prefix, and only mentions will be used.
         * Setting to `null` means that the prefix from {@link CommandoClient#commandPrefix} will be used instead.
         * @type {string}
         * @emits {@link CommandoClient#commandPrefixChange}
         */
        get commandPrefix() {
            if (this._commandPrefix === null) return this.client.commandPrefix;
            return this._commandPrefix;
        }

        set commandPrefix(prefix) {
            this._commandPrefix = prefix;
            /**
             * Emitted whenever a guild's command prefix is changed
             * @event CommandoClient#commandPrefixChange
             * @param {?CommandoGuild} guild - Guild that the prefix was changed in (null for global)
             * @param {?string} prefix - New command prefix (null for default)
             */
            this.client.emit('commandPrefixChange', this, this._commandPrefix);
        }

        /**
         * Sets whether a command is enabled in the guild
         * @param {CommandResolvable} command - Command to set status of
         * @param {boolean} enabled - Whether the command should be enabled
         * @param {permission} type - How/Where should the command or group be disabled
         */
        setCommandEnabled(command, enabled, type) {
            command = this.client.registry.resolveCommand(command);
            if (command.guarded) throw new Error('The command is guarded.');
            if (typeof enabled === 'undefined') throw new TypeError('Enabled must not be undefined.');
            enabled = Boolean(enabled);
            // Type is Channel
            if (type.messages) {
                if (!this._commandsEnabledChannel) this._commandsEnabledChannel = {};
                if (!this._commandsEnabledChannel[ type.id ]) this._commandsEnabledChannel[ type.id ] = {};
                this._commandsEnabledChannel[ type.id ][ command.name ] = enabled;
            } else if (type.hexColor) {
                if (!this._commandsEnabledRoles) this._commandsEnabledRoles = {};
                if (!this._commandsEnabledRoles[ command.name ]) this._commandsEnabledRoles[ command.name ] = {};
                this._commandsEnabledRoles[ command.name ][ type.id ] = enabled;
            } else if (type === 'server') {
                if (!this._commandsEnabled) this._commandsEnabled = {};
                this._commandsEnabled[ command.name ] = enabled;
            }
            this.client.emit('commandStatusChange', this, command, enabled, type);
        }

        /**
         * Checks whether a command is enabled in the guild (does not take the command's group status into account)
         * @param {CommandResolvable} command - Command to check status of
         * @return {boolean}
         * @param {permission} message - How/Where should the command or group be disabled
         */
        isCommandEnabled(command, message) {
            command = this.client.registry.resolveCommand(command);
            if (command.guarded) return true;
            let isFoundServer = true;
            let isFoundChannel = true;
            let isFoundRole = true;

            if (!this._commandsEnabled || typeof this._commandsEnabled[ command.name ] === 'undefined') isFoundServer = false;
            if (!this._commandsEnabledChannel || !this._commandsEnabledChannel[ message.channel.id ] || typeof this._commandsEnabledChannel[ message.channel.id ][ command.name ] === 'undefined') isFoundChannel = false;
            if (!this._commandsEnabledRoles || !this._commandsEnabledRoles[ command.name ]) isFoundRole = false;
            if (!isFoundServer && !isFoundChannel && !isFoundRole && !command.whitelist.roles && !command.whitelist.channels) return command._globalEnabled;

            return this.isCommandEnabledInGuild(command) && this.isUsableChannel(command, message.channel) && this.isUsableRole(command, message.member);
        }

        isCommandEnabledInGuild(command) {
            if (!this._commandsEnabled || typeof this._commandsEnabled[ command.name ] === 'undefined') return true;
            return this._commandsEnabled[ command.name ];
        }

        /**
         * Sets whether a command group is enabled in the guild
         * @param {CommandGroupResolvable} group - Command to set status of
         * @param {boolean} enabled - Whether the group should be enabled
         * @param {permission} type - How/Where should the command or group be disabled
         */
        setGroupEnabled(group, enabled, type) {
            group = this.client.registry.resolveGroup(group);
            if (group.guarded) throw new Error('The group is guarded.');
            if (typeof enabled === 'undefined') throw new TypeError('Enabled must not be undefined.');
            enabled = Boolean(enabled);
            // Type is Channel
            if (type.messages) {
                if (!this._groupsEnabledChannels) this._groupsEnabledChannels = {};
                if (!this._groupsEnabledChannels[ type.id ]) this._groupsEnabledChannels[ type.id ] = {};
                this._groupsEnabledChannels[ type.id ][ group.id ] = enabled;
            } else if (type.hexColor) {
                if (!this._groupsEnabledRoles) this._groupsEnabledRoles = {};
                if (!this._groupsEnabledRoles[ group.id ]) this._groupsEnabledRoles[ group.id ] = {};
                this._groupsEnabledRoles[ group.id ][ type.id ] = enabled;
            } else if (type === 'server') {
                if (!this._groupsEnabled) this._groupsEnabled = {};
                this._groupsEnabled[ group.id ] = enabled;
            }
            this.client.emit('groupStatusChange', this, group, enabled, type);
        }

        /**
         * Checks whether a command group is enabled
         * @param {CommandGroupResolvable} command - Group to check status of
         * @return {boolean}
         * @param {message} message - How/Where should the command or group be disabled
         */
        isGroupEnabled(command, message) {
            let group = this.client.registry.resolveGroup(command.group);
            if (group.guarded) return true;
            let isFoundServer = true;
            let isFoundChannel = true;
            let isFoundRole = true;

            if (!this._groupsEnabled || typeof this._groupsEnabled[ group.id ] === 'undefined') isFoundServer = false;
            if (!this._groupsEnabledChannels || !this._groupsEnabledChannels[ message.channel.id ] || typeof this._groupsEnabledChannels[ message.channel.id ][ group.id ] === 'undefined') isFoundChannel = false;
            if (!this._groupsEnabledRoles || !this._groupsEnabledRoles[ group.id ]) isFoundRole = false;
            if (!isFoundServer && !isFoundChannel && !isFoundRole && !group.whitelist.roles && !group.whitelist.channels) return group._globalEnabled;

            return this.isGroupEnabledInGuild(group) && this.isUsableChannel(command, message.channel) && this.isUsableRole(command, message.member);
        }

        isGroupEnabledInGuild(group) {
            if (!this._groupsEnabled || typeof this._groupsEnabled[ group.id ] === 'undefined') return true;
            return this._groupsEnabled[ group.id ];
        }

        isUsableRole(command, member) {
            let group = this.client.registry.resolveGroup(command.group);
            let foundGroup = false;
            let foundCommand = false;

            if (this._commandsEnabledRoles && this._commandsEnabledRoles[ command.name ] && this._commandsEnabledRoles[ command.name ].length !== 0) {
                for (const id of Object.keys(this._commandsEnabledRoles[ command.name ])) {
                    if (member.roles.has(id)) {
                        if (this._commandsEnabledRoles[ command.name ][ id ]) foundCommand = true;
                        else return false;
                    }
                }
                if (!command.whitelist.roles && !group.whitelist.roles) foundCommand = true;
            } else if (!command.whitelist.roles && !group.whitelist.roles) foundCommand = true;

            if (this._groupsEnabledRoles && this._groupsEnabledRoles[ group.id ] && this._groupsEnabledRoles[ group.id ].length !== 0) {
                for (const id of Object.keys(this._groupsEnabledRoles[ group.id ])) {
                    if (member.roles.has(id)) {
                        if (this._groupsEnabledRoles[ group.id ][ id ]) foundGroup = true;
                        else return false;
                    }
                }
                if (!command.whitelist.roles && !group.whitelist.roles) foundGroup = true;
            } else if (!command.whitelist.roles && !group.whitelist.roles) foundGroup = true;

            return foundGroup || foundCommand;
        }

        isUsableChannel(command, channel) {
            let group = this.client.registry.resolveGroup(command.group);
            let foundGroup = false;
            let foundCommand = false;

            if (this._commandsEnabledChannel && this._commandsEnabledChannel[ channel.id ] && typeof this._commandsEnabledChannel[ channel.id ][ command.name ] !== 'undefined') {
                if (this._commandsEnabledChannel[ channel.id ][ command.name ]) foundCommand = true;
                else return false;
            } else if (!command.whitelist.channels && !group.whitelist.channels) foundCommand = true;

            if (this._groupsEnabledChannels && this._groupsEnabledChannels[ channel.id ] && typeof this._groupsEnabledChannels[ channel.id ][ group.id ] !== 'undefined') {
                if (this._groupsEnabledChannels[ channel.id ][ group.id ]) foundGroup = true;
                else return false;
            } else if (!command.whitelist.channels && !group.whitelist.channels) foundCommand = true;

            return foundGroup || foundCommand;
        }

        /**
         * Creates a command usage string using the guild's prefix
         * @param {string} [command] - A command + arg string
         * @param {User} [user=this.client.user] - User to use for the mention command format
         * @return {string}
         */
        commandUsage(command, user = this.client.user) {
            return Command.usage(command, this.commandPrefix, user);
        }
    }

    return CommandoGuild;
});