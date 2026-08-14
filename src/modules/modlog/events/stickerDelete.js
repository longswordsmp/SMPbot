'use strict';

const { Events, AuditLogEvent } = require('discord.js');
const log = require('../../../core/logger');
const { truncate } = require('../../../core/utils');
const logs = require('../services/logs');

/** Log sticker removals to 'server'. */
module.exports = {
  event: Events.GuildStickerDelete,

  async execute(client, sticker) {
    try {
      const guild = sticker?.guild;
      if (!guild) return;
      if (!client.logs.channelIdFor(guild.id, 'server')) return;

      const attr = await logs.attribute(guild, AuditLogEvent.StickerDelete, sticker.id);
      const embed = logs.logEmbed(client, guild, {
        colorKind: 'error',
        emoji: '🗑️',
        title: 'Sticker removed',
        fields: [
          { name: 'Sticker', value: `${truncate(sticker.name ?? 'unknown', 100)} (\`${sticker.id}\`)`, inline: true },
          logs.executorField(attr),
        ],
      });
      await client.logs.send(guild, 'server', { embeds: [embed] });
    } catch (err) {
      log.debug('modlog stickerDelete failed:', err?.message ?? err);
    }
  },
};
