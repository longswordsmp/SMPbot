'use strict';

const { Events, AuditLogEvent } = require('discord.js');
const log = require('../../../core/logger');
const logs = require('../services/logs');

/** Log emoji additions to 'server'. */
module.exports = {
  event: Events.GuildEmojiCreate,

  async execute(client, emoji) {
    try {
      const guild = emoji?.guild;
      if (!guild) return;
      if (!client.logs.channelIdFor(guild.id, 'server')) return;

      const attr = await logs.attribute(guild, AuditLogEvent.EmojiCreate, emoji.id);
      const embed = logs.logEmbed(client, guild, {
        colorKind: 'success',
        emoji: '😀',
        title: 'Emoji added',
        fields: [
          { name: 'Emoji', value: `${emoji.toString?.() ?? ''} \`:${emoji.name}:\` (\`${emoji.id}\`)`, inline: true },
          logs.executorField(attr),
        ],
      });
      if (emoji.imageURL) embed.setThumbnail(emoji.imageURL());
      await client.logs.send(guild, 'server', { embeds: [embed] });
    } catch (err) {
      log.debug('modlog emojiCreate failed:', err?.message ?? err);
    }
  },
};
