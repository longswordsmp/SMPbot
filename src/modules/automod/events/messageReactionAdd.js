'use strict';

const { Events } = require('discord.js');
const log = require('../../../core/logger');
const { getConfig, bounded, boundedAction } = require('../services/settings');
const pipeline = require('../services/pipeline');

/**
 * Mass-reaction protection: count reactions added per user in a sliding window
 * and enforce the configured action when the flood threshold is exceeded. The
 * offending reaction is removed (best effort) before enforcement. Reuses the
 * shared pipeline exemptions and enforcement so behavior matches the message
 * pass. Partial reactions/messages are fetched first.
 */
module.exports = {
  event: Events.MessageReactionAdd,

  async execute(client, reaction, user) {
    try {
      if (!user || user.bot) return;
      if (user.id === client.user?.id) return;

      if (reaction.partial) {
        try {
          await reaction.fetch();
        } catch {
          return;
        }
      }
      let message = reaction.message;
      if (message?.partial) {
        try {
          message = await message.fetch();
        } catch {
          return;
        }
      }
      const guild = message?.guild;
      if (!guild) return;

      const cfg = getConfig(client, guild.id);
      if (!cfg.enabled) return;
      const node = cfg.spam?.reactions ?? {};
      if (!node.enabled) return;

      if (pipeline.channelWhitelisted(cfg, message.channel)) return;
      const member = await guild.members.fetch(user.id).catch(() => null);
      if (pipeline.memberExempt(client, cfg, guild, member)) return;

      const windowMs = bounded(node.windowSeconds, 10, 2, 600) * 1000;
      const max = bounded(node.maxReactions, 15, 3, 200);
      const n = client.cooldowns.count(`automod:react:${guild.id}:${user.id}`, windowMs);
      if (n <= max) return;

      // One enforcement per user per window — avoid punishing every reaction.
      if (client.cooldowns.hit(`automod:reacttrip:${guild.id}:${user.id}`, Math.round(windowMs / 1000)) > 0) return;

      try {
        await reaction.users.remove(user.id);
      } catch (err) {
        log.debug(`automod: reaction remove failed in guild ${guild.id}:`, err?.message ?? err);
      }

      const violation = {
        key: 'reactions',
        rule: 'spam.reactions',
        label: 'Mass reactions',
        action: boundedAction(node.action, 'warn'),
        reason: `${n} reactions in ${Math.round(windowMs / 1000)}s (limit ${max})`,
      };
      await pipeline.applyAction(client, {
        guild,
        member,
        user,
        channel: message.channel,
        cfg,
        violation,
        context: {},
      });
    } catch (err) {
      log.error('automod: reaction handler failed:', err);
    }
  },
};
