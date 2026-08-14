'use strict';

const { Events, AuditLogEvent } = require('discord.js');
const log = require('../../../core/logger');
const { truncate } = require('../../../core/utils');
const logs = require('../services/logs');

/** Log sticker renames to 'server'. */
module.exports = {
  event: Events.GuildStickerUpdate,

  async execute(client, oldSticker, newSticker) {
    try {
      const guild = newSticker?.guild;
      if (!guild) return;
      if (oldSticker?.name === newSticker?.name && oldSticker?.description === newSticker?.description) return;
      if (!client.logs.channelIdFor(guild.id, 'server')) return;

      const attr = await logs.attribute(guild, AuditLogEvent.StickerUpdate, newSticker.id);
      const fields = [
        { name: 'Sticker', value: `${truncate(newSticker.name ?? 'unknown', 100)} (\`${newSticker.id}\`)`, inline: true },
        logs.executorField(attr),
      ];
      if (oldSticker?.name !== newSticker?.name) {
        fields.push({ name: 'Name', value: `${truncate(oldSticker?.name ?? '—', 60)} → ${truncate(newSticker?.name ?? '—', 60)}`, inline: false });
      }
      const embed = logs.logEmbed(client, guild, { colorKind: 'warning', emoji: '✏️', title: 'Sticker updated', fields });
      await client.logs.send(guild, 'server', { embeds: [embed] });
    } catch (err) {
      log.debug('modlog stickerUpdate failed:', err?.message ?? err);
    }
  },
};
