const path = require('path');
const discord = require('discord.js');
const Command = require('./commands/base');
const CommandGroup = require('./commands/group');
const CommandMessage = require('./commands/message');
const ArgumentType = require('./types/base');

/** Handles registration and searching of commands and groups */
class CommandRegistry {
    /** @param {CommandoClient} [client] - Client to use  */
    constructor(client) {
        /**
         * The client this registry is for
         * @name CommandRegistry#client
         * @type {CommandoClient}
         * @readonly
         */
        Object.defineProperty(this, 'client', { value: client });

        /**
         * Registered commands
         * @type {Collection<string, Command>}
         */
        this.commands = new discord.Collection();

        /**
         * Registered command groups
         * @type {Collection<string, CommandGroup>}
         */
        this.groups = new discord.Collection();

        /**
         * Registered argument types
         * @type {Collection<string, ArgumentType>}
         */
        this.types = new discord.Collection();

        /**
         * Registered objects for the eval command
         * @type {Object}
         */
        this.evalObjects = {};

        /**
         * Fully resolved path to the bot's commands directory
         * @type {?string}
         */
        this.commandsPath = null;
    }

    /**
     * Registers a single group
     * @param {CommandGroup|Function|Object|string} group - A CommandGroup instance, a constructor, or the group ID
     * @param {string} [name] - Name for the group (if the first argument is the group ID)
     * @param {boolean} [whitelist] - Whether the group should be whitelist only (if the first argument is the group ID)
     * @param {boolean} [guarded] - Whether the group should be guarded (if the first argument is the group ID)
     * @return {CommandRegistry}
     * @see {@link CommandRegistry#registerGroups}
     */
    registerGroup(group, name, whitelist, guarded) {
        if (typeof group === 'string') {
            group = new CommandGroup(this.client, group, name, whitelist, guarded);
        } else if (typeof group === 'function') {
            group = new group(this.client); // eslint-disable-line new-cap
        } else if (typeof group === 'object' && !(group instanceof CommandGroup)) {
            group = new CommandGroup(this.client, group.id, group.name, group.whitelist, group.guarded);
        }

        const existing = this.groups.get(group.id);
        if (existing) {
            existing.name = group.name;
            this.client.emit('debug', `Group ${group.id} is already registered; renamed it to "${group.name}".`);
        } else {
            this.groups.set(group.id, group);
            /**
             * Emitted when a group is registered
             * @event CommandoClient#groupRegister
             * @param {CommandGroup} group - Group that was registered
             * @param {CommandRegistry} registry - Registry that the group was registered to
             */
            this.client.emit('groupRegister', group, this);
            this.client.emit('debug', `Registered group ${group.id}.`);
        }

        return this;
    }

    /**
     * Registers multiple groups
     * @param {CommandGroup[]|Function[]|Object[]|Array<string[]>} groups - An array of CommandGroup instances,
     * constructors, plain objects (with ID, name, and guarded properties),
     * or arrays of {@link CommandRegistry#registerGroup} parameters
     * @return {CommandRegistry}
     * @example
     * registry.registerGroups([
     *    ['fun', 'Fun'],
     *    ['mod', 'Moderation']
     * ]);
     * @example
     * registry.registerGroups([
     *    { id: 'fun', name: 'Fun' },
     *    { id: 'mod', name: 'Moderation' }
     * ]);
     */
    registerGroups(groups) {
        if (!Array.isArray(groups)) throw new TypeError('Groups must be an Array.');
        for (const group of groups) {
            if (Array.isArray(group)) this.registerGroup(...group);
            else this.registerGroup(group);
        }
        return this;
    }

