'use strict';

const { Events, AuditLogEvent } = require('discord.js');
const engine = require('../services/engine');

/** Anti-nuke: mass channel deletion detection (+ restore-from-backup hints). */
module.exports = {
  event: Events.ChannelDelete,

  async execute(client, channel) {
    const guild = channel?.guild;
    if (!guild || !engine.isEnabled(client, guild.id)) return;

    // Remember the deletion so a triggered incident can restore it from backup.
    engine.trackDeletion(guild.id, 'channel', { id: channel.id, name: channel.name });

    const attr = await engine.attribute(guild, AuditLogEvent.ChannelDelete, channel.id);
    await engine.recordAction(client, guild, 'channelDelete', attr.executorId, {
      summary: `Deleted channel **#${channel.name ?? 'unknown'}** (\`${channel.id}\`)`,
      restoreKind: 'channel',
      attributionNote: attr.reason,
    });
  },
};
