'use strict';

const { Events, AuditLogEvent } = require('discord.js');
const { hasDangerousPermissions, dangerousPermissionNames } = require('../../../core/permissions');
const engine = require('../services/engine');

/** Anti-nuke: mass role creation detection. */
module.exports = {
  event: Events.GuildRoleCreate,

  async execute(client, role) {
    const guild = role?.guild;
    if (!guild || !engine.isEnabled(client, guild.id)) return;

    const dangerous = hasDangerousPermissions(role.permissions)
      ? ` — carries dangerous permissions: ${dangerousPermissionNames(role.permissions).join(', ')}`
      : '';
    const attr = await engine.attribute(guild, AuditLogEvent.RoleCreate, role.id);
    await engine.recordAction(client, guild, 'roleCreate', attr.executorId, {
      summary: `Created role **${role.name ?? 'unknown'}** (\`${role.id}\`)${dangerous}`,
      attributionNote: attr.reason,
    });
  },
};
