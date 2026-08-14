'use strict';

const { Events, AuditLogEvent } = require('discord.js');
const { hasDangerousPermissions, dangerousPermissionNames } = require('../../../core/permissions');
const engine = require('../services/engine');

/**
 * Anti-administrator-abuse:
 *  - mass timeouts (communication disabled) by one moderator
 *  - a member being handed a role that carries dangerous permissions
 */
module.exports = {
  event: Events.GuildMemberUpdate,

  async execute(client, oldMember, newMember) {
    const guild = newMember?.guild;
    if (!guild || !engine.isEnabled(client, guild.id)) return;
    if (newMember.id === client.user?.id) return;

    // --- Timeouts -----------------------------------------------------------
    const before = oldMember?.communicationDisabledUntilTimestamp ?? 0;
    const after = newMember?.communicationDisabledUntilTimestamp ?? 0;
    if (after && after > Date.now() && after !== before) {
      const attr = await engine.attribute(guild, AuditLogEvent.MemberUpdate, newMember.id);
      await engine.recordAction(client, guild, 'timeout', attr.executorId, {
        summary: `Timed out **${newMember.user?.tag ?? 'unknown user'}** (\`${newMember.id}\`)`,
        attributionNote: attr.reason,
      });
    }

    // --- Dangerous role grants ---------------------------------------------
    // Skip when the old state is partial — the role diff would be unreliable.
    if (oldMember?.partial) return;
    const addedRoles = newMember.roles.cache.filter((role) => !oldMember.roles.cache.has(role.id));
    if (!addedRoles.size) return;
    const dangerous = addedRoles.filter((role) => hasDangerousPermissions(role.permissions));
    if (!dangerous.size) return;

    const names = dangerous
      .map((role) => `**${role.name}** (${dangerousPermissionNames(role.permissions).join(', ')})`)
      .join('; ');
    const attr = await engine.attribute(guild, AuditLogEvent.MemberRoleUpdate, newMember.id);
    await engine.recordAction(client, guild, 'dangerousRoleGrant', attr.executorId, {
      summary: `**${newMember.user?.tag ?? 'unknown user'}** (\`${newMember.id}\`) was given dangerous role(s): ${names}`,
      attributionNote: attr.reason,
    });
  },
};
