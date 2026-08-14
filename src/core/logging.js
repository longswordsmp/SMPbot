'use strict';

const log = require('./logger');

/**
 * Every log category SMPbot can write. Guild staff map each category to a
 * channel via /logging setup (categories fall back to `default` if set).
 */
const LOG_TYPES = [
  'security',
  'antinuke',
  'moderation',
  'members',
  'messages',
  'roles',
  'channels',
  'tickets',
  'giveaways',
  'verification',
  'invites',
  'leveling',
  'server',
  'bots',
  'webhooks',
];

const DEFAULT_LOGGING = {
  enabled: true,
  channels: {}, // logType -> channelId, plus optional `default`
};

/**
 * Guild log dispatcher. Modules call `client.logs.send(guild, 'security', { embeds: [...] })`
 * and the entry lands in the channel staff configured for that category,
 * delivered through the branded webhook pipeline.
 */
class GuildLogService {
  constructor(client) {
    this.client = client;
  }

  config(guildId) {
    return this.client.config.get(guildId, 'logging', DEFAULT_LOGGING);
  }

  channelIdFor(guildId, type) {
    const cfg = this.config(guildId);
    if (!cfg.enabled) return null;
    return cfg.channels?.[type] || cfg.channels?.default || null;
  }

  /**
   * Send a log payload ({ embeds, content, files }) to the configured channel
   * for `type`. Silently no-ops when logging is disabled or unconfigured —
   * logging must never break a feature.
   */
  async send(guild, type, payload) {
    try {
      if (!guild) return null;
      const channelId = this.channelIdFor(guild.id, type);
      if (!channelId) return null;
      const channel =
        guild.channels.cache.get(channelId) ?? (await guild.channels.fetch(channelId).catch(() => null));
      if (!channel) return null;
      return await this.client.hooks.send(channel, { ...payload, allowedMentions: { parse: [] } });
    } catch (err) {
      log.debug(`Guild log '${type}' failed for guild ${guild?.id}:`, err?.message ?? err);
      return null;
    }
  }
}

module.exports = { GuildLogService, LOG_TYPES, DEFAULT_LOGGING };
