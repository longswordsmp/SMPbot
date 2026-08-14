'use strict';

const { Events, AuditLogEvent } = require('discord.js');
const log = require('../../../core/logger');
const logs = require('../services/logs');

/** Log channel creation to 'channels' with best-effort executor attribution. */
module.exports = {
  event: Events.ChannelCreate,

  async execute(client, channel) {
    try {
      const guild = channel?.guild;
      if (!guild) return;
      if (!client.logs.channelIdFor(guild.id, 'channels')) return;

      const attr = await logs.attribute(guild, AuditLogEvent.ChannelCreate, channel.id);
      const embed = logs.logEmbed(client, guild, {
        colorKind: 'success',
        emoji: '📁',
        title: 'Channel created',
        fields: [
          { name: 'Channel', value: `<#${channel.id}> (\`${channel.id}\`)`, inline: true },
          logs.executorField(attr),
        ],
      });
      await client.logs.send(guild, 'channels', { embeds: [embed] });
    } catch (err) {
      log.debug('modlog channelCreate failed:', err?.message ?? err);
    }
  },
};
