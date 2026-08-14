'use strict';

const { Events, AuditLogEvent } = require('discord.js');
const log = require('../../../core/logger');
const { truncate, formatDuration } = require('../../../core/utils');
const logs = require('../services/logs');

/** Log meaningful channel edits (name, topic, nsfw, slowmode, category) to 'channels'. */
module.exports = {
  event: Events.ChannelUpdate,

  async execute(client, oldChannel, newChannel) {
    try {
      const guild = newChannel?.guild;
      if (!guild) return;
      if (!client.logs.channelIdFor(guild.id, 'channels')) return;

      const changes = [];
      if (oldChannel.name !== newChannel.name) {
        changes.push({ name: 'Name', value: `${truncate(oldChannel.name ?? '—', 100)} → ${truncate(newChannel.name ?? '—', 100)}`, inline: false });
      }
      if ((oldChannel.topic ?? '') !== (newChannel.topic ?? '')) {
        changes.push({ name: 'Topic', value: truncate(`${oldChannel.topic || '*none*'} → ${newChannel.topic || '*none*'}`, 1024), inline: false });
      }
      if (Boolean(oldChannel.nsfw) !== Boolean(newChannel.nsfw)) {
        changes.push({ name: 'Age-restricted', value: `${oldChannel.nsfw ? 'Yes' : 'No'} → ${newChannel.nsfw ? 'Yes' : 'No'}`, inline: true });
      }
      if ((oldChannel.rateLimitPerUser ?? 0) !== (newChannel.rateLimitPerUser ?? 0)) {
        const fmt = (s) => (s ? formatDuration(s * 1000) : 'off');
        changes.push({ name: 'Slowmode', value: `${fmt(oldChannel.rateLimitPerUser)} → ${fmt(newChannel.rateLimitPerUser)}`, inline: true });
      }
      if ((oldChannel.parentId ?? null) !== (newChannel.parentId ?? null)) {
        changes.push({
          name: 'Category',
          value: `${oldChannel.parentId ? `<#${oldChannel.parentId}>` : '*none*'} → ${newChannel.parentId ? `<#${newChannel.parentId}>` : '*none*'}`,
          inline: true,
        });
      }

      if (!changes.length) return;

      const attr = await logs.attribute(guild, AuditLogEvent.ChannelUpdate, newChannel.id);
      const embed = logs.logEmbed(client, guild, {
        colorKind: 'warning',
        emoji: '🔧',
        title: 'Channel updated',
        fields: [{ name: 'Channel', value: `<#${newChannel.id}>`, inline: true }, logs.executorField(attr), ...changes],
      });
      await client.logs.send(guild, 'channels', { embeds: [embed] });
    } catch (err) {
      log.debug('modlog channelUpdate failed:', err?.message ?? err);
    }
  },
};
