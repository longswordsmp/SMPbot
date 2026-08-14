'use strict';

const { Events } = require('discord.js');
const log = require('../../../core/logger');
const { config, resolveChannel, LOG_TYPE } = require('../services/config');
const render = require('../services/render');

/**
 * On leave: post the (plainer) leave message to the configured channel and log
 * the departure to the members log. Wrapped throughout so a partial member,
 * missing perms, or a deleted channel never crashes the handler.
 */
module.exports = {
  event: Events.GuildMemberRemove,

  async execute(client, member) {
    try {
      const guild = member?.guild;
      if (!guild?.id) return;

      const cfg = config(client, guild.id);

      // Leave message.
      if (cfg.leave?.enabled && cfg.leave?.channelId) {
        const channel = await resolveChannel(guild, cfg.leave.channelId);
        if (channel) {
          try {
            const payload = render.buildLeavePayload(client, guild, member, cfg);
            await client.hooks.send(channel, payload);
          } catch (err) {
            log.warn('welcome: failed to send leave message:', err?.message ?? err);
          }
        }
      }

      // Members log.
      try {
        await client.logs.send(guild, LOG_TYPE, { embeds: [render.buildLeaveLog(client, guild, member)] });
      } catch (err) {
        log.debug('welcome: leave log failed:', err?.message ?? err);
      }
    } catch (err) {
      log.warn('welcome guildMemberRemove handler failed:', err?.message ?? err);
    }
  },
};