    /**
     * Registers a single command
     * @param {Command|Function} command - Either a Command instance, or a constructor for one
     * @return {CommandRegistry}
     * @see {@link CommandRegistry#registerCommands}
     */
    registerCommand(command) {
        if (typeof command === 'function') command = new command(this.client); // eslint-disable-line new-cap
        if (!(command instanceof Command)) throw new Error(`Invalid command object to register: ${command}`);

        // Make sure there aren't any conflicts
        if (this.commands.some(cmd => cmd.name === command.name || cmd.aliases.includes(command.name))) {
            throw new Error(`A command with the name/alias "${command.name}" is already registered.`);
        }
        for (const alias of command.aliases) {
            if (this.commands.some(cmd => cmd.name === alias || cmd.aliases.includes(alias))) {
                throw new Error(`A command with the name/alias "${alias}" is already registered.`);
            }
        }
        const group = this.groups.find(grp => grp.id === command.groupID);
        if (!group) throw new Error(`Group "${command.groupID}" is not registered.`);
        if (group.commands.some(cmd => cmd.memberName === command.memberName)) {
            throw new Error(`A command with the member name "${command.memberName}" is already registered in ${group.id}`);
        }

        // Add the command
        command.group = group;
        group.commands.set(command.name, command);
        this.commands.set(command.name, command);

        /**
         * Emitted when a command is registered
         * @event CommandoClient#commandRegister
         * @param {Command} command - Command that was registered
         * @param {CommandRegistry} registry - Registry that the command was registered to
         */
        this.client.emit('commandRegister', command, this);
        this.client.emit('debug', `Registered command ${group.id}:${command.memberName}.`);

        return this;
    }

    /**
     * Registers multiple commands
     * @param {Command[]|Function[]} commands - An array of Command instances or constructors
     * @param {boolean} [ignoreInvalid=false] - Whether to skip over invalid objects without throwing an error
     * @return {CommandRegistry}
     */
    registerCommands(commands, ignoreInvalid = false) {
        if (!Array.isArray(commands)) throw new TypeError('Commands must be an Array.');
        for (const command of commands) {
            if (ignoreInvalid && typeof command !== 'function' && !(command instanceof Command)) {
                this.client.emit('warn', `Attempting to register an invalid command object: ${command}; skipping.`);
                continue;
            }
            this.registerCommand(command);
        }
        return this;
    }

    /**
     * Registers all commands in a directory. The files must export a Command class constructor or instance.
     * @param {string|RequireAllOptions} options - The path to the directory, or a require-all options object
     * @return {CommandRegistry}
     * @example
     * const path = require('path');
     * registry.registerCommandsIn(path.join(__dirname, 'commands'));
     */
    registerCommandsIn(options) {
        const obj = require('require-all')(options);
        const commands = [];
        for (const group of Object.values(obj)) {
            for (let command of Object.values(group)) {
                if (typeof command.default === 'function') command = command.default;
                commands.push(command);
            }
        }
        if (typeof options === 'string' && !this.commandsPath) this.commandsPath = options;
        return this.registerCommands(commands, true);
    }

    /**
     * Registers a single argument type
     * @param {ArgumentType|Function} type - Either an ArgumentType instance, or a constructor for one
     * @return {CommandRegistry}
     * @see {@link CommandRegistry#registerTypes}
     */
    registerType(type) {
        if (typeof type === 'function') type = new type(this.client); // eslint-disable-line new-cap
        if (!(type instanceof ArgumentType)) throw new Error(`Invalid type object to register: ${type}`);

        // Make sure there aren't any conflicts
        if (this.types.has(type.id)) throw new Error(`An argument type with the ID "${type.id}" is already registered.`);

        // Add the type
        this.types.set(type.id, type);

        /**
         * Emitted when an argument type is registered
         * @event CommandoClient#typeRegister
         * @param {ArgumentType} type - Argument type that was registered
         * @param {CommandRegistry} registry - Registry that the type was registered to
         */
        this.client.emit('typeRegister', type, this);
        this.client.emit('debug', `Registered argument type ${type.id}.`);

        return this;
    }

