const SettingProvider = require('./base');
const Sequelize = require('sequelize');

/**
 * Uses an PostgreSQL database to store settings with guilds
 * @extends {SettingProvider}
 */
class SequelizeProvider extends SettingProvider {
    /**
     * @external PostgreSQLDatabase
     * @see {@link https://www.npmjs.com/package/sequelize}
     */

    /**
     * @param {SQLDatabase} db - Database for the provider
     */
    constructor(db) {
        super();

        /**
         * Database that will be used for storing/retrieving settings
         * @type {SQLDatabase}
         */
        this.db = db;

        /**
         * Client that the provider is for (set once the client is ready, after using {@link CommandoClient#setProvider})
         * @name SequelizeProvider#client
         * @type {CommandoClient}
         * @readonly
         */
        Object.defineProperty(this, 'client', { value: null, writable: true });

        /**
         * Settings cached in memory, mapped by guild ID (or 'global')
         * @type {Map}
         * @private
         */
        this.settings = new Map();

        /**
         * Listeners on the Client, mapped by the event name
         * @type {Map}
         * @private
         */
        this.listeners = new Map();

        /**
         * Sequelize Model Object
         * @type {SequelizeModel}
         * @private
         */
        this.model = this.db.define('settings', {
            guild: {
                type: Sequelize.STRING,
                allowNull: false,
                unique: true,
                primaryKey: true
            },
            server: { type: Sequelize.TEXT },
            channels: { type: Sequelize.TEXT },
            roles: { type: Sequelize.TEXT },
            whitelist: { type: Sequelize.TEXT }
        });

        /**
         * @external SequelizeModel
         * @see {@link http://docs.sequelizejs.com/en/latest/api/model/}
         */
    }

    async init(client) {
        this.client = client;
        await this.db.sync();

        // Load all settings
        const rows = await this.model.findAll();
        for (const row of rows) {
            let settings = {};
            let server;
            let channels;
            let roles;
            let whitelist;
            try {
                server = JSON.parse(row.dataValues.server);
                channels = JSON.parse(row.dataValues.channels);
                roles = JSON.parse(row.dataValues.roles);
                whitelist = JSON.parse(row.dataValues.whitelist);
            } catch (err) {
                client.emit('warn', `SequelizeProvider couldn't parse the settings stored for guild ${row.dataValues.guild}. -- ${err}`);
                continue;
            }

            const guild = row.dataValues.guild !== '0' ? row.dataValues.guild : 'global';
            settings = { server: server, channels: channels, roles: roles, whitelist: whitelist };
            this.settings.set(guild, settings);
            if (guild !== 'global' && !client.guilds.has(row.dataValues.guild)) continue;
            this.setupGuild(guild, settings);
        }

        // Listen for changes
        this.listeners
            .set('commandPrefixChange', (guild, prefix) => this.set(guild, 'prefix', prefix))
            .set('commandStatusChange', (guild, command, enabled, type) => this.set(guild, `cmd-${command.name}`, enabled, type))
            .set('groupStatusChange', (guild, group, enabled, type) => this.set(guild, `grp-${group.id}`, enabled, type))
            .set('commandWhitelistChange', (guild, command, enabled, type) => this.set(guild, `cmd-${command.name}`, enabled, `${type}-whitelist`))
            .set('groupWhitelistChange', (guild, group, enabled, type) => this.set(guild, `grp-${group.id}`, enabled, `${type}-whitelist`))
            .set('channelDelete', channel => this.remove(channel.guild, channel))
            .set('roleDelete', role => this.remove(role.guild, role))
            .set('guildCreate', guild => {
                const settings = this.settings.get(guild.id);
                if (!settings) return;
                this.setupGuild(guild.id, settings);
            })
            .set('commandRegister', command => {
                for (const [guild, settings] of this.settings) {
                    if (guild !== 'global' && !client.guilds.has(guild)) continue;
                    this.setupGuildCommand(client.guilds.get(guild), command, settings);
                }
            })
            .set('groupRegister', group => {
                for (const [guild, settings] of this.settings) {
                    if (guild !== 'global' && !client.guilds.has(guild)) continue;
                    this.setupGuildGroup(client.guilds.get(guild), group, settings);
                }
            });
        for (const [event, listener] of this.listeners) client.on(event, listener);
    }

    destroy() {
        // Remove all listeners from the client
        for (const [event, listener] of this.listeners) this.client.removeListener(event, listener);
        this.listeners.clear();
    }

    get(guild, key, defVal) {
        const settings = this.settings.get(this.constructor.getGuildID(guild));
        return settings ? typeof settings[key] !== 'undefined' ? settings[key] : defVal : defVal;
    }

