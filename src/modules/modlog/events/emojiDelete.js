'use strict';

const { Events, AuditLogEvent } = require('discord.js');
const log = require('../../../core/logger');
const { truncate } = require('../../../core/utils');
const logs = require('../services/logs');

/** Log emoji removals to 'server'. */
module.exports = {
  event: Events.GuildEmojiDelete,

  async execute(client, emoji) {
    try {
      const guild = emoji?.guild;
      if (!guild) return;
      if (!client.logs.channelIdFor(guild.id, 'server')) return;

      const attr = await logs.attribute(guild, AuditLogEvent.EmojiDelete, emoji.id);
      const embed = logs.logEmbed(client, guild, {
        colorKind: 'error',
        emoji: '🗑️',
        title: 'Emoji removed',
        fields: [
          { name: 'Emoji', value: `\`:${truncate(emoji.name ?? 'unknown', 100)}:\` (\`${emoji.id}\`)`, inline: true },
          logs.executorField(attr),
        ],
      });
      await client.logs.send(guild, 'server', { embeds: [embed] });
    } catch (err) {
      log.debug('modlog emojiDelete failed:', err?.message ?? err);
    }
  },
};
