'use strict';

const { Events, AuditLogEvent } = require('discord.js');
const log = require('../../../core/logger');
const { truncate } = require('../../../core/utils');
const logs = require('../services/logs');

/** Log emoji renames to 'server'. */
module.exports = {
  event: Events.GuildEmojiUpdate,

  async execute(client, oldEmoji, newEmoji) {
    try {
      const guild = newEmoji?.guild;
      if (!guild) return;
      if (oldEmoji?.name === newEmoji?.name) return;
      if (!client.logs.channelIdFor(guild.id, 'server')) return;

      const attr = await logs.attribute(guild, AuditLogEvent.EmojiUpdate, newEmoji.id);
      const embed = logs.logEmbed(client, guild, {
        colorKind: 'warning',
        emoji: '✏️',
        title: 'Emoji renamed',
        fields: [
          { name: 'Emoji', value: `${newEmoji.toString?.() ?? ''} (\`${newEmoji.id}\`)`, inline: true },
          logs.executorField(attr),
          { name: 'Name', value: `\`:${truncate(oldEmoji.name ?? '—', 60)}:\` → \`:${truncate(newEmoji.name ?? '—', 60)}:\``, inline: false },
        ],
      });
      await client.logs.send(guild, 'server', { embeds: [embed] });
    } catch (err) {
      log.debug('modlog emojiUpdate failed:', err?.message ?? err);
    }
  },
};