    async set(guild, key, val, type) {
        guild = this.constructor.getGuildID(guild);
        let settings = this.settings.get(guild); // gets the pair from the map
        if (!settings) { // if not found
            settings = { server: {}, channels: {}, roles: {}, whitelist: { roles: {}, channels: {} } }; // make new obj
            this.settings.set(guild, settings); // set it in map
        }
        if (type === 'roles-whitelist' || type === 'channels-whitelist') {
            if (type.includes('channels-whitelist')) settings.whitelist.channels[key] = val;
            if (type.includes('roles-whitelist')) settings.whitelist.roles[key] = val;
            await this.model.upsert(
                { guild: guild !== 'global' ? guild : '0', whitelist: JSON.stringify(settings.whitelist) },
                { where: { guild: guild !== 'global' ? guild : '0' } }
            );
        } else if (type.messages) {
            if (!settings.channels) settings.channels = {};
            if (!settings.channels[type.id]) settings.channels[type.id] = {};

            settings.channels[type.id][key] = val; // "channelID"{"cmd-xxx": true}
            await this.model.upsert(
                { guild: guild !== 'global' ? guild : '0', channels: JSON.stringify(settings.channels) },
                { where: { guild: guild !== 'global' ? guild : '0' } }
            );
        } else if (type.hexColor) {
            if (!settings.roles) settings.roles = {};
            if (!settings.roles[key]) settings.roles[key] = {};

            settings.roles[key][type.id] = val; // "cmd-xxx"{"roleID": true}
            await this.model.upsert(
                { guild: guild !== 'global' ? guild : '0', roles: JSON.stringify(settings.roles) },
                { where: { guild: guild !== 'global' ? guild : '0' } }
            );
        } else {
            settings.server[key] = val; // "cmd-xxx": true
            await this.model.upsert(
                { guild: guild !== 'global' ? guild : '0', server: JSON.stringify(settings.server) },
                { where: { guild: guild !== 'global' ? guild : '0' } }
            );
        }
        if (guild === 'global') this.updateOtherShards(key, val);
        return val;
    }

    async remove(guild, key) {
        guild = this.constructor.getGuildID(guild);
        const settings = this.settings.get(guild);
        if (typeof settings === 'undefined') return;

        if (key.messages && settings.channels && settings.channels[key.id]) {
            delete settings.channels[key.id];
            await this.model.upsert(
                { guild: guild !== 'global' ? guild : '0', channels: JSON.stringify(settings.channels) },
                { where: { guild: guild !== 'global' ? guild : '0' } }
            );
        } else if (key.hexColor && settings.roles) {
            for (const command of Object.keys(settings.roles)) {
                if (typeof settings.roles[command][key.id] !== 'undefined') {
                    delete settings.roles[command][key.id];
                }
            }
            await this.model.upsert(
                { guild: guild !== 'global' ? guild : '0', roles: JSON.stringify(settings.roles) },
                { where: { guild: guild !== 'global' ? guild : '0' } }
            );
        }
    }

    async clear(guild) {
        guild = this.constructor.getGuildID(guild);
        if (!this.settings.has(guild)) return;
        this.settings.delete(guild);
        await this.model.destroy({ where: { guild: guild !== 'global' ? guild : '0' } });
    }

    /**
     * Loads all settings for a guild
     * @param {string} guild - Guild ID to load the settings of (or 'global')
     * @param {Object} settings - Settings to load
     * @private
     */
    setupGuild(guild, settings) {
        if (typeof guild !== 'string') throw new TypeError('The guild must be a guild ID or "global".');
        guild = this.client.guilds.get(guild) || null;

        // Load the command prefix
        if (typeof settings.prefix !== 'undefined') {
            if (guild) guild._commandPrefix = settings.prefix;
            else this.client._commandPrefix = settings.prefix;
        }

        // Load all command/group statuses
        for (const command of this.client.registry.commands.values()) this.setupGuildCommand(guild, command, settings);
        for (const group of this.client.registry.groups.values()) this.setupGuildGroup(guild, group, settings);
    }

