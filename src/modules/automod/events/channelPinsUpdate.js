'use strict';

const { Events, AuditLogEvent, PermissionFlagsBits } = require('discord.js');
const log = require('../../../core/logger');
const { getConfig, bounded } = require('../services/settings');

/**
 * Excessive-pins detection (alert-only). ChannelPinsUpdate fires on pin AND
 * unpin without saying which, so this is a heuristic: when pin-update events in
 * a channel exceed the threshold in the window, staff are alerted via the
 * 'moderation' log with best-effort audit-log attribution of the pinner.
 */
module.exports = {
  event: Events.ChannelPinsUpdate,

  async execute(client, channel) {
    try {
      const guild = channel?.guild;
      if (!guild) return;

      const cfg = getConfig(client, guild.id);
      if (!cfg.enabled) return;
      const node = cfg.spam?.pins ?? {};
      if (!node.enabled) return;

      const windowMs = bounded(node.windowSeconds, 60, 5, 3600) * 1000;
      const max = bounded(node.maxPins, 4, 2, 50);
      const n = client.cooldowns.count(`automod:pins:${guild.id}:${channel.id}`, windowMs);
      if (n <= max) return;

      // One alert per channel per window.
      if (client.cooldowns.hit(`automod:pintrip:${guild.id}:${channel.id}`, Math.round(windowMs / 1000)) > 0) return;

      let executorId = null;
      try {
        const me = guild.members.me;
        if (me?.permissions?.has(PermissionFlagsBits.ViewAuditLog)) {
          const logs = await guild.fetchAuditLogs({ type: AuditLogEvent.MessagePin, limit: 5 });
          const entry = logs?.entries?.find((e) => Date.now() - e.createdTimestamp <= 15000) ?? null;
          executorId = entry?.executorId ?? entry?.executor?.id ?? null;
        }
      } catch (err) {
        log.debug(`automod: pin audit fetch failed in guild ${guild.id}:`, err?.message ?? err);
      }

      const embed = client.brand
        .embed(guild, { color: 'warning' })
        .setTitle('📌 Excessive pinning detected')
        .setDescription(`Unusual pin activity in <#${channel.id}>.`)
        .addFields(
          { name: 'Pin updates', value: `**${n}** within **${Math.round(windowMs / 1000)}s** (limit ${max})`, inline: true },
          {
            name: 'By',
            value: executorId ? `<@${executorId}> (\`${executorId}\`)` : 'Unknown (audit attribution unavailable)',
            inline: true,
          },
        );
      await client.logs.send(guild, 'moderation', { embeds: [embed] });
      log.warn(`automod: excessive pins in guild ${guild.id} channel ${channel.id} (${n})`);
    } catch (err) {
      log.error('automod: pins handler failed:', err);
    }
  },
};