    /**
     * Registers multiple argument types
     * @param {ArgumentType[]|Function[]} types - An array of ArgumentType instances or constructors
     * @param {boolean} [ignoreInvalid=false] - Whether to skip over invalid objects without throwing an error
     * @return {CommandRegistry}
     */
    registerTypes(types, ignoreInvalid = false) {
        if (!Array.isArray(types)) throw new TypeError('Types must be an Array.');
        for (const type of types) {
            if (ignoreInvalid && typeof type !== 'function' && !(type instanceof ArgumentType)) {
                this.client.emit('warn', `Attempting to register an invalid argument type object: ${type}; skipping.`);
                continue;
            }
            this.registerType(type);
        }
        return this;
    }

    /**
     * Registers all argument types in a directory. The files must export an ArgumentType class constructor or instance.
     * @param {string|RequireAllOptions} options - The path to the directory, or a require-all options object
     * @return {CommandRegistry}
     */
    registerTypesIn(options) {
        const obj = require('require-all')(options);
        const types = [];
        for (const type of Object.values(obj)) types.push(type);
        return this.registerTypes(types, true);
    }

    /**
     * Registers the default argument types, groups, and commands. This is equivalent to:
     * registry.registerDefaultTypes()
     *    .registerDefaultGroups()
     *    .registerDefaultCommands();
     * @return {CommandRegistry}
     */
    registerDefaults() {
        this.registerDefaultTypes();
        this.registerDefaultGroups();
        this.registerDefaultCommands();
        return this;
    }

    /**
     * Registers the default groups ("util" and "commands")
     * @return {CommandRegistry}
     */
    registerDefaultGroups() {
        return this.registerGroups([
            ['commands', 'Commands', true],
            ['util', 'Utility']
        ]);
    }

    /**
     * Registers the default commands to the registry
     * @param {Object} [commands] - Object specifying which commands to register
     * @param {boolean} [commands.help=true] - Whether to register the built-in help command
     * (requires "util" group and "string" type)
     * @param {boolean} [commands.prefix=true] - Whether to register the built-in prefix command
     * (requires "util" group and "string" type)
     * @param {boolean} [commands.eval=true] - Whether to register the built-in eval command
     * (requires "util" group and "string" type)
     * @param {boolean} [commands.ping=true] - Whether to register the built-in ping command (requires "util" group)
     * @param {boolean} [commands.commandState=true] - Whether to register the built-in command state commands
     * (enable, disable, load, unload, reload, list groups - requires "commands" group, "command" type, and "group" type)
     * @return {CommandRegistry}
     */
    registerDefaultCommands(commands = {}) {
        commands = { help: true, prefix: true, ping: true, eval: true, commandState: true, ...commands };
        if (commands.help) this.registerCommand(require('./commands/util/help'));
        if (commands.prefix) this.registerCommand(require('./commands/util/prefix'));
        if (commands.ping) this.registerCommand(require('./commands/util/ping'));
        if (commands.eval) this.registerCommand(require('./commands/util/eval'));
        if (commands.commandState) {
            this.registerCommands([
                require('./commands/commands/groups'),
                require('./commands/commands/enable'),
                require('./commands/commands/whitelist'),
                require('./commands/commands/permissions'),
                require('./commands/commands/disable'),
                require('./commands/commands/reload'),
                require('./commands/commands/load'),
                require('./commands/commands/unload')
            ]);
        }
        return this;
    }

