const ArgumentType = require('./base');
const { disambiguation } = require('../util');
const { escapeMarkdown } = require('discord.js');

class PermissionArgumentType extends ArgumentType {
    constructor(client) {
        super(client, 'permission');
    }

    validate(value, msg, arg) {
        if (value.toLowerCase() === 'server') return true;

        // If a channel or role was mentioned
        const cMatches = value.match(/^(?:<#)?([0-9]+)>?$/);
        const rMatches = value.match(/^(?:<@&)?([0-9]+)>?$/);
        if (cMatches) return msg.guild.channels.has(cMatches[1]);
        if (rMatches) return msg.guild.roles.has(rMatches[1]);

        // Search the roles and the channels for the string
        const search = value.toLowerCase();
        let roles = msg.guild.roles.filter(nameFilterInexact(search));
        let channels = msg.guild.channels.filter(nameFilterInexact(search));

        if (channels.size === 0 && roles.size === 0) return false;
        if (roles.size === 1) {
            if (arg.oneOf && !arg.oneOf.includes(roles.first().id)) return false;
            return true;
        }
        if (channels.size === 1) {
            if (arg.oneOf && !arg.oneOf.includes(channels.first().id)) return false;
            return true;
        }

        const exactRoles = roles.filter(nameFilterExact(search));
        const exactChannels = channels.filter(nameFilterExact(search));
        if (exactRoles.size === 1) {
            if (arg.oneOf && !arg.oneOf.includes(exactRoles.first().id)) return false;
            return true;
        }
        if (exactChannels.length === 1) {
            if (arg.oneOf && !arg.oneOf.includes(exactChannels.first().id)) return false;
            return true;
        }

        if (exactRoles.size > 0) {
            roles = exactRoles;
            return roles.size <= 15 ?
                `${disambiguation(roles.map(role => `${escapeMarkdown(role.name)}`), 'roles', null)}\n` :
                'Multiple roles found. Please be more specific.';
        }
        if (exactChannels.size > 0) {
            channels = exactChannels;
            return channels.size <= 15 ?
                `${disambiguation(channels.map(chan => escapeMarkdown(chan.name)), 'channels', null)}\n` :
                'Multiple channels found. Please be more specific.';
        }
    }

    parse(value, msg) {
        if (value.toLowerCase() === 'server') return value;

        const cMatches = value.match(/^(?:<#)?([0-9]+)>?$/);
        const rMatches = value.match(/^(?:<@&)?([0-9]+)>?$/);
        if (cMatches) return msg.guild.channels.get(cMatches[1]) || null;
        if (rMatches) return msg.guild.roles.get(rMatches[1]) || null;

        const search = value.toLowerCase();
        const channels = msg.guild.channels.filter(nameFilterInexact(search));
        const roles = msg.guild.roles.filter(nameFilterInexact(search));

        if (channels.size === 0 && roles.size === 0) return null;
        if (channels.size === 1) return channels.first();
        if (roles.size === 1) return roles.first();

        const exactChannels = channels.filter(nameFilterExact(search));
        const exactRoles = roles.filter(nameFilterExact(search));
        if (exactChannels.size === 1) return exactChannels.first();
        if (exactRoles.size === 1) return exactRoles.first();
        return null;
    }
}

function nameFilterExact(search) {
    return thing => thing.name.toLowerCase() === search;
}

function nameFilterInexact(search) {
    return thing => thing.name.toLowerCase().includes(search);
}

module.exports = PermissionArgumentType;