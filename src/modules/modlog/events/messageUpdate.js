'use strict';

const { Events } = require('discord.js');
const log = require('../../../core/logger');
const { truncate } = require('../../../core/utils');
const logs = require('../services/logs');

/** Log message edits (before/after) to 'messages'. */
module.exports = {
  event: Events.MessageUpdate,

  async execute(client, oldMessage, newMessage) {
    try {
      const guild = newMessage.guild ?? (newMessage.guildId ? client.guilds.cache.get(newMessage.guildId) : null);
      if (!guild) return;
      if (!client.logs.channelIdFor(guild.id, 'messages')) return;
      if (newMessage.author?.bot) return;

      const before = oldMessage?.content ?? null;
      const after = newMessage?.content ?? null;
      // Ignore non-content updates (embeds resolving, pins, etc.) and no-op edits.
      if (before !== null && after !== null && before === after) return;
      if (before === null && after === null) return;

      const link = newMessage.url ? `[Jump to message](${newMessage.url})` : null;
      const embed = logs.logEmbed(client, guild, {
        colorKind: 'warning',
        emoji: '✏️',
        title: 'Message edited',
        actor: newMessage.author ?? null,
        fields: [
          { name: 'Author', value: newMessage.author ? `<@${newMessage.author.id}> (\`${newMessage.author.id}\`)` : 'Unknown', inline: true },
          { name: 'Channel', value: newMessage.channelId ? `<#${newMessage.channelId}>` : 'Unknown', inline: true },
          { name: 'Before', value: before !== null ? truncate(before || '*empty*', 1024) : '*(not cached)*', inline: false },
          { name: 'After', value: after !== null ? truncate(after || '*empty*', 1024) : '*(unavailable)*', inline: false },
          ...(link ? [{ name: 'Link', value: link, inline: false }] : []),
        ],
      });
      await client.logs.send(guild, 'messages', { embeds: [embed] });
    } catch (err) {
      log.debug('modlog messageUpdate failed:', err?.message ?? err);
    }
  },
};
