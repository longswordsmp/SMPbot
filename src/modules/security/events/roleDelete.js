'use strict';

const { Events, AuditLogEvent } = require('discord.js');
const engine = require('../services/engine');

/** Anti-nuke: mass role deletion detection (+ restore-from-backup hints). */
module.exports = {
  event: Events.GuildRoleDelete,

  async execute(client, role) {
    const guild = role?.guild;
    if (!guild || !engine.isEnabled(client, guild.id)) return;

    engine.trackDeletion(guild.id, 'role', { id: role.id, name: role.name });

    const attr = await engine.attribute(guild, AuditLogEvent.RoleDelete, role.id);
    await engine.recordAction(client, guild, 'roleDelete', attr.executorId, {
      summary: `Deleted role **${role.name ?? 'unknown'}** (\`${role.id}\`)`,
      restoreKind: 'role',
      attributionNote: attr.reason,
    });
  },
};
