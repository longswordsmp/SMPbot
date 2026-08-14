'use strict';

const { Events } = require('discord.js');
const log = require('../../../core/logger');
const { truncate } = require('../../../core/utils');
const logs = require('../services/logs');

/** Log deleted messages (author, channel, content, attachments) to 'messages'. */
module.exports = {
  event: Events.MessageDelete,

  async execute(client, message) {
    try {
      const guild = message.guild ?? (message.guildId ? client.guilds.cache.get(message.guildId) : null);
      if (!guild) return;
      if (!client.logs.channelIdFor(guild.id, 'messages')) return;
      // Skip bot / webhook messages (reduces noise; also avoids our own logs).
      if (message.author?.bot) return;

      const fields = [
        { name: 'Author', value: message.author ? `<@${message.author.id}> (\`${message.author.id}\`)` : 'Unknown', inline: true },
        { name: 'Channel', value: message.channelId ? `<#${message.channelId}>` : 'Unknown', inline: true },
      ];
      const content = message.content ? truncate(message.content, 1024) : message.partial ? '*(not cached — content unavailable)*' : '*No text content*';
      fields.push({ name: 'Content', value: content, inline: false });

      const attachments = message.attachments;
      if (attachments && attachments.size) {
        fields.push({
          name: `Attachments (${attachments.size})`,
          value: truncate([...attachments.values()].map((a) => `[${a.name || 'file'}](${a.url})`).join('\n'), 1024),
          inline: false,
        });
      }

      const embed = logs.logEmbed(client, guild, {
        colorKind: 'error',
        emoji: '🗑️',
        title: 'Message deleted',
        actor: message.author ?? null,
        fields,
      });
      await client.logs.send(guild, 'messages', { embeds: [embed] });
    } catch (err) {
      log.debug('modlog messageDelete failed:', err?.message ?? err);
    }
  },
};
