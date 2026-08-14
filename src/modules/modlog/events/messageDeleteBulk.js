'use strict';

const { Events, AttachmentBuilder } = require('discord.js');
const log = require('../../../core/logger');
const logs = require('../services/logs');

/** Log bulk message deletions (count + a .txt dump attachment) to 'messages'. */
module.exports = {
  event: Events.MessageBulkDelete,

  async execute(client, messages, channel) {
    try {
      const guild = channel?.guild ?? (messages?.first?.()?.guild ?? null);
      if (!guild) return;
      if (!client.logs.channelIdFor(guild.id, 'messages')) return;

      const list = [...messages.values()].sort((a, b) => (a.createdTimestamp ?? 0) - (b.createdTimestamp ?? 0));
      const lines = list.map((m) => {
        const when = m.createdTimestamp ? new Date(m.createdTimestamp).toISOString() : 'unknown-time';
        const who = m.author ? `${m.author.tag ?? m.author.username ?? 'unknown'} (${m.author.id})` : 'unknown author';
        const body = m.content || (m.attachments?.size ? `[${m.attachments.size} attachment(s)]` : '[no cached content]');
        return `[${when}] ${who}: ${body}`;
      });
      const dump = lines.join('\n') || 'No cached message content was available for the deleted messages.';

      const embed = logs.logEmbed(client, guild, {
        colorKind: 'error',
        emoji: '🧨',
        title: 'Bulk message delete',
        fields: [
          { name: 'Channel', value: channel?.id ? `<#${channel.id}>` : 'Unknown', inline: true },
          { name: 'Messages', value: `${messages.size}`, inline: true },
        ],
      });

      const files = [new AttachmentBuilder(Buffer.from(dump, 'utf8'), { name: `bulk-delete-${channel?.id ?? 'log'}.txt` })];
      await client.logs.send(guild, 'messages', { embeds: [embed], files });
    } catch (err) {
      log.debug('modlog messageDeleteBulk failed:', err?.message ?? err);
    }
  },
};
