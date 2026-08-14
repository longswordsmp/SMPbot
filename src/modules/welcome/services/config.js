'use strict';

/**
 * Configuration surface for the `welcome` namespace — welcome & leave system.
 * All durable state lives in the guild config namespace (SQLite-backed), so the
 * module is fully restart-safe and holds no in-memory source of truth.
 *
 * DEFAULTS is exported so /setup and server templates can reference it.
 */

const NAMESPACE = 'welcome';
const LOG_TYPE = 'members';

const DEFAULTS = {
  enabled: false, // send a welcome message on join
  channelId: null, // welcome channel
  title: 'Welcome to {server}!',
  description: 'Hey {user}, welcome to **{server}**! You are member **#{membercount}**. Make yourself at home. 🎉',
  serverIcon: true, // show the server icon as the embed author
  imageUrl: null, // custom embed image (URL); ignored when a banner is used
  banner: false, // generate a canvas welcome banner as the embed image
  skipBots: true, // do not auto-role bots that join
  autoroles: [], // role ids granted on join
  buttons: [], // [{ label, url }] link buttons (max 5)
  dm: {
    enabled: false,
    message: 'Hey {username}, welcome to **{server}**! We are glad to have you here. 🌟',
  },
  leave: {
    enabled: false,
    channelId: null,
    title: 'Goodbye 👋',
    description: '**{username}** just left **{server}**. We are now **{membercount}** members.',
  },
};

// Shared bounds so the command's validation stays consistent everywhere.
const LIMITS = {
  maxAutoroles: 15,
  maxButtons: 5,
  titleMax: 256,
  descriptionMax: 2000,
  dmMax: 2000,
  urlMax: 512,
  labelMax: 80,
};

function config(client, guildId) {
  return client.config.get(guildId, NAMESPACE, DEFAULTS);
}

/** Resolve a channel id to a channel object (cache first, then a tolerant fetch). */
async function resolveChannel(guild, channelId) {
  if (!guild || !channelId) return null;
  return guild.channels.cache.get(channelId) ?? (await guild.channels.fetch(channelId).catch(() => null));
}

module.exports = { NAMESPACE, LOG_TYPE, DEFAULTS, LIMITS, config, resolveChannel };
