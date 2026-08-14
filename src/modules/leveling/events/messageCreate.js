'use strict';

const { Events } = require('discord.js');
const log = require('../../../core/logger');
const engine = require('../services/engine');

/**
 * Award XP for a qualifying message, then handle level-ups (role rewards +
 * branded announcement). Anti-farming: bots never earn XP; messages shorter
 * than the configured length (after stripping emoji/whitespace) are ignored;
 * identical consecutive messages are ignored; no-XP channels/roles are ignored;
 * a per-user cooldown and a daily UTC cap are enforced. One DB write per grant.
 */
module.exports = {
  event: Events.MessageCreate,

  async execute(client, message) {
    try {
      // Guild text only; never credit bots, system messages, or webhook posts.
      if (!message?.guild || !message.author) return;
      if (message.author.bot || message.system || message.webhookId) return;
      if (typeof message.content !== 'string' || !message.content) return;

      const guild = message.guild;
      const userId = message.author.id;
      const cfg = engine.config(client, guild.id);
      if (!cfg.enabled) return;

      // No-XP channels (match the channel or its parent category / thread parent).
      const noXpChannels = Array.isArray(cfg.noXpChannels) ? cfg.noXpChannels : [];
      if (noXpChannels.length) {
        const ch = message.channel;
        const ids = [ch?.id, ch?.parentId, ch?.parent?.parentId].filter(Boolean);
        if (ids.some((id) => noXpChannels.includes(id))) return;
      }

      // Use the member from the gateway payload only — never fetch on the hot
      // path. A missing member simply means role checks/multipliers degrade.
      const member = message.member?.roles?.cache ? message.member : null;

      const noXpRoles = Array.isArray(cfg.noXpRoles) ? cfg.noXpRoles : [];
      if (member && noXpRoles.length && noXpRoles.some((id) => member.roles.cache.has(id))) return;

      // Anti-farming: minimum meaningful length after stripping emoji/whitespace.
      const minLen = Number(cfg.minMessageLength) || 0;
      if (minLen > 0 && engine.meaningfulLength(message.content) < minLen) return;

      const now = Date.now();
      const row = engine.getUser(client, guild.id, userId);

      // Per-user cooldown (durable via last_message_at).
      const cooldownMs = (Number(cfg.cooldownSeconds) || 0) * 1000;
      if (row && cooldownMs > 0 && now - Number(row.last_message_at || 0) < cooldownMs) return;

      // Ignore identical consecutive messages.
      const hash = engine.contentHash(message.content);
      if (hash && row?.last_hash && row.last_hash === hash) return;

      // Daily cap (resets by UTC date-string comparison).
      const today = engine.utcDateString(now);
      let dailyXp = Number(row?.daily_xp ?? 0);
      if (row?.last_daily_date !== today) dailyXp = 0;
      const cap = Number(cfg.dailyCap) || 0;
      if (cap > 0 && dailyXp >= cap) return;

      // Compute the grant with the best applicable multiplier (max, not product).
      const base = engine.randomInt(cfg.minXp, cfg.maxXp);
      const multiplier = engine.multiplierFor(cfg, member);
      let gain = Math.round(base * multiplier);
      if (cap > 0) gain = Math.min(gain, cap - dailyXp);
      if (gain <= 0) return;

      const newDaily = dailyXp + gain;
      const { oldXp, newXp } = engine.grantMessageXp(client, guild.id, userId, {
        gain,
        newDaily,
        today,
        now,
        hash,
        oldXp: Number(row?.xp ?? 0),
      });

      const oldLevel = engine.levelForXp(oldXp);
      const newLevel = engine.levelForXp(newXp);
      if (newLevel <= oldLevel) return;

      // Level up: reward roles (fetch the member only now), announce, and log.
      let roleMember = member;
      if (!roleMember?.roles?.cache) {
        roleMember = await guild.members.fetch(userId).catch(() => null);
      }
      if (roleMember) {
        await engine.syncMemberRoles(client, guild, roleMember, newLevel);
      }
      await engine.announceLevelUp(client, guild, message.channel, message.author, oldLevel, newLevel);

      try {
        const logEmbed = client.brand
          .embed(guild, { color: 'info' })
          .setTitle('📈 Level up')
          .setDescription(`<@${userId}> reached **level ${newLevel}** (from ${oldLevel}).`);
        await client.logs.send(guild, engine.LOG_TYPE, { embeds: [logEmbed] });
      } catch (err) {
        log.debug('leveling: level-up log failed:', err?.message ?? err);
      }
    } catch (err) {
      log.warn('leveling messageCreate handler failed:', err?.message ?? err);
    }
  },
};
