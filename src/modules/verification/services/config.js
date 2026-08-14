'use strict';

/**
 * Configuration surface for the `verification` namespace — member verification.
 * All durable settings live in the guild config namespace (SQLite-backed) so
 * the module is fully restart-safe and holds no in-memory source of truth.
 *
 * DEFAULTS is exported so /setup and server templates can reference it.
 */

const NAMESPACE = 'verification';
const LOG_TYPE = 'verification';

const MODES = ['button', 'captcha'];

const DEFAULTS = {
  enabled: false, // master switch — nothing happens on join or click while off
  verifiedRoleId: null, // role granted on successful verification
  unverifiedRoleId: null, // optional role assigned on join, removed on verify
  channelId: null, // channel the verify panel is published to
  panelChannelId: null, // where the live panel currently is (for refresh/cleanup)
  panelMessageId: null, // id of the published panel message
  mode: 'button', // 'button' (instant) | 'captcha' (solve a code)
  minAccountAgeDays: 0, // 0 = off; require Discord accounts to be N days old
  cooldownSeconds: 30, // per-user cooldown between verify attempts
  autoKickUnverifiedHours: 0, // 0 = off; kick members still unverified after N hours
  dm: {
    enabled: false, // DM the member on successful verification
    message: 'You have been verified in **{server}**! Welcome aboard. 🎉',
  },
};

// Shared bounds so validation stays consistent across the command and wizard.
const LIMITS = {
  minAccountAgeDaysMax: 365,
  cooldownSecondsMax: 3600,
  autoKickHoursMax: 720, // 30 days
  dmMax: 1500,
};

function config(client, guildId) {
  return client.config.get(guildId, NAMESPACE, DEFAULTS);
}

/** Resolve a channel id to a channel object (cache first, then a tolerant fetch). */
async function resolveChannel(guild, channelId) {
  if (!guild || !channelId) return null;
  return guild.channels.cache.get(channelId) ?? (await guild.channels.fetch(channelId).catch(() => null));
}

/** Resolve a role id to a role object (cache first, then a tolerant fetch). */
async function resolveRole(guild, roleId) {
  if (!guild || !roleId) return null;
  return guild.roles.cache.get(roleId) ?? (await guild.roles.fetch(roleId).catch(() => null));
}

module.exports = { NAMESPACE, LOG_TYPE, MODES, DEFAULTS, LIMITS, config, resolveChannel, resolveRole };
