'use strict';

const { Events, AuditLogEvent } = require('discord.js');
const log = require('../../../core/logger');
const { truncate } = require('../../../core/utils');
const logs = require('../services/logs');

/** Log channel deletion to 'channels' with best-effort executor attribution. */
module.exports = {
  event: Events.ChannelDelete,

  async execute(client, channel) {
    try {
      const guild = channel?.guild;
      if (!guild) return;
      if (!client.logs.channelIdFor(guild.id, 'channels')) return;

      const attr = await logs.attribute(guild, AuditLogEvent.ChannelDelete, channel.id);
      const embed = logs.logEmbed(client, guild, {
        colorKind: 'error',
        emoji: '🗑️',
        title: 'Channel deleted',
        fields: [
          { name: 'Channel', value: `#${truncate(channel.name ?? 'unknown', 100)} (\`${channel.id}\`)`, inline: true },
          logs.executorField(attr),
        ],
      });
      await client.logs.send(guild, 'channels', { embeds: [embed] });
    } catch (err) {
      log.debug('modlog channelDelete failed:', err?.message ?? err);
    }
  },
};