    /**
     * Registers the default argument types to the registry
     * @param {Object} [types] - Object specifying which types to register
     * @param {boolean} [types.string=true] - Whether to register the built-in string type
     * @param {boolean} [types.integer=true] - Whether to register the built-in integer type
     * @param {boolean} [types.float=true] - Whether to register the built-in float type
     * @param {boolean} [types.boolean=true] - Whether to register the built-in boolean type
     * @param {boolean} [types.user=true] - Whether to register the built-in user type
     * @param {boolean} [types.member=true] - Whether to register the built-in member type
     * @param {boolean} [types.role=true] - Whether to register the built-in role type
     * @param {boolean} [types.channel=true] - Whether to register the built-in channel type
     * @param {boolean} [types.message=true] - Whether to register the built-in message type
     * @param {boolean} [types.emoji=true] - Whether to register the built-in emoji type
     * @param {boolean} [types.avatar=true] - Whether to register the built-in avatar type
     * @param {boolean} [types.image=true] - Whether to register the built-in image type
     * @param {boolean} [types.month=true] - Whether to register the built-in month type
     * @param {boolean} [types.permission=true] - Whether to register the built-in permission type
     * @param {boolean} [types.command=true] - Whether to register the built-in command type
     * @param {boolean} [types.group=true] - Whether to register the built-in group type
     * @return {CommandRegistry}
     */
    registerDefaultTypes(types = {}) {
        types = {
            string: true, integer: true, float: true, boolean: true,
            user: true, member: true, role: true, channel: true, message: true,
            emoji: true, permission: true, avatar: true, image: true, month: true,
            command: true, group: true,
            ...types
        };
        if (types.string) this.registerType(require('./types/string'));
        if (types.integer) this.registerType(require('./types/integer'));
        if (types.float) this.registerType(require('./types/float'));
        if (types.boolean) this.registerType(require('./types/boolean'));
        if (types.user) this.registerType(require('./types/user'));
        if (types.member) this.registerType(require('./types/member'));
        if (types.role) this.registerType(require('./types/role'));
        if (types.channel) this.registerType(require('./types/channel'));
        if (types.message) this.registerType(require('./types/message'));
        if (types.emoji) this.registerType(require('./types/emoji'));
        if (types.avatar) this.registerType(require('./types/avatar'));
        if (types.image) this.registerType(require('./types/image'));
        if (types.month) this.registerType(require('./types/month'));
        if (types.permission) this.registerType(require('./types/permission'));
        if (types.command) this.registerType(require('./types/command'));
        if (types.group) this.registerType(require('./types/group'));
        return this;
    }

    /**
     * Reregisters a command (does not support changing name, group, or memberName)
     * @param {Command|Function} command - New command
     * @param {Command} oldCommand - Old command
     */
    reregisterCommand(command, oldCommand) {
        if (typeof command === 'function') command = new command(this.client); // eslint-disable-line new-cap
        if (command.name !== oldCommand.name) throw new Error('Command name cannot change.');
        if (command.groupID !== oldCommand.groupID) throw new Error('Command group cannot change.');
        if (command.memberName !== oldCommand.memberName) throw new Error('Command memberName cannot change.');
        command.group = this.resolveGroup(command.groupID);
        command.group.commands.set(command.name, command);
        this.commands.set(command.name, command);
        /**
         * Emitted when a command is reregistered
         * @event CommandoClient#commandReregister
         * @param {Command} newCommand - New command
         * @param {Command} oldCommand - Old command
         */
        this.client.emit('commandReregister', command, oldCommand);
        this.client.emit('debug', `Reregistered command ${command.groupID}:${command.memberName}.`);
    }

    /**
     * Unregisters a command
     * @param {Command} command - Command to unregister
     */
    unregisterCommand(command) {
        this.commands.delete(command.name);
        command.group.commands.delete(command.name);
        /**
         * Emitted when a command is unregistered
         * @event CommandoClient#commandUnregister
         * @param {Command} command - Command that was unregistered
         */
        this.client.emit('commandUnregister', command);
        this.client.emit('debug', `Unregistered command ${command.groupID}:${command.memberName}.`);
    }

    /**
     * Registers a single object to be usable by the eval command
     * @param {string} key - The key for the object
     * @param {Object} obj - The object
     * @return {CommandRegistry}
     * @see {@link CommandRegistry#registerEvalObjects}
     */
    registerEvalObject(key, obj) {
        const registerObj = {};
        registerObj[key] = obj;
        return this.registerEvalObjects(registerObj);
    }

    /**
     * Registers multiple objects to be usable by the eval command
     * @param {Object} obj - An object of keys: values
     * @return {CommandRegistry}
     */
    registerEvalObjects(obj) {
        Object.assign(this.evalObjects, obj);
        return this;
    }

