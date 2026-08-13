'use strict';

const { Events, AuditLogEvent } = require('discord.js');
const engine = require('../services/engine');

/** Anti-nuke: repeated bulk message deletions (channel purges). */
module.exports = {
  event: Events.MessageBulkDelete,

  async execute(client, messages, channel) {
    const guild = channel?.guild;
    if (!guild || !engine.isEnabled(client, guild.id)) return;

    // MessageBulkDelete audit entries target the channel the purge happened in.
    const attr = await engine.attribute(guild, AuditLogEvent.MessageBulkDelete, channel.id);
    await engine.recordAction(client, guild, 'bulkDelete', attr.executorId, {
      summary: `Bulk-deleted **${messages?.size ?? '?'}** message(s) in <#${channel.id}>`,
      attributionNote: attr.reason,
    });
  },
};
