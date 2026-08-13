'use strict';

const { Events, AuditLogEvent, PermissionsBitField } = require('discord.js');
const { hasDangerousPermissions, dangerousPermissionNames } = require('../../../core/permissions');
const engine = require('../services/engine');

/**
 * Anti-administrator-abuse: detect a role being edited to gain dangerous
 * permissions (Administrator, Ban Members, Manage Roles, ...). Only the
 * ADDED permission bits are inspected — removing permissions is fine.
 */
module.exports = {
  event: Events.GuildRoleUpdate,

  async execute(client, oldRole, newRole) {
    const guild = newRole?.guild;
    if (!guild || !engine.isEnabled(client, guild.id)) return;

    const before = oldRole?.permissions?.bitfield ?? 0n;
    const after = newRole?.permissions?.bitfield ?? 0n;
    const addedBits = after & ~before;
    if (!addedBits) return;

    const added = new PermissionsBitField(addedBits);
    if (!hasDangerousPermissions(added)) return;

    const attr = await engine.attribute(guild, AuditLogEvent.RoleUpdate, newRole.id);
    await engine.recordAction(client, guild, 'permGrant', attr.executorId, {
      summary: `Role **${newRole.name ?? 'unknown'}** (\`${newRole.id}\`) was granted: ${dangerousPermissionNames(added).join(', ')}`,
      attributionNote: attr.reason,
    });
  },
};
