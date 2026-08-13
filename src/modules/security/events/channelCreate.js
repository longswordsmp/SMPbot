'use strict';

const { Events, AuditLogEvent } = require('discord.js');
const engine = require('../services/engine');

/** Anti-nuke: mass channel creation detection (spam-channel raids). */
module.exports = {
  event: Events.ChannelCreate,

  async execute(client, channel) {
    const guild = channel?.guild;
    if (!guild || !engine.isEnabled(client, guild.id)) return;

    const attr = await engine.attribute(guild, AuditLogEvent.ChannelCreate, channel.id);
    await engine.recordAction(client, guild, 'channelCreate', attr.executorId, {
      summary: `Created channel **#${channel.name ?? 'unknown'}** (\`${channel.id}\`)`,
      attributionNote: attr.reason,
    });
  },
};