    /**
     * Sets up a command's status in a guild from the guild's settings
     * @param {?Guild} guild - Guild to set the status in
     * @param {Command} command - Command to set the status of
     * @param {Object} settings - Settings of the guild
     * @private
     */
    setupGuildCommand(guild, command, settings) {
        if (guild) {
            for (const key of Object.keys(settings)) {
                if (key === 'server') {
                    if (!settings.server) settings.server = {};
                    if (typeof settings.server[`cmd-${command.name}`] === 'undefined') continue;
                    if (!guild._commandsEnabled) guild._commandsEnabled = {};
                    guild._commandsEnabled[command.name] = settings.server[`cmd-${command.name}`];
                } else if (key === 'channels') {
                    if (!settings.channels) settings.channels = {};
                    for (const id of Object.keys(settings.channels)) {
                        if (!guild._commandsEnabledChannel) guild._commandsEnabledChannel = {};
                        if (!guild._commandsEnabledChannel[id]) guild._commandsEnabledChannel[id] = {};
                        guild._commandsEnabledChannel[id][command.name] = settings.channels[id][`cmd-${command.name}`];
                    }
                } else if (key === 'roles') {
                    if (!settings.roles) settings.roles = {};
                    if (typeof settings.roles[`cmd-${command.name}`] === 'undefined') continue;
                    for (const id of Object.keys(settings.roles[`cmd-${command.name}`])) {
                        if (!guild._commandsEnabledRoles) guild._commandsEnabledRoles = {};
                        if (!guild._commandsEnabledRoles[command.name]) guild._commandsEnabledRoles[command.name] = {};
                        guild._commandsEnabledRoles[command.name][id] = settings.roles[`cmd-${command.name}`][id];
                    }
                } else if (key === 'whitelist') {
                    if (!settings.whitelist) settings.whitelist = { channels: {}, roles: {} };
                    if (!settings.whitelist.channels) settings.whitelist.channels = {};
                    if (!settings.whitelist.roles) settings.whitelist.roles = {};
                    if (typeof settings.whitelist.roles[`cmd-${command.name}`] !== 'undefined') command.whitelist.roles = settings.whitelist.roles[`cmd-${command.name}`];
                    if (typeof settings.whitelist.channels[`cmd-${command.name}`] !== 'undefined') command.whitelist.channels = settings.whitelist.channels[`cmd-${command.name}`];
                }
            }
        } else {
            command._globalEnabled = settings[`cmd-${command.name}`];
        }
    }

    /**
     * Sets up a group's status in a guild from the guild's settings
     * @param {?Guild} guild - Guild to set the status in
     * @param {CommandGroup} group - Group to set the status of
     * @param {Object} settings - Settings of the guild
     * @private
     */
    setupGuildGroup(guild, group, settings) {
        if (guild) {
            for (const key of Object.keys(settings)) {
                if (key === 'server') {
                    if (!settings.server) settings.server = {};
                    if (typeof settings.server[`grp-${group.id}`] === 'undefined') continue;
                    if (!guild._groupsEnabled) guild._groupsEnabled = {};
                    guild._groupsEnabled[group.id] = settings.server[`grp-${group.id}`];
                } else if (key === 'channels') {
                    if (!settings.channels) settings.channels = {};
                    for (const id of Object.keys(settings.channels)) {
                        if (!guild._groupsEnabledChannels) guild._groupsEnabledChannels = {};
                        if (!guild._groupsEnabledChannels[id]) guild._groupsEnabledChannels[id] = {};
                        guild._groupsEnabledChannels[id][group.id] = settings.channels[id][`grp-${group.id}`];
                    }
                } else if (key === 'roles') {
                    if (!settings.roles) settings.roles = {};
                    if (typeof settings.roles[`grp-${group.id}`] === 'undefined') continue;
                    for (const id of Object.keys(settings.roles[`grp-${group.id}`])) {
                        if (!guild._groupsEnabledRoles) guild._groupsEnabledRoles = {};
                        if (!guild._groupsEnabledRoles[group.id]) guild._groupsEnabledRoles[group.id] = {};
                        guild._groupsEnabledRoles[group.id][id] = settings.roles[`grp-${group.id}`][id];
                    }
                } else if (key === 'whitelist') {
                    if (!settings.whitelist) settings.whitelist = { channels: {}, roles: {} };
                    if (!settings.whitelist.channels) settings.whitelist.channels = {};
                    if (!settings.whitelist.roles) settings.whitelist.roles = {};
                    if (typeof settings.whitelist.roles[`grp-${group.id}`] !== 'undefined') group.whitelist.roles = settings.whitelist.roles[`grp-${group.id}`];
                    if (typeof settings.whitelist.channels[`grp-${group.id}`] !== 'undefined') group.whitelist.channels = settings.whitelist.channels[`grp-${group.id}`];
                }
            }
        } else {
            group._globalEnabled = settings[`grp-${group.id}`];
        }
    }

    /**
     * Updates a global setting on all other shards if using the {@link ShardingManager}.
     * @param {string} key - Key of the setting to update
     * @param {*} val - Value of the setting
     * @private
     */
    updateOtherShards(key, val) {
        if (!this.client.shard) return;
        key = JSON.stringify(key);
        val = typeof val !== 'undefined' ? JSON.stringify(val) : 'undefined';
        this.client.shard.broadcastEval(`
			if(this.shard.id !== ${this.client.shard.id} && this.provider && this.provider.settings) {
				let global = this.provider.settings.get('global');
				if (!global) {
					global = {};
					this.provider.settings.set('global', global)
				}
				global[${key}] = ${val};
			}
		`);
    }
}

module.exports = SequelizeProvider;