    /**
     * Finds all groups that match the search string
     * @param {string} [searchString] - The string to search for
     * @param {boolean} [exact=false] - Whether the search should be exact
     * @return {CommandGroup[]} All groups that are found
     */
    findGroups(searchString = null, exact = false) {
        if (!searchString) return this.groups;

        // Find all matches
        const lcSearch = searchString.toLowerCase();
        const matchedGroups = Array.from(this.groups.filter(
            exact ? groupFilterExact(lcSearch) : groupFilterInexact(lcSearch)
        ).values());
        if (exact) return matchedGroups;

        // See if there's an exact match
        for (const group of matchedGroups) {
            if (group.name.toLowerCase() === lcSearch || group.id === lcSearch) return [group];
        }
        return matchedGroups;
    }

    /**
     * A CommandGroupResolvable can be:
     * * A CommandGroup
     * * A group ID
     * @typedef {CommandGroup|string} CommandGroupResolvable
     */

    /**
     * Resolves a CommandGroupResolvable to a CommandGroup object
     * @param {CommandGroupResolvable} group - The group to resolve
     * @return {CommandGroup} The resolved CommandGroup
     */
    resolveGroup(group) {
        if (group instanceof CommandGroup) return group;
        if (typeof group === 'string') {
            const groups = this.findGroups(group, true);
            if (groups.length === 1) return groups[0];
        }
        throw new Error('Unable to resolve group.');
    }

    /**
     * Finds all commands that match the search string
     * @param {string} [searchString] - The string to search for
     * @param {boolean} [exact=false] - Whether the search should be exact
     * @param {Message} [message] - The message to check usability against
     * @return {Command[]} All commands that are found
     */
    findCommands(searchString = null, exact = false, message = null) {
        if (!searchString) {
            return message ?
                Array.from(this.commands.filter(cmd => cmd.isUsable(message)).values()) :
                this.commands;
        }

        // Find all matches
        const lcSearch = searchString.toLowerCase();
        const matchedCommands = Array.from(this.commands.filter(
            exact ? commandFilterExact(lcSearch) : commandFilterInexact(lcSearch)
        ).values());
        if (exact) return matchedCommands;

        // See if there's an exact match
        for (const command of matchedCommands) {
            if (command.name === lcSearch || (command.aliases && command.aliases.some(ali => ali === lcSearch))) {
                return [command];
            }
        }

        return matchedCommands;
    }

    /**
     * A CommandResolvable can be:
     * * A Command
     * * A command name
     * * A CommandMessage
     * @typedef {Command|string} CommandResolvable
     */

    /**
     * Resolves a CommandResolvable to a Command object
     * @param {CommandResolvable} command - The command to resolve
     * @return {Command} The resolved Command
     */
    resolveCommand(command) {
        if (command instanceof Command) return command;
        if (command instanceof CommandMessage) return command.command;
        if (typeof command === 'string') {
            const commands = this.findCommands(command, true);
            if (commands.length === 1) return commands[0];
        }
        throw new Error('Unable to resolve command.');
    }

    /**
     * Resolves a command file path from a command's group ID and memberName
     * @param {string} group - ID of the command's group
     * @param {string} memberName - Member name of the command
     * @return {string} Fully-resolved path to the corresponding command file
     */
    resolveCommandPath(group, memberName) {
        return path.join(this.commandsPath, group, `${memberName}.js`);
    }
}

function groupFilterExact(search) {
    return grp => grp.id === search || grp.name.toLowerCase() === search;
}

function groupFilterInexact(search) {
    return grp => grp.id.includes(search) || grp.name.toLowerCase().includes(search);
}

function commandFilterExact(search) {
    return cmd => cmd.name === search ||
        (cmd.aliases && cmd.aliases.some(ali => ali === search)) ||
        `${cmd.groupID}:${cmd.memberName}` === search;
}

function commandFilterInexact(search) {
    return cmd => cmd.name.includes(search) ||
        `${cmd.groupID}:${cmd.memberName}` === search ||
        (cmd.aliases && cmd.aliases.some(ali => ali.includes(search)));
}

module.exports = CommandRegistry